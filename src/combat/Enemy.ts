import { loadModelOrWarn, ModelRig, yawToRotation } from '../models/ModelRig';
import { MissingModelPlaceholder } from '../models/Placeholder';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Group } from 'three';
import type { EnemyDef } from '../data/enemies';
import { PALETTE } from '../render/palette';
import type { WorldQuery } from '../player/CharacterController';
import { EnemyBrain, type EnemyState } from './EnemyBrain';
import type { BossAttack, BossAttackKind } from '../data/enemies';
import { ELEMENT_COLOR, tickAura, type Aura } from './Elements';

export type EnemyAction = { kind: 'melee' } | { kind: 'bolt' } | { kind: 'boss'; attack: BossAttackKind } | null;

let nextId = 1;

/** Seconds the body stays before it shrinks away, when the death clip gives no better answer. */
const DEATH_HOLD = 1.4;
const DEATH_HOLD_MAX = 4;

/** Scene-side enemy: a Meshy model (or a placeholder marker), movement, hit reactions, aura and defence debuff bookkeeping. */
export class Enemy {
  readonly id = nextId++;
  readonly object = new Group();
  readonly brain: EnemyBrain;
  pos: { x: number; y: number; z: number };
  yaw = 0;
  hp: number;
  aura: Aura | null = null;
  defDown = { amount: 0, left: 0 };
  private knock = { x: 0, z: 0 };
  private flashLeft = 0;
  private deadFor = 0;
  private time = 0;
  private stepPhase = 0;
  /** Set by the combat system: dust + shake on heavy footsteps and slams. */
  onStomp?: (x: number, y: number, z: number) => void;
  /** The boss attack chosen for the current windup. */
  currentAttack: BossAttack | null = null;
  private orbitAngle = Math.random() * Math.PI * 2;
  /** Set by the combat system when a bolt-summoned minion should vanish for good. */
  noRespawn = false;
  model: ModelRig | null = null;
  private placeholder: MissingModelPlaceholder | null = null;
  private lastState: EnemyState = 'idle';
  /** Walking back to its spot after losing the player (it heals and ignores the player on the way). */
  returning = false;
  /** How far from its spot this enemy will follow (its def's leash, or a default by size). */
  readonly territory: number;

  constructor(readonly def: EnemyDef, readonly spawn: { x: number; z: number }, private readonly world: WorldQuery) {
    this.brain = new EnemyBrain({ ...def.brain });
    this.hp = def.maxHp;
    this.pos = { x: spawn.x, y: world.heightAt(spawn.x, spawn.z) + def.hover, z: spawn.z };
    this.territory = def.leash ?? (def.boss ? 30 : 22);
    if (def.scale) this.object.scale.setScalar(def.scale);
    this.object.position.set(this.pos.x, this.pos.y, this.pos.z);
    void loadModelOrWarn(def.kind, def.name).then((g) => { if (g) this.useModel(def.kind, g); else this.showPlaceholder(); });
  }

  private showPlaceholder(): void {
    if (this.model || this.placeholder) return;
    this.placeholder = new MissingModelPlaceholder(ELEMENT_COLOR[this.def.element]);
    this.object.add(this.placeholder.group);
  }

  /** Installs the loaded glTF as the body (its own material copies, so hit flashes stay per enemy). */
  useModel(id: string, gltf: GLTF): void {
    if (this.placeholder) { this.object.remove(this.placeholder.group); this.placeholder = null; }
    if (this.model) this.object.remove(this.model.root);
    this.model = new ModelRig(id, gltf, { cloneMaterials: true });
    this.object.add(this.model.root);
    this.object.scale.setScalar(1);
    if (!this.alive) this.model.play('death', true);
  }

  get alive(): boolean {
    return this.brain.state !== 'dead';
  }

  get state(): EnemyState {
    return this.brain.state;
  }

  get aggro(): boolean {
    const s = this.brain.state;
    return !this.returning && (s === 'chase' || s === 'windup' || s === 'attack' || s === 'recover');
  }

  /** Gives up the chase: back to its spot, healing on the way (portals, leaving its territory, the player dying). */
  disengage(): void {
    if (!this.alive || this.returning) return;
    if (this.aggro) this.returning = true;
    this.brain.state = 'idle';
    this.brain.stateTime = 0;
    this.currentAttack = null;
  }

  /** Advance AI + movement. Returns an action the combat system must resolve this step. */
  update(dt: number, player: { x: number; y: number; z: number }): EnemyAction {
    this.time += dt;
    this.aura = tickAura(this.aura, dt);
    if (this.defDown.left > 0) {
      this.defDown.left -= dt;
      if (this.defDown.left <= 0) this.defDown = { amount: 0, left: 0 };
    }
    if (!this.alive) {
      this.deadFor += dt;
      if (this.deadFor >= this.def.respawn) this.respawn();
      return null;
    }
    // Out of its territory (or out of this world, through a portal): walk home and heal.
    const playerFromHome = Math.hypot(player.x - this.spawn.x, player.z - this.spawn.z);
    if (this.aggro && (playerFromHome > this.territory + this.def.brain.aggroRange * 0.5 || Math.abs(player.y - this.pos.y) > 60)) this.disengage();
    if (this.returning) return this.walkHome(dt);
    const dx = player.x - this.pos.x;
    const dz = player.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    // Bosses choose their next attack before the brain enters windup, so the windup length matches it.
    if (this.def.attacks && this.brain.state === 'chase' && this.brain.cooldownLeft <= 0) {
      const usable = this.def.attacks.filter((a) => a.range >= dist);
      if (usable.length) {
        let total = usable.reduce((t, a) => t + a.weight, 0);
        let r = Math.random() * total;
        let pick = usable[0];
        for (const a of usable) { r -= a.weight; if (r <= 0) { pick = a; break; } }
        this.currentAttack = pick;
        this.brain.p.attackRange = pick.range;
        this.brain.p.windup = pick.windup;
        this.brain.p.recover = pick.recover;
      }
    }
    const state = this.brain.update(dt, dist);
    let action: EnemyAction = null;
    if (state === 'attack') {
      if (this.def.attacks && this.currentAttack) {
        action = { kind: 'boss', attack: this.currentAttack.kind };
        if ((this.currentAttack.kind === 'charge' || this.currentAttack.kind === 'bite') && dist > 0.01) {
          const push = this.currentAttack.kind === 'charge' ? 18 : 8;
          this.knock.x += (dx / dist) * push;
          this.knock.z += (dz / dist) * push;
        }
      } else {
        action = { kind: 'melee' };
        if ((this.def.kind === 'beast' || this.def.kind === 'croc') && dist > 0.01) {
          this.knock.x += (dx / dist) * 9;
          this.knock.z += (dz / dist) * 9;
        }
      }
    }

    // Facing and movement.
    if (state === 'chase' || state === 'windup' || state === 'recover') this.yaw = Math.atan2(dz, dx);
    let mx = 0;
    let mz = 0;
    if (state === 'chase' && dist > 0.01) {
      const ux = dx / dist;
      const uz = dz / dist;
      const pref = this.def.brain.preferredRange ?? 0;
      if (pref > 0) {
        if (dist > pref + 1.5) { mx = ux; mz = uz; }
        else if (dist < pref - 2) { mx = -ux; mz = -uz; }
        else { mx = -uz * 0.6; mz = ux * 0.6; } // strafe
      } else {
        mx = ux;
        mz = uz;
      }
    }
    if (this.def.flying && (state === 'chase' || state === 'recover')) {
      // Circle the player at the preferred range, banking.
      this.orbitAngle += dt * 0.55;
      const pref = this.def.brain.preferredRange ?? 14;
      const tx = player.x + Math.cos(this.orbitAngle) * pref;
      const tz = player.z + Math.sin(this.orbitAngle) * pref;
      const ddx = tx - this.pos.x;
      const ddz = tz - this.pos.z;
      const dd = Math.hypot(ddx, ddz) || 1;
      mx = ddx / dd;
      mz = ddz / dd;
      this.yaw = Math.atan2(mz, mx);
    }
    let nx = this.pos.x + (mx * this.def.speed + this.knock.x) * dt;
    let nz = this.pos.z + (mz * this.def.speed + this.knock.z) * dt;
    {
      const lx = nx - this.spawn.x;
      const lz = nz - this.spawn.z;
      const ld = Math.hypot(lx, lz);
      if (ld > this.territory) { nx = this.spawn.x + (lx / ld) * this.territory; nz = this.spawn.z + (lz / ld) * this.territory; }
    }
    this.stepTo(nx, nz, dt, this.def.flying ? Math.max(this.world.heightAt(this.pos.x, this.pos.z, this.pos.y), player.y) : null);
    return action;
  }

  /** Moves to (nx, nz) unless a wall or a drop is in the way (ground walkers never climb onto roofs), then settles. */
  private stepTo(nx: number, nz: number, dt: number, flyAt: number | null): void {
    const feet = this.pos.y - this.def.hover;
    const gNow = this.world.heightAt(this.pos.x, this.pos.z, feet);
    const ok = (x: number, z: number) => {
      const rise = this.world.heightAt(x, z, feet) - gNow;
      return rise < 1.2 && rise > -(2.5 + (this.def.boss ? 2 : 0));
    };
    if (this.def.flying || ok(nx, nz)) {
      this.pos.x = nx;
      this.pos.z = nz;
    } else {
      // Something in the way (a trunk, a wall, a drop): steer around it instead of pushing into it.
      const dx = nx - this.pos.x;
      const dz = nz - this.pos.z;
      for (const a of [0.7, -0.7, 1.4, -1.4]) {
        const c = Math.cos(a);
        const sn = Math.sin(a);
        const tx = this.pos.x + (dx * c - dz * sn) * 0.9;
        const tz = this.pos.z + (dx * sn + dz * c) * 0.9;
        if (ok(tx, tz)) { this.pos.x = tx; this.pos.z = tz; break; }
      }
    }
    const decay = Math.exp(-7 * dt);
    this.knock.x *= decay;
    this.knock.z *= decay;
    const bob = this.def.hover > 0 ? Math.sin(this.time * 2.4) * 0.25 : 0;
    const groundY = this.world.heightAt(this.pos.x, this.pos.z, feet);
    const targetY = (flyAt ?? groundY) + this.def.hover + bob;
    this.pos.y += (targetY - this.pos.y) * Math.min(1, dt * (this.def.flying ? 2 : 12));
  }

  /** Walks back to the spawn point, ignoring the player, healing as it goes. */
  private walkHome(dt: number): EnemyAction {
    const hx = this.spawn.x - this.pos.x;
    const hz = this.spawn.z - this.pos.z;
    const d = Math.hypot(hx, hz);
    this.hp = Math.min(this.def.maxHp, this.hp + this.def.maxHp * 0.25 * dt);
    this.aura = null;
    if (d < 1.2 || this.def.speed <= 0) {
      this.returning = false;
      this.hp = this.def.maxHp;
      this.brain.state = 'idle';
      return null;
    }
    this.yaw = Math.atan2(hz, hx);
    const v = Math.max(this.def.speed, 2) * 1.15;
    const step = Math.min(d, v * dt);
    const nx = this.pos.x + (hx / d) * step;
    const nz = this.pos.z + (hz / d) * step;
    const before = { x: this.pos.x, z: this.pos.z };
    this.stepTo(nx, nz, dt, null);
    // Stuck behind something on the way home: just appear back at the spot.
    if (this.pos.x === before.x && this.pos.z === before.z) { this.pos.x = this.spawn.x; this.pos.z = this.spawn.z; }
    return null;
  }

  takeDamage(amount: number, kb: { x: number; z: number }, strength: number): boolean {
    if (!this.alive) return false;
    this.hp -= amount;
    this.knock.x += kb.x * strength;
    this.knock.z += kb.z * strength;
    this.flashLeft = 0.09;
    if (this.hp <= 0) {
      this.hp = 0;
      this.brain.kill();
      this.deadFor = 0;
      return true;
    }
    return false;
  }

  private respawn(): void {
    if (this.noRespawn) return;
    this.returning = false;
    this.hp = this.def.maxHp;
    this.aura = null;
    this.defDown = { amount: 0, left: 0 };
    this.pos.x = this.spawn.x;
    this.pos.z = this.spawn.z;
    this.brain.state = 'idle';
    this.brain.stateTime = 0;
    this.lastState = 'idle';
    this.object.visible = true;
    this.object.scale.setScalar(this.model ? 1 : this.def.scale ?? 1);
    this.model?.play('idle');
  }

  /** Per-frame visuals. */
  /** `far`: beyond animation range, so the skeleton holds its pose (state, position and shrink still update). */
  animate(dt: number, far = false): void {
    this.object.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.flashLeft = Math.max(0, this.flashLeft - dt);
    if (this.model) {
      for (const m of this.model.materials) {
        if (this.flashLeft > 0) { m.emissive.set(PALETTE.moon); m.emissiveIntensity = 1.4; }
        else { m.emissive.set(m.userData.baseEmissive as number); m.emissiveIntensity = m.userData.baseIntensity as number; }
      }
    }
    const st: EnemyState = this.returning ? 'chase' : this.brain.state;
    const m = this.model;
    // State transitions first, so the death clip plays before the body shrinks away.
    if (m && st !== this.lastState) {
      if (st === 'windup') { if (!m.play(this.currentAttack?.kind === 'roar' ? 'roar' : 'attack', true)) m.play('attack', true); }
      else if (st === 'attack') { if (this.def.stomp) this.onStomp?.(this.pos.x, this.pos.y, this.pos.z); }
      else if (st === 'chase') { if (!m.play('walk')) m.play('idle'); }
      else if (st === 'idle') m.play('idle');
      else if (st === 'dead') { if (!m.play('death', true)) m.play('idle'); }
    }
    this.lastState = st;
    if (!this.alive) {
      // Hold the corpse while the death clip runs (or a short beat without one), then shrink it away.
      const clipRunning = !!m && m.playing === 'death' && !m.finished && this.deadFor < DEATH_HOLD_MAX;
      const hold = clipRunning || this.deadFor < DEATH_HOLD;
      const s = hold ? (m ? 1 : this.def.scale ?? 1) : Math.max(0, 1 - (this.deadFor - DEATH_HOLD) * 2.2);
      this.object.scale.setScalar(m ? s : s * (this.def.scale ?? 1));
      this.object.visible = s > 0;
      if (!far) m?.update(dt);
      return;
    }
    this.object.rotation.y = yawToRotation(this.yaw);
    if (!m) { this.placeholder?.update(dt); return; }
    if ((st === 'recover' || st === 'chase') && m.finished) { if (!m.play('walk')) m.play('idle'); }
    if (this.def.stomp && st === 'chase') {
      const prev = this.stepPhase;
      this.stepPhase += dt * (Math.PI * this.def.speed) / (this.def.height * 0.45);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) this.onStomp?.(this.pos.x, this.pos.y, this.pos.z);
    }
    if (!far) m.update(dt);
    // Models that came without clips (the seated Hollow King) still breathe.
    if (!m.playing) { const b = 1 + Math.sin(this.time * 0.9) * 0.012; m.root.scale.set(1, b, 1); }
  }
}

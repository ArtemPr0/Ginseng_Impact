import { loadModelOrWarn, ModelRig, yawToRotation } from '../models/ModelRig';
import { MissingModelPlaceholder } from '../models/Placeholder';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Group, type Object3D, Quaternion, type Sprite, Vector3 } from 'three';
import { glowSprite } from '../render/Glow';
import { LeanBubble } from '../render/LeanBubble';
import { patchTrippy } from '../render/Materials';
import type { EnemyDef } from '../data/enemies';
import { PALETTE } from '../render/palette';
import type { WorldQuery } from '../player/CharacterController';
import { EnemyBrain, type EnemyState } from './EnemyBrain';
import type { BossAttack, BossAttackKind } from '../data/enemies';
import { ELEMENT_COLOR, tickAura, type Aura } from './Elements';

export type EnemyAction = { kind: 'melee' } | { kind: 'boss'; attack: BossAttackKind } | null;

/**
 * What the heroes' bursts do to a mob (seconds left of each): dazed on the spot, stumbling about at random (it has
 * lost the hero), fighting another mob instead of the hero, and everything at a fraction (`slowBy`) of its pace.
 */
export interface Afflictions { stun: number; confuse: number; brawl: number; slow: number; slowBy: number }

let nextId = 1;

/** Seconds the body stays before it shrinks away, when the death clip gives no better answer. */
const DEATH_HOLD = 1.4;
const DEATH_HOLD_MAX = 4;
/** A heap of bones lies a while before it crumbles away. */
const HEAP_HOLD = 6;
/** Getting up off a seat. */
const STAND_UP = 1.4;

/** Where an enemy lives: its spot (which moves along a patrol route), facing, and route. */
export interface EnemyHome { x: number; z: number; yaw?: number; patrol?: ReadonlyArray<readonly [number, number]>; sitY?: number }

const _pq = new Quaternion();
const _wq = new Quaternion();
const _aq = new Quaternion();
const _fq = new Quaternion();
const _fwd = new Vector3();

/** Turns `bone` about a world axis from its pose now, returning the local rotation that results (not applied). */
function turnedAbout(bone: Object3D, axis: Vector3, angle: number, out = new Quaternion()): Quaternion {
  _pq.identity();
  bone.parent?.getWorldQuaternion(_pq);
  _wq.copy(_pq).multiply(bone.quaternion);
  _wq.premultiply(_aq.setFromAxisAngle(axis, angle));
  return out.copy(_pq.invert()).multiply(_wq);
}

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
  /** Called up by a boss: drops nothing, and leaves with its caster. */
  summoned = false;
  model: ModelRig | null = null;
  private placeholder: MissingModelPlaceholder | null = null;
  private lastState: EnemyState = 'idle';
  /** Animation bookkeeping: measured ground speed and direction, the one-shot clip in flight, procedural pose state. */
  private lastX = 0;
  private lastZ = 0;
  private lastYaw = 0;
  private groundSpeed = 0;
  private moveDirX = 0;
  private moveDirZ = 0;
  private stateClock = 0;
  private oneShot: 'attack' | 'hit' | 'death' | null = null;
  private wantFlinch = false;
  private lastFlinch = -10;
  private gaitPhase = Math.random() * 6;
  private lunge = 0;
  private flinch = 0;
  /** Walking back to its spot after losing the player (it heals and ignores the player on the way). */
  returning = false;
  /** How far from its spot this enemy will follow (its def's leash, or a default by size). */
  readonly territory: number;
  /** Sitting at its spot (seated mobs), and seconds left of getting up. */
  private seatedNow = false;
  private rising = 0;
  /** Neutral mobs fight only once hit. */
  private provoked = false;
  /** Patrol: which leg of the route it is walking. */
  private leg = 0;
  /** The heroes' bursts on this mob, the mob it has been turned on, and its stumbling while confused. */
  readonly status: Afflictions = { stun: 0, confuse: 0, brawl: 0, slow: 0, slowBy: 1 };
  brawlTarget: Enemy | null = null;
  private wanderYaw = 0;
  private wanderIn = 0;
  /** A body that is not a model (a living lean bubble), and its hop: seconds into the current leap. */
  private bubble: LeanBubble | null = null;
  private hopT = -1;
  private bob = Math.random() * 6;
  /** Little lights circling its head while it is dazed, confused or fighting its own (created on first need). */
  private halo: Sprite[] | null = null;
  /** The fall into a heap of bones (collapse mobs): each bone's pose from → to, and the body's tip. */
  private heap: { t: number; bones: Array<{ b: Object3D; from: Quaternion; to: Quaternion; delay: number }>; tipAxis: Vector3; drop: number } | null = null;

  constructor(readonly def: EnemyDef, readonly spawn: EnemyHome, private readonly world: WorldQuery) {
    this.brain = new EnemyBrain({ ...def.brain });
    this.hp = def.maxHp;
    // On the ground under any roof or deck (a seat inside a pavilion, not its dome).
    const ground = 'groundAt' in world ? (world as { groundAt(x: number, z: number): number }).groundAt(spawn.x, spawn.z) : undefined;
    this.pos = { x: spawn.x, y: Math.max(world.heightAt(spawn.x, spawn.z, ground), def.floatAt ?? -Infinity) + def.hover + (def.flyAbove ?? 0), z: spawn.z };
    this.territory = def.leash ?? (def.boss ? 30 : 22);
    this.lastX = this.pos.x;
    this.lastZ = this.pos.z;
    if (spawn.yaw !== undefined) this.yaw = spawn.yaw;
    if (def.seated && spawn.sitY !== undefined) this.pos.y = spawn.sitY;
    if (def.scale) this.object.scale.setScalar(def.scale);
    this.object.position.set(this.pos.x, this.pos.y, this.pos.z);
    if (def.body === 'bubble') { this.bubble = new LeanBubble(def.bodyRadius); this.object.add(this.bubble.group); return; }
    void loadModelOrWarn(def.kind, def.name).then((g) => { if (g) this.useModel(def.kind, g); else this.showPlaceholder(); });
  }

  /** Starts a leap (the 'hop' move): `seconds` of arc, as high as `height`. */
  leap(seconds: number, height: number): void {
    this.hopT = 0;
    this.hopLen = seconds;
    this.hopH = height;
  }

  private hopLen = 0.6;
  private hopH = 1.2;

  /** Height of the leap in progress above the ground (0 when not leaping). */
  private get hopLift(): number {
    if (this.hopT < 0) return 0;
    const k = Math.min(1, this.hopT / this.hopLen);
    return Math.sin(Math.PI * k) * this.hopH;
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
    if (this.def.trippy) for (const m of this.model.materials) patchTrippy(m);
    this.object.add(this.model.root);
    this.object.scale.setScalar(1);
    if (!this.alive) this.model.play('death', true);
  }

  get alive(): boolean {
    return this.brain.state !== 'dead';
  }

  /** Turned on another mob (Orlan's smoke), and that mob still stands. */
  get brawling(): boolean {
    return this.status.brawl > 0 && !!this.brawlTarget?.alive && this.brawlTarget !== this;
  }

  /** Lays an affliction on (the longer of what it has and `seconds`); a slow keeps the stronger factor. */
  afflict(kind: 'stun' | 'confuse' | 'brawl' | 'slow', seconds: number, slowBy = 1): void {
    if (!this.alive) return;
    const s = this.status;
    s[kind] = Math.max(s[kind], seconds);
    if (kind === 'slow') s.slowBy = Math.min(s.slow > 0 && s.slowBy < 1 ? s.slowBy : 1, slowBy);
    // Shaken out of a seat or a calm patrol.
    if (kind !== 'slow') { this.seatedNow = false; this.rising = 0; this.provoked = true; }
  }

  /** Pace of everything it does: 1, or the slow's fraction while slowed. */
  get pace(): number {
    return this.status.slow > 0 ? this.status.slowBy : 1;
  }

  get state(): EnemyState {
    return this.brain.state;
  }

  get aggro(): boolean {
    const s = this.brain.state;
    return !this.returning && (s === 'chase' || s === 'windup' || s === 'attack' || s === 'recover');
  }

  /** 0..1 of a lunge's push that still fits before the body would run into the player (a lunge stops at the target). */
  private lungeRoom(dist: number): number {
    return Math.max(0, Math.min(1, (dist - (this.def.bodyRadius + 1)) / 2.6));
  }

  /** Gives up the chase: back to its spot, healing on the way (portals, leaving its territory, the player dying). */
  disengage(): void {
    if (!this.alive || this.returning) return;
    this.provoked = false;
    if (this.aggro) this.returning = true;
    this.brain.state = 'idle';
    this.brain.stateTime = 0;
    this.currentAttack = null;
  }

  /** Advance AI + movement. Returns an action the combat system must resolve this step. */
  update(dt: number, player: { x: number; y: number; z: number }): EnemyAction {
    this.time += dt;
    this.aura = tickAura(this.aura, dt);
    const st = this.status;
    st.stun = Math.max(0, st.stun - dt);
    st.confuse = Math.max(0, st.confuse - dt);
    st.brawl = Math.max(0, st.brawl - dt);
    st.slow = Math.max(0, st.slow - dt);
    if (st.slow <= 0) st.slowBy = 1;
    if (st.brawl <= 0) this.brawlTarget = null;
    // Slowed: it moves, winds up and recovers at a fraction of its pace.
    dt *= this.pace;
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
    // (A boss that cannot walk, like the seated Hollow King, still holds the player anywhere within its reach.)
    const giveUp = Math.max(this.territory + this.def.brain.aggroRange * 0.75, this.def.brain.aggroRange * 1.25);
    if (this.aggro && (playerFromHome > giveUp || Math.abs(player.y - this.pos.y) > 60)) this.disengage();
    if (this.returning) return this.walkHome(dt);
    // Dazed: stands where it is (knockback still settles).
    if (st.stun > 0) { this.stepTo(this.pos.x, this.pos.z, dt, this.def.flying ? this.pos.y : null); return null; }
    // Confused (and not fighting another mob): it has lost the hero and stumbles about, changing its mind often.
    if (st.confuse > 0 && !this.brawling) {
      this.wanderIn -= dt;
      if (this.wanderIn <= 0) { this.wanderIn = 0.6 + Math.random() * 0.9; this.wanderYaw = Math.random() * Math.PI * 2; }
      this.yaw += Math.atan2(Math.sin(this.wanderYaw - this.yaw), Math.cos(this.wanderYaw - this.yaw)) * Math.min(1, dt * 4);
      const v = this.def.speed * 0.45;
      let nx = this.pos.x + (Math.cos(this.yaw) * v + this.knock.x) * dt;
      let nz = this.pos.z + (Math.sin(this.yaw) * v + this.knock.z) * dt;
      const lx = nx - this.spawn.x;
      const lz = nz - this.spawn.z;
      const ld = Math.hypot(lx, lz);
      if (ld > this.territory) { nx = this.spawn.x + (lx / ld) * this.territory; nz = this.spawn.z + (lz / ld) * this.territory; this.wanderIn = 0; }
      if (this.brain.state !== 'idle' && this.brain.state !== 'chase') { this.brain.state = 'chase'; this.brain.stateTime = 0; }
      this.stepTo(nx, nz, dt, this.def.flying ? this.pos.y : null);
      return null;
    }
    const dx = player.x - this.pos.x;
    const dz = player.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    // Seated at home: it sits facing its fire until the player comes near, then takes a moment to get up.
    if (this.def.seated && this.brain.state === 'idle') {
      if (!this.seatedNow && Math.hypot(this.pos.x - this.spawn.x, this.pos.z - this.spawn.z) < 1.3) { this.seatedNow = true; this.pos.x = this.spawn.x; this.pos.z = this.spawn.z; }
      if (this.seatedNow && this.spawn.sitY !== undefined) this.pos.y = this.spawn.sitY;
      if (this.seatedNow) {
        this.yaw = this.spawn.yaw ?? this.yaw;
        if (dist > this.brain.p.aggroRange) return null;
        this.seatedNow = false;
        this.rising = STAND_UP;
        this.brain.state = 'chase';
        this.brain.stateTime = 0;
      }
    }
    if (this.rising > 0) {
      this.rising -= dt;
      this.yaw += Math.atan2(Math.sin(Math.atan2(dz, dx) - this.yaw), Math.cos(Math.atan2(dz, dx) - this.yaw)) * Math.min(1, dt * 3);
      return null;
    }
    // Walking its route while nobody bothers it (its home moves with it).
    const calm = this.brain.state === 'idle' && !(this.def.neutral && this.provoked);
    if (calm && this.spawn.patrol && this.spawn.patrol.length > 1) {
      const [tx, tz] = this.spawn.patrol[this.leg % this.spawn.patrol.length];
      const hx = tx - this.pos.x;
      const hz = tz - this.pos.z;
      const hd = Math.hypot(hx, hz);
      if (hd < 0.8) this.leg++;
      else {
        this.yaw = Math.atan2(hz, hx);
        const step = Math.min(hd, this.def.speed * 0.55 * dt);
        this.stepTo(this.pos.x + (hx / hd) * step, this.pos.z + (hz / hd) * step, dt, this.def.flying && this.def.flyAbove ? this.flyHeight(-Infinity) : null);
        this.spawn.x = this.pos.x;
        this.spawn.z = this.pos.z;
      }
      if (this.def.neutral && !this.provoked) return null;
    }
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
    // A neutral mob does not see the player until it has been hit.
    const before = this.brain.state;
    const state = this.brain.update(dt, this.def.neutral && !this.provoked && !this.brawling ? Infinity : dist);
    // Lost the player (outran, out of sight): walk back to its spot and heal on the way, never idle where it stopped.
    if (before === 'chase' && state === 'idle' && Math.hypot(this.pos.x - this.spawn.x, this.pos.z - this.spawn.z) > 1.5) {
      this.provoked = false;
      this.returning = true;
      this.currentAttack = null;
      return null;
    }
    let action: EnemyAction = null;
    if (state === 'attack') {
      if (this.def.attacks && this.currentAttack) {
        action = { kind: 'boss', attack: this.currentAttack.kind };
        const k = this.currentAttack.kind;
        if (k === 'hop') this.leap(this.def.body ? 0.55 : 0.9, this.def.body ? 1.4 : 4);
        if ((k === 'charge' || k === 'bite' || k === 'hop') && dist > 0.01) {
          // (A leap carries it the whole way: it lands on you.)
          const push = (k === 'charge' ? 18 : k === 'hop' ? dist * 2.2 : 8) * (k === 'hop' ? 1 : this.lungeRoom(dist));
          this.knock.x += (dx / dist) * push;
          this.knock.z += (dz / dist) * push;
        }
      } else {
        action = { kind: 'melee' };
        if ((this.def.kind === 'beast' || this.def.kind === 'croc') && dist > 0.01) {
          const push = 9 * this.lungeRoom(dist);
          this.knock.x += (dx / dist) * push;
          this.knock.z += (dz / dist) * push;
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
      } else if (dist > this.def.brain.attackRange * 0.8) {
        // Melee: close in to striking distance and hold there while the next blow cools down.
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
    this.stepTo(nx, nz, dt, this.def.flying ? this.flyHeight(player.y) : null);
    return action;
  }

  /** Where a flyer holds itself: over the ground (or the void's floor) and the hero, by its `flyAbove` margin. */
  private flyHeight(playerY: number): number {
    const ground = Math.max(this.world.heightAt(this.pos.x, this.pos.z, this.pos.y), this.def.floatAt ?? -Infinity);
    return Math.max(ground, playerY) + (this.def.flyAbove ?? 0);
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
    const groundY = Math.max(this.world.heightAt(this.pos.x, this.pos.z, feet), this.def.floatAt ?? -Infinity);
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
    this.stepTo(nx, nz, dt, this.def.flying && this.def.flyAbove ? this.flyHeight(-Infinity) : null);
    // Stuck behind something on the way home: just appear back at the spot.
    if (this.pos.x === before.x && this.pos.z === before.z) { this.pos.x = this.spawn.x; this.pos.z = this.spawn.z; }
    return null;
  }

  takeDamage(amount: number, kb: { x: number; z: number }, strength: number): boolean {
    if (!this.alive) return false;
    // Hit: a neutral mob turns on you, a seated one jumps up at once.
    if (this.def.neutral && !this.provoked) { this.provoked = true; if (this.brain.state === 'idle') { this.brain.state = 'chase'; this.brain.stateTime = 0; } }
    if (this.seatedNow) { this.seatedNow = false; this.rising = STAND_UP * 0.6; this.brain.state = 'chase'; this.brain.stateTime = 0; }
    this.hp -= amount;
    this.knock.x += kb.x * strength;
    this.knock.z += kb.z * strength;
    this.flashLeft = 0.09;
    // Flinch: every hit for small mobs; bosses only now and then, so their attacks are not interrupted constantly.
    if (!this.def.boss || this.time - this.lastFlinch > 3) { this.wantFlinch = true; this.flinch = 1; this.lastFlinch = this.time; }
    if (this.hp <= 0) {
      this.hp = 0;
      this.brain.kill();
      this.deadFor = 0;
      Object.assign(this.status, { stun: 0, confuse: 0, brawl: 0, slow: 0, slowBy: 1 });
      this.brawlTarget = null;
      if (this.halo) for (const g of this.halo) g.visible = false;
      return true;
    }
    return false;
  }

  private respawn(): void {
    if (this.noRespawn) return;
    this.returning = false;
    this.provoked = false;
    this.seatedNow = false;
    this.rising = 0;
    // The bones were posed by hand: put them back before the clips take over (the mixer only rewrites changes).
    if (this.heap) for (const x of this.heap.bones) x.b.quaternion.copy(x.from);
    this.heap = null;
    this.oneShot = null;
    this.wantFlinch = false;
    this.lunge = this.flinch = 0;
    if (this.model) { this.model.root.rotation.set(0, 0, 0); this.model.root.position.set(0, 0, 0); }
    this.bubble?.reset();
    this.hopT = -1;
    this.hp = this.def.maxHp;
    this.aura = null;
    this.defDown = { amount: 0, left: 0 };
    this.pos.x = this.spawn.x;
    this.pos.z = this.spawn.z;
    this.brain.state = 'idle';
    this.brain.stateTime = 0;
    this.lastState = 'idle';
    this.object.visible = true;
    this.object.scale.setScalar(this.model || this.bubble ? 1 : this.def.scale ?? 1);
    this.model?.play('idle');
  }

  /** Per-frame visuals. */
  /** `far`: beyond animation range, so the skeleton holds its pose (state, position and shrink still update). */
  animate(dt: number, far = false): void {
    if (this.hopT >= 0) { this.hopT += dt; if (this.hopT >= this.hopLen) this.hopT = -1; }
    this.object.position.set(this.pos.x, this.pos.y + this.hopLift, this.pos.z);
    this.flashLeft = Math.max(0, this.flashLeft - dt);
    if (this.bubble) { this.animateBubble(dt); return; }
    if (this.model) {
      for (const m of this.model.materials) {
        if (this.flashLeft > 0) { m.emissive.set(PALETTE.moon); m.emissiveIntensity = 1.4; }
        else { m.emissive.set(m.userData.baseEmissive as number); m.emissiveIntensity = m.userData.baseIntensity as number; }
      }
    }
    // How fast and which way the body is actually travelling (drives the gait, not the intended speed).
    const mx = this.pos.x - this.lastX;
    const mz = this.pos.z - this.lastZ;
    this.lastX = this.pos.x;
    this.lastZ = this.pos.z;
    const inst = dt > 0 ? Math.hypot(mx, mz) / dt : 0;
    this.groundSpeed += (Math.min(inst, 30) - this.groundSpeed) * Math.min(1, dt * 8);
    if (inst > 0.05) { this.moveDirX = mx; this.moveDirZ = mz; }
    const yawRate = Math.atan2(Math.sin(this.yaw - this.lastYaw), Math.cos(this.yaw - this.lastYaw)) / Math.max(dt, 1e-4);
    this.lastYaw = this.yaw;

    const st: EnemyState = this.returning ? 'chase' : this.brain.state;
    const m = this.model;
    const entered = st !== this.lastState;
    if (entered) this.stateClock = 0;
    this.stateClock += dt;
    if (entered && st === 'attack') { this.lunge = 1; if (this.def.stomp) this.onStomp?.(this.pos.x, this.pos.y, this.pos.z); }
    if (m && m.hasClips) this.driveClips(m, st, entered);
    this.lastState = st;
    if (!this.alive) {
      if (this.heap) this.fallApart(dt);
      // Hold the corpse while the death clip runs (or a short beat without one), then shrink it away.
      const clipRunning = !!m && m.playing === 'death' && !m.finished && this.deadFor < DEATH_HOLD_MAX;
      const hold = clipRunning || this.deadFor < (this.heap ? HEAP_HOLD : DEATH_HOLD);
      const s = hold ? (m ? 1 : this.def.scale ?? 1) : Math.max(0, 1 - (this.deadFor - DEATH_HOLD) * 2.2);
      this.object.scale.setScalar(m ? s : s * (this.def.scale ?? 1));
      this.object.visible = s > 0;
      if (m && !m.hasClips) this.driveStatic(m, st, dt, yawRate);
      if (m) this.flapWings(m, dt);
      if (!far && !this.heap) m?.update(dt);
      return;
    }
    this.object.rotation.y = yawToRotation(this.yaw);
    if (!m) { this.placeholder?.update(dt); return; }
    if (this.def.stomp && st === 'chase' && this.groundSpeed > 0.4) {
      const prev = this.stepPhase;
      this.stepPhase += dt * (Math.PI * this.groundSpeed) / (this.def.height * 0.45);
      if (Math.floor(prev / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) this.onStomp?.(this.pos.x, this.pos.y, this.pos.z);
    }
    if (!m.hasClips) this.driveStatic(m, st, dt, yawRate);
    else {
      // Dazed: swaying on its feet.
      const daze = this.status.stun > 0 ? Math.sin(this.time * 5) * 0.09 : 0;
      m.root.rotation.z += (daze - m.root.rotation.z) * Math.min(1, dt * 8);
    }
    if (!far) this.flapWings(m, dt);
    if (!far) m.update(dt * this.pace);
    this.lunge = Math.max(0, this.lunge - dt * 2.8);
    this.flinch = Math.max(0, this.flinch - dt * 4);
    this.animateHalo(m.height);
  }

  /** A lean bubble: bobs in place, bounces along as it moves, stretches in a leap and squashes as it lands. */
  private animateBubble(dt: number): void {
    const b = this.bubble!;
    this.object.rotation.y = yawToRotation(this.yaw);
    if (!this.alive) {
      if (this.deadFor < 0.05) b.burst();
      b.update(dt, 0, 0, 0);
      this.object.visible = this.deadFor < 0.4;
      return;
    }
    const mx = this.pos.x - this.lastX;
    const mz = this.pos.z - this.lastZ;
    this.lastX = this.pos.x;
    this.lastZ = this.pos.z;
    const v = dt > 0 ? Math.hypot(mx, mz) / dt : 0;
    this.bob += dt * (3 + v * 2.5);
    const bounce = v > 0.4 && this.hopT < 0 ? Math.abs(Math.sin(this.bob)) * 0.35 : 0;
    let squash = Math.sin(this.bob * 0.5) * 0.06;
    if (this.hopT >= 0) { const k = this.hopT / this.hopLen; squash = k < 0.15 ? -0.5 + k * 4 : k > 0.85 ? -(k - 0.85) * 4 : 0.45; }
    else if (v > 0.4) squash = Math.cos(this.bob * 2) * 0.2;
    if (this.brain.state === 'windup') squash = -0.4 * Math.min(1, this.stateClock / 0.4);
    this.stateClock += dt;
    if (this.brain.state !== this.lastState) { this.stateClock = 0; this.lastState = this.brain.state; }
    b.update(dt, bounce, squash, this.flashLeft > 0 ? 1 : 0);
    this.animateHalo(this.def.height);
  }

  /** Lights circling the head: white stars when dazed, every colour when confused, red when it fights its own, lean when slowed. */
  private animateHalo(height: number): void {
    const s = this.status;
    const on = s.stun > 0 || s.confuse > 0 || s.brawl > 0 || s.slow > 0;
    if (!on && !this.halo) return;
    if (!this.halo) {
      this.halo = [];
      for (let i = 0; i < 4; i++) { const g = glowSprite(0xffffff, 0.3, 0.9, true); this.object.add(g); this.halo.push(g); }
    }
    const t = this.time;
    const r = Math.max(0.35, this.def.bodyRadius * 0.6);
    this.halo.forEach((g, i) => {
      g.visible = on;
      if (!on) return;
      const a = t * 3 + (i * Math.PI) / 2;
      g.position.set(Math.cos(a) * r, height + 0.25 + Math.sin(t * 4 + i) * 0.06, Math.sin(a) * r);
      const c = g.material.color;
      if (s.stun > 0) c.setHex(0xdfe6ff);
      else if (s.confuse > 0) c.setHSL((t * 0.6 + i / 4) % 1, 1, 0.6);
      else if (s.brawl > 0) c.setHex(0xff2a2a);
      else c.setHex(0xb36bff);
    });
  }

  /**
   * Clip choice for a rigged body. Attacks play the clip that suits the move, timed so its blow lands exactly when
   * the hit is dealt; the gait follows the real ground speed (walk or run, played faster or slower so the feet stay
   * planted, backwards when retreating); standing still shows the stance, never a walk in place.
   */
  private driveClips(m: ModelRig, st: EnemyState, entered: boolean): void {
    if (entered && st === 'dead') {
      if (this.def.collapse) { this.startHeap(m); return; }
      if (!m.play('death', true)) m.play('idle');
      this.oneShot = 'death';
      return;
    }
    if (st === 'dead') return;
    if (this.status.stun > 0) { m.play('idle', false, 0.35); this.oneShot = null; return; }
    if (this.seatedNow) { m.play('sit'); return; }
    if (this.rising > 0) { if (m.playing !== 'stand' && !m.play('stand', true, 1, STAND_UP)) m.play('idle'); return; }
    if (entered && st === 'windup') {
      const windup = this.brain.p.windup;
      for (const key of attackClips(this.currentAttack?.kind)) if (m.playStrike(key, windup)) { this.oneShot = 'attack'; return; }
    }
    if (this.wantFlinch) {
      this.wantFlinch = false;
      // Never during the wind-up (the blow is coming); the follow-through after the blow may be cut short.
      if (st !== 'windup' && st !== 'attack' && m.has('hit')) { m.play('hit', true, 1, 0.65); this.oneShot = 'hit'; return; }
    }
    // Let a swing or a flinch finish (a swing may give way once the body is on the move again).
    if (this.oneShot && !m.finished) {
      if (!(this.oneShot === 'hit' || (st === 'chase' && this.groundSpeed > 0.6))) return;
      if (this.oneShot === 'hit') return;
    }
    this.oneShot = null;
    if (st === 'windup' || st === 'attack') return;
    const v = this.groundSpeed;
    if (v < 0.35) {
      // Calm at home: the relaxed idle; facing the player: the combat stance.
      if (!(st === 'idle' && !this.returning && m.has('idle_02') && m.play('idle_02'))) m.play('idle');
      return;
    }
    // Pick the gait whose natural pace is nearest the real one, then match it exactly.
    let best = '';
    let bestScale = 1;
    let bestErr = Infinity;
    for (const key of ['walk', 'run', 'walking', 'running']) {
      const rate = m.strideSpeed(key);
      if (rate <= 0) continue;
      const scale = v / rate;
      const err = Math.abs(Math.log(scale));
      if (err < bestErr) { bestErr = err; best = key; bestScale = scale; }
    }
    if (!best) { m.play('idle'); return; }
    const fx = Math.cos(this.yaw);
    const fz = Math.sin(this.yaw);
    const len = Math.hypot(this.moveDirX, this.moveDirZ) || 1;
    const along = (this.moveDirX * fx + this.moveDirZ * fz) / len;
    const speed = Math.min(2.4, Math.max(0.45, bestScale)) * (along < -0.35 ? -1 : 1);
    m.play(best, false, speed);
  }

  /**
   * Death for a skeleton: the clip stops and the bones let go. The legs buckle and the hips drop, the spine slumps,
   * the arms and the skull flop loose, and the whole frame tips over onto the ground with a little bounce: a heap.
   */
  private startHeap(m: ModelRig): void {
    m.stopAll();
    m.root.updateWorldMatrix(true, true);
    const fq = m.frame.getWorldQuaternion(new Quaternion());
    const lat = new Vector3(1, 0, 0).applyQuaternion(fq);
    const fwd = new Vector3(0, 0, 1).applyQuaternion(fq);
    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const bones: Array<{ b: Object3D; from: Quaternion; to: Quaternion; delay: number }> = [];
    const add = (re: RegExp, axis: Vector3, angle: number, delay: number) => {
      const b = m.bone(re);
      if (b) bones.push({ b, from: b.quaternion.clone(), to: turnedAbout(b, axis, angle), delay });
    };
    add(/leftupleg$/i, lat, rand(-1.4, -0.9), 0);
    add(/rightupleg$/i, lat, rand(-1.4, -0.9), 0);
    add(/leftleg$/i, lat, rand(1.6, 2.2), 0);
    add(/rightleg$/i, lat, rand(1.6, 2.2), 0);
    add(/spine$/i, lat, rand(0.3, 0.6), 0.08);
    add(/spine1$/i, lat, rand(0.2, 0.5), 0.1);
    add(/spine2$/i, fwd, rand(-0.5, 0.5), 0.12);
    add(/neck$/i, new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize(), rand(0.6, 1.2), 0.2);
    add(/head$/i, new Vector3(rand(-1, 1), rand(-0.3, 0.3), rand(-1, 1)).normalize(), rand(0.8, 1.6), 0.25);
    for (const side of ['left', 'right']) {
      add(new RegExp(side + 'arm$', 'i'), new Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize(), rand(0.8, 1.6), 0.15);
      add(new RegExp(side + 'forearm$', 'i'), new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), rand(0.6, 1.4), 0.22);
      add(new RegExp(side + 'hand$', 'i'), new Vector3(rand(-1, 1), rand(-1, 1), rand(-1, 1)).normalize(), rand(0.5, 1.2), 0.3);
    }
    // Tip over sideways or backwards, whichever way it was going.
    const a = Math.random() * Math.PI * 2;
    this.heap = { t: 0, bones, tipAxis: new Vector3(Math.cos(a), 0, Math.sin(a)), drop: m.height * 0.32 };
    this.onCollapse?.(this.pos.x, this.pos.y, this.pos.z);
  }

  private fallApart(dt: number): void {
    const h = this.heap!;
    const m = this.model;
    if (!m) return;
    h.t += dt;
    for (const x of h.bones) {
      const k = Math.min(1, Math.max(0, (h.t - x.delay) / 0.45));
      // Gravity: slow to start, fast at the end, a small rebound once it lands.
      const e = k < 1 ? k * k : 1;
      const settle = k >= 1 ? Math.max(0, 1 - (h.t - x.delay - 0.45) / 0.25) * 0.06 * Math.sin((h.t - x.delay) * 30) : 0;
      x.b.quaternion.slerpQuaternions(x.from, x.to, Math.min(1, e + settle));
    }
    // The frame sinks as the legs give, then topples about its feet onto the ground.
    const sink = Math.min(1, h.t / 0.35);
    const tip = Math.min(1, Math.max(0, (h.t - 0.2) / 0.5));
    const te = tip * tip;
    const bounce = tip >= 1 ? Math.exp(-(h.t - 0.7) * 9) * Math.sin((h.t - 0.7) * 28) * 0.06 : 0;
    // (Sunk while the legs give; lifted back as it tips, so the heap lies on the ground, not under it.)
    m.root.position.y = -h.drop * sink * sink * (1 - te) + 0.06 * te;
    m.root.quaternion.setFromAxisAngle(h.tipAxis, (1.1 + bounce) * te);
  }

  /** Set by the combat system: the clatter of a skeleton falling apart. */
  onCollapse?: (x: number, y: number, z: number) => void;

  private wingBones: Array<{ b: Object3D; bind: Quaternion; side: number }> | null = null;
  private wingBeat = 0;

  /** Beating wings for a clip-less flyer: each wing's root rocks about the body's forward axis (slower when dying). */
  private flapWings(m: ModelRig, dt: number): void {
    const w = this.def.wings;
    if (!w) return;
    if (!this.wingBones) {
      this.wingBones = [];
      for (const [name, side] of [[w.right, 1], [w.left, -1]] as const) {
        const b = m.bone(new RegExp('^' + name + '$'));
        if (b) this.wingBones.push({ b, bind: b.quaternion.clone(), side });
      }
    }
    this.wingBeat += dt * w.rate * (this.alive ? 1 : 0.3) * Math.PI * 2;
    const a = Math.sin(this.wingBeat) * w.amp * (this.alive ? 1 : 0.4);
    m.root.updateWorldMatrix(true, true);
    const fwd = _fwd.set(0, 0, 1).applyQuaternion(m.frame.getWorldQuaternion(_fq));
    for (const x of this.wingBones) {
      x.b.quaternion.copy(x.bind);
      turnedAbout(x.b, fwd, a * x.side, x.b.quaternion);
      x.b.updateWorldMatrix(false, true);
    }
  }

  /**
   * A body without clips (the wyrm, the shades, the crocs, the Ember Rider, the seated Hollow King) moves by hand:
   * a gait bob or slither while travelling, a lean back on the wind-up and a lunge on the blow, a flinch when hit,
   * a topple when it dies, and breathing at rest.
   */
  private driveStatic(m: ModelRig, st: EnemyState, dt: number, yawRate: number): void {
    const H = m.height;
    const motion = STATIC_MOTION[this.def.kind] ?? 'stride';
    const v = this.groundSpeed;
    const k = Math.min(1, v / Math.max(0.5, H * 0.6));
    this.gaitPhase += dt * (motion === 'slither' ? 2.2 + v * 1.4 : motion === 'gallop' ? 2 + v * 1.25 : 1.6 + (v / Math.max(0.4, H)) * 5);
    const ph = this.gaitPhase;
    const t = this.time;
    let y = 0;
    let pitch = 0;
    let roll = 0;
    let wiggle = 0;
    let sy = 1 + Math.sin(t * 0.9) * 0.012;
    switch (motion) {
      case 'gallop':
        y = Math.abs(Math.sin(ph)) * 0.05 * H * k;
        pitch = Math.sin(ph * 2) * 0.06 * k + 0.04 * k;
        break;
      case 'slither':
        wiggle = Math.sin(ph) * 0.2 * (0.25 + k);
        y = Math.abs(Math.sin(ph * 2)) * 0.01 * H * k;
        break;
      case 'hover':
        y = Math.sin(t * 1.6) * 0.05 * H;
        pitch = 0.12 * k;
        roll = Math.sin(t * 0.8) * 0.03 + Math.sin(ph) * 0.03 * k;
        break;
      case 'wade':
        y = Math.sin(t * 1.3) * 0.03 * H;
        roll = Math.sin(t * 0.7) * 0.04 + Math.sin(ph) * 0.05 * k;
        pitch = 0.06 * k;
        break;
      case 'fly':
        y = Math.sin(t * 1.2) * 0.06 * H;
        roll = Math.max(-0.6, Math.min(0.6, -yawRate * 0.35));
        pitch = 0.08 * k + Math.sin(t * 2.4) * 0.03;
        break;
      case 'seated':
        sy = 1 + Math.sin(t * 0.7) * 0.015;
        break;
      default: // heavy stride
        y = Math.abs(Math.sin(ph)) * 0.03 * H * k;
        roll = Math.sin(ph) * 0.045 * k;
        pitch = 0.05 * k;
    }
    // Wind-up: rear back (a horse rears, a croc lifts its head); the blow: lunge forward; a hit: flinch back.
    if (st === 'windup') {
      const p = Math.min(1, this.stateClock / Math.max(0.1, this.brain.p.windup));
      const ease = p * p * (3 - 2 * p);
      pitch -= ease * (motion === 'gallop' ? 0.42 : motion === 'seated' ? 0.08 : 0.2);
      sy += ease * 0.04;
    }
    pitch += this.lunge * this.lunge * (motion === 'gallop' ? 0.3 : motion === 'seated' ? 0.1 : 0.28);
    pitch -= this.flinch * 0.16;
    if (!this.alive) {
      // No death clip: topple onto one side and settle.
      const d = Math.min(1, this.deadFor / 0.9);
      const e = 1 - (1 - d) * (1 - d);
      roll = e * 1.35;
      pitch *= 1 - e;
      y = -e * 0.12 * H;
      wiggle = 0;
    }
    const r = m.root;
    const a = Math.min(1, dt * 14);
    r.position.y += (y - r.position.y) * a;
    r.rotation.x += (pitch - r.rotation.x) * a;
    r.rotation.z += (roll - r.rotation.z) * a;
    r.rotation.y += (wiggle - r.rotation.y) * a;
    r.scale.set(1, sy, 1);
  }
}

/** Clip keys to try for each move, best first (Meshy preset names match by substring). */
function attackClips(kind: BossAttackKind | undefined): string[] {
  switch (kind) {
    case 'slam': case 'roots': return ['charged_ground_slam', 'heavy', 'attack'];
    case 'volley': case 'summon': case 'blink': return ['charged_spell_cast', 'mage_s', 'cast', 'attack'];
    case 'breath': case 'roar': return ['zombie_scream', 'shouting', 'roar', 'attack'];
    // A swing or a throw: the plain Attack clip, which boss bodies list under 'heavy' ('attack' is their slam).
    case 'sweep': case 'bite': case 'boulder': case 'charge': return ['heavy', 'attack'];
    case 'logthrow': return ['throw', 'heavy', 'attack'];
    case 'punch': return ['punch', 'attack'];
    case 'grab': return ['grab', 'attack'];
    case 'cupmortar': case 'cupvolley': return ['throw', 'heavy', 'attack'];
    case 'web': case 'webdrop': return ['attack', 'heavy'];
    case 'kaleido': case 'eyebeam': case 'mirror': case 'hop': return ['attack', 'cast'];
    case 'snowstorm': return ['heavy', 'cast', 'attack'];
    default: return ['attack', 'heavy'];
  }
}

type StaticMotion = 'gallop' | 'slither' | 'hover' | 'wade' | 'fly' | 'seated' | 'stride';
/** How each clip-less body moves (see driveStatic). */
const STATIC_MOTION: Partial<Record<string, StaticMotion>> = {
  'dmt-entity': 'hover', spiderchapel: 'hover',
  emberrider: 'gallop', croc: 'slither', rivershade: 'hover', lurker: 'wade', wyrm: 'fly', hollowking: 'seated', marshdemon: 'stride',
};

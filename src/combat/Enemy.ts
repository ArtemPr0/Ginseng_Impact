import { BoxGeometry, Group, Mesh, MeshLambertMaterial, OctahedronGeometry } from 'three';
import type { EnemyDef } from '../data/enemies';
import { PALETTE } from '../render/palette';
import { ps1Lambert } from '../render/PS1Material';
import type { WorldQuery } from '../player/CharacterController';
import { glowSprite } from '../world/Landmarks';
import { EnemyBrain, type EnemyState } from './EnemyBrain';
import { tickAura, type Aura } from './Elements';

export type EnemyAction = { kind: 'melee' } | { kind: 'bolt' } | null;

let nextId = 1;

/** Scene-side enemy: procedural rig, movement, hit reactions, aura and defence debuff bookkeeping. */
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
  private readonly flashMats: MeshLambertMaterial[] = [];
  private readonly parts: { body: Mesh; legL?: Group; legR?: Group; armL?: Group; armR?: Group; core?: Mesh } ;

  constructor(readonly def: EnemyDef, readonly spawn: { x: number; z: number }, private readonly world: WorldQuery) {
    this.brain = new EnemyBrain(def.brain);
    this.hp = def.maxHp;
    this.pos = { x: spawn.x, y: world.heightAt(spawn.x, spawn.z) + def.hover, z: spawn.z };
    this.parts = def.kind === 'wisp' ? this.buildWisp() : this.buildSentinel();
    this.object.position.set(this.pos.x, this.pos.y, this.pos.z);
  }

  private mat(color: number, emissive?: number, intensity = 2): MeshLambertMaterial {
    const m = ps1Lambert(emissive !== undefined ? { color, emissive, emissiveIntensity: intensity } : { color });
    m.userData.baseEmissive = m.emissive.getHex();
    m.userData.baseIntensity = m.emissiveIntensity;
    this.flashMats.push(m);
    return m;
  }

  private buildWisp() {
    const body = new Mesh(new OctahedronGeometry(0.62, 0), this.mat(0x24347c));
    const core = new Mesh(new OctahedronGeometry(0.26, 0), this.mat(PALETTE.void, PALETTE.electric, 2.5));
    const halo = glowSprite(PALETTE.electric, 3.2, 0.5, true);
    this.object.add(body, core, halo);
    return { body, core };
  }

  private buildSentinel() {
    const stone = 0x46538c;
    const dark = 0x2c3666;
    const body = new Mesh(new BoxGeometry(1.6, 1.5, 1.3), this.mat(stone));
    body.position.y = 1.55;
    const brow = new Mesh(new BoxGeometry(1.7, 0.18, 0.3), this.mat(0x5a6aa8));
    brow.position.set(0, 0.45, 0.6);
    body.add(brow);
    for (const side of [-1, 1]) {
      const socket = new Mesh(new BoxGeometry(0.4, 0.25, 0.1), this.mat(PALETTE.void));
      socket.position.set(side * 0.4, 0.2, 0.66);
      const eye = new Mesh(new BoxGeometry(0.16, 0.12, 0.08), this.mat(PALETTE.void, PALETTE.blood, 3));
      eye.position.set(side * 0.4, 0.2, 0.72);
      const halo = glowSprite(PALETTE.blood, 1.1, 0.6, true);
      halo.position.copy(eye.position);
      body.add(socket, eye, halo);
    }
    const limb = (w: number, h: number, color: number) => {
      const pivot = new Group();
      const m = new Mesh(new BoxGeometry(w, h, w), this.mat(color));
      m.position.y = -h / 2;
      pivot.add(m);
      return pivot;
    };
    const legL = limb(0.48, 0.85, dark);
    const legR = limb(0.48, 0.85, dark);
    legL.position.set(-0.45, 0.85, 0);
    legR.position.set(0.45, 0.85, 0);
    const armL = limb(0.36, 1.25, dark);
    const armR = limb(0.36, 1.25, dark);
    armL.position.set(-1.0, 2.1, 0);
    armR.position.set(1.0, 2.1, 0);
    this.object.add(body, legL, legR, armL, armR);
    return { body, legL, legR, armL, armR };
  }

  get alive(): boolean {
    return this.brain.state !== 'dead';
  }

  get state(): EnemyState {
    return this.brain.state;
  }

  get aggro(): boolean {
    const s = this.brain.state;
    return s === 'chase' || s === 'windup' || s === 'attack' || s === 'recover';
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
    const dx = player.x - this.pos.x;
    const dz = player.z - this.pos.z;
    const dist = Math.hypot(dx, dz);
    const state = this.brain.update(dt, dist);
    let action: EnemyAction = null;
    if (state === 'attack') action = this.def.kind === 'wisp' ? { kind: 'bolt' } : { kind: 'melee' };

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
    const nx = this.pos.x + (mx * this.def.speed + this.knock.x) * dt;
    const nz = this.pos.z + (mz * this.def.speed + this.knock.z) * dt;
    const gNow = this.world.heightAt(this.pos.x, this.pos.z);
    const gNext = this.world.heightAt(nx, nz);
    if (Math.abs(gNext - gNow) < 2.5) {
      this.pos.x = nx;
      this.pos.z = nz;
    }
    const decay = Math.exp(-7 * dt);
    this.knock.x *= decay;
    this.knock.z *= decay;
    const bob = this.def.hover > 0 ? Math.sin(this.time * 2.4) * 0.25 : 0;
    this.pos.y = this.world.heightAt(this.pos.x, this.pos.z) + this.def.hover + bob;
    return action;
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
    this.hp = this.def.maxHp;
    this.aura = null;
    this.defDown = { amount: 0, left: 0 };
    this.pos.x = this.spawn.x;
    this.pos.z = this.spawn.z;
    this.brain.state = 'idle';
    this.brain.stateTime = 0;
    this.object.visible = true;
    this.object.scale.setScalar(1);
  }

  /** Per-frame visuals. */
  animate(dt: number): void {
    this.object.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.flashLeft = Math.max(0, this.flashLeft - dt);
    for (const m of this.flashMats) {
      if (this.flashLeft > 0) {
        m.emissive.set(PALETTE.moon);
        m.emissiveIntensity = 1.4;
      } else {
        m.emissive.set(m.userData.baseEmissive as number);
        m.emissiveIntensity = m.userData.baseIntensity as number;
      }
    }
    if (!this.alive) {
      const s = Math.max(0, 1 - this.deadFor * 2.2);
      this.object.scale.setScalar(s);
      this.object.visible = s > 0;
      return;
    }
    const st = this.brain.state;
    const k = 1 - Math.exp(-dt * 16);
    if (this.def.kind === 'wisp') {
      this.object.rotation.y += dt * (st === 'windup' ? 9 : 1.2);
      const coreScale = st === 'windup' ? 1 + this.brain.stateTime * 1.6 : 1;
      this.parts.core!.scale.setScalar(coreScale);
    } else {
      this.object.rotation.y = -this.yaw - Math.PI / 2;
      const moving = st === 'chase';
      const swing = moving ? Math.sin(this.time * 7) * 0.6 : 0;
      const { legL, legR, armL, armR } = this.parts;
      let aL = swing * 0.5;
      let aR = -swing * 0.5;
      if (st === 'windup') { aL = aR = -2.6; }
      else if (st === 'attack' || (st === 'recover' && this.brain.stateTime < 0.25)) { aL = aR = 0.9; }
      legL!.rotation.x += (swing - legL!.rotation.x) * k;
      legR!.rotation.x += (-swing - legR!.rotation.x) * k;
      armL!.rotation.x += (aL - armL!.rotation.x) * (st === 'attack' ? 1 : k);
      armR!.rotation.x += (aR - armR!.rotation.x) * (st === 'attack' ? 1 : k);
    }
  }
}

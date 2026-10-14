import { AdditiveBlending, BoxGeometry, BufferGeometry, CapsuleGeometry, ConeGeometry, Group, IcosahedronGeometry, Matrix4, Mesh, MeshBasicMaterial, MeshStandardMaterial, Quaternion, SphereGeometry, Sprite, Vector3 } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { rockify, tintRock } from '../world/geometry';
import type { EnemyDef } from '../data/enemies';
import { PALETTE } from '../render/palette';
import { surface } from '../render/Materials';
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
  private readonly flashMats: MeshStandardMaterial[] = [];
  private readonly parts: { body: Mesh; legL?: Group; legR?: Group; armL?: Group; armR?: Group; core?: Mesh; shells?: Mesh[]; orbit?: Group; cracks?: MeshStandardMaterial; head?: Group; jaw?: Mesh; mane?: Mesh; legs?: Group[]; tail?: Mesh };
  private readonly trail: Sprite[] = [];
  private readonly history: Vector3[] = [];
  private stepPhase = 0;
  /** Set by the combat system: dust + shake on heavy footsteps and slams. */
  onStomp?: (x: number, y: number, z: number) => void;

  constructor(readonly def: EnemyDef, readonly spawn: { x: number; z: number }, private readonly world: WorldQuery) {
    this.brain = new EnemyBrain(def.brain);
    this.hp = def.maxHp;
    this.pos = { x: spawn.x, y: world.heightAt(spawn.x, spawn.z) + def.hover, z: spawn.z };
    this.parts = def.kind === 'wisp' ? this.buildWisp() : def.kind === 'beast' ? this.buildBeast() : this.buildSentinel();
    this.object.position.set(this.pos.x, this.pos.y, this.pos.z);
  }

  private mat(color: number, emissive?: number, intensity = 2): MeshStandardMaterial {
    const m = surface(emissive !== undefined ? { color, emissive, emissiveIntensity: intensity } : { color });
    m.userData.baseEmissive = m.emissive.getHex();
    m.userData.baseIntensity = m.emissiveIntensity;
    this.flashMats.push(m);
    return m;
  }

  private buildWisp() {
    const core = new Mesh(new SphereGeometry(0.22, 14, 10), this.mat(PALETTE.void, PALETTE.electric, 3.5));
    const inner = new Mesh(new IcosahedronGeometry(0.5, 1), this.mat(0x1a2a7a, PALETTE.electric, 0.5));
    (inner.material as MeshStandardMaterial).transparent = true;
    (inner.material as MeshStandardMaterial).opacity = 0.55;
    const outer = new Mesh(new IcosahedronGeometry(0.82, 1), new MeshBasicMaterial({ color: PALETTE.electric, transparent: true, opacity: 0.14, blending: AdditiveBlending, depthWrite: false }));
    const halo = glowSprite(PALETTE.electric, 2.8, 0.45, true);
    const orbit = new Group();
    for (let i = 0; i < 6; i++) {
      const m = glowSprite(i % 2 ? PALETTE.rune : PALETTE.electric, 0.45, 0.8, true);
      const a = (i / 6) * Math.PI * 2;
      m.position.set(Math.cos(a) * 1.0, Math.sin(a * 2) * 0.3, Math.sin(a) * 1.0);
      orbit.add(m);
    }
    this.object.add(core, inner, outer, halo, orbit);
    for (let i = 0; i < 10; i++) {
      const t = glowSprite(PALETTE.electric, 1.2 * (1 - i / 10) + 0.2, 0.35 * (1 - i / 10), true);
      this.trail.push(t);
      this.history.push(new Vector3(this.pos.x, this.pos.y, this.pos.z));
    }
    return { body: inner, core, shells: [inner, outer], orbit };
  }

  private buildSentinel() {
    const rock = (w: number, h: number, d: number, amp: number, seed: number) => {
      const geo = rockify(new BoxGeometry(w, h, d, 6, 6, 6), amp, 0.9, seed);
      tintRock(geo, 0x46538c, 0x1f4d46, 0.5, seed);
      const m = new Mesh(geo, this.mat(0xffffff));
      (m.material as MeshStandardMaterial).vertexColors = true;
      m.castShadow = true;
      m.receiveShadow = true;
      return m;
    };
    const body = rock(1.7, 1.6, 1.3, 0.12, 1);
    body.position.y = 1.6;
    const head = rock(1.1, 0.85, 1.0, 0.08, 2);
    head.position.set(0, 1.15, 0.15);
    body.add(head);
    for (const side of [-1, 1]) {
      const socket = new Mesh(new BoxGeometry(0.34, 0.22, 0.12), this.mat(PALETTE.void));
      socket.position.set(side * 0.3, 0.05, 0.5);
      const eye = new Mesh(new SphereGeometry(0.09, 10, 8), this.mat(PALETTE.void, PALETTE.blood, 2.5));
      eye.position.set(side * 0.3, 0.05, 0.54);
      const halo = glowSprite(PALETTE.blood, 0.9, 0.5, true);
      halo.position.copy(eye.position);
      head.add(socket, eye, halo);
      const shoulder = rock(0.8, 0.7, 0.7, 0.1, 3 + side);
      shoulder.position.set(side * 1.05, 0.7, 0);
      body.add(shoulder);
    }
    const cracksMat = this.mat(PALETTE.void, PALETTE.rune, 1.6);
    for (const [x, y, w, h] of [[-0.3, 0.1, 0.05, 0.9], [0.35, -0.2, 0.04, 0.7], [0.05, 0.45, 0.5, 0.04]] as const) {
      const crack = new Mesh(new BoxGeometry(w, h, 0.04), cracksMat);
      crack.position.set(x, y, 0.66);
      crack.rotation.z = x * 0.6;
      body.add(crack);
    }
    const limb = (r: number, len: number, seed: number) => {
      const pivot = new Group();
      const m = new Mesh(new CapsuleGeometry(r, len - r * 2, 3, 10), this.mat(0x3a4680));
      m.position.y = -len / 2;
      m.castShadow = true;
      pivot.add(m);
      const fist = rock(r * 2.4, r * 2.2, r * 2.4, 0.08, seed);
      fist.position.y = -len;
      pivot.add(fist);
      return pivot;
    };
    const legL = limb(0.26, 0.9, 7);
    const legR = limb(0.26, 0.9, 8);
    legL.position.set(-0.5, 0.9, 0);
    legR.position.set(0.5, 0.9, 0);
    const armL = limb(0.2, 1.3, 9);
    const armR = limb(0.2, 1.3, 10);
    armL.position.set(-1.25, 2.2, 0);
    armR.position.set(1.25, 2.2, 0);
    this.object.add(body, legL, legR, armL, armR);
    return { body, legL, legR, armL, armR, cracks: cracksMat };
  }

  /** Shaggy red-eyed quadruped that prowls the forest and lunges. */
  private buildBeast() {
    const furColor = 0x0b0f2e;
    const bodyMat = this.mat(0x121840);
    const body = new Mesh(new CapsuleGeometry(0.55, 1.5, 4, 12).rotateZ(Math.PI / 2), bodyMat);
    body.position.y = 1.0;
    body.castShadow = true;
    // Fur: cones scattered over the body, leaning back.
    const furs: BufferGeometry[] = [];
    const up = new Vector3(0, 1, 0);
    const q = new Quaternion();
    const m4 = new Matrix4();
    for (let i = 0; i < 110; i++) {
      const ax = (Math.random() - 0.5) * 2.2;
      const th = Math.random() * Math.PI * 2;
      const n = new Vector3(0, Math.cos(th), Math.sin(th));
      const pos = new Vector3(ax, n.y * 0.55, n.z * 0.55);
      const dir = n.clone().add(new Vector3(-0.6, 0.2, 0)).normalize();
      const cone = new ConeGeometry(0.07, 0.35 + Math.random() * 0.3, 5).translate(0, 0.2, 0);
      q.setFromUnitVectors(up, dir);
      m4.compose(pos, q, new Vector3(1, 1, 1));
      cone.applyMatrix4(m4);
      furs.push(cone);
    }
    const fur = new Mesh(mergeGeometries(furs, false)!, this.mat(furColor));
    fur.castShadow = true;
    body.add(fur);
    const mane = new Mesh(new SphereGeometry(0.7, 12, 8), this.mat(furColor));
    mane.scale.set(0.8, 1, 1);
    mane.position.set(0.8, 0.2, 0);
    body.add(mane);
    const head = new Group();
    head.position.set(1.25, 0.25, 0);
    const skull = new Mesh(new SphereGeometry(0.42, 14, 10), bodyMat);
    skull.scale.set(1.1, 0.9, 0.9);
    const snout = new Mesh(new BoxGeometry(0.5, 0.26, 0.34), bodyMat);
    snout.position.set(0.5, -0.08, 0);
    const jaw = new Mesh(new BoxGeometry(0.42, 0.1, 0.3), bodyMat);
    jaw.position.set(0.48, -0.26, 0);
    for (const side of [-1, 1]) {
      const ear = new Mesh(new ConeGeometry(0.1, 0.32, 5), this.mat(furColor));
      ear.position.set(-0.05, 0.42, side * 0.22);
      ear.rotation.z = -0.2;
      const eye = new Mesh(new SphereGeometry(0.085, 10, 8), this.mat(PALETTE.void, PALETTE.blood, 2.6));
      eye.position.set(0.3, 0.12, side * 0.2);
      const halo = glowSprite(PALETTE.blood, 0.8, 0.55, true);
      halo.position.copy(eye.position);
      const tooth = new Mesh(new ConeGeometry(0.03, 0.12, 4), this.mat(0xc9d2f5));
      tooth.position.set(0.68, -0.18, side * 0.1);
      tooth.rotation.z = Math.PI;
      head.add(ear, eye, halo, tooth);
    }
    head.add(skull, snout, jaw);
    body.add(head);
    const legs: Group[] = [];
    const legMat = this.mat(0x101538);
    for (const [lx, lz] of [[0.65, -0.32], [0.65, 0.32], [-0.65, -0.32], [-0.65, 0.32]] as const) {
      const pivot = new Group();
      pivot.position.set(lx, 0.85, lz);
      const upper = new Mesh(new CapsuleGeometry(0.13, 0.4, 3, 8), legMat);
      upper.position.y = -0.3;
      upper.castShadow = true;
      const joint = new Group();
      joint.position.y = -0.55;
      const lower = new Mesh(new CapsuleGeometry(0.1, 0.35, 3, 8), legMat);
      lower.position.y = -0.25;
      const paw = new Mesh(new BoxGeometry(0.22, 0.1, 0.3), legMat);
      paw.position.set(0.05, -0.48, 0);
      joint.add(lower, paw);
      pivot.add(upper, joint);
      this.object.add(pivot);
      legs.push(pivot);
    }
    const tail = new Mesh(new CapsuleGeometry(0.09, 0.9, 3, 8), this.mat(furColor));
    tail.position.set(-1.25, 0.35, 0);
    tail.rotation.z = -0.9;
    body.add(tail);
    this.object.add(body);
    return { body, head, jaw, mane, legs, tail };
  }

  /** World-space trail sprites (wisp). Add to the scene next to `object`. */
  get trailObjects(): Sprite[] {
    return this.trail;
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
    if (state === 'attack') {
      action = this.def.kind === 'wisp' ? { kind: 'bolt' } : { kind: 'melee' };
      if (this.def.kind === 'beast' && dist > 0.01) {
        this.knock.x += (dx / dist) * 9;
        this.knock.z += (dz / dist) * 9;
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
      for (const t of this.trail) t.visible = false;
      return;
    }
    const st = this.brain.state;
    const k = 1 - Math.exp(-dt * 16);
    if (this.def.kind === 'beast') {
      this.object.rotation.y = -this.yaw;
      const moving = st === 'chase';
      if (moving) this.stepPhase += dt * 11;
      const { body, head, jaw, mane, legs, tail } = this.parts;
      const amp = moving ? 0.7 : 0;
      const gait = [1, -1, -1, 1];
      legs!.forEach((leg, i) => {
        const ph = this.stepPhase + (gait[i] > 0 ? 0 : Math.PI);
        const target = Math.sin(ph) * amp + (st === 'windup' ? 0.6 : 0);
        leg.rotation.x += (target - leg.rotation.x) * k;
        const joint = leg.children[1];
        joint.rotation.x += ((Math.max(0, -Math.sin(ph)) * amp * 1.2 + (st === 'windup' ? 0.9 : 0.15)) - joint.rotation.x) * k;
      });
      let crouch = st === 'windup' ? -0.3 : st === 'attack' || (st === 'recover' && this.brain.stateTime < 0.2) ? 0.15 : 0;
      body.position.y += ((1.0 + crouch + (moving ? Math.abs(Math.sin(this.stepPhase)) * 0.08 : 0)) - body.position.y) * k;
      body.rotation.z += (((st === 'windup' ? 0.25 : st === 'attack' ? -0.3 : 0) + (moving ? Math.sin(this.stepPhase) * 0.04 : 0)) - body.rotation.z) * k;
      head!.rotation.z += (((moving ? 0.2 : st === 'windup' ? 0.45 : 0.1) + Math.sin(this.time * 1.7) * 0.05) - head!.rotation.z) * k;
      const jawOpen = st === 'attack' || st === 'windup' ? 0.45 : 0.05;
      jaw!.rotation.z += (jawOpen - jaw!.rotation.z) * k;
      mane!.scale.setScalar(1 + (st === 'windup' ? 0.25 : 0) + Math.sin(this.time * 2) * 0.03);
      tail!.rotation.z = -0.9 + Math.sin(this.time * 3) * 0.2 + (moving ? 0.3 : 0);
    } else if (this.def.kind === 'wisp') {
      const { core, shells, orbit } = this.parts;
      this.object.rotation.y += dt * (st === 'windup' ? 6 : 0.8);
      const pulse = 1 + Math.sin(this.time * 4) * 0.08;
      const charge = st === 'windup' ? 1 + this.brain.stateTime * 1.8 : 1;
      core!.scale.setScalar(pulse * charge);
      shells![0].scale.setScalar((1 + Math.sin(this.time * 2.3) * 0.06) * (st === 'windup' ? 1.3 : 1));
      shells![1].scale.setScalar((1 + Math.sin(this.time * 1.7 + 1) * 0.1) * (st === 'windup' ? 1.5 : 1));
      shells![0].rotation.x += dt * 0.7;
      shells![1].rotation.z -= dt * 0.5;
      orbit!.rotation.y += dt * (st === 'windup' ? 8 : 2.2);
      orbit!.rotation.x = Math.sin(this.time * 0.8) * 0.5;
      // Trail: shift history every ~50 ms.
      this.stepPhase += dt;
      if (this.stepPhase > 0.05) {
        this.stepPhase = 0;
        for (let i = this.history.length - 1; i > 0; i--) this.history[i].copy(this.history[i - 1]);
        this.history[0].set(this.pos.x, this.pos.y, this.pos.z);
      }
      for (let i = 0; i < this.trail.length; i++) {
        this.trail[i].position.copy(this.history[i]);
        this.trail[i].visible = this.alive;
      }
    } else {
      this.object.rotation.y = -this.yaw - Math.PI / 2;
      const moving = st === 'chase';
      const prevPhase = this.stepPhase;
      if (moving) this.stepPhase += dt * 4.2;
      const swing = moving ? Math.sin(this.stepPhase) * 0.55 : 0;
      if (moving && Math.floor(prevPhase / Math.PI) !== Math.floor(this.stepPhase / Math.PI)) this.onStomp?.(this.pos.x, this.pos.y, this.pos.z);
      const { legL, legR, armL, armR, body, cracks } = this.parts;
      let aL = swing * 0.6 + 0.15;
      let aR = -swing * 0.6 + 0.15;
      let bodyLean = moving ? 0.12 : 0;
      if (st === 'windup') { aL = aR = -2.5; bodyLean = -0.2; }
      else if (st === 'attack' || (st === 'recover' && this.brain.stateTime < 0.25)) { aL = aR = 1.1; bodyLean = 0.35; if (st === 'attack') this.onStomp?.(this.pos.x, this.pos.y, this.pos.z); }
      legL!.rotation.x += (swing - legL!.rotation.x) * k;
      legR!.rotation.x += (-swing - legR!.rotation.x) * k;
      armL!.rotation.x += (aL - armL!.rotation.x) * (st === 'attack' ? 1 : k);
      armR!.rotation.x += (aR - armR!.rotation.x) * (st === 'attack' ? 1 : k);
      body.rotation.x += (bodyLean - body.rotation.x) * k;
      body.rotation.z = Math.sin(this.stepPhase) * 0.06 * (moving ? 1 : 0);
      body.position.y = 1.6 + Math.abs(Math.cos(this.stepPhase)) * 0.08 * (moving ? 1 : 0);
      cracks!.emissiveIntensity = 1.2 + Math.sin(this.time * 3) * 0.6 + (st === 'windup' ? 2 : 0);
    }
  }
}

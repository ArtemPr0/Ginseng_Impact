/**
 * Picking things up in the game (Carry.ts holds the pure parts). Sir Aldric: G grabs the mob in front of him by the
 * neck, one-handed; he walks with it (slower); the attack button throws it along his facing, the heavy button slams it
 * into the ground, G again drops it. Orlan: holding the heavy button lifts what the crosshair is on — a mob, loose
 * rubble, or a whole small building torn from its footing into its pieces — into a wobbling hold in front of him;
 * letting go hurls it where he looks, the attack button slams it straight down. What is thrown hurts what it hits and
 * what it lands on, by its mass and speed, and breaks the world where it lands.
 */
import { Vector3 } from 'three';
import type { Enemy } from './Enemy';
import type { DebrisSim, Piece } from '../world/Debris';
import type { BlowKind } from '../world/Breakables';
import { canHandGrab, canLift, handHold, impactDamage, massOf, mindHold, steerTo, throwVelocity } from './Carry';

export interface CarryHost {
  enemies(): readonly Enemy[];
  hero(): { pos: Vector3; yaw: number; grounded: boolean };
  /** 'knight' | 'archer' | 'wizard'. */
  heroId(): string;
  /** Where the crosshair points on the ground, and the camera's forward. */
  aimAt(): Vector3 | null;
  lookDir(): Vector3;
  debris(): DebrisSim[];
  breakAt(x: number, y: number, z: number, r: number, kind: BlowKind): number;
  /** Is there something breakable and small enough to tear up at (x, z)? Its centre and reach. */
  building(x: number, z: number): { x: number; y: number; z: number; r: number } | null;
  /** Hurts `e` for `share` of the hero's attack, knocked along (kx, kz). */
  hit(e: Enemy, share: number, at: Vector3, heavy: boolean): void;
  groundAt(x: number, z: number, y: number): number;
  fx: {
    shock(at: Vector3, color: number, radius: number, seconds?: number): void;
    dust(at: Vector3, size: number): void;
    sparks(at: Vector3, dir: Vector3, n: number, color: number, speed: number, spread?: number): void;
  };
  shake(amount: number): void;
  sound: { grab(): void; throw(heavy: boolean): void; land(size: number): void };
}

export interface CarryInput {
  /** G this step. */
  grab: boolean;
  /** The attack button this step. */
  attack: boolean;
  heavyHeld: boolean;
}

/** Orlan's lifting colour. */
const MIND = 0x9a7aff;
/** Pieces Orlan can hold at once. */
const MAX_PIECES = 36;
const G_SIM = 9.81;

interface Flying { until: number; hit: Set<number>; mass: number }

const _v = new Vector3(), _w = new Vector3();

export class CarrySystem {
  /** The knight's fist: the mob he holds. */
  hand: { e: Enemy; t: number } | null = null;
  /** Orlan's hold. */
  mind: { e: Enemy | null; pieces: Map<Piece, Vector3>; from: { x: number; z: number; r: number; until: number } | null; t: number } | null = null;
  private readonly flying = new Map<Piece, Flying>();
  private readonly thrown = new Map<Enemy, Set<number>>();
  private time = 0;
  /** Heavy button state last step (Orlan lifts on its press). */
  private heavyWas = false;

  constructor(private readonly h: CarryHost) {}

  /** True while a hero holds something (the caller keeps other moves off the buttons this step). */
  get busy(): boolean { return !!this.hand || !!this.mind; }

  /** The mob the knight holds slows him: his walk speed multiplier. */
  get carrySlow(): number { return this.hand ? 0.7 : 1; }

  /** Lets everything go (the hero switched, fell, dodged). */
  drop(): void {
    if (this.hand) { this.release(this.hand.e, { x: 0, y: 0, z: 0 }); this.hand = null; }
    if (this.mind) {
      if (this.mind.e) this.release(this.mind.e, { x: 0, y: -1, z: 0 });
      this.mind = null;
    }
  }

  /**
   * One step. Returns true when it used the buttons this step (a throw, a grab, a slam, a lift held): the caller then
   * skips the combo, the heavy and the like.
   */
  update(dt: number, input: CarryInput): boolean {
    this.time += dt;
    let used = false;
    const id = this.h.heroId();
    if (this.hand && id !== 'knight') this.drop();
    if (this.mind && id !== 'wizard') this.drop();
    if (id === 'knight') used = this.knight(dt, input);
    else if (id === 'wizard') used = this.wizard(dt, input);
    this.heavyWas = input.heavyHeld;
    this.collide();
    return used;
  }

  // --- Sir Aldric ---------------------------------------------------------------------------------------------------

  private knight(dt: number, input: CarryInput): boolean {
    const me = this.h.hero();
    if (!this.hand) {
      if (!input.grab) return false;
      const e = this.inFront(me, 2.8, (x) => canHandGrab(x.def));
      if (!e) return false;
      e.held = true;
      e.thrown = null;
      this.hand = { e, t: 0 };
      this.h.sound.grab();
      return true;
    }
    const hd = this.hand;
    hd.t += dt;
    const e = hd.e;
    if (!e.alive || hd.t > 10) { this.release(e, { x: 0, y: 0, z: 0 }); this.hand = null; return false; }
    const h = e.def.height * (e.def.scale ?? 1);
    // Lifted off its feet over a quarter second, then hanging from the fist, facing him.
    const want = handHold(me.pos, me.yaw, h);
    const k = Math.min(1, hd.t / 0.25);
    e.pos.x += (want.x - e.pos.x) * k;
    e.pos.z += (want.z - e.pos.z) * k;
    e.pos.y += (want.y + Math.sin(this.time * 7) * 0.04 - e.pos.y) * k;
    e.yaw = me.yaw + Math.PI;
    const fx = Math.cos(me.yaw), fz = Math.sin(me.yaw);
    if (input.grab) { this.release(e, { x: fx * 1.5, y: 0, z: fz * 1.5 }); this.hand = null; return true; }
    if (input.attack) {
      const v = throwVelocity({ x: fx, y: 0.15, z: fz }, 'hand', massOf(e.def));
      this.release(e, v);
      this.thrown.set(e, new Set([e.id]));
      this.hand = null;
      this.h.sound.throw(false);
      return true;
    }
    if (input.heavyHeld && !this.heavyWas) {
      // Slammed into the ground at his feet.
      const at = _v.set(me.pos.x + fx * 1.3, 0, me.pos.z + fz * 1.3);
      at.y = this.h.groundAt(at.x, at.z, me.pos.y + 1);
      e.pos.x = at.x; e.pos.z = at.z; e.pos.y = at.y;
      this.release(e, { x: 0, y: 0, z: 0 });
      this.hand = null;
      this.landed(e, 16, massOf(e.def));
      return true;
    }
    return input.attack || input.heavyHeld;
  }

  // --- Orlan --------------------------------------------------------------------------------------------------------

  private wizard(dt: number, input: CarryInput): boolean {
    const me = this.h.hero();
    if (!this.mind) {
      if (!input.heavyHeld || this.heavyWas) return false;
      return this.lift();
    }
    const m = this.mind;
    m.t += dt;
    const centre = mindHold(me.pos, me.yaw, m.t);
    const rise = Math.min(1, m.t / 0.45);
    // A building torn up: its pieces come loose over a second or so; each one in reach joins the hold.
    if (m.from && m.t < m.from.until) this.gather(m, m.from.x, m.from.z, m.from.r);
    if (m.e) {
      const e = m.e;
      if (!e.alive || m.t > 4) { this.release(e, { x: 0, y: -1, z: 0 }); m.e = null; }
      else {
        const h = e.def.height * (e.def.scale ?? 1);
        const k = Math.min(1, dt * 6) * rise;
        e.pos.x += (centre.x - e.pos.x) * k;
        e.pos.y += (centre.y - h * 0.5 + 0.3 - e.pos.y) * k;
        e.pos.z += (centre.z - e.pos.z) * k;
      }
    }
    // The pieces circle slowly round the hold, drawn in tight.
    const spin = m.t * 0.9, c = Math.cos(spin), s = Math.sin(spin);
    for (const [p, off] of m.pieces) {
      if (p.dead) { m.pieces.delete(p); continue; }
      _w.set(centre.x + (off.x * c - off.z * s), centre.y + off.y + Math.sin(m.t * 3 + off.x * 4) * 0.12, centre.z + (off.x * s + off.z * c));
      // Rising from where it lay, then held.
      _w.lerpVectors(_v.set(p.x, p.y, p.z), _w, rise);
      const v = steerTo(p, _w, dt, G_SIM);
      p.vx = v.vx; p.vy = v.vy; p.vz = v.vz;
      p.wx *= 0.9; p.wy *= 0.9; p.wz *= 0.9;
      p.awake = true; p.still = 0;
    }
    // A light shake of dust off what he holds.
    if (Math.random() < dt * 6 && (m.pieces.size || m.e)) this.h.fx.dust(_v.set(centre.x, centre.y - 0.6, centre.z), 0.5);
    if (!m.e && !m.pieces.size && !(m.from && m.t < m.from.until)) { this.mind = null; return false; }
    if (input.attack) { this.hurl(m, { x: 0, y: -1, z: 0 }, 28); return true; }
    if (!input.heavyHeld) { this.hurl(m, this.h.lookDir(), 0); return true; }
    return true;
  }

  /** Where Orlan's hold is and how big what he holds is (the beam and field run to it), or null. */
  holding(): { to: Vector3; r: number } | null {
    const m = this.mind;
    if (!m) return null;
    const me = this.h.hero();
    const c = mindHold(me.pos, me.yaw, m.t);
    let r = 0.6;
    if (m.e) r = Math.max(r, m.e.def.height * (m.e.def.scale ?? 1) * 0.55);
    for (const off of m.pieces.values()) r = Math.max(r, Math.hypot(off.x, off.y, off.z) + 0.4);
    return { to: new Vector3(c.x, c.y, c.z), r };
  }

  /**
   * What a lift would take now (Orlan's Telekinesis glows on it under the crosshair): a mob near the crosshair (not a
   * boss or a giant), else loose rubble there, else a small building to tear up; nothing past 22 m.
   */
  liftTarget(): { kind: 'mob' | 'rubble' | 'building'; x: number; y: number; z: number; r: number; e?: Enemy } | null {
    const me = this.h.hero();
    const at = this.h.aimAt();
    if (!at || Math.hypot(at.x - me.pos.x, at.z - me.pos.z) > 22) return null;
    let best: Enemy | null = null, bd = 3;
    for (const e of this.h.enemies()) {
      if (!e.alive || e.held || !canLift(e.def)) continue;
      const d = Math.hypot(e.pos.x - at.x, e.pos.z - at.z) - e.def.bodyRadius * (e.def.scale ?? 1);
      if (d < bd) { bd = d; best = e; }
    }
    if (best) return { kind: 'mob', x: best.pos.x, y: best.pos.y, z: best.pos.z, r: best.def.bodyRadius * (best.def.scale ?? 1) + 0.4, e: best };
    for (const sim of this.h.debris()) for (const p of sim.pieces) {
      if (!p.dead && !this.flying.has(p) && Math.hypot(p.x - at.x, p.z - at.z) <= 2.6) return { kind: 'rubble', x: at.x, y: at.y, z: at.z, r: 2.6 };
    }
    const b = this.h.building(at.x, at.z);
    return b ? { kind: 'building', x: b.x, y: b.y, z: b.z, r: b.r } : null;
  }

  /** On the lift's press: what liftTarget finds — a mob, the rubble there, or a small building torn up. */
  private lift(): boolean {
    const t = this.liftTarget();
    if (!t) return false;
    const at = this.h.aimAt()!;
    const m = { e: null as Enemy | null, pieces: new Map<Piece, Vector3>(), from: null as { x: number; z: number; r: number; until: number } | null, t: 0 };
    if (t.kind === 'mob') {
      t.e!.held = true;
      t.e!.thrown = null;
      m.e = t.e!;
    } else if (t.kind === 'rubble') this.gather(m, at.x, at.z, 2.6);
    else {
      // Torn from its footing: it comes apart and its pieces rise into the hold as they come loose.
      // (At its base: the crosshair's ground there is its roof.)
      this.h.breakAt(t.x, t.y + 1, t.z, t.r + 1, 'burst');
      m.from = { x: t.x, z: t.z, r: t.r + 1.5, until: 2.5 };
      this.h.shake(0.5);
    }
    this.mind = m;
    this.h.fx.shock(_v.set(at.x, at.y + 0.2, at.z), MIND, 3, 0.5);
    this.h.sound.grab();
    return true;
  }

  /** Loose pieces within `r` of (x, z) join the hold (up to MAX_PIECES), each keeping its place round the middle. */
  private gather(m: NonNullable<CarrySystem['mind']>, x: number, z: number, r: number): void {
    for (const sim of this.h.debris()) for (const p of sim.pieces) {
      if (m.pieces.size >= MAX_PIECES) return;
      if (p.dead || m.pieces.has(p) || this.flying.has(p) || Math.hypot(p.x - x, p.z - z) > r) continue;
      const k = 0.45;
      m.pieces.set(p, new Vector3((p.x - x) * k, Math.min(1.5, (p.y - this.h.groundAt(p.x, p.z, p.y + 1)) * 0.25) - 0.3, (p.z - z) * k));
      sim.wake(p);
    }
  }

  /** Throws all he holds along `dir` (`speed` 0: by its mass). */
  private hurl(m: NonNullable<CarrySystem['mind']>, dir: { x: number; y: number; z: number }, speed: number): void {
    if (m.e) {
      const v = throwVelocity(dir, 'mind', massOf(m.e.def));
      if (speed) { const l = Math.hypot(dir.x, dir.y, dir.z) || 1; v.x = (dir.x / l) * speed; v.y = (dir.y / l) * speed; v.z = (dir.z / l) * speed; }
      this.release(m.e, v);
      this.thrown.set(m.e, new Set([m.e.id]));
    }
    for (const p of m.pieces.keys()) {
      const mass = Math.max(0.2, Math.min(6, 1 / Math.max(1e-4, p.invM) / 120));
      const v = throwVelocity(dir, 'mind', Math.max(1, mass * 0.5));
      if (speed) { const l = Math.hypot(dir.x, dir.y, dir.z) || 1; v.x = (dir.x / l) * speed; v.y = (dir.y / l) * speed; v.z = (dir.z / l) * speed; }
      // (A loose spread, so a building flies as a cloud of its pieces, not one lump.)
      p.vx = v.x + (Math.random() - 0.5) * 3; p.vy = v.y + (Math.random() - 0.5) * 2; p.vz = v.z + (Math.random() - 0.5) * 3;
      p.wx = (Math.random() - 0.5) * 8; p.wy = (Math.random() - 0.5) * 8; p.wz = (Math.random() - 0.5) * 8;
      this.flying.set(p, { until: this.time + 2.5, hit: new Set(), mass });
    }
    this.h.sound.throw(m.pieces.size > 8 || !!m.e);
    this.mind = null;
  }

  // --- what is in the air -------------------------------------------------------------------------------------------

  private release(e: Enemy, v: { x: number; y: number; z: number }): void {
    e.held = false;
    e.object.rotation.z = 0;
    e.thrown = { vx: v.x, vy: v.y, vz: v.z, spin: Math.hypot(v.x, v.z) > 3 ? (Math.random() < 0.5 ? -1 : 1) * 7 : 0, angle: 0 };
    e.onThrownLand = (x, speed) => { this.thrown.delete(x); this.landed(x, speed, massOf(x.def)); x.object.rotation.x = 0; };
  }

  /** A thrown body hits the ground: it is hurt, and so is whatever it fell on; the ground and the world there break. */
  private landed(e: Enemy, speed: number, mass: number): void {
    const share = impactDamage(mass, speed);
    if (share <= 0) return;
    const at = _v.set(e.pos.x, e.pos.y + 0.3, e.pos.z);
    this.h.hit(e, share, at.clone(), true);
    for (const o of this.h.enemies()) {
      if (o === e || !o.alive || o.held) continue;
      if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) < 2 + o.def.bodyRadius * (o.def.scale ?? 1)) this.h.hit(o, share * 0.7, at.clone(), true);
    }
    this.h.breakAt(e.pos.x, e.pos.y + 0.5, e.pos.z, 1.2 + mass * 0.4, speed > 14 ? 'skill' : 'heavy');
    this.h.fx.shock(at, 0xc8c0b0, 2 + mass, 0.4);
    this.h.fx.dust(at, 1 + mass);
    this.h.shake(Math.min(0.8, 0.15 + speed * 0.025 * Math.sqrt(mass)));
    this.h.sound.land(mass);
  }

  /** Thrown bodies and pieces strike the mobs they fly into. */
  private collide(): void {
    const enemies = this.h.enemies();
    for (const [e, hit] of this.thrown) {
      if (!e.thrown || !e.alive) { this.thrown.delete(e); continue; }
      const speed = Math.hypot(e.thrown.vx, e.thrown.vy, e.thrown.vz);
      for (const o of enemies) {
        if (!o.alive || hit.has(o.id) || o.held) continue;
        const reach = e.def.bodyRadius * (e.def.scale ?? 1) + o.def.bodyRadius * (o.def.scale ?? 1);
        if (Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z) > reach || Math.abs(o.pos.y - e.pos.y) > o.def.height * (o.def.scale ?? 1)) continue;
        hit.add(o.id);
        const share = impactDamage(massOf(e.def), speed);
        this.h.hit(o, share, _v.set(o.pos.x, e.pos.y + 0.6, o.pos.z).clone(), true);
        this.h.hit(e, share * 0.5, _v.set(e.pos.x, e.pos.y + 0.6, e.pos.z).clone(), false);
        // It stops on what it hit, and drops.
        e.thrown.vx *= 0.2; e.thrown.vz *= 0.2;
      }
    }
    for (const [p, f] of this.flying) {
      if (p.dead || this.time > f.until) { this.flying.delete(p); continue; }
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      if (speed < 5) continue;
      for (const o of enemies) {
        if (!o.alive || f.hit.has(o.id) || o.held) continue;
        const sc = o.def.scale ?? 1;
        if (Math.hypot(o.pos.x - p.x, o.pos.z - p.z) > o.def.bodyRadius * sc + p.r || p.y < o.pos.y - 0.3 || p.y > o.pos.y + o.def.height * sc + 0.3) continue;
        f.hit.add(o.id);
        this.h.hit(o, impactDamage(f.mass, speed), _v.set(p.x, p.y, p.z).clone(), f.mass > 1);
        p.vx *= 0.4; p.vz *= 0.4;
      }
    }
  }

  /** The nearest mob within `reach` in front of the hero that `ok` allows. */
  private inFront(me: { pos: Vector3; yaw: number }, reach: number, ok: (e: Enemy) => boolean): Enemy | null {
    const fx = Math.cos(me.yaw), fz = Math.sin(me.yaw);
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.h.enemies()) {
      if (!e.alive || e.held || !ok(e)) continue;
      const dx = e.pos.x - me.pos.x, dz = e.pos.z - me.pos.z;
      const d = Math.hypot(dx, dz) - e.def.bodyRadius * (e.def.scale ?? 1);
      if (d > reach || Math.abs(e.pos.y - me.pos.y) > 2) continue;
      if ((dx * fx + dz * fz) / (Math.hypot(dx, dz) || 1) < 0.2) continue;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
}

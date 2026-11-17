/**
 * Picking things up in the game (Carry.ts holds the pure parts). Sir Aldric: G grabs the mob in front of him by the
 * neck in his sword hand (the sword put away); he walks with it (slower), it swinging from his fist (Dangle); the attack
 * button swings it as a club (it and what it hits are hurt), the heavy button slams it into the ground, G again throws
 * it at the crosshair. Orlan: holding right click lifts what the crosshair is on — a mob, loose rubble, or a whole small
 * building, lifted in one piece (playtest 2026-11-17: no longer torn apart) — into a swaying hold in front of where he
 * looks; left click throws it at the crosshair, letting go sets it down. What is thrown hurts what it hits and what it
 * lands on, by its mass and speed, and breaks the world only where it lands.
 */
import { Vector3 } from 'three';
import type { Enemy } from './Enemy';
import type { DebrisSim, Piece } from '../world/Debris';
import type { BlowKind } from '../world/Breakables';
import { aimedVelocity, canHandGrab, canLift, handHold, impactDamage, massOf, mindHold, steerTo, THROW_G } from './Carry';
import { Dangle } from './Dangle';

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
  /** Telekinesis is off cooldown (a lift may start); unset: always. */
  mindReady?(): boolean;
  /** What he held was thrown or slammed down: Telekinesis' cooldown starts. */
  mindSpent?(): void;
  /** Lifts the small building at (x, z) whole off its footing (its colliders go with it), or null. */
  takeBuilding?(x: number, z: number): HeldBuilding | null;
  /** Where the active hero's sword hand is now (the knight's fist); false when it has none. */
  fist?(out: Vector3): boolean;
}

/** A building Orlan holds in one piece (Breakables.takeWhole). (x, y, z): its base. */
export interface HeldBuilding {
  x: number; y: number; z: number; r: number; height: number;
  /** Puts its base at (x, y, z), tilted (radians about world x and z). */
  move(x: number, y: number, z: number, tiltX: number, tiltZ: number): void;
  /** It came down with its base at (x, y, z): upright, solid again there. */
  land(x: number, y: number, z: number): void;
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
/** A thrown building flies under this gravity (heavier-feeling than loose pieces) at about this speed. */
const G_HOUSE = 14;
const HOUSE_SPEED = 20;
/** Throw speeds across the ground (m/s): the knight's by hand, Orlan's by the mind, loose pieces (heavier is slower). */
const KNIGHT_THROW = 15, MIND_THROW = 24, PIECE_THROW = 22;
/** Sir Aldric's swing of a held mob: how long, how far round (radians each side), at what reach. */
const SWING = { t: 0.42, arc: 1.25, reach: 1.45 };

interface Flying { until: number; hit: Set<number>; mass: number }

const _v = new Vector3(), _w = new Vector3(), _g = new Vector3(), _p = new Vector3();

/** The fist's place without a rig: in front at head height (Carry.handHold's grip). */
function handHoldGrip(me: { pos: Vector3; yaw: number }, h: number): [number, number, number] {
  const p = handHold(me.pos, me.yaw, h);
  return [p.x, p.y + h * 0.85, p.z];
}

export class CarrySystem {
  /** The knight's fist: the mob he holds. */
  hand: { e: Enemy; t: number; dangle: Dangle; swing: number; swung: Set<number> } | null = null;
  /** Orlan's hold. */
  mind: {
    e: Enemy | null; pieces: Map<Piece, Vector3>; from: { x: number; z: number; r: number; until: number } | null; t: number;
    whole: { b: HeldBuilding; x: number; y: number; z: number; sway: Dangle } | null; dangle: Dangle | null;
  } | null = null;
  /** A building in the air (thrown or let go). */
  private house: { b: HeldBuilding; x: number; y: number; z: number; vx: number; vy: number; vz: number; t: number; hit: Set<number>; spin: number } | null = null;
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
    if (this.mind) this.letGo(this.mind);
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
    if (this.house) this.flyHouse(dt);
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
      this.hand = { e, t: 0, dangle: new Dangle(e.def.height * (e.def.scale ?? 1) * 0.6), swing: 0, swung: new Set() };
      this.h.sound.grab();
      return true;
    }
    const hd = this.hand;
    hd.t += dt;
    const e = hd.e;
    if (!e.alive || hd.t > 12) { this.release(e, { x: 0, y: 0, z: 0 }); this.hand = null; return false; }
    const h = e.def.height * (e.def.scale ?? 1);
    const fx = Math.cos(me.yaw), fz = Math.sin(me.yaw);
    // Where his fist is: the rig's sword hand, else in front at head height.
    const grip = this.h.fist?.(_g) ? _g : _g.set(...handHoldGrip(me, h));
    if (hd.swing > 0) {
      // Swung round in front of him as a club, from his right across to his left.
      hd.swing = Math.max(0, hd.swing - dt);
      const k = 1 - hd.swing / SWING.t;
      const a = me.yaw - SWING.arc + k * SWING.arc * 2;
      grip.set(me.pos.x + Math.cos(a) * SWING.reach, me.pos.y + 1.7, me.pos.z + Math.sin(a) * SWING.reach);
      this.clubHits(hd, grip);
    }
    hd.dangle.update(dt, grip.x, grip.z);
    // Lifted off its feet over a fifth of a second, then hanging from the fist by the neck, swinging.
    const k = Math.min(1, hd.t / 0.2);
    const want = { x: grip.x + hd.dangle.dx, y: grip.y - h * 0.85, z: grip.z + hd.dangle.dz };
    e.pos.x += (want.x - e.pos.x) * k;
    e.pos.z += (want.z - e.pos.z) * k;
    e.pos.y += (want.y - e.pos.y) * k;
    e.yaw = me.yaw + Math.PI;
    e.swing = { x: hd.dangle.tiltX, z: hd.dangle.tiltZ };
    if (input.grab) {
      // Thrown at the crosshair.
      const at = this.h.aimAt() ?? _v.set(me.pos.x + fx * 8, me.pos.y, me.pos.z + fz * 8);
      this.release(e, aimedVelocity(e.pos, at, THROW_G, KNIGHT_THROW / Math.sqrt(massOf(e.def))));
      this.thrown.set(e, new Set([e.id]));
      this.hand = null;
      this.h.sound.throw(true);
      return true;
    }
    if (input.attack && hd.swing <= 0) {
      hd.swing = SWING.t;
      hd.swung.clear();
      hd.dangle.kick(-fz * 6, fx * 6);
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
    return input.attack || input.heavyHeld || hd.swing > 0;
  }

  /** The held mob, swung, strikes the mobs it passes through: they are hurt, and so is it, once each a swing. */
  private clubHits(hd: NonNullable<CarrySystem['hand']>, at: Vector3): void {
    const e = hd.e;
    const mass = massOf(e.def);
    for (const o of this.h.enemies()) {
      if (o === e || !o.alive || o.held || hd.swung.has(o.id)) continue;
      const reach = 0.9 + o.def.bodyRadius * (o.def.scale ?? 1);
      if (Math.hypot(o.pos.x - at.x, o.pos.z - at.z) > reach) continue;
      hd.swung.add(o.id);
      this.h.hit(o, 1.2 + mass * 0.4, _w.set(o.pos.x, at.y - 0.6, o.pos.z).clone(), true);
      if (!hd.swung.has(e.id)) { hd.swung.add(e.id); this.h.hit(e, 0.6, _w.set(e.pos.x, e.pos.y + 1, e.pos.z).clone(), false); }
      this.h.fx.dust(_w.set(o.pos.x, at.y - 0.8, o.pos.z), 0.7);
      this.h.shake(0.3);
    }
  }

  // --- Orlan --------------------------------------------------------------------------------------------------------

  private wizard(dt: number, input: CarryInput): boolean {
    const me = this.h.hero();
    if (!this.mind) {
      if (!input.heavyHeld || this.heavyWas || this.h.mindReady?.() === false) return false;
      return this.lift();
    }
    const m = this.mind;
    m.t += dt;
    const yaw = this.lookYaw(me.yaw);
    const centre = mindHold(me.pos, yaw, m.t);
    const rise = Math.min(1, m.t / 0.45);
    if (m.from && m.t < m.from.until) this.gather(m, m.from.x, m.from.z, m.from.r);
    if (m.whole) {
      // The building hangs before him, its base a little over the ground, swaying as he turns (lagging on a spring).
      const w = m.whole;
      const ahead = 3.5 + w.b.r;
      const tx = me.pos.x + Math.cos(yaw) * ahead, tz = me.pos.z + Math.sin(yaw) * ahead;
      const ty = Math.max(me.pos.y + 1.2, this.h.groundAt(tx, tz, me.pos.y + 4) + 0.6) + Math.sin(m.t * 1.8) * 0.2;
      const k = Math.min(1, dt * 2.5) * rise;
      w.x += (tx - w.x) * k; w.y += (ty - w.y) * Math.min(1, dt * 2.5); w.z += (tz - w.z) * k;
      w.sway.update(dt, w.x, w.z);
      w.b.move(w.x, w.y, w.z, w.sway.tiltX * 0.25, w.sway.tiltZ * 0.25);
      // Grit and dust falling off its foundations.
      if (Math.random() < dt * 8) this.h.fx.dust(_v.set(w.x + (Math.random() - 0.5) * w.b.r, w.y, w.z + (Math.random() - 0.5) * w.b.r), 0.6);
    }
    if (m.e) {
      const e = m.e;
      if (!e.alive || m.t > 6) { this.release(e, { x: 0, y: -1, z: 0 }); m.e = null; }
      else {
        const h = e.def.height * (e.def.scale ?? 1);
        const k = Math.min(1, dt * 6) * rise;
        m.dangle ??= new Dangle(h * 0.6);
        m.dangle.update(dt, centre.x, centre.z);
        e.pos.x += (centre.x + m.dangle.dx - e.pos.x) * k;
        e.pos.y += (centre.y - h * 0.5 + 0.3 - e.pos.y) * k;
        e.pos.z += (centre.z + m.dangle.dz - e.pos.z) * k;
        e.swing = { x: m.dangle.tiltX, z: m.dangle.tiltZ };
      }
    }
    // The pieces circle slowly round the hold, drawn in tight.
    const spin = m.t * 0.9, c = Math.cos(spin), s = Math.sin(spin);
    for (const [p, off] of m.pieces) {
      if (p.dead) { m.pieces.delete(p); continue; }
      _w.set(centre.x + (off.x * c - off.z * s), centre.y + off.y + Math.sin(m.t * 3 + off.x * 4) * 0.12, centre.z + (off.x * s + off.z * c));
      _w.lerpVectors(_v.set(p.x, p.y, p.z), _w, rise);
      const v = steerTo(p, _w, dt, G_SIM);
      p.vx = v.vx; p.vy = v.vy; p.vz = v.vz;
      p.wx *= 0.9; p.wy *= 0.9; p.wz *= 0.9;
      p.awake = true; p.still = 0;
    }
    if (Math.random() < dt * 6 && (m.pieces.size || m.e)) this.h.fx.dust(_v.set(centre.x, centre.y - 0.6, centre.z), 0.5);
    if (!m.e && !m.whole && !m.pieces.size && !(m.from && m.t < m.from.until)) { this.mind = null; return false; }
    // Left click: thrown at the crosshair. Letting go of right click: set down.
    if (input.attack) { this.throwAt(m); return true; }
    if (!input.heavyHeld) { this.letGo(m); return true; }
    return true;
  }

  /** The way the camera looks, flat (Orlan holds what he lifts in front of his view, not his feet). */
  private lookYaw(fallback: number): number {
    const d = this.h.lookDir();
    return Math.hypot(d.x, d.z) > 1e-3 ? Math.atan2(d.z, d.x) : fallback;
  }

  /** Throws all Orlan holds at the crosshair (else straight ahead). */
  private throwAt(m: NonNullable<CarrySystem['mind']>): void {
    const me = this.h.hero();
    const yaw = this.lookYaw(me.yaw);
    const at = this.h.aimAt() ?? new Vector3(me.pos.x + Math.cos(yaw) * 15, me.pos.y, me.pos.z + Math.sin(yaw) * 15);
    if (m.e) {
      this.release(m.e, aimedVelocity(m.e.pos, at, THROW_G, MIND_THROW / Math.sqrt(massOf(m.e.def))));
      this.thrown.set(m.e, new Set([m.e.id]));
    }
    for (const p of m.pieces.keys()) {
      const mass = Math.max(0.2, Math.min(6, 1 / Math.max(1e-4, p.invM) / 120));
      const v = aimedVelocity(p, { x: at.x + (Math.random() - 0.5) * 1.5, y: at.y, z: at.z + (Math.random() - 0.5) * 1.5 }, G_SIM, PIECE_THROW);
      p.vx = v.x; p.vy = v.y; p.vz = v.z;
      p.wx = (Math.random() - 0.5) * 6; p.wy = (Math.random() - 0.5) * 6; p.wz = (Math.random() - 0.5) * 6;
      this.flying.set(p, { until: this.time + 2.5, hit: new Set(), mass });
    }
    if (m.whole) {
      const w = m.whole;
      const v = aimedVelocity(w, at, G_HOUSE, HOUSE_SPEED);
      this.house = { b: w.b, x: w.x, y: w.y, z: w.z, vx: v.x, vy: v.y, vz: v.z, t: 0, hit: new Set(), spin: (Math.random() < 0.5 ? -1 : 1) * 0.6 };
    }
    this.h.sound.throw(m.pieces.size > 8 || !!m.e || !!m.whole);
    this.mind = null;
    this.h.mindSpent?.();
  }

  /** Lets go of what Orlan holds: it falls where it hangs. */
  private letGo(m: NonNullable<CarrySystem['mind']>): void {
    if (m.e) this.release(m.e, { x: 0, y: -1, z: 0 });
    if (m.whole) this.house = { b: m.whole.b, x: m.whole.x, y: m.whole.y, z: m.whole.z, vx: 0, vy: 0, vz: 0, t: 0, hit: new Set(), spin: 0 };
    this.mind = null;
    this.h.mindSpent?.();
  }

  /** A building in the air: it falls, strikes the mobs it passes, and lands — breaking only where it hits. */
  private flyHouse(dt: number): void {
    const f = this.house!;
    f.t += dt;
    f.vy -= G_HOUSE * dt;
    f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
    const speed = Math.hypot(f.vx, f.vy, f.vz);
    // Tumbling a little forward as it flies.
    const tilt = Math.min(0.5, f.t * Math.abs(f.spin));
    const l = Math.hypot(f.vx, f.vz) || 1;
    f.b.move(f.x, f.y, f.z, (f.vz / l) * tilt, -(f.vx / l) * tilt);
    if (speed > 5) for (const o of this.h.enemies()) {
      if (!o.alive || o.held || f.hit.has(o.id)) continue;
      if (Math.hypot(o.pos.x - f.x, o.pos.z - f.z) > f.b.r + o.def.bodyRadius * (o.def.scale ?? 1) || o.pos.y > f.y + f.b.height || o.pos.y + o.def.height * (o.def.scale ?? 1) < f.y) continue;
      f.hit.add(o.id);
      this.h.hit(o, impactDamage(6, speed), _v.set(o.pos.x, o.pos.y + 1, o.pos.z).clone(), true);
    }
    const g = this.h.groundAt(f.x, f.z, f.y + 1);
    if ((f.y > g || f.vy > 0) && f.t < 8) return;
    // Down: upright and solid where it came down; the part that struck first breaks off.
    this.house = null;
    f.b.land(f.x, g, f.z);
    if (speed < 6) { this.h.fx.dust(_v.set(f.x, g, f.z), f.b.r * 0.6); this.h.sound.land(2); return; }
    const hx = f.x + (f.vx / l) * f.b.r * 0.6, hz = f.z + (f.vz / l) * f.b.r * 0.6;
    this.h.breakAt(hx, g + 0.8, hz, Math.min(2.2, 1.2 + speed * 0.04), speed > 14 ? 'skill' : 'heavy');
    for (const o of this.h.enemies()) {
      if (!o.alive || o.held || f.hit.has(o.id)) continue;
      if (Math.hypot(o.pos.x - f.x, o.pos.z - f.z) < f.b.r + 1) this.h.hit(o, impactDamage(5, speed), _v.set(o.pos.x, o.pos.y + 0.5, o.pos.z).clone(), true);
    }
    this.h.fx.shock(_v.set(f.x, g + 0.1, f.z), 0xc8c0b0, f.b.r * 2.2, 0.6);
    this.h.fx.dust(_v.set(f.x, g, f.z), f.b.r);
    this.h.shake(Math.min(1, 0.3 + speed * 0.03));
    this.h.sound.land(4);
  }

  /**
   * What a throw now would fly (the aim preview draws it): from what is held to the crosshair, under its gravity at its
   * speed; `arc` is how high the flight rises over the straight line at its middle (a parabola's g·T²/8). Null: nothing
   * held, or no crosshair point.
   */
  throwPreview(): { from: Vector3; to: Vector3; arc: number; r: number } | null {
    const spec = this.throwSpec();
    const to = this.h.aimAt();
    if (!spec || !to) return null;
    const T = Math.max(0.35, Math.hypot(to.x - spec.from.x, to.z - spec.from.z) / spec.speed);
    return { from: spec.from.clone(), to: to.clone(), arc: (spec.g * T * T) / 8, r: spec.r };
  }

  /** Where a throw would start, under what gravity and at what speed (shared by the throw and its preview). */
  private throwSpec(): { from: Vector3; g: number; speed: number; r: number } | null {
    if (this.hand) {
      const e = this.hand.e;
      return { from: _p.copy(e.pos), g: THROW_G, speed: KNIGHT_THROW / Math.sqrt(massOf(e.def)), r: 1.5 };
    }
    const m = this.mind;
    if (!m) return null;
    if (m.whole) return { from: _p.set(m.whole.x, m.whole.y, m.whole.z), g: G_HOUSE, speed: HOUSE_SPEED, r: m.whole.b.r };
    if (m.e) return { from: _p.copy(m.e.pos), g: THROW_G, speed: MIND_THROW / Math.sqrt(massOf(m.e.def)), r: 1.5 };
    const h = this.holding();
    return h ? { from: _p.copy(h.to), g: G_SIM, speed: PIECE_THROW, r: 1.5 } : null;
  }

  /** Where Orlan's hold is and how big what he holds is (the beam and field run to it), or null. */
  holding(): { to: Vector3; r: number } | null {
    const m = this.mind;
    if (!m) return null;
    const me = this.h.hero();
    if (m.whole) return { to: new Vector3(m.whole.x, m.whole.y + m.whole.b.height * 0.5, m.whole.z), r: m.whole.b.r + 0.5 };
    const c = mindHold(me.pos, this.lookYaw(me.yaw), m.t);
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

  private glowAge = Infinity;
  private glowLast: ReturnType<CarrySystem['liftTarget']> = null;

  /** liftTarget for the glow under the crosshair, looked up again at most ten times a second (it scans every piece). */
  glowTarget(dt: number): ReturnType<CarrySystem['liftTarget']> {
    this.glowAge += dt;
    if (this.glowAge >= 0.1) { this.glowAge = 0; this.glowLast = this.liftTarget(); }
    return this.glowLast;
  }

  /** On the lift's press: what liftTarget finds — a mob, the rubble there, or a small building torn up. */
  private lift(): boolean {
    const t = this.liftTarget();
    if (!t) return false;
    const at = this.h.aimAt()!;
    const m: NonNullable<CarrySystem['mind']> = { e: null, pieces: new Map<Piece, Vector3>(), from: null, t: 0, whole: null, dangle: null };
    if (t.kind === 'mob') {
      t.e!.held = true;
      t.e!.thrown = null;
      m.e = t.e!;
    } else if (t.kind === 'rubble') this.gather(m, at.x, at.z, 2.6);
    else if (this.h.takeBuilding) {
      // Lifted whole, off its footing (playtest 2026-11-17: tearing it apart was not what he wanted).
      const b = this.h.takeBuilding(t.x, t.z);
      if (!b) return false;
      m.whole = { b, x: b.x, y: b.y, z: b.z, sway: new Dangle(3) };
      this.h.shake(0.5);
      this.h.fx.dust(_v.set(b.x, b.y, b.z), b.r);
    } else {
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

  // --- what is in the air -------------------------------------------------------------------------------------------

  private release(e: Enemy, v: { x: number; y: number; z: number }): void {
    e.held = false;
    e.swing = null;
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

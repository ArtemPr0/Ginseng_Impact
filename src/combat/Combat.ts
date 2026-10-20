import { REACTIONS, type ReactionId } from './Elements';

export interface DamageInput {
  atk: number;
  multiplier: number;
  defense: number;
  reaction?: ReactionId | null;
}

/** Genshin-shaped formula: atk × mult × 100/(100+def) × reaction. Integer, at least 1. */
export function computeDamage(d: DamageInput): number {
  const reactionMult = d.reaction ? REACTIONS[d.reaction].damageMult : 1;
  const raw = d.atk * d.multiplier * (100 / (100 + Math.max(0, d.defense))) * reactionMult;
  return Math.max(1, Math.round(raw));
}

/** The chance every hero hit has to crit before charms and affixes (Inventory.critBonus adds to it). */
export const CRIT_CHANCE = 0.1;
/** What a crit multiplies a hit's damage by (on top of any reaction). */
export const CRIT_MULT = 1.6;

/**
 * One hit's damage with its crit roll: one draw of `rnd` against `chance` (a chance of 1 or more always crits). A crit
 * multiplies the damage by CRIT_MULT on top of any reaction; the rounding happens once, at the end. A chance of 0 never
 * draws (ground zones, smoke and companions do not crit).
 */
export function rollHit(d: DamageInput, chance: number, rnd: () => number = Math.random): { amount: number; crit: boolean } {
  const crit = chance > 0 && rnd() < Math.min(1, chance);
  return { amount: computeDamage(crit ? { ...d, multiplier: d.multiplier * CRIT_MULT } : d), crit };
}

/** A piercing shot's hit-stop on each body after the first it cuts, as a share of its own (see pierceStop). */
export const PIERCE_STOP = 0.3;

/**
 * The hit-stop a piercing shot (Crimson Cleave's crescent) lands on the `nth` body it cuts, 1 being the first: its full
 * `stop` there, PIERCE_STOP of it on each after. Its bodies are struck on separate steps, so a full freeze on each would
 * stall the fight once per mob in the line.
 */
export function pierceStop(stop: number, nth: number): number {
  return nth <= 1 ? stop : stop * PIERCE_STOP;
}

/** A shot riding the ground (Crimson Cleave's crescent) rides up a step of RIDE_UP metres at most, and down RIDE_DROP at most. */
export const RIDE_UP = 1.2;
export const RIDE_DROP = 2.5;
/** A ground-riding shot lays its burning patch only on ground at most PATCH_DROP metres under its base. */
export const PATCH_DROP = 0.5;

/**
 * One step of a shot riding the ground: the height its base rides at over `ground` (the ground under it, asked RIDE_UP
 * over its base `base`), or null where it breaks on a step higher than RIDE_UP. Up a slope or down one it follows the
 * ground; over a drop deeper than RIDE_DROP it holds its height and sails across.
 */
export function rideBase(base: number, ground: number): number | null {
  if (ground > base + RIDE_UP) return null;
  return ground > base - RIDE_DROP ? ground : base;
}

/**
 * Where a ground-riding shot lays a patch of burning ground, asked as rideBase is (its base, the ground under it): on
 * that ground; at its base where the ground rises over it (the step or wall it broke on: the patch lies at the foot);
 * nowhere (null) over ground more than PATCH_DROP below it, where it sails across a drop and a patch at its height would
 * hang in the air (its tick, across the ground only, burning whatever stands far below).
 */
export function patchHeight(base: number, ground: number): number | null {
  return ground < base - PATCH_DROP ? null : Math.min(ground, base);
}

/** What one blow charges the burst (full at 100). */
export const HIT_ENERGY = 6;
/** How many bodies one cast of a many-shot skill charges the burst for (CastCharge). */
export const CAST_BODIES = 3;

/**
 * The burst charge of one cast of a many-shot skill (Moon Volley's six arrows, Starfall's four stars), shared by its
 * shots: HIT_ENERGY for each body the cast strikes, the first time any of its shots strikes it, CAST_BODIES bodies at
 * most. A cast so charges no more than the single chaining bolt each of these skills was (a body and two chained on,
 * 18 at most), however many of its shots land: twelve hits at a blow's worth each would fill the burst in two casts.
 */
export class CastCharge {
  private readonly struck = new Set<number>();

  constructor(readonly bodies = CAST_BODIES) {}

  /** A shot of the cast struck body `id`: what that charges (HIT_ENERGY for a body new to the cast under the cap, else 0). */
  take(id: number): number {
    if (this.struck.has(id) || this.struck.size >= this.bodies) return 0;
    this.struck.add(id);
    return HIT_ENERGY;
  }
}

/** The combo counter: hits in a row, each landing within `window` seconds of the last; a pause drops it to 0. */
export class HitStreak {
  count = 0;
  private left = 0;

  constructor(readonly window = 1.2) {}

  /** A hit landed: returns the new count. */
  hit(): number {
    this.count++;
    this.left = this.window;
    return this.count;
  }

  update(dt: number): void {
    if (this.count === 0) return;
    this.left -= dt;
    if (this.left <= 0) { this.count = 0; this.left = 0; }
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/**
 * The part of a clip cut (0..1) in which the blade is cutting: a `measured` window, in seconds of the source clip,
 * mapped into the cut's [from, to] and clamped; without one, `around` (a fraction of the cut) either side of `strike`.
 */
export function cutWindow(from: number, to: number, strike: number, measured?: readonly [number, number] | null, around = 0.22): [number, number] {
  if (measured) {
    const span = Math.max(1e-6, to - from);
    return [clamp01((measured[0] - from) / span), clamp01((measured[1] - from) / span)];
  }
  return [clamp01(strike - around), clamp01(strike + around)];
}

export interface P2 { x: number; z: number }

/** yaw follows the controller convention: 0 faces +x, π/2 faces +z. */
export function inCone(origin: P2, yaw: number, target: P2, range: number, halfAngle: number): boolean {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  const d = Math.hypot(dx, dz);
  if (d > range) return false;
  if (d < 1e-6) return true;
  const ang = Math.atan2(dz, dx);
  let diff = ang - yaw;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  return Math.abs(diff) <= halfAngle;
}

export function inRadius(origin: P2, target: P2, radius: number): boolean {
  const dx = target.x - origin.x;
  const dz = target.z - origin.z;
  return dx * dx + dz * dz <= radius * radius;
}

/** Lock-on (Tab): how far it picks (metres), and how far its target may get before the lock lets go. */
export const LOCK_RANGE = 30;
export const UNLOCK_RANGE = 40;
/** "In front of the camera": within 60° either side of its look (the cosine). */
const LOCK_FRONT = 0.5;

/** What lock-on can pick: where a body stands, whether it still stands, whether it is drawn at all. */
export interface LockCandidate { readonly alive: boolean; readonly pos: P2; readonly object: { readonly visible: boolean } }

/**
 * The body Tab locks on to: the nearest standing, drawn one within `range` of `from` in front of the camera (within 60°
 * either side of `forward`, the camera's unit look on the ground; one at the hero's feet counts), else the nearest
 * within `range` at all; null with nobody in range.
 */
export function pickLockTarget<T extends LockCandidate>(from: P2, forward: P2, bodies: Iterable<T>, range = LOCK_RANGE): T | null {
  let front: T | null = null;
  let any: T | null = null;
  let fd = range;
  let ad = range;
  for (const b of bodies) {
    if (!b.alive || !b.object.visible) continue;
    const dx = b.pos.x - from.x;
    const dz = b.pos.z - from.z;
    const d = Math.hypot(dx, dz);
    // (The nearest in front is never nearer than the nearest of all: past it, a body is neither.)
    if (d >= fd) continue;
    if (d < ad) { ad = d; any = b; }
    if (d < 0.5 || (dx * forward.x + dz * forward.z) / d > LOCK_FRONT) { fd = d; front = b; }
  }
  return front ?? any;
}

/** A lock on `target` holds while it stands within `range` of `from`. */
export function lockHolds(target: LockCandidate, from: P2, range = UNLOCK_RANGE): boolean {
  return target.alive && Math.hypot(target.pos.x - from.x, target.pos.z - from.z) <= range;
}

/** The lock-on: Tab picks a target (pickLockTarget) or lets go of it; it lets go by itself once the target falls or gets away. */
export class LockOn<T extends LockCandidate> {
  target: T | null = null;

  /** Tab: lets go when locked on, else locks on to pickLockTarget's choice. Returns the target, or null. */
  toggle(from: P2, forward: P2, bodies: Iterable<T>): T | null {
    this.target = this.target ? null : pickLockTarget(from, forward, bodies);
    return this.target;
  }

  /** Every step: lets go of a target that fell or is past UNLOCK_RANGE of the hero at `from`. */
  update(from: P2): void {
    if (this.target && !lockHolds(this.target, from)) this.target = null;
  }
}

export class Cooldown {
  private left = 0;

  constructor(readonly duration: number) {}

  get ready(): boolean {
    return this.left <= 0;
  }

  /** 1 = just used, 0 = ready. */
  get fraction(): number {
    return this.left <= 0 ? 0 : this.left / this.duration;
  }

  use(): void {
    this.left = this.duration;
  }

  update(dt: number): void {
    this.left = Math.max(0, this.left - dt);
  }
}

/**
 * Normal-attack combo sequencing. A press starts hit 0; a press during the back part of a swing
 * buffers the next hit; the combo resets after `resetAfter` seconds idle. `update` returns the
 * hit index exactly once, at that hit's fraction of its swing (`hitFractions[i]`: the moment the clip's
 * blow lands, see heroClips.ts).
 */
export class ComboTracker {
  currentHit = 0;
  swinging = false;
  /** Seconds into the current swing. */
  swingTime = 0;
  private buffered = false;
  private fired = false;
  private idle = Infinity;

  constructor(readonly durations: readonly number[], readonly hitFractions: readonly number[], readonly resetAfter = 1.0, readonly bufferWindow = 0.45) {}

  get duration(): number {
    return this.durations[this.currentHit];
  }

  /** Where in the current swing its damage lands, 0..1. */
  get hitFraction(): number {
    return this.hitFractions[this.currentHit] ?? this.hitFractions[this.hitFractions.length - 1] ?? 0.4;
  }

  /** 0..1 progress of the current swing (for the rig). */
  get progress(): number {
    return this.swinging ? Math.min(1, this.swingTime / this.duration) : 0;
  }

  /** Returns the hit index that started, or null if the press was buffered or ignored. */
  press(): number | null {
    if (this.swinging) {
      if (this.swingTime >= this.duration * (1 - this.bufferWindow)) this.buffered = true;
      return null;
    }
    // Pressed again soon after a swing ended: the combo goes on to the next hit; after a pause it starts over.
    this.currentHit = this.idle > this.resetAfter ? 0 : (this.currentHit + 1) % this.durations.length;
    this.start();
    return this.currentHit;
  }

  private start(): void {
    this.swinging = true;
    this.swingTime = 0;
    this.fired = false;
    this.buffered = false;
    this.idle = 0;
  }

  /** Advances; returns the hit index when its damage frame is reached. */
  update(dt: number): number | null {
    if (!this.swinging) {
      this.idle += dt;
      return null;
    }
    this.swingTime += dt;
    let hit: number | null = null;
    if (!this.fired && this.swingTime >= this.duration * this.hitFraction) {
      this.fired = true;
      hit = this.currentHit;
    }
    if (this.swingTime >= this.duration) {
      if (this.buffered) {
        this.currentHit = (this.currentHit + 1) % this.durations.length;
        this.start();
      } else {
        this.swinging = false;
        this.idle = 0;
      }
    }
    return hit;
  }
}

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

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

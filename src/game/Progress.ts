/**
 * Party-wide experience and levels. Pure: no three.js, no DOM. One Progress for every hero: a kill feeds the party,
 * and the level scales every hero's attack and HP (atkMult, hpMult).
 */
export const MAX_LEVEL = 30;

/** Experience for killing an enemy: a 25th of its HP, and 400 more for a boss. */
export function xpForKill(def: { maxHp: number; boss?: boolean }): number {
  return Math.round(def.maxHp / 25) + (def.boss ? 400 : 0);
}

/** Experience needed to go from `level` to the next: 60 · level^1.6 (60, 182, 348, 553, 794 ...). */
export function xpFor(level: number): number {
  return Math.round(60 * Math.pow(Math.max(1, level), 1.6));
}

/** Attack multiplier at `level`: +3% a level. */
export function atkMult(level: number): number {
  return 1 + 0.03 * (clampLevel(level) - 1);
}

/** Max HP multiplier at `level`: +4% a level. */
export function hpMult(level: number): number {
  return 1 + 0.04 * (clampLevel(level) - 1);
}

function clampLevel(level: number): number {
  return Math.min(MAX_LEVEL, Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));
}

export interface ProgressSnapshot { xp: number; level: number }

export class Progress {
  /** Experience into the current level (0 .. xpFor(level) − 1; 0 at the cap). */
  xp = 0;
  level = 1;

  /** Adds experience; returns how many levels it gained (0 at the cap). */
  add(xp: number): number {
    if (!(xp > 0) || this.level >= MAX_LEVEL) return 0;
    let gained = 0;
    this.xp += xp;
    while (this.level < MAX_LEVEL && this.xp >= xpFor(this.level)) {
      this.xp -= xpFor(this.level);
      this.level++;
      gained++;
    }
    if (this.level >= MAX_LEVEL) { this.level = MAX_LEVEL; this.xp = 0; }
    return gained;
  }

  /** Experience still needed for the next level (0 at the cap). */
  toNext(): number {
    return this.level >= MAX_LEVEL ? 0 : xpFor(this.level) - this.xp;
  }

  snapshot(): ProgressSnapshot {
    return { xp: this.xp, level: this.level };
  }

  /** Restores a snapshot, clamped to sane values (a level past the cap stays at the cap, bad numbers reset). */
  restore(s: ProgressSnapshot): void {
    this.level = clampLevel(s.level);
    const xp = Number.isFinite(s.xp) ? Math.max(0, Math.floor(s.xp)) : 0;
    this.xp = this.level >= MAX_LEVEL ? 0 : Math.min(xp, xpFor(this.level) - 1);
  }
}

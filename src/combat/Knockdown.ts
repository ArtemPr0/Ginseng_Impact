/**
 * Knockdowns (v12, 2026-11-16, from the Flowbound clips: heavy blows put bodies on the ground). A heavy enough blow
 * (knockback strength KNOCKDOWN_AT and up) on a small grounded mob tips it over away from the blow about its feet in
 * a third of a second, it lies there, and it gets back up over the last 0.6 s. Bosses, flyers, the rooted and big
 * bodies stay on their feet. Pure maths; Enemy applies it.
 */

/** Knockback strength from which a blow knocks a small mob down. */
export const KNOCKDOWN_AT = 6;
/** Seconds on the ground, falling and getting up included. */
export const KNOCKDOWN_S = 1.6;
/** How far over it goes (radians: nearly flat). */
const FLAT = 1.4;
const FALL = 0.32;
const RISE = 0.6;

export function canKnockDown(d: { boss?: boolean; flying?: boolean; speed: number; height: number }, strength: number): boolean {
  return strength >= KNOCKDOWN_AT && !d.boss && !d.flying && d.speed > 0 && d.height <= 3.5;
}

/** 0 standing .. 1 flat on the ground, `t` seconds into a knockdown lasting `len`. */
export function knockdownTilt(t: number, len: number): number {
  if (t <= 0 || t >= len) return 0;
  // Over like a felled body: slow at the top, fast at the end (gravity).
  if (t < FALL) { const k = t / FALL; return k * k; }
  if (t < len - RISE) return 1;
  const k = (len - t) / RISE;
  return k * k * (3 - 2 * k);
}

/**
 * The body's lean (radians, in its own frame: pitch forward-positive, roll) for a blow pushing along (kx, kz) on a
 * body facing (fx, fz), at `tilt` (0..1).
 */
export function knockdownLean(kx: number, kz: number, yaw: number, tilt: number): { pitch: number; roll: number } {
  const l = Math.hypot(kx, kz) || 1;
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  const along = (kx * fx + kz * fz) / l;
  const side = (kx * -fz + kz * fx) / l;
  return { pitch: along * FLAT * tilt, roll: -side * FLAT * tilt };
}

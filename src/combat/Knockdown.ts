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
 * The body's lean for a blow pushing along (kx, kz), `tilt` (0..1) of the way over: the Euler pitch (x) and roll (z)
 * that, under the model's own turn `rotY` (Euler order YXZ, as Enemy sets it), tip its top along the push.
 */
export function knockdownLean(kx: number, kz: number, rotY: number, tilt: number): { pitch: number; roll: number } {
  const l = Math.hypot(kx, kz) || 1;
  const ux = kx / l, uz = kz / l;
  // Under YXZ the up axis goes to sin(p)cos(r)·A + sin(r)·B (+ y), with A = (sin rotY, 0, cos rotY) and
  // B = (-cos rotY, 0, sin rotY): split the push between them.
  const a = ux * Math.sin(rotY) + uz * Math.cos(rotY);
  const b = -ux * Math.cos(rotY) + uz * Math.sin(rotY);
  const s = Math.sin(FLAT * tilt);
  const roll = Math.asin(Math.max(-1, Math.min(1, s * b)));
  const pitch = Math.asin(Math.max(-1, Math.min(1, (s * a) / Math.max(1e-6, Math.cos(roll)))));
  return { pitch, roll };
}

/**
 * A body on a slope: it pitches toward the ground's normal (front edge down a descent, up a climb) and rolls half as
 * far across it, and leans into a turn the way a runner does (atan(v·ω/g)). Eased toward the target at ~8/s; zero
 * while flying, swimming or climbing (the caller passes `on = false`). Pure: angles in radians for a root whose
 * rotation order is 'YXZ' (yaw first, then this pitch about its own lateral axis, then this roll about its forward).
 * Yaw follows the game's convention: facing (cos yaw, sin yaw) on x/z, drawn as rotation.y = π/2 − yaw.
 */
export const SLOPE = {
  /** Largest pitch along the slope (10°). */
  pitch: (10 * Math.PI) / 180,
  /** Roll across the slope, as a fraction of the normal's lateral tilt. */
  rollRatio: 0.5,
  /** Largest lean into a turn (6°). */
  turn: (6 * Math.PI) / 180,
  /** Easing rate (1/s). */
  rate: 8,
  /** Gravity for the turn lean. */
  g: 9.8,
} as const;

export interface Lean { pitch: number; roll: number }

const clamp = (v: number, m: number): number => Math.max(-m, Math.min(m, v));

/**
 * The lean a body wants: `gx`, `gz` the ground's gradient (dh/dx, dh/dz) under it, `yaw` its heading, `yawRate`
 * radians per second (positive = yaw increasing), `speed` metres per second over the ground. `scale` shrinks the
 * limits (a very big body tips less).
 */
export function slopeTarget(gx: number, gz: number, yaw: number, yawRate: number, speed: number, out: Lean, scale = 1): Lean {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  // Rise per metre straight ahead, and toward the body's local +x (its left: the model faces local +z).
  const along = gx * c + gz * s;
  const side = gx * s - gz * c;
  const max = SLOPE.pitch * scale;
  // Up a climb the normal tips back: a negative pitch (rotation.x > 0 tips the nose down).
  out.pitch = clamp(-Math.atan(along), max);
  // Ground rising toward local +x tips the normal toward −x: rotation.z > 0 tilts the up axis that way.
  const slopeRoll = clamp(Math.atan(side) * SLOPE.rollRatio, max * SLOPE.rollRatio);
  // Turning with yaw increasing swings the nose toward local −x: the inside of the turn, lean that way.
  const turn = clamp(Math.atan((speed * yawRate) / SLOPE.g), SLOPE.turn * scale);
  out.roll = slopeRoll + turn;
  return out;
}

/** Eases `cur` toward `target` (or toward upright when `on` is false) over `dt` seconds; returns `cur`. */
export function easeLean(cur: Lean, target: Lean | null, dt: number): Lean {
  const k = 1 - Math.exp(-SLOPE.rate * Math.max(0, dt));
  const tp = target ? target.pitch : 0;
  const tr = target ? target.roll : 0;
  cur.pitch += (tp - cur.pitch) * k;
  cur.roll += (tr - cur.roll) * k;
  if (!target && Math.abs(cur.pitch) < 1e-5 && Math.abs(cur.roll) < 1e-5) { cur.pitch = 0; cur.roll = 0; }
  return cur;
}

/** The signed change from `from` to `to`, wrapped to (−π, π]. */
export function yawDelta(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

/**
 * A boat rowed back and forth along a river (the Vale's gnomes' ferry: the playtest of 2026-11-12 found a boat moored
 * there doing nothing): from z0 to z1 along the river's line x(z), easing off and on at each end, where it turns round
 * on the spot (`turn` seconds) and rows back. Bow first all the way: `heading` is the direction it points (angle from
 * +x toward +z), along its way while it moves.
 */
export interface FerryRun { z0: number; z1: number; x: (z: number) => number; speed: number; turn: number }

export function ferryAt(t: number, r: FerryRun): { x: number; z: number; heading: number } {
  const L = r.z1 - r.z0;
  const T = (L / r.speed) * 1.5; // the eased crossing's average speed is 2/3 of its top speed
  const P = 2 * (T + r.turn);
  const p = ((t % P) + P) % P;
  const ease = (u: number) => u - Math.sin(2 * Math.PI * u) / (2 * Math.PI);
  const smooth = (u: number) => u * u * (3 - 2 * u);
  const along = (z: number, dir: 1 | -1) => { const d = (r.x(z + 0.05) - r.x(z - 0.05)) / 0.1; return Math.atan2(dir, dir * d); };
  let z: number, heading: number;
  if (p < T) { z = r.z0 + L * ease(p / T); heading = along(z, 1); }
  else if (p < T + r.turn) { z = r.z1; heading = along(z, 1) + Math.PI * smooth((p - T) / r.turn); }
  else if (p < 2 * T + r.turn) { z = r.z1 - L * ease((p - T - r.turn) / T); heading = along(z, -1); }
  else { z = r.z0; heading = along(z, -1) + Math.PI * smooth((p - 2 * T - r.turn) / r.turn); }
  return { x: r.x(z), z, heading };
}

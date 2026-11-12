/**
 * A body blown far past dead (an overkill, game/Hype.isOverkill) is launched: up and away from the blow, spinning,
 * along a ballistic arc until it lands, then it burns away where it fell. `mass` (its size, 1 for a person) shortens
 * the flight: a giant barely leaves the ground.
 */
export interface Yeet {
  vx: number; vy: number; vz: number;
  /** Tumble, radians a second (about the body's sideways axis). */
  spin: number;
  /** How far it has tumbled. */
  angle: number;
  landed: boolean;
}

const G = 22;

export function launch(dirX: number, dirZ: number, mass: number): Yeet {
  const l = Math.hypot(dirX, dirZ) || 1;
  const k = 1 / Math.max(1, mass);
  const out = 7 * k;
  return { vx: (dirX / l) * out, vy: 7 + 3 * k, vz: (dirZ / l) * out, spin: (Math.random() < 0.5 ? -1 : 1) * (6 + 6 * k), angle: 0, landed: false };
}

/** One step of the flight: moves `p`, stops it on the ground (`groundAt`). */
export function yeetStep(y: Yeet, p: { x: number; y: number; z: number }, dt: number, groundAt: (x: number, z: number) => number): void {
  if (y.landed) return;
  y.vy -= G * dt;
  p.x += y.vx * dt;
  p.y += y.vy * dt;
  p.z += y.vz * dt;
  y.angle += y.spin * dt;
  const g = groundAt(p.x, p.z);
  if (p.y <= g && y.vy < 0) { p.y = g; y.landed = true; }
}

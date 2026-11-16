/**
 * Combat timing numbers for CombatSystem, Enemy and main. (The cartoon layer of 2026-11-14 — squash, comic words, the
 * spin finisher — was removed on 2026-11-16: the user wants it realistic now.)
 * - the hero lunges into a light swing, stopping short of the body in front (lungeReach);
 * - the charged heavy leaps into a slam (leapVelocity);
 * - a boss dies in slow motion (slowMoScale).
 */

/** How far short of a body a lunge stops (m). */
export const LUNGE_STOP = 0.6;

/** How far to lunge (m, up to `max`) toward a body whose near side is `gap` metres away. */
export function lungeReach(gap: number, max: number): number {
  return Math.max(0, Math.min(max, gap - LUNGE_STOP));
}

/**
 * A leap's take-off speed: up (vy) and along (vh) so it comes down `airTime` seconds later `distance` metres on, under
 * `gravity` rising and `gravity × fall` falling (the controller's heavier fall).
 */
export function leapVelocity(airTime: number, distance: number, gravity: number, fall: number): { vy: number; vh: number } {
  return { vy: (gravity * airTime) / (1 + 1 / Math.sqrt(fall)), vh: distance / Math.max(0.05, airTime) };
}

/**
 * How much heavier gravity runs through a leap of `airTime` seconds so it still peaks `apex` metres up (a cartoon leap:
 * up fast, a hang, down hard). Never lighter than the world's own (1).
 */
export function leapGravity(airTime: number, apex: number, gravity: number, fall: number): number {
  const a = 1 + 1 / Math.sqrt(fall);
  return Math.max(1, (2 * a * a * apex) / (gravity * Math.max(0.05, airTime) ** 2));
}

/** A boss's death in slow motion: this long (real seconds) at this speed, the last EASE seconds easing back. */
export const SLOW_MO = { seconds: 1.2, scale: 0.3, ease: 0.4 };

/** The world's speed with `left` seconds of slow motion to go. */
export function slowMoScale(left: number): number {
  if (left <= 0) return 1;
  if (left >= SLOW_MO.ease) return SLOW_MO.scale;
  const u = 1 - left / SLOW_MO.ease;
  return SLOW_MO.scale + (1 - SLOW_MO.scale) * u * u * (3 - 2 * u);
}

/** A drop deeper than this under the hero's feet is a fall, not a step down. */
const EDGE_DROP = 3;
/** How far short of a drop a knocked-flying hero lands. */
const EDGE_MARGIN = 1.5;

/**
 * How far a blow may knock the hero (from (x, z) with feet at `y`, along the unit (dx, dz), `want` metres at most)
 * without carrying them over a drop: probed every half metre, stopping EDGE_MARGIN short of the first drop deeper than
 * EDGE_DROP (the full pass of 2026-11-15: the Hollow King's blows threw the hero off the island's edge).
 */
export function edgeSafeReach(x: number, z: number, y: number, dx: number, dz: number, want: number, groundAt: (x: number, z: number) => number): number {
  for (let t = 0.5; t <= want + EDGE_MARGIN + 1e-6; t += 0.5) {
    if (groundAt(x + dx * t, z + dz * t) < y - EDGE_DROP) return Math.max(0, Math.min(want, t - 0.5 - EDGE_MARGIN));
  }
  return want;
}

/**
 * Seconds in the air for a body launched at `vy` m/s up from `height` metres over the ground it lands on: rising under
 * `gravity`, falling under `gravity · fall` (the controller's heavier fall).
 */
export function flightTime(vy: number, height: number, gravity: number, fall: number): number {
  const up = Math.max(0, vy) / gravity;
  const apex = Math.max(0, height) + (Math.max(0, vy) ** 2) / (2 * gravity);
  return up + Math.sqrt((2 * apex) / (gravity * fall));
}

/** Heading for things carried by water (river boats): bow along the current, turning at bends like a hull would. */

const TAU = Math.PI * 2;

/**
 * The vortex's spin while `pull` (0..1) holds the boat; once it lets go, the hull swings back to the current, ending on
 * a whole number of turns so the bow points downstream again (a part turn left over held boats sideways for good).
 */
export function settleSpin(spin: number, pull: number, dt: number): number {
  if (pull > 0) return spin + dt * pull * pull * 2.6;
  const home = Math.round(spin / TAU) * TAU;
  return spin + (home - spin) * Math.min(1, dt * 1.2);
}

/** Turns `heading` toward `target` the short way at a hull's rate (about 1.5 rad/s, eased), never snapping at a bend. */
export function steerHeading(heading: number, target: number, dt: number): number {
  const d = Math.atan2(Math.sin(target - heading), Math.cos(target - heading));
  const step = Math.sign(d) * Math.min(Math.abs(d), Math.max(Math.abs(d) * dt * 2.5, dt * 0.2), dt * 1.5);
  return heading + step;
}

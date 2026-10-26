import { Vector3 } from 'three';

/**
 * Steering shots (Wren's arrows off her ridden bow, Moon Volley, the trip volley, the Frog God's rainbow ribbons), kept
 * pure so a test can fly one: CombatSystem's projectile loop calls `steer` every step and `chainTo` when a chaining shot
 * goes on from the body it just struck.
 */

/** A body a shot can chase: its id, whether it still stands, its feet and its height. */
export interface Quarry {
  readonly id: number;
  readonly alive: boolean;
  readonly pos: { readonly x: number; readonly y: number; readonly z: number };
  readonly def: { readonly height: number; readonly scale?: number };
}

/** How a shot steers: after `delay` seconds it turns toward `target` (or `point`, with no target), `turn` growing as it goes. */
export interface Homing<T extends Quarry> { target: T | null; point: Vector3 | null; delay: number; turn: number; age: number }

/** What steering reads and changes on a shot: where it is, its velocity, the bodies it has struck, its steering. */
export interface Steered<T extends Quarry> {
  readonly pos: Vector3;
  readonly vel: Vector3;
  readonly hit: ReadonlySet<number>;
  homing: Homing<T> | null;
}

/** The nearest standing body within `range` of (x, z) that is not in `exclude`, or null (CombatSystem.nearestEnemy). */
export type NearestQuarry<T extends Quarry> = (x: number, z: number, range: number, exclude: ReadonlySet<number>) => T | null;

/** How far round a steering shot looks for another body once its own is gone (metres). */
export const RETARGET_RANGE = 20;

const want = new Vector3();

/**
 * One step of a steering shot: turned toward its body's middle (or its point), tighter as it goes, its speed kept.
 * A body that fell, or one this shot has already struck, is let go for the nearest other within RETARGET_RANGE; with
 * none, a shot whose body fell flies at the spot where it stood, and one that struck its body flies straight on (back at
 * a body it can no longer hit, it would only dive into the ground beside it).
 */
export function steer<T extends Quarry>(p: Steered<T>, dt: number, nearest: NearestQuarry<T>): void {
  const h = p.homing;
  if (!h) return;
  h.age += dt;
  if (h.age < h.delay) return;
  const was = h.target;
  if (was && (!was.alive || p.hit.has(was.id))) {
    const next = nearest(p.pos.x, p.pos.z, RETARGET_RANGE, p.hit);
    if (!next && !was.alive) h.point = new Vector3(was.pos.x, was.pos.y + 0.5, was.pos.z);
    h.target = next;
  }
  const t = h.target;
  if (t) want.set(t.pos.x, t.pos.y + t.def.height * (t.def.scale ?? 1) * 0.5, t.pos.z);
  else if (h.point) want.copy(h.point);
  else return;
  const speed = p.vel.length();
  want.sub(p.pos).normalize().multiplyScalar(speed);
  p.vel.lerp(want, 1 - Math.exp(-h.turn * dt)).setLength(speed);
  h.turn += dt * 5;
}

/**
 * A chaining shot goes on from the body it just struck to `next`: aimed straight at it (0.6 m over its feet) at `speed`,
 * and a steering one chases `next` from now on. (Left on the body it struck, which still stands, the steering would turn
 * it straight back to a body it can no longer hit, and it would dive into the ground beside it.)
 */
export function chainTo<T extends Quarry>(p: Steered<T>, next: T, speed: number): void {
  p.vel.set(next.pos.x - p.pos.x, next.pos.y + 0.6 - p.pos.y, next.pos.z - p.pos.z).normalize().multiplyScalar(speed);
  if (p.homing) {
    p.homing.target = next;
    p.homing.point = null;
  }
}

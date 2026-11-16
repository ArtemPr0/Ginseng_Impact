/**
 * What breaks the world (Breakables) when the heroes and the big mobs strike: the blow's kind, where a swing lands, and
 * which mobs are big enough to smash buildings (the user's call of 2026-11-15: bosses and big mobs, not small ones).
 */
import type { BlowKind } from '../world/Breakables';

/** A blow's breaking kind: combo hits are light, the heavy is heavy, skills (and shots of a cast) are skills. */
export function blowKindOf(blow: number | 'heavy' | 'skill' | undefined): BlowKind {
  if (typeof blow === 'number') return 'light';
  return blow === 'heavy' ? 'heavy' : 'skill';
}

/** Bosses, and mobs three metres tall or more, break what they walk into and what their slams reach. */
export function breaksThings(def: { boss?: boolean; height: number; scale?: number }): boolean {
  return !!def.boss || def.height * (def.scale ?? 1) >= 3;
}

/** Where a swing of `range` metres, facing `yaw`, breaks things: a ball ahead at chest height. */
export function coneSmash(pos: { x: number; y: number; z: number }, yaw: number, range: number): { x: number; y: number; z: number; r: number } {
  return { x: pos.x + Math.cos(yaw) * range * 0.6, y: pos.y + 1.2, z: pos.z + Math.sin(yaw) * range * 0.6, r: Math.max(1, range * 0.5) };
}

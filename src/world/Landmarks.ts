import type { Group, Vector3 } from 'three';
import type { Footprint } from './Colliders';

/** Anything placed in the world: a scene object, the colliders it adds to the height field, an optional per-frame hook. */
export interface Landmark {
  object: Group;
  footprints: Footprint[];
  update?(dt: number, player: Vector3): void;
  /** Clip to play when a glTF model replaces the procedural build (walkers want 'walk'). */
  clip?: string;
}

export interface CausewayConfig {
  x: number; zStart: number; zEnd: number; width: number; yStart: number; yEnd: number; postSpacing: number; segmentLength: number;
}

export { glowSprite, glowTexture } from '../render/Glow';

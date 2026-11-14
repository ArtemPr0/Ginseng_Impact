/**
 * What the bosses throw (EnemyDef.throws), in flight and where it lands (the playtest of 2026-11-14: the boulder was a
 * 10 m pale glow, the volleys plain white bolts: "replace that big white circle with fireballs or something", "make them
 * fun like the npcs that throw lean cups"). Each throws a thing of its own place: a flaming boulder trails embers and
 * craters the ground, a witchfire skull trails violet flame, a bottle drips poison and pools, a koi or a lily pad sheds
 * water and splashes. CombatSystem draws the model (a 'prop' shot) and calls these each step and on impact.
 */
import type { ColorRepresentation, Vector3 } from 'three';
import type { ThrowLook, ThrowTrail } from '../data/enemies';
import { MODELS } from '../data/models';

/** The effects a throw uses (CombatFx's own calls). */
export interface FxLike {
  sparks(at: Vector3, dir: Vector3, n: number, color: ColorRepresentation, speed: number, spread?: number): void;
  flash(at: Vector3, color: ColorRepresentation, size: number): void;
  shock(at: Vector3, color: ColorRepresentation, radius: number, seconds?: number): void;
  dust(at: Vector3, size: number): void;
}

/** The scale that makes the thrown model `look.size` metres tall (ModelRig sizes it to its registry height first). */
export function throwScale(look: ThrowLook): number {
  return look.size / MODELS[look.model].height;
}

/** A trail's colours, the first its main one (the halo round the thrown thing takes it too). */
export const TRAIL_COLORS: Record<ThrowTrail, readonly number[]> = {
  fire: [0xff7a1a, 0xffc04a, 0xff3a10],
  witchfire: [0xb36bff, 0x7a3dff, 0x6aff9a],
  water: [0x7fe8ff, 0x3ab8ff],
  poison: [0x6aff3a, 0x2ed15a],
  // (Icy and cyan first: a white halo read as the very circle the playtest complained of.)
  frost: [0x7fc8ff, 0xdff6ff],
  sparkle: [0x6fd8ff, 0xd6a8ff, 0xe9f2ff],
};

/** How the motes leave it: rising for flame, falling for drips and drops, drifting for frost and glints. */
const TRAIL_RISE: Record<ThrowTrail, number> = { fire: 1, witchfire: 1, water: -1, poison: -1, frost: 0.3, sparkle: 0.2 };
/** Seconds between trail beats. */
const BEAT = 0.05;

const _dir = { x: 0, y: 0, z: 0 };

/**
 * One step of a throw's trail: a few motes of its colours every beat, thrown back off its flight (and up for flame,
 * down for drips). `acc` carries the time since the last beat between steps; the new value is returned.
 */
export function throwTrail(fx: FxLike, look: ThrowLook, pos: Vector3, vel: Vector3, dt: number, acc: number): number {
  acc += dt;
  if (acc < BEAT) return acc;
  acc %= BEAT;
  const colors = TRAIL_COLORS[look.trail];
  const l = Math.hypot(vel.x, vel.y, vel.z) || 1;
  _dir.x = -vel.x / l * 0.4;
  _dir.y = TRAIL_RISE[look.trail];
  _dir.z = -vel.z / l * 0.4;
  const n = look.size > 1.2 ? 2 : 1;
  fx.sparks(pos, _dir as unknown as Vector3, n, colors[0], 2.2, 0.8);
  fx.sparks(pos, _dir as unknown as Vector3, 1, colors[1 + Math.floor(Math.random() * (colors.length - 1))], 1.6, 1.0);
  return acc;
}

/** What a burst asks of the fight beyond its effects: how hard the camera shakes, and a puddle left behind. */
export interface BurstResult { shake: number; puddle: 'poison' | null }

/** Where a throw lands: its own burst, sized to the thing thrown. */
export function throwBurst(fx: FxLike, look: ThrowLook, at: Vector3): BurstResult {
  const s = look.size;
  const [main, second] = TRAIL_COLORS[look.trail];
  switch (look.burst) {
    case 'crater':
      // The rock smashes in: a ring of fire, embers everywhere, dust, the ground shakes.
      fx.shock(at, 0xff6a1a, 2.6 * s + 1.5, 0.45);
      fx.shock(at, 0xffc04a, 1.2 * s + 0.5, 0.25);
      fx.sparks(at, UPV, 30, 0xff7a1a, 8, 1.2);
      fx.sparks(at, UPV, 14, 0xffc04a, 5, 1.0);
      fx.flash(at, 0xff8a2a, 1.4 * s + 0.6);
      fx.dust(at, 1.6 * s + 1);
      return { shake: 0.65, puddle: null };
    case 'frost':
      fx.shock(at, 0x9fd8ff, 2.4 * s + 1.5, 0.45);
      fx.sparks(at, UPV, 32, 0xdff6ff, 7, 1.3);
      fx.flash(at, 0x9fd8ff, 1.2 * s + 0.6);
      fx.dust(at, 1.4 * s + 1);
      return { shake: 0.55, puddle: null };
    case 'witchfire':
      fx.shock(at, main, 3.2, 0.35);
      fx.sparks(at, UPV, 22, main, 6, 1.1);
      fx.sparks(at, UPV, 10, 0x6aff9a, 4, 0.9);
      fx.flash(at, main, 2.2);
      return { shake: 0.2, puddle: null };
    case 'splash':
      fx.shock(at, main, 3, 0.4);
      fx.sparks(at, UPV, 28, main, 7, 0.7);
      fx.sparks(at, UPV, 10, 0xffffff, 4, 0.5);
      fx.flash(at, second ?? main, 1.6);
      return { shake: 0.15, puddle: null };
    case 'poison':
      // The bottle breaks: glass glints, a green splash, and the brew pools where it fell.
      fx.sparks(at, UPV, 12, 0xe9f2ff, 5, 1.0);
      fx.sparks(at, UPV, 18, main, 5, 1.1);
      fx.shock(at, main, 2.4, 0.3);
      return { shake: 0.1, puddle: 'poison' };
    case 'shatter':
      fx.sparks(at, UPV, 26, 0xe9f2ff, 7, 1.3);
      fx.sparks(at, UPV, 12, 0xd6a8ff, 5, 1.0);
      fx.flash(at, 0x9fe8ff, 1.5);
      return { shake: 0.2, puddle: null };
  }
}

const UPV = { x: 0, y: 1, z: 0 } as unknown as Vector3;

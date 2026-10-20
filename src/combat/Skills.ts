import type { WeaponKind } from '../characters/roster';
import type { Element } from './Elements';

/** A wave that rides the ground and cuts through everything it passes, once each (Crimson Cleave). */
export interface CrescentShape {
  kind: 'crescent';
  /** Metres it travels, at `speed` m/s. */
  range: number;
  speed: number;
  /** Half its width across the ground (the hit reach either side of its line). */
  halfWidth: number;
  /** The skill's burning ground is laid every `burnEvery` metres along its path. */
  burnEvery: number;
}

/** A fan of arrows that spreads ±`fan` radians, then each turns after a mob (Moon Volley); the mult is per arrow. */
export interface VolleyShape { kind: 'volley'; arrows: number; fan: number; range: number; chains: number; chainRange: number }

/**
 * Stars dropped from `height` metres over the target area (the mark, or `range` ahead), spread within `spread` metres,
 * each bursting over `radius` metres where it lands (Starfall); the mult is per star.
 */
export interface StarfallShape { kind: 'starfall'; stars: number; range: number; height: number; spread: number; radius: number }

export type HitShape =
  | { kind: 'cone'; range: number; halfAngle: number }
  | { kind: 'radius'; radius: number }
  | { kind: 'bolt'; range: number; chains: number; chainRange: number }
  | CrescentShape
  | VolleyShape
  | StarfallShape;

/** 'own' resolves to the caster's element; null is physical. */
export interface AttackDef {
  mult: number;
  element: 'own' | null;
  shape: HitShape;
  knockback: number;
  hitStop: number;
}

export interface GroundEffectDef {
  radius: number;
  duration: number;
  tickMult: number;
  tickEvery: number;
  element: Element;
}

/** Each hero's burst (Q): Sir Aldric's lean cyclone, Wren's psychedelic volley, Orlan's cloud of pipe smoke. */
export type BurstKind = 'cyclone' | 'trip' | 'smoke';
export const BURST: Record<string, { kind: BurstKind; name: string; time: number }> = {
  knight: { kind: 'cyclone', name: 'Lean Cyclone', time: 5.35 },
  archer: { kind: 'trip', name: 'Trip Volley', time: 1.6 },
  wizard: { kind: 'smoke', name: 'Pipe Dream', time: 1.4 },
};
/** The cyclone: the lean is poured over the blade first, then he spins (seconds). */
export const CYCLONE = { pour: 0.75, spin: 4.6 };

/**
 * A skill's numbers. How long the cast takes and when it lands are not here: they are the hero's measured clip cut
 * (skillTiming in heroClips.ts), so the damage falls on the clip's blow.
 */
export interface SkillDef {
  id: string;
  name: string;
  cooldown: number;
  attack: AttackDef;
  ground?: GroundEffectDef;
}

const deg = (d: number) => (d * Math.PI) / 180;
const cone = (range: number, half: number): HitShape => ({ kind: 'cone', range, halfAngle: deg(half) });

/** What each hit of the light combo does; how long it takes and when it lands come from the hero's clips (heroClips.ts). */
export interface ComboDef { hits: AttackDef[] }

export const COMBO: Record<WeaponKind, ComboDef> = {
  sword: {
    hits: [
      { mult: 0.9, element: null, shape: cone(2.8, 70), knockback: 0.6, hitStop: 0.03 },
      { mult: 1.0, element: null, shape: cone(2.8, 70), knockback: 0.6, hitStop: 0.03 },
      { mult: 1.6, element: 'own', shape: cone(3.2, 80), knockback: 1.8, hitStop: 0.07 },
    ],
  },
  greatsword: {
    hits: [
      { mult: 1.2, element: null, shape: cone(3.3, 80), knockback: 1.2, hitStop: 0.05 },
      { mult: 1.3, element: null, shape: cone(3.3, 80), knockback: 1.2, hitStop: 0.05 },
      { mult: 2.1, element: 'own', shape: cone(3.8, 90), knockback: 3, hitStop: 0.1 },
    ],
  },
  bow: {
    hits: [
      { mult: 0.95, element: null, shape: { kind: 'bolt', range: 26, chains: 0, chainRange: 0 }, knockback: 0.5, hitStop: 0.02 },
      { mult: 0.95, element: null, shape: { kind: 'bolt', range: 26, chains: 0, chainRange: 0 }, knockback: 0.5, hitStop: 0.02 },
      { mult: 1.5, element: 'own', shape: { kind: 'bolt', range: 28, chains: 0, chainRange: 0 }, knockback: 1.6, hitStop: 0.05 },
    ],
  },
  staff: {
    hits: [
      { mult: 0.85, element: 'own', shape: { kind: 'bolt', range: 15, chains: 0, chainRange: 0 }, knockback: 0.3, hitStop: 0.02 },
      { mult: 0.85, element: 'own', shape: { kind: 'bolt', range: 15, chains: 0, chainRange: 0 }, knockback: 0.3, hitStop: 0.02 },
      { mult: 1.3, element: 'own', shape: { kind: 'bolt', range: 15, chains: 1, chainRange: 6 }, knockback: 0.8, hitStop: 0.04 },
    ],
  },
};

/**
 * The skills (E), true to their names. Crimson Cleave sends a blood crescent 9 m along the ground that cuts every mob it
 * passes and leaves its burning ground behind it (a patch every 2 m, the ticks of overlapping patches never doubled);
 * Moon Volley looses six arrows in a fan that then home in; Starfall drops four stars from the sky onto the target area.
 */
export const SKILLS: Record<string, SkillDef> = {
  knight: {
    id: 'crimson-cleave', name: 'Crimson Cleave', cooldown: 8,
    attack: { mult: 3.0, element: 'own', shape: { kind: 'crescent', range: 9, speed: 14, halfWidth: 2, burnEvery: 2 }, knockback: 4, hitStop: 0.1 },
    // Each patch along the path is as wide as the crescent; one patch's ticks, however many overlap.
    ground: { radius: 2, duration: 5, tickMult: 0.4, tickEvery: 1, element: 'blood' },
  },
  archer: {
    id: 'moon-volley', name: 'Moon Volley', cooldown: 6,
    attack: { mult: 0.7, element: 'own', shape: { kind: 'volley', arrows: 6, fan: deg(22), range: 30, chains: 1, chainRange: 8 }, knockback: 1.5, hitStop: 0.06 },
  },
  wizard: {
    id: 'starfall', name: 'Starfall', cooldown: 5,
    attack: { mult: 0.8, element: 'own', shape: { kind: 'starfall', stars: 4, range: 16, height: 12, spread: 3, radius: 1.8 }, knockback: 1, hitStop: 0.05 },
  },
};

import { PALETTE } from '../render/palette';

/** Ginseng elements (Genshin reskin): Lunar=Cryo, Blood=Pyro, Astral=Electro, Fog=Anemo, Stone=Geo, Rot=Dendro, Tide=Hydro. */
export type Element = 'lunar' | 'blood' | 'astral' | 'fog' | 'stone' | 'rot' | 'tide';

export const ELEMENT_COLOR: Record<Element, number> = {
  lunar: PALETTE.moon,
  blood: PALETTE.blood,
  astral: PALETTE.dusk,
  fog: PALETTE.fog,
  stone: PALETTE.ultramarine,
  rot: PALETTE.witch,
  tide: PALETTE.rune,
};

export const ELEMENT_NAME: Record<Element, string> = {
  lunar: 'Lunar', blood: 'Blood', astral: 'Astral', fog: 'Fog', stone: 'Stone', rot: 'Rot', tide: 'Tide',
};

export interface Aura { element: Element; gauge: number }

export type ReactionId = 'eclipse' | 'conduit' | 'overload';

export interface Reaction {
  id: ReactionId;
  name: string;
  /** Multiplier on the triggering hit. */
  damageMult: number;
  /** Radius of the splash, 0 for single target. */
  aoeRadius: number;
  knockback: number;
  /** Flat defence reduction applied to the target for `defDownDuration`. */
  defDown: number;
  defDownDuration: number;
  color: number;
}

export const AURA_DURATION = 6;

export const REACTIONS: Record<ReactionId, Reaction> = {
  eclipse: { id: 'eclipse', name: 'Eclipse', damageMult: 2.2, aoeRadius: 2.5, knockback: 2, defDown: 0, defDownDuration: 0, color: PALETTE.blood },
  conduit: { id: 'conduit', name: 'Conduit', damageMult: 1.3, aoeRadius: 0, knockback: 0, defDown: 40, defDownDuration: 8, color: PALETTE.rune },
  overload: { id: 'overload', name: 'Overload', damageMult: 1.6, aoeRadius: 3.5, knockback: 7, defDown: 0, defDownDuration: 0, color: PALETTE.dusk },
};

const PAIRS: Array<[Element, Element, ReactionId]> = [
  ['lunar', 'blood', 'eclipse'],
  ['lunar', 'astral', 'conduit'],
  ['blood', 'astral', 'overload'],
];

export function reactionFor(a: Element, b: Element): ReactionId | null {
  for (const [x, y, id] of PAIRS) if ((a === x && b === y) || (a === y && b === x)) return id;
  return null;
}

/** Applies an incoming element to a target's aura. Pure. */
export function applyElement(aura: Aura | null, incoming: Element | null): { aura: Aura | null; reaction: ReactionId | null } {
  if (incoming === null) return { aura, reaction: null };
  if (!aura) return { aura: { element: incoming, gauge: AURA_DURATION }, reaction: null };
  if (aura.element === incoming) return { aura: { element: incoming, gauge: AURA_DURATION }, reaction: null };
  const reaction = reactionFor(aura.element, incoming);
  if (reaction) return { aura: null, reaction };
  return { aura: { element: incoming, gauge: AURA_DURATION }, reaction: null };
}

export function tickAura(aura: Aura | null, dt: number): Aura | null {
  if (!aura) return null;
  const gauge = aura.gauge - dt;
  return gauge <= 0 ? null : { element: aura.element, gauge };
}

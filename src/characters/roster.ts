import { PALETTE } from '../render/palette';
import type { Element } from '../combat/Elements';

export { ELEMENT_COLOR, type Element } from '../combat/Elements';

export type WeaponKind = 'sword' | 'greatsword' | 'staff' | 'bow';

export interface CharacterDef {
  id: string;
  name: string;
  title: string;
  element: Element;
  weapon: WeaponKind;
  maxHp: number;
  atk: number;
  /** Trail, placeholder and glow colour. */
  accent: number;
}

export const ROSTER: readonly CharacterDef[] = [
  {
    id: 'knight', name: 'Sir Aldric', title: 'The Weary Sentinel', element: 'blood', weapon: 'greatsword',
    maxHp: 1700, atk: 82,
    accent: PALETTE.blood,
  },
  {
    id: 'archer', name: 'Wren', title: 'Hooded Archer of the Fog', element: 'lunar', weapon: 'bow',
    maxHp: 1050, atk: 64,
    accent: PALETTE.moon,
  },
  {
    id: 'wizard', name: 'Orlan', title: 'Wizard of the Blue Mountain', element: 'astral', weapon: 'staff',
    maxHp: 900, atk: 72,
    accent: PALETTE.dusk,
  },
];

/** Non-party NPC look for the coven witches. */
export const WITCH: CharacterDef = {
  id: 'witch', name: 'Witch', title: 'Of the Green Bridge', element: 'rot', weapon: 'staff', maxHp: 1, atk: 1,
  accent: PALETTE.witch,
};

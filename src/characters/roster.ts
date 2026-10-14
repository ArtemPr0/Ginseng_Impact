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
  /** Rig look. */
  look: {
    cloth: number;
    armour: number;
    skin: number;
    accent: number;
    hat?: boolean;
    cape?: boolean;
    antlers?: boolean;
    horns?: boolean;
    beard?: boolean;
    skeleton?: boolean;
    /** Tall pointed wizard hat vs. the witch hat (both use `hat`). */
    hatColor?: number;
    bulk: number; // 0.8 slim … 1.3 heavy
    height: number; // metres
  };
}

export const ROSTER: readonly CharacterDef[] = [
  {
    id: 'knight', name: 'Sir Aldric', title: 'The Weary Sentinel', element: 'blood', weapon: 'greatsword',
    maxHp: 1700, atk: 82,
    look: { cloth: 0x1a1d3c, armour: 0x4a5270, skin: 0x8c93b8, accent: PALETTE.blood, cape: true, bulk: 1.25, height: 1.95 },
  },
  {
    id: 'archer', name: 'Wren', title: 'Hooded Archer of the Fog', element: 'lunar', weapon: 'bow',
    maxHp: 1050, atk: 64,
    look: { cloth: 0x2a3050, armour: 0x5a6388, skin: 0xb9c0e0, accent: PALETTE.moon, bulk: 0.85, height: 1.8 },
  },
  {
    id: 'wizard', name: 'Orlan', title: 'Wizard of the Blue Mountain', element: 'astral', weapon: 'staff',
    maxHp: 900, atk: 72,
    look: { cloth: 0x1c2cc8, armour: 0x2b3fd9, skin: 0xd8c8b8, accent: PALETTE.dusk, hat: true, beard: true, bulk: 0.9, height: 1.85 },
  },
];

/** Non-party NPC look for the coven witches. */
export const WITCH: CharacterDef = {
  id: 'witch', name: 'Witch', title: 'Of the Green Bridge', element: 'rot', weapon: 'staff', maxHp: 1, atk: 1,
  look: { cloth: 0x12163a, armour: 0x1d2350, skin: 0x7fa58c, accent: PALETTE.witch, hat: true, bulk: 0.78, height: 1.85 },
};

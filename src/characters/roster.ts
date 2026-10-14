import { PALETTE } from '../render/palette';
import type { Element } from '../combat/Elements';

export { ELEMENT_COLOR, type Element } from '../combat/Elements';

export type WeaponKind = 'sword' | 'greatsword' | 'staff';

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
    bulk: number; // 0.8 slim … 1.3 heavy
    height: number; // metres
  };
}

export const ROSTER: readonly CharacterDef[] = [
  {
    id: 'vesper', name: 'Vesper', title: 'Blade of the Silver Moon', element: 'lunar', weapon: 'sword',
    maxHp: 1100, atk: 62,
    look: { cloth: PALETTE.cloth, armour: 0x5f6fb8, skin: 0xb9c0e0, accent: PALETTE.moon, cape: true, bulk: 0.85, height: 1.8 },
  },
  {
    id: 'morrow', name: 'Morrow', title: 'Knight of the Lonely Cliff', element: 'blood', weapon: 'greatsword',
    maxHp: 1600, atk: 80,
    look: { cloth: PALETTE.bark, armour: 0x1e2246, skin: 0x8c93b8, accent: PALETTE.blood, bulk: 1.25, height: 1.95 },
  },
  {
    id: 'ashka', name: 'Ashka', title: 'Witch of the Astral Bridge', element: 'astral', weapon: 'staff',
    maxHp: 900, atk: 70,
    look: { cloth: 0x3c1f7a, armour: PALETTE.dusk, skin: 0xa7b0d8, accent: PALETTE.witch, hat: true, bulk: 0.8, height: 1.75 },
  },
];

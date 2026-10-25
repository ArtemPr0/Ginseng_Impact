import type { Element } from '../combat/Elements';

export type ItemKind = 'weapon' | 'consumable' | 'material' | 'charm' | 'key';
export type WeaponClass = 'sword' | 'greatsword' | 'staff' | 'bow';

/** What each hero's weapon hand (roster `WeaponKind`, the same names) accepts: a greatsword hand also takes a sword. */
export const WEAPON_ACCEPTS: Record<WeaponClass, readonly WeaponClass[]> = {
  greatsword: ['greatsword', 'sword'],
  sword: ['sword'],
  bow: ['bow'],
  staff: ['staff'],
};

/** Whether a hero with `weaponKind` can wield an item of `itemClass` (false for an item with no class). */
export function canWield(weaponKind: WeaponClass, itemClass: WeaponClass | undefined): boolean {
  return itemClass !== undefined && WEAPON_ACCEPTS[weaponKind].includes(itemClass);
}

export interface ItemDef {
  id: string;
  name: string;
  kind: ItemKind;
  desc: string;
  /** Base sell value in Moon Shards. */
  value: number;
  rarity: 1 | 2 | 3 | 4;
  weaponClass?: WeaponClass;
  atk?: number;
  /** Overrides the wielder's element for elemental hits. */
  element?: Element;
  /** Multiplier on damage dealt while equipped (charms). */
  dmgMult?: number;
  /** Instant heal (consumables). */
  heal?: number;
  /** Seconds of +50% attack (consumables). */
  frenzy?: number;
  /** Reveals bosses on the minimap (key). */
  reveals?: boolean;
  /** Blade/orb accent colour. */
  color?: number;
}

export const ITEMS: Record<string, ItemDef> = {
  // Consumables
  'moon-dew': { id: 'moon-dew', name: 'Moon Dew', kind: 'consumable', desc: 'Restores 600 HP. Tastes like cold light.', value: 12, rarity: 1, heal: 600 },
  'lotus-tea': { id: 'lotus-tea', name: 'Lotus Tea', kind: 'consumable', desc: 'Restores 350 HP and steadies the hand: +50% attack for 20 s.', value: 10, rarity: 1, heal: 350, frenzy: 20 },
  'rot-salve': { id: 'rot-salve', name: 'Rot Salve', kind: 'consumable', desc: 'Restores 900 HP. Smells like the pot.', value: 12, rarity: 2, heal: 900 },
  // Materials
  'wisp-ember': { id: 'wisp-ember', name: 'Wisp Ember', kind: 'material', desc: 'A cold blue coal that never goes out.', value: 6, rarity: 1 },
  'rune-shard': { id: 'rune-shard', name: 'Rune Shard', kind: 'material', desc: 'A flake of carved stone, still humming.', value: 9, rarity: 1 },
  'sentinel-core': { id: 'sentinel-core', name: 'Sentinel Core', kind: 'material', desc: 'The heart-stone of a golem. Warm.', value: 40, rarity: 2 },
  'beast-fang': { id: 'beast-fang', name: 'Beast Fang', kind: 'material', desc: 'Curved, black, still wet.', value: 14, rarity: 1 },
  'croc-hide': { id: 'croc-hide', name: 'Mire Hide', kind: 'material', desc: 'Armoured hide from the river crocodiles.', value: 16, rarity: 1 },
  'yeti-pelt': { id: 'yeti-pelt', name: 'Yeti Pelt', kind: 'material', desc: 'White fur that stays cold in your hands.', value: 180, rarity: 3 },
  'shade-horn': { id: 'shade-horn', name: 'Shade Horn', kind: 'material', desc: 'It curls the wrong way. Do not look at it long.', value: 200, rarity: 3 },
  'river-pearl': { id: 'river-pearl', name: 'River Pearl', kind: 'material', desc: 'Grown in a drowned throat.', value: 120, rarity: 3 },
  'warden-antler': { id: 'warden-antler', name: 'Warden Antler', kind: 'material', desc: 'A branch of the river giant\'s crown.', value: 260, rarity: 4 },
  'wyrm-scale': { id: 'wyrm-scale', name: 'Wyrm Scale', kind: 'material', desc: 'Moonlight sticks to it.', value: 280, rarity: 4 },
  'troll-hide': { id: 'troll-hide', name: 'Troll Hide', kind: 'material', desc: 'Blue stone that was skin a moment ago.', value: 170, rarity: 3 },
  'lurker-eye': { id: 'lurker-eye', name: 'Lurker Eye', kind: 'material', desc: 'Still looks at you from the bag.', value: 150, rarity: 3 },
  'demon-horn': { id: 'demon-horn', name: 'Sovereign Horn', kind: 'material', desc: 'One of four. It is warm, which is wrong.', value: 240, rarity: 4 },
  'king-rib': { id: 'king-rib', name: 'Hollow Rib', kind: 'material', desc: 'A bone the size of a bridge. Something glows inside it.', value: 300, rarity: 4 },
  // Weapons
  'travelers-blade': { id: 'travelers-blade', name: "Traveler's Blade", kind: 'weapon', weaponClass: 'sword', desc: 'A plain, honest sword. +12 attack.', value: 80, rarity: 1, atk: 12, color: 0xaab3dc },
  'hunters-bow': { id: 'hunters-bow', name: "Hunter's Bow", kind: 'weapon', weaponClass: 'bow', desc: 'Yew and gut string, fog-cured. +14 attack.', value: 90, rarity: 1, atk: 14, color: 0xaab3dc },
  'moonstring-bow': { id: 'moonstring-bow', name: 'Moonstring Bow', kind: 'weapon', weaponClass: 'bow', desc: 'Strung with a hair of the Lurker. +42 attack, Lunar element.', value: 560, rarity: 3, atk: 42, element: 'lunar', color: 0xdfe6ff },
  'witch-staff': { id: 'witch-staff', name: 'Coven Staff', kind: 'weapon', weaponClass: 'staff', desc: 'Stirs more than pots. +18 attack, Rot element.', value: 120, rarity: 2, atk: 18, element: 'rot', color: 0x5dff3a },
  'crown-blade': { id: 'crown-blade', name: 'Antler Crown Blade', kind: 'weapon', weaponClass: 'sword', desc: 'Forged from a king\'s first crown. +34 attack.', value: 400, rarity: 3, atk: 34, color: 0xd8c070 },
  'fang-cleaver': { id: 'fang-cleaver', name: 'Fang Cleaver', kind: 'weapon', weaponClass: 'greatsword', desc: 'The Pass Beast\'s jaw, hafted. +40 attack, Rot element.', value: 480, rarity: 3, atk: 40, element: 'rot', color: 0x5dff3a },
  'glacier-maul': { id: 'glacier-maul', name: 'Glacier Maul', kind: 'weapon', weaponClass: 'greatsword', desc: 'Yeti-bone and river ice. +52 attack, Lunar element.', value: 700, rarity: 4, atk: 52, element: 'lunar', color: 0xdfe6ff },
  'horn-staff': { id: 'horn-staff', name: 'Horned Staff', kind: 'weapon', weaponClass: 'staff', desc: 'The Shade\'s own horn. +48 attack, Astral element.', value: 700, rarity: 4, atk: 48, element: 'astral', color: 0x8b3dff },
  'tide-blade': { id: 'tide-blade', name: 'Tide Blade', kind: 'weapon', weaponClass: 'sword', desc: 'Pulled from the River Shade. +38 attack, Tide element.', value: 520, rarity: 3, atk: 38, element: 'tide', color: 0x37f5ff },
  'warden-bough': { id: 'warden-bough', name: 'Warden Bough', kind: 'weapon', weaponClass: 'staff', desc: 'A living branch that remembers the river. +56 attack, Rot element.', value: 820, rarity: 4, atk: 56, element: 'rot', color: 0x5dff3a },
  'troll-club': { id: 'troll-club', name: 'Gorge Club', kind: 'weapon', weaponClass: 'greatsword', desc: 'A troll\'s arm-bone, still blue. +46 attack, Stone element.', value: 620, rarity: 4, atk: 46, element: 'stone', color: 0x5a6aa8 },
  'tide-hook': { id: 'tide-hook', name: 'Tide Hook', kind: 'weapon', weaponClass: 'sword', desc: 'The Lurker\'s own claw on a haft. +44 attack, Tide element.', value: 600, rarity: 4, atk: 44, element: 'tide', color: 0x37f5ff },
  'horned-glaive': { id: 'horned-glaive', name: 'Sovereign Glaive', kind: 'weapon', weaponClass: 'staff', desc: 'Two horns bound into one blade. +58 attack, Astral element.', value: 860, rarity: 4, atk: 58, element: 'astral', color: 0x8b3dff },
  'wyrm-fang-blade': { id: 'wyrm-fang-blade', name: 'Wyrm Fang', kind: 'weapon', weaponClass: 'sword', desc: 'A fang the length of a sword. +60 attack, Lunar element.', value: 900, rarity: 4, atk: 60, element: 'lunar', color: 0xdfe6ff },
  // Charms and keys
  'hollow-crown': { id: 'hollow-crown', name: 'Hollow Crown', kind: 'charm', desc: 'The King\'s crown. All damage +30% while carried.', value: 1200, rarity: 4, dmgMult: 1.3 },
  'mist-blade': { id: 'mist-blade', name: 'Bittersweet Blade', kind: 'weapon', weaponClass: 'sword', desc: 'Yung Lean\'s blade, for going into the mist. It hums when it is quiet.', value: 300, rarity: 4, atk: 150, element: 'astral' },
  'lost-sound': { id: 'lost-sound', name: 'The Lost Sound', kind: 'key', desc: 'A hum in a glass of mist. The kingdom has been quiet without it.', value: 0, rarity: 4 },
  'old-bone': { id: 'old-bone', name: 'Old Bone', kind: 'material', desc: 'A campfire skeleton\'s thighbone, still warm on one side. Someone will buy it.', value: 14, rarity: 1 },
  'antler-signet': { id: 'antler-signet', name: 'Antlered Signet', kind: 'charm', desc: 'The Antlered King\'s own seal, for the usurper\'s death. All damage +25% while carried.', value: 600, rarity: 4, dmgMult: 1.25 },
  'signed-cup': { id: 'signed-cup', name: 'Signed Cup', kind: 'key', desc: 'A double styrofoam cup with Yung Lean\'s signature in purple marker. Goldgrin\'s brother wants it.', value: 0, rarity: 3 },
  'lunar-charm': { id: 'lunar-charm', name: 'Lunar Charm', kind: 'charm', desc: 'All damage +15% while carried.', value: 90, rarity: 2, dmgMult: 1.15 },
  'third-eye': { id: 'third-eye', name: 'Third Eye of the Frog God', kind: 'charm', desc: 'It still blinks when nobody is looking. +25% damage while carried in the charm slot.', value: 900, rarity: 4, dmgMult: 1.25, color: 0xff5ad6 },
  'star-chart': { id: 'star-chart', name: 'Star Chart', kind: 'key', desc: 'Pim\'s drawing of where the great ones sleep. Marks bosses on the minimap.', value: 100, rarity: 2, reveals: true },
  // The story's keys (data/quests.ts): two of the five voices, and the book the dragon's reader wants.
  'drowned-bell': { id: 'drowned-bell', name: 'The Drowned Bell', kind: 'key', desc: 'The sunken city\'s voice, out of the anglers\' lane. It rings under water; up here it hums.', value: 0, rarity: 4 },
  'grave-crown': { id: 'grave-crown', name: 'The Grave Crown', kind: 'key', desc: 'The Skeleton King\'s first crown, off the Grave Cyclops. He let you keep it: two on one skull looks desperate.', value: 0, rarity: 4 },
  'old-ledger': { id: 'old-ledger', name: 'An Old Ledger', kind: 'key', desc: 'A century of the Vale\'s debts, Rattlebones on page forty. A book for a dragon to sleep on.', value: 0, rarity: 2 },
};

export const RARITY_COLOR: Record<1 | 2 | 3 | 4, number> = { 1: 0xdfe6ff, 2: 0x4f7cff, 3: 0x8b3dff, 4: 0xff2a2a };
export const RARITY_NAME: Record<1 | 2 | 3 | 4, string> = { 1: 'Common', 2: 'Fine', 3: 'Rare', 4: 'Mythic' };

/**
 * The item `itemId` names, or undefined. Only ITEMS' own keys count: ITEMS['constructor'], ITEMS['__proto__'] and
 * ITEMS['toString'] are truthy too (every object inherits them), and a hand-edited save naming one would otherwise
 * carry a phantom item with no kind.
 */
export function itemDef(itemId: string): ItemDef | undefined {
  return Object.hasOwn(ITEMS, itemId) ? ITEMS[itemId] : undefined;
}

// ----- Affixes: the bonus lines a dropped weapon rolls by its rarity ("Fang Cleaver of the Moon") -----

export interface Affix {
  atk?: number;
  hp?: number;
  /** Extra crit chance, 0..1. */
  crit?: number;
  /** Mythic lines carry an element (the name's token). */
  element?: Element;
  /** "of the Moon" and the like. */
  name: string;
}

/** The token each element lends an affix name: "of the Moon", "of the Blood", ... */
export const AFFIX_TOKENS: Record<Element, string> = { lunar: 'Moon', blood: 'Blood', fog: 'Fog', tide: 'Tide', rot: 'Rot', stone: 'Stone', astral: 'Astral' };
const AFFIX_ELEMENTS = Object.keys(AFFIX_TOKENS) as Element[];
/** How far the attack line grows with rarity. */
const AFFIX_SCALE: Record<number, number> = { 2: 1, 3: 1.5, 4: 2 };

/**
 * Rolls the bonus lines for an item of `rarity` from `rnd` (0..1; seedable, so a given sequence always rolls the same
 * affix): common none; fine one line; rare two; mythic two and an element. Lines are attack +4..+12 (scaled by rarity),
 * HP +40..+160 and crit +3%..+8%, never the same line twice. Null for a common item.
 */
export function rollAffix(rarity: number, rnd: () => number): Affix | null {
  if (rarity < 2) return null;
  const pick = (n: number) => Math.min(n - 1, Math.max(0, Math.floor(rnd() * n)));
  const range = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const element = AFFIX_ELEMENTS[pick(AFFIX_ELEMENTS.length)];
  const affix: Affix = { name: `of the ${AFFIX_TOKENS[element]}` };
  if (rarity >= 4) affix.element = element;
  const scale = AFFIX_SCALE[Math.min(4, rarity)];
  const kinds: Array<'atk' | 'hp' | 'crit'> = ['atk', 'hp', 'crit'];
  const lines = rarity >= 3 ? 2 : 1;
  for (let i = 0; i < lines; i++) {
    const kind = kinds.splice(pick(kinds.length), 1)[0];
    if (kind === 'atk') affix.atk = Math.round(range(4, 12) * scale);
    else if (kind === 'hp') affix.hp = Math.round(range(40, 160) / 10) * 10;
    else affix.crit = Math.round(range(0.03, 0.08) * 1000) / 1000;
  }
  return affix;
}

/** The item's name with its affix: "Fang Cleaver of the Moon". */
export function entryName(itemId: string, affix?: Affix | null): string {
  const name = itemDef(itemId)?.name ?? itemId;
  return affix ? `${name} ${affix.name}` : name;
}

/**
 * What every item looks like on the ground (the playtest of 2026-11-14: loot "must look unique, not just some white
 * cube or circle… fix this issue all around the game"). An item is a small copy of a reel model it is, recoloured (a
 * potion bottle, the crown, a spell book; a weapon as the hero's own sword, bow or staff), or, until its own model is
 * made (the Meshy round after the renewal), its own drawn icon in its own colour (render/LootIcons). (The eyes and the
 * sentinel's core were small dark spheres on the ground, the very circle the playtest named: drawn and faceted now.)
 */

export const ICON_KEYS = ['fang', 'hide', 'horn', 'pearl', 'antler', 'bell', 'rib', 'ring', 'moon', 'note', 'eye', 'flame', 'scroll', 'book'] as const;
export type IconKey = (typeof ICON_KEYS)[number];

/**
 * A model id (MODELS), its longest side on the ground (m), its tint (none keeps the model's own colours, and then
 * `glow` names the colour of the light round it), and `shine`, a flat glow of that colour all over (a dark texture lit
 * through its own map stayed dark: steel, a crystal); or an icon and its colour.
 */
export type ItemLook = { model: string; size: number; tint?: number; glow?: number; shine?: number } | { icon: IconKey; tint: number }
  /** Made from the break materials, as the rubble it came off (render/HarvestLooks). */
  | { make: 'log' | 'stone' | 'plank'; tint?: undefined; glow: number };

/** One string per look: no two items may share it. */
export function lookKey(look: ItemLook): string {
  return 'model' in look ? `${look.model}:${look.tint ?? 'own'}` : 'make' in look ? `make:${look.make}` : `icon:${look.icon}:${look.tint}`;
}

/** The colour of the light round an item on the ground: its tint, or the glow named for an untinted model. */
export function itemGlow(id: string): number {
  const look = ITEM_LOOKS[id];
  return ('glow' in look ? look.glow : undefined) ?? look.tint ?? 0xffc04a;
}

export const ITEM_LOOKS: Record<string, ItemLook> = {
  // Brews and teas.
  'moon-dew': { model: 'potion-bottle', size: 0.5, tint: 0x9fd8ff },
  'rot-salve': { model: 'potion-bottle', size: 0.5, tint: 0x6aff3a },
  'lotus-tea': { model: 'chalice', size: 0.45, tint: 0xffb0d8 },
  // Materials.
  wood: { make: 'log', glow: 0xd8a060 },
  plank: { make: 'plank', glow: 0xe0b070 },
  stone: { make: 'stone', glow: 0x9ab0e0 },
  'wisp-ember': { icon: 'flame', tint: 0x6ad8ff },
  'rune-shard': { model: 'purple-crystal', size: 0.55, tint: 0x7fd8ff, shine: 0.5 },
  'sentinel-core': { model: 'gem', size: 0.5, tint: 0x5a8aff },
  'wyrm-scale': { model: 'gem', size: 0.45, tint: 0x6aff9a },
  'lurker-eye': { icon: 'eye', tint: 0xff4a4a },
  'old-bone': { model: 'giant-skull', size: 0.45, glow: 0x9affb0 },
  'beast-fang': { icon: 'fang', tint: 0xf2dcb0 },
  'croc-hide': { icon: 'hide', tint: 0x7aa04a },
  'yeti-pelt': { icon: 'hide', tint: 0xb8dcff },
  'troll-hide': { icon: 'hide', tint: 0xa08a5a },
  'shade-horn': { icon: 'horn', tint: 0x9a7aff },
  'demon-horn': { icon: 'horn', tint: 0xff5a3a },
  'warden-antler': { icon: 'antler', tint: 0xb8e08a },
  'river-pearl': { icon: 'pearl', tint: 0xf0c8ff },
  'church-bell': { icon: 'bell', tint: 0xd8a84a },
  'king-rib': { icon: 'rib', tint: 0xc8b8ff },
  // Weapons: the heroes' own sword, bow and staff, each its own colour.
  'travelers-blade': { model: 'greatsword', size: 1.0, glow: 0x9fd8ff },
  'crown-blade': { model: 'greatsword', size: 1.0, tint: 0xffd27a },
  'fang-cleaver': { model: 'greatsword', size: 1.05, tint: 0xffa07a },
  'tide-blade': { model: 'greatsword', size: 1.0, tint: 0x6ad8ff },
  'mist-blade': { model: 'greatsword', size: 1.0, tint: 0xc8a8ff },
  'wyrm-fang-blade': { model: 'greatsword', size: 1.05, tint: 0x8aff9a },
  'hunters-bow': { model: 'bow', size: 0.9, glow: 0xffc04a },
  'moonstring-bow': { model: 'bow', size: 0.9, tint: 0x9fd8ff },
  'witch-staff': { model: 'staff', size: 1.1, tint: 0xb36bff },
  'horn-staff': { model: 'staff', size: 1.15, tint: 0xff9a5a },
  'warden-bough': { model: 'staff', size: 1.1, tint: 0x8adf6a },
  'horned-glaive': { model: 'staff', size: 1.2, tint: 0xff5a7a },
  'glacier-maul': { model: 'staff', size: 1.1, tint: 0x9fe0ff },
  'troll-club': { model: 'staff', size: 1.0, tint: 0xc09a60 },
  'tide-hook': { model: 'staff', size: 1.1, tint: 0x3ab8ff },
  // Charms and keys.
  'hollow-crown': { model: 'giant-crown', size: 0.45, tint: 0xb8a8ff },
  'grave-crown': { model: 'giant-crown', size: 0.5, tint: 0x9affb0 },
  'third-eye': { icon: 'eye', tint: 0x7affc0 },
  'signed-cup': { model: 'lean-cup', size: 0.45, glow: 0xb36bff },
  'star-chart': { icon: 'scroll', tint: 0x6a8aff },
  'old-ledger': { icon: 'book', tint: 0xd8a86a },
  'antler-signet': { icon: 'ring', tint: 0xffc04a },
  'lunar-charm': { icon: 'moon', tint: 0x9fd8ff },
  'lost-sound': { icon: 'note', tint: 0xd6a8ff },
  'drowned-bell': { icon: 'bell', tint: 0x6ad8ff },
};

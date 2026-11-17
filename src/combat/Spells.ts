/**
 * The spell bars (the user's calls of 2026-11-15: a bar for every hero; since 2026-11-16 they sit on slots 3-7 of the
 * 1-7 bar, SpellBar.ts). Pure data and cooldowns; SpellCast.ts makes them happen, the HUD draws the
 * bar from the icons here (24 x 24 SVG, stroked in the spell's colour).
 */
import { Cooldown } from './Combat';

export type SpellId =
  | 'earthsplitter' | 'wrecking-charge' | 'chain-hook' | 'blood-moon'
  | 'moonbomb' | 'frost-arrow' | 'storm-arrow' | 'gale-shot'
  | 'fireball' | 'black-hole' | 'fire-tornado' | 'overgrowth'
  | 'stone-wall' | 'storm-tornado' | 'telekinesis'
  // Page 2 (Shift+1-7, playtest 2026-11-17: the Flowbound reels' moves).
  | 'stone-ring' | 'spike-row' | 'boulder' | 'pillars' | 'earth-wall' | 'dust-kick' | 'rock-armor'
  | 'fire-jets' | 'fire-wave' | 'fire-ring' | 'fire-column' | 'fire-dash' | 'flame-body' | 'fire-fist'
  | 'ice-ramp' | 'water-shield' | 'ice-shards' | 'water-whip' | 'wave-surf' | 'ice-wall' | 'ice-discs';

export interface SpellDef {
  id: SpellId;
  name: string;
  /** Seconds between casts. */
  cooldown: number;
  color: number;
  /** Damage as a multiple of the hero's attack, per hit. */
  mult: number;
  /** Metres of its blast, pull or cone. */
  radius: number;
  /** Aimed at the crosshair's ground point (a rune circle shows there as it is cast). */
  aimed: boolean;
  /** The icon's SVG shapes, drawn in a 24 x 24 box. */
  icon: string;
}

export const SPELLS: Record<string, SpellDef[]> = {
  knight: [
    { id: 'earthsplitter', name: 'Earthsplitter', cooldown: 9, color: 0xff3a4a, mult: 3.2, radius: 4.5, aimed: true,
      icon: '<path d="M4 20 L9 13 L11 16 L14 9 L16 13 L20 4"/><path d="M2 21 H22"/><path d="M12 21 L10 17 M12 21 L15 17"/>' },
    { id: 'wrecking-charge', name: 'Wrecking Charge', cooldown: 8, color: 0xff6a3a, mult: 2.4, radius: 2.4, aimed: false,
      icon: '<path d="M3 12 H15"/><path d="M11 6 L17 12 L11 18"/><path d="M19 5 V19"/><path d="M21 8 L19 10 M21 16 L19 14"/>' },
    { id: 'chain-hook', name: 'Chain Hook', cooldown: 7, color: 0xc8c8d8, mult: 1.6, radius: 1.8, aimed: true,
      icon: '<circle cx="5" cy="19" r="2"/><circle cx="9" cy="15" r="2"/><circle cx="13" cy="11" r="2"/><path d="M15 9 L19 5 Q22 6 20 9 L18 8"/>' },
    { id: 'blood-moon', name: 'Blood Moon', cooldown: 30, color: 0xd0102a, mult: 0, radius: 0, aimed: false,
      icon: '<circle cx="12" cy="12" r="7"/><path d="M15 6 A7 7 0 0 1 15 18 A5 6 0 0 0 15 6 Z"/><path d="M12 21 Q11 23 12 23 Q13 23 12 21"/>' },
    // (2026-11-16, Flowbound: a wall of stone blocks pulled up out of the ground, then kicked apart at the enemy.)
    { id: 'stone-wall', name: 'Stone Wall', cooldown: 7, color: 0xc9a27a, mult: 2.2, radius: 2.2, aimed: true,
      icon: '<path d="M3 21 H21"/><rect x="4" y="15" width="7" height="5"/><rect x="11" y="15" width="8" height="5"/><rect x="6" y="10" width="7" height="5"/><rect x="13" y="10" width="5" height="5"/><path d="M8 6 L10 3 M13 6 L14 2 M17 7 L19 4"/>' },
  ],
  archer: [
    { id: 'moonbomb', name: 'Moonbomb Arrow', cooldown: 9, color: 0x9fd8ff, mult: 3.4, radius: 5, aimed: true,
      icon: '<path d="M3 21 L13 11"/><path d="M3 21 L3 17 M3 21 L7 21"/><circle cx="16" cy="8" r="4"/><path d="M16 2 V3 M22 8 H21 M20 4 L19.5 4.5"/>' },
    { id: 'frost-arrow', name: 'Frost Arrow', cooldown: 10, color: 0x7fe8ff, mult: 1.8, radius: 4, aimed: true,
      icon: '<path d="M12 2 V22 M3.5 7 L20.5 17 M3.5 17 L20.5 7"/><path d="M10 4 L12 6 L14 4 M10 20 L12 18 L14 20"/>' },
    { id: 'storm-arrow', name: 'Storm Arrow', cooldown: 8, color: 0xb6a0ff, mult: 2.6, radius: 2.5, aimed: true,
      icon: '<path d="M13 2 L6 13 H11 L9 22 L18 9 H13 Z"/>' },
    { id: 'gale-shot', name: 'Gale Shot', cooldown: 7, color: 0xd8f4ff, mult: 1.4, radius: 9, aimed: false,
      icon: '<path d="M3 8 H15 Q19 8 19 5 Q19 2 16 3"/><path d="M3 13 H19 Q22 13 22 16 Q22 19 19 18"/><path d="M3 18 H10"/>' },
    // (2026-11-16, the reel's grey tornado under a storm cloud, full of blocks.)
    { id: 'storm-tornado', name: 'Storm Tornado', cooldown: 14, color: 0x9aa6bf, mult: 0.7, radius: 3.5, aimed: true,
      icon: '<path d="M2 4 Q12 1 22 4 Q12 7 2 4 Z"/><path d="M5 9 H18"/><path d="M8 13 H16"/><path d="M10 17 H14"/><path d="M12 21 V19"/><rect x="18" y="12" width="2" height="2"/><rect x="5" y="15" width="2" height="2"/>' },
  ],
  wizard: [
    { id: 'fireball', name: 'Fireball', cooldown: 6, color: 0xff7a1a, mult: 3.0, radius: 4.5, aimed: true,
      icon: '<path d="M12 22 Q5 21 5 14 Q5 9 9 6 Q9 10 11 11 Q11 5 15 2 Q15 8 18 10 Q20 13 19 16 Q18 21 12 22 Z"/><circle cx="12" cy="16" r="2.5"/>' },
    { id: 'black-hole', name: 'Black Hole', cooldown: 14, color: 0x8a3dff, mult: 0.5, radius: 9, aimed: true,
      icon: '<circle cx="12" cy="12" r="3"/><path d="M12 4 A8 8 0 0 1 20 12"/><path d="M12 20 A8 8 0 0 1 4 12"/><path d="M6 6 A9 9 0 0 1 18 5"/><path d="M18 18 A9 9 0 0 1 6 19"/>' },
    { id: 'fire-tornado', name: 'Fire Tornado', cooldown: 12, color: 0xff5a10, mult: 0.8, radius: 3, aimed: false,
      icon: '<path d="M3 4 H21"/><path d="M5 8 H18"/><path d="M8 12 H16"/><path d="M9 16 H14"/><path d="M11 20 H13"/>' },
    { id: 'overgrowth', name: 'Overgrowth', cooldown: 16, color: 0x6dff9a, mult: 0.6, radius: 6, aimed: true,
      icon: '<path d="M12 22 V10"/><path d="M12 14 Q6 14 5 8 Q11 8 12 14"/><path d="M12 11 Q18 11 19 5 Q13 5 12 11"/><path d="M6 22 Q9 18 12 22 Q15 18 18 22"/>' },
    // (2026-11-16: hold right click to lift a mob, rubble or a small building; let go to hurl it. CarrySystem.)
    { id: 'telekinesis', name: 'Telekinesis', cooldown: 1.5, color: 0xb070ff, mult: 0, radius: 0, aimed: true,
      icon: '<path d="M4 20 Q8 14 12 15"/><path d="M4 20 L6 16 M4 20 L8 19"/><rect x="13" y="5" width="7" height="6" transform="rotate(12 16 8)"/><path d="M11 13 Q14 12 15 12 M10 10 Q12 9 13 9"/>' },
  ],
};

const EARTH = 0xc8925a, FIRE = 0xff6a1a, WATER = 0x3fc8ff, ICE = 0xbfefff;
const sp = (id: SpellId, name: string, cooldown: number, color: number, mult: number, radius: number, aimed: boolean, icon: string): SpellDef =>
  ({ id, name, cooldown, color, mult, radius, aimed, icon });

/**
 * The second page (Shift+1-7; playtest 2026-11-17: "copy all abilities from the 2 videos"), seven per hero after the
 * Flowbound reels: Sir Aldric bends earth, Orlan fire, Wren water and ice (ReelMoves.ts makes them happen).
 */
const SECOND: Record<string, SpellDef[]> = {
  knight: [
    sp('stone-ring', 'Stone Ring', 10, EARTH, 1.6, 4.5, false, '<path d="M4 18 L6 11 L8 18 M10 18 L12 8 L14 18 M16 18 L18 11 L20 18"/><path d="M2 20 H22"/>'),
    sp('spike-row', 'Spike Row', 6, EARTH, 1.4, 1.5, true, '<path d="M2 20 L5 14 L7 20 L10 12 L12 20 L15 10 L17 20 L20 8 L22 20"/>'),
    sp('boulder', 'Boulder', 8, EARTH, 2.4, 3, true, '<circle cx="14" cy="9" r="5"/><path d="M3 21 Q6 12 10 11"/><path d="M2 21 H22"/>'),
    sp('pillars', 'Pillars', 9, EARTH, 1.8, 1.4, true, '<rect x="4" y="8" width="4" height="12"/><rect x="10" y="5" width="4" height="15"/><rect x="16" y="9" width="4" height="11"/>'),
    sp('earth-wall', 'Earth Wall', 12, EARTH, 0, 0, false, '<path d="M3 21 L4 6 L8 4 L12 6 L16 3 L20 6 L21 21 Z"/><path d="M8 12 L11 14 M14 10 L16 13"/>'),
    sp('dust-kick', 'Dust Kick', 5, 0xd8c09a, 1.2, 5, false, '<path d="M4 20 L9 12 L13 14"/><circle cx="17" cy="9" r="2"/><circle cx="20" cy="14" r="1.5"/><circle cx="15" cy="15" r="1.5"/>'),
    sp('rock-armor', 'Rock Armor', 18, 0x9a8f86, 0, 0, false, '<path d="M12 2 L20 6 V12 Q20 18 12 22 Q4 18 4 12 V6 Z"/><path d="M8 9 L12 12 L16 9 M12 12 V18"/>'),
  ],
  wizard: [
    sp('fire-jets', 'Fire Jets', 10, FIRE, 0.6, 2.5, false, '<path d="M12 2 V10"/><path d="M8 12 Q9 18 7 22 M16 12 Q15 18 17 22 M12 13 Q13 18 12 22"/>'),
    sp('fire-wave', 'Fire Wave', 8, FIRE, 1.4, 12, false, '<path d="M2 18 Q6 8 10 18 Q14 8 18 18 Q20 12 22 14"/><path d="M2 21 H22"/>'),
    sp('fire-ring', 'Fire Ring', 9, FIRE, 1.6, 4.5, true, '<circle cx="12" cy="12" r="8"/><path d="M12 4 Q14 1 12 0 M20 12 Q23 14 24 12 M12 20 Q10 23 12 24 M4 12 Q1 10 0 12"/>'),
    sp('fire-column', 'Fire Column', 10, 0xff8a2a, 2.8, 2.8, true, '<path d="M9 22 Q7 14 10 8 Q11 4 12 1 Q13 4 14 8 Q17 14 15 22 Z"/>'),
    sp('fire-dash', 'Fire Dash', 6, FIRE, 1.2, 1.6, false, '<path d="M2 12 H14"/><path d="M4 8 H12 M4 16 H12"/><path d="M15 6 L21 12 L15 18"/>'),
    sp('flame-body', 'Flame Body', 16, 0xff4a10, 0.3, 2.4, false, '<circle cx="12" cy="6" r="2.5"/><path d="M12 9 V16 M8 22 L12 16 L16 22 M7 12 H17"/><path d="M5 4 Q4 8 6 10 M19 4 Q20 8 18 10"/>'),
    sp('fire-fist', 'Fire Fist', 5, 0xff7a20, 2, 2, true, '<rect x="8" y="8" width="8" height="8" rx="2"/><path d="M2 10 H6 M2 14 H6 M3 12 H7"/><path d="M16 10 H18 V14 H16"/>'),
  ],
  archer: [
    sp('ice-ramp', 'Ice Ramp', 10, ICE, 0, 0, false, '<path d="M2 21 L22 7 L22 21 Z"/><path d="M8 17 L10 21 M14 13 L16 21"/>'),
    sp('water-shield', 'Water Shield', 12, WATER, 0, 0, false, '<path d="M5 21 Q2 12 5 3"/><path d="M9 21 Q6 12 9 3"/><path d="M13 21 Q10 12 13 3"/>'),
    sp('ice-shards', 'Ice Shards', 7, ICE, 1.6, 3.5, true, '<path d="M12 12 L12 2 M12 12 L21 7 M12 12 L20 18 M12 12 L4 18 M12 12 L3 7 M12 12 L12 22"/>'),
    sp('water-whip', 'Water Whip', 6, WATER, 1.6, 2, true, '<path d="M3 20 Q8 6 13 14 Q17 20 21 4"/>'),
    sp('wave-surf', 'Wave Surf', 8, WATER, 1.2, 1.8, false, '<path d="M2 18 Q8 6 14 14 Q18 18 22 12"/><path d="M2 21 H22"/><path d="M10 8 L13 6 L12 10"/>'),
    sp('ice-wall', 'Ice Wall', 12, ICE, 0, 0, true, '<path d="M3 21 L5 8 L8 13 L11 4 L14 12 L17 6 L21 21 Z"/>'),
    sp('ice-discs', 'Ice Discs', 6, ICE, 1.1, 1, true, '<ellipse cx="6" cy="12" rx="3" ry="1.5"/><ellipse cx="13" cy="8" rx="3" ry="1.5"/><ellipse cx="13" cy="16" rx="3" ry="1.5"/><path d="M17 12 H22"/>'),
  ],
};
for (const hero of Object.keys(SECOND)) SPELLS[hero].push(...SECOND[hero]);

/** The second page's spells by hero, in bar order (Shift+1-7). */
export const PAGE2: Record<string, SpellId[]> = Object.fromEntries(Object.entries(SECOND).map(([h, list]) => [h, list.map((s) => s.id)]));

/** Every hero's spell cooldowns; they run on while the hero is benched. */
export class SpellBook {
  private readonly cds = new Map<string, Cooldown[]>();

  private of(hero: string): Cooldown[] {
    let c = this.cds.get(hero);
    if (!c) { c = (SPELLS[hero] ?? []).map((s) => new Cooldown(s.cooldown)); this.cds.set(hero, c); }
    return c;
  }

  ready(hero: string, slot: number): boolean { return this.of(hero)[slot]?.ready ?? false; }
  use(hero: string, slot: number): void { this.of(hero)[slot]?.use(); }
  /** 1 = just cast, 0 = ready. */
  fraction(hero: string, slot: number): number { return this.of(hero)[slot]?.fraction ?? 0; }
  update(dt: number): void {
    for (const hero of Object.keys(SPELLS)) for (const c of this.of(hero)) c.update(dt);
  }
}

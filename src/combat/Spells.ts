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
  | 'stone-wall' | 'storm-tornado' | 'telekinesis';

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

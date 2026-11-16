/**
 * The spell bar (the user's calls of 2026-11-16, after the godofprompt wizard reel): keys 1-7 pick a slot, right click
 * casts it at the crosshair at once, left click stays the weapon (tap = combo, hold = charged heavy), F1-F3 switch hero.
 * Every hero's seven: slot 1 is the old E skill, slot 2 the old Q burst (still filled by fighting), slots 3-7 the
 * spell book (Spells.ts). Telekinesis is the one slot that is held (hold right click to lift, let go to hurl).
 */
import { SKILLS, BURST } from './Skills';
import { SPELLS } from './Spells';

export type BarAction = { kind: 'skill' } | { kind: 'burst' } | { kind: 'spell'; slot: number };

export interface BarSlot {
  name: string;
  color: number;
  /** 24 x 24 SVG shapes, stroked in the colour. */
  icon: string;
  action: BarAction;
  /** Held on right click (telekinesis), not cast on the press. */
  hold?: boolean;
}

export const BAR_SIZE = 7;

const SKILL_LOOK: Record<string, { color: number; icon: string }> = {
  knight: { color: 0xff2a3a, icon: '<path d="M4 18 Q12 4 21 8"/><path d="M6 20 Q13 8 21 12"/><path d="M3 21 L7 17"/>' },
  archer: { color: 0xbfe4ff, icon: '<path d="M3 21 L18 6"/><path d="M6 21 L20 10"/><path d="M3 18 L16 4"/><path d="M15 3 L18 6 L21 3"/>' },
  wizard: { color: 0xffd36a, icon: '<path d="M12 2 L13.5 7 L19 7 L14.5 10 L16 15 L12 12 L8 15 L9.5 10 L5 7 L10.5 7 Z"/><path d="M5 22 L8 17 M12 22 V18 M19 22 L16 17"/>' },
};
const BURST_LOOK: Record<string, { color: number; icon: string }> = {
  knight: { color: 0xa04dff, icon: '<path d="M12 12 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0"/><path d="M12 6 A6 6 0 0 1 18 12"/><path d="M12 18 A6 6 0 0 1 6 12"/><circle cx="12" cy="12" r="2"/>' },
  archer: { color: 0xff6ad5, icon: '<path d="M3 20 Q12 2 21 20"/><path d="M6 20 Q12 8 18 20"/><path d="M9 20 Q12 14 15 20"/>' },
  wizard: { color: 0x9a8cff, icon: '<path d="M4 16 Q2 12 6 11 Q6 6 11 7 Q14 3 18 7 Q22 8 20 12 Q22 16 17 16 Z"/><path d="M8 20 H16"/>' },
};

function bar(hero: string): BarSlot[] {
  const spells = SPELLS[hero] ?? [];
  return [
    { name: SKILLS[hero].name, ...SKILL_LOOK[hero], action: { kind: 'skill' } },
    { name: BURST[hero].name, ...BURST_LOOK[hero], action: { kind: 'burst' } },
    ...spells.map((s, i): BarSlot => ({ name: s.name, color: s.color, icon: s.icon, action: { kind: 'spell', slot: i }, ...(s.id === 'telekinesis' ? { hold: true } : {}) })),
  ];
}

export const BAR: Record<string, BarSlot[]> = { knight: bar('knight'), archer: bar('archer'), wizard: bar('wizard') };

/** The slot a number key picks (Digit1-7 → 0-6), or null. */
export function barKey(code: string): number | null {
  const m = /^Digit([1-7])$/.exec(code);
  return m ? Number(m[1]) - 1 : null;
}

/** The hero F1-F3 switch to (0-2), or null. */
export function heroKey(code: string): number | null {
  const m = /^F([1-3])$/.exec(code);
  return m ? Number(m[1]) - 1 : null;
}

/** Which slot each hero has picked (it stays picked when you switch away and back). */
export class SpellBar {
  private readonly picked = new Map<string, number>();

  selected(hero: string): number { return this.picked.get(hero) ?? 2; }
  select(hero: string, slot: number): void {
    if (slot >= 0 && slot < (BAR[hero]?.length ?? 0)) this.picked.set(hero, slot);
  }
  current(hero: string): BarSlot { return BAR[hero][this.selected(hero)]; }
}

/** Seconds left click must be held before it becomes a charged heavy. */
export const HEAVY_HOLD = 0.3;

/**
 * Left click: the press swings the combo at once (no waiting to see if it is a hold); kept down past HEAVY_HOLD it
 * charges the heavy, and letting go swings it.
 */
export class LmbGesture {
  private held = 0;
  private was = false;
  private charging = false;

  update(dt: number, down: boolean): { attack: boolean; heavyHeld: boolean; heavyRelease: boolean } {
    const attack = down && !this.was;
    if (down) this.held = attack ? 0 : this.held + dt;
    const heavyRelease = !down && this.was && this.charging;
    this.charging = down && this.held >= HEAVY_HOLD;
    if (!down) this.held = 0;
    this.was = down;
    return { attack, heavyHeld: this.charging, heavyRelease };
  }
}

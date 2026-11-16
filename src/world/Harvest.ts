/**
 * What breaking something gives (the user's request of 2026-11-16: "when the sword guy hits buildings or trees, he can
 * break them and loot them for wood/stone"): a tree gives wood, a wooden building planks, stone and plaster give
 * stone; glass, crystal, metal and bone give nothing (yet). A few at a time, more for more pieces knocked off.
 */
import type { BreakKind } from '../render/BreakMaterial';

export function harvestOf(material: BreakKind | undefined, tree: boolean, size: number, pieces: number, brief = false): { itemId: 'wood' | 'plank' | 'stone'; count: number } | null {
  if (!material || brief || size < 0.5) return null;
  const itemId = material === 'wood' ? (tree ? 'wood' : 'plank') : material === 'stone' || material === 'plaster' || material === 'earth' ? 'stone' : null;
  if (!itemId) return null;
  return { itemId, count: Math.min(4, 1 + Math.floor(pieces / 3)) };
}

/** Piles one thing gives until it is rebuilt. */
export const HARVEST_MAX = 4;

/** Keeps the harvest to a pile per blow (a collapse breaks off pieces for seconds) and HARVEST_MAX per thing. */
export class HarvestLedger {
  private readonly of = new WeakMap<object, { n: number; at: number }>();
  take(thing: object, now: number): boolean {
    const e = this.of.get(thing) ?? { n: 0, at: -Infinity };
    if (e.n >= HARVEST_MAX || now - e.at < 0.6) return false;
    e.n++; e.at = now;
    this.of.set(thing, e);
    return true;
  }
  reset(thing: object): void { this.of.delete(thing); }
}

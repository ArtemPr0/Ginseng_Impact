import { describe, expect, it } from 'vitest';
import { harvestOf } from './Harvest';

// The user's request of 2026-11-16: "when the sword guy hits buildings or trees, he can break them and loot them for
// wood/stone".
describe('harvestOf', () => {
  it('a tree gives wood, a wooden building planks, stone and plaster give stone', () => {
    expect(harvestOf('wood', true, 4, 3)).toMatchObject({ itemId: 'wood' });
    expect(harvestOf('wood', false, 20, 3)).toMatchObject({ itemId: 'plank' });
    expect(harvestOf('stone', false, 20, 3)).toMatchObject({ itemId: 'stone' });
    expect(harvestOf('plaster', false, 20, 3)).toMatchObject({ itemId: 'stone' });
  });
  it('glass, crystal, metal, bone and plants give nothing', () => {
    for (const m of ['glass', 'crystal', 'metal', 'bone'] as const) expect(harvestOf(m, false, 5, 3)).toBe(null);
    expect(harvestOf(undefined, false, 0.3, 1)).toBe(null);
    // Flowers, mushrooms and leaves (brief things) give nothing.
    expect(harvestOf('wood', false, 3, 3, true)).toBe(null);
  });
  it('more pieces knocked off give more, a few at a time', () => {
    const a = harvestOf('stone', false, 20, 1)!, b = harvestOf('stone', false, 20, 8)!;
    expect(a.count).toBeGreaterThanOrEqual(1);
    expect(b.count).toBeGreaterThan(a.count);
    expect(b.count).toBeLessThanOrEqual(4);
  });
});

describe('HarvestLedger', () => {
  it('one pile per blow (not per falling piece), and at most HARVEST_MAX from one thing until it stands again', async () => {
    const { HarvestLedger, HARVEST_MAX } = await import('./Harvest');
    const l = new HarvestLedger();
    const b = {};
    expect(l.take(b, 0)).toBe(true);
    expect(l.take(b, 0.2)).toBe(false);
    let n = 1;
    for (let t = 1; t < 30; t += 1) if (l.take(b, t)) n++;
    expect(n).toBe(HARVEST_MAX);
    l.reset(b);
    expect(l.take(b, 31)).toBe(true);
  });
});

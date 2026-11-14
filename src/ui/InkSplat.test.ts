import { describe, expect, it } from 'vitest';
import { inkBlots } from './InkSplat';

// Big Gerald's ink (the playtest of 2026-11-14: boss attacks "fun like the npcs that throw lean cups"): a jet that catches
// you splats the screen with ink for a moment.
const seeded = (s: number) => () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;

describe('the ink splat on the screen', () => {
  it('throws a handful of big blots, on the screen, at least one over the middle where you look', () => {
    for (const seed of [1, 7, 42, 999]) {
      const blots = inkBlots(seeded(seed));
      expect(blots.length).toBeGreaterThanOrEqual(4);
      expect(blots.length).toBeLessThanOrEqual(7);
      for (const b of blots) {
        expect(b.x).toBeGreaterThanOrEqual(5);
        expect(b.x).toBeLessThanOrEqual(95);
        expect(b.y).toBeGreaterThanOrEqual(5);
        expect(b.y).toBeLessThanOrEqual(95);
        expect(b.size).toBeGreaterThanOrEqual(14);
        expect(b.size).toBeLessThanOrEqual(42);
      }
      expect(blots.some((b) => Math.abs(b.x - 50) < 18 && Math.abs(b.y - 50) < 18)).toBe(true);
    }
  });

  it('never covers the same spot twice in a row the same way', () => {
    const r = seeded(3);
    expect(inkBlots(r)).not.toEqual(inkBlots(r));
  });
});

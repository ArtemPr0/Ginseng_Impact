import { describe, expect, it } from 'vitest';
import { floatingLeaf } from './Water';
import { RIVER_RIBBON_HALF, riverDistance } from './Terrain';

describe('leaves floating down the river (the playtest of 2026-11-13: they drifted straight west off the bent river)', () => {
  it('stay on the water the whole way, wherever the river bends', () => {
    for (const off of [-6, -3, 0, 3, 6]) for (let t = 0; t < 400; t += 0.7) {
      const p = floatingLeaf({ s0: 13, off, speed: 0.7 }, t);
      expect(riverDistance(p.x, p.z), `off ${off} at t ${t}`).toBeLessThan(RIVER_RIBBON_HALF - 3);
    }
  });

  it('go with the current: a leaf a second later is downstream of where it was', () => {
    const a = floatingLeaf({ s0: 40, off: 2, speed: 0.7 }, 10);
    const b = floatingLeaf({ s0: 40, off: 2, speed: 0.7 }, 11);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeGreaterThan(0.5);
    expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeLessThan(0.9);
  });

  it('never jump sideways at a bend of the river line (the review: 3 m in one frame at a 30° vertex)', () => {
    for (const off of [-6, 6]) {
      let prev = floatingLeaf({ s0: 0, off, speed: 0.7 }, 0);
      for (let t = 0.05; t < 200; t += 0.05) { // (one lap: at the river's end a leaf starts again at its head)
        const p = floatingLeaf({ s0: 0, off, speed: 0.7 }, t);
        expect(Math.hypot(p.x - prev.x, p.z - prev.z), `off ${off} at t ${t.toFixed(2)}`).toBeLessThan(0.15);
        prev = p;
      }
    }
  });
});

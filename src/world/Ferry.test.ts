import { describe, expect, it } from 'vitest';
import { ferryAt, type FerryRun } from './Ferry';

const run: FerryRun = { z0: 952, z1: 1018, x: (z) => 955 + Math.sin(z * 0.05) * 3, speed: 1.6, turn: 4 };
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe('the gnomes\' ferry on the Vale river', () => {
  it('rows back and forth between its two ends, on the river\'s line', () => {
    let lo = Infinity, hi = -Infinity;
    for (let t = 0; t < 400; t += 0.25) {
      const f = ferryAt(t, run);
      lo = Math.min(lo, f.z); hi = Math.max(hi, f.z);
      expect(f.x).toBeCloseTo(run.x(f.z), 6);
    }
    expect(lo).toBeCloseTo(run.z0, 1);
    expect(hi).toBeCloseTo(run.z1, 1);
  });

  it('goes bow first: while it moves, its heading is where it is going', () => {
    for (let t = 0.5; t < 300; t += 0.37) {
      const a = ferryAt(t, run), b = ferryAt(t + 0.05, run);
      const moved = Math.hypot(b.x - a.x, b.z - a.z);
      if (moved < 0.02) continue;
      const going = Math.atan2(b.z - a.z, b.x - a.x);
      expect(Math.abs(wrap(a.heading - going)), `t ${t.toFixed(2)}`).toBeLessThan(0.15);
    }
  });

  it('turns round at each end smoothly (no snap of half a turn)', () => {
    for (let t = 0; t < 300; t += 0.05) expect(Math.abs(wrap(ferryAt(t + 0.05, run).heading - ferryAt(t, run).heading))).toBeLessThan(0.1);
  });
});

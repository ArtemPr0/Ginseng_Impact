import { describe, expect, it } from 'vitest';
import { crowdSpots } from './Crowd';

describe('crowdSpots', () => {
  const stage = { x: 0, z: 0 };
  it('fills the front first, keeps everyone apart, faces the stage and skips blocked ground', () => {
    const pillar = (x: number, z: number) => Math.hypot(x - 2, z - 6) < 1.5;
    const spots = crowdSpots([{ rect: [-4, 4, 3, 12], look: stage, keep: 3 }], 20, (x, z) => !pillar(x, z));
    expect(spots.length).toBe(20);
    for (const a of spots) {
      expect(Math.hypot(a.x, a.z)).toBeGreaterThanOrEqual(3);
      expect(pillar(a.x, a.z)).toBe(false);
      for (const b of spots) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeGreaterThanOrEqual(1.3);
      // Facing the stage within the small turn of the head.
      const want = Math.atan2(-a.z, -a.x);
      expect(Math.abs(Math.atan2(Math.sin(a.yaw - want), Math.cos(a.yaw - want)))).toBeLessThan(0.2);
    }
    // The first spot is nearer than the last.
    expect(Math.hypot(spots[0].x, spots[0].z)).toBeLessThan(Math.hypot(spots[19].x, spots[19].z));
  });

  it('spills into the next area when the first is full, and keeps off taken points', () => {
    const spots = crowdSpots(
      [{ rect: [-1, 1, 3, 4], look: stage }, { rect: [-6, 6, 10, 16], look: { x: 0, z: 9 } }],
      12, () => true, { taken: [{ x: 0, z: 3.5 }] },
    );
    expect(spots.length).toBe(12);
    expect(spots.some((s) => s.area === 1)).toBe(true);
    for (const s of spots) expect(Math.hypot(s.x, s.z - 3.5)).toBeGreaterThanOrEqual(1.3);
  });

  it('is deterministic for a seed', () => {
    const a = crowdSpots([{ rect: [-4, 4, 3, 12], look: stage }], 10, () => true, { seed: 3 });
    const b = crowdSpots([{ rect: [-4, 4, 3, 12], look: stage }], 10, () => true, { seed: 3 });
    expect(a).toEqual(b);
  });
});

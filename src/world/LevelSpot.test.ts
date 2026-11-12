import { describe, expect, it } from 'vitest';
import { levelSpot } from './LevelSpot';

describe('a chest finds level ground', () => {
  // A floor at 10 m with a 0.4 m-wide post 1.2 m tall at (0, 0).
  const post = (x: number, z: number) => (Math.hypot(x, z) < 0.4 ? 11.2 : 10);
  it('steps off a post onto the floor beside it, not balanced on top of it', () => {
    const s = levelSpot(post, 0, 0, 0.8, 4);
    expect(s.y).toBe(10);
    expect(Math.hypot(s.x, s.z)).toBeGreaterThan(0.8 + 0.4);
    expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(4);
  });
  it('stays put where the ground is already level', () => {
    expect(levelSpot(() => 3, 5, 6, 0.8, 4)).toEqual({ x: 5, z: 6, y: 3 });
  });
  it('keeps the original spot when nowhere near is level (a slope): never a worse place', () => {
    const s = levelSpot((x) => x, 0, 0, 0.8, 2);
    expect([s.x, s.z]).toEqual([0, 0]);
  });
});

import { describe, expect, it } from 'vitest';
import { ComboTracker, Cooldown, computeDamage, inCone, inRadius } from './Combat';

describe('computeDamage', () => {
  it('scales with atk and multiplier and is reduced by defence', () => {
    const base = computeDamage({ atk: 100, multiplier: 1, defense: 0 });
    expect(base).toBe(100);
    expect(computeDamage({ atk: 100, multiplier: 2.5, defense: 0 })).toBe(250);
    expect(computeDamage({ atk: 100, multiplier: 1, defense: 100 })).toBe(50);
  });

  it('applies reaction multipliers and never drops below 1', () => {
    expect(computeDamage({ atk: 100, multiplier: 1, defense: 0, reaction: 'eclipse' })).toBeGreaterThan(100);
    expect(computeDamage({ atk: 1, multiplier: 0.01, defense: 1000 })).toBe(1);
  });
});

describe('hit shapes', () => {
  const o = { x: 0, z: 0 };
  it('inCone respects range and half angle around the facing yaw', () => {
    // yaw 0 faces +x
    expect(inCone(o, 0, { x: 3, z: 0.5 }, 4, Math.PI / 4)).toBe(true);
    expect(inCone(o, 0, { x: 5, z: 0 }, 4, Math.PI / 4)).toBe(false);
    expect(inCone(o, 0, { x: 1, z: 3 }, 4, Math.PI / 4)).toBe(false);
    expect(inCone(o, Math.PI / 2, { x: 0, z: 3 }, 4, Math.PI / 4)).toBe(true);
  });
  it('inRadius is inclusive', () => {
    expect(inRadius(o, { x: 3, z: 4 }, 5)).toBe(true);
    expect(inRadius(o, { x: 3, z: 4.1 }, 5)).toBe(false);
  });
});

describe('Cooldown', () => {
  it('is ready at start, then counts down', () => {
    const c = new Cooldown(2);
    expect(c.ready).toBe(true);
    c.use();
    expect(c.ready).toBe(false);
    expect(c.fraction).toBeCloseTo(1);
    c.update(1);
    expect(c.fraction).toBeCloseTo(0.5);
    c.update(1.1);
    expect(c.ready).toBe(true);
    expect(c.fraction).toBe(0);
  });
});

describe('ComboTracker', () => {
  const durations = [0.4, 0.4, 0.6];

  it('starts hit 0 on press and reports the hit frame once', () => {
    const c = new ComboTracker(durations, 0.4);
    expect(c.press(0)).toBe(0);
    expect(c.swinging).toBe(true);
    const fired: number[] = [];
    for (let t = 0; t < 0.5; t += 1 / 60) {
      const h = c.update(1 / 60);
      if (h !== null) fired.push(h);
    }
    expect(fired).toEqual([0]);
    expect(c.swinging).toBe(false);
  });

  it('chains to the next hit when pressed late in a swing, and resets after a gap', () => {
    const c = new ComboTracker(durations, 0.4);
    c.press(0);
    for (let i = 0; i < 20; i++) c.update(1 / 60); // 0.33 s into a 0.4 s swing
    expect(c.press(0)).toBeNull(); // buffered
    for (let i = 0; i < 6; i++) c.update(1 / 60);
    expect(c.currentHit).toBe(1);
    expect(c.swinging).toBe(true);
    for (let i = 0; i < 120; i++) c.update(1 / 60);
    expect(c.swinging).toBe(false);
    expect(c.press(0)).toBe(0); // combo reset after idle
  });

  it('ignores presses early in a swing', () => {
    const c = new ComboTracker(durations, 0.4);
    c.press(0);
    c.update(1 / 60);
    expect(c.press(0)).toBeNull();
    for (let i = 0; i < 30; i++) c.update(1 / 60);
    expect(c.currentHit).toBe(0);
    expect(c.swinging).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { KNOCKDOWN_AT, canKnockDown, knockdownTilt, knockdownLean } from './Knockdown';

describe('Knockdown (v12, Flowbound: heavy blows put mobs on the ground)', () => {
  it('falls fast, lies there, gets back up by the end', () => {
    expect(knockdownTilt(0, 1.6)).toBe(0);
    expect(knockdownTilt(0.15, 1.6)).toBeGreaterThan(0.2);
    expect(knockdownTilt(0.35, 1.6)).toBeCloseTo(1, 2);
    expect(knockdownTilt(0.9, 1.6)).toBeCloseTo(1, 2);
    expect(knockdownTilt(1.4, 1.6)).toBeLessThan(0.6);
    expect(knockdownTilt(1.6, 1.6)).toBe(0);
    expect(knockdownTilt(5, 1.6)).toBe(0);
  });
  it('only heavy blows on small grounded mobs', () => {
    const small = { boss: false, flying: false, speed: 3, height: 1.8 };
    expect(canKnockDown(small, KNOCKDOWN_AT)).toBe(true);
    expect(canKnockDown(small, KNOCKDOWN_AT - 1)).toBe(false);
    expect(canKnockDown({ ...small, boss: true }, 20)).toBe(false);
    expect(canKnockDown({ ...small, flying: true }, 20)).toBe(false);
    expect(canKnockDown({ ...small, speed: 0 }, 20)).toBe(false);
    expect(canKnockDown({ ...small, height: 6 }, 20)).toBe(false);
  });
  it('falls away from the blow: hit from the front it goes over backwards, from the side sideways', () => {
    // Facing +x (yaw 0); a blow pushing it along -x (it was hit from the front) tips it back (negative pitch).
    const back = knockdownLean(-1, 0, 0, 1);
    expect(back.pitch).toBeLessThan(-1);
    expect(Math.abs(back.roll)).toBeLessThan(1e-6);
    const side = knockdownLean(0, 1, 0, 1);
    expect(Math.abs(side.pitch)).toBeLessThan(1e-6);
    expect(Math.abs(side.roll)).toBeGreaterThan(1);
  });
});

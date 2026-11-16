import { describe, expect, it } from 'vitest';
import { Euler, Vector3 } from 'three';
import { yawToRotation } from '../models/ModelRig';
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
});

describe('knockdownLean in the world (review 2026-11-16: a side blow tipped it toward the hit)', () => {
  const top = (kx: number, kz: number, yaw: number) => {
    const l = knockdownLean(kx, kz, yawToRotation(yaw), 1);
    return new Vector3(0, 1, 0).applyEuler(new Euler(l.pitch, yawToRotation(yaw), l.roll, 'YXZ'));
  };
  for (const yaw of [0, 1.1, Math.PI / 2, -2.4]) for (const [kx, kz] of [[1, 0], [0, 1], [-0.6, 0.8], [0.3, -0.95]]) {
    it(`facing ${yaw.toFixed(1)}, pushed along (${kx}, ${kz}): its top goes along the push`, () => {
      const t = top(kx, kz, yaw);
      const l = Math.hypot(kx, kz);
      // Nearly flat (FLAT = 1.4 rad over), and over along the push.
      expect(t.y).toBeLessThan(0.2);
      expect((t.x * kx + t.z * kz) / l).toBeGreaterThan(0.95);
    });
  }
});

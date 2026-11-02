import { describe, expect, it } from 'vitest';
import { Euler, Vector3 } from 'three';
import { SLOPE, easeLean, slopeTarget, yawDelta, type Lean } from './SlopeLean';
import { yawToRotation } from '../models/ModelRig';

const deg = (r: number) => (r * 180) / Math.PI;

/** The body's up axis in the world for a lean at a yaw (the root's YXZ rotation). */
function upOf(yaw: number, l: Lean): Vector3 {
  return new Vector3(0, 1, 0).applyEuler(new Euler(l.pitch, yawToRotation(yaw), l.roll, 'YXZ'));
}

describe('slope lean', () => {
  it('is zero on flat ground standing still', () => {
    const l = slopeTarget(0, 0, 0.7, 0, 0, { pitch: 1, roll: 1 });
    expect(Math.abs(l.pitch)).toBeLessThan(1e-9);
    expect(Math.abs(l.roll)).toBeLessThan(1e-9);
  });

  it('tips the up axis toward the ground normal along the slope, clamped at 10°', () => {
    for (const yaw of [0, 1.1, -2.4]) {
      // A gentle climb straight ahead: 0.1 m per metre.
      const fx = Math.cos(yaw), fz = Math.sin(yaw);
      const l = slopeTarget(0.1 * fx, 0.1 * fz, yaw, 0, 0, { pitch: 0, roll: 0 });
      const up = upOf(yaw, l);
      const normal = new Vector3(-0.1 * fx, 1, -0.1 * fz).normalize();
      expect(up.angleTo(normal)).toBeLessThan(0.01);
      // A steep one stops at the limit.
      const steep = slopeTarget(2 * fx, 2 * fz, yaw, 0, 0, { pitch: 0, roll: 0 });
      expect(deg(Math.abs(steep.pitch))).toBeCloseTo(10, 5);
    }
  });

  it('rolls half the lateral tilt across a slope', () => {
    const yaw = 0.4;
    // Ground rising toward the body's side (local +x is (sin yaw, -cos yaw)).
    const sx = Math.sin(yaw), sz = -Math.cos(yaw);
    const l = slopeTarget(0.1 * sx, 0.1 * sz, yaw, 0, 0, { pitch: 0, roll: 0 });
    expect(Math.abs(l.pitch)).toBeLessThan(1e-9);
    expect(l.roll).toBeCloseTo(Math.atan(0.1) * 0.5, 6);
    // The up axis leans away from the rising side (toward the normal).
    const up = upOf(yaw, l);
    expect(up.x * sx + up.z * sz).toBeLessThan(0);
  });

  it('leans into a turn up to 6°, toward the inside', () => {
    const yaw = 0;
    const l = slopeTarget(0, 0, yaw, 3, 8, { pitch: 0, roll: 0 });
    expect(deg(l.roll)).toBeCloseTo(6, 5);
    // Yaw increasing turns the nose from +x toward +z: the inside is +z, and the head goes there.
    expect(upOf(yaw, l).z).toBeGreaterThan(0);
    const r = slopeTarget(0, 0, yaw, -0.2, 3, { pitch: 0, roll: 0 });
    expect(r.roll).toBeLessThan(0);
    expect(deg(Math.abs(r.roll))).toBeLessThan(6);
  });

  it('eases at about 8/s and settles upright when off', () => {
    const cur = { pitch: 0, roll: 0 };
    easeLean(cur, { pitch: 0.1, roll: 0 }, 1 / 8);
    expect(cur.pitch).toBeCloseTo(0.1 * (1 - Math.exp(-1)), 6);
    for (let i = 0; i < 200; i++) easeLean(cur, null, 0.05);
    expect(cur).toEqual({ pitch: 0, roll: 0 });
    expect(SLOPE.rate).toBe(8);
  });

  it('wraps yaw deltas', () => {
    expect(yawDelta(3.1, -3.1)).toBeCloseTo(2 * Math.PI - 6.2, 6);
  });
});

import { describe, expect, it } from 'vitest';
import { shakeOffset } from './Shake';

describe('shakeOffset (trauma-based, smooth noise)', () => {
  it('nothing with no trauma; grows with its square; stays small', () => {
    expect(shakeOffset(1.3, 0)).toEqual({ x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 });
    let big = 0, half = 0;
    for (let t = 0; t < 5; t += 0.05) {
      const a = shakeOffset(t, 1), b = shakeOffset(t, 0.5);
      big = Math.max(big, Math.abs(a.roll), Math.abs(a.pitch), Math.abs(a.yaw));
      half = Math.max(half, Math.abs(b.roll), Math.abs(b.pitch), Math.abs(b.yaw));
      expect(Math.abs(a.x)).toBeLessThan(0.2);
      expect(Math.abs(a.roll)).toBeLessThan(0.06);
    }
    expect(half / big).toBeLessThan(0.35);
    expect(big).toBeGreaterThan(0.015);
  });
  it('smooth: frame to frame at 60 fps it moves a little, not a random jump', () => {
    let worst = 0;
    for (let t = 0; t < 3; t += 1 / 60) worst = Math.max(worst, Math.abs(shakeOffset(t + 1 / 60, 1).x - shakeOffset(t, 1).x));
    expect(worst).toBeLessThan(0.03);
  });
});

import { describe, expect, it } from 'vitest';
import { CameraBob } from './CameraBob';

describe('CameraBob', () => {
  it('standing still the camera does not move', () => {
    const b = new CameraBob();
    for (let i = 0; i < 60; i++) expect(b.step(1 / 60, 0)).toBe(0);
  });
  it('walking it rises and falls a few centimetres, a step at a time; sprinting a little more', () => {
    const walk = new CameraBob(), run = new CameraBob();
    let wMax = 0, rMax = 0, sign = 0, flips = 0;
    for (let i = 0; i < 120; i++) {
      const y = walk.step(1 / 60, 5);
      wMax = Math.max(wMax, Math.abs(y));
      if (Math.sign(y) !== sign && y !== 0) { flips++; sign = Math.sign(y); }
      rMax = Math.max(rMax, Math.abs(run.step(1 / 60, 9)));
    }
    expect(wMax).toBeGreaterThan(0.015);
    expect(wMax).toBeLessThan(0.05);
    expect(rMax).toBeGreaterThan(wMax);
    expect(flips).toBeGreaterThan(3);
  });
  it('eases out when the hero stops instead of snapping', () => {
    const b = new CameraBob();
    for (let i = 0; i < 37; i++) b.step(1 / 60, 5);
    const moving = Math.abs(b.step(1 / 60, 5));
    expect(Math.abs(b.step(1 / 60, 0))).toBeLessThanOrEqual(moving + 1e-6);
  });
});

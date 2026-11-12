import { describe, expect, it } from 'vitest';
import { settleSpin, steerHeading } from './Drift';

const TAU = Math.PI * 2;
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe('a drifting boat keeps its bow downstream', () => {
  it('a spin picked up over the eye pool settles to whole turns once the vortex lets go', () => {
    let spin = 3.7; // part of a turn: left alone it holds the boat sideways for the rest of the river
    for (let i = 0; i < 600; i++) spin = settleSpin(spin, 0, 1 / 60);
    expect(Math.abs(wrap(spin))).toBeLessThan(0.01);
  });

  it('keeps spinning while the vortex holds it', () => {
    expect(settleSpin(1, 0.8, 0.1)).toBeGreaterThan(1);
  });

  it('turns at a river bend the short way and smoothly, never snapping', () => {
    const step = steerHeading(0, Math.PI / 2, 1 / 60);
    expect(step).toBeGreaterThan(0);
    expect(step).toBeLessThan(Math.PI / 2 * 0.2);
    expect(steerHeading(3, -3, 1 / 60)).toBeGreaterThan(3); // across the ±π seam: the short way is up
    let h = 0;
    for (let i = 0; i < 600; i++) h = steerHeading(h, 1, 1 / 60);
    expect(h).toBeCloseTo(1, 3);
    expect(Math.abs(wrap(steerHeading(TAU + 0.5, 0.5, 1 / 60) - 0.5))).toBeLessThan(1e-6);
  });
});

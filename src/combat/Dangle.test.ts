import { describe, expect, it } from 'vitest';
import { Dangle } from './Dangle';

describe('Dangle (a held body swings from its grip, playtest 2026-11-17: "realistic and funny")', () => {
  it('when the holder sets off, the body swings back against the move, then settles hanging straight', () => {
    const d = new Dangle(1.2);
    let x = 0;
    // The holder runs off along +x for a quarter second.
    for (let i = 0; i < 15; i++) { x += 6 / 60; d.update(1 / 60, x, 0); }
    expect(d.dx).toBeLessThan(-0.05);
    for (let i = 0; i < 600; i++) d.update(1 / 60, x, 0);
    expect(Math.abs(d.dx)).toBeLessThan(0.01);
    expect(Math.abs(d.dz)).toBeLessThan(0.01);
  });
  it('it overshoots when the holder stops short (a pendulum, not a lerp)', () => {
    const d = new Dangle(1.2);
    let x = 0, maxPos = 0;
    for (let i = 0; i < 40; i++) { x += 5 / 60; d.update(1 / 60, x, 0); }
    for (let i = 0; i < 90; i++) { d.update(1 / 60, x, 0); maxPos = Math.max(maxPos, d.dx); }
    expect(maxPos).toBeGreaterThan(0.05);
  });
  it('a kick (a swing used as a club) sets it swinging, and the swing stays bounded', () => {
    const d = new Dangle(1.2);
    d.kick(4, 0);
    let m = 0;
    for (let i = 0; i < 120; i++) { d.update(1 / 60, 0, 0); m = Math.max(m, Math.hypot(d.dx, d.dz)); }
    expect(m).toBeGreaterThan(0.2);
    expect(m).toBeLessThan(1.2);
    // Its tilt angles follow its swing.
    expect(Math.abs(d.tiltZ)).toBeLessThan(Math.PI / 2);
  });
});

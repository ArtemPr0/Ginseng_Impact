import { describe, expect, it } from 'vitest';
import { gazeStep, type Gaze } from './Gaze';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const opts = { home: 0, look: 0, reach: 30, body: 0.6, neck: 0.7 };
function settle(g: Gaze, at: { x: number; z: number }, player: { x: number; z: number }, o = opts): Gaze {
  for (let i = 0; i < 1200; i++) g = gazeStep(g, at, player, 1 / 60, o);
  return g;
}
/** Where the head looks (direction angle, from +x toward +z): the body's direction, plus its own offset, less the neck. */
const looks = (g: Gaze, o = opts) => g.body + o.look - g.neck;

describe('a dragon that watches you', () => {
  it('looks straight at you when you are near: body and neck together', () => {
    for (const ang of [0.3, 1.0, -1.2]) {
      const g = settle({ body: 0, neck: 0 }, { x: 0, z: 0 }, { x: Math.cos(ang) * 10, z: Math.sin(ang) * 10 });
      expect(wrap(looks(g) - ang)).toBeCloseTo(0, 2);
      expect(Math.abs(g.body)).toBeLessThanOrEqual(opts.body + 1e-9);
      expect(Math.abs(g.neck)).toBeLessThanOrEqual(opts.neck + 1e-9);
    }
  });
  it('allows for a head that looks off its body\'s line (the lean dragon looks 27° left of its yaw)', () => {
    const o = { ...opts, look: 0.47 };
    const g = settle({ body: 0, neck: 0 }, { x: 0, z: 0 }, { x: 10, z: 0 }, o);
    expect(wrap(looks(g, o))).toBeCloseTo(0, 2);
  });
  it('settles back to where it lay once you walk off', () => {
    const g = settle({ body: 0.5, neck: -0.4 }, { x: 0, z: 0 }, { x: 80, z: 0 });
    expect(g.body).toBeCloseTo(0, 3);
    expect(g.neck).toBeCloseTo(0, 3);
  });
  it('turns slowly, a heavy body: no snap', () => {
    const g = gazeStep({ body: 0, neck: 0 }, { x: 0, z: 0 }, { x: 0, z: 10 }, 1 / 60, opts);
    expect(Math.abs(g.body)).toBeLessThan(0.02);
  });
});

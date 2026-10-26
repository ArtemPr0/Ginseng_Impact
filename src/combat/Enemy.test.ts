import { describe, expect, it } from 'vitest';
import { MODELS } from '../data/models';
import { Color, SRGBColorSpace } from 'three';
import { ELEMENT_COLOR } from './Elements';
import { attackClips, dissolveEdge, pickMark, separate, SEPARATION, topplePose, turnToward, TURN_RATE } from './Enemy';

describe('attackClips', () => {
  it('throws (a boulder, a log, a cup) with the throw clip before the plain swing', () => {
    expect(attackClips('boulder')).toEqual(['throw', 'heavy', 'attack']);
    expect(attackClips('logthrow')).toEqual(['throw', 'heavy', 'attack']);
    expect(attackClips('cupmortar')).toEqual(['throw', 'heavy', 'attack']);
  });

  it('keeps the slam on the slam clip', () => {
    expect(attackClips('slam')[0]).toBe('charged_ground_slam');
  });
});

describe('boss clip table', () => {
  it('names the over-shoulder throw for the cyclopes, so a boulder is not thrown with the slam', () => {
    for (const id of ['cyclops', 'cyclops-lord']) expect(MODELS[id].clips?.throw).toMatch(/over_shoulder_throw/);
  });
});

describe('topplePose', () => {
  const back = (80 * Math.PI) / 180;

  it('starts upright and on the ground', () => {
    const { pitch, sink } = topplePose(0);
    expect(pitch).toBeCloseTo(0, 6);
    expect(sink).toBeCloseTo(0, 6);
  });

  it('ends about 80° on its back, sunk 0.3 m', () => {
    const { pitch, sink } = topplePose(3);
    expect(pitch).toBeCloseTo(-back, 2);
    expect(sink).toBeCloseTo(-0.3, 3);
  });

  it('falls like a weight: less than half way down at half time, settled by 0.9 s', () => {
    expect(Math.abs(topplePose(0.45).pitch)).toBeLessThan(back / 2);
    expect(Math.abs(topplePose(0.9).pitch)).toBeCloseTo(back, 2);
    expect(topplePose(0.9).sink).toBeCloseTo(-0.3, 3);
  });
});

describe('pickMark: whom an enemy goes for', () => {
  const hero = { x: 0, z: 0 };
  it('the hero alone, or a boss: always the hero', () => {
    expect(pickMark(5, 0, [hero], 0, 18, false)).toBe(0);
    expect(pickMark(5, 0, [hero, { x: 5, z: 0.5 }], 0, 18, true)).toBe(0);
  });
  it('a companion nearer by more than the margin, within aggro, draws it off', () => {
    expect(pickMark(10, 0, [hero, { x: 9, z: 0 }], 0, 18, false)).toBe(1);
    // Only a little nearer: it keeps to whom it fights (no flicking between two).
    expect(pickMark(10, 0, [hero, { x: 0.5, z: 0 }], 0, 18, false)).toBe(0);
    expect(pickMark(10, 0, [hero, { x: 9.5, z: 0 }], 1, 18, false)).toBe(1);
  });
  it('a companion beyond aggro does not count, and one it chased out of aggro lets it go back to the hero', () => {
    expect(pickMark(30, 0, [hero, { x: 50, z: 0 }], 0, 18, false)).toBe(0);
    expect(pickMark(0, 0, [hero, { x: 25, z: 0 }], 1, 18, false)).toBe(0);
  });
  it('a stale index (its companion went home) falls back to the hero', () => {
    expect(pickMark(3, 0, [hero], 2, 18, false)).toBe(0);
  });
});

describe('turnToward: the turn rate', () => {
  it('turns at most the step, the short way round, and lands on the target once within it', () => {
    expect(turnToward(0, 1, TURN_RATE.mob / 60)).toBeCloseTo(7 / 60);
    expect(turnToward(0, 0.05, 0.1)).toBeCloseTo(0.05);
    // From 170 to -170 degrees: 20 degrees through ±180, not 340 the long way.
    const a = (170 * Math.PI) / 180;
    const y = turnToward(a, -a, 0.1);
    expect(Math.abs(y)).toBeGreaterThan(a);
  });
  it('a boss takes about a second to come about through 180 degrees; a mob under half that', () => {
    const steps = (rate: number) => { let y = 0, n = 0; while (Math.abs(y - Math.PI) > 1e-6 && n < 1000) { y = turnToward(y, Math.PI - 1e-9, rate / 60); n++; } return n / 60; };
    expect(steps(TURN_RATE.boss)).toBeGreaterThan(0.9);
    expect(steps(TURN_RATE.mob)).toBeLessThan(0.5);
  });
});

describe('separate: a pack does not stand in itself', () => {
  const body = (x: number, z: number, radius: number) => ({ pos: { x, z }, radius, shove(dx: number, dz: number) { this.pos.x += dx; this.pos.z += dz; } });
  it('parts two overlapping bodies at SEPARATION m/s between them, never past touching', () => {
    const a = body(0, 0, 1), b = body(1, 0, 1);
    separate([a, b], 0.1);
    expect(b.pos.x - a.pos.x).toBeCloseTo(1 + SEPARATION * 0.1);
    for (let i = 0; i < 200; i++) separate([a, b], 0.1);
    expect(b.pos.x - a.pos.x).toBeCloseTo(2);
  });
  it('the smaller gives the more way; bodies apart are left alone; bodies on one spot still part', () => {
    const boss = body(0, 0, 3), mob = body(2, 0, 0.5);
    separate([boss, mob], 0.1);
    expect(mob.pos.x - 2).toBeGreaterThan(5 * -boss.pos.x);
    expect(-boss.pos.x).toBeGreaterThan(0);
    const far = body(10, 0, 1), near = body(0, 0, 1);
    separate([far, near], 0.1);
    expect(far.pos.x).toBe(10);
    const p = body(0, 0, 1), q = body(0, 0, 1);
    separate([p, q], 0.1);
    expect(Math.hypot(p.pos.x - q.pos.x, p.pos.z - q.pos.z)).toBeGreaterThan(0.1);
  });
});

describe('dissolveEdge', () => {
  it('burns in its element\'s colour, lifted so even the fog\'s navy glows', () => {
    const fog = new Color(dissolveEdge('fog'));
    const hsl = { h: 0, s: 0, l: 0 };
    fog.getHSL(hsl, SRGBColorSpace);
    expect(hsl.l).toBeGreaterThanOrEqual(0.49);
    const blood = new Color(ELEMENT_COLOR.blood).getHSL({ h: 0, s: 0, l: 0 }, SRGBColorSpace);
    if (blood.l >= 0.5) expect(dissolveEdge('blood')).toBe(new Color(ELEMENT_COLOR.blood).getHex());
  });
});

import { describe, expect, it } from 'vitest';
import { MODELS } from '../data/models';
import { attackClips, topplePose } from './Enemy';

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

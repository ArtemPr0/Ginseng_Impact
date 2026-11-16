import { describe, expect, it } from 'vitest';
import { blowKindOf, breaksThings, coneSmash } from './Smash';

describe('blowKindOf', () => {
  it('names the blow by what made it', () => {
    expect(blowKindOf(0)).toBe('light');
    expect(blowKindOf(2)).toBe('light');
    expect(blowKindOf('heavy')).toBe('heavy');
    expect(blowKindOf('skill')).toBe('skill');
    expect(blowKindOf(undefined)).toBe('skill');
  });
});

describe('breaksThings', () => {
  it('bosses and anything three metres tall smash what they walk into; small mobs do not', () => {
    expect(breaksThings({ boss: true, height: 2 })).toBe(true);
    expect(breaksThings({ height: 9 })).toBe(true);
    expect(breaksThings({ height: 2, scale: 1.6 })).toBe(true);
    expect(breaksThings({ height: 1.75 })).toBe(false);
  });
});

describe('coneSmash', () => {
  it('a swing breaks things in front of the hero, as far as its reach', () => {
    const s = coneSmash({ x: 0, y: 0, z: 0 }, 0, 3);
    expect(s.x).toBeCloseTo(1.8);
    expect(s.z).toBeCloseTo(0);
    expect(s.y).toBeCloseTo(1.2);
    expect(s.r).toBeCloseTo(1.5);
  });
});

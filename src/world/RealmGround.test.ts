import { describe, expect, it } from 'vitest';
import { GALAXY } from '../data/world';
import { RealmGrounds } from './RealmGround';

describe('RealmGrounds.rimFootprints', () => {
  it('the kingdom rim has many boxes near floor + 6', () => {
    const g = new RealmGrounds();
    const rim = g.rimFootprints('galaxy');
    expect(rim.length).toBeGreaterThan(80);
    for (const f of rim) {
      expect(f.kind).toBe('box');
      if (f.kind !== 'box') continue;
      expect(f.top).toBeGreaterThan(GALAXY.y + 4);
      expect(f.top).toBeLessThan(GALAXY.y + 12);
      expect(f.hw).toBe(2.2);
      expect(f.hd).toBe(1.1);
    }
    expect(g.rimFootprints('galaxy')).toBe(rim);
  });

  it('returns nothing for non-sculpt zones', () => {
    expect(new RealmGrounds().rimFootprints('treehouse')).toEqual([]);
  });
});

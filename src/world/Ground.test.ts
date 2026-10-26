import { describe, expect, it } from 'vitest';
import { GALAXY } from '../data/world';
import { GroundQuery } from './Ground';
import { RealmGrounds } from './RealmGround';

describe('GroundQuery', () => {
  const terrain = { heightAt: () => 3 };
  const q = new GroundQuery(terrain, new RealmGrounds());

  it('keeps the island where no realm reaches', () => {
    expect(q.heightAt(0, 40)).toBe(3);
  });

  it('stands on the kingdom sculpt instead of the island abyss', () => {
    const h = q.heightAt(GALAXY.x, GALAXY.z - 20);
    expect(h).toBeGreaterThan(GALAXY.y - 8);
    expect(h).toBeLessThan(GALAXY.y + 12);
  });
});

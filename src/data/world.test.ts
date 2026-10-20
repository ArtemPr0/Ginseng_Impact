import { describe, expect, it } from 'vitest';
import { SKIES } from '../render/Sky';
import { CLOUD_LEVEL, LAYOUT, REALM_SKY, REALMS, SUNKEN } from './world';

describe('CLOUD_LEVEL', () => {
  it('has a level (or none) for the island and every realm', () => {
    expect(CLOUD_LEVEL.island).toBe(LAYOUT.cloudSea.y);
    for (const r of REALMS) expect(r.id in CLOUD_LEVEL, r.id).toBe(true);
  });

  it('no cloud sea under the lake or in the rooms', () => {
    expect(CLOUD_LEVEL.sunken).toBeNull();
    for (const id of ['treehouse', 'tavern-room', 'crypt-room'] as const) expect(CLOUD_LEVEL[id]).toBeNull();
  });

  it('every cloud layer lies well under its realm’s floor (the drowned city’s -48 least of all)', () => {
    for (const r of REALMS) {
      const y = CLOUD_LEVEL[r.id as keyof typeof CLOUD_LEVEL];
      if (y === null) continue;
      expect(y, r.id).toBeLessThan(r.y - 25);
    }
    expect(SUNKEN.y).toBe(-48);
  });
});

describe('REALM_SKY', () => {
  it('every realm but the kingdom (its sky changes with its night) has its own sky to reflect', () => {
    for (const r of REALMS) expect(r.id in REALM_SKY, r.id).toBe(r.id !== 'galaxy');
    expect('island' in REALM_SKY).toBe(false);
  });

  it('the vale and the alley reflect the very sky the island dome shows over them (their SKIES preset)', () => {
    for (const id of ['vale', 'graveyard'] as const) {
      const p = SKIES[id];
      expect(REALM_SKY[id]).toEqual({ horizon: p.horizon, mid: p.mid, zenith: p.zenith, cloud: p.cloudLit });
    }
  });
});

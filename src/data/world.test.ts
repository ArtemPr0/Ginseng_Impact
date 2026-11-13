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

  it('the vale, the alley and the drowned city reflect the very sky the island dome shows over them (their SKIES preset)', () => {
    for (const id of ['vale', 'graveyard', 'sunken'] as const) {
      const p = SKIES[id];
      expect(REALM_SKY[id]).toEqual({ horizon: p.horizon, mid: p.mid, zenith: p.zenith, cloud: p.cloudLit });
    }
  });
});

describe('the carriage at the lean castle\'s bridge (the review of 2026-11-13: left inside the castle when the west block moved)', async () => {
  const { CARRIAGE_STAND, LEAN_QUARTER: Q, ANCHORS: A } = await import('./world');
  it('stands on the street side of the moat, with Count Rattlewheel in it', () => {
    expect(CARRIAGE_STAND.x).toBeGreaterThan(Q.moat[1]);
    expect(CARRIAGE_STAND.x).toBeLessThan(Q.street[0] + 20);
    expect(Math.hypot(A['carriage-count'].x - CARRIAGE_STAND.x, A['carriage-count'].z - CARRIAGE_STAND.z)).toBeLessThan(1);
  });
});

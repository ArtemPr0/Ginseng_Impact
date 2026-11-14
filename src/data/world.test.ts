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

describe('Yung Lean\'s kingdom closed in (the playtest of 2026-11-14: "make the land smaller", about half the walking)', async () => {
  const { GALAXY, LEAN_QUARTER: Q, ANCHORS: A } = await import('./world');
  const plaza = { x: GALAXY.x, z: GALAXY.z - 5 };
  const far = (p: { x: number; z: number }) => Math.hypot(p.x - plaza.x, p.z - plaza.z);
  // Before: the castle, the snow chapel, the Skeleton King on his throne and the sky dock, as they stood until then.
  const before = { castle: { x: 833, z: 18 }, chapel: { x: 933, z: 152 }, throne: { x: 1000, z: -159 }, dock: { x: 1180, z: 12 } };
  const now = { castle: Q.castle, chapel: Q.chapel, throne: A['skeleton-king'], dock: Q.dock };
  const keys = Object.keys(before) as Array<keyof typeof before>;
  it('from the middle of the plaza to the castle, the chapel, the throne and the dock: each 60% of the way or less', () => {
    for (const k of keys) expect(far(now[k]) / far(before[k]), `${k}: ${far(now[k]).toFixed(1)} m, was ${far(before[k]).toFixed(1)} m`).toBeLessThanOrEqual(0.6);
  });
  it('the quarters still meet edge to edge, each on its own ground, none of them on top of the plaza', () => {
    expect(Q.castleYard[1]).toBe(Q.moat[0]);
    expect(Q.moat[1]).toBe(Q.street[0]);
    expect(Q.snow[2]).toBe(Q.street[3]);
    expect(Q.court[3]).toBeLessThan(Q.street[2] - 20);
    for (const k of keys) expect(far(now[k]), k).toBeGreaterThan(50);
  });
});

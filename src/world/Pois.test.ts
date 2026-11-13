import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { GALAXY, KINGDOM_ROAD } from '../data/world';
import { COURT_DRAGONS, COURT_RUIN, dressKingdom, ruinPieces } from './Pois';

// No GLB fetches or canvases in node.
vi.mock('../models/ModelRig', () => ({ loadModelOrWarn: () => Promise.resolve(null), ModelRig: class {}, yawToRotation: (y: number) => y }));
vi.mock('../render/Glow', () => ({ glowSprite: () => new Group(), glowTexture: () => null }));

describe('the Skeleton Court\'s fallen gatehouse', () => {
  it('leaves the throne dragons room: no column or wall in a dragon\'s claws', () => {
    const { columns, walls } = ruinPieces(COURT_RUIN.x, COURT_RUIN.z, COURT_RUIN.yaw, COURT_DRAGONS);
    for (const [x, z] of [...columns, ...walls]) for (const [dx, dz, r] of COURT_DRAGONS) expect(Math.hypot(x - dx, z - dz)).toBeGreaterThanOrEqual(r);
    expect(columns.length + walls.length).toBeGreaterThanOrEqual(4);
  });
  it('without anything to avoid, lays all four columns and both walls', () => {
    const { columns, walls } = ruinPieces(0, 0, 0);
    expect([columns.length, walls.length]).toEqual([4, 2]);
  });
});

describe('the kingdom\'s margins keep off its checkered road (a dead tree stood on it, the playtest of 2026-11-13)', () => {
  const flora: Array<{ id: string; ps: Array<{ x: number; z: number }> }> = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  dressKingdom({ group: new Group(), realm: () => {}, place: () => {}, flora: (id: string, ps: Array<{ x: number; z: number }>) => { flora.push({ id, ps }); }, vfx: () => {}, h: () => GALAXY.y, rnd } as never);

  it('grows no tree, mushroom or crystal on the road', () => {
    const on = flora.flatMap(({ id, ps }) => ps.filter((p) => Math.abs(p.x - KINGDOM_ROAD.x) < KINGDOM_ROAD.half && p.z > KINGDOM_ROAD.z0 && p.z < KINGDOM_ROAD.z1).map((p) => `${id} at (${p.x.toFixed(1)}, ${p.z.toFixed(1)})`));
    expect(on).toEqual([]);
    expect(flora.some(({ id }) => id === 'dead-forest-tree')).toBe(true);
  });
});

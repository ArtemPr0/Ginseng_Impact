import { describe, expect, it } from 'vitest';
import { DROWNED_RESERVED, drownedLayout, STREET, SUNKEN_FLOOR, SUNKEN_SURFACE, surfaceExit, TABLE_SPOTS } from './Sunken';
import { Vector3 } from 'three';
import type { PortalLink } from './Portal';
import { ISLAND_PORTALS } from '../data/world';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('the drowned street, thrown about by the sea', () => {
  const houses = drownedLayout(seeded(7));

  it('scatters its houses, not two straight rows: no common line, no common facing', () => {
    expect(houses.length).toBeGreaterThanOrEqual(12);
    const off = houses.map((h) => Math.abs(h.dx));
    const mean = off.reduce((a, b) => a + b, 0) / off.length;
    const sd = Math.sqrt(off.reduce((a, b) => a + (b - mean) ** 2, 0) / off.length);
    expect(sd, 'spread of distances from the street').toBeGreaterThan(4);
    const yaws = new Set(houses.map((h) => Math.round(h.yaw * 4)));
    expect(yaws.size, 'distinct facings').toBeGreaterThan(houses.length / 2);
  });

  it('keeps every house clear of the next, of the way through and of the square', () => {
    for (let i = 0; i < houses.length; i++) {
      const a = houses[i];
      expect(Math.abs(a.dx), 'off the winding way through').toBeGreaterThanOrEqual(STREET.clear);
      expect(a.z).toBeLessThanOrEqual(STREET.z1);
      expect(a.z).toBeGreaterThanOrEqual(STREET.z0);
      for (let j = i + 1; j < houses.length; j++) expect(Math.hypot(a.dx - houses[j].dx, a.z - houses[j].z)).toBeGreaterThanOrEqual(STREET.spacing);
      for (const r of DROWNED_RESERVED) expect(Math.hypot(a.dx - r.dx, a.z - r.z), r.what).toBeGreaterThanOrEqual(r.r);
    }
  });

  it('is the same city every time (seeded)', () => {
    expect(drownedLayout(seeded(7))).toEqual(houses);
  });
});

describe('the way home from the Sunken City', () => {
  const link = (at: Vector3, radius: number, height: number, x: number, z: number, yaw: number, name: string): PortalLink => ({ at, radius, height, to: { x, z, yaw, cameraYaw: 0 }, name });
  it('is up: rising through the sea\'s surface anywhere over the city brings you out in the lily pond', () => {
    const l = surfaceExit(link);
    expect(l.at.y).toBe(SUNKEN_SURFACE.y);
    const [x0, x1, z0, z1] = SUNKEN_FLOOR;
    for (const [x, z] of [[x0, z0], [x1, z1], [x0, z1], [x1, z0]]) expect(Math.hypot(x - l.at.x, z - l.at.z)).toBeLessThan(l.radius);
    expect(Math.hypot(l.to.x - ISLAND_PORTALS.pond.x, l.to.z - ISLAND_PORTALS.pond.z)).toBeLessThan(8);
    expect(l.name).toBe('The Lily Pond');
  });
  it('sets the goblets on the long tables\' tops', () => {
    for (const d of TABLE_SPOTS) expect(Math.abs(d) + 0.12).toBeLessThan(1.0);
  });
});

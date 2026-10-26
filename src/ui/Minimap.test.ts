import { describe, expect, it } from 'vitest';
import { GALAXY, REALMS, SUNKEN } from '../data/world';
import { bakeZonePixels, ZoneBakes, zoneBakeSpec } from './Minimap';

describe('zoneBakeSpec', () => {
  it("covers a realm's whole square round its centre, shading from its floor", () => {
    const s = zoneBakeSpec(GALAXY);
    expect(s).toMatchObject({ id: 'galaxy', cx: GALAXY.x, cz: GALAXY.z, span: GALAXY.radius * 2, floorY: GALAXY.y });
    expect(zoneBakeSpec(SUNKEN, 64).res).toBe(64);
  });

  it('every realm bakes to its own square', () => {
    const ids = REALMS.map((r) => zoneBakeSpec(r).id);
    expect(new Set(ids).size).toBe(REALMS.length);
  });
});

describe('bakeZonePixels', () => {
  const spec = { id: 't', cx: 100, cz: -50, span: 40, res: 4, floorY: 10 };
  const px = (data: Uint8ClampedArray, i: number, j: number) => Array.from(data.slice((j * 4 + i) * 4, (j * 4 + i) * 4 + 4));

  it('leaves the void transparent (the panel colour shows) and paints ground opaque', () => {
    // Land only on the west half (x < 100); far below the floor elsewhere.
    const data = bakeZonePixels(spec, (x) => (x < 100 ? 10 : -80));
    for (let j = 0; j < 4; j++) {
      expect(px(data, 0, j)[3]).toBe(255);
      expect(px(data, 1, j)[3]).toBe(255);
      expect(px(data, 2, j)).toEqual([0, 0, 0, 0]);
      expect(px(data, 3, j)).toEqual([0, 0, 0, 0]);
    }
  });

  it('samples each pixel at its centre: column i goes +x, row j goes +z', () => {
    const seen: Array<[number, number]> = [];
    bakeZonePixels(spec, (x, z) => { seen.push([x, z]); return 10; });
    expect(seen).toHaveLength(16);
    expect(seen[0]).toEqual([85, -65]);
    expect(seen[1]).toEqual([95, -65]);
    expect(seen[4]).toEqual([85, -55]);
    expect(seen[15]).toEqual([115, -35]);
  });

  it('shades floors by height like the island, and draws walls and buildings pale', () => {
    const data = bakeZonePixels(spec, (x, z) => (z < -50 ? 10 : x < 100 ? 6 : 20));
    const floor = px(data, 0, 0);
    const low = px(data, 0, 3);
    const wall = px(data, 3, 3);
    expect(floor[2]).toBeGreaterThan(low[2]);
    expect(wall).toEqual([120, 132, 196, 255]);
    // A floor is a cobalt blue, never black.
    expect(floor[2]).toBeGreaterThan(floor[0]);
    expect(floor[2]).toBeGreaterThanOrEqual(110);
  });

  it('a hole in the height (NaN) is void, not a broken colour', () => {
    const data = bakeZonePixels(spec, () => Number.NaN);
    expect(Array.from(data).every((v) => v === 0)).toBe(true);
  });
});

describe('ZoneBakes', () => {
  it('bakes a zone the first time it is asked for and keeps it by id', () => {
    const bakes = new ZoneBakes<{ n: number }>();
    let made = 0;
    const bake = () => ({ n: ++made });
    const a = bakes.get('galaxy', bake);
    expect(bakes.get('galaxy', bake)).toBe(a);
    expect(made).toBe(1);
    const b = bakes.get('vale', bake);
    expect(b).not.toBe(a);
    expect(made).toBe(2);
    // Back in the kingdom: the cached bake, no second one.
    expect(bakes.get('galaxy', bake)).toBe(a);
    expect(made).toBe(2);
  });

  it('drop forgets one zone (rebaked next time) or all of them', () => {
    const bakes = new ZoneBakes<number>();
    let made = 0;
    bakes.get('galaxy', () => ++made);
    bakes.get('vale', () => ++made);
    bakes.drop('galaxy');
    expect(bakes.has('galaxy')).toBe(false);
    expect(bakes.has('vale')).toBe(true);
    expect(bakes.get('galaxy', () => ++made)).toBe(3);
    bakes.drop();
    expect(bakes.has('galaxy') || bakes.has('vale')).toBe(false);
  });
});

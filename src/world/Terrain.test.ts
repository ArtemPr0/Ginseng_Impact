import { describe, expect, it } from 'vitest';
import { Noise2D, smoothstep } from './noise';
import { LAYOUT } from '../data/world';
import { EYE, RIVER_LEVEL, WORLD, riverAt, terrainHeight } from './Terrain';

describe('Noise2D', () => {
  it('is deterministic for a seed and bounded in [-1, 1]', () => {
    const a = new Noise2D(7);
    const b = new Noise2D(7);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 2000; i++) {
      const x = (i * 0.37) % 50;
      const y = (i * 0.91) % 50;
      const v = a.noise(x, y);
      expect(v).toBe(b.noise(x, y));
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.5);
  });

  it('smoothstep clamps and eases', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothstep(10, 0, 5)).toBeCloseTo(0.5); // reversed edges work too
  });
});

describe('terrainHeight', () => {
  const noise = new Noise2D(1337);

  it('is a walkable plateau near the spawn and the far end of the causeway line', () => {
    for (const z of [70, 40, 0, -30, -90, -120]) {
      const h = terrainHeight(0, z, noise);
      expect(h).toBeGreaterThan(-6);
      expect(h).toBeLessThan(14);
    }
  });

  it('fades the causeway corridor out past its ends instead of leaving a ledge', () => {
    // (Behind the spawn and behind the causeway's north stairs, where it once stopped in 2.5 m and 3.6 m steps.)
    for (const x of [0, 4]) {
      for (const [from, to] of [[WORLD.corridorZ.max - 8, WORLD.corridorZ.max + 11], [WORLD.corridorZ.min - 12, WORLD.corridorZ.min + 6]]) {
        for (let z = from; z < to; z += 0.5) {
          expect(Math.abs(terrainHeight(x, z + 0.5, noise) - terrainHeight(x, z, noise))).toBeLessThan(0.5);
        }
      }
    }
  });

  it('drops into the abyss well outside the island', () => {
    for (const [x, z] of [[170, 0], [-170, -36], [0, 150], [0, -200]] as const) {
      expect(terrainHeight(x, z, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
    }
  });

  it('has a chasm across the island on the causeway line', () => {
    expect(terrainHeight(0, WORLD.chasmCentreZ, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
    expect(terrainHeight(24, WORLD.chasmCentreZ, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
  });

  it('opens the eye pool under water where the road crosses the river, with dry banks at both bridge ends', () => {
    expect(terrainHeight(EYE.x, EYE.z, noise)).toBeLessThan(RIVER_LEVEL - 2);
    expect(riverAt(EYE.x, EYE.z)).toBe(1);
    for (const z of [EYE.z - EYE.b - 4, EYE.z + EYE.b + 4]) expect(terrainHeight(0, z, noise)).toBeGreaterThan(RIVER_LEVEL + 1);
  });

  it('cuts the forest gorge deep below its rims', () => {
    const G = WORLD.gorge;
    const floor = terrainHeight(G.x, -124, noise);
    expect(terrainHeight(G.x - G.rim - 2, -124, noise) - floor).toBeGreaterThan(8);
  });

  it('steps the koi pools down toward the eye, each basin under its own water', () => {
    const levels = LAYOUT.tiers.map((t) => t.water);
    expect(levels[0]).toBeLessThan(levels[1]);
    expect(levels[1]).toBeLessThan(levels[2]);
    for (const t of LAYOUT.tiers) expect(terrainHeight(t.x, t.z, noise)).toBeLessThan(t.water);
  });
});

import { describe, expect, it } from 'vitest';
import { Noise2D, smoothstep } from './noise';
import { WORLD, terrainHeight } from './Terrain';

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

  it('drops into the abyss well outside the island', () => {
    for (const [x, z] of [[170, 0], [-170, -36], [0, 150], [0, -200]] as const) {
      expect(terrainHeight(x, z, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
    }
  });

  it('has a chasm across the island on the causeway line', () => {
    expect(terrainHeight(0, WORLD.chasmCentreZ, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
    expect(terrainHeight(24, WORLD.chasmCentreZ, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
  });
});

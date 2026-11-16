import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { boltPaths, Lightning } from './Lightning';

describe('boltPaths (a branching lightning bolt)', () => {
  it('a jagged main channel from a to b, with 2-4 thinner branches off it', () => {
    const a = new Vector3(0, 18, 0), b = new Vector3(0, 0, 0);
    const paths = boltPaths(a, b, 1);
    const main = paths[0];
    expect(main.width).toBe(1);
    expect(main.points[0].distanceTo(a)).toBeLessThan(1e-6);
    expect(main.points[main.points.length - 1].distanceTo(b)).toBeLessThan(1e-6);
    expect(main.points.length).toBeGreaterThanOrEqual(17);
    // Jagged: some points leave the straight line.
    expect(Math.max(...main.points.map((p) => Math.hypot(p.x, p.z)))).toBeGreaterThan(0.3);
    expect(paths.length - 1).toBeGreaterThanOrEqual(2);
    expect(paths.length - 1).toBeLessThanOrEqual(4);
    for (const br of paths.slice(1)) expect(br.width).toBeLessThan(main.width);
  });
  it('every bolt is different', () => {
    const a = new Vector3(0, 10, 0), b = new Vector3();
    expect(boltPaths(a, b, 1)[0].points[5].x).not.toBe(boltPaths(a, b, 1)[0].points[5].x);
  });
});

describe('Lightning', () => {
  it('flickers and is gone after its life; uses a pool', () => {
    const l = new Lightning(4);
    l.strike(new Vector3(0, 18, 0), new Vector3(), 0x9fd8ff);
    expect(l.live).toBe(1);
    for (let t = 0; t < 0.5; t += 1 / 30) l.update(1 / 30);
    expect(l.live).toBe(0);
    for (let i = 0; i < 9; i++) l.strike(new Vector3(0, 5, 0), new Vector3(), 0xffffff);
    expect(l.live).toBe(4);
  });
});

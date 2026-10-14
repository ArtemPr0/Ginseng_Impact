import { describe, expect, it } from 'vitest';
import { HeightWorld } from './Colliders';

describe('HeightWorld', () => {
  const world = new HeightWorld({ heightAt: (x) => x * 0.1 });

  it('returns terrain height outside footprints and the top inside', () => {
    world.add({ kind: 'box', x: 10, z: 0, hw: 2, hd: 3, top: 6 });
    world.add({ kind: 'cyl', x: -10, z: 0, r: 1.5, top: 4 });
    expect(world.heightAt(0, 0)).toBeCloseTo(0);
    expect(world.heightAt(10, 0)).toBe(6);
    expect(world.heightAt(12.5, 0)).toBeCloseTo(1.25);
    expect(world.heightAt(-10, 1)).toBe(4);
    expect(world.heightAt(-10, 2)).toBeCloseTo(-1);
  });

  it('respects box rotation', () => {
    const w = new HeightWorld({ heightAt: () => 0 });
    w.add({ kind: 'box', x: 0, z: 0, hw: 5, hd: 0.5, top: 2, rotY: Math.PI / 2 });
    expect(w.heightAt(0, 4)).toBe(2);
    expect(w.heightAt(4, 0)).toBe(0);
  });

  it('never lowers the terrain', () => {
    const w = new HeightWorld({ heightAt: () => 10 });
    w.add({ kind: 'cyl', x: 0, z: 0, r: 3, top: 2 });
    expect(w.heightAt(0, 0)).toBe(10);
  });
});

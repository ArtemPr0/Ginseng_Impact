import { describe, expect, it } from 'vitest';
import { CLEARANCE, gridFootprint, HeightWorld } from './Colliders';
import { COLLIDER_GRIDS, PRESENT_MODELS } from '../data/colliderGrids';
import { MODELS } from '../data/models';

const flat = { heightAt: () => 0 };

describe('HeightWorld — overhangs', () => {
  it('lets a walker pass under a raised deck and stand on it from above', () => {
    const w = new HeightWorld(flat);
    w.add({ kind: 'box', x: 0, z: 0, hw: 3, hd: 10, top: 6, bottom: 5.1 });
    expect(w.heightAt(0, 0, 0)).toBe(0);
    expect(w.heightAt(0, 0, 6)).toBe(6);
    expect(w.heightAt(0, 0)).toBe(6);
  });

  it('blocks a walker whose head would hit the underside', () => {
    const w = new HeightWorld(flat);
    w.add({ kind: 'box', x: 0, z: 0, hw: 3, hd: 3, top: 2.4, bottom: CLEARANCE - 0.2 });
    expect(w.heightAt(0, 0, 0)).toBe(2.4);
  });

  it('a footprint without an underside is a solid block', () => {
    const w = new HeightWorld(flat);
    w.add({ kind: 'cyl', x: 0, z: 0, r: 2, top: 8 });
    expect(w.heightAt(0, 0, 0)).toBe(8);
    expect(w.heightAt(5, 0, 0)).toBe(0);
    expect(w.blocked(0, 0)).toBe(true);
    expect(w.near(3, 0, (f) => (f.kind === 'cyl' ? f.r + 2 : 0))).toBe(true);
    expect(w.near(5, 0, (f) => (f.kind === 'cyl' ? f.r + 2 : 0))).toBe(false);
  });
});

describe('baked model colliders', () => {
  it('only exist for models whose file is present', () => {
    for (const id of Object.keys(COLLIDER_GRIDS)) expect(PRESENT_MODELS.has(id)).toBe(true);
    expect(gridFootprint('palmisland', 0, 0, 0)).toBeNull();
  });

  it('keep the cloister arches open and its columns solid', () => {
    const f = gridFootprint('cloister', 0, 0, 0);
    expect(f).not.toBeNull();
    const w = new HeightWorld(flat);
    w.add(f!);
    // Walking along the arcade's axis at ground level: open bays between solid columns.
    let open = 0;
    let solid = 0;
    for (let x = -4.5; x <= 4.5; x += 0.25) {
      const h = w.heightAt(x, 0, 0);
      if (h < 0.6) open++;
      else if (h > MODELS.cloister.height * 0.6) solid++;
    }
    expect(open).toBeGreaterThan(10);
    expect(solid).toBeGreaterThan(3);
  });

  it('make a closed building solid inside, and follow its rotation and scale', () => {
    const w = new HeightWorld(flat);
    w.add(gridFootprint('village-house', 10, 0, 10, Math.PI / 2, 1.5)!);
    expect(w.heightAt(10, 10, 0)).toBeGreaterThan(MODELS['village-house'].height);
    expect(w.heightAt(10 + MODELS['village-house'].height * 2, 10, 0)).toBe(0);
  });
});

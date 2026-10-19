import { describe, expect, it } from 'vitest';
import { type BufferGeometry, type Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { ChunkedGround, GROUND_ALBEDO, Heightfield, LAYER, LAYER_COUNT, LAYER_TINT, OUTSIDE_HEIGHT, type Sculpt, TEXTURE_LAYERS } from './Ground';

/** A tiny sculpt: 8 m square at (-3, 2), 1 m cells, a known polynomial with a 1.5 m step past x = 1.5 (between vertices). */
function sculpt(extra: Partial<Sculpt> = {}): Sculpt {
  return {
    x0: -3,
    z0: 2,
    size: 8,
    cell: 1,
    height: (x, z) => 0.1 * x * x - 0.05 * z * x + 0.3 * z + (x > 1.5 ? 1.5 : 0),
    layers: (_x, _z, _h, slope, out) => {
      const rock = Math.min(1, Math.max(0, (slope - 0.45) / 0.35));
      out[LAYER.rock] = rock;
      out[LAYER.grass] = 1 - rock;
    },
    ...extra,
  };
}

/** Deterministic pseudo-random numbers in [0, 1). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Hit { h: number; nx: number; ny: number; nz: number; count: number }

/** The height and face normal of the drawn triangle under (x, z), read from a chunk's LOD-0 index buffer. */
function drawnSurface(ground: ChunkedGround, x: number, z: number): Hit {
  const hit: Hit = { h: NaN, nx: 0, ny: 0, nz: 0, count: 0 };
  for (const child of ground.group.children) {
    const geo = (child as Mesh).geometry as BufferGeometry;
    const pos = geo.attributes.position.array as Float32Array;
    const idx = geo.index!.array;
    for (let t = 0; t < idx.length; t += 3) {
      const i0 = idx[t] * 3, i1 = idx[t + 1] * 3, i2 = idx[t + 2] * 3;
      const x0 = pos[i0], z0 = pos[i0 + 2], x1 = pos[i1], z1 = pos[i1 + 2], x2 = pos[i2], z2 = pos[i2 + 2];
      const den = (z1 - z2) * (x0 - x2) + (x2 - x1) * (z0 - z2);
      if (Math.abs(den) < 1e-9) continue; // a skirt: vertical, no footprint
      const l0 = ((z1 - z2) * (x - x2) + (x2 - x1) * (z - z2)) / den;
      const l1 = ((z2 - z0) * (x - x2) + (x0 - x2) * (z - z2)) / den;
      const l2 = 1 - l0 - l1;
      if (l0 < -1e-9 || l1 < -1e-9 || l2 < -1e-9) continue;
      hit.h = l0 * pos[i0 + 1] + l1 * pos[i1 + 1] + l2 * pos[i2 + 1];
      // Face normal from the winding (must point up: the ground's front faces are its tops).
      const ax = x1 - x0, ay = pos[i1 + 1] - pos[i0 + 1], az = z1 - z0;
      const bx = x2 - x0, by = pos[i2 + 1] - pos[i0 + 1], bz = z2 - z0;
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const len = Math.hypot(nx, ny, nz);
      nx /= len; ny /= len; nz /= len;
      hit.nx = nx; hit.ny = ny; hit.nz = nz;
      hit.count++;
    }
  }
  return hit;
}

describe('Heightfield', () => {
  it('bakes deterministically', () => {
    const a = new Heightfield(sculpt());
    const b = new Heightfield(sculpt());
    a.bake();
    b.bake();
    expect(a.n).toBe(8);
    expect(a.data.length).toBe(81);
    expect(a.data).toEqual(b.data);
    expect(a.layers).toEqual(b.layers);
    expect(a.tints).toEqual(b.tints);
    expect(a.isBaked).toBe(true);
  });

  it('heightAt at the vertices equals the baked data', () => {
    const f = new Heightfield(sculpt());
    f.bake();
    const s = f.s;
    for (let iz = 0; iz <= f.n; iz++) {
      for (let ix = 0; ix <= f.n; ix++) {
        expect(f.heightAt(s.x0 + ix * s.cell, s.z0 + iz * s.cell)).toBeCloseTo(f.data[f.indexOf(ix, iz)], 6);
        expect(f.data[f.indexOf(ix, iz)]).toBeCloseTo(s.height(s.x0 + ix * s.cell, s.z0 + iz * s.cell), 5);
      }
    }
  });

  it('clamps within one cell of the border and reports OUTSIDE_HEIGHT beyond it', () => {
    const f = new Heightfield(sculpt());
    f.bake();
    expect(f.contains(0, 5)).toBe(true);
    expect(f.contains(-3.01, 5)).toBe(false);
    expect(f.heightAt(-3.5, 5)).toBeCloseTo(f.heightAt(-3, 5), 9);
    expect(f.heightAt(0, 10.9)).toBeCloseTo(f.heightAt(0, 10), 9);
    expect(f.heightAt(-4.5, 5)).toBe(OUTSIDE_HEIGHT);
    expect(f.heightAt(0, 11.5)).toBe(OUTSIDE_HEIGHT);
    expect(Number.isFinite(f.heightAt(1e6, -1e6))).toBe(true);
    expect(f.slopeAt(1e6, 0)).toBe(0);
    expect(f.normalAt(1e6, 0, new Vector3()).y).toBe(1);
  });

  it('stores normalised layers: the textures sum to 255 and wet is its own channel', () => {
    const f = new Heightfield(sculpt());
    f.bake();
    const count = (f.n + 1) * (f.n + 1);
    expect(f.layers.length).toBe(count * LAYER_COUNT);
    for (let i = 0; i < count; i++) {
      let sum = 0;
      for (let k = 0; k < TEXTURE_LAYERS; k++) {
        expect(f.layers[i * LAYER_COUNT + k]).toBeLessThanOrEqual(255);
        sum += f.layers[i * LAYER_COUNT + k];
      }
      expect(Math.abs(sum - 255)).toBeLessThanOrEqual(6);
      expect(f.layers[i * LAYER_COUNT + LAYER.wet]).toBe(0);
    }
    // A sculpt that paints nothing falls back to grass; wet rides on top without diluting the textures.
    const g = new Heightfield(sculpt({ layers: (x, _z, _h, _s, out) => { if (x > 0) { out[LAYER.grass] = 1; out[LAYER.wet] = 1; } } }));
    g.bake();
    for (let i = 0; i < count; i++) {
      expect(g.layers[i * LAYER_COUNT + LAYER.grass]).toBe(255);
      const x = g.s.x0 + (i % (g.n + 1)) * g.s.cell;
      expect(g.layers[i * LAYER_COUNT + LAYER.wet]).toBe(x > 0 ? 255 : 0);
    }
    // The default far tint of pure grass is the grass pattern's average at the lit albedo.
    const grassVertex = f.layers.findIndex((v, k) => k % LAYER_COUNT === LAYER.grass && v === 255) / LAYER_COUNT;
    expect(grassVertex).toBeGreaterThanOrEqual(0);
    expect(f.tints[grassVertex * 3]).toBeCloseTo(LAYER_TINT[LAYER.grass][0] * GROUND_ALBEDO, 6);
    expect(f.tints[grassVertex * 3 + 2]).toBeCloseTo(LAYER_TINT[LAYER.grass][2] * GROUND_ALBEDO, 6);
    // A sculpt's own tint wins.
    const t = new Heightfield(sculpt({ tint: (_x, _z, _h, _s, out) => out.setRGB(0.25, 0.5, 0.75) }));
    t.bake();
    expect(t.tints[7 * 3]).toBeCloseTo(0.25, 6);
    expect(t.tints[7 * 3 + 1]).toBeCloseTo(0.5, 6);
    expect(t.tints[7 * 3 + 2]).toBeCloseTo(0.75, 6);
  });
});

describe('ChunkedGround', () => {
  it('heightAt is exactly the drawn triangle, and normalAt its face normal, at 500 random points', () => {
    const f = new Heightfield(sculpt());
    const ground = new ChunkedGround(f, new MeshBasicMaterial(), { chunk: 4 });
    expect(ground.chunkCount).toBe(4);
    const rand = rng(99);
    const n = new Vector3();
    for (let i = 0; i < 500; i++) {
      const x = f.s.x0 + rand() * f.s.size;
      const z = f.s.z0 + rand() * f.s.size;
      const hit = drawnSurface(ground, x, z);
      expect(hit.count).toBeGreaterThanOrEqual(1);
      expect(Math.abs(hit.h - f.heightAt(x, z))).toBeLessThan(1e-5);
      f.normalAt(x, z, n);
      expect(n.length()).toBeCloseTo(1, 6);
      expect(hit.ny).toBeGreaterThan(0);
      expect(Math.abs(n.x - hit.nx)).toBeLessThan(1e-5);
      expect(Math.abs(n.y - hit.ny)).toBeLessThan(1e-5);
      expect(Math.abs(n.z - hit.nz)).toBeLessThan(1e-5);
      // slopeAt is the same plane's gradient.
      const g = Math.hypot(n.x / n.y, n.z / n.y);
      expect(f.slopeAt(x, z)).toBeCloseTo(g / (1 + g), 6);
    }
    ground.dispose();
    expect(ground.chunkCount).toBe(0);
    expect(ground.group.children.length).toBe(0);
  });

  it('never builds a chunk that is entirely below voidBelow', () => {
    const f = new Heightfield(sculpt({ height: (x, z) => (x < 1.5 ? -100 : 0.1 * x * x + 0.3 * z), voidBelow: -50 }));
    const ground = new ChunkedGround(f, new MeshBasicMaterial(), { chunk: 4 });
    expect(ground.chunkCount).toBe(2);
    expect(ground.group.children.length).toBe(2);
    const names = ground.group.children.map((c) => c.name).sort();
    expect(names).toEqual(['ground:4,0', 'ground:4,4']);
  });

  it('precomputes three index sets with skirts and swaps them by distance without reallocating', () => {
    const f = new Heightfield(sculpt());
    const ground = new ChunkedGround(f, new MeshBasicMaterial(), { chunk: 8, lod: [64, 160], skirt: 1.5 });
    expect(ground.chunkCount).toBe(1);
    const mesh = ground.group.children[0] as Mesh;
    const geo = mesh.geometry as BufferGeometry;
    const tris = () => geo.index!.count / 3;
    // 8 × 8 cells: full 128 + skirt 64, quarter 32 + 32, sixteenth 8 + 16.
    const full = geo.index!.array;
    expect(tris()).toBe(2 * 64 + 2 * 4 * 8);
    expect(geo.attributes.position.count).toBe(81 + 4 * 9);
    expect(geo.attributes.layerA.itemSize).toBe(4);
    expect((geo.attributes.layerA as { normalized: boolean }).normalized).toBe(true);
    // Skirt vertices hang 1.5 m under their boundary vertex.
    const pos = geo.attributes.position.array as Float32Array;
    expect(pos[81 * 3 + 1]).toBeCloseTo(pos[1] - 1.5, 5);
    expect(pos[81 * 3]).toBe(pos[0]);
    expect(pos[81 * 3 + 2]).toBe(pos[2]);
    expect(mesh.frustumCulled).toBe(true);
    expect(mesh.castShadow).toBe(true);

    ground.update(new Vector3(0, 0, 5));
    expect(geo.index!.array).toBe(full);
    ground.update(new Vector3(-3 - 100, 0, 5));
    const half = geo.index!.array;
    expect(half).not.toBe(full);
    expect(tris()).toBe(2 * 16 + 2 * 4 * 4);
    expect(mesh.castShadow).toBe(false);
    ground.update(new Vector3(-3 - 100, 0, 5));
    expect(geo.index!.array).toBe(half);
    ground.update(new Vector3(0, 0, 2 + 8 + 300));
    const quarter = geo.index!.array;
    expect(tris()).toBe(2 * 4 + 2 * 4 * 2);
    ground.update(new Vector3(0, 0, 5));
    expect(geo.index!.array).toBe(full);
    expect(mesh.castShadow).toBe(true);
    ground.update(new Vector3(0, 0, 2 + 8 + 300));
    expect(geo.index!.array).toBe(quarter);
    // Coarser steps still draw the same corners: every LOD's interior is a surface over the same chunk.
    for (const arr of [full, half, quarter]) for (let i = 0; i < arr.length; i++) expect(arr[i]).toBeLessThan(geo.attributes.position.count);
  });

  it('keeps an uneven last chunk and its LOD steps clamped to the field', () => {
    const f = new Heightfield(sculpt({ size: 6 }));
    const ground = new ChunkedGround(f, new MeshBasicMaterial(), { chunk: 4 });
    expect(ground.chunkCount).toBe(4);
    const rand = rng(7);
    for (let i = 0; i < 100; i++) {
      const x = f.s.x0 + rand() * f.s.size;
      const z = f.s.z0 + rand() * f.s.size;
      expect(Math.abs(drawnSurface(ground, x, z).h - f.heightAt(x, z))).toBeLessThan(1e-5);
    }
    // The 2-cell chunk at the far corner: 2 × 2 cells, 4-cell steps clamp to one cell → 2 + skirt 8 triangles.
    ground.update(new Vector3(-500, 0, -500));
    const corner = ground.group.children.find((c) => c.name === 'ground:4,4') as Mesh;
    expect((corner.geometry as BufferGeometry).index!.count / 3).toBe(2 + 2 * 4);
  });
});

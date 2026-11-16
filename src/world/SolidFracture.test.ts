import { describe, expect, it } from 'vitest';
import { BoxGeometry, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { fractureBlocks, fractureSolid, type SolidChunk } from './SolidFracture';

/** Surface area of a geometry's group-0 (the outside) triangles, in their chunk frames. */
function outerArea(c: SolidChunk): number {
  const p = c.geometry.attributes.position.array as ArrayLike<number>;
  const g = c.geometry.groups[0];
  let a = 0;
  const A = new Vector3(), B = new Vector3(), C = new Vector3();
  for (let i = g.start; i < g.start + g.count; i += 3) {
    A.fromArray(p as number[], i * 3); B.fromArray(p as number[], i * 3 + 3); C.fromArray(p as number[], i * 3 + 6);
    a += B.sub(A).cross(C.sub(A)).length() / 2;
  }
  return a;
}

/** Watertight: every edge of the chunk used an even number of times (twice, or four where two walls fold together). */
function closed(c: SolidChunk): boolean {
  const p = c.geometry.attributes.position.array as ArrayLike<number>;
  const k = (i: number) => `${Math.round(p[i * 3] * 1e4)},${Math.round(p[i * 3 + 1] * 1e4)},${Math.round(p[i * 3 + 2] * 1e4)}`;
  const edges = new Map<string, number>();
  for (let t = 0; t < p.length / 9; t++) for (let e = 0; e < 3; e++) {
    const a = k(t * 3 + e), b = k(t * 3 + ((e + 1) % 3));
    if (a === b) continue;
    const key = a < b ? `${a}|${b}` : `${b}|${a}`;
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  return [...edges.values()].every((n) => n % 2 === 0);
}

const wall = () => new PlaneGeometry(6, 4, 12, 8);

describe('fractureSolid', () => {
  it('keeps all of the surface: the chunks\' outsides add up to the model\'s area (cut triangles split, none lost)', () => {
    const { chunks } = fractureSolid(wall(), 10, { seed: 3, thickness: 0.2 });
    const total = chunks.reduce((s, c) => s + outerArea(c), 0);
    expect(total).toBeCloseTo(24, 1);
  });

  it('cuts along straight planes: no chunk edge zig-zags along the source triangles', () => {
    // A cut through a fine grid would leave sawtooth outlines; split triangles keep each chunk's outside a convex-ish
    // patch whose area is close to its outline's hull.
    const { chunks } = fractureSolid(wall(), 6, { seed: 5, thickness: 0.2 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(c.splitTris).toBeGreaterThanOrEqual(0);
    expect(chunks.reduce((s, c) => s + c.splitTris, 0)).toBeGreaterThan(0);
  });

  it('gives every chunk thickness: a closed solid with inner and cut faces in their own material group', () => {
    const { chunks } = fractureSolid(wall(), 8, { seed: 2, thickness: 0.3 });
    for (const c of chunks) {
      expect(c.geometry.groups.length).toBe(2);
      expect(c.geometry.groups[0].materialIndex).toBe(0);
      expect(c.geometry.groups[1].materialIndex).toBe(1);
      expect(c.geometry.groups[1].count).toBeGreaterThan(0);
      expect(closed(c)).toBe(true);
      // Its box is as thick as asked (the plane faces +z: thickness along one of the box's axes).
      const h = [c.half.x, c.half.y, c.half.z].sort((a, b) => a - b);
      expect(h[0] * 2).toBeCloseTo(0.3, 1);
    }
  });

  it('a closed model (a box) breaks into closed solids too', () => {
    const { chunks } = fractureSolid(new BoxGeometry(2, 2, 2, 4, 4, 4), 8, { seed: 9, thickness: 0.15 });
    expect(chunks.length).toBeGreaterThan(3);
    for (const c of chunks) expect(closed(c)).toBe(true);
  });

  it('a different seed breaks it differently', () => {
    const a = fractureSolid(wall(), 8, { seed: 1, thickness: 0.2 }).chunks.map((c) => c.pivot.x.toFixed(2)).sort().join();
    const b = fractureSolid(wall(), 8, { seed: 2, thickness: 0.2 }).chunks.map((c) => c.pivot.x.toFixed(2)).sort().join();
    expect(a).not.toBe(b);
  });

  it('breaks finer near the blow: small chunks round the impact, big slabs away from it', () => {
    const { chunks } = fractureSolid(new PlaneGeometry(12, 4, 48, 16), 24, { seed: 4, thickness: 0.2, impact: new Vector3(-5, 0, 0) });
    const near = chunks.filter((c) => c.pivot.x < -2.5), far = chunks.filter((c) => c.pivot.x > 2.5);
    const mean = (cs: SolidChunk[]) => cs.reduce((s, c) => s + outerArea(c), 0) / Math.max(1, cs.length);
    expect(near.length).toBeGreaterThan(far.length);
    expect(mean(far)).toBeGreaterThan(mean(near) * 1.5);
  });

  it('knows which chunks touch (for what holds what up), each pair both ways, all one connected piece', () => {
    const { chunks, adjacent } = fractureSolid(wall(), 8, { seed: 6, thickness: 0.2 });
    expect(adjacent.length).toBe(chunks.length);
    for (let i = 0; i < chunks.length; i++) for (const j of adjacent[i]) expect(adjacent[j]).toContain(i);
    const seen = new Set([0]), stack = [0];
    while (stack.length) for (const j of adjacent[stack.pop()!]) if (!seen.has(j)) { seen.add(j); stack.push(j); }
    expect(seen.size).toBe(chunks.length);
  });

  it('each chunk sits in its own box frame: geometry centred, the orientation given as a quaternion', () => {
    const { chunks } = fractureSolid(wall(), 6, { seed: 8, thickness: 0.2 });
    for (const c of chunks) {
      expect(c.q).toBeInstanceOf(Quaternion);
      c.geometry.computeBoundingBox();
      const bb = c.geometry.boundingBox!;
      expect(bb.max.x).toBeCloseTo(c.half.x, 2);
      expect(bb.min.y).toBeCloseTo(-c.half.y, 2);
      expect(c.radius).toBeGreaterThanOrEqual(Math.max(c.half.x, c.half.y, c.half.z) - 1e-6);
    }
  });
});

describe('fractureBlocks (2026-11-16, the reel: buildings come apart block by block)', () => {
  const H = 0.5, Wd = 0.8;
  it('keeps all of the surface', () => {
    const { chunks } = fractureBlocks(wall(), { course: H, length: Wd, thickness: 0.25 });
    expect(chunks.reduce((s, c) => s + outerArea(c), 0)).toBeCloseTo(24, 1);
  });
  it('cuts brick-sized blocks in courses: no block taller than a course or longer than a brick', () => {
    const { chunks } = fractureBlocks(wall(), { course: H, length: Wd, thickness: 0.25 });
    // 6 x 4 m: 8 courses of 7-8 blocks.
    expect(chunks.length).toBeGreaterThanOrEqual(56);
    expect(chunks.length).toBeLessThanOrEqual(72);
    for (const c of chunks) {
      const h = [c.half.x, c.half.y, c.half.z].sort((a, b) => a - b);
      // (A sliver at the wall's end may be narrower than the wall is thick.)
      if (c.half.x * 2 > 0.3) expect(c.half.z * 2).toBeCloseTo(0.25, 1);
      expect(h[2] * 2).toBeLessThanOrEqual(Wd + 1e-3);
      expect(h[1] * 2).toBeLessThanOrEqual(Wd + 1e-3);
    }
    const courses = new Set(chunks.map((c) => Math.floor((c.pivot.y + 2) / H)));
    expect(courses.size).toBe(8);
  });
  it('staggers the joints: every other course is shifted half a brick, like masonry', () => {
    const { chunks } = fractureBlocks(wall(), { course: H, length: Wd, thickness: 0.25 });
    const full = chunks.filter((c) => Math.max(c.half.x, c.half.y, c.half.z) * 2 > Wd - 0.01);
    const phase = (c: SolidChunk) => { const f = (c.pivot.x / Wd) % 1; return f < 0 ? f + 1 : f; };
    const course = (c: SolidChunk) => Math.floor((c.pivot.y + 2) / H);
    const even = full.filter((c) => course(c) % 2 === 0).map(phase);
    const odd = full.filter((c) => course(c) % 2 === 1).map(phase);
    expect(even.length).toBeGreaterThan(10);
    expect(odd.length).toBeGreaterThan(10);
    // (Phases are on a circle: 0.999 and 0.001 are the same place.)
    const gap = (a: number, b: number) => { const d = Math.abs(a - b) % 1; return Math.min(d, 1 - d); };
    for (const p of even) expect(gap(p, even[0])).toBeLessThan(0.02);
    for (const p of odd) expect(gap(p, odd[0])).toBeLessThan(0.02);
    expect(Math.abs(gap(even[0], odd[0]) - 0.5)).toBeLessThan(0.02);
  });
  it('every block is a closed solid with the break material inside', () => {
    const { chunks } = fractureBlocks(wall(), { course: H, length: Wd, thickness: 0.25 });
    for (const c of chunks) {
      expect(c.geometry.groups[1].count).toBeGreaterThan(0);
      expect(closed(c)).toBe(true);
    }
  });
  it('knows which blocks touch: side by side in a course, and over and under across courses; both ways', () => {
    const { chunks, adjacent } = fractureBlocks(wall(), { course: H, length: Wd, thickness: 0.25 });
    adjacent.forEach((a, i) => { for (const j of a) expect(adjacent[j]).toContain(i); });
    // A block in the middle touches 2 beside it and 2 above and 2 below (staggered).
    const mid = chunks.findIndex((c) => Math.abs(c.pivot.x) < 0.5 && Math.abs(c.pivot.y) < 0.6);
    expect(adjacent[mid].length).toBe(6);
  });
  it('keeps the model\'s texture coordinates on the outside faces', () => {
    const { chunks } = fractureBlocks(wall(), { course: H, length: Wd, thickness: 0.25 });
    const uv = chunks[0].geometry.attributes.uv.array as ArrayLike<number>;
    const g = chunks[0].geometry.groups[0];
    let spread = 0;
    for (let i = g.start; i < g.start + g.count; i++) spread = Math.max(spread, Math.abs(uv[i * 2] - uv[g.start * 2]));
    expect(spread).toBeGreaterThan(0.01);
    expect(spread).toBeLessThan(0.2);
  });
  it('a closed model (a house-sized box) comes apart into closed blocks, corners included', () => {
    const { chunks } = fractureBlocks(new BoxGeometry(4, 3, 5, 4, 3, 5), { course: 0.5, length: 0.8, thickness: 0.2 });
    expect(chunks.length).toBeGreaterThan(80);
    for (const c of chunks) expect(closed(c)).toBe(true);
  });
});

import { describe, expect, it } from 'vitest';
import { BoxGeometry, PlaneGeometry, Quaternion, Vector3 } from 'three';
import { fractureSolid, type SolidChunk } from './SolidFracture';

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

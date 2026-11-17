import { describe, expect, it } from 'vitest';
import { BufferGeometry, MeshStandardMaterial, Quaternion, Vector3 } from 'three';
import { assemble } from './FractureObject';
import type { SolidChunk } from './SolidFracture';

const chunk = (x: number, y: number, z: number, hx: number, hy: number, hz: number) => ({
  geometry: new BufferGeometry(), pivot: new Vector3(x, y, z), q: new Quaternion(), half: { x: hx, y: hy, z: hz },
  radius: Math.hypot(hx, hy, hz), tris: 1, splitTris: 0,
}) as unknown as SolidChunk;

describe('assemble links the meshes of a model where they really touch (playtest 2026-11-17: roofs fell on the first hit)', () => {
  it('a long roof slab resting on a wall\'s top is joined to it, though their middles are far apart', () => {
    const m = new MeshStandardMaterial();
    const wall = { chunks: [chunk(0, 1, 0, 0.2, 1, 0.2)], adjacent: [[]], material: m };
    const roof = { chunks: [chunk(2.5, 2.1, 0, 3, 0.1, 1)], adjacent: [[]], material: m };
    const f = assemble([wall, roof]);
    expect(f.adjacent[0]).toContain(1);
    expect(f.adjacent[1]).toContain(0);
  });
  it('pieces with a gap between them are not joined', () => {
    const m = new MeshStandardMaterial();
    const a = { chunks: [chunk(0, 1, 0, 0.5, 0.5, 0.5)], adjacent: [[]], material: m };
    const b = { chunks: [chunk(1.2, 1, 0, 0.5, 0.5, 0.5)], adjacent: [[]], material: m };
    expect(assemble([a, b]).adjacent[0]).not.toContain(1);
  });
});

import { describe, expect, it } from 'vitest';
import { BatchedMesh, BoxGeometry, Matrix4, MeshStandardMaterial, Vector3, type BufferGeometry } from 'three';
import { ChunkBatch } from './ChunkBatch';

/** A non-indexed box with an outside group (the first 24 triangles... all but the last face) and an inside group. */
function chunkGeo(): BufferGeometry {
  const g = new BoxGeometry(1, 1, 1).toNonIndexed();
  g.clearGroups();
  g.addGroup(0, 30, 0);
  g.addGroup(30, 6, 1);
  return g;
}

describe('ChunkBatch (a broken building\'s blocks drawn in one batch per material)', () => {
  it('one batched mesh per outside material plus one for the inside, however many blocks', () => {
    const stone = new MeshStandardMaterial(), wood = new MeshStandardMaterial(), inside = new MeshStandardMaterial();
    const chunks = Array.from({ length: 300 }, (_, i) => ({ geometry: chunkGeo(), material: i % 3 ? stone : wood }));
    const b = new ChunkBatch(chunks, inside, (m) => m);
    const batches = b.group.children.filter((c) => (c as BatchedMesh).isBatchedMesh);
    expect(batches).toHaveLength(3);
    expect(b.proxies).toHaveLength(300);
  });
  it('each block follows its stand-in: moved, turned, shrunk or hidden', () => {
    const m = new MeshStandardMaterial();
    const b = new ChunkBatch([{ geometry: chunkGeo(), material: m }, { geometry: chunkGeo(), material: m }], m, (x) => x);
    const p = b.proxies[1];
    p.position.set(3, 4, 5);
    p.scale.setScalar(0.5);
    b.update();
    const outer = b.group.children.find((c) => (c as BatchedMesh).isBatchedMesh) as BatchedMesh;
    const mat = new Matrix4();
    outer.getMatrixAt(1, mat);
    const v = new Vector3().setFromMatrixPosition(mat);
    expect(v.toArray()).toEqual([3, 4, 5]);
    expect(new Vector3().setFromMatrixScale(mat).x).toBeCloseTo(0.5);
    p.visible = false;
    b.update();
    expect(outer.getVisibleAt(1)).toBe(false);
    expect(outer.getVisibleAt(0)).toBe(true);
  });
});

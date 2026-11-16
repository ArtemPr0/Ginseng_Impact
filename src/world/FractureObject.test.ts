import { describe, expect, it } from 'vitest';
import { BoxGeometry, BufferAttribute, BufferGeometry, Group, InterleavedBuffer, InterleavedBufferAttribute, Mesh, MeshStandardMaterial } from 'three';
import { fractureNow, meshJobs } from './FractureObject';

/**
 * A box stored as the optimised GLBs store it (model-tools optimize: KHR_mesh_quantization): positions as normalized
 * int16 in an interleaved buffer, a scale on the mesh bringing them back to metres.
 */
function quantizedBox(): Mesh {
  const src = new BoxGeometry(2, 2, 2, 2, 2, 2).toNonIndexed();
  const p = src.attributes.position;
  const stride = 4;
  const data = new Int16Array(p.count * stride);
  for (let i = 0; i < p.count; i++) {
    data[i * stride] = Math.round((p.getX(i) / 2) * 32767);
    data[i * stride + 1] = Math.round((p.getY(i) / 2) * 32767);
    data[i * stride + 2] = Math.round((p.getZ(i) / 2) * 32767);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new InterleavedBufferAttribute(new InterleavedBuffer(data, stride), 3, 0, true));
  const n = src.attributes.normal;
  const nd = new Int8Array(n.count * 4);
  for (let i = 0; i < n.count; i++) { nd[i * 4] = Math.round(n.getX(i) * 127); nd[i * 4 + 1] = Math.round(n.getY(i) * 127); nd[i * 4 + 2] = Math.round(n.getZ(i) * 127); }
  g.setAttribute('normal', new BufferAttribute(nd, 3, true));
  const m = new Mesh(g, new MeshStandardMaterial());
  m.scale.setScalar(4); // stored at ±0.5: a 4 m box
  return m;
}

describe('meshJobs on optimised models', () => {
  it('reads quantized, interleaved positions as real coordinates', () => {
    const root = new Group();
    root.add(quantizedBox());
    const [j] = meshJobs(root, 4);
    expect(j.position.length).toBe(j.n !== undefined ? j.position.length : 0);
    let max = 0;
    for (const v of j.position) max = Math.max(max, Math.abs(v));
    // Stored as ±0.5, scaled 4 by its mesh: ±2 in the model frame, not ±32767, and not clamped to ±1.
    expect(max).toBeGreaterThan(1.9);
    expect(max).toBeLessThan(2.1);
    expect(j.position.length % 9).toBe(0);
    expect(Math.abs(j.normal![0])).toBeLessThanOrEqual(1.01);
  });
  it('breaks it into chunks', () => {
    const root = new Group();
    root.add(quantizedBox());
    expect(fractureNow(root, 6, 1, 0.1).chunks.length).toBeGreaterThan(1);
  });
});

describe('fracturers and models still loading', () => {
  it('a model with no meshes yet (its GLB still loading) is not cut, and nothing empty is kept for it', async () => {
    const { SyncFracturer } = await import('./FractureObject');
    const f = new SyncFracturer();
    const root = new Group();
    expect(f.get('house', root, 6, 1, 0.1)).toBe(null);
    root.add(new Mesh(new BoxGeometry(2, 2, 2, 2, 2, 2), new MeshStandardMaterial()));
    expect(f.get('house', root, 6, 1, 0.1)!.chunks.length).toBeGreaterThan(1);
  });
});

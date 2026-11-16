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

describe('WorkerFracturer when the worker fails (review 2026-11-16)', () => {
  it('a job that errors, or a worker that dies, falls back to cutting on the main thread: nothing stays unbreakable', async () => {
    const { WorkerFracturer } = await import('./FractureObject');
    const { BoxGeometry: B, Group: Gr, Mesh: M, MeshStandardMaterial: Mat } = await import('three');
    const fake = { onmessage: null as null | ((e: MessageEvent) => void), onerror: null as null | ((e: unknown) => void), posted: [] as Array<{ id: number }>, postMessage(m: { id: number }) { this.posted.push(m); } };
    const f = new WorkerFracturer(fake as unknown as Worker, 0);
    const g = new Gr();
    g.add(new M(new B(2, 2, 2, 3, 3, 3), new Mat()));
    expect(f.get('a', g, 6, 1, 0.1)).toBeNull();
    // The job comes back as an error.
    fake.onmessage!({ data: { id: fake.posted[0].id, error: 'boom' } } as MessageEvent);
    expect(f.get('a', g, 6, 1, 0.1)?.chunks.length).toBeGreaterThan(0);
    // The worker dies: what was waiting, and everything after, is cut on the spot.
    expect(f.get('b', g, 6, 2, 0.1)).toBeNull();
    fake.onerror!(new Event('error'));
    expect(f.get('b', g, 6, 2, 0.1)?.chunks.length).toBeGreaterThan(0);
    expect(f.get('c', g, 6, 3, 0.1)?.chunks.length).toBeGreaterThan(0);
  });
});

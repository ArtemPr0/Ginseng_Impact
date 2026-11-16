import { describe, expect, it } from 'vitest';
import { BoxGeometry, type BufferGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry } from 'three';
import { chunkCount, fractureGeometry, fractureObject, blockCount, blockSize } from './Fracture';

const triCount = (g: BufferGeometry) => (g.getIndex()?.count ?? g.attributes.position.count) / 3;

describe('fractureGeometry', () => {
  it('puts every triangle in exactly one chunk', () => {
    const g = new SphereGeometry(2, 24, 16);
    const chunks = fractureGeometry(g, 12, 7);
    const total = chunks.reduce((s, c) => s + c.tris, 0);
    expect(total).toBe(triCount(g));
    for (const c of chunks) expect(c.geometry.attributes.position.count).toBe(c.tris * 3);
  });

  it('makes at most n chunks, none empty', () => {
    const chunks = fractureGeometry(new SphereGeometry(2, 24, 16), 12, 7);
    expect(chunks.length).toBeGreaterThan(4);
    expect(chunks.length).toBeLessThanOrEqual(12);
    for (const c of chunks) expect(c.tris).toBeGreaterThan(0);
  });

  it('centres each chunk on its pivot, and the pivot lies inside the bounds', () => {
    const g = new BoxGeometry(4, 6, 2, 6, 8, 3);
    for (const c of fractureGeometry(g, 10, 3)) {
      expect(Math.abs(c.pivot.x)).toBeLessThanOrEqual(2);
      expect(Math.abs(c.pivot.y)).toBeLessThanOrEqual(3);
      expect(Math.abs(c.pivot.z)).toBeLessThanOrEqual(1);
      c.geometry.computeBoundingSphere();
      expect(c.geometry.boundingSphere!.center.length()).toBeLessThan(c.radius + 1e-6);
      expect(c.radius).toBeGreaterThan(0);
    }
  });

  it('is the same for the same seed', () => {
    const g = new SphereGeometry(2, 16, 12);
    const a = fractureGeometry(g, 8, 5).map((c) => c.tris);
    const b = fractureGeometry(g, 8, 5).map((c) => c.tris);
    expect(a).toEqual(b);
  });

  it('keeps normals and uvs', () => {
    const c = fractureGeometry(new SphereGeometry(1, 12, 8), 4, 1)[0];
    expect(c.geometry.attributes.normal).toBeDefined();
    expect(c.geometry.attributes.uv).toBeDefined();
  });
});

describe('fractureObject', () => {
  it('cuts every mesh of a model, in the root frame, keeping each mesh material', () => {
    const root = new Group();
    const red = new MeshStandardMaterial({ color: 0xff0000 });
    const blue = new MeshStandardMaterial({ color: 0x0000ff });
    const a = new Mesh(new BoxGeometry(2, 2, 2, 4, 4, 4), red);
    const b = new Mesh(new BoxGeometry(2, 2, 2, 4, 4, 4), blue);
    b.position.set(0, 10, 0);
    root.add(a, b);
    const chunks = fractureObject(root, 10, 2);
    expect(chunks.some((c) => c.material === red)).toBe(true);
    expect(chunks.some((c) => c.material === blue)).toBe(true);
    for (const c of chunks.filter((c) => c.material === blue)) expect(c.pivot.y).toBeGreaterThan(8);
  });
});

describe('chunkCount', () => {
  it('scales with size: props, houses, landmarks', () => {
    expect(chunkCount(1)).toBeGreaterThanOrEqual(8);
    expect(chunkCount(1)).toBeLessThanOrEqual(20);
    expect(chunkCount(8)).toBeGreaterThanOrEqual(40);
    expect(chunkCount(8)).toBeLessThanOrEqual(80);
    expect(chunkCount(50)).toBeGreaterThanOrEqual(100);
    expect(chunkCount(50)).toBeLessThanOrEqual(150);
  });

  it('halves far away', () => {
    expect(chunkCount(8, true)).toBeLessThan(chunkCount(8));
  });
});

describe('blocks (v12: buildings come apart block by block, as in the godofprompt reel)', () => {
  it('only buildings and big things (2.5 m and up) break into blocks; houses ~200, landmarks ~600, capped', () => {
    expect(blockCount(1.5)).toBe(0);
    expect(blockCount(3)).toBeGreaterThanOrEqual(50);
    expect(blockCount(8)).toBeGreaterThan(180);
    expect(blockCount(8)).toBeLessThan(260);
    expect(blockCount(55)).toBeGreaterThan(550);
    expect(blockCount(500)).toBeLessThanOrEqual(800);
  });
  it('Low quality: fewer, bigger blocks, never under 24', () => {
    expect(blockCount(8, 0.4)).toBeCloseTo(blockCount(8) * 0.4, -1);
    expect(blockCount(3, 0.1)).toBe(24);
  });
  it('sizes the blocks so the surface makes about n of them: stone as bricks, wood as long planks', () => {
    const b = blockSize(200, 200, 'stone')!;
    expect(b.course * b.length * 200).toBeCloseTo(200, 0);
    expect(b.length / b.course).toBeCloseTo(1.6, 1);
    const w = blockSize(200, 200, 'wood')!;
    expect(w.length / w.course).toBeCloseTo(3, 1);
    expect(blockSize(200, 200, 'glass')).toBeNull();
  });
});

describe('hasBlocks (review 2026-11-16: metal and glass got 200-800 Voronoi shards)', () => {
  it('stone, plaster, wood, earth, bone and crystal break into blocks; metal and glass do not', async () => {
    const { hasBlocks } = await import('./Fracture');
    for (const k of ['stone', 'plaster', 'wood', 'earth', 'bone', 'crystal']) expect(hasBlocks(k)).toBe(true);
    for (const k of ['metal', 'glass', 'nonsense']) expect(hasBlocks(k)).toBe(false);
  });
});

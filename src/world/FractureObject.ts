/**
 * A whole placed model broken into solid chunks (SolidFracture per mesh, in the model's own frame), either at once
 * (props, tests) or in a worker (buildings: a castle takes ~100–300 ms, so it is cut ahead of time as the hero comes
 * near, FractureWorker.ts). Results are cached per model id and seed: every copy of a model can break three ways.
 */
import { BufferAttribute, BufferGeometry, type InterleavedBufferAttribute, Matrix4, Quaternion, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { fractureBlocks, fractureSolid, type SolidChunk } from './SolidFracture';
import { blockSize } from './Fracture';

export interface ObjectChunk extends SolidChunk { material: Material }

export interface ObjectFracture {
  chunks: ObjectChunk[];
  adjacent: number[][];
  /** Lowest point of the model (its frame). */
  floor: number;
}

/** A mesh of the model, in the model's frame, ready to cut (or to send to the worker). */
export interface MeshJob {
  position: Float32Array;
  normal: Float32Array | null;
  uv: Float32Array | null;
  index: Uint32Array | null;
  n: number;
  material: Material;
}

/**
 * An attribute as plain floats, `size` a vertex: the optimised GLBs store positions, normals and uvs quantized
 * (normalized int16/int8) and interleaved, so the raw array is neither floats nor one attribute (read through
 * getComponent, which unpacks both).
 */
function floats(a: BufferAttribute | InterleavedBufferAttribute | undefined, size: number): Float32Array | null {
  if (!a) return null;
  const out = new Float32Array(a.count * size);
  for (let i = 0; i < a.count; i++) for (let k = 0; k < size; k++) out[i * size + k] = a.getComponent(i, k);
  return out;
}

/** The model's meshes in its own frame, with each one's share of `n` chunks. */
export function meshJobs(root: Object3D, n: number): MeshJob[] {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert();
  const meshes: Mesh[] = [];
  root.traverseVisible((o) => { if ((o as Mesh).isMesh && !(o as { isSkinnedMesh?: boolean }).isSkinnedMesh) meshes.push(o as Mesh); });
  const tris = (m: Mesh) => (m.geometry.getIndex()?.count ?? m.geometry.attributes.position.count) / 3;
  const total = meshes.reduce((s, m) => s + tris(m), 0) || 1;
  const m4 = new Matrix4();
  return meshes.map((m) => {
    // Unpacked to floats first, then moved into the model's frame (a transform written back into int16 clamps at ±1).
    const src = m.geometry;
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(floats(src.getAttribute('position'), 3)!, 3));
    const nrm = floats(src.getAttribute('normal'), 3);
    if (nrm) g.setAttribute('normal', new BufferAttribute(nrm, 3));
    g.applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
    const idx = src.getIndex();
    const job: MeshJob = {
      position: g.attributes.position.array as Float32Array,
      normal: nrm ? (g.attributes.normal.array as Float32Array) : null,
      uv: floats(src.getAttribute('uv'), 2),
      index: idx ? new Uint32Array(idx.array as ArrayLike<number>) : null,
      n: Math.max(1, Math.round((n * tris(m)) / total)),
      material: (Array.isArray(m.material) ? m.material[0] : m.material) as Material,
    };
    g.dispose();
    return job;
  });
}

function jobGeometry(j: Pick<MeshJob, 'position' | 'normal' | 'uv' | 'index'>): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(j.position, 3));
  if (j.normal) g.setAttribute('normal', new BufferAttribute(j.normal, 3));
  if (j.uv) g.setAttribute('uv', new BufferAttribute(j.uv, 2));
  if (j.index) g.setIndex(new BufferAttribute(j.index, 1));
  return g;
}

/** Plain data for one chunk (what the worker sends back). */
export interface ChunkData {
  position: Float32Array; normal: Float32Array; uv: Float32Array;
  outer: number;
  pivot: [number, number, number]; q: [number, number, number, number];
  half: [number, number, number]; radius: number; tris: number; splitTris: number; volume: number;
}

export function toData(c: SolidChunk): ChunkData {
  return {
    position: c.geometry.attributes.position.array as Float32Array,
    normal: c.geometry.attributes.normal.array as Float32Array,
    uv: c.geometry.attributes.uv.array as Float32Array,
    outer: c.geometry.groups[0].count,
    pivot: [c.pivot.x, c.pivot.y, c.pivot.z], q: [c.q.x, c.q.y, c.q.z, c.q.w],
    half: [c.half.x, c.half.y, c.half.z], radius: c.radius, tris: c.tris, splitTris: c.splitTris, volume: c.volume,
  };
}

export function fromData(d: ChunkData): SolidChunk {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(d.position, 3));
  g.setAttribute('normal', new BufferAttribute(d.normal, 3));
  g.setAttribute('uv', new BufferAttribute(d.uv, 2));
  g.addGroup(0, d.outer, 0);
  g.addGroup(d.outer, d.position.length / 3 - d.outer, 1);
  return {
    geometry: g, pivot: new Vector3(...d.pivot), q: new Quaternion(...d.q),
    half: { x: d.half[0], y: d.half[1], z: d.half[2] }, radius: d.radius, tris: d.tris, splitTris: d.splitTris, volume: d.volume,
  };
}

/** A course height and block length (model units): the mesh is cut into blocks instead of Voronoi chunks. */
export interface BlockSpec { course: number; length: number }

/** Surface area of the jobs' triangles (model units). */
export function jobsArea(jobs: Array<Pick<MeshJob, 'position' | 'index'>>): number {
  let a = 0;
  for (const j of jobs) {
    const p = j.position, idx = j.index;
    const triN = (idx ? idx.length : p.length / 3) / 3;
    for (let t = 0; t < triN; t++) {
      const i0 = (idx ? idx[t * 3] : t * 3) * 3, i1 = (idx ? idx[t * 3 + 1] : t * 3 + 1) * 3, i2 = (idx ? idx[t * 3 + 2] : t * 3 + 2) * 3;
      const ux = p[i1] - p[i0], uy = p[i1 + 1] - p[i0 + 1], uz = p[i1 + 2] - p[i0 + 2];
      const vx = p[i2] - p[i0], vy = p[i2 + 1] - p[i0 + 1], vz = p[i2 + 2] - p[i0 + 2];
      a += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
    }
  }
  return a;
}

/** The block size for `jobs` cut into about `n` blocks of `kind` (null: not a block material, Voronoi instead). */
export function blocksFor(jobs: Array<Pick<MeshJob, 'position' | 'index'>>, n: number, kind?: string): BlockSpec | null {
  return kind ? blockSize(jobsArea(jobs), n, kind) : null;
}

/** Cuts one mesh job (the worker runs this too). */
export function cutJob(j: Pick<MeshJob, 'position' | 'normal' | 'uv' | 'index' | 'n'>, seed: number, thickness: number, block?: BlockSpec | null): { chunks: SolidChunk[]; adjacent: number[][] } {
  const g = jobGeometry(j);
  const r = block ? fractureBlocks(g, { ...block, thickness }) : fractureSolid(g, j.n, { seed, thickness });
  g.dispose();
  return r;
}

/** Boxes this close count as touching (m). */
const CONTACT = 0.05;

/** A chunk's world-aligned box: [minX, minY, minZ, maxX, maxY, maxZ]. */
function worldBox(c: { pivot: Vector3; q: Quaternion; half: { x: number; y: number; z: number } }): number[] {
  const e = new Vector3(), v = new Vector3();
  for (const ax of [[c.half.x, 0, 0], [0, c.half.y, 0], [0, 0, c.half.z]]) {
    v.set(ax[0], ax[1], ax[2]).applyQuaternion(c.q);
    e.x += Math.abs(v.x); e.y += Math.abs(v.y); e.z += Math.abs(v.z);
  }
  return [c.pivot.x - e.x, c.pivot.y - e.y, c.pivot.z - e.z, c.pivot.x + e.x, c.pivot.y + e.y, c.pivot.z + e.z];
}

/** Joins the meshes' results into one fracture: indices offset, and chunks of different meshes that meet linked. */
export function assemble(parts: Array<{ chunks: SolidChunk[]; adjacent: number[][]; material: Material }>): ObjectFracture {
  const chunks: ObjectChunk[] = [];
  const adjacent: number[][] = [];
  const meshOf: number[] = [];
  parts.forEach((p, m) => {
    const off = chunks.length;
    p.chunks.forEach((c, i) => { chunks.push({ ...c, material: p.material }); adjacent.push(p.adjacent[i].map((j) => j + off)); meshOf.push(m); });
  });
  if (parts.length > 1) {
    // Chunks of different meshes that really touch (their boxes within CONTACT of each other), not ones whose middles
    // happen to be near: a guess by distance joined pieces across gaps and missed a long roof on its wall. Swept along x.
    const box = chunks.map(worldBox);
    const order = chunks.map((_, i) => i).sort((p, q) => box[p][0] - box[q][0]);
    for (let a = 0; a < order.length; a++) {
      const i = order[a], A = box[i];
      for (let b = a + 1; b < order.length; b++) {
        const j = order[b], B = box[j];
        if (B[0] > A[3] + CONTACT) break;
        if (meshOf[i] === meshOf[j]) continue;
        if (B[1] > A[4] + CONTACT || A[1] > B[4] + CONTACT || B[2] > A[5] + CONTACT || A[2] > B[5] + CONTACT) continue;
        adjacent[i].push(j); adjacent[j].push(i);
      }
    }
  }
  let floor = Infinity;
  const v = new Vector3();
  for (const c of chunks) {
    // Lowest corner of its box.
    for (let k = 0; k < 8; k++) {
      v.set(k & 1 ? c.half.x : -c.half.x, k & 2 ? c.half.y : -c.half.y, k & 4 ? c.half.z : -c.half.z).applyQuaternion(c.q).add(c.pivot);
      floor = Math.min(floor, v.y);
    }
  }
  return { chunks, adjacent, floor: Number.isFinite(floor) ? floor : 0 };
}

function hasMesh(root: Object3D): boolean {
  let found = false;
  root.traverseVisible((o) => { if ((o as Mesh).isMesh && !(o as { isSkinnedMesh?: boolean }).isSkinnedMesh) found = true; });
  return found;
}

/** Breaks `root` now (`blockKind`: into about `n` blocks of that material, when it is one that breaks in blocks). */
export function fractureNow(root: Object3D, n: number, seed: number, thickness: number, blockKind?: string): ObjectFracture {
  const jobs = meshJobs(root, n);
  const block = blocksFor(jobs, n, blockKind);
  return assemble(jobs.map((j, i) => ({ ...cutJob(j, seed + i * 101, thickness, block), material: j.material })));
}

/** Where fractures come from: at once, or from the worker (null until it is ready; asking starts it). */
export interface Fracturer {
  get(key: string, root: Object3D, n: number, seed: number, thickness: number, blockKind?: string): ObjectFracture | null;
}

/** Cuts on the spot, cached. */
export class SyncFracturer implements Fracturer {
  private readonly cache = new Map<string, ObjectFracture>();
  get(key: string, root: Object3D, n: number, seed: number, thickness: number, blockKind?: string): ObjectFracture | null {
    let f = this.cache.get(key);
    if (!f) {
      // (No meshes yet: its model is still loading. Nothing is kept, so it is cut once it has arrived.)
      if (!hasMesh(root)) return null;
      f = fractureNow(root, n, seed, thickness, blockKind);
      this.cache.set(key, f);
    }
    return f;
  }
}

/** Cuts in a worker; small things (under `syncTris` triangles) on the spot. */
export class WorkerFracturer implements Fracturer {
  private readonly cache = new Map<string, ObjectFracture>();
  private readonly waiting = new Map<string, Array<{ id: number; material: Material }>>();
  private readonly parts = new Map<string, Array<{ chunks: SolidChunk[]; adjacent: number[][]; material: Material } | undefined>>();
  private next = 1;
  private readonly jobKey = new Map<number, { key: string; slot: number }>();

  /** The worker died (failed to load or crashed): everything is cut on the main thread from now on. */
  private dead = false;
  /** Keys whose cut threw in the worker: cut on the main thread next time they are asked for. */
  private readonly local = new Set<string>();

  constructor(private readonly worker: Worker, private readonly syncTris = 4000) {
    worker.onmessage = (ev: MessageEvent<{ id: number; chunks?: ChunkData[]; adjacent?: number[][]; error?: string }>) => {
      const j = this.jobKey.get(ev.data.id);
      if (!j) return;
      this.jobKey.delete(ev.data.id);
      if (ev.data.error || !ev.data.chunks || !ev.data.adjacent) { this.forget(j.key); this.local.add(j.key); return; }
      const list = this.parts.get(j.key);
      const w = this.waiting.get(j.key);
      if (!list || !w) return;
      list[j.slot] = { chunks: ev.data.chunks.map(fromData), adjacent: ev.data.adjacent, material: w[j.slot].material };
      if (list.every(Boolean)) {
        this.cache.set(j.key, assemble(list as Array<{ chunks: SolidChunk[]; adjacent: number[][]; material: Material }>));
        this.parts.delete(j.key);
        this.waiting.delete(j.key);
      }
    };
    worker.onerror = () => {
      this.dead = true;
      for (const key of [...this.waiting.keys()]) this.forget(key);
    };
  }

  /** Drops a key's jobs in flight (their answers, if any come, are ignored). */
  private forget(key: string): void {
    for (const [id, j] of this.jobKey) if (j.key === key) this.jobKey.delete(id);
    this.waiting.delete(key);
    this.parts.delete(key);
  }

  /** True when `key` is cut or being cut. */
  has(key: string): boolean { return this.cache.has(key) || this.waiting.has(key); }

  get(key: string, root: Object3D, n: number, seed: number, thickness: number, blockKind?: string): ObjectFracture | null {
    const hit = this.cache.get(key);
    if (hit) return hit;
    if (this.waiting.has(key)) return null;
    const jobs = meshJobs(root, n);
    // (Its model still loading: ask again later.)
    if (!jobs.length) return null;
    const tris = jobs.reduce((s, j) => s + (j.index ? j.index.length : j.position.length / 3) / 3, 0);
    const block = blocksFor(jobs, n, blockKind);
    if (tris <= this.syncTris || this.dead || this.local.has(key)) {
      const f = assemble(jobs.map((j, i) => ({ ...cutJob(j, seed + i * 101, thickness, block), material: j.material })));
      this.cache.set(key, f);
      return f;
    }
    const slots: Array<{ id: number; material: Material }> = [];
    this.parts.set(key, jobs.map(() => undefined));
    jobs.forEach((j, i) => {
      const id = this.next++;
      slots.push({ id, material: j.material });
      this.jobKey.set(id, { key, slot: i });
      const msg = { id, position: j.position, normal: j.normal, uv: j.uv, index: j.index, n: j.n, seed: seed + i * 101, thickness, block };
      const transfer = [j.position.buffer, j.normal?.buffer, j.uv?.buffer, j.index?.buffer].filter(Boolean) as ArrayBuffer[];
      this.worker.postMessage(msg, transfer);
    });
    this.waiting.set(key, slots);
    return null;
  }
}

/**
 * Shattering a real model (the request of 2026-11-15: "make buildings and stuff collapsible and breakable"): the Meshy
 * shell is cut into chunks by nearest seed (a Voronoi split of its triangles by centroid), each chunk its own small
 * geometry centred on its pivot, so a building looks exactly the same until it is hit and then comes apart into its
 * own pieces. Meshy models are hollow shells, so the chunks are shells too (render them double-sided). Runs at
 * runtime on first break and is cached by the caller per model, so the build does not grow.
 */
import { BufferAttribute, BufferGeometry, Matrix4, Mesh, Vector3, type Material, type Object3D } from 'three';

export interface ChunkGeo {
  /** Non-indexed, positions relative to `pivot`. */
  geometry: BufferGeometry;
  /** Where the chunk sits in the source's frame. */
  pivot: Vector3;
  /** Farthest vertex from the pivot. */
  radius: number;
  tris: number;
}

export interface Chunk extends ChunkGeo { material: Material }

/** mulberry32. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cuts `geo` into at most `n` chunks (fewer when it has fewer triangles); the same seed cuts the same way. */
export function fractureGeometry(geo: BufferGeometry, n: number, seed = 1): ChunkGeo[] {
  const pos = geo.attributes.position;
  const index = geo.getIndex();
  const triN = (index ? index.count : pos.count) / 3;
  const vi = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  // Centroids.
  const cx = new Float32Array(triN), cy = new Float32Array(triN), cz = new Float32Array(triN);
  for (let t = 0; t < triN; t++) {
    let x = 0, y = 0, z = 0;
    for (let k = 0; k < 3; k++) { const v = vi(t, k); x += pos.getX(v); y += pos.getY(v); z += pos.getZ(v); }
    cx[t] = x / 3; cy[t] = y / 3; cz[t] = z / 3;
  }
  const k = Math.max(1, Math.min(n, triN));
  const rnd = seeded(seed);
  // Seeds on random triangles, then one Lloyd step so the chunks come out even.
  const sx = new Float32Array(k), sy = new Float32Array(k), sz = new Float32Array(k);
  for (let s = 0; s < k; s++) { const t = Math.floor(rnd() * triN); sx[s] = cx[t]; sy[s] = cy[t]; sz[s] = cz[t]; }
  const owner = new Int32Array(triN);
  const assign = () => {
    for (let t = 0; t < triN; t++) {
      let best = 0, bd = Infinity;
      for (let s = 0; s < k; s++) {
        const dx = cx[t] - sx[s], dy = cy[t] - sy[s], dz = cz[t] - sz[s];
        const d = dx * dx + dy * dy + dz * dz;
        if (d < bd) { bd = d; best = s; }
      }
      owner[t] = best;
    }
  };
  assign();
  const ax = new Float64Array(k), ay = new Float64Array(k), az = new Float64Array(k), an = new Int32Array(k);
  for (let t = 0; t < triN; t++) { const s = owner[t]; ax[s] += cx[t]; ay[s] += cy[t]; az[s] += cz[t]; an[s]++; }
  for (let s = 0; s < k; s++) if (an[s]) { sx[s] = ax[s] / an[s]; sy[s] = ay[s] / an[s]; sz[s] = az[s] / an[s]; }
  assign();

  const lists: number[][] = Array.from({ length: k }, () => []);
  for (let t = 0; t < triN; t++) lists[owner[t]].push(t);
  const names = Object.keys(geo.attributes);
  const out: ChunkGeo[] = [];
  for (const tris of lists) {
    if (!tris.length) continue;
    const pivot = new Vector3();
    for (const t of tris) pivot.x += cx[t], pivot.y += cy[t], pivot.z += cz[t];
    pivot.divideScalar(tris.length);
    const g = new BufferGeometry();
    for (const name of names) {
      const src = geo.attributes[name] as BufferAttribute;
      const size = src.itemSize;
      const arr = new Float32Array(tris.length * 3 * size);
      let o = 0;
      for (const t of tris) for (let c = 0; c < 3; c++) {
        const v = vi(t, c);
        for (let j = 0; j < size; j++) arr[o++] = src.getComponent(v, j);
      }
      g.setAttribute(name, new BufferAttribute(arr, size, src.normalized));
    }
    const p = g.attributes.position.array as Float32Array;
    let r2 = 0;
    for (let i = 0; i < p.length; i += 3) {
      p[i] -= pivot.x; p[i + 1] -= pivot.y; p[i + 2] -= pivot.z;
      r2 = Math.max(r2, p[i] * p[i] + p[i + 1] * p[i + 1] + p[i + 2] * p[i + 2]);
    }
    out.push({ geometry: g, pivot, radius: Math.sqrt(r2) || 0.05, tris: tris.length });
  }
  return out;
}

/**
 * Cuts every mesh of `root` (in root's own frame, so the chunks sit where the model was when added under root's
 * parent with root's transform), sharing the `n` chunks out by triangle count. Skinned bodies are cut by Sever.
 */
export function fractureObject(root: Object3D, n: number, seed = 1): Chunk[] {
  root.updateMatrixWorld(true);
  const inv = new Matrix4().copy(root.matrixWorld).invert();
  const meshes: Mesh[] = [];
  // (Hidden parts, like a placeholder under a loaded model, are left out with everything under them.)
  root.traverseVisible((o) => { if ((o as Mesh).isMesh && !(o as { isSkinnedMesh?: boolean }).isSkinnedMesh) meshes.push(o as Mesh); });
  const tris = (m: Mesh) => (m.geometry.getIndex()?.count ?? m.geometry.attributes.position.count) / 3;
  const total = meshes.reduce((s, m) => s + tris(m), 0) || 1;
  const out: Chunk[] = [];
  const m4 = new Matrix4();
  meshes.forEach((m, i) => {
    const share = Math.max(1, Math.round((n * tris(m)) / total));
    const g = m.geometry.clone();
    g.applyMatrix4(m4.multiplyMatrices(inv, m.matrixWorld));
    const material = (Array.isArray(m.material) ? m.material[0] : m.material) as Material;
    for (const c of fractureGeometry(g, share, seed + i * 101)) out.push({ ...c, material });
    g.dispose();
  });
  return out;
}

/** How many chunks a thing `size` metres across breaks into: props 8–20, houses 40–80, landmarks 100–150; half far. */
export function chunkCount(size: number, far = false): number {
  const pts: [number, number][] = [[0.5, 8], [1, 12], [8, 60], [50, 130], [200, 150]];
  let n = pts[pts.length - 1][1];
  if (size <= pts[0][0]) n = pts[0][1];
  else for (let i = 1; i < pts.length; i++) {
    const [s0, n0] = pts[i - 1], [s1, n1] = pts[i];
    if (size <= s1) { n = n0 + ((Math.log(size) - Math.log(s0)) / (Math.log(s1) - Math.log(s0))) * (n1 - n0); break; }
  }
  n = Math.round(n);
  return far ? Math.max(6, Math.round(n / 2)) : n;
}

/**
 * How many blocks a building `size` metres across comes apart into (v12, 2026-11-16: block by block, as in the
 * godofprompt reel): 0 under 2.5 m (props keep their Voronoi chunks), houses about 200, landmarks about 600, at most 800;
 * `scale` is the quality's share (Low: fewer, bigger blocks), never under 24.
 */
export function blockCount(size: number, scale = 1): number {
  if (size < 2.5) return 0;
  const pts: [number, number][] = [[2.5, 50], [8, 220], [20, 380], [55, 620], [200, 800]];
  let n = pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    const [s0, n0] = pts[i - 1], [s1, n1] = pts[i];
    if (size <= s1) { n = n0 + ((Math.log(size) - Math.log(s0)) / (Math.log(s1) - Math.log(s0))) * (n1 - n0); break; }
  }
  return Math.max(24, Math.round(n * scale));
}

/** Length to height of a block: stone and plaster as bricks, wood as planks; glass and metal do not break in blocks. */
const BLOCK_RATIO: Record<string, number> = { stone: 1.6, plaster: 1.6, earth: 1.6, bone: 1.6, crystal: 1.4, wood: 3 };

/** A course height and block length (source units) that cut `area` of surface into about `n` blocks; null: not blocks. */
/** True for materials that break into laid blocks (blockSize has a shape for them); metal and glass shatter. */
export function hasBlocks(kind: string): boolean { return !!BLOCK_RATIO[kind]; }

export function blockSize(area: number, n: number, kind: string): { course: number; length: number } | null {
  const r = BLOCK_RATIO[kind];
  if (!r || n <= 0 || area <= 0) return null;
  const course = Math.sqrt(area / (n * r));
  return { course, length: course * r };
}

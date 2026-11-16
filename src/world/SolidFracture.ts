/**
 * Breaking a model into solid chunks (the quality pass of 2026-11-16: "when buildings break it doesn't look
 * realistic"). The Meshy shell is cut by a Voronoi split of the surface: seeds scattered over it, denser round the
 * blow (small shards there, big slabs further off); every triangle that straddles two cells is clipped along their
 * bisector plane, so the cracks run straight instead of zig-zagging along the model's triangles. Each chunk is then
 * given thickness: an inner copy pushed in along the normals and side walls along every open edge, so a broken wall
 * shows its depth. The outside keeps the model's own material (group 0); inside and cut faces are group 1 (the break
 * material: stone, plaster, wood). Each chunk comes centred in its own fitted box frame (its box drives the physics),
 * with which chunks touch, for what holds what up.
 *
 * Pure (no DOM): it runs in a worker for big buildings (FractureWorker.ts) and in tests.
 */
import { BufferAttribute, BufferGeometry, Matrix4, Quaternion, Vector3 } from 'three';

export interface SolidChunk {
  /** Non-indexed; group 0 = outside (model material), group 1 = inside and cut faces (break material). */
  geometry: BufferGeometry;
  /** Its box's centre in the source frame. */
  pivot: Vector3;
  /** Its box's orientation in the source frame (the geometry sits in that box's frame). */
  q: Quaternion;
  half: { x: number; y: number; z: number };
  /** Farthest vertex from the pivot. */
  radius: number;
  /** Outside triangles, and how many of them were cut out of a straddling source triangle. */
  tris: number;
  splitTris: number;
  /** Box volume (m³ in source units). */
  volume: number;
}

export interface FractureOptions {
  seed?: number;
  /** Wall thickness in source units. */
  thickness: number;
  /** Where the blow landed (source frame): chunks come out smaller round it. */
  impact?: Vector3;
}

export interface SolidFracture {
  chunks: SolidChunk[];
  /** adjacent[i]: the chunks chunk i touches along a crack. */
  adjacent: number[][];
}

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

/** A vertex while clipping: position, normal, uv. */
const W = 8;

/** Cuts `geo` into about `n` solid chunks. */
export function fractureSolid(geo: BufferGeometry, n: number, o: FractureOptions): SolidFracture {
  const pos = geo.attributes.position;
  const nrm = geo.attributes.normal;
  const uv = geo.attributes.uv;
  const index = geo.getIndex();
  const vN = pos.count;
  const triN = (index ? index.count : vN) / 3;
  const vi = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);
  const rnd = seeded(o.seed ?? 1);

  // Areas, for seeds spread over the surface (not over the triangle count: Meshy packs triangles into detail).
  const area = new Float64Array(triN);
  let total = 0;
  const A = new Vector3(), B = new Vector3(), C = new Vector3();
  const bmin = new Vector3(Infinity, Infinity, Infinity), bmax = new Vector3(-Infinity, -Infinity, -Infinity);
  for (let t = 0; t < triN; t++) {
    A.fromBufferAttribute(pos, vi(t, 0)); B.fromBufferAttribute(pos, vi(t, 1)); C.fromBufferAttribute(pos, vi(t, 2));
    bmin.min(A).min(B).min(C); bmax.max(A).max(B).max(C);
    area[t] = B.sub(A).cross(C.sub(A)).length() / 2;
    total += area[t];
  }
  const diag = bmin.distanceTo(bmax) || 1;
  const cum = new Float64Array(triN);
  let acc = 0;
  for (let t = 0; t < triN; t++) { acc += area[t]; cum[t] = acc; }
  const pick = () => {
    const r = rnd() * acc;
    let lo = 0, hi = triN - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < r) lo = m + 1; else hi = m; }
    return lo;
  };
  // Seeds: random points on the surface, kept more often near the blow.
  const k = Math.max(1, Math.min(n, triN));
  const sx = new Float64Array(k), sy = new Float64Array(k), sz = new Float64Array(k);
  const spread = diag * 0.22;
  for (let s = 0, tries = 0; s < k; tries++) {
    const t = pick();
    let u = rnd(), v = rnd();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    A.fromBufferAttribute(pos, vi(t, 0)); B.fromBufferAttribute(pos, vi(t, 1)); C.fromBufferAttribute(pos, vi(t, 2));
    const px = A.x + (B.x - A.x) * u + (C.x - A.x) * v, py = A.y + (B.y - A.y) * u + (C.y - A.y) * v, pz = A.z + (B.z - A.z) * u + (C.z - A.z) * v;
    if (o.impact && tries < k * 40) {
      const d = Math.hypot(px - o.impact.x, py - o.impact.y, pz - o.impact.z) / spread;
      if (rnd() > 0.12 + 0.88 / (1 + d * d)) continue;
    }
    sx[s] = px; sy[s] = py; sz[s] = pz; s++;
  }
  const nearest = (x: number, y: number, z: number) => {
    let best = 0, bd = Infinity;
    for (let s = 0; s < k; s++) {
      const dx = x - sx[s], dy = y - sy[s], dz = z - sz[s];
      const d = dx * dx + dy * dy + dz * dz;
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  };
  const owner = new Int32Array(vN);
  for (let v = 0; v < vN; v++) owner[v] = nearest(pos.getX(v), pos.getY(v), pos.getZ(v));

  // Outside triangles per seed (flat W-float vertices), and which seeds meet along a crack.
  const outs: number[][] = Array.from({ length: k }, () => []);
  const splits = new Int32Array(k);
  const touch: Set<number>[] = Array.from({ length: k }, () => new Set());
  const vert = (v: number): number[] => [
    pos.getX(v), pos.getY(v), pos.getZ(v),
    nrm ? nrm.getX(v) : 0, nrm ? nrm.getY(v) : 0, nrm ? nrm.getZ(v) : 0,
    uv ? uv.getX(v) : 0, uv ? uv.getY(v) : 0,
  ];
  for (let t = 0; t < triN; t++) {
    const a = vi(t, 0), b = vi(t, 1), c = vi(t, 2);
    const oa = owner[a], ob = owner[b], oc = owner[c];
    if (oa === ob && ob === oc) { outs[oa].push(...vert(a), ...vert(b), ...vert(c)); continue; }
    const ids = [...new Set([oa, ob, oc])];
    const tri = [vert(a), vert(b), vert(c)];
    for (const s of ids) {
      let poly = tri;
      for (const s2 of ids) {
        if (s2 === s) continue;
        touch[s].add(s2);
        // Keep where s is nearer than s2: (s2 − s)·x < (|s2|² − |s|²)/2.
        const nx = sx[s2] - sx[s], ny = sy[s2] - sy[s], nz = sz[s2] - sz[s];
        const d = (sx[s2] ** 2 + sy[s2] ** 2 + sz[s2] ** 2 - sx[s] ** 2 - sy[s] ** 2 - sz[s] ** 2) / 2;
        poly = clip(poly, nx, ny, nz, d);
        if (poly.length < 3) break;
      }
      for (let i = 1; i + 1 < poly.length; i++) { outs[s].push(...poly[0], ...poly[i], ...poly[i + 1]); splits[s]++; }
    }
  }

  // Solids.
  const remap = new Int32Array(k).fill(-1);
  const chunks: SolidChunk[] = [];
  for (let s = 0; s < k; s++) {
    if (outs[s].length < W * 3) continue;
    remap[s] = chunks.length;
    chunks.push(solidify(outs[s], o.thickness, diag * 1e-5, splits[s]));
  }
  const adjacent: number[][] = chunks.map(() => []);
  for (let s = 0; s < k; s++) {
    if (remap[s] < 0) continue;
    for (const s2 of touch[s]) if (remap[s2] >= 0 && s2 !== s) {
      const i = remap[s], j = remap[s2];
      if (!adjacent[i].includes(j)) adjacent[i].push(j);
      if (!adjacent[j].includes(i)) adjacent[j].push(i);
    }
  }
  void total;
  return { chunks, adjacent };
}

/** Sutherland–Hodgman: the part of `poly` where n·x < d, attributes interpolated. */
function clip(poly: number[][], nx: number, ny: number, nz: number, d: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const fp = p[0] * nx + p[1] * ny + p[2] * nz - d, fq = q[0] * nx + q[1] * ny + q[2] * nz - d;
    if (fp < 0) out.push(p);
    if ((fp < 0) !== (fq < 0)) {
      const t = fp / (fp - fq);
      const m = new Array(W);
      for (let j = 0; j < W; j++) m[j] = p[j] + (q[j] - p[j]) * t;
      out.push(m);
    }
  }
  return out;
}

/**
 * Gives an outside patch (flat W-float triangles) thickness `t`, fits its box (principal axes) and returns it centred
 * in that frame.
 */
function solidify(flat: number[], t: number, eps: number, split: number): SolidChunk {
  const triN = flat.length / (W * 3);
  const vN = triN * 3;
  // Weld by position, averaging normals (a face normal where the model has none).
  const keyOf = (i: number) => `${Math.round(flat[i * W] / eps)},${Math.round(flat[i * W + 1] / eps)},${Math.round(flat[i * W + 2] / eps)}`;
  const id = new Int32Array(vN);
  const ids = new Map<string, number>();
  const nAcc: number[] = [];
  for (let i = 0; i < vN; i++) {
    const key = keyOf(i);
    let w = ids.get(key);
    if (w === undefined) { w = ids.size; ids.set(key, w); nAcc.push(0, 0, 0); }
    id[i] = w;
  }
  for (let tr = 0; tr < triN; tr++) {
    const o = tr * 3 * W;
    let nx = flat[o + 3] + flat[o + W + 3] + flat[o + 2 * W + 3];
    let ny = flat[o + 4] + flat[o + W + 4] + flat[o + 2 * W + 4];
    let nz = flat[o + 5] + flat[o + W + 5] + flat[o + 2 * W + 5];
    // Face normal (weighted by area), which also covers a model without normals.
    const ax = flat[o + W] - flat[o], ay = flat[o + W + 1] - flat[o + 1], az = flat[o + W + 2] - flat[o + 2];
    const bx = flat[o + 2 * W] - flat[o], by = flat[o + 2 * W + 1] - flat[o + 1], bz = flat[o + 2 * W + 2] - flat[o + 2];
    const fx = ay * bz - az * by, fy = az * bx - ax * bz, fz = ax * by - ay * bx;
    const fl = Math.hypot(fx, fy, fz);
    if (Math.hypot(nx, ny, nz) < 1e-6 && fl > 0) { nx = fx / fl; ny = fy / fl; nz = fz / fl; }
    else { const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l; }
    for (let c = 0; c < 3; c++) { const w = id[tr * 3 + c] * 3; nAcc[w] += nx; nAcc[w + 1] += ny; nAcc[w + 2] += nz; }
  }
  for (let w = 0; w < nAcc.length; w += 3) {
    const l = Math.hypot(nAcc[w], nAcc[w + 1], nAcc[w + 2]) || 1;
    nAcc[w] /= l; nAcc[w + 1] /= l; nAcc[w + 2] /= l;
  }
  // Open edges (used once, welded): the cracks and the model's own borders.
  const edges = new Map<string, number>();
  const ek = (a: number, b: number) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  for (let tr = 0; tr < triN; tr++) for (let e = 0; e < 3; e++) {
    const a = id[tr * 3 + e], b = id[tr * 3 + ((e + 1) % 3)];
    if (a === b) continue;
    const key = ek(a, b);
    edges.set(key, (edges.get(key) ?? 0) + 1);
  }
  // Positions of a welded vertex, outside and pushed in.
  const wp = new Float64Array(ids.size * 3);
  for (let i = 0; i < vN; i++) { const w = id[i] * 3; wp[w] = flat[i * W]; wp[w + 1] = flat[i * W + 1]; wp[w + 2] = flat[i * W + 2]; }
  const inner = (w: number, j: number) => wp[w * 3 + j] - nAcc[w * 3 + j] * t;

  const P: number[] = [], N: number[] = [], U: number[] = [];
  // Outside: the model's own surface.
  for (let i = 0; i < vN; i++) {
    P.push(flat[i * W], flat[i * W + 1], flat[i * W + 2]);
    N.push(flat[i * W + 3], flat[i * W + 4], flat[i * W + 5]);
    U.push(flat[i * W + 6], flat[i * W + 7]);
  }
  const outer = vN;
  const face = (ax: number, ay: number, az: number, bx: number, by: number, bz: number, cx: number, cy: number, cz: number) => {
    const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    P.push(ax, ay, az, bx, by, bz, cx, cy, cz);
    N.push(nx, ny, nz, nx, ny, nz, nx, ny, nz);
    U.push(0, 0, 0, 0, 0, 0);
  };
  // Inside: the same surface pushed in, wound the other way.
  for (let tr = 0; tr < triN; tr++) {
    const a = id[tr * 3], b = id[tr * 3 + 1], c = id[tr * 3 + 2];
    face(inner(a, 0), inner(a, 1), inner(a, 2), inner(c, 0), inner(c, 1), inner(c, 2), inner(b, 0), inner(b, 1), inner(b, 2));
  }
  // Side walls along every open edge (a→b as the outside triangle runs it): (a, a', b) and (b, a', b').
  for (let tr = 0; tr < triN; tr++) for (let e = 0; e < 3; e++) {
    const a = id[tr * 3 + e], b = id[tr * 3 + ((e + 1) % 3)];
    if (a === b || edges.get(ek(a, b)) !== 1) continue;
    const ax = wp[a * 3], ay = wp[a * 3 + 1], az = wp[a * 3 + 2], bx = wp[b * 3], by = wp[b * 3 + 1], bz = wp[b * 3 + 2];
    face(ax, ay, az, inner(a, 0), inner(a, 1), inner(a, 2), bx, by, bz);
    face(bx, by, bz, inner(a, 0), inner(a, 1), inner(a, 2), inner(b, 0), inner(b, 1), inner(b, 2));
  }

  // Its box: principal axes of the points, then the bounds along them.
  const axes = principalAxes(P);
  const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < P.length; i += 3) for (let j = 0; j < 3; j++) {
    const d = P[i] * axes[j * 3] + P[i + 1] * axes[j * 3 + 1] + P[i + 2] * axes[j * 3 + 2];
    lo[j] = Math.min(lo[j], d); hi[j] = Math.max(hi[j], d);
  }
  const mid = [0, 1, 2].map((j) => (lo[j] + hi[j]) / 2);
  const pivot = new Vector3(
    axes[0] * mid[0] + axes[3] * mid[1] + axes[6] * mid[2],
    axes[1] * mid[0] + axes[4] * mid[1] + axes[7] * mid[2],
    axes[2] * mid[0] + axes[5] * mid[1] + axes[8] * mid[2],
  );
  const m = new Matrix4().set(
    axes[0], axes[3], axes[6], 0,
    axes[1], axes[4], axes[7], 0,
    axes[2], axes[5], axes[8], 0,
    0, 0, 0, 1,
  );
  const q = new Quaternion().setFromRotationMatrix(m);
  // Into the box frame.
  const out = new Float32Array(P.length), outN = new Float32Array(N.length);
  let r2 = 0;
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i] - pivot.x, y = P[i + 1] - pivot.y, z = P[i + 2] - pivot.z;
    for (let j = 0; j < 3; j++) {
      out[i + j] = x * axes[j * 3] + y * axes[j * 3 + 1] + z * axes[j * 3 + 2];
      outN[i + j] = N[i] * axes[j * 3] + N[i + 1] * axes[j * 3 + 1] + N[i + 2] * axes[j * 3 + 2];
    }
    r2 = Math.max(r2, out[i] ** 2 + out[i + 1] ** 2 + out[i + 2] ** 2);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(out, 3));
  g.setAttribute('normal', new BufferAttribute(outN, 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(U), 2));
  g.addGroup(0, outer, 0);
  g.addGroup(outer, P.length / 3 - outer, 1);
  const half = { x: Math.max(1e-3, (hi[0] - lo[0]) / 2), y: Math.max(1e-3, (hi[1] - lo[1]) / 2), z: Math.max(1e-3, (hi[2] - lo[2]) / 2) };
  return { geometry: g, pivot, q, half, radius: Math.sqrt(r2) || 0.05, tris: triN, splitTris: split, volume: 8 * half.x * half.y * half.z };
}

/** Orthonormal principal axes (rows: axis 0, 1, 2) of a point cloud, right-handed (Jacobi on the covariance). */
function principalAxes(P: number[]): number[] {
  const n = P.length / 3;
  let mx = 0, my = 0, mz = 0;
  for (let i = 0; i < P.length; i += 3) { mx += P[i]; my += P[i + 1]; mz += P[i + 2]; }
  mx /= n; my /= n; mz /= n;
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < P.length; i += 3) {
    const x = P[i] - mx, y = P[i + 1] - my, z = P[i + 2] - mz;
    c[0] += x * x; c[1] += x * y; c[2] += x * z; c[4] += y * y; c[5] += y * z; c[8] += z * z;
  }
  c[3] = c[1]; c[6] = c[2]; c[7] = c[5];
  const v = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  for (let sweep = 0; sweep < 12; sweep++) {
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      const apq = c[p * 3 + q];
      if (Math.abs(apq) < 1e-12) continue;
      const th = (c[q * 3 + q] - c[p * 3 + p]) / (2 * apq);
      const tt = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
      const cs = 1 / Math.sqrt(tt * tt + 1), sn = tt * cs;
      for (let k = 0; k < 3; k++) {
        const akp = c[k * 3 + p], akq = c[k * 3 + q];
        c[k * 3 + p] = cs * akp - sn * akq; c[k * 3 + q] = sn * akp + cs * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = c[p * 3 + k], aqk = c[q * 3 + k];
        c[p * 3 + k] = cs * apk - sn * aqk; c[q * 3 + k] = sn * apk + cs * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k * 3 + p], vkq = v[k * 3 + q];
        v[k * 3 + p] = cs * vkp - sn * vkq; v[k * 3 + q] = sn * vkp + cs * vkq;
      }
    }
  }
  // Columns of v are the eigenvectors; return them as rows, made right-handed.
  const ax = [v[0], v[3], v[6], v[1], v[4], v[7], v[2], v[5], v[8]];
  const cx = ax[1] * ax[5] - ax[2] * ax[4], cy = ax[2] * ax[3] - ax[0] * ax[5], cz = ax[0] * ax[4] - ax[1] * ax[3];
  if (cx * ax[6] + cy * ax[7] + cz * ax[8] < 0) { ax[6] = -ax[6]; ax[7] = -ax[7]; ax[8] = -ax[8]; }
  return ax;
}

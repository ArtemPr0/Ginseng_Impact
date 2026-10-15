#!/usr/bin/env -S node --experimental-strip-types
/**
 * Bakes a collision height grid for every static model in public/models, so a placed building is exactly as
 * solid as it looks (no walking through walls, no invisible blocks where a model is smaller than its old box).
 *
 *   node --experimental-strip-types scripts/collider-grids.mjs        → src/data/colliderGrids.ts
 *
 * The grid lives in the model's normalised frame (the one ModelRig builds: scaled to the registry height,
 * centred on x/z, feet at y = 0, registry yaw applied), in units of the model's height, so it follows the
 * registry height and any placement scale. Each cell stores three levels (bins of BINS over the model's height):
 *   low    top of the part that stands on the ground (plinth, wall, column); 0 = nothing on the ground
 *   bottom where the overhead part starts (arch vault, eaves, floating deck); 255 = no overhead part
 *   top    highest geometry in the cell; 0 = empty cell
 * A gap of at least CLEARANCE metres separates "low" from "overhead", so a character walks under arches,
 * bridges and floating islands but not through walls.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { existsSync, writeFileSync } from 'node:fs';

const { MODELS } = await import('../src/data/models.ts');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const BINS = 128;
/** Cells along the model's longest horizontal side. */
const CELLS = 40;
const CLEARANCE = 2.1;
/** Models that move or are characters never get a grid (their colliders, if any, are written by hand). */
/** Closed buildings whose enclosed hollow insides are made solid (open halls, pavilions and arches are not listed). */
const CLOSED = new Set(['cathedral', 'castle', 'church', 'tower', 'treehouse', 'tavern', 'village-house', 'observatory', 'purple-house', 'round-tower', 'sunken-tavern', 'face-tree', 'head', 'world-tree']);
const SKIP = new Set(['knight', 'archer', 'wizard', 'staff', 'greatsword', 'causeway-segment', 'chasm-bridge', 'causeway-stairs', 'checker-road', 'stepping-stone']);

function transformPoint(m, x, y, z) {
  return [m[0] * x + m[4] * y + m[8] * z + m[12], m[1] * x + m[5] * y + m[9] * z + m[13], m[2] * x + m[6] * y + m[10] * z + m[14]];
}

async function trianglesOf(path) {
  const doc = await io.read(path);
  const root = doc.getRoot();
  if (root.listSkins().length) return null;
  const tris = [];
  for (const node of root.listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      if (!pos) continue;
      const n = pos.getCount();
      const world = new Float32Array(n * 3);
      const v = [0, 0, 0];
      for (let i = 0; i < n; i++) { pos.getElement(i, v); const w = transformPoint(m, v[0], v[1], v[2]); world[i * 3] = w[0]; world[i * 3 + 1] = w[1]; world[i * 3 + 2] = w[2]; }
      const idx = prim.getIndices()?.getArray();
      const count = idx ? idx.length : n;
      for (let i = 0; i < count; i += 3) {
        const a = idx ? idx[i] : i, b = idx ? idx[i + 1] : i + 1, c = idx ? idx[i + 2] : i + 2;
        tris.push(world[a * 3], world[a * 3 + 1], world[a * 3 + 2], world[b * 3], world[b * 3 + 1], world[b * 3 + 2], world[c * 3], world[c * 3 + 1], world[c * 3 + 2]);
      }
    }
  }
  return new Float32Array(tris);
}

function bake(id, def, raw) {
  // Normalise exactly like ModelRig: scale to height along `fit`, centre x/z, feet at 0, then the registry yaw.
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < raw.length; i += 3) {
    const x = raw[i], y = raw[i + 1], z = raw[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  const size = { x: maxX - minX, y: maxY - minY, z: maxZ - minZ };
  const H = def.height;
  const s = H / Math.max(1e-6, size[def.fit ?? 'y']);
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const yaw = def.yaw ?? 0, cy = Math.cos(yaw), sy = Math.sin(yaw);
  const pts = new Float32Array(raw.length);
  let bx0 = Infinity, bx1 = -Infinity, bz0 = Infinity, bz1 = -Infinity, yMax = 0;
  for (let i = 0; i < raw.length; i += 3) {
    const X = ((raw[i] - cx) * s) / H, Z = ((raw[i + 2] - cz) * s) / H;
    const Y = ((raw[i + 1] - minY) * s + (def.yOffset ?? 0)) / H;
    const xr = X * cy + Z * sy, zr = -X * sy + Z * cy;
    pts[i] = xr; pts[i + 1] = Y; pts[i + 2] = zr;
    if (xr < bx0) bx0 = xr; if (xr > bx1) bx1 = xr; if (zr < bz0) bz0 = zr; if (zr > bz1) bz1 = zr; if (Y > yMax) yMax = Y;
  }
  const cell = Math.max(bx1 - bx0, bz1 - bz0) / CELLS;
  const nx = Math.max(1, Math.ceil((bx1 - bx0) / cell)), nz = Math.max(1, Math.ceil((bz1 - bz0) / cell));
  const words = BINS / 32;
  const mask = new Uint32Array(nx * nz * words);
  const mark = (x, y, z) => {
    const i = Math.min(nx - 1, Math.max(0, Math.floor((x - bx0) / cell)));
    const k = Math.min(nz - 1, Math.max(0, Math.floor((z - bz0) / cell)));
    const b = Math.min(BINS - 1, Math.max(0, Math.floor((y / yMax) * BINS)));
    mask[(k * nx + i) * words + (b >> 5)] |= 1 << (b & 31);
  };
  // Sample every triangle densely enough that it touches each cell and bin it passes through.
  const spacing = Math.min(cell, yMax / BINS) * 0.7;
  for (let t = 0; t < pts.length; t += 9) {
    const ax = pts[t], ay = pts[t + 1], az = pts[t + 2], bxp = pts[t + 3], byp = pts[t + 4], bzp = pts[t + 5], cxp = pts[t + 6], cyp = pts[t + 7], czp = pts[t + 8];
    const e = Math.max(Math.hypot(bxp - ax, byp - ay, bzp - az), Math.hypot(cxp - ax, cyp - ay, czp - az), Math.hypot(cxp - bxp, cyp - byp, czp - bzp));
    const n = Math.min(160, Math.max(1, Math.ceil(e / spacing)));
    for (let i = 0; i <= n; i++) for (let j = 0; j <= n - i; j++) {
      const u = i / n, v = j / n, w = 1 - u - v;
      mark(ax * w + bxp * u + cxp * v, ay * w + byp * u + cyp * v, az * w + bzp * u + czp * v);
    }
  }
  // Solid insides: a vertical ray through each cell centre crosses a closed surface an even number of times, and
  // everything between the 1st/2nd, 3rd/4th... crossing is inside the model (a castle keep is solid, the air
  // under an arch vault is not). Cells with an odd count (an open mesh) keep only their sampled surface.
  const crossings = Array.from({ length: nx * nz }, () => []);
  for (let t = 0; t < pts.length; t += 9) {
    const ax = pts[t], ay = pts[t + 1], az = pts[t + 2], bxp = pts[t + 3], byp = pts[t + 4], bzp = pts[t + 5], cxp = pts[t + 6], cyp = pts[t + 7], czp = pts[t + 8];
    const det = (bzp - czp) * (ax - cxp) + (cxp - bxp) * (az - czp);
    if (Math.abs(det) < 1e-12) continue;
    const i0 = Math.max(0, Math.ceil((Math.min(ax, bxp, cxp) - bx0) / cell - 0.5)), i1 = Math.min(nx - 1, Math.floor((Math.max(ax, bxp, cxp) - bx0) / cell - 0.5));
    const k0 = Math.max(0, Math.ceil((Math.min(az, bzp, czp) - bz0) / cell - 0.5)), k1 = Math.min(nz - 1, Math.floor((Math.max(az, bzp, czp) - bz0) / cell - 0.5));
    for (let k = k0; k <= k1; k++) for (let i = i0; i <= i1; i++) {
      const px = bx0 + (i + 0.5) * cell, pz = bz0 + (k + 0.5) * cell;
      const l1 = ((bzp - czp) * (px - cxp) + (cxp - bxp) * (pz - czp)) / det;
      const l2 = ((czp - az) * (px - cxp) + (ax - cxp) * (pz - czp)) / det;
      const l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      crossings[k * nx + i].push(l1 * ay + l2 * byp + l3 * cyp);
    }
  }
  for (let c = 0; c < nx * nz; c++) {
    const ys = crossings[c].sort((a, b) => a - b).filter((y, i, a) => i === 0 || y - a[i - 1] > 1e-5);
    if (ys.length < 2 || ys.length % 2) continue;
    for (let p = 0; p < ys.length; p += 2) {
      const b0 = Math.max(0, Math.floor((ys[p] / yMax) * BINS)), b1 = Math.min(BINS - 1, Math.floor((ys[p + 1] / yMax) * BINS));
      for (let b = b0; b <= b1; b++) mask[c * words + (b >> 5)] |= 1 << (b & 31);
    }
  }
  const gapBins = Math.max(1, Math.ceil((CLEARANCE / H / yMax) * BINS));
  const data = new Uint8Array(nx * nz * 3);
  let solid = 0;
  for (let c = 0; c < nx * nz; c++) {
    const has = (b) => (mask[c * words + (b >> 5)] >>> (b & 31)) & 1;
    let top = -1;
    for (let b = BINS - 1; b >= 0; b--) if (has(b)) { top = b; break; }
    if (top < 0) { data[c * 3] = 0; data[c * 3 + 1] = 255; data[c * 3 + 2] = 0; continue; }
    solid++;
    // The ground part: occupied bins from the floor up, allowing gaps shorter than the clearance.
    let low = -1, b = 0, gap = 0;
    const groundBins = Math.max(1, Math.ceil((0.35 / H / yMax) * BINS));
    let started = false;
    for (b = 0; b < groundBins; b++) if (has(b)) { started = true; break; }
    let bottom = 255;
    if (started) {
      for (b = 0; b < BINS; b++) {
        if (has(b)) { low = b; gap = 0; } else if (++gap >= gapBins) break;
      }
      for (let k = low + 1; k < BINS; k++) if (has(k)) { bottom = k; break; }
    } else {
      for (let k = 0; k < BINS; k++) if (has(k)) { bottom = k; break; }
    }
    data[c * 3] = low + 1;
    data[c * 3 + 1] = bottom;
    data[c * 3 + 2] = top + 1;
  }
  // Closed buildings: any walk-under space their walls enclose (the hollow inside of a shell) is solid, so no one
  // wanders into a see-through interior. Walls are thickened by a cell for the test so door-sized gaps stay shut.
  if (CLOSED.has(id)) {
    const wall = new Uint8Array(nx * nz);
    for (let c = 0; c < nx * nz; c++) if (data[c * 3] > 0 && data[c * 3 + 1] === 255) wall[c] = 1;
    const thick = new Uint8Array(nx * nz);
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
      let w = 0;
      for (let dk = -1; dk <= 1 && !w; dk++) for (let di = -1; di <= 1 && !w; di++) { const kk = k + dk, ii = i + di; if (kk >= 0 && ii >= 0 && kk < nz && ii < nx && wall[kk * nx + ii]) w = 1; }
      thick[k * nx + i] = w;
    }
    const outside = new Uint8Array(nx * nz);
    const queue = [];
    for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) if ((k === 0 || i === 0 || k === nz - 1 || i === nx - 1) && !thick[k * nx + i]) { outside[k * nx + i] = 1; queue.push(k * nx + i); }
    while (queue.length) {
      const c = queue.pop(), k = Math.floor(c / nx), i = c % nx;
      for (const [dk, di] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kk = k + dk, ii = i + di;
        if (kk < 0 || ii < 0 || kk >= nz || ii >= nx) continue;
        const n = kk * nx + ii;
        if (!outside[n] && !thick[n]) { outside[n] = 1; queue.push(n); }
      }
    }
    for (let c = 0; c < nx * nz; c++) if (!outside[c] && data[c * 3 + 2] > 0 && data[c * 3 + 1] !== 255) { data[c * 3] = data[c * 3 + 2]; data[c * 3 + 1] = 255; }
  }
  // Trunk radius for trees: how far the bottom 6% of the model reaches from its centre.
  let trunk = 0;
  for (let i = 0; i < pts.length; i += 3) if (pts[i + 1] < 0.06) trunk = Math.max(trunk, Math.hypot(pts[i], pts[i + 2]));
  return { minX: +bx0.toFixed(5), minZ: +bz0.toFixed(5), cell: +cell.toFixed(6), nx, nz, yMax: +yMax.toFixed(5), trunk: +trunk.toFixed(4), solid, data: Buffer.from(data).toString('base64') };
}

const out = {};
const ids = Object.keys(MODELS).filter((id) => !SKIP.has(id) && existsSync(`public/models/${MODELS[id].file}`));
for (const id of ids) {
  const raw = await trianglesOf(`public/models/${MODELS[id].file}`);
  if (!raw) continue;
  out[id] = bake(id, MODELS[id], raw);
  console.log(`${id.padEnd(20)} ${out[id].nx}x${out[id].nz} cells, ${out[id].solid} solid, trunk ${(out[id].trunk * MODELS[id].height).toFixed(2)} m`);
}
const present = Object.keys(MODELS).filter((id) => existsSync(`public/models/${MODELS[id].file}`));
const body = Object.entries(out).map(([id, g]) => `  '${id}': { h: ${MODELS[id].height}, minX: ${g.minX}, minZ: ${g.minZ}, cell: ${g.cell}, nx: ${g.nx}, nz: ${g.nz}, yMax: ${g.yMax}, trunk: ${g.trunk}, data: '${g.data}' },`).join('\n');
writeFileSync('src/data/colliderGrids.ts', `/* eslint-disable */
// Generated by scripts/collider-grids.mjs from public/models and src/data/models.ts. Do not edit by hand:
// after adding a model or changing a registry height, run \`npm run colliders\`.
/** Bins of a cell level over the model's height (see scripts/collider-grids.mjs). */
export const GRID_BINS = ${BINS};
export interface ColliderGrid {
  /** Registry height the grid was baked for (clearance gaps depend on it). */
  h: number;
  minX: number; minZ: number; cell: number; nx: number; nz: number; yMax: number;
  /** Trunk radius for trees, in model heights. */
  trunk: number;
  /** base64 of [low, bottom, top] per cell, row-major (z rows of x cells). */
  data: string;
}
/** Registry ids whose GLB is in public/models (anything else renders nothing and collides with nothing). */
export const PRESENT_MODELS: ReadonlySet<string> = new Set(${JSON.stringify(present)});
export const COLLIDER_GRIDS: Record<string, ColliderGrid> = {
${body}
};
`);
console.log(`wrote ${Object.keys(out).length} grids → src/data/colliderGrids.ts`);

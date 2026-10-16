#!/usr/bin/env node
/**
 * ASCII plan slice of a GLB: marks where triangles cross a height band given as fractions of the model height.
 * Shows walls, gates and hollow insides before a building is opened for walking (scripts/collider-grids.mjs).
 *   node scripts/model-slice.mjs <file.glb> [from=0.02] [to=0.12] [cells=60]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
await MeshoptDecoder.ready;
const [file, f0 = '0.02', f1 = '0.12', N = '60'] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder });
const doc = await io.read(file);
const tris = [];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue;
  const m = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) {
    const pos = p.getAttribute('POSITION'); const idx = p.getIndices();
    const v = (i) => { const a = pos.getElement(i, []); return [m[0]*a[0]+m[4]*a[1]+m[8]*a[2]+m[12], m[1]*a[0]+m[5]*a[1]+m[9]*a[2]+m[13], m[2]*a[0]+m[6]*a[1]+m[10]*a[2]+m[14]]; };
    const n = idx ? idx.getCount() : pos.getCount();
    for (let i = 0; i < n; i += 3) tris.push([v(idx ? idx.getScalar(i) : i), v(idx ? idx.getScalar(i+1) : i+1), v(idx ? idx.getScalar(i+2) : i+2)]);
  }
}
let mn = [1e9,1e9,1e9], mx = [-1e9,-1e9,-1e9];
for (const t of tris) for (const p of t) for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); }
const H = mx[1] - mn[1], y0 = mn[1] + H * +f0, y1 = mn[1] + H * +f1;
const n = +N, sx = (mx[0]-mn[0]) / n, sz = (mx[2]-mn[2]) / n, cell = Math.max(sx, sz);
const W = Math.ceil((mx[0]-mn[0]) / cell), D = Math.ceil((mx[2]-mn[2]) / cell);
const g = Array.from({ length: D }, () => Array(W).fill(' '));
for (const t of tris) {
  const ty0 = Math.min(t[0][1], t[1][1], t[2][1]), ty1 = Math.max(t[0][1], t[1][1], t[2][1]);
  if (ty1 < y0 || ty0 > y1) continue;
  for (let s = 0; s <= 6; s++) for (let r = 0; r <= 6 - s; r++) {
    const a = s / 6, b = r / 6, c = 1 - a - b;
    const p = [0, 1, 2].map((k) => t[0][k]*a + t[1][k]*b + t[2][k]*c);
    if (p[1] < y0 || p[1] > y1) continue;
    const i = Math.min(W-1, Math.floor((p[0]-mn[0]) / cell)), j = Math.min(D-1, Math.floor((p[2]-mn[2]) / cell));
    g[j][i] = '#';
  }
}
console.log(`${file}: bbox x ${mn[0].toFixed(2)}..${mx[0].toFixed(2)} y ${mn[1].toFixed(2)}..${mx[1].toFixed(2)} z ${mn[2].toFixed(2)}..${mx[2].toFixed(2)}; slice ${f0}-${f1}; rows = z (top = -z), cols = x`);
console.log(g.map((r) => r.join('')).join('\n'));

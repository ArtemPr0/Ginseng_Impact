#!/usr/bin/env node
/**
 * Renders top (x→right, z→down), front (x→right, y→up, seen from +z) and side (z→right, y→up, seen from +x)
 * point silhouettes of a GLB to one PNG, to check orientation without a viewer.
 *   node scripts/model-silhouette.mjs <in.glb> <out.png>
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import sharp from 'sharp';
const [inPath, outPath] = process.argv.slice(2);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const doc = await io.read(inPath);
const P = [];
const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) { P.push(a[i], a[i + 1], a[i + 2]); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a[i + k]); mx[k] = Math.max(mx[k], a[i + k]); } } }
const S = 220, pad = 10, W = S * 3 + pad * 4, H = S + pad * 2 + 16;
const img = Buffer.alloc(W * H * 3, 24);
const ext = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
const views = [[0, 2, false], [0, 1, true], [2, 1, true]]; // [u axis, v axis, flip v]
views.forEach(([u, v, flip], vi) => {
  const ox = pad + vi * (S + pad), oy = pad + 16;
  const depth = new Float32Array(S * S).fill(-Infinity);
  const d = 3 - u - v; // remaining axis, nearer = larger
  for (let i = 0; i < P.length; i += 3) {
    const px = Math.floor(((P[i + u] - mn[u]) / ext) * (S - 1));
    let py = Math.floor(((P[i + v] - mn[v]) / ext) * (S - 1));
    if (flip) py = S - 1 - py;
    const z = vi === 0 ? P[i + 1] : P[i + d];
    const k = py * S + px;
    if (z > depth[k]) depth[k] = z;
  }
  const dmin = vi === 0 ? mn[1] : mn[d], dmax = vi === 0 ? mx[1] : mx[d];
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const z = depth[y * S + x]; if (z === -Infinity) continue;
    const t = (z - dmin) / Math.max(1e-6, dmax - dmin);
    const o = ((oy + y) * W + ox + x) * 3;
    img[o] = 60 + t * 180; img[o + 1] = 80 + t * 150; img[o + 2] = 140 + t * 115;
  }
});
await sharp(img, { raw: { width: W, height: H, channels: 3 } }).png().toFile(outPath);
console.log(`${outPath}: top (x→, z↓) | front from +z (x→, y↑) | side from +x (z→, y↑); brighter = higher (top) / nearer`);

#!/usr/bin/env node
/**
 * Bounding box of a GLB plus its "deck": the highest surface near the centre line of the long axis
 * (for walkways: where the player's feet go), as fractions of the height.
 *   node scripts/model-measure.mjs <file.glb>...
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const P = [];
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) { const a = p.getAttribute('POSITION').getArray(); for (let i = 0; i < a.length; i += 3) { P.push(a[i], a[i + 1], a[i + 2]); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], a[i + k]); mx[k] = Math.max(mx[k], a[i + k]); } } }
  const size = mx.map((v, k) => v - mn[k]);
  const long = size[0] >= size[2] ? 0 : 2; const across = 2 - long;
  const cA = (mn[across] + mx[across]) / 2;
  // Deck: median of the top-most vertex heights in thin slices along the long axis, near the centre line.
  const slices = 24; const tops = new Array(slices).fill(-Infinity);
  for (let i = 0; i < P.length; i += 3) {
    if (Math.abs(P[i + across] - cA) > size[across] * 0.18) continue;
    const s = Math.min(slices - 1, Math.floor(((P[i + long] - mn[long]) / size[long]) * slices));
    tops[s] = Math.max(tops[s], P[i + 1]);
  }
  const sorted = tops.filter(Number.isFinite).sort((a, b) => a - b);
  const deck = sorted[Math.floor(sorted.length / 2)];
  console.log(f.split('/').pop().padEnd(24), 'size x/y/z', size.map((v) => v.toFixed(3)).join(' / '), ' long axis', long === 0 ? 'x' : 'z', ' deck', ((deck - mn[1]) / size[1]).toFixed(3), 'of height');
}

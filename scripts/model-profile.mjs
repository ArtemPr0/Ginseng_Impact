#!/usr/bin/env node
/**
 * Height profile of a GLB along its z axis: the top surface near the centre line and at the edges, per slice, as
 * fractions of the height (walkways: where the steps, landing and parapets are). World transforms applied.
 *   node scripts/model-profile.mjs <file.glb> [centre half-width as a fraction of x, default 0.15]
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const f = process.argv[2]; const across = Number(process.argv[3] ?? 0.15);
const doc = await io.read(f);
const P = []; const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
for (const node of doc.getRoot().listNodes()) {
  const mesh = node.getMesh(); if (!mesh) continue; const M = node.getWorldMatrix();
  for (const p of mesh.listPrimitives()) { const a = p.getAttribute('POSITION').getArray();
    for (let i = 0; i < a.length; i += 3) { const x = a[i], y = a[i + 1], z = a[i + 2];
      const v = [M[0] * x + M[4] * y + M[8] * z + M[12], M[1] * x + M[5] * y + M[9] * z + M[13], M[2] * x + M[6] * y + M[10] * z + M[14]];
      P.push(...v); for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], v[k]); mx[k] = Math.max(mx[k], v[k]); } } } }
const size = mx.map((v, k) => v - mn[k]); console.log('size', size.map((v) => v.toFixed(3)).join(' '), 'min', mn.map((v) => v.toFixed(3)).join(' '));
const cx = (mn[0] + mx[0]) / 2; const slices = 30; const tops = new Array(slices).fill(-Infinity); const edge = new Array(slices).fill(-Infinity);
for (let i = 0; i < P.length; i += 3) { const s = Math.min(slices - 1, Math.floor(((P[i + 2] - mn[2]) / size[2]) * slices));
  if (Math.abs(P[i] - cx) < size[0] * across) tops[s] = Math.max(tops[s], P[i + 1]); else edge[s] = Math.max(edge[s], P[i + 1]); }
for (let s = 0; s < slices; s++) console.log(((s + 0.5) / slices).toFixed(3), 'centre', ((tops[s] - mn[1]) / size[1]).toFixed(3), 'edges', ((edge[s] - mn[1]) / size[1]).toFixed(3));

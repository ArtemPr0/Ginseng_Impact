#!/usr/bin/env node
/**
 * Which way does a model face? Prints, per GLB, the toe-minus-foot direction of the bind pose (bipeds) and the
 * offset of the lowest 6% of vertices (the feet, whose toes point forward) from the model centre.
 * Usage: node scripts/model-facing.mjs public/models/*.glb
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const dir = (v) => { const [x, , z] = v; if (Math.abs(x) < 1e-6 && Math.abs(z) < 1e-6) return '?'; return Math.abs(x) > Math.abs(z) ? (x > 0 ? '+X' : '-X') : (z > 0 ? '+Z' : '-Z'); };
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const root = doc.getRoot();
  const pick = (re) => root.listNodes().find((n) => re.test(n.getName()));
  const foot = pick(/left.?foot|foot[_.]?l\b|lfoot|l_foot/i), toe = pick(/left.?toe|toe[_.]?l\b|ltoe|l_toe/i);
  let bones = '-';
  if (foot && toe) { const a = foot.getWorldTranslation(), b = toe.getWorldTranslation(); const v = [b[0] - a[0], 0, b[2] - a[2]]; bones = `${dir(v)} (${v.map((x) => x.toFixed(3)).join(',')})`; }
  let minY = 1e9, maxY = -1e9; const pos = [];
  for (const m of root.listMeshes()) for (const p of m.listPrimitives()) { const arr = p.getAttribute('POSITION').getArray(); for (let i = 0; i < arr.length; i += 3) { pos.push(arr[i], arr[i + 1], arr[i + 2]); if (arr[i + 1] < minY) minY = arr[i + 1]; if (arr[i + 1] > maxY) maxY = arr[i + 1]; } }
  const h = maxY - minY; let cx = 0, cz = 0, n = 0, fx = 0, fz = 0, fn = 0;
  for (let i = 0; i < pos.length; i += 3) { cx += pos[i]; cz += pos[i + 2]; n++; if (pos[i + 1] < minY + h * 0.06) { fx += pos[i]; fz += pos[i + 2]; fn++; } }
  const v = [fx / fn - cx / n, 0, fz / fn - cz / n];
  console.log(f.split('/').pop().padEnd(26), 'toes:', bones.padEnd(28), 'feet-offset:', dir(v), v.map((x) => x.toFixed(3)).join(','));
}

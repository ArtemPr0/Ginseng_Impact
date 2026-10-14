#!/usr/bin/env node
/**
 * Model pipeline helpers for Meshy exports (GLB).
 *
 *   node scripts/model-tools.mjs info <in.glb>
 *   node scripts/model-tools.mjs optimize <in.glb> <out.glb> [maxTextureSize=1024] [targetTriangles]
 *       Converts textures to WebP (≤ maxTextureSize), dedups and prunes. 20 MB → ~1–2 MB. With a triangle
 *       target it also simplifies the mesh (meshoptimizer), e.g. 30000 for a prop, 80000 for a landmark.
 *   node scripts/model-tools.mjs strip-floaters <in.glb> <out.glb> [aboveFraction=0.45]
 *       Deletes mesh islands that float entirely above that fraction of the model's height (Meshy likes to add a
 *       moon sphere over buildings and stairs).
 *   node scripts/model-tools.mjs clip <in.glb> <out.glb>
 *       Keeps only the node hierarchy and animations (drops meshes, skins, materials, textures), so one
 *       animation export becomes a ~100 KB file the game layers onto the base model (see models.ts clipFiles).
 *   node scripts/model-tools.mjs import <downloaded.glb> <name> [clipKey]
 *       Convenience: with a clipKey writes public/models/<name>-<clipKey>.glb (clip only), otherwise
 *       public/models/<name>.glb (optimized).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [cmd, a, b, c, d] = process.argv.slice(2);

function mb(path) {
  return (statSync(path).size / 1048576).toFixed(2) + ' MB';
}

async function info(path) {
  const doc = await io.read(path);
  const root = doc.getRoot();
  const tris = root.listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  console.log(`${path}: ${mb(path)}`);
  console.log(`  meshes ${root.listMeshes().length}, triangles ${Math.round(tris)}, nodes ${root.listNodes().length}, skins ${root.listSkins().length}`);
  console.log(`  animations: ${root.listAnimations().map((x) => `${x.getName() || '(unnamed)'} (${x.listChannels().length} ch)`).join(', ') || 'none'}`);
  console.log(`  textures: ${root.listTextures().map((t) => `${t.getName() || '?'} ${t.getMimeType()} ${(t.getImage()?.byteLength / 1048576).toFixed(2)} MB`).join(', ') || 'none'}`);
}

async function optimize(inPath, outPath, maxSize = 1024, targetTris = 0) {
  const doc = await io.read(inPath);
  const tris = doc.getRoot().listMeshes().reduce((n, m) => n + m.listPrimitives().reduce((k, p) => k + (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3, 0), 0);
  const steps = [dedup()];
  if (targetTris > 0 && tris > targetTris * 1.15) {
    await MeshoptSimplifier.ready;
    steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: targetTris / tris, error: 0.002 }));
    console.log(`simplify ${Math.round(tris)} → ~${targetTris} triangles`);
  }
  steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxSize, maxSize], quality: 82 }), prune());
  await doc.transform(...steps);
  await io.write(outPath, doc);
  console.log(`optimized ${inPath} (${mb(inPath)}) → ${outPath} (${mb(outPath)})`);
}

async function stripFloaters(inPath, outPath, above = 0.45) {
  const doc = await io.read(inPath);
  let dropped = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const pos = prim.getAttribute('POSITION').getArray();
    const idxAcc = prim.getIndices();
    if (!idxAcc) continue;
    const idx = idxAcc.getArray();
    const n = pos.length / 3;
    // Union vertices that share a triangle or sit at the same position (UV seams split vertices).
    const parent = new Int32Array(n).map((_, i) => i);
    const find = (a) => { while (parent[a] !== a) { parent[a] = parent[parent[a]]; a = parent[a]; } return a; };
    const unite = (a, b) => { a = find(a); b = find(b); if (a !== b) parent[a] = b; };
    for (let t = 0; t < idx.length; t += 3) { unite(idx[t], idx[t + 1]); unite(idx[t], idx[t + 2]); }
    const seen = new Map();
    for (let i = 0; i < n; i++) { const k = `${Math.round(pos[i * 3] * 1e4)},${Math.round(pos[i * 3 + 1] * 1e4)},${Math.round(pos[i * 3 + 2] * 1e4)}`; const j = seen.get(k); if (j === undefined) seen.set(k, i); else unite(i, j); }
    let minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < n; i++) { minY = Math.min(minY, pos[i * 3 + 1]); maxY = Math.max(maxY, pos[i * 3 + 1]); }
    const lowest = new Map();
    for (let i = 0; i < n; i++) { const r = find(i); const y = pos[i * 3 + 1]; if (!lowest.has(r) || y < lowest.get(r)) lowest.set(r, y); }
    const cut = minY + (maxY - minY) * above;
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) { if (lowest.get(find(idx[t])) > cut) { dropped++; continue; } keep.push(idx[t], idx[t + 1], idx[t + 2]); }
    idxAcc.setArray(new Uint32Array(keep));
  }
  await doc.transform(prune());
  await io.write(outPath, doc);
  console.log(`strip-floaters ${inPath}: dropped ${dropped} floating triangles → ${outPath}`);
}

async function clip(inPath, outPath) {
  const doc = await io.read(inPath);
  const root = doc.getRoot();
  if (root.listAnimations().length === 0) throw new Error(`${inPath} has no animations`);
  for (const n of root.listNodes()) { n.setMesh(null); n.setSkin(null); }
  for (const m of root.listMeshes()) m.dispose();
  for (const s of root.listSkins()) s.dispose();
  for (const m of root.listMaterials()) m.dispose();
  for (const t of root.listTextures()) t.dispose();
  await doc.transform(resample(), prune({ keepLeaves: true, keepAttributes: false }));
  await io.write(outPath, doc);
  console.log(`clip ${inPath} (${mb(inPath)}) → ${outPath} (${mb(outPath)}): ${root.listAnimations().map((x) => x.getName()).join(', ')}`);
}

async function main() {
  if (cmd === 'info') return info(a);
  if (cmd === 'optimize') return optimize(a, b, c ? Number(c) : 1024, d ? Number(d) : 0);
  if (cmd === 'strip-floaters') return stripFloaters(a, b, c ? Number(c) : 0.45);
  if (cmd === 'clip') return clip(a, b);
  if (cmd === 'import') {
    const name = b;
    if (c) return clip(a, resolve('public/models', `${name}-${c}.glb`));
    return optimize(a, resolve('public/models', `${name}.glb`));
  }
  console.error('usage: model-tools.mjs info|optimize|clip|import ...');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

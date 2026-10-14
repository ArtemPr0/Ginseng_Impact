#!/usr/bin/env node
/**
 * Model pipeline helpers for Meshy exports (GLB).
 *
 *   node scripts/model-tools.mjs info <in.glb>
 *   node scripts/model-tools.mjs optimize <in.glb> <out.glb> [maxTextureSize=1024]
 *       Converts textures to WebP (≤ maxTextureSize), dedups and prunes. 20 MB → ~1–2 MB.
 *   node scripts/model-tools.mjs clip <in.glb> <out.glb>
 *       Keeps only the node hierarchy and animations (drops meshes, skins, materials, textures), so one
 *       animation export becomes a ~100 KB file the game layers onto the base model (see models.ts clipFiles).
 *   node scripts/model-tools.mjs import <downloaded.glb> <name> [clipKey]
 *       Convenience: with a clipKey writes public/models/<name>-<clipKey>.glb (clip only), otherwise
 *       public/models/<name>.glb (optimized).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, resample, textureCompress } from '@gltf-transform/functions';
import sharp from 'sharp';
import { statSync } from 'node:fs';
import { resolve } from 'node:path';

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const [cmd, a, b, c] = process.argv.slice(2);

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

async function optimize(inPath, outPath, maxSize = 1024) {
  const doc = await io.read(inPath);
  await doc.transform(
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxSize, maxSize], quality: 82 }),
    prune(),
  );
  await io.write(outPath, doc);
  console.log(`optimized ${inPath} (${mb(inPath)}) → ${outPath} (${mb(outPath)})`);
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
  if (cmd === 'optimize') return optimize(a, b, c ? Number(c) : 1024);
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

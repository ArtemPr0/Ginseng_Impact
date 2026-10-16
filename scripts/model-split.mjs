#!/usr/bin/env node
/**
 * Connected pieces of a Meshy export (vertices welded by position): list them, keep only some, cut away everything
 * below a height, or split a set into separate files (a row of gravestones → one GLB each).
 *   node scripts/model-split.mjs list <in.glb>
 *   node scripts/model-split.mjs keep <in.glb> <out.glb> [--largest] [--below <fraction of height>] [--box x0,x1,z0,z1 (fractions)]
 *        [--column x0,x1,z0,z1,top]: under `top` keep only what is inside that column (a figure's legs rising out of
 *        a scenery base Meshy invented around them)
 *   node scripts/model-split.mjs split <in.glb> <out-prefix> [minTriangles=2000]
 *   node scripts/model-split.mjs plain <in.glb> <out.glb> [triangles=60000] [texture=1024]   (a plain GLB with JPEG
 *        textures and no compression extensions, small enough to upload back to Meshy for rigging)
 * Fractions are of the model's bounding box (0 = min, 1 = max). Positions are read through the node transforms.
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, prune, simplify, textureCompress, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
process.chdir(fileURLToPath(new URL('..', import.meta.url)));

await MeshoptDecoder.ready;
await MeshoptEncoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'meshopt.encoder': MeshoptEncoder });
const [cmd, input, output, ...rest] = process.argv.slice(2);
const flag = (name) => { const i = rest.indexOf(name); return i < 0 ? null : rest[i + 1] ?? true; };

/** Every primitive's triangles grouped into welded connected components, with world-space bounds. */
function analyse(doc) {
  const prims = [];
  const mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const m = node.getWorldMatrix();
    for (const prim of mesh.listPrimitives()) {
      const pos = prim.getAttribute('POSITION');
      const n = pos.getCount();
      const world = new Float32Array(n * 3);
      const a = [0, 0, 0];
      for (let i = 0; i < n; i++) {
        pos.getElement(i, a);
        const x = m[0] * a[0] + m[4] * a[1] + m[8] * a[2] + m[12], y = m[1] * a[0] + m[5] * a[1] + m[9] * a[2] + m[13], z = m[2] * a[0] + m[6] * a[1] + m[10] * a[2] + m[14];
        world[i * 3] = x; world[i * 3 + 1] = y; world[i * 3 + 2] = z;
        mn[0] = Math.min(mn[0], x); mn[1] = Math.min(mn[1], y); mn[2] = Math.min(mn[2], z);
        mx[0] = Math.max(mx[0], x); mx[1] = Math.max(mx[1], y); mx[2] = Math.max(mx[2], z);
      }
      const idx = prim.getIndices();
      const tri = idx ? Array.from(idx.getArray()) : Array.from({ length: n }, (_, i) => i);
      prims.push({ prim, world, tri });
    }
  }
  const size = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]);
  const q = size / 20000;
  for (const p of prims) {
    // Weld by quantised position, then union triangles that share a welded vertex.
    const key = new Map();
    const weld = new Int32Array(p.world.length / 3);
    for (let i = 0; i < weld.length; i++) {
      const k = `${Math.round(p.world[i * 3] / q)},${Math.round(p.world[i * 3 + 1] / q)},${Math.round(p.world[i * 3 + 2] / q)}`;
      let id = key.get(k); if (id === undefined) key.set(k, (id = key.size)); weld[i] = id;
    }
    const parent = new Int32Array(key.size).map((_, i) => i);
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let t = 0; t < p.tri.length; t += 3) {
      const a = find(weld[p.tri[t]]), b = find(weld[p.tri[t + 1]]), c = find(weld[p.tri[t + 2]]);
      parent[b] = a; parent[find(c)] = a;
    }
    const comps = new Map();
    for (let t = 0; t < p.tri.length; t += 3) {
      const r = find(weld[p.tri[t]]);
      let c = comps.get(r);
      if (!c) comps.set(r, (c = { tris: [], mn: [Infinity, Infinity, Infinity], mx: [-Infinity, -Infinity, -Infinity] }));
      c.tris.push(t);
      for (let k = 0; k < 3; k++) for (let d = 0; d < 3; d++) { const v = p.world[p.tri[t + k] * 3 + d]; c.mn[d] = Math.min(c.mn[d], v); c.mx[d] = Math.max(c.mx[d], v); }
    }
    p.comps = [...comps.values()].sort((a, b) => b.tris.length - a.tris.length);
  }
  return { prims, mn, mx };
}

const frac = (v, d, mn, mx) => (v - mn[d]) / Math.max(1e-9, mx[d] - mn[d]);

function keepTriangles(p, keepTri) {
  const out = [];
  for (let t = 0; t < p.tri.length; t += 3) if (keepTri(t)) out.push(p.tri[t], p.tri[t + 1], p.tri[t + 2]);
  const idx = p.prim.getIndices();
  if (idx) idx.setArray(new Uint32Array(out));
  compactPrimitive(p.prim);
  return out.length / 3;
}

const doc = await io.read(input);
const { prims, mn, mx } = analyse(doc);
if (cmd === 'list') {
  for (const p of prims) {
    console.log(`primitive: ${p.tri.length / 3} triangles, ${p.comps.length} pieces`);
    for (const c of p.comps.slice(0, 25)) {
      const f = (d) => `${frac(c.mn[d], d, mn, mx).toFixed(2)}..${frac(c.mx[d], d, mn, mx).toFixed(2)}`;
      console.log(`  ${String(c.tris.length).padStart(7)} tris  x ${f(0)}  y ${f(1)}  z ${f(2)}`);
    }
  }
} else if (cmd === 'keep') {
  const below = flag('--below') !== null ? Number(flag('--below')) : null;
  const box = flag('--box') ? String(flag('--box')).split(',').map(Number) : null;
  const largest = rest.includes('--largest');
  // (Repeatable: each column rule applies under its own height.)
  const columns = rest.flatMap((v, i) => (rest[i - 1] === '--column' ? [String(v).split(',').map(Number)] : []));
  for (const p of prims) {
    const keepComp = new Set(largest ? [p.comps[0]] : p.comps);
    const compOf = new Map();
    for (const c of p.comps) for (const t of c.tris) compOf.set(t, c);
    const n = keepTriangles(p, (t) => {
      if (!keepComp.has(compOf.get(t))) return false;
      for (let k = 0; k < 3; k++) {
        const v = p.tri[t + k] * 3;
        const fy = frac(p.world[v + 1], 1, mn, mx);
        if (below !== null && fy < below) return false;
        const fx = frac(p.world[v], 0, mn, mx), fz = frac(p.world[v + 2], 2, mn, mx);
        if (box && (fx < box[0] || fx > box[1] || fz < box[2] || fz > box[3])) return false;
        for (const c of columns) if (fy < c[4] && (fx < c[0] || fx > c[1] || fz < c[2] || fz > c[3])) return false;
      }
      return true;
    });
    console.log(`kept ${n} triangles`);
  }
  await doc.transform(prune());
  await io.write(output, doc);
} else if (cmd === 'split') {
  const min = Number(output && rest[0] ? rest[0] : 2000);
  const prefix = output;
  const pieces = prims[0].comps.filter((c) => c.tris.length >= min).sort((a, b) => a.mn[0] - b.mn[0]);
  for (let i = 0; i < pieces.length; i++) {
    const d2 = await io.read(input);
    const { prims: p2 } = analyse(d2);
    const keep = new Set(p2[0].comps.filter((c) => c.tris.length >= min).sort((a, b) => a.mn[0] - b.mn[0])[i].tris);
    keepTriangles(p2[0], (t) => keep.has(t));
    await d2.transform(prune());
    await io.write(`${prefix}-${i + 1}.glb`, d2);
    console.log(`wrote ${prefix}-${i + 1}.glb (${keep.size} triangles)`);
  }
} else if (cmd === 'plain') {
  const want = Number(rest[0] ?? 60000);
  const tex = Number(rest[1] ?? 1024);
  const tris = prims.reduce((n, p) => n + p.tri.length / 3, 0);
  await MeshoptSimplifier.ready;
  await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: Math.min(1, want / tris), error: 0.01 }),
    textureCompress({ encoder: sharp, targetFormat: 'jpeg', resize: [tex, tex], quality: 85 }), prune());
  for (const ext of doc.getRoot().listExtensionsUsed()) if (/meshopt|draco|webp|quantiz/i.test(ext.extensionName)) ext.dispose();
  await new NodeIO().registerExtensions(ALL_EXTENSIONS).write(output, doc);
  console.log(`plain ${output}`);
} else {
  console.error('usage: model-split.mjs list|keep|split|plain …');
  process.exit(2);
}

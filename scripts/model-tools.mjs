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
 *   node scripts/model-tools.mjs strip-skin <in.glb> <out.glb>
 *       Drops JOINTS_1+/WEIGHTS_1+ (Meshy rigs store 12 influences; three.js skins with the first 4 but uploads all).
 *   node scripts/model-tools.mjs fix-limb-skin <in.glb> <out.glb> [--dry]
 *       Meshy's auto-skin gives hands that hang beside the thighs (yeti claws, troll knuckles) some leg weight, and
 *       thighs some hand weight, so they smear into streaks whenever arms and legs move apart. For every vertex this
 *       keeps only the dominant limb group (an arm, or a leg) when both pull on it, and renormalises.
 *   node scripts/model-tools.mjs fix-skin-branches <in.glb> <out.glb> [--dry]
 *       Keeps each vertex on the limb its strongest bone belongs to: a forearm/hand/shin/foot vertex loses every
 *       influence outside its own limb (a claw pulled by the spine fans into a sheet when the arm swings); an upper
 *       arm/thigh vertex may still blend with the torso; a torso vertex may blend with upper limbs but not hands/feet.
 *   node scripts/model-tools.mjs cut-fused-limbs <in.glb> <out.glb> [--dry]
 *       Meshy sometimes generates hands welded to the thighs (claws resting on fur): triangles joining a hand to
 *       anything outside its arm, or an arm to a leg, stretch into fans and streaks as soon as the limbs move. Those
 *       triangles are deleted (robes spanning both legs are left alone).
 *   node scripts/model-tools.mjs fix-arm-flank <in.glb> <out.glb> [--dry]
 *       A body whose arms hang against its sides in the bind pose (the yeti) gets flank fur weighted to the upper
 *       arms, so raising an arm drags a sheet of torso up with it. Every vertex an arm pulls on that lies nearer the
 *       spine (hips→neck) than that arm's bone (shoulder→elbow), in bind pose, gives its arm weight to the spine
 *       bone at its height.
 *   node scripts/model-tools.mjs cut-triangles <in.glb> <out.glb> <triangles.json>
 *       Deletes the listed triangles (indices into the first primitive, as the game loads it): the webs a stretch
 *       survey in the running game finds between limbs that the mesh fused (see .claude/skills/verify).
 *   node scripts/model-tools.mjs rebind-nearest <in.glb> <out.glb> [keepBonesRegex]
 *       Re-skins every vertex to the nearest bones of the body's real skeleton (by default the mixamorig bones, not
 *       Meshy's extra Bone_NNN chains and _End leaves): distance to each bone's segment (its joint to its child's) in
 *       bind pose, the two nearest blended. For an auto-rig gone wrong (the grave cyclops' tail bound to a toe, its
 *       foot claws to chains hanging off the forearms: spikes shot across the screen as it moved).
 *   node scripts/model-tools.mjs fix-misbound <in.glb> <out.glb> [ratio=2.5]
 *       A vertex skinned mostly to one limb while it sits on another (in bind pose its own bone is `ratio` times farther
 *       than the nearest bone, of another limb or the body) goes wholly to the bone it sits on: thigh fur under a
 *       yeti's resting claws flew off with the hand as a sheet. Smooth after it (smooth-skin).
 *   node scripts/model-tools.mjs drop-islands <in.glb> <out.glb> [minTris=12]
 *       Deletes pieces of the mesh smaller than minTris triangles (UV seams welded) and the fringe along a cut
 *       (triangles hanging by one edge or a corner): the slivers cutting a fused limb free leaves dangling.
 *   node scripts/model-tools.mjs fill-holes <in.glb> <out.glb> [maxRim=400]
 *       Closes every hole in the surface (a rim of edges used by one triangle) with a fan to a centre vertex that
 *       averages the rim (its colour, normal and skin): a forearm cut free of the flank it lay against is a half shell
 *       that reads as a flat plank, and the flank has a window in it.
 *   node scripts/model-tools.mjs smooth-skin <in.glb> <out.glb> [passes=3] [triangles.json]
 *       Smooths the skin weights over the mesh (each pass: half a vertex's own, half its neighbours' average; UV seams
 *       welded so both halves agree). For weights that jump from vertex to vertex (an auto-rig or rebind-nearest
 *       leaves a loincloth half on one thigh, half on the other: it fans into a sheet when the legs part). With a
 *       triangle list (a stretch survey's) only those and two rings round them change.
 *   node scripts/model-tools.mjs clip <in.glb> <out.glb> [nameRegex] [--rot-only]
 *       Keeps only the node hierarchy and animations (drops meshes, skins, materials, textures), so one
 *       animation export becomes a ~100 KB file the game layers onto the base model (see models.ts clipFiles).
 *       With a name pattern only the matching clips stay; --rot-only drops translation and scale tracks (a clip
 *       borrowed from another Meshy rig of the same skeleton: its root motion and bone lengths are not the target's).
 *   node scripts/model-tools.mjs import <downloaded.glb> <name> [clipKey]
 *       Convenience: with a clipKey writes public/models/<name>-<clipKey>.glb (clip only), otherwise
 *       public/models/<name>.glb (optimized).
 */
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { compactPrimitive, dedup, prune, resample, simplify, textureCompress, weld } from '@gltf-transform/functions';
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
    // Untextured Meshy drafts arrive as triangle soup with per-face normals, which blocks welding: drop the
    // normals first; the game recomputes smooth ones on load (ModelRig) for files without NORMAL.
    let soup = false;
    for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
      const n = prim.getAttribute('POSITION').getCount();
      const idx = prim.getIndices()?.getCount() ?? n;
      if (n >= idx * 0.9 && !prim.getAttribute('TEXCOORD_0')) { prim.setAttribute('NORMAL', null); soup = true; }
    }
    steps.push(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: targetTris / tris, error: Number(process.env.SIMPLIFY_ERROR ?? 0.002) }));
    console.log(`simplify ${Math.round(tris)} → ~${targetTris} triangles${soup ? ' (welded triangle soup)' : ''}`);
  }
  steps.push(textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [maxSize, maxSize], quality: 82 }), prune());
  await doc.transform(...steps);
  // Texture seams stop the normal simplifier well short of small targets (a pine stalls at ~7k). For instanced
  // flora that is fine to fix with meshoptimizer's sloppy mode, which ignores topology.
  if (targetTris > 0) {
    const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives()).filter((p) => p.getIndices());
    const total = prims.reduce((n, p) => n + p.getIndices().getCount() / 3, 0);
    if (total > targetTris * 1.3) {
      await MeshoptSimplifier.ready;
      for (const prim of prims) {
        const idx = prim.getIndices();
        const want = Math.max(12, Math.round((targetTris * (idx.getCount() / 3)) / total)) * 3;
        const pos = Float32Array.from(prim.getAttribute('POSITION').getArray());
        const [out, err] = MeshoptSimplifier.simplifySloppy(Uint32Array.from(idx.getArray()), pos, 3, null, want, Number(process.env.SLOPPY_ERROR ?? 0.05));
        idx.setArray(out);
        compactPrimitive(prim);
        console.log(`sloppy ${idx.getCount() === out.length ? '' : ''}→ ${out.length / 3} triangles (error ${err.toFixed(4)})`);
      }
      await doc.transform(prune());
    }
  }
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

async function stripSkin(inPath, outPath) {
  const doc = await io.read(inPath);
  let dropped = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    for (const sem of prim.listSemantics()) if (/^(JOINTS|WEIGHTS)_[1-9]$/.test(sem)) { prim.setAttribute(sem, null); dropped++; }
  }
  await doc.transform(prune());
  await io.write(outPath, doc);
  console.log(`strip-skin ${inPath}: dropped ${dropped} extra influence attributes → ${outPath} (${mb(outPath)})`);
}

/** Which limb a joint belongs to: 'armL' | 'armR' | 'legL' | 'legR' | null (spine, head, extra bones). */
function limbOf(name) {
  const n = name.toLowerCase();
  const side = /left/.test(n) ? 'L' : /right/.test(n) ? 'R' : '';
  if (!side) return null;
  if (/shoulder|arm|hand|thumb|index|middle|ring|pinky/.test(n)) return 'arm' + side;
  if (/upleg|leg|foot|toe/.test(n)) return 'leg' + side;
  return null;
}

async function fixLimbSkin(inPath, outPath, dry) {
  const doc = await io.read(inPath);
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) { console.log(`${inPath}: no skin`); return; }
  const limbs = skin.listJoints().map((j) => limbOf(j.getName() ?? ''));
  let fixed = 0, total = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0');
    const W = prim.getAttribute('WEIGHTS_0');
    if (!J || !W) continue;
    const j = [0, 0, 0, 0];
    const w = [0, 0, 0, 0];
    for (let i = 0; i < J.getCount(); i++) {
      total++;
      J.getElement(i, j);
      W.getElement(i, w);
      const sum = { arm: 0, leg: 0 };
      for (let k = 0; k < 4; k++) { const l = limbs[j[k]]; if (l && w[k] > 0) sum[l.slice(0, 3)] += w[k]; }
      if (sum.arm <= 0.002 || sum.leg <= 0.002) continue;
      const drop = sum.arm >= sum.leg ? 'leg' : 'arm';
      let kept = 0;
      for (let k = 0; k < 4; k++) { const l = limbs[j[k]]; if (l && l.startsWith(drop)) w[k] = 0; kept += w[k]; }
      if (kept <= 1e-6) continue;
      for (let k = 0; k < 4; k++) w[k] /= kept;
      W.setElement(i, w);
      fixed++;
    }
  }
  console.log(`fix-limb-skin ${inPath}: ${fixed} of ${total} vertices had both arm and leg weights${dry ? ' (dry run)' : ''}`);
  if (dry) return;
  await io.write(outPath, doc);
}

/** Branch and level of a Mixamo-style joint: limb ('armL'…'legR') or 'core', and whether it is distal. */
function branchOf(name) {
  const n = name.toLowerCase();
  const limb = limbOf(name);
  if (!limb) return { branch: 'core', distal: false };
  const distal = limb.startsWith('arm') ? /forearm|hand|thumb|index|middle|ring|pinky/.test(n) : /(^|:|_)(left|right)leg$|foot|toe/.test(n) || (/leg/.test(n) && !/upleg/.test(n));
  return { branch: limb, distal };
}

async function fixSkinBranches(inPath, outPath, dry) {
  const doc = await io.read(inPath);
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) { console.log(`${inPath}: no skin`); return; }
  const info = skin.listJoints().map((jn) => branchOf(jn.getName() ?? ''));
  let fixed = 0, total = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0');
    const W = prim.getAttribute('WEIGHTS_0');
    if (!J || !W) continue;
    const j = [0, 0, 0, 0];
    const w = [0, 0, 0, 0];
    for (let i = 0; i < J.getCount(); i++) {
      total++;
      J.getElement(i, j);
      W.getElement(i, w);
      let top = 0;
      for (let k = 1; k < 4; k++) if (w[k] > w[top]) top = k;
      const t = info[j[top]];
      let changed = false, kept = 0;
      for (let k = 0; k < 4; k++) {
        if (w[k] <= 0) continue;
        const o = info[j[k]];
        const allowed = t.branch === 'core' ? !o.distal : t.distal ? o.branch === t.branch : o.branch === t.branch || o.branch === 'core';
        if (!allowed) { w[k] = 0; changed = true; }
        kept += w[k];
      }
      if (!changed || kept <= 1e-6) continue;
      for (let k = 0; k < 4; k++) w[k] /= kept;
      W.setElement(i, w);
      fixed++;
    }
  }
  console.log(`fix-skin-branches ${inPath}: ${fixed} of ${total} vertices pulled by another limb${dry ? ' (dry run)' : ''}`);
  if (dry) return;
  await io.write(outPath, doc);
}

async function cutFusedLimbs(inPath, outPath, dry) {
  const doc = await io.read(inPath);
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) { console.log(`${inPath}: no skin`); return; }
  const info = skin.listJoints().map((jn) => branchOf(jn.getName() ?? ''));
  let cut = 0, total = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const J = prim.getAttribute('JOINTS_0');
    const W = prim.getAttribute('WEIGHTS_0');
    const idxAcc = prim.getIndices();
    if (!J || !W || !idxAcc) continue;
    const j = [0, 0, 0, 0];
    const w = [0, 0, 0, 0];
    const dom = [];
    for (let i = 0; i < J.getCount(); i++) {
      J.getElement(i, j); W.getElement(i, w);
      let top = 0; for (let k = 1; k < 4; k++) if (w[k] > w[top]) top = k;
      dom.push(info[j[top]]);
    }
    const idx = idxAcc.getArray();
    const keep = [];
    for (let t = 0; t < idx.length; t += 3) {
      total++;
      const v = [dom[idx[t]], dom[idx[t + 1]], dom[idx[t + 2]]];
      let bad = false;
      for (let a = 0; a < 3 && !bad; a++) for (let b = 0; b < 3 && !bad; b++) {
        const x = v[a], y = v[b];
        if (x.branch === y.branch) continue;
        if (x.branch.startsWith('arm') && x.distal) bad = true;                       // a hand/forearm joined to something else
        else if (x.branch.startsWith('arm') && y.branch.startsWith('leg')) bad = true; // any arm joined to a leg
        else if (x.branch.startsWith('arm') && y.branch.startsWith('arm')) bad = true; // left arm joined to right arm
      }
      if (bad) { cut++; continue; }
      keep.push(idx[t], idx[t + 1], idx[t + 2]);
    }
    if (!dry) idxAcc.setArray(new Uint32Array(keep));
  }
  console.log(`cut-fused-limbs ${inPath}: ${cut} of ${total} triangles joined a hand or arm to another limb${dry ? ' (dry run)' : ''}`);
  if (dry) return;
  await io.write(outPath, doc);
}

/** Where a joint sits in bind pose: the translation of the inverse of its (column-major, affine) inverse bind matrix. */
function invertTranslation(m) {
  // Rows of the 3×3 part (glTF stores columns), then inverse = adjugate / det, and t' = -R⁻¹ t.
  const [a, b, c, d, e, f, g, h, i] = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const r = [A, -(b * i - c * h), b * f - c * e, B, a * i - c * g, -(a * f - c * d), C, -(a * h - b * g), a * e - b * d].map((v) => v / det);
  const tx = m[12], ty = m[13], tz = m[14];
  return [-(r[0] * tx + r[1] * ty + r[2] * tz), -(r[3] * tx + r[4] * ty + r[5] * tz), -(r[6] * tx + r[7] * ty + r[8] * tz)];
}

/** Closest point to p on segment a→b. */
function closestOn(p, a, b) {
  const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const l2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2] || 1;
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1] + (p[2] - a[2]) * ab[2]) / l2));
  return [a[0] + ab[0] * t, a[1] + ab[1] * t, a[2] + ab[2] * t];
}

async function fixArmFlank(inPath, outPath, dry) {
  const doc = await io.read(inPath);
  const skin = doc.getRoot().listSkins()[0];
  if (!skin) { console.log(`${inPath}: no skin`); return; }
  const names = skin.listJoints().map((j) => (j.getName() ?? '').toLowerCase());
  const ibm = skin.getInverseBindMatrices().getArray();
  const at = (k) => invertTranslation(Array.from(ibm.slice(k * 16, k * 16 + 16)));
  const find = (re) => names.findIndex((n) => re.test(n));
  const hips = find(/hips$/), neck = find(/neck$/);
  const spines = names.map((n, k) => (/hips$|spine\d?$/.test(n) ? k : -1)).filter((k) => k >= 0).map((k) => ({ k, y: at(k)[1] }));
  if (hips < 0 || neck < 0) { console.log(`${inPath}: not a humanoid skeleton`); return; }
  const H = at(hips), N = at(neck);
  const prims = doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives());
  let moved = 0, total = 0;
  for (const s of ['left', 'right']) {
    const ks = { arm: find(new RegExp(s + 'arm$')), fore: find(new RegExp(s + 'forearm$')), hand: find(new RegExp(s + 'hand$')) };
    if (ks.arm < 0 || ks.fore < 0 || ks.hand < 0) continue;
    const S = at(ks.arm), E = at(ks.fore), W0 = at(ks.hand);
    const armBones = new Set(names.map((n, k) => (new RegExp(s + '(arm|forearm|hand|thumb|index|middle|ring|pinky)').test(n) ? k : -1)).filter((k) => k >= 0));
    // The arm's thickness: how far forearm-dominated vertices sit from the forearm bone (median).
    const radii = [];
    const p = [0, 0, 0], j = [0, 0, 0, 0], w = [0, 0, 0, 0];
    for (const prim of prims) {
      const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), Wt = prim.getAttribute('WEIGHTS_0');
      if (!P || !J || !Wt) continue;
      for (let i = 0; i < J.getCount(); i++) {
        J.getElement(i, j); Wt.getElement(i, w);
        let top = 0; for (let k = 1; k < 4; k++) if (w[k] > w[top]) top = k;
        if (j[top] !== ks.fore || w[top] < 0.6) continue;
        P.getElement(i, p);
        const c = closestOn(p, E, W0);
        radii.push(Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
      }
    }
    radii.sort((x, y) => x - y);
    const rArm = (radii[Math.floor(radii.length * 0.75)] ?? 0.1) * 1.15;
    for (const prim of prims) {
      const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), Wt = prim.getAttribute('WEIGHTS_0');
      if (!P || !J || !Wt) continue;
      for (let i = 0; i < J.getCount(); i++) {
        J.getElement(i, j); Wt.getElement(i, w);
        let armW = 0;
        for (let k = 0; k < 4; k++) if (w[k] > 0 && armBones.has(j[k])) armW += w[k];
        if (armW <= 0.01) continue;
        P.getElement(i, p);
        total++;
        // Below the shoulder joint, between the arm and the spine, and further in than the arm is thick: flank.
        if (p[1] > S[1] - 0.04 || p[1] < Math.min(W0[1], H[1]) - 0.05) continue;
        const c1 = closestOn(p, S, E), c2 = closestOn(p, E, W0);
        const d1 = Math.hypot(p[0] - c1[0], p[1] - c1[1], p[2] - c1[2]);
        const d2 = Math.hypot(p[0] - c2[0], p[1] - c2[1], p[2] - c2[2]);
        const c = d1 < d2 ? c1 : c2;
        const sp = closestOn(p, H, N);
        const inward = [sp[0] - c[0], 0, sp[2] - c[2]];
        const il = Math.hypot(inward[0], inward[2]) || 1;
        const depth = ((p[0] - c[0]) * inward[0] + (p[2] - c[2]) * inward[2]) / il;
        if (depth < rArm) continue;
        let best = spines[0];
        for (const q of spines) if (Math.abs(q.y - p[1]) < Math.abs(best.y - p[1])) best = q;
        let slot = -1;
        for (let k = 0; k < 4; k++) if (j[k] === best.k) slot = k;
        for (let k = 0; k < 4; k++) {
          if (!(w[k] > 0 && armBones.has(j[k]))) continue;
          if (slot < 0) { slot = k; j[k] = best.k; }
          else { w[slot] += w[k]; w[k] = 0; }
        }
        J.setElement(i, j); Wt.setElement(i, w);
        moved++;
      }
    }
    console.log(`  ${s} arm: thickness ${rArm.toFixed(3)}`);
  }
  console.log(`fix-arm-flank ${inPath}: ${moved} of ${total} arm-weighted vertices were flank, moved to the spine${dry ? ' (dry run)' : ''}`);
  if (dry) return;
  await io.write(outPath, doc);
}

async function cutTriangles(inPath, outPath, listPath) {
  const { readFileSync } = await import('node:fs');
  const drop = new Set(JSON.parse(readFileSync(listPath, 'utf8')));
  const doc = await io.read(inPath);
  const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const acc = prim?.getIndices();
  if (!acc) { console.log(`${inPath}: no indexed primitive`); return; }
  const idx = acc.getArray();
  const keep = [];
  for (let t = 0; t < idx.length / 3; t++) if (!drop.has(t)) keep.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  acc.setArray(new Uint32Array(keep));
  await io.write(outPath, doc);
  console.log(`cut-triangles ${inPath}: ${idx.length / 3 - keep.length / 3} of ${idx.length / 3} triangles removed`);
}

/** The skeleton's bones as bind-pose segments (each kept bone from its joint to each kept child's), and a distance. */
function boneSegments(root, keepRe) {
  const skin = root.listSkins()[0];
  if (!skin) throw new Error('the model has no skin');
  const joints = skin.listJoints();
  const ibm = skin.getInverseBindMatrices();
  const keep = new RegExp(keepRe, 'i');
  // Bind-pose joint positions in mesh space: the inverse of each inverse bind matrix, applied to the origin.
  const inv = (m) => {
    const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
    const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
    const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12, b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
    const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
    const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
    const id = 1 / det;
    // Only the translation column of the inverse is needed (column-major: elements 12, 13, 14).
    return [
      (-a10 * b09 + a11 * b07 - a12 * b06) * id,
      (a00 * b09 - a01 * b07 + a02 * b06) * id,
      (-a30 * b03 + a31 * b01 - a32 * b00) * id,
    ];
  };
  const pos = joints.map((_, j) => inv(Array.from(ibm.getElement(j, []))));
  const idx = new Map(joints.map((n, j) => [n, j]));
  // Segments: each kept bone from its joint to each kept child's joint (a leaf is a point).
  const segs = [];
  joints.forEach((n, j) => {
    if (!keep.test(n.getName())) return;
    const kids = n.listChildren().filter((k) => idx.has(k) && keep.test(k.getName()));
    if (kids.length === 0) segs.push({ j, a: pos[j], b: pos[j] });
    for (const k of kids) segs.push({ j, a: pos[j], b: pos[idx.get(k)] });
  });
  const dist = (p, s) => {
    const ab = [s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]];
    const ap = [p[0] - s.a[0], p[1] - s.a[1], p[2] - s.a[2]];
    const L = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
    const t = L > 1e-12 ? Math.max(0, Math.min(1, (ap[0] * ab[0] + ap[1] * ab[1] + ap[2] * ab[2]) / L)) : 0;
    const d = [ap[0] - ab[0] * t, ap[1] - ab[1] * t, ap[2] - ab[2] * t];
    return Math.hypot(d[0], d[1], d[2]);
  };
  return { joints, segs, dist };
}

async function rebindNearest(inPath, outPath, keepRe = '^mixamorig:(?!.*_End$)') {
  const doc = await io.read(inPath);
  const root = doc.getRoot();
  const { segs, dist } = boneSegments(root, keepRe);
  let changed = 0;
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
    if (!P || !J || !W) continue;
    const p = [0, 0, 0];
    for (let i = 0; i < P.getCount(); i++) {
      P.getElement(i, p);
      const best = new Map();
      for (const s of segs) { const d = dist(p, s); if (!best.has(s.j) || d < best.get(s.j)) best.set(s.j, d); }
      const near = [...best.entries()].sort((x, y) => x[1] - y[1]);
      const [j0, d0] = near[0];
      const [j1, d1] = near[1] ?? [j0, Infinity];
      // Blend the second bone only when it is nearly as close (a joint's crease), by inverse distance to the fourth.
      let w0 = 1, w1 = 0;
      if (d1 < d0 * 1.6) { const a0 = 1 / Math.pow(d0 + 1e-4, 4), a1 = 1 / Math.pow(d1 + 1e-4, 4); w0 = a0 / (a0 + a1); w1 = 1 - w0; }
      J.setElement(i, [j0, j1, 0, 0]);
      W.setElement(i, [w0, w1, 0, 0]);
      changed++;
    }
  }
  await io.write(outPath, doc);
  console.log(`rebind-nearest ${inPath}: ${changed} vertices re-skinned to ${new Set(segs.map((s) => s.j)).size} bones`);
}

/** Which limb a bone belongs to (for fix-misbound). */
function limbGroup(name) {
  const n = name.replace(/^mixamorig:?/i, '');
  const side = /^Left/.test(n) ? 'L' : /^Right/.test(n) ? 'R' : '';
  if (/(Shoulder|Arm|ForeArm|Hand)/.test(n)) return side + 'arm';
  if (/(UpLeg|Leg|Foot|Toe)/.test(n)) return side + 'leg';
  return 'body';
}

async function fixMisbound(inPath, outPath, ratio = 2.5, keepRe = '^mixamorig:(?!.*_End$)') {
  const doc = await io.read(inPath);
  const root = doc.getRoot();
  const { joints, segs, dist } = boneSegments(root, keepRe);
  const groupOf = joints.map((n) => limbGroup(n.getName()));
  let changed = 0, total = 0;
  const moved = {};
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) {
    const P = prim.getAttribute('POSITION'), J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
    if (!P || !J || !W) continue;
    const p = [0, 0, 0], j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
    for (let i = 0; i < P.getCount(); i++) {
      P.getElement(i, p); J.getElement(i, j4); W.getElement(i, w4); total++;
      let k = 0; for (let m = 1; m < 4; m++) if (w4[m] > w4[k]) k = m;
      const jd = j4[k];
      let dDom = Infinity, near = -1, dNear = Infinity;
      for (const sg of segs) { const d = dist(p, sg); if (sg.j === jd && d < dDom) dDom = d; if (d < dNear) { dNear = d; near = sg.j; } }
      if (near < 0 || groupOf[near] === groupOf[jd] || !(dDom > dNear * ratio)) continue;
      J.setElement(i, [near, 0, 0, 0]);
      W.setElement(i, [1, 0, 0, 0]);
      const key = `${groupOf[jd]}->${groupOf[near]}`; moved[key] = (moved[key] ?? 0) + 1;
      changed++;
    }
  }
  await io.write(outPath, doc);
  console.log(`fix-misbound ${inPath}: ${changed} of ${total} vertices moved to the bone they sit on`, JSON.stringify(moved));
}

async function dropIslands(inPath, outPath, minTris = 12) {
  const doc = await io.read(inPath);
  const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const P = prim?.getAttribute('POSITION'), acc = prim?.getIndices();
  if (!P || !acc) throw new Error(`${inPath}: no indexed primitive`);
  const idx = acc.getArray(), n = P.getCount(), nT = idx.length / 3;
  // Welded by position (UV seams split a surface into islands that are not really apart).
  const p = [0, 0, 0], key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) { P.getElement(i, p); const k = p.map((x) => Math.round(x * 1e4)).join(','); let w = key.get(k); if (w === undefined) key.set(k, w = key.size); weld[i] = w; }
  const parent = Int32Array.from({ length: key.size }, (_, i) => i);
  const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
  for (let t = 0; t < nT; t++) { const a = find(weld[idx[t * 3]]); for (let e = 1; e < 3; e++) { const b = find(weld[idx[t * 3 + e]]); if (a !== b) parent[b] = a; } }
  const size = new Map();
  for (let t = 0; t < nT; t++) { const r = find(weld[idx[t * 3]]); size.set(r, (size.get(r) ?? 0) + 1); }
  let alive = new Uint8Array(nT); let dropped = 0, islands = 0;
  for (const [, c] of size) if (c < minTris) islands++;
  for (let t = 0; t < nT; t++) { if (size.get(find(weld[idx[t * 3]])) < minTris) dropped++; else alive[t] = 1; }
  // Fringes: triangles left hanging by one edge or a corner along a cut (at most one neighbour across an edge), a few
  // passes, each one eating the next ring of a dangling strip.
  let fringe = 0;
  const ekey = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  for (let pass = 0; pass < 3; pass++) {
    const count = new Map();
    for (let t = 0; t < nT; t++) if (alive[t]) for (let e = 0; e < 3; e++) { const k = ekey(weld[idx[t * 3 + e]], weld[idx[t * 3 + (e + 1) % 3]]); count.set(k, (count.get(k) ?? 0) + 1); }
    let n0 = 0;
    for (let t = 0; t < nT; t++) {
      if (!alive[t]) continue;
      let nb = 0; for (let e = 0; e < 3; e++) if ((count.get(ekey(weld[idx[t * 3 + e]], weld[idx[t * 3 + (e + 1) % 3]])) ?? 0) > 1) nb++;
      if (nb <= 1) { alive[t] = 0; n0++; }
    }
    fringe += n0; if (!n0) break;
  }
  const keep = [];
  for (let t = 0; t < nT; t++) if (alive[t]) keep.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]);
  acc.setArray(new Uint32Array(keep));
  await io.write(outPath, doc);
  console.log(`drop-islands ${inPath}: ${islands} islands under ${minTris} triangles (${dropped} triangles) and ${fringe} fringe triangles removed`);
}

async function fillHoles(inPath, outPath, maxLoop = 400) {
  const doc = await io.read(inPath);
  const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const P = prim?.getAttribute('POSITION'), acc = prim?.getIndices();
  if (!P || !acc) throw new Error(`${inPath}: no indexed primitive`);
  const idx = Array.from(acc.getArray()), n = P.getCount();
  const p = [0, 0, 0], key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) { P.getElement(i, p); const k = p.map((x) => Math.round(x * 1e4)).join(','); let w = key.get(k); if (w === undefined) key.set(k, w = key.size); weld[i] = w; }
  // Boundary edges (welded): used by one triangle. Each keeps its direction in that triangle and a real vertex per end.
  const ekey = (a, b) => (a < b ? a * 4294967296 + b : b * 4294967296 + a);
  const uses = new Map();
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = idx[t + e], b = idx[t + (e + 1) % 3]; const k = ekey(weld[a], weld[b]); const u = uses.get(k); if (u) u.n++; else uses.set(k, { n: 1, a, b }); }
  const next = new Map();
  for (const u of uses.values()) if (u.n === 1) next.set(weld[u.a], u);
  // Walk them into loops (a boundary edge a->b runs on from b).
  const seen = new Set(); const loops = [];
  for (const [start] of next) {
    if (seen.has(start)) continue;
    const loop = []; let cur = start, ok = true;
    while (!seen.has(cur)) { seen.add(cur); const u = next.get(cur); if (!u) { ok = false; break; } loop.push(u); cur = weld[u.b]; if (loop.length > maxLoop) { ok = false; break; } }
    if (ok && cur === start && loop.length >= 3) loops.push(loop);
  }
  // A rim that runs across two limbs (a hand cut free of the thigh it lay on) is closed limb by limb: each run of rim
  // on one limb gets its own cap (one cap over both would weld them again).
  const J = prim.getAttribute('JOINTS_0'), W = prim.getAttribute('WEIGHTS_0');
  const skin = doc.getRoot().listSkins()[0];
  const groupOfJoint = skin ? skin.listJoints().map((jn) => limbGroup(jn.getName())) : [];
  const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0];
  const limbOfVertex = (v) => { if (!J || !W) return 'body'; J.getElement(v, j4); W.getElement(v, w4); let k = 0; for (let m = 1; m < 4; m++) if (w4[m] > w4[k]) k = m; return groupOfJoint[j4[k]] ?? 'body'; };
  const caps = [];
  for (const loop of loops) {
    const g = loop.map((u) => limbOfVertex(u.a));
    const cut = g.findIndex((x, i) => x !== g[(i + g.length - 1) % g.length]);
    if (cut < 0) { caps.push({ edges: loop, chord: null }); continue; }
    const rot = [...loop.slice(cut), ...loop.slice(0, cut)], gr = [...g.slice(cut), ...g.slice(0, cut)];
    let run = [];
    for (let i = 0; i <= rot.length; i++) {
      if (i < rot.length && (run.length === 0 || gr[i] === gr[i - 1])) { run.push(rot[i]); continue; }
      // (The run's own edges, closed by a chord from its last vertex back to its first.)
      if (run.length >= 3) caps.push({ edges: run.slice(0, -1), chord: [run[run.length - 1].a, run[0].a], rim: run.map((u) => u.a) });
      run = i < rot.length ? [rot[i]] : [];
    }
  }
  const attrs = prim.listSemantics().map((sem) => [sem, prim.getAttribute(sem)]);
  const extra = caps.length;
  for (const [, a] of attrs) { const arr = a.getArray(); const grown = new arr.constructor(arr.length + extra * a.getElementSize()); grown.set(arr); a.setArray(grown); }
  let vi = n;
  for (const cap of caps) {
    const rim = cap.rim ?? cap.edges.map((u) => u.a);
    for (const [sem, a] of attrs) {
      if (sem === 'JOINTS_0' || sem === 'WEIGHTS_0') continue;
      const size = a.getElementSize(), v = new Array(size).fill(0), tmp = new Array(size).fill(0);
      for (const r of rim) { a.getElement(r, tmp); for (let k = 0; k < size; k++) v[k] += tmp[k] / rim.length; }
      if (sem === 'NORMAL') { const l = Math.hypot(v[0], v[1], v[2]) || 1; for (let k = 0; k < 3; k++) v[k] /= l; }
      a.setElement(vi, v);
    }
    if (J && W) {
      const sum = new Map();
      for (const r of rim) { J.getElement(r, j4); W.getElement(r, w4); for (let k = 0; k < 4; k++) if (w4[k] > 0) sum.set(j4[k], (sum.get(j4[k]) ?? 0) + w4[k]); }
      const top = [...sum.entries()].sort((x, y) => y[1] - x[1]).slice(0, 4); const tot = top.reduce((x, [, w]) => x + w, 0) || 1;
      J.setElement(vi, [0, 1, 2, 3].map((k) => top[k]?.[0] ?? 0)); W.setElement(vi, [0, 1, 2, 3].map((k) => (top[k]?.[1] ?? 0) / tot));
    }
    for (const u of cap.edges) idx.push(u.b, u.a, vi);
    if (cap.chord) idx.push(cap.chord[1], cap.chord[0], vi);
    vi++;
  }
  acc.setArray(new Uint32Array(idx));
  await io.write(outPath, doc);
  console.log(`fill-holes ${inPath}: ${loops.length} holes closed with ${caps.length} caps (rims ${loops.map((l) => l.length).sort((x, y) => y - x).slice(0, 8).join(', ')}${loops.length > 8 ? ', ...' : ''})`);
}

async function smoothSkin(inPath, outPath, iterations = 3, maskPath) {
  const { readFileSync } = await import('node:fs');
  const doc = await io.read(inPath);
  const prim = doc.getRoot().listMeshes()[0]?.listPrimitives()[0];
  const P = prim?.getAttribute('POSITION'), J = prim?.getAttribute('JOINTS_0'), W = prim?.getAttribute('WEIGHTS_0'), I = prim?.getIndices();
  if (!P || !J || !W || !I) throw new Error(`${inPath}: no skinned indexed primitive`);
  const n = P.getCount(), idx = I.getArray();
  // Weld by position (UV seams split a vertex in two; each half must end up with the same weights or the skin tears).
  const p = [0, 0, 0], key = new Map(), weld = new Int32Array(n);
  for (let i = 0; i < n; i++) { P.getElement(i, p); const k = p.map((x) => Math.round(x * 1e4)).join(','); let w = key.get(k); if (w === undefined) key.set(k, w = key.size); weld[i] = w; }
  const m = key.size;
  const nbr = Array.from({ length: m }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) for (let e = 0; e < 3; e++) { const a = weld[idx[t + e]], b = weld[idx[t + (e + 1) % 3]]; if (a !== b) { nbr[a].add(b); nbr[b].add(a); } }
  // Which welded vertices may change: all, or those of the listed triangles and two rings round them.
  let free = null;
  if (maskPath) {
    free = new Uint8Array(m);
    for (const t of JSON.parse(readFileSync(maskPath, 'utf8'))) for (let e = 0; e < 3; e++) free[weld[idx[t * 3 + e]]] = 1;
    for (let ring = 0; ring < 2; ring++) { const add = []; for (let v = 0; v < m; v++) if (free[v]) for (const u of nbr[v]) if (!free[u]) add.push(u); for (const u of add) free[u] = 1; }
  }
  let w = Array.from({ length: m }, () => new Map());
  const j4 = [0, 0, 0, 0], w4 = [0, 0, 0, 0], count = new Int32Array(m);
  for (let i = 0; i < n; i++) { J.getElement(i, j4); W.getElement(i, w4); const map = w[weld[i]]; count[weld[i]]++; for (let k = 0; k < 4; k++) if (w4[k] > 0) map.set(j4[k], (map.get(j4[k]) ?? 0) + w4[k]); }
  for (let v = 0; v < m; v++) for (const [j, x] of w[v]) w[v].set(j, x / count[v]);
  // Each pass: half its own weights, half its neighbours' average.
  for (let it = 0; it < iterations; it++) {
    const next = w.map((map, v) => {
      if ((free && !free[v]) || nbr[v].size === 0) return map;
      const out = new Map(); for (const [j, x] of map) out.set(j, x * 0.5);
      const share = 0.5 / nbr[v].size;
      for (const u of nbr[v]) for (const [j, x] of w[u]) out.set(j, (out.get(j) ?? 0) + x * share);
      return out;
    });
    w = next;
  }
  let changed = 0;
  for (let i = 0; i < n; i++) {
    const v = weld[i]; if (free && !free[v]) continue;
    const top = [...w[v].entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top.reduce((a, [, x]) => a + x, 0) || 1;
    J.setElement(i, [0, 1, 2, 3].map((k) => top[k]?.[0] ?? 0));
    W.setElement(i, [0, 1, 2, 3].map((k) => (top[k]?.[1] ?? 0) / sum));
    changed++;
  }
  await io.write(outPath, doc);
  console.log(`smooth-skin ${inPath}: ${changed} of ${n} vertices smoothed (${iterations} passes${maskPath ? ', masked' : ''})`);
}

async function clip(inPath, outPath, nameRe, rotOnly = false) {
  const doc = await io.read(inPath);
  const root = doc.getRoot();
  if (nameRe) for (const an of root.listAnimations()) if (!new RegExp(nameRe, 'i').test(an.getName())) an.dispose();
  if (rotOnly) for (const an of root.listAnimations()) for (const ch of an.listChannels()) {
    if (ch.getTargetPath() !== 'rotation') { ch.getSampler()?.dispose(); ch.dispose(); }
  }
  if (root.listAnimations().length === 0) throw new Error(`${inPath} has no animations${nameRe ? ` matching ${nameRe}` : ''}`);
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
  if (cmd === 'strip-skin') return stripSkin(a, b);
  if (cmd === 'fix-limb-skin') return fixLimbSkin(a, b, c === '--dry');
  if (cmd === 'fix-skin-branches') return fixSkinBranches(a, b, c === '--dry');
  if (cmd === 'cut-fused-limbs') return cutFusedLimbs(a, b, c === '--dry');
  if (cmd === 'fix-arm-flank') return fixArmFlank(a, b, c === '--dry');
  if (cmd === 'cut-triangles') return cutTriangles(a, b, c);
  if (cmd === 'rebind-nearest') return rebindNearest(a, b, c);
  if (cmd === 'smooth-skin') return smoothSkin(a, b, c ? Number(c) : 3, d);
  if (cmd === 'fix-misbound') return fixMisbound(a, b, c ? Number(c) : 2.5);
  if (cmd === 'drop-islands') return dropIslands(a, b, c ? Number(c) : 12);
  if (cmd === 'fill-holes') return fillHoles(a, b, c ? Number(c) : 400);
  if (cmd === 'clip') return clip(a, b, c && c !== '--rot-only' ? c : undefined, process.argv.includes('--rot-only'));
  if (cmd === 'import') {
    const name = b;
    if (c) return clip(a, resolve('public/models', `${name}-${c}.glb`));
    return optimize(a, resolve('public/models', `${name}.glb`));
  }
  console.error('usage: model-tools.mjs info|optimize|clip|import ...');
  process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });

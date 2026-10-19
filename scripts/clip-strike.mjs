#!/usr/bin/env node
/**
 * Where in each clip does the blow land? For every animation of a GLB this prints the moment the matched bone (the
 * right hand by default: the sword hand, the string hand) moves fastest through the world (the blow), when it starts
 * to move (the wind-up) and when it comes to rest again (the settle), plus the other swings of a multi-strike clip and,
 * for jumps, the hips' arc (take-off, apex, landing). The numbers feed src/characters/heroClips.ts.
 *
 *   node scripts/clip-strike.mjs public/models/knight.glb [boneRegex]
 *
 * Speeds are in body heights per second (the file is measured unscaled). Loads the GLB the way clip-reach.mjs does,
 * except that textures are dropped from the file's JSON first: three's GLTFLoader needs a DOM to decode images, and
 * only the skeleton and the clips matter here.
 */
import { readFileSync } from 'node:fs';
import { AnimationMixer, Box3, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const args = process.argv.slice(2);
const curveAt = args.indexOf('--curve');
/** `--curve <clip substring>`: the bone's speed and height and the hips' height every 1/30 s of that clip. */
const curveOf = curveAt >= 0 ? args.splice(curveAt, 2)[1] : null;
const [file, boneArg] = args;
if (!file) { console.log('usage: node scripts/clip-strike.mjs <file.glb> [boneRegex] [--curve <clip substring>]'); process.exit(1); }
const boneRe = new RegExp(boneArg ?? 'hand|wrist', 'i');

/** A GLB with its images, textures and samplers removed (materials keep their colours), as an ArrayBuffer. */
export function stripTextures(buf) {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  if (dv.getUint32(0, true) !== 0x46546c67) return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength); // not a GLB: as is
  const total = dv.getUint32(8, true);
  const chunks = [];
  for (let off = 12; off < total;) {
    const len = dv.getUint32(off, true);
    const type = dv.getUint32(off + 4, true);
    chunks.push({ type, data: buf.subarray(off + 8, off + 8 + len) });
    off += 8 + len;
  }
  const json = JSON.parse(Buffer.from(chunks[0].data).toString('utf8'));
  delete json.images; delete json.textures; delete json.samplers;
  for (const m of json.materials ?? []) {
    delete m.normalTexture; delete m.occlusionTexture; delete m.emissiveTexture; delete m.extensions;
    if (m.pbrMetallicRoughness) { delete m.pbrMetallicRoughness.baseColorTexture; delete m.pbrMetallicRoughness.metallicRoughnessTexture; }
  }
  const noTex = (e) => !/texture|webp|avif|basisu/i.test(e);
  if (json.extensionsUsed) json.extensionsUsed = json.extensionsUsed.filter(noTex);
  if (json.extensionsRequired) json.extensionsRequired = json.extensionsRequired.filter(noTex);
  let text = JSON.stringify(json);
  while (text.length % 4) text += ' ';
  const jsonChunk = Buffer.from(text, 'utf8');
  const bin = chunks.find((c) => c.type === 0x004e4942);
  const binLen = bin ? bin.data.length + ((4 - (bin.data.length % 4)) % 4) : 0;
  const out = Buffer.alloc(12 + 8 + jsonChunk.length + (bin ? 8 + binLen : 0));
  out.writeUInt32LE(0x46546c67, 0); out.writeUInt32LE(2, 4); out.writeUInt32LE(out.length, 8);
  out.writeUInt32LE(jsonChunk.length, 12); out.writeUInt32LE(0x4e4f534a, 16); jsonChunk.copy(out, 20);
  if (bin) { const at = 20 + jsonChunk.length; out.writeUInt32LE(binLen, at); out.writeUInt32LE(0x004e4942, at + 4); bin.data.copy(out, at + 8); }
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
}

/** Loads a GLB in node (no DOM): textures dropped, clips and skeleton intact. */
export async function loadGlb(path) {
  const ab = stripTextures(readFileSync(path));
  return new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
}

const gltf = await loadGlb(file);
const scene = gltf.scene;
scene.updateMatrixWorld(true);
const height = new Box3().setFromObject(scene).getSize(new Vector3()).y || 1;
const bones = [];
scene.traverse((o) => { if (o.isBone && boneRe.test(o.name)) bones.push(o); });
// The right side first (a sword hand, a string hand), then the shortest name (the hand itself before its fingers).
const bone = bones.sort((a, b) => (/right|_r\b|\.r\b/i.test(b.name) ? 1 : 0) - (/right|_r\b|\.r\b/i.test(a.name) ? 1 : 0) || a.name.length - b.name.length)[0];
const hips = (() => { let h = null; scene.traverse((o) => { if (!h && o.isBone && /hips$/i.test(o.name)) h = o; }); return h; })();
if (!bone) {
  // A clip-only file (hero-climb.glb carries rotations for the heroes' skeleton, no bones of its own): just the list.
  const names = []; scene.traverse((o) => { if (o.isBone) names.push(o.name); });
  console.log(`\n${file}: no bone matches ${boneRe} (bones: ${names.join(', ') || 'none'}); clips:`);
  for (const c of gltf.animations) console.log(`  ${c.name}  ${c.duration.toFixed(3)} s  ${c.tracks.length} tracks`);
  process.exit(0);
}

const mixer = new AnimationMixer(scene);
const RATE = 120;
const p = new Vector3();
const q = new Vector3();
const h = new Vector3();
const f2 = (x) => x.toFixed(2);

/** Samples the bone's world speed (heights/s) and the hips' height through the clip. */
function sample(clip) {
  const action = mixer.clipAction(clip);
  action.play();
  const n = Math.max(2, Math.round(clip.duration * RATE));
  const t = [];
  const speed = [];
  const hipsY = [];
  const boneY = [];
  for (let i = 0; i <= n; i++) {
    const time = Math.min(clip.duration - 1e-5, (clip.duration * i) / n);
    action.time = time;
    mixer.update(0);
    scene.updateMatrixWorld(true);
    bone.getWorldPosition(p);
    if (hips) hipsY.push(hips.getWorldPosition(h).y / height);
    boneY.push(p.y / height);
    if (i > 0) { speed.push(p.distanceTo(q) / (clip.duration / n) / height); t.push(time); }
    q.copy(p);
  }
  action.stop();
  mixer.uncacheClip(clip);
  // A little smoothing (three samples) against the baked keys' jitter.
  const s = speed.map((_, i) => (speed[Math.max(0, i - 1)] + speed[i] + speed[Math.min(speed.length - 1, i + 1)]) / 3);
  return { t, s, hipsY, boneY, dt: clip.duration / n };
}

/** The curve of one clip, every 1/30 s: time, the bone's speed and height, the hips' height (all in body heights). */
function printCurve(clip) {
  const { t, s, hipsY, boneY, dt } = sample(clip);
  console.log(`\n${clip.name} (${clip.duration.toFixed(3)} s) — t s | ${bone.name} speed h/s | ${bone.name} y h | hips y h`);
  const step = Math.max(1, Math.round(1 / 30 / dt));
  for (let i = 0; i < s.length; i += step) {
    const bar = '#'.repeat(Math.round(Math.min(40, (s[i] / Math.max(...s)) * 40)));
    console.log(`${t[i].toFixed(2).padStart(5)} | ${s[i].toFixed(2).padStart(5)} | ${boneY[i + 1].toFixed(3)} | ${hipsY.length ? hipsY[i + 1].toFixed(3) : '-'} ${bar}`);
  }
}

/** The local maxima of `s` above `floor`, at least `gap` seconds apart, strongest first. */
function peaks(t, s, floor, gap) {
  const out = [];
  for (let i = 1; i < s.length - 1; i++) if (s[i] >= s[i - 1] && s[i] > s[i + 1] && s[i] >= floor) out.push({ t: t[i], v: s[i], i });
  out.sort((a, b) => b.v - a.v);
  const kept = [];
  for (const pk of out) if (!kept.some((k) => Math.abs(k.t - pk.t) < gap)) kept.push(pk);
  return kept;
}

if (curveOf) {
  const clip = gltf.animations.find((c) => c.name.toLowerCase().includes(curveOf.toLowerCase()));
  if (!clip) { console.log('clips:', gltf.animations.map((c) => c.name).join(', ')); process.exit(1); }
  printCurve(clip);
  process.exit(0);
}

const rows = [];
const arcs = [];
for (const clip of gltf.animations) {
  const { t, s, hipsY, dt } = sample(clip);
  const peak = Math.max(...s);
  const at = s.indexOf(peak);
  const quiet = peak * 0.2;
  const hold = Math.round(0.12 / dt);
  // The wind-up starts when the hand last left its rest before the blow; it settles once it stays slow after it.
  let windup = at;
  for (let i = at; i >= 0; i--) { if (s[i] < quiet) { windup = i; break; } if (i === 0) windup = 0; }
  let settle = s.length - 1;
  for (let i = at; i < s.length; i++) { if (s.slice(i, i + hold).every((v) => v < quiet) && i + hold <= s.length) { settle = i; break; } }
  const others = peaks(t, s, peak * 0.35, 0.25).filter((pk) => pk.i !== at).slice(0, 4);
  rows.push({
    name: clip.name, dur: clip.duration, blow: t[at], frac: t[at] / clip.duration, peak, windup: t[windup], settle: t[settle],
    others: others.map((pk) => `${f2(pk.t)} (${Math.round((pk.v / peak) * 100)}%)`).join(', ') || '-',
  });
  if (hipsY.length && /jump|leap|hop/i.test(clip.name)) {
    const rest = hipsY[0];
    const apexI = hipsY.indexOf(Math.max(...hipsY));
    const band = 0.02;
    let takeoff = apexI;
    for (let i = apexI; i >= 0; i--) if (hipsY[i] <= rest + band) { takeoff = i; break; }
    let land = hipsY.length - 1;
    for (let i = apexI; i < hipsY.length; i++) if (hipsY[i] <= rest + band) { land = i; break; }
    const crouch = Math.min(...hipsY.slice(0, apexI + 1));
    const stepT = clip.duration / (hipsY.length - 1);
    arcs.push({ name: clip.name, dur: clip.duration, takeoff: takeoff * stepT, apex: apexI * stepT, land: land * stepT, rise: hipsY[apexI] - rest, crouch: rest - crouch });
  }
}

console.log(`\n${file}: bone ${bone.name} (${bones.length} match ${boneRe}), body height ${height.toFixed(3)} units, ${gltf.animations.length} clips\n`);
console.log('| clip | duration s | blow s | blow frac | wind-up s | settle s | peak h/s | other swings s (% of peak) |');
console.log('|---|---|---|---|---|---|---|---|');
for (const r of rows) console.log(`| ${r.name} | ${r.dur.toFixed(3)} | ${f2(r.blow)} | ${r.frac.toFixed(3)} | ${f2(r.windup)} | ${f2(r.settle)} | ${f2(r.peak)} | ${r.others} |`);
if (arcs.length) {
  console.log('\nJump arcs (hips height; take-off = the hips leave the rest band, land = back in it):\n');
  console.log('| clip | duration s | take-off s | apex s | land s | rise h | crouch h |');
  console.log('|---|---|---|---|---|---|---|');
  for (const a of arcs) console.log(`| ${a.name} | ${a.dur.toFixed(3)} | ${f2(a.takeoff)} | ${f2(a.apex)} | ${f2(a.land)} | ${a.rise.toFixed(3)} | ${a.crouch.toFixed(3)} |`);
}

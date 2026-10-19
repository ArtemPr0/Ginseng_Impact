#!/usr/bin/env node
/**
 * When does a clip strike? For every animation clip, samples a bone's world position at 60 Hz and prints the blow (the time
 * and phase of the bone's peak speed) and the settle (the first time after the blow when the speed stays under 15% of the
 * peak for 0.15 s), to time a hit, a sound or the return to idle. Read-only; a sibling of clip-reach.mjs.
 *   node scripts/clip-strike.mjs <file.glb> [boneRegex=/hand/i]
 *   node scripts/clip-strike.mjs public/models/knight.glb 'righthand$'
 * Of several matching nodes the right-hand one is used (the weapon hand); the others are named so a stricter regex can pick one.
 */
import { readFileSync } from 'node:fs';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const RATE = 60; // samples per second
const QUIET = 0.15; // settled: under this fraction of the peak speed…
const HOLD = 0.15; // …for this long (s)

/** The blow and the settle of a sampled path (positions at the given times, s): speeds are per interval, stamped at its end. */
function strike(times, positions) {
  const speeds = [0];
  let peak = 0; let peakAt = 0;
  for (let i = 1; i < positions.length; i++) {
    const dt = times[i] - times[i - 1];
    const v = dt > 1e-9 ? positions[i].distanceTo(positions[i - 1]) / dt : 0;
    speeds.push(v);
    if (v > peak) { peak = v; peakAt = i; }
  }
  if (peak <= 1e-6) return { peak: 0, peakT: null, settleT: null };
  let settleT = null;
  for (let j = peakAt + 1; j < speeds.length && settleT === null; j++) {
    if (speeds[j] >= QUIET * peak) continue;
    let k = j;
    while (k < speeds.length && speeds[k] < QUIET * peak) k++;
    // The quiet run covers the intervals j..k-1, from times[j-1] on; it must last HOLD, else look on past it.
    if (times[k - 1] - times[j - 1] >= HOLD - 1e-9) settleT = times[j];
    else j = k;
  }
  return { peak, peakT: times[peakAt], settleT };
}

const [file, boneArg] = process.argv.slice(2);
if (!file) { console.log('usage: node scripts/clip-strike.mjs <file.glb> [boneRegex=/hand/i]'); process.exit(1); }
const m = boneArg ? /^\/(.*)\/([a-z]*)$/.exec(boneArg) : null;
const boneRe = m ? new RegExp(m[1], m[2]) : new RegExp(boneArg ?? 'hand', 'i');
const buf = readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
// Only the bones and the clips are needed: skip the textures (Node has no image elements to decode them into).
const loader = new GLTFLoader().register((parser) => { parser.loadTexture = () => Promise.resolve(null); parser.loadTextureImage = () => Promise.resolve(null); return { name: 'no-textures' }; });
const gltf = await new Promise((res, rej) => loader.parse(ab, '', res, rej));
const matches = [];
gltf.scene.traverse((o) => { if (boneRe.test(o.name)) matches.push(o); });
if (!matches.length) {
  const bones = [];
  gltf.scene.traverse((o) => { if (o.isBone) bones.push(o.name); });
  console.log(`no node matches ${boneRe}; bones: ${bones.join(', ')}`);
  process.exit(1);
}
if (!gltf.animations.length) { console.log(`no animation clips in ${file}`); process.exit(1); }
// The hand itself before its fingers, the right one before the left.
const bone = matches.find((o) => /right.*hand$/i.test(o.name)) ?? matches.find((o) => /hand$/i.test(o.name)) ?? matches.find((o) => /right/i.test(o.name)) ?? matches[0];
const others = matches.filter((o) => o !== bone).map((o) => o.name);
const also = others.length ? ` (also matched: ${others.slice(0, 5).join(', ')}${others.length > 5 ? ` +${others.length - 5} more` : ''})` : '';
console.log(`${file} — bone ${bone.name}${also}; ${RATE} Hz; settle = under ${QUIET * 100}% of the peak speed for ${HOLD} s\n`);
console.log('| clip | duration (s) | peak speed (m/s) | blow at (s) | phase | settle at (s) | after the blow (s) |');
console.log('|---|---:|---:|---:|---:|---:|---:|');
const mixer = new AnimationMixer(gltf.scene);
const f = (x, d = 3) => (x === null ? '—' : x.toFixed(d));
for (const clip of gltf.animations) {
  const action = mixer.clipAction(clip);
  action.play();
  const n = Math.max(1, Math.round(clip.duration * RATE));
  const times = []; const positions = [];
  for (let i = 0; i <= n; i++) {
    const t = Math.min(clip.duration, i / RATE);
    action.time = t;
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    times.push(t);
    positions.push(bone.getWorldPosition(new Vector3()));
  }
  action.stop();
  const { peak, peakT, settleT } = strike(times, positions);
  const name = clip.name.replace(/\|/g, '\\|');
  console.log(`| ${name} | ${clip.duration.toFixed(2)} | ${peak.toFixed(2)} | ${f(peakT)} | ${f(peakT === null ? null : peakT / clip.duration, 2)} | ${f(settleT)} | ${f(settleT === null ? null : settleT - peakT)} |`);
}

#!/usr/bin/env node
/**
 * Where in a clip does a hand come closest to the head? Prints the phase (0..1) of the minimum distance between
 * the right (and left) hand bone and the head bone, to sync a sound (a sip) to an animation.
 *   node scripts/clip-reach.mjs <file.glb> <clip-substring>
 */
import { readFileSync } from 'node:fs';
import { AnimationMixer, Vector3 } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const [file, clipName] = process.argv.slice(2);
const buf = readFileSync(file);
const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
const gltf = await new Promise((res, rej) => new GLTFLoader().parse(ab, '', res, rej));
const clip = gltf.animations.find((c) => c.name.toLowerCase().includes(clipName.toLowerCase()));
if (!clip) { console.log('clips:', gltf.animations.map((c) => c.name).join(', ')); process.exit(1); }
const find = (re) => { let f = null; gltf.scene.traverse((o) => { if (!f && re.test(o.name)) f = o; }); return f; };
const head = find(/head$/i) ?? find(/head/i);
const hands = { right: find(/righthand$/i), left: find(/lefthand$/i) };
const mixer = new AnimationMixer(gltf.scene);
const action = mixer.clipAction(clip);
action.play();
const a = new Vector3(), b = new Vector3();
for (const [side, hand] of Object.entries(hands)) {
  if (!hand || !head) continue;
  let best = { d: Infinity, t: 0 };
  const steps = 120;
  for (let i = 0; i <= steps; i++) {
    action.time = (clip.duration * i) / steps;
    mixer.update(0);
    gltf.scene.updateMatrixWorld(true);
    hand.getWorldPosition(a);
    head.getWorldPosition(b);
    const d = a.distanceTo(b);
    if (d < best.d) best = { d, t: i / steps };
  }
  console.log(`${clip.name} (${clip.duration.toFixed(2)} s): ${side} hand closest to the head at phase ${best.t.toFixed(2)} (distance ${best.d.toFixed(3)})`);
}

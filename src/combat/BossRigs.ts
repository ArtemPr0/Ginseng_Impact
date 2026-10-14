import {
  BoxGeometry, BufferGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, DoubleSide, Group, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, Quaternion, SphereGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../render/palette';
import { rockify, tintRock } from '../world/geometry';
import { glowSprite } from '../world/Landmarks';
import type { EnemyState } from './EnemyBrain';
import type { BossAttackKind } from '../data/enemies';

export type MatFn = (color: number, emissive?: number, intensity?: number) => MeshStandardMaterial;

export interface AnimCtx {
  state: EnemyState;
  stateTime: number;
  time: number;
  dt: number;
  moving: boolean;
  attack: BossAttackKind | null;
  /** Normalised 0..1 progress through the windup. */
  windup: number;
}

export interface BossRig {
  animate(ctx: AnimCtx): void;
}

const k = (dt: number, speed = 10) => 1 - Math.exp(-dt * speed);
const ease = (c: number, t: number, kk: number) => c + (t - c) * kk;

/** Fur: cones scattered over a capsule surface leaning along `lean`. */
function fur(count: number, length: number, radius: number, halfLen: number, lean: Vector3, seed = 1): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const up = new Vector3(0, 1, 0);
  const q = new Quaternion();
  const m = new Matrix4();
  let s = seed;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < count; i++) {
    const ax = (rnd() - 0.5) * 2 * halfLen;
    const th = rnd() * Math.PI * 2;
    const n = new Vector3(0, Math.cos(th), Math.sin(th));
    const pos = new Vector3(ax, n.y * radius, n.z * radius);
    const dir = n.clone().add(lean).normalize();
    const cone = new ConeGeometry(0.06 * length, length * (0.7 + rnd() * 0.6), 5).translate(0, length * 0.4, 0);
    q.setFromUnitVectors(up, dir);
    m.compose(pos, q, new Vector3(1, 1, 1));
    cone.applyMatrix4(m);
    parts.push(cone);
  }
  return mergeGeometries(parts, false)!;
}

/** Yeti: 5 m white shaggy ape with blue eyes. */
export function yeti(root: Group, mat: MatFn): BossRig {
  const white = 0xc9d2ea;
  const dark = 0x6b7aa8;
  const body = new Mesh(new CapsuleGeometry(1.3, 1.8, 6, 16), mat(white));
  body.position.y = 2.6;
  body.castShadow = true;
  const bodyFur = new Mesh(fur(220, 0.7, 1.32, 0.9, new Vector3(0, -0.6, 0), 5).rotateZ(Math.PI / 2), mat(white));
  body.add(bodyFur);
  const chest = new Mesh(new SphereGeometry(0.9, 14, 10), mat(dark));
  chest.scale.set(1.2, 1, 0.6);
  chest.position.set(0, 0.5, 1.0);
  body.add(chest);
  const head = new Group();
  head.position.set(0, 1.9, 0.5);
  const skull = new Mesh(new SphereGeometry(0.75, 16, 12), mat(white));
  skull.scale.set(1, 0.95, 1);
  const face = new Mesh(new SphereGeometry(0.5, 14, 10), mat(0x2a3360));
  face.scale.set(1.1, 1.0, 0.7);
  face.position.set(0, -0.1, 0.55);
  const brow = new Mesh(new BoxGeometry(1.1, 0.25, 0.5), mat(white));
  brow.position.set(0, 0.35, 0.6);
  const jaw = new Mesh(new BoxGeometry(0.7, 0.25, 0.5), mat(0x2a3360));
  jaw.position.set(0, -0.5, 0.5);
  head.add(skull, face, brow, jaw);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.11, 10, 8), mat(PALETTE.void, PALETTE.electric, 3));
    eye.position.set(side * 0.24, 0.1, 0.95);
    const halo = glowSprite(PALETTE.electric, 1.6, 0.7, true);
    halo.position.copy(eye.position);
    head.add(eye, halo);
    for (let t = 0; t < 2; t++) {
      const tooth = new Mesh(new ConeGeometry(0.04, 0.18, 4), mat(0xf0f0ff));
      tooth.position.set(side * (0.12 + t * 0.14), -0.42, 0.72);
      tooth.rotation.z = Math.PI;
      head.add(tooth);
    }
  }
  body.add(head);
  const limb = (len: number, r: number, furry: boolean) => {
    const pivot = new Group();
    const upper = new Mesh(new CapsuleGeometry(r, len * 0.5, 4, 10), mat(white));
    upper.position.y = -len * 0.3;
    upper.castShadow = true;
    if (furry) upper.add(new Mesh(fur(50, 0.45, r * 1.02, len * 0.25, new Vector3(0, -0.5, 0), 9), mat(white)));
    const joint = new Group();
    joint.position.y = -len * 0.55;
    const lower = new Mesh(new CapsuleGeometry(r * 0.85, len * 0.45, 4, 10), mat(white));
    lower.position.y = -len * 0.25;
    const hand = new Mesh(new SphereGeometry(r * 1.4, 10, 8), mat(0x2a3360));
    hand.position.y = -len * 0.5;
    joint.add(lower, hand);
    pivot.add(upper, joint);
    root.add(pivot);
    return pivot;
  };
  const armL = limb(3.2, 0.42, true);
  const armR = limb(3.2, 0.42, true);
  armL.position.set(-1.55, 3.9, 0.2);
  armR.position.set(1.55, 3.9, 0.2);
  const legL = limb(2.0, 0.42, false);
  const legR = limb(2.0, 0.42, false);
  legL.position.set(-0.65, 1.9, 0);
  legR.position.set(0.65, 1.9, 0);
  root.add(body);
  return {
    animate(c) {
      const kk = k(c.dt);
      const ph = c.time * 4.5;
      const sw = c.moving ? Math.sin(ph) * 0.5 : 0;
      let aL = c.moving ? -Math.sin(ph) * 0.4 + 0.1 : 0.1;
      let aR = c.moving ? Math.sin(ph) * 0.4 + 0.1 : 0.1;
      let lean = c.moving ? 0.25 : 0.1;
      let headPitch = 0;
      let outL = 0.35, outR = -0.35;
      if (c.state === 'windup') {
        if (c.attack === 'slam') { aL = aR = -2.9 * c.windup; outL = 0.25; outR = -0.25; lean = -0.25 * c.windup; }
        else if (c.attack === 'roar') { aL = aR = -1.6; outL = 1.2; outR = -1.2; lean = -0.45; headPitch = -0.6; }
        else if (c.attack === 'boulder') { aR = -2.6; outR = -0.6; aL = -0.4; lean = -0.15; }
        else { aL = aR = -1.2; lean = 0.2; }
      } else if (c.state === 'attack' || (c.state === 'recover' && c.stateTime < 0.3)) {
        if (c.attack === 'slam') { aL = aR = 0.9; lean = 0.55; }
        else if (c.attack === 'boulder') { aR = 1.2; outR = -0.3; lean = 0.3; }
        else if (c.attack === 'roar') { aL = aR = -1.4; outL = 1.3; outR = -1.3; lean = -0.5; headPitch = -0.7; }
        else { aL = aR = 0.7; lean = 0.4; }
      }
      armL.rotation.x = ease(armL.rotation.x, aL, kk);
      armR.rotation.x = ease(armR.rotation.x, aR, kk);
      armL.rotation.z = ease(armL.rotation.z, outL, kk);
      armR.rotation.z = ease(armR.rotation.z, outR, kk);
      legL.rotation.x = ease(legL.rotation.x, sw, kk);
      legR.rotation.x = ease(legR.rotation.x, -sw, kk);
      body.rotation.x = ease(body.rotation.x, lean, kk);
      body.position.y = 2.6 + (c.moving ? Math.abs(Math.cos(ph)) * 0.15 : 0);
      head.rotation.x = ease(head.rotation.x, headPitch, kk);
      jaw.position.y = -0.5 - (c.attack === 'roar' && c.state !== 'chase' ? 0.25 : 0.0);
    },
  };
}

/** Horned Shade: 6 m hooded wraith with long curling horns and blue eyes, floating in tattered robes. */
export function hornedShade(root: Group, mat: MatFn, horns = true, scale = 1): BossRig {
  const g = new Group();
  g.scale.setScalar(scale);
  const robeMat = mat(0x1a2150);
  const body = new Mesh(new ConeGeometry(1.6, 5.5, 14, 6, true), robeMat);
  body.position.y = 2.75;
  body.castShadow = true;
  (body.material as MeshStandardMaterial).side = DoubleSide;
  const tatters: Mesh[] = [];
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const t = new Mesh(new PlaneGeometry(0.5, 2.2 + (i % 3) * 0.6, 1, 4), robeMat);
    t.position.set(Math.cos(a) * 1.5, 0.6, Math.sin(a) * 1.5);
    t.rotation.y = -a;
    g.add(t);
    tatters.push(t);
  }
  const shoulders = new Mesh(new SphereGeometry(1.5, 14, 10), robeMat);
  shoulders.scale.set(1.4, 0.7, 0.9);
  shoulders.position.y = 5.2;
  const hood = new Mesh(new SphereGeometry(0.95, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.7), robeMat);
  hood.position.y = 6.3;
  hood.scale.set(1, 1.3, 1.1);
  const faceVoid = new Mesh(new SphereGeometry(0.7, 12, 10), mat(0x02030a));
  faceVoid.position.set(0, 6.1, 0.3);
  g.add(body, shoulders, hood, faceVoid);
  const eyes: Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.12, 10, 8), mat(PALETTE.void, PALETTE.electric, 4));
    eye.position.set(side * 0.28, 6.15, 0.85);
    const halo = glowSprite(PALETTE.electric, 2.6, 0.8, true);
    halo.position.copy(eye.position);
    g.add(eye, halo);
    eyes.push(eye);
    if (horns) {
      const hornMat = mat(0x0a0d2a);
      const base = new Mesh(new ConeGeometry(0.28, 2.6, 8), hornMat);
      base.position.set(side * 0.8, 7.4, 0);
      base.rotation.z = -side * 0.7;
      const curl = new Mesh(new ConeGeometry(0.16, 1.8, 7), hornMat);
      curl.position.set(side * 1.9, 8.4, -0.3);
      curl.rotation.z = -side * 1.6;
      const tip = new Mesh(new ConeGeometry(0.09, 1.2, 6), hornMat);
      tip.position.set(side * 2.6, 7.9, -0.5);
      tip.rotation.z = -side * 2.6;
      g.add(base, curl, tip);
    }
  }
  const arms: Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(side * 1.7, 5.2, 0.2);
    const arm = new Mesh(new CapsuleGeometry(0.22, 2.4, 4, 10), robeMat);
    arm.position.y = -1.3;
    const hand = new Mesh(new SphereGeometry(0.32, 10, 8), mat(0x02030a));
    hand.position.y = -2.7;
    for (let f = 0; f < 4; f++) {
      const finger = new Mesh(new ConeGeometry(0.05, 0.6, 5), mat(0x02030a));
      finger.position.set((f - 1.5) * 0.14, -3.1, 0.1);
      finger.rotation.z = Math.PI;
      pivot.add(finger);
    }
    const palmGlow = glowSprite(PALETTE.electric, 1.2, 0.35, true);
    palmGlow.position.y = -2.7;
    pivot.add(arm, hand, palmGlow);
    g.add(pivot);
    arms.push(pivot);
  }
  const aura = glowSprite(PALETTE.electric, 9, 0.18, true);
  aura.position.y = 4;
  g.add(aura);
  root.add(g);
  return {
    animate(c) {
      const kk = k(c.dt, 8);
      g.position.y = Math.sin(c.time * 1.2) * 0.3;
      let a = -0.3, out = 0.5, lean = 0.05;
      if (c.state === 'windup') {
        if (c.attack === 'volley') { a = -2.4 * c.windup; out = 0.3; lean = -0.2; }
        else if (c.attack === 'summon') { a = -2.9; out = 1.3; lean = -0.3; }
        else if (c.attack === 'blink') { a = -1.0; out = 1.6; }
        else { a = -1.9; out = 0.4; }
      } else if (c.state === 'attack' || (c.state === 'recover' && c.stateTime < 0.3)) {
        a = c.attack === 'sweep' ? 0.9 : -1.4; out = c.attack === 'sweep' ? -0.4 : 1.1; lean = 0.25;
      }
      arms.forEach((p, i) => { const side = i === 0 ? -1 : 1; p.rotation.x = ease(p.rotation.x, a, kk); p.rotation.z = ease(p.rotation.z, -side * out, kk); });
      body.rotation.x = ease(body.rotation.x, lean, kk);
      tatters.forEach((t, i) => { t.rotation.x = Math.sin(c.time * 3 + i) * 0.25 + 0.15; });
      aura.scale.setScalar(9 + Math.sin(c.time * 2.5) * 1);
    },
  };
}

/** Antlered Warden: 14 m tree giant with bark skin, antler crown and blue eyes, wading the river. */
export function antleredWarden(root: Group, mat: MatFn): BossRig {
  const barkMat = mat(0xffffff);
  barkMat.vertexColors = true;
  const part = (geo: BufferGeometry, seed: number, amp = 0.25) => { const r = rockify(geo, amp, 0.35, seed); tintRock(r, 0x4a3a58, 0x2f6a56, 0.6, seed); const m = new Mesh(r, barkMat); m.castShadow = true; return m; };
  const torso = part(new CylinderGeometry(1.9, 2.6, 7, 12, 6), 500);
  torso.position.y = 8.5;
  const hips = part(new SphereGeometry(2.4, 12, 9), 501);
  hips.position.y = 5.2;
  const head = new Group();
  head.position.y = 12.6;
  const skull = part(new SphereGeometry(1.3, 14, 10), 502, 0.15);
  skull.scale.set(1, 1.25, 1);
  head.add(skull);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.2, 10, 8), mat(PALETTE.void, PALETTE.electric, 3.5));
    eye.position.set(side * 0.5, 0.2, 1.1);
    const halo = glowSprite(PALETTE.electric, 1.8, 0.5, true);
    halo.position.copy(eye.position);
    head.add(eye, halo);
    const beam = part(new CylinderGeometry(0.12, 0.26, 4.5, 6, 3), 503 + side, 0.1);
    beam.position.set(side * 1.1, 2.6, -0.3);
    beam.rotation.z = -side * 0.55;
    head.add(beam);
    for (let t = 0; t < 4; t++) {
      const tine = part(new CylinderGeometry(0.05, 0.14, 1.6 + t * 0.4, 5, 2), 510 + t + side * 7, 0.05);
      tine.position.set(side * (1.4 + t * 0.55), 3.2 + t * 0.9, -0.3);
      tine.rotation.z = -side * (0.2 + t * 0.35);
      head.add(tine);
    }
  }
  torso.add(head);
  head.position.set(0, 4.3, 0);
  const limb = (len: number, r: number, seed: number) => {
    const pivot = new Group();
    const upper = part(new CylinderGeometry(r, r * 1.2, len * 0.5, 9, 4), seed);
    upper.position.y = -len * 0.25;
    const joint = new Group();
    joint.position.y = -len * 0.5;
    const lower = part(new CylinderGeometry(r * 0.8, r * 1.05, len * 0.5, 9, 4), seed + 1);
    lower.position.y = -len * 0.25;
    joint.add(lower);
    pivot.add(upper, joint);
    return pivot;
  };
  const armL = limb(7.5, 0.6, 520);
  const armR = limb(7.5, 0.6, 522);
  armL.position.set(-2.6, 11.2, 0);
  armR.position.set(2.6, 11.2, 0);
  const legL = limb(5.5, 0.85, 524);
  const legR = limb(5.5, 0.85, 526);
  legL.position.set(-1.3, 5.2, 0);
  legR.position.set(1.3, 5.2, 0);
  for (const a of [armL, armR]) {
    const hand = part(new SphereGeometry(0.9, 10, 8), 530);
    hand.position.y = -3.8;
    a.children[1].add(hand);
  }
  // Moss and leaves on the shoulders.
  for (let i = 0; i < 6; i++) {
    const leaf = new Mesh(new ConeGeometry(0.6, 2.4, 6), mat(0x163a33));
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 2.2, 12 + (i % 2) * 0.6, Math.sin(a) * 1.6);
    leaf.rotation.z = -Math.cos(a) * 0.8;
    leaf.rotation.x = Math.sin(a) * 0.8;
    root.add(leaf);
  }
  root.add(torso, hips, armL, armR, legL, legR);
  return {
    animate(c) {
      const kk = k(c.dt, 6);
      const ph = c.time * 1.6;
      const sw = c.moving ? Math.sin(ph) * 0.5 : 0;
      let aL = c.moving ? -Math.sin(ph) * 0.3 + 0.2 : 0.15, aR = c.moving ? Math.sin(ph) * 0.3 + 0.2 : 0.15;
      let outL = 0.25, outR = -0.25, lean = c.moving ? 0.12 : 0.04;
      if (c.state === 'windup') {
        if (c.attack === 'roots') { aL = aR = -2.6 * c.windup; lean = -0.2 * c.windup; }
        else if (c.attack === 'sweep') { aR = -1.2; outR = 1.4 * c.windup; lean = 0.1; }
        else { aL = aR = -1.6; }
      } else if (c.state === 'attack' || (c.state === 'recover' && c.stateTime < 0.4)) {
        if (c.attack === 'roots') { aL = aR = 1.0; lean = 0.5; }
        else if (c.attack === 'sweep') { aR = -0.6; outR = -1.5; lean = 0.2; }
        else { aL = aR = 0.8; lean = 0.4; }
      }
      armL.rotation.x = ease(armL.rotation.x, aL, kk);
      armR.rotation.x = ease(armR.rotation.x, aR, kk);
      armL.rotation.z = ease(armL.rotation.z, outL, kk);
      armR.rotation.z = ease(armR.rotation.z, outR, kk);
      armL.children[1].rotation.x = ease(armL.children[1].rotation.x, -0.4, kk);
      armR.children[1].rotation.x = ease(armR.children[1].rotation.x, -0.4, kk);
      legL.rotation.x = ease(legL.rotation.x, sw, kk);
      legR.rotation.x = ease(legR.rotation.x, -sw, kk);
      legL.children[1].rotation.x = ease(legL.children[1].rotation.x, Math.max(0, -Math.sin(ph)) * 0.6 * (c.moving ? 1 : 0), kk);
      legR.children[1].rotation.x = ease(legR.children[1].rotation.x, Math.max(0, Math.sin(ph)) * 0.6 * (c.moving ? 1 : 0), kk);
      torso.rotation.x = ease(torso.rotation.x, lean, kk);
      torso.rotation.z = c.moving ? Math.sin(ph) * 0.05 : 0;
      head.rotation.x = Math.sin(c.time * 0.7) * 0.05;
    },
  };
}

/** Moon Wyrm: 18 m wingspan dragon with bat wings, long neck and tail, blue fire in the throat. */
export function moonWyrm(root: Group, mat: MatFn): BossRig {
  const scale = mat(0x2a3878);
  const belly = mat(0x4a5aa8);
  const body = new Mesh(new CapsuleGeometry(1.3, 4.5, 6, 14).rotateZ(Math.PI / 2), scale);
  body.castShadow = true;
  const bellyM = new Mesh(new CapsuleGeometry(1.0, 4.2, 6, 12).rotateZ(Math.PI / 2), belly);
  bellyM.position.y = -0.5;
  body.add(bellyM);
  const neck = new Group();
  neck.position.set(2.6, 0.5, 0);
  const neckM = new Mesh(new CapsuleGeometry(0.6, 3.5, 5, 10).rotateZ(Math.PI / 2 - 0.5), scale);
  neckM.position.set(1.7, 0.8, 0);
  neck.add(neckM);
  const head = new Group();
  head.position.set(3.4, 1.8, 0);
  const skull = new Mesh(new BoxGeometry(1.6, 0.9, 0.9), scale);
  const snout = new Mesh(new BoxGeometry(1.4, 0.5, 0.7), scale);
  snout.position.set(1.3, -0.1, 0);
  const jaw = new Mesh(new BoxGeometry(1.3, 0.25, 0.6), belly);
  jaw.position.set(1.2, -0.45, 0);
  const throat = new Mesh(new SphereGeometry(0.35, 10, 8), mat(PALETTE.void, PALETTE.electric, 3.5));
  throat.position.set(1.0, -0.3, 0);
  const throatGlow = glowSprite(PALETTE.electric, 2.4, 0.5, true);
  throatGlow.position.copy(throat.position);
  head.add(skull, snout, jaw, throat, throatGlow);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.14, 10, 8), mat(PALETTE.void, PALETTE.electric, 3));
    eye.position.set(0.4, 0.2, side * 0.48);
    const halo = glowSprite(PALETTE.electric, 1.0, 0.5, true);
    halo.position.copy(eye.position);
    const horn = new Mesh(new ConeGeometry(0.12, 1.4, 6), scale);
    horn.position.set(-0.6, 0.5, side * 0.35);
    horn.rotation.z = 1.2;
    head.add(eye, halo, horn);
  }
  neck.add(head);
  body.add(neck);
  const tail = new Group();
  tail.position.set(-2.8, 0, 0);
  let prev: Group = tail;
  const tailSegs: Group[] = [];
  for (let i = 0; i < 7; i++) {
    const seg = new Group();
    const m = new Mesh(new CapsuleGeometry(0.55 * (1 - i / 8), 1.3, 4, 8).rotateZ(Math.PI / 2), scale);
    m.position.x = -0.8;
    seg.add(m);
    seg.position.x = i === 0 ? 0 : -1.5;
    prev.add(seg);
    prev = seg;
    tailSegs.push(seg);
  }
  const fin = new Mesh(new ConeGeometry(0.5, 1.6, 4), scale);
  fin.rotation.z = Math.PI / 2;
  fin.position.x = -1.6;
  prev.add(fin);
  body.add(tail);
  const wings: Group[] = [];
  const membrane = new MeshBasicMaterial({ color: 0x1c2460, side: DoubleSide, transparent: true, opacity: 0.9 });
  for (const side of [-1, 1]) {
    const wing = new Group();
    wing.position.set(0.4, 0.9, side * 1.0);
    const bone1 = new Mesh(new CylinderGeometry(0.12, 0.18, 5.5, 6).rotateX(Math.PI / 2), scale);
    bone1.position.z = side * 2.75;
    const elbow = new Group();
    elbow.position.z = side * 5.5;
    const bone2 = new Mesh(new CylinderGeometry(0.08, 0.12, 5.5, 6).rotateX(Math.PI / 2), scale);
    bone2.position.z = side * 2.75;
    elbow.add(bone2);
    const geo = new BufferGeometry();
    const pts = [0, 0, 0, -3.5, -0.3, side * 5.5, -1.5, -0.2, side * 5.5, -4.5, -0.6, side * 11, -2.0, -0.3, side * 11, 0.5, 0, side * 11];
    geo.setAttribute('position', new (Object.getPrototypeOf(new PlaneGeometry().attributes.position).constructor)(new Float32Array(pts), 3));
    geo.setIndex([0, 1, 2, 2, 3, 4, 4, 5, 2, 1, 3, 2]);
    geo.computeVertexNormals();
    const mem = new Mesh(geo, membrane);
    wing.add(bone1, elbow, mem);
    const inner = new Mesh(new PlaneGeometry(4, 5.5), membrane);
    inner.position.set(-1.6, -0.2, side * 2.75);
    inner.rotation.x = Math.PI / 2;
    wing.add(inner);
    body.add(wing);
    wings.push(wing);
    wing.userData.elbow = elbow;
  }
  root.add(body);
  return {
    animate(c) {
      const kk = k(c.dt, 8);
      const flap = Math.sin(c.time * 3.2);
      const flapAmt = c.state === 'windup' ? 0.35 : 0.7;
      wings.forEach((w, i) => {
        const side = i === 0 ? -1 : 1;
        w.rotation.x = -side * flap * flapAmt;
        (w.userData.elbow as Group).rotation.x = -side * (flap * 0.4 + 0.25);
      });
      body.position.y = Math.sin(c.time * 3.2 + 1.2) * 0.25;
      let neckPitch = -0.1, lean = 0;
      if (c.state === 'windup' && c.attack === 'breath') { neckPitch = -0.6 + c.windup * 0.2; }
      else if (c.state === 'windup' && c.attack === 'charge') { neckPitch = 0.3; lean = 0.25; }
      else if (c.state === 'attack' || (c.state === 'recover' && c.stateTime < 0.5)) { neckPitch = c.attack === 'breath' ? 0.5 : 0.2; lean = c.attack === 'charge' ? 0.5 : 0; }
      neck.rotation.z = ease(neck.rotation.z, neckPitch, kk);
      body.rotation.x = ease(body.rotation.x, lean, kk);
      jaw.position.y = -0.45 - (c.attack === 'breath' && c.state !== 'chase' ? 0.3 : 0);
      throatGlow.scale.setScalar(c.attack === 'breath' && c.state === 'windup' ? 2.4 + c.windup * 3 : 2.4);
      tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(c.time * 2 - i * 0.5) * 0.18; s.rotation.z = Math.sin(c.time * 1.5 - i * 0.4) * 0.08; });
    },
  };
}

/** Crocodile: low, long, armoured, glowing eyes; snaps. */
export function crocodile(root: Group, mat: MatFn): BossRig {
  const hide = mat(0x245a3a);
  const body = new Mesh(new CapsuleGeometry(0.45, 2.6, 5, 10).rotateZ(Math.PI / 2), hide);
  body.position.y = 0.45;
  body.castShadow = true;
  const ridges = new Mesh(fur(50, 0.3, 0.46, 1.2, new Vector3(0, 1, 0), 21).rotateZ(Math.PI / 2), mat(0x0a2014));
  body.add(ridges);
  const head = new Group();
  head.position.set(1.6, 0.05, 0);
  const snout = new Mesh(new BoxGeometry(1.6, 0.32, 0.7), hide);
  snout.position.x = 0.8;
  const jaw = new Mesh(new BoxGeometry(1.5, 0.14, 0.62), mat(0x0a2014));
  jaw.position.set(0.8, -0.22, 0);
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.09, 8, 6), mat(PALETTE.void, PALETTE.witch, 2.5));
    eye.position.set(0.15, 0.24, side * 0.3);
    head.add(eye);
    for (let t = 0; t < 4; t++) {
      const tooth = new Mesh(new ConeGeometry(0.03, 0.12, 4), mat(0xf0f0ff));
      tooth.position.set(0.3 + t * 0.32, -0.14, side * 0.3);
      tooth.rotation.z = Math.PI;
      head.add(tooth);
    }
  }
  head.add(snout, jaw);
  body.add(head);
  const tail = new Group();
  tail.position.x = -1.7;
  const tailSegs: Group[] = [];
  let prev: Group = tail;
  for (let i = 0; i < 5; i++) {
    const seg = new Group();
    const m = new Mesh(new CapsuleGeometry(0.3 * (1 - i / 6), 0.8, 4, 8).rotateZ(Math.PI / 2), hide);
    m.position.x = -0.5;
    seg.add(m);
    seg.position.x = i === 0 ? 0 : -0.95;
    prev.add(seg);
    prev = seg;
    tailSegs.push(seg);
  }
  body.add(tail);
  const legs: Group[] = [];
  for (const [lx, lz] of [[0.9, -0.55], [0.9, 0.55], [-0.9, -0.55], [-0.9, 0.55]] as const) {
    const pivot = new Group();
    pivot.position.set(lx, 0.35, lz);
    const upper = new Mesh(new CapsuleGeometry(0.13, 0.4, 3, 8).rotateX(Math.PI / 2), hide);
    upper.position.z = Math.sign(lz) * 0.25;
    const lower = new Mesh(new CapsuleGeometry(0.1, 0.35, 3, 8), hide);
    lower.position.set(0, -0.2, Math.sign(lz) * 0.5);
    pivot.add(upper, lower);
    root.add(pivot);
    legs.push(pivot);
  }
  root.add(body);
  return {
    animate(c) {
      const kk = k(c.dt);
      const ph = c.time * 7;
      legs.forEach((l, i) => { l.rotation.y = c.moving ? Math.sin(ph + (i % 2 ? Math.PI : 0)) * 0.5 : 0; });
      body.rotation.y = c.moving ? Math.sin(ph) * 0.08 : 0;
      tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(c.time * (c.moving ? 7 : 2) - i * 0.6) * 0.3; });
      let open = 0.05;
      if (c.state === 'windup') open = 0.9 * c.windup;
      else if (c.state === 'attack') open = 0.0;
      jaw.rotation.z = ease(jaw.rotation.z, open, kk);
      head.rotation.z = ease(head.rotation.z, c.state === 'windup' ? -0.3 : 0, kk);
    },
  };
}

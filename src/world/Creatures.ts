import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry, CircleGeometry, Color, ConeGeometry,
  CylinderGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, Points,
  PointsMaterial, ShaderMaterial, SphereGeometry, Vector3, type MeshStandardMaterial,
} from 'three';
import { Rig } from '../characters/Rig';
import { WITCH } from '../characters/roster';
import { surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import { moonTexture } from '../render/Sky';
import type { Footprint } from './Colliders';
import { rockify, tintRock } from './geometry';
import { glowSprite, glowTexture, type Landmark } from './Landmarks';

/** Warm orange-red: the one allowed warm accent, reserved for the frog king's eyes. */
const FROG_EYE = 0xff6a2a;

/** The Astral Frog King: a 6 m star-speckled frog in a mossy hollow. Breathes, pulses its throat, blinks, watches the player. */
export function frogKing(x: number, z: number, baseY: number): Landmark {
  const g = new Group();
  const bodyGeo = rockify(new SphereGeometry(2.7, 40, 28), 0.14, 1.1, 21);
  bodyGeo.scale(1.3, 0.8, 1.15);
  tintRock(bodyGeo, 0x1b1f52, 0x1f4d46, 0.35, 21);
  // Star speckles: lighten a few vertices.
  const col = bodyGeo.attributes.color as BufferAttribute;
  for (let i = 0; i < col.count; i++) if (Math.random() < 0.04) col.setXYZ(i, 0.85, 0.9, 1.2);
  const body = new Mesh(bodyGeo, surface({ vertexColors: true, roughness: 0.6 }));
  body.position.y = 2.1;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);
  const headGeo = rockify(new SphereGeometry(2.0, 32, 22), 0.1, 1.2, 22);
  headGeo.scale(1.25, 0.75, 1.1);
  tintRock(headGeo, 0x1d2258, 0x1f4d46, 0.25, 22);
  const head = new Mesh(headGeo, surface({ vertexColors: true, roughness: 0.6 }));
  head.position.set(0, 3.3, 2.0);
  head.castShadow = true;
  g.add(head);
  const eyeMats: MeshStandardMaterial[] = [];
  const lids: Mesh[] = [];
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.5, 18, 14), surface({ color: 0x1a0a05, emissive: FROG_EYE, emissiveIntensity: 1.8, roughness: 0.2 }));
    eye.position.set(side * 1.35, 1.1, 0.9);
    const pupil = new Mesh(new BoxGeometry(0.16, 0.5, 0.3), surface({ color: PALETTE.void }));
    pupil.position.set(side * 1.35, 1.1, 1.36);
    const lid = new Mesh(new SphereGeometry(0.54, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), surface({ vertexColors: false, color: 0x1d2258 }));
    lid.position.copy(eye.position);
    lid.scale.y = 0.05;
    const halo = glowSprite(FROG_EYE, 1.8, 0.4, true);
    halo.position.copy(eye.position);
    head.add(eye, pupil, lid, halo);
    eyeMats.push(eye.material as MeshStandardMaterial);
    lids.push(lid);
  }
  const mouth = new Mesh(new BoxGeometry(3.2, 0.06, 0.1), surface({ color: PALETTE.void }));
  mouth.position.set(0, -0.35, 2.1);
  head.add(mouth);
  const throat = new Mesh(new SphereGeometry(1.1, 20, 14), surface({ color: 0x2a2f6a, roughness: 0.5 }));
  throat.position.set(0, 1.6, 2.6);
  g.add(throat);
  // Crown of astral crystals.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const crystal = new Mesh(new ConeGeometry(0.16, 0.7 + (i % 2) * 0.3, 5), surface({ color: PALETTE.void, emissive: PALETTE.dusk, emissiveIntensity: 1.5 }));
    crystal.position.set(Math.cos(a) * 1.1, 1.6, Math.sin(a) * 1.1 - 0.3);
    crystal.rotation.z = -Math.cos(a) * 0.4;
    crystal.rotation.x = Math.sin(a) * 0.4;
    head.add(crystal);
  }
  // Legs: folded hind legs and small front legs.
  const legMat = surface({ color: 0x1a1e4e, roughness: 0.65 });
  for (const side of [-1, 1]) {
    const thigh = new Mesh(new SphereGeometry(1.25, 18, 12), legMat);
    thigh.scale.set(1, 0.7, 1.4);
    thigh.position.set(side * 2.9, 1.0, -1.2);
    thigh.castShadow = true;
    const foot = new Mesh(new BoxGeometry(1.6, 0.3, 2.4), legMat);
    foot.position.set(side * 3.3, 0.15, 0.4);
    const front = new Mesh(new CapsuleGeometry(0.32, 1.2, 4, 10), legMat);
    front.position.set(side * 2.0, 1.0, 2.6);
    front.rotation.x = 0.4;
    front.rotation.z = side * 0.25;
    g.add(thigh, foot, front);
  }
  // Astral sparkle on the back.
  const sparkPos: number[] = [];
  for (let i = 0; i < 90; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 0.45;
    sparkPos.push(Math.cos(u) * Math.cos(v) * 3.55, 2.1 + Math.sin(v) * 2.25, Math.sin(u) * Math.cos(v) * 3.15);
  }
  const sparkGeo = new BufferGeometry();
  sparkGeo.setAttribute('position', new Float32BufferAttribute(sparkPos, 3));
  const sparks = new Points(sparkGeo, new PointsMaterial({ map: glowTexture(), color: PALETTE.moon, size: 0.45, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false }));
  g.add(sparks);
  g.position.set(x, baseY, z);
  let t = 0;
  let blink = 3;
  const target = new Vector3();
  return {
    object: g,
    footprints: [{ kind: 'cyl', x, z, r: 3.6, top: baseY + 3.6 }],
    update(dt, player) {
      t += dt;
      body.scale.y = 1 + Math.sin(t * 2.2) * 0.025;
      throat.scale.setScalar(1 + Math.max(0, Math.sin(t * 6.5)) * 0.28);
      blink -= dt;
      const closing = blink < 0.18 ? 1 - Math.abs(blink - 0.09) / 0.09 : 0;
      for (const l of lids) l.scale.y = 0.05 + Math.max(0, closing) * 0.95;
      if (blink < 0) blink = 3 + Math.random() * 5;
      for (const m of eyeMats) m.emissiveIntensity = 1.6 + Math.sin(t * 1.3) * 0.3;
      // Head turns slowly toward the player.
      target.copy(player).sub(g.position);
      const yaw = Math.atan2(target.x, target.z);
      const clamped = Math.max(-0.6, Math.min(0.6, yaw));
      head.rotation.y += (clamped - head.rotation.y) * Math.min(1, dt * 0.8);
      sparks.rotation.y = Math.sin(t * 0.3) * 0.02;
    },
  };
}

/** Colossal snail whose shell is a moon. Crawls along a loop on the cliffs leaving a glowing trail. */
export function moonShellColossus(path: Array<[number, number]>, heightAt: (x: number, z: number) => number): Landmark {
  const g = new Group();
  const bodyGeo = rockify(new CapsuleGeometry(3.2, 15, 6, 18), 0.25, 0.5, 31);
  bodyGeo.rotateZ(Math.PI / 2);
  tintRock(bodyGeo, 0x242a5c, 0x1f4d46, 0.2, 31);
  const body = new Mesh(bodyGeo, surface({ vertexColors: true, roughness: 0.55 }));
  body.position.y = 3.0;
  body.castShadow = true;
  g.add(body);
  const shell = new Mesh(new SphereGeometry(8.5, 48, 32), surface({ map: moonTexture(), color: 0xdfe6ff, emissive: 0x8fa2ff, emissiveIntensity: 0.35, roughness: 0.7 }));
  shell.position.set(-2, 9.5, 0);
  shell.rotation.z = 0.3;
  shell.castShadow = true;
  g.add(shell);
  const shellHalo = glowSprite(PALETTE.electric, 30, 0.25, true);
  shellHalo.position.copy(shell.position);
  g.add(shellHalo);
  const stalkMat = surface({ color: 0x2a3068 });
  for (const side of [-1, 1]) {
    const stalk = new Mesh(new CylinderGeometry(0.22, 0.35, 5, 10), stalkMat);
    stalk.position.set(9.5, 5.5, side * 1.2);
    stalk.rotation.z = -0.45;
    stalk.rotation.x = side * 0.25;
    const eye = new Mesh(new SphereGeometry(0.6, 14, 10), surface({ color: PALETTE.void, emissive: PALETTE.moon, emissiveIntensity: 2.5 }));
    eye.position.set(10.8, 7.8, side * 1.9);
    const halo = glowSprite(PALETTE.moon, 3, 0.5, true);
    halo.position.copy(eye.position);
    g.add(stalk, eye, halo);
  }
  const trail: Mesh[] = [];
  const trailMat = new MeshBasicMaterial({ color: PALETTE.electric, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  let seg = 0;
  let along = 0;
  let sinceDrop = 0;
  const pos = new Vector3(path[0][0], 0, path[0][1]);
  const lookTarget = new Vector3();
  return {
    object: g,
    footprints: [],
    update(dt) {
      const a = path[seg];
      const b = path[(seg + 1) % path.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      along += dt * 0.9;
      if (along >= len) { along = 0; seg = (seg + 1) % path.length; }
      const t = Math.min(1, along / len);
      pos.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
      pos.y = Math.max(heightAt(pos.x, pos.z), -20) - 0.5;
      g.position.lerp(pos, Math.min(1, dt * 2));
      lookTarget.set(b[0], g.position.y, b[1]);
      const yaw = Math.atan2(lookTarget.x - g.position.x, lookTarget.z - g.position.z) - Math.PI / 2;
      g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt);
      body.scale.x = 1 + Math.sin(along * 1.2) * 0.04;
      sinceDrop += dt;
      if (sinceDrop > 4) {
        sinceDrop = 0;
        const disc = new Mesh(new CircleGeometry(4.5, 16), trailMat.clone());
        disc.rotation.x = -Math.PI / 2;
        disc.position.set(g.position.x, g.position.y + 0.55, g.position.z);
        g.parent?.add(disc);
        trail.push(disc);
        if (trail.length > 24) { const old = trail.shift()!; old.parent?.remove(old); }
      }
      for (let i = 0; i < trail.length; i++) (trail[i].material as MeshBasicMaterial).opacity = 0.05 + (i / trail.length) * 0.3;
    },
  };
}

const STREAM_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld;
void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`;
const STREAM_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColorA; uniform vec3 uColorB;
varying vec2 vUv; varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vWorld.xz * 0.35 + vec2(0.0, -uTime * 0.9);
  float n = vnoise(p) * 0.5 + vnoise(p * 2.3 + vec2(uTime * 0.2, 0.0)) * 0.3 + vnoise(p * 5.0) * 0.2;
  float edge = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
  vec3 c = mix(uColorA, uColorB, smoothstep(0.35, 0.75, n));
  gl_FragColor = vec4(c * (0.6 + n * 0.8), edge * 0.85);
}`;

/** Glowing acid-green stream in its ravine, a stone bridge across it, and a witch coven circling a cauldron on the bridge. */
export function witchBridge(streamX: number, zMin: number, zMax: number, bridgeZ: number, heightAt: (x: number, z: number) => number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const length = zMax - zMin;
  const water = new Mesh(new PlaneGeometry(11, length, 1, 1), new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColorA: { value: new Color(PALETTE.witch).multiplyScalar(0.6) }, uColorB: { value: new Color(PALETTE.rune).multiplyScalar(0.7) } },
    vertexShader: STREAM_VERT, fragmentShader: STREAM_FRAG, transparent: true, depthWrite: false, side: DoubleSide,
  }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(streamX, heightAt(streamX, (zMin + zMax) / 2) + 0.35, (zMin + zMax) / 2);
  g.add(water);
  for (let z = zMin + 6; z < zMax; z += 12) {
    const glow = glowSprite(PALETTE.witch, 9, 0.22, true);
    glow.position.set(streamX, heightAt(streamX, z) + 1.5, z);
    g.add(glow);
  }
  const light = new PointLight(PALETTE.witch, 22, 20, 1.8);
  light.position.set(streamX, heightAt(streamX, bridgeZ) + 3, bridgeZ);
  g.add(light);

  // Bridge: deck across the ravine with parapets and two piers.
  const deckY = heightAt(streamX - 9, bridgeZ) + 0.6;
  const deckGeo = rockify(new BoxGeometry(22, 0.9, 5, 10, 1, 4), 0.06, 0.8, 41);
  tintRock(deckGeo, 0x3b4478, 0x1f4d46, 0.35, 41);
  const deck = new Mesh(deckGeo, surface({ vertexColors: true }));
  deck.position.set(streamX, deckY, bridgeZ);
  deck.castShadow = true;
  deck.receiveShadow = true;
  g.add(deck);
  footprints.push({ kind: 'box', x: streamX, z: bridgeZ, hw: 11, hd: 2.5, top: deckY + 0.45 });
  for (const side of [-1, 1]) {
    const parapet = new Mesh(new BoxGeometry(22, 0.8, 0.4), surface({ color: 0x2f3868 }));
    parapet.position.set(streamX, deckY + 0.85, bridgeZ + side * 2.3);
    parapet.castShadow = true;
    g.add(parapet);
    footprints.push({ kind: 'box', x: streamX, z: bridgeZ + side * 2.3, hw: 11, hd: 0.2, top: deckY + 1.25 });
    const pier = new Mesh(new BoxGeometry(2.4, 6, 4), surface({ color: 0x2a3160 }));
    pier.position.set(streamX + side * 4, deckY - 3.2, bridgeZ);
    g.add(pier);
  }
  // Cauldron with green fire.
  const cauldron = new Mesh(new CylinderGeometry(0.75, 0.55, 0.9, 14), surface({ color: 0x0b0d22, roughness: 0.4, metalness: 0.6 }));
  cauldron.position.set(streamX, deckY + 0.9, bridgeZ);
  cauldron.castShadow = true;
  const brew = new Mesh(new CircleGeometry(0.68, 16), new MeshBasicMaterial({ color: new Color(PALETTE.witch).multiplyScalar(1.3), toneMapped: false }));
  brew.rotation.x = -Math.PI / 2;
  brew.position.set(streamX, deckY + 1.36, bridgeZ);
  const fire = glowSprite(PALETTE.witch, 5, 0.6, true);
  fire.position.set(streamX, deckY + 2.2, bridgeZ);
  const fireLight = new PointLight(PALETTE.witch, 30, 14, 2);
  fireLight.position.set(streamX, deckY + 2.5, bridgeZ);
  g.add(cauldron, brew, fire, fireLight);
  footprints.push({ kind: 'cyl', x: streamX, z: bridgeZ, r: 0.8, top: deckY + 1.4 });
  // Bubbles rising from the brew.
  const bubblePos: number[] = [];
  const bubbleSeed: number[] = [];
  for (let i = 0; i < 40; i++) { bubblePos.push(0, 0, 0); bubbleSeed.push(Math.random()); }
  const bubbleGeo = new BufferGeometry();
  bubbleGeo.setAttribute('position', new Float32BufferAttribute(bubblePos, 3));
  const bubbleAttr = bubbleGeo.attributes.position as BufferAttribute;
  const bubbles = new Points(bubbleGeo, new PointsMaterial({ map: glowTexture(), color: PALETTE.witch, size: 0.35, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  bubbles.frustumCulled = false;
  g.add(bubbles);
  // Three witches circling the cauldron.
  const witches: Rig[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new Rig(WITCH);
    g.add(r.root);
    witches.push(r);
  }
  let t = 0;
  return {
    object: g,
    footprints,
    update(dt) {
      t += dt;
      (water.material as ShaderMaterial).uniforms.uTime.value = t;
      fire.scale.setScalar(5 + Math.sin(t * 7) * 0.5 + Math.sin(t * 13) * 0.3);
      fireLight.intensity = 26 + Math.sin(t * 9) * 6;
      for (let i = 0; i < 40; i++) {
        const life = (t * (0.5 + bubbleSeed[i] * 0.5) + bubbleSeed[i] * 7) % 1.6;
        const a = bubbleSeed[i] * Math.PI * 2 + life * 2;
        bubbleAttr.setXYZ(i, streamX + Math.cos(a) * 0.4 * (1 + life), deckY + 1.4 + life * 2.2, bridgeZ + Math.sin(a) * 0.4 * (1 + life));
      }
      bubbleAttr.needsUpdate = true;
      for (let i = 0; i < witches.length; i++) {
        const a = t * 0.55 + (i / 3) * Math.PI * 2;
        const rad = 2.6 + Math.sin(t * 1.3 + i) * 0.3;
        const wx = streamX + Math.cos(a) * rad;
        const wz = bridgeZ + Math.sin(a) * rad * 0.7;
        const r = witches[i];
        r.root.position.set(wx, deckY + 0.45 + Math.abs(Math.sin(t * 2.2 + i * 2)) * 0.12, wz);
        // Face along the circle (tangent), yaw convention: 0 faces +x.
        const yaw = Math.atan2(Math.cos(a) * 0.7, -Math.sin(a));
        r.root.rotation.y = -yaw - Math.PI / 2;
        r.animate({ mode: 'ground', speed: 1.6 + Math.sin(t * 1.1 + i) * 0.4, attack: i === Math.floor(t / 3) % 3 ? undefined : ((t * 0.5) % 1), attackKind: 'skill' }, dt);
      }
    },
  };
}

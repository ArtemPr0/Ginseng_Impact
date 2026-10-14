/**
 * The witch stream: acid-green water shader in its ravine, glow sprites, the cauldron's green fire and
 * bubbles on the bridge, and the three coven witches circling it. The bridge deck itself is a walkway slab
 * (Walkways.ts) and the cauldron a Meshy model; this file is effects and characters only.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Mesh, PlaneGeometry, PointLight, Points,
  PointsMaterial, ShaderMaterial,
} from 'three';
import { Rig } from '../characters/Rig';
import { WITCH } from '../characters/roster';
import { glowSprite, glowTexture } from '../render/Glow';
import { PALETTE } from '../render/palette';
import type { Landmark } from './Landmarks';

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

export function witchStream(streamX: number, zMin: number, zMax: number, bridgeZ: number, deckY: number, heightAt: (x: number, z: number) => number): Landmark {
  const g = new Group();
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
  // Green fire over the cauldron.
  const fire = glowSprite(PALETTE.witch, 5, 0.6, true);
  fire.position.set(streamX, deckY + 2.2, bridgeZ);
  const fireLight = new PointLight(PALETTE.witch, 30, 14, 2);
  fireLight.position.set(streamX, deckY + 2.5, bridgeZ);
  g.add(fire, fireLight);
  const bubblePos: number[] = [];
  const bubbleSeed: number[] = [];
  for (let i = 0; i < 40; i++) { bubblePos.push(0, 0, 0); bubbleSeed.push(Math.random()); }
  const bubbleGeo = new BufferGeometry();
  bubbleGeo.setAttribute('position', new Float32BufferAttribute(bubblePos, 3));
  const bubbleAttr = bubbleGeo.attributes.position as BufferAttribute;
  const bubbles = new Points(bubbleGeo, new PointsMaterial({ map: glowTexture(), color: PALETTE.witch, size: 0.35, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  bubbles.frustumCulled = false;
  g.add(bubbles);
  const witches: Rig[] = [];
  for (let i = 0; i < 3; i++) {
    const r = new Rig(WITCH);
    g.add(r.root);
    witches.push(r);
  }
  let t = 0;
  return {
    object: g,
    footprints: [],
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
        const r = witches[i];
        r.root.position.set(streamX + Math.cos(a) * rad, deckY + 0.45 + Math.abs(Math.sin(t * 2.2 + i * 2)) * 0.12, bridgeZ + Math.sin(a) * rad * 0.7);
        const yaw = Math.atan2(Math.cos(a) * 0.7, -Math.sin(a));
        r.root.rotation.y = -yaw - Math.PI / 2;
        r.animate({ mode: 'ground', speed: 1.6 + Math.sin(t * 1.1 + i) * 0.4, attack: i === Math.floor(t / 3) % 3 ? undefined : ((t * 0.5) % 1), attackKind: 'skill' }, dt);
      }
    },
  };
}

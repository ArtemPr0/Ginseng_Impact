/**
 * Waterfalls (#28, 01.22.56, the whale reel's koi tiers): a curved ribbon of layered falling streaks with a luminous
 * core that blooms, ragged edges and a thin mist veil, and at the foot a splash ring, spray and rising mist. Pure
 * effect, kept procedural.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, PlaneGeometry, Points, RingGeometry,
  ShaderMaterial, Vector3,
} from 'three';
import { glowSprite, glowTexture } from '../render/Glow';
import type { Landmark } from './Landmarks';

const FALL_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FALL_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uHeight; uniform float uWidth; uniform float uVeil; uniform float uSeed;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // uv.y: 1 at the lip, 0 at the foot. Water falls in distinct strands with dark gaps between them, faster as it drops.
  float fall = 1.0 - vUv.y;
  float x = vUv.x * uWidth;
  float y = fall * uHeight;
  float drop = y - uTime * (7.0 + fall * 5.0);
  // Strands: thin bright ribbons across the width (fixed lanes that wobble a little).
  float lane = vnoise(vec2(x * 2.6 + uSeed, y * 0.04));
  float strands = smoothstep(0.42, 0.75, lane);
  // Clumps of water racing down each strand.
  float clumps = vnoise(vec2(x * 3.5 - uSeed, drop * 0.22)) * 0.6 + vnoise(vec2(x * 8.0, drop * 0.6)) * 0.4;
  float body = strands * (0.35 + clumps * 0.9);
  float across = abs(vUv.x - 0.5) * 2.0;
  float edgeNoise = vnoise(vec2(drop * 0.15, vUv.x * 5.0 + uSeed));
  float edge = 1.0 - smoothstep(0.55 + edgeNoise * 0.35, 1.0, across);
  float lip = smoothstep(0.0, 0.03, vUv.y);
  // Near the foot the strands break into spray.
  float foot = smoothstep(0.82, 1.0, fall);
  float alpha = edge * lip * clamp(body + 0.12, 0.0, 1.0) * (1.0 - foot * 0.5) * uVeil;
  vec3 c = uColor * (0.35 + body * 1.1);
  c += vec3(0.75, 0.9, 1.0) * smoothstep(0.8, 1.0, clumps) * strands * 0.7;
  if (alpha < 0.01) discard;
  gl_FragColor = vec4(c, alpha);
}`;

const RING_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
void main() {
  // RingGeometry uv: radial position in uv.x after we remap (see geometry), rings run outward.
  float r = vUv.x;
  float w = 0.5 + 0.5 * sin(r * 26.0 - uTime * 5.0);
  float a = (1.0 - r) * smoothstep(0.0, 0.15, r) * (0.35 + w * 0.5);
  gl_FragColor = vec4(uColor * (0.8 + w * 0.6), a);
}`;

export interface CascadeOptions {
  /** Where the water leaves its lip (world). */
  x: number;
  z: number;
  top: number;
  /** Drop to the foot, and width at the lip (metres). */
  height: number;
  width: number;
  /** Direction the water falls away from its cliff (radians, 0 = toward +z). */
  yaw?: number;
  /** How far the water arcs out from the lip before it drops (metres). */
  curve?: number;
  color?: Color;
}

const BLUE = new Color(0.22, 0.55, 1.35);

/** A glowing waterfall with its foot effects (see the file comment). */
export function cascade(o: CascadeOptions): Landmark {
  const color = o.color ?? BLUE;
  const curve = o.curve ?? Math.min(3, o.height * 0.12);
  const yaw = o.yaw ?? 0;
  const g = new Group();
  g.position.set(o.x, 0, o.z);
  g.rotation.y = yaw;
  const seed = (Math.abs(o.x * 13.1 + o.z * 7.7) % 50);
  const mats: ShaderMaterial[] = [];
  // The ribbon: the water arcs out from the lip and then falls straight (a curve that flattens as it drops).
  const ribbon = (width: number, veil: number, out: number) => {
    const geo = new PlaneGeometry(width, o.height, 1, 24);
    const pos = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const fall = 1 - (pos.getY(i) / o.height + 0.5);
      pos.setXYZ(i, pos.getX(i), o.top - fall * o.height, Math.sqrt(Math.max(0, fall)) * curve + out);
    }
    geo.computeVertexNormals();
    const mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: color.clone() }, uHeight: { value: o.height }, uWidth: { value: width }, uVeil: { value: veil }, uSeed: { value: seed + out * 10 } },
      vertexShader: FALL_VERT, fragmentShader: FALL_FRAG, transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, fog: false,
    });
    mats.push(mat);
    const m = new Mesh(geo, mat);
    m.renderOrder = 4;
    g.add(m);
  };
  ribbon(o.width, 1, 0.15);
  ribbon(o.width * 1.5, 0.35, 0.7);
  const footY = o.top - o.height;
  const footZ = curve + 0.4;
  // Splash ring on the water at the foot.
  const ringGeo = new RingGeometry(0.1, o.width * 1.3 + 1, 32, 1);
  const ruv = ringGeo.attributes.uv as BufferAttribute;
  const rpos = ringGeo.attributes.position as BufferAttribute;
  const outer = o.width * 1.3 + 1;
  for (let i = 0; i < rpos.count; i++) ruv.setXY(i, Math.hypot(rpos.getX(i), rpos.getY(i)) / outer, 0);
  const ringMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: color.clone().multiplyScalar(0.8) } },
    vertexShader: FALL_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  });
  const ring = new Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, footY + 0.08, footZ);
  ring.renderOrder = 5;
  g.add(ring);
  // Mist rising from the foot.
  const mists = [0, 1, 2].map((i) => {
    const sp = glowSprite(color.getHex(), o.width * (1.6 + i * 0.6), 0.22, true);
    sp.position.set((i - 1) * o.width * 0.3, footY + 1 + i * 1.2, footZ);
    g.add(sp);
    return sp;
  });
  // Spray: droplets thrown up and out of the foot that fall back.
  const n = Math.round(30 + o.width * 12);
  const spray = new Float32Array(n * 3);
  const vel: Vector3[] = [];
  const reset = (i: number) => {
    spray[i * 3] = (Math.random() - 0.5) * o.width;
    spray[i * 3 + 1] = footY + 0.1;
    spray[i * 3 + 2] = footZ + (Math.random() - 0.3) * 0.8;
    vel[i] = new Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 4, (Math.random() - 0.2) * 3);
  };
  for (let i = 0; i < n; i++) { reset(i); spray[i * 3 + 1] += Math.random() * 2; }
  const sg = new BufferGeometry();
  sg.setAttribute('position', new BufferAttribute(spray, 3));
  const sparkMat = new ShaderMaterial({
    uniforms: { uColor: { value: color.clone() }, uMap: { value: glowTexture() } },
    vertexShader: 'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 90.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform sampler2D uMap; void main() { float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(uColor * 1.4, a * 0.8); }',
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  });
  const points = new Points(sg, sparkMat);
  points.frustumCulled = false;
  g.add(points);
  const sattr = sg.attributes.position as BufferAttribute;
  let t = 0;
  return {
    object: g,
    footprints: [],
    update(dt) {
      t += dt;
      for (const m of mats) m.uniforms.uTime.value = t;
      ringMat.uniforms.uTime.value = t;
      mists.forEach((sp, i) => {
        sp.material.opacity = 0.16 + Math.sin(t * 0.8 + i * 2.1) * 0.06;
        sp.position.y = footY + 1 + i * 1.2 + Math.sin(t * 0.5 + i) * 0.4;
      });
      for (let i = 0; i < n; i++) {
        vel[i].y -= 9.8 * dt;
        spray[i * 3] += vel[i].x * dt;
        spray[i * 3 + 1] += vel[i].y * dt;
        spray[i * 3 + 2] += vel[i].z * dt;
        if (spray[i * 3 + 1] < footY) reset(i);
      }
      sattr.needsUpdate = true;
    },
  };
}

/** Blue waterfall pouring down a cliff (the older call: lip at (x, topY, z), facing +z). */
export function waterfall(x: number, z: number, topY: number, width: number, height: number): Landmark {
  return cascade({ x, z, top: topY, height, width });
}

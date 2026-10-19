/**
 * Waterfalls (#28, 01.22.56, the whale reel's koi tiers): a body of clear falling water bowed across its width under
 * two veils of white water, all on the parabola water takes off a lip, accelerating as it falls (long streaks that
 * stretch lower down), churning to foam toward the foot; at the foot a boiling plunge pool, spray, and mist that
 * swells up in puffs. Pure effect, kept procedural.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, PlaneGeometry, Points, RingGeometry,
  ShaderMaterial, Sphere, Vector3,
} from 'three';
import { glowSprite, glowTexture } from '../render/Glow';
import type { Landmark } from './Landmarks';

const FALL_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vN = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - wp.xyz);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

/**
 * A sheet of falling water. uv.x across, uv.y 1 at the lip and 0 at the foot. The water accelerates as it falls (its
 * pattern is laid out along the square root of the drop, so streaks stretch longer the lower they are), runs in long
 * vertical streaks of clear and white water, churns to foam toward the foot and at the lip's edge, and is more opaque
 * where it is seen edge-on (fresnel). uLayer: 0 the clear body, 1 the white foam veil in front.
 */
const FALL_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uHeight; uniform float uWidth; uniform float uSeed; uniform float uLayer;
varying vec2 vUv; varying vec3 vN; varying vec3 vView;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float fall = 1.0 - vUv.y;
  float x = vUv.x * uWidth;
  // Time-of-flight coordinate: equal steps of it are equal times, so the pattern moves at a constant rate in it.
  float s = sqrt(fall * uHeight) * 2.4;
  float flow = s - uTime * 2.2;
  // Long streaks: fine across, very coarse along the fall; two octaves, the second faster.
  float st = vnoise(vec2(x * 3.2 + uSeed, flow * 0.9)) * 0.6 + vnoise(vec2(x * 8.0 - uSeed, flow * 2.3 - uTime * 0.6)) * 0.4;
  float strands = smoothstep(0.38, 0.8, st);
  // Turbulent foam: grows toward the foot, breaks into clumps.
  float churn = vnoise(vec2(x * 5.0, flow * 3.5)) * 0.5 + vnoise(vec2(x * 13.0, flow * 7.0 + uSeed)) * 0.5;
  float foamy = smoothstep(0.35, 1.0, fall) * 0.9 + smoothstep(0.06, 0.0, vUv.y - 0.94) * 0.0;
  float lipFoam = smoothstep(0.92, 1.0, vUv.y) * 0.7;
  float foam = clamp(smoothstep(0.55 - foamy * 0.35, 0.9, churn) * (0.35 + foamy) + lipFoam, 0.0, 1.0);
  // Ragged sides: the sheet thins and tears at its edges, more so lower down.
  float across = abs(vUv.x - 0.5) * 2.0;
  float tear = vnoise(vec2(flow * 0.6, vUv.x * 6.0 + uSeed)) * (0.25 + fall * 0.35);
  float edge = 1.0 - smoothstep(0.62 - tear, 1.0 - tear * 0.5, across);
  float lip = smoothstep(0.0, 0.02, vUv.y);
  float fres = pow(1.0 - abs(dot(normalize(vN), normalize(vView))), 2.0);
  vec3 deep = uColor * 0.55;
  vec3 white = mix(vec3(0.85, 0.92, 1.0), uColor * 1.2 + 0.25, 0.25);
  vec3 c; float a;
  if (uLayer < 0.5) {
    c = mix(deep, uColor * 1.15, strands) + white * strands * 0.25;
    c = mix(c, white, foam * 0.75);
    c += white * fres * 0.35;
    a = (0.45 + strands * 0.35 + foam * 0.3 + fres * 0.3) * edge * lip;
  } else {
    // The veil: only the white water, wisps and clumps over the body.
    float wisp = smoothstep(0.6, 0.95, st) * 0.6 + foam;
    c = white * (0.85 + churn * 0.4);
    a = clamp(wisp, 0.0, 1.0) * 0.55 * edge * lip * (0.4 + fall * 0.6);
  }
  if (a < 0.015) discard;
  gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
}`;

/** The plunge pool: white foam boiling where the water lands, rings running outward under drifting foam cells. */
const RING_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // vUv: (radius 0..1, angle 0..1) after the geometry's remap.
  float r = vUv.x;
  float ang = vUv.y * 6.2832;
  vec2 p = vec2(cos(ang), sin(ang)) * r * 6.0;
  float rings = 0.5 + 0.5 * sin(r * 30.0 - uTime * 4.5);
  float cells = vnoise(p * 2.0 + vec2(uTime * 0.3, -uTime * 0.2)) * 0.6 + vnoise(p * 5.0 - uTime * 0.5) * 0.4;
  float foam = smoothstep(0.45, 0.85, cells) * (1.0 - smoothstep(0.15, 0.9, r)) + (1.0 - smoothstep(0.0, 0.35, r)) * 0.6;
  vec3 white = mix(vec3(0.85, 0.92, 1.0), uColor + 0.2, 0.25);
  vec3 c = mix(uColor * (0.5 + rings * 0.4), white, clamp(foam, 0.0, 1.0));
  float a = (1.0 - smoothstep(0.55, 1.0, r)) * (0.35 + rings * 0.15 + foam * 0.55);
  gl_FragColor = vec4(c, a);
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

/** A waterfall with its foot effects (see the file comment). */
export function cascade(o: CascadeOptions): Landmark {
  const color = o.color ?? BLUE;
  const curve = o.curve ?? Math.min(3, o.height * 0.12);
  const yaw = o.yaw ?? 0;
  const g = new Group();
  g.position.set(o.x, 0, o.z);
  g.rotation.y = yaw;
  const seed = (Math.abs(o.x * 13.1 + o.z * 7.7) % 50);
  const mats: ShaderMaterial[] = [];
  // A sheet: the water leaves the lip on a parabola (out along sqrt of the drop), spreads a little as it falls, and
  // bows outward across its width (a real sheet is thicker in the middle). `out` pushes it forward of the body.
  const sheet = (width: number, layer: number, out: number, spread: number, order: number) => {
    const across = Math.max(4, Math.round(width * 3));
    const geo = new PlaneGeometry(width, o.height, across, 32);
    const pos = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const fall = 1 - (pos.getY(i) / o.height + 0.5);
      const u = pos.getX(i) / width;
      const bow = (1 - 4 * u * u) * Math.min(0.5, width * 0.12);
      pos.setXYZ(i, pos.getX(i) * (1 + fall * spread), o.top - fall * o.height, Math.sqrt(Math.max(0, fall)) * curve + out + bow * (0.4 + fall * 0.6));
    }
    geo.computeVertexNormals();
    const mat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: color.clone() }, uHeight: { value: o.height }, uWidth: { value: width }, uSeed: { value: seed + out * 10 }, uLayer: { value: layer } },
      vertexShader: FALL_VERT, fragmentShader: FALL_FRAG, transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, fog: false,
    });
    mats.push(mat);
    const m = new Mesh(geo, mat);
    m.renderOrder = order;
    g.add(m);
  };
  // The body behind, the white veil over it, a thin second veil breaking wider in front.
  sheet(o.width, 0, 0.1, 0.18, 4);
  sheet(o.width * 1.05, 1, 0.28, 0.3, 5);
  sheet(o.width * 1.35, 1, 0.55, 0.45, 5);
  const footY = o.top - o.height;
  const footZ = curve + 0.45;
  // The plunge pool's foam and rings.
  const outer = o.width * 1.4 + 1.2;
  const ringGeo = new RingGeometry(0.05, outer, 48, 4);
  const ruv = ringGeo.attributes.uv as BufferAttribute;
  const rpos = ringGeo.attributes.position as BufferAttribute;
  for (let i = 0; i < rpos.count; i++) ruv.setXY(i, Math.hypot(rpos.getX(i), rpos.getY(i)) / outer, (Math.atan2(rpos.getY(i), rpos.getX(i)) / (Math.PI * 2) + 1) % 1);
  const ringMat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: color.clone() } },
    vertexShader: FALL_VERT, fragmentShader: RING_FRAG, transparent: true, depthWrite: false, fog: false,
  });
  const ring = new Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(0, footY + 0.08, footZ);
  ring.renderOrder = 5;
  g.add(ring);
  // Mist boiling up from the foot: soft white puffs that rise, swell and thin out, one after another.
  const mistColor = new Color(0.8, 0.86, 1.0).lerp(color, 0.25).getHex();
  const mists = Array.from({ length: 6 }, (_, i) => {
    const sp = glowSprite(mistColor, 1, 0, true);
    sp.renderOrder = 6;
    g.add(sp);
    return { sp, age: i / 6, x: (Math.random() - 0.5) * o.width };
  });
  // Spray: droplets thrown up and out of the foot that fall back.
  const n = Math.round(40 + o.width * 16);
  const spray = new Float32Array(n * 3);
  const vel: Vector3[] = [];
  const reset = (i: number) => {
    spray[i * 3] = (Math.random() - 0.5) * o.width;
    spray[i * 3 + 1] = footY + 0.1;
    spray[i * 3 + 2] = footZ + (Math.random() - 0.3) * 0.8;
    (vel[i] ??= new Vector3()).set((Math.random() - 0.5) * 3.5, 2 + Math.random() * 4.5, (Math.random() - 0.1) * 3.5);
  };
  for (let i = 0; i < n; i++) { reset(i); spray[i * 3 + 1] += Math.random() * 2; }
  const sg = new BufferGeometry();
  sg.setAttribute('position', new BufferAttribute(spray, 3));
  const sparkMat = new ShaderMaterial({
    uniforms: { uColor: { value: new Color(0.85, 0.92, 1.0).lerp(color, 0.3) }, uMap: { value: glowTexture() } },
    vertexShader: 'void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = 60.0 / -mv.z; gl_Position = projectionMatrix * mv; }',
    fragmentShader: 'uniform vec3 uColor; uniform sampler2D uMap; void main() { float a = texture2D(uMap, gl_PointCoord).a; gl_FragColor = vec4(uColor * 1.3, a * 0.7); }',
    transparent: true, depthWrite: false, blending: AdditiveBlending, fog: false,
  });
  const points = new Points(sg, sparkMat);
  points.renderOrder = 6;
  // Culled by a sphere round the whole spray (never by its first frame's positions).
  sg.boundingSphere = new Sphere(new Vector3(0, footY + 2, footZ), o.width + 6);
  g.add(points);
  const sattr = sg.attributes.position as BufferAttribute;
  let t = 0;
  const mistRise = Math.min(6, 1.5 + o.height * 0.15);
  return {
    object: g,
    footprints: [],
    update(dt) {
      t += dt;
      for (const m of mats) m.uniforms.uTime.value = t;
      ringMat.uniforms.uTime.value = t;
      for (const m of mists) {
        m.age += dt / 3.5;
        if (m.age >= 1) { m.age -= 1; m.x = (Math.random() - 0.5) * o.width; }
        const k = m.age;
        m.sp.position.set(m.x * (1 + k), footY + 0.3 + k * mistRise, footZ + k * 1.2);
        m.sp.scale.setScalar(o.width * (0.9 + k * 2.2));
        m.sp.material.opacity = Math.sin(k * Math.PI) * 0.28;
      }
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

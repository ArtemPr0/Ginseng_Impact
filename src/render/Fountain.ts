/**
 * A tiered fountain's water, centred on its model (the Lean Quarter's lean fountains, Def4LDkxikA): a jet over the
 * finial falling into the upper bowl, a ring of water spilling from the bowl's lip down into the basin (a curtain, not
 * a flat ribbon), and the basin's and the bowl's surfaces rippling where the water lands.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, type Color, CylinderGeometry, DoubleSide, Group, Mesh, Points, ShaderMaterial } from 'three';
import { glowTexture } from './Glow';

/** The fountain's tiers, metres over its base: the basin's water (level, radius), the bowl's lip (y, radius), the jet's top. */
export interface FountainTiers { basinY: number; basinR: number; bowlY: number; bowlR: number; jetY: number }

const CURTAIN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const CURTAIN_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  // uv.x round the ring, uv.y: 1 at the lip, 0 at the basin. Strands of water racing down, breaking up near the bottom.
  float fall = 1.0 - vUv.y;
  float drop = fall * 3.0 - uTime * 2.6;
  float strands = smoothstep(0.35, 0.7, vnoise(vec2(vUv.x * 48.0, fall * 0.6)));
  float clumps = vnoise(vec2(vUv.x * 64.0, drop * 3.0));
  float body = strands * (0.4 + clumps * 0.8);
  float alpha = clamp(body + 0.15, 0.0, 1.0) * smoothstep(0.0, 0.06, vUv.y) * (1.0 - smoothstep(0.8, 1.0, fall) * 0.6) * 0.75;
  if (alpha < 0.02) discard;
  gl_FragColor = vec4(uColor * (0.5 + body * 1.1) + vec3(0.6, 0.5, 0.8) * smoothstep(0.85, 1.0, clumps) * strands * 0.5, alpha);
}`;

const POOL_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uR; uniform float uRing;
varying vec2 vUv;
void main() {
  // Rings running out from where the falling water lands (radius uRing of uR), over a deep glowing pool.
  float r = length(vUv - 0.5) * 2.0 * uR;
  float w = 0.5 + 0.5 * sin((r - uRing) * 9.0 - uTime * 4.0);
  float near = exp(-pow((r - uRing) * 1.6, 2.0));
  vec3 c = uColor * (0.35 + 0.25 * w + near * (0.6 + 0.6 * w));
  float a = 0.85 * smoothstep(uR, uR - 0.08, r);
  gl_FragColor = vec4(c, a);
}`;

export function fountain(x: number, z: number, y: number, t: FountainTiers, color: Color): { group: Group; update(dt: number): void } {
  const g = new Group();
  const time = { value: 0 };
  // The curtain: from the bowl's lip down to the basin's water, spreading a little as it falls.
  const fallH = t.bowlY - t.basinY;
  const curtain = new Mesh(new CylinderGeometry(t.bowlR + 0.02, t.bowlR + 0.22, fallH, 40, 6, true), new ShaderMaterial({
    vertexShader: CURTAIN_VERT, fragmentShader: CURTAIN_FRAG, transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true,
    uniforms: { uTime: time, uColor: { value: color } },
  }));
  curtain.position.set(x, y + t.basinY + fallH / 2, z);
  curtain.renderOrder = 4;
  // The basin's and the bowl's surfaces.
  const pool = (r: number, level: number, ring: number) => {
    const m = new Mesh(new CircleGeometry(r, 40), new ShaderMaterial({
      vertexShader: CURTAIN_VERT, fragmentShader: POOL_FRAG, transparent: true, depthWrite: false, forceSinglePass: true,
      uniforms: { uTime: time, uColor: { value: color }, uR: { value: r }, uRing: { value: ring } },
    }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y + level, z);
    return m;
  };
  g.add(curtain, pool(t.basinR, t.basinY, t.bowlR + 0.22), pool(t.bowlR - 0.06, t.bowlY - 0.06, 0.05));
  // The jet: droplets thrown up from the finial in a crown, arcing down into the bowl.
  const n = 70;
  const pos = new Float32Array(n * 3);
  const seeds = Array.from({ length: n }, () => ({ a: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 0.5, ph: Math.random() }));
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  const drops = new Points(geo, new ShaderMaterial({
    transparent: true, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uMap: { value: glowTexture() }, uColor: { value: color } },
    vertexShader: /* glsl */ `void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = 26.0 / -mv.z; }`,
    fragmentShader: /* glsl */ `uniform sampler2D uMap; uniform vec3 uColor; void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor * 1.2 + 0.2, t.a * 0.8); }`,
  }));
  drops.frustumCulled = false;
  g.add(drops);
  const reach = t.bowlR * 0.8;
  const rise = 0.5;
  return {
    group: g,
    update(dt) {
      time.value += dt;
      for (let i = 0; i < n; i++) {
        const sd = seeds[i];
        const k = (time.value * sd.s + sd.ph) % 1;
        const r = reach * k;
        // Up from the jet's top and down into the bowl: a parabola over the flight.
        const h = t.jetY + rise * 4 * k * (1 - k) - (t.jetY - t.bowlY + 0.05) * k * k;
        pos[i * 3] = x + Math.cos(sd.a) * r;
        pos[i * 3 + 1] = y + h;
        pos[i * 3 + 2] = z + Math.sin(sd.a) * r;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}

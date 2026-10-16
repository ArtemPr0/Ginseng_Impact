import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  Mesh, MeshBasicMaterial, PlaneGeometry, Points, PointsMaterial, RingGeometry, ShaderMaterial, SphereGeometry, Vector2, Vector3, Vector4,
} from 'three';
import { SKY_SHARED } from '../render/Sky';
import { PALETTE } from '../render/palette';
import type { Placement } from './Flora';
import { glowTexture } from '../render/Glow';
import type { Landmark } from './Landmarks';
import { EYE, RIVER, RIVER_LEVEL, riverDistance } from './Terrain';

const WATER_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld;
void main() {
  vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

/** Noise, the reflected sky and the psychedelic flow colours, shared by the water and the eye pool. */
const WATER_COMMON = /* glsl */ `
uniform vec3 uSkyHorizon; uniform vec3 uSkyMid; uniform vec3 uSkyZenith; uniform vec3 uSkyCloud; uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform float uSkyTime;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.3) * 0.3 + vnoise(p * 4.3 - 1.7) * 0.2; }
// The sky as seen in a reflection: the dome's gradient and clouds, the moon as a hot glint with a soft halo.
vec3 skyColor(vec3 r) {
  float y = max(r.y, 0.0);
  vec3 c = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.3, y));
  c = mix(c, uSkyZenith, smoothstep(0.3, 0.95, y));
  vec2 p = r.xz / (y + 0.14) * 0.85 + vec2(uSkyTime * 0.012, uSkyTime * 0.004);
  c = mix(c, uSkyCloud * 0.75, smoothstep(0.42, 0.78, fbm(p * 1.25)) * 0.7 * smoothstep(0.0, 0.15, y));
  float m = max(dot(r, uMoonDir), 0.0);
  return c + uMoonCol * (pow(m, 1400.0) * 40.0 + pow(m, 90.0) * 1.2 + pow(m, 10.0) * 0.18);
}
// The psychedelic flow of the reference river (#28): deep blue streaked with orange, magenta and cyan.
vec3 tripColor(vec2 p, float t) {
  vec2 w = vec2(fbm(p * 0.35 + t * 0.05), fbm(p * 0.35 + vec2(4.1, 7.3) - t * 0.04));
  float n = fbm(p * 0.22 + w * 2.6);
  vec3 c = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + n * 1.6 + t * 0.03));
  c = mix(vec3(0.05, 0.12, 0.85), c, smoothstep(0.35, 0.75, n));
  c = mix(c, vec3(1.6, 0.55, 0.12), smoothstep(0.66, 0.8, fbm(p * 0.5 - w * 3.0)) * 0.8);
  return c * (0.45 + smoothstep(0.55, 0.9, n) * 0.7);
}`;

const WATER_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform float uFlow; uniform float uWidth;
uniform vec4 uDisc; uniform vec4 uEye;
varying vec2 vUv; varying vec3 vWorld;
${WATER_COMMON}
// Wave heights: two scrolling layers, small and smaller.
float waves(vec2 q) {
  return vnoise(q * 0.55 + vec2(uTime * 0.35, uTime * 0.12)) * 0.6 + vnoise(q * 1.3 - vec2(uTime * 0.2, -uTime * 0.31)) * 0.3
       + vnoise(q * 3.1 + vec2(uTime * 0.6, 0.0)) * 0.1;
}
void main() {
  // A river flows along its ribbon (uv.x is metres / 30 along it, uv.y across); a pond is still (world xz).
  vec2 q = uFlow > 0.5 ? vec2(vUv.x * 30.0 - uTime * uFlow, vUv.y * uWidth) : vWorld.xz;
  float e = 0.12;
  float h0 = waves(q), hx = waves(q + vec2(e, 0.0)), hz = waves(q + vec2(0.0, e));
  vec3 N = normalize(vec3(-(hx - h0) / e * 0.35, 1.0, -(hz - h0) / e * 0.35));
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.03 + 0.97 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 refl = skyColor(reflect(-V, N));
  float n = fbm(q * 0.18 + uTime * 0.02);
  vec3 body = mix(uDeep, uShallow, smoothstep(0.25, 0.85, n)) * (0.55 + h0 * 0.5);
  // Light caught under the surface where the waves crest.
  body += uShallow * smoothstep(0.62, 0.9, h0) * 0.35;
  // Near the eye pool the river turns into the reference's psychedelic flow.
  float trip = 0.0;
  if (uEye.w > 0.0) {
    trip = (1.0 - smoothstep(uEye.z * 0.35, uEye.z, distance(vWorld.xz, uEye.xy))) * uEye.w;
    if (trip > 0.0) body = mix(body, tripColor(q, uTime), trip);
  }
  vec3 c = mix(body, refl, fres * (1.0 - trip * 0.5));
  // Foam: streaks in the current and a lace along a river's banks.
  float streak = smoothstep(0.6, 0.85, vnoise(vec2(q.x * 0.9, q.y * 2.4))) * 0.25;
  float bank = uFlow > 0.5 ? (1.0 - smoothstep(0.0, 0.1, vUv.y)) + (1.0 - smoothstep(0.0, 0.1, 1.0 - vUv.y)) : 0.0;
  float lace = bank * smoothstep(0.4, 0.75, vnoise(q * 2.2 + uTime * 0.8));
  c += uFoam * (streak * (1.0 - trip) + lace * 0.7);
  // Moonlit sparkle on the crests.
  float glint = pow(max(dot(reflect(-V, N), uMoonDir), 0.0), 60.0) * smoothstep(0.7, 0.95, h0);
  c += uMoonCol * glint * 2.5;
  float edge = uDisc.w > 0.0
    ? 1.0 - smoothstep(uDisc.z, uDisc.w, distance(vWorld.xz, uDisc.xy))
    : smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  if (edge <= 0.002) discard;
  gl_FragColor = vec4(c, mix(0.8, 0.97, max(fres, trip)) * edge + 0.03);
}`;

/**
 * Water that reflects the sky above it (SKY_SHARED: the dome's own colours and moon), with waves, a moon glint,
 * foam and light under the crests. `flow` > 0 scrolls along a ribbon's uv at that speed (rivers); 0 is still (ponds).
 */
export function waterMaterial(deep: number, shallow: number, foam: number, flow = 1.2, width = 23): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uDeep: { value: new Color(deep) }, uShallow: { value: new Color(shallow) }, uFoam: { value: new Color(foam) },
      uFlow: { value: flow }, uWidth: { value: width }, uDisc: { value: new Vector4(0, 0, 0, 0) }, uEye: { value: new Vector4(0, 0, 0, 0) },
      ...SKY_SHARED,
    },
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true,
  });
}

const EYE_FRAG = /* glsl */ `
uniform float uTime; uniform vec2 uCentre; uniform vec2 uPupil; uniform float uDilate; uniform vec3 uAxes;
varying vec2 vUv; varying vec3 vWorld;
${WATER_COMMON}
void main() {
  vec2 d = vWorld.xz - uCentre;
  // The ellipse outline (Terrain.eyeDistance): fade out across its last metres into the swirling river.
  vec2 nd = d / uAxes.xy;
  float k = length(nd);
  float lens = (k - 1.0) * length(normalize(nd + 1e-5) * uAxes.xy);
  float edge = 1.0 - smoothstep(-6.0, 0.5, lens);
  if (edge <= 0.002) discard;
  vec2 pd = vWorld.xz - (uCentre + uPupil);
  float r = length(pd);
  float a = atan(pd.y, pd.x);
  float t = uTime;
  float pupil = 3.4 * uDilate;
  // Iris: radial fibres in every colour, green-yellow at the collar like the reference, turning slowly.
  float fib = fbm(vec2(a * 9.0 + t * 0.08, r * 0.6)) * 0.6 + fbm(vec2(a * 23.0 - t * 0.05, r * 1.4)) * 0.4;
  vec3 iris = 0.5 + 0.5 * cos(6.2832 * (vec3(0.0, 0.33, 0.67) + r * 0.09 + fib * 0.5 - t * 0.04));
  iris = mix(vec3(0.5, 0.9, 0.1), iris, smoothstep(pupil, pupil + 2.6, r));
  iris *= 0.45 + fib * 0.55;
  float irisMask = smoothstep(pupil + 6.5, pupil + 4.5, r);
  // Beyond the iris the water swirls into the eye: orange and violet arms.
  vec2 sw = vec2(a * 2.0 + r * 0.35 - t * 0.35, r * 0.25);
  vec3 swirl = tripColor(vec2(cos(sw.x), sin(sw.x)) * r * 1.4 + sw.y, t);
  vec3 col = mix(swirl, iris, irisMask);
  // The pupil: a black well with a soft violet rim that breathes.
  float pm = smoothstep(pupil + 0.5, pupil - 0.2, r);
  col = mix(col, vec3(0.0), pm);
  float rim = (r - pupil - 0.4) * 1.6;
  col += vec3(0.4, 0.12, 0.9) * exp(-rim * rim) * (0.6 + 0.4 * sin(t * 2.0));
  // A thin sky reflection over everything but the pupil.
  vec3 V = normalize(cameraPosition - vWorld);
  float fres = 0.03 + 0.97 * pow(1.0 - max(V.y, 0.0), 5.0);
  col += skyColor(reflect(-V, vec3(0.0, 1.0, 0.0))) * fres * 0.35 * (1.0 - pm);
  gl_FragColor = vec4(col, edge * mix(0.94, 1.0, pm));
}`;

/**
 * The eye-shaped vortex pool of the reference (#28): a lens of water whose black pupil sits in a rainbow iris and
 * whose rim swirls in orange and violet into the river. The pupil leans toward the hero and dilates when they come
 * close or when `startle()` is called (a shot into it).
 */
export function eyePool(x: number, z: number, level: number, a: number, b: number): Landmark & { startle(): void } {
  const mat = new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uCentre: { value: new Vector2(x, z) }, uPupil: { value: new Vector2() }, uDilate: { value: 1 },
      uAxes: { value: new Vector3(a, b, 0) }, ...SKY_SHARED,
    },
    vertexShader: WATER_VERT, fragmentShader: EYE_FRAG, transparent: true, depthWrite: false, forceSinglePass: true,
  });
  const geo = new PlaneGeometry(a * 2 + 2, b * 2 + 2, 1, 1);
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, mat);
  mesh.position.set(x, level + 0.04, z);
  mesh.renderOrder = 3;
  const g = new Group();
  g.add(mesh);
  let t = 0;
  let startled = 0;
  const pupil = mat.uniforms.uPupil.value as Vector2;
  return {
    object: g,
    footprints: [],
    startle() { startled = 1; },
    update(dt, player) {
      t += dt;
      mat.uniforms.uTime.value = t;
      // The pupil leans up to 1.5 m toward the hero; it widens as they come near, and snaps wide when startled.
      const dx = player.x - x;
      const dz = player.z - z;
      const dist = Math.hypot(dx, dz);
      const lean = Math.min(1.5, dist * 0.04);
      const tx = dist > 0.01 ? (dx / dist) * lean : 0;
      const tz = dist > 0.01 ? (dz / dist) * lean : 0;
      const k = Math.min(1, dt * 2);
      pupil.set(pupil.x + (tx - pupil.x) * k, pupil.y + (tz - pupil.y) * k);
      startled = Math.max(0, startled - dt * 0.6);
      const near = 1 - Math.min(1, Math.max(0, (dist - 8) / 40));
      const want = 1 + near * 0.35 + startled * 0.7 + Math.sin(t * 0.7) * 0.06;
      mat.uniforms.uDilate.value += (want - (mat.uniforms.uDilate.value as number)) * Math.min(1, dt * 3);
    },
  };
}

/** Samples the river polyline into evenly spaced points with tangents. */
export function riverSamples(step = 3): Array<{ x: number; z: number; tx: number; tz: number; u: number }> {
  const out: Array<{ x: number; z: number; tx: number; tz: number; u: number }> = [];
  let u = 0;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i];
    const [bx, bz] = RIVER[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    for (let d = 0; d < len; d += step) {
      out.push({ x: ax + tx * d, z: az + tz * d, tx, tz, u: u + d });
    }
    u += len;
  }
  return out;
}

let riverLength = 0;
/** Position along the river at arc length `s` (wraps). */
export function riverPoint(s: number): { x: number; z: number; yaw: number } {
  // (Measured once: boats ask every frame.)
  const total = riverLength || (riverLength = riverSamples(3).at(-1)!.u);
  let d = ((s % total) + total) % total;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i];
    const [bx, bz] = RIVER[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (d <= len) {
      const t = d / len;
      return { x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw: Math.atan2(bz - az, bx - ax) };
    }
    d -= len;
  }
  const [lx, lz] = RIVER[RIVER.length - 1];
  return { x: lx, z: lz, yaw: 0 };
}

/** The great glowing river: a ribbon mesh along the polyline, sparkles, and reed banks. */
export function river(heightAt: (x: number, z: number) => number, rnd: () => number): Landmark & { reedSpots: Placement[] } {
  const g = new Group();
  const samples = riverSamples(3);
  const half = 11.5;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  samples.forEach((s, i) => {
    const nx = -s.tz;
    const nz = s.tx;
    // Smooth the width at joins by tapering both ends slightly.
    pos.push(s.x + nx * half, RIVER_LEVEL, s.z + nz * half, s.x - nx * half, RIVER_LEVEL, s.z - nz * half);
    uv.push(s.u / 30, 0, s.u / 30, 1);
    if (i > 0) {
      const a = (i - 1) * 2;
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = waterMaterial(0x061660, 0x2450e8, 0xbcd6ff, 1.2, half * 2);
  (mat.uniforms.uEye.value as Vector4).set(EYE.x, EYE.z, 48, 1);
  const mesh = new Mesh(geo, mat);
  mesh.renderOrder = 2;
  g.add(mesh);
  // Underwater glow strip for bloom.
  const glowGeo = geo.clone();
  const gp = glowGeo.attributes.position as BufferAttribute;
  for (let i = 0; i < gp.count; i++) gp.setY(i, RIVER_LEVEL - 0.35);
  const glow = new Mesh(glowGeo, new MeshBasicMaterial({ color: new Color(PALETTE.electric).multiplyScalar(0.45), transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false, side: DoubleSide, forceSinglePass: true }));
  glow.renderOrder = 1;
  g.add(glow);
  // Sparkles drifting downstream.
  const n = 900;
  const sp: number[] = [];
  const seeds: number[] = [];
  for (let i = 0; i < n; i++) {
    const s = samples[Math.floor(rnd() * samples.length)];
    const off = (rnd() - 0.5) * 16;
    sp.push(s.x - s.tz * off, RIVER_LEVEL + 0.1 + rnd() * 0.6, s.z + s.tx * off);
    seeds.push(rnd());
  }
  const sg = new BufferGeometry();
  sg.setAttribute('position', new Float32BufferAttribute(sp, 3));
  const sparkles = new Points(sg, new PointsMaterial({ map: glowTexture(), color: PALETTE.moon, size: 0.5, transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false }));
  sparkles.frustumCulled = false;
  g.add(sparkles);
  const sattr = sg.attributes.position as BufferAttribute;
  // Reeds along both banks.
  const reedSpots: Placement[] = [];
  for (const s of samples) {
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const d = 6.5 + rnd() * 3.5;
        const x = s.x - s.tz * side * d + (rnd() - 0.5) * 2;
        const z = s.z + s.tx * side * d + (rnd() - 0.5) * 2;
        const y = heightAt(x, z);
        if (y < RIVER_LEVEL - 0.3 || y > RIVER_LEVEL + 2.6) continue;
        reedSpots.push({ x, y: y - 0.1, z, yaw: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 0.7 });
      }
    }
  }
  let t = 0;
  let frame = 0;
  return {
    object: g,
    reedSpots,
    footprints: [],
    update(dt, player) {
      t += dt;
      mat.uniforms.uTime.value = t;
      void player;
      frame++;
      for (let i = 0; i < n; i++) {
        const x = sattr.getX(i);
        const z = sattr.getZ(i);
        // Drift west; every 8th frame (per particle, staggered) check it is still over the water, else respawn it.
        if ((i + frame) % 8 === 0 && riverDistance(x, z) > 9) {
          const s = samples[Math.floor(seeds[i] * samples.length)];
          sattr.setXYZ(i, s.x, RIVER_LEVEL + 0.1 + seeds[i] * 0.6, s.z);
        } else {
          sattr.setX(i, x - dt * (1.2 + seeds[i]));
          sattr.setY(i, RIVER_LEVEL + 0.15 + Math.sin(t * 3 + seeds[i] * 20) * 0.12);
        }
      }
      sattr.needsUpdate = true;
    },
  };
}

/** Lily pond: still water disc, floating lily pads, glowing pink lotus flowers, sparkles. */
export function lilyPond(cx: number, cz: number, radius: number, rnd: () => number): Landmark & { padSpots: Placement[]; lotusSpots: Placement[] } {
  const g = new Group();
  const level = 1.0;
  const mat = waterMaterial(0x071660, 0x2a6af0, 0x9fc4ff, 0);
  // The bowl (Terrain.ts) meets the water about 1.4 m beyond `radius`: fade out just inside that shore.
  (mat.uniforms.uDisc.value as Vector4).set(cx, cz, radius - 0.4, radius + 1.0);
  const water = new Mesh(new CircleGeometry(radius + 2, 64), mat);
  water.rotation.x = -Math.PI / 2;
  water.position.set(cx, level, cz);
  water.renderOrder = 2;
  g.add(water);
  const padSpots: Placement[] = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * (radius - 1);
    const yaw = rnd() * Math.PI * 2;
    padSpots.push({ x: cx + Math.cos(a) * r, y: level + 0.03, z: cz + Math.sin(a) * r, yaw, scale: 0.6 + rnd() * 0.8 });
  }
  const lotusSpots: Placement[] = [];
  for (let i = 0; i < 26; i++) { const pad = padSpots[i * 2]; lotusSpots.push({ x: pad.x, y: level + 0.06, z: pad.z, yaw: pad.yaw, scale: 1 }); }
  const n = 220;
  const sp: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * radius;
    sp.push(cx + Math.cos(a) * r, level + 0.2 + rnd() * 1.4, cz + Math.sin(a) * r);
  }
  const sg = new BufferGeometry();
  sg.setAttribute('position', new Float32BufferAttribute(sp, 3));
  const sparkles = new Points(sg, new PointsMaterial({ map: glowTexture(), color: PALETTE.electric, size: 0.35, transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
  sparkles.frustumCulled = false;
  g.add(sparkles);
  const sattr = sg.attributes.position as BufferAttribute;
  let t = 0;
  return {
    object: g,
    padSpots,
    lotusSpots,
    footprints: [],
    update(dt, player) {
      t += dt;
      mat.uniforms.uTime.value = t;
      void player;
      for (let i = 0; i < n; i++) sattr.setY(i, level + 0.3 + ((t * 0.25 + i * 0.37) % 1.4) );
      sattr.needsUpdate = true;
    },
  };
}

/**
 * A pool of liquid mud (the Marsh Sovereign's): a slow, glossy, swirling sludge (blue-black with a violet sheen, in the
 * island's palette) with bubbles that swell up out of it and pop, throwing a ring and a few drops. `inside(true)` is
 * called each frame the player wades in it (the world slows them).
 */
export function mudPool(x: number, z: number, y: number, radius: number, inside: (wading: boolean) => void): Landmark {
  const g = new Group();
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { uTime: { value: 0 }, uDisc: { value: new Vector4(x, z, radius - 0.6, radius + 0.6) } },
    vertexShader: WATER_VERT,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec4 uDisc;
      varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.3) * 0.3 + vnoise(p * 4.3 - 1.7) * 0.2; }
      void main() {
        vec2 p = vWorld.xz * 0.35;
        float n = fbm(p + vec2(fbm(p + uTime * 0.05), fbm(p - uTime * 0.04)) * 1.6);
        vec3 c = mix(vec3(0.03, 0.03, 0.09), vec3(0.14, 0.11, 0.26), smoothstep(0.35, 0.8, n));
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 N = normalize(vec3((n - 0.5) * 0.6, 1.0, (fbm(p * 1.7) - 0.5) * 0.6));
        float spec = pow(max(dot(normalize(V + vec3(0.15, 0.42, -1.0)), N), 0.0), 40.0);
        c += vec3(0.45, 0.4, 0.85) * spec * 0.5;
        float edge = 1.0 - smoothstep(uDisc.z, uDisc.w, distance(vWorld.xz, uDisc.xy));
        if (edge <= 0.002) discard;
        gl_FragColor = vec4(c, 0.96 * edge);
      }`,
  });
  const surface = new Mesh(new CircleGeometry(radius + 0.8, 48), mat);
  surface.rotation.x = -Math.PI / 2;
  surface.position.set(x, y, z);
  g.add(surface);
  // Bubbles: domes of mud that swell and pop.
  const domeGeo = new SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  const ringGeo = new RingGeometry(0.7, 1, 20);
  const domeMat = new MeshBasicMaterial({ color: 0x241d3d, transparent: true, opacity: 0.95 });
  const bubbles = Array.from({ length: 10 }, () => {
    const dome = new Mesh(domeGeo, domeMat);
    const ring = new Mesh(ringGeo, new MeshBasicMaterial({ color: 0x8a7fd0, transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    dome.visible = ring.visible = false;
    g.add(dome, ring);
    return { dome, ring, t: Math.random() * 3, life: 1, size: 0.3 };
  });
  let t = 0;
  return {
    object: g,
    footprints: [],
    update(dt, player) {
      t += dt;
      mat.uniforms.uTime.value = t;
      for (const b of bubbles) {
        b.t -= dt;
        if (b.t <= -0.5) {
          // A new bubble somewhere in the pool.
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * (radius - 1);
          b.dome.position.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r);
          b.ring.position.set(b.dome.position.x, y + 0.03, b.dome.position.z);
          b.size = 0.25 + Math.random() * 0.5;
          b.life = 0.9 + Math.random() * 1.4;
          b.t = b.life;
          b.dome.visible = true;
        }
        if (b.t > 0) {
          const k = 1 - b.t / b.life;
          b.dome.scale.set(b.size * (0.3 + k * 0.9), b.size * (0.2 + k * 0.8), b.size * (0.3 + k * 0.9));
          b.ring.visible = false;
        } else {
          // Pop: the dome is gone, a ring spreads and fades.
          b.dome.visible = false;
          const k = -b.t / 0.5;
          b.ring.visible = true;
          b.ring.scale.setScalar(b.size * (1 + k * 2.5));
          (b.ring.material as MeshBasicMaterial).opacity = 0.6 * (1 - k);
        }
      }
      inside(Math.hypot(player.x - x, player.z - z) < radius - 0.3 && player.y < y);
    },
  };
}


/** A still, round pool of the reflecting water (the koi tiers): its surface at `level`, fading just inside its rim. */
export function poolWater(x: number, z: number, r: number, level: number): Landmark {
  const mat = waterMaterial(0x071a66, 0x2c78ff, 0xa8d0ff, 0);
  (mat.uniforms.uDisc.value as Vector4).set(x, z, r - 0.3, r + 0.6);
  const mesh = new Mesh(new CircleGeometry(r + 1, 48), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(x, level, z);
  mesh.renderOrder = 2;
  const g = new Group();
  g.add(mesh);
  let t = 0;
  return { object: g, footprints: [], update(dt) { t += dt; mat.uniforms.uTime.value = t; } };
}

/**
 * A stream running down a sloped bed (the forest gorge's floor): a ribbon through `points` ([x, z, surface y]),
 * `half` metres either side of its centre line, flowing from the first point to the last.
 */
export function waterRibbon(points: ReadonlyArray<readonly [number, number, number]>, half: number): Landmark {
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let u = 0;
  points.forEach(([x, z, y], i) => {
    const [px, pz] = points[Math.max(0, i - 1)];
    const [nx, nz] = points[Math.min(points.length - 1, i + 1)];
    const tx = nx - px;
    const tz = nz - pz;
    const l = Math.hypot(tx, tz) || 1;
    if (i > 0) u += Math.hypot(x - points[i - 1][0], z - points[i - 1][1]);
    pos.push(x - (tz / l) * half, y, z + (tx / l) * half, x + (tz / l) * half, y, z - (tx / l) * half);
    uv.push(u / 30, 0, u / 30, 1);
    if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  });
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = waterMaterial(0x061a70, 0x3a8cff, 0xd0e4ff, 3.2, half * 2);
  const mesh = new Mesh(geo, mat);
  mesh.renderOrder = 2;
  const g = new Group();
  g.add(mesh);
  let t = 0;
  return { object: g, footprints: [], update(dt) { t += dt; mat.uniforms.uTime.value = t; } };
}

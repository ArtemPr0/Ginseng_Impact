import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, Float32BufferAttribute, Group,
  Mesh, MeshBasicMaterial, Points, PointsMaterial, ShaderMaterial, Vector3, Vector4,
} from 'three';
import { surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import type { Placement } from './Flora';
import { glowTexture } from '../render/Glow';
import type { Landmark } from './Landmarks';
import { RIVER, RIVER_LEVEL, riverDistance } from './Terrain';

const WATER_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
void main() {
  vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz; vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WATER_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uFoam; uniform vec3 uCam; uniform vec3 uMoonDir; uniform float uFlow;
uniform vec4 uDisc;
varying vec2 vUv; varying vec3 vWorld; varying vec3 vNormalW;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.3) * 0.3 + vnoise(p * 4.3 - 1.7) * 0.2; }
void main() {
  vec2 p = vec2(vUv.x * uFlow - uTime * 0.35, vUv.y * 3.0);
  float n = fbm(p * 2.0) ;
  float n2 = fbm(p * 5.0 + vec2(uTime * 0.2, 0.0));
  float streak = smoothstep(0.55, 0.8, vnoise(vec2(p.x * 9.0, p.y * 1.5)));
  vec3 c = mix(uDeep, uShallow, smoothstep(0.3, 0.75, n));
  c += uFoam * (smoothstep(0.62, 0.85, n2) * 0.8 + streak * 0.6);
  vec3 V = normalize(uCam - vWorld);
  float fres = pow(1.0 - max(dot(V, vNormalW), 0.0), 3.0);
  vec3 H = normalize(V + uMoonDir);
  float spec = pow(max(dot(H, normalize(vNormalW + vec3(n2 - 0.5, 0.0, n - 0.5) * 0.4)), 0.0), 60.0);
  c += vec3(0.75, 0.82, 1.0) * spec * 1.6 + uShallow * fres * 0.5;
  // A ribbon fades at its banks (uv.y); a pond (uDisc: centre x, z, then the radii where it starts and ends fading)
  // ends in a soft circle just inside its shore, never in the zigzag where the coarse terrain crosses the surface.
  float edge = uDisc.w > 0.0
    ? 1.0 - smoothstep(uDisc.z, uDisc.w, distance(vWorld.xz, uDisc.xy))
    : smoothstep(0.0, 0.12, vUv.y) * smoothstep(1.0, 0.88, vUv.y);
  if (edge <= 0.002) discard;
  gl_FragColor = vec4(c, 0.92 * edge + 0.08);
}`;

export function waterMaterial(deep: number, shallow: number, foam: number, flow = 40): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uDeep: { value: new Color(deep) }, uShallow: { value: new Color(shallow) }, uFoam: { value: new Color(foam) },
      uCam: { value: new Vector3() }, uMoonDir: { value: new Vector3(0.15, 0.42, -1).normalize() }, uFlow: { value: flow },
      uDisc: { value: new Vector4(0, 0, 0, 0) },
    },
    vertexShader: WATER_VERT, fragmentShader: WATER_FRAG, transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true,
  });
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
  const mat = waterMaterial(0x0b1f7a, 0x2f63ff, 0xbcd6ff, 1);
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
      (mat.uniforms.uCam.value as Vector3).copy(player);
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
  const mat = waterMaterial(0x0a1a66, 0x2a55e8, 0x9fc4ff, 4);
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
      (mat.uniforms.uCam.value as Vector3).copy(player);
      for (let i = 0; i < n; i++) sattr.setY(i, level + 0.3 + ((t * 0.25 + i * 0.37) % 1.4) );
      sattr.needsUpdate = true;
    },
  };
}

/** Still, dark water in a ruin or a hollow. */
export function stillWaterDisc(x: number, z: number, y: number, radius: number): Landmark {
  const water = new Mesh(new CircleGeometry(radius, 40), surface({ color: 0x0a1240, emissive: 0x1b2a6b, emissiveIntensity: 0.55, roughness: 0.15, transparent: true, opacity: 0.8 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y, z);
  const g = new Group();
  g.add(water);
  return { object: g, footprints: [] };
}

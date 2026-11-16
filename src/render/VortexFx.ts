/**
 * The Black Hole and the Fire Tornado, rebuilt to look real (the user, 2026-11-16: "the black hole and tornado
 * visually look terrible ... make them look realistic and epic").
 *
 * Black hole: a perfectly black core edged by a thin white-hot photon ring, a tilted accretion disc whose matter
 * swirls faster the nearer it is (Keplerian shear draws the spiral streaks by itself), white-hot inside through violet
 * to dark red outside, brighter on the side spinning toward you (Doppler beaming); a thinner second disc, two polar
 * jets, and streaks of matter falling in on accelerating orbits.
 *
 * Fire tornado: three nested lathe shells of noise-driven fire (white-yellow core, orange, ragged dark-red edges) that
 * spin and climb, flared at the base, pinched above the ground and wide at the top, swaying and leaning as it runs,
 * under a dark cap of smoke. Pure shaders on simple shapes: no textures, no downloads.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, CylinderGeometry, DoubleSide, Group, LatheGeometry, LineBasicMaterial,
  LineSegments, Mesh, MeshBasicMaterial, NormalBlending, PlaneGeometry, RingGeometry, ShaderMaterial, SphereGeometry, Vector2, Vector3,
  type Camera, type Material,
} from 'three';
import { GLSL_NOISE_BASIC } from './glsl';

/** The hole's size over its life: tears open over 0.6 s, holds, collapses to a point in its last 0.35 s. */
export function holeScale(t: number, life: number): number {
  if (t < 0.6) return Math.max(0.001, 1 - (1 - t / 0.6) ** 3);
  const left = life - t;
  if (left < 0.35) return Math.max(0.001, (Math.max(0, left) / 0.35) ** 2);
  return 1;
}

function additive(vertex: string, fragment: string, uniforms: Record<string, { value: unknown }>): ShaderMaterial {
  const m = new ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide });
  m.forceSinglePass = true;
  return m;
}

const DISC_V = /* glsl */ `
varying vec2 vP;
varying float vDop;
void main() {
  vP = position.xy;
  vec4 w = modelMatrix * vec4(position, 1.0);
  // Matter orbits anticlockwise in the disc's plane: brighter where it comes at the camera.
  vec3 tang = normalize((modelMatrix * vec4(-position.y, position.x, 0.0, 0.0)).xyz);
  vDop = dot(tang, normalize(cameraPosition - w.xyz));
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const DISC_F = /* glsl */ `
uniform float uT;
uniform float uI;
uniform float uIn;
uniform float uOut;
uniform vec3 uHot;
uniform vec3 uMid;
uniform vec3 uCold;
varying vec2 vP;
varying float vDop;
${GLSL_NOISE_BASIC}
void main() {
  float r = length(vP);
  // Keplerian shear: the inside turns faster, winding the noise into spiral streaks.
  float w = uT * 2.6 / pow(r, 1.5);
  float c = cos(w), s = sin(w);
  vec2 p = vec2(c * vP.x - s * vP.y, s * vP.x + c * vP.y);
  float n = fbm(p * 1.7) * 0.65 + fbm(p * 5.3 + 3.7) * 0.35;
  n = smoothstep(0.2, 0.85, n);
  float heat = smoothstep(uOut, uIn, r);
  vec3 col = mix(uCold, uMid, smoothstep(0.0, 0.6, heat));
  col = mix(col, uHot, smoothstep(0.6, 1.0, heat));
  float b = n * (0.35 + 1.8 * heat * heat) * (1.0 + 0.85 * vDop);
  float edge = smoothstep(uIn, uIn + 0.22, r) * smoothstep(uOut, uOut - 1.2, r);
  gl_FragColor = vec4(col * b * uI * edge, 1.0);
}`;

const RING_V = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const RING_F = /* glsl */ `
uniform float uT;
uniform float uFlash;
uniform vec3 uColor;
varying vec2 vUv;
${GLSL_NOISE_BASIC}
void main() {
  vec2 d = (vUv - 0.5) * 3.2;
  float r = length(d);
  float a = atan(d.y, d.x);
  float flick = 0.8 + 0.4 * vnoise(vec2(a * 3.0, uT * 4.0));
  float ring = exp(-pow((r - 1.035) / 0.028, 2.0)) * 2.6 * flick;
  float glow = exp(-pow((r - 1.0) / 0.2, 2.0)) * 0.55;
  float halo = r > 1.0 ? exp(-(r - 1.0) * 2.6) * 0.22 : 0.0;
  // The tear opening: a bright ring flash running out.
  float tear = uFlash * exp(-pow((r - (1.0 + (1.0 - uFlash) * 0.5)) / 0.08, 2.0)) * 3.0;
  float k = r < 0.985 ? 0.0 : 1.0;
  vec3 col = mix(uColor, vec3(1.0), clamp(ring * 0.5 + tear * 0.4, 0.0, 1.0));
  gl_FragColor = vec4(col * (ring + glow + halo + tear) * k, 1.0);
}`;

const JET_F = /* glsl */ `
uniform float uT;
uniform vec3 uColor;
varying vec2 vUv;
${GLSL_NOISE_BASIC}
void main() {
  float n = fbm(vec2(vUv.x * 7.0, vUv.y * 9.0 - uT * 7.0));
  float a = smoothstep(0.35, 0.8, n) * (1.0 - vUv.y) * smoothstep(0.0, 0.08, vUv.y);
  gl_FragColor = vec4(mix(uColor, vec3(1.0), 0.45) * a * 1.4, 1.0);
}`;

const STREAKS = 160;

export class BlackHoleFx {
  readonly group = new Group();
  private readonly discMat: ShaderMaterial;
  private readonly disc2Mat: ShaderMaterial;
  private readonly ringMat: ShaderMaterial;
  private readonly jetMat: ShaderMaterial;
  private readonly streakGeo = new BufferGeometry();
  private readonly sr = new Float32Array(STREAKS);
  private readonly sa = new Float32Array(STREAKS);
  private readonly sy = new Float32Array(STREAKS);
  private readonly spos = new Float32Array(STREAKS * 6);
  private readonly scol = new Float32Array(STREAKS * 6);
  private readonly tilt = -Math.PI / 2 + 0.32;

  constructor(color: number, private readonly life: number) {
    const violet = new Color(color);
    const core = new Mesh(new SphereGeometry(1, 40, 20), new MeshBasicMaterial({ color: 0x000000 }));
    core.name = 'core';
    core.renderOrder = 2;
    const uniforms = (inner: number, outer: number, i: number) => ({
      uT: { value: 0 }, uI: { value: i }, uIn: { value: inner }, uOut: { value: outer },
      uHot: { value: new Color(1, 0.95, 1.0) }, uMid: { value: violet.clone().multiplyScalar(1.3) }, uCold: { value: new Color(0.55, 0.05, 0.12) },
    });
    this.discMat = additive(DISC_V, DISC_F, uniforms(1.25, 4.6, 1.1));
    const disc = new Mesh(new RingGeometry(1.25, 4.6, 160, 10), this.discMat);
    disc.name = 'disc';
    disc.rotation.x = this.tilt;
    disc.renderOrder = 3;
    this.disc2Mat = additive(DISC_V, DISC_F, uniforms(1.12, 2.7, 0.55));
    const disc2 = new Mesh(new RingGeometry(1.12, 2.7, 120, 6), this.disc2Mat);
    disc2.name = 'disc2';
    disc2.rotation.set(this.tilt + 0.9, 0.5, 0);
    disc2.renderOrder = 3;
    this.ringMat = additive(RING_V, RING_F, { uT: { value: 0 }, uFlash: { value: 1 }, uColor: { value: violet.clone().lerp(new Color(1, 1, 1), 0.35) } });
    const ring = new Mesh(new PlaneGeometry(3.2, 3.2), this.ringMat);
    ring.name = 'photon-ring';
    ring.renderOrder = 4;
    this.jetMat = additive(RING_V, JET_F, { uT: { value: 0 }, uColor: { value: violet.clone() } });
    const jets = new Group();
    jets.name = 'jets';
    for (const up of [1, -1]) {
      const j = new Mesh(new CylinderGeometry(0.5, 0.04, 9, 20, 1, true).translate(0, 4.5, 0), this.jetMat);
      j.scale.y = up;
      jets.add(j);
    }
    jets.rotation.x = this.tilt + Math.PI / 2;
    // Matter falling in: short stretched lines on spiralling orbits in the disc's plane.
    for (let i = 0; i < STREAKS; i++) this.respawn(i, 1.2 + Math.random() * 7.8);
    this.streakGeo.setAttribute('position', new BufferAttribute(this.spos, 3));
    this.streakGeo.setAttribute('color', new BufferAttribute(this.scol, 3));
    const streakMat = new LineBasicMaterial({ vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false });
    const infall = new LineSegments(this.streakGeo, streakMat);
    infall.name = 'infall';
    infall.frustumCulled = false;
    this.group.add(core, disc, disc2, ring, jets, infall);
    ring.onBeforeRender = (_r, _s, cam) => { ring.quaternion.copy(cam.quaternion); };
  }

  private respawn(i: number, r = 5.2 + Math.random() * 3.8): void {
    this.sr[i] = r;
    this.sa[i] = Math.random() * Math.PI * 2;
    this.sy[i] = (Math.random() - 0.5) * 0.5;
  }

  /** The streaks' distances from the core (tests). */
  streakRadii(): number[] { return Array.from(this.sr); }

  update(t: number, dt: number, _camera?: Camera): void {
    this.group.scale.setScalar(holeScale(t, this.life));
    for (const m of [this.discMat, this.disc2Mat, this.ringMat, this.jetMat]) m.uniforms.uT.value = t;
    this.ringMat.uniforms.uFlash.value = Math.max(0, 1 - t / 0.5);
    // A slow pulse in the disc.
    this.discMat.uniforms.uI.value = 1.05 + Math.sin(t * 5) * 0.12;
    const c = Math.cos(this.tilt), s = Math.sin(this.tilt);
    const hot = new Color(1, 0.9, 1), cold = new Color(0.6, 0.2, 0.9);
    const tmp = new Color();
    for (let i = 0; i < STREAKS; i++) {
      const r0 = this.sr[i], a0 = this.sa[i];
      const r = r0 - (1.2 + 7 / r0) * dt;
      const a = a0 + (3.2 / Math.pow(Math.max(1, r0), 1.5)) * dt * 3;
      if (r < 1.05) { this.respawn(i); continue; }
      this.sr[i] = r; this.sa[i] = a;
      // From where it was (stretched: a little further back the nearer it is) to where it is.
      const back = Math.min(0.9, 0.12 + 1.4 / r);
      const put = (o: number, rr: number, aa: number) => {
        const x = rr * Math.cos(aa), y = rr * Math.sin(aa), z = this.sy[i] * (rr / 5);
        // The disc's plane: (x, y) tilted about x.
        this.spos[o] = x; this.spos[o + 1] = y * c - z * s; this.spos[o + 2] = y * s + z * c;
      };
      put(i * 6, r + back * 0.4, a - back * 0.35);
      put(i * 6 + 3, r, a);
      tmp.copy(cold).lerp(hot, Math.max(0, 1 - (r - 1) / 4));
      const k = Math.min(1, (9 - r) / 2);
      for (let v = 0; v < 2; v++) { this.scol[i * 6 + v * 3] = tmp.r * k * (v ? 1 : 0.2); this.scol[i * 6 + v * 3 + 1] = tmp.g * k * (v ? 1 : 0.2); this.scol[i * 6 + v * 3 + 2] = tmp.b * k * (v ? 1 : 0.2); }
    }
    this.streakGeo.setDrawRange(0, STREAKS * 2);
    this.streakGeo.attributes.position.needsUpdate = true;
    this.streakGeo.attributes.color.needsUpdate = true;
  }

  dispose(): void { disposeTree(this.group); }
}

const FIRE_V = /* glsl */ `
uniform float uT;
uniform float uSeed;
varying vec3 vP;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec3 p = position;
  // Sways: the column bends in a slow wave that climbs it.
  float k = p.y / 7.0;
  p.x += sin(p.y * 0.7 - uT * 2.1 + uSeed) * 0.35 * k;
  p.z += cos(p.y * 0.6 - uT * 1.7 + uSeed) * 0.35 * k;
  vP = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const FIRE_F = /* glsl */ `
uniform float uT;
uniform float uHeat;
uniform float uI;
uniform float uSpin;
varying vec3 vP;
varying vec2 vUv;
${GLSL_NOISE_BASIC}
void main() {
  // Spinning and climbing: the noise is sampled in a frame that turns with time and with height.
  float w = uT * uSpin + vP.y * 0.55;
  float c = cos(w), s = sin(w);
  vec2 q = vec2(c * vP.x - s * vP.z, s * vP.x + c * vP.z);
  float n = fbm(vec2(q.x * 1.6, vP.y * 1.1 - uT * 3.2)) * 0.55 + fbm(vec2(q.y * 1.6 + 7.1, vP.y * 1.3 - uT * 3.7)) * 0.45;
  float h = n * uHeat;
  vec3 col = mix(vec3(0.45, 0.04, 0.0), vec3(1.0, 0.36, 0.03), smoothstep(0.3, 0.58, h));
  col = mix(col, vec3(1.0, 0.88, 0.55), smoothstep(0.62, 0.9, h));
  float a = smoothstep(0.4, 0.66, n) * smoothstep(0.0, 0.06, vUv.y) * smoothstep(1.0, 0.72, vUv.y);
  gl_FragColor = vec4(col * a * uI, 1.0);
}`;

const SMOKE_F = /* glsl */ `
uniform float uT;
varying vec3 vP;
varying vec2 vUv;
${GLSL_NOISE_BASIC}
void main() {
  float w = uT * 1.4;
  float c = cos(w), s = sin(w);
  vec2 q = vec2(c * vP.x - s * vP.z, s * vP.x + c * vP.z);
  float n = fbm(q * 0.9 + vec2(0.0, -uT * 0.4));
  float a = smoothstep(0.38, 0.7, n) * 0.7 * sin(vUv.y * 3.14159);
  gl_FragColor = vec4(vec3(0.07, 0.055, 0.06) + vec3(0.25, 0.08, 0.0) * smoothstep(0.6, 0.0, vUv.y) * n, a);
}`;

/** The tornado's radius `y` metres up: flared base, pinched just above the ground, wide at the top (7 m). */
function profile(y: number): number {
  if (y < 0.8) { const k = y / 0.8; return 1.5 + (0.55 - 1.5) * k * k * (3 - 2 * k); }
  return 0.55 + Math.pow((y - 0.8) / 6.2, 1.4) * 2.3;
}

export class FireTornadoFx {
  readonly group = new Group();
  private readonly mats: ShaderMaterial[] = [];

  constructor(_color: number) {
    const pts = (k: number, hk: number) => {
      const out: Vector2[] = [];
      for (let i = 0; i <= 28; i++) { const y = (i / 28) * 7; out.push(new Vector2(profile(y) * k, y * hk)); }
      return out;
    };
    const shells: Array<[number, number, number, number, number]> = [
      // radius scale, height scale, heat, brightness, spin
      [1, 1, 0.95, 0.9, 2.4],
      [0.72, 0.94, 1.15, 1.0, -3.1],
      [0.42, 0.85, 1.4, 1.1, 3.8],
    ];
    shells.forEach(([k, hk, heat, i, spin], n) => {
      const m = additive(FIRE_V, FIRE_F, { uT: { value: 0 }, uSeed: { value: n * 1.7 }, uHeat: { value: heat }, uI: { value: i }, uSpin: { value: spin } });
      this.mats.push(m);
      const mesh = new Mesh(new LatheGeometry(pts(k, hk), 56), m);
      mesh.name = `shell${n}`;
      mesh.renderOrder = 3 + n;
      this.group.add(mesh);
    });
    // The smoke cap: a dark rolling dome over the top.
    const cap: Vector2[] = [];
    for (let i = 0; i <= 12; i++) { const a = (i / 12) * Math.PI; cap.push(new Vector2(2.4 + Math.sin(a) * 1.4, 6.3 + (1 - Math.cos(a)) * 0.9)); }
    const smokeMat = new ShaderMaterial({ vertexShader: FIRE_V, fragmentShader: SMOKE_F, uniforms: { uT: { value: 0 }, uSeed: { value: 0 } }, transparent: true, depthWrite: false, blending: NormalBlending, side: DoubleSide });
    smokeMat.forceSinglePass = true;
    this.mats.push(smokeMat);
    const smoke = new Mesh(new LatheGeometry(cap, 48), smokeMat);
    smoke.name = 'smoke';
    this.group.add(smoke);
  }

  radiusAt(y: number): number { return profile(y); }

  /** `t` seconds in; `dir`: the way it is running (it leans into it). */
  update(t: number, _dt: number, dir: Vector3 | { x: number; z: number }): void {
    for (const m of this.mats) m.uniforms.uT.value = t;
    // Sways on its own and leans into the way it runs.
    this.group.rotation.z = Math.sin(t * 1.3) * 0.07 - dir.x * 0.09 + Math.sin(t * 3.1) * 0.025;
    this.group.rotation.x = Math.sin(t * 0.9 + 1) * 0.06 + dir.z * 0.09;
  }

  dispose(): void { disposeTree(this.group); }
}

function disposeTree(root: Group): void {
  const mats = new Set<Material>();
  root.traverse((o) => {
    const m = o as Mesh;
    if (m.geometry) m.geometry.dispose();
    if (m.material) for (const x of Array.isArray(m.material) ? m.material : [m.material]) mats.add(x);
  });
  for (const m of mats) m.dispose();
  root.removeFromParent();
}


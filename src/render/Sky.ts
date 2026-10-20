import {
  AdditiveBlending, BackSide, BufferGeometry, CanvasTexture, CircleGeometry, Color, type ColorRepresentation, Float32BufferAttribute, Group,
  LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry, Points, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3,
} from 'three';
import { PALETTE } from './palette';

const SKY_RADIUS = 520;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uZenith; uniform vec3 uCloudDark; uniform vec3 uCloudLit;
uniform vec3 uMoonDir; uniform vec3 uMoonGlow; uniform float uTime; uniform vec3 uNebulaA; uniform vec3 uNebulaB; uniform float uFlash;
uniform vec3 uVortexDir; uniform float uVortexAmount; uniform vec3 uVortexA; uniform vec3 uVortexB; uniform vec3 uVortexC;
uniform float uCover; uniform float uSwirl; uniform float uNebula;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.3) * 0.3 + vnoise(p * 4.7 - 1.2) * 0.2; }
float fbm5(vec2 p) {
  float a = 0.5, s = 0.0;
  for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p = p * 2.03 + vec2(1.7, -2.3); a *= 0.5; }
  return s / 0.97;
}
mat2 rot(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
void main() {
  vec3 vd = normalize(vDir);
  float y = clamp(vd.y, -0.1, 1.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.3, y));
  c = mix(c, uZenith, smoothstep(0.3, 0.95, y));
  float m = max(dot(vd, uMoonDir), 0.0);

  // Nebula band arcing across the sky, behind the clouds.
  float az = atan(vd.x, vd.z);
  float bandY = 0.42 + 0.22 * sin(az * 1.3 + 0.8);
  float bd = (vd.y - bandY) * 4.5;
  float band = exp(-bd * bd);
  vec2 np = vec2(az * 2.0, vd.y * 6.0) + vec2(uTime * 0.001, 0.0);
  float nn = fbm(np) * 0.6 + fbm(np * 2.7 + 11.0) * 0.4;
  vec3 neb = mix(uNebulaA, uNebulaB, fbm(np * 0.7 + 3.0));
  c += neb * band * smoothstep(0.42, 0.78, nn) * 0.55 * uNebula;

  // Spiral galaxy vortex around uVortexDir.
  vec3 vx = normalize(cross(uVortexDir, vec3(0.0, 1.0, 0.0)));
  vec3 vy = cross(vx, uVortexDir);
  float along = dot(vd, uVortexDir);
  if (along > 0.3 && uVortexAmount > 0.001) {
    vec2 q = vec2(dot(vd, vx), dot(vd, vy)) / along;
    float r = length(q);
    float ang = atan(q.y, q.x);
    float arms = sin(ang * 2.0 - r * 9.0 + uTime * 0.06) * 0.5 + 0.5;
    float core = exp(-r * 6.0);
    float disc = exp(-r * 1.6) * (1.0 - smoothstep(0.0, 0.9, r));
    float sw = pow(arms, 2.0) * disc * 0.9 + core * 1.2;
    float n2 = fbm(q * 6.0 + uTime * 0.01);
    vec3 vc = mix(uVortexA, uVortexB, arms);
    vc = mix(vc, uVortexC, smoothstep(0.5, 0.8, n2));
    c += vc * sw * uVortexAmount * smoothstep(0.3, 0.6, along) * (0.6 + n2 * 0.6);
  }

  // Clouds: a domain-warped layer projected on a high plane, slowly swirling around a point overhead, lit from the
  // moon side (silver linings, dark undersides) and glowing where they pass in front of it.
  vec2 p = vd.xz / (max(vd.y, 0.0) + 0.14) * 0.85;
  vec2 sc = vec2(-0.6, -1.4);
  vec2 dp = p - sc;
  dp = rot(uSwirl * 1.8 * exp(-length(dp) * 0.32) + uTime * 0.004 * uSwirl) * dp;
  p = sc + dp + vec2(uTime * 0.012, uTime * 0.004);
  vec2 w = vec2(fbm(p * 0.9 + uTime * 0.006), fbm(p * 0.9 + vec2(5.2, 1.3) - uTime * 0.005));
  float n = fbm5(p * 1.25 + w * 1.7);
  vec2 md = normalize(uMoonDir.xz + 1e-4);
  float nl = fbm5((p + md * 0.11) * 1.25 + w * 1.7);
  float dens = smoothstep(uCover - 0.16, uCover + 0.24, n);
  float horizonFade = smoothstep(-0.02, 0.16, vd.y);
  float lit = clamp((n - nl) * 5.0 + 0.45, 0.0, 1.0);
  vec3 cloud = mix(uCloudDark, uCloudLit, lit);
  cloud += uMoonGlow * (pow(m, 7.0) * 1.4 + pow(m, 40.0) * 1.6) * (0.35 + lit);
  // Thin wisps between the thick banks.
  float wisp = smoothstep(0.55, 0.85, fbm5(p * 3.1 - w * 2.0)) * (1.0 - dens) * 0.35;
  c = mix(c, cloud, clamp(dens * horizonFade, 0.0, 1.0) * 0.92);
  c += uCloudLit * wisp * horizonFade;
  c += uMoonGlow * (pow(m, 20.0) * 0.35 + pow(m, 180.0) * 0.6) * (1.0 - dens * 0.6);
  c += vec3(0.5, 0.6, 1.0) * uFlash * (0.35 + dens * 0.6);
  gl_FragColor = vec4(c, 1.0);
}`;

/** Corona around the black sun: a dark disc ringed by flickering blue fire (reel DeSEl9PvPG_). */
const ECLIPSE_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uCorona; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 q = vUv * 2.0 - 1.0;
  float r = length(q);
  float a = atan(q.y, q.x);
  float flame = vnoise(vec2(a * 6.0, r * 3.0 - uTime * 0.4)) * 0.6 + vnoise(vec2(a * 17.0, r * 9.0 - uTime * 0.9)) * 0.4;
  float rr = (r - 0.42) * 9.0;
  float ring = exp(-rr * rr) * 1.6;
  float rays = smoothstep(0.42, 0.5, r) * pow(max(0.0, 1.0 - (r - 0.42) / (0.55 * (0.5 + flame))), 2.0);
  vec3 col = uCorona * (ring + rays * 1.4) * (0.7 + flame * 0.6);
  float disc = 1.0 - smoothstep(0.395, 0.405, r);
  float alpha = max(disc, clamp(ring + rays, 0.0, 1.0)) * (1.0 - smoothstep(0.92, 1.0, r));
  gl_FragColor = vec4(mix(col, vec3(0.0), disc), alpha);
}`;

const STAR_VERT = /* glsl */ `
attribute float phase; uniform float uTime; varying float vA;
void main() {
  vA = 0.5 + 0.5 * sin(uTime * 1.7 + phase);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = 1.8 + vA * 1.8;
  gl_Position = projectionMatrix * mv;
}`;
const STAR_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, (0.35 + vA * 0.65) * (1.0 - d * 2.0) * uOpacity); }`;

/** A sky's colours as a reflection sees them (data/world REALM_SKY, Kingdom.ts kingdomSkyColors): hex or Color. */
export interface SkyColors { horizon: ColorRepresentation; mid: ColorRepresentation; zenith: ColorRepresentation; cloud: ColorRepresentation }

/** The colours and weather of one sky. Zones blend toward theirs (Sky.setPreset). */
export interface SkyPreset {
  horizon: number;
  mid: number;
  zenith: number;
  cloudDark: number;
  cloudLit: number;
  /** Cloud cover: lower is heavier (0.3 overcast, 0.6 broken banks). */
  cover: number;
  swirl: number;
  vortex: number;
  vortexA: number;
  vortexB: number;
  vortexC: number;
  nebula: number;
  stars: number;
  moon: number;
  eclipse: number;
}

const col = (hex: number, k = 1): Color => new Color(hex).multiplyScalar(k);
const TMP_COLOR = new Color();
const REFL_COLOR = new Color();
const BLOOD_TINT = new Color(1.9, 0.12, 0.1);

/**
 * The sky's colours, moon and clock as uniform objects shared with everything that reflects the sky (water, polished
 * ground). On the island the colours follow the island dome's own; in a realm they follow the realm's own sky
 * (Sky.setReflection: the kingdom's, the dream's, the vale's and the alley's presets, the drowned city's murk, a
 * room's dark), so a reflection always matches the sky above it. The moon's direction and colour (blood moon
 * included) are the dome's.
 */
export const SKY_SHARED = {
  uSkyHorizon: { value: new Color(0x1f3080) },
  uSkyMid: { value: new Color(0x0f1a6a) },
  uSkyZenith: { value: new Color(0x050a26) },
  uSkyCloud: { value: new Color(0x4a64c8) },
  uMoonDir: { value: new Vector3(0.15, Math.sin((25 * Math.PI) / 180), -1).normalize() },
  uMoonCol: { value: new Color(0.85, 0.9, 1.25) },
  uSkyTime: { value: 0 },
};

/** The island's reference night (#28, 01.16.36, 01.22.56) and the graveyard's amber storm (01.16.54). */
export const SKIES: Record<string, SkyPreset> = {
  island: {
    horizon: 0x1f3080, mid: 0x0f1a6a, zenith: 0x050a26, cloudDark: 0x0a1036, cloudLit: 0x4a64c8, cover: 0.5, swirl: 0.7,
    vortex: 0.5, vortexA: 0x3a3cff, vortexB: 0xc04ad8, vortexC: 0xff8a3a, nebula: 1, stars: 1, moon: 1, eclipse: 1,
  },
  // The Dragon's Vale (Dd5Bqt7vQ5T): a deep teal-blue night, thin clouds, many stars (the aurora is SkyEvents').
  vale: {
    horizon: 0x13405a, mid: 0x0a2048, zenith: 0x030818, cloudDark: 0x08182e, cloudLit: 0x3a6a9a, cover: 0.3, swirl: 0.3,
    vortex: 0, vortexA: 0x000000, vortexB: 0x000000, vortexC: 0x000000, nebula: 0.4, stars: 1.2, moon: 1, eclipse: 0,
  },
  graveyard: {
    horizon: 0x3a1460, mid: 0x5a2a28, zenith: 0x1a0c06, cloudDark: 0x2a1206, cloudLit: 0xd88a2a, cover: 0.34, swirl: 0.25,
    vortex: 0, vortexA: 0x000000, vortexB: 0x000000, vortexC: 0x000000, nebula: 0, stars: 0.25, moon: 0, eclipse: 0,
  },
};

/** Gradient dome with swirling moon-lit clouds, galaxy vortex and nebula, twinkling stars, the moon, a black sun. */
export class Sky {
  readonly group = new Group();
  readonly moonDir = SKY_SHARED.uMoonDir.value;
  private readonly domeMat: ShaderMaterial;
  private readonly starMat: ShaderMaterial;
  private readonly moonMat: MeshBasicMaterial;
  private readonly glowMat: SpriteMaterial;
  private readonly glow: Sprite;
  private readonly faceMat: MeshBasicMaterial;
  private readonly skyFace: Sprite;
  private readonly streak: Sprite;
  private readonly streakDir = new Vector3();
  private streakT = 99;
  /** The first shooting star comes a few seconds after you arrive; then one every 8–14 s. */
  private nextStreak = 3;
  private readonly moon: Mesh;
  private readonly face: Mesh;
  private readonly eclipse: Mesh;
  private readonly eclipseMat: ShaderMaterial;
  private faceModel: Group | null = null;
  /** The face-moon's tint (it turns red as a blood moon) and its own colour to come back to. */
  private moonTint: Color | null = null;
  private readonly moonTintBase = new Color();
  private bloodMoon = false;
  private preset: SkyPreset = SKIES.island;
  /** The sky the reflections follow instead of this dome's (a realm's own), or null. */
  private reflection: SkyColors | null = null;
  private readonly cur = { cover: 0.5, swirl: 0.7, vortex: 0.5, nebula: 1, stars: 1, moon: 1, eclipse: 1 };
  /** Where the black sun hangs: low in the north-west, over the forest gorge and the spire castle. */
  readonly eclipseDir = new Vector3(-0.62, 0.17, -0.77).normalize();
  /** 0..1 lightning flash, decays. */
  flash = 0;
  private time = 0;

  constructor() {
    this.domeMat = new ShaderMaterial({
      uniforms: {
        // (The dome's own colours: SKY_SHARED follows them, or a realm's sky; see blendReflection.)
        uHorizon: { value: SKY_SHARED.uSkyHorizon.value.clone() },
        uMid: { value: SKY_SHARED.uSkyMid.value.clone() },
        uZenith: { value: SKY_SHARED.uSkyZenith.value.clone() },
        uCloudDark: { value: col(SKIES.island.cloudDark) },
        uCloudLit: { value: SKY_SHARED.uSkyCloud.value.clone() },
        uMoonDir: { value: this.moonDir },
        uMoonGlow: { value: new Color(PALETTE.electric).multiplyScalar(0.5) },
        uTime: { value: 0 },
        uNebulaA: { value: new Color(PALETTE.dusk).multiplyScalar(0.5) },
        uNebulaB: { value: new Color(PALETTE.electric).multiplyScalar(0.45) },
        uFlash: { value: 0 },
        uVortexDir: { value: new Vector3(-0.6, 0.72, -0.35).normalize() },
        uVortexAmount: { value: SKIES.island.vortex },
        uVortexA: { value: col(SKIES.island.vortexA) },
        uVortexB: { value: col(SKIES.island.vortexB) },
        uVortexC: { value: col(SKIES.island.vortexC) },
        uCover: { value: SKIES.island.cover },
        uSwirl: { value: SKIES.island.swirl },
        uNebula: { value: 1 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new Mesh(new SphereGeometry(SKY_RADIUS, 48, 24), this.domeMat);
    // Last of the opaque pass: the depth test skips every pixel the world already covers (the shader is heavy).
    dome.renderOrder = 1000;
    this.group.add(dome);

    const starPos: number[] = [];
    const phases: number[] = [];
    let s = 99;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 2200; i++) {
      const theta = rnd() * Math.PI * 2;
      const y = 0.03 + rnd() * 0.97;
      const r = Math.sqrt(1 - y * y);
      starPos.push(Math.cos(theta) * r * SKY_RADIUS * 0.96, y * SKY_RADIUS * 0.96, Math.sin(theta) * r * SKY_RADIUS * 0.96);
      phases.push(rnd() * Math.PI * 2);
    }
    const starGeo = new BufferGeometry();
    starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3));
    starGeo.setAttribute('phase', new Float32BufferAttribute(phases, 1));
    this.starMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uColor: { value: new Color(PALETTE.moon) }, uOpacity: { value: 1 } },
      vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const stars = new Points(starGeo, this.starMat);
    stars.renderOrder = -9;
    this.group.add(stars);

    const moonRadius = SKY_RADIUS * 0.94 * Math.tan((4.5 * Math.PI) / 180);
    this.moonMat = new MeshBasicMaterial({ map: moonTexture(), color: new Color(PALETTE.moon).multiplyScalar(1.6), fog: false, toneMapped: false });
    const moon = new Mesh(new CircleGeometry(moonRadius, 48), this.moonMat);
    moon.position.copy(this.moonDir).multiplyScalar(SKY_RADIUS * 0.94);
    moon.lookAt(0, 0, 0);
    moon.renderOrder = -8;
    this.group.add(moon);
    this.moon = moon;

    // The moon with a face: fades in for a while every few minutes.
    this.faceMat = new MeshBasicMaterial({ map: faceTexture(), transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false });
    const face = new Mesh(new CircleGeometry(moonRadius * 1.001, 48), this.faceMat);
    face.position.copy(this.moonDir).multiplyScalar(SKY_RADIUS * 0.939);
    face.lookAt(0, 0, 0);
    face.renderOrder = -7;
    this.group.add(face);
    this.face = face;

    // The black sun: a dark disc with a blue corona, low over the north-west.
    this.eclipseMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCorona: { value: new Color(0.16, 0.34, 1.0) } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: ECLIPSE_FRAG, transparent: true, depthWrite: false, fog: false,
    });
    this.eclipse = new Mesh(new PlaneGeometry(moonRadius * 2.6, moonRadius * 2.6), this.eclipseMat);
    this.eclipse.position.copy(this.eclipseDir).multiplyScalar(SKY_RADIUS * 0.93);
    this.eclipse.lookAt(0, 0, 0);
    this.eclipse.renderOrder = -8;
    this.group.add(this.eclipse);

    // A colossal face in the clouds behind the moon (Lost Horizons): fades in for ~40 s every 3 min.
    this.skyFace = new Sprite(new SpriteMaterial({ map: skyFaceTexture(), color: 0x6f86ff, transparent: true, opacity: 0, fog: false, depthWrite: false, blending: AdditiveBlending }));
    this.skyFace.position.copy(this.moonDir).multiplyScalar(SKY_RADIUS * 0.97).add(new Vector3(0, -18, 0));
    this.skyFace.scale.set(moonRadius * 7.5, moonRadius * 9, 1);
    this.skyFace.renderOrder = -9;
    this.group.add(this.skyFace);

    this.streak = new Sprite(new SpriteMaterial({ map: streakTexture(), color: PALETTE.moon, blending: AdditiveBlending, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.streak.scale.set(40, 3, 1);
    this.streak.renderOrder = -7;
    this.group.add(this.streak);

    this.glowMat = new SpriteMaterial({ map: haloTexture(), color: PALETTE.electric, blending: AdditiveBlending, transparent: true, opacity: 0.5, fog: false, depthWrite: false });
    this.glow = new Sprite(this.glowMat);
    this.glow.position.copy(this.moonDir).multiplyScalar(SKY_RADIUS * 0.955);
    this.glow.scale.setScalar(moonRadius * 7);
    this.glow.renderOrder = -8;
    this.group.add(this.glow);
  }

  /** Blends toward another sky over a couple of seconds (the graveyard's amber storm, back to the island night). */
  setPreset(p: SkyPreset): void {
    this.preset = p;
  }

  /**
   * What water and polished ground reflect (SKY_SHARED): a realm's own sky (its colours may change from frame to
   * frame: the same object is read each frame), or null for this dome's own colours. Blended in update (1 − e^(−2·dt)).
   */
  setReflection(c: SkyColors | null): void {
    this.reflection = c;
  }

  /**
   * Replaces the flat cratered moon with a modelled face-moon (render/MoonFace). The canvas moon and its timed face
   * stay as the fallback while the model loads or if it is missing.
   */
  attachMoonModel(model: Group, tint?: Color): void {
    this.faceModel = model;
    this.moonTint = tint ?? null;
    if (tint) this.moonTintBase.copy(tint);
    model.position.copy(this.moonDir).multiplyScalar(SKY_RADIUS * 0.93);
    // (lookAt points the model's +z, its face, back at the camera at the dome's centre.)
    model.lookAt(0, 0, 0);
    model.renderOrder = -8;
    this.group.add(model);
    this.moon.visible = false;
    this.face.visible = false;
  }

  /** The moon's on-screen size: its radius in metres at the sky's distance (models are scaled to match). */
  static get moonRadius(): number {
    return SKY_RADIUS * 0.94 * Math.tan((4.5 * Math.PI) / 180);
  }

  private blendPreset(dt: number): void {
    const k = 1 - Math.exp(-dt * 1.2);
    const u = this.domeMat.uniforms;
    const p = this.preset;
    const tmp = TMP_COLOR;
    const lerpC = (name: string, hex: number) => (u[name].value as Color).lerp(tmp.set(hex), k);
    lerpC('uHorizon', p.horizon); lerpC('uMid', p.mid); lerpC('uZenith', p.zenith);
    lerpC('uCloudDark', p.cloudDark); lerpC('uCloudLit', p.cloudLit);
    lerpC('uVortexA', p.vortexA); lerpC('uVortexB', p.vortexB); lerpC('uVortexC', p.vortexC);
    const c = this.cur;
    c.cover += (p.cover - c.cover) * k; c.swirl += (p.swirl - c.swirl) * k; c.vortex += (p.vortex - c.vortex) * k;
    c.nebula += (p.nebula - c.nebula) * k; c.stars += (p.stars - c.stars) * k; c.moon += (p.moon - c.moon) * k;
    c.eclipse += (p.eclipse - c.eclipse) * k;
    u.uCover.value = c.cover; u.uSwirl.value = c.swirl; u.uVortexAmount.value = c.vortex; u.uNebula.value = c.nebula;
    this.starMat.uniforms.uOpacity.value = c.stars;
    const moonOn = c.moon > 0.05;
    this.moon.visible = moonOn && !this.faceModel;
    this.face.visible = moonOn && !this.faceModel;
    if (this.faceModel) this.faceModel.visible = moonOn;
    this.glow.visible = moonOn;
    this.eclipse.visible = c.eclipse > 0.05;
  }

  /** SKY_SHARED's colours toward the realm's sky, or toward the dome's own (the island restores its own). */
  private blendReflection(dt: number): void {
    const k = 1 - Math.exp(-2 * dt);
    const r = this.reflection;
    const u = this.domeMat.uniforms;
    const to = (c: ColorRepresentation | undefined, own: Color) => (c === undefined ? own : REFL_COLOR.set(c));
    SKY_SHARED.uSkyHorizon.value.lerp(to(r?.horizon, u.uHorizon.value as Color), k);
    SKY_SHARED.uSkyMid.value.lerp(to(r?.mid, u.uMid.value as Color), k);
    SKY_SHARED.uSkyZenith.value.lerp(to(r?.zenith, u.uZenith.value as Color), k);
    SKY_SHARED.uSkyCloud.value.lerp(to(r?.cloud, u.uCloudLit.value as Color), k);
  }

  setBloodMoon(on: boolean): void {
    if (on === this.bloodMoon) return;
    this.bloodMoon = on;
    if (this.moonTint) this.moonTint.copy(on ? BLOOD_TINT : this.moonTintBase);
    SKY_SHARED.uMoonCol.value.set(on ? 1.6 : 0.85, on ? 0.15 : 0.9, on ? 0.15 : 1.25);
    this.moonMat.color.set(on ? PALETTE.blood : PALETTE.moon).multiplyScalar(on ? 1.9 : 1.6);
    this.glowMat.color.set(on ? PALETTE.blood : PALETTE.electric);
    (this.domeMat.uniforms.uMoonGlow.value as Color).set(on ? PALETTE.blood : PALETTE.electric).multiplyScalar(on ? 0.35 : 0.5);
  }

  update(dt: number, cameraPosition: Vector3): void {
    this.time += dt;
    this.blendPreset(dt);
    this.blendReflection(dt);
    this.domeMat.uniforms.uTime.value = this.time;
    SKY_SHARED.uSkyTime.value = this.time;
    this.eclipseMat.uniforms.uTime.value = this.time;
    this.starMat.uniforms.uTime.value = this.time;
    this.glowMat.opacity = 0.45 + Math.sin(this.time * 0.6) * 0.07;
    this.group.position.copy(cameraPosition);
    // Sky face: period 180 s, visible ~40 s, starting at 100 s.
    const fp = (this.time % 180) / 180;
    const sf = fp > 0.55 && fp < 0.78 ? Math.sin(((fp - 0.55) / 0.23) * Math.PI) : 0;
    this.skyFace.material.opacity = sf * 0.55;
    // Moon face: period 150 s, visible ~30 s.
    const phase = (this.time % 150) / 150;
    const face = phase > 0.6 && phase < 0.8 ? Math.sin(((phase - 0.6) / 0.2) * Math.PI) : 0;
    this.faceMat.opacity = Math.min(1, face * 1.4) * 0.9;
    // Shooting stars.
    this.streakT += dt;
    if (this.streakT > this.nextStreak) {
      this.streakT = 0;
      this.nextStreak = 8 + Math.random() * 6;
      const az = Math.random() * Math.PI * 2;
      const el = 0.35 + Math.random() * 0.4;
      this.streak.position.set(Math.cos(az) * SKY_RADIUS * 0.9, Math.sin(el) * SKY_RADIUS * 0.9, Math.sin(az) * SKY_RADIUS * 0.9);
      this.streakDir.set(-Math.sin(az), -0.35, Math.cos(az)).normalize().multiplyScalar(90);
      this.streak.material.rotation = Math.atan2(-0.35, 1) + (az > Math.PI ? Math.PI : 0);
    }
    if (this.streakT < 1.1) {
      this.streak.position.addScaledVector(this.streakDir, dt);
      this.streak.material.opacity = Math.sin((this.streakT / 1.1) * Math.PI) * 0.9;
    } else this.streak.material.opacity = 0;
    this.flash = Math.max(0, this.flash - dt * 4);
    this.domeMat.uniforms.uFlash.value = this.flash;
  }
}

function moonTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#e4e9ff';
  ctx.fillRect(0, 0, size, size);
  let s = 7;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  for (let i = 0; i < 60; i++) {
    const r = 4 + rnd() * 22;
    const x = rnd() * size;
    const y = rnd() * size;
    const g = ctx.createRadialGradient(x, y, r * 0.2, x, y, r);
    g.addColorStop(0, 'rgba(150,165,215,0.55)');
    g.addColorStop(1, 'rgba(150,165,215,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  const edge = ctx.createRadialGradient(size / 2, size / 2, size * 0.36, size / 2, size / 2, size * 0.5);
  edge.addColorStop(0, 'rgba(120,135,200,0)');
  edge.addColorStop(1, 'rgba(120,135,200,0.45)');
  ctx.fillStyle = edge;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = tex.magFilter = LinearFilter;
  return tex;
}

function haloTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,0.9)');
  g.addColorStop(0.2, 'rgba(255,255,255,0.35)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

function faceTexture(): CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'rgba(10,12,40,0.85)';
  // Hollow eyes.
  for (const x of [88, 168]) {
    ctx.beginPath();
    ctx.ellipse(x, 100, 22, 30, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Wide grin with teeth.
  ctx.beginPath();
  ctx.moveTo(60, 150);
  ctx.quadraticCurveTo(128, 230, 196, 150);
  ctx.quadraticCurveTo(128, 185, 60, 150);
  ctx.fill();
  ctx.fillStyle = 'rgba(200,210,240,0.9)';
  for (let i = 0; i < 9; i++) {
    const x = 72 + i * 14;
    const y = 158 + Math.sin((i / 8) * Math.PI) * 14;
    ctx.fillRect(x, y, 9, 10);
  }
  // Faint glowing pupils.
  ctx.fillStyle = 'rgba(79,124,255,0.9)';
  for (const x of [88, 168]) { ctx.beginPath(); ctx.arc(x, 104, 6, 0, Math.PI * 2); ctx.fill(); }
  return new CanvasTexture(canvas);
}

function streakTexture(): CanvasTexture {
  const w = 256;
  const h = 16;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, w, 0);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.75, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,1)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  return new CanvasTexture(canvas);
}

/** Huge brooding face: shadowed brow, closed eyes, heavy mouth, drawn soft so it reads as cloud. */
function skyFaceTexture(): CanvasTexture {
  const w = 256;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, w, h);
  const soft = (x: number, y: number, rx: number, ry: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, rx, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  soft(128, 150, 110, 150, 0.35); // head mass
  soft(90, 120, 30, 14, 0.9); // brows
  soft(166, 120, 30, 14, 0.9);
  soft(128, 175, 16, 34, 0.7); // nose
  soft(128, 235, 46, 12, 0.85); // mouth
  soft(74, 165, 28, 40, 0.5); // cheeks
  soft(182, 165, 28, 40, 0.5);
  return new CanvasTexture(canvas);
}

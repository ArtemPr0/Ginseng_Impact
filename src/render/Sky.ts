import {
  AdditiveBlending, BackSide, BufferGeometry, CanvasTexture, CircleGeometry, Color, Float32BufferAttribute, Group,
  LinearFilter, Mesh, MeshBasicMaterial, Points, ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3,
} from 'three';
import { PALETTE } from './palette';

const SKY_RADIUS = 520;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uZenith; uniform vec3 uCloud; uniform vec3 uMoonDir; uniform vec3 uMoonGlow; uniform float uTime; uniform vec3 uNebulaA; uniform vec3 uNebulaB; uniform float uFlash; uniform vec3 uVortexDir; uniform float uVortexAmount;
varying vec3 vDir;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.3) * 0.3 + vnoise(p * 4.7 - 1.2) * 0.2; }
void main() {
  float y = clamp(vDir.y, -0.1, 1.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.3, y));
  c = mix(c, uZenith, smoothstep(0.3, 0.95, y));
  vec2 p = vDir.xz / max(vDir.y, 0.06) * 1.4 + vec2(uTime * 0.006, uTime * 0.002);
  float n = fbm(p);
  float cloud = smoothstep(0.46, 0.74, n) * smoothstep(0.02, 0.22, y) * (1.0 - smoothstep(0.55, 0.95, y));
  c = mix(c, uCloud, cloud * 0.75);
  // Nebula band arcing across the sky.
  float az = atan(vDir.x, vDir.z);
  float bandY = 0.42 + 0.22 * sin(az * 1.3 + 0.8);
  float band = exp(-pow((vDir.y - bandY) * 4.5, 2.0));
  vec2 np = vec2(az * 2.0, vDir.y * 6.0) + vec2(uTime * 0.001, 0.0);
  float nn = fbm(np) * 0.6 + fbm(np * 2.7 + 11.0) * 0.4;
  vec3 neb = mix(uNebulaA, uNebulaB, fbm(np * 0.7 + 3.0));
  c += neb * band * smoothstep(0.42, 0.78, nn) * 0.55 * (1.0 - cloud);
  float m = max(dot(normalize(vDir), uMoonDir), 0.0);
  c += uMoonGlow * (pow(m, 20.0) * 0.35 + pow(m, 180.0) * 0.6);
  // Spiral galaxy vortex around uVortexDir.
  vec3 vd = normalize(vDir);
  vec3 vx = normalize(cross(uVortexDir, vec3(0.0, 1.0, 0.0)));
  vec3 vy = cross(vx, uVortexDir);
  float along = dot(vd, uVortexDir);
  if (along > 0.3) {
    vec2 q = vec2(dot(vd, vx), dot(vd, vy)) / along;
    float r = length(q);
    float ang = atan(q.y, q.x);
    float arms = sin(ang * 2.0 - r * 9.0 + uTime * 0.06) * 0.5 + 0.5;
    float core = exp(-r * 6.0);
    float disc = exp(-r * 1.6) * (1.0 - smoothstep(0.0, 0.9, r));
    float sw = pow(arms, 2.0) * disc * 0.9 + core * 1.2;
    float n2 = fbm(q * 6.0 + uTime * 0.01);
    vec3 vc = mix(vec3(0.2, 0.3, 1.0), vec3(0.9, 0.3, 0.9), arms) ;
    vc = mix(vc, vec3(0.3, 0.95, 1.0), smoothstep(0.5, 0.8, n2));
    c += vc * sw * uVortexAmount * smoothstep(0.3, 0.6, along) * (0.6 + n2 * 0.6);
  }
  c += vec3(0.5, 0.6, 1.0) * uFlash * (0.35 + cloud * 0.5);
  gl_FragColor = vec4(c, 1.0);
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
uniform vec3 uColor; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, (0.35 + vA * 0.65) * (1.0 - d * 2.0)); }`;

/** Gradient dome with drifting clouds and a moon glow, twinkling stars, cratered moon with a soft halo. */
export class Sky {
  readonly group = new Group();
  readonly moonDir = new Vector3(0.15, Math.sin((25 * Math.PI) / 180), -1).normalize();
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
  private nextStreak = 8;
  /** 0..1 lightning flash, decays. */
  flash = 0;
  private time = 0;

  constructor() {
    this.domeMat = new ShaderMaterial({
      uniforms: {
        uHorizon: { value: new Color(PALETTE.fog).multiplyScalar(1.15) },
        uMid: { value: new Color(PALETTE.cobalt).multiplyScalar(0.5) },
        uZenith: { value: new Color(PALETTE.abyss).multiplyScalar(0.55) },
        uCloud: { value: new Color(PALETTE.cobalt).lerp(new Color(PALETTE.dusk), 0.35).multiplyScalar(0.42) },
        uMoonDir: { value: this.moonDir },
        uMoonGlow: { value: new Color(PALETTE.electric).multiplyScalar(0.5) },
        uTime: { value: 0 },
        uNebulaA: { value: new Color(PALETTE.dusk).multiplyScalar(0.5) },
        uNebulaB: { value: new Color(PALETTE.electric).multiplyScalar(0.45) },
        uFlash: { value: 0 },
        uVortexDir: { value: new Vector3(-0.6, 0.72, -0.35).normalize() },
        uVortexAmount: { value: 0.55 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: BackSide,
      depthWrite: false,
      fog: false,
    });
    const dome = new Mesh(new SphereGeometry(SKY_RADIUS, 48, 24), this.domeMat);
    dome.renderOrder = -10;
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
      uniforms: { uTime: { value: 0 }, uColor: { value: new Color(PALETTE.moon) } },
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

    // The moon with a face: fades in for a while every few minutes.
    this.faceMat = new MeshBasicMaterial({ map: faceTexture(), transparent: true, opacity: 0, fog: false, depthWrite: false, toneMapped: false });
    const face = new Mesh(new CircleGeometry(moonRadius * 1.001, 48), this.faceMat);
    face.position.copy(this.moonDir).multiplyScalar(SKY_RADIUS * 0.939);
    face.lookAt(0, 0, 0);
    face.renderOrder = -7;
    this.group.add(face);

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

  setBloodMoon(on: boolean): void {
    this.moonMat.color.set(on ? PALETTE.blood : PALETTE.moon).multiplyScalar(on ? 1.9 : 1.6);
    this.glowMat.color.set(on ? PALETTE.blood : PALETTE.electric);
    (this.domeMat.uniforms.uMoonGlow.value as Color).set(on ? PALETTE.blood : PALETTE.electric).multiplyScalar(on ? 0.35 : 0.5);
  }

  update(dt: number, cameraPosition: Vector3): void {
    this.time += dt;
    this.domeMat.uniforms.uTime.value = this.time;
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
      this.nextStreak = 10 + Math.random() * 18;
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

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
uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uZenith; uniform vec3 uCloud; uniform vec3 uMoonDir; uniform vec3 uMoonGlow; uniform float uTime;
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
  float m = max(dot(normalize(vDir), uMoonDir), 0.0);
  c += uMoonGlow * (pow(m, 20.0) * 0.35 + pow(m, 180.0) * 0.6);
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

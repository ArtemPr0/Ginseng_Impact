import {
  AdditiveBlending, BackSide, BufferGeometry, CircleGeometry, Color, Float32BufferAttribute, Group,
  Mesh, MeshBasicMaterial, Points, PointsMaterial, ShaderMaterial, SphereGeometry, Sprite,
  SpriteMaterial, Vector3, CanvasTexture, NearestFilter,
} from 'three';
import { PALETTE } from './palette';

const SKY_RADIUS = 520;

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize(position);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uHorizon; uniform vec3 uMid; uniform vec3 uZenith;
varying vec3 vDir;
void main() {
  float y = clamp(vDir.y, -0.1, 1.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.25, y));
  c = mix(c, uZenith, smoothstep(0.25, 0.9, y));
  gl_FragColor = vec4(c, 1.0);
}`;

/** Gradient dome (fog → cobalt → abyss), 1 500 stars, and a moon with an additive glow sprite. */
export class Sky {
  readonly group = new Group();
  readonly moonDir = new Vector3(0.15, Math.sin((25 * Math.PI) / 180), -1).normalize();
  private readonly moonMat: MeshBasicMaterial;
  private readonly glowMat: SpriteMaterial;

  constructor() {
    const dome = new Mesh(
      new SphereGeometry(SKY_RADIUS, 24, 12),
      new ShaderMaterial({
        uniforms: {
          uHorizon: { value: new Color(PALETTE.fog) },
          uMid: { value: new Color(PALETTE.cobalt).multiplyScalar(0.55) },
          uZenith: { value: new Color(PALETTE.abyss).multiplyScalar(0.7) },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
        side: BackSide,
        depthWrite: false,
        fog: false,
      }),
    );
    dome.renderOrder = -10;
    this.group.add(dome);

    const starPos: number[] = [];
    let s = 99;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    for (let i = 0; i < 1500; i++) {
      const u = rnd();
      const v = rnd();
      const theta = u * Math.PI * 2;
      const y = 0.05 + v * 0.95;
      const r = Math.sqrt(1 - y * y);
      starPos.push(Math.cos(theta) * r * SKY_RADIUS * 0.96, y * SKY_RADIUS * 0.96, Math.sin(theta) * r * SKY_RADIUS * 0.96);
    }
    const starGeo = new BufferGeometry();
    starGeo.setAttribute('position', new Float32BufferAttribute(starPos, 3));
    const stars = new Points(starGeo, new PointsMaterial({ color: PALETTE.moon, size: 1.5, sizeAttenuation: false, fog: false }));
    stars.renderOrder = -9;
    this.group.add(stars);

    const moonRadius = SKY_RADIUS * 0.94 * Math.tan((4 * Math.PI) / 180);
    this.moonMat = new MeshBasicMaterial({ color: PALETTE.moon, fog: false });
    const moon = new Mesh(new CircleGeometry(moonRadius, 24), this.moonMat);
    moon.position.copy(this.moonDir).multiplyScalar(SKY_RADIUS * 0.94);
    moon.lookAt(0, 0, 0);
    moon.renderOrder = -8;
    this.group.add(moon);

    this.glowMat = new SpriteMaterial({ map: radialGlowTexture(), color: PALETTE.electric, blending: AdditiveBlending, transparent: true, opacity: 0.45, fog: false, depthWrite: false });
    const glow = new Sprite(this.glowMat);
    glow.position.copy(this.moonDir).multiplyScalar(SKY_RADIUS * 0.955); // just behind the disc
    glow.scale.setScalar(moonRadius * 6);
    glow.renderOrder = -8;
    this.group.add(glow);
  }

  /** Silver by default; blood moon for combat/boss zones. */
  setBloodMoon(on: boolean): void {
    this.moonMat.color.set(on ? PALETTE.blood : PALETTE.moon);
    this.glowMat.color.set(on ? PALETTE.blood : PALETTE.electric);
  }

  /** Keep the dome centred on the camera so it never clips. */
  follow(cameraPosition: Vector3): void {
    this.group.position.copy(cameraPosition);
  }
}

function radialGlowTexture(): CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = tex.magFilter = NearestFilter;
  return tex;
}

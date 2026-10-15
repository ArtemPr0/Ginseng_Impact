import { AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, NormalBlending, Points, ShaderMaterial, Vector3, type Blending } from 'three';
import { PALETTE } from './palette';

export interface WeatherZone { x: number; z: number; radius: number }

const RAIN_VERT = /* glsl */ `
attribute float seed; uniform float uTime; uniform vec3 uCenter; uniform float uRange; uniform float uHeight; uniform float uSpeed; uniform float uSway; varying float vA;
void main() {
  float fall = mod(position.y - uTime * uSpeed * (0.7 + seed * 0.6), uHeight);
  vec3 p = vec3(position.x + sin(uTime * 0.8 + seed * 9.0) * uSway, fall, position.z + cos(uTime * 0.6 + seed * 7.0) * uSway);
  p.xz = mod(p.xz - uCenter.xz + uRange * 0.5, uRange) - uRange * 0.5 + uCenter.xz;
  p.y += uCenter.y - 4.0;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vA = smoothstep(1.5, 6.0, dist) * exp(-dist * 0.03);
  gl_PointSize = uSway > 0.5 ? (3.0 + 180.0 / max(dist, 2.0)) : (2.0 + 320.0 / max(dist, 2.0));
  gl_Position = projectionMatrix * mv;
}`;
const RAIN_FRAG = /* glsl */ `
uniform sampler2D uMap; uniform vec3 uColor; uniform float uOpacity; varying float vA;
void main() { vec4 t = texture2D(uMap, gl_PointCoord); gl_FragColor = vec4(uColor, t.a * vA * uOpacity); }`;

function streakTexture(): CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 0, size);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.9)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(14, 0, 4, size);
  return new CanvasTexture(canvas);
}

function flakeTexture(): CanvasTexture {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return new CanvasTexture(canvas);
}

/** Localised precipitation: rain over the orchard, snow over the frozen realm; both fade with distance from their zone. */
export class Weather {
  readonly group = new Group();
  private readonly rainMat: ShaderMaterial;
  private readonly snowMat: ShaderMaterial;
  private time = 0;
  private lightningIn = 12;
  /** True while the player stands inside the rain zone (drives lightning). */
  inRain = false;

  constructor(private readonly rain: WeatherZone, private readonly snow: WeatherZone) {
    const make = (count: number, range: number, height: number, speed: number, sway: number, color: number, map: CanvasTexture, opacity: number, blending: Blending) => {
      const pos: number[] = [];
      const seeds: number[] = [];
      for (let i = 0; i < count; i++) {
        pos.push((Math.random() - 0.5) * range, Math.random() * height, (Math.random() - 0.5) * range);
        seeds.push(Math.random());
      }
      const geo = new BufferGeometry();
      geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
      geo.setAttribute('seed', new Float32BufferAttribute(seeds, 1));
      const mat = new ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uCenter: { value: new Vector3() }, uRange: { value: range }, uHeight: { value: height }, uSpeed: { value: speed }, uSway: { value: sway }, uMap: { value: map }, uColor: { value: new Color(color) }, uOpacity: { value: opacity } },
        vertexShader: RAIN_VERT, fragmentShader: RAIN_FRAG, transparent: true, depthWrite: false, blending,
      });
      const pts = new Points(geo, mat);
      pts.frustumCulled = false;
      this.group.add(pts);
      return mat;
    };
    this.rainMat = make(3200, 70, 30, 22, 0.0, 0x9fb0ff, streakTexture(), 0.55, NormalBlending);
    this.snowMat = make(2200, 80, 26, 1.6, 1.2, PALETTE.moon, flakeTexture(), 0.8, AdditiveBlending);
  }

  /**
   * Returns a lightning flash strength (0 most frames). `covered`: the player is under a roof (the cathedral's nave,
   * a bridge's arch), where no rain or snow falls.
   */
  update(dt: number, player: Vector3, covered = false): number {
    this.time += dt;
    this.cover += ((covered ? 1 : 0) - this.cover) * Math.min(1, dt * 3);
    const open = 1 - this.cover;
    const rainF = this.zoneFade(this.rain, player) * open;
    const snowF = this.zoneFade(this.snow, player) * open;
    this.inRain = rainF > 0.5;
    this.fall(this.rainMat, rainF, 0.55, player);
    this.fall(this.snowMat, snowF, 0.8, player);
    this.lightningIn -= dt * (this.inRain ? 1 : 0.15);
    if (this.lightningIn <= 0) {
      this.lightningIn = this.inRain ? 9 + Math.random() * 16 : 40 + Math.random() * 60;
      return 1;
    }
    return 0;
  }

  private cover = 0;

  private zoneFade(z: WeatherZone, player: Vector3): number {
    return 1 - Math.min(1, Math.max(0, (Math.hypot(player.x - z.x, player.z - z.z) - z.radius) / 40));
  }

  private fall(mat: ShaderMaterial, f: number, opacity: number, player: Vector3): void {
    mat.uniforms.uTime.value = this.time;
    (mat.uniforms.uCenter.value as Vector3).copy(player);
    mat.uniforms.uOpacity.value = opacity * f;
    mat.visible = f > 0.01;
  }
}

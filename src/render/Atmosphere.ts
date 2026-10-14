import {
  AdditiveBlending, BufferGeometry, CanvasTexture, Color, Float32BufferAttribute, Group, LinearFilter, NormalBlending,
  Points, ShaderMaterial, Sprite, SpriteMaterial, Vector3,
} from 'three';
import { PALETTE } from './palette';

interface MistSprite { sprite: Sprite; vx: number; vz: number; spin: number; baseOpacity: number; height: number }

const MIST_RANGE = 110;

/** Soft noise blob used by the mist sprites. */
function mistTexture(seed: number): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  let s = seed;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const grid = 8;
  const cells: number[] = [];
  for (let i = 0; i < (grid + 1) * (grid + 1) * 4; i++) cells.push(rnd());
  const val = (x: number, y: number, oct: number) => {
    const g = grid * (1 << oct);
    const fx = x * g, fy = y * g;
    const ix = Math.floor(fx), iy = Math.floor(fy);
    const tx = fx - ix, ty = fy - iy;
    const h = (a: number, b: number) => cells[((a * 73 + b * 151 + oct * 37) % cells.length + cells.length) % cells.length];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    return (h(ix, iy) * (1 - sx) + h(ix + 1, iy) * sx) * (1 - sy) + (h(ix, iy + 1) * (1 - sx) + h(ix + 1, iy + 1) * sx) * sy;
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size;
      const n = val(u, v, 0) * 0.5 + val(u, v, 1) * 0.3 + val(u, v, 2) * 0.2;
      const dx = u - 0.5, dy = (v - 0.5) * 1.6;
      const falloff = Math.max(0, 1 - Math.hypot(dx, dy) * 2.2);
      const a = Math.max(0, (n - 0.35) / 0.45) * falloff * falloff;
      const k = (y * size + x) * 4;
      img.data[k] = 255; img.data[k + 1] = 255; img.data[k + 2] = 255; img.data[k + 3] = Math.round(Math.min(1, a) * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new CanvasTexture(canvas);
  tex.minFilter = tex.magFilter = LinearFilter;
  return tex;
}

const MOTE_VERT = /* glsl */ `
attribute float phase; uniform float uTime; uniform vec3 uCenter; uniform float uRange; varying float vA;
void main() {
  vec3 drift = vec3(sin(uTime * 0.25 + phase) * 3.0, uTime * 0.35 + sin(uTime * 0.4 + phase * 2.0) * 1.5, cos(uTime * 0.22 + phase) * 3.0);
  vec3 p = mod(position + drift - uCenter + uRange * 0.5, uRange) - uRange * 0.5 + uCenter;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float dist = -mv.z;
  vA = (0.5 + 0.5 * sin(uTime * 1.3 + phase * 3.0)) * smoothstep(2.0, 10.0, dist) * exp(-dist * 0.018);
  gl_PointSize = 4.0 * (60.0 / max(dist, 1.0)) + 1.5;
  gl_Position = projectionMatrix * mv;
}`;
const MOTE_FRAG = /* glsl */ `
uniform vec3 uColor; varying float vA;
void main() { float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(uColor, vA * (1.0 - d * 2.0) * 0.8); }`;

/** Ground-hugging drifting mist sprites plus floating light motes, both kept centred on the player. */
export class Atmosphere {
  readonly group = new Group();
  private readonly mists: MistSprite[] = [];
  private readonly moteMat: ShaderMaterial;
  private time = 0;
  private readonly tmp = new Vector3();

  constructor(private readonly heightAt: (x: number, z: number) => number, origin: Vector3) {
    const textures = [mistTexture(11), mistTexture(29), mistTexture(53)];
    let s = 3;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const tint = new Color(PALETTE.fog).lerp(new Color(PALETTE.electric), 0.4);
    for (let i = 0; i < 42; i++) {
      const mat = new SpriteMaterial({ map: textures[i % 3], color: tint, transparent: true, opacity: 0.1, depthWrite: false, blending: NormalBlending, fog: true, rotation: rnd() * Math.PI * 2 });
      const sprite = new Sprite(mat);
      const w = 55 + rnd() * 80;
      sprite.scale.set(w, w * 0.38, 1);
      sprite.renderOrder = 3;
      const x = origin.x + (rnd() - 0.5) * MIST_RANGE * 2;
      const z = origin.z + (rnd() - 0.5) * MIST_RANGE * 2;
      const height = 1.5 + rnd() * 7;
      sprite.position.set(x, this.groundAt(x, z) + height, z);
      this.group.add(sprite);
      this.mists.push({ sprite, vx: (rnd() - 0.5) * 1.2, vz: (rnd() - 0.5) * 1.2, spin: (rnd() - 0.5) * 0.02, baseOpacity: 0.2 + rnd() * 0.18, height });
    }

    const n = 1400;
    const pos: number[] = [];
    const phase: number[] = [];
    const range = 110;
    for (let i = 0; i < n; i++) {
      pos.push((rnd() - 0.5) * range, (rnd() - 0.5) * range, (rnd() - 0.5) * range);
      phase.push(rnd() * Math.PI * 2);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
    geo.setAttribute('phase', new Float32BufferAttribute(phase, 1));
    this.moteMat = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uCenter: { value: new Vector3() }, uRange: { value: range }, uColor: { value: new Color(PALETTE.electric) } },
      vertexShader: MOTE_VERT, fragmentShader: MOTE_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
    });
    const motes = new Points(geo, this.moteMat);
    motes.frustumCulled = false;
    this.group.add(motes);
  }

  private groundAt(x: number, z: number): number {
    return Math.max(this.heightAt(x, z), -30);
  }

  update(dt: number, player: Vector3, camera: Vector3): void {
    this.time += dt;
    this.moteMat.uniforms.uTime.value = this.time;
    (this.moteMat.uniforms.uCenter.value as Vector3).copy(player);
    for (const m of this.mists) {
      const p = m.sprite.position;
      p.x += m.vx * dt;
      p.z += m.vz * dt;
      if (p.x - player.x > MIST_RANGE) p.x -= MIST_RANGE * 2;
      if (p.x - player.x < -MIST_RANGE) p.x += MIST_RANGE * 2;
      if (p.z - player.z > MIST_RANGE) p.z -= MIST_RANGE * 2;
      if (p.z - player.z < -MIST_RANGE) p.z += MIST_RANGE * 2;
      const target = this.groundAt(p.x, p.z) + m.height;
      p.y += (target - p.y) * Math.min(1, dt * 0.8);
      m.sprite.material.rotation += m.spin * dt;
      const d = this.tmp.copy(p).sub(camera).length();
      m.sprite.material.opacity = m.baseOpacity * Math.min(1, Math.max(0, (d - 6) / 18));
    }
  }
}

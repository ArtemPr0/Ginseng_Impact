/**
 * Big Gerald's effects (the octopus boss, the playtest of 2026-11-14): the ink he jets, a billowing dark cloud that hangs
 * in the water and thins away, and the whirlpool he spins up, a spiral turning on the ground under him.
 */
import {
  AdditiveBlending, CanvasTexture, CircleGeometry, Color, DoubleSide, Group, Mesh, NormalBlending, ShaderMaterial, Sprite, SpriteMaterial,
  SRGBColorSpace, type Vector3,
} from 'three';

let inkTex: CanvasTexture | null = null;
/**
 * A puff of ink as filled smoke: a solid deep-purple body (not near-black: that vanished against the dark water, and a
 * bright rim alone read as hollow rings), lobed, soft at its edge, a paler wisp lit from above.
 */
function inkTexture(): CanvasTexture {
  if (inkTex) return inkTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const blob = (x: number, y: number, r: number, rgb: string, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(${rgb},${a})`);
    g.addColorStop(0.6, `rgba(${rgb},${a * 0.9})`);
    g.addColorStop(1, `rgba(${rgb},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };
  for (const [x, y, r] of [[46, 54, 34], [82, 50, 32], [78, 84, 34], [46, 82, 30], [64, 64, 46]] as const) blob(x, y, r, '52,16,92', 0.95);
  for (const [x, y, r] of [[56, 44, 22], [76, 40, 16]] as const) blob(x, y, r, '130,70,210', 0.35);
  inkTex = new CanvasTexture(canvas);
  inkTex.colorSpace = SRGBColorSpace;
  return inkTex;
}

const PUFFS = 64;
const GROW = 0.45;
const HANG = 2.2;
const THIN = 1.3;

interface Puff { sprite: Sprite; mat: SpriteMaterial; delay: number; age: number; size: number; vx: number; vy: number; vz: number; live: boolean }

/** A pool of ink puffs: `jet` fans a burst out along a facing, `update` swells, drifts and thins them. */
export class InkClouds {
  readonly group = new Group();
  private readonly puffs: Puff[] = [];
  private next = 0;

  constructor() {
    for (let i = 0; i < PUFFS; i++) {
      const mat = new SpriteMaterial({ map: inkTexture(), transparent: true, opacity: 0, depthWrite: false, blending: NormalBlending, fog: true, rotation: i * 2.39 });
      const sprite = new Sprite(mat);
      sprite.visible = false;
      this.group.add(sprite);
      this.puffs.push({ sprite, mat, delay: 0, age: 0, size: 1, vx: 0, vy: 0, vz: 0, live: false });
    }
  }

  /**
   * A jet from `from` along `yaw` (direction (cos, sin)), `reach` metres long and `half` radians wide, sinking toward
   * `floorY` as it goes (it is sprayed down at whoever stands there).
   */
  jet(from: Vector3, yaw: number, reach: number, half: number, floorY = from.y): void {
    const n = 22;
    for (let i = 0; i < n; i++) {
      const p = this.puffs[this.next];
      this.next = (this.next + 1) % PUFFS;
      const d = reach * (0.12 + 0.88 * (i / (n - 1))) * (0.85 + Math.random() * 0.3);
      const a = yaw + (Math.random() * 2 - 1) * half * 0.8;
      const sink = Math.min(1, d / reach);
      p.sprite.position.set(from.x + Math.cos(a) * d, from.y + (floorY + 1.2 - from.y) * sink + (Math.random() - 0.3) * 1.5, from.z + Math.sin(a) * d);
      // (Out along the jet: the near puffs first, as if it were sprayed.)
      p.delay = d / 24;
      p.age = 0;
      p.size = 2.4 + d * 0.32 + Math.random() * 1.6;
      p.vx = Math.cos(a) * 0.8; p.vz = Math.sin(a) * 0.8; p.vy = 0.25 + Math.random() * 0.3;
      p.live = true;
      p.sprite.visible = false;
    }
  }

  update(dt: number): void {
    for (const p of this.puffs) {
      if (!p.live) continue;
      if (p.delay > 0) { p.delay -= dt; continue; }
      p.age += dt;
      const t = p.age;
      if (t > GROW + HANG + THIN) { p.live = false; p.sprite.visible = false; continue; }
      p.sprite.visible = true;
      const grow = Math.min(1, t / GROW);
      p.sprite.scale.setScalar(p.size * (0.3 + 0.7 * (1 - (1 - grow) ** 3)) * (1 + 0.12 * Math.max(0, t - GROW)));
      p.sprite.position.x += p.vx * dt; p.sprite.position.y += p.vy * dt; p.sprite.position.z += p.vz * dt;
      p.vx *= 1 - dt * 1.5; p.vz *= 1 - dt * 1.5;
      p.mat.rotation += dt * 0.25;
      p.mat.opacity = 0.92 * Math.min(1, t / 0.12) * (t > GROW + HANG ? 1 - (t - GROW - HANG) / THIN : 1);
    }
  }
}

const SWIRL_FRAG = /* glsl */ `
varying vec2 vUv;
uniform float uTime;
uniform float uFade;
uniform vec3 uColor;
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  float arms = smoothstep(0.15, 1.0, sin(a * 4.0 + r * 11.0 - uTime * 7.0));
  float edge = smoothstep(1.0, 0.75, r) * smoothstep(0.0, 0.2, r);
  float eye = 1.0 - smoothstep(0.0, 0.28, r);
  float alpha = (arms * edge * 0.55 + eye * 0.5) * uFade;
  gl_FragColor = vec4(uColor * (0.5 + arms * 0.9 + eye), alpha);
}
`;
const SWIRL_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

/** The whirlpool's spiral on the ground, `radius` metres: `update(dt, fade)` turns it; fade 0..1. */
export function swirlDisc(radius: number, color: number): { mesh: Mesh; update(dt: number, fade: number): void; dispose(): void } {
  const mat = new ShaderMaterial({
    vertexShader: SWIRL_VERT, fragmentShader: SWIRL_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uColor: { value: new Color(color) } },
  });
  const geo = new CircleGeometry(radius, 64);
  geo.rotateX(-Math.PI / 2);
  const mesh = new Mesh(geo, mat);
  mesh.renderOrder = 2;
  return {
    mesh,
    update(dt, fade) { mat.uniforms.uTime.value += dt; mat.uniforms.uFade.value = fade; },
    dispose() { geo.dispose(); mat.dispose(); },
  };
}

/**
 * The rune circles a spell is cast through (2026-11-15 screenshots; v12, 2026-11-16: the godofprompt reel). A glowing
 * ring drawn in code — an outer band of glyph ticks, a double ring, an inner star sigil — lies on the ground where the
 * spell is aimed, and for big spells 1–4 more stack above it, smaller and higher, turning opposite ways, with a soft
 * column of light through them (the reel's towers of circles). A small upright one opens at the caster's hand, facing
 * the target. They spin up over 0.25 s, hold while the spell flies, and fade as it lands. Pooled; one white texture
 * tinted per spell.
 */
import { AdditiveBlending, CanvasTexture, CylinderGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, Quaternion, ShaderMaterial, Vector3 } from 'three';

const POOL = 24;
const COLUMNS = 6;
const UP = new Vector3(0, 1, 0);

const COL_VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const COL_FRAG = /* glsl */ `
uniform vec3 uColor; uniform float uA; uniform float uTime;
varying vec2 vUv;
void main() {
  float y = vUv.y;
  float shimmer = 0.7 + 0.3 * sin(vUv.x * 50.0 - uTime * 4.0 + y * 12.0);
  float a = (1.0 - y) * smoothstep(0.0, 0.08, y) * 0.32 * shimmer * uA + (1.0 - smoothstep(0.0, 0.25, y)) * 0.15 * uA;
  gl_FragColor = vec4(uColor * a * 2.0, a);
}`;

export interface CastOptions {
  /** Radius of the ground circle, metres. */
  radius: number;
  /** Circles in the stack (1 = only the ground circle). */
  stack?: number;
  /** How high the top circle stands over the ground one. */
  height?: number;
  /** Seconds it holds before fading (the spell's lead). */
  hold: number;
}

function drawRune(): CanvasTexture {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.translate(S / 2, S / 2);
  g.strokeStyle = '#fff';
  g.fillStyle = '#fff';
  g.shadowColor = '#fff';
  g.shadowBlur = 6;
  const ring = (r: number, w: number) => { g.lineWidth = w; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke(); };
  ring(120, 4); ring(108, 2); ring(70, 3); ring(30, 2);
  // The glyph band: little runes between the outer rings.
  for (let i = 0; i < 24; i++) {
    g.save();
    g.rotate((i / 24) * Math.PI * 2);
    g.translate(0, -114);
    g.lineWidth = 2;
    g.beginPath();
    const k = i % 4;
    if (k === 0) { g.moveTo(-3, -4); g.lineTo(3, 4); g.moveTo(3, -4); g.lineTo(-3, 4); }
    else if (k === 1) { g.moveTo(0, -5); g.lineTo(0, 5); g.moveTo(-3, -1); g.lineTo(3, -1); }
    else if (k === 2) { g.arc(0, 0, 3, 0, Math.PI * 2); }
    else { g.moveTo(-3, 4); g.lineTo(0, -4); g.lineTo(3, 4); }
    g.stroke();
    g.restore();
  }
  // The sigil: a six-point star joining the middle ring.
  g.lineWidth = 3;
  for (const off of [0, Math.PI / 3]) {
    g.beginPath();
    for (let i = 0; i <= 3; i++) {
      const a = off + (i / 3) * Math.PI * 2 - Math.PI / 2;
      if (i === 0) g.moveTo(Math.cos(a) * 70, Math.sin(a) * 70); else g.lineTo(Math.cos(a) * 70, Math.sin(a) * 70);
    }
    g.stroke();
  }
  // Spokes from the inner ring out to the band.
  g.lineWidth = 1.5;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    g.beginPath(); g.moveTo(Math.cos(a) * 74, Math.sin(a) * 74); g.lineTo(Math.cos(a) * 104, Math.sin(a) * 104); g.stroke();
  }
  const t = new CanvasTexture(c);
  t.anisotropy = 4;
  return t;
}

interface Slot { mesh: Mesh; mat: MeshBasicMaterial; age: number; hold: number; size: number; live: boolean; spin: number; y0: number; rise: number }
interface Column { mesh: Mesh; mat: ShaderMaterial; age: number; hold: number; live: boolean }

export class RuneCircles {
  readonly group = new Group();
  private readonly slots: Slot[] = [];
  private readonly columns: Column[] = [];
  private time = 0;

  constructor() {
    const tex = typeof document !== 'undefined' ? drawRune() : null;
    const geo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL; i++) {
      const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
      const mesh = new Mesh(geo, mat);
      mesh.name = 'rune';
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.slots.push({ mesh, mat, age: 0, hold: 0, size: 1, live: false, spin: 1, y0: 0, rise: 0 });
    }
    const cyl = new CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, 0.5, 0);
    for (let i = 0; i < COLUMNS; i++) {
      const mat = new ShaderMaterial({
        vertexShader: COL_VERT, fragmentShader: COL_FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
        side: DoubleSide, forceSinglePass: true, uniforms: { uColor: { value: new Vector3(1, 1, 1) }, uA: { value: 0 }, uTime: { value: 0 } },
      });
      const mesh = new Mesh(cyl, mat);
      mesh.name = 'rune-column';
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.group.add(mesh);
      this.columns.push({ mesh, mat, age: 0, hold: 0, live: false });
    }
  }

  private slot(): Slot {
    return this.slots.find((x) => !x.live) ?? this.slots.reduce((a, b) => (a.age > b.age ? a : b));
  }

  private open(s: Slot, x: number, y: number, z: number, size: number, color: number, hold: number, spin: number, rise: number): void {
    s.live = true;
    s.age = 0;
    s.hold = hold;
    s.size = size;
    s.spin = spin;
    s.y0 = y;
    s.rise = rise;
    s.mat.color.set(color).multiplyScalar(1.3);
    s.mesh.quaternion.identity();
    s.mesh.position.set(x, y, z);
    s.mesh.scale.setScalar(size * 0.4);
    s.mesh.visible = true;
  }

  /** A circle `radius` metres across at `at` in `color`, held `hold` seconds before it fades. */
  show(at: Vector3, radius: number, color: number, hold: number): void {
    this.cast(at, color, { radius, hold });
  }

  /** The reel's cast: the ground circle at `at`, `stack - 1` more stacked up to `height` over it, a column through them. */
  cast(at: Vector3, color: number, o: CastOptions): void {
    const stack = Math.max(1, Math.min(4, Math.round(o.stack ?? 1)));
    const height = o.height ?? o.radius * 2.5;
    for (let k = 0; k < stack; k++) {
      const f = stack > 1 ? k / (stack - 1) : 0;
      this.open(this.slot(), at.x, at.y + 0.08, at.z, o.radius * 2.2 * (1 - 0.18 * k), color, o.hold, k % 2 ? -1 : 1, f * height);
    }
    if (stack > 1) {
      const c = this.columns.find((x) => !x.live) ?? this.columns.reduce((a, b) => (a.age > b.age ? a : b));
      c.live = true;
      c.age = 0;
      c.hold = o.hold;
      const col = new MeshBasicMaterial({ color }).color;
      (c.mat.uniforms.uColor.value as Vector3).set(col.r, col.g, col.b);
      c.mesh.position.set(at.x, at.y, at.z);
      c.mesh.scale.set(o.radius * 0.55, height + 1, o.radius * 0.55);
      c.mesh.visible = true;
    }
  }

  /** A small upright circle at the caster's hand (`from`), facing `to`. */
  tip(from: Vector3, to: Vector3, color: number, hold: number): void {
    const s = this.slot();
    this.open(s, from.x, from.y, from.z, 0.9, color, hold, 1, 0);
    const d = new Vector3().subVectors(to, from);
    if (d.lengthSq() < 1e-6) d.set(0, 0, 1);
    s.mesh.quaternion.copy(new Quaternion().setFromUnitVectors(UP, d.normalize()));
  }

  update(dt: number): void {
    this.time += dt;
    for (const s of this.slots) {
      if (!s.live) continue;
      s.age += dt;
      const up = Math.min(1, s.age / 0.25);
      const fade = s.age < s.hold ? 1 : Math.max(0, 1 - (s.age - s.hold) / 0.6);
      const ease = 1 - (1 - up) ** 3;
      // Spins fast as it opens, then turns slowly (stacked ones the other way round, every other one).
      s.mesh.rotateY(dt * s.spin * (0.6 + 6 * (1 - up)));
      s.mesh.scale.setScalar(s.size * (0.4 + 0.6 * ease));
      s.mesh.position.y = s.y0 + s.rise * ease;
      s.mat.opacity = 0.95 * up * fade;
      if (fade <= 0) { s.live = false; s.mesh.visible = false; }
    }
    for (const c of this.columns) {
      if (!c.live) continue;
      c.age += dt;
      const up = Math.min(1, c.age / 0.3);
      const fade = c.age < c.hold ? 1 : Math.max(0, 1 - (c.age - c.hold) / 0.5);
      c.mat.uniforms.uA.value = up * fade;
      c.mat.uniforms.uTime.value = this.time;
      if (fade <= 0) { c.live = false; c.mesh.visible = false; }
    }
  }
}

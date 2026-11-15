/**
 * The rune circle a spell lands in (from the user's screenshots of 2026-11-15): a glowing ring drawn in code — outer
 * band of glyph ticks, a double ring, an inner star sigil — laid on the ground where the spell is aimed. It spins up
 * over 0.25 s, holds while the spell flies, and fades as it lands. Pooled; one white texture tinted per spell.
 */
import { AdditiveBlending, CanvasTexture, DoubleSide, Group, Mesh, MeshBasicMaterial, PlaneGeometry, type Vector3 } from 'three';

const POOL = 4;

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

interface Slot { mesh: Mesh; mat: MeshBasicMaterial; age: number; hold: number; size: number; live: boolean }

export class RuneCircles {
  readonly group = new Group();
  private readonly slots: Slot[] = [];

  constructor() {
    const tex = typeof document !== 'undefined' ? drawRune() : null;
    const geo = new PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    for (let i = 0; i < POOL; i++) {
      const mat = new MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 });
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 2;
      this.group.add(mesh);
      this.slots.push({ mesh, mat, age: 0, hold: 0, size: 1, live: false });
    }
  }

  /** A circle `radius` metres across at `at` in `color`, held `hold` seconds before it fades. */
  show(at: Vector3, radius: number, color: number, hold: number): void {
    const s = this.slots.find((x) => !x.live) ?? this.slots.reduce((a, b) => (a.age > b.age ? a : b));
    s.live = true;
    s.age = 0;
    s.hold = hold;
    s.size = radius * 2.2;
    s.mat.color.set(color).multiplyScalar(1.3);
    s.mesh.position.set(at.x, at.y + 0.08, at.z);
    s.mesh.visible = true;
  }

  update(dt: number): void {
    for (const s of this.slots) {
      if (!s.live) continue;
      s.age += dt;
      const up = Math.min(1, s.age / 0.25);
      const fade = s.age < s.hold ? 1 : Math.max(0, 1 - (s.age - s.hold) / 0.6);
      // Spins fast as it opens, then turns slowly.
      s.mesh.rotation.y += dt * (0.6 + 6 * (1 - up));
      s.mesh.scale.setScalar(s.size * (0.4 + 0.6 * (1 - (1 - up) ** 3)));
      s.mat.opacity = 0.95 * up * fade;
      if (fade <= 0) { s.live = false; s.mesh.visible = false; }
    }
  }
}

/**
 * The comic impact star (the playtest of 2026-11-14: combat "cool… funny… not realistic"): a jagged white burst with a
 * dark outline, in the blow's colour, popping where a blow lands and gone in STAR_LIFE seconds. It draws over the bodies
 * like a panel's POW, turns a little as it grows, and holds still while the fight is frozen (hit-stop), so every blow
 * gets its freeze frame. A pool, the oldest reused.
 */
import { CanvasTexture, SRGBColorSpace, Sprite, SpriteMaterial, type Scene, type Texture, type Vector3, type ColorRepresentation } from 'three';

/** How long a star lasts (s). */
export const STAR_LIFE = 0.2;

/** The burst: twelve uneven points, white shaded to grey, outlined dark (the sprite's colour tints it). */
export function starTexture(): Texture {
  const S = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = S;
  const ctx = canvas.getContext('2d')!;
  const N = 12;
  ctx.beginPath();
  for (let i = 0; i <= N * 2; i++) {
    const a = (i / (N * 2)) * Math.PI * 2;
    const r = i % 2 ? 22 + (i % 4 === 1 ? 4 : 0) : 54 - (i % 6 === 0 ? 10 : 0);
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 56);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(1, '#b8b8b8');
  ctx.fillStyle = g;
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#140a24';
  ctx.fill();
  ctx.stroke();
  const t = new CanvasTexture(canvas);
  t.colorSpace = SRGBColorSpace;
  return t;
}

interface Live { age: number; size: number; spin: number }

export class ImpactStars {
  readonly sprites: Sprite[] = [];
  private readonly live: Live[] = [];
  private next = 0;

  constructor(scene: Scene, pool = 12, texture: () => Texture = starTexture) {
    const map = texture();
    for (let i = 0; i < pool; i++) {
      const s = new Sprite(new SpriteMaterial({ map, transparent: true, depthTest: false, depthWrite: false, fog: false }));
      s.visible = false;
      s.renderOrder = 20;
      s.frustumCulled = false;
      scene.add(s);
      this.sprites.push(s);
      this.live.push({ age: 0, size: 1, spin: 0 });
    }
  }

  /** A star at `at`, `size` metres across at its biggest, in `color`. */
  pop(at: Vector3, color: ColorRepresentation, size: number): void {
    const i = this.next;
    this.next = (i + 1) % this.sprites.length;
    const s = this.sprites[i];
    const l = this.live[i];
    l.age = 0;
    l.size = size;
    l.spin = (Math.random() < 0.5 ? -1 : 1) * (1.5 + Math.random() * 2);
    s.position.copy(at);
    s.material.color.set(color);
    s.material.rotation = Math.random() * Math.PI;
    s.material.opacity = 1;
    s.visible = true;
    this.pose(s, l);
  }

  update(dt: number): void {
    for (let i = 0; i < this.sprites.length; i++) {
      const s = this.sprites[i];
      if (!s.visible || dt <= 0) continue;
      const l = this.live[i];
      l.age += dt;
      if (l.age >= STAR_LIFE) { s.visible = false; continue; }
      s.material.rotation += l.spin * dt;
      this.pose(s, l);
    }
  }

  /** Out fast to full size, then thinning away over the second half. */
  private pose(s: Sprite, l: Live): void {
    const u = Math.min(1, l.age / STAR_LIFE);
    s.scale.setScalar(l.size * (0.35 + 0.65 * (1 - (1 - Math.min(1, u * 2.2)) ** 3)));
    s.material.opacity = u < 0.5 ? 1 : 1 - (u - 0.5) * 2;
  }

  dispose(): void {
    for (const s of this.sprites) { s.removeFromParent(); s.material.dispose(); }
    this.sprites[0]?.material.map?.dispose();
  }
}

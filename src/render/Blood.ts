/**
 * Blood (the user's call of 2026-11-17: "realistic liquid blood bursting out of it", red): spurts of dark red drops
 * that fly, stretch along their fall and leave a stain where they land (fading over STAIN_LIFE seconds); `pulse` is
 * an artery's beat from a stump, several in a row. Ghosts spurt their own glow instead (additive drops, no stain). Pooled.
 */
import {
  AdditiveBlending, CircleGeometry, Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from 'three';

export const STAIN_LIFE = 20;
/** The red of blood drops (other colours are dust: bone, stone; only blood stains). */
export const DROP_RED = 0x6a0a10;
const DROPS = 260;
const STAINS = 48;
const GRAVITY = 18;

interface Drop { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; size: number; glow: boolean; stain: boolean; color: number }

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _c = new Color();

export class Blood {
  readonly group = new Group();
  private readonly red: InstancedMesh;
  private readonly glow: InstancedMesh;
  private readonly drops: Drop[] = [];
  private readonly stains: Array<{ mesh: Mesh; mat: MeshBasicMaterial; age: number; size: number }> = [];
  private nextStain = 0;

  constructor(private readonly groundAt: (x: number, z: number, y: number) => number) {
    const geo = new IcosahedronGeometry(1, 1);
    this.red = new InstancedMesh(geo, new MeshStandardMaterial({ color: 0xffffff, emissive: 0x1a0204, roughness: 0.25, metalness: 0 }), DROPS);
    this.glow = new InstancedMesh(geo, new MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: AdditiveBlending, depthWrite: false }), DROPS);
    for (const m of [this.red, this.glow]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.glow.setColorAt(0, _c.set(0xffffff));
    this.red.setColorAt(0, _c.set(DROP_RED));
    const disc = new CircleGeometry(1, 14).rotateX(-Math.PI / 2);
    for (let i = 0; i < STAINS; i++) {
      const mat = new MeshBasicMaterial({ color: 0x3a0306, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
      const mesh = new Mesh(disc, mat);
      mesh.visible = false;
      mesh.renderOrder = 1;
      this.group.add(mesh);
      this.stains.push({ mesh, mat, age: STAIN_LIFE, size: 1 });
    }
  }

  /** `count` drops out of `at` along `dir` (unit-ish) at about `speed` m/s; `glow` in `color` instead of blood. */
  spurt(at: Vector3, dir: Vector3, count: number, speed = 4, glow = false, color = DROP_RED): void {
    for (let i = 0; i < count; i++) {
      if (this.drops.length >= DROPS * 2) this.drops.shift();
      const s = speed * (0.4 + Math.random() * 0.8);
      const d: Drop = {
        x: at.x, y: at.y, z: at.z,
        vx: dir.x * s + (Math.random() - 0.5) * 2.2, vy: dir.y * s + Math.random() * 2.5, vz: dir.z * s + (Math.random() - 0.5) * 2.2,
        life: 1.6, size: 0.012 + Math.random() * 0.022, glow, stain: !glow && color === DROP_RED && i % 4 === 0, color,
      };
      this.drops.push(d);
    }
  }

  /** One beat of an artery: a jet of drops out of `at` along `dir`, the strongest first, then weaker. */
  pulse(at: Vector3, dir: Vector3, strength: number): void {
    this.spurt(at, dir, Math.round(10 + strength * 14), 3 + strength * 4, false, DROP_RED);
  }

  /** Drops alive now (tests). */
  get live(): number { return this.drops.length; }

  /** A stain `size` metres across on the ground at (x, y, z). */
  stain(x: number, y: number, z: number, size: number): void {
    const s = this.stains[this.nextStain];
    this.nextStain = (this.nextStain + 1) % STAINS;
    s.age = 0;
    s.size = size;
    s.mesh.position.set(x, y + 0.03, z);
    s.mesh.rotation.y = Math.random() * Math.PI;
    s.mesh.scale.set(size * (0.7 + Math.random() * 0.6), 1, size);
    s.mesh.visible = true;
  }

  update(dt: number): void {
    let r = 0, g = 0;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i];
      d.life -= dt;
      d.vy -= GRAVITY * dt;
      d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      const gy = this.groundAt(d.x, d.z, d.y + 0.5);
      if (d.y <= gy || d.life <= 0) {
        if (d.y <= gy && d.stain) this.stain(d.x, gy, d.z, 0.12 + Math.random() * 0.22);
        this.drops.splice(i, 1);
        continue;
      }
      const mesh = d.glow ? this.glow : this.red;
      const n = d.glow ? g++ : r++;
      if (n >= DROPS) continue;
      // Stretched along the fall, like a drop in flight.
      const sp = Math.hypot(d.vx, d.vy, d.vz);
      _s.set(d.size, d.size * (1 + Math.min(2.5, sp * 0.18)), d.size);
      _q.setFromUnitVectors(_p.set(0, 1, 0), _p.set(d.vx, d.vy, d.vz).normalize());
      _m.compose(_p.set(d.x, d.y, d.z), _q, _s);
      mesh.setMatrixAt(n, _m);
      mesh.setColorAt(n, _c.set(d.color));
    }
    this.red.count = Math.min(r, DROPS);
    this.glow.count = Math.min(g, DROPS);
    this.red.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
    for (const m of [this.red, this.glow]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    for (const s of this.stains) {
      if (!s.mesh.visible) continue;
      s.age += dt;
      // Spreads a little as it soaks in, then fades.
      const k = Math.min(1, s.age / 0.4);
      s.mat.opacity = 0.85 * k * Math.max(0, 1 - Math.max(0, s.age - STAIN_LIFE * 0.6) / (STAIN_LIFE * 0.4));
      if (s.age >= STAIN_LIFE) s.mesh.visible = false;
    }
  }
}

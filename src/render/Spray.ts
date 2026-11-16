/**
 * The spray where a mob loses a part (the user's call of 2026-11-16: no blood): glowing motes of its element (additive),
 * or grit and dust for bone and stone (lit, per-instance colour). Short-lived, no stains. Pooled.
 */
import {
  AdditiveBlending, Color, DynamicDrawUsage, Group, IcosahedronGeometry, InstancedMesh, Matrix4, MeshBasicMaterial,
  MeshStandardMaterial, Quaternion, Vector3,
} from 'three';

const DROPS = 260;
const GRAVITY = 18;

interface Drop { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; size: number; glow: boolean; color: number }

const _m = new Matrix4();
const _q = new Quaternion();
const _s = new Vector3();
const _p = new Vector3();
const _c = new Color();

export class Spray {
  readonly group = new Group();
  private readonly grit: InstancedMesh;
  private readonly glow: InstancedMesh;
  private readonly drops: Drop[] = [];

  constructor(private readonly groundAt: (x: number, z: number, y: number) => number) {
    const geo = new IcosahedronGeometry(1, 1);
    this.grit = new InstancedMesh(geo, new MeshStandardMaterial({ color: 0xffffff, roughness: 0.95, metalness: 0 }), DROPS);
    this.glow = new InstancedMesh(geo, new MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: AdditiveBlending, depthWrite: false }), DROPS);
    for (const m of [this.grit, this.glow]) {
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      m.count = 0;
      m.frustumCulled = false;
      this.group.add(m);
    }
    this.glow.setColorAt(0, _c.set(0xffffff));
    this.grit.setColorAt(0, _c.set(0xffffff));
  }

  /** `count` drops out of `at` along `dir` (unit-ish) at about `speed` m/s; `glow` in `color` instead of blood. */
  spurt(at: Vector3, dir: Vector3, count: number, speed = 4, glow = false, color = 0xd9d2bf): void {
    for (let i = 0; i < count; i++) {
      if (this.drops.length >= DROPS * 2) this.drops.shift();
      const s = speed * (0.4 + Math.random() * 0.8);
      const d: Drop = {
        x: at.x, y: at.y, z: at.z,
        vx: dir.x * s + (Math.random() - 0.5) * 2.2, vy: dir.y * s + Math.random() * 2.5, vz: dir.z * s + (Math.random() - 0.5) * 2.2,
        life: 1.6, size: 0.012 + Math.random() * 0.022, glow, color,
      };
      this.drops.push(d);
    }
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
        this.drops.splice(i, 1);
        continue;
      }
      const mesh = d.glow ? this.glow : this.grit;
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
    this.grit.count = Math.min(r, DROPS);
    this.glow.count = Math.min(g, DROPS);
    this.grit.instanceMatrix.needsUpdate = true;
    this.glow.instanceMatrix.needsUpdate = true;
    for (const m of [this.grit, this.glow]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }
}

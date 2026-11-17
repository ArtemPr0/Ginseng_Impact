/**
 * Spiky rocks bursting out of the ground (the Flowbound reel's earth bending, v1 t11/t106/t112; playtest 2026-11-17:
 * "Sir Aldric kneels and raises spiky rocks"): each spike shoots up out of the earth, leaning a little, stands, then
 * sinks back into it. One instanced draw for all of them, from one rock model (a Meshy rock spire), its shape set to
 * one metre high from its base so each spike is sized by its own height and width. Without the model the spikes
 * still exist (the spells hit on time) but draw nothing.
 */
import { BufferGeometry, InstancedMesh, Matrix4, Mesh, MeshStandardMaterial, Object3D, Quaternion, Vector3, Euler, Box3, type Material } from 'three';

const MAX = 160;
/** Seconds a spike takes to burst up, and to sink at the end. */
const UP = 0.16;
const DOWN = 0.4;

export interface SpikeOpts {
  height: number; width: number; delay: number; life: number; lean?: { x: number; z: number }; yaw?: number;
  /** A name for a group of them (drop sinks them together). */
  tag?: string;
}

interface Spike { at: Vector3; o: Required<SpikeOpts>; t: number }

const _up = new Vector3(0, 1, 0), _y = new Quaternion();
const _m = new Matrix4(), _q = new Quaternion(), _s = new Vector3(), _p = new Vector3(), _e = new Euler();

export class SpikeField {
  readonly mesh: InstancedMesh | null = null;
  private readonly spikes: Spike[] = [];

  /** `tint`: restyles its (cloned) material, e.g. rock spires turned to ice. */
  constructor(src: Object3D | null, tint?: (m: MeshStandardMaterial) => void) {
    if (!src) return;
    let geo: BufferGeometry | null = null, mat: Material | null = null;
    src.updateMatrixWorld(true);
    src.traverse((o) => {
      const m = o as Mesh;
      if (geo || !m.isMesh) return;
      geo = m.geometry.clone().applyMatrix4(m.matrixWorld);
      mat = Array.isArray(m.material) ? m.material[0] : m.material;
    });
    if (!geo) return;
    const g = geo as BufferGeometry;
    // One metre high from its base, centred on its foot, one metre across its widest.
    const b = new Box3().setFromBufferAttribute(g.getAttribute('position') as never);
    const size = b.getSize(new Vector3());
    g.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    g.scale(1 / Math.max(1e-3, Math.max(size.x, size.z)), 1 / Math.max(1e-3, size.y), 1 / Math.max(1e-3, Math.max(size.x, size.z)));
    const m = ((mat as Material | null) as MeshStandardMaterial | null)?.clone?.() ?? new MeshStandardMaterial();
    tint?.(m);
    this.mesh = new InstancedMesh(g, m, MAX);
    this.mesh.name = 'spikes';
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = true;
    this.mesh.count = 0;
  }

  /** Spikes standing or waiting. */
  get count(): number { return this.spikes.length; }

  /** A spike at `at` (on the ground there). */
  raise(at: Vector3, o: SpikeOpts): void {
    if (this.spikes.length >= MAX) this.spikes.shift();
    this.spikes.push({ at: at.clone(), o: { lean: { x: 0, z: 0 }, yaw: Math.random() * Math.PI * 2, tag: '', ...o }, t: 0 });
  }

  /** The spikes tagged `tag` start sinking now (those still to come up never do). */
  drop(tag: string): void {
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i];
      if (s.o.tag !== tag) continue;
      const t = s.t - s.o.delay;
      if (t < UP) this.spikes.splice(i, 1);
      else s.o.life = Math.min(s.o.life, t);
    }
  }

  update(dt: number): void {
    for (let i = this.spikes.length - 1; i >= 0; i--) {
      const s = this.spikes[i];
      s.t += dt;
      if (s.t >= s.o.delay + s.o.life + DOWN) this.spikes.splice(i, 1);
    }
    const mesh = this.mesh;
    if (!mesh) return;
    for (let i = 0; i < this.spikes.length; i++) {
      const s = this.spikes[i];
      const t = s.t - s.o.delay;
      // How far out of the ground: bursting up (fast, overshooting a little), standing, sinking.
      let k = 0;
      if (t > 0) k = t < UP ? Math.min(1.06, Math.sin((t / UP) * Math.PI * 0.58) * 1.06) : t < s.o.life ? 1 : Math.max(0, 1 - (t - s.o.life) / DOWN);
      // Spun about its own axis, then leaned in the world (lean.x tips its top toward +z, lean.z toward -x).
      _q.setFromEuler(_e.set(s.o.lean.x, 0, s.o.lean.z, 'XYZ')).multiply(_y.setFromAxisAngle(_up, s.o.yaw));
      _s.set(s.o.width, s.o.height, s.o.width);
      _p.set(s.at.x, s.at.y - s.o.height * (1 - k) - (k <= 0 ? 0.05 : 0), s.at.z);
      mesh.setMatrixAt(i, _m.compose(_p, _q, _s));
    }
    mesh.count = this.spikes.length;
    mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    if (!this.mesh) return;
    this.mesh.geometry.dispose();
    (this.mesh.material as Material).dispose();
  }
}

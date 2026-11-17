/**
 * Chain Hook's chain (playtest 2026-11-17: "it doesn't seem to do anything" — the old chain was a line of sparks): a
 * real chain of steel links that shoots out from the hand to where it caught, holds a moment and reels back in.
 */
import { InstancedMesh, MeshStandardMaterial, Object3D, TorusGeometry, Vector3 } from 'three';

const LINK = 0.16;
const MAX_LINKS = 160;
const OUT = 0.14;
const HOLD = 0.12;
const BACK = 0.22;

const _o = new Object3D();
const _d = new Vector3();
const _p = new Vector3();

export class ChainFx {
  readonly mesh: InstancedMesh;
  private readonly from = new Vector3();
  private readonly to = new Vector3();
  private t = 0;
  private live = false;

  constructor() {
    const geo = new TorusGeometry(LINK * 0.42, LINK * 0.12, 5, 10);
    const mat = new MeshStandardMaterial({ color: 0xb8bcc8, metalness: 0.85, roughness: 0.32, emissive: 0x1a1c24 });
    this.mesh = new InstancedMesh(geo, mat, MAX_LINKS);
    this.mesh.name = 'chain';
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    this.mesh.count = 0;
  }

  /** Fires the chain from `from` to `to`. */
  fire(from: Vector3, to: Vector3): void {
    this.from.copy(from);
    this.to.copy(to);
    this.t = 0;
    this.live = true;
    this.mesh.visible = true;
    this.update(0, from);
  }

  get active(): boolean { return this.live; }

  /** `hand`: where the chain starts now (it follows the hero). */
  update(dt: number, hand?: Vector3): void {
    if (!this.live) return;
    this.t += dt;
    if (hand) this.from.copy(hand);
    const t = this.t;
    // How much of the way out the head is: out, hold, back in.
    const reach = t < OUT ? t / OUT : t < OUT + HOLD ? 1 : Math.max(0, 1 - (t - OUT - HOLD) / BACK);
    if (t >= OUT + HOLD + BACK) { this.live = false; this.mesh.visible = false; this.mesh.count = 0; return; }
    _d.subVectors(this.to, this.from);
    const len = _d.length() * reach;
    const n = Math.min(MAX_LINKS, Math.max(1, Math.floor(len / (LINK * 0.8))));
    _d.normalize();
    for (let i = 0; i < n; i++) {
      const k = (i + 0.5) * (len / n);
      // A little sag in the middle while it is out.
      const sag = Math.sin((k / Math.max(len, 0.01)) * Math.PI) * 0.18 * reach;
      _p.copy(this.from).addScaledVector(_d, k);
      _p.y -= sag;
      _o.position.copy(_p);
      _o.lookAt(_p.x + _d.x, _p.y + _d.y, _p.z + _d.z);
      // Every other link turned a quarter, like a real chain.
      _o.rotateZ(i % 2 ? Math.PI / 2 : 0);
      _o.updateMatrix();
      this.mesh.setMatrixAt(i, _o.matrix);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshStandardMaterial).dispose();
  }
}

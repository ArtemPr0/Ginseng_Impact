/**
 * Bent water (the Flowbound reel's water moves, v2 t17/t42/t47): translucent cobalt-and-cyan ribbons that ripple —
 * Wren's whip lashing out, the wave she surfs, the curved wall of her shield. One dynamic strip mesh for every ribbon
 * alive; each runs through its points, flat (a whip, a wave) or standing up from them (a shield), rippling along its
 * length and thinning out at its ends, fading over its life.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Mesh, MeshBasicMaterial, Vector3 } from 'three';

const MAX = 6000;
const SEG = 28;

export interface RibbonOpts {
  width: number; life: number;
  /** Stands up from its points (a wall of water), else lies flat across them. */
  upright?: boolean;
  /** Travels out from its first point to its last over this share of its life (a whip lashing out), else all at once. */
  grow?: number;
  color?: number;
}

interface Ribbon { pts: Vector3[]; o: Required<RibbonOpts>; t: number }

const _a = new Vector3(), _d = new Vector3(), _n = new Vector3(), _up = new Vector3(0, 1, 0);

export class WaterFx {
  readonly mesh: Mesh;
  private readonly pos = new Float32Array(MAX * 3);
  private readonly col = new Float32Array(MAX * 3);
  private readonly ribbons: Ribbon[] = [];
  private n = 0;
  private time = 0;

  constructor() {
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(this.pos, 3));
    g.setAttribute('color', new BufferAttribute(this.col, 3));
    const m = new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
    m.forceSinglePass = true;
    this.mesh = new Mesh(g, m);
    this.mesh.name = 'water-fx';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
  }

  get count(): number { return this.ribbons.length; }
  /** Vertices drawn (tests). */
  get verts(): number { return this.n; }

  ribbon(pts: Vector3[], o: RibbonOpts): void {
    if (pts.length < 2) return;
    this.ribbons.push({ pts: pts.map((p) => p.clone()), o: { upright: false, grow: 0, color: 0x3fc8ff, ...o }, t: 0 });
  }

  /** Where along its points a ribbon is at k (0..1). */
  private at(r: Ribbon, k: number, out: Vector3): Vector3 {
    const f = k * (r.pts.length - 1), i = Math.min(r.pts.length - 2, Math.floor(f));
    return out.lerpVectors(r.pts[i], r.pts[i + 1], f - i);
  }

  update(dt: number): void {
    this.time += dt;
    for (let i = this.ribbons.length - 1; i >= 0; i--) if ((this.ribbons[i].t += dt) >= this.ribbons[i].o.life) this.ribbons.splice(i, 1);
    this.n = 0;
    const c = new Color(), white = new Color(0xffffff);
    for (const r of this.ribbons) {
      const life = r.t / r.o.life;
      const reach = r.o.grow > 0 ? Math.min(1, life / r.o.grow) : 1;
      const fade = Math.min(1, (1 - life) * 4) * Math.min(1, r.t * 8);
      let prevL: Vector3 | null = null, prevR: Vector3 | null = null, prevC = 0;
      for (let s = 0; s <= SEG; s++) {
        const k = (s / SEG) * reach;
        this.at(r, k, _a);
        this.at(r, Math.min(1, k + 0.01), _d).sub(_a);
        if (_d.lengthSq() < 1e-8) _d.set(0, 0, 1);
        _d.normalize();
        const ripple = Math.sin(k * 18 - this.time * 9) * 0.5 + 0.5;
        // Thin at its ends, thicker where a ripple passes.
        const w = r.o.width * Math.sin(Math.PI * Math.min(1, Math.max(0, s / SEG))) ** 0.6 * (0.8 + ripple * 0.35) + 0.02;
        let L: Vector3, R: Vector3;
        if (r.o.upright) {
          const wob = Math.sin(this.time * 6 + k * 10) * 0.08;
          L = _a.clone().add(_n.set(-_d.z * wob, 0, _d.x * wob));
          R = L.clone().addScaledVector(_up, r.o.width * (0.85 + ripple * 0.2));
        } else {
          _n.crossVectors(_d, _up);
          if (_n.lengthSq() < 1e-6) _n.set(1, 0, 0);
          _n.normalize().multiplyScalar(w / 2);
          const lift = Math.sin(k * 14 - this.time * 7) * 0.08;
          L = _a.clone().sub(_n); L.y += lift;
          R = _a.clone().add(_n); R.y += lift;
        }
        // Cobalt through cyan to white foam on the ripples' crests.
        c.set(r.o.color).lerp(white, ripple * ripple * 0.45).multiplyScalar(fade);
        const ci = c.getHex();
        if (prevL && prevR && this.n + 6 <= MAX) {
          this.quad(prevL, prevR, R, L, prevC, ci);
        }
        prevL = L; prevR = R; prevC = ci;
      }
    }
    const g = this.mesh.geometry;
    g.setDrawRange(0, this.n);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    this.mesh.visible = this.n > 0;
  }

  private quad(a: Vector3, b: Vector3, c: Vector3, d: Vector3, ca: number, cb: number): void {
    const v = [a, b, c, a, c, d], cs = [ca, ca, cb, ca, cb, cb];
    const col = new Color();
    for (let i = 0; i < 6; i++) {
      this.pos.set([v[i].x, v[i].y, v[i].z], this.n * 3);
      col.setHex(cs[i]);
      this.col.set([col.r, col.g, col.b], this.n * 3);
      this.n++;
    }
  }

  dispose(): void { this.mesh.geometry.dispose(); (this.mesh.material as MeshBasicMaterial).dispose(); }
}

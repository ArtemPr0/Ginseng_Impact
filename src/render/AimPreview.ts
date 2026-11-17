/**
 * What a held spell will do (hold right click to aim, playtest 2026-11-17): its flight drawn as a dotted ribbon over the
 * exact arc it flies (Aim.flightPoint) to a pulsing landing ring of its real radius; a tornado's whole weaving path
 * (Aim.tornadoPath); a lane for a charge, a cone for the gale, a wall's footprint; the black hole's marker where it will
 * open (in the sky, in the ground, inside a building) with a line down to the ground. Dimmed past the spell's range.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { flightPoint, tornadoPath, type AimShape } from '../combat/Aim';

const MAX = 4096;
const _a = new Vector3();
const _b = new Vector3();
const _s = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

export interface AimView {
  shape: AimShape;
  /** Where it starts (the hand; a lane's or cone's or path's start on the ground). */
  from: Vector3;
  /** Where it lands (the crosshair's point, clamped to range). */
  to: Vector3;
  /** Its heading on the ground. */
  dir: { x: number; z: number };
  color: number;
  /** Past the spell's range (the ring sits at the edge, dimmed). */
  far: boolean;
  /** The black hole: how high over `to` it opens. */
  lift?: number;
  /** A wall: the yaw it stands across. */
  yaw?: number;
}

export class AimPreview {
  readonly group = new Group();
  private readonly geo = new BufferGeometry();
  private readonly mat = new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.85 });
  private readonly pos = new Float32Array(MAX * 3);
  private n = 0;
  private t = 0;

  constructor(private readonly heightAt: (x: number, z: number, y: number) => number) {
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.mat.forceSinglePass = true;
    const mesh = new Mesh(this.geo, this.mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    mesh.name = 'aim-preview';
    this.group.add(mesh);
    this.group.visible = false;
  }

  hide(): void { this.group.visible = false; }

  /** Vertices drawn last frame (tests). */
  get count(): number { return this.n; }

  show(v: AimView, dt: number): void {
    const shape = v.shape;
    if (shape.kind === 'none') { this.hide(); return; }
    this.t += dt;
    this.n = 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    const { from, to, dir } = v;
    switch (shape.kind) {
      case 'ring':
        this.landing(shape.self ? from : to, shape.radius);
        break;
      case 'arc': {
        // The flight: dashes along the very arc it flies, running toward the target.
        const steps = 40;
        for (let i = 0; i < steps; i++) {
          if ((i + Math.floor(this.t * 12)) % 2) continue;
          flightPoint(from, to, i / steps, shape.arc, _a);
          flightPoint(from, to, (i + 1) / steps, shape.arc, _b);
          this.seg3(_a, _b, 0.06);
        }
        this.landing(to, shape.radius);
        break;
      }
      case 'path': {
        const pts = tornadoPath(from, dir, shape.run, shape.life, 0.2);
        const l: Array<[number, number]> = pts.map((p) => [p.x, p.z]);
        this.line(l, from.y, 0.18);
        // Its funnel's reach at the start and the end, and chevrons running along it.
        this.ring(pts[0].x, from.y, pts[0].z, shape.radius, 0.08);
        const e = pts[pts.length - 1];
        this.ring(e.x, from.y, e.z, shape.radius, 0.08);
        for (let k = 0; k < 5; k++) {
          const i = Math.floor(((this.t * 0.25 + k / 5) % 1) * (pts.length - 2));
          const p = pts[i], q = pts[i + 1];
          const dx = q.x - p.x, dz = q.z - p.z, dl = Math.hypot(dx, dz) || 1;
          const nx = -dz / dl, nz = dx / dl;
          this.line([[p.x - (dx / dl) * 0.8 + nx, p.z - (dz / dl) * 0.8 + nz], [p.x, p.z], [p.x - (dx / dl) * 0.8 - nx, p.z - (dz / dl) * 0.8 - nz]], from.y, 0.08);
        }
        break;
      }
      case 'lane': {
        const len = Math.min(shape.length, Math.hypot(to.x - from.x, to.z - from.z) || shape.length);
        const w = shape.width / 2, px = -dir.z, pz = dir.x;
        const at = (a: number, s: number): [number, number] => [from.x + dir.x * a + px * s, from.z + dir.z * a + pz * s];
        this.line([at(0, -w), at(len, -w)], from.y, 0.12);
        this.line([at(0, w), at(len, w)], from.y, 0.12);
        this.line([at(len, -w), at(len, w)], from.y, 0.12);
        for (let k = 0; k < 4; k++) {
          const a = ((this.t * 6 + k * (len / 4)) % Math.max(len, 0.1));
          this.line([at(a - 0.8, -w * 0.6), at(a, 0), at(a - 0.8, w * 0.6)], from.y, 0.08);
        }
        break;
      }
      case 'cone': {
        const r = shape.radius, a0 = Math.atan2(dir.z, dir.x);
        const edge = (a: number): [number, number] => [from.x + Math.cos(a) * r, from.z + Math.sin(a) * r];
        this.line([[from.x, from.z], edge(a0 - shape.angle)], from.y, 0.12);
        this.line([[from.x, from.z], edge(a0 + shape.angle)], from.y, 0.12);
        const arc: Array<[number, number]> = [];
        for (let i = 0; i <= 16; i++) arc.push(edge(a0 - shape.angle + (i / 16) * shape.angle * 2));
        this.line(arc, from.y, 0.12);
        break;
      }
      case 'wall': {
        // (A wall raised before him faces the way he aims; one at the crosshair stands across his facing.)
        const yaw = shape.ahead !== undefined ? Math.atan2(dir.z, dir.x) : v.yaw ?? Math.atan2(dir.z, dir.x);
        const to = shape.ahead !== undefined ? _b.set(from.x + dir.x * shape.ahead, from.y, from.z + dir.z * shape.ahead).clone() : v.to;
        const sx = -Math.sin(yaw), sz = Math.cos(yaw), w = shape.width / 2;
        const fx = Math.cos(yaw) * 0.5, fz = Math.sin(yaw) * 0.5;
        this.line([[to.x - sx * w - fx, to.z - sz * w - fz], [to.x + sx * w - fx, to.z + sz * w - fz], [to.x + sx * w + fx, to.z + sz * w + fz], [to.x - sx * w + fx, to.z - sz * w + fz], [to.x - sx * w - fx, to.z - sz * w - fz]], to.y, 0.1);
        break;
      }
      case 'marker': {
        const lift = v.lift ?? 10;
        const cy = to.y + lift;
        // A ring where it opens (level, at its height), its reach on the ground, a dashed line between.
        this.ring3(to.x, cy, to.z, 1.6 + pulse * 0.4, 0.1);
        this.ring3(to.x, cy, to.z, 0.5, 0.08);
        this.ring(to.x, to.y, to.z, shape.radius, 0.1);
        const top = Math.max(cy, to.y), bot = Math.min(cy, to.y);
        for (let y = bot; y < top; y += 0.8) this.seg3(_a.set(to.x, y, to.z), _b.set(to.x, Math.min(top, y + 0.4), to.z), 0.05);
        break;
      }
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.mat.color.copy(_c.set(v.color)).multiplyScalar(v.far ? 0.35 : 0.75 + pulse * 0.35);
    this.group.visible = true;
  }

  /** The landing: its real radius, a ring sweeping out to it, a dot in the middle. */
  private landing(at: Vector3, r: number): void {
    this.ring(at.x, at.y, at.z, r, 0.14);
    this.ring(at.x, at.y, at.z, r * (0.25 + 0.75 * ((this.t * 0.8) % 1)), 0.07);
    this.ring(at.x, at.y, at.z, 0.35, 0.1);
  }

  private ring(x: number, y: number, z: number, r: number, w: number): void {
    const pts: Array<[number, number]> = [];
    const seg = Math.max(24, Math.min(72, Math.round(r * 10)));
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
    this.line(pts, y, w);
  }

  /** A level ring at height y (not on the ground). */
  private ring3(x: number, y: number, z: number, r: number, w: number): void {
    const seg = 32;
    for (let i = 0; i < seg; i++) {
      const a = (i / seg) * Math.PI * 2, b = ((i + 1) / seg) * Math.PI * 2;
      this.seg3(_a.set(x + Math.cos(a) * r, y, z + Math.sin(a) * r), _b.set(x + Math.cos(b) * r, y, z + Math.sin(b) * r), w);
    }
  }

  /** A strip `w` wide from a to b in the air (flat across, or facing sideways for an upright one). */
  private seg3(a: Vector3, b: Vector3, w: number): void {
    if (this.n + 6 > MAX) return;
    _s.subVectors(b, a).cross(UP);
    if (_s.lengthSq() < 1e-8) _s.set(1, 0, 0);
    _s.setLength(w);
    const q = [a.x - _s.x, a.y - _s.y, a.z - _s.z, a.x + _s.x, a.y + _s.y, a.z + _s.z, b.x + _s.x, b.y + _s.y, b.z + _s.z,
      a.x - _s.x, a.y - _s.y, a.z - _s.z, b.x + _s.x, b.y + _s.y, b.z + _s.z, b.x - _s.x, b.y - _s.y, b.z - _s.z];
    this.pos.set(q, this.n * 3);
    this.n += 6;
  }

  /** A flat strip `w` wide along `pts`, each point set on the ground. */
  private line(pts: Array<[number, number]>, y: number, w: number): void {
    for (let i = 0; i < pts.length - 1; i++) {
      if (this.n + 6 > MAX) return;
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const dx = bx - ax, dz = bz - az, l = Math.hypot(dx, dz) || 1;
      const nx = (-dz / l) * w, nz = (dx / l) * w;
      const ay = this.heightAt(ax, az, y + 2) + 0.07, by = this.heightAt(bx, bz, y + 2) + 0.07;
      const q = [ax - nx, ay, az - nz, ax + nx, ay, az + nz, bx + nx, by, bz + nz, ax - nx, ay, az - nz, bx + nx, by, bz + nz, bx - nx, by, bz - nz];
      this.pos.set(q, this.n * 3);
      this.n += 6;
    }
  }
}

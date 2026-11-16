/**
 * Where a held spell will land (hold to aim, 2026-11-16): a soft pulsing ring of its real radius on the ground
 * (hugging slopes), a lane of its real length for the charge and the tornado, a cone for the gale. Dimmed when the
 * crosshair is past the spell's range (the ring then sits at the range's edge).
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshBasicMaterial } from 'three';
import type { AimShape } from '../combat/Aim';

const MAX = 1024;

export class AimPreview {
  readonly group = new Group();
  private readonly geo = new BufferGeometry();
  private readonly mat = new MeshBasicMaterial({ transparent: true, blending: AdditiveBlending, depthWrite: false, opacity: 0.8 });
  private readonly pos = new Float32Array(MAX * 3);
  private n = 0;
  private t = 0;

  constructor(private readonly heightAt: (x: number, z: number, y: number) => number) {
    this.geo.setAttribute('position', new BufferAttribute(this.pos, 3));
    this.mat.forceSinglePass = true;
    const mesh = new Mesh(this.geo, this.mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = 5;
    this.group.add(mesh);
    this.group.visible = false;
  }

  hide(): void { this.group.visible = false; }

  /**
   * Shows `shape` at (x, y, z) (a ring's centre; a lane's or cone's start, along `dir`), in `color`; `far`: past range.
   */
  show(shape: AimShape, x: number, y: number, z: number, dir: { x: number; z: number }, color: number, far: boolean, dt: number): void {
    if (shape.kind === 'none') { this.hide(); return; }
    this.t += dt;
    this.n = 0;
    const pulse = 0.5 + 0.5 * Math.sin(this.t * 6);
    if (shape.kind === 'ring') {
      this.ring(x, y, z, shape.radius, 0.14);
      this.ring(x, y, z, shape.radius * (0.25 + 0.75 * ((this.t * 0.8) % 1)), 0.07);
      this.ring(x, y, z, 0.35, 0.1);
    } else if (shape.kind === 'lane') {
      const l = shape.length, w = shape.width / 2, px = -dir.z, pz = dir.x;
      const at = (a: number, s: number): [number, number] => [x + dir.x * a + px * s, z + dir.z * a + pz * s];
      this.line([at(0, -w), at(l, -w)], y, 0.12);
      this.line([at(0, w), at(l, w)], y, 0.12);
      this.line([at(l, -w), at(l, w)], y, 0.12);
      // Chevrons running along it.
      for (let k = 0; k < 4; k++) {
        const a = ((this.t * 6 + k * (l / 4)) % l);
        this.line([at(a - 0.8, -w * 0.6), at(a, 0), at(a - 0.8, w * 0.6)], y, 0.08);
      }
    } else {
      const r = shape.radius, a0 = Math.atan2(dir.z, dir.x);
      const edge = (a: number): [number, number] => [x + Math.cos(a) * r, z + Math.sin(a) * r];
      this.line([[x, z], edge(a0 - shape.angle)], y, 0.12);
      this.line([[x, z], edge(a0 + shape.angle)], y, 0.12);
      const arc: Array<[number, number]> = [];
      for (let i = 0; i <= 16; i++) arc.push(edge(a0 - shape.angle + (i / 16) * shape.angle * 2));
      this.line(arc, y, 0.12);
    }
    this.geo.setDrawRange(0, this.n);
    this.geo.attributes.position.needsUpdate = true;
    this.mat.color.copy(new Color(color)).multiplyScalar(far ? 0.35 : 0.75 + pulse * 0.35);
    this.group.visible = true;
  }

  private ring(x: number, y: number, z: number, r: number, w: number): void {
    const pts: Array<[number, number]> = [];
    const seg = Math.max(24, Math.min(72, Math.round(r * 10)));
    for (let i = 0; i <= seg; i++) { const a = (i / seg) * Math.PI * 2; pts.push([x + Math.cos(a) * r, z + Math.sin(a) * r]); }
    this.line(pts, y, w);
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

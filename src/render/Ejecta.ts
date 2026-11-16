/**
 * Clods of earth and rock thrown out of a fresh crater (the user's request of 2026-11-16, "the floor could get
 * bombed"): rough lumps in the break material of the ground, flung up and out of the bowl, landing round its rim and
 * lying there a while before they sink away. They are real debris, so Orlan can lift them too.
 */
import { DodecahedronGeometry, Group, Mesh } from 'three';
import { DebrisSim, type Piece } from '../world/Debris';
import { breakMaterial } from './BreakMaterial';

export const EJECTA_LIFE = 25;

let lumps: DodecahedronGeometry[] | null = null;

function lumpGeometries(): DodecahedronGeometry[] {
  if (lumps) return lumps;
  lumps = [];
  for (let k = 0; k < 4; k++) {
    const g = new DodecahedronGeometry(1, 0);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const j = 1 + Math.sin(i * 12.9898 + k * 78.233) * 0.22;
      p.setXYZ(i, p.getX(i) * j, p.getY(i) * j * 0.7, p.getZ(i) * j);
    }
    g.computeVertexNormals();
    lumps.push(g);
  }
  return lumps;
}

export class Ejecta {
  readonly group = new Group();
  readonly sim: DebrisSim;
  private readonly life = new Map<Piece, number>();

  constructor(groundAt: (x: number, z: number, y: number) => number) {
    this.sim = new DebrisSim(groundAt, 80);
    this.group.name = 'ejecta';
  }

  /** A crater `r` across and `depth` deep was just blown at (x, y, z). */
  spawn(x: number, y: number, z: number, r: number, depth: number): void {
    const n = Math.max(3, Math.min(18, Math.round(r * depth * 3.5)));
    const geos = lumpGeometries();
    const mat = breakMaterial('earth');
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, d = r * (0.2 + Math.random() * 0.5);
      const size = 0.08 + Math.random() * 0.22 * Math.min(1.5, depth + 0.4);
      const mesh = new Mesh(geos[i % geos.length], mat);
      mesh.scale.set(size, size, size);
      mesh.castShadow = true;
      this.group.add(mesh);
      const out = 2.5 + Math.random() * 3 * Math.min(2, depth + 0.5);
      const p = this.sim.add({
        x: x + Math.cos(a) * d, y: y + 0.2, z: z + Math.sin(a) * d, r: size, box: { x: size * 0.9, y: size * 0.6, z: size * 0.9 },
        vx: Math.cos(a) * out, vy: 4 + Math.random() * 5 * Math.min(1.6, depth + 0.4), vz: Math.sin(a) * out,
        wx: (Math.random() - 0.5) * 12, wy: (Math.random() - 0.5) * 12, wz: (Math.random() - 0.5) * 12,
        density: 1800, restitution: 0.12, friction: 0.8, obj: mesh,
      });
      this.life.set(p, EJECTA_LIFE * (0.8 + Math.random() * 0.4));
    }
  }

  update(dt: number): void {
    this.sim.step(dt);
    for (const [p, left] of this.life) {
      const l = left - dt;
      this.life.set(p, l);
      const m = p.obj as Mesh | undefined;
      // The last two seconds it sinks into the ground and is gone.
      if (l < 2 && m) m.position.y -= dt * 0.15;
      if (l <= 0 || p.dead) {
        if (m) m.removeFromParent();
        this.sim.remove(p);
        this.life.delete(p);
      }
    }
  }
}

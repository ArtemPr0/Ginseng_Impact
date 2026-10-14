import type { WorldQuery } from '../player/CharacterController';

/** A landmark footprint that raises the collision height field (walkable top, climbable sides). */
export type Footprint =
  | { kind: 'box'; x: number; z: number; hw: number; hd: number; top: number; rotY?: number }
  | { kind: 'cyl'; x: number; z: number; r: number; top: number };

export function footprintContains(f: Footprint, x: number, z: number): boolean {
  const dx = x - f.x;
  const dz = z - f.z;
  if (f.kind === 'cyl') return dx * dx + dz * dz <= f.r * f.r;
  const c = Math.cos(-(f.rotY ?? 0));
  const s = Math.sin(-(f.rotY ?? 0));
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd;
}

/** Terrain height combined with landmark footprints: the single height field the controller and camera use. */
export class HeightWorld implements WorldQuery {
  readonly footprints: Footprint[] = [];

  constructor(private readonly terrain: WorldQuery) {}

  add(...f: Footprint[]): void {
    this.footprints.push(...f);
  }

  heightAt(x: number, z: number): number {
    let h = this.terrain.heightAt(x, z);
    for (const f of this.footprints) {
      if (f.top > h && footprintContains(f, x, z)) h = f.top;
    }
    return h;
  }
}

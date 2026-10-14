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
  /** Footprints bucketed into CELL-metre squares, so a query only tests the shapes near it. */
  private readonly grid = new Map<number, Footprint[]>();
  private static readonly CELL = 16;

  constructor(private readonly terrain: WorldQuery) {}

  private static key(cx: number, cz: number): number {
    return (cx + 32768) * 65536 + (cz + 32768);
  }

  add(...f: Footprint[]): void {
    this.footprints.push(...f);
    const C = HeightWorld.CELL;
    for (const fp of f) {
      const r = fp.kind === 'cyl' ? fp.r : Math.hypot(fp.hw, fp.hd);
      for (let cx = Math.floor((fp.x - r) / C); cx <= Math.floor((fp.x + r) / C); cx++) {
        for (let cz = Math.floor((fp.z - r) / C); cz <= Math.floor((fp.z + r) / C); cz++) {
          const k = HeightWorld.key(cx, cz);
          let list = this.grid.get(k);
          if (!list) this.grid.set(k, (list = []));
          list.push(fp);
        }
      }
    }
  }

  heightAt(x: number, z: number): number {
    let h = this.terrain.heightAt(x, z);
    const list = this.grid.get(HeightWorld.key(Math.floor(x / HeightWorld.CELL), Math.floor(z / HeightWorld.CELL)));
    if (list) for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.top > h && footprintContains(f, x, z)) h = f.top;
    }
    return h;
  }
}

import type { WorldQuery } from '../player/CharacterController';
import { COLLIDER_GRIDS, GRID_BINS } from '../data/colliderGrids';
import { MODELS } from '../data/models';

/** Head room a character needs to pass under an overhang (arch vault, bridge deck, floating rock). */
export const CLEARANCE = 1.9;

/**
 * A footprint raises the collision height field (walkable top, climbable sides).
 * `bottom` (box/cyl) marks an overhead shape: a character whose feet are low enough walks underneath.
 * A `grid` is a baked model collider (scripts/collider-grids.mjs): per cell a ground part, an overhead part and a top.
 */
export type Footprint =
  | { kind: 'box'; x: number; z: number; hw: number; hd: number; top: number; rotY?: number; bottom?: number }
  | { kind: 'cyl'; x: number; z: number; r: number; top: number; bottom?: number }
  | GridFootprint;

export interface GridFootprint {
  kind: 'grid';
  /** Model id, for debugging. */
  id: string;
  x: number; z: number;
  /** Rotation about y of the placed model (its root's rotation.y). */
  rotY: number;
  /** Where the model's feet are. */
  base: number;
  /** Cell grid in metres, in the model's local frame. */
  minX: number; minZ: number; cell: number; nx: number; nz: number;
  /** Metres per height bin. */
  unit: number;
  /** [low, bottom, top] per cell (see colliderGrids.ts). */
  data: Uint8Array;
  /** Bounding radius around (x, z). */
  r: number;
  /** Highest point. */
  top: number;
}

const decoded = new Map<string, Uint8Array>();

function decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** True when model `id` has a baked collider (its file exists and is static). */
export function hasGrid(id: string): boolean {
  return id in COLLIDER_GRIDS;
}

/**
 * The baked collider of model `id` placed with its feet at (x, base, z), turned by `rotY` and scaled by `scale`
 * on top of the registry height. Null when the model has no grid (missing file, character).
 */
export function gridFootprint(id: string, x: number, base: number, z: number, rotY = 0, scale = 1): GridFootprint | null {
  const g = COLLIDER_GRIDS[id];
  if (!g) return null;
  let data = decoded.get(id);
  if (!data) decoded.set(id, (data = decode(g.data)));
  const H = (MODELS[id]?.height ?? g.h) * scale;
  const minX = g.minX * H, minZ = g.minZ * H, cell = g.cell * H;
  const maxX = minX + g.nx * cell, maxZ = minZ + g.nz * cell;
  const r = Math.max(Math.hypot(minX, minZ), Math.hypot(maxX, minZ), Math.hypot(minX, maxZ), Math.hypot(maxX, maxZ));
  return { kind: 'grid', id, x, z, rotY, base, minX, minZ, cell, nx: g.nx, nz: g.nz, unit: (g.yMax * H) / GRID_BINS, data, r, top: base + g.yMax * H };
}

/** A tree trunk: a cylinder of `trunkFraction` × height radius, topped near the crown (climbable like a trunk). */
export function trunkFootprint(id: string, x: number, base: number, z: number, scale: number, trunkFraction: number): Footprint | null {
  if (!hasGrid(id)) return null;
  const H = (MODELS[id]?.height ?? 1) * scale;
  return { kind: 'cyl', x, z, r: Math.max(0.2, H * trunkFraction), top: base + H * 0.85 };
}

/** Cell index of (x, z) in a grid footprint, or -1 outside it. */
function gridCell(f: GridFootprint, x: number, z: number): number {
  const dx = x - f.x;
  const dz = z - f.z;
  if (dx * dx + dz * dz > f.r * f.r) return -1;
  // Into the model's frame: undo the root's rotation about y.
  const c = Math.cos(f.rotY);
  const s = Math.sin(f.rotY);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  const i = Math.floor((lx - f.minX) / f.cell);
  const k = Math.floor((lz - f.minZ) / f.cell);
  if (i < 0 || k < 0 || i >= f.nx || k >= f.nz) return -1;
  return k * f.nx + i;
}

export function footprintContains(f: Footprint, x: number, z: number): boolean {
  const dx = x - f.x;
  const dz = z - f.z;
  if (f.kind === 'cyl') return dx * dx + dz * dz <= f.r * f.r;
  if (f.kind === 'grid') { const c = gridCell(f, x, z); return c >= 0 && f.data[c * 3 + 2] > 0; }
  const c = Math.cos(-(f.rotY ?? 0));
  const s = Math.sin(-(f.rotY ?? 0));
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) <= f.hw && Math.abs(lz) <= f.hd;
}

/** Horizontal reach of a footprint from its centre (plantable checks, spawn checks, bucketing). */
export function footprintRadius(f: Footprint): number {
  return f.kind === 'cyl' || f.kind === 'grid' ? f.r : Math.hypot(f.hw, f.hd);
}

/**
 * The surface height a footprint offers at (x, z) to something whose feet are at `y` (undefined = the highest
 * surface). Overhead parts are skipped when the feet are far enough below them.
 */
function surfaceOf(f: Footprint, x: number, z: number, y: number | undefined): number {
  if (f.kind === 'grid') {
    const c = gridCell(f, x, z);
    if (c < 0) return -Infinity;
    const top = f.data[c * 3 + 2];
    if (top === 0) return -Infinity;
    const bottom = f.data[c * 3 + 1];
    if (y !== undefined && bottom !== 255 && y + CLEARANCE <= f.base + bottom * f.unit) {
      const low = f.data[c * 3];
      return low > 0 ? f.base + low * f.unit : -Infinity;
    }
    return f.base + top * f.unit;
  }
  if (!footprintContains(f, x, z)) return -Infinity;
  if (y !== undefined && f.bottom !== undefined && y + CLEARANCE <= f.bottom) return -Infinity;
  return f.top;
}

/** Terrain height combined with landmark footprints: the single height field the controller and camera use. */
export class HeightWorld implements WorldQuery {
  readonly footprints: Footprint[] = [];
  /** Footprints bucketed into CELL-metre squares, so a query only tests the shapes near it. */
  private readonly grid = new Map<number, Footprint[]>();
  private static readonly CELL = 16;
  private static readonly NEAR_PAD = 2;

  /** Footprints that move every frame (the snail): checked everywhere, not bucketed. Mutate their x/z/rotY/top. */
  readonly moving: Footprint[] = [];

  /** Where the water is (surface height at x, z, or null): the controller swims there when it is deep enough. */
  water: ((x: number, z: number) => number | null) | null = null;

  /** Springy surfaces (giant mushroom caps): landing on one within `r` of (x, z) at height `top` throws you up at `v`. */
  readonly bouncers: Array<{ x: number; z: number; r: number; top: number; v: number }> = [];

  constructor(private readonly terrain: WorldQuery) {}

  /** Upward speed for feet landing at height `y` on a springy surface at (x, z), or null. */
  bounceAt(x: number, z: number, y: number): number | null {
    for (const b of this.bouncers) if (Math.abs(y - b.top) < 0.35 && Math.hypot(x - b.x, z - b.z) < b.r) return b.v;
    return null;
  }

  waterAt(x: number, z: number): number | null {
    return this.water ? this.water(x, z) : null;
  }

  /** True when (x, z) lies within `pad` (≤ 2 m) of a footprint's reach — a cheap "keep clear of buildings" test. */
  near(x: number, z: number, pad: (f: Footprint) => number): boolean {
    const list = this.grid.get(HeightWorld.key(Math.floor(x / HeightWorld.CELL), Math.floor(z / HeightWorld.CELL)));
    if (!list) return false;
    for (let i = 0; i < list.length; i++) {
      const f = list[i];
      const dx = x - f.x;
      const dz = z - f.z;
      const r = pad(f);
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  private static key(cx: number, cz: number): number {
    return (cx + 32768) * 65536 + (cz + 32768);
  }

  add(...f: Footprint[]): void {
    this.footprints.push(...f);
    const C = HeightWorld.CELL;
    for (const fp of f) {
      // Registered a little wider than the shape, so `near()` finds it from any bucket within NEAR_PAD.
      const r = footprintRadius(fp) + HeightWorld.NEAR_PAD;
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

  /** Removes footprints (a model that turned out to be missing, a moved landmark). */
  remove(...f: Footprint[]): void {
    const gone = new Set(f);
    for (let i = this.footprints.length - 1; i >= 0; i--) if (gone.has(this.footprints[i])) this.footprints.splice(i, 1);
    for (const list of this.grid.values()) for (let i = list.length - 1; i >= 0; i--) if (gone.has(list[i])) list.splice(i, 1);
  }

  /** Raw terrain, ignoring every structure. */
  groundAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  /**
   * Height of the surface under (x, z). With `y` (the feet of whoever asks) overhead shapes they fit under are
   * ignored: a character walks under an arch or a bridge, and stands on it once up there.
   */
  heightAt(x: number, z: number, y?: number): number {
    let h = this.terrain.heightAt(x, z);
    const list = this.grid.get(HeightWorld.key(Math.floor(x / HeightWorld.CELL), Math.floor(z / HeightWorld.CELL)));
    if (list) for (let i = 0; i < list.length; i++) {
      const f = list[i];
      if (f.top <= h) continue;
      const s = surfaceOf(f, x, z, y);
      if (s > h) h = s;
    }
    for (let i = 0; i < this.moving.length; i++) {
      const f = this.moving[i];
      if (f.top <= h) continue;
      const s = surfaceOf(f, x, z, y);
      if (s > h) h = s;
    }
    return h;
  }

  /**
   * The underside of the lowest overhang above feet at `y` at (x, z) (a bridge deck, an arch vault), or Infinity:
   * flying or jumping up into a deck stops there instead of passing through it.
   */
  ceilingAt(x: number, z: number, y: number): number {
    let c = Infinity;
    const list = this.grid.get(HeightWorld.key(Math.floor(x / HeightWorld.CELL), Math.floor(z / HeightWorld.CELL)));
    if (list) for (const f of list) {
      let bottom: number | undefined;
      if (f.kind === 'grid') {
        const cell = gridCell(f, x, z);
        if (cell < 0) continue;
        const b = f.data[cell * 3 + 1];
        if (b === 255 || f.data[cell * 3 + 2] === 0) continue;
        bottom = f.base + b * f.unit;
      } else {
        if (f.bottom === undefined || !footprintContains(f, x, z)) continue;
        bottom = f.bottom;
      }
      if (bottom > y + 0.2 && bottom < c) c = bottom;
    }
    return c;
  }

  /** True when (x, z) is inside any structure's outline (not just under its overhang). */
  blocked(x: number, z: number): boolean {
    const list = this.grid.get(HeightWorld.key(Math.floor(x / HeightWorld.CELL), Math.floor(z / HeightWorld.CELL)));
    if (list) for (const f of list) if (footprintContains(f, x, z)) return true;
    for (const f of this.moving) if (footprintContains(f, x, z)) return true;
    return false;
  }
}

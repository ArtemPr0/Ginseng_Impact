import { BufferAttribute, Color, DoubleSide, InstancedMesh, Object3D, PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patchWind, surface } from '../render/Materials';

const COUNT = 30000;
const RADIUS = 48;
/** Grass is grown per TILE × TILE metres. */
const TILE = 16;
/** Same density as the old 26 000 blades in a 48 m disc. */
const BLADES_PER_M2 = 26000 / (Math.PI * 48 * 48);

/** Instanced grass blades that follow the player: tapered crossed quads, wind sway, dark base to electric tips. */
export class Grass {
  readonly mesh: InstancedMesh;
  private readonly dummy = new Object3D();
  private seed = 17;

  constructor(private readonly heightAt: (x: number, z: number) => number, private readonly plantable: (x: number, z: number) => boolean) {
    const blade = (rot: number) => {
      const g = new PlaneGeometry(0.07, 0.48, 1, 4).translate(0, 0.24, 0);
      const pos = g.attributes.position as BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const base = new Color(0x0e1c34);
      const tip = new Color(0x4b66b8);
      const c = new Color();
      for (let i = 0; i < pos.count; i++) {
        const t = pos.getY(i) / 0.48;
        pos.setX(i, pos.getX(i) * (1 - t * 0.75));
        pos.setZ(i, pos.getZ(i) + t * t * 0.14); // curved blade
        c.copy(base).lerp(tip, t * t);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      g.rotateY(rot);
      return g;
    };
    const geo = mergeGeometries([blade(0), blade(Math.PI / 2)], false)!;
    const mat = surface({ vertexColors: true, side: DoubleSide, roughness: 0.9 });
    patchWind(mat, 0.4);
    this.mesh = new InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.receiveShadow = true;
  }

  private rnd(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Blade matrices per TILE-metre square, computed once each (a few per frame) and reused as the player roams. */
  private readonly tiles = new Map<string, Float32Array>();
  private readonly pending: string[] = [];
  private dirty = true;
  private lastTile = '';

  /** The tile being grown: resumable, so growing never takes more than a few milliseconds of a frame. */
  private growing: { key: string; tx: number; tz: number; seed: number; tries: number; placed: number; want: number; out: number[] } | null = null;

  /**
   * Grows the current tile for at most `budgetMs`; returns true when it finished. Deterministic per tile (its
   * own seed), so a tile looks the same every time it comes back.
   */
  private growStep(budgetMs: number): boolean {
    const g = this.growing!;
    const t0 = performance.now();
    this.seed = g.seed;
    while (g.placed < g.want && g.tries < g.want * 3) {
      if ((g.tries & 31) === 0 && performance.now() - t0 > budgetMs) { g.seed = this.seed; return false; }
      g.tries++;
      const x = (g.tx + this.rnd()) * TILE;
      const z = (g.tz + this.rnd()) * TILE;
      const rx = this.rnd(), ry = this.rnd(), rz = this.rnd(), s1 = this.rnd(), s2 = this.rnd();
      if (!this.plantable(x, z)) continue;
      this.dummy.position.set(x, this.heightAt(x, z) - 0.03, z);
      this.dummy.rotation.set((rx - 0.5) * 0.25, ry * Math.PI, (rz - 0.5) * 0.25);
      const sc = 0.75 + s1 * 0.7;
      this.dummy.scale.set(sc, sc * (0.8 + s2 * 0.5), sc);
      this.dummy.updateMatrix();
      const e = this.dummy.matrix.elements;
      for (let k = 0; k < 16; k++) g.out.push(e[k]);
      g.placed++;
      // A tile that is mostly road, water or buildings gives up early instead of trying thousands of spots.
      if (g.tries > 120 && g.placed * 8 < g.tries) break;
    }
    this.tiles.set(g.key, new Float32Array(g.out));
    this.growing = null;
    return true;
  }

  /**
   * Keeps grass within RADIUS of the player: missing tiles are grown a couple per frame (no hitch when crossing
   * the map), and the instance buffer is refilled from the cached tiles whenever the set changes.
   */
  update(px: number, pz: number): void {
    const ptx = Math.floor(px / TILE);
    const ptz = Math.floor(pz / TILE);
    const reach = Math.ceil(RADIUS / TILE);
    const key = ptx + ',' + ptz;
    if (key !== this.lastTile) {
      this.lastTile = key;
      this.pending.length = 0;
      if (this.growing) this.pending.push(this.growing.key);
      const want: Array<[number, number, number]> = [];
      for (let dz = -reach; dz <= reach; dz++) for (let dx = -reach; dx <= reach; dx++) {
        const cx = (ptx + dx + 0.5) * TILE - px;
        const cz = (ptz + dz + 0.5) * TILE - pz;
        const d = Math.hypot(cx, cz);
        if (d > RADIUS + TILE * 0.7) continue;
        want.push([ptx + dx, ptz + dz, d]);
      }
      want.sort((a, b) => a[2] - b[2]);
      for (const [tx, tz] of want) { const k = tx + ',' + tz; if (!this.tiles.has(k)) this.pending.push(k); }
      // Forget tiles far behind, so the cache stays small on a long walk.
      for (const k of this.tiles.keys()) { const [tx, tz] = k.split(',').map(Number); if (Math.hypot((tx + 0.5) * TILE - px, (tz + 0.5) * TILE - pz) > RADIUS * 3) this.tiles.delete(k); }
      this.dirty = true;
    }
    // Grow tiles for ~3 ms a frame, nearest first.
    const t0 = performance.now();
    while (performance.now() - t0 < 3) {
      if (!this.growing) {
        const k = this.pending.shift();
        if (!k) break;
        if (this.tiles.has(k)) continue;
        const [tx, tz] = k.split(',').map(Number);
        this.growing = { key: k, tx, tz, seed: (Math.imul(tx * 73856093 ^ tz * 19349663, 2654435761) >>> 0) || 1, tries: 0, placed: 0, want: Math.round(BLADES_PER_M2 * TILE * TILE), out: [] };
      }
      if (this.growStep(3 - (performance.now() - t0))) this.dirty = true;
      else break;
    }
    if (!this.dirty) return;
    this.dirty = false;
    const arr = this.mesh.instanceMatrix.array as Float32Array;
    let placed = 0;
    for (let dz = -reach; dz <= reach && placed < COUNT; dz++) for (let dx = -reach; dx <= reach && placed < COUNT; dx++) {
      const t = this.tiles.get((ptx + dx) + ',' + (ptz + dz));
      if (!t) continue;
      const cx = (ptx + dx + 0.5) * TILE - px;
      const cz = (ptz + dz + 0.5) * TILE - pz;
      if (Math.hypot(cx, cz) > RADIUS + TILE * 0.7) continue;
      const n = Math.min(t.length / 16, COUNT - placed);
      arr.set(t.subarray(0, n * 16), placed * 16);
      placed += n;
    }
    this.mesh.count = placed;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

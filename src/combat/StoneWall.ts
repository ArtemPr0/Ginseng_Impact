/**
 * Sir Aldric's Stone Wall (v12, 2026-11-16, from the Flowbound clips the user sent): a wall of stone blocks pulled up
 * out of the ground across his line of sight, row by row from the middle out, solid to walk and shoot into. Cast again
 * while it stands and he kicks it apart: every block flies off along his facing as a heavy projectile. Left alone it
 * crumbles after STAND seconds. Earthsplitter uses the same blocks as a ring of slabs jutting up round its crater.
 *
 * The blocks are cut (world/SolidFracture's block mode) from the earth spikes' Meshy rock (v13: never the dry-stone
 * wall's bricks): copies of it stacked three high and two wide, each cut into blocks once and reused. Drawn in one batch
 * (render/ChunkBatch), hidden while it stands (the spikes show), handed to the debris sim and shown only when kicked.
 */
import { Color, Quaternion, Vector3, type Material, type Object3D } from 'three';
import { ChunkBatch } from '../render/ChunkBatch';
import { breakMaterial } from '../render/BreakMaterial';
import { fractureNow, type ObjectChunk } from '../world/FractureObject';
import type { DebrisSim, Piece } from '../world/Debris';

/** Seconds it stands before it crumbles by itself. */
export const STAND = 10;
/** The wall: copies of the model across and up. */
const ACROSS = 2;
const ROWS = 3;
const WIDTH = 6;
const RISE = 0.45;

/** The model cut into blocks, in its own frame, with its size. */
export interface WallSource {
  chunks: ObjectChunk[];
  /** Its length (along x), height and lowest point, model units. */
  length: number;
  height: number;
  floor: number;
}

const sources = new WeakMap<Object3D, WallSource>();
/** The model's own texture is warm brick-red; at spell size it is cooled to night stone (cached per material). */
const COOL = new Color(0x8a93a8);
const cooled = new WeakMap<Material, Material>();
function cool(m: Material): Material {
  let c = cooled.get(m);
  if (!c) {
    c = m.clone();
    const col = (c as Material & { color?: Color }).color;
    if (col) col.multiply(COOL);
    cooled.set(m, c);
  }
  return c;
}

/** Cuts the wall model into about a dozen stone blocks (once per model). */
export function wallSource(root: Object3D): WallSource | null {
  const hit = sources.get(root);
  if (hit) return hit;
  const f = fractureNow(root, 12, 7, 0.1, 'stone');
  if (!f.chunks.length) return null;
  // Its size and floor from the blocks themselves, in the model's own frame (the frame they were cut in: a model
  // that is also placed in the world has a world box that is somewhere else and scaled).
  const lo = new Vector3(Infinity, Infinity, Infinity), hi = new Vector3(-Infinity, -Infinity, -Infinity);
  const corner = new Vector3();
  for (const c of f.chunks) for (let k = 0; k < 8; k++) {
    corner.set(k & 1 ? c.half.x : -c.half.x, k & 2 ? c.half.y : -c.half.y, k & 4 ? c.half.z : -c.half.z).applyQuaternion(c.q).add(c.pivot);
    lo.min(corner); hi.max(corner);
  }
  const s: WallSource = { chunks: f.chunks, length: hi.x - lo.x, height: hi.y - lo.y, floor: lo.y };
  sources.set(root, s);
  return s;
}

interface Block { proxy: Object3D; x: number; y: number; z: number; ty: number; delay: number; half: { x: number; y: number; z: number }; piece: Piece | null }

export class StoneWall {
  readonly batch: ChunkBatch;
  readonly blocks: Block[] = [];
  /** Seconds since it was raised. */
  t = 0;
  /** Standing (solid, kickable). */
  up = true;
  /** Seconds since it was kicked or crumbled. */
  gone = 0;
  private readonly dir: { x: number; z: number };
  private removers: Array<() => void> = [];
  private readonly hit = new Set<unknown>();
  private readonly rise: number;

  /**
   * A wall across `yaw` at `at`; or, with `ring`, Earthsplitter's slabs: `ring.count` blocks jutting up round `at`
   * `ring.r` metres out, tilted outward.
   */
  constructor(src: WallSource, at: Vector3, yaw: number, groundAt: (x: number, z: number) => number,
    solid?: (x: number, z: number, r: number, top: number) => () => void, ring?: { r: number; count: number }) {
    this.dir = { x: Math.cos(yaw), z: Math.sin(yaw) };
    this.rise = ring ? 0.16 : RISE;
    const side = { x: -this.dir.z, z: this.dir.x };
    const UP = new Vector3(0, 1, 0);
    const picked: Array<{ c: ObjectChunk; s: number; pos: Vector3; q: Quaternion; delay: number }> = [];
    // It comes up out of the ground at the aim, never off the top of something small standing there (a stump or a
    // fence post's collider read as ground lifted a whole wall a metre into the air, 2026-11-16).
    const floorAt = (x: number, z: number) => Math.min(groundAt(x, z), at.y + 0.25);
    if (ring) {
      // Slabs: blocks of the wall, big, standing on end round the crater and leaning out.
      const s = 2.2 / Math.max(1e-3, src.height);
      for (let i = 0; i < ring.count; i++) {
        const c = src.chunks[Math.floor(Math.random() * src.chunks.length)];
        const a = (i / ring.count) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
        const r = ring.r * (0.85 + Math.random() * 0.3);
        const x = at.x + Math.cos(a) * r, z = at.z + Math.sin(a) * r;
        const q = new Quaternion().setFromAxisAngle(UP, Math.PI / 2 - a)
          .multiply(new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), 0.5 + Math.random() * 0.35));
        picked.push({ c, s, pos: new Vector3(x, floorAt(x, z) + Math.max(c.half.x, c.half.y, c.half.z) * s * 0.55, z), q, delay: Math.random() * 0.06 });
      }
    } else {
      // The wall: the model's copies, its length fitted to half the wall, three rows high; every other row turned
      // round so no two rows match.
      const s = WIDTH / ACROSS / Math.max(1e-3, src.length);
      const face = new Quaternion().setFromAxisAngle(UP, -yaw + Math.PI / 2);
      for (let row = 0; row < ROWS; row++) {
        const turn = row % 2 ? new Quaternion().setFromAxisAngle(UP, Math.PI) : new Quaternion();
        for (let k = 0; k < ACROSS; k++) {
          const along = (k - (ACROSS - 1) / 2) * (WIDTH / ACROSS);
          const ox = at.x + side.x * along, oz = at.z + side.z * along;
          const ground = floorAt(ox, oz);
          const qc = face.clone().multiply(turn);
          for (const c of src.chunks) {
            const p = c.pivot.clone().setY(c.pivot.y - src.floor + row * src.height).multiplyScalar(s).applyQuaternion(qc);
            const mid = Math.abs(along + p.x * side.x + p.z * side.z) / (WIDTH / 2);
            picked.push({ c, s, pos: new Vector3(ox + p.x, ground + p.y, oz + p.z), q: qc.clone().multiply(c.q), delay: mid * 0.15 + row * 0.08 });
          }
        }
      }
    }
    this.batch = new ChunkBatch(picked.map((p) => p.c), breakMaterial('stone') as Material, cool);
    this.batch.group.name = ring ? 'stone-slabs' : 'stone-wall';
    const height = src.height * (WIDTH / ACROSS / Math.max(1e-3, src.length)) * ROWS;
    picked.forEach((p, i) => {
      const proxy = this.batch.proxies[i];
      const sink = (ring ? 2.4 : height) + 0.4;
      // Slabs: the chunk's own box turned (its q) under the slab's lean.
      const q = ring ? p.q.clone().multiply(p.c.q) : p.q;
      proxy.position.set(p.pos.x, p.pos.y - sink, p.pos.z);
      proxy.quaternion.copy(q);
      proxy.scale.setScalar(p.s);
      proxy.userData.scale = p.s;
      this.blocks.push({
        proxy, x: p.pos.x, y: p.pos.y - sink, z: p.pos.z, ty: p.pos.y, delay: p.delay,
        half: { x: p.c.half.x * p.s, y: p.c.half.y * p.s, z: p.c.half.z * p.s }, piece: null,
      });
    });
    this.batch.update();
    // Solid along its length.
    if (solid && !ring) {
      for (let s = -WIDTH / 2 + 0.5; s <= WIDTH / 2 - 0.5; s += 1) {
        const x = at.x + side.x * s, z = at.z + side.z * s;
        this.removers.push(solid(x, z, 0.55, floorAt(x, z) + height));
      }
    }
  }

  update(dt: number): void {
    this.t += dt;
    if (this.up) {
      for (const b of this.blocks) {
        const k = Math.max(0, Math.min(1, (this.t - b.delay) / this.rise));
        // Out of the ground fast, a small overshoot, settles.
        const e = 1 - (1 - k) ** 3 + Math.sin(k * Math.PI) * 0.04;
        b.proxy.position.y = b.y + (b.ty - b.y) * e;
      }
    } else {
      this.gone += dt;
      // Rubble left lying fades after a while.
      if (this.gone > 8) for (const b of this.blocks) b.proxy.scale.setScalar((b.proxy.userData.scale as number) * Math.max(0, 1 - (this.gone - 8) / 1.5));
    }
    this.batch.update();
  }

  /** Every block flies off along `yaw` (his facing as he kicks; the raise's by default) at `speed` m/s, spinning. */
  kick(sim: DebrisSim, speed = 16, yaw?: number): void {
    if (!this.up) return;
    this.release();
    const dx = yaw === undefined ? this.dir.x : Math.cos(yaw), dz = yaw === undefined ? this.dir.z : Math.sin(yaw);
    for (const b of this.blocks) {
      const k = speed * (0.85 + Math.random() * 0.3);
      const up = 1.5 + Math.random() * 2.5;
      b.piece = this.add(sim, b, dx * k + (Math.random() - 0.5) * 2, up, dz * k + (Math.random() - 0.5) * 2, 6);
    }
  }

  /** It crumbles where it stands. */
  crumble(sim: DebrisSim): void {
    if (!this.up) return;
    this.release();
    for (const b of this.blocks) b.piece = this.add(sim, b, (Math.random() - 0.5) * 1.5, 0, (Math.random() - 0.5) * 1.5, 1.5);
  }

  /** Kicked blocks still flying fast, for their hits. */
  *flying(): Generator<Piece> {
    for (const b of this.blocks) if (b.piece && !b.piece.dead && Math.hypot(b.piece.vx, b.piece.vz) > 4) yield b.piece;
  }

  /** True the first time `e` is struck by this wall. */
  strike(e: unknown): boolean {
    if (this.hit.has(e)) return false;
    this.hit.add(e);
    return true;
  }

  /** Done: everything faded. */
  get finished(): boolean { return !this.up && this.gone > 9.5; }

  dispose(sim: DebrisSim): void {
    this.release();
    for (const b of this.blocks) if (b.piece) sim.remove(b.piece);
    this.batch.dispose();
  }

  private release(): void {
    this.up = false;
    for (const r of this.removers) r();
    this.removers = [];
  }

  private add(sim: DebrisSim, b: Block, vx: number, vy: number, vz: number, spin: number): Piece {
    const q = b.proxy.quaternion;
    return sim.add({
      x: b.proxy.position.x, y: b.proxy.position.y, z: b.proxy.position.z, r: Math.hypot(b.half.x, b.half.y, b.half.z), box: b.half,
      q: { x: q.x, y: q.y, z: q.z, w: q.w },
      vx, vy, vz, wx: (Math.random() - 0.5) * spin, wy: (Math.random() - 0.5) * spin, wz: (Math.random() - 0.5) * spin,
      obj: b.proxy, density: 2300, restitution: 0.15, friction: 0.7,
    });
  }
}

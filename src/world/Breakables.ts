/**
 * Everything breaks (the request of 2026-11-15, "literally everything"; made real on 2026-11-16, "when buildings break
 * it doesn't look realistic"). A placed model is registered with its colliders and a size; the first blow strong
 * enough swaps it for its own solid chunks (SolidFracture: straight cracks, wall thickness, a stone, wood or plaster
 * inside), knocks out the ones the blow reaches, and whatever is no longer joined to the ground through standing
 * chunks falls under its own weight — dropped, not thrown. When its hit points run out the building comes down as a
 * wave from the blow: the walls by it fail first, those on the ground tip over outward about their base, the rest
 * drop and pile. Rubble rests as real boxes (Debris) and becomes box colliders you climb; small bits fade after a
 * while; and only out of the hero's sight, far off, does the building stand again.
 */
import { Group, Quaternion, Vector3, type Material, type Object3D } from 'three';
import { ChunkBatch } from '../render/ChunkBatch';
import { blockCount, hasBlocks, chunkCount } from './Fracture';
import { SyncFracturer, type Fracturer, type ObjectChunk } from './FractureObject';
import { DebrisSim, type Piece } from './Debris';
import type { Footprint, GridFootprint } from './Colliders';
import { breakMaterial, type BreakKind } from '../render/BreakMaterial';

/** A building with less than this share of its blocks standing comes down (it used to be 35 %: whole walls went). */
export const LAST_STANDING = 0.1;

/** How hard a blow breaks things, by its kind. */
export const POWER = { light: 0.5, heavy: 1, skill: 3, spell: 3, burst: 6, stomp: 2 } as const;
export type BlowKind = keyof typeof POWER;

/** Hit points of a thing `size` metres across: a prop one light blow, a house six heavies, a castle four bursts. */
export function breakHp(size: number): number {
  if (size < 2.5) return POWER.light;
  if (size < 12) return 6;
  if (size < 30) return 12;
  return 24;
}

/** Light combo blows only break props. */
export function canBreak(size: number, kind: BlowKind): boolean {
  return kind !== 'light' || size < 2.5;
}

/** Seconds before rubble rebuilds: a home, a shop or a door within a minute, the rest in three. */
export const REBUILD_S = { quick: 60, slow: 180 };
/** Rebuilding is never seen: the hero is at least this far away and looking elsewhere. */
export const REBUILD_AWAY = 60;

export function rebuildDue(e: { brokeAt: number; quick: boolean }, now: number, heroDist: number, inView: boolean): boolean {
  if (now - e.brokeAt < (e.quick ? REBUILD_S.quick : REBUILD_S.slow)) return false;
  return heroDist >= REBUILD_AWAY && !inView;
}

/** Standing chunks not joined to the ground (`grounded`) through standing neighbours (`adjacent`). */
export function unheld(adjacent: number[][], standing: boolean[], grounded: boolean[]): number[] {
  const held = new Array(standing.length).fill(false);
  const queue: number[] = [];
  standing.forEach((s, i) => { if (s && grounded[i]) { held[i] = true; queue.push(i); } });
  while (queue.length) {
    const i = queue.pop()!;
    for (const j of adjacent[i]) if (!held[j] && standing[j]) { held[j] = true; queue.push(j); }
  }
  const out: number[] = [];
  standing.forEach((s, i) => { if (s && !held[i]) out.push(i); });
  return out;
}

/**
 * When a chunk `d` metres (across the ground) from the blow gives way in the collapse of a thing `size` metres across;
 * `jitter` 0–1. The near side first, the far side last: a house in ~0.5 s, a cathedral in ~1.5 s.
 */
export function collapseDelay(d: number, size: number, jitter: number): number {
  const span = 0.35 + Math.min(1.1, size / 45);
  const k = Math.min(1, d / Math.max(1, size));
  return Math.max(0, span * k * (0.8 + 0.4 * jitter));
}

/**
 * A copy of grid footprint `f` cut down to `standing` (balls in the grid's local metres, y above its base): cells with
 * nothing over them are cleared, the rest lowered to the top of what stands. The shared baked grid is never touched.
 */
export function trimGrid(f: GridFootprint, standing: Array<{ x: number; y: number; z: number; r: number }>): GridFootprint {
  const data = new Uint8Array(f.data);
  for (let k = 0; k < f.nz; k++) for (let i = 0; i < f.nx; i++) {
    const o = (k * f.nx + i) * 3;
    if (data[o + 2] === 0) continue;
    const lx = f.minX + (i + 0.5) * f.cell, lz = f.minZ + (k + 0.5) * f.cell;
    let top = -1;
    for (const b of standing) {
      if (Math.hypot(b.x - lx, b.z - lz) <= b.r + f.cell * 0.5) top = Math.max(top, b.y + b.r);
    }
    if (top < 0) { data[o] = 0; data[o + 1] = 255; data[o + 2] = 0; continue; }
    const bins = Math.max(1, Math.ceil(top / f.unit));
    data[o + 2] = Math.min(data[o + 2], bins);
    if (data[o + 1] !== 255 && data[o + 1] >= data[o + 2]) data[o + 1] = 255;
    if (data[o] >= data[o + 2]) data[o] = 0;
  }
  return { ...f, data };
}

/** What can be broken: a placed model with its colliders. */
export interface BreakTarget {
  id: string;
  object: Object3D;
  footprints: Footprint[];
  /** Metres across (its biggest side). */
  size: number;
  /** Someone lives or trades here, or a door leads in: it rebuilds within a minute. */
  quick?: boolean;
  /** For things made on demand (a flora instance): one key per thing, so it is registered once. */
  key?: unknown;
  /** Where its chunks go when `object` is not in the scene (a flora instance stand-in). */
  parent?: Object3D;
  /** For instanced flora: hide or show the instance instead of the object. */
  hide?: () => void;
  show?: () => void;
  /** Soft things (flowers, mushrooms, kelp): its pieces never pile into solid rubble and are gone within seconds. */
  brief?: boolean;
  /** A tree: its trunk falls as solid logs, its crown (the upper part) flutters off like a brief thing. */
  tree?: boolean;
  /** What its inside is (the cut faces, the rubble's weight and sound). Default stone. */
  material?: BreakKind;
}

export interface ChunkState {
  chunk: ObjectChunk;
  /** Its stand-in: the physics moves this, its building's ChunkBatch draws it. */
  mesh: Object3D;
  /** Centre in world space, its box half extents (scaled) and bounding radius. */
  x: number; y: number; z: number; r: number;
  half: { x: number; y: number; z: number };
  q: Quaternion;
  /** Its box reaches the ground the model stands on. */
  grounded: boolean;
  standing: boolean;
  /** It went because what held it up went (dropped, not thrown). */
  fell: boolean;
  /** In a collapse: when it gives way (the clock), -1 when not scheduled. */
  failAt: number;
  /** Leaves: shrinks away within seconds. */
  brief: boolean;
  piece: Piece | null;
}

export interface Breakable {
  target: BreakTarget;
  hp: number;
  maxHp: number;
  state: 'intact' | 'broken' | 'rubble';
  brokeAt: number;
  x: number; z: number; r: number;
  chunks: ChunkState[];
  adjacent: number[][];
  group: Group | null;
  /** Draws its pieces in a few calls (ChunkBatch). */
  batch: ChunkBatch | null;
  /** Colliders in the height field now (the original, a trimmed copy, or none). */
  live: Footprint[];
  /** Rubble colliders by piece. */
  rubble: Map<Piece, Footprint>;
  /** Blows that landed while its fracture was still being cut (the worker): applied when it is ready. */
  pending: Array<[number, number, number, number, BlowKind]>;
  /** Which of its three ways to break it takes this time. */
  variant: number;
}

export interface HeightsLike {
  add(...f: Footprint[]): void;
  remove(...f: Footprint[]): void;
  /** `skip`: a collider to leave out (a resting piece asking for the ground under its own). */
  heightAt(x: number, z: number, y?: number, skip?: Footprint): number;
}

const outers = new Map<Material, Material>();

/** The chunk's outside: the model's own material (a copy, so a patch on the model does not move its rubble). */
function outerMaterial(m: Material): Material {
  let s = outers.get(m);
  if (!s) { s = m.clone(); outers.set(m, s); }
  return s;
}

/** Throw speed (m/s) a blow gives chunks at its centre. */
const THROW: Record<BlowKind, number> = { light: 3, heavy: 4.5, skill: 7, spell: 7, burst: 10, stomp: 5 };
/** Rubble whose biggest half is under this fades after FADE_AFTER seconds at rest; over it, it becomes a collider. */
const SMALL = 0.22;
const FADE_AFTER = 90;
/** A brief thing's pieces (leaves, petals) shrink to nothing over this many seconds from the blow. */
const BRIEF_LIFE = 1.6;
/** kg/m³ by material (the rubble's weight). */
const DENSITY: Record<BreakKind, number> = { stone: 2300, plaster: 1500, wood: 650, metal: 4000, glass: 2500, crystal: 2600, bone: 1800, earth: 1600 };
/** Wall thickness (m) by material, scaled with the thing's size. */
function thicknessOf(kind: BreakKind, size: number): number {
  const base = kind === 'wood' ? 0.1 : kind === 'plaster' ? 0.16 : kind === 'metal' || kind === 'glass' ? 0.04 : 0.26;
  return Math.max(0.03, Math.min(base, size * 0.06));
}
/** A tree's trunk: the lower share of its height. */
const TRUNK = 0.42;

export class Breakables {
  /** How many blocks buildings break into, as a share of High's (the quality setting). */
  blockScale = 1;
  /** When each piece was thrown (a brief thing's leaves shrink from then). */
  private readonly born = new WeakMap<Piece, number>();
  readonly entries: Breakable[] = [];
  readonly sim: DebrisSim;
  /** Things registered only when a blow reaches them (each flora set's instances): (x, z, radius) → targets there. */
  readonly providers: Array<(x: number, z: number, radius: number) => BreakTarget[]> = [];
  private readonly byKey = new Map<unknown, Breakable>();
  /** Buildings Telekinesis holds whole (takeWhole): no blow reaches them, they are not rebuilt. */
  private readonly lifted = new Set<Breakable>();
  /** A building came down (evacuate the people of `quick` ones, play the rumble). */
  onCollapse?: (b: Breakable) => void;
  /** Chunks broke off (crack and crumble sounds, dust). */
  onBreak?: (b: Breakable, x: number, y: number, z: number, count: number) => void;
  /** A piece of rubble hit the ground hard: dust there, a thud by its mass. */
  onLand?: (x: number, y: number, z: number, size: number, material: BreakKind) => void;
  /** A chunk gave way in a collapse (a crack, dust off it). */
  onFail?: (x: number, y: number, z: number, size: number, material: BreakKind) => void;
  onRebuild?: (b: Breakable) => void;
  /** Whether a spot is on screen (the camera's view); rebuilds wait for out of view. */
  inView: (x: number, z: number, r: number) => boolean = () => true;
  /** Where fractures come from (main swaps in the worker). */
  fracturer: Fracturer = new SyncFracturer();
  private now = 0;
  private landAt = 0;
  private readonly owner = new Map<Piece, { b: Breakable; c: ChunkState }>();
  private readonly restSince = new Map<Piece, number>();
  private readonly falling: Array<{ b: Breakable; c: ChunkState; bx: number; bz: number }> = [];

  /** Is `o`'s place on show now? (World: false for island things while the hero is in a realm.) */
  shownNow: (o: Object3D) => boolean = () => true;

  /** Ways each thing may break, one after another as it is rebuilt (Quality: 3 on High, 1 on Low). */
  variants = 3;

  constructor(private readonly heights: HeightsLike) {
    // A resting piece's own rubble collider is not its ground (it would hold itself up after the wall under it broke).
    this.sim = new DebrisSim((x, z, y, p) => {
      const foot = p && this.owner.get(p)?.b.rubble.get(p);
      return heights.heightAt(x, z, y, foot || undefined);
    });
    // A piece knocked awake lets go of its collider before it moves (no pop up off itself).
    this.sim.onWake = (p) => {
      const o = this.owner.get(p);
      const foot = o?.b.rubble.get(p);
      if (o && foot) { heights.remove(foot); o.b.rubble.delete(p); }
    };
  }

  register(t: BreakTarget): Breakable {
    t.object.updateMatrixWorld(true);
    const p = t.object.parent ? t.object.getWorldPosition(t.object.position.clone()) : t.object.position.clone();
    const b: Breakable = {
      target: t, hp: breakHp(t.size), maxHp: breakHp(t.size), state: 'intact', brokeAt: 0,
      x: p.x, z: p.z, r: t.size / 2, chunks: [], adjacent: [], group: null, batch: null, live: t.footprints.slice(), rubble: new Map(),
      pending: [], variant: Math.floor(Math.random() * 3),
    };
    this.entries.push(b);
    if (t.key !== undefined) this.byKey.set(t.key, b);
    return b;
  }

  /**
   * Lifts the intact building nearest (x, z) (within 1.5 m of its edge; 1 to 12 m across, not a flower or an instanced
   * thing) whole off its footing, for Telekinesis: its colliders leave the world while it is held. `move` puts its
   * base at a point, tilted; `land` sets it down upright there, its colliders moved with it. Null: nothing to lift.
   */
  takeWhole(x: number, z: number): { x: number; y: number; z: number; r: number; height: number; move(x: number, y: number, z: number, tx: number, tz: number): void; land(x: number, y: number, z: number): void } | null {
    let b: Breakable | null = null, bd = 1.5;
    for (const e of this.near(x, z, 8)) {
      const t = e.target;
      if (e.state !== 'intact' || e.pending.length || t.brief || t.hide || t.size < 1 || t.size >= 12 || !t.object.parent) continue;
      const d = Math.hypot(e.x - x, e.z - z) - e.r;
      if (d < bd) { bd = d; b = e; }
    }
    if (!b) return null;
    const it = b, o = it.target.object, parent = o.parent!;
    o.updateMatrixWorld(true);
    const start = o.getWorldPosition(new Vector3());
    const rx = o.rotation.x, rz = o.rotation.z;
    this.heights.remove(...it.live);
    it.live = [];
    // (Held: no blow breaks it until it is down.)
    this.lifted.add(it);
    const put = (px: number, py: number, pz: number) => {
      const l = parent.worldToLocal(new Vector3(px, py, pz));
      o.position.copy(l);
      o.updateMatrixWorld(true);
    };
    return {
      x: start.x, y: start.y, z: start.z, r: it.r, height: it.target.size,
      move: (px, py, pz, tx, tz) => { put(px, py, pz); o.rotation.x = rx + tx; o.rotation.z = rz + tz; o.updateMatrixWorld(true); },
      land: (px, py, pz) => {
        o.rotation.x = rx; o.rotation.z = rz;
        put(px, py, pz);
        const dx = px - start.x, dy = py - start.y, dz = pz - start.z;
        for (const f of it.target.footprints) {
          f.x += dx; f.z += dz; f.top += dy;
          if (f.kind === 'grid') f.base += dy;
          else if (f.bottom !== undefined) f.bottom += dy;
        }
        it.x = px; it.z = pz;
        it.live = it.target.footprints.slice();
        this.heights.add(...it.live);
        this.lifted.delete(it);
        // Its cut was made where it stood: cut again here.
        this.cut.delete(it);
      },
    };
  }

  /** Breakables a blow at (x, z) of `radius` reaches. */
  near(x: number, z: number, radius: number): Breakable[] {
    for (const p of this.providers) for (const t of p(x, z, radius)) if (!this.byKey.has(t.key)) this.register(t);
    return this.entries.filter((b) => b.state !== 'rubble' && !this.lifted.has(b) && Math.hypot(b.x - x, b.z - z) <= b.r + radius);
  }

  /** A blow of `kind` at (x, y, z) reaching `radius` metres: breaks what it reaches. Returns how many things it hit. */
  damageAt(x: number, y: number, z: number, radius: number, kind: BlowKind): number {
    let hit = 0;
    for (const b of this.near(x, z, radius)) {
      if (!canBreak(b.target.size, kind)) continue;
      if (!this.shatter(b)) {
        // (Cut into nothing — a model with no solid mesh: it does not break.)
        if (this.cut.get(b)?.chunks.length === 0) continue;
        // Still being cut: the blow waits for it.
        if (b.target.object.parent ?? b.target.parent) { b.pending.push([x, y, z, radius, kind]); hit++; }
        continue;
      }
      hit++;
      this.strike(b, x, y, z, radius, kind);
    }
    if (hit) this.sim.blast(x, y, z, radius + 1, THROW[kind] * 0.45);
    return hit;
  }

  /**
   * A vortex over (x, z) tears up to `count` standing blocks loose from what stands within `radius` (v12, the reel's
   * black hole lifting a temple block by block): the highest go first, let go with no throw (the vortex's own pull
   * carries them). A building torn down to its last third comes down. Only big things (heavy blows' size) are torn.
   * Returns how many came loose.
   */
  tear(x: number, z: number, radius: number, count: number): number {
    let torn = 0;
    for (const b of this.near(x, z, radius)) {
      if (torn >= count) break;
      if (b.state === 'rubble' || !canBreak(b.target.size, 'heavy')) continue;
      if (!this.shatter(b)) continue;
      const up = b.chunks.filter((c) => c.standing && Math.hypot(c.x - x, c.z - z) <= radius).sort((p, q) => q.y - p.y);
      for (const c of up.slice(0, count - torn)) {
        this.add(b, c, (Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6,
          (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5, (Math.random() - 0.5) * 1.5);
        torn++;
      }
      if (!up.length) continue;
      const left = b.chunks.filter((c) => c.standing).length;
      if (left < b.chunks.length * LAST_STANDING) { this.collapse(b, x, b.chunks[0].y, z, radius, 1); continue; }
      this.dropUnheld(b);
      this.trim(b);
    }
    return torn;
  }

  private strike(b: Breakable, x: number, y: number, z: number, radius: number, kind: BlowKind): void {
    b.hp -= POWER[kind];
    const speed = THROW[kind];
    // A prop goes in one blow; a building only loses what the blow reaches (playtest 2026-11-17: "only the part that
    // was hit breaks, not the whole building").
    if (b.hp <= 0 && b.target.size < 2.5) { this.collapse(b, x, y, z, radius, speed); return; }
    // Knock out what the blow reaches (at least the chunk nearest it).
    let n = 0;
    let nearest: ChunkState | null = null, nd = Infinity;
    for (const c of b.chunks) {
      if (!c.standing) continue;
      const d = Math.hypot(c.x - x, c.y - y, c.z - z);
      if (d < nd) { nd = d; nearest = c; }
      if (d <= radius + Math.min(c.r, 1)) { this.launch(b, c, x, y, z, speed, radius); n++; }
    }
    if (!n && nearest) { this.launch(b, nearest, x, y, z, speed, radius); n = 1; }
    // What is no longer held up falls under its own weight.
    this.dropUnheld(b);
    const left = b.chunks.filter((c) => c.standing).length;
    if (left < b.chunks.length * LAST_STANDING) { this.collapse(b, x, y, z, radius, 1); return; }
    this.onBreak?.(b, x, y, z, n);
    this.trim(b);
  }

  private dropUnheld(b: Breakable): void {
    const standing = b.chunks.map((c) => c.standing);
    for (const i of unheld(b.adjacent, standing, b.chunks.map((c) => c.grounded))) this.drop(b, b.chunks[i], b.x, b.z, false);
  }

  update(dt: number, hero: { x: number; z: number }, inView: (x: number, z: number, r: number) => boolean = this.inView): void {
    this.now += dt;
    // Fractures that were being cut: their waiting blows land now.
    for (const b of this.entries) {
      if (!b.pending.length || b.state !== 'intact') continue;
      if (!this.shatter(b)) continue;
      const blows = b.pending.splice(0);
      for (const [x, y, z, r, k] of blows) {
        if ((b.state as Breakable['state']) === 'rubble') break;
        this.strike(b, x, y, z, r, k);
      }
    }
    // The collapse wave: chunks giving way on time.
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      if (f.c.failAt > this.now) continue;
      this.falling.splice(i, 1);
      this.drop(f.b, f.c, f.bx, f.bz, true);
    }
    this.sim.step(dt);
    for (const p of this.sim.pieces) {
      const o = this.owner.get(p);
      if (!o) continue;
      if (o.c.brief) {
        const k = (this.now - (this.born.get(p) ?? this.now)) / BRIEF_LIFE;
        o.c.mesh.scale.setScalar(Math.max(0, (o.c.mesh.userData.scale as number) * (1 - k * k)));
        if (k >= 1) { o.c.mesh.visible = false; this.sim.remove(p); }
        continue;
      }
      // Rubble that settles becomes solid; a piece that moves again lets go.
      const foot = o.b.rubble.get(p);
      const big = Math.max(p.hx, p.hy, p.hz) >= SMALL;
      if (!p.awake && !foot && big) {
        const f = rubbleFootprint(p);
        o.b.rubble.set(p, f);
        this.heights.add(f);
      } else if (p.awake && foot) { this.heights.remove(foot); o.b.rubble.delete(p); }
      // Small bits fade after a while at rest.
      if (!p.awake && !big) {
        const since = this.restSince.get(p) ?? this.now;
        this.restSince.set(p, since);
        const a = this.now - since - FADE_AFTER;
        if (a > 0) {
          o.c.mesh.scale.setScalar(Math.max(0, (o.c.mesh.userData.scale as number) * (1 - a)));
          if (a >= 1) { o.c.mesh.visible = false; this.sim.remove(p); }
        }
      } else this.restSince.delete(p);
    }
    for (const [p, o] of this.owner) if (p.dead) { o.c.mesh.visible = false; this.owner.delete(p); this.restSince.delete(p); }
    for (const b of this.entries) {
      if (b.state === 'intact' || this.lifted.has(b)) continue;
      const d = Math.hypot(b.x - hero.x, b.z - hero.z);
      if (rebuildDue({ brokeAt: b.brokeAt, quick: !!b.target.quick }, this.now, d, inView(b.x, b.z, b.r))) this.rebuild(b);
    }
    for (const b of this.entries) if (b.batch && b.group?.visible !== false) b.batch.update();
  }

  /** Cuts the nearest intact building within `range` ahead of time (the worker), one a call. */
  prefetch(hero: { x: number; z: number }, range = 80): void {
    let best: Breakable | null = null, bd = range;
    for (const b of this.entries) {
      if (b.state !== 'intact' || b.target.size < 4 || b.target.key !== undefined) continue;
      const d = Math.hypot(b.x - hero.x, b.z - hero.z) - b.r;
      if (d < bd && !this.ready(b)) { bd = d; best = b; }
    }
    if (best) this.fracture(best);
  }

  private readonly cut = new WeakMap<Breakable, ReturnType<Fracturer['get']>>();
  private ready(b: Breakable): boolean { return !!this.cut.get(b); }

  private fracture(b: Breakable): ReturnType<Fracturer['get']> {
    const t = b.target;
    const hit = this.cut.get(b);
    if (hit) return hit;
    const kind = t.material ?? 'stone';
    // Buildings and big things come apart block by block (v12, the reel); props, trees and leaves in Voronoi chunks.
    // (Metal and glass have no block shape: they shatter in chunkCount's few pieces.)
    const blocks = t.tree || t.brief || !hasBlocks(kind) ? 0 : blockCount(t.size, this.blockScale);
    const n = blocks || chunkCount(t.size);
    const s = t.object.getWorldScale(new Vector3()).x || 1;
    const f = this.fracturer.get(`${t.id}:${n}:${b.variant}${blocks ? ':b' : ''}`, t.object, n, 1 + b.variant * 977, thicknessOf(kind, t.size) / s, blocks ? kind : undefined);
    if (f) this.cut.set(b, f);
    return f;
  }

  /** Swaps the intact model for its chunks, standing where it stood (false while it is not loaded or not cut yet). */
  private shatter(b: Breakable): boolean {
    if (b.state !== 'intact') return true;
    const t = b.target;
    const parent = t.object.parent ?? t.parent;
    if (!parent) return false;
    const f = this.fracture(b);
    if (!f || !f.chunks.length) return false;
    const kind = t.material ?? 'stone';
    const inside = breakMaterial(kind);
    const batch = new ChunkBatch(f.chunks, inside, outerMaterial);
    const group = batch.group;
    group.name = 'broken:' + t.id;
    parent.add(group);
    t.object.updateMatrixWorld(true);
    const s = t.object.getWorldScale(new Vector3()).x || 1;
    const wq = t.object.getWorldQuaternion(new Quaternion());
    const height = t.size;
    const floorY = new Vector3(0, f.floor, 0).applyMatrix4(t.object.matrixWorld).y;
    b.chunks = f.chunks.map((chunk, i) => {
      const mesh = batch.proxies[i];
      const w = chunk.pivot.clone().applyMatrix4(t.object.matrixWorld);
      const q = wq.clone().multiply(chunk.q);
      mesh.position.copy(w);
      mesh.quaternion.copy(q);
      mesh.scale.setScalar(s);
      mesh.userData.scale = s;
      const half = { x: chunk.half.x * s, y: chunk.half.y * s, z: chunk.half.z * s };
      // Lowest corner of its box, to know what stands on the ground.
      let low = Infinity;
      const v = new Vector3();
      for (let k = 0; k < 8; k++) {
        v.set(k & 1 ? half.x : -half.x, k & 2 ? half.y : -half.y, k & 4 ? half.z : -half.z).applyQuaternion(q);
        low = Math.min(low, w.y + v.y);
      }
      const brief = !!t.brief || (!!t.tree && w.y - floorY > height * TRUNK);
      return {
        chunk, mesh, x: w.x, y: w.y, z: w.z, r: Math.max(0.1, chunk.radius * s), half, q,
        grounded: low <= floorY + Math.max(0.3, height * 0.06), standing: true, fell: false, failAt: -1, brief, piece: null,
      };
    });
    b.adjacent = f.adjacent;
    b.group = group;
    b.batch = batch;
    batch.update();
    // (Marked hidden too, so a zone change does not show it again: World.showZone.)
    if (t.hide) t.hide(); else { t.object.visible = false; t.object.userData.hidden = true; }
    b.state = 'broken';
    b.brokeAt = this.now;
    return true;
  }

  /** Into the sim: thrown away from (x, y, z) at `speed` (fading out past `radius`), tumbling. */
  private launch(b: Breakable, c: ChunkState, x: number, y: number, z: number, speed: number, radius: number): void {
    if (!c.standing) return;
    const dx = c.x - x, dy = c.y - y, dz = c.z - z;
    const d = Math.hypot(dx, dy, dz) || 1;
    // (Leaves are thrown softly: they flutter off, they are not shrapnel.)
    const k = speed * Math.max(0.15, 1 - d / (radius + 3)) * (c.brief ? 0.45 : 1);
    const spin = (k * 0.8) / Math.max(0.35, c.r);
    this.add(b, c, (dx / d) * k, Math.max(0, (dy / d) * k) + k * 0.3, (dz / d) * k,
      (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin, (Math.random() - 0.5) * spin);
  }

  /**
   * Into the sim under its own weight: no throw. A chunk on the ground (`topple`) tips over outward from the building's
   * centre (bx, bz) about its base; one higher up drops with a slight tilt.
   */
  private drop(b: Breakable, c: ChunkState, bx: number, bz: number, topple: boolean): void {
    if (!c.standing) return;
    c.fell = true;
    let ox = c.x - bx, oz = c.z - bz;
    const ol = Math.hypot(ox, oz) || 1;
    ox /= ol; oz /= ol;
    if (topple && c.grounded) {
      // Tip about the horizontal axis across the outward direction: ω = up × out.
      const w = 0.7 + Math.random() * 0.9;
      this.add(b, c, ox * 0.6, 0, oz * 0.6, oz * w, 0, -ox * w);
    } else {
      const w = 0.4 / Math.max(0.4, c.r);
      this.add(b, c, ox * 0.3 + (Math.random() - 0.5) * 0.3, -0.2, oz * 0.3 + (Math.random() - 0.5) * 0.3,
        (Math.random() - 0.5) * w, (Math.random() - 0.5) * w * 0.3, (Math.random() - 0.5) * w);
    }
    if (topple) this.onFail?.(c.x, c.y, c.z, c.r, b.target.material ?? 'stone');
  }

  private add(b: Breakable, c: ChunkState, vx: number, vy: number, vz: number, wx: number, wy: number, wz: number): void {
    c.standing = false;
    c.failAt = -1;
    const kind = b.target.material ?? 'stone';
    const p = this.sim.add({
      x: c.x, y: c.y, z: c.z, r: c.r, box: c.half, q: c.q,
      vx, vy, vz, wx, wy, wz, obj: c.mesh, density: DENSITY[kind],
      restitution: kind === 'wood' ? 0.3 : 0.15, friction: kind === 'glass' || kind === 'metal' ? 0.4 : 0.65,
      onLand: c.brief ? undefined : (q, v) => {
        if (this.now - this.landAt < 0.03) return;
        this.landAt = this.now;
        const size = Math.max(q.hx, q.hy, q.hz);
        if (v > 2.5 && size > 0.12) this.onLand?.(q.x, q.y - size, q.z, size * Math.min(1, v / 8), kind);
      },
    });
    c.piece = p;
    this.owner.set(p, { b, c });
    this.born.set(p, this.now);
  }

  /** It comes down: the blow's reach goes at once, the rest gives way in a wave from it, the colliders go. */
  private collapse(b: Breakable, x: number, y: number, z: number, radius: number, speed: number): void {
    for (const c of b.chunks) {
      if (!c.standing) continue;
      const d = Math.hypot(c.x - x, c.y - y, c.z - z);
      // (Leaves and petals all go at once: a plant does not fall in a wave.)
      if ((d <= radius + 0.5 && speed > 1) || c.brief) { this.launch(b, c, x, y, z, Math.max(speed, 3), radius); continue; }
      c.failAt = this.now + collapseDelay(Math.hypot(c.x - x, c.z - z), b.target.size, Math.random())
        // (Higher up goes a beat after what holds it.)
        + Math.max(0, c.y - b.chunks[0].y) * 0.004;
      this.falling.push({ b, c, bx: b.x, bz: b.z });
    }
    this.heights.remove(...b.live);
    b.live = [];
    b.state = 'rubble';
    b.brokeAt = this.now;
    this.onCollapse?.(b);
  }

  /** Cuts the collider down to the chunks still standing. */
  private trim(b: Breakable): void {
    const t = b.target;
    const next: Footprint[] = [];
    const standing = b.chunks.filter((c) => c.standing);
    for (const f of t.footprints) {
      // A box or a cylinder: cut as a grid too, so where the building is gone nothing invisible stays standing.
      if (f.kind !== 'grid') { if (standing.length) next.push(trimGrid(...gridLocal(gridOf(f, b.chunks), standing))); continue; }
      const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
      const local = standing.map((ch) => {
        const dx = ch.x - f.x, dz = ch.z - f.z;
        return { x: dx * c - dz * s, z: dx * s + dz * c, y: ch.y - f.base, r: ch.r * 0.5 };
      });
      next.push(trimGrid(f, local));
    }
    this.heights.remove(...b.live);
    this.heights.add(...next);
    b.live = next;
  }

  private rebuild(b: Breakable): void {
    for (const c of b.chunks) {
      if (c.piece) {
        this.sim.remove(c.piece);
        this.owner.delete(c.piece);
        this.restSince.delete(c.piece);
        const f = b.rubble.get(c.piece);
        if (f) this.heights.remove(f);
      }
    }
    for (let i = this.falling.length - 1; i >= 0; i--) if (this.falling[i].b === b) this.falling.splice(i, 1);
    b.rubble.clear();
    this.sim.step(0);
    for (let i = this.sim.pieces.length - 1; i >= 0; i--) if (this.sim.pieces[i].dead) this.sim.pieces.splice(i, 1);
    b.batch?.dispose();
    b.batch = null;
    b.group?.removeFromParent();
    b.group = null;
    b.chunks = [];
    b.adjacent = [];
    this.heights.remove(...b.live);
    this.heights.add(...b.target.footprints);
    b.live = b.target.footprints.slice();
    if (b.target.show) b.target.show(); else { b.target.object.visible = this.shownNow(b.target.object); delete b.target.object.userData.hidden; }
    b.hp = b.maxHp;
    b.state = 'intact';
    // Next time it breaks another way.
    b.variant = (b.variant + 1) % this.variants;
    this.cut.delete(b);
    this.onRebuild?.(b);
  }
}

/** A box collider over a resting piece: its world box's footprint (along its longest level axis), as high as its top. */
export function rubbleFootprint(p: Piece): Footprint {
  const q = new Quaternion(p.qx, p.qy, p.qz, p.qw);
  const axes = [new Vector3(1, 0, 0), new Vector3(0, 1, 0), new Vector3(0, 0, 1)].map((a) => a.applyQuaternion(q));
  const h = [p.hx, p.hy, p.hz];
  // The box axis lying most level, with the most length, sets the footprint's heading.
  let best = 0, bs = -1;
  axes.forEach((a, i) => { const s = (1 - Math.abs(a.y)) * h[i]; if (s > bs) { bs = s; best = i; } });
  const u = new Vector3(axes[best].x, 0, axes[best].z).normalize();
  if (u.lengthSq() < 0.5) u.set(1, 0, 0);
  const v = new Vector3(-u.z, 0, u.x);
  const along = (d: Vector3) => axes.reduce((s, a, i) => s + Math.abs(a.dot(d)) * h[i], 0);
  const up = axes.reduce((s, a, i) => s + Math.abs(a.y) * h[i], 0);
  // (Local x runs along (cos rotY, sin rotY): Colliders' box convention.)
  // Its top is where a line straight up through its middle leaves it (a leaning plank is thin there), not its highest
  // corner: a level box at its corner height stood over thin air beside a tilted piece.
  let thick = Infinity;
  axes.forEach((a, i) => { thick = Math.min(thick, h[i] / Math.max(1e-3, Math.abs(a.y))); });
  // How level it lies: a tilted piece's box covers less than its whole shadow.
  const level = Math.max(...axes.map((a) => Math.abs(a.y)));
  const k = 0.55 + 0.35 * level;
  return { kind: 'box', x: p.x, z: p.z, hw: along(u) * k, hd: along(v) * k, top: p.y + Math.min(thick, up) * 0.95, rotY: Math.atan2(u.z, u.x), bottom: p.y - up };
}

/** A box or cylinder collider as a grid of 0.5 m cells over the same ground, standing from its building's floor. */
export function gridOf(f: Exclude<Footprint, GridFootprint>, chunks: Array<{ y: number; r: number }>): GridFootprint {
  let base = f.bottom ?? Infinity;
  if (!Number.isFinite(base)) for (const c of chunks) base = Math.min(base, c.y - c.r);
  if (!Number.isFinite(base)) base = 0;
  const hw = f.kind === 'box' ? f.hw : f.r, hd = f.kind === 'box' ? f.hd : f.r;
  const cell = 0.5;
  const nx = Math.max(1, Math.ceil((hw * 2) / cell)), nz = Math.max(1, Math.ceil((hd * 2) / cell));
  const unit = Math.max(0.1, (f.top - base) / 250);
  const bins = Math.max(1, Math.ceil((f.top - base) / unit));
  const data = new Uint8Array(nx * nz * 3);
  for (let k = 0; k < nz; k++) for (let i = 0; i < nx; i++) {
    const o = (k * nx + i) * 3;
    const lx = -hw + (i + 0.5) * cell, lz = -hd + (k + 0.5) * cell;
    const inside = f.kind === 'box' ? true : Math.hypot(lx, lz) <= f.r;
    data[o] = 0; data[o + 1] = 255; data[o + 2] = inside ? bins : 0;
  }
  // (Grids turn the other way from boxes: a box's local x runs along (cos rotY, sin rotY).)
  const rotY = f.kind === 'box' ? -(f.rotY ?? 0) : 0;
  return { kind: 'grid', id: 'trimmed', x: f.x, z: f.z, rotY, base, minX: -hw, minZ: -hd, cell, nx, nz, unit, data, r: Math.hypot(hw, hd), top: f.top };
}

/** The grid and the standing chunks in its local frame (trimGrid's input). */
function gridLocal(g: GridFootprint, standing: Array<{ x: number; y: number; z: number; r: number }>): [GridFootprint, Array<{ x: number; y: number; z: number; r: number }>] {
  const c = Math.cos(g.rotY), s = Math.sin(g.rotY);
  return [g, standing.map((ch) => {
    const dx = ch.x - g.x, dz = ch.z - g.z;
    return { x: dx * c - dz * s, z: dx * s + dz * c, y: ch.y - g.base, r: ch.r * 0.5 };
  })];
}

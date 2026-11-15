/**
 * Everything breaks (the request of 2026-11-15, "literally everything"): a placed model is registered with its colliders
 * and a size; the first blow strong enough swaps it for its own chunks (Fracture), knocks out the ones near the blow,
 * drops whatever is no longer held up (a tower blown through the middle loses its top), and trims its collider to what
 * still stands. When its hit points run out the rest comes down. The rubble rests (Debris), small bits fade, and after a
 * while — never in front of the hero — the building quietly stands again.
 */
import { DoubleSide, Group, Mesh, type Material, type Object3D } from 'three';
import { chunkCount, fractureObject, type Chunk } from './Fracture';
import { DebrisSim, type Piece } from './Debris';
import type { Footprint, GridFootprint } from './Colliders';

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
/** Rebuilding is never seen: the hero is this far away or looking elsewhere. */
export const REBUILD_AWAY = 60;

export function rebuildDue(e: { brokeAt: number; quick: boolean }, now: number, heroDist: number, inView: boolean): boolean {
  if (now - e.brokeAt < (e.quick ? REBUILD_S.quick : REBUILD_S.slow)) return false;
  return heroDist >= REBUILD_AWAY || !inView;
}

interface Ball { x: number; y: number; z: number; r: number }

/**
 * Indices of standing chunks no longer held up: not joined to the ground (the lowest band of chunks) through other
 * standing chunks that touch.
 */
export function unsupported(chunks: Ball[], standing: boolean[]): number[] {
  let floor = Infinity;
  for (const c of chunks) floor = Math.min(floor, c.y - c.r);
  const held = new Array(chunks.length).fill(false);
  const queue: number[] = [];
  chunks.forEach((c, i) => { if (standing[i] && c.y - c.r <= floor + 0.5) { held[i] = true; queue.push(i); } });
  while (queue.length) {
    const i = queue.pop()!;
    const a = chunks[i];
    for (let j = 0; j < chunks.length; j++) {
      if (held[j] || !standing[j]) continue;
      const b = chunks[j];
      if (Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= (a.r + b.r) * 1.0) { held[j] = true; queue.push(j); }
    }
  }
  const out: number[] = [];
  chunks.forEach((_, i) => { if (standing[i] && !held[i]) out.push(i); });
  return out;
}

/**
 * A copy of grid footprint `f` cut down to `standing` (balls in the grid's local metres, y above its base): cells with
 * nothing over them are cleared, the rest lowered to the top of what stands. The shared baked grid is never touched.
 */
export function trimGrid(f: GridFootprint, standing: Ball[]): GridFootprint {
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
  /** Leaves (a tree's crown, flowers): its pieces never pile into solid rubble and are gone within seconds. */
  brief?: boolean;
}

interface ChunkState {
  chunk: Chunk;
  mesh: Mesh;
  /** Pivot in world space, and its ball radius (scaled). */
  x: number; y: number; z: number; r: number;
  standing: boolean;
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
  group: Group | null;
  /** Colliders in the height field now (the original, a trimmed copy, or none). */
  live: Footprint[];
  /** Rubble colliders by piece. */
  rubble: Map<Piece, Footprint>;
}

export interface HeightsLike {
  add(...f: Footprint[]): void;
  remove(...f: Footprint[]): void;
  heightAt(x: number, z: number, y?: number): number;
}

const fractured = new Map<string, Chunk[]>();
const shells = new Map<Material, Material>();

/** The chunk's material: the model's own, double-sided, its inside faces dark (the shell's hidden side). */
function shellMaterial(m: Material): Material {
  let s = shells.get(m);
  if (!s) {
    s = m.clone();
    s.side = DoubleSide;
    s.onBeforeCompile = (sh) => {
      sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb *= 0.28;');
    };
    s.customProgramCacheKey = () => 'shell';
    shells.set(m, s);
  }
  return s;
}

/** Throw speed (m/s) a blow gives chunks at its centre. */
const THROW: Record<BlowKind, number> = { light: 3, heavy: 5, skill: 8, spell: 8, burst: 11, stomp: 6 };
/** Rubble smaller than this fades after FADE_AFTER seconds at rest. */
const SMALL = 0.5;
const FADE_AFTER = 60;
/** A brief thing's pieces (leaves, petals) shrink to nothing over this many seconds from the blow, like a burst of leaves. */
const BRIEF_LIFE = 1.6;

export class Breakables {
  /** When each piece was thrown (a brief thing's leaves shrink from then). */
  private readonly born = new WeakMap<Piece, number>();
  readonly entries: Breakable[] = [];
  readonly sim: DebrisSim;
  /** Things registered only when a blow reaches them (each flora set's instances): (x, z, radius) → targets there. */
  readonly providers: Array<(x: number, z: number, radius: number) => BreakTarget[]> = [];
  private readonly byKey = new Map<unknown, Breakable>();
  /** A building came down (evacuate the people of `quick` ones, play the rumble). */
  onCollapse?: (b: Breakable) => void;
  /** Chunks broke off (crack and crumble sounds, dust). */
  onBreak?: (b: Breakable, x: number, y: number, z: number, count: number) => void;
  onRebuild?: (b: Breakable) => void;
  private now = 0;
  private readonly owner = new Map<Piece, { b: Breakable; c: ChunkState }>();
  private readonly restSince = new Map<Piece, number>();

  constructor(private readonly heights: HeightsLike) {
    this.sim = new DebrisSim((x, z, y) => heights.heightAt(x, z, y));
  }

  register(t: BreakTarget): Breakable {
    t.object.updateMatrixWorld(true);
    const p = t.object.parent ? t.object.getWorldPosition(t.object.position.clone()) : t.object.position.clone();
    const b: Breakable = {
      target: t, hp: breakHp(t.size), maxHp: breakHp(t.size), state: 'intact', brokeAt: 0,
      x: p.x, z: p.z, r: t.size / 2, chunks: [], group: null, live: t.footprints.slice(), rubble: new Map(),
    };
    this.entries.push(b);
    if (t.key !== undefined) this.byKey.set(t.key, b);
    return b;
  }

  /** Breakables a blow at (x, z) of `radius` reaches. */
  near(x: number, z: number, radius: number): Breakable[] {
    for (const p of this.providers) for (const t of p(x, z, radius)) if (!this.byKey.has(t.key)) this.register(t);
    return this.entries.filter((b) => b.state !== 'rubble' && Math.hypot(b.x - x, b.z - z) <= b.r + radius);
  }

  /** A blow of `kind` at (x, y, z) reaching `radius` metres: breaks what it reaches. Returns how many things it hit. */
  damageAt(x: number, y: number, z: number, radius: number, kind: BlowKind): number {
    let hit = 0;
    for (const b of this.near(x, z, radius)) {
      if (!canBreak(b.target.size, kind)) continue;
      if (!this.shatter(b)) continue;
      hit++;
      b.hp -= POWER[kind];
      const speed = THROW[kind];
      if (b.hp <= 0) { this.collapse(b, x, y, z, speed); continue; }
      // Knock out what the blow reaches (at least the chunk nearest it).
      let n = 0;
      let nearest: ChunkState | null = null, nd = Infinity;
      for (const c of b.chunks) {
        if (!c.standing) continue;
        const d = Math.hypot(c.x - x, c.y - y, c.z - z);
        if (d < nd) { nd = d; nearest = c; }
        if (d <= radius + c.r) { this.launch(b, c, x, y, z, speed); n++; }
      }
      if (!n && nearest) { this.launch(b, nearest, x, y, z, speed); n = 1; }
      // What is no longer held up falls.
      for (const i of unsupported(b.chunks, b.chunks.map((c) => c.standing))) this.launch(b, b.chunks[i], x, y, z, 1.5);
      const left = b.chunks.filter((c) => c.standing).length;
      if (left < b.chunks.length * 0.35) { this.collapse(b, x, y, z, 2); continue; }
      this.onBreak?.(b, x, y, z, n);
      this.trim(b);
    }
    if (hit) this.sim.blast(x, y, z, radius + 1.5, THROW[kind] * 0.6);
    return hit;
  }

  update(dt: number, hero: { x: number; z: number }, inView: (x: number, z: number, r: number) => boolean = () => true): void {
    this.now += dt;
    this.sim.step(dt);
    for (const p of this.sim.pieces) {
      const o = this.owner.get(p);
      if (!o) continue;
      // Rubble that settles becomes solid; a piece that moves again lets go.
      const foot = o.b.rubble.get(p);
      const brief = !!o.b.target.brief;
      if (brief) {
        const k = (this.now - (this.born.get(p) ?? this.now)) / BRIEF_LIFE;
        o.c.mesh.scale.setScalar(Math.max(0, (o.c.mesh.userData.scale as number) * (1 - k * k)));
        if (k >= 1) { o.c.mesh.visible = false; this.sim.remove(p); }
        continue;
      }
      if (!p.awake && !foot && p.r >= SMALL) {
        const f: Footprint = { kind: 'cyl', x: p.x, z: p.z, r: p.r * 0.8, top: p.y + p.r * 0.5 };
        o.b.rubble.set(p, f);
        this.heights.add(f);
      } else if (p.awake && foot) { this.heights.remove(foot); o.b.rubble.delete(p); }
      // Small bits fade after a minute at rest.
      if (!p.awake && p.r < SMALL) {
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
      if (b.state === 'intact') continue;
      const d = Math.hypot(b.x - hero.x, b.z - hero.z);
      if (rebuildDue({ brokeAt: b.brokeAt, quick: !!b.target.quick }, this.now, d, inView(b.x, b.z, b.r))) this.rebuild(b);
    }
  }

  /** Swaps the intact model for its chunks, standing where it stood (false while its model has not loaded). */
  private shatter(b: Breakable): boolean {
    if (b.state !== 'intact') return true;
    const t = b.target;
    const parent = t.object.parent ?? t.parent;
    if (!parent) return false;
    const n = chunkCount(t.size);
    const key = `${t.id}:${n}`;
    let chunks = fractured.get(key);
    if (!chunks) {
      chunks = fractureObject(t.object, n, 1);
      if (!chunks.length) return false;
      fractured.set(key, chunks);
    }
    const group = new Group();
    group.name = 'broken:' + t.id;
    parent.add(group);
    const s = t.object.scale.x;
    t.object.updateMatrixWorld(true);
    b.chunks = chunks.map((chunk) => {
      const mesh = new Mesh(chunk.geometry, shellMaterial(chunk.material));
      const w = chunk.pivot.clone().applyMatrix4(t.object.matrixWorld);
      mesh.position.copy(w);
      mesh.rotation.set(0, t.object.rotation.y, 0);
      mesh.scale.setScalar(s);
      mesh.userData.scale = s;
      mesh.castShadow = true;
      group.add(mesh);
      return { chunk, mesh, x: w.x, y: w.y, z: w.z, r: Math.max(0.15, chunk.radius * s), standing: true, piece: null };
    });
    b.group = group;
    // (Marked hidden too, so a zone change does not show it again: World.showZone.)
    if (t.hide) t.hide(); else { t.object.visible = false; t.object.userData.hidden = true; }
    b.state = 'broken';
    b.brokeAt = this.now;
    return true;
  }

  private launch(b: Breakable, c: ChunkState, x: number, y: number, z: number, speed: number): void {
    if (!c.standing) return;
    c.standing = false;
    const dx = c.x - x, dy = c.y - y, dz = c.z - z;
    const d = Math.hypot(dx, dy, dz) || 1;
    // (Leaves are thrown softly: they flutter off, they are not shrapnel.)
    const k = speed * Math.max(0.3, 1 - d / 12) * (b.target.brief ? 0.45 : 1);
    const spin = () => (Math.random() - 0.5) * 2 * (2 + speed * 0.4) / Math.max(0.5, c.r);
    const p = this.sim.add({
      x: c.x, y: c.y, z: c.z, r: c.r,
      vx: (dx / d) * k + (Math.random() - 0.5), vy: Math.max(0, (dy / d) * k) + k * 0.4, vz: (dz / d) * k + (Math.random() - 0.5),
      wx: spin(), wy: spin(), wz: spin(), ry: c.mesh.rotation.y, obj: c.mesh,
    });
    c.piece = p;
    this.owner.set(p, { b, c });
    this.born.set(p, this.now);
  }

  private collapse(b: Breakable, x: number, y: number, z: number, speed: number): void {
    for (const c of b.chunks) this.launch(b, c, x, y, z, speed);
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
      if (f.kind !== 'grid') { if (standing.length) next.push(f); continue; }
      const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
      const local = standing.map((ch) => {
        const dx = ch.x - f.x, dz = ch.z - f.z;
        return { x: dx * c - dz * s, z: dx * s + dz * c, y: ch.y - f.base, r: ch.r };
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
    b.rubble.clear();
    this.sim.step(0);
    for (let i = this.sim.pieces.length - 1; i >= 0; i--) if (this.sim.pieces[i].dead) this.sim.pieces.splice(i, 1);
    b.group?.removeFromParent();
    b.group = null;
    b.chunks = [];
    this.heights.remove(...b.live);
    this.heights.add(...b.target.footprints);
    b.live = b.target.footprints.slice();
    if (b.target.show) b.target.show(); else { b.target.object.visible = true; delete b.target.object.userData.hidden; }
    b.hp = b.maxHp;
    b.state = 'intact';
    this.onRebuild?.(b);
  }
}

/**
 * Breaking the land (the request of 2026-11-15; the user's call: shallow, walkable craters and scorch that heal):
 * a big blow digs a bowl with a raised rim straight into the baked heightfield, so the hero, the mobs, the camera and
 * the rubble all feel it at once; fire burns the ground black, frost turns it pale. Every vertex touched remembers what
 * it was and eases back over HEAL_S seconds, to exactly that.
 */
import { LAYER, type Heightfield } from '../render/Ground';

/**
 * Deepest a crater (or craters on craters) may dig below the original ground, metres: a field bombed again and again
 * goes down to a real shell hole (the user's request of 2026-11-16, "the floor could get bombed").
 */
export const MAX_DEPTH = 3;
/** Steepest a crater's side may be, metres of drop per metre across (walkable: the controller climbs it). */
const MAX_STEP = 0.8;
/** Seconds a crater or a scorch takes to heal. */
export const HEAL_S = 180;
const LAYER_COUNT = 12;

/** Height change at distance `d` from the centre of a crater `r` metres across its bowl and `depth` deep. */
export function craterProfile(d: number, r: number, depth: number): number {
  if (d < r) return -depth * (1 - (d / r) ** 2);
  if (d < r * 1.5) return depth * 0.25 * Math.sin((Math.PI * (d - r)) / (r * 0.5));
  return 0;
}

interface Rec {
  h0: number; l0: Uint8Array; t0: [number, number, number];
  h1: number; l1: Uint8Array; t1: [number, number, number];
  at: number;
}

export interface CraterHooks {
  /**
   * The field changed over [x0, x1] × [z0, z1]: redraw it (Terrain.refresh). `regrow`: the grass there must grow again
   * (a new crater or scorch clears it; healing grows it back once nothing there is healing any more).
   */
  refresh(x0: number, z0: number, x1: number, z1: number, regrow: boolean): void;
  /** May the ground be dug at (x, z)? (not under a building, on water, on a path's flat or a realm floor) */
  canDig(x: number, z: number): boolean;
}

const ASH: [number, number, number] = [0.02, 0.018, 0.022];
const ICE: [number, number, number] = [0.52, 0.66, 0.82];

export class Craters {
  private readonly recs = new Map<number, Rec>();
  private now = 0;
  private since = 0;

  constructor(readonly field: Heightfield, private readonly hooks: CraterHooks) {}

  /** Vertices still healing. */
  get healing(): number {
    return this.recs.size;
  }

  /**
   * Digs a crater `r` metres across its bowl at (x, z), at most `depth` deep (clamped to stay walkable). Where the ground
   * may not be dug it only burns a smaller patch; returns whether it dug.
   */
  crater(x: number, z: number, r: number, depth: number): boolean {
    if (!this.field.contains(x, z)) return false;
    if (!this.hooks.canDig(x, z)) { this.scorch(x, z, r * 0.6, 'burnt'); return false; }
    const dep = Math.min(depth, r * 0.35, MAX_DEPTH);
    const { data } = this.field;
    const box = this.each(x, z, r * 1.5, (i, d) => {
      const rec = this.rec(i);
      data[i] = Math.max(rec.h0 - MAX_DEPTH, data[i] + craterProfile(d, r, dep));
      rec.h1 = data[i];
    });
    // Craters on craters deepen the middle: the sides slump back until they are walkable again, so a deep hole is a
    // wide one (as real shell holes are), and you can always climb out.
    const wide = this.relax(x, z, r * 1.5 + MAX_DEPTH / MAX_STEP + 1);
    if (box) this.hooks.refresh(...(wide ?? box), true);
    return true;
  }

  /** Lowers ground standing more than MAX_STEP a cell above a neighbour within `r` of (x, z); returns the box changed. */
  private relax(x: number, z: number, r: number): [number, number, number, number] | null {
    const { s, n, data } = this.field;
    const n1 = n + 1, step = MAX_STEP * s.cell;
    const ix0 = Math.max(0, Math.floor((x - r - s.x0) / s.cell)), ix1 = Math.min(n, Math.ceil((x + r - s.x0) / s.cell));
    const iz0 = Math.max(0, Math.floor((z - r - s.z0) / s.cell)), iz1 = Math.min(n, Math.ceil((z + r - s.z0) / s.cell));
    let changed = false;
    for (let pass = 0; pass < 24; pass++) {
      let any = false;
      for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
        const i = iz * n1 + ix;
        const h = data[i];
        for (const [jx, jz] of [[ix + 1, iz], [ix - 1, iz], [ix, iz + 1], [ix, iz - 1]]) {
          if (jx < ix0 || jx > ix1 || jz < iz0 || jz > iz1) continue;
          const j = jz * n1 + jx;
          if (data[j] <= h + step + 1e-6) continue;
          if (!this.hooks.canDig(s.x0 + jx * s.cell, s.z0 + jz * s.cell)) continue;
          const rec = this.rec(j);
          const to = Math.max(rec.h0 - MAX_DEPTH, h + step);
          if (to >= data[j] - 1e-6) continue;
          data[j] = to;
          rec.h1 = to;
          any = changed = true;
        }
      }
      if (!any) break;
    }
    return changed ? [s.x0 + ix0 * s.cell, s.z0 + iz0 * s.cell, s.x0 + ix1 * s.cell, s.z0 + iz1 * s.cell] : null;
  }

  /** Burns (`burnt`: ash black) or freezes (`frozen`: pale frost) the ground within `r` metres of (x, z). */
  scorch(x: number, z: number, r: number, kind: 'burnt' | 'frozen'): void {
    const { layers, tints } = this.field;
    const layer = kind === 'burnt' ? LAYER.dead : LAYER.snow;
    const col = kind === 'burnt' ? ASH : ICE;
    const R = r * 1.2;
    const box = this.each(x, z, R, (i, d) => {
      const rec = this.rec(i);
      const k = Math.min(1, 1.15 * (1 - (d / R) ** 2));
      const o = i * LAYER_COUNT;
      for (let j = 0; j < LAYER.wet; j++) layers[o + j] = Math.round(layers[o + j] * (1 - k) + (j === layer ? 255 : 0) * k);
      // Burnt ground reads darker still as wet ash (the ground shader darkens `wet`).
      if (kind === 'burnt') layers[o + LAYER.wet] = Math.max(layers[o + LAYER.wet], Math.round(230 * k));
      for (let c = 0; c < 3; c++) tints[i * 3 + c] = tints[i * 3 + c] * (1 - k * 0.95) + col[c] * k * 0.95;
      rec.l1.set(layers.subarray(o, o + LAYER_COUNT));
      rec.t1 = [tints[i * 3], tints[i * 3 + 1], tints[i * 3 + 2]];
    });
    if (box) this.hooks.refresh(...box, true);
  }

  /** Is the ground at (x, z) dug or scorched and not yet healed? */
  marked(x: number, z: number): boolean {
    const { s, n } = this.field;
    const ix = Math.round((x - s.x0) / s.cell), iz = Math.round((z - s.z0) / s.cell);
    if (ix < 0 || iz < 0 || ix > n || iz > n) return false;
    return this.recs.has(this.field.indexOf(ix, iz));
  }

  /** Heals: every edited vertex eases back to what it was over HEAL_S seconds from its last edit. */
  update(dt: number): void {
    if (!this.recs.size) return;
    this.now += dt;
    this.since += dt;
    if (this.since < 0.5) return;
    this.since = 0;
    const { data, layers, tints, s } = this.field;
    const n1 = this.field.n + 1;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    // Where ground finished healing this tick: its grass grows back even while other craters still heal.
    let hx0 = Infinity, hz0 = Infinity, hx1 = -Infinity, hz1 = -Infinity;
    for (const [i, r] of this.recs) {
      const u = Math.min(1, (this.now - r.at) / HEAL_S);
      const k = u * u * (3 - 2 * u);
      const o = i * LAYER_COUNT;
      if (u >= 1) {
        data[i] = r.h0;
        layers.set(r.l0, o);
        tints[i * 3] = r.t0[0]; tints[i * 3 + 1] = r.t0[1]; tints[i * 3 + 2] = r.t0[2];
        this.recs.delete(i);
        const hx = s.x0 + (i % n1) * s.cell, hz = s.z0 + Math.floor(i / n1) * s.cell;
        hx0 = Math.min(hx0, hx); hx1 = Math.max(hx1, hx); hz0 = Math.min(hz0, hz); hz1 = Math.max(hz1, hz);
      } else {
        data[i] = r.h1 + (r.h0 - r.h1) * k;
        for (let j = 0; j < LAYER_COUNT; j++) layers[o + j] = Math.round(r.l1[j] + (r.l0[j] - r.l1[j]) * k);
        for (let c = 0; c < 3; c++) tints[i * 3 + c] = r.t1[c] + (r.t0[c] - r.t1[c]) * k;
      }
      const x = s.x0 + (i % n1) * s.cell, z = s.z0 + Math.floor(i / n1) * s.cell;
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z);
    }
    if (x0 <= x1) this.hooks.refresh(x0, z0, x1, z1, this.recs.size === 0);
    if (this.recs.size > 0 && hx0 <= hx1) this.hooks.refresh(hx0, hz0, hx1, hz1, true);
  }

  /** The vertex's record, made on its first edit; an edit restarts its healing from where it is now. */
  private rec(i: number): Rec {
    const { data, layers, tints } = this.field;
    const o = i * LAYER_COUNT;
    let r = this.recs.get(i);
    if (!r) {
      const l = layers.slice(o, o + LAYER_COUNT);
      const t: [number, number, number] = [tints[i * 3], tints[i * 3 + 1], tints[i * 3 + 2]];
      r = { h0: data[i], l0: l, t0: t, h1: data[i], l1: l.slice(), t1: [...t], at: this.now };
      this.recs.set(i, r);
    } else {
      r.h1 = data[i];
      r.l1.set(layers.subarray(o, o + LAYER_COUNT));
      r.t1 = [tints[i * 3], tints[i * 3 + 1], tints[i * 3 + 2]];
      r.at = this.now;
    }
    return r;
  }

  /** Calls `fn(index, distance)` for every field vertex within `r` of (x, z); returns the box it covered. */
  private each(x: number, z: number, r: number, fn: (i: number, d: number) => void): [number, number, number, number] | null {
    const { s, n } = this.field;
    const ix0 = Math.max(0, Math.floor((x - r - s.x0) / s.cell)), ix1 = Math.min(n, Math.ceil((x + r - s.x0) / s.cell));
    const iz0 = Math.max(0, Math.floor((z - r - s.z0) / s.cell)), iz1 = Math.min(n, Math.ceil((z + r - s.z0) / s.cell));
    if (ix0 > ix1 || iz0 > iz1) return null;
    for (let iz = iz0; iz <= iz1; iz++) for (let ix = ix0; ix <= ix1; ix++) {
      const d = Math.hypot(s.x0 + ix * s.cell - x, s.z0 + iz * s.cell - z);
      if (d <= r) fn(this.field.indexOf(ix, iz), d);
    }
    return [s.x0 + ix0 * s.cell, s.z0 + iz0 * s.cell, s.x0 + ix1 * s.cell, s.z0 + iz1 * s.cell];
  }
}

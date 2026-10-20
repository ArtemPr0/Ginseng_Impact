/**
 * The ground as one heightfield system: a `Sculpt` (pure analytic height + layer weights) bakes into a `Heightfield`
 * (a regular grid of heights, 12 layer weights and a far tint per vertex), and `ChunkedGround` draws it as chunk
 * meshes that share one material and swap precomputed index buffers for level of detail. No material here: this
 * file is importable in node (vitest) and is the only ground code that constructs geometry (the procedural audit
 * allows everything under src/render/).
 *
 * Triangle split (the one PlaneGeometry uses, kept so `heightAt` is exactly the drawn surface): each cell
 * (ix, iz) is the two triangles (a, b, d) and (b, c, d) with a = (ix, iz), b = (ix, iz+1), c = (ix+1, iz+1),
 * d = (ix+1, iz), i.e. the diagonal runs from (ix, iz+1) to (ix+1, iz). In cell coordinates (u along x, v along z)
 * the lower triangle is u + v <= 1 and the upper one u + v >= 1.
 */
import { BufferAttribute, BufferGeometry, Color, Group, type Material, Mesh, Vector3 } from 'three';

/** The 12 ground layers: A = grass/moss/rock/soil, B = flagstone/cobble/snow/sand, C = dead/marble/seabed/wet. */
export const LAYER = { grass: 0, moss: 1, rock: 2, soil: 3, flagstone: 4, cobble: 5, snow: 6, sand: 7, dead: 8, marble: 9, seabed: 10, wet: 11 } as const;
export const LAYER_COUNT = 12;
/**
 * `wet` is a modifier (gloss, darker, half the roughness) laid over whichever texture layers are under it; the other
 * eleven are textures whose weights are normalised to sum to 1 (grass is the fallback when nothing is painted).
 */
export const TEXTURE_LAYERS = 11;

/**
 * The Floors.ts patterns were written for an unlit floor as screen values; the lit ground outputs linear albedo at
 * this factor of those values (the one knob for the lit-vs-unlit brightness shift; tune against the reel frames).
 */
export const GROUND_ALBEDO = 0.8;

/**
 * The average colour of each layer's pattern, in Floors space (before GROUND_ALBEDO), measured from the shader's own
 * patterns (GroundMaterial.ts ported to JS, 490 000 samples over a 360 m square; the snow's sparkle averaged over
 * camera positions). Two jobs, one table: the default far tint of a vertex is the weight-mixed average, so the ground
 * beyond the detail distance matches what is drawn up close; and up close the shader divides the pattern by the same
 * mix (splatAlbedo), so the layers lend the tint their pattern but never their hue. The shader's TINT_* constants are
 * generated from it. (wet has no colour of its own: it darkens the mix instead.)
 */
export const LAYER_TINT: ReadonlyArray<readonly [number, number, number]> = [
  [0.074, 0.167, 0.121], // grass
  [0.054, 0.132, 0.075], // moss
  [0.067, 0.075, 0.105], // rock
  [0.164, 0.15, 0.145], // soil
  [0.101, 0.097, 0.198], // flagstone (its violet crack glow included)
  [0.191, 0.246, 0.314], // cobble
  [0.332, 0.392, 0.551], // snow (its sparkle included)
  [0.504, 0.531, 0.635], // sand
  [0.352, 0.123, 0.211], // dead leaves
  [0.495, 0.495, 0.536], // marble
  [0.032, 0.082, 0.101], // seabed
  [0, 0, 0], // wet (modifier)
];
/** How much the wet modifier darkens the albedo: baked into every far tint, so it darkens the ground near and far. */
export const WET_DARKEN = 0.35;
/**
 * Up close the ground is its far tint times the layers' pattern over the pattern's mean (LAYER_TINT), per channel,
 * clamped to this range (splatAlbedo). The eleven patterns span 0.11 (cobble gaps) to 2.9 (snow sparkle) of their
 * means, so the clamp never cuts a pattern and the default tint stays the exact identity; it only bounds the division.
 */
export const PATTERN_RATIO: readonly [number, number] = [0.05, 4];

/** The threshold under which the shader skips a layer (and leaves it out of the mix and its mean). */
const SPLAT_MIN_WEIGHT = 0.02;

/**
 * The ground's albedo up close, in JS: what GroundMaterial's color_fragment computes, kept here for the tests (edit
 * the two together). `tint` is the vertex colour (the baked far tint, the wet modifier already in it), `weights` the
 * twelve layer weights as the shader reads them (0..1), `patterns` each texture layer's pattern colour at the point
 * (Floors space) and `detail` 1 up close fading to 0 at uDetailFar. Hue from the tint, pattern from the layers: the
 * tint times the weighted pattern over the weighted LAYER_TINT, so a sculpt that brings its own tint (the island's
 * cobalt night) keeps its hue and average brightness and only gains the pattern, while the default tint (the weighted
 * LAYER_TINT at GROUND_ALBEDO, wet-darkened) gives back the weighted pattern at GROUND_ALBEDO, wet-darkened.
 */
export function splatAlbedo(
  tint: ArrayLike<number>,
  weights: ArrayLike<number>,
  patterns: ReadonlyArray<ArrayLike<number>>,
  detail = 1,
  out: number[] = [0, 0, 0],
): number[] {
  let wsum = 0;
  const acc = [0, 0, 0];
  const mean = [0, 0, 0];
  for (let k = 0; k < TEXTURE_LAYERS; k++) {
    const w = weights[k];
    if (!(w > SPLAT_MIN_WEIGHT)) continue;
    for (let c = 0; c < 3; c++) {
      acc[c] += patterns[k][c] * w;
      mean[c] += LAYER_TINT[k][c] * w;
    }
    wsum += w;
  }
  if (wsum < SPLAT_MIN_WEIGHT) {
    // Nothing painted: grass.
    for (let c = 0; c < 3; c++) {
      acc[c] = patterns[LAYER.grass][c];
      mean[c] = LAYER_TINT[LAYER.grass][c];
    }
    wsum = 1;
  }
  for (let c = 0; c < 3; c++) {
    const ratio = acc[c] / wsum / Math.max(mean[c] / wsum, 1e-3);
    const clamped = Math.min(PATTERN_RATIO[1], Math.max(PATTERN_RATIO[0], ratio));
    out[c] = tint[c] * (1 + (clamped - 1) * detail);
  }
  return out;
}

/** A pure description of a square of ground: where it is, how fine its grid is, its height and its surface. */
export interface Sculpt {
  /** World x, z of the grid's corner (the field covers [x0, x0 + size] × [z0, z0 + size]). */
  x0: number;
  z0: number;
  /** Side length in metres. */
  size: number;
  /** Cell size in metres (the island 1 m, realms 1.5 m). */
  cell: number;
  /** Pure analytic height. */
  height(x: number, z: number): number;
  /** Writes the 12 layer weights (LAYER order) into `out` (zeroed before the call); `slope` is 0 flat .. 1 vertical. */
  layers(x: number, z: number, h: number, slope: number, out: Float32Array): void;
  /**
   * The ground's colour (linear albedo): its hue and average brightness near and far, the layers lending it only their
   * pattern up close (splatAlbedo); the wet modifier darkens it at bake. Without it the weight-mixed LAYER_TINT
   * average at GROUND_ALBEDO is used, and the layers' own colours show up close.
   */
  tint?(x: number, z: number, h: number, slope: number, out: Color): void;
  /** Chunks whose every vertex is below this height are not built (a realm is mostly void around its land). */
  voidBelow?: number;
}

/** Heights this far below the field's lowest edge are reported for points beyond the field (callers dispatch first). */
export const OUTSIDE_HEIGHT = -1e9;

const TMP_W = new Float32Array(LAYER_COUNT);
const TMP_C = new Color();

/** A baked sculpt: (n+1)² heights, row-major by z then x, with per-vertex layer weights and tints. */
export class Heightfield {
  /** Cells per side. */
  readonly n: number;
  /** Heights, (n+1)², row-major by z then x: `data[iz * (n + 1) + ix]`. */
  readonly data: Float32Array;
  /** Layer weights, (n+1)² × 12, 0..255: the eleven textures sum to 255, `wet` is its own 0..255. */
  readonly layers: Uint8Array;
  /** Far tints, (n+1)² × 3, linear albedo. */
  readonly tints: Float32Array;
  private baked = false;
  // Scratch for the triangle lookup (allocation-free queries).
  private lix = 0;
  private liz = 0;
  private lu = 0;
  private lv = 0;

  constructor(readonly s: Sculpt) {
    this.n = Math.max(1, Math.round(s.size / s.cell));
    const count = (this.n + 1) * (this.n + 1);
    this.data = new Float32Array(count);
    this.layers = new Uint8Array(count * LAYER_COUNT);
    this.tints = new Float32Array(count * 3);
  }

  /** Vertex index of grid column `ix`, row `iz`. */
  indexOf(ix: number, iz: number): number {
    return iz * (this.n + 1) + ix;
  }

  /** Whether (x, z) lies on the field (border included). */
  contains(x: number, z: number): boolean {
    const s = this.s;
    return x >= s.x0 && x <= s.x0 + s.size && z >= s.z0 && z <= s.z0 + s.size;
  }

  /** Has `bake()` run? */
  get isBaked(): boolean {
    return this.baked;
  }

  /**
   * Heights, then layers and tints, from the sculpt. The slope handed to `layers`/`tint` is the central-difference
   * gradient of the baked grid at the vertex (the mean of its surrounding triangles; `slopeAt` is triangle-exact).
   * Deterministic: the same sculpt always bakes the same buffers.
   */
  bake(): void {
    const { s, n, data } = this;
    const n1 = n + 1;
    for (let iz = 0; iz < n1; iz++) {
      const z = s.z0 + iz * s.cell;
      for (let ix = 0; ix < n1; ix++) data[iz * n1 + ix] = s.height(s.x0 + ix * s.cell, z);
    }
    const w = TMP_W;
    const c = TMP_C;
    const hasTint = typeof s.tint === 'function';
    for (let iz = 0; iz < n1; iz++) {
      const z = s.z0 + iz * s.cell;
      for (let ix = 0; ix < n1; ix++) {
        const i = iz * n1 + ix;
        const x = s.x0 + ix * s.cell;
        const h = data[i];
        const g = this.gradient(ix, iz);
        const slope = g / (1 + g);
        w.fill(0);
        s.layers(x, z, h, slope, w);
        let sum = 0;
        for (let k = 0; k < TEXTURE_LAYERS; k++) {
          if (!(w[k] > 0)) w[k] = 0;
          sum += w[k];
        }
        const wet = Math.min(1, Math.max(0, w[LAYER.wet] || 0));
        const o = i * LAYER_COUNT;
        if (sum <= 1e-6) {
          // Nothing painted: grass, so no vertex is ever black.
          w.fill(0);
          w[LAYER.grass] = 1;
          sum = 1;
        }
        for (let k = 0; k < TEXTURE_LAYERS; k++) {
          w[k] /= sum;
          this.layers[o + k] = Math.round(w[k] * 255);
        }
        this.layers[o + LAYER.wet] = Math.round(wet * 255);
        // Wet ground is darker whoever coloured it: the shader keeps the tint's brightness up close, so the wet
        // modifier lives here, in the tint, for the sculpt's own tint as for the default one.
        const dry = 1 - WET_DARKEN * wet;
        if (hasTint) {
          c.setRGB(0, 0, 0);
          s.tint!(x, z, h, slope, c);
          c.multiplyScalar(dry);
        } else {
          let r = 0, gg = 0, b = 0;
          for (let k = 0; k < TEXTURE_LAYERS; k++) {
            const t = LAYER_TINT[k];
            r += t[0] * w[k];
            gg += t[1] * w[k];
            b += t[2] * w[k];
          }
          const k = GROUND_ALBEDO * dry;
          c.setRGB(r * k, gg * k, b * k);
        }
        this.tints[i * 3] = c.r;
        this.tints[i * 3 + 1] = c.g;
        this.tints[i * 3 + 2] = c.b;
      }
    }
    this.baked = true;
  }

  /** |∇h| at a grid vertex by central differences (one-sided on the border). */
  private gradient(ix: number, iz: number): number {
    const { n, data, s } = this;
    const n1 = n + 1;
    const x0 = Math.max(0, ix - 1), x1 = Math.min(n, ix + 1);
    const z0 = Math.max(0, iz - 1), z1 = Math.min(n, iz + 1);
    const gx = (data[iz * n1 + x1] - data[iz * n1 + x0]) / ((x1 - x0) * s.cell);
    const gz = (data[z1 * n1 + ix] - data[z0 * n1 + ix]) / ((z1 - z0) * s.cell);
    return Math.hypot(gx, gz);
  }

  /**
   * Smooth vertex normal (central differences on the grid): continuous across chunk borders, unlike a per-chunk
   * computeVertexNormals, so chunk seams never show in the lighting.
   */
  vertexNormal(ix: number, iz: number, out: Vector3): Vector3 {
    const { n, data, s } = this;
    const n1 = n + 1;
    const x0 = Math.max(0, ix - 1), x1 = Math.min(n, ix + 1);
    const z0 = Math.max(0, iz - 1), z1 = Math.min(n, iz + 1);
    const gx = (data[iz * n1 + x1] - data[iz * n1 + x0]) / ((x1 - x0) * s.cell);
    const gz = (data[z1 * n1 + ix] - data[z0 * n1 + ix]) / ((z1 - z0) * s.cell);
    return out.set(-gx, 1, -gz).normalize();
  }

  /**
   * Finds the cell under (x, z). Points within one cell of the border are clamped onto the field; beyond that it
   * returns false. Leaves the cell and the point's position in it in the scratch fields.
   */
  private locate(x: number, z: number): boolean {
    const { s, n } = this;
    let fx = (x - s.x0) / s.cell;
    let fz = (z - s.z0) / s.cell;
    if (!(fx >= -1 && fx <= n + 1 && fz >= -1 && fz <= n + 1)) return false;
    fx = Math.min(n, Math.max(0, fx));
    fz = Math.min(n, Math.max(0, fz));
    const ix = Math.min(n - 1, Math.floor(fx));
    const iz = Math.min(n - 1, Math.floor(fz));
    this.lix = ix;
    this.liz = iz;
    this.lu = fx - ix;
    this.lv = fz - iz;
    return true;
  }

  /**
   * EXACTLY the height of the drawn surface at (x, z): barycentric on the triangle of the cell the point is in (the
   * split documented at the top). Within one cell of the border the point is clamped onto the field; further out
   * returns OUTSIDE_HEIGHT (finite, never NaN).
   */
  heightAt(x: number, z: number): number {
    if (!this.locate(x, z)) return OUTSIDE_HEIGHT;
    const n1 = this.n + 1;
    const { lix: ix, liz: iz, lu: u, lv: v, data } = this;
    const a = data[iz * n1 + ix];
    const b = data[(iz + 1) * n1 + ix];
    const c = data[(iz + 1) * n1 + ix + 1];
    const d = data[iz * n1 + ix + 1];
    if (u + v <= 1) return a + (d - a) * u + (b - a) * v;
    return c + (b - c) * (1 - u) + (d - c) * (1 - v);
  }

  /**
   * The face normal of the triangle under (x, z): flat-shading-exact, the plane `heightAt` interpolates on (not the
   * smooth vertex normal the mesh is lit with). Straight up beyond the field.
   */
  normalAt(x: number, z: number, out: Vector3): Vector3 {
    if (!this.locate(x, z)) return out.set(0, 1, 0);
    const n1 = this.n + 1;
    const { lix: ix, liz: iz, lu: u, lv: v, data } = this;
    const cell = this.s.cell;
    const a = data[iz * n1 + ix];
    const b = data[(iz + 1) * n1 + ix];
    const c = data[(iz + 1) * n1 + ix + 1];
    const d = data[iz * n1 + ix + 1];
    let gx: number, gz: number;
    if (u + v <= 1) {
      gx = (d - a) / cell;
      gz = (b - a) / cell;
    } else {
      gx = (c - b) / cell;
      gz = (c - d) / cell;
    }
    return out.set(-gx, 1, -gz).normalize();
  }

  /** 0 = flat, 1 = vertical: |∇h| / (1 + |∇h|) of the triangle under (x, z) (Terrain.slopeAt's mapping). */
  slopeAt(x: number, z: number): number {
    if (!this.locate(x, z)) return 0;
    const n1 = this.n + 1;
    const { lix: ix, liz: iz, lu: u, lv: v, data } = this;
    const cell = this.s.cell;
    const a = data[iz * n1 + ix];
    const b = data[(iz + 1) * n1 + ix];
    const c = data[(iz + 1) * n1 + ix + 1];
    const d = data[iz * n1 + ix + 1];
    const g = u + v <= 1 ? Math.hypot((d - a) / cell, (b - a) / cell) : Math.hypot((c - b) / cell, (c - d) / cell);
    return g / (1 + g);
  }
}

export interface GroundOptions {
  /** Chunk side in metres (default 32). */
  chunk?: number;
  /** LOD distances in metres (default [64, 160]): full resolution under lod[0], 2-cell steps to lod[1], 4-cell beyond. */
  lod?: [number, number];
  /** Skirt depth in metres around every chunk (default 1.5), so a LOD seam never shows a crack. */
  skirt?: number;
  /** Chunks within lod[0] cast shadows (default true). */
  castShadowNear?: boolean;
}

const LOD_STEPS = [1, 2, 4] as const;

interface Chunk {
  mesh: Mesh;
  geo: BufferGeometry;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  indices: [BufferAttribute, BufferAttribute, BufferAttribute];
  lod: number;
}

const TMP_N = new Vector3();
const TMP_E1 = new Vector3();
const TMP_E2 = new Vector3();

/**
 * The field as chunk meshes under one material. Each chunk is ONE BufferGeometry with full-resolution position,
 * normal, color, layerA/B/C attributes and three precomputed index buffers (1-, 2- and 4-cell steps, each with a
 * skirt ring dropped by `skirt` metres); `update(focus)` only swaps `setIndex` by distance and toggles castShadow on
 * the near chunks. Frustum culling stays on. Chunks entirely below `sculpt.voidBelow` are never built.
 */
export class ChunkedGround {
  readonly group = new Group();
  private readonly chunks: Chunk[] = [];
  private readonly lod: [number, number];
  private readonly castNear: boolean;

  constructor(readonly field: Heightfield, material: Material, opts: GroundOptions = {}) {
    const s = field.s;
    const chunkM = opts.chunk ?? 32;
    const skirt = opts.skirt ?? 1.5;
    this.lod = opts.lod ?? [64, 160];
    this.castNear = opts.castShadowNear ?? true;
    this.group.name = 'ground';
    if (!field.isBaked) field.bake();
    const cc = Math.max(1, Math.round(chunkM / s.cell));
    const n = field.n;
    for (let cz = 0; cz < n; cz += cc) {
      for (let cx = 0; cx < n; cx += cc) {
        const w = Math.min(cc, n - cx);
        const d = Math.min(cc, n - cz);
        const chunk = this.buildChunk(cx, cz, w, d, skirt, material);
        if (chunk) {
          this.chunks.push(chunk);
          this.group.add(chunk.mesh);
        }
      }
    }
  }

  /** Built chunks only (void chunks are skipped). */
  get chunkCount(): number {
    return this.chunks.length;
  }

  private buildChunk(cx: number, cz: number, w: number, d: number, skirt: number, material: Material): Chunk | null {
    const field = this.field;
    const { s, n, data, layers, tints } = field;
    const n1 = n + 1;
    // Void test: every vertex below voidBelow → not built.
    if (s.voidBelow !== undefined) {
      let top = -Infinity;
      for (let k = 0; k <= d; k++) for (let i = 0; i <= w; i++) top = Math.max(top, data[(cz + k) * n1 + cx + i]);
      if (top < s.voidBelow) return null;
    }
    const w1 = w + 1, d1 = d + 1;
    const gridCount = w1 * d1;
    // Skirt vertices: one dropped copy of every boundary vertex (south, north, west, east rings).
    const S0 = gridCount, S1 = S0 + w1, S2 = S1 + w1, S3 = S2 + d1;
    const count = S3 + d1;
    const pos = new Float32Array(count * 3);
    const nor = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const la = new Uint8Array(count * 4);
    const lb = new Uint8Array(count * 4);
    const lc = new Uint8Array(count * 4);
    const put = (v: number, ix: number, iz: number, drop: number) => {
      const fi = iz * n1 + ix;
      pos[v * 3] = s.x0 + ix * s.cell;
      pos[v * 3 + 1] = data[fi] - drop;
      pos[v * 3 + 2] = s.z0 + iz * s.cell;
      field.vertexNormal(ix, iz, TMP_N);
      nor[v * 3] = TMP_N.x;
      nor[v * 3 + 1] = TMP_N.y;
      nor[v * 3 + 2] = TMP_N.z;
      col[v * 3] = tints[fi * 3];
      col[v * 3 + 1] = tints[fi * 3 + 1];
      col[v * 3 + 2] = tints[fi * 3 + 2];
      const o = fi * LAYER_COUNT;
      for (let k = 0; k < 4; k++) {
        la[v * 4 + k] = layers[o + k];
        lb[v * 4 + k] = layers[o + 4 + k];
        lc[v * 4 + k] = layers[o + 8 + k];
      }
    };
    for (let k = 0; k < d1; k++) for (let i = 0; i < w1; i++) put(k * w1 + i, cx + i, cz + k, 0);
    for (let i = 0; i < w1; i++) {
      put(S0 + i, cx + i, cz, skirt);
      put(S1 + i, cx + i, cz + d, skirt);
    }
    for (let k = 0; k < d1; k++) {
      put(S2 + k, cx, cz + k, skirt);
      put(S3 + k, cx + w, cz + k, skirt);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(pos, 3));
    geo.setAttribute('normal', new BufferAttribute(nor, 3));
    geo.setAttribute('color', new BufferAttribute(col, 3));
    geo.setAttribute('layerA', new BufferAttribute(la, 4, true));
    geo.setAttribute('layerB', new BufferAttribute(lb, 4, true));
    geo.setAttribute('layerC', new BufferAttribute(lc, 4, true));
    const g = (i: number, k: number) => k * w1 + i;
    const indices = LOD_STEPS.map((step) => {
      const idx: number[] = [];
      // Interior: the (a, b, d) / (b, c, d) split of every (possibly step-sized, clamped at the edge) cell.
      for (let k = 0; k < d; k += step) {
        const k1 = Math.min(k + step, d);
        for (let i = 0; i < w; i += step) {
          const i1 = Math.min(i + step, w);
          const a = g(i, k), b = g(i, k1), c = g(i1, k1), dd = g(i1, k);
          idx.push(a, b, dd, b, c, dd);
        }
      }
      // Skirts: a quad from each boundary edge down to its dropped copy, wound to face outward.
      const quad = (ti: number, tj: number, bj: number, bi: number, ox: number, oz: number) => {
        TMP_E1.set(pos[tj * 3] - pos[ti * 3], pos[tj * 3 + 1] - pos[ti * 3 + 1], pos[tj * 3 + 2] - pos[ti * 3 + 2]);
        TMP_E2.set(pos[bj * 3] - pos[ti * 3], pos[bj * 3 + 1] - pos[ti * 3 + 1], pos[bj * 3 + 2] - pos[ti * 3 + 2]);
        TMP_N.crossVectors(TMP_E1, TMP_E2);
        if (TMP_N.x * ox + TMP_N.z * oz >= 0) idx.push(ti, tj, bj, ti, bj, bi);
        else idx.push(ti, bj, tj, ti, bi, bj);
      };
      for (let i = 0; i < w; i += step) {
        const i1 = Math.min(i + step, w);
        quad(g(i, 0), g(i1, 0), S0 + i1, S0 + i, 0, -1);
        quad(g(i, d), g(i1, d), S1 + i1, S1 + i, 0, 1);
      }
      for (let k = 0; k < d; k += step) {
        const k1 = Math.min(k + step, d);
        quad(g(0, k), g(0, k1), S2 + k1, S2 + k, -1, 0);
        quad(g(w, k), g(w, k1), S3 + k1, S3 + k, 1, 0);
      }
      return new BufferAttribute(count > 65535 ? new Uint32Array(idx) : new Uint16Array(idx), 1);
    }) as [BufferAttribute, BufferAttribute, BufferAttribute];
    geo.setIndex(indices[0]);
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    const mesh = new Mesh(geo, material);
    mesh.name = `ground:${cx},${cz}`;
    mesh.receiveShadow = true;
    mesh.castShadow = this.castNear;
    // Static, at the origin (vertices are in world space): no per-frame matrix work.
    mesh.matrixAutoUpdate = false;
    return {
      mesh, geo, indices, lod: 0,
      x0: s.x0 + cx * s.cell, z0: s.z0 + cz * s.cell, x1: s.x0 + (cx + w) * s.cell, z1: s.z0 + (cz + d) * s.cell,
    };
  }

  /** Picks each chunk's LOD by its distance from `focus` (the hero / camera): swaps the index set and castShadow only when it changes. */
  update(focus: Vector3): void {
    const near = this.lod[0], far = this.lod[1];
    for (const c of this.chunks) {
      const dx = Math.max(c.x0 - focus.x, 0, focus.x - c.x1);
      const dz = Math.max(c.z0 - focus.z, 0, focus.z - c.z1);
      const dist = Math.hypot(dx, dz);
      const lod = dist < near ? 0 : dist < far ? 1 : 2;
      if (lod === c.lod) continue;
      c.lod = lod;
      c.geo.setIndex(c.indices[lod]);
      c.mesh.castShadow = this.castNear && lod === 0;
    }
  }

  dispose(): void {
    for (const c of this.chunks) {
      this.group.remove(c.mesh);
      c.geo.dispose();
    }
    this.chunks.length = 0;
  }
}

import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { Heightfield, LAYER, LAYER_COUNT, TEXTURE_LAYERS } from '../render/Ground';
import { gridFootprint } from '../world/Colliders';
import { Noise2D, smoothstep } from '../world/noise';
import { ENEMY_SPAWNS } from './enemies';
import {
  ABYSS_Y, CHAPEL_Y, CROWNED_HEAD, CUPS, CUP_R, DOCK, FREEBOARD, MOAT_BED, MOAT_BED_RECT, MOAT_LEVEL, PLOT_PADS, PLOT_Y, REALM_CELL,
  REALM_SCULPTS, SEABED_FALL, SNOW_FLATS, VALE_DOME, VALE_HEAD_PATH, VALE_HEAD_SEAT, VALE_HEAD_Y, VALE_PATH, VALE_PATH_GRADE, VALE_RIVER,
  hillHeight, landDistance, landMask, onGrid, padMask, padY, realmField, realmHeight, realmLayers, realmTint, sculptFor, sdRect,
  sdSeg, sdShape, snowY, type Pad, type RealmSculpt,
} from './sculpts';
import { ANCHORS, GALAXY, GRAVEYARD, LEAN_QUARTER, REALMS, SUNKEN, VALE } from './world';

const noise = new Noise2D(1337);
const SCULPTS: readonly RealmSculpt[] = Object.values(REALM_SCULPTS);
const realmDef = (s: RealmSculpt) => REALMS.find((r) => r.id === s.id)!;
const h = (s: RealmSculpt, x: number, z: number) => realmHeight(s, x, z, noise);
/** The realm-wide scans (a distance transform over a whole field, 200 segments, a baked field) take a second or two; this is headroom for a heavily loaded machine. */
const SCAN_TIMEOUT = 120_000;

/** Each realm baked once, as the game draws it (render/Ground.ts Heightfield: heightAt is exactly the drawn surface). */
const BAKED = new Map<RealmSculpt, Heightfield>();
function drawn(s: RealmSculpt): Heightfield {
  let f = BAKED.get(s);
  if (!f) {
    f = new Heightfield(sculptFor(s, noise));
    f.bake();
    BAKED.set(s, f);
  }
  return f;
}

/** The floater whose disc holds (x, z), if any (things standing there stand on its own collider, over the void). */
const floaterAt = (s: RealmSculpt, x: number, z: number) => (s.clear ?? []).find((f) => Math.hypot(x - f.disc.x, z - f.disc.z) < f.disc.r);

/**
 * The alley of graves' 12 dead trees where the builders put them in the game (World.ts builds every realm on one
 * rng(5150) stream, the graveyard last): x, z and the y Graveyard.ts stands them at (y0 + 0.6 for |x| < 16, else y0).
 * Any change to a builder before it moves them, so step 7 sends every one through h().
 */
const GRAVE_TREES: ReadonlyArray<readonly [number, number, number]> = [
  [-14.34, -925.05, 0.6], [17.06, -939.05, 0], [-19.44, -949.24, 0], [15.77, -959.04, 0.6], [-19.0, -970.53, 0], [16.29, -982.46, 0],
  [-18.19, -994.01, 0], [19.35, -1003.61, 0], [-14.08, -1013.12, 0.6], [19.61, -1024.69, 0], [-19.34, -1038.58, 0], [16.02, -1049.33, 0],
];

/** Deterministic pseudo-random numbers in [0, 1). */
function rng(seed: number): () => number {
  let v = seed >>> 0;
  return () => {
    v = (Math.imul(v, 1664525) + 1013904223) >>> 0;
    return v / 4294967296;
  };
}

/** A pad's middle and `n` points evenly round its outline (rect, disc or capsule). */
function padSamples(p: Pad, n = 16): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  if (p.rect) {
    const [x0, x1, z0, z1] = p.rect;
    pts.push([(x0 + x1) / 2, (z0 + z1) / 2]);
    const w = x1 - x0, d = z1 - z0, per = 2 * (w + d);
    for (let i = 0; i < n; i++) {
      let s = (i / n) * per;
      if (s < w) pts.push([x0 + s, z0]);
      else if ((s -= w) < d) pts.push([x1, z0 + s]);
      else if ((s -= d) < w) pts.push([x1 - s, z1]);
      else pts.push([x0, z1 - (s - w)]);
    }
  }
  if (p.disc) {
    const c = p.disc;
    pts.push([c.x, c.z]);
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push([c.x + Math.cos(a) * c.r, c.z + Math.sin(a) * c.r]); }
  }
  if (p.seg) {
    const g = p.seg;
    const L = Math.hypot(g.bx - g.ax, g.bz - g.az), ux = (g.bx - g.ax) / L, uz = (g.bz - g.az) / L, nx = -uz, nz = ux;
    pts.push([(g.ax + g.bx) / 2, (g.az + g.bz) / 2]);
    const per = 2 * L + 2 * Math.PI * g.r;
    for (let i = 0; i < n; i++) {
      let s = (i / n) * per;
      if (s < L) pts.push([g.ax + ux * s + nx * g.r, g.az + uz * s + nz * g.r]);
      else if ((s -= L) < Math.PI * g.r) { const a = s / g.r; pts.push([g.bx + (nx * Math.cos(a) + ux * Math.sin(a)) * g.r, g.bz + (nz * Math.cos(a) + uz * Math.sin(a)) * g.r]); }
      else if ((s -= Math.PI * g.r) < L) pts.push([g.bx - ux * s - nx * g.r, g.bz - uz * s - nz * g.r]);
      else { const a = (s - L) / g.r; pts.push([g.ax + (-nx * Math.cos(a) - ux * Math.sin(a)) * g.r, g.az + (-nz * Math.cos(a) - uz * Math.sin(a)) * g.r]); }
    }
  }
  return pts;
}

/** Inside (or within `pad` metres of) one of the realm's water rects. */
const nearWater = (s: RealmSculpt, x: number, z: number, pad = 0.3) => (s.water ?? []).some((w) => sdRect(x, z, w.rect) < pad);

/** Squared 1-D distance transform (Felzenszwalb & Huttenlocher) of `f` into `d`. */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, zz: Float64Array): void {
  let k = 0;
  v[0] = 0; zz[0] = -Infinity; zz[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
    while (s <= zz[k]) { k--; s = (f[q] + q * q - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
    k++; v[k] = q; zz[k] = s; zz[k + 1] = Infinity;
  }
  k = 0;
  for (let q = 0; q < n; q++) { while (zz[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
}

/** Every grid point of the realm's field (at `step` m) with its distance in metres to the nearest land (landMask > 0) point. */
function distanceToLand(s: RealmSculpt, step: number): Array<{ x: number; z: number; d: number }> {
  const f = realmField(s);
  const n = Math.floor(f.size / step) + 1;
  const BIG = 1e20;
  const grid = new Float64Array(n * n);
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) grid[iz * n + ix] = landDistance(s, f.x0 + ix * step, f.z0 + iz * step, noise) < 0 ? 0 : BIG;
  const col = new Float64Array(n), out = new Float64Array(n), v = new Int32Array(n), zz = new Float64Array(n + 1);
  for (let ix = 0; ix < n; ix++) {
    for (let iz = 0; iz < n; iz++) col[iz] = grid[iz * n + ix];
    edt1d(col, n, out, v, zz);
    for (let iz = 0; iz < n; iz++) grid[iz * n + ix] = out[iz];
  }
  for (let iz = 0; iz < n; iz++) {
    edt1d(grid.subarray(iz * n, iz * n + n), n, out, v, zz);
    grid.set(out, iz * n);
  }
  const pts: Array<{ x: number; z: number; d: number }> = [];
  for (let iz = 0; iz < n; iz++) for (let ix = 0; ix < n; ix++) pts.push({ x: f.x0 + ix * step, z: f.z0 + iz * step, d: Math.sqrt(grid[iz * n + ix]) * step });
  return pts;
}

/** Random points on the realm's land (landMask > 0) inside its field. */
function landPoints(s: RealmSculpt, count: number, seed: number): Array<[number, number]> {
  const f = realmField(s);
  const r = rng(seed);
  const pts: Array<[number, number]> = [];
  for (let i = 0; pts.length < count && i < count * 400; i++) {
    const x = f.x0 + r() * f.size, z = f.z0 + r() * f.size;
    if (landMask(s, x, z, noise) > 0) pts.push([x, z]);
  }
  return pts;
}

/** The slope Heightfield.bake hands the layers: |∇h| / (1 + |∇h|) by central differences over one cell. */
function slopeAt(s: RealmSculpt, x: number, z: number): number {
  const e = REALM_CELL;
  const g = Math.hypot((h(s, x + e, z) - h(s, x - e, z)) / (2 * e), (h(s, x, z + e) - h(s, x, z - e)) / (2 * e));
  return g / (1 + g);
}

describe('realm sculpts: pads keep their height', () => {
  for (const s of SCULPTS) {
    it(`${s.id}: every pad's middle and 16 points round its outline stand at the pad's height`, () => {
      const bad: string[] = [];
      s.pads.forEach((p, i) => {
        let checked = 0;
        for (const [x, z] of padSamples(p)) {
          const want = padY(p, x, z);
          // A later pad of a different height there owns the point (pads override in order); so does water cut deeper.
          if (s.pads.some((q, j) => j > i && sdShape(x, z, q) < q.blend && Math.abs(padY(q, x, z) - want) > 1e-6)) continue;
          if ((s.water ?? []).some((w) => sdRect(x, z, w.rect) < 0.3 && Math.abs(w.bed - want) > 1e-6)) continue;
          checked++;
          const got = h(s, x, z);
          if (!(Math.abs(got - want) < 0.02)) bad.push(`${p.name} at (${x.toFixed(1)}, ${z.toFixed(1)}): ${got.toFixed(3)} for ${want.toFixed(3)}`);
        }
        if (checked < 9) bad.push(`${p.name}: only ${checked} of 17 points checked`);
      });
      expect(bad, bad.join('\n')).toEqual([]);
    });
  }

  it('the kingdom: its floors at 24, the moat bed at 21.8, the snow quarter climbing to the chapel at 27', () => {
    const g = REALM_SCULPTS.galaxy;
    expect(h(g, 1000, 0)).toBeCloseTo(GALAXY.y, 6);
    expect(h(g, 1000, -135)).toBeCloseTo(GALAXY.y, 6);
    expect(h(g, 884, 17)).toBeCloseTo(GALAXY.y, 6);
    expect(h(g, 798, 18)).toBeCloseTo(GALAXY.y, 6);
    expect(h(g, 822, 0)).toBeCloseTo(MOAT_BED, 6);
    expect(h(g, LEAN_QUARTER.chapel.x, LEAN_QUARTER.chapel.z)).toBeCloseTo(CHAPEL_Y, 6);
    expect(snowY(LEAN_QUARTER.chapel.z)).toBeCloseTo(CHAPEL_Y, 6);
    for (const f of SNOW_FLATS) expect(h(g, f.x, f.z), f.name).toBeCloseTo(f.y, 6);
    // The snow gate stays on the floor's own level; the cottages and the plague doctor ride the slope (the plan's h() sweep).
    expect(SNOW_FLATS.find((f) => f.name === 'snow-gate')!.y).toBe(GALAXY.y);
    for (const f of SNOW_FLATS) if (f.name !== 'snow-gate') expect(f.y, f.name).toBeCloseTo(snowY(f.z), 9);
    // The moat's bed holds Q.moat less a cell all round, on the grid (its walls rise over the last cell inside the sheet).
    expect(MOAT_BED_RECT).toEqual([817.5, 826.5, -37.5, 73.5]);
    // The sky dock floats over the void like the cups: no ground under its island, let alone its floor.
    expect(h(g, LEAN_QUARTER.dock.x, LEAN_QUARTER.dock.z)).toBe(ABYSS_Y);
    expect(DOCK.below).toBeLessThan(GALAXY.y - 20);
  });

  it('no placement the builders stand at a fixed height moves', () => {
    const gy = GALAXY.y, vy = VALE.y, sy = SUNKEN.y, y0 = GRAVEYARD.y;
    // [x, z, y, what] — read off LeanQuarter.ts, Kingdom.ts, Realms.ts, Vale.ts, Sunken.ts, Graveyard.ts.
    const spots: Record<RealmSculpt['id'], Array<[number, number, number, string]>> = {
      galaxy: [
        [1000, -172, gy, 'dragon throne'], [992.5, -166, gy, 'throne brazier'], [962, -108, gy, 'dragon fountain'], [1038, -138, gy, 'dragon fountain'],
        [982, -126, gy, 'lean fountain'], [1018, -126, gy, 'lean fountain'], [989, -156, gy, 'court torch'], [1011, -96, gy, 'court torch'],
        [956, -176, gy, 'stone throne'], [950, -168, gy, 'coin block'], [1043, -160, gy, 'pavilion'], [1030, -134, gy, 'bottle table'],
        [1036, -150, gy, 'court barrel'], [924, 4, gy, 'purple house'], [852, 32, gy, 'purple house'], [915, 8.6, gy, 'stall'],
        [879, 27.4, gy, 'stall'], [872, -26, gy, 'round tower'], [800, 18, gy, 'castle'], [829.4, 14, gy, 'moat torch'],
        [829.4, 22, gy, 'moat torch'], [814.8, 14, gy, 'moat torch'], [814.8, 22, gy, 'moat torch'], [783, -38, gy, 'yard crystal'],
        [813, 72, gy, 'yard crystal'], [1000, 69, gy, 'checker road'], [989, 52, gy, 'causeway tower'], [1011, -14, gy, 'causeway tower'],
        [1000, 72, gy, 'ring portal'], [988, 70, gy, 'ring portal'], [1000, -66, gy, 'galaxy hall'], [1000, -75, gy, 'marble throne'],
        [1035, -55, gy, 'lean-chucker pavilion'], [1027, 66, gy, 'tea stream end'], [1057, 10, gy, 'first lean wave'],
        [946.5, 86, gy, 'snow gate pillar'], [953.5, 86, gy, 'snow gate pillar'], [955.6, 87.8, gy, 'broken gate'],
      ],
      vale: [
        [1024, 976, vy, 'tavern'], [1015, 973, vy, 'yard table'], [1015, 978.4, vy, 'yard table'], [1019, 966, vy, 'campfire'],
        [1010, 982, vy, 'barrel'], [1020, 984, vy, 'barrel'], [989, 992, vy, 'house'], [987.8, 980, vy, 'house'], [1011, 956, vy, 'house'],
        [1012.2, 920, vy, 'house'], [984.7, 916.7, vy, 'house corner'], [1015.5, 923.3, vy, 'house corner'], [993.6, 988, vy, 'lantern'],
        [1006.4, 912, vy, 'lantern'], [1006.8, 941.4, vy, 'stall'], [993.2, 930, vy, 'stall'], [1000, 892, vy, 'green dragon'],
        [988, 881, vy, 'dragon flank'], [1012, 903, vy, 'dragon flank'], [995, 904.72, vy, 'reader'], [961.5, 937, vy, 'bridge brazier'],
        [961.5, 943, vy, 'bridge brazier'], [948.5, 937, vy, 'bridge brazier'], [948.5, 943, vy, 'bridge brazier'], [1000, 1014, vy, 'way home'],
        [997.6, 1014, vy, 'arch lantern'], [1002.4, 1014, vy, 'arch lantern'], [1000, 1006, vy, 'arrival'],
      ],
      sunken: [
        [-1000, -80, sy, 'sea castle'], [-1018, -98, sy, 'sea castle corner'], [-982, -62, sy, 'sea castle corner'], [-1000, -70.3, sy, 'coral throne'],
        [-1000, -66.2, sy, 'counter'], [-1005, -67.5, sy, 'bottle shelf'], [-1007.2, -56, sy, 'goblet table'], [-995.4, -63.4, sy, 'coin table'],
        [-1010.6, -57.6, sy, 'barrel'], [-996.4, -59.6, sy, 'orb lamp'], [-1014, -58.5, sy, 'green door'], [-1000, 64, sy, 'bubble column'],
        [-1010.5, 12, sy, 'house'], [-988.7, -38, sy, 'house'], [-1004.8, 0, sy, 'stall'], [-1036, 20, sy, 'kelp'], [-964, 68, sy, 'kelp'],
      ],
      graveyard: [
        [2.78, -917, y0, "wall's alley face"], [-2.78, -1044, y0, "wall's alley face"], [2.2, -980, y0, 'shrine brazier'], [0, -980, y0, 'candles'], [0, -1015, y0, 'toadstool'],
        [0, -1045, y0, 'ring portal'], [0, -1095, y0, 'gothic tower (sunk 0.5 m on purpose)'], [14, -1088, y0, 'round tower'], [-10, -1078, y0, 'arena brazier'],
        [0, -909, y0, 'way home'], [0, -1068, y0, 'cyclops lord'], [5.0, -919, PLOT_Y, 'grave'], [12.6, -1043.6, PLOT_Y, 'grave'], [-8.8, -980, PLOT_Y, 'grave'],
        [-5.0, -1042.8, PLOT_Y, 'grave'], [12.6, -918.7, PLOT_Y, 'grave'], [-12.6, -1042.8, PLOT_Y, 'grave'],
        // The trees off the plots' rises (the three on them are the alley test's: they go through h()).
        ...GRAVE_TREES.filter(([x]) => Math.abs(x) <= 15 || Math.abs(x) >= 16.5).map(([x, z, y]): [number, number, number, string] => [x, z, y, 'dead tree']),
      ],
    };
    for (const s of SCULPTS) {
      const bad = spots[s.id].filter(([x, z, y]) => !(Math.abs(h(s, x, z) - y) < 0.02)).map(([x, z, y, what]) => `${what} (${x}, ${z}): ${h(s, x, z).toFixed(3)} for ${y}`);
      expect(bad, `${s.id}:\n${bad.join('\n')}`).toEqual([]);
    }
  });
});

describe('realm sculpts: the land', () => {
  for (const s of SCULPTS) {
    it(`${s.id}: every ANCHORS entry inside the realm is on land and on a pad, but for those on a floater over the void`, () => {
      const R = realmDef(s);
      const bad: string[] = [];
      let n = 0;
      for (const [id, a] of Object.entries(ANCHORS)) {
        if (Math.hypot(a.x - R.x, a.z - R.z) > R.radius) continue;
        n++;
        const f = floaterAt(s, a.x, a.z);
        if (f) {
          // On the floater's own collider (the sky dock's Old Ribs and Sir Velvet): the ground stays far below its foot.
          const got = h(s, a.x, a.z);
          if (!(got < f.below - 0.25)) bad.push(`${id} (${a.x}, ${a.z}) on ${f.name}: ground ${got.toFixed(2)} under its foot at ${f.below.toFixed(2)}`);
          continue;
        }
        const land = landMask(s, a.x, a.z, noise), pad = padMask(s, a.x, a.z).mask;
        if (!(land > 0.99) || !(pad >= 0.99)) bad.push(`${id} (${a.x}, ${a.z}): land ${land.toFixed(3)}, pad ${pad.toFixed(3)}`);
      }
      expect(bad, `${s.id} anchors off the land or a pad:\n${bad.join('\n')}`).toEqual([]);
      if (s.id !== 'graveyard') expect(n).toBeGreaterThan(0);
    });

    it(`${s.id}: every enemy spawn in the realm is on land (exact ones on a pad), but for the lean bubbles in the floating cups`, () => {
      const R = realmDef(s);
      const bad: string[] = [];
      for (const sp of ENEMY_SPAWNS) {
        if (Math.hypot(sp.x - R.x, sp.z - R.z) > R.radius) continue;
        const f = floaterAt(s, sp.x, sp.z);
        if (f) {
          // Over the void in a cup: the ground must stay far below it.
          if (!(h(s, sp.x, sp.z) < f.below - 0.25)) bad.push(`${sp.kind} (${sp.x}, ${sp.z}) has ground under its ${f.name}`);
          continue;
        }
        const land = landMask(s, sp.x, sp.z, noise);
        if (!(land > 0.99)) bad.push(`${sp.kind} (${sp.x}, ${sp.z}): land ${land.toFixed(3)}`);
        if (sp.exact && !(padMask(s, sp.x, sp.z).mask >= 0.99)) bad.push(`${sp.kind} (${sp.x}, ${sp.z}) is exact but off the pads`);
      }
      expect(bad, bad.join('\n')).toEqual([]);
    });

    it(`${s.id}: what floats over the void stays clear of the ground`, () => {
      const bad: string[] = [];
      for (const f of s.clear ?? []) {
        for (let ri = 0; ri <= 4; ri++) for (let ai = 0; ai < 24; ai++) {
          const r = (ri / 4) * f.disc.r, a = (ai / 24) * Math.PI * 2;
          const x = f.disc.x + Math.cos(a) * r, z = f.disc.z + Math.sin(a) * r;
          const got = h(s, x, z);
          if (!(got < f.below - 0.25)) bad.push(`${f.name} at (${x.toFixed(1)}, ${z.toFixed(1)}): ground ${got.toFixed(2)} under its foot at ${f.below.toFixed(2)}`);
        }
      }
      expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
    });
  }

  it('the kingdom: the lean waves to the cups and the dock arch clear of the ground', () => {
    // Kingdom.ts leanWave: from the plaza's edge into the first cup, cup to cup, the last cup to the dock; each end comes
    // down WAVE_INSIDE inside a rim; the deck rises sin(πs) × 4.2 over gy, 3.8 m wide.
    const g = REALM_SCULPTS.galaxy, gy = GALAXY.y, inside = 2.6;
    const into = (i: number, fx: number, fz: number) => { const [x, z] = CUPS[i]; const d = Math.hypot(fx - x, fz - z); const k = (CUP_R - inside) / d; return [x + (fx - x) * k, z + (fz - z) * k] as const; };
    const waves: Array<readonly [number, number, number, number]> = [[1057, 10, ...into(0, 1057, 10)]];
    for (let i = 0; i < CUPS.length - 1; i++) waves.push([...into(i, CUPS[i + 1][0], CUPS[i + 1][1]), ...into(i + 1, CUPS[i][0], CUPS[i][1])]);
    {
      const D = LEAN_QUARTER.dock;
      const [ax, az] = into(CUPS.length - 1, D.x, D.z);
      const d = Math.hypot(ax - D.x, az - D.z);
      waves.push([ax, az, D.x + ((ax - D.x) / d) * (D.r - 2), D.z + ((az - D.z) / d) * (D.r - 2)]);
    }
    const bad: string[] = [];
    for (const [ax, az, bx, bz] of waves) {
      const L = Math.hypot(bx - ax, bz - az), sx = -(bz - az) / L, sz = (bx - ax) / L;
      for (let k = 0; k <= 100; k++) {
        const s = k / 100, deck = gy + Math.sin(Math.PI * s) * 4.2;
        for (const across of [-1.9, 0, 1.9]) {
          const x = ax + (bx - ax) * s + sx * across, z = az + (bz - az) * s + sz * across;
          // Where it rises out of the plaza, the floor is the deck's own level (it comes down on the dock's own collider).
          if (padMask(g, x, z).mask >= 0.99) continue;
          const got = h(g, x, z);
          if (!(got < deck - 0.25)) bad.push(`wave (${ax.toFixed(0)}, ${az.toFixed(0)}) at s ${s.toFixed(2)}: ground ${got.toFixed(2)}, deck ${deck.toFixed(2)}`);
        }
      }
    }
    expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
  });

  for (const s of SCULPTS) {
    if (s.edge.kind !== 'cliff') continue;
    const edge = s.edge;
    it(`${s.id}: the cliff reaches base − drop within width + 10 m outside the land`, () => {
      const step = 2;
      const pts = distanceToLand(s, step);
      const bottom = s.base - edge.drop;
      let checked = 0;
      const bad: string[] = [];
      for (const p of pts) {
        if (p.d < edge.width + 10 + step) continue;
        checked++;
        const got = h(s, p.x, p.z);
        if (!(got <= bottom + 1e-6)) bad.push(`(${p.x.toFixed(1)}, ${p.z.toFixed(1)}) ${p.d.toFixed(1)} m out: ${got.toFixed(2)} > ${bottom}`);
      }
      expect(checked).toBeGreaterThan(1000);
      expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
      // And it does fall: just past the land it is still near the rim, by width + 10 m it is down.
      expect(pts.some((p) => p.d > 0 && p.d < 3 && h(s, p.x, p.z) > bottom + edge.drop * 0.5)).toBe(true);
    }, SCAN_TIMEOUT);
  }

  it('sunken: the seabed falls away to the abyss past its disc', () => {
    const s = REALM_SCULPTS.sunken;
    if (s.edge.kind !== 'seabed' || s.land.kind !== 'disc') throw new Error('the sunken city is a seabed disc');
    const fall = s.edge.fall ?? SEABED_FALL, d = s.land.disc;
    expect(h(s, d.x + d.r + fall + 1, d.z)).toBe(ABYSS_Y);
    expect(h(s, d.x, d.z - d.r + 10)).toBeGreaterThan(s.base - 2);
    // Gentle: under one metre a metre all the way down.
    for (let x = d.x + d.r - 5; x < d.x + d.r + fall; x += 1) expect(Math.abs(h(s, x + 1, d.z) - h(s, x, d.z))).toBeLessThan(1);
  });

  it('heights are continuous across pad borders and the land edge (200 random segments)', () => {
    const r = rng(2024);
    const bad: string[] = [];
    for (let i = 0; i < 200; i++) {
      const s = SCULPTS[i % SCULPTS.length];
      let bx: number, bz: number;
      if (i % 2 === 0) {
        // A point on a pad's border.
        const p = s.pads[Math.floor(r() * s.pads.length)];
        const pts = padSamples(p, 64).slice(1);
        [bx, bz] = pts[Math.floor(r() * pts.length)];
      } else {
        // A point on the land's edge: out from a pad's middle until the land ends.
        const p = s.pads[Math.floor(r() * s.pads.length)];
        [bx, bz] = padSamples(p, 1)[0];
        const a = r() * Math.PI * 2;
        let t = 0;
        while (landDistance(s, bx + Math.cos(a) * t, bz + Math.sin(a) * t, noise) < 0 && t < 2000) t += 0.25;
        bx += Math.cos(a) * t;
        bz += Math.sin(a) * t;
      }
      // 16 m across it, sampled every 0.1 m.
      const a = r() * Math.PI * 2, ux = Math.cos(a), uz = Math.sin(a), N = 160;
      const xs: number[] = [], zs: number[] = [], hs: number[] = [], land: boolean[] = [], wet: boolean[] = [];
      for (let k = 0; k <= N; k++) {
        const x = bx + ux * (k * 0.1 - 8), z = bz + uz * (k * 0.1 - 8);
        xs.push(x); zs.push(z); hs.push(h(s, x, z)); land.push(landMask(s, x, z, noise) > 0); wet.push(nearWater(s, x, z));
      }
      for (let k = 0; k < N; k++) {
        if (wet[k] || wet[k + 1]) continue;
        // No tears anywhere (a 0.1 m step never jumps more than a gradient of 8 allows, cliffs included: their steepest
        // ground is about 6.2, see the scan below)…
        const dh = Math.abs(hs[k + 1] - hs[k]);
        if (!(dh < 0.8)) bad.push(`${s.id} (${xs[k].toFixed(2)}, ${zs[k].toFixed(2)}) → 0.1 m: ${dh.toFixed(3)}`);
        // …and on the land, under 1.5 m a metre.
        if (k + 10 > N || wet[k + 10] || !land[k] || !land[k + 10]) continue;
        const dm = Math.abs(hs[k + 10] - hs[k]);
        if (!(dm < 1.5)) bad.push(`${s.id} (${xs[k].toFixed(2)}, ${zs[k].toFixed(2)}) → 1 m on land: ${dm.toFixed(3)}`);
      }
    }
    expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
  }, SCAN_TIMEOUT);

  for (const s of SCULPTS) {
    if (s.edge.kind !== 'cliff') continue;
    it(`${s.id}: the steepest cliff ground (every metre of the cliff band, central differences) is under a gradient of 8`, () => {
      // The cliff's smoothstep is 4.2..4.6 steep straight across the border; the border's fbm warp adds its own gradient
      // where it bends, up to about 6.2 (the kingdom's). Not one sample of the band may tear past 8.
      const f = realmField(s);
      const d = 0.05;
      let worst = 0, at = '', band = 0;
      for (let z = f.z0; z <= f.z0 + f.size; z += 1) for (let x = f.x0; x <= f.x0 + f.size; x += 1) {
        const e = landDistance(s, x, z, noise);
        if (e < -6 || e > 60) continue;
        band++;
        const g = Math.hypot((h(s, x + d, z) - h(s, x - d, z)) / (2 * d), (h(s, x, z + d) - h(s, x, z - d)) / (2 * d));
        if (g > worst) { worst = g; at = `(${x}, ${z})`; }
      }
      expect(band).toBeGreaterThan(5000);
      expect(worst, `steepest ${worst.toFixed(2)} at ${at}`).toBeLessThan(8);
      // And it is a cliff: steeper than its smoothstep alone somewhere.
      expect(worst).toBeGreaterThan(4);
    }, SCAN_TIMEOUT);
  }

  it("the vale: the cobbled path climbs to the crowned head at a gradient of at most 0.3, the head's ground level on the hill", () => {
    const v = REALM_SCULPTS.vale;
    expect(VALE_PATH_GRADE).toBeLessThanOrEqual(0.3);
    let worst = 0, run = 0;
    for (let i = 0; i < VALE_HEAD_PATH.length - 1; i++) {
      const [ax, az] = VALE_HEAD_PATH[i], [bx, bz] = VALE_HEAD_PATH[i + 1];
      const L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 0.25);
      for (let k = 0; k < n; k++) {
        const x0 = ax + ((bx - ax) * k) / n, z0 = az + ((bz - az) * k) / n, x1 = ax + ((bx - ax) * (k + 1)) / n, z1 = az + ((bz - az) * (k + 1)) / n;
        worst = Math.max(worst, Math.abs(h(v, x1, z1) - h(v, x0, z0)) / Math.hypot(x1 - x0, z1 - z0));
      }
      run += L;
    }
    expect(worst).toBeLessThanOrEqual(0.3);
    expect(run).toBeGreaterThan(30);
    // It starts level with the bridge's bank and ends on the head's seat, the top of the hill, where the head stands.
    expect(h(v, VALE_HEAD_PATH[0][0], VALE_HEAD_PATH[0][1])).toBeCloseTo(VALE.y, 6);
    expect(h(v, CROWNED_HEAD.x, CROWNED_HEAD.z)).toBeCloseTo(VALE_HEAD_Y, 6);
    expect(VALE_HEAD_Y).toBeCloseTo(VALE.y + 5, 9);
    for (let a = 0; a < 16; a++) expect(h(v, VALE_HEAD_SEAT.x + Math.cos(a) * VALE_HEAD_SEAT.r * 0.99, VALE_HEAD_SEAT.z + Math.sin(a) * VALE_HEAD_SEAT.r * 0.99)).toBeCloseTo(VALE_HEAD_Y, 6);
    // Vale.ts's braziers where the path meets the head ((928, 928.5) ± 2.8 across it) are on the seat's rim: h() puts them there.
    for (const [x, z] of [[926.75, 931], [929.25, 926]]) expect(h(v, x, z)).toBeCloseTo(VALE_HEAD_Y, 6);
  });

  it("the vale: the crowned head's mound rests level on its seat (every floor-touching collider cell, sculpted and drawn), on a smooth hill", () => {
    const v = REALM_SCULPTS.vale, field = drawn(v);
    const H = CROWNED_HEAD;
    const y = h(v, H.x, H.z);
    const f = gridFootprint('crowned-head', H.x, y, H.z, H.yaw, H.scale);
    expect(f).not.toBeNull();
    const g = f!, c = Math.cos(g.rotY), sn = Math.sin(g.rotY);
    let cells = 0, far = 0;
    const bad: string[] = [];
    for (let k = 0; k < g.nz; k++) for (let i = 0; i < g.nx; i++) {
      // Floor-touching: the cell's ground part (`low`, colliderGrids.ts) starts at the model's feet.
      if (g.data[(k * g.nx + i) * 3] === 0) continue;
      cells++;
      for (const [du, dv] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) {
        // The cell's corners and middle, from the model's frame back into the world (Colliders.ts gridCell's turn, inverted).
        const lx = g.minX + (i + du) * g.cell, lz = g.minZ + (k + dv) * g.cell;
        const x = H.x + lx * c + lz * sn, z = H.z - lx * sn + lz * c;
        far = Math.max(far, Math.hypot(x - H.x, z - H.z));
        const a = h(v, x, z), b = field.heightAt(x, z);
        if (!(Math.abs(a - y) < 1e-6) || !(Math.abs(b - y) < 0.02)) bad.push(`(${x.toFixed(1)}, ${z.toFixed(1)}): sculpt ${a.toFixed(3)}, drawn ${b.toFixed(3)} for ${y}`);
      }
    }
    // (The reviewed mound: 849 cells reaching 17.7 m from where it stands.)
    expect(cells).toBeGreaterThan(800);
    expect(far).toBeGreaterThan(17);
    expect(bad, `${bad.length} points off the seat:\n${bad.slice(0, 20).join('\n')}`).toEqual([]);
    // Off the pads (the seat, the path's spur, the bridge's banks), the hill is exactly the dome: no fbm hills on it.
    let checked = 0;
    for (let a = 0; a < 64; a++) for (const r of [18, 22, 26, 30, 34]) {
      const x = VALE_DOME.disc.x + Math.cos((a / 64) * Math.PI * 2) * r, z = VALE_DOME.disc.z + Math.sin((a / 64) * Math.PI * 2) * r;
      if (padMask(v, x, z).mask > 0 || sdSeg(x, z, VALE_PATH) < 12) continue;
      checked++;
      expect(h(v, x, z), `(${x.toFixed(1)}, ${z.toFixed(1)})`).toBeCloseTo(VALE.y + hillHeight(VALE_DOME, x, z), 6);
    }
    expect(checked).toBeGreaterThan(120);
  }, SCAN_TIMEOUT);

  it('the vale: the land stops short of the floating castle; the river runs its full length between raised banks', () => {
    const v = REALM_SCULPTS.vale;
    for (let z = 790; z <= 1020; z += 5) expect(landMask(v, 1095, z, noise), `x 1095, z ${z}`).toBe(0);
    // (The bed rises to the shore over its last WATER_BANK metres at each end, so the sheet's ends sink into the banks.)
    for (let z = 784; z <= 1021; z += 3) {
      expect(landMask(v, 955, z, noise), `river at z ${z}`).toBe(1);
      expect(h(v, 955, z)).toBeCloseTo(VALE.y - 2.2, 6);
      for (const x of [947, 963]) expect(h(v, x, z), `bank (${x}, ${z})`).toBeGreaterThanOrEqual(VALE_RIVER.level + FREEBOARD - 1e-9);
    }
  });

  it('the alley of graves: the land reaches no further than |x| 42, the mounds only beyond the plots', () => {
    const g = REALM_SCULPTS.graveyard;
    for (let z = -1160; z <= -840; z += 4) {
      expect(landMask(g, 42.5, z, noise), `x 42.5, z ${z}`).toBe(0);
      expect(landMask(g, -42.5, z, noise), `x -42.5, z ${z}`).toBe(0);
    }
    // (Where the plots' trees stand, on the floor beyond the plots: Graveyard.ts, |x| 16..20, z −925..−1050.)
    for (let z = -1050; z <= -920; z += 5) for (const x of [-20, -17, 17, 20]) expect(h(g, x, z), `(${x}, ${z})`).toBeCloseTo(GRAVEYARD.y, 6);
    expect(landMask(g, 0, -1138, noise)).toBeGreaterThan(0);
    expect(landMask(g, 0, -862, noise)).toBeGreaterThan(0);
    expect(landMask(g, 0, -1150, noise)).toBe(0);
  });
});

describe('realm sculpts: sharp edges are drawn as sculpted', () => {
  it('the grid is world-aligned, and the moat and the grave plots lie on its lines', () => {
    const on = (v: number) => Math.abs(v / REALM_CELL - Math.round(v / REALM_CELL)) < 1e-9;
    for (const s of SCULPTS) { const f = realmField(s); expect(on(f.x0) && on(f.z0) && on(f.size), s.id).toBe(true); }
    expect(PLOT_PADS).toEqual([[4.5, 15, -1068, -916.5], [-15, -4.5, -1068, -916.5]]);
    for (const v of [...PLOT_PADS.flat(), ...MOAT_BED_RECT]) expect(on(v), `${v}`).toBe(true);
    expect(onGrid([816, 828, -40, 75])).toEqual([816, 828, -39, 75]);
    expect(onGrid([816, 828, -40, 75], 1)).toEqual(MOAT_BED_RECT);
  });

  it('the alley of graves: each plot rises over one column of cells, and the drawn ground there is the sculpt', () => {
    const g = REALM_SCULPTS.graveyard, field = drawn(g), y0 = GRAVEYARD.y;
    const bad: string[] = [];
    const same = (x: number, z: number) => {
      const a = h(g, x, z), b = field.heightAt(x, z);
      if (!(Math.abs(a - b) < 1e-4)) bad.push(`(${x.toFixed(2)}, ${z.toFixed(2)}): sculpt ${a.toFixed(4)}, drawn ${b.toFixed(4)}`);
    };
    // Across the long sides (the inner rise x ±3..4.5, the outer ±15..16.5) and the ends (z −1069.5..−1068, −916.5..−915),
    // away from the four corner cells of each plot (where the rise rounds off and nothing stands).
    for (let z = -1066.5; z <= -918; z += 0.37) for (let ax = 2; ax <= 18; ax += 0.05) for (const side of [-1, 1]) same(side * ax, z);
    for (let ax = 6; ax <= 13.5; ax += 0.25) for (let z = -1071; z <= -1066; z += 0.05) for (const side of [-1, 1]) same(side * ax, z);
    for (let ax = 6; ax <= 13.5; ax += 0.25) for (let z = -918.5; z <= -913.5; z += 0.05) for (const side of [-1, 1]) same(side * ax, z);
    expect(bad, `${bad.length} points:\n${bad.slice(0, 20).join('\n')}`).toEqual([]);
    // The tops are level at PLOT_Y, the rise one cell, the floor beyond at y0.
    for (const side of [-1, 1]) {
      expect(field.heightAt(side * 4.5, -1000)).toBeCloseTo(PLOT_Y, 5);
      expect(field.heightAt(side * 15, -1000)).toBeCloseTo(PLOT_Y, 5);
      expect(field.heightAt(side * 3, -1000)).toBeCloseTo(y0, 5);
      expect(field.heightAt(side * 16.5, -1000)).toBeCloseTo(y0, 5);
      expect(field.heightAt(side * 3.75, -1000)).toBeCloseTo((y0 + PLOT_Y) / 2, 5);
    }
  }, SCAN_TIMEOUT);

  it('the alley of graves: the trees off the rises keep their height; the three the outer rise moves stand on the drawn ground through h()', () => {
    const g = REALM_SCULPTS.graveyard, field = drawn(g);
    // The step-7 sweep list: these three (and, to be safe from the shared random stream, every dead tree) go through h().
    const moved = GRAVE_TREES.filter(([x, z, y]) => !(Math.abs(h(g, x, z) - y) < 0.02));
    expect(moved.map(([x, z]) => [x, z])).toEqual([[15.77, -959.04], [16.29, -982.46], [16.02, -1049.33]]);
    expect(moved.map(([x, z]) => +h(g, x, z).toFixed(3))).toEqual([0.292, 0.084, 0.192]);
    // Wherever the stream drops a tree (Graveyard.ts: |x| 14..20, z −925..−1050), h() is the drawn ground.
    const bad: string[] = [];
    for (let ax = 14; ax <= 20; ax += 0.01) for (const z of [-925, -959.04, -982.46, -1012.7, -1049.33, -1050]) for (const side of [-1, 1]) {
      const x = side * ax, a = h(g, x, z), b = field.heightAt(x, z);
      if (!(Math.abs(a - b) < 1e-4)) bad.push(`(${x.toFixed(2)}, ${z}): sculpt ${a.toFixed(4)}, drawn ${b.toFixed(4)}`);
    }
    expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
  }, SCAN_TIMEOUT);

  it("the alley of graves: the walls stand flush on the alley's floor and never float; behind them the plots' rise banks against their plot face", () => {
    const g = REALM_SCULPTS.graveyard, field = drawn(g), y0 = GRAVEYARD.y;
    // Graveyard.ts: stone-wall segments at x ±3.4 (footprint ±0.62: x ±2.78..±4.02), z from −917 down past −1046, at y0.
    const bad: string[] = [];
    let banked = 0;
    for (let z = -1046; z <= -917; z += 0.25) for (const side of [-1, 1]) {
      for (let ax = 2.78; ax <= 4.0201; ax += 0.02) {
        const v = field.heightAt(side * ax, z), a = h(g, side * ax, z);
        if (!(v >= y0 - 1e-6) || !(a >= y0 - 1e-6)) bad.push(`(${side * ax}, ${z}) under the wall's foot: drawn ${v}, sculpt ${a}`);
        banked = Math.max(banked, v - y0);
      }
      for (const ax of [2.78, 3]) if (!(Math.abs(field.heightAt(side * ax, z) - y0) < 1e-6)) bad.push(`(${side * ax}, ${z}): the alley face is not on the floor`);
    }
    expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
    expect(banked).toBeLessThan(0.41);
  }, SCAN_TIMEOUT);

  it("the kingdom: the moat's walls are drawn inside its water sheet, the banks beside it level above the water (no dry trench)", () => {
    const g = REALM_SCULPTS.galaxy, field = drawn(g), M = LEAN_QUARTER.moat;
    const bad: string[] = [];
    // Within 2 m outside the sheet, the drawn ground never dips to the water.
    for (let x = M[0] - 2; x <= M[1] + 2; x += 0.05) for (let z = M[2] - 2; z <= M[3] + 2; z += 0.25) {
      const d = sdRect(x, z, M);
      if (d <= 0 || d > 2) continue;
      const v = field.heightAt(x, z);
      if (!(v > MOAT_LEVEL)) bad.push(`(${x.toFixed(2)}, ${z.toFixed(2)}) outside the sheet: drawn ${v.toFixed(3)} under the water at ${MOAT_LEVEL}`);
    }
    // Across the channel, away from its ends: the drawn ground is the sculpt, level with the banks at x 816 and 828, the
    // walls one cell each inside the sheet, the bed level between.
    for (let z = -37; z <= 73; z += 1.7) for (let x = 812; x <= 832; x += 0.05) {
      const a = h(g, x, z), b = field.heightAt(x, z);
      if (!(Math.abs(a - b) < 0.01)) bad.push(`(${x.toFixed(2)}, ${z.toFixed(2)}): sculpt ${a.toFixed(3)}, drawn ${b.toFixed(3)}`);
      if (x >= 817.5 && x <= 826.5 && !(Math.abs(b - MOAT_BED) < 1e-4)) bad.push(`(${x.toFixed(2)}, ${z.toFixed(2)}): the bed at ${b.toFixed(3)}`);
    }
    expect(bad, `${bad.length} points:\n${bad.slice(0, 20).join('\n')}`).toEqual([]);
    for (const x of [816, 828]) expect(field.heightAt(x, 0)).toBeCloseTo(GALAXY.y, 4);
    // The torches either side of the bridge stand on level drawn ground.
    for (const x of [814.8, 829.4]) for (const z of [14, 22]) expect(field.heightAt(x, z)).toBeCloseTo(GALAXY.y, 4);
  }, SCAN_TIMEOUT);
});

describe('realm sculpts: layers and tint', () => {
  for (const s of SCULPTS) {
    it(`${s.id}: the texture weights sum to 1 (between 0.5 and 1.001) everywhere on land, wet in 0..1`, () => {
      const out = new Float32Array(LAYER_COUNT);
      const bad: string[] = [];
      for (const [x, z] of landPoints(s, 800, 7)) {
        for (const slope of [slopeAt(s, x, z), 0, 0.6, 0.95]) {
          out.fill(0);
          realmLayers(s, x, z, h(s, x, z), slope, noise, out);
          let sum = 0;
          for (let k = 0; k < TEXTURE_LAYERS; k++) {
            if (!(out[k] >= 0)) bad.push(`(${x.toFixed(1)}, ${z.toFixed(1)}) layer ${k} = ${out[k]}`);
            sum += out[k];
          }
          if (!(sum >= 0.5 && sum <= 1.001)) bad.push(`(${x.toFixed(1)}, ${z.toFixed(1)}) slope ${slope.toFixed(2)}: sum ${sum}`);
          if (!(out[LAYER.wet] >= 0 && out[LAYER.wet] <= 1)) bad.push(`(${x.toFixed(1)}, ${z.toFixed(1)}): wet ${out[LAYER.wet]}`);
        }
      }
      expect(bad, bad.slice(0, 20).join('\n')).toEqual([]);
    });
  }

  it('each realm paints its own ground: marble mid-plaza, cobble mid-street, snow by the chapel, grass in the vale, the alley slabbed, the seabed under the river', () => {
    const out = new Float32Array(LAYER_COUNT);
    const at = (s: RealmSculpt, x: number, z: number, slope = 0) => { out.fill(0); realmLayers(s, x, z, h(s, x, z), slope, noise, out); return out; };
    const { galaxy: g, vale: v, graveyard: gr, sunken: su } = REALM_SCULPTS;
    expect(at(g, 1000, -5)[LAYER.marble]).toBeGreaterThan(0.95);
    expect(at(g, 884, 18)[LAYER.cobble]).toBeGreaterThan(0.95);
    expect(at(g, 1000, -135)[LAYER.flagstone]).toBeGreaterThan(0.95);
    expect(at(g, 905, 160)[LAYER.snow]).toBeGreaterThan(0.95);
    expect(at(g, 822, 0)[LAYER.wet]).toBe(1);
    expect(at(v, 1000, 960)[LAYER.cobble]).toBeGreaterThan(0.95);
    expect(at(v, 955, 850)[LAYER.seabed]).toBeGreaterThan(0.95);
    expect(at(gr, 0, -1000)[LAYER.flagstone]).toBeGreaterThan(0.9);
    expect(at(su, -1000, -40)[LAYER.cobble]).toBeGreaterThan(0.95);
    expect(at(su, -1000, 150)[LAYER.wet]).toBeCloseTo(0.6, 6);
    // Rock on steep ground and on the cliff band; the default ground where nothing else is painted.
    expect(at(v, 1040, 870, 0.95)[LAYER.rock]).toBe(1);
    const grass = (() => { let best = 0; for (let x = 1040; x < 1075; x += 5) for (let z = 850; z < 880; z += 5) best = Math.max(best, at(v, x, z)[LAYER.grass]); return best; })();
    expect(grass).toBeGreaterThan(0.5);
    // The plaza's marble frays at its edge: somewhere along it the cobble or the rock shows through.
    let mixed = 0;
    for (let z = -80; z < 70; z += 1) { const w = at(g, 941, z); if (w[LAYER.marble] > 0.05 && w[LAYER.marble] < 0.6) mixed++; }
    expect(mixed).toBeGreaterThan(5);
  });

  it('the far tint stays in the island palette: dark, finite, wet ground darker, snow the brightest', () => {
    const c = { r: 0, g: 0, b: 0 };
    const tint = (s: RealmSculpt, x: number, z: number) => { realmTint(s, x, z, h(s, x, z), slopeAt(s, x, z), c); return { ...c }; };
    for (const s of SCULPTS) for (const [x, z] of landPoints(s, 200, 11)) {
      const t = tint(s, x, z);
      for (const v of [t.r, t.g, t.b]) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThan(0.6); }
    }
    const snow = tint(REALM_SCULPTS.galaxy, 905, 160), rock = tint(REALM_SCULPTS.galaxy, 850, 200);
    expect(snow.r + snow.g + snow.b).toBeGreaterThan(rock.r + rock.g + rock.b);
    // Blue-leaning, like the island's navy and moonlit snow.
    expect(snow.b).toBeGreaterThan(snow.r);
    // The same ground wet is darker.
    const w = new Float32Array(LAYER_COUNT);
    w[LAYER.cobble] = 1;
    const dry = { r: 0, g: 0, b: 0 }, wet = { r: 0, g: 0, b: 0 };
    realmTint(REALM_SCULPTS.vale, 0, 0, 0, 0, dry, w);
    w[LAYER.wet] = 1;
    realmTint(REALM_SCULPTS.vale, 0, 0, 0, 0, wet, w);
    expect(wet.r + wet.g + wet.b).toBeLessThan(0.8 * (dry.r + dry.g + dry.b));
  });
});

describe('realm sculpts: sculptFor', () => {
  for (const s of SCULPTS) {
    it(`${s.id}: a Sculpt over the whole land whose height is realmHeight at 1000 random land points`, () => {
      const sc = sculptFor(s, noise);
      // Every realm at the specified 1.5 m; the largest field (the sunken city's) 135k vertices, the kingdom's 118k.
      expect(sc.cell).toBe(REALM_CELL);
      expect(REALM_CELL).toBe(1.5);
      expect(sc.voidBelow).toBe(ABYSS_Y + 1);
      expect(Math.abs(sc.size / sc.cell - Math.round(sc.size / sc.cell))).toBeLessThan(1e-9);
      expect((Math.round(sc.size / sc.cell) + 1) ** 2).toBeLessThan(140_000);
      const pts = landPoints(s, 1000, 3);
      expect(pts.length).toBe(1000);
      const bad: string[] = [];
      for (const [x, z] of pts) if (sc.height(x, z) !== realmHeight(s, x, z, noise)) bad.push(`(${x}, ${z})`);
      expect(bad, bad.slice(0, 10).join('\n')).toEqual([]);
      // The field holds the whole land and its fall: its border is abyss all round.
      for (let i = 0; i <= 40; i++) {
        const t = (i / 40) * sc.size;
        for (const [x, z] of [[sc.x0 + t, sc.z0], [sc.x0 + t, sc.z0 + sc.size], [sc.x0, sc.z0 + t], [sc.x0 + sc.size, sc.z0 + t]]) expect(sc.height(x, z)).toBe(ABYSS_Y);
      }
      // Layers and tint go through to the module's functions (the tint reusing the weights the layers just wrote).
      const a = new Float32Array(LAYER_COUNT), b = new Float32Array(LAYER_COUNT);
      const ca = new Color(), cb = { r: 0, g: 0, b: 0 };
      for (const [x, z] of pts.slice(0, 50)) {
        const hh = sc.height(x, z), sl = slopeAt(s, x, z);
        sc.layers(x, z, hh, sl, a);
        realmLayers(s, x, z, hh, sl, noise, b);
        expect(Array.from(a)).toEqual(Array.from(b));
        sc.tint!(x, z, hh, sl, ca);
        realmTint(s, x, z, hh, sl, cb, b);
        expect([ca.r, ca.g, ca.b]).toEqual([cb.r, cb.g, cb.b]);
      }
    });
  }

  it('is deterministic for Noise2D(1337)', () => {
    const other = new Noise2D(1337);
    const r = rng(5);
    for (const s of SCULPTS) {
      const f = realmField(s);
      for (let i = 0; i < 300; i++) {
        const x = f.x0 + r() * f.size, z = f.z0 + r() * f.size;
        expect(realmHeight(s, x, z, other)).toBe(realmHeight(s, x, z, noise));
        expect(landMask(s, x, z, other)).toBe(landMask(s, x, z, noise));
      }
    }
  });

  it('the realms keep their sky and cloud sea', () => {
    expect(REALM_SCULPTS.galaxy.cloudSea).toBe(GALAXY.y - 40);
    expect(REALM_SCULPTS.galaxy.sky).toBe('kingdom');
    expect(REALM_SCULPTS.vale.cloudSea).toBe(-30);
    expect(REALM_SCULPTS.graveyard.cloudSea).toBe(-30);
    expect(REALM_SCULPTS.sunken.cloudSea).toBeNull();
    expect(REALM_SCULPTS.vale.grass).toBe(true);
    expect(REALM_SCULPTS.graveyard.grass).toBe(true);
    expect(REALM_SCULPTS.galaxy.grass).toBe(false);
    expect(REALM_SCULPTS.sunken.grass).toBe(false);
    for (const s of SCULPTS) expect(s.base).toBe(realmDef(s).y);
    // (smoothstep is the noise module's: the sculpts' slope is the one the island uses.)
    expect(snowY(80)).toBe(GALAXY.y + 3 * smoothstep(80, 150, 80));
  });
});

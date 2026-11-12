/**
 * The island's placements against its own ground: no building stands in water, hangs over a bank, sinks into a
 * hillside or sits over the void, and no NPC or mob spot is wet or over the drop (the user's playtest of 2026-11-10
 * found the witches' bridge in the river and a house in the water; nothing measured it). Every object is sampled
 * over its baked collider cells (Colliders.gridFootprint) against the analytic sculpt (terrainHeight) and the water
 * (waterLevelAt), exactly as World.ts places it (LANDMARKS, LAYOUT, VILLAGE, ANCHORS, ENEMY_SPAWNS).
 */
import { describe, expect, it } from 'vitest';
import { ANCHORS, ISLAND_PORTALS, LANDMARKS, LAYOUT, SINK, SKY_EYES, VILLAGE, type LandmarkSpot } from '../data/world';
import { ENEMY_DEFS, ENEMY_SPAWNS } from '../data/enemies';
import { MODELS } from '../data/models';
import { gridFootprint, type GridFootprint } from './Colliders';
import { Noise2D } from './noise';
import { terrainHeight, waterLevelAt } from './Terrain';

const noise = new Noise2D(1337);
const h = (x: number, z: number) => terrainHeight(x, z, noise);
const VOID = -2;

/** Where a model's feet touch the ground: the occupied cells with no overhead gap (an arch's span is not a foot). */
function groundCells(f: GridFootprint): Array<[number, number]> {
  const pts: Array<[number, number]> = [];
  const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
  for (let k = 0; k < f.nz; k++) for (let i = 0; i < f.nx; i++) {
    const ci = (k * f.nx + i) * 3;
    if (!(f.data[ci + 2] > 0) || f.data[ci + 1] !== 255) continue;
    const lx = f.minX + (i + 0.5) * f.cell, lz = f.minZ + (k + 0.5) * f.cell;
    pts.push([f.x + lx * c + lz * s, f.z - lx * s + lz * c]);
  }
  return pts;
}

interface Placed extends LandmarkSpot { base: number }

/** The island's buildings and props as World.ts stands them (its base = ground at the spot, less its sink). */
function placed(): Placed[] {
  const out: Placed[] = [];
  const put = (l: LandmarkSpot) => out.push({ ...l, base: h(l.at?.x ?? l.x, l.at?.z ?? l.z) - (l.sink ?? 0) });
  for (const l of LANDMARKS) put(l);
  const L = LAYOUT;
  put({ id: 'cathedral', x: L.cathedral.x, z: L.cathedral.z, yaw: L.cathedral.yaw, scale: L.cathedral.scale, fixedY: L.cathedral.y });
  put({ id: 'church', x: L.church.x, z: L.church.z, yaw: Math.PI / 2, sink: SINK.church });
  put({ id: 'throne', x: L.throne.x, z: L.throne.z, sink: SINK.throne });
  put({ id: 'treehouse', x: L.treehouse.x, z: L.treehouse.z, yaw: Math.PI / 2, sink: SINK.treehouse, rockBase: true });
  put({ id: 'tower', x: L.tower.x, z: L.tower.z, sink: SINK.tower, rockBase: true });
  for (const r of L.ruins) put({ id: r.arch ? 'ruin-arch' : 'ruin-column', x: r.x, z: r.z, yaw: r.yaw, sink: SINK.ruin });
  for (const [x, z, yaw] of L.hamlet) put({ id: 'village-house', x, z, yaw, sink: SINK.house });
  for (const [dx, dz, , , yaw] of VILLAGE.houses) put({ id: 'village-house', x: VILLAGE.x + dx, z: VILLAGE.z + dz, yaw, sink: SINK.house });
  const ft = ISLAND_PORTALS.galaxy.faceTree;
  put({ id: 'face-tree', x: ft.x, z: ft.z, sink: SINK.faceTree });
  return out.map((p) => (p.fixedY !== undefined ? { ...p, base: p.fixedY } : p));
}

interface Report { id: string; at: string; buried: number; floating: number; wet: number; void: number; cells: number }

function measure(p: Placed): Report | null {
  const f = gridFootprint(p.id, p.x, p.base, p.z, p.yaw ?? 0, p.scale ?? 1);
  if (!f) return null;
  const cells = groundCells(f);
  const rep: Report = { id: p.id, at: `(${p.x},${p.z})`, buried: -Infinity, floating: -Infinity, wet: 0, void: 0, cells: cells.length };
  for (const [x, z] of cells) {
    const g = h(x, z);
    rep.buried = Math.max(rep.buried, g - p.base);
    rep.floating = Math.max(rep.floating, p.base - g);
    const w = waterLevelAt(x, z, noise);
    if (w !== null && g < w) rep.wet++;
    // Over the drop, or on a footing shelf levelled out past the cliff (a footing counts as land, so the ground under
    // it reads as its own height; the sculpt without footings is the cliff).
    if (g < VOID || terrainHeight(x, z, noise, true, false) < VOID) rep.void++;
  }
  return rep;
}

describe('the island stands on its ground', () => {
  const reports = placed().map((p) => [p, measure(p)] as const).filter((r): r is readonly [Placed, Report] => r[1] !== null);

  it('measures every building (its collider grid is baked)', () => {
    expect(reports.length).toBeGreaterThan(20);
    for (const [, r] of reports) expect(r.cells, r.id + r.at).toBeGreaterThan(0);
  });

  it('keeps every building out of the water', () => {
    const wet = reports.filter(([, r]) => r.wet > 0).map(([, r]) => `${r.id}${r.at} ${r.wet}/${r.cells} cells wet`);
    expect(wet).toEqual([]);
  });

  it('keeps every building off the chasm and the cliff', () => {
    const over = reports.filter(([, r]) => r.void > 0).map(([, r]) => `${r.id}${r.at} ${r.void}/${r.cells} cells over the void`);
    expect(over).toEqual([]);
  });

  it('stands every building on its ground: no bank under a wall, no hillside through a floor', () => {
    const bad: string[] = [];
    for (const [p, r] of reports) {
      const height = (MODELS[p.id]?.height ?? 1) * (p.scale ?? 1);
      if (!p.rockBase && r.buried > Math.max(1, 0.3 * height)) bad.push(`${r.id}${r.at} buried ${r.buried.toFixed(2)} of ${height.toFixed(1)}`);
      if (r.floating > 0.35) bad.push(`${r.id}${r.at} hangs ${r.floating.toFixed(2)} over its ground`);
    }
    expect(bad).toEqual([]);
  });
});

/** Mobs that live in the water, in the gorge or in the air (by design). */
const AQUATIC = /^(cyclops|croc|lurker|koi|marshdemon|rivershade)$/;
const FLYING_OR_SUNK = /^(blood-eye|troll)$/;

describe('the island\'s folk and mobs stand on dry land', () => {
  const island = (x: number, z: number) => Math.abs(x) < 200 && Math.abs(z) < 200;

  it('keeps every NPC spot dry and off the drop', () => {
    const bad: string[] = [];
    for (const [id, a] of Object.entries(ANCHORS)) {
      if (!island(a.x, a.z) || a.y !== undefined) continue;
      const g = h(a.x, a.z);
      const w = waterLevelAt(a.x, a.z, noise);
      if (w !== null && g < w) bad.push(`${id} (${a.x},${a.z}) in water ${(w - g).toFixed(2)} deep`);
      if (g < VOID) bad.push(`${id} (${a.x},${a.z}) over the void`);
    }
    expect(bad).toEqual([]);
  });

  it('keeps every roaming hostile 30 m from the spawn and 12 m from anyone you talk to', () => {
    // (The user's rule: nothing hostile near the spawn, and no mob leashed on top of an NPC. Bosses sit where their
    // quests put them; `exact` spawns are posed scenes: the campfire skeletons round their own fire.)
    const bad: string[] = [];
    const folk = Object.entries(ANCHORS).filter(([, a]) => island(a.x, a.z));
    for (const s of ENEMY_SPAWNS) {
      const def = ENEMY_DEFS[s.kind];
      if (!island(s.x, s.z) || s.exact || def?.boss || def?.passive) continue;
      const pts: Array<readonly [number, number]> = [[s.x, s.z], ...(s.patrol ?? [])];
      for (const [x, z] of pts) {
        const ds = Math.hypot(x - LAYOUT.spawn.x, z - LAYOUT.spawn.z);
        if (ds < 30) bad.push(`${s.kind} (${x},${z}) ${ds.toFixed(0)} m from the spawn`);
        for (const [id, a] of folk) {
          const d = Math.hypot(x - a.x, z - a.z);
          if (d < 12) bad.push(`${s.kind} (${x},${z}) ${d.toFixed(1)} m from ${id}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('keeps every mob spawn dry and off the drop, bar the swimmers, the gorge troll and the flyer', () => {
    const bad: string[] = [];
    for (const s of ENEMY_SPAWNS) {
      if (!island(s.x, s.z) || AQUATIC.test(s.kind) || FLYING_OR_SUNK.test(s.kind) || ENEMY_DEFS[s.kind]?.flying) continue;
      const pts: Array<readonly [number, number]> = [[s.x, s.z], ...(s.patrol ?? [])];
      for (const [x, z] of pts) {
        const g = h(x, z);
        const w = waterLevelAt(x, z, noise);
        if (w !== null && g < w) bad.push(`${s.kind} (${x},${z}) in water ${(w - g).toFixed(2)} deep`);
        if (g < VOID) bad.push(`${s.kind} (${x},${z}) over the void`);
        // A spawn on a wall (the gorge's cut, the peak's flank) slides or hangs: the ground within a metre may rise no
        // more than it runs.
        const slope = Math.max(Math.abs(h(x + 1, z) - h(x - 1, z)), Math.abs(h(x, z + 1) - h(x, z - 1))) / 2;
        if (!s.exact && slope > 1) bad.push(`${s.kind} (${x},${z}) on a ${Math.round((Math.atan(slope) * 180) / Math.PI)}-degree slope`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('one eye at a time', () => {
  it('no watching sky eye hangs over the Blood Eye\'s patrol (side by side they read as one eye with two pupils)', () => {
    const spawn = ENEMY_SPAWNS.find((s) => s.kind === 'blood-eye')!;
    const path = [[spawn.x, spawn.z], ...(spawn.patrol ?? [])];
    for (const e of SKY_EYES) for (const [x, z] of path) expect(Math.hypot(e.x - x, e.z - z), `sky eye at (${e.x},${e.z})`).toBeGreaterThan(30);
  });
});

import { describe, expect, it } from 'vitest';
import { CHESTS, CHEST_RESPAWN, chestById } from './chests';
import { ITEMS } from '../items/Items';
import { ANCHORS, LAYOUT, LEAN_QUARTER, PADS, REALMS } from './world';
import { ENEMY_SPAWNS } from './enemies';
import type { Zone } from '../game/Events';
import { footprintContains, gridFootprint, type Footprint } from '../world/Colliders';
import { Noise2D } from '../world/noise';
import { WORLD, terrainHeight } from '../world/Terrain';

const ZONES: Record<Zone, true> = { island: true, galaxy: true, sunken: true, treehouse: true, dream: true, graveyard: true, vale: true, 'tavern-room': true, 'crypt-room': true };

type XZ = { x: number; z: number };
const dist = (a: XZ, b: XZ) => Math.hypot(a.x - b.x, a.z - b.z);

/** Which zone (x, z) falls in, the way main.ts decides it: inside a realm's radius, else the island. */
function zoneOf(x: number, z: number): Zone {
  return (REALMS.find((r) => Math.hypot(x - r.x, z - r.z) < r.radius)?.id as Zone | undefined) ?? 'island';
}

function segDist(p: XZ, a: readonly [number, number], b: readonly [number, number]): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / len2));
  return Math.hypot(p.x - (a[0] + dx * t), p.z - (a[1] + dz * t));
}

function pathDist(p: XZ, path: ReadonlyArray<readonly [number, number]>): number {
  let best = Infinity;
  for (let i = 0; i + 1 < path.length; i++) best = Math.min(best, segDist(p, path[i], path[i + 1]));
  return path.length === 1 ? dist(p, { x: path[0][0], z: path[0][1] }) : best;
}

/** Everything that walks a route: the NPC loops (world/NPCs.ts), the island's big walkers (LAYOUT), the mobs' patrols. */
const WALKS: Array<{ zone: Zone; path: ReadonlyArray<readonly [number, number]> }> = [
  { zone: 'island', path: [[40, 60], [50, 62], [58, 56]] },                 // the wanderer crossing the desert's edge
  { zone: 'island', path: [[-52, 70], [-30, 70.4], [-12, 70]] },             // the lantern walker on the village street
  { zone: 'island', path: [[-58, 70], [-34, 70], [-8, 70]] },                // the carrier on the village street
  { zone: 'sunken', path: [[-1000.8, 50], [-999.4, 36], [-1000.6, 24]] },    // the diver on the kelp road
  { zone: 'island', path: LAYOUT.colossusPath },
  { zone: 'island', path: LAYOUT.logGiantPath },
  { zone: 'island', path: LAYOUT.riderPath },
  ...ENEMY_SPAWNS.filter((s) => s.patrol).map((s) => ({ zone: zoneOf(s.x, s.z), path: s.patrol! })),
];

/** The buildings the chests sit by, placed as the world places them (World.ts, LeanQuarter.ts, Sunken.ts, Vale.ts). */
const face = (yaw: number) => Math.PI / 2 - yaw;
const GY = 24;
const Q = LEAN_QUARTER;
const BUILDINGS: Footprint[] = ([
  gridFootprint('cathedral', LAYOUT.cathedral.x, LAYOUT.cathedral.y, LAYOUT.cathedral.z, LAYOUT.cathedral.yaw, LAYOUT.cathedral.scale),
  gridFootprint('castle', LAYOUT.castle.x, 4.4, LAYOUT.castle.z, LAYOUT.castle.yaw),
  gridFootprint('throne', LAYOUT.throne.x, 4.4, LAYOUT.throne.z),
  gridFootprint('world-tree', LAYOUT.worldTree.x, 1.2, LAYOUT.worldTree.z),
  gridFootprint('church', LAYOUT.church.x, 0, LAYOUT.church.z, Math.PI / 2),
  gridFootprint('tower', LAYOUT.tower.x, 0, LAYOUT.tower.z),
  gridFootprint('treehouse', LAYOUT.treehouse.x, 0, LAYOUT.treehouse.z, Math.PI / 2),
  gridFootprint('observatory', LAYOUT.observatory.x, 0, LAYOUT.observatory.z),
  ...LAYOUT.ruins.map((r) => gridFootprint(r.arch ? 'ruin-arch' : 'ruin-column', r.x, 0, r.z, r.yaw)),
  gridFootprint('snow-chapel', Q.chapel.x, GY, Q.chapel.z, face(Math.atan2(86 - Q.chapel.z, 950 - Q.chapel.x))),
  gridFootprint('gothic-pavilion', 1043, GY, -160, face(Math.PI)),
  gridFootprint('dragon-throne', 1000, GY, -172, face(Math.PI / 2)),
  gridFootprint('stone-throne', 956, GY, -176, face(Math.PI / 2)),
  gridFootprint('castle', Q.castle.x, GY, Q.castle.z, face(0)),
  ...[924, 906, 888, 870, 852].flatMap((x) => [4, 32].map((z): Footprint => ({ kind: 'box', x, z, hw: 3.4, hd: 3.4, top: GY + 9 }))),
  { kind: 'box', x: 915, z: 8.6, hw: 1.8, hd: 1.2, top: GY + 1.1 }, { kind: 'box', x: 879, z: 27.4, hw: 1.8, hd: 1.2, top: GY + 1.1 },
  gridFootprint('sea-castle', -1000, -48, -80, 0),
  ...[12, 2, -8, -18, -28, -38, -48].flatMap((z, i) => [-1, 1].map((side): Footprint => ({ kind: 'box', x: -1000 + side * (10.5 + (i % 2) * 0.8), z, hw: 3.3, hd: 3.3, top: -42 }))),
  gridFootprint('crowned-head', 1000 - 85, 0, 900 + 20, face(0.25), 1.5),
] as Array<Footprint | null>).filter((f): f is Footprint => f !== null);

describe('CHESTS', () => {
  it('has about fourteen chests with unique ids and the right mix of kinds', () => {
    expect(CHESTS.length).toBeGreaterThanOrEqual(12);
    expect(new Set(CHESTS.map((c) => c.id)).size).toBe(CHESTS.length);
    const kinds = { hoard: 0, cache: 0, mimic: 0 };
    for (const c of CHESTS) kinds[c.kind]++;
    expect(kinds).toEqual({ hoard: 9, cache: 3, mimic: 2 });
    expect(chestById('gorge-head')?.kind).toBe('hoard');
    expect(chestById('nowhere')).toBeUndefined();
  });

  it('names a valid zone, and sits inside it', () => {
    for (const c of CHESTS) {
      expect(ZONES[c.zone], c.id).toBe(true);
      expect(zoneOf(c.x, c.z), c.id).toBe(c.zone);
    }
  });

  it('holds only items that exist, at chances in (0, 1], with at most one weapon at a low chance', () => {
    for (const c of CHESTS) {
      expect(c.table.length, c.id).toBeGreaterThan(0);
      let weapons = 0;
      for (const d of c.table) {
        expect(ITEMS[d.itemId], `${c.id}: ${d.itemId}`).toBeDefined();
        expect(d.chance, `${c.id}: ${d.itemId}`).toBeGreaterThan(0);
        expect(d.chance, `${c.id}: ${d.itemId}`).toBeLessThanOrEqual(1);
        if (ITEMS[d.itemId].kind === 'weapon') { weapons++; expect(d.chance, `${c.id}: ${d.itemId}`).toBeLessThanOrEqual(0.1); }
        expect(['material', 'consumable', 'weapon'], `${c.id}: ${d.itemId}`).toContain(ITEMS[d.itemId].kind);
      }
      expect(weapons, c.id).toBeLessThanOrEqual(1);
      expect(c.table.some((d) => ITEMS[d.itemId].kind === 'consumable'), c.id).toBe(true);
    }
  });

  it('pays shards by kind and refills after 900 s', () => {
    for (const c of CHESTS) {
      expect(c.respawn, c.id).toBe(CHEST_RESPAWN);
      expect(c.shards[0], c.id).toBeLessThanOrEqual(c.shards[1]);
      const [lo, hi] = c.kind === 'cache' ? [15, 40] : [30, 120];
      expect(c.shards[0], c.id).toBeGreaterThanOrEqual(lo);
      expect(c.shards[1], c.id).toBeLessThanOrEqual(hi);
    }
  });

  it('keeps at least 3 m from every NPC spot and walker path, and 4 m from every mob spawn', () => {
    for (const c of CHESTS) {
      for (const [id, a] of Object.entries(ANCHORS)) expect(dist(c, a), `${c.id} vs ${id}`).toBeGreaterThanOrEqual(3);
      for (const w of WALKS) if (w.zone === c.zone) expect(pathDist(c, w.path), `${c.id} vs a walker`).toBeGreaterThanOrEqual(3);
      for (const s of ENEMY_SPAWNS) if (zoneOf(s.x, s.z) === c.zone) expect(dist(c, s), `${c.id} vs ${s.kind}`).toBeGreaterThanOrEqual(4);
    }
  });

  it('stands outside the buildings and the creatures\' pads', () => {
    expect(BUILDINGS.length).toBeGreaterThan(20);
    for (const c of CHESTS) {
      for (const f of BUILDINGS) expect(footprintContains(f, c.x, c.z), `${c.id} inside ${f.kind === 'grid' ? f.id : `${f.kind} at ${f.x},${f.z}`}`).toBe(false);
      // The small pads level the ground under one creature or NPC each; the big ones (the castle's rock, the world tree) are ground.
      if (c.zone === 'island') for (const p of PADS) if (p.r < 10) expect(dist(c, p), `${c.id} on the pad at ${p.x},${p.z}`).toBeGreaterThan(p.r);
    }
  });

  it('sits on the island\'s ground, not in the chasm or over the cliff', () => {
    const noise = new Noise2D(1337);
    for (const c of CHESTS) {
      if (c.zone !== 'island') continue;
      const y = terrainHeight(c.x, c.z, noise);
      expect(y, `${c.id} at ${c.x},${c.z}: ground ${y.toFixed(1)}`).toBeGreaterThan(WORLD.cloudSeaY + 20);
      // Not under the river or the eye pool either.
      expect(y, `${c.id} is under water`).toBeGreaterThan(-1.5);
    }
  });
});

/**
 * The places between the places: small scenes that give the land something to find. Each is built from models the
 * game already has, stands on the sculpted ground, and is set where the empty-ground map (scripts/perf/audit/empty.js)
 * showed nothing within reach. Their mobs are in ENEMY_SPAWNS, their chests in data/chests.ts.
 */
import { KINGDOM_ROAD } from '../data/world';
import { glowSprite } from '../render/Glow';
import { fire, PURPLE_FIRE } from './Fire';
import { modelLandmark } from './ModelLandmark';
import type { Placement } from './Flora';
import type { RealmApi } from './Realms';

const LANTERN = 0xffa040;

/** `n` spots in a disc round (x, z), at least `min` from the middle. */
function ring(api: RealmApi, x: number, z: number, r: number, n: number, min = 0, size: [number, number] = [0.85, 1.2]): Placement[] {
  const out: Placement[] = [];
  for (let i = 0; i < n; i++) {
    const a = api.rnd() * Math.PI * 2, d = min + (r - min) * Math.sqrt(api.rnd());
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    out.push({ x: px, y: api.h(px, pz), z: pz, yaw: api.rnd() * 6.28, scale: size[0] + api.rnd() * (size[1] - size[0]) });
  }
  return out;
}

/** Spots through a rectangle, every `step` metres give or take. */
function field(api: RealmApi, x0: number, x1: number, z0: number, z1: number, step: number, size: [number, number] = [0.85, 1.25]): Placement[] {
  const out: Placement[] = [];
  for (let z = z0; z <= z1; z += step) for (let x = x0; x <= x1; x += step) {
    const px = x + (api.rnd() - 0.5) * step * 0.8, pz = z + (api.rnd() - 0.5) * step * 0.8;
    out.push({ x: px, y: api.h(px, pz), z: pz, yaw: api.rnd() * 6.28, scale: size[0] + api.rnd() * (size[1] - size[0]) });
  }
  return out;
}

/** A solid thing with a simple round footprint. */
function prop(api: RealmApi, id: string, x: number, z: number, r: number, top: number, yaw = 0, scale = 1): number {
  const y = api.h(x, z);
  api.place(modelLandmark(id, x, z, y, { yaw, scale, collider: 'manual', footprints: [{ kind: 'cyl', x, z, r, top: y + top }] }));
  return y;
}

/** A fire with people's leavings round it: bandits or the dead, whoever the spawn table sets there. */
export function camp(api: RealmApi, x: number, z: number): void {
  const y = api.h(x, z);
  api.place(modelLandmark('campfire', x, z, y));
  api.vfx(fire(x, y + 0.3, z, 1, 12));
  for (const [dx, dz] of [[-3.2, 1.2], [3, 1.8], [0.6, -3.4]]) prop(api, 'barrel', x + dx, z + dz, 0.45, 1);
  api.flora('skull-pile', ring(api, x, z, 6, 2, 4));
  prop(api, 'torch-post', x - 5, z - 3, 0.2, 2.4);
  api.vfx(fire(x - 5, api.h(x - 5, z - 3) + 2.1, z - 3, 0.4, 6));
}

/**
 * Where a fallen gatehouse's pieces lie round its arch at (x, z) turned by `yaw`: its four columns and two runs of wall,
 * less any that would stand within `avoid` ([x, z, radius] each) of something already there.
 */
export function ruinPieces(x: number, z: number, yaw: number, avoid: ReadonlyArray<readonly [number, number, number]> = []): { columns: Array<[number, number]>; walls: Array<[number, number]> } {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const clear = ([px, pz]: [number, number]) => !avoid.some(([ax, az, r]) => Math.hypot(px - ax, pz - az) < r);
  const columns = ([[-9, 2], [8, -3], [-6, -8], [5, 7]] as const).map(([dx, dz]): [number, number] => [x + dx * c - dz * s, z + dx * s + dz * c]).filter(clear);
  const walls = [-11, -7.5].map((d): [number, number] => [x + d * c + 6 * s, z + d * s - 6 * c]).filter(clear);
  return { columns, walls };
}

/** A fallen gatehouse: an arch still standing, columns, a run of wall (none of them inside `avoid`, see ruinPieces). */
export function ruin(api: RealmApi, x: number, z: number, yaw: number, avoid: ReadonlyArray<readonly [number, number, number]> = []): void {
  const y = api.h(x, z);
  api.place(modelLandmark('ruin-arch', x, z, y - 0.3, { yaw }));
  const { columns, walls } = ruinPieces(x, z, yaw, avoid);
  for (const [px, pz] of columns) api.place(modelLandmark('ruin-column', px, pz, api.h(px, pz) - 0.2, { yaw: api.rnd() * 6 }));
  for (const [px, pz] of walls) api.place(modelLandmark('stone-wall', px, pz, api.h(px, pz) - 0.1, { yaw }));
  api.flora('boulder', ring(api, x, z, 16, 5, 11, [0.7, 1.6]).filter((p) => !avoid.some(([ax, az, r]) => Math.hypot(p.x - ax, p.z - az) < r)));
}

/** The throne dragons' ground in the Skeleton Court (LeanQuarter: 8.5 m either side of (1000, -172), 5.5 m long). */
export const COURT_DRAGONS: ReadonlyArray<readonly [number, number, number]> = [[991.5, -160, 5.5], [1008.5, -160, 5.5]];
/** The court's fallen gatehouse. */
export const COURT_RUIN = { x: 990, z: -148, yaw: 0.6 } as const;

/** A little graveyard under a dead tree. */
export function graves(api: RealmApi, x: number, z: number, r = 11): void {
  api.flora('grave', ring(api, x, z, r, 7, 3));
  api.flora('grave-cross', ring(api, x, z, r, 4, 3));
  api.flora('rune-grave', ring(api, x, z, r, 2, 3));
  api.flora('dead-forest-tree', [{ x, y: api.h(x, z), z, yaw: api.rnd() * 6, scale: 1 }], { trunk: 0.05 });
}

/** A ring of toadstools with one giant among them, lit from under the caps. */
export function shrooms(api: RealmApi, x: number, z: number): void {
  api.flora('mushroom', ring(api, x, z, 9, 16, 4));
  api.flora('giant-mushroom', [[0, 0, 1.3], [5.5, 3, 1], [-4, 5, 0.85]].map(([dx, dz, scale]) => ({ x: x + dx, y: api.h(x + dx, z + dz), z: z + dz, yaw: dx, scale })), { trunk: 0.09 });
  for (let i = 0; i < 4; i++) { const a = i * 1.7, g = glowSprite(0x7fd8ff, 2, 0.4, true); g.position.set(x + Math.cos(a) * 5, api.h(x, z) + 1.1, z + Math.sin(a) * 5); api.group.add(g); }
}

/** A planted plot in rows behind a low wall. */
export function garden(api: RealmApi, x: number, z: number, w: number, d: number): void {
  const rows: Placement[] = [];
  for (let px = x - w / 2; px <= x + w / 2; px += 1.7) for (let pz = z - d / 2; pz <= z + d / 2; pz += 2.4) rows.push({ x: px, y: api.h(px, pz), z: pz, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 0.3 });
  api.flora('sunflower', rows, { wind: 0.18 });
  const y = api.h(x, z - d / 2 - 1.2);
  api.place(modelLandmark('stone-wall', x, z - d / 2 - 1.2, y - 0.1, { yaw: 0 }));
}

/** A landing on the bank: a moored boat (unless its boat is out on the water: `moored` false), barrels waiting, a lamp. */
export function pier(api: RealmApi, x: number, z: number, wx: number, y: number, moored = true): void {
  if (moored) api.place(modelLandmark('boat', wx, z, y, { yaw: Math.PI / 2, collider: 'none' }));
  for (const [dx, dz] of [[0, -2], [1.1, -2.6], [0.4, 2.2]]) prop(api, 'barrel', x + dx, z + dz, 0.45, 1);
  prop(api, 'lantern-post', x + 1.6, z, 0.2, 2.5);
  const g = glowSprite(LANTERN, 1.8, 0.6, true); g.position.set(x + 1.6, api.h(x, z) + 2.3, z); api.group.add(g);
}

/** A wreck half sunk in the silt, weed growing through it. */
export function wreck(api: RealmApi, x: number, z: number, yaw: number): void {
  const y = api.h(x, z);
  api.place(modelLandmark('boat', x, z, y - 0.5, { yaw, scale: 2, collider: 'manual', footprints: [{ kind: 'cyl', x, z, r: 2.2, top: y + 1 }] }));
  api.flora('kelp', ring(api, x, z, 10, 8, 6), { wind: 0.3 });
  api.flora('coral', ring(api, x, z, 10, 5, 6));
}

/** The Dragon's Vale: what lies round the village. */
export function dressVale(api: RealmApi): void {
  garden(api, 973, 1011, 13, 6);
  garden(api, 1034, 1000, 11, 8);
  // (Its boat is the gnomes' ferry, out on the river: Vale.ts.)
  pier(api, 958, 985, 951, -0.35, false);
  ruin(api, 1000, 846.5, 0.3);
  camp(api, 915, 840);
  graves(api, 882, 868);
  shrooms(api, 1046, 872);
  shrooms(api, 870, 925);
  // (After the north was squeezed on 2026-11-13: the bare ground west of the head's hill, the south meadow and the east.)
  ruin(api, 884, 948, 1.2);
  garden(api, 952, 1027, 12, 6);
  api.flora('gnarled-tree', field(api, 930, 990, 1036, 1044, 14).filter((p) => p.y > -1), { trunk: 0.05 });
  camp(api, 1046, 900);
  api.flora('flower-tree', ring(api, 1046, 884, 8, 4, 4, [0.8, 1.1]), { trunk: 0.04 });
  api.flora('giant-flower', ring(api, 1054, 960, 10, 14, 2, [0.8, 1.3]), { wind: 0.12 });
  api.flora('flower-tree', ring(api, 1050, 990, 12, 5, 3, [0.8, 1.1]), { trunk: 0.04 });
  // Woods on the far side of everything, thick enough to be a place of their own (squeezed toward the village with
  // the rest of the north: the playtest of 2026-11-13, "you didn't compact them").
  api.flora('pine', [...field(api, 860, 930, 826, 856, 8), ...field(api, 1020, 1075, 832, 856, 8)].filter((p) => p.y > -3), { trunk: 0.035 });
  api.flora('gnarled-tree', [...field(api, 852, 900, 880, 905, 14), ...field(api, 850, 925, 975, 1005, 15)].filter((p) => p.y > -3), { trunk: 0.05 });
  // (Not in the village, the gate's ruin or the crowned head's mound.)
  api.flora('boulder', [...ring(api, 985, 870, 36, 12, 18, [0.8, 2]), ...ring(api, 900, 960, 40, 8, 20, [0.8, 2])].filter((p) => p.y > -3 && !(p.x > 960 && p.z > 890) && Math.hypot(p.x - 1000, p.z - 846.5) > 17 && Math.hypot(p.x - 908, p.z - 918) > 24));
}

/** The kingdom's margins: a purple wood north of Bucket Street, crystal outcrops by the court, more graves in the snow. */
export function dressKingdom(realm: RealmApi): void {
  // (Nothing grows on the checkered road: a dead tree from the field south of the plaza stood on it.)
  const offRoad = (p: Placement) => !(Math.abs(p.x - KINGDOM_ROAD.x) < KINGDOM_ROAD.half && p.z > KINGDOM_ROAD.z0 && p.z < KINGDOM_ROAD.z1);
  const api: RealmApi = Object.assign(Object.create(realm) as RealmApi, { flora: (id: string, ps: Placement[], opts?: Parameters<RealmApi['flora']>[2]) => realm.flora(id, ps.filter(offRoad), opts) });
  // (A wood you walk into, not a tree every 24 m; clear of the camp and the lamps.)
  // (On the land: the margins were cut back on 2026-11-12, so a field reaching past them stops at the rim.)
  const clear = (p: Placement) => p.y > 20 && Math.hypot(p.x - 863, p.z + 56) > 9 && ![[893, -56], [963, -56], [980, -58]].some(([x, z]) => Math.hypot(p.x - x, p.z - z) < 3.5);
  api.flora('purple-mushroom', field(api, 833, 985, -72, -42, 9).filter(clear), { trunk: 0.08 });
  api.flora('dead-forest-tree', [...field(api, 839, 980, -70, -44, 12).filter(clear), ...field(api, 823, 893, 80, 102, 12).filter((p) => p.y > 20)], { trunk: 0.05 });
  api.flora('purple-crystal', [...field(api, 928, 944, -170, -86, 13), ...field(api, 1058, 1074, -170, -86, 13)], { shadows: false });
  for (const [x, z] of [[893, -56], [963, -56], [980, -58]]) { prop(api, 'gothic-lamp', x, z, 0.3, 3); const g = glowSprite(0xc070ff, 2.4, 0.55, true); g.position.set(x, api.h(x, z) + 3.1, z); api.group.add(g); }
  camp(api, 863, -56);
  // (The bare south slab and the east dunes, empty on the 2026-11-03 walk: a fallen gatehouse, a toadstool ring, a
  // stand of dead trees.)
  // (Its pieces keep off the throne dragons: a column stood in the west one's claw.)
  ruin(api, COURT_RUIN.x, COURT_RUIN.z, COURT_RUIN.yaw, COURT_DRAGONS);
  shrooms(api, 1040, 80);
  api.flora('dead-forest-tree', field(api, 1004, 1062, 62, 96, 13).filter((p) => Math.hypot(p.x - 1040, p.z - 80) > 12 && p.y > 10), { trunk: 0.05 });
  graves(api, 1000, 124, 11);
  graves(api, 867, 86, 9);
  // (The dunes either side of the Skeleton Court, bare on the 2026-11-04 walk: a burial ground under dead trees west,
  // a fallen gatehouse east, the trees thinning out to the void.)
  // (The west burial ground went with the court's west dunes on 2026-11-13; the gatehouse came in off the new rim.)
  ruin(api, 1056, -120, 2.1);
  const courtSide = (p: Placement) => p.y > 23.5 && Math.hypot(p.x - 1056, p.z + 120) > 17;
  api.flora('dead-forest-tree', [...field(api, 906, 936, -172, -84, 11), ...field(api, 1064, 1096, -172, -84, 11)].filter(courtSide), { trunk: 0.05 });
  // (After the compaction of 2026-11-13, what the empty-space audit still found bare, each with its quarter's own things.)
  const lamp = (x: number, z: number) => { prop(api, 'gothic-lamp', x, z, 0.3, 3); const g = glowSprite(0xc070ff, 2.4, 0.55, true); g.position.set(x, api.h(x, z) + 3.1, z); api.group.add(g); };
  const brazier = (x: number, z: number) => { prop(api, 'brazier', x, z, 0.6, 1.3); api.vfx(fire(x, api.h(x, z) + 1.5, z, 0.7, 10, PURPLE_FIRE)); };
  const onLand = (p: Placement) => p.y > 23.5;
  // The castle's rock behind it, out to the rim: crystals and dead trees.
  api.flora('purple-crystal', field(api, 796, 812, -30, 70, 9).filter(onLand), { shadows: false });
  api.flora('dead-forest-tree', field(api, 800, 812, -20, 60, 16).filter(onLand), { trunk: 0.05 });
  // The street's north side between the round tower and the plaza: a brazier corner with its barrels.
  brazier(926, -24); brazier(942, -20);
  for (const [dx, dz] of [[-1.2, 2], [0.4, 2.8], [1.8, 1.6]]) prop(api, 'barrel', 933 + dx, -26 + dz, 0.45, 1, dx);
  // The moat's east bank at the street's corner.
  lamp(868, -30); lamp(868, 66);
  api.flora('purple-crystal', ring(api, 872, -20, 4, 5, 1.5, [0.7, 1.4]), { shadows: false });
  // The street's south side, where the bucket men wait.
  camp(api, 902, 62);
  // The plaza's north-east rim and the court's north-east corner.
  lamp(1052, -62); lamp(1052, -30); lamp(1050, 40);
  brazier(1048, -170); brazier(1048, -150);
  api.flora('purple-crystal', field(api, 1036, 1058, -178, -160, 6).filter(onLand), { shadows: false });
  // The snow's south rim.
  api.flora('dead-forest-tree', field(api, 905, 945, 176, 188, 10).filter(onLand), { trunk: 0.05 });
}

/** The drowned land round the sea king's city: wrecks, weed and old stones. */
export function dressSunken(api: RealmApi): void {
  wreck(api, -1070, -60, 0.6); wreck(api, -930, -100, 2.1); wreck(api, -1078, 58, 4); wreck(api, -926, 62, 1.2); wreck(api, -1000, 112, 3); wreck(api, -1000, -146, 5.2);
  // (Weed round the wrecks, ruins and skulls, never through them.)
  const taken: Array<[number, number, number]> = [[-1070, -60, 7], [-930, -100, 7], [-1078, 58, 7], [-926, 62, 7], [-1000, 112, 7], [-1000, -146, 7], [-1060, -115, 13], [-940, 25, 13], [-1062, 15, 13], [-945, -38, 8], [-1058, 108, 8]];
  const free = (p: Placement) => !taken.some(([x, z, r]) => Math.hypot(p.x - x, p.z - z) < r);
  // (Beds, not single stalks: the eye-level walk of 2026-11-03 found the outer seabed bare.)
  api.flora('kelp', [...field(api, -1095, -1045, -130, 120, 10), ...field(api, -955, -904, -130, 120, 10)].filter(free), { wind: 0.3 });
  api.flora('coral', [...field(api, -1090, -1050, -120, 110, 13), ...field(api, -950, -908, -120, 110, 13), ...field(api, -1040, -960, 84, 125, 17), ...field(api, -1040, -960, -158, -118, 17)].filter(free));
  for (const [x, z, yaw] of [[-1060, -115, 0.4], [-940, 25, 2], [-1062, 15, 1.2]] as const) ruin(api, x, z, yaw);
  prop(api, 'giant-skull', -945, -38, 2.4, 3, 2.2, 1.4);
  prop(api, 'giant-skull', -1058, 108, 2.4, 3, 0.6, 1.2);
  // (The outer bands east and west, still bare sand on the 2026-11-04 walk: thinner weed out to the rim, coral and
  // rocks among it, the odd fallen column.)
  const rim = (p: Placement) => Math.hypot(p.x + 1000, p.z) < 150 && p.y > -62 && free(p);
  const outer = [...field(api, -1152, -1098, -140, 140, 12), ...field(api, -902, -848, -140, 140, 12), ...field(api, -1090, -910, 126, 148, 12), ...field(api, -1090, -910, -148, -128, 12)].filter(rim);
  api.flora('kelp', outer.filter((_, i) => i % 3 !== 2), { wind: 0.3 });
  api.flora('coral', [...field(api, -1146, -1104, -130, 130, 19), ...field(api, -896, -854, -130, 130, 19)].filter(rim));
  api.flora('boulder', [...ring(api, -1125, -40, 14, 6, 4, [0.6, 1.4]), ...ring(api, -878, 40, 14, 6, 4, [0.6, 1.4]), ...ring(api, -1118, 70, 12, 5, 3, [0.6, 1.3]), ...ring(api, -884, -70, 12, 5, 3, [0.6, 1.3])].filter(rim));
  for (const [x, z] of [[-1128, -92], [-1112, 104], [-872, 96], [-886, -12]]) api.place(modelLandmark('ruin-column', x, z, api.h(x, z) - 0.3, { yaw: api.rnd() * 6 }));
}

/** Beyond the alley's walls: the older dead. */
export function dressGraveyard(api: RealmApi): void {
  // (Two more on the level ground by the walls; past them is only a thin lip over the drop.)
  for (const [x, z] of [[-31, -1100], [31, -1040], [-32, -985], [31, -925], [-30, -925], [30, -990], [-31, -1045], [31, -958]]) graves(api, x, z, 8);
}

/** The dream's open fractal floor between its sights: glowing toadstool rings and giant flowers (bare on the 2026-11-03 walk). */
export function dressDream(realm: RealmApi, floorY: number): void {
  // (The dream has no sculpted ground: its floor is a flat plane at floorY.)
  const api: RealmApi = Object.assign(Object.create(realm) as RealmApi, { h: () => floorY });
  for (const [x, z] of [[-110, 2505], [110, 2500], [-118, 2680], [90, 2700], [-50, 2690]]) {
    shrooms(api, x, z);
    api.flora('giant-flower', ring(api, x, z, 15, 6, 11, [0.8, 1.3]), { wind: 0.12 });
  }
  // (Still wide bare floor on the 2026-11-04 walk: more rings, and groves of crystal and giant flowers, each spot at
  // least 17 m from anything already standing.)
  for (const [x, z] of [[120, 2580], [60, 2665], [-130, 2610], [-20, 2470], [-80, 2720]]) {
    shrooms(api, x, z);
    api.flora('giant-flower', ring(api, x, z, 15, 5, 11, [0.8, 1.3]), { wind: 0.12 });
  }
  for (const [x, z] of [[140, 2620], [110, 2655], [30, 2720], [70, 2470], [0, 2650], [-60, 2640]]) {
    api.flora('purple-crystal', ring(api, x, z, 7, 7, 2, [0.9, 1.8]), { shadows: false });
    api.flora('giant-flower', ring(api, x, z, 12, 9, 4, [0.9, 1.5]), { wind: 0.12 });
  }
}

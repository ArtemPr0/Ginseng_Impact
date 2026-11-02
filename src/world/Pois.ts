/**
 * The places between the places: small scenes that give the land something to find. Each is built from models the
 * game already has, stands on the sculpted ground, and is set where the empty-ground map (scripts/perf/audit/empty.js)
 * showed nothing within reach. Their mobs are in ENEMY_SPAWNS, their chests in data/chests.ts.
 */
import { glowSprite } from '../render/Glow';
import { fire } from './Fire';
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

/** A fallen gatehouse: an arch still standing, columns, a run of wall. */
export function ruin(api: RealmApi, x: number, z: number, yaw: number): void {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const y = api.h(x, z);
  api.place(modelLandmark('ruin-arch', x, z, y - 0.3, { yaw }));
  for (const [dx, dz] of [[-9, 2], [8, -3], [-6, -8], [5, 7]]) {
    const px = x + dx * c - dz * s, pz = z + dx * s + dz * c;
    api.place(modelLandmark('ruin-column', px, pz, api.h(px, pz) - 0.2, { yaw: api.rnd() * 6 }));
  }
  for (const d of [-11, -7.5]) { const px = x + d * c + 6 * s, pz = z + d * s - 6 * c; api.place(modelLandmark('stone-wall', px, pz, api.h(px, pz) - 0.1, { yaw })); }
  api.flora('boulder', ring(api, x, z, 14, 5, 7, [0.7, 1.6]));
}

/** A little graveyard under a dead tree. */
export function graves(api: RealmApi, x: number, z: number, r = 11): void {
  api.flora('grave', ring(api, x, z, r, 7, 3));
  api.flora('grave-cross', ring(api, x, z, r, 4, 3));
  api.flora('rune-grave', ring(api, x, z, r, 2, 3));
  api.flora('dead-forest-tree', [{ x, y: api.h(x, z), z, yaw: api.rnd() * 6, scale: 1 }], { trunk: 0.5 });
}

/** A ring of toadstools with one giant among them, lit from under the caps. */
export function shrooms(api: RealmApi, x: number, z: number): void {
  api.flora('mushroom', ring(api, x, z, 9, 16, 4));
  api.flora('giant-mushroom', ring(api, x, z, 7, 3, 2, [0.9, 1.4]), { trunk: 0.5 });
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

/** A landing on the bank: a moored boat, barrels waiting, a lamp. */
export function pier(api: RealmApi, x: number, z: number, wx: number, y: number): void {
  api.place(modelLandmark('boat', wx, z, y, { yaw: Math.PI / 2, collider: 'none' }));
  for (const [dx, dz] of [[0, -2], [1.1, -2.6], [0.4, 2.2]]) prop(api, 'barrel', x + dx, z + dz, 0.45, 1);
  prop(api, 'lantern-post', x + 1.6, z, 0.2, 2.5);
  const g = glowSprite(LANTERN, 1.8, 0.6, true); g.position.set(x + 1.6, api.h(x, z) + 2.3, z); api.group.add(g);
}

/** A wreck half sunk in the silt, weed growing through it. */
export function wreck(api: RealmApi, x: number, z: number, yaw: number): void {
  const y = api.h(x, z);
  api.place(modelLandmark('boat', x, z, y - 0.5, { yaw, scale: 2, collider: 'manual', footprints: [{ kind: 'cyl', x, z, r: 2.2, top: y + 1 }] }));
  api.flora('kelp', ring(api, x, z, 7, 8, 2.5), { wind: 0.3 });
  api.flora('coral', ring(api, x, z, 8, 5, 3));
}

/** The Dragon's Vale: what lies round the village. */
export function dressVale(api: RealmApi): void {
  garden(api, 973, 1011, 13, 6);
  garden(api, 1034, 1000, 11, 8);
  pier(api, 958, 985, 951, -0.35);
  ruin(api, 1000, 830, 0.3);
  camp(api, 915, 815);
  graves(api, 882, 868);
  shrooms(api, 1046, 872);
  shrooms(api, 870, 925);
  api.flora('giant-flower', ring(api, 1058, 960, 13, 14, 2, [0.8, 1.3]), { wind: 0.12 });
  api.flora('flower-tree', ring(api, 1050, 990, 12, 5, 3, [0.8, 1.1]), { trunk: 0.4 });
  // Woods on the far side of everything, thick enough to be a place of their own.
  api.flora('pine', [...field(api, 860, 930, 790, 845, 11), ...field(api, 1020, 1075, 800, 845, 12)].filter((p) => p.y > -3), { trunk: 0.4 });
  api.flora('gnarled-tree', [...field(api, 852, 900, 880, 905, 14), ...field(api, 850, 925, 975, 1005, 15)].filter((p) => p.y > -3), { trunk: 0.5 });
  api.flora('boulder', [...ring(api, 985, 870, 60, 12, 30, [0.8, 2]), ...ring(api, 900, 960, 40, 8, 20, [0.8, 2])].filter((p) => p.y > -3));
}

/** The kingdom's margins: a purple wood north of Bucket Street, crystal outcrops by the court, more graves in the snow. */
export function dressKingdom(api: RealmApi): void {
  api.flora('purple-mushroom', field(api, 800, 985, -68, -46, 13), { trunk: 0.3 });
  api.flora('dead-forest-tree', [...field(api, 806, 980, -66, -48, 24), ...field(api, 790, 860, 82, 100, 17)], { trunk: 0.5 });
  api.flora('purple-crystal', [...field(api, 928, 944, -182, -98, 13), ...field(api, 1058, 1074, -182, -98, 13)], { shadows: false });
  for (const [x, z] of [[860, -56], [930, -56], [980, -58]]) { prop(api, 'gothic-lamp', x, z, 0.3, 3); const g = glowSprite(0xc070ff, 2.4, 0.55, true); g.position.set(x, api.h(x, z) + 3.1, z); api.group.add(g); }
  camp(api, 830, -56);
  graves(api, 972, 122, 13);
  graves(api, 812, 90, 9);
}

/** The drowned land round the sea king's city: wrecks, weed and old stones. */
export function dressSunken(api: RealmApi): void {
  wreck(api, -1070, -60, 0.6); wreck(api, -930, -100, 2.1); wreck(api, -1078, 58, 4); wreck(api, -926, 62, 1.2); wreck(api, -1000, 112, 3); wreck(api, -1000, -146, 5.2);
  api.flora('kelp', [...field(api, -1095, -1045, -130, 120, 15), ...field(api, -955, -908, -130, 120, 15)], { wind: 0.3 });
  api.flora('coral', [...field(api, -1090, -1050, -120, 110, 21), ...field(api, -950, -912, -120, 110, 21), ...field(api, -1040, -960, 84, 125, 17), ...field(api, -1040, -960, -158, -118, 17)]);
  for (const [x, z, yaw] of [[-1060, -115, 0.4], [-940, 25, 2], [-1062, 15, 1.2]] as const) ruin(api, x, z, yaw);
  prop(api, 'giant-skull', -945, -38, 2.4, 3, 2.2, 1.4);
  prop(api, 'giant-skull', -1058, 108, 2.4, 3, 0.6, 1.2);
}

/** Beyond the alley's walls: the older dead. */
export function dressGraveyard(api: RealmApi): void {
  for (const [x, z] of [[-31, -1100], [31, -1040], [-32, -985], [31, -925], [-30, -925], [30, -990]]) graves(api, x, z, 8);
}

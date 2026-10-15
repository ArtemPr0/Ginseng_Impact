/**
 * The places the fifth batch of reels added: the galaxy city beyond the portal, the sunken city under the lake,
 * and the new sites on the island (the portal clearing, the mushroom tavern, the world tree, the spire-city view).
 * Every structure and prop is a Meshy model by id; floors are stone slabs until their floor models exist.
 */
import { Group, PointLight, Vector3 } from 'three';
import { GALAXY, ISLAND_PORTALS, LAYOUT, SUNKEN } from '../data/world';
import { MODELS } from '../data/models';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import { waterfall } from './Falls';
import { fire } from './Fire';
import type { FloraOptions, Placement } from './Flora';
import type { Landmark } from './Landmarks';
import { modelLandmark } from './ModelLandmark';
import { PRESENT_MODELS } from '../data/colliderGrids';
import { portal, type PortalLink } from './Portal';
import { chasmBridge, floorSlab } from './Walkways';

export interface RealmApi {
  /** Where new objects go: the island, or the realm last selected with `realm()`. */
  readonly group: Group;
  /** Builds what follows into a realm's own group (shown only while the player is inside it); null = the island. */
  realm(id: string | null): void;
  place(l: Landmark): void;
  flora(id: string, placements: Placement[], opts?: FloraOptions): void;
  vfx(f: { group: Group; update(dt: number): void }): void;
  /** Terrain height on the island. */
  h(x: number, z: number): number;
  rnd(): number;
}

/** Camera yaw that looks along controller yaw `yaw` (controller: direction (cos, sin); camera: forward (−sin, −cos)). */
function cameraYawFor(yaw: number): number {
  return Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
}

function link(at: Vector3, radius: number, height: number, x: number, z: number, yaw: number, name: string): PortalLink {
  return { at, radius, height, to: { x, z, yaw, cameraYaw: cameraYawFor(yaw) }, name };
}

/** Rotation that turns a model's front (local +z) toward world direction `yaw` (cos, sin). */
const face = (yaw: number) => Math.PI / 2 - yaw;

function glowAt(api: RealmApi, color: number, size: number, x: number, y: number, z: number, opacity = 0.5): void {
  const s = glowSprite(color, size, opacity, true);
  s.position.set(x, y, z);
  api.group.add(s);
}

/** Builds everything and returns the portal links between the island and the realms. */
export function buildRealms(api: RealmApi): PortalLink[] {
  const links: PortalLink[] = [];
  const G = GALAXY;
  const S = SUNKEN;

  // ===== Island: the portal clearing by the face tree (DeQ-NnpvqF6) =====
  const P = ISLAND_PORTALS.galaxy;
  const py = api.h(P.x, P.z);
  const ft = P.faceTree;
  api.place(modelLandmark('face-tree', ft.x, ft.z, api.h(ft.x, ft.z) - 0.3, { yaw: face(Math.atan2(-15, 4)), footprints: [{ kind: 'cyl', x: ft.x, z: ft.z, r: 2.6, top: api.h(ft.x, ft.z) + 8 }] }));
  const stones: Placement[] = [];
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const x = -43 + (P.x + 3 - -43) * t + (api.rnd() - 0.5) * 0.8;
    const z = -17 + (P.z - -17) * t + (api.rnd() - 0.5) * 0.8;
    stones.push({ x, y: api.h(x, z) + 0.02, z, yaw: api.rnd() * 6, scale: 0.9 + api.rnd() * 0.4 });
  }
  api.flora('stepping-stone', stones, { shadows: false });
  api.place(portal(P.x, py + 2.6, P.z, 2.4, { vertical: true, facing: 0 }));
  // Lanterns hang from the face tree's lower branches beside the portal.
  const lanterns: Placement[] = [];
  const ftY = api.h(ft.x, ft.z);
  for (const a of [-2.4, -1.7, -0.9, 2.6]) {
    const x = ft.x + Math.cos(a) * 4.6;
    const z = ft.z + Math.sin(a) * 4.6;
    lanterns.push({ x, y: ftY + 3.6, z, yaw: 0, scale: 1 });
    glowAt(api, PALETTE.dusk, 1.4, x, ftY + 3.8, z);
  }
  api.flora('hanging-lantern', lanterns);
  links.push(link(new Vector3(P.x, py + 1, P.z), 1.8, 3, G.x, G.z + 60, -Math.PI / 2, G.name));

  // ===== Island: the whirlpool in the lily pond, the way down to the sunken city (DeVj-Z8POjl) =====
  const pond = ISLAND_PORTALS.pond;
  api.place(portal(pond.x, 1.06, pond.z, 3, { vertical: false, colors: [PALETTE.abyss, PALETTE.rune], spin: -1 }));
  links.push(link(new Vector3(pond.x, 0.5, pond.z), 2.6, 3, S.x, S.z + 22, -Math.PI / 2, S.name));

  // ===== Island: the mushroom tavern between the frog hollow and the pond (DaIqFavJWbd) =====
  const tx = -40, tz = -24;
  const tables: Placement[] = [[0, 0, 0.2], [4, -4, 1.6], [-4, -4, -1.2]].map(([dx, dz, yaw]) => ({ x: tx + dx, y: api.h(tx + dx, tz + dz), z: tz + dz, yaw, scale: 1 }));
  api.flora('tavern-table', tables);
  if (PRESENT_MODELS.has('tavern-table')) for (const t of tables) api.place({ object: new Group(), footprints: [{ kind: 'box', x: t.x, z: t.z, hw: 1.6, hd: 0.6, top: t.y + 0.95, rotY: -t.yaw }] });
  const lamps: Placement[] = [];
  const lampColors = [PALETTE.blood, PALETTE.rune, PALETTE.witch, PALETTE.dusk, PALETTE.moon];
  // The lamps hang over the tavern's tables: with no tables (model not made yet) there is nothing to hang them from.
  if (PRESENT_MODELS.has('tavern-table')) for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2 + api.rnd() * 0.3;
    const r = 3 + api.rnd() * 6;
    const x = tx + Math.cos(a) * r;
    const z = tz - 2 + Math.sin(a) * r;
    const y = api.h(x, z) + 3.2 + api.rnd() * 2;
    lamps.push({ x, y, z, yaw: api.rnd() * 6, scale: 0.7 + api.rnd() * 0.6 });
    glowAt(api, lampColors[i % lampColors.length], 1.4, x, y - 0.2, z, 0.55);
  }
  api.flora('mushroom-lamp', lamps, { shadows: false });
  if (PRESENT_MODELS.has('tavern-table')) {
    const tavLight = new PointLight(PALETTE.dusk, 26, 18, 1.6);
    tavLight.position.set(tx, api.h(tx, tz) + 4, tz - 2);
    api.group.add(tavLight);
  }

  // ===== Island: the world tree in the dead wood (Ddn0A49tnW7) =====
  const wx = LAYOUT.worldTree.x, wz = LAYOUT.worldTree.z;
  const wy = api.h(wx, wz);
  api.place(modelLandmark('world-tree', wx, wz, wy - 0.5));
  const graves: Placement[] = [];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * 0.15 + (i / 6) * Math.PI * 0.7;
    const x = wx + Math.cos(a) * 9;
    const z = wz + Math.sin(a) * 9;
    graves.push({ x, y: api.h(x, z), z, yaw: face(Math.atan2(wz - z, wx - x)), scale: 0.9 + api.rnd() * 0.3 });
    if (PRESENT_MODELS.has('rune-grave')) glowAt(api, PALETTE.rune, 1.2, x, api.h(x, z) + 1.1, z, 0.35);
  }
  api.flora('rune-grave', graves);
  for (let k = 0; k < 6; k++) glowAt(api, PALETTE.electric, 3 + k * 0.4, wx + (api.rnd() - 0.5) * 3, wy + 3 + k * 3, wz + (api.rnd() - 0.5) * 3, 0.3);
  api.place(waterfall(wx - 7, wz - 9, wy + 18, 3, 18));
  api.place(waterfall(wx + 7, wz - 9, wy + 18, 3, 18));

  // ===== Island: the spire city across the water, watched by the lantern witch (DdwXCyeSsXn) =====
  api.place(modelLandmark('spire-city', -330, 20, -40, { yaw: face(0), color: PALETTE.electric }));

  // ===== The galaxy city =====
  api.realm(G.id);
  const gy = G.y;
  api.place(floorSlab(G.x, G.z - 5, gy, 120, 160));
  // Checkered causeway with towers either side (DeOemU1BOZF).
  const road: Placement[] = [];
  for (let z = G.z + 69; z > G.z - 44; z -= 6) road.push({ x: G.x, y: gy + 0.02, z, yaw: 0, scale: 1 });
  api.flora('checker-road', road, { shadows: false });
  for (const z of [52, 30, 8, -14]) {
    for (const side of [-1, 1]) {
      const x = G.x + side * 11;
      api.place(modelLandmark('round-tower', x, G.z + z, gy, { yaw: face(side < 0 ? 0 : Math.PI), footprints: [{ kind: 'cyl', x, z: G.z + z, r: 3.6, top: gy + 22 }] }));
    }
  }
  for (let z = 60; z > -40; z -= 16) {
    for (const side of [-1, 1]) {
      const x = G.x + side * 4.6;
      api.place(modelLandmark('brazier', x, G.z + z, gy, { footprints: [{ kind: 'cyl', x, z: G.z + z, r: 0.6, top: gy + 1.3 }] }));
      api.vfx(fire(x, gy + 1.5, G.z + z, 0.5, 8));
    }
  }
  // Return portal in a ring, the ring portals and the void monk (DdyN2PNyIxb).
  api.place(modelLandmark('ring-portal', G.x, G.z + 72, gy, { yaw: face(-Math.PI / 2) }));
  api.place(portal(G.x, gy + 3.9, G.z + 72, 1.65, { vertical: true, facing: -Math.PI / 2 }));
  links.push(link(new Vector3(G.x, gy + 1, G.z + 72), 1.6, 3, -49, -13, 0, 'The Island'));
  for (const [dx, dy, dz, spin] of [[-12, 9, 76, 0.3], [12, 11, 76, -0.25], [0, 16, 82, 0.2]] as const) {
    let a = 0;
    api.place(modelLandmark('ring-portal', G.x + dx, G.z + dz, gy + dy, { yaw: face(-Math.PI / 2), collider: 'none', update: (dt, root) => { a += dt * spin; root.rotation.z = Math.sin(a) * 0.2; root.position.y = gy + dy + Math.sin(a * 2) * 0.4; } }));
    api.place(portal(G.x + dx, gy + dy + 3.9, G.z + dz, 1.65, { vertical: true, facing: -Math.PI / 2, colors: [PALETTE.void, PALETTE.electric] }));
  }
  // The river hall of the galaxy king (Dd0wR9Jh2lH).
  api.place(modelLandmark('galaxy-hall', G.x, G.z - 66, gy, { yaw: face(Math.PI / 2) }));
  api.place(modelLandmark('marble-throne', G.x, G.z - 75, gy, { yaw: face(Math.PI / 2), footprints: [{ kind: 'box', x: G.x, z: G.z - 75.6, hw: 1.8, hd: 1.2, top: gy + 0.8 }] }));
  // The skeleton king's treasury, west (DeOemU1BOZF).
  api.place(modelLandmark('stone-throne', 962, G.z - 57, gy, { yaw: face(0), footprints: [{ kind: 'box', x: 961.4, z: G.z - 57, hw: 1.2, hd: 1.6, top: gy + 0.9 }] }));
  const coins: Placement[] = [[968, -52], [970, -61], [966, -65], [958, -50], [956, -63], [973, -56]].map(([x, z]) => ({ x, y: gy, z: G.z + z, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 0.5 }));
  api.flora('coin-block', coins);
  for (const c of coins) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: c.x, z: c.z, r: 0.7 * c.scale, top: gy + 1.1 * c.scale }] });
  const crystals: Placement[] = [];
  for (let i = 0; i < 10; i++) { const x = 952 + api.rnd() * 26; const z = G.z - 48 - api.rnd() * 20; crystals.push({ x, y: gy, z, yaw: api.rnd() * 6, scale: 0.6 + api.rnd() * 1.2 }); glowAt(api, PALETTE.dusk, 1.4, x, gy + 0.6, z, 0.4); }
  api.flora('purple-crystal', crystals, { shadows: false });
  // The skeleton lord's pavilion, east (DeXn5rSPxR8).
  api.place(modelLandmark('gothic-pavilion', 1035, G.z - 55, gy, { yaw: face(Math.PI) }));
  // Dragon riders circling the city (DeYtKbMh76x).
  let da = 0;
  api.place(modelLandmark('dragon-riders', G.x + 80, G.z, gy + 42, { clip: 'fly', color: PALETTE.dusk, collider: 'none', update: (dt, root) => {
    da += dt * 0.12;
    root.position.set(G.x + Math.cos(da) * 80, gy + 42 + Math.sin(da * 3) * 4, G.z + Math.sin(da) * 80);
    root.rotation.y = face(da + Math.PI / 2);
    root.rotation.z = -0.25;
  } }));
  // The bucket mimics' street, west at z = 20 (DeaqHWJBBPw).
  for (const x of [986, 970, 954]) {
    for (const [z, yaw] of [[9, Math.PI / 2], [31, -Math.PI / 2]] as const) {
      api.place(modelLandmark('purple-house', x, G.z + z, gy, { yaw: face(yaw), footprints: [{ kind: 'box', x, z: G.z + z, hw: 4.2, hd: 4.2, top: gy + 9 }] }));
    }
  }
  const shrooms: Placement[] = [];
  for (let x = 990; x > 945; x -= 6) for (const z of [14, 26]) { shrooms.push({ x, y: gy, z: G.z + z, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 0.5 }); glowAt(api, PALETTE.dusk, 1.8, x, gy + 2, G.z + z, 0.45); }
  api.flora('purple-mushroom', shrooms, { shadows: false });
  // The star brewer's tower at the street's end (DeQ-NnpvqF6).
  api.place(modelLandmark('round-tower', 945, G.z - 20, gy, { yaw: face(0), footprints: [{ kind: 'cyl', x: 945, z: G.z - 20, r: 3.6, top: gy + 22 }] }));
  // Floating isles joined by rope bridges, with the goblin market on the last (DdnJDwBMUoj).
  const isles: Array<[number, number]> = [[1082, 10], [1108, -12], [1136, 14]];
  for (const [x, z] of isles) {
    const scale = 3;
    // The stone slab is the walk surface; the island model is the rock under it.
    api.place(modelLandmark('floating-island', x, z, gy - MODELS['floating-island'].height * scale, { scale, collider: 'none' }));
    api.place(floorSlab(x, z, gy, 13, 13));
  }
  api.flora('gnarled-tree', isles.flatMap(([x, z]) => [{ x: x - 4, y: gy, z: z + 3, yaw: api.rnd() * 6, scale: 1.2 }, { x: x + 3, y: gy, z: z - 4, yaw: api.rnd() * 6, scale: 1 }]));
  const spans: Array<[number, number, number, number]> = [[1059, 10, 1074, 10], [1088, 4, 1102, -6], [1114, -6, 1130, 8]];
  for (const [ax, az, bx, bz] of spans) {
    const b = chasmBridge(ax, az, bx, bz, gy, MODELS['chasm-bridge'].height);
    api.place(b);
    api.flora('chasm-bridge', b.tiles);
  }
  api.place(modelLandmark('market-stall', 1134, 9, gy, { yaw: face(Math.PI / 2), footprints: [{ kind: 'box', x: 1134, z: 9, hw: 1.8, hd: 1.2, top: gy + 1.1 }] }));
  api.place(modelLandmark('market-stall', 1140, 17, gy, { yaw: face(-Math.PI / 2), footprints: [{ kind: 'box', x: 1140, z: 17, hw: 1.8, hd: 1.2, top: gy + 1.1 }] }));
  api.place(modelLandmark('crystal-ball', 1134.4, 9.6, gy + 1.1, { color: PALETTE.dusk }));
  glowAt(api, PALETTE.dusk, 1.6, 1134.4, gy + 1.5, 9.6, 0.6);

  // ===== The sunken city =====
  api.realm(S.id);
  const sy = S.y;
  api.place(floorSlab(S.x, S.z, sy, 110, 110));
  api.place(modelLandmark('sunken-tavern', S.x, S.z - 24, sy, { yaw: face(Math.PI / 2), footprints: [{ kind: 'box', x: S.x, z: S.z - 28.5, hw: 10.5, hd: 1.8, top: sy + 11 }] }));
  api.place(modelLandmark('coral-throne', S.x - 4, S.z - 13, sy, { yaw: face(Math.PI / 2), footprints: [{ kind: 'box', x: S.x - 4, z: S.z - 13.4, hw: 1.3, hd: 1, top: sy + 0.8 }] }));
  let ca = 0;
  api.place(modelLandmark('giant-crown', S.x, S.z - 16, sy + 11, { collider: 'none', update: (dt, root) => { ca += dt; root.rotation.y = Math.sin(ca * 0.3) * 0.2; root.position.y = sy + 11 + Math.sin(ca * 0.8) * 0.2; } }));
  const sTables: Placement[] = [[-6, -6, 0], [6, -6, 0]].map(([dx, dz, yaw]) => ({ x: S.x + dx, y: sy, z: S.z + dz, yaw, scale: 1 }));
  api.flora('tavern-table', sTables);
  if (PRESENT_MODELS.has('tavern-table')) for (const t of sTables) api.place({ object: new Group(), footprints: [{ kind: 'box', x: t.x, z: t.z, hw: 1.6, hd: 0.6, top: sy + 0.95 }] });
  if (PRESENT_MODELS.has('tavern-table')) api.flora('candle', sTables.flatMap((t) => [-1, 0, 1].map((k) => ({ x: t.x + k * 0.9, y: sy + 0.95, z: t.z, yaw: 0, scale: 1 }))), { shadows: false });
  if (PRESENT_MODELS.has('tavern-table')) for (const t of sTables) for (const k of [-1, 0, 1]) glowAt(api, PALETTE.dusk, 0.5, t.x + k * 0.9, sy + 1.4, t.z, 0.6);
  const barrels: Placement[] = [[-10, -14], [-11.5, -12], [10, -14], [11.6, -12.4], [-8, 4], [9, 6]].map(([dx, dz]) => ({ x: S.x + dx, y: sy, z: S.z + dz, yaw: api.rnd() * 6, scale: 1 }));
  api.flora('barrel', barrels);
  for (const b of barrels) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: b.x, z: b.z, r: 0.5, top: sy + 1.1 }] });
  const coral: Placement[] = [];
  for (let i = 0; i < 28; i++) { const a = api.rnd() * Math.PI * 2; const r = 16 + api.rnd() * 30; coral.push({ x: S.x + Math.cos(a) * r, y: sy, z: S.z + Math.sin(a) * r, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 1.6 }); }
  api.flora('coral', coral, { shadows: false });
  const jelly: Placement[] = [];
  const jellySeed: Array<{ cx: number; cz: number; r: number; h: number; s: number; p: number }> = [];
  for (let i = 0; i < 16; i++) {
    const seed = { cx: S.x + (api.rnd() - 0.5) * 50, cz: S.z + (api.rnd() - 0.5) * 50, r: 2 + api.rnd() * 6, h: sy + 4 + api.rnd() * 10, s: 0.1 + api.rnd() * 0.2, p: api.rnd() * 6 };
    jellySeed.push(seed);
    jelly.push({ x: seed.cx, y: seed.h, z: seed.cz, yaw: 0, scale: 0.6 + api.rnd() * 0.8 });
  }
  api.flora('jellyfish', jelly, { shadows: false, update: (t, ps) => {
    ps.forEach((p, i) => { const s = jellySeed[i]; const a = t * s.s + s.p; p.x = s.cx + Math.cos(a) * s.r; p.z = s.cz + Math.sin(a) * s.r; p.y = s.h + Math.sin(t * 0.7 + s.p) * 1.2; p.yaw = -a; });
    return true;
  } });
  const glowJelly = new Group();
  for (let i = 0; i < 16; i++) glowJelly.add(glowSprite(PALETTE.rune, 2.2, 0.35, true));
  api.vfx({ group: glowJelly, update: () => { const t = performance.now() / 1000; glowJelly.children.forEach((c, i) => { const s = jellySeed[i]; const a = t * s.s + s.p; c.position.set(s.cx + Math.cos(a) * s.r, s.h + 0.6 + Math.sin(t * 0.7 + s.p) * 1.2, s.cz + Math.sin(a) * s.r); }); } });
  const hearth = new PointLight(PALETTE.rune, 60, 30, 1.6);
  hearth.position.set(S.x, sy + 3, S.z - 17);
  api.group.add(hearth);
  // The bubble column home.
  api.place(portal(S.x, sy + 0.06, S.z + 30, 2.6, { vertical: false, colors: [PALETTE.abyss, PALETTE.moon], spin: 1 }));
  for (let k = 0; k < 8; k++) glowAt(api, PALETTE.moon, 0.8, S.x + (api.rnd() - 0.5) * 2, sy + 1 + k * 1.6, S.z + 30 + (api.rnd() - 0.5) * 2, 0.4);
  links.push(link(new Vector3(S.x, sy + 0.5, S.z + 30), 2.2, 3, ISLAND_PORTALS.pond.shore.x, ISLAND_PORTALS.pond.shore.z, 0, 'The Lily Pond'));

  api.realm(null);
  return links;
}

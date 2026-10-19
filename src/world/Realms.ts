/**
 * The places the fifth batch of reels added: the galaxy city beyond the portal, the sunken city under the lake,
 * and the new sites on the island (the portal clearing, the mushroom tavern, the world tree, the spire-city view).
 * Every structure and prop is a Meshy model by id; floors are stone slabs until their floor models exist.
 */
import { Group, PointLight, Vector3 } from 'three';
import { GALAXY, ISLAND_PORTALS, LAYOUT, SUNKEN } from '../data/world';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import { fire } from './Fire';
import type { FloraOptions, Placement } from './Flora';
import type { Landmark } from './Landmarks';
import { modelLandmark } from './ModelLandmark';
import { PRESENT_MODELS } from '../data/colliderGrids';
import { portal, type PortalLink } from './Portal';
import { buildSunken, SUNKEN_ARRIVAL } from './Sunken';
import { buildVale } from './Vale';
import { patchWingFlap } from '../render/Materials';
import type { HostileShot } from '../combat/CombatSystem';

export interface RealmApi {
  /** Where new objects go: the island, or the realm last selected with `realm()`. */
  readonly group: Group;
  /** Builds what follows into a realm's own group (shown only while the player is inside it); null = the island. */
  realm(id: string | null): void;
  place(l: Landmark): void;
  flora(id: string, placements: Placement[], opts?: FloraOptions): void;
  vfx(f: { group: Group; update(dt: number): void }): void;
  /** A shot at the hero from something in this world (the dragon's fire). */
  shoot?(from: Vector3, s: HostileShot): void;
  /** Swimmable water (a realm's river or moat): surface `level` over [x0, x1] × [z0, z1]. */
  water?(x0: number, x1: number, z0: number, z1: number, level: number): void;
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
  // Lanterns hang from the face tree's lower branches beside the portal (at -2.4 rad there was no branch over it).
  const lanterns: Placement[] = [];
  const ftY = api.h(ft.x, ft.z);
  for (const a of [-1.7, -0.9, 2.6]) {
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
  links.push(link(new Vector3(pond.x, 0.5, pond.z), 2.6, 3, SUNKEN_ARRIVAL.x, SUNKEN_ARRIVAL.z, -Math.PI / 2, S.name));

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
    // In a ring just outside the tree's roots.
    const x = wx + Math.cos(a) * 18;
    const z = wz + Math.sin(a) * 18;
    graves.push({ x, y: api.h(x, z), z, yaw: face(Math.atan2(wz - z, wx - x)), scale: 0.9 + api.rnd() * 0.3 });
    if (PRESENT_MODELS.has('rune-grave')) glowAt(api, PALETTE.rune, 1.2, x, api.h(x, z) + 1.1, z, 0.35);
  }
  api.flora('rune-grave', graves);
  for (let k = 0; k < 6; k++) glowAt(api, PALETTE.electric, 3 + k * 0.4, wx + (api.rnd() - 0.5) * 3, wy + 3 + k * 3, wz + (api.rnd() - 0.5) * 3, 0.3);

  // ===== Island: the spire city across the water, watched by the lantern witch (DdwXCyeSsXn) =====
  api.place(modelLandmark('spire-city', -330, 20, -40, { yaw: face(0), color: PALETTE.electric }));

  // ===== The galaxy city =====
  api.realm(G.id);
  const gy = G.y;
  // (The floor, the sky, the streams and the cup islands are Yung Lean's kingdom: see Kingdom.ts.)
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
  // (The treasury, Bucket Street and the rest of the Lean Quarter: LeanQuarter.ts.)
  // The Lean-Chucker's pavilion, east (DeXn5rSPxR8's dome; the skeleton lord has his own in the court).
  api.place(modelLandmark('gothic-pavilion', 1035, G.z - 55, gy, { yaw: face(Math.PI) }));
  // Dragon riders circling the city (DeYtKbMh76x): wings beating (the mesh has no bones: a vertex flap), and purple
  // fire for anyone who flies up close.
  let da = 0;
  let breath = 0;
  let cool = 2;
  const mouth = new Vector3();
  const DRAGON_FIRE = { speed: 24, color: PALETTE.dusk, atk: 105, kind: 'fire' as const, size: 1.7, radius: 1.1 };
  api.place(modelLandmark('dragon-riders', G.x + 80, G.z, gy + 42, { clip: 'fly', color: PALETTE.dusk, collider: 'none',
    onLoad: (m) => { for (const mat of m.materials) patchWingFlap(mat, { x0: 0.22, rootY: 0.45, rate: 3.4, amp: 0.75 }); },
    update: (dt, root, _m, player) => {
      da += dt * 0.09;
      // A wide loop over every quarter: the court, the castle, the snow chapel, the sky dock.
      root.position.set(G.x - 40 + Math.cos(da) * 130, gy + 42 + Math.sin(da * 3) * 4, G.z - 20 + Math.sin(da) * 120);
      root.rotation.y = face(da + Math.PI / 2);
      root.rotation.z = -0.25;
      // A hero in the air near it gets a gout of fire (bursts of bolts from the jaws, then a breath).
      const near = player.distanceTo(root.position) < 28 && player.y > gy + 4;
      cool -= dt;
      if (near && cool <= 0 && breath <= 0) { breath = 1.1; cool = 4; }
      if (breath > 0) {
        const before = breath;
        breath -= dt;
        if (Math.floor(before / 0.14) !== Math.floor(Math.max(0, breath) / 0.14)) {
          root.updateWorldMatrix(true, false);
          api.shoot?.(root.localToWorld(mouth.set(0, 2.2, 2.8)), { ...DRAGON_FIRE, spread: (Math.random() - 0.5) * 0.12 });
        }
      }
    } }));

  // ===== The sunken city (DeVj-Z8POjl): Sunken.ts; the Dragon's Vale (Dd5Bqt7vQ5T): Vale.ts =====
  links.push(...buildSunken(api, link));
  links.push(...buildVale(api, link));

  api.realm(null);
  return links;
}

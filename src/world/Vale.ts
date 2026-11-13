/**
 * The Dragon's Vale (reel Dd5Bqt7vQ5T), reached through the lantern arch at the east end of the island's village
 * street. Walking north from the arch:
 *  - the tavern yard: long tables and a campfire before the tavern, whose door leads into the taproom where the
 *    candle-headed man and the dwarves raise candle-lit tankards (Interiors.ts);
 *  - the village street: thatched houses with warm windows and smoking chimneys, lanterns on their fronts, stalls,
 *    villagers, a beggar on a barrel;
 *  - at the street's end, a huge green dragon lying behind the last houses, a hooded mage reading on its claw;
 *  - west, over a river and a stone bridge between braziers, a crowned stone head lies on its hill under the aurora;
 *  - east, past the vale's edge, a gothic castle floats over the clouds on its rock, pouring waterfalls, with chained
 *    platforms and lanterns hanging round it, a purple vortex turning above and two big moons on the horizon.
 * Buildings, props and creatures are Meshy models by id; the ground, water, fire, smoke and sky are procedural.
 */
import { Color, Group, type Mesh, type MeshStandardMaterial, Vector3 } from 'three';
import { CLOUD_LEVEL, ISLAND_PORTALS, VALE } from '../data/world';
import { MODELS } from '../data/models';
import { glowSprite } from '../render/Glow';
import { horizonMoon, skyVortex } from '../render/LeanFx';
import { patchLitWindows, patchNeckTurn } from '../render/Materials';
import { PipeSmoke } from '../render/Smoke';
import { cascade } from './Falls';
import { fire } from './Fire';
import type { Placement } from './Flora';
import type { ModelRig } from '../models/ModelRig';
import { modelLandmark } from './ModelLandmark';
import { PRESENT_MODELS } from '../data/colliderGrids';
import { portal, type PortalLink } from './Portal';
import type { RealmApi } from './Realms';
import { chainSpan, witchBridgeDeck } from './Walkways';
import { waterRibbon } from './Water';
import { VALE_MEANDER_AMP, VALE_STREET, valeMeander } from '../data/sculpts';
import { dressVale } from './Pois';
import { ferryAt, type FerryRun } from './Ferry';
import { Rig } from '../characters/Rig';
import { yawToRotation } from '../models/ModelRig';

const PALETTE_GOLD = 0xffc23a;

/** Rotation that turns a model's front (local +z) toward world direction `yaw` (cos, sin). */
const face = (yaw: number) => Math.PI / 2 - yaw;
const LANTERN = 0xffa040;
/** How high over the vale the castle's rock foot hangs: low enough for its west shelf to be walked to. */
const VALE_CASTLE_LIFT = 3;
/** Where the hero comes in from the island, at the street's south end, facing north up it. */
export const VALE_ARRIVAL = { x: VALE.x, z: VALE.z + 106 };

function restyle(model: ModelRig, fn: (mat: MeshStandardMaterial) => void): void {
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    fn(mat);
    m.material = mat;
  });
}

/** Builds the vale and the arch to it on the island; returns both ways through. */
export function buildVale(api: RealmApi, link: (at: Vector3, radius: number, height: number, x: number, z: number, yaw: number, name: string) => PortalLink): PortalLink[] {
  const links: PortalLink[] = [];
  const V = VALE;
  const vy = V.y;
  const X = V.x, Z = V.z;

  // ===== On the island: the lantern arch at the east end of the village street =====
  const A = ISLAND_PORTALS.vale;
  const ay = api.h(A.x, A.z);
  api.place(portal(A.x, ay + 2.4, A.z, 1.7, { vertical: true, facing: Math.PI, colors: [0x0a2a1a, 0xffb050] }));
  for (const dz of [-2.4, 2.4]) {
    api.place(modelLandmark('lantern-post', A.x, A.z + dz, ay, { footprints: [{ kind: 'cyl', x: A.x, z: A.z + dz, r: 0.2, top: ay + 2.5 }] }));
    const s = glowSprite(LANTERN, 1.6, 0.55, true);
    s.position.set(A.x, ay + 2.3, A.z + dz);
    api.group.add(s);
  }
  links.push(link(new Vector3(A.x, ay + 1, A.z), 1.6, 3, VALE_ARRIVAL.x, VALE_ARRIVAL.z, -Math.PI / 2, V.name));

  // ===== The vale =====
  api.realm(V.id);
  const glow = (color: number, size: number, x: number, y: number, z: number, opacity = 0.5) => {
    const s = glowSprite(color, size, opacity, true);
    s.position.set(x, y, z);
    api.group.add(s);
    return s;
  };
  const fx = new Group();
  const updates: Array<(dt: number) => void> = [];
  api.vfx({ group: fx, update: (dt) => { for (const u of updates) u(dt); } });
  // The vale stands on its sculpt, open to its cliffs; the river is water over the sculpted bed.
  const z0 = Z - 120, z1 = Z + 125;
  const riverX = X - 45;
  // The way home: the arch behind where you arrive, between two lantern posts like the island's (it hung alone).
  api.place(portal(X, vy + 2.4, VALE_ARRIVAL.z + 8, 1.7, { vertical: true, facing: -Math.PI / 2, colors: [0x0a2a1a, 0xffb050] }));
  for (const dx of [-2.4, 2.4]) {
    api.place(modelLandmark('lantern-post', X + dx, VALE_ARRIVAL.z + 8, vy, { footprints: [{ kind: 'cyl', x: X + dx, z: VALE_ARRIVAL.z + 8, r: 0.2, top: vy + 2.5 }] }));
    glow(LANTERN, 1.6, X + dx, vy + 2.3, VALE_ARRIVAL.z + 8, 0.55);
  }
  links.push(link(new Vector3(X, vy + 1, VALE_ARRIVAL.z + 8), 1.6, 3, A.x - 3, A.z, Math.PI, 'The Village'));

  // --- The tavern yard (the reel's toast is inside: Interiors.ts, through the tavern's front door) ---
  api.place(modelLandmark('tavern', X + 24, Z + 76, vy, { yaw: face(Math.PI) }));
  for (const z of [Z + 73, Z + 78.4]) {
    api.flora('tavern-table', [{ x: X + 15, y: vy, z, yaw: 0, scale: 1.2 }]);
    api.place({ object: new Group(), footprints: [{ kind: 'box', x: X + 15, z, hw: 1.9, hd: 0.7, top: vy + 1.1 }] });
    api.flora('candle', [-1.2, 0, 1.2].map((dx) => ({ x: X + 15 + dx, y: vy + 1.12, z, yaw: 0, scale: 1 })), { shadows: false });
    for (const dx of [-1.2, 0, 1.2]) glow(0xffb050, 0.7, X + 15 + dx, vy + 1.5, z, 0.55);
    api.flora('tankard', [-0.6, 0.6].map((dx) => ({ x: X + 15 + dx, y: vy + 1.12, z: z + 0.25, yaw: api.rnd() * 6, scale: 1 })), { shadows: false });
  }
  api.place(modelLandmark('campfire', X + 19, Z + 66, vy));
  api.vfx(fire(X + 19, vy + 0.3, Z + 66, 1, 18));
  const yardBarrels: Placement[] = [[X + 10, Z + 82], [X + 11.4, Z + 83.4], [X + 20, Z + 84]].map(([x, z]) => ({ x, y: vy, z, yaw: api.rnd() * 6, scale: 1 }));
  api.flora('barrel', yardBarrels);
  for (const b of yardBarrels) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: b.x, z: b.z, r: 0.5, top: vy + 1.1 }] });

  // --- The village: the street bends through a square round an old tree, the houses stand as people built them ---
  // (dx, dz, the way the door looks, size.)
  const homes: ReadonlyArray<readonly [number, number, number, number]> = [
    [-8, 102, 0.15, 1], [-6, 88, -0.12, 1.05], [-6.5, 74, 0.22, 0.95], [-18, 63, 0.45, 1], [-20, 34, -0.4, 1.05], [-17, 26, 0.12, 1], [-15, 12, -0.2, 0.95],
    [18, 41, Math.PI + 0.3, 1], [14, 27, Math.PI - 0.12, 1.05], [12, 13, Math.PI + 0.15, 0.95],
    [-25, 97, 0.85, 0.95], [-23, 81, -0.5, 1], [-31, 67, 0.25, 1], [-29, 30, 0.55, 1], [-30, 14, -0.3, 1.05],
    [38, 52, Math.PI - 0.5, 1], [32, 27, Math.PI + 0.2, 0.95], [27, 11, Math.PI - 0.3, 1], [46, 39, Math.PI, 1.05],
  ];
  homes.forEach(([dx, dz, yaw, size], i) => {
    const x = X + dx, z = Z + dz;
    api.place(modelLandmark('village-house', x, z, vy, { yaw: face(yaw), scale: size, onLoad: (m) => restyle(m, (mat) => patchLitWindows(mat)) }));
    // Lamplight on the house front, smoke from every third chimney.
    glow(LANTERN, 1.1, x + Math.cos(yaw) * 3 - Math.sin(yaw) * 1.6, vy + 2.6, z + Math.sin(yaw) * 3 + Math.cos(yaw) * 1.6, 0.42);
    if (i % 3 === 0) {
      const smoke = new PipeSmoke(0x9aa6c0);
      smoke.emitter.position.set(x - Math.cos(yaw) * 1.2, vy + 6.3, z - Math.sin(yaw) * 1.2);
      smoke.emitter.scale.setScalar(6);
      fx.add(smoke.emitter, smoke.particles);
      updates.push((dt) => smoke.update(dt));
    }
  });
  // Barrels by the door, the odds and ends of living there.
  const stacks: Placement[] = [];
  homes.forEach(([dx, dz, yaw], i) => {
    if (i % 2) return;
    for (let k = 0; k < 2; k++) stacks.push({ x: X + dx + Math.cos(yaw) * 3.9 + Math.sin(yaw) * (2.2 + k * 0.95), y: vy, z: Z + dz + Math.sin(yaw) * 3.9 - Math.cos(yaw) * (2.2 + k * 0.95), yaw: api.rnd() * 6, scale: 0.9 });
  });
  api.flora('barrel', stacks);
  for (const b of stacks) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: b.x, z: b.z, r: 0.45, top: vy + 1 }] });
  // Lamps along the bend, side to side.
  const lanterns: Placement[] = [];
  for (let i = 0, side = 1; i + 1 < VALE_STREET.length; i++) {
    const [ax, az] = VALE_STREET[i], [bx, bz] = VALE_STREET[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    for (let d = 7; d < len; d += 15, side = -side) {
      const t = d / len;
      lanterns.push({ x: X + ax + (bx - ax) * t + ((bz - az) / len) * side * 5.6, y: vy, z: Z + az + (bz - az) * t - ((bx - ax) / len) * side * 5.6, yaw: 0, scale: 1 });
    }
  }
  api.flora('lantern-post', lanterns);
  for (const l of lanterns) { api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: l.x, z: l.z, r: 0.2, top: vy + 2.5 }] }); glow(LANTERN, 1.2, l.x, vy + 2.3, l.z, 0.5); }
  // The square: stalls round an old tree hung with lanterns, a long table in its shade.
  for (const [dx, dz, yaw] of [[6.8, 41.4, Math.PI], [-12.5, 36, 0.3], [13.5, 51, Math.PI - 0.2], [-11, 60, -0.4]] as const) {
    const x = X + dx, z = Z + dz;
    api.place(modelLandmark('market-stall', x, z, vy, { yaw: face(yaw), footprints: [{ kind: 'box', x, z, hw: 1.2, hd: 1.8, top: vy + 1.1, rotY: -face(yaw) }] }));
  }
  api.place(modelLandmark('gnarled-tree', X + 1, Z + 52, vy, { scale: 1.3, collider: 'manual', footprints: [{ kind: 'cyl', x: X + 1, z: Z + 52, r: 0.9, top: vy + 5 }] }));
  for (const a of [0.4, 2.2, 4.1]) glow(LANTERN, 1.6, X + 1 + Math.cos(a) * 3.2, vy + 3.4, Z + 52 + Math.sin(a) * 3.2, 0.55);
  {
    const tx = X + 7.5, tz = Z + 63;
    api.flora('tavern-table', [{ x: tx, y: vy, z: tz, yaw: 0.5, scale: 1 }]);
    api.place({ object: new Group(), footprints: [{ kind: 'box', x: tx, z: tz, hw: 1.6, hd: 0.6, top: vy + 0.95, rotY: -0.5 }] });
    api.flora('tankard', [[-0.7, 0.15], [0.6, -0.1], [0.1, 0.2]].map(([dx, dz]) => ({ x: tx + dx, y: vy + 0.96, z: tz + dz, yaw: api.rnd() * 6, scale: 1 })), { shadows: false });
  }
  // The wider vale: gardens, ruins, camps and the rest (Pois.ts).
  dressVale(api);

  // --- The green dragon lying behind the last houses, the reader on its claw ---
  // Twice the registry size: in the reel he looms over the roofs, head raised, at the end of the street (facing up it).
  // (Tinted greener: under the vale's blue moon his dark green scales read blue-black.)
  // His head turns to watch you as you come up the street (the neck measured on green-dragon.glb: it rises from the
  // body at z 0.2 on the line x -0.3 and ends at the snout, z 0.89, model units); talk to him at his head (NPCs.ts).
  const neckTurn = { value: 0 };
  const DRAGON_UNIT = (MODELS['green-dragon'].height * 2) / 1.114;
  const neckRoot = new Vector3(X - 0.28 * DRAGON_UNIT, vy, Z - 8 + 0.2 * DRAGON_UNIT);
  api.place(modelLandmark('green-dragon', X, Z - 8, vy, { yaw: face(Math.PI / 2), scale: 2,
    onLoad: (m) => restyle(m, (mat) => {
      mat.color.multiply(new Color(0.8, 1.35, 0.85)); mat.emissive.setRGB(0.008, 0.03, 0.012);
      patchNeckTurn(mat, { pivot: [-0.28, 0.2], z0: 0.2, z1: 0.55, yMin: -0.05, xCenter: -0.3, xHalf: 0.42, turn: neckTurn });
    }),
    update: (dt, _root, _m, player) => {
      // Toward you (the model faces +z: a turn about y of atan2(dx, dz)), within what a neck can do, eased.
      const dx = player.x - neckRoot.x, dz = player.z - neckRoot.z;
      const near = Math.hypot(dx, dz) < 70;
      const want = near ? Math.max(-0.75, Math.min(0.75, Math.atan2(dx, dz))) : 0;
      neckTurn.value += (want - neckTurn.value) * Math.min(1, dt * 1.5);
    } }));
  // The reader sits on a stool against the front of his left claw, reading to him, the book open in his lap.
  api.place(modelLandmark('spell-book', X - 5, Z + 4.72, vy + 0.42, { scale: 0.8, collider: 'none' }));
  glow(0x7fd8ff, 0.9, X - 5, vy + 0.72, Z + 4.72, 0.45);

  // --- West: the river, the stone bridge between braziers, the crowned head on its hill ---
  {
    // It winds, and it runs: a ribbon over the sculpt's meandering bed, flowing south to the cliff.
    const bed: Array<[number, number, number]> = [];
    for (let z = z0 - 4; z <= z1 + 12; z += 3) bed.push([riverX + valeMeander(z), z, vy - 0.35]);
    api.place(waterRibbon(bed, 6.6, [0x041628, 0x1c5a8a, 0xa8d0ff], 1.7));
  }
  api.water?.(riverX - 5 - VALE_MEANDER_AMP, riverX + 5 + VALE_MEANDER_AMP, z0, z1, vy - 0.35);
  const bridgeZ = Z + 40;
  // The gnomes' ferry: two gnomes rowing a boat up and down the river below the bridge, past the landing (Pois pier),
  // turning round at each end (Ferry.ts). (It lay moored there doing nothing: the playtest of 2026-11-12.)
  {
    const run: FerryRun = { z0: bridgeZ + 12, z1: Math.min(z1 - 8, bridgeZ + 78), x: (z) => riverX + valeMeander(z), speed: 1.4, turn: 4 };
    const start = ferryAt(0, run);
    const rowers: Rig[] = [];
    let t = 0;
    api.place(modelLandmark('boat', start.x, start.z, vy - 0.3, { collider: 'none',
      onLoad: (m) => {
        for (const [dz, model] of [[0.55, 'cup-gnome'], [-0.45, 'gnome-brother']] as const) {
          const rig = new Rig({ id: 'ferry-gnome', name: 'Gnome', title: '', element: 'fog', weapon: 'staff', maxHp: 1, atk: 1, accent: PALETTE_GOLD }, model);
          rig.root.position.set(0, 0.32, dz);
          // Facing the way the boat goes (facing the stern, as real rowers do, read as the boat going backwards: the
          // playtest of 2026-11-13).
          rig.root.rotation.y = yawToRotation(Math.PI / 2);
          m.root.parent?.add(rig.root);
          rowers.push(rig);
        }
      },
      update: (dt, root) => {
        t += dt;
        const f = ferryAt(t, run);
        root.position.set(f.x, vy - 0.3 + Math.sin(t * 1.4) * 0.05, f.z);
        root.rotation.y = yawToRotation(f.heading);
        root.rotation.z = Math.sin(t * 1.1) * 0.025;
        for (const r of rowers) r.animate({ mode: 'ground', speed: 0, pose: 'row' }, dt);
      } }));
  }
  // Bank to bank across the current, its deck following the arch (its 22 m span lands on the flat banks either side).
  const deck = witchBridgeDeck(riverX, bridgeZ, api.h);
  api.place(deck);
  api.place(modelLandmark('witch-bridge', riverX, bridgeZ, deck.baseY, { collider: 'none', onLoad: () => { deck.object.visible = false; deck.object.userData.hidden = true; } }));
  for (const [dx, dz] of [[13, -3.4], [13, 3.4], [-13, -3.4], [-13, 3.4]]) {
    const x = riverX + dx, z = bridgeZ + dz;
    api.place(modelLandmark('brazier', x, z, vy, { footprints: [{ kind: 'cyl', x, z, r: 0.6, top: vy + 1.3 }] }));
    api.vfx(fire(x, vy + 1.5, z, 0.55, dx > 0 ? 9 : 0));
  }
  // The crowned head, half again its registry size (it fills the reel's frame), at the end of a cobbled path from the
  // bridge with braziers burning where the path meets it.
  const headX = X - 85, headZ = Z + 20;
  const headY = api.h(headX, headZ);
  api.place(modelLandmark('crowned-head', headX, headZ, headY, { yaw: face(0.25), scale: 1.5 }));
  {
    // From the bridge's west end (949, 939) toward the head, along (0.894, 0.447).
    const ux = 0.894, uz = 0.447;
    for (const side of [-1, 1]) {
      const x = X - 72 - uz * side * 2.8, z = Z + 28.5 + ux * side * 2.8;
      // (On the hill's slope: at the ground there, not the street's level.)
      const by = api.h(x, z);
      api.place(modelLandmark('brazier', x, z, by, { footprints: [{ kind: 'cyl', x, z, r: 0.6, top: by + 1.3 }] }));
      api.vfx(fire(x, by + 1.5, z, 0.55, 0));
    }
  }

  // --- East: the floating castle over the clouds, its chained platforms and lanterns ---
  {
    // (Still and solid, as it looks: you can walk the chains across to its rock, or fly over and land on its roofs.)
    const cx = X + 130, cz = Z + 10, cy = vy + VALE_CASTLE_LIFT;
    api.place(modelLandmark('floating-castle', cx, cz, cy, { yaw: face(Math.PI) }));
    // (Its falls only once there is a castle to pour them.)
    if (PRESENT_MODELS.has('floating-castle')) for (const [dx, dz, w] of [[-14, -6, 4], [-14, 9, 3]] as const) api.place(cascade({ x: cx + dx, z: cz + dz, top: cy + 12, height: cy + 12 - (CLOUD_LEVEL.vale ?? -30) + 2, width: w, yaw: -Math.PI / 2, curve: 2, foot: false }));
    // (Two between the vale's edge and the castle, stepping stones to fly by; two beyond it. Clear of its 30 m rock.)
    const plats: Array<[number, number, number]> = [[X + 106, Z - 6, vy + 3], [X + 108, Z + 30, vy + 7], [X + 152, Z - 22, vy + 11], [X + 150, Z + 44, vy + 2]];
    // (A flat disc at the rock's walk top: the baked grid kept the lantern's 0.9 m stub right where the two chain spans
    // meet, and a walker caught on it now and then, 2026-11-03.)
    plats.forEach(([px, pz, py], i) => {
      api.place(modelLandmark('chained-platform', px, pz, py, { yaw: i * 1.7, collider: 'manual', footprints: [{ kind: 'cyl', x: px, z: pz, r: 2.2, top: py + 4.9, bottom: py + 3.4 }] }));
      glow(LANTERN, 2.2, px, py + 1.4, pz, 0.55);
    });
    // The way over: planks on chains from the vale's edge to the first platform, and on to the castle's west shelf.
    const tile = MODELS['chasm-bridge'].height;
    const shelfY = cy + 5;
    const platY = plats[0][2] + 4.9;
    for (const span of [
      chainSpan(X + 84, Z - 5, api.h(X + 84, Z - 5) + 0.05, X + 105, Z - 6, platY, tile),
      chainSpan(X + 105, Z - 6, platY, X + 118, Z + 3, shelfY, tile),
    ]) { api.place(span); api.flora('chasm-bridge', span.tiles); }
    for (const dz of [-2, 2]) {
      const y = api.h(X + 83, Z - 5 + dz);
      api.place(modelLandmark('lantern-post', X + 83, Z - 5 + dz, y, { footprints: [{ kind: 'cyl', x: X + 83, z: Z - 5 + dz, r: 0.2, top: y + 2.5 }] }));
      glow(LANTERN, 1.8, X + 83, y + 2.3, Z - 5 + dz, 0.6);
    }
    const vortex = skyVortex(380, [0x4a2a9a, 0xa04ab0]);
    vortex.position.set(cx + 160, vy + 170, cz);
    vortex.lookAt(X, vy + 40, Z);
    api.group.add(vortex);
    for (const [mx, mz] of [[X + 330, Z - 220], [X + 330, Z + 240]]) {
      const m = horizonMoon(150);
      m.position.set(mx, vy + 30, mz);
      api.group.add(m);
    }
    // The cloud sea under the castle: low soft cloud sprites drifting.
    for (let i = 0; i < 18; i++) {
      const s = glowSprite(0x9fb4e0, 40 + api.rnd() * 30, 0.12, false);
      s.position.set(X + 110 + api.rnd() * 130, vy - 6 - api.rnd() * 8, Z - 110 + api.rnd() * 220);
      api.group.add(s);
    }
  }
  api.realm(null);
  return links;
}

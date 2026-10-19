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
import { ISLAND_PORTALS, VALE } from '../data/world';
import { MODELS } from '../data/models';
import { cobbleFloor, grassGround, seabed } from '../render/Floors';
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
import { floorSlab } from './Walkways';
import { waterSheet } from './Water';

/** Rotation that turns a model's front (local +z) toward world direction `yaw` (cos, sin). */
const face = (yaw: number) => Math.PI / 2 - yaw;
const LANTERN = 0xffa040;
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
  // Ground: night grass everywhere, a muddy cobbled street up the middle; unseen walls at the edges.
  const x0 = X - 110, x1 = X + 100, z0 = Z - 120, z1 = Z + 125;
  const riverX = X - 45;
  // (The grass stops at the river's banks: one sheet over everything hid the water under it.)
  api.group.add(grassGround((x0 + riverX - 5) / 2, (z0 + z1) / 2, riverX - 5 - x0, z1 - z0, vy));
  api.group.add(grassGround((riverX + 5 + x1) / 2, (z0 + z1) / 2, x1 - riverX - 5, z1 - z0, vy));
  // The river's silt bed, seen through the water.
  api.group.add(seabed(riverX, (z0 + z1) / 2, 10, z1 - z0, vy - 2.2));
  // (A couple of centimetres over the grass, or the two planes fight for the same pixels.)
  api.group.add(cobbleFloor(X, Z + 50, 12, 130, vy + 0.02, 0, 0.7));
  api.place({ object: new Group(), footprints: [
    { kind: 'box', x: (riverX + 5 + x1) / 2, z: (z0 + z1) / 2, hw: (x1 - riverX - 5) / 2, hd: (z1 - z0) / 2, top: vy },
    { kind: 'box', x: (x0 + riverX - 5) / 2, z: (z0 + z1) / 2, hw: (riverX - 5 - x0) / 2, hd: (z1 - z0) / 2, top: vy },
    // The river's bed, deep enough to swim (wading into a bed under a painted surface looked like sinking into the ground).
    { kind: 'box', x: riverX, z: (z0 + z1) / 2, hw: 5, hd: (z1 - z0) / 2, top: vy - 2.2 },
    { kind: 'box', x: x0 - 0.5, z: (z0 + z1) / 2, hw: 0.5, hd: (z1 - z0) / 2 + 1, top: vy + 6 }, { kind: 'box', x: x1 + 0.5, z: (z0 + z1) / 2, hw: 0.5, hd: (z1 - z0) / 2 + 1, top: vy + 6 },
    { kind: 'box', x: (x0 + x1) / 2, z: z0 - 0.5, hw: (x1 - x0) / 2 + 1, hd: 0.5, top: vy + 6 }, { kind: 'box', x: (x0 + x1) / 2, z: z1 + 0.5, hw: (x1 - x0) / 2 + 1, hd: 0.5, top: vy + 6 },
  ] });
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
  }
  api.place(modelLandmark('campfire', X + 19, Z + 66, vy));
  api.vfx(fire(X + 19, vy + 0.3, Z + 66, 1, 18));
  const yardBarrels: Placement[] = [[X + 10, Z + 82], [X + 11.4, Z + 83.4], [X + 20, Z + 84]].map(([x, z]) => ({ x, y: vy, z, yaw: api.rnd() * 6, scale: 1 }));
  api.flora('barrel', yardBarrels);
  for (const b of yardBarrels) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: b.x, z: b.z, r: 0.5, top: vy + 1.1 }] });

  // --- The village street (z +100 → +10), houses both sides facing it ---
  const houseZs = [92, 80, 56, 44, 32, 20];
  houseZs.forEach((dz, i) => {
    for (const side of [-1, 1]) {
      // (The tavern stands where the east side's first two houses would.)
      if (side > 0 && dz > 70) continue;
      const x = X + side * (11 + (i % 2) * 1.2);
      const z = Z + dz;
      api.place(modelLandmark('village-house', x, z, vy, { yaw: face(side < 0 ? 0 : Math.PI), footprints: [{ kind: 'box', x, z, hw: 3.3, hd: 3.3, top: vy + 6 }], onLoad: (m) => restyle(m, (mat) => patchLitWindows(mat)) }));
      // Lamplight on the house fronts (village-house.glb's front wall is 2.85 m from its middle: the glow hung 0.75 m out in
      // the street), and smoke from every other chimney.
      glow(LANTERN, 2, x - side * 2.95, vy + 2.6, z + 1.6, 0.6);
      if (i % 2 === 0) {
        const smoke = new PipeSmoke(0x9aa6c0);
        smoke.emitter.position.set(x + side * 1.2, vy + 6.3, z - 1);
        smoke.emitter.scale.setScalar(6);
        fx.add(smoke.emitter, smoke.particles);
        updates.push((dt) => smoke.update(dt));
      }
    }
  });
  const lanterns: Placement[] = [];
  // (Clear of the stalls at dz 41.4, 30 and 18.)
  for (const dz of [88, 64, 36, 12]) for (const side of [-1, 1]) lanterns.push({ x: X + side * 6.4, y: vy, z: Z + dz, yaw: 0, scale: 1 });
  api.flora('lantern-post', lanterns);
  for (const l of lanterns) { api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: l.x, z: l.z, r: 0.2, top: vy + 2.5 }] }); glow(LANTERN, 1.8, l.x, vy + 2.3, l.z, 0.6); }
  // Stalls along the street, a barrel for the beggar to sit on.
  for (const [dx, dz, yaw] of [[6.8, 41.4, Math.PI], [-6.8, 30, 0], [6.8, 18, Math.PI]] as const) {
    const x = X + dx, z = Z + dz;
    api.place(modelLandmark('market-stall', x, z, vy, { yaw: face(yaw), footprints: [{ kind: 'box', x, z, hw: 1.2, hd: 1.8, top: vy + 1.1 }] }));
  }

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
  api.place(waterSheet(riverX, (z0 + z1) / 2, 10, z1 - z0, vy - 0.35, [0x041628, 0x1c5a8a, 0xa8d0ff]));
  api.water?.(riverX - 5, riverX + 5, z0, z1, vy - 0.35);
  const bridgeZ = Z + 40;
  api.place(floorSlab(riverX, bridgeZ, vy, 11, 5));
  api.place(modelLandmark('witch-bridge', riverX, bridgeZ, vy - 1.2, { yaw: face(0), collider: 'none' }));
  for (const [dx, dz] of [[6.5, -3], [6.5, 3], [-6.5, -3], [-6.5, 3]]) {
    const x = riverX + dx, z = bridgeZ + dz;
    api.place(modelLandmark('brazier', x, z, vy, { footprints: [{ kind: 'cyl', x, z, r: 0.6, top: vy + 1.3 }] }));
    api.vfx(fire(x, vy + 1.5, z, 0.55, dx > 0 ? 9 : 0));
  }
  // The crowned head, half again its registry size (it fills the reel's frame), at the end of a cobbled path from the
  // bridge with braziers burning where the path meets it.
  api.place(modelLandmark('crowned-head', X - 85, Z + 20, vy, { yaw: face(0.25), scale: 1.5 }));
  {
    // From the bridge's west end (949, 939) toward the head, along (0.894, 0.447).
    const ux = 0.894, uz = 0.447;
    api.group.add(cobbleFloor(X - 62.5, Z + 33.2, 26, 3.5, vy + 0.02, -Math.atan2(uz, ux), 0.6));
    for (const side of [-1, 1]) {
      const x = X - 72 - uz * side * 2.8, z = Z + 28.5 + ux * side * 2.8;
      api.place(modelLandmark('brazier', x, z, vy, { footprints: [{ kind: 'cyl', x, z, r: 0.6, top: vy + 1.3 }] }));
      api.vfx(fire(x, vy + 1.5, z, 0.55, 0));
    }
  }

  // --- East: the floating castle over the clouds, its chained platforms and lanterns ---
  {
    // (Still and solid, as it looks, 35 m nearer the vale's edge: you can fly over and land on its rock and roofs.)
    const cx = X + 130, cz = Z + 10, cy = vy + 18;
    api.place(modelLandmark('floating-castle', cx, cz, cy, { yaw: face(Math.PI) }));
    // (Its falls only once there is a castle to pour them.)
    if (PRESENT_MODELS.has('floating-castle')) for (const [dx, dz, w] of [[-14, -6, 4], [-14, 9, 3]] as const) api.place(cascade({ x: cx + dx, z: cz + dz, top: cy + 12, height: 40, width: w, yaw: -Math.PI / 2, curve: 2 }));
    // (Two between the vale's edge and the castle, stepping stones to fly by; two beyond it. Clear of its 30 m rock.)
    const plats: Array<[number, number, number]> = [[X + 106, Z - 6, vy + 3], [X + 108, Z + 30, vy + 7], [X + 152, Z - 22, vy + 11], [X + 150, Z + 44, vy + 2]];
    plats.forEach(([px, pz, py], i) => {
      api.place(modelLandmark('chained-platform', px, pz, py, { yaw: i * 1.7 }));
      glow(LANTERN, 2.2, px, py + 1.4, pz, 0.55);
    });
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

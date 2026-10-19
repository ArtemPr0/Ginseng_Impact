/**
 * Rooms behind doors, each a small realm of its own like the tree house's:
 *  - the vale tavern's taproom (Dd5Bqt7vQ5T's toast): warm and close, the candle-headed man and the dwarves raising
 *    candle-lit tankards by a fireplace, a chandelier of melting candles over them, stone walls, barrels stacked high,
 *    a purple-lit window behind; built from Meshy models made for other places;
 *  - the crypt bar under the Lean Quarter's snow chapel (DeldocTvFiB): a stone vault (its own model) where
 *    green-eyed skeletons sip at the counters among skulls and melting candles.
 * The floors, fire and dark are procedural.
 */
import { Color, Group, type Mesh, type MeshStandardMaterial, PointLight, Vector3 } from 'three';
import { CRYPT_ROOM, GALAXY, TAVERN_ROOM, VALE } from '../data/world';
import { MODELS } from '../data/models';
import { darkHollow, plankFloor } from '../render/Floors';
import { glowSprite } from '../render/Glow';
import { patchRetint } from '../render/Materials';
import type { ModelRig } from '../models/ModelRig';
import { fire } from './Fire';
import type { Footprint } from './Colliders';
import type { Placement } from './Flora';
import type { Interactable, Teleport } from './Interact';
import { modelLandmark } from './ModelLandmark';
import type { RealmApi } from './Realms';

/** Rotation that turns a model's front (local +z) toward world direction `yaw` (cos, sin). */
const face = (yaw: number) => Math.PI / 2 - yaw;
const CANDLE = 0xffb050;

/** The vale tavern's front door: tavern.glb at (VALE.x + 24, VALE.z + 76) faces west, its front wall 3.8 m out. */
export const VALE_TAVERN_DOOR = { x: VALE.x + 20.2, z: VALE.z + 76 };

function restyle(model: ModelRig, fn: (mat: MeshStandardMaterial) => void): void {
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    fn(mat);
    m.material = mat;
  });
}

/**
 * The taproom, hearth at the north end, door at the south: the drowned tavern's face (Sunken.ts) is its hearth wall,
 * re-coloured soot-warm; barrels stacked two high down the west side, bottle shelves down the east and either side of
 * the door; the long table under the chandelier, two more by the walls. Returns the doors in and out.
 */
export function buildTavernRoom(api: RealmApi, teleport: Teleport): Interactable[] {
  const R = TAVERN_ROOM;
  const x = R.x, z = R.z, y = R.y;
  api.realm(R.id);
  const glow = (color: number, size: number, gx: number, gy: number, gz: number, opacity = 0.5) => {
    const s = glowSprite(color, size, opacity, true);
    s.position.set(gx, gy, gz);
    api.group.add(s);
  };
  api.group.add(darkHollow(x, y, z, 26, R.fog.color));

  // The hearth wall: its face stands 2.7 m behind the model's centre, the fireplace in the arch at the middle.
  const wallZ = z - 5;
  const faceZ = wallZ - 2.7;
  api.place(modelLandmark('sunken-tavern', x, wallZ, y, { onLoad: (m) => restyle(m, (mat) => patchRetint(mat, new Color(0.52, 0.38, 0.27))) }));
  api.vfx(fire(x, y + 0.9, faceZ - 0.2, 0.65, 0));
  const hearth = new PointLight(0xff8a3a, 34, 18, 1.5);
  hearth.position.set(x, y + 1.8, faceZ + 1.2);
  api.group.add(hearth);
  // The reel's window glowing purple behind the toasters: the hearth wall's upper round windows.
  for (const side of [-1, 1]) glow(0x9b4dff, 2.6, x + side * 4.4, y + 6.2, faceZ + 0.2, 0.45);

  // Floor, and the walls you cannot pass: the room is 18 m across, hearth wall to door; a ceiling under the dark.
  const z0 = faceZ - 0.5, z1 = z + 8.6;
  api.group.add(plankFloor(x, (z0 + z1) / 2, 18.4, z1 - z0, y, [[x, faceZ + 1.5, 6, 0.9], [x, z + 0.2, 5, 0.55]]));
  const bounds: Footprint[] = [
    { kind: 'box', x, z: (z0 + z1) / 2, hw: 9.2, hd: (z1 - z0) / 2, top: y },
    { kind: 'box', x: x - 9.4, z: (z0 + z1) / 2, hw: 0.4, hd: (z1 - z0) / 2 + 0.8, top: y + 80 },
    { kind: 'box', x: x + 9.4, z: (z0 + z1) / 2, hw: 0.4, hd: (z1 - z0) / 2 + 0.8, top: y + 80 },
    { kind: 'box', x, z: z1 + 0.4, hw: 9.8, hd: 0.4, top: y + 80 },
    { kind: 'box', x, z: z0 - 0.4, hw: 9.8, hd: 0.4, top: y + 80 },
    { kind: 'box', x, z: (z0 + z1) / 2, hw: 10, hd: (z1 - z0) / 2 + 1, top: y + 80, bottom: y + 5.8 },
  ];
  api.place({ object: new Group(), footprints: bounds });

  // West: barrels two high along the wall.
  const barrels: Placement[] = [];
  for (let i = 0; i < 10; i++) barrels.push({ x: x - 8.3, y, z: z - 4.8 + i * 1.05, yaw: api.rnd() * 6, scale: 1 });
  for (let i = 0; i < 9; i++) barrels.push({ x: x - 8.3, y: y + 1.1, z: z - 4.3 + i * 1.05, yaw: api.rnd() * 6, scale: 1 });
  api.flora('barrel', barrels);
  api.place({ object: new Group(), footprints: [{ kind: 'box', x: x - 8.3, z, hw: 0.55, hd: 5.4, top: y + 2.2 }] });
  // East (between the hearth wall's end and the door) and either side of the door: shelves of glowing bottles.
  api.place(modelLandmark('bottle-shelf', x + 8.35, z + 3.6, y, { yaw: face(Math.PI) }));
  for (let k = 0; k < 5; k++) glow(CANDLE, 0.9, x + 7.95, y + 0.8 + (k % 2) * 0.8, z + 3.6 + (k - 2) * 1.1, 0.35);
  for (const side of [-1, 1]) api.place(modelLandmark('bottle-shelf', x + side * 4.3, z1 - 0.7, y, { yaw: face(-Math.PI / 2) }));
  // The door out, between the shelves.
  api.place(modelLandmark('treehouse-door', x, z1 - 0.3, y, { yaw: face(-Math.PI / 2), collider: 'none', scale: 2.5 / MODELS['treehouse-door'].height }));
  glow(CANDLE, 1.4, x, y + 2.7, z1 - 0.6, 0.4);

  // The long table under the chandelier (Waxwick and the two dwarves stand round it: ANCHORS), two more by the walls.
  const tables: Array<[number, number, number]> = [[x, z + 0.2, 0], [x - 4.8, z + 3.8, Math.PI / 2], [x + 4.8, z + 3.8, Math.PI / 2]];
  for (const [tx, tz, yaw] of tables) {
    api.flora('tavern-table', [{ x: tx, y, z: tz, yaw, scale: 1 }]);
    const along = yaw === 0;
    api.place({ object: new Group(), footprints: [{ kind: 'box', x: tx, z: tz, hw: along ? 1.6 : 0.6, hd: along ? 0.6 : 1.6, top: y + 0.95 }] });
    const candles = [-1, 0, 1].map((k) => ({ x: tx + (along ? k : 0), y: y + 0.97, z: tz + (along ? 0 : k), yaw: 0, scale: 1 }));
    api.flora('candle', candles, { shadows: false });
    for (const c of candles) glow(CANDLE, 0.7, c.x, c.y + 0.38, c.z, 0.55);
  }
  // The chandelier of melting candles, and its light.
  const ch = { x, z: z + 0.2, y: y + 3.6 };
  api.place(modelLandmark('chandelier', ch.x, ch.z, ch.y, { collider: 'none' }));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; glow(CANDLE, 0.8, ch.x + Math.cos(a) * 0.75, ch.y + 0.55, ch.z + Math.sin(a) * 0.75, 0.6); }
  const lamp = new PointLight(0xffa050, 26, 14, 1.5);
  lamp.position.set(ch.x, ch.y + 0.2, ch.z);
  api.group.add(lamp);
  // More of the crowd at the side tables, toasting (their tankards are in the mesh).
  for (const [dx, dz, yaw] of [[-3.8, 3.2, Math.PI], [-5.8, 4.6, 0], [3.8, 4.4, 0]] as const) {
    const t0 = api.rnd() * 4;
    api.place(modelLandmark('dwarf', x + dx, z + dz, y, { yaw: face(yaw), clip: 'drink', collider: 'manual',
      footprints: [{ kind: 'cyl', x: x + dx, z: z + dz, r: 0.35, top: y + 1.4 }], onLoad: (m) => m.update(t0) }));
  }
  api.realm(null);

  // In by the vale tavern's front door; out by the taproom's own.
  const D = VALE_TAVERN_DOOR;
  const exitAt = new Vector3(x, y, z1 - 1.2);
  return [
    { pos: new Vector3(D.x - 0.6, VALE.y, D.z), range: 2.6, zone: VALE.id, label: () => 'Step into the tavern', act: () => teleport(x, y, z1 - 2.2, -Math.PI / 2, R.name) },
    { pos: exitAt, range: 1.4, zone: R.id, label: () => 'Leave the tavern', act: () => teleport(D.x - 1.8, VALE.y, D.z, Math.PI) },
  ];
}

/**
 * The snow chapel's door in the Lean Quarter: snow-chapel.glb at LEAN_QUARTER.chapel faces the gate at (950, 86); its
 * front stands about 5 m out along that way.
 */
export const CHAPEL_DOOR = { x: 902.6, z: 146.5 };

/**
 * The crypt bar under the snow chapel (DeldocTvFiB): crypt-bar.glb, a vault open at the front, at 6.5 m tall. Measured
 * by vertical ray picks (at that size): the floor at its base; a nave 4 m wide (x -2.4..1.6 from its centre) between
 * two bar counters 1.2 m high that run its length (x -3.7..-2.8 and 2.0..2.8, z -3.3..5.4), a third across the back
 * (z -4.5..-3.3); side aisles behind them with low stone ledges; the vault 6 m up over the nave, under 3 m over the
 * aisles. Two skeletons sip along the west counter facing the way in, Knuckles sits on a barrel at the east one, Sir
 * Gilt toasts the dead at the back.
 */
export function buildCryptRoom(api: RealmApi, teleport: Teleport): Interactable[] {
  const R = CRYPT_ROOM;
  const x = R.x, z = R.z, y = R.y;
  api.realm(R.id);
  const glow = (color: number, size: number, gx: number, gy: number, gz: number, opacity = 0.5) => {
    const s = glowSprite(color, size, opacity, true);
    s.position.set(gx, gy, gz);
    api.group.add(s);
  };
  api.group.add(darkHollow(x, y, z, 26, R.fog.color));
  api.place(modelLandmark('crypt-bar', x, z, y, { collider: 'none', scale: 6.5 / MODELS['crypt-bar'].height }));
  const top = y + 1.22;
  api.place({ object: new Group(), footprints: [
    { kind: 'box', x, z, hw: 5.6, hd: 5.6, top: y },
    { kind: 'box', x: x - 5.7, z, hw: 0.3, hd: 6, top: y + 80 }, { kind: 'box', x: x + 5.7, z, hw: 0.3, hd: 6, top: y + 80 },
    { kind: 'box', x, z: z - 5.7, hw: 6, hd: 0.3, top: y + 80 }, { kind: 'box', x, z: z + 5.9, hw: 6, hd: 0.3, top: y + 80 },
    // The counters, and the vaults (over the nave, lower over the aisles).
    { kind: 'box', x: x - 3.25, z: z + 1.07, hw: 0.42, hd: 4.32, top }, { kind: 'box', x: x + 2.42, z: z + 1.07, hw: 0.42, hd: 4.32, top },
    { kind: 'box', x: x - 0.6, z: z - 3.86, hw: 1.85, hd: 0.62, top },
    { kind: 'box', x, z, hw: 6, hd: 6, top: y + 80, bottom: y + 5.6 },
    { kind: 'box', x: x - 4.6, z, hw: 1, hd: 6, top: y + 80, bottom: y + 2.6 }, { kind: 'box', x: x + 3.9, z, hw: 1.6, hd: 6, top: y + 80, bottom: y + 2.6 },
  ] });

  // Skulls heaped along the aisles' ledges behind the counters, two rows high, and on the back counter.
  const skulls: Placement[] = [];
  for (let k = 0; k < 8; k++) for (const [sx, lift] of [[-4.7, 0.4], [-4.9, 1.2], [3.9, 0.4], [4.1, 1.2]] as const) {
    skulls.push({ x: x + sx, y: y + lift, z: z - 3.2 + k * 1.05, yaw: api.rnd() * 6, scale: 0.42 + api.rnd() * 0.12 });
  }
  for (const dx of [-1.9, 0.7]) skulls.push({ x: x + dx, y: top, z: z - 4.1, yaw: api.rnd() * 6, scale: 0.45 });
  api.flora('skull-pile', skulls, { patch: (mat) => mat.color.set(0x9a9284) });
  // Melting candles down the counters, each with its flame.
  const candles: Placement[] = [];
  for (let k = 0; k < 6; k++) for (const cx of [-3.25, 2.42]) candles.push({ x: x + cx + (api.rnd() - 0.5) * 0.2, y: top, z: z - 2.4 + k * 1.4, yaw: 0, scale: 0.8 + api.rnd() * 0.6 });
  for (const dx of [-1.3, -0.2, 1.0]) candles.push({ x: x + dx, y: top, z: z - 3.9, yaw: 0, scale: 1.2 });
  api.flora('candle', candles, { shadows: false });
  for (const c of candles) glow(CANDLE, 0.7, c.x, c.y + 0.3 * c.scale + 0.08, c.z, 0.55);
  // A chandelier of candles over the nave, and the warm light of all of them.
  const ch = { x: x - 0.4, z: z + 1, y: y + 3.6 };
  api.place(modelLandmark('chandelier', ch.x, ch.z, ch.y, { collider: 'none' }));
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; glow(CANDLE, 0.8, ch.x + Math.cos(a) * 0.75, ch.y + 0.55, ch.z + Math.sin(a) * 0.75, 0.6); }
  const lamp = new PointLight(0xffb878, 22, 13, 1.5);
  lamp.position.set(ch.x, ch.y + 0.2, ch.z);
  api.group.add(lamp);
  const back = new PointLight(0xffb070, 12, 8, 1.6);
  back.position.set(x - 0.4, y + 2.2, z - 3.4);
  api.group.add(back);
  // The way up: the crypt's open arch at the front, lit faintly by the moon on the snow above.
  const exitAt = new Vector3(x - 0.4, y, z + 5.0);
  glow(0x9fb4ff, 3.2, exitAt.x, y + 2.4, z + 5.6, 0.25);
  api.realm(null);

  const D = CHAPEL_DOOR;
  return [
    { pos: new Vector3(D.x, GALAXY.y, D.z), range: 3, zone: GALAXY.id, label: () => 'Go down to the crypt bar', act: () => teleport(exitAt.x, y, z + 4.2, -Math.PI / 2, R.name) },
    { pos: exitAt, range: 1.4, zone: R.id, label: () => 'Climb back up to the chapel', act: () => teleport(D.x + 2.2, GALAXY.y, D.z - 2.4, -0.92) },
  ];
}

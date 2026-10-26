/**
 * The Alley of Graves (01.16.54): a straight cracked, mossy path between low stone walls, gravestones crowded on raised
 * plots either side, purple fog along the ground and amber storm clouds overhead (Sky's 'graveyard' preset), a gothic
 * tower at the end, and the cyclops waiting before it. Reached through the demon church's door on the island. Every
 * 35 m or so something happens: skeleton guards, a candle shrine, an open grave that throws you up, the gate.
 * The floor (path and moss) is a shader like the terrain; walls, graves, trees and towers are models.
 */
import { Color, Mesh, type MeshStandardMaterial, Vector3 } from 'three';
import { ENEMY_SPAWNS } from '../data/enemies';
import { GRAVEYARD } from '../data/world';
import { MODELS } from '../data/models';
import { fireflies } from '../render/Fireflies';
import { patchRetint } from '../render/Materials';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import type { Footprint, HeightWorld } from './Colliders';
import { fire } from './Fire';
import type { FloraOptions, Placement } from './Flora';
import type { Interactable, Teleport } from './Interact';
import { modelLandmark } from './ModelLandmark';
import type { ModelRig } from '../models/ModelRig';
import { portal, type PortalLink } from './Portal';
import type { RealmApi } from './Realms';

/** Gives every mesh of a loaded model its own material copy and restyles it. */
function restyle(model: ModelRig, fn: (mat: MeshStandardMaterial) => void): void {
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    fn(mat);
    m.material = mat;
  });
}

export interface GraveyardApi extends Omit<RealmApi, 'flora'> {
  heights: HeightWorld;
  flora(id: string, placements: Placement[], opts?: FloraOptions & { trunk?: number }): void;
  teleport(): Teleport | undefined;
  /** Where the island door is (the demon church's front) and the ground height there. */
  door: { x: number; z: number; y: number };
}

export function buildGraveyard(api: GraveyardApi): { links: PortalLink[]; interactables: Interactable[] } {
  const R = GRAVEYARD;
  api.realm(R.id);
  const y0 = R.y;
  const zGate = R.z + 85;
  const zArena = R.z - 68;
  const rnd = api.rnd;
  // The alley stands on its sculpt. Invisible walls at the old floor's edge (beyond is the void and the fog).
  const solid: Footprint[] = [];
  // Invisible walls at the floor's edge (beyond is the void and the fog).
  for (const side of [-1, 1]) solid.push({ kind: 'box', x: R.x + side * 24.5, z: R.z, hw: 0.5, hd: 120, top: y0 + 6 });
  solid.push({ kind: 'box', x: R.x, z: R.z + 120.5, hw: 25, hd: 0.5, top: y0 + 6 }, { kind: 'box', x: R.x, z: R.z - 120.5, hw: 25, hd: 0.5, top: y0 + 6 });

  // Walls either side of the path, with a gap every 30 m (a way onto the plots).
  // One segment's length (stone-wall.glb is 2.16 times as long as it is tall).
  const wallLen = MODELS['stone-wall'].height * 2.16;
  const walls: Footprint[] = [];
  for (const side of [-1, 1]) {
    for (let z = zGate - 2; z > zArena + 22; z -= wallLen) {
      if (Math.abs(((zGate - z) % 30) - 15) < 2) continue;
      api.place(modelLandmark('stone-wall', R.x + side * 3.4, z, y0, { collider: 'none', yaw: Math.PI / 2 }));
      walls.push({ kind: 'box', x: R.x + side * 3.4, z, hw: 0.62, hd: wallLen / 2, top: y0 + MODELS['stone-wall'].height });
    }
  }
  // Raised plots of graves behind the walls.
  const graves: Placement[] = [];
  const runes: Placement[] = [];
  const crosses: Placement[] = [];
  for (const side of [-1, 1]) {
    solid.push({ kind: 'box', x: R.x + side * 10.25, z: R.z + 8, hw: 5.75, hd: 76, top: y0 + 0.6 });
    for (let z = zGate - 4; z > zArena + 24; z -= 1.9) {
      for (let k = 0; k < 3; k++) {
        if (rnd() < 0.18) continue;
        const x = R.x + side * (5.4 + k * 3.4 + (rnd() - 0.5) * 0.8);
        const p = { x, y: y0 + 0.6, z: z + (rnd() - 0.5) * 0.6, yaw: (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (rnd() - 0.5) * 0.35, scale: 0.8 + rnd() * 0.5 };
        const r = rnd();
        (r < 0.15 ? runes : r < 0.3 ? crosses : graves).push(p);
      }
    }
  }
  // Solid like any stone (a slim cylinder each; the cross's is narrower).
  api.flora('grave', graves, { trunk: 0.3 });
  api.flora('rune-grave', runes, { trunk: 0.25 });
  api.flora('grave-cross', crosses, { trunk: 0.12 });
  // The plots are the sculpt's raised pads. Dead trees lean over them.
  const trees: Placement[] = [];
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    const x = R.x + side * (14 + rnd() * 6);
    // On the raised plot (|x| < 16) or on the floor beyond it.
    trees.push({ x, y: Math.abs(x - R.x) < 16 ? y0 + 0.6 : y0, z: zGate - 10 - i * 11 - rnd() * 4, yaw: rnd() * 6, scale: 0.9 + rnd() * 0.5 });
  }
  api.flora('dead-forest-tree', trees, { trunk: 0.05 });

  // Something every 35 m: the guards (enemies, data/enemies), a candle shrine, an open grave that throws you up, the gate.
  const shrineZ = R.z + 20;
  for (const side of [-1, 1]) {
    const x = R.x + side * 2.2;
    api.place(modelLandmark('brazier', x, shrineZ, y0, { collider: 'none' }));
    api.vfx(fire(x, y0 + MODELS.brazier.height * 0.9, shrineZ, 0.6, 14));
  }
  const candles: Placement[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const x = R.x + Math.cos(a) * 1.4;
    const z = shrineZ + Math.sin(a) * 1.4;
    candles.push({ x, y: y0, z, yaw: rnd() * 6, scale: 0.9 + rnd() * 0.5 });
    if (i % 3 === 0) api.vfx(fire(x, y0 + 0.3, z, 0.1, 1));
  }
  api.flora('candle', candles, { shadows: false });
  // The skeletons that sit waiting by the gate sit on stones (a mob that sits needs a seat: ENEMY_SPAWNS), 0.28 m behind
  // their spot, the stone's top at the height their sit pose expects (0.5 m, as the campfire barrels).
  const seats: Placement[] = ENEMY_SPAWNS.filter((sp) => sp.kind === 'skeleton' && Math.hypot(sp.x - R.x, sp.z - R.z) < R.radius).map((sp) => {
    const yaw = sp.yaw ?? 0;
    return { x: sp.x - Math.cos(yaw) * 0.28, y: y0, z: sp.z - Math.sin(yaw) * 0.28, yaw: rnd() * 6, scale: 0.5 / MODELS.boulder.height };
  });
  api.flora('boulder', seats);
  // A small glowing toadstool by an open grave (it was a bare glow in the ground): jump on its cap and it squashes and
  // flings you high.
  const graveZ = R.z - 15;
  const capTop = y0 + 1.0;
  api.heights.bouncers.push({ x: R.x, z: graveZ, r: 0.95, top: capTop, v: 18 });
  let squash = -1;
  // (purple-mushroom.glb re-coloured toxic green.)
  const SHROOM = MODELS['purple-mushroom'].height;
  api.place(modelLandmark('purple-mushroom', R.x, graveZ, y0, {
    collider: 'manual', footprints: [{ kind: 'cyl', x: R.x, z: graveZ, r: 0.7, top: capTop }],
    scale: 1.1 / SHROOM,
    onLoad: (m) => restyle(m, (mat) => { patchRetint(mat, new Color(0.35, 1.0, 0.25)); if (mat.map) mat.emissiveMap = mat.map; mat.emissive.set(0x2a9a18); mat.emissiveIntensity = 0.7; }),
    update: (dt, root, _m, player) => {
      const on = Math.hypot(player.x - R.x, player.z - graveZ) < 0.95 && Math.abs(player.y - capTop) < 0.3;
      if (on && squash < 0) squash = 0;
      if (squash >= 0) { squash += dt; if (squash > 0.45) squash = -1; }
      const k = squash >= 0 ? Math.sin((squash / 0.45) * Math.PI) : 0;
      // (Its registry scale on the root: the squash rides on top of it.)
      const base = 1.1 / SHROOM;
      root.scale.set(base * (1 + 0.25 * k), base * (1 - 0.4 * k + 0.12 * Math.max(0, Math.sin((squash / 0.45) * Math.PI * 2 - Math.PI))), base * (1 + 0.25 * k));
    },
  }));
  const pit = glowSprite(PALETTE.witch, 2.2, 0.4, true);
  pit.position.set(R.x, capTop + 0.1, graveZ);
  api.group.add(pit);
  api.place(modelLandmark('ring-portal', R.x, R.z - 45, y0, { collider: 'none', scale: 1.6 }));

  // The end: the cyclops's arena before the gothic tower and its two round towers.
  api.place(modelLandmark('tower', R.x, zArena - 27, y0 - 0.5, { onLoad: (m) => restyle(m, (mat) => { mat.color.multiplyScalar(0.4); }) }));
  for (const side of [-1, 1]) api.place(modelLandmark('round-tower', R.x + side * 14, zArena - 20, y0 - 0.3));
  for (const [x, z] of [[-8, zArena + 6], [8, zArena + 6], [-10, zArena - 10], [10, zArena - 10]] as const) {
    api.place(modelLandmark('brazier', R.x + x, z, y0, { collider: 'none' }));
    api.vfx(fire(R.x + x, y0 + MODELS.brazier.height * 0.9, z, 0.7, 16));
  }

  // Purple mist sprites low over the plots, fireflies (wisps) over the graves.
  for (let i = 0; i < 26; i++) {
    const s = glowSprite(0x6a2aa8, 10 + rnd() * 10, 0.12 + rnd() * 0.08, true);
    s.position.set(R.x + (rnd() - 0.5) * 40, y0 + 0.8 + rnd() * 1.5, R.z + (rnd() - 0.5) * 220);
    api.group.add(s);
  }
  api.vfx(fireflies(R.x - 10, y0 + 0.6, R.z + 30, 9, 3, 40, new Color(0.6, 1.4, 0.5)));
  api.vfx(fireflies(R.x + 10, y0 + 0.6, R.z - 20, 9, 3, 40, new Color(0.6, 1.4, 0.5)));

  // Ways in and out: the church door on the island, the portal at the alley's mouth back to it.
  const exit = portal(R.x, y0 + 2, zGate + 6, 1.8, { vertical: true, facing: -Math.PI / 2, colors: [0x6a2aa8, 0x2a1446] });
  api.place(exit);
  api.realm(null);
  api.heights.add(...solid, ...walls);
  const door = api.door;
  const interactables: Interactable[] = [{
    pos: new Vector3(door.x, door.y + 1, door.z), range: 3.2, zone: null,
    label: () => 'Open the church door',
    act: () => api.teleport()?.(R.x, y0 + 0.05, zGate - 1, -Math.PI / 2, R.name),
  }];
  const links: PortalLink[] = [{ at: new Vector3(R.x, y0 + 1, zGate + 6), radius: 1.6, height: 3, to: { x: door.x + 4, z: door.z, yaw: 0, cameraYaw: Math.atan2(-Math.cos(0), -Math.sin(0)) }, name: 'The Demon Church' }];
  return { links, interactables };
}

/**
 * The tree house (DdKl7fKMO75): its round door opens with F and you step inside, into a round room in the trunk
 * (a small realm of its own) where Goldgrin's diamond-grilled brother keeps shop.
 */
import { Group, PointLight, Vector3 } from 'three';
import { TREEHOUSE_ROOM } from '../data/world';
import { MODELS } from '../data/models';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import type { Footprint } from './Colliders';
import type { Interactable, Teleport } from './Interact';
import { modelLandmark } from './ModelLandmark';
import type { RealmApi } from './Realms';

/**
 * The door opening in tree-house.glb as placed (LAYOUT.treehouse, facing east), measured by ray picks: the plane of
 * the door, its centre line, the threshold and the size of the opening.
 */
export const TREEHOUSE_DOOR = { x: -86.9, z: 30.08, bottom: 4.0, w: 2.2, h: 3.6 };
/**
 * The room (treehouse-interior.glb, 7 m, at TREEHOUSE_ROOM), measured by downward ray picks: the plank floor 1.0 m
 * above the model's base, about 2.3 m around the table in the middle; its round door is on the west side.
 */
const FLOOR = 1.0;
const ROOM_R = 2.3;

export interface TreeHouse {
  interactables: Interactable[];
  /** Floor height inside, and the brother's spot (by the shelves, across the table from the door). */
  floorY: number;
  brotherAt: { x: number; z: number };
}

export function buildTreeHouse(api: RealmApi, teleport: Teleport): TreeHouse {
  const D = TREEHOUSE_DOOR;
  // --- the door: a hinged plank door at the north edge of the opening, swinging inward ---
  const hinge = new Group();
  hinge.position.set(D.x + 0.05, D.bottom, D.z + D.w / 2);
  const door = modelLandmark('treehouse-door', 0, 0, 0, {
    collider: 'none', yaw: Math.PI / 2, scale: D.h / MODELS['treehouse-door'].height,
    // Fit the opening: the model is wider and deeper than the hole in the trunk.
    onLoad: (m) => { m.root.scale.x *= D.w / (D.h * 0.77); m.root.scale.z *= 0.3; },
  });
  door.root.position.set(0, 0, -D.w / 2);
  hinge.add(door.object);
  let open = 0;
  let opening = false;
  api.place({
    object: hinge, footprints: [],
    update: (dt) => {
      if (opening && open < 1) open = Math.min(1, open + dt / 0.9);
      // Eased swing, a little overshoot settling back.
      const k = open < 1 ? 1 - Math.pow(1 - open, 3) : 1;
      hinge.rotation.y = 1.75 * k;
    },
  });
  // A warm-coloured glow would break the palette: the room inside shows dusk light through the open door.
  const spill = glowSprite(PALETTE.dusk, 3.2, 0, true);
  spill.position.set(D.x - 0.6, D.bottom + 1.6, D.z);
  api.group.add(spill);
  api.vfx({ group: new Group(), update: () => { spill.material.opacity = 0.5 * open; } });

  // --- the room inside the trunk ---
  const R = TREEHOUSE_ROOM;
  api.realm(R.id);
  const room = modelLandmark('treehouse-interior', R.x, R.z, R.y, { collider: 'none', yaw: Math.PI / 2 });
  const floorY = R.y + FLOOR;
  const walls: Footprint[] = [{ kind: 'cyl', x: R.x, z: R.z, r: ROOM_R + 0.6, top: floorY }];
  // An unseen ring keeps you inside the round room, and the table stands in the middle.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    walls.push({ kind: 'box', x: R.x + Math.cos(a) * (ROOM_R + 0.25), z: R.z + Math.sin(a) * (ROOM_R + 0.25), hw: 0.25, hd: 0.55, top: floorY + 5, rotY: -a });
  }
  walls.push({ kind: 'cyl', x: R.x, z: R.z, r: 0.6, top: floorY + 0.7 });
  api.place({ ...room, footprints: walls });
  const lamp = new PointLight(PALETTE.dusk, 30, 12, 1.6);
  lamp.position.set(R.x, floorY + 3.2, R.z);
  api.group.add(lamp);
  const lampGlow = glowSprite(PALETTE.dusk, 1.6, 0.5, true);
  lampGlow.position.copy(lamp.position);
  api.group.add(lampGlow);
  // The way out: the room's own round door, west side.
  const exitAt = new Vector3(R.x - ROOM_R + 0.3, floorY, R.z);
  const exitGlow = glowSprite(PALETTE.rune, 2.0, 0.3, true);
  exitGlow.position.set(exitAt.x - 0.3, floorY + 1.3, exitAt.z);
  api.group.add(exitGlow);
  api.realm(null);

  const outside = { x: D.x + 2.4, z: D.z };
  const interactables: Interactable[] = [
    {
      pos: new Vector3(D.x + 1.2, D.bottom, D.z), range: 3.2, zone: null,
      label: () => (open === 0 && !opening ? 'Open the round door' : open >= 1 ? 'Step inside' : null),
      act: () => {
        if (!opening) { opening = true; return; }
        if (open >= 1) teleport(exitAt.x + 1.0, floorY, exitAt.z, 0, R.name);
      },
    },
    {
      pos: exitAt, range: 0.9, zone: R.id,
      label: () => 'Leave the tree house',
      act: () => teleport(outside.x, api.h(outside.x, outside.z), outside.z, 0),
    },
  ];
  return { interactables, floorY, brotherAt: { x: R.x + 1.45, z: R.z + 0.35 } };
}

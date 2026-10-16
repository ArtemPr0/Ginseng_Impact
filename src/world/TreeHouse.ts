/**
 * Goldgrin's brother's home: a round room in a trunk (a small realm of its own) where his diamond-grilled brother
 * keeps shop. Two doors lead in: the tree house's (DdKl7fKMO75), which opens with F and lets you walk through, and
 * the round plank door in the face tree's mouth by the portal (the one people take for his house).
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

/** The face tree's round door (its own planks, in its mouth): a spot in front of it and the way it faces. */
export interface FaceDoor { x: number; z: number; y: number; yaw: number }

export interface TreeHouse {
  interactables: Interactable[];
  /** Floor height inside, and the brother's spot (by the shelves, across the table from the door). */
  floorY: number;
  brotherAt: { x: number; z: number };
}

export function buildTreeHouse(api: RealmApi, teleport: Teleport, faceDoor: FaceDoor): TreeHouse {
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
  // Which door you came in by (you leave by the same one).
  let cameIn: 'tree' | 'face' = 'tree';
  api.place({
    object: hinge, footprints: [],
    update: (dt, player) => {
      if (opening && open < 1) open = Math.min(1, open + dt / 0.9);
      // Eased swing, a little overshoot settling back.
      const k = open < 1 ? 1 - Math.pow(1 - open, 3) : 1;
      hinge.rotation.y = 1.75 * k;
      // Once it is open, stepping up to the doorway takes you in (the trunk's collider stays closed behind the door).
      if (open >= 1 && player && player.x - D.x > -0.5 && player.x - D.x < 2.2 && Math.abs(player.z - D.z) < D.w / 2 && player.y > D.bottom - 1.5 && player.y < D.bottom + 2.5) enter('tree');
    },
  });

  // --- the room inside the trunk ---
  const R = TREEHOUSE_ROOM;
  api.realm(R.id);
  const room = modelLandmark('treehouse-interior', R.x, R.z, R.y, { collider: 'none', yaw: Math.PI / 2 });
  const floorY = R.y + FLOOR;
  const walls: Footprint[] = [{ kind: 'cyl', x: R.x, z: R.z, r: ROOM_R + 0.6, top: floorY }];
  // An unseen ring keeps you inside the round room (all the way up: the trunk is open at the top), a ceiling under
  // the rafters stops you jumping or flying out over the wall, and the table stands in the middle.
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    walls.push({ kind: 'box', x: R.x + Math.cos(a) * (ROOM_R + 0.25), z: R.z + Math.sin(a) * (ROOM_R + 0.25), hw: 0.25, hd: 0.55, top: floorY + 80, rotY: a });
  }
  walls.push({ kind: 'cyl', x: R.x, z: R.z, r: ROOM_R + 1, top: floorY + 80, bottom: floorY + 4.6 });
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
  // In front of the face tree's door, a step out from it.
  const faceOut = { x: faceDoor.x + Math.cos(faceDoor.yaw) * 1.6, z: faceDoor.z + Math.sin(faceDoor.yaw) * 1.6 };
  function enter(by: 'tree' | 'face'): void {
    cameIn = by;
    teleport(exitAt.x + 1.0, floorY, exitAt.z, 0, R.name);
  }
  const interactables: Interactable[] = [
    {
      pos: new Vector3(D.x + 1.2, D.bottom, D.z), range: 3.2, zone: null,
      label: () => (open === 0 && !opening ? 'Open the round door' : open >= 1 ? 'Step inside' : null),
      act: () => {
        if (!opening) { opening = true; return; }
        if (open >= 1) enter('tree');
      },
    },
    {
      // The face tree's door (its planks are part of the tree): a knock, and you are let in.
      pos: new Vector3(faceDoor.x, faceDoor.y, faceDoor.z), range: 3.4, zone: null,
      label: () => "Knock on Glintgrin's door",
      act: () => enter('face'),
    },
    {
      pos: exitAt, range: 0.9, zone: R.id,
      label: () => 'Leave the tree house',
      act: () => {
        if (cameIn === 'face') teleport(faceOut.x, api.h(faceOut.x, faceOut.z), faceOut.z, faceDoor.yaw);
        else teleport(outside.x, api.h(outside.x, outside.z), outside.z, 0);
      },
    },
  ];
  return { interactables, floorY, brotherAt: { x: R.x + 1.45, z: R.z + 0.35 } };
}

import { type Bone, Color, Group, Matrix4, type Mesh, type MeshStandardMaterial, Object3D, type SkinnedMesh, Vector3 } from 'three';
import { socketsInBone } from '../characters/SkullEyes';
import { blunt } from '../render/Blunt';
import { PipeSmoke } from '../render/Smoke';
import { REALM_SCULPTS } from '../data/sculpts';
import { FOLK } from '../data/folk';
import { ANCHORS, CRYPT_ROOM, GALAXY, ISLAND_PORTALS, LANDMARKS, LAYOUT, REALMS, SINK, SKY_EYES, SUNKEN, TAVERN_ROOM, TREEHOUSE_ROOM, VILLAGE } from '../data/world';
import { ENEMY_DEFS, ENEMY_SPAWNS } from '../data/enemies';
import type { Events, Zone } from '../game/Events';
import { PALETTE } from '../render/palette';
import { glowSprite } from '../render/Glow';
import { patchGait, patchGlowCap, patchLitWindows, patchWhiteBloom } from '../render/Materials';
import { PointLight } from 'three';
import { CloudSea } from './CloudSea';
import { GroundQuery } from './Ground';
import { RealmGrounds } from './RealmGround';
import { carveGridOpening, footprintContains, HeightWorld, trunkFootprint, type Footprint, type GridFootprint } from './Colliders';
import { PRESENT_MODELS } from '../data/colliderGrids';
import { MODELS } from '../data/models';
import { waterfall } from './Falls';
import { FIRE, fire } from './Fire';
import { cobbleSpots, floraSet, ringSpots, type Placement } from './Flora';
import { orchardSpots } from './Footprints';
import { Grass } from './Grass';
import type { Landmark } from './Landmarks';
import { modelLandmark, type ModelLandmark, riverDrifter, walkerLandmark } from './ModelLandmark';
import { Npc, NPC_DEFS } from './NPCs';
import { Rig } from '../characters/Rig';
import { yawToRotation } from '../models/ModelRig';
import { Noise2D } from './noise';
import { witchStream } from './Stream';
import { stoneHeadEyes } from './StoneHead';
import { buildCryptRoom, buildTavernRoom } from './Interiors';
import { buildCastleHall } from './CastleHall';
import { landableIsland } from './Islands';
import { CARRIAGE } from './Carriage';
import { buildTreeHouse } from './TreeHouse';
import { buildDream, dreamWatchers } from './Dream';
import { buildKingdom } from './Kingdom';
import { buildLeanQuarter } from './LeanQuarter';
import { type Bouncer, buildHeart } from './Heart';
import { buildGraveyard } from './Graveyard';
import type { ModelRig } from '../models/ModelRig';
import type { Interactable, Teleport } from './Interact';
import type { HostileShot, ShotTarget } from '../combat/CombatSystem';
import { SkyEyes } from '../render/SkyEyes';
import { fireflies } from '../render/Fireflies';

import { buildRealms, type RealmApi } from './Realms';
import type { PortalLink } from './Portal';
import { deadAt, EYE, eyeDistance, frozenAt, pathAt, RIVER, RIVER_LEVEL, riverAt, riverDistance, sandAt, streamAt, Terrain, WORLD } from './Terrain';
import { mistLayers } from '../render/LeanFx';
import { causewayPostPoints, causewayWalk, chainSpan, witchBridgeDeck } from './Walkways';
import { lilyPond, mudPool, river } from './Water';

/**
 * The moon-shell snail (moon-shell-colossus.glb, 16.6 m long, head toward +z; measured): solid as it crawls (two
 * boxes that move with it: the shell and the head), and when the hero stands before its head, within 45° of straight
 * ahead and 30 m, it shoots a pair of green rings from its two tentacle tips.
 */
function snailBehaviour(root: Group, heights: HeightWorld, shoot: (from: Vector3, s: HostileShot) => void): { group: Group; update(dt: number): void } {
  const shell: Footprint & { kind: 'box' } = { kind: 'box', x: 0, z: 0, hw: 4, hd: 5, top: 0 };
  const head: Footprint & { kind: 'box' } = { kind: 'box', x: 0, z: 0, hw: 2.4, hd: 2.4, top: 0 };
  heights.moving.push(shell, head);
  const TIPS = [new Vector3(2.1, 4.8, 8.1), new Vector3(-2.1, 4.8, 8.1)];
  const RING: HostileShot = { speed: 14, color: PALETTE.witch, atk: 85, kind: 'ring', size: 1.4, radius: 0.9 };
  let wait = 1.5;
  const tip = new Vector3();
  const player = new Vector3();
  return {
    group: new Group(),
    update: (dt) => {
      const th = root.rotation.y;
      const at = (zc: number, f: { x: number; z: number; rotY?: number }) => { f.x = root.position.x + Math.sin(th) * zc; f.z = root.position.z + Math.cos(th) * zc; f.rotY = -th; };
      at(-1.5, shell);
      shell.top = root.position.y + 8.4;
      at(5.6, head);
      head.top = root.position.y + 4.6;
      // Facing the hero? (`snailTarget` is the player's position, set by main through the hooks each frame.)
      if (!snailTarget) return;
      player.copy(snailTarget);
      const hx = root.position.x + Math.sin(th) * 7;
      const hz = root.position.z + Math.cos(th) * 7;
      const dx = player.x - hx;
      const dz = player.z - hz;
      const d = Math.hypot(dx, dz);
      const ahead = (dx * Math.sin(th) + dz * Math.cos(th)) / (d || 1);
      wait -= dt;
      if (d < 30 && ahead > Math.cos(Math.PI / 4) && wait <= 0) {
        wait = 2.6;
        root.updateWorldMatrix(true, false);
        for (const t of TIPS) shoot(root.localToWorld(tip.copy(t)), RING);
      }
    },
  };
}
/** The hero's position for things that aim at it (set every frame in World.update). */
let snailTarget: Vector3 | null = null;

/** A river boat (its moving root) and the two knights rowing it. */
export interface Boat { root: Group; rowers: Rig[] }

/** Glints on Goldgrin's brother's diamond grills: a few sharp twinkles at his mouth, livelier while he talks. */
function grillSparkle(npc: Npc): { group: Group; update(dt: number): void } {
  const group = new Group();
  const stars = [0, 1, 2, 3].map(() => { const s = glowSprite(0xffffff, 0.09, 0, true); group.add(s); return { s, phase: Math.random() * 10, rate: 3 + Math.random() * 4 }; });
  let head: Object3D | null = null;
  let t = 0;
  const at = new Vector3();
  return {
    group,
    update: (dt) => {
      t += dt;
      if (!head && npc.rig.model) head = npc.rig.model.bone(/head$/i);
      if (!head) return;
      head.getWorldPosition(at);
      // The mouth: a little in front of and below the head joint, along his facing.
      at.x += Math.cos(npc.yaw) * 0.1;
      at.z += Math.sin(npc.yaw) * 0.1;
      at.y += 0.02;
      stars.forEach((st, i) => {
        st.s.position.set(at.x + Math.sin(npc.yaw) * (i - 1.5) * 0.025, at.y, at.z - Math.cos(npc.yaw) * (i - 1.5) * 0.025);
        st.s.material.opacity = Math.pow(Math.max(0, Math.sin(t * st.rate + st.phase)), 12) * 0.95;
      });
    },
  };
}

/**
 * The crypt skeletons' eyes burn green in their sockets (DeldocTvFiB): two small points carried by the head bone
 * (SkullEyes), placed from the bind pose. (They were set from the body's yaw off the head joint, so a turned or bowed
 * head left a green blob hanging beside the skull: the playtest of 2026-11-12.)
 */
function skullEyes(npc: Npc): { group: Group; update(dt: number): void } {
  const group = new Group();
  const eyes = [0, 1].map(() => { const s = glowSprite(PALETTE.witch, 0.06, 0.95, true); group.add(s); return s; });
  let head: Object3D | null = null;
  let local: Vector3[] | null = null;
  const at = new Vector3();
  return {
    group,
    update: () => {
      if (!head && npc.rig.model) head = npc.rig.model.bone(/head$/i);
      if (head && !local) {
        // The head's world matrix at bind, from the skinned mesh that it drives.
        let skinned: SkinnedMesh | null = null;
        npc.rig.model!.root.traverse((o) => { if (!skinned && (o as SkinnedMesh).isSkinnedMesh && (o as SkinnedMesh).skeleton.bones.includes(head as Bone)) skinned = o as SkinnedMesh; });
        const sm = skinned as SkinnedMesh | null;
        if (sm) {
          sm.updateWorldMatrix(true, false);
          const i = sm.skeleton.bones.indexOf(head as Bone);
          const bind = new Matrix4().multiplyMatrices(sm.matrixWorld, sm.bindMatrix).multiply(sm.skeleton.boneInverses[i].clone().invert());
          local = socketsInBone(bind, npc.yaw);
        }
      }
      group.visible = !!local;
      if (!head || !local) return;
      head.updateWorldMatrix(true, false);
      local.forEach((l, k) => eyes[k].position.copy(at.copy(l).applyMatrix4(head!.matrixWorld)));
    },
  };
}

/**
 * The Skeleton Lord's blunt (Blunt.ts, built in code), held in his right hand's fingers, its ember glowing and its
 * purple smoke rising from it (it rose from a fixed point at his teeth before; the playtest of 2026-11-12 asked for
 * the blunt in his hand). Parented to the hand bone, sized back to metres against the skeleton's scale.
 */
function bluntInHand(npc: Npc): { group: Group; update(dt: number): void } {
  const group = new Group();
  const b = blunt();
  const holder = new Group();
  holder.add(b.object);
  const tip = new Object3D();
  tip.position.copy(b.ember);
  b.object.add(tip, Object.assign(glowSprite(0xff7a2a, 0.09, 0.8, true), { position: b.ember.clone() }));
  const smoke = new PipeSmoke(0xb36bff);
  tip.add(smoke.emitter);
  group.add(smoke.particles);
  let attached = false;
  const ws = new Vector3();
  return {
    group,
    update: (dt) => {
      if (!attached && npc.rig.model) {
        const hand = npc.rig.model.bone(/right.?hand$/i);
        if (!hand) return;
        npc.rig.model.root.updateWorldMatrix(true, true);
        hand.getWorldScale(ws);
        holder.scale.setScalar(1 / Math.max(1e-4, ws.y));
        holder.position.set(BLUNT_GRIP.x / ws.y, BLUNT_GRIP.y / ws.y, BLUNT_GRIP.z / ws.y);
        holder.rotation.set(BLUNT_GRIP.rx, BLUNT_GRIP.ry, BLUNT_GRIP.rz);
        hand.add(holder);
        attached = true;
      }
      if (attached) smoke.update(dt);
    },
  };
}
/** Where the blunt sits in the hand bone's frame (metres; the bone's +y runs to the fingers): between the fingers. */
const BLUNT_GRIP = { x: 0, y: 0.09, z: 0.02, rx: 0, ry: 0, rz: 0 };

/** The diver's brass helmet: its porthole glows white (DeVj-Z8POjl's kelp road), just in front of his head joint. */
function helmetGlow(npc: Npc): { group: Group; update(dt: number): void } {
  const group = new Group();
  const s = glowSprite(0xdff6ff, 0.55, 0.75, true);
  group.add(s);
  let head: Object3D | null = null;
  const at = new Vector3();
  return {
    group,
    update: () => {
      if (!head && npc.rig.model) head = npc.rig.model.bone(/head$/i);
      s.visible = !!head;
      if (!head) return;
      head.getWorldPosition(at);
      s.position.set(at.x + Math.cos(npc.yaw) * 0.2, at.y + 0.1, at.z + Math.sin(npc.yaw) * 0.2);
    },
  };
}

/**
 * Waxwick's head of candles burns (Dd5Bqt7vQ5T's toast): a warm halo over the cluster and a few flickering flames on
 * its wicks, following his head joint.
 */
function candleCrown(npc: Npc): { group: Group; update(dt: number): void } {
  const group = new Group();
  const halo = glowSprite(0xffb050, 1.1, 0.5, true);
  const flames = [0, 1, 2, 3, 4].map(() => glowSprite(0xffd890, 0.16, 0.95, true));
  group.add(halo, ...flames);
  let head: Object3D | null = null;
  const at = new Vector3();
  let t = 0;
  return {
    group,
    update: (dt) => {
      t += dt;
      if (!head && npc.rig.model) head = npc.rig.model.bone(/head$/i);
      group.visible = !!head;
      if (!head) return;
      head.getWorldPosition(at);
      halo.position.set(at.x, at.y + 0.28, at.z);
      flames.forEach((f, i) => {
        const a = i * 1.26 + 0.4;
        const r = i === 0 ? 0 : 0.09;
        f.position.set(at.x + Math.cos(a) * r, at.y + 0.36 - (i === 0 ? 0 : 0.05) + Math.sin(t * 13 + i * 2) * 0.008, at.z + Math.sin(a) * r);
        f.scale.setScalar(0.16 * (0.85 + Math.sin(t * 17 + i * 3) * 0.15));
      });
    },
  };
}

/** Candle-lit windows for a house model: each mesh gets its own material copy with the lit-window glow. */
function litWindows(m: ModelRig): void {
  m.root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as MeshStandardMaterial).clone();
    patchLitWindows(mat);
    mesh.material = mat;
  });
}

/** Where the campfire skeletons sit (data/world ANCHORS) and the fire they face. */
const CAMPFIRE = { x: -24, z: 52 };
const CAMPFIRE_SEATS = new Set(['rattle', 'bone', 'marrow']);
/** Flora with a crown: kept TREE_CLEAR metres from every NPC's spot. */
const TREES = new Set(['pine', 'snow-pine', 'dead-forest-tree', 'gnarled-tree', 'cypress', 'birch', 'willow', 'palm', 'pod-tree', 'giant-mushroom']);
const TREE_CLEAR = 4.5;
/** NPCs who sit on a barrel (the island tavern's four sit round their table in the yard). */
const EVERYONE = [...NPC_DEFS, ...FOLK];
for (const f of FOLK) ANCHORS[f.id] = f.at;
const SEATED = new Set([...FOLK.filter((f) => f.seat).map((f) => f.id), 'rattle', 'bone', 'marrow', 'moss', 'sentry', 'vale-beggar', 'court-knight', 'dock-knight', 'dragon-reader', 'crypt-bones', 'aldous', 'mirren', 'gob-a', 'gob-b', 'croak']);
/** Sitters whose seat is not a barrel (Brother Croak reads on a stone in the castle's shadow). */
const SEAT_MODEL: Record<string, string> = {};
/**
 * The lantern in the rider's right hand, in horse-rider.glb's own frame (forward is -x, the rider's right -z, y up
 * from the hooves): the centre of its lit glass (the texels of the flame, averaged), less the fire's own lift.
 */
const RIDER_LANTERN = { x: 0.32, y: 1.71, z: -0.23 };
/** The horse's legs (columns in the same frame, measured at the hooves, knees and forearms) and their beat in the walk. */
const HORSE_LEGS = [{ x: 0.5, z: 0.13, phase: 0 }, { x: -0.56, z: 0.11, phase: 0.25 }, { x: 0.52, z: -0.18, phase: 0.5 }, { x: -0.5, z: -0.15, phase: 0.75 }];
/** The round door in the face tree's mouth (it faces the way the tree looks: Realms.ts places it), just outside the trunk (its collider ends 5.2 m out). */
const FACE_DOOR = (h: (x: number, z: number) => number) => {
  const ft = ISLAND_PORTALS.galaxy.faceTree;
  const yaw = Math.atan2(-15, 4);
  const x = ft.x + Math.cos(yaw) * 5.6;
  const z = ft.z + Math.sin(yaw) * 5.6;
  return { x, z, y: h(x, z), yaw };
};
/** Routes the ground walkers take: no trees grow on them. */
const WALKER_ROUTES = [LAYOUT.logGiantPath, LAYOUT.riderPath, LAYOUT.colossusPath];
function nearRoute(route: ReadonlyArray<readonly [number, number]>, x: number, z: number, r: number): boolean {
  for (let i = 0; i < route.length; i++) {
    const [ax, az] = route[i];
    const [bx, bz] = route[(i + 1) % route.length];
    const dx = bx - ax;
    const dz = bz - az;
    const l2 = dx * dx + dz * dz || 1;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
    const ex = x - (ax + dx * t);
    const ez = z - (az + dz * t);
    if (ex * ex + ez * ez < r * r) return true;
  }
  return false;
}

/** How far from each footprint nothing grows. */
const plantPad = (f: Footprint): number => f.kind === 'cyl' ? f.r + 2 : f.kind === 'grid' ? f.r * 0.85 + 1 : Math.max(f.hw, f.hd) + 2;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/**
 * Assembles the island. Every structure, creature and plant is a Meshy model placed by id (a glowing
 * marker stands in for a file that has not been generated yet); terrain, water, sky, fire and glow
 * effects are the only procedural visuals.
 */
export class World {
  readonly group = new Group();
  readonly heights: HeightWorld;
  readonly npcs: Npc[] = [];
  readonly grass: Grass;
  /** Church position, used to brighten the aurora nearby. */
  readonly auroraCentre = new Vector3();
  /** Portals between the island and the realms (main.ts teleports the player through them). */
  readonly portals: PortalLink[] = [];
  /** Things to use with F (doors, boats); main.ts offers the nearest one in the player's zone. */
  readonly interactables: Interactable[] = [];
  /** What main.ts lets the world do to the player: move them, sit them in a boat. */
  readonly hooks: {
    teleport?: Teleport; board?: (boat: Boat) => void; mire?: (seconds: number) => void; shoot?: (from: Vector3, s: HostileShot) => void; hurt?: (atk: number, poison?: { dps: number; seconds: number }) => void;
    /** Yung Lean's quest: is the lost sound there to find, and the hero took it. */
    soundWanted?: () => boolean; foundSound?: () => void;
    /** A small prize for a feat in the world ('eyes': every sky eye shot). */
    reward?: (what: string) => void;
    /** The world swirls (a sip from the Lean Quarter's fountains). */
    trip?: (strength: number, seconds: number) => void;
    /** The game's event bus: zone changes and the world's own feats (a fountain sip) are announced on it. */
    events?: Events;
  } = {};
  /** The river boats with their two rowers each. */
  readonly boats: Boat[] = [];
  /** The eye pool at the island's heart (it startles when shot). */
  eye: ReturnType<typeof buildHeart>['eye'] | null = null;
  /** Mushroom caps that bounce the hero up (CharacterController reads them). */
  readonly bouncers: Bouncer[] = [];
  /** Shootable things that are not enemies (main.ts hands them to CombatSystem.targets). */
  readonly shotTargets: ShotTarget[] = [];
  /** Things updated with the camera and the hero (sky eyes), in their zone only. */
  private readonly watchers: Array<{ zone: string | null; update(dt: number, cam: Vector3, player: Vector3): void }> = [];
  private readonly landmarks: Landmark[] = [];
  /** Build target and zone: the island (null) or a realm id; objects in a realm group are drawn and updated only there. */
  private target!: Group;
  private zone: string | null = null;
  private readonly realmGroups = new Map<string, Group>();
  /**
   * Barrel stools still to be fitted to their sitters: once the sit clip plays, the stool moves under the hips (each
   * body's sit pose puts them somewhere else: Old Moss hovered 0.9 m beside his) and the sitter settles onto it.
   */
  private readonly seatFits: Array<{ id: string; barrel: Group; top: number; wait: number }> = [];
  /** The sitters' seats by NPC id (Croak's boulder goes with him when he is carried off in the sack and put down). */
  private readonly seats = new Map<string, ModelLandmark>();
  /** Swimmable water out in the realms (the vale's river, the lean moat): surface `level` over [x0, x1] × [z0, z1]. */
  private readonly waterZones: Array<{ x0: number; x1: number; z0: number; z1: number; level: number }> = [];
  private readonly zoneOf = new Map<object, string | null>();
  private here: string | null | undefined = undefined;
  private readonly extras: Array<{ update: (dt: number) => void }> = [];
  /** The cloud sea under every place (main.ts sets its level per zone): it lives in the scene root, beside `group`. */
  readonly clouds: CloudSea;
  /** Sculpted floors of the four realms. HeightWorld reads them; the mesh is baked on the first visit. */
  readonly realmGround = new RealmGrounds();
  /** Rim colliders added once per sculpted realm (first visit). */
  private readonly noise = new Noise2D(1337);

  /** The drawn ground alone, no colliders. */
  readonly ground: GroundQuery;

  constructor(readonly terrain: Terrain) {
    this.ground = new GroundQuery(terrain, this.realmGround);
    this.heights = new HeightWorld(this.ground);
    // The great river is the swimmable water (the lily pond and the pools are only knee to waist deep), and the realms'
    // rivers and moats (RealmApi.water).
    this.heights.water = (x, z) => {
      if (riverAt(x, z) > 0.3) return RIVER_LEVEL;
      for (const w of this.waterZones) if (x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return w.level;
      return null;
    };
    // Out in a realm flight's ceiling counts from the realm's floor, not from the void beside it.
    this.heights.flyFloor = (x, z) => {
      const land = this.realmGround.heightAt(x, z);
      if (land !== null) return land;
      const realm = REALMS.find((r) => Math.abs(x - r.x) < r.radius + 120 && Math.abs(z - r.z) < r.radius + 120);
      return realm ? realm.y : 0;
    };
    this.target = this.group;
    const rnd = rng(4242);
    const world0 = this;
    const h = (x: number, z: number) => terrain.heightAt(x, z);
    /** Island terrain, or a realm's sculpt where one reaches (placements, seats, the realm builders' `h`). */
    const gh = (x: number, z: number) => this.realmGround.heightAt(x, z) ?? h(x, z);
    // What a seat stands on: the sculpted ground, or over a realm's void (the sky dock, the rooms) the floor collider at
    // the realm's own height, shapes overhead ignored.
    const seatGround = (x: number, z: number) => {
      const g = gh(x, z);
      if (g > -20) return g;
      const r = REALMS.find((q) => Math.hypot(x - q.x, z - q.z) < q.radius);
      return r ? this.heights.heightAt(x, z, r.y + 0.5) : g;
    };
    // Ground-level height for things placed on the island (walkers, NPCs, grass): overhangs above the ground are skipped.
    const hw = (x: number, z: number, y?: number) => this.heights.heightAt(x, z, y ?? terrain.heightAt(x, z));
    const flora = (id: string, placements: Placement[], opts?: Parameters<typeof floraSet>[2] & { trunk?: number }) => {
      // Trees and bushes keep off the landmarks: nothing grows through a statue or a tower.
      if (/tree|pine|birch|palm|bush|cypress/.test(id)) placements = placements.filter((p) => !LANDMARK_CLEARINGS.some((c) => Math.hypot(p.x - c.x, p.z - c.z) < c.r));
      // No tree grows where someone stands: a crown over an NPC's spot hid their head in it (Mother Marrow's pine).
      if (TREES.has(id)) placements = placements.filter((p) => !Object.values(ANCHORS).some((a) => (a.x - p.x) ** 2 + (a.z - p.z) ** 2 < TREE_CLEAR ** 2));
      // Trees are solid at the trunk (climbable, like any trunk), never at the crown.
      if (opts?.trunk) for (const p of placements) { const f = trunkFootprint(id, p.x, p.y, p.z, p.scale, opts.trunk); if (f) this.heights.add(f); }
      const set = floraSet(id, placements, opts);
      this.target.add(set.group);
      this.extras.push(set);
      this.zoneOf.set(set, this.zone);
    };
    const vfx = (f: { group: Group; update: (dt: number) => void }) => { this.target.add(f.group); this.extras.push(f); this.zoneOf.set(f, this.zone); };

    // --- walkways (placeholder slabs until their models land) ---
    const causeway = causewayWalk(LAYOUT.causeway, h, MODELS['causeway-segment'].height);
    this.place(causeway.landmark);
    flora('causeway-segment', causeway.spans);
    // Piers: under every joint over the chasm a rock spire climbs out of the cloud sea to the arch feet, all alike
    // (slimmed across, or a 95 m spire would be 35 m wide).
    for (const p of causeway.piers) {
      const lm = modelLandmark('pinnacle', p.x, p.z, p.y, { collider: 'none', scale: p.height / MODELS.pinnacle.height });
      lm.root.scale.x *= 0.3;
      lm.root.scale.z *= 0.3;
      this.place(lm);
    }
    const cb = LAYOUT.chasmBridge;
    // (A chain span from bank to bank: a flat deck at the higher bank hung the north end 3 m over its ground.)
    const bridge = chainSpan(cb.ax, cb.az, h(cb.ax, cb.az) + 0.45, cb.bx, cb.bz, h(cb.bx, cb.bz) + 0.45, MODELS['chasm-bridge'].height);
    this.place(bridge);
    flora('chasm-bridge', bridge.tiles);
    const deck = witchBridgeDeck(LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, h);
    this.place(deck);
    // The witches' bridge (DeWji_1PuKW): the stone slab keeps the colliders and hides once the model is in.
    // The slab's measured, stepped deck stays the collider (the model's grid would add its abutments too).
    this.place(modelLandmark('witch-bridge', LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, deck.baseY, { collider: 'none', onLoad: () => { deck.object.visible = false; deck.object.userData.hidden = true; } }));

    // --- the skyline ---
    // Every building below collides exactly as its model looks (baked grids, see Colliders.ts).
    const headY = h(LAYOUT.head.x, LAYOUT.head.z) - SINK.head;
    this.place(modelLandmark('head', LAYOUT.head.x, LAYOUT.head.z, headY, { color: PALETTE.blood }));
    this.place(stoneHeadEyes());
    const cathY = LAYOUT.cathedral.y;
    const cs = LAYOUT.cathedral.scale;
    {
      // The east door is the way in: the model's arch is 2.6 m wide and too low for a hero, so a broken gap replaces
      // it, in the collider (carved) and in the mesh (cut away in the shader).
      // (Measured at 0.7 with the model at (68, -18): the door 18 m east of the centre, the carve 15.4..19.4 m east.)
      const cat = LAYOUT.cathedral;
      const door = { x: cat.x + (18 / 0.7) * cs, z: cat.z + 0.1, halfWidth: 3.2, floor: 3.75, spring: 2.6 };
      const cathedral = modelLandmark('cathedral', cat.x, cat.z, cathY, { yaw: cat.yaw, scale: cs, onLoad: (m) => cutDoor(m.root, door) });
      let grid = cathedral.footprints.find((f): f is GridFootprint => f.kind === 'grid');
      if (grid) { for (const dx of [15.4, 16.4, 17.4, 18.4, 19.4]) grid = carveGridOpening(grid, cat.x + (dx / 0.7) * cs, door.z, door.halfWidth - 0.4); cathedral.footprints = [grid]; }
      this.place(cathedral);
    }
    // Its nave is open to walk in through the arch at the east end (scripts/collider-grids.mjs): two rows of candles
    // down the aisle and a cold light under the vault so the inside reads.
    {
      const cat = LAYOUT.cathedral;
      const nave: Placement[] = [];
      for (let dx = -18; dx <= 20; dx += 6) for (const side of [-1, 1]) {
        const x = cat.x + dx * cs;
        const z = cat.z + side * 3.2 * cs;
        const y = this.heights.heightAt(x, z, cathY + 1);
        nave.push({ x, y, z, yaw: 0, scale: 1.4 });
        vfx(fire(x, y + 0.42, z, 0.12, 1.2));
      }
      flora('candle', nave, { shadows: false });
      for (const x of [cat.x - 8 * cs, cat.x + 12 * cs]) {
        const y = this.heights.heightAt(x, cat.z, cathY + 1) + 7 * cs;
        const light = new PointLight(PALETTE.rune, 40, 26, 1.6);
        light.position.set(x, y, cat.z);
        this.group.add(light);
        const glow = glowSprite(PALETTE.rune, 4, 0.25, true);
        glow.position.copy(light.position);
        this.group.add(glow);
      }
    }
    const castleY = h(LAYOUT.castle.x, LAYOUT.castle.z) - SINK.castle;
    this.place(modelLandmark('castle', LAYOUT.castle.x, LAYOUT.castle.z, castleY, { yaw: LAYOUT.castle.yaw }));
    // Its open courtyard is walkable through the south gate (scripts/collider-grids.mjs): candles along both curtain
    // walls and two cold lights above the yard, like the cathedral's nave.
    {
      const cas = LAYOUT.castle;
      const yard: Placement[] = [];
      for (let z = cas.z - 8; z <= cas.z + 6; z += 4.6) for (const side of [-1, 1]) {
        const x = cas.x + side * 8.5;
        const y = this.heights.heightAt(x, z, castleY + 2);
        yard.push({ x, y, z, yaw: 0, scale: 1.4 });
        vfx(fire(x, y + 0.42, z, 0.12, 1.2));
      }
      flora('candle', yard, { shadows: false });
      for (const z of [cas.z - 6, cas.z + 3]) {
        const y = this.heights.heightAt(cas.x, z, castleY + 2) + 6;
        const light = new PointLight(PALETTE.rune, 34, 22, 1.6);
        light.position.set(cas.x, y, z);
        this.group.add(light);
        const glow = glowSprite(PALETTE.rune, 3.5, 0.22, true);
        glow.position.copy(light.position);
        this.group.add(glow);
      }
    }
    // Antler throne (DedGUYetKjP) on its dais in front of the castle gate, facing +z (the road).
    const th = LAYOUT.throne;
    const thY = h(th.x, th.z) - SINK.throne;
    this.place(modelLandmark('throne', th.x, th.z, thY));
    const thS = MODELS.throne.height / 4.5;
    for (const side of [-1, 1]) vfx(fire(th.x + side * 2.6 * thS, thY + 2.85 * thS, th.z + 0.4 * thS, 0.3, 8));
    // Horned facade faces east (local +z → world +x), toward the road from the spawn.
    const ch = LAYOUT.church;
    const churchY = h(ch.x, ch.z) - SINK.church;
    this.place(modelLandmark('church', ch.x, ch.z, churchY, { yaw: Math.PI / 2, update: churchGlow(this.group, ch.x + MODELS.church.height * 0.4, churchY, ch.z) }));
    this.auroraCentre.set(ch.x, 0, ch.z);
    const tw = LAYOUT.tower;
    const towerY = h(tw.x, tw.z) - SINK.tower;
    // Cave mouth on the east flank of the rock base (glow + walkable opening through the baked shell).
    const caveX = tw.x + 7.7, caveZ = tw.z + 4.7;
    {
      const tower = modelLandmark('tower', tw.x, tw.z, towerY);
      const grid = tower.footprints.find((f): f is GridFootprint => f.kind === 'grid');
      if (grid) tower.footprints = [carveGridOpening(grid, caveX, caveZ, 2.4)];
      this.place(tower);
      const cave = glowSprite(PALETTE.rune, 5, 0.35, true);
      cave.position.set(caveX, towerY + 2.2, caveZ);
      this.group.add(cave);
      const caveLight = new PointLight(PALETTE.rune, 18, 12, 1.8);
      caveLight.position.copy(cave.position);
      this.group.add(caveLight);
    }
    const tr = LAYOUT.treehouse;
    this.place(modelLandmark('treehouse', tr.x, tr.z, h(tr.x, tr.z) - SINK.treehouse, { yaw: Math.PI / 2 }));
    // The free-standing buildings and props (data/world.ts LANDMARKS, measured by IslandTruth.test.ts).
    const spotted = new Set<string>();
    const spot = (id: string) => {
      const l = LANDMARKS.find((s) => s.id === id);
      if (!l) throw new Error(`LANDMARKS has no ${id}`);
      spotted.add(id);
      return { ...l, y: l.fixedY ?? h(l.at?.x ?? l.x, l.at?.z ?? l.z) - (l.sink ?? 0) };
    };
    // Every LANDMARKS entry is placed: the plain ones here, the ones with props and fires (PROPPED) below by name; a spot
    // never asked for is reported, so a new entry cannot stand in the data and not in the game.
    const PROPPED = new Set(['tavern', 'campfire', 'cloister', 'observatory', 'cauldron']);
    for (const l of LANDMARKS) if (!PROPPED.has(l.id)) { const s = spot(l.id); this.place(modelLandmark(l.id, s.x, s.z, s.y, { yaw: s.yaw ?? 0, scale: s.scale })); }
    // Things that only make sense once their model exists: the palm island's falls, the burning castle's blaze.
    if (PRESENT_MODELS.has('palmisland')) {
      this.place(modelLandmark('palmisland', 72, 89, 34, { collider: 'none', update: (dt, root) => { root.position.y = 34 + Math.sin(performance.now() * 0.0004) * 0.6; void dt; } }));
      // Two falls off the rock's real rim (measured: 8.2 m out, 13 m up its 28 m), down into the cloud sea.
      for (const [dx, dz, w] of [[7.6, 1.5, 2.6], [-4.5, 6.4, 2]] as const) this.place(waterfall(72 + dx, 89 + dz, 46.6, w, 76, false));
    }
    if (PRESENT_MODELS.has('burning-castle')) {
      this.place(modelLandmark('burning-castle', 0, 180, -14, { color: PALETTE.blood, collider: 'none' }));
      vfx(fire(0, 25, 180, 14, 0));
    }
    for (const r of LAYOUT.ruins) this.place(modelLandmark(r.arch ? 'ruin-arch' : 'ruin-column', r.x, r.z, h(r.x, r.z) - SINK.ruin, { yaw: r.yaw }));
    // Rainy orchard (DdKl7fKMO75): rows of twisted trees; each trunk is solid once the tree model exists.
    const orng = rng(321);
    // (Not in the river: the orchard's south row reaches its channel.)
    flora('gnarled-tree', orchardSpots(LAYOUT.orchard.x, LAYOUT.orchard.z).map(([x, z]: [number, number]) => ({ x, y: h(x, z) - 0.2, z, yaw: orng() * Math.PI * 2, scale: 0.75 + orng() * 0.3 })).filter((p) => riverAt(p.x, p.z) < 0.02 && riverDistance(p.x, p.z) > 7 && !this.heights.blocked(p.x, p.z)), { trunk: 0.05 });
    const pool = LAYOUT.floodedRuin;
    // The Marsh Sovereign stands waist-deep in it; wading in drags at your legs.
    this.place(mudPool(pool.x, pool.z, pool.mud, pool.r, (wading) => { if (wading) this.hooks.mire?.(0.4); }));
    // (The troll's gorge is carved into the terrain now: Terrain.ts WORLD.gorge, dressed in Heart.ts.)
    // Backdrop mountain ring (scale encodes the old cone sizes).
    const mountains: Placement[] = [];
    const mr = rng(77);
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2 + (mr() - 0.5) * 0.25; const r = 270 + mr() * 60; mr(); const hgt = 130 + mr() * 90; mountains.push({ x: Math.cos(a) * r, y: -90, z: -36 + Math.sin(a) * r, yaw: mr() * Math.PI, scale: hgt / 180 }); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3 + (mr() - 0.5) * 0.4; const r = 190 + mr() * 35; mr(); const hgt = 60 + mr() * 40; mountains.push({ x: Math.cos(a) * r, y: -90, z: -36 + Math.sin(a) * r, yaw: mr() * Math.PI, scale: hgt / 180 }); }
    // (Shaded, not textured: simplifying the mesh scrambles its UVs. Night rock, with snow on whatever faces up.)
    flora('mountain', mountains, { shadows: false, patch: (m) => {
      m.map = m.normalMap = m.roughnessMap = m.metalnessMap = null;
      m.color.set(0x27345f); m.roughness = 1; m.metalness = 0; m.envMapIntensity = 0;
      m.onBeforeCompile = (sh) => {
        sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.62, 0.7, 0.92), smoothstep(0.52, 0.74, inverseTransformDirection(normal, viewMatrix).y));`);
      };
      m.customProgramCacheKey = () => 'mountain-snow';
    } });
    const pinSpots: Placement[] = [];
    for (let i = 0; i < 26; i++) pinSpots.push({ x: (rnd() - 0.5) * 190, y: LAYOUT.cloudSea.y - 6, z: 141 + rnd() * 66, yaw: rnd() * 6, scale: 0.6 + rnd() * 0.9 });
    // (The burning castle stands clear of them, seen across the water from the south shore.)
    flora('pinnacle', pinSpots.filter((p) => Math.hypot(p.x, p.z - 180) > 42 && Math.abs(p.x) > 20), { shadows: false });

    // --- creatures that wander ---
    // The Frog King is an NPC now (he has a son to find); his bulk stays solid.
    // (He stands on the ground: his NPC is placed after this collider exists, so it is given the ground height.)
    const frogY = h(LAYOUT.frog.x, LAYOUT.frog.z);
    this.heights.add({ kind: 'cyl', x: LAYOUT.frog.x, z: LAYOUT.frog.z, r: MODELS.frogking.height * 0.4, top: frogY + MODELS.frogking.height * 0.75 });
    ANCHORS.frogking = { ...ANCHORS.frogking, x: LAYOUT.frog.x, z: LAYOUT.frog.z, y: frogY };
    // Walkers follow the ground itself (never trunks or roofs); their routes are kept clear of trees (plantable).
    const snail = walkerLandmark('colossus', LAYOUT.colossusPath, 0.9, h, { lift: -0.5, clip: 'idle', trail: true });
    this.place(snail);
    vfx(snailBehaviour(snail.root, this.heights, (from, s) => this.hooks.shoot?.(from, s)));
    // (The log giant is an enemy now: he walks his road and fights back when hit; see data/enemies.)
    // (The spider chapel is a boss now: it stalks the kingdom's snowfield and fights; see data/enemies.)
    const rider = walkerLandmark('horse-rider', [...LAYOUT.riderPath], 3.2, h);
    // The lantern fire hangs from the rider's raised hand (horse-rider.glb, measured in the model's own frame).
    const lantern = fire(0, 0, 0, 0.3, 8);
    // Bright enough to find him by in the trees: a lamp that reaches 22 m and a halo around the flame.
    const lamp = new PointLight(FIRE, 32, 22, 1.4);
    // (Up and out from the horse's flank, so the lamp lights the clearing rather than burning a spot on the coat.)
    lamp.position.set(0, 0.6, -0.4);
    const halo = glowSprite(FIRE, 2.2, 0.35, true);
    halo.position.set(0, 0.2, 0);
    lantern.group.add(lamp, halo);
    const riderLoad = rider.update!;
    let lanternAttached = false;
    rider.update = (dt, p) => {
      riderLoad(dt, p);
      if (!lanternAttached && rider.model) {
        lanternAttached = true;
        lantern.group.position.set(RIDER_LANTERN.x, RIDER_LANTERN.y, RIDER_LANTERN.z);
        rider.model.frame.add(lantern.group);
        // The horse walks (the mesh has no skeleton: its legs swing in the vertex shader).
        rider.model.root.updateWorldMatrix(true, true);
        const toFrame = rider.model.frame.matrixWorld.clone().invert();
        rider.model.root.traverse((o) => {
          const mesh = o as Mesh;
          if (mesh.isMesh) patchGait(mesh.material as MeshStandardMaterial, { legs: HORSE_LEGS, hipY: 0.95, radius: 0.2, rate: 1.6, amp: 0.42, rel: mesh.matrixWorld.clone().premultiply(toFrame) });
        });
      }
    };
    this.extras.push(lantern);
    this.place(rider);
    // Flying koi over the lily pond are combat enemies now (ENEMY_SPAWNS 'koi'): killable, never hostile.
    // (On the bank east of the lily pond, not in its water.)
    this.place(modelLandmark('snake', -4, -14, h(-4, -14) + 0.05, { clip: 'idle', collider: 'none' }));

    // --- water ---
    const theRiver = river(h, rnd);
    // The river's sink pool at its west end (it bends away from the witches' bridge, 2026-11-10): a low cool mist over
    // the water where it ends, so the end reads as a pool and not as a sheet cut off.
    { const [ex, ez] = RIVER[RIVER.length - 1]; this.group.add(mistLayers(ex, ez, 26, 26, RIVER_LEVEL + 0.2, 0x3050ff, 0.16, 2)); }
    this.place(theRiver);
    // No reed clumps on the banks: the reed model is a heap of loose shards at any distance (eye-level walk,
    // 2026-11-04), so the banks keep the grass instead. (reedSpots still draws its randoms, so nothing placed
    // after it moves.)
    const pond = lilyPond(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r, rnd);
    this.place(pond);
    // The lily pads with their pink lotus (Dd93tyxMLB3, round 9), as modelled: the stone stand-in was pressed flat and
    // painted, with a second copy recoloured as the flower on top; the model carries its own flower.
    flora('lily-pad', pond.padSpots, { shadows: false });
    // Two armoured knights row each boat (DdjlyzyOcnK), facing the stern as rowers do.
    for (const [start, speed] of [[0, 2.4], [108, 2.0]] as const) {
      const boat = riverDrifter('boat', start, speed);
      const rowers: Rig[] = [];
      for (const dz of [0.55, -0.45]) {
        const rig = new Rig({ id: 'rower', name: 'Rower', title: '', element: 'fog', weapon: 'sword', maxHp: 1, atk: 1, accent: PALETTE.electric }, 'knight-npc');
        rig.root.position.set(0, 0.32, dz);
        rig.root.rotation.y = yawToRotation(-Math.PI / 2);
        boat.root.add(rig.root);
        rowers.push(rig);
      }
      const base = boat.update!;
      boat.update = (dt, player) => { base(dt, player); for (const r of rowers) r.animate({ mode: 'ground', speed: 0, pose: 'row' }, dt); };
      this.place(boat);
      const b: Boat = { root: boat.root, rowers };
      this.boats.push(b);
      // Swim or wade up to a boat and climb in (main.ts seats you between the rowers).
      const at = new Vector3();
      this.interactables.push({ pos: at, range: 3.6, zone: null, label: () => { at.copy(boat.root.position); return 'Climb into the boat'; }, act: () => this.hooks.board?.(b) });
    }
    this.place(witchStream((z) => terrain.streamCentre(z), LAYOUT.coven.zMin, LAYOUT.coven.zMax, LAYOUT.coven.bridgeZ, deck.deckY, h, {
      shoot: (from, s) => this.hooks.shoot?.(from, s),
      hurt: (atk, poison) => this.hooks.hurt?.(atk, poison),
    }));
    this.place(modelLandmark('cauldron', LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, deck.deckY + 0.05, { color: PALETTE.witch }));

    // --- the island's heart (#28) and the forest gorge (01.16.36) ---
    const heart = buildHeart({
      get group() { return world0.target; }, realm: (id) => this.enterZone(id), place: (l) => this.place(l), flora, vfx, h, rnd,
      shoot: (from, sh) => this.hooks.shoot?.(from, sh), heights: this.heights,
    });
    this.eye = heart.eye;
    this.bouncers.push(...heart.bouncers);
    this.heights.bouncers.push(...heart.bouncers);
    // Eyes in the sky that watch the hero (and glare when shot); the eye pool startles when a shot lands in it.
    const skyEyes = new SkyEyes(SKY_EYES);
    this.group.add(skyEyes.group);
    this.watchers.push({ zone: null, update: (dt, cam, p) => skyEyes.update(dt, cam, p) });
    this.shotTargets.push(...skyEyes.targets());
    skyEyes.onAllHurt = () => this.hooks.reward?.('eyes');
    // (A low sphere: only shots that come down into the pool's middle count, not ones flying over it.)
    this.shotTargets.push({ pos: new Vector3(EYE.x, RIVER_LEVEL - 3, EYE.z), radius: 5.5, active: () => this.here === null, onHit: () => heart.eye.startle() });

    // --- settlements ---
    const vrnd = rng(909);
    for (const [dx, dz, , , rot] of VILLAGE.houses) {
      const x = VILLAGE.x + dx;
      const z = VILLAGE.z + dz;
      this.place(modelLandmark('village-house', x, z, h(x, z) - SINK.house, { yaw: rot, onLoad: (m) => litWindows(m) }));
    }
    const torchSpots: Placement[] = [];
    const torchH = MODELS['torch-post'].height;
    for (const [dx, dz] of VILLAGE.torches) {
      const x = VILLAGE.x + dx;
      const z = VILLAGE.z + dz;
      torchSpots.push({ x, y: h(x, z), z, yaw: 0, scale: 1 });
      vfx(fire(x, h(x, z) + torchH * 0.86, z, 0.4, 8));
    }
    flora('torch-post', torchSpots);
    flora('cobblestone', cobbleSpots([[VILLAGE.x - 34, VILLAGE.z + 1], [VILLAGE.x + 34, VILLAGE.z + 1]], 5, h, vrnd).filter((p) => !this.insideBuilding(p.x, p.z)), { shadows: false });
    const tv = spot('tavern');
    const tavernY = tv.y;
    this.place(modelLandmark('tavern', tv.x, tv.z, tavernY));
    // The yard table the regulars sit round on barrel stools (ANCHORS), candles on it.
    {
      const tx = 24.5, tz = 70.8, ty = h(tx, tz);
      flora('tavern-table', [{ x: tx, y: ty, z: tz, yaw: 0, scale: 1 }]);
      if (PRESENT_MODELS.has('tavern-table')) this.heights.add({ kind: 'box', x: tx, z: tz, hw: 1.6, hd: 0.6, top: ty + 0.95, rotY: 0 });
      const candles = [-0.9, 0.9].map((dx) => ({ x: tx + dx, y: ty + 0.97, z: tz, yaw: 0, scale: 1 }));
      flora('candle', candles, { shadows: false });
      for (const c of candles) { const g = glowSprite(0xffb050, 0.7, 0.55, true); g.position.set(c.x, c.y + 0.38, c.z); this.group.add(g); }
      // What the regulars are drinking stands on the table in front of them.
      flora('tankard', [[-0.45, 0.2], [0.35, 0.22]].map(([dx, dz]) => ({ x: tx + dx, y: ty + 0.97, z: tz + dz, yaw: dx * 4, scale: 1 })), { shadows: false });
      flora('lean-cup', [[0.5, -0.2], [-0.3, -0.22]].map(([dx, dz]) => ({ x: tx + dx, y: ty + 0.97, z: tz + dz, yaw: 0, scale: 1 })), { shadows: false });
    }
    const cf = spot('campfire');
    const campY = cf.y;
    this.place(modelLandmark('campfire', cf.x, cf.z, campY));
    vfx(fire(cf.x, campY + 0.25, cf.z, 1.5, 34));
    const steam = glowSprite(0x8fa2ff, 1.6, 0.18, true);
    steam.position.set(cf.x, campY + 2.5, cf.z);
    this.group.add(steam);
    this.extras.push({ update: (dt) => { steamT += dt; steam.position.y = campY + 2.4 + Math.sin(steamT) * 0.2; steam.scale.setScalar(1.6 + Math.sin(steamT * 0.7) * 0.4); } });
    let steamT = 0;
    const cl = spot('cloister');
    // The baked grid keeps the columns solid and the arches open to walk through.
    this.place(modelLandmark('cloister', cl.x, cl.z, cl.y));
    flora('cobblestone', cobbleSpots([[23, 68], [41, 68]], 7, h, rng(55)).filter((p) => !this.insideBuilding(p.x, p.z)), { shadows: false });
    const ob = spot('observatory');
    this.place(modelLandmark('observatory', ob.x, ob.z, ob.y));
    const pot = spot('cauldron');
    const potY = pot.y;
    this.place(modelLandmark('cauldron', pot.x, pot.z, potY, { color: PALETTE.witch }));
    vfx(fire(pot.x, potY - 0.1, pot.z, 0.7, 14));
    for (const l of LANDMARKS) if (!spotted.has(l.id)) console.error(`LANDMARKS entry ${l.id} was never placed`);
    // Lanterns and candles along the causeway.
    const posts = causewayPostPoints(LAYOUT.causeway, MODELS['causeway-segment'].height);
    const lanternSpots: Placement[] = [];
    const candleSpots: Placement[] = [];
    posts.forEach((p, i) => {
      if (i % 6 === 0) lanternSpots.push({ x: p.x, y: p.y, z: p.z, yaw: 0, scale: 1 });
      else if (i % 2 === 0) { candleSpots.push({ x: p.x, y: p.y, z: p.z, yaw: 0, scale: 1 }); vfx(fire(p.x, p.y + 0.3, p.z, 0.1, 1.2)); }
    });
    flora('lantern-post', lanternSpots);
    flora('candle', candleSpots, { shadows: false });
    for (const p of lanternSpots) { const halo = glowSprite(PALETTE.blood, 2.4, 0.45, true); halo.position.set(p.x, p.y + 2.1, p.z); this.group.add(halo); }

    // --- flora and biomes ---
    // (The view from the spawn down the mushroom road to the eye stays open: no pines in it.)
    // (None under the world tree's crown, 22 m across the radius: it is placed later, with the realms, so its collider
    // cannot keep them out; a pine grew up through its roots.)
    flora('pine', this.scatterRing(rnd, LAYOUT.forest.innerRadius, LAYOUT.forest.outerRadius, LAYOUT.forest.count, 0.8, 1.2, 2.8)
      .filter((p) => !(Math.abs(p.x) < 18 && p.z > 24 && p.z < 78) && Math.hypot(p.x - LAYOUT.worldTree.x, p.z - LAYOUT.worldTree.z) > 24), { trunk: 0.035 });
    for (const f of LAYOUT.sunflowerFields) flora('sunflower', this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.8, 1.2), { wind: 0.18 });
    const meadow: Placement[] = [];
    const whiteMeadow: Placement[] = [];
    for (const f of LAYOUT.flowerMeadows) (f.white ? whiteMeadow : meadow).push(...this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.7, 1.3));
    meadow.push(...this.scatterRing(rnd, 12, 90, 380, 0.6, 1.1));
    flora('flower', meadow, { wind: 0.5, shadows: false });
    flora('flower', whiteMeadow, { wind: 0.5, shadows: false, patch: (mat) => patchWhiteBloom(mat) });
    flora('boulder', this.scatterRing(rnd, 18, 114, 60, 0.8, 2.6, 3));
    this.grass = new Grass((x, z) => hw(x, z), (x, z) => this.plantable(x, z) && frozenAt(x, z) < 0.6 && sandAt(x, z) < 0.3 && deadAt(x, z) < 0.3);
    this.group.add(this.grass.mesh);
    const fr = LAYOUT.frozenRect;
    const frozenPick = (count: number, minS: number, maxS: number, dy: number): Placement[] => {
      const out: Placement[] = [];
      let guard = 0;
      while (out.length < count && guard++ < count * 15) {
        const x = fr.xFrom + rnd() * (fr.xTo - fr.xFrom);
        const z = fr.zTo - rnd() * (fr.zTo - fr.zFrom);
        if (frozenAt(x, z) < 0.35 || !this.clearGround(x, z) || Math.hypot(x - 71, z + 90) < 14) continue;
        out.push({ x, y: terrain.heightAt(x, z) + dy, z, yaw: rnd() * Math.PI * 2, scale: minS + rnd() * (maxS - minS) });
      }
      return out;
    };
    // Frozen reel (DeJj8CDhL2f, DeVKAIavhfv): blue snow pines and dark boulders along the glowing stream.
    flora('snow-pine', frozenPick(150, 0.8, 1.2, -0.3), { trunk: 0.035 });
    flora('boulder', frozenPick(70, 0.8, 2.4, -0.2));
    flora('pod-tree', frozenPick(14, 0.9, 1.4, -0.3).filter((p) => p.x > 72 && p.z < -72));
    // The small blue mushroom clusters (DdhDILcJXVC, round 9): their caps glow like the giant ones'.
    flora('mushroom', [...this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 22, 70, 0.7, 1.3), ...this.scatterRing(rnd, 66, 114, 80, 0.6, 1.2)], { shadows: false, patch: (mat, geo) => { const bb = geo.boundingBox!; patchGlowCap(mat, bb.min.y + (bb.max.y - bb.min.y) * 0.5); } });
    // Keep the portal clearing (DeQ-NnpvqF6) and the mushroom tavern (DaIqFavJWbd) open under the sky.
    // ...and the face tree's doorstep (the mushrooms used to crowd its round door).
    const door = FACE_DOOR(h);
    const clear = (p: Placement) => Math.hypot(p.x - ISLAND_PORTALS.galaxy.x, p.z - ISLAND_PORTALS.galaxy.z) > 11 && Math.hypot(p.x + 40, p.z + 24) > 10 && Math.hypot(p.x - door.x, p.z - door.z) > 11;
    const shroomRing = this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 34, 14, 0.8, 1.5, 4).filter((p) => Math.hypot(p.x - LAYOUT.frog.x, p.z - LAYOUT.frog.z) > 12 && clear(p));
    // Fireflies in the frog hollow's mushroom ring and among the churchyard's graves.
    vfx(fireflies(LAYOUT.frog.x, h(LAYOUT.frog.x, LAYOUT.frog.z), LAYOUT.frog.z, 18, 4, 80));
    vfx(fireflies(LAYOUT.church.x, h(LAYOUT.church.x, LAYOUT.church.z), LAYOUT.church.z, 16, 3, 50, new Color(0.6, 1.4, 0.5)));
    flora('giant-mushroom', shroomRing, { trunk: 0.09, patch: (mat, geo) => { const bb = geo.boundingBox!; patchGlowCap(mat, bb.min.y + (bb.max.y - bb.min.y) * 0.55); } });
    flora('flower-tree', this.scatterDisc(rnd, WORLD.pond.x, WORLD.pond.z, 30, 16, 0.8, 1.3).filter((p) => Math.hypot(p.x - WORLD.pond.x, p.z - WORLD.pond.z) > WORLD.pond.r + 3));
    // One floating island over the lily pond pours two glowing falls into it (01.22.56: the lake under the island).
    {
      const ix = WORLD.pond.x - 4;
      const iz = WORLD.pond.z - 9;
      const base = 24;
      // (Solid on top: you can fly up and land on it.)
      const { top } = landableIsland({ place: (l) => this.place(l), get group() { return world0.target; } }, ix, iz, base, { yaw: 0.8 });
      for (const [dx, w] of [[-2.5, 3], [2.2, 2.2]] as const) this.place(waterfall(ix + dx, iz + 5, top, w, top - 1.0));
    }
    const unbuilt = (p: Placement): boolean => !this.heights.near(p.x, p.z, plantPad) && !this.heights.blocked(p.x, p.z);
    flora('willow', ringSpots(WORLD.pond.x, WORLD.pond.z, 18, 6, h, rnd).filter(unbuilt));
    flora('palm', [...this.scatterDisc(rnd, WORLD.desert.x, WORLD.desert.z, WORLD.desert.r, 18, 0.8, 1.3), ]);
    flora('dead-forest-tree', this.scatterDisc(rnd, WORLD.dead.x, WORLD.dead.z, WORLD.dead.r, 60, 0.8, 1.4, 2.6).filter((p) => Math.hypot(p.x - WORLD.dead.x, p.z - WORLD.dead.z) > 9));
    flora('gnarled-tree', ringSpots(LAYOUT.orchard.x, LAYOUT.orchard.z, 32, 14, h, rnd).filter(unbuilt));
    flora('fallen-fruit', this.scatterDisc(rnd, LAYOUT.orchard.x, LAYOUT.orchard.z, 26, 90, 0.8, 1.2), { shadows: false });
    const roses: Placement[] = [];
    const rr = rng(2100);
    for (let i = 0; i < 700; i++) { const a = rr() * Math.PI * 2; const r = Math.sqrt(rr()) * 12; const x = 17 + Math.cos(a) * r; const z = 34 + Math.sin(a) * r; const s0 = rr(); const s1 = rr(); if (eyeDistance(x, z) < 2 || riverAt(x, z) > 0.02) continue; roses.push({ x, y: h(x, z) - 0.05, z, yaw: s0 * 6, scale: 0.7 + s1 * 0.6 }); }
    flora('rose-bush', roses, { shadows: false });
    flora('birch', this.riverBank(rnd, 14, 30, 110, 24, 96), { trunk: 0.03 });
    flora('fallen-leaf', this.riverBank(rnd, 8, 26, 600, 24, 96).map((p) => ({ ...p, scale: 0.8 + rnd() * 0.6 })), { shadows: false });
    const driftSpots: Placement[] = [];
    for (let i = 0; i < 160; i++) { const x = 24 + rnd() * 72; const z = 4 + rnd() * 12; if (riverAt(x, z) > 0.5) driftSpots.push({ x, y: 1.0, z, yaw: rnd() * 6, scale: 1 }); }
    let leafT = 0;
    flora('fallen-leaf', driftSpots, { shadows: false, update: (t, ps) => { const dt = Math.min(0.1, t - leafT); leafT = t; for (const p of ps) { p.x -= 0.6 * dt; if (p.x < 24) p.x = 96; p.yaw = Math.sin(t + p.z) * 0.4; } return true; } });
    flora('coral', this.riverBank(rnd, 10, 16, 30, 36, 90), { shadows: false });
    const crnd = rng(31);
    flora('cypress', ringSpots(-66, 57, 20, 10, h, crnd));
    // The churchyard: gravestones on the land around the church, inside its cypress ring (never past the cliff).
    const graves: Placement[] = [];
    for (let i = 0; i < 400 && graves.length < 26; i++) {
      const a = crnd() * Math.PI * 2;
      const r = 9 + crnd() * 10;
      const x = LAYOUT.church.x + Math.cos(a) * r;
      const z = LAYOUT.church.z + Math.sin(a) * r;
      if (!this.clearGround(x, z) || h(x, z) < 1 || Math.hypot(x - WORLD.islandCentre.x, z - WORLD.islandCentre.z) > 116) continue;
      if (graves.some((g) => Math.hypot(g.x - x, g.z - z) < 1.6)) continue;
      graves.push({ x, y: h(x, z), z, yaw: Math.PI / 2 + (crnd() - 0.5) * 0.3, scale: 0.8 + crnd() * 0.5 });
    }
    flora('grave', graves, { trunk: 0.3 });
    this.clouds = new CloudSea(LAYOUT.cloudSea.y);
    // Beside the world's group, not in it: showZone never hides the clouds (each place sets their level instead).
    this.group.addEventListener('added', () => this.group.parent?.add(this.clouds.group));
    this.group.addEventListener('removed', () => this.clouds.group.removeFromParent());

    // --- the fifth batch of reels: realms beyond the portals and the new island sites ---
    const rrnd = rng(5150);
    const world = this;
    const realmApi: RealmApi = {
      get group() { return world.target; },
      realm: (id) => this.enterZone(id),
      place: (l) => this.place(l), flora, vfx, h: gh, rnd: rrnd,
      water: (x0, x1, z0, z1, level) => { this.waterZones.push({ x0, x1, z0, z1, level }); },
      shoot: (from, s) => this.hooks.shoot?.(from, s),
      bounce: (b) => { this.heights.bouncers.push(b); },
    };
    this.portals.push(...buildRealms(realmApi));
    // The tree house's round door and the room behind it; the frog's dream.
    const treeHouse = buildTreeHouse(realmApi, (x, y, z, yaw, name) => this.hooks.teleport?.(x, y, z, yaw, name), FACE_DOOR(h));
    this.interactables.push(...treeHouse.interactables);
    ANCHORS.brother = { ...treeHouse.brotherAt, y: treeHouse.floorY };
    // The vale tavern's taproom behind its front door.
    this.interactables.push(...buildTavernRoom(realmApi, (x, y, z, yaw, name) => this.hooks.teleport?.(x, y, z, yaw, name)));
    // Inside the island castle, by its gate: the Moon Throne Hall.
    this.interactables.push(...buildCastleHall(realmApi, (x, y, z, yaw, name) => this.hooks.teleport?.(x, y, z, yaw, name), (what) => this.hooks.reward?.(what), h));
    // The crypt bar under the Lean Quarter's snow chapel.
    this.interactables.push(...buildCryptRoom(realmApi, (x, y, z, yaw, name) => this.hooks.teleport?.(x, y, z, yaw, name)));
    buildDream(realmApi);
    for (const w of dreamWatchers) this.watchers.push({ zone: 'dream', update: w });
    const kingdom = buildKingdom(realmApi, { soundWanted: () => this.hooks.soundWanted?.() ?? false, foundSound: () => this.hooks.foundSound?.() });
    this.interactables.push(...kingdom.interactables);
    this.interactables.push(...buildLeanQuarter(realmApi, { trip: (s, sec) => this.hooks.trip?.(s, sec), sip: () => this.hooks.events?.emit({ kind: 'feat', what: 'fountain' }) }).interactables);
    // The carriage at the lean castle's bridge, Count Rattlewheel inside (world/Carriage.ts; main.ts drives it).
    this.enterZone(GALAXY.id);
    this.interactables.push(...CARRIAGE.build(realmApi, 840, 12, -Math.PI / 2, (x, z, y) => this.heights.heightAt(x, z, y), (s, sec) => this.hooks.trip?.(s, sec)));
    this.enterZone(null);
    // Behind the demon church's door: the Alley of Graves.
    {
      const dx = LAYOUT.church.x + MODELS.church.height * 0.4 + 0.8;
      const yard = buildGraveyard({
        get group() { return world.target; }, realm: (id) => this.enterZone(id), place: (l) => this.place(l), flora, vfx, h: gh, rnd: rrnd,
        heights: this.heights, teleport: () => this.hooks.teleport, door: { x: dx, z: LAYOUT.church.z, y: h(dx, LAYOUT.church.z) },
      });
      this.portals.push(...yard.links);
      this.interactables.push(...yard.interactables);
    }

    // Seats for NPCs whose only rest pose is sitting on a chair: a barrel at stool height just behind each sitter
    // (the campfire skeletons, Old Moss on the stream bank, Sir Halvard on the cliff).
    for (const id of SEATED) {
      const def = EVERYONE.find((d) => d.id === id);
      const a = ANCHORS[id];
      // The campfire seats belong to the skeletons (enemies now): they face the fire; NPCs face their own way.
      const facing = CAMPFIRE_SEATS.has(id) ? Math.atan2(CAMPFIRE.z - a.z, CAMPFIRE.x - a.x) : def?.behaviour.kind === 'stand' ? def.behaviour.yaw : 0;
      const bx = a.x - Math.cos(facing) * 0.28;
      const bz = a.z - Math.sin(facing) * 0.28;
      // On the ground its sitter sits on: the island's, or out in a realm (the island's terrain is the void there) the
      // realm's floor under any roof (as the NPCs below).
      const by = seatGround(bx, bz);
      // (In the sitter's realm's group: the island's group is hidden while the player is in a realm.)
      const realm = REALMS.find((r) => Math.hypot(bx - r.x, bz - r.z) < r.radius);
      this.enterZone(realm ? realm.id : null);
      const seatId = SEAT_MODEL[id] ?? 'barrel';
      const barrel = modelLandmark(seatId, bx, bz, by, { scale: 0.5 / MODELS[seatId].height, collider: 'none' });
      this.place(barrel);
      this.seats.set(id, barrel);
      if (!CAMPFIRE_SEATS.has(id)) this.seatFits.push({ id, barrel: barrel.root, top: by + 0.5, wait: 0.6 });
    }
    this.enterZone(null);
    // The Antlered King perches on the front edge of his throne's seat (squatting, not sunk into the back).
    {
      const th = LAYOUT.throne;
      const seatZ = th.z + 0.35 * (MODELS.throne.height / 3);
      ANCHORS.king = { x: th.x, z: seatZ, y: this.heights.heightAt(th.x, seatZ) - 0.42 };
    }

    // --- NPCs, and the folk going about their day ---
    for (const def of EVERYONE) {
      const s = ANCHORS[def.id] ?? { x: 0, z: 0 };
      const npc = new Npc(def, s, hw);
      if (s.y !== undefined) npc.pos.y = s.y;
      // Seated NPCs sit `dy` above the ground itself (not above the stool the tavern model already has).
      if (s.dy !== undefined) {
        // Out in a realm the island terrain is the void far below: sit on the realm's own floor instead.
        npc.pos.y = seatGround(s.x, s.z) + s.dy;
      }
      // A guard bars the doorway behind him (a box across it, 6 m wide) until he steps aside.
      if (def.behaviour.kind === 'guard') {
        const gate: Footprint = { kind: 'box', x: s.x, z: s.z - 1.6, hw: 3.2, hd: 0.4, top: npc.pos.y + 3, rotY: 0 };
        this.heights.add(gate);
        npc.onStepAside = () => this.heights.remove(gate);
      }
      const realm = REALMS.find((r) => Math.hypot(npc.pos.x - r.x, npc.pos.z - r.z) < r.radius);
      this.enterZone(realm ? realm.id : null);
      this.target.add(npc.object);
      this.zoneOf.set(npc, this.zone);
      this.npcs.push(npc);
    }
    // Goldgrin's brother's diamond grills catch the lamplight.
    const brother = this.npcs.find((n) => n.def.id === 'brother');
    if (brother) { this.enterZone(TREEHOUSE_ROOM.id); vfx(grillSparkle(brother)); }
    const diver = this.npcs.find((n) => n.def.id === 'diver');
    if (diver) { this.enterZone(SUNKEN.id); vfx(helmetGlow(diver)); }
    // The crypt bar's skeletons: green eyes, and gold grills catching the candlelight.
    this.enterZone(CRYPT_ROOM.id);
    const skeletonLord = this.npcs.find((n) => n.def.id === 'skeleton-lord');
    if (skeletonLord) { this.enterZone(GALAXY.id); vfx(bluntInHand(skeletonLord)); }
    for (const n of this.npcs) if (n.def.id.startsWith('crypt-')) { vfx(skullEyes(n)); if (n.def.id !== 'crypt-bones') vfx(grillSparkle(n)); }
    CARRIAGE.passenger = this.npcs.find((n) => n.def.id === 'carriage-count') ?? null;
    const waxwick = this.npcs.find((n) => n.def.id === 'waxwick');
    if (waxwick) { this.enterZone(TAVERN_ROOM.id); vfx(candleCrown(waxwick)); }
    this.enterZone(null);
  }

  /** Switches the build target to a realm's group (created on first use) or back to the island. */
  private enterZone(id: string | null): void {
    this.zone = id;
    if (id === null) { this.target = this.group; return; }
    let g = this.realmGroups.get(id);
    if (!g) { g = new Group(); g.name = 'realm:' + id; this.realmGroups.set(id, g); this.group.add(g); }
    this.target = g;
  }

  /** Shows only the place the player is in: the island, or one realm. Runs when the player crosses a portal. */
  private showZone(id: string | null): void {
    this.hooks.events?.emit({ kind: 'zone', zone: (id ?? 'island') as Zone, from: (this.here ?? 'island') as Zone });
    this.here = id;
    if (id) {
      const g = this.realmGroups.get(id);
      if (g) {
        this.realmGround.ensure(id, g);
      }
    }
    for (const child of this.group.children) {
      // Point lights belong to the light budget, which keeps them hidden and reads them as sources.
      if (child.userData.budgeted) continue;
      const realm = child.name.startsWith('realm:') ? child.name.slice(6) : null;
      // (Things that hid themselves, like a stand-in under its model or Croak in the sack, stay hidden.)
      if (realm !== null) child.visible = realm === id;
      else child.visible = id === null && !child.userData.hidden;
    }
  }

  private place(l: Landmark): void {
    this.target.add(l.object);
    this.heights.add(...l.footprints);
    this.landmarks.push(l);
    this.zoneOf.set(l, this.zone);
  }

  /** Puts a prop in a realm's group, or on the island when `zone` is null (chests). */
  adopt(zone: string | null, object: Object3D): void {
    const was = this.zone;
    this.enterZone(zone);
    this.target.add(object);
    this.enterZone(was);
  }

  /** An NPC's seat (Croak's boulder): Adventures hides it while he is carried in the sack. */
  seatOf(id: string): ModelLandmark | undefined {
    return this.seats.get(id);
  }

  /**
   * Moves an NPC into a zone's group (Croak climbing out of the sack wherever the player is) so it is drawn and
   * updated there, with its seat put down at its feet and fitted under its hips again once it sits (see seatFits).
   */
  moveNpcToZone(npc: Npc, id: string | null): void {
    const was = this.zone;
    this.enterZone(id);
    this.target.add(npc.object);
    this.zoneOf.set(npc, id);
    const seat = this.seats.get(npc.def.id);
    if (seat) {
      this.target.add(seat.object);
      this.zoneOf.set(seat, id);
      seat.root.position.copy(npc.pos);
      const i = this.seatFits.findIndex((f) => f.id === npc.def.id);
      if (i >= 0) this.seatFits.splice(i, 1);
      this.seatFits.push({ id: npc.def.id, barrel: seat.root, top: npc.pos.y + 0.5, wait: 0.6 });
    }
    this.enterZone(was);
  }

  /** True where flora may grow: on the island, off the road, not in water or chasm, on gentle ground, clear of buildings. */
  /** Inside the walls of a building (any baked collider grid's occupied cells). */
  private insideBuilding(x: number, z: number): boolean {
    return this.heights.footprints.some((f) => f.kind === 'grid' && footprintContains(f, x, z));
  }

  /** Plantable, and not inside any structure's outline (a plant is placed once; grass uses the cheaper plantable). */
  private clearGround(x: number, z: number): boolean {
    return this.plantable(x, z) && !this.heights.blocked(x, z);
  }

  plantable(x: number, z: number): boolean {
    const y = this.realmGround.heightAt(x, z) ?? this.terrain.heightAt(x, z);
    if (y < -2) return false;
    // Cheapest tests first: this runs for every grass blade candidate around the player.
    // The causeway line, on to the stone head it leads to (its north stairs come down onto open ground before it).
    if (Math.abs(x) < 7 && z < LAYOUT.causeway.zStart + 8 && z > LAYOUT.head.z + 6) return false;
    if (Math.abs(z - WORLD.chasmCentreZ) < WORLD.chasmHalfWidth + 14) return false;
    // The forest gorge's floor and walls stay bare (its rims have their own pines, Heart.ts).
    if (z < WORLD.gorge.zHead + 4 && z > WORLD.gorge.zMouth - 10 && Math.abs(x - WORLD.gorge.x) < WORLD.gorge.rim + 1) return false;
    if (Math.abs(x - VILLAGE.x) < 24 && Math.abs(z - VILLAGE.z) < 10) return false;
    for (const route of WALKER_ROUTES) if (nearRoute(route, x, z, 5)) return false;
    // The world tree, the face tree and its portal clearing (built after the flora, so not yet in the colliders),
    // and the koi pools.
    if (Math.hypot(x - LAYOUT.worldTree.x, z - LAYOUT.worldTree.z) < 17) return false;
    if (Math.hypot(x - ISLAND_PORTALS.galaxy.faceTree.x, z - ISLAND_PORTALS.galaxy.faceTree.z) < 9) return false;
    if (Math.hypot(x - ISLAND_PORTALS.galaxy.x, z - ISLAND_PORTALS.galaxy.z) < 11) return false;
    for (const t of LAYOUT.tiers) { const dx = x - t.x; const dz = z - t.z; if (dx * dx + dz * dz < (t.r + 3) ** 2) return false; }
    const pdx = x - WORLD.pond.x;
    const pdz = z - WORLD.pond.z;
    if (pdx * pdx + pdz * pdz < (WORLD.pond.r + 1) ** 2) return false;
    for (const b of this.bossSpots) { const dx = x - b.x; const dz = z - b.z; if (dx * dx + dz * dz < 324) return false; }
    if (this.heights.near(x, z, plantPad)) return false;
    if (riverDistance(x, z) < 7 || riverAt(x, z) > 0.02) return false;
    if (pathAt(x, z) > 0.3) return false;
    if (streamAt(x, z, this.noise) > 0.05) return false;
    if (this.terrain.slopeAtCached(x, z) > 0.55) return false;
    return true;
  }
  private readonly bossSpots = ENEMY_SPAWNS.filter((sp) => ENEMY_DEFS[sp.kind].boss);

  /** `gap`: no two placements closer than this (trees, so trunks never merge). */
  private scatterRing(rnd: () => number, inner: number, outer: number, count: number, minS = 0.7, maxS = 1.5, gap = 0): Placement[] {
    const out: Placement[] = [];
    const c = WORLD.islandCentre;
    let guard = 0;
    while (out.length < count && guard++ < count * 12) {
      const a = rnd() * Math.PI * 2;
      const r = inner + Math.sqrt(rnd()) * (outer - inner);
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (!this.clearGround(x, z)) continue;
      if (gap > 0 && out.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < gap * gap)) continue;
      out.push({ x, y: this.terrain.heightAt(x, z) - 0.3, z, yaw: rnd() * Math.PI * 2, scale: minS + rnd() * (maxS - minS) });
    }
    return out;
  }

  private scatterDisc(rnd: () => number, cx: number, cz: number, radius: number, count: number, minS: number, maxS: number, gap = 0): Placement[] {
    const out: Placement[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 12) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * radius;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (!this.clearGround(x, z)) continue;
      if (gap > 0 && out.some((p) => (p.x - x) ** 2 + (p.z - z) ** 2 < gap * gap)) continue;
      out.push({ x, y: this.terrain.heightAt(x, z) - 0.05, z, yaw: rnd() * Math.PI * 2, scale: minS + rnd() * (maxS - minS) });
    }
    return out;
  }

  /** Points on the river banks between `minD` and `maxD` from the water, for x in [xFrom, xTo]. */
  private riverBank(rnd: () => number, minD: number, maxD: number, count: number, xFrom: number, xTo: number): Placement[] {
    const out: Placement[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 20) {
      const x = xFrom + rnd() * (xTo - xFrom);
      const z = -30 + rnd() * 80;
      const d = riverDistance(x, z);
      if (d < minD || d > maxD) continue;
      const y = this.terrain.heightAt(x, z);
      if (y < 0 || this.terrain.slopeAt(x, z) > 0.6 || !this.clearGround(x, z)) continue;
      out.push({ x, y: y - 0.05, z, yaw: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 0.6 });
    }
    return out;
  }

  update(dt: number, cameraPos: Vector3, playerPos: Vector3, talkingNpc: Npc | null): void {
    snailTarget = playerPos;
    const here = REALMS.find((r) => Math.hypot(playerPos.x - r.x, playerPos.z - r.z) < r.radius)?.id ?? null;
    if (here !== this.here) this.showZone(here);
    this.realmGround.update(cameraPos);
    // Only the place you are in is updated; elsewhere nothing moves until you get there.
    for (const l of this.landmarks) if ((this.zoneOf.get(l) ?? null) === here) l.update?.(dt, playerPos);
    for (const e of this.extras) if ((this.zoneOf.get(e) ?? null) === here) e.update(dt);
    for (const w of this.watchers) if (w.zone === here) w.update(dt, cameraPos, playerPos);
    this.clouds.update(dt, cameraPos);
    const sculpt = here ? REALM_SCULPTS[here as keyof typeof REALM_SCULPTS] : undefined;
    if (here === null || sculpt?.grass) this.grass.update(playerPos.x, playerPos.z);
    for (const n of this.npcs) {
      if ((this.zoneOf.get(n) ?? null) !== here) continue;
      // Characters beyond 70 m keep their place but stop animating (they are fog-dimmed specks at that range).
      const far = Math.hypot(n.pos.x - playerPos.x, n.pos.z - playerPos.z) > 70 && n !== talkingNpc;
      n.update(dt, playerPos, n === talkingNpc, !far);
    }
    for (let i = this.seatFits.length - 1; i >= 0; i--) this.fitSeat(i, dt, here);
  }

  /** Puts a sitter's barrel under their hips and their hips 0.1 m over its top (see seatFits). */
  private fitSeat(i: number, dt: number, here: string | null): void {
    const f = this.seatFits[i];
    const n = this.npcs.find((q) => q.def.id === f.id);
    if (!n) { this.seatFits.splice(i, 1); return; }
    const m = n.rig.model;
    if ((this.zoneOf.get(n) ?? null) !== here || !m || !/sit|chair/i.test(m.clipName(m.playing ?? ''))) return;
    f.wait -= dt;
    if (f.wait > 0) return;
    const hips = m.bone(/hips$/i);
    if (hips) {
      n.object.updateWorldMatrix(true, true);
      const p = hips.getWorldPosition(new Vector3());
      f.barrel.position.x = p.x;
      f.barrel.position.z = p.z;
      n.pos.y += f.top + 0.1 - p.y;
    }
    this.seatFits.splice(i, 1);
  }
}

/** The demon church's doorway glow and light, flickering. */
function churchGlow(scene: Group, x: number, y: number, z: number): (dt: number) => void {
  const glow = glowSprite(PALETTE.witch, 9, 0.55, true);
  glow.position.set(x, y + 4, z);
  // (Within the churchyard: at 40 m it reached the tree house and tinted its door green.)
  const light = new PointLight(PALETTE.witch, 120, 26, 1.6);
  light.position.set(x + 2, y + 5, z);
  scene.add(glow, light);
  let t = 0;
  return (dt) => { t += dt; glow.material.opacity = 0.45 + Math.sin(t * 3) * 0.1; light.intensity = 110 + Math.sin(t * 5) * 20; };
}

/** Cuts a round-headed door out of a model in world space, on its own copy of the materials. */
function cutDoor(root: Object3D, d: { x: number; z: number; halfWidth: number; floor: number; spring: number }): void {
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    const m = (mesh.material as MeshStandardMaterial).clone();
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = 'varying vec3 vDoor;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vDoor = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'varying vec3 vDoor;\n' + sh.fragmentShader.replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        { float dz = vDoor.z - (${d.z.toFixed(2)}); float w = ${d.halfWidth.toFixed(2)};
          if (abs(dz) < w && abs(vDoor.x - ${d.x.toFixed(2)}) < 4.0 && vDoor.y < ${(d.floor + d.spring).toFixed(2)} + sqrt(max(0.0, w * w - dz * dz))) discard; }`);
    };
    m.customProgramCacheKey = () => 'cut-door';
    mesh.material = m;
  });
}

/** Ground kept clear of trees around the island's landmarks (x, z, radius). */
// (Read from the layout tables: literal copies went stale when the arch gate and the tree house moved, and pines grew through them.)
const CLEARING_RADIUS: Record<string, number> = { 'colossus-statue': 11, archgate: 8, observatory: 10, 'candle-gate': 8 };
const LANDMARK_CLEARINGS = [
  ...LANDMARKS.filter((l) => l.id in CLEARING_RADIUS).map((l) => ({ x: l.x, z: l.z, r: CLEARING_RADIUS[l.id] })),
  { x: LAYOUT.tower.x, z: LAYOUT.tower.z, r: 17 },
  { x: 88, z: -103, r: 12 }, // the colossus's shore walk
  { x: LAYOUT.worldTree.x, z: LAYOUT.worldTree.z, r: 23 }, { x: LAYOUT.church.x, z: LAYOUT.church.z, r: 17 }, { x: LAYOUT.treehouse.x, z: LAYOUT.treehouse.z, r: 13 },
  { x: LAYOUT.cathedral.x, z: LAYOUT.cathedral.z, r: 34 }, { x: LAYOUT.floodedRuin.x, z: LAYOUT.floodedRuin.z, r: 11 },
];

import { Color, Group, type Mesh, type MeshStandardMaterial, type Object3D, Vector3 } from 'three';
import { ANCHORS, ISLAND_PORTALS, LAYOUT, REALMS, TREEHOUSE_ROOM, VILLAGE } from '../data/world';
import { ENEMY_DEFS, ENEMY_SPAWNS } from '../data/enemies';
import { PALETTE } from '../render/palette';
import { glowSprite } from '../render/Glow';
import { patchGait, patchGlowCap, patchLitWindows, patchWhiteBloom } from '../render/Materials';
import { PointLight } from 'three';
import { CloudSea } from './CloudSea';
import { footprintContains, HeightWorld, trunkFootprint, type Footprint } from './Colliders';
import { PRESENT_MODELS } from '../data/colliderGrids';
import { MODELS } from '../data/models';
import { waterfall } from './Falls';
import { FIRE, fire } from './Fire';
import { cobbleSpots, floraSet, ringSpots, type Placement } from './Flora';
import { orchardSpots } from './Footprints';
import { Grass } from './Grass';
import type { Landmark } from './Landmarks';
import { modelLandmark, riverDrifter, walkerLandmark } from './ModelLandmark';
import { Npc, NPC_DEFS } from './NPCs';
import { Rig } from '../characters/Rig';
import { yawToRotation } from '../models/ModelRig';
import { Noise2D } from './noise';
import { witchStream } from './Stream';
import { stoneHeadEyes } from './StoneHead';
import { buildTreeHouse } from './TreeHouse';
import { buildDream, dreamWatchers } from './Dream';
import { buildKingdom } from './Kingdom';
import { buildLeanQuarter } from './LeanQuarter';
import { type Bouncer, buildHeart, ISLAND_TOP } from './Heart';
import { buildGraveyard } from './Graveyard';
import type { ModelRig } from '../models/ModelRig';
import type { Interactable, Teleport } from './Interact';
import type { HostileShot, ShotTarget } from '../combat/CombatSystem';
import { SkyEyes } from '../render/SkyEyes';
import { fireflies } from '../render/Fireflies';

import { buildRealms, type RealmApi } from './Realms';
import type { PortalLink } from './Portal';
import { deadAt, EYE, eyeDistance, frozenAt, pathAt, RIVER_LEVEL, riverAt, riverDistance, sandAt, streamAt, Terrain, WORLD } from './Terrain';
import { causewayPostPoints, causewayWalk, chasmBridge, witchBridgeDeck } from './Walkways';
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
/** NPCs who sit on a barrel. */
const SEATED = new Set(['rattle', 'bone', 'marrow', 'moss', 'sentry', 'vale-beggar', 'court-knight', 'dock-knight', 'dragon-reader']);
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
  private readonly zoneOf = new Map<object, string | null>();
  private here: string | null | undefined = undefined;
  private readonly extras: Array<{ update: (dt: number) => void }> = [];
  private readonly clouds: CloudSea;
  private readonly noise = new Noise2D(1337);

  constructor(readonly terrain: Terrain) {
    this.heights = new HeightWorld(terrain);
    // The great river is the swimmable water (the lily pond and the pools are only knee to waist deep).
    this.heights.water = (x, z) => (riverAt(x, z) > 0.3 ? RIVER_LEVEL : null);
    this.target = this.group;
    const rnd = rng(4242);
    const world0 = this;
    const h = (x: number, z: number) => terrain.heightAt(x, z);
    // Ground-level height for things placed on the island (walkers, NPCs, grass): overhangs above the ground are skipped.
    const hw = (x: number, z: number, y?: number) => this.heights.heightAt(x, z, y ?? terrain.heightAt(x, z));
    const flora = (id: string, placements: Placement[], opts?: Parameters<typeof floraSet>[2] & { trunk?: number }) => {
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
    // The stairs' colliders come from causewayWalk (the model only shows them).
    // (Squeezed across to the bridge's width: a flight scaled up to meet the high north end would be 27 m wide.)
    for (const [st, yaw] of [[causeway.stairs, 0], [causeway.northStairs, Math.PI]] as const) {
      const lm = modelLandmark('causeway-stairs', st.x, st.z, st.y, { collider: 'none', yaw, scale: st.height / MODELS['causeway-stairs'].height });
      lm.root.scale.x *= st.widthScale;
      this.place(lm);
    }
    const cb = LAYOUT.chasmBridge;
    const bridge = chasmBridge(cb.ax, cb.az, cb.bx, cb.bz, Math.max(h(cb.ax, cb.az), h(cb.bx, cb.bz)) + 0.6, MODELS['chasm-bridge'].height);
    this.place(bridge);
    flora('chasm-bridge', bridge.tiles);
    const deck = witchBridgeDeck(LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, h);
    this.place(deck);
    // The witches' bridge (DeWji_1PuKW): the stone slab keeps the colliders and hides once the model is in.
    // The slab's measured, stepped deck stays the collider (the model's grid would add its abutments too).
    this.place(modelLandmark('witch-bridge', LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, deck.baseY, { collider: 'none', onLoad: () => { deck.object.visible = false; deck.object.userData.hidden = true; } }));

    // --- the skyline ---
    // Every building below collides exactly as its model looks (baked grids, see Colliders.ts).
    const headY = h(LAYOUT.head.x, LAYOUT.head.z) - 3;
    this.place(modelLandmark('head', LAYOUT.head.x, LAYOUT.head.z, headY, { color: PALETTE.blood }));
    this.place(stoneHeadEyes());
    const cathY = h(LAYOUT.cathedral.x, LAYOUT.cathedral.z) - 0.5;
    this.place(modelLandmark('cathedral', LAYOUT.cathedral.x, LAYOUT.cathedral.z, cathY, { yaw: LAYOUT.cathedral.yaw }));
    // Its nave is open to walk in through the arch at the east end (scripts/collider-grids.mjs): two rows of candles
    // down the aisle and a cold light under the vault so the inside reads.
    {
      const cat = LAYOUT.cathedral;
      const nave: Placement[] = [];
      for (let x = cat.x - 18; x <= cat.x + 20; x += 6) for (const side of [-1, 1]) {
        const z = cat.z + side * 3.2;
        const y = this.heights.heightAt(x, z, cathY + 1);
        nave.push({ x, y, z, yaw: 0, scale: 1.4 });
        vfx(fire(x, y + 0.42, z, 0.12, 1.2));
      }
      flora('candle', nave, { shadows: false });
      for (const x of [cat.x - 8, cat.x + 12]) {
        const y = this.heights.heightAt(x, cat.z, cathY + 1) + 7;
        const light = new PointLight(PALETTE.rune, 40, 26, 1.6);
        light.position.set(x, y, cat.z);
        this.group.add(light);
        const glow = glowSprite(PALETTE.rune, 4, 0.25, true);
        glow.position.copy(light.position);
        this.group.add(glow);
      }
    }
    const castleY = h(LAYOUT.castle.x, LAYOUT.castle.z) - 0.6;
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
    const thY = h(th.x, th.z) - 0.05;
    this.place(modelLandmark('throne', th.x, th.z, thY));
    const thS = MODELS.throne.height / 4.5;
    for (const side of [-1, 1]) vfx(fire(th.x + side * 2.6 * thS, thY + 2.85 * thS, th.z + 0.4 * thS, 0.3, 8));
    // Horned facade faces east (local +z → world +x), toward the road from the spawn.
    const ch = LAYOUT.church;
    const churchY = h(ch.x, ch.z) - 0.4;
    this.place(modelLandmark('church', ch.x, ch.z, churchY, { yaw: Math.PI / 2, update: churchGlow(this.group, ch.x + MODELS.church.height * 0.4, churchY, ch.z) }));
    this.auroraCentre.set(ch.x, 0, ch.z);
    const tw = LAYOUT.tower;
    const towerY = h(tw.x, tw.z) - 1.5;
    this.place(modelLandmark('tower', tw.x, tw.z, towerY));
    // The cave in the tower's rock base (east side, under the Moon Wyrm's circuit): a faint rune glow inside.
    {
      const cave = glowSprite(PALETTE.rune, 5, 0.35, true);
      cave.position.set(tw.x + 7.7, towerY + 2.2, tw.z + 4.7);
      this.group.add(cave);
      const caveLight = new PointLight(PALETTE.rune, 18, 12, 1.8);
      caveLight.position.copy(cave.position);
      this.group.add(caveLight);
    }
    if (PRESENT_MODELS.has('floating-rock')) for (let i = 0; i < 14; i++) {
      const radius = 12 + ((i * 41) % 20);
      const height = towerY + 6 + ((i * 23) % 24);
      const speed = 0.03 + ((i * 13) % 5) * 0.012;
      let angle = (i / 14) * Math.PI * 2;
      this.place(modelLandmark('floating-rock', tw.x + Math.cos(angle) * radius, tw.z + Math.sin(angle) * radius, height, {
        collider: 'none',
        update: (dt, root) => { angle += dt * speed; root.position.set(tw.x + Math.cos(angle) * radius, height + Math.sin(angle * 9 + i) * 1.2, tw.z + Math.sin(angle) * radius); root.rotation.y += dt * 0.08; },
      }));
    }
    const tr = LAYOUT.treehouse;
    this.place(modelLandmark('treehouse', tr.x, tr.z, h(tr.x, tr.z) - 0.6, { yaw: Math.PI / 2 }));
    // (Beside the stone head on the north half: the last flat open ground there. It once stood over the chasm.)
    this.place(modelLandmark('nave', 18, -136, h(18, -136) - 0.4, { yaw: 0 }));
    this.place(modelLandmark('archgate', 58, -90, h(58, -90) - 0.3, { yaw: 0.5 }));
    // Things that only make sense once their model exists: the palm island's falls, the burning castle's blaze.
    if (PRESENT_MODELS.has('palmisland')) {
      this.place(modelLandmark('palmisland', 72, 89, 34, { collider: 'none', update: (dt, root) => { root.position.y = 34 + Math.sin(performance.now() * 0.0004) * 0.6; void dt; } }));
      for (const [dx, dz] of [[20, 0], [-20, 0], [0, 20], [0, -20]] as const) this.place(waterfall(72 + dx, 89 + dz, 36, 5, 46));
    }
    this.place(modelLandmark('colossus-statue', WORLD.dead.x - 14, WORLD.dead.z + 6, h(WORLD.dead.x - 14, WORLD.dead.z + 6) - 0.5, { yaw: 0.9 }));
    if (PRESENT_MODELS.has('burning-castle')) {
      this.place(modelLandmark('burning-castle', 0, 180, -32, { color: PALETTE.blood, collider: 'none' }));
      vfx(fire(0, 12, 180, 14, 0));
    }
    for (const r of LAYOUT.ruins) this.place(modelLandmark(r.arch ? 'ruin-arch' : 'ruin-column', r.x, r.z, h(r.x, r.z) - 0.3, { yaw: r.yaw }));
    // Rainy orchard (DdKl7fKMO75): rows of twisted trees; each trunk is solid once the tree model exists.
    const orng = rng(321);
    // (Not in the river: the orchard's south row reaches its channel.)
    flora('gnarled-tree', orchardSpots(LAYOUT.orchard.x, LAYOUT.orchard.z).map(([x, z]: [number, number]) => ({ x, y: h(x, z) - 0.2, z, yaw: orng() * Math.PI * 2, scale: 0.75 + orng() * 0.3 })).filter((p) => riverAt(p.x, p.z) < 0.02 && riverDistance(p.x, p.z) > 7), { trunk: 0.05 });
    const pool = LAYOUT.floodedRuin;
    this.place(modelLandmark('flooded-ruin', pool.x, pool.z, h(pool.x, pool.z) - 0.6));
    // The Marsh Sovereign stands waist-deep in it; wading in drags at your legs.
    this.place(mudPool(pool.x, pool.z, pool.mud, pool.r, (wading) => { if (wading) this.hooks.mire?.(0.4); }));
    // (The troll's gorge is carved into the terrain now: Terrain.ts WORLD.gorge, dressed in Heart.ts.)
    // Backdrop mountain ring (scale encodes the old cone sizes).
    const mountains: Placement[] = [];
    const mr = rng(77);
    for (let i = 0; i < 20; i++) { const a = (i / 20) * Math.PI * 2 + (mr() - 0.5) * 0.25; const r = 270 + mr() * 60; mr(); const hgt = 130 + mr() * 90; mountains.push({ x: Math.cos(a) * r, y: -90, z: -36 + Math.sin(a) * r, yaw: mr() * Math.PI, scale: hgt / 180 }); }
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2 + 0.3 + (mr() - 0.5) * 0.4; const r = 190 + mr() * 35; mr(); const hgt = 60 + mr() * 40; mountains.push({ x: Math.cos(a) * r, y: -90, z: -36 + Math.sin(a) * r, yaw: mr() * Math.PI, scale: hgt / 180 }); }
    flora('mountain', mountains, { shadows: false });
    const pinSpots: Placement[] = [];
    for (let i = 0; i < 26; i++) pinSpots.push({ x: (rnd() - 0.5) * 190, y: LAYOUT.cloudSea.y - 6, z: 141 + rnd() * 66, yaw: rnd() * 6, scale: 0.6 + rnd() * 0.9 });
    flora('pinnacle', pinSpots, { shadows: false });

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
    // (The spider chapel is a boss now: it walks the sky over the west cliffs and fights; see data/enemies.)
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
    for (let i = 0; i < 7; i++) {
      const phase = (i / 7) * Math.PI * 2;
      const r = 5 + (i % 4) * 2;
      // Koi swim through the air a few metres over the lily pond (DeVj reel), not up in the clouds.
      const hgt = h(WORLD.pond.x, WORLD.pond.z) + 3.5 + (i % 3) * 1.6;
      const speed = 0.25 + (i % 3) * 0.06;
      this.place(modelLandmark('koi', WORLD.pond.x, WORLD.pond.z, hgt, { clip: 'idle', collider: 'none', update: (dt, root) => { void dt; const t = performance.now() * 0.001; const a = t * speed + phase; root.position.set(WORLD.pond.x + Math.cos(a) * r, hgt + Math.sin(t * 0.9 + phase * 3) * 0.8, WORLD.pond.z + Math.sin(a) * r); root.rotation.y = -a; root.rotation.z = Math.cos(t * 0.9 + phase * 3) * 0.3; } }));
    }
    // (On the bank east of the lily pond, not in its water.)
    this.place(modelLandmark('snake', -4, -14, h(-4, -14) + 0.05, { clip: 'idle', collider: 'none' }));

    // --- water ---
    const theRiver = river(h, rnd);
    this.place(theRiver);
    // (Not inside the face tree's roots, which stand on the bank.)
    const ft = ISLAND_PORTALS.galaxy.faceTree;
    // (Nor under the witch bridge's deck, which they would poke through.)
    const wb = LAYOUT.coven;
    flora('reed', theRiver.reedSpots.filter((p) => Math.hypot(p.x - ft.x, p.z - ft.z) > 8.5 && !(Math.abs(p.x - wb.streamX) < 13 && Math.abs(p.z - wb.bridgeZ) < 3.5)), { wind: 0.22, shadows: false });
    const pond = lilyPond(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r, rnd);
    this.place(pond);
    flora('lily-pad', pond.padSpots, { shadows: false });
    flora('lotus', pond.lotusSpots, { shadows: false });
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
    const skyEyes = new SkyEyes([
      { x: -34, y: 36, z: -60, size: 9 }, { x: 30, y: 42, z: -66, size: 11 }, { x: -92, y: 44, z: -122, size: 10 },
      { x: 74, y: 46, z: 8, size: 10 }, { x: -62, y: 40, z: 28, size: 8 }, { x: 8, y: 56, z: -120, size: 13 },
    ]);
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
      this.place(modelLandmark('village-house', x, z, h(x, z) - 0.2, { yaw: rot, onLoad: (m) => litWindows(m) }));
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
    const tavernY = h(20, 66) - 0.2;
    this.place(modelLandmark('tavern', 20, 63, tavernY));
    for (const side of [-1, 1]) vfx(fire(20 + side * 6.4, tavernY + 2.6, 55.6, 0.4, 8));
    const campY = h(-24, 52);
    this.place(modelLandmark('campfire', -24, 52, campY));
    vfx(fire(-24, campY + 0.25, 52, 1.5, 34));
    const steam = glowSprite(0x8fa2ff, 1.6, 0.18, true);
    steam.position.set(-24, campY + 2.5, 52);
    this.group.add(steam);
    this.extras.push({ update: (dt) => { steamT += dt; steam.position.y = campY + 2.4 + Math.sin(steamT) * 0.2; steam.scale.setScalar(1.6 + Math.sin(steamT * 0.7) * 0.4); } });
    let steamT = 0;
    const cloY = h(32, 68);
    // The baked grid keeps the columns solid and the arches open to walk through.
    this.place(modelLandmark('cloister', 32, 64.5, cloY));
    flora('cobblestone', cobbleSpots([[23, 68], [41, 68]], 7, h, rng(55)).filter((p) => !this.insideBuilding(p.x, p.z)), { shadows: false });
    const ob = LAYOUT.observatory;
    this.place(modelLandmark('observatory', ob.x, ob.z, h(ob.x, ob.z) - 0.2));
    const potY = h(24, 77);
    this.place(modelLandmark('cauldron', 24, 77, potY, { color: PALETTE.witch }));
    vfx(fire(24, potY - 0.1, 77, 0.7, 14));
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
    flora('pine', this.scatterRing(rnd, LAYOUT.forest.innerRadius, LAYOUT.forest.outerRadius, LAYOUT.forest.count, 0.8, 1.2, 2.8).filter((p) => !(Math.abs(p.x) < 18 && p.z > 24 && p.z < 78)), { trunk: 0.035 });
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
        if (frozenAt(x, z) < 0.35 || !this.plantable(x, z) || Math.hypot(x - 71, z + 90) < 14) continue;
        out.push({ x, y: terrain.heightAt(x, z) + dy, z, yaw: rnd() * Math.PI * 2, scale: minS + rnd() * (maxS - minS) });
      }
      return out;
    };
    // Frozen reel (DeJj8CDhL2f, DeVKAIavhfv): blue snow pines and dark boulders along the glowing stream.
    flora('snow-pine', frozenPick(150, 0.8, 1.2, -0.3), { trunk: 0.035 });
    flora('boulder', frozenPick(70, 0.8, 2.4, -0.2));
    flora('pod-tree', frozenPick(14, 0.9, 1.4, -0.3).filter((p) => p.x > 72 && p.z < -72));
    flora('mushroom', [...this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 22, 70, 0.7, 1.3), ...this.scatterRing(rnd, 66, 114, 80, 0.6, 1.2)], { shadows: false });
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
      this.place(modelLandmark('floating-island', ix, iz, base, { collider: 'none', yaw: 0.8 }));
      const top = base + MODELS['floating-island'].height * ISLAND_TOP;
      for (const [dx, w] of [[-2.5, 3], [2.2, 2.2]] as const) this.place(waterfall(ix + dx, iz + 5, top, w, top - 1.0));
    }
    const unbuilt = (p: Placement): boolean => !this.heights.near(p.x, p.z, plantPad);
    flora('willow', ringSpots(WORLD.pond.x, WORLD.pond.z, 18, 6, h, rnd).filter(unbuilt));
    const islandPalms: Placement[] = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; islandPalms.push({ x: 72 + Math.cos(a) * 14, y: 36.4, z: 89 + Math.sin(a) * 14, yaw: rnd() * 6, scale: 0.9 + rnd() * 0.3 }); }
    flora('palm', [...this.scatterDisc(rnd, WORLD.desert.x, WORLD.desert.z, WORLD.desert.r, 18, 0.8, 1.3), ...(PRESENT_MODELS.has('palmisland') ? islandPalms : [])]);
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
      if (!this.plantable(x, z) || h(x, z) < 1 || Math.hypot(x - WORLD.islandCentre.x, z - WORLD.islandCentre.z) > 116) continue;
      if (graves.some((g) => Math.hypot(g.x - x, g.z - z) < 1.6)) continue;
      graves.push({ x, y: h(x, z), z, yaw: Math.PI / 2 + (crnd() - 0.5) * 0.3, scale: 0.8 + crnd() * 0.5 });
    }
    flora('grave', graves, { trunk: 0.3 });
    this.clouds = new CloudSea(LAYOUT.cloudSea.y);
    this.group.add(this.clouds.group);

    // --- the fifth batch of reels: realms beyond the portals and the new island sites ---
    const rrnd = rng(5150);
    const world = this;
    const realmApi: RealmApi = {
      get group() { return world.target; },
      realm: (id) => this.enterZone(id),
      place: (l) => this.place(l), flora, vfx, h, rnd: rrnd,
      shoot: (from, s) => this.hooks.shoot?.(from, s),
    };
    this.portals.push(...buildRealms(realmApi));
    // The tree house's round door and the room behind it; the frog's dream.
    const treeHouse = buildTreeHouse(realmApi, (x, y, z, yaw, name) => this.hooks.teleport?.(x, y, z, yaw, name), FACE_DOOR(h));
    this.interactables.push(...treeHouse.interactables);
    ANCHORS.brother = { ...treeHouse.brotherAt, y: treeHouse.floorY };
    buildDream(realmApi);
    for (const w of dreamWatchers) this.watchers.push({ zone: 'dream', update: w });
    const kingdom = buildKingdom(realmApi, { soundWanted: () => this.hooks.soundWanted?.() ?? false, foundSound: () => this.hooks.foundSound?.() });
    this.interactables.push(...kingdom.interactables);
    this.interactables.push(...buildLeanQuarter(realmApi, { trip: (s, sec) => this.hooks.trip?.(s, sec) }).interactables);
    // Behind the demon church's door: the Alley of Graves.
    {
      const dx = LAYOUT.church.x + MODELS.church.height * 0.4 + 0.8;
      const yard = buildGraveyard({
        get group() { return world.target; }, realm: (id) => this.enterZone(id), place: (l) => this.place(l), flora, vfx, h, rnd: rrnd,
        heights: this.heights, teleport: () => this.hooks.teleport, door: { x: dx, z: LAYOUT.church.z, y: h(dx, LAYOUT.church.z) },
      });
      this.portals.push(...yard.links);
      this.interactables.push(...yard.interactables);
    }

    // Seats for NPCs whose only rest pose is sitting on a chair: a barrel at stool height just behind each sitter
    // (the campfire skeletons, Old Moss on the stream bank, Sir Halvard on the cliff).
    for (const id of SEATED) {
      const def = NPC_DEFS.find((d) => d.id === id);
      const a = ANCHORS[id];
      // The campfire seats belong to the skeletons (enemies now): they face the fire; NPCs face their own way.
      const facing = CAMPFIRE_SEATS.has(id) ? Math.atan2(CAMPFIRE.z - a.z, CAMPFIRE.x - a.x) : def?.behaviour.kind === 'stand' ? def.behaviour.yaw : 0;
      const bx = a.x - Math.cos(facing) * 0.28;
      const bz = a.z - Math.sin(facing) * 0.28;
      // On the ground its sitter sits on: the island's, or out in a realm (the island's terrain is the void there) the
      // realm's floor under any roof (as the NPCs below).
      const ground = h(bx, bz);
      const by = ground < -20 ? this.heights.heightAt(bx, bz, ground) : ground;
      this.place(modelLandmark('barrel', bx, bz, by, { scale: 0.5 / MODELS.barrel.height, collider: 'none' }));
    }
    // The Antlered King perches on the front edge of his throne's seat (squatting, not sunk into the back).
    {
      const th = LAYOUT.throne;
      const seatZ = th.z + 0.35 * (MODELS.throne.height / 3);
      ANCHORS.king = { x: th.x, z: seatZ, y: this.heights.heightAt(th.x, seatZ) - 0.42 };
    }

    // --- NPCs ---
    for (const def of NPC_DEFS) {
      const s = ANCHORS[def.id] ?? { x: 0, z: 0 };
      const npc = new Npc(def, s, hw);
      if (s.y !== undefined) npc.pos.y = s.y;
      // Seated NPCs sit `dy` above the ground itself (not above the stool the tavern model already has).
      if (s.dy !== undefined) {
        // Out in a realm the island terrain is the void far below: sit on the realm's own floor instead.
        const ground = terrain.heightAt(s.x, s.z);
        npc.pos.y = (ground < -20 ? this.heights.heightAt(s.x, s.z, ground) : ground) + s.dy;
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
    this.here = id;
    for (const child of this.group.children) {
      // Point lights belong to the light budget, which keeps them hidden and reads them as sources.
      if (child.userData.budgeted) continue;
      const realm = child.name.startsWith('realm:') ? child.name.slice(6) : null;
      // (Things that hid themselves, like a stand-in under its model or Croak in the sack, stay hidden.)
      if (realm !== null) child.visible = realm === id;
      else if (child !== this.clouds.group) child.visible = id === null && !child.userData.hidden;
    }
  }

  private place(l: Landmark): void {
    this.target.add(l.object);
    this.heights.add(...l.footprints);
    this.landmarks.push(l);
    this.zoneOf.set(l, this.zone);
  }

  /** True where flora may grow: on the island, off the road, not in water or chasm, on gentle ground, clear of buildings. */
  /** Inside the walls of a building (any baked collider grid's occupied cells). */
  private insideBuilding(x: number, z: number): boolean {
    return this.heights.footprints.some((f) => f.kind === 'grid' && footprintContains(f, x, z));
  }

  plantable(x: number, z: number): boolean {
    const y = this.terrain.heightAt(x, z);
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
      if (!this.plantable(x, z)) continue;
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
      if (!this.plantable(x, z)) continue;
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
      if (y < 0 || this.terrain.slopeAt(x, z) > 0.6 || !this.plantable(x, z)) continue;
      out.push({ x, y: y - 0.05, z, yaw: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 0.6 });
    }
    return out;
  }

  update(dt: number, cameraPos: Vector3, playerPos: Vector3, talkingNpc: Npc | null): void {
    snailTarget = playerPos;
    const here = REALMS.find((r) => Math.hypot(playerPos.x - r.x, playerPos.z - r.z) < r.radius)?.id ?? null;
    if (here !== this.here) this.showZone(here);
    // Only the place you are in is updated; elsewhere nothing moves until you get there.
    for (const l of this.landmarks) if ((this.zoneOf.get(l) ?? null) === here) l.update?.(dt, playerPos);
    for (const e of this.extras) if ((this.zoneOf.get(e) ?? null) === here) e.update(dt);
    for (const w of this.watchers) if (w.zone === here) w.update(dt, cameraPos, playerPos);
    this.clouds.update(dt, cameraPos);
    if (here === null) this.grass.update(playerPos.x, playerPos.z);
    for (const n of this.npcs) {
      if ((this.zoneOf.get(n) ?? null) !== here) continue;
      // Characters beyond 70 m keep their place but stop animating (they are fog-dimmed specks at that range).
      const far = Math.hypot(n.pos.x - playerPos.x, n.pos.z - playerPos.z) > 70 && n !== talkingNpc;
      n.update(dt, playerPos, n === talkingNpc, !far);
    }
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

import { Group, Vector3 } from 'three';
import { ANCHORS, ISLAND_PORTALS, LAYOUT, REALMS, VILLAGE } from '../data/world';
import { ENEMY_DEFS, ENEMY_SPAWNS } from '../data/enemies';
import { PALETTE } from '../render/palette';
import { glowSprite } from '../render/Glow';
import { PointLight } from 'three';
import { CloudSea } from './CloudSea';
import { HeightWorld, trunkFootprint, type Footprint } from './Colliders';
import { PRESENT_MODELS } from '../data/colliderGrids';
import { MODELS } from '../data/models';
import { waterfall } from './Falls';
import { fire } from './Fire';
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
import { buildRealms } from './Realms';
import type { PortalLink } from './Portal';
import { deadAt, frozenAt, pathAt, riverAt, riverDistance, sandAt, streamAt, Terrain, WORLD } from './Terrain';
import { causewayPostPoints, causewayWalk, chasmBridge, witchBridgeDeck } from './Walkways';
import { lilyPond, river, stillWaterDisc } from './Water';

/** Where the campfire skeletons sit (data/world ANCHORS) and the fire they face. */
const CAMPFIRE = { x: -24, z: 52 };
const CAMPFIRE_SEATS = new Set(['rattle', 'bone', 'marrow']);
/** NPCs who sit on a barrel. */
const SEATED = new Set(['rattle', 'bone', 'marrow', 'moss', 'sentry']);
/** The lantern's spot on the horse rider, in horse-rider.glb's own frame (x left, y up from the hooves, z forward). */
const RIDER_LANTERN = { x: 0.55, y: 2.2, z: 0.45 };
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
    this.target = this.group;
    const rnd = rng(4242);
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
    this.place(modelLandmark('causeway-stairs', causeway.stairs.x, causeway.stairs.z, causeway.stairs.y, { collider: 'none', scale: causeway.stairs.height / MODELS['causeway-stairs'].height }));
    const ns = causeway.northStairs;
    this.place(modelLandmark('causeway-stairs', ns.x, ns.z, ns.y, { collider: 'none', yaw: Math.PI, scale: ns.height / MODELS['causeway-stairs'].height }));
    const cb = LAYOUT.chasmBridge;
    const bridge = chasmBridge(cb.ax, cb.az, cb.bx, cb.bz, Math.max(h(cb.ax, cb.az), h(cb.bx, cb.bz)) + 0.6, MODELS['chasm-bridge'].height);
    this.place(bridge);
    flora('chasm-bridge', bridge.tiles);
    const deck = witchBridgeDeck(LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, h);
    this.place(deck);
    // The witches' bridge (DeWji_1PuKW): the stone slab keeps the colliders and hides once the model is in.
    // The slab's measured, stepped deck stays the collider (the model's grid would add its abutments too).
    this.place(modelLandmark('witch-bridge', LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, deck.baseY, { collider: 'none', onLoad: () => { deck.object.visible = false; } }));

    // --- the skyline ---
    // Every building below collides exactly as its model looks (baked grids, see Colliders.ts).
    const headY = h(LAYOUT.head.x, LAYOUT.head.z) - 3;
    this.place(modelLandmark('head', LAYOUT.head.x, LAYOUT.head.z, headY, { color: PALETTE.blood }));
    const cathY = h(LAYOUT.cathedral.x, LAYOUT.cathedral.z) - 0.5;
    this.place(modelLandmark('cathedral', LAYOUT.cathedral.x, LAYOUT.cathedral.z, cathY, { yaw: LAYOUT.cathedral.yaw }));
    const castleY = h(LAYOUT.castle.x, LAYOUT.castle.z) - 0.6;
    this.place(modelLandmark('castle', LAYOUT.castle.x, LAYOUT.castle.z, castleY, { yaw: LAYOUT.castle.yaw }));
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
    this.place(modelLandmark('nave', 66, -17, h(66, -17) - 0.4, { yaw: 0.3 }));
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
    flora('gnarled-tree', orchardSpots(LAYOUT.orchard.x, LAYOUT.orchard.z).map(([x, z]: [number, number]) => ({ x, y: h(x, z) - 0.2, z, yaw: orng() * Math.PI * 2, scale: 0.75 + orng() * 0.3 })), { trunk: 0.05 });
    const pool = LAYOUT.floodedRuin;
    this.place(modelLandmark('flooded-ruin', pool.x, pool.z, h(pool.x, pool.z) - 0.6));
    this.place(stillWaterDisc(pool.x, pool.z, h(pool.x, pool.z) - 0.3, pool.r));
    this.place(modelLandmark('troll-gorge', -66, -129, h(-66, -129) - 0.5));
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
    const frogR = MODELS.frogking.height * 0.5;
    this.place(modelLandmark('frogking', LAYOUT.frog.x, LAYOUT.frog.z, h(LAYOUT.frog.x, LAYOUT.frog.z) - 0.2, { clip: 'idle', collider: 'manual', footprints: [{ kind: 'cyl', x: LAYOUT.frog.x, z: LAYOUT.frog.z, r: frogR, top: h(LAYOUT.frog.x, LAYOUT.frog.z) + MODELS.frogking.height * 0.75 }] }));
    // Walkers follow the ground itself (never trunks or roofs); their routes are kept clear of trees (plantable).
    this.place(walkerLandmark('colossus', LAYOUT.colossusPath, 0.9, h, { lift: -0.5, clip: 'idle', trail: true }));
    this.place(walkerLandmark('loggiant', [...LAYOUT.logGiantPath], 1.2, h));
    // The spider chapel flies over the west cliffs at a fixed height, well above the treetops.
    this.place(walkerLandmark('spiderchapel', [...LAYOUT.spiderPath], 1.6, () => LAYOUT.spiderFlyHeight, { lift: 0 }));
    const rider = walkerLandmark('horse-rider', [...LAYOUT.riderPath], 3.2, h);
    // The lantern fire hangs from the rider's raised hand (horse-rider.glb, measured in the model's own frame).
    const lantern = fire(0, 0, 0, 0.3, 8);
    const riderLoad = rider.update!;
    let lanternAttached = false;
    rider.update = (dt, p) => {
      riderLoad(dt, p);
      if (!lanternAttached && rider.model) { lanternAttached = true; lantern.group.position.set(RIDER_LANTERN.x, RIDER_LANTERN.y, RIDER_LANTERN.z); rider.model.frame.add(lantern.group); }
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
    this.place(modelLandmark('snake', -11, -13, h(-11, -13) + 0.05, { clip: 'idle', collider: 'none' }));

    // --- water ---
    const theRiver = river(h, rnd);
    this.place(theRiver);
    flora('reed', theRiver.reedSpots, { wind: 0.22, shadows: false });
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
    }
    this.place(witchStream(LAYOUT.coven.streamX, LAYOUT.coven.zMin, LAYOUT.coven.zMax, LAYOUT.coven.bridgeZ, deck.deckY, h));
    this.place(modelLandmark('cauldron', LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, deck.deckY + 0.45, { color: PALETTE.witch }));

    // --- settlements ---
    const vrnd = rng(909);
    for (const [dx, dz, , , rot] of VILLAGE.houses) {
      const x = VILLAGE.x + dx;
      const z = VILLAGE.z + dz;
      this.place(modelLandmark('village-house', x, z, h(x, z) - 0.2, { yaw: rot }));
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
    flora('cobblestone', cobbleSpots([[VILLAGE.x - 34, VILLAGE.z + 1], [VILLAGE.x + 34, VILLAGE.z + 1]], 5, h, vrnd), { shadows: false });
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
    flora('cobblestone', cobbleSpots([[23, 68], [41, 68]], 7, h, rng(55)), { shadows: false });
    const ob = LAYOUT.observatory;
    this.place(modelLandmark('observatory', ob.x, ob.z, h(ob.x, ob.z) - 0.2));
    const potY = h(24, 77);
    this.place(modelLandmark('cauldron', 24, 77, potY, { color: PALETTE.witch }));
    vfx(fire(24, potY - 0.1, 77, 0.7, 14));
    // Lanterns and candles along the causeway.
    const posts = causewayPostPoints(LAYOUT.causeway);
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
    flora('pine', this.scatterRing(rnd, LAYOUT.forest.innerRadius, LAYOUT.forest.outerRadius, LAYOUT.forest.count, 0.8, 1.2), { trunk: 0.035 });
    for (const f of LAYOUT.sunflowerFields) flora('sunflower', this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.8, 1.2), { wind: 0.18 });
    const meadow: Placement[] = [];
    for (const f of LAYOUT.flowerMeadows) meadow.push(...this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.7, 1.3));
    meadow.push(...this.scatterRing(rnd, 12, 90, 380, 0.6, 1.1));
    flora('flower', meadow, { wind: 0.5, shadows: false });
    flora('boulder', this.scatterRing(rnd, 18, 114, 60, 0.8, 2.6));
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
    const clear = (p: Placement) => Math.hypot(p.x - ISLAND_PORTALS.galaxy.x, p.z - ISLAND_PORTALS.galaxy.z) > 11 && Math.hypot(p.x + 40, p.z + 24) > 10;
    const shroomRing = this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 34, 14, 0.8, 1.5).filter((p) => Math.hypot(p.x - LAYOUT.frog.x, p.z - LAYOUT.frog.z) > 12 && clear(p));
    flora('giant-mushroom', shroomRing, { trunk: 0.09 });
    flora('flower-tree', this.scatterDisc(rnd, WORLD.pond.x, WORLD.pond.z, 30, 16, 0.8, 1.3).filter((p) => Math.hypot(p.x - WORLD.pond.x, p.z - WORLD.pond.z) > WORLD.pond.r + 3));
    for (const [dx, y, dz, sc] of [[-18, 26, -10, 1.2], [14, 31, 12, 0.9], [2, 36, -22, 1.0]] as const) {
      const base = y;
      this.place(modelLandmark('floating-island', WORLD.pond.x + dx, WORLD.pond.z + dz, base, { collider: 'none', update: (dt, root) => { void dt; root.position.y = base + Math.sin(performance.now() * 0.0005 + dx) * 0.8; root.scale.setScalar(sc); } }));
    }
    flora('willow', ringSpots(WORLD.pond.x, WORLD.pond.z, 18, 6, h, rnd));
    const islandPalms: Placement[] = [];
    for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; islandPalms.push({ x: 72 + Math.cos(a) * 14, y: 36.4, z: 89 + Math.sin(a) * 14, yaw: rnd() * 6, scale: 0.9 + rnd() * 0.3 }); }
    flora('palm', [...this.scatterDisc(rnd, WORLD.desert.x, WORLD.desert.z, WORLD.desert.r, 18, 0.8, 1.3), ...islandPalms]);
    flora('dead-forest-tree', this.scatterDisc(rnd, WORLD.dead.x, WORLD.dead.z, WORLD.dead.r, 60, 0.8, 1.4).filter((p) => Math.hypot(p.x - WORLD.dead.x, p.z - WORLD.dead.z) > 9));
    flora('gnarled-tree', ringSpots(LAYOUT.orchard.x, LAYOUT.orchard.z, 32, 14, h, rnd));
    flora('fallen-fruit', this.scatterDisc(rnd, LAYOUT.orchard.x, LAYOUT.orchard.z, 26, 90, 0.8, 1.2), { shadows: false });
    flora('giant-flower', this.scatterDisc(rnd, -18, 33, 14, 80, 0.8, 1.3), { wind: 0.3 });
    const roses: Placement[] = [];
    const rr = rng(2100);
    for (let i = 0; i < 700; i++) { const a = rr() * Math.PI * 2; const r = Math.sqrt(rr()) * 12; const x = 17 + Math.cos(a) * r; const z = 34 + Math.sin(a) * r; roses.push({ x, y: h(x, z) - 0.05, z, yaw: rr() * 6, scale: 0.7 + rr() * 0.6 }); }
    flora('rose-bush', roses, { shadows: false });
    flora('birch', this.riverBank(rnd, 14, 30, 110, 24, 96), { trunk: 0.03 });
    flora('fallen-leaf', this.riverBank(rnd, 8, 26, 600, 24, 96).map((p) => ({ ...p, scale: 0.8 + rnd() * 0.6 })), { shadows: false });
    const driftSpots: Placement[] = [];
    for (let i = 0; i < 160; i++) { const x = 24 + rnd() * 72; const z = 4 + rnd() * 12; if (riverAt(x, z) > 0.5) driftSpots.push({ x, y: 1.0, z, yaw: rnd() * 6, scale: 1 }); }
    flora('fallen-leaf', driftSpots, { shadows: false, update: (t, ps) => { for (const p of ps) { p.x -= 0.6 * 0.016; if (p.x < 24) p.x = 96; p.yaw = Math.sin(t + p.z) * 0.4; } return true; } });
    flora('coral', this.riverBank(rnd, 10, 16, 30, 36, 90), { shadows: false });
    const crnd = rng(31);
    flora('cypress', ringSpots(-66, 57, 20, 10, h, crnd));
    const graves: Placement[] = [];
    for (let i = 0; i < 26; i++) { const x = -66 + (crnd() - 0.5) * 24; const z = 57 + 20 + crnd() * 16; graves.push({ x, y: h(x, z), z, yaw: (crnd() - 0.5) * 0.4, scale: 0.8 + crnd() * 0.5 }); }
    flora('grave', graves);
    this.clouds = new CloudSea(LAYOUT.cloudSea.y);
    this.group.add(this.clouds.group);

    // --- the fifth batch of reels: realms beyond the portals and the new island sites ---
    const rrnd = rng(5150);
    const world = this;
    this.portals.push(...buildRealms({
      get group() { return world.target; },
      realm: (id) => this.enterZone(id),
      place: (l) => this.place(l), flora, vfx, h, rnd: rrnd,
    }));

    // Seats for NPCs whose only rest pose is sitting on a chair: a barrel at stool height just behind each sitter
    // (the campfire skeletons, Old Moss on the stream bank, Sir Halvard on the cliff).
    for (const def of NPC_DEFS) {
      if (!SEATED.has(def.id) || def.behaviour.kind !== 'stand') continue;
      const a = ANCHORS[def.id];
      const facing = CAMPFIRE_SEATS.has(def.id) ? Math.atan2(CAMPFIRE.z - a.z, CAMPFIRE.x - a.x) : def.behaviour.yaw;
      const bx = a.x - Math.cos(facing) * 0.28;
      const bz = a.z - Math.sin(facing) * 0.28;
      this.place(modelLandmark('barrel', bx, bz, h(bx, bz), { scale: 0.5 / MODELS.barrel.height, collider: 'none' }));
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
      if (s.dy !== undefined) npc.pos.y = terrain.heightAt(s.x, s.z) + s.dy;
      // The campfire skeletons face the fire from their barrels.
      if (CAMPFIRE_SEATS.has(def.id)) npc.yaw = Math.atan2(CAMPFIRE.z - s.z, CAMPFIRE.x - s.x);
      const realm = REALMS.find((r) => Math.hypot(npc.pos.x - r.x, npc.pos.z - r.z) < r.radius);
      this.enterZone(realm ? realm.id : null);
      this.target.add(npc.object);
      this.zoneOf.set(npc, this.zone);
      this.npcs.push(npc);
    }
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
      if (realm !== null) child.visible = realm === id;
      else if (child !== this.clouds.group) child.visible = id === null;
    }
  }

  private place(l: Landmark): void {
    this.target.add(l.object);
    this.heights.add(...l.footprints);
    this.landmarks.push(l);
    this.zoneOf.set(l, this.zone);
  }

  /** True where flora may grow: on the island, off the road, not in water or chasm, on gentle ground, clear of buildings. */
  plantable(x: number, z: number): boolean {
    const y = this.terrain.heightAt(x, z);
    if (y < -2) return false;
    // Cheapest tests first: this runs for every grass blade candidate around the player.
    if (Math.abs(x) < 7 && z < LAYOUT.causeway.zStart + 8 && z > LAYOUT.causeway.zEnd - 8) return false;
    if (Math.abs(z - WORLD.chasmCentreZ) < WORLD.chasmHalfWidth + 14) return false;
    if (Math.abs(x - VILLAGE.x) < 24 && Math.abs(z - VILLAGE.z) < 10) return false;
    for (const route of WALKER_ROUTES) if (nearRoute(route, x, z, 5)) return false;
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

  private scatterRing(rnd: () => number, inner: number, outer: number, count: number, minS = 0.7, maxS = 1.5): Placement[] {
    const out: Placement[] = [];
    const c = WORLD.islandCentre;
    let guard = 0;
    while (out.length < count && guard++ < count * 12) {
      const a = rnd() * Math.PI * 2;
      const r = inner + Math.sqrt(rnd()) * (outer - inner);
      const x = c.x + Math.cos(a) * r;
      const z = c.z + Math.sin(a) * r;
      if (!this.plantable(x, z)) continue;
      out.push({ x, y: this.terrain.heightAt(x, z) - 0.3, z, yaw: rnd() * Math.PI * 2, scale: minS + rnd() * (maxS - minS) });
    }
    return out;
  }

  private scatterDisc(rnd: () => number, cx: number, cz: number, radius: number, count: number, minS: number, maxS: number): Placement[] {
    const out: Placement[] = [];
    let guard = 0;
    while (out.length < count && guard++ < count * 12) {
      const a = rnd() * Math.PI * 2;
      const r = Math.sqrt(rnd()) * radius;
      const x = cx + Math.cos(a) * r;
      const z = cz + Math.sin(a) * r;
      if (!this.plantable(x, z)) continue;
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
      if (y < 0 || this.terrain.slopeAt(x, z) > 0.6) continue;
      out.push({ x, y: y - 0.05, z, yaw: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 0.6 });
    }
    return out;
  }

  update(dt: number, cameraPos: Vector3, playerPos: Vector3, talkingNpc: Npc | null): void {
    const here = REALMS.find((r) => Math.hypot(playerPos.x - r.x, playerPos.z - r.z) < r.radius)?.id ?? null;
    if (here !== this.here) this.showZone(here);
    // Only the place you are in is updated; elsewhere nothing moves until you get there.
    for (const l of this.landmarks) if ((this.zoneOf.get(l) ?? null) === here) l.update?.(dt, playerPos);
    for (const e of this.extras) if ((this.zoneOf.get(e) ?? null) === here) e.update(dt);
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
  const light = new PointLight(PALETTE.witch, 120, 40, 1.6);
  light.position.set(x + 2, y + 5, z);
  scene.add(glow, light);
  let t = 0;
  return (dt) => { t += dt; glow.material.opacity = 0.45 + Math.sin(t * 3) * 0.1; light.intensity = 110 + Math.sin(t * 5) * 20; };
}

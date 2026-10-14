import { Group, Vector3 } from 'three';
import { ANCHORS, ISLAND_PORTALS, LAYOUT, VILLAGE } from '../data/world';
import { ENEMY_DEFS, ENEMY_SPAWNS } from '../data/enemies';
import { PALETTE } from '../render/palette';
import { glowSprite } from '../render/Glow';
import { PointLight } from 'three';
import { CloudSea } from './CloudSea';
import { HeightWorld } from './Colliders';
import { MODELS } from '../data/models';
import { tealFalls, waterfall } from './Falls';
import { fire } from './Fire';
import { cobbleSpots, floraSet, ringSpots, type Placement } from './Flora';
import { archGateFootprints, castleFootprints, cathedralFootprints, floodedRuinFootprints, naveFootprints, orchardFootprints, trollGorgeFootprints, villageHouseFootprint } from './Footprints';
import { Grass } from './Grass';
import type { Landmark } from './Landmarks';
import { modelLandmark, riverDrifter, walkerLandmark } from './ModelLandmark';
import { Npc, NPC_DEFS } from './NPCs';
import { Noise2D } from './noise';
import { witchStream } from './Stream';
import { buildRealms } from './Realms';
import type { PortalLink } from './Portal';
import { deadAt, frozenAt, riverAt, riverDistance, sandAt, streamAt, Terrain, WORLD } from './Terrain';
import { causewayPostPoints, causewayWalk, chasmBridge, witchBridgeDeck } from './Walkways';
import { lilyPond, river, stillWaterDisc } from './Water';

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
  private readonly extras: Array<{ update: (dt: number) => void }> = [];
  private readonly clouds: CloudSea;
  private readonly noise = new Noise2D(1337);

  constructor(readonly terrain: Terrain) {
    this.heights = new HeightWorld(terrain);
    const rnd = rng(4242);
    const h = (x: number, z: number) => terrain.heightAt(x, z);
    const hw = (x: number, z: number) => this.heights.heightAt(x, z);
    const flora = (id: string, placements: Placement[], opts?: Parameters<typeof floraSet>[2]) => {
      const set = floraSet(id, placements, opts);
      this.group.add(set.group);
      this.extras.push(set);
    };
    const vfx = (f: { group: Group; update: (dt: number) => void }) => { this.group.add(f.group); this.extras.push(f); };

    // --- walkways (placeholder slabs until their models land) ---
    const causeway = causewayWalk(LAYOUT.causeway, h, MODELS['causeway-segment'].height);
    this.place(causeway.landmark);
    flora('causeway-segment', causeway.spans);
    const stairs = modelLandmark('causeway-stairs', causeway.stairs.x, causeway.stairs.z, causeway.stairs.y);
    stairs.root.scale.setScalar(causeway.stairs.height / MODELS['causeway-stairs'].height);
    this.place(stairs);
    const bridge = chasmBridge(42, -30, 43, -84, Math.max(h(42, -30), h(43, -84)) + 0.6, MODELS['chasm-bridge'].height);
    this.place(bridge);
    flora('chasm-bridge', bridge.tiles);
    const deck = witchBridgeDeck(LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, h);
    this.place(deck);

    // --- the skyline ---
    const headY = Math.max(-12, h(LAYOUT.head.x, LAYOUT.head.z) - 8);
    this.place(modelLandmark('head', LAYOUT.head.x, LAYOUT.head.z, headY, { color: PALETTE.blood, footprints: [{ kind: 'box', x: LAYOUT.head.x, z: LAYOUT.head.z, hw: 0.36 * LAYOUT.head.height, hd: 0.375 * LAYOUT.head.height, top: headY + 1.02 * LAYOUT.head.height }] }));
    const cathY = Math.max(0, h(LAYOUT.cathedral.x, LAYOUT.cathedral.z) - 1);
    this.place(modelLandmark('cathedral', LAYOUT.cathedral.x, LAYOUT.cathedral.z, cathY, { footprints: cathedralFootprints(LAYOUT.cathedral.x, LAYOUT.cathedral.z, cathY) }));
    for (const w of LAYOUT.waterfalls) this.place(waterfall(w.x, w.z, h(w.x, w.z + (w.z > -57 ? 4 : -4)) - 0.5, w.width, w.height));
    const castleY = Math.max(0, h(LAYOUT.castle.x, LAYOUT.castle.z) - 1);
    this.place(modelLandmark('castle', LAYOUT.castle.x, LAYOUT.castle.z, castleY, { footprints: castleFootprints(LAYOUT.castle.x, LAYOUT.castle.z, castleY) }));
    this.place(modelLandmark('throne', LAYOUT.castle.x, LAYOUT.castle.z + 11, castleY, { footprints: [{ kind: 'box', x: LAYOUT.castle.x, z: LAYOUT.castle.z + 11, hw: 4.5, hd: 3.5, top: castleY + 1.2 }] }));
    for (const side of [-1, 1]) vfx(fire(LAYOUT.castle.x + side * 4.2, castleY + 2.0, LAYOUT.castle.z + 11 + 1.8, 0.7, 16));
    // Horned facade faces east (local +z → world +x), toward the road from the spawn.
    const churchY = h(-66, 57) - 0.5;
    this.place(modelLandmark('church', -66, 57, churchY, { yaw: Math.PI / 2, footprints: [{ kind: 'box', x: -66, z: 57, hw: 9, hd: 13.4, top: churchY + 15 }], update: churchGlow(this.group, -66 + 9.5, churchY, 57) }))
    this.auroraCentre.set(-66, 0, 57);
    const towerY = Math.max(-8, h(93, 42) - 6);
    this.place(modelLandmark('tower', 93, 42, towerY, { footprints: [{ kind: 'cyl', x: 93, z: 42, r: 6.2, top: towerY + 70 }, { kind: 'cyl', x: 93, z: 42, r: 4.6, top: towerY + 94 }] }));
    for (let i = 0; i < 14; i++) {
      const radius = 16 + ((i * 41) % 30);
      const height = towerY + 8 + ((i * 23) % 62);
      const speed = 0.03 + ((i * 13) % 5) * 0.012;
      let angle = (i / 14) * Math.PI * 2;
      this.place(modelLandmark('floating-rock', 93 + Math.cos(angle) * radius, 42 + Math.sin(angle) * radius, height, {
        update: (dt, root) => { angle += dt * speed; root.position.set(93 + Math.cos(angle) * radius, height + Math.sin(angle * 9 + i) * 1.2, 42 + Math.sin(angle) * radius); root.rotation.y += dt * 0.08; },
      }));
    }
    this.place(modelLandmark('treehouse', -90, 30, h(-90, 30) - 1, { yaw: Math.PI / 2, footprints: [{ kind: 'cyl', x: -90, z: 30, r: 5, top: h(-90, 30) + 15 }] }));
    this.place(modelLandmark('nave', 66, -17, h(66, -17) - 0.4, { yaw: 0.3, footprints: naveFootprints(66, -17, h(66, -17) - 0.4, 0.3) }));
    this.place(modelLandmark('archgate', 58, -90, h(58, -90) - 0.3, { yaw: 0.5, footprints: archGateFootprints(58, -90, h(58, -90) - 0.3, 0.5) }));
    this.place(modelLandmark('palmisland', 72, 89, 34, { footprints: [{ kind: 'cyl', x: 72, z: 89, r: 21, top: 36.4 }], update: (dt, root) => { root.position.y = 34 + Math.sin(performance.now() * 0.0004) * 0.6; void dt; } }));
    for (const [dx, dz] of [[20, 0], [-20, 0], [0, 20], [0, -20]] as const) this.place(waterfall(72 + dx, 89 + dz, 36, 5, 46));
    this.place(modelLandmark('colossus-statue', WORLD.dead.x - 14, WORLD.dead.z + 6, h(WORLD.dead.x - 14, WORLD.dead.z + 6) - 0.5, { yaw: 0.9, footprints: [{ kind: 'cyl', x: WORLD.dead.x - 14, z: WORLD.dead.z + 6, r: 6, top: h(WORLD.dead.x - 14, WORLD.dead.z + 6) + 7.5 }] }));
    this.place(modelLandmark('burning-castle', 0, 180, -32, { color: PALETTE.blood }));
    vfx(fire(0, 12, 180, 14, 0));
    for (const r of LAYOUT.ruins) this.place(modelLandmark(r.arch ? 'ruin-arch' : 'ruin-column', r.x, r.z, h(r.x, r.z) - 0.3, { yaw: r.yaw }));
    // Rainy orchard (DdKl7fKMO75): rows of twisted trees; each trunk keeps its collider.
    const orchardTrunks = orchardFootprints(LAYOUT.orchard.x, LAYOUT.orchard.z, h);
    this.heights.add(...orchardTrunks);
    const orng = rng(321);
    flora('gnarled-tree', orchardTrunks.map((f) => ({ x: f.x, y: h(f.x, f.z) - 0.2, z: f.z, yaw: orng() * Math.PI * 2, scale: 0.75 + orng() * 0.3 })));
    this.place(modelLandmark('flooded-ruin', 99, -11, h(99, -11) - 0.6, { footprints: floodedRuinFootprints(99, -11, h(99, -11) - 0.6, 18) }));
    this.place(stillWaterDisc(99, -11, h(99, -11) - 0.3, 18));
    this.place(modelLandmark('troll-gorge', -66, -129, h(-66, -129) - 0.5, { footprints: trollGorgeFootprints(-66, -129, h(-66, -129) - 0.5, 36) }));
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
    this.place(modelLandmark('frogking', LAYOUT.frog.x, LAYOUT.frog.z, h(LAYOUT.frog.x, LAYOUT.frog.z) - 0.3, { clip: 'idle', footprints: [{ kind: 'cyl', x: LAYOUT.frog.x, z: LAYOUT.frog.z, r: 3.6, top: h(LAYOUT.frog.x, LAYOUT.frog.z) + 3.3 }] }));
    this.place(walkerLandmark('colossus', LAYOUT.colossusPath, 0.9, hw, { lift: -0.5, clip: 'idle', trail: true }));
    this.place(walkerLandmark('loggiant', [[-50, 76], [-33, 88], [-16, 76], [-33, 64]], 1.5, hw));
    this.place(walkerLandmark('spiderchapel', [[-84, 42], [-66, 36], [-57, 51], [-75, 65], [-90, 57]], 2.4, hw, { lift: -0.5 }));
    const rider = walkerLandmark('horse-rider', [[-12, 72], [6, 67], [18, 60], [30, 62], [36, 75], [18, 84], [0, 80]], 3.6, hw);
    const lantern = fire(2.3, 1.2, 0, 0.3, 8);
    rider.root.add(lantern.group);
    this.extras.push(lantern);
    this.place(rider);
    for (let i = 0; i < 7; i++) {
      const phase = (i / 7) * Math.PI * 2;
      const r = 14 + (i % 4) * 5;
      const hgt = 28 + (i % 3) * 4;
      const speed = 0.25 + (i % 3) * 0.06;
      this.place(modelLandmark('koi', WORLD.pond.x, WORLD.pond.z, hgt, { clip: 'idle', update: (dt, root) => { void dt; const t = performance.now() * 0.001; const a = t * speed + phase; root.position.set(WORLD.pond.x + Math.cos(a) * r, hgt + Math.sin(t * 0.9 + phase * 3) * 2.5, WORLD.pond.z + Math.sin(a) * r); root.rotation.y = -a; root.rotation.z = Math.cos(t * 0.9 + phase * 3) * 0.3; } }));
    }
    this.place(modelLandmark('snake', -11, -13, h(-11, -13) + 0.05, { clip: 'idle' }));

    // --- water ---
    const theRiver = river(h, rnd);
    this.place(theRiver);
    flora('reed', theRiver.reedSpots, { wind: 0.22, shadows: false });
    const pond = lilyPond(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r, rnd);
    this.place(pond);
    flora('lily-pad', pond.padSpots, { shadows: false });
    flora('lotus', pond.lotusSpots, { shadows: false });
    this.place(riverDrifter('boat', 0, 2.4));
    this.place(riverDrifter('boat', 108, 2.0));
    this.place(witchStream(LAYOUT.coven.streamX, LAYOUT.coven.zMin, LAYOUT.coven.zMax, LAYOUT.coven.bridgeZ, deck.deckY, h));
    this.place(modelLandmark('cauldron', LAYOUT.coven.streamX, LAYOUT.coven.bridgeZ, deck.deckY + 0.45, { color: PALETTE.witch, footprints: [{ kind: 'cyl', x: LAYOUT.coven.streamX, z: LAYOUT.coven.bridgeZ, r: 0.8, top: deck.deckY + 1.4 }] }));

    // --- settlements ---
    const vrnd = rng(909);
    for (const [dx, dz, w, d, rot] of VILLAGE.houses) {
      const x = VILLAGE.x + dx;
      const z = VILLAGE.z + dz;
      this.place(modelLandmark('village-house', x, z, h(x, z) - 0.2, { yaw: rot, footprints: [villageHouseFootprint(x, z, h(x, z) - 0.2, w, d, rot)] }));
    }
    const torchSpots: Placement[] = [];
    for (let dx = -28; dx <= 28; dx += 14) {
      for (const dz of [-5.5, 7.5]) {
        const x = VILLAGE.x + dx;
        const z = VILLAGE.z + dz;
        torchSpots.push({ x, y: h(x, z), z, yaw: 0, scale: 1 });
        vfx(fire(x, h(x, z) + 2.1, z, 0.45, 9));
      }
    }
    flora('torch-post', torchSpots);
    flora('cobblestone', cobbleSpots([[VILLAGE.x - 34, VILLAGE.z + 1], [VILLAGE.x + 34, VILLAGE.z + 1]], 5, h, vrnd), { shadows: false });
    const tavernY = h(20, 66) - 0.2;
    this.place(modelLandmark('tavern', 20, 63, tavernY, { footprints: [{ kind: 'box', x: 20, z: 60, hw: 6, hd: 4.5, top: tavernY + 5.4 }, { kind: 'cyl', x: 20, z: 68, r: 1.2, top: tavernY + 1.0 }] }));
    for (const side of [-1, 1]) vfx(fire(20 + side * 6.4, tavernY + 2.6, 55.6, 0.4, 8));
    const campY = h(-24, 52);
    this.place(modelLandmark('campfire', -24, 52, campY, { footprints: [{ kind: 'cyl', x: -24, z: 52, r: 1.2, top: campY + 0.4 }] }));
    vfx(fire(-24, campY + 0.25, 52, 1.5, 34));
    const steam = glowSprite(0x8fa2ff, 1.6, 0.18, true);
    steam.position.set(-24, campY + 2.5, 52);
    this.group.add(steam);
    this.extras.push({ update: (dt) => { steamT += dt; steam.position.y = campY + 2.4 + Math.sin(steamT) * 0.2; steam.scale.setScalar(1.6 + Math.sin(steamT * 0.7) * 0.4); } });
    let steamT = 0;
    const cloY = h(32, 68);
    this.place(modelLandmark('cloister', 32, 64.5, cloY, { footprints: [{ kind: 'box', x: 32, z: 64.5, hw: 8.5, hd: 0.7, top: cloY + 8.6 }] }));
    flora('cobblestone', cobbleSpots([[23, 68], [41, 68]], 7, h, rng(55)), { shadows: false });
    const obsY = h(-44, 60);
    this.place(modelLandmark('observatory', -44, 60, obsY, { footprints: [{ kind: 'cyl', x: -44, z: 60, r: 3.2, top: obsY + 10.4 }] }));
    const potY = h(24, 77);
    this.place(modelLandmark('cauldron', 24, 77, potY, { color: PALETTE.witch, footprints: [{ kind: 'cyl', x: 24, z: 77, r: 1, top: potY + 1.1 }] }));
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
    flora('pine', this.scatterRing(rnd, LAYOUT.forest.innerRadius, LAYOUT.forest.outerRadius, LAYOUT.forest.count));
    for (const f of LAYOUT.sunflowerFields) flora('sunflower', this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.8, 1.2), { wind: 0.18 });
    const meadow: Placement[] = [];
    for (const f of LAYOUT.flowerMeadows) meadow.push(...this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.7, 1.3));
    meadow.push(...this.scatterRing(rnd, 12, 90, 380, 0.6, 1.1));
    flora('flower', meadow, { wind: 0.5, shadows: false });
    flora('boulder', this.scatterRing(rnd, 18, 114, 60, 0.8, 2.6));
    this.grass = new Grass((x, z) => this.heights.heightAt(x, z), (x, z) => this.plantable(x, z) && frozenAt(x, z) < 0.6 && sandAt(x, z) < 0.3 && deadAt(x, z) < 0.3);
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
    flora('snow-pine', frozenPick(150, 0.7, 1.3, -0.3));
    flora('boulder', frozenPick(70, 0.8, 2.4, -0.2));
    flora('pod-tree', frozenPick(14, 0.9, 1.4, -0.3).filter((p) => p.x > 72 && p.z < -72));
    flora('mushroom', [...this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 22, 70, 0.7, 1.3), ...this.scatterRing(rnd, 66, 114, 80, 0.6, 1.2)], { shadows: false });
    // Keep the portal clearing (DeQ-NnpvqF6) and the mushroom tavern (DaIqFavJWbd) open under the sky.
    const clear = (p: Placement) => Math.hypot(p.x - ISLAND_PORTALS.galaxy.x, p.z - ISLAND_PORTALS.galaxy.z) > 11 && Math.hypot(p.x + 40, p.z + 24) > 10;
    const shroomRing = this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 34, 14, 0.8, 1.5).filter((p) => Math.hypot(p.x - LAYOUT.frog.x, p.z - LAYOUT.frog.z) > 12 && clear(p));
    flora('giant-mushroom', shroomRing);
    this.place(tealFalls(shroomRing.slice(0, 4).map((p) => ({ x: p.x + 2.5 * p.scale, z: p.z, top: p.y + 5.6 * p.scale, height: 5.6 * p.scale + 1, width: 1.6 * p.scale }))));
    flora('flower-tree', this.scatterDisc(rnd, WORLD.pond.x, WORLD.pond.z, 30, 16, 0.8, 1.3).filter((p) => Math.hypot(p.x - WORLD.pond.x, p.z - WORLD.pond.z) > WORLD.pond.r + 3));
    for (const [dx, y, dz, sc] of [[-18, 26, -10, 1.2], [14, 31, 12, 0.9], [2, 36, -22, 1.0]] as const) {
      const base = y;
      this.place(modelLandmark('floating-island', WORLD.pond.x + dx, WORLD.pond.z + dz, base, { update: (dt, root) => { void dt; root.position.y = base + Math.sin(performance.now() * 0.0005 + dx) * 0.8; root.scale.setScalar(sc); } }));
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
    flora('birch', this.riverBank(rnd, 14, 30, 110, 24, 96));
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
    this.portals.push(...buildRealms({ group: this.group, place: (l) => this.place(l), flora, vfx, h, rnd: rrnd }));

    // --- NPCs ---
    for (const def of NPC_DEFS) {
      const s = ANCHORS[def.id] ?? { x: 0, z: 0 };
      const npc = new Npc(def, s, hw);
      if (s.y !== undefined) npc.pos.y = s.y;
      npc.pos.y += s.dy ?? 0;
      this.group.add(npc.object);
      this.npcs.push(npc);
    }
  }

  private place(l: Landmark): void {
    this.group.add(l.object);
    this.heights.add(...l.footprints);
    this.landmarks.push(l);
  }

  /** True where flora may grow: on the island, off the road, not in water or chasm, on gentle ground, clear of buildings. */
  plantable(x: number, z: number): boolean {
    const y = this.terrain.heightAt(x, z);
    if (y < -2) return false;
    for (const sp of ENEMY_SPAWNS) if (ENEMY_DEFS[sp.kind].boss && Math.hypot(x - sp.x, z - sp.z) < 18) return false;
    if (streamAt(x, z, this.noise) > 0.05 || riverAt(x, z) > 0.02 || riverDistance(x, z) < 7) return false;
    if (Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z) < WORLD.pond.r + 1) return false;
    if (Math.abs(x) < 7 && z < LAYOUT.causeway.zStart + 8 && z > LAYOUT.causeway.zEnd - 8) return false;
    if (Math.abs(z - WORLD.chasmCentreZ) < WORLD.chasmHalfWidth + 14) return false;
    if (this.terrain.slopeAt(x, z) > 0.55) return false;
    if (Math.abs(x - VILLAGE.x) < 24 && Math.abs(z - VILLAGE.z) < 10) return false;
    for (const f of this.heights.footprints) {
      const dx = x - f.x;
      const dz = z - f.z;
      const r = f.kind === 'cyl' ? f.r + 2 : Math.max(f.hw, f.hd) + 2;
      if (dx * dx + dz * dz < r * r) return false;
    }
    return true;
  }

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
    for (const l of this.landmarks) l.update?.(dt, playerPos);
    for (const e of this.extras) e.update(dt);
    this.clouds.update(dt, cameraPos);
    this.grass.update(playerPos.x, playerPos.z);
    for (const n of this.npcs) n.update(dt, playerPos, n === talkingNpc);
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

import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { LAYOUT } from '../data/world';
import { ENEMY_DEFS, ENEMY_SPAWNS } from '../data/enemies';
import { surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import { castle, frozenDecor, mountains, mushrooms, orchard, ruins } from './Biomes';
import {
  archGate, birches, causewayLights, coral, demonChurch, fallenLeaves, flyingKoi, giantFlowers, hangingPods, kneelingColossus, palmIsland,
  pinnacles, roseGarden, ruinedNave, snake, treeHouse, willows, wizardTower, woodenBridge,
} from './Biomes2';
import { CloudSea } from './CloudSea';
import { HeightWorld } from './Colliders';
import { frogKing, moonShellColossus, witchBridge } from './Creatures';
import { floatingRocks, floodedRuin, logGiant, spiderChapel, trollGorge } from './Reels2';
import { boulders, flowers, pines, sunflowers, type Placement } from './Flora';
import { Grass } from './Grass';
import { cathedral, causeway, giantHead, monolith, waterfall, type Landmark } from './Landmarks';
import { Npc, NPC_DEFS } from './NPCs';
import { Noise2D } from './noise';
import {
  boat, campfire, cloister, deadForest, fallenFruit, fire, flowerTrees, giantMushrooms, gnarledTrees, observatory, palms, rider, snowPines,
  tavern, tealFalls, throneHall, village,
} from './Settlements';
import { deadAt, frozenAt, riverAt, riverDistance, sandAt, streamAt, Terrain, WORLD } from './Terrain';
import { lilyPond, river } from './Water';
import { loadModel, ModelRig } from '../models/ModelRig';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** Assembles the whole island: every landmark, biome, creature and NPC from the reels, plus the collision height field. */
export class World {
  readonly group = new Group();
  readonly heights: HeightWorld;
  readonly npcs: Npc[] = [];
  readonly grass: Grass;
  /** Church position, used to brighten the aurora nearby. */
  readonly auroraCentre = new Vector3();
  private readonly landmarks: Landmark[] = [];
  private readonly extras: Array<{ update: (dt: number) => void }> = [];
  private readonly clouds: CloudSea;
  private readonly noise = new Noise2D(1337);

  constructor(readonly terrain: Terrain) {
    this.heights = new HeightWorld(terrain);
    const rnd = rng(4242);
    const h = (x: number, z: number) => terrain.heightAt(x, z);
    const hw = (x: number, z: number) => this.heights.heightAt(x, z);

    // --- the original landmarks ---
    this.place(causeway(LAYOUT.causeway, h, rnd));
    this.place(giantHead(LAYOUT.head.x, LAYOUT.head.z, Math.max(-12, h(LAYOUT.head.x, LAYOUT.head.z) - 8), LAYOUT.head.height), 'head');
    this.place(cathedral(LAYOUT.cathedral.x, LAYOUT.cathedral.z, Math.max(0, h(LAYOUT.cathedral.x, LAYOUT.cathedral.z) - 1)), 'cathedral');
    for (const [x, z, w, mh, d, rot] of LAYOUT.monoliths) this.place(monolith(x, z, h(x, z) - 0.6, w, mh, d, rot));
    for (const w of LAYOUT.waterfalls) this.place(waterfall(w.x, w.z, h(w.x, w.z + (w.z > -95 ? 4 : -4)) - 0.5, w.width, w.height));
    this.place(frogKing(LAYOUT.frog.x, LAYOUT.frog.z, h(LAYOUT.frog.x, LAYOUT.frog.z) - 0.3), 'frogking');
    this.place(witchBridge(LAYOUT.coven.streamX, LAYOUT.coven.zMin, LAYOUT.coven.zMax, LAYOUT.coven.bridgeZ, h));
    this.place(castle(LAYOUT.castle.x, LAYOUT.castle.z, Math.max(0, h(LAYOUT.castle.x, LAYOUT.castle.z) - 1)), 'castle');
    this.place(orchard(LAYOUT.orchard.x, LAYOUT.orchard.z, h));
    this.place(moonShellColossus(LAYOUT.colossusPath, hw), 'colossus');
    this.group.add(mountains(WORLD.islandCentre));
    this.group.add(ruins(LAYOUT.ruins.map((r) => ({ ...r, y: h(r.x, r.z) }))));

    // --- water ---
    this.place(river(h, rnd));
    this.place(lilyPond(WORLD.pond.x, WORLD.pond.z, WORLD.pond.r, rnd));
    this.place(boat(0, 2.4));
    this.place(boat(108, 2.0));

    // --- settlements ---
    this.place(village(-33, 76, h));
    const inn = tavern(20, 66, h);
    this.place(inn);
    const camp = campfire(-24, 52, h);
    this.place(camp);
    const clo = cloister(32, 68, h);
    this.place(clo);
    const obs = observatory(-44, 60, h);
    this.place(obs);
    const throne = throneHall(LAYOUT.castle.x, LAYOUT.castle.z + 11, Math.max(0, h(LAYOUT.castle.x, LAYOUT.castle.z) - 1), 0);
    this.place(throne);
    this.place(rider([[-12, 72], [6, 67], [18, 60], [30, 62], [36, 75], [18, 84], [0, 80]], 3.6, hw));

    // --- structures from the second viewing ---
    this.place(wizardTower(93, 42, Math.max(-8, h(93, 42) - 6)), 'tower');
    this.place(floatingRocks(93, 42, Math.max(-8, h(93, 42) - 6)));
    // Second reel batch: the Sovereign's flooded nave by the chasm, the troll's gorge, and two wandering giants.
    this.place(floodedRuin(99, -11, h(99, -11) - 0.6, 18));
    this.place(trollGorge(-66, -129, h(-66, -129) - 0.5, 36));
    this.place(logGiant([[-50, 76], [-33, 88], [-16, 76], [-33, 64]], hw), 'loggiant');
    this.place(spiderChapel([[-84, 42], [-66, 36], [-57, 51], [-75, 65], [-90, 57]], hw), 'spiderchapel');
    this.place(demonChurch(-66, 57, h(-66, 57) - 0.5, Math.PI), 'church');
    this.auroraCentre.set(-66, 0, 57);
    this.place(palmIsland(72, 34, 89));
    this.place(treeHouse(-90, 30, h(-90, 30) - 1), 'treehouse');
    this.place(ruinedNave(66, -17, h(66, -17) - 0.4, 0.3));
    this.place(archGate(58, -90, h(58, -90) - 0.3, 0.5));
    this.place(woodenBridge(42, -30, 43, -84, Math.max(h(42, -30), h(43, -84)) + 0.6));
    this.place(kneelingColossus(WORLD.dead.x - 14, WORLD.dead.z + 6, h(WORLD.dead.x - 14, WORLD.dead.z + 6) - 0.5, 0.9));
    this.place(flyingKoi(WORLD.pond.x, 28, WORLD.pond.z, 7));
    this.place(snake(-11, -13, h(-11, -13) + 0.05));
    const posts: Array<{ x: number; z: number; y: number }> = [];
    const cw = LAYOUT.causeway;
    for (let z = cw.zStart - 2; z > cw.zEnd + 2; z -= 4) {
      const t = (cw.zStart - z) / (cw.zStart - cw.zEnd);
      const top = cw.yStart + (cw.yEnd - cw.yStart) * t;
      for (const side of [-1, 1]) posts.push({ x: cw.x + side * (cw.width / 2 - 0.4), z, y: top });
    }
    this.place(causewayLights(posts, 6));
    // Cauldron witch's pot on the south shore.
    const pot = new Group();
    const potY = h(24, 77);
    const cauldron = new Mesh(new CylinderGeometry(0.9, 0.65, 1.1, 14), surface({ color: 0x0b0d22, roughness: 0.4, metalness: 0.6 }));
    cauldron.position.set(24, potY + 0.55, 77);
    const brew = new Mesh(new CircleGeometry(0.82, 16), new MeshBasicMaterial({ color: new Color(PALETTE.witch).multiplyScalar(1.3), toneMapped: false }));
    brew.rotation.x = -Math.PI / 2;
    brew.position.set(24, potY + 1.12, 77);
    const coals = fire(24, potY - 0.1, 77, 0.7, 14);
    pot.add(cauldron, brew, coals.group);
    this.group.add(pot);
    this.extras.push(coals);
    this.heights.add({ kind: 'cyl', x: 24, z: 77, r: 1, top: potY + 1.1 });
    // Burning castle on the far shore (south, out in the cloud sea).
    const burning = new Group();
    for (const [bx, bz, bw, bh] of [[-18, 180, 26, 40], [-5, 184, 14, 62], [7, 179, 20, 48], [18, 182, 10, 34]] as const) {
      const tower = new Mesh(new BoxGeometry(bw, bh, bw), surface({ color: 0x0a0d2a, emissive: 0xff3a10, emissiveIntensity: 0.25 }));
      tower.position.set(bx, -26 + bh / 2 - 6, bz);
      burning.add(tower);
    }
    const blaze = fire(0, 12, 180, 14, 0);
    burning.add(blaze.group);
    this.extras.push(blaze);
    this.group.add(burning);

    // --- flora and biomes ---
    this.group.add(pines(this.scatterRing(rnd, LAYOUT.forest.innerRadius, LAYOUT.forest.outerRadius, LAYOUT.forest.count)));
    for (const f of LAYOUT.sunflowerFields) this.group.add(sunflowers(this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.8, 1.2)));
    const meadow: Placement[] = [];
    for (const f of LAYOUT.flowerMeadows) meadow.push(...this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.7, 1.3));
    meadow.push(...this.scatterRing(rnd, 12, 90, 380, 0.6, 1.1));
    this.group.add(flowers(meadow));
    this.group.add(boulders(this.scatterRing(rnd, 18, 114, 60, 0.8, 2.6)));
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
    this.group.add(frozenDecor(frozenPick(260, 0.6, 1.8, -0.1), frozenPick(70, 0.9, 1.6, -0.3)));
    this.group.add(snowPines(frozenPick(90, 0.7, 1.3, -0.3)));
    this.group.add(hangingPods(frozenPick(14, 0.9, 1.4, -0.3).filter((p) => p.x > 72 && p.z < -72)));
    this.group.add(mushrooms([...this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 22, 70, 0.7, 1.3), ...this.scatterRing(rnd, 66, 114, 80, 0.6, 1.2)]));
    const shroomRing = this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 34, 14, 0.8, 1.5).filter((p) => Math.hypot(p.x - LAYOUT.frog.x, p.z - LAYOUT.frog.z) > 12);
    this.group.add(giantMushrooms(shroomRing));
    this.place(tealFalls(shroomRing.slice(0, 4).map((p) => ({ x: p.x + 2.5 * p.scale, z: p.z, top: p.y + 5.6 * p.scale, height: 5.6 * p.scale + 1, width: 1.6 * p.scale }))));
    const ft = flowerTrees(this.scatterDisc(rnd, WORLD.pond.x, WORLD.pond.z, 30, 16, 0.8, 1.3).filter((p) => Math.hypot(p.x - WORLD.pond.x, p.z - WORLD.pond.z) > WORLD.pond.r + 3), [
      { x: WORLD.pond.x - 18, y: 26, z: WORLD.pond.z - 10, yaw: 0, scale: 1.2 }, { x: WORLD.pond.x + 14, y: 31, z: WORLD.pond.z + 12, yaw: 0, scale: 0.9 }, { x: WORLD.pond.x + 2, y: 36, z: WORLD.pond.z - 22, yaw: 0, scale: 1.0 },
    ]);
    this.group.add(ft.group);
    this.extras.push(ft);
    this.group.add(willows(this.ringAround(WORLD.pond.x, WORLD.pond.z, 18, 6, rnd)));
    this.group.add(palms([...this.scatterDisc(rnd, WORLD.desert.x, WORLD.desert.z, WORLD.desert.r, 18, 0.8, 1.3), ...(this.landmarks.find((l) => 'palms' in l) as unknown as { palms: Placement[] } | undefined)?.palms ?? []]));
    this.group.add(deadForest(this.scatterDisc(rnd, WORLD.dead.x, WORLD.dead.z, WORLD.dead.r, 60, 0.8, 1.4).filter((p) => Math.hypot(p.x - WORLD.dead.x, p.z - WORLD.dead.z) > 9)));
    this.group.add(gnarledTrees(this.ringAround(LAYOUT.orchard.x, LAYOUT.orchard.z, 32, 14, rnd)));
    this.group.add(fallenFruit(this.scatterDisc(rnd, LAYOUT.orchard.x, LAYOUT.orchard.z, 26, 90, 0.8, 1.2)));
    this.group.add(giantFlowers(this.scatterDisc(rnd, -18, 33, 14, 80, 0.8, 1.3)));
    this.group.add(roseGarden(17, 34, 12, h, rnd));
    const birchSpots = this.riverBank(rnd, 14, 30, 110, 24, 96);
    this.group.add(birches(birchSpots));
    const leaves = fallenLeaves(this.riverBank(rnd, 8, 26, 600, 24, 96).map((p) => ({ ...p, scale: 0.8 + rnd() * 0.6 })), false);
    this.group.add(leaves.mesh);
    const driftSpots: Placement[] = [];
    for (let i = 0; i < 160; i++) { const x = 24 + rnd() * 72; const z = 4 + rnd() * 12; if (riverAt(x, z) > 0.5) driftSpots.push({ x, y: 1.0, z, yaw: rnd() * 6, scale: 1 }); }
    const drifting = fallenLeaves(driftSpots, true);
    this.group.add(drifting.mesh);
    this.extras.push(drifting);
    this.group.add(coral(this.riverBank(rnd, 10, 16, 30, 36, 90)));
    const pinSpots: Placement[] = [];
    for (let i = 0; i < 26; i++) pinSpots.push({ x: (rnd() - 0.5) * 190, y: 0, z: 141 + rnd() * 66, yaw: rnd() * 6, scale: 1 });
    this.group.add(pinnacles(pinSpots, LAYOUT.cloudSea.y));

    this.clouds = new CloudSea(LAYOUT.cloudSea.y);
    this.group.add(this.clouds.group);

    // --- NPCs ---
    const spots: Record<string, { x: number; z: number; y?: number }> = {
      aldous: { x: inn.seats[0].x, z: inn.seats[0].z }, mirren: { x: inn.seats[1].x, z: inn.seats[1].z },
      'gob-a': { x: inn.seats[0].x + 2.8, z: inn.seats[0].z - 1.4 }, 'gob-b': { x: inn.seats[1].x + 1.4, z: inn.seats[1].z - 2.2 },
      vigil: { x: clo.kneel.x, z: clo.kneel.z },
      rattle: { x: camp.seats[0].x, z: camp.seats[0].z }, bone: { x: camp.seats[1].x, z: camp.seats[1].z }, marrow: { x: camp.seats[2].x, z: camp.seats[2].z },
      croak: { x: WORLD.pond.x + 16, z: WORLD.pond.z - 4 },
      pim: { x: obs.perch.x, z: obs.perch.z, y: obs.perch.y },
      moss: { x: -58, z: 19 },
      king: { x: throne.seat.x, z: throne.seat.z },
      sentry: { x: -40, z: -90 }, standard: { x: WORLD.peak.x, z: WORLD.peak.z },
      'rose-knight': { x: 16, z: 34 }, maiden: { x: 18.2, z: 33 },
      'watcher-knight': { x: -18, z: -43 }, 'watcher-mage': { x: -15, z: -44 },
      cook: { x: 25.6, z: 77 },
    };
    for (const def of NPC_DEFS) {
      const s = spots[def.id] ?? { x: 0, z: 0 };
      const npc = new Npc(def, s, hw);
      if (s.y !== undefined) npc.pos.y = s.y;
      const modelId = def.id === 'king' ? 'king' : def.id.startsWith('witch') ? 'witch' : null;
      if (modelId) void loadModel(modelId).then((g) => { if (g) npc.rig.useModel(modelId, g); });
      if (def.behaviour.kind === 'stand' && (def.behaviour.pose === 'sit' || def.behaviour.pose === 'drink' || def.behaviour.pose === 'read' || def.behaviour.pose === 'throne' || def.behaviour.pose === 'sitSword' || def.behaviour.pose === 'fish')) npc.pos.y += def.behaviour.pose === 'throne' ? 1.2 : 0.5;
      this.group.add(npc.object);
      this.npcs.push(npc);
    }
  }

  private place(l: Landmark, modelId?: string): void {
    this.group.add(l.object);
    this.heights.add(...l.footprints);
    this.landmarks.push(l);
    if (modelId) {
      void loadModel(modelId).then((g) => {
        if (!g) return;
        const m = new ModelRig(modelId, g);
        l.object.children.forEach((c) => { c.visible = false; });
        l.object.add(m.root);
        if (l.clip) m.play(l.clip);
        // Static exports (smart-rigged creatures have no clips yet) still breathe and sway a little.
        let t = Math.random() * 10;
        this.extras.push({ update: (dt) => { m.update(dt); if (!m.playing) { t += dt; m.root.scale.y = 1 + Math.sin(t * 0.8) * 0.015; m.root.rotation.z = Math.sin(t * 0.5) * 0.01; } } });
      });
    }
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
    if (Math.abs(x + 33) < 24 && Math.abs(z - 76) < 10) return false;
    if (Math.abs(x - 28) < 12 && Math.abs(z - 112) < 12) return false;
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

  private ringAround(cx: number, cz: number, radius: number, count: number, rnd: () => number): Placement[] {
    const out: Placement[] = [];
    for (let i = 0; i < count; i++) {
      const a = (i / count) * Math.PI * 2 + rnd() * 0.3;
      const x = cx + Math.cos(a) * radius * (0.9 + rnd() * 0.2);
      const z = cz + Math.sin(a) * radius * (0.9 + rnd() * 0.2);
      out.push({ x, y: this.terrain.heightAt(x, z) - 0.3, z, yaw: rnd() * Math.PI * 2, scale: 0.9 + rnd() * 0.5 });
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

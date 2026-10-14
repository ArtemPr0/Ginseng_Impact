import { Group, Vector3 } from 'three';
import { LAYOUT } from '../data/world';
import { CloudSea } from './CloudSea';
import { HeightWorld } from './Colliders';
import { boulders, flowers, pines, sunflowers, type Placement } from './Flora';
import { Grass } from './Grass';
import { castle, frozenDecor, mountains, mushrooms, orchard, ruins } from './Biomes';
import { frogKing, moonShellColossus, witchBridge } from './Creatures';
import { frozenAt, streamAt } from './Terrain';
import { cathedral, causeway, giantHead, monolith, waterfall, type Landmark } from './Landmarks';
import { Terrain, WORLD } from './Terrain';
import { Noise2D } from './noise';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Assembles the first area: landmarks, flora, cloud sea, and the combined collision height field. */
export class World {
  readonly group = new Group();
  readonly heights: HeightWorld;
  private readonly landmarks: Landmark[] = [];
  private readonly clouds: CloudSea;
  readonly grass: Grass;
  private readonly noise = new Noise2D(1337);

  constructor(readonly terrain: Terrain) {
    this.heights = new HeightWorld(terrain);
    const rnd = rng(4242);
    const h = (x: number, z: number) => terrain.heightAt(x, z);

    this.place(causeway(LAYOUT.causeway, h, rnd));
    this.place(giantHead(LAYOUT.head.x, LAYOUT.head.z, Math.max(-12, h(LAYOUT.head.x, LAYOUT.head.z) - 8), LAYOUT.head.height));
    this.place(cathedral(LAYOUT.cathedral.x, LAYOUT.cathedral.z, Math.max(0, h(LAYOUT.cathedral.x, LAYOUT.cathedral.z) - 1)));
    for (const [x, z, w, mh, d, rot] of LAYOUT.monoliths) this.place(monolith(x, z, h(x, z) - 0.6, w, mh, d, rot));
    for (const w of LAYOUT.waterfalls) this.place(waterfall(w.x, w.z, h(w.x, w.z + (w.z > -95 ? 4 : -4)) - 0.5, w.width, w.height));
    this.place(frogKing(LAYOUT.frog.x, LAYOUT.frog.z, h(LAYOUT.frog.x, LAYOUT.frog.z) - 0.3));
    this.place(witchBridge(LAYOUT.coven.streamX, LAYOUT.coven.zMin, LAYOUT.coven.zMax, LAYOUT.coven.bridgeZ, h));
    this.place(castle(LAYOUT.castle.x, LAYOUT.castle.z, Math.max(0, h(LAYOUT.castle.x, LAYOUT.castle.z) - 1)));
    this.place(orchard(LAYOUT.orchard.x, LAYOUT.orchard.z, h));
    this.place(moonShellColossus(LAYOUT.colossusPath, (x, z) => this.heights.heightAt(x, z)));
    this.group.add(mountains(WORLD.islandCentre));
    this.group.add(ruins(LAYOUT.ruins.map((r) => ({ ...r, y: h(r.x, r.z) }))));

    this.group.add(pines(this.scatterRing(rnd, LAYOUT.forest.innerRadius, LAYOUT.forest.outerRadius, LAYOUT.forest.count)));
    for (const f of LAYOUT.sunflowerFields) this.group.add(sunflowers(this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.8, 1.2)));
    const meadow: Placement[] = [];
    for (const f of LAYOUT.flowerMeadows) meadow.push(...this.scatterDisc(rnd, f.x, f.z, f.r, f.count, 0.7, 1.3));
    meadow.push(...this.scatterRing(rnd, 20, 150, 600, 0.6, 1.1));
    this.group.add(flowers(meadow));
    this.group.add(boulders(this.scatterRing(rnd, 30, 190, 90, 0.8, 2.6)));
    this.grass = new Grass((x, z) => this.heights.heightAt(x, z), (x, z) => this.plantable(x, z) && frozenAt(x, z) < 0.6);
    this.group.add(this.grass.mesh);
    const fr = LAYOUT.frozenRect;
    const frozenPick = (count: number, minS: number, maxS: number, dy: number): Placement[] => {
      const out: Placement[] = [];
      let guard = 0;
      while (out.length < count && guard++ < count * 15) {
        const x = fr.xFrom + rnd() * (fr.xTo - fr.xFrom);
        const z = fr.zTo - rnd() * (fr.zTo - fr.zFrom);
        if (frozenAt(x, z) < 0.35 || !this.plantable(x, z)) continue;
        out.push({ x, y: terrain.heightAt(x, z) + dy, z, yaw: rnd() * Math.PI * 2, scale: minS + rnd() * (maxS - minS) });
      }
      return out;
    };
    this.group.add(frozenDecor(frozenPick(260, 0.6, 1.8, -0.1), frozenPick(70, 0.9, 1.6, -0.3)));
    const shroomSpots = [...this.scatterDisc(rnd, LAYOUT.frog.x, LAYOUT.frog.z, 22, 70, 0.7, 1.3), ...this.scatterRing(rnd, 110, 190, 120, 0.6, 1.2)];
    this.group.add(mushrooms(shroomSpots));

    this.clouds = new CloudSea(LAYOUT.cloudSea.y);
    this.group.add(this.clouds.group);
  }

  private place(l: Landmark): void {
    this.group.add(l.object);
    this.heights.add(...l.footprints);
    this.landmarks.push(l);
  }

  /** True where flora may grow: on the island, off the road, not in the chasm, on gentle ground. */
  plantable(x: number, z: number): boolean {
    const y = this.terrain.heightAt(x, z);
    if (y < -2) return false;
    if (streamAt(x, z, this.noise) > 0.05) return false;
    if (Math.abs(x) < 7 && z < LAYOUT.causeway.zStart + 8 && z > LAYOUT.causeway.zEnd - 8) return false;
    if (Math.abs(z - WORLD.chasmCentreZ) < WORLD.chasmHalfWidth + 14) return false;
    if (this.terrain.slopeAt(x, z) > 0.55) return false;
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

  update(dt: number, cameraPos: Vector3, playerPos: Vector3): void {
    for (const l of this.landmarks) l.update?.(dt, playerPos);
    this.clouds.update(dt, cameraPos);
    this.grass.update(playerPos.x, playerPos.z);
  }
}

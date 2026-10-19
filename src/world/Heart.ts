/**
 * The island's heart as the reference shows it (#28, 01.22.56): a flagstone road from the spawn between glowing blue
 * mushrooms to an arched wooden bridge over the eye-shaped vortex pool; a hamlet with lit windows on the far bank;
 * floating rock islands with dead trees, one pouring glowing waterfalls into the eye; three koi pools stepping down
 * beside the road (the whale reel). And the forest gorge (01.16.36): a waterfall at its head, a stream on its floor,
 * a stone bridge across, pines on its rims, and the dark spire castle rising out of the cloud sea beyond it under the
 * black sun. Everything is placed models and effects; the shapes in the ground come from Terrain.ts.
 */
import { Color, type Mesh, type MeshStandardMaterial, Vector3 } from 'three';
import { LAYOUT } from '../data/world';
import { MODELS } from '../data/models';
import { fireflies } from '../render/Fireflies';
import { glowSprite } from '../render/Glow';
import { patchGlowCap, patchLitWindows } from '../render/Materials';
import { PALETTE } from '../render/palette';
import type { Footprint, HeightWorld } from './Colliders';
import { cascade } from './Falls';
import { fire } from './Fire';
import type { FloraOptions, Placement } from './Flora';
import { modelLandmark } from './ModelLandmark';
import { landableIsland } from './Islands';
import type { ModelRig } from '../models/ModelRig';
import type { RealmApi } from './Realms';
import { EYE, RIVER_LEVEL, WORLD } from './Terrain';
import { archBridge, witchBridgeDeck } from './Walkways';
import { eyePool, poolWater, waterRibbon } from './Water';

/** The floating island's rock top (where its waterfalls spill and things stand), as a fraction of its height. */
export const ISLAND_TOP = 0.46;

/** A giant mushroom cap you bounce off (the joy pass): landing on it within `r` of its centre launches you at `v`. */
export interface Bouncer { x: number; z: number; r: number; top: number; v: number }

export interface HeartApi extends Omit<RealmApi, 'flora'> {
  heights: HeightWorld;
  /** As RealmApi.flora; `trunk` makes each tree's trunk solid (World.flora). */
  flora(id: string, placements: Placement[], opts?: FloraOptions & { trunk?: number }): void;
}

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

/** The glowing-cap patch for a mushroom set: caps from 55% of the model's height up. */
const glowCaps = (color?: Color) => (mat: MeshStandardMaterial, geo: { boundingBox: { min: Vector3; max: Vector3 } | null }) => {
  const bb = geo.boundingBox!;
  patchGlowCap(mat, bb.min.y + (bb.max.y - bb.min.y) * 0.55, color);
};

export function buildHeart(api: HeartApi): { eye: ReturnType<typeof eyePool>; bouncers: Bouncer[] } {
  const { h, rnd } = api;
  const bouncers: Bouncer[] = [];

  // --- the eye and its bridge ---
  const eye = eyePool(EYE.x, EYE.z, RIVER_LEVEL, EYE.a, EYE.b);
  api.place(eye);
  const zA = EYE.z + EYE.b + 4;
  const zB = EYE.z - EYE.b - 4;
  const endY = Math.max(h(0, zA), h(0, zB)) + 0.1;
  const bridge = archBridge(0, zA, zB, endY, endY + 3.8, 1.3, MODELS['chasm-bridge'].height);
  api.place(bridge);
  api.flora('chasm-bridge', bridge.tiles);
  // Railing posts with candles on every other one (the reference's bridge has small flames on its posts).
  const postH = MODELS['torch-post'].height * 0.5;
  const posts: Placement[] = [];
  const candles: Placement[] = [];
  bridge.posts.forEach((p, i) => {
    posts.push({ x: p.x, y: p.y - 0.1, z: p.z, yaw: 0, scale: 0.5 });
    if (i % 2 === 0) {
      api.vfx(fire(p.x, p.y + postH * 0.86, p.z, 0.16, 1.2));
    } else {
      candles.push({ x: p.x, y: p.y + postH * 0.9, z: p.z, yaw: rnd() * 6, scale: 1 });
      api.vfx(fire(p.x, p.y + postH * 0.9 + 0.3, p.z, 0.1, 1));
    }
  });
  api.flora('torch-post', posts, { shadows: false });
  api.flora('candle', candles, { shadows: false });

  // --- the flagstone road from the spawn to the bridge, two stones abreast ---
  const stones: Placement[] = [];
  for (let z = LAYOUT.spawn.z - 1; z > zA - 0.5; z -= 1.15) {
    for (const side of [-0.62, 0.62]) {
      const x = side + (rnd() - 0.5) * 0.3;
      const zz = z + (rnd() - 0.5) * 0.3;
      stones.push({ x, y: h(x, zz) - 0.04, z: zz, yaw: rnd() * 6, scale: 0.95 + rnd() * 0.35 });
    }
  }
  api.flora('stepping-stone', stones, { shadows: false, patch: (mat) => { mat.color.multiplyScalar(0.55); } });

  // --- glowing mushrooms along the road (and fireflies among them) ---
  const giants: Placement[] = [];
  for (const [x, z, s] of [[6, 54, 1.0], [-5, 50, 0.85], [6, 42, 1.15], [-4.5, 37, 0.9], [5, 33, 0.8]] as const) {
    const y = h(x, z) - 0.1;
    giants.push({ x, y, z, yaw: rnd() * 6, scale: s });
    const glow = glowSprite(0x3f8cff, 6 * s, 0.32, true);
    glow.position.set(x, y + MODELS['giant-mushroom'].height * s * 0.75, z);
    api.group.add(glow);
    const top = y + MODELS['giant-mushroom'].height * s * 0.92;
    bouncers.push({ x, z, r: 1.9 * s, top, v: 16 });
    // The cap is solid to land on (an overhang: you walk under it).
    api.heights.add({ kind: 'cyl', x, z, r: 2.1 * s, top, bottom: top - 0.9 });
  }
  api.flora('giant-mushroom', giants, { trunk: 0.09, patch: glowCaps() });
  const small: Placement[] = [];
  for (let i = 0; i < 26; i++) {
    const z = 30 + rnd() * 28;
    const side = rnd() < 0.5 ? -1 : 1;
    const x = side * (1.8 + rnd() * 4);
    small.push({ x, y: h(x, z) - 0.05, z, yaw: rnd() * 6, scale: 0.12 + rnd() * 0.16 });
  }
  api.flora('purple-mushroom', small, { shadows: false, patch: glowCaps(new Color(0.3, 0.6, 1.8)) });
  api.vfx(fireflies(0, h(0, 44), 44, 12, 4, 70, new Color(0.45, 0.85, 1.6)));

  // --- the hamlet on the far bank (lit windows, torches by the stairs) ---
  for (const [x, z, yaw] of LAYOUT.hamlet) {
    api.place(modelLandmark('village-house', x, z, h(x, z) - 0.2, { yaw, onLoad: (m) => restyle(m, (mat) => patchLitWindows(mat)) }));
  }
  for (const [x, z] of [[-3, -3.5], [3, -3.5], [12, -11], [-14, -3]] as const) {
    const y = h(x, z);
    api.place(modelLandmark('torch-post', x, z, y, { collider: 'none' }));
    api.vfx(fire(x, y + MODELS['torch-post'].height * 0.86, z, 0.4, 8));
  }

  // --- floating islands over the river: the west one pours three glowing falls into the eye ---
  // (Both still and solid on top: fly up and land on them.)
  const { top: westTop } = landableIsland(api, -14, 12, 22);
  // Off the island's south rim (its rock is about 5.5 m across the middle), into the eye's west lobe.
  for (const [x, z, w] of [[-17.5, 16.6, 2.6], [-14, 17.2, 4], [-10.6, 16.6, 2.2]] as const) {
    api.place(cascade({ x, z, top: westTop, height: westTop - RIVER_LEVEL, width: w, curve: 1.2 }));
  }
  landableIsland(api, 18, -28, 34, { yaw: 2.2 });

  // --- three koi pools stepping down beside the road, each spilling into the next and the last into the eye ---
  for (const t of LAYOUT.tiers) api.place(poolWater(t.x, t.z, t.r, t.water));
  const [t1, t2, t3] = LAYOUT.tiers;
  const rune = new Color(0.25, 1.2, 1.6);
  const spill = (a: { x: number; z: number; r: number; water: number }, bLevel: number, toward: { x: number; z: number }) => {
    const yaw = Math.atan2(toward.x - a.x, toward.z - a.z);
    const x = a.x + Math.sin(yaw) * (a.r - 0.2);
    const z = a.z + Math.cos(yaw) * (a.r - 0.2);
    api.place(cascade({ x, z, top: a.water + 0.05, height: a.water - bLevel, width: 1.8, yaw, curve: 0.5, color: rune }));
  };
  spill(t3, t2.water, t2);
  spill(t2, t1.water, t1);
  spill(t1, RIVER_LEVEL, { x: -12, z: EYE.z + EYE.b });
  const tierKoi = { x: t2.x, z: t2.z };
  for (let i = 0; i < 5; i++) {
    const phase = (i / 5) * Math.PI * 2;
    const r = 4 + (i % 3) * 2.5;
    const hgt = t2.water + 2.5 + (i % 2) * 1.4;
    const speed = 0.3 + (i % 3) * 0.05;
    api.place(modelLandmark('koi', tierKoi.x, tierKoi.z, hgt, { clip: 'idle', collider: 'none', update: (dt, root) => { void dt; const tt = performance.now() * 0.001; const a = tt * speed + phase; root.position.set(tierKoi.x + Math.cos(a) * r, hgt + Math.sin(tt * 0.9 + phase * 3) * 0.7, tierKoi.z + Math.sin(a) * r); root.rotation.y = -a; root.rotation.z = Math.cos(tt * 0.9 + phase * 3) * 0.3; } }));
  }
  api.vfx(fireflies(t2.x, t2.water, t2.z, 10, 3, 50));

  // --- the forest gorge ---
  const G = WORLD.gorge;
  const headTop = h(G.x, G.zHead + 4);
  api.place(cascade({ x: G.x, z: G.zHead + 0.5, top: headTop, height: headTop - G.floorHead, width: 6, yaw: Math.PI, curve: 1.5 }));
  const bed: Array<[number, number, number]> = [];
  for (let z = G.zHead; z >= G.zMouth - 4; z -= 2) bed.push([G.x + 0, z, h(G.x, z) + 0.35]);
  api.place(waterRibbon(bed, 2.6));
  // Over the cliff at the mouth, down into the cloud sea.
  const mouthY = h(G.x, G.zMouth - 4) + 0.3;
  api.place(cascade({ x: G.x, z: G.zMouth - 5, top: mouthY, height: mouthY - LAYOUT.cloudSea.y + 4, width: 5, yaw: Math.PI, curve: 2 }));
  // The stone arch across it (the witches' bridge model: 22 m, the gorge's full width at the rims).
  const deck = witchBridgeDeck(G.x, -124, h);
  api.place(deck);
  api.place(modelLandmark('witch-bridge', G.x, -124, deck.baseY, { collider: 'none', onLoad: () => { deck.object.visible = false; deck.object.userData.hidden = true; } }));
  // Steps up from the lower rim to the deck's end, so neither side is a ledge.
  const ends: Footprint[] = [];
  for (const side of [-1, 1]) {
    const ex = G.x + side * 11.3;
    const ground = h(ex + side * 1.5, -124);
    const endTop = deck.baseY + 22 * (0.368 / 1.899) * 0.29;
    const rise = endTop - ground;
    const steps = Math.ceil(rise / 0.35);
    for (let k = 0; k < steps; k++) {
      const top = ground + (rise * (k + 1)) / steps;
      ends.push({ kind: 'box', x: ex + side * (0.4 + (steps - 1 - k) * 0.45), z: -124, hw: 0.25, hd: 2.3, top, bottom: top - 1.5 });
    }
  }
  if (ends.length) api.heights.add(...ends);
  // Pines on both rims, dead trees leaning over the edges; the walls stay bare.
  const rims: Placement[] = [];
  const dead: Placement[] = [];
  for (let i = 0; i < 160 && rims.length < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * 28;
    const x = G.x + Math.cos(a) * r;
    const z = -122 + Math.sin(a) * r;
    if (Math.hypot(x - WORLD.islandCentre.x, z - WORLD.islandCentre.z) > 118) continue;
    if (Math.abs(x - G.x) < G.rim + 1.5 || Math.abs(z + 124) < 4 || h(x, z) < 0) continue;
    rims.push({ x, y: h(x, z) - 0.3, z, yaw: rnd() * 6, scale: 0.8 + rnd() * 0.4 });
  }
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const z = G.zHead - 6 - rnd() * 34;
    const x = G.x + side * (G.rim + 0.5 + rnd() * 2);
    if (Math.abs(z + 124) < 5) continue;
    dead.push({ x, y: h(x, z) - 0.2, z, yaw: rnd() * 6, scale: 0.8 + rnd() * 0.4 });
  }
  api.flora('pine', rims, { trunk: 0.035 });
  api.flora('dead-forest-tree', dead);
  api.vfx(fireflies(G.x, h(G.x, -118), -118, 9, 6, 60, new Color(0.5, 0.9, 1.6)));

  // --- the spire castle rising out of the cloud sea beyond the gorge (and #28's left spire from the spawn) ---
  api.place(modelLandmark('cathedral', -150, -170, -40, {
    collider: 'none', scale: 1.3, yaw: 0.6,
    onLoad: (m) => restyle(m, (mat) => { mat.color.multiplyScalar(0.32); mat.emissive.set(0x0a1440); mat.emissiveIntensity = 1; patchLitWindows(mat, 1.4); }),
  }));
  void PALETTE;
  return { eye, bouncers };
}

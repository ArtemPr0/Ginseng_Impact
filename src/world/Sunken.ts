/**
 * The Sunken City under the lily pond, laid out as reel DeVj-Z8POjl, walked south to north from the bubbles you
 * arrive in:
 *  1. the kelp road: a stone path through teal fog between jellyfish cage-lanterns, kelp and drowned trees, where
 *     the diver in the brass helmet walks (NPCs.ts);
 *  2. the drowned street: cobbles between half-timbered houses with warm windows, orange lanterns hung from their
 *     fronts, market stalls, big blue fish swimming between the roofs, a gothic church at the end;
 *  3. the square before the tavern: the coral throne under the giant crown, a teal hearth, the long table of purple
 *     goblets and candles, coin tables, barrels, red orb lamps, jellyfish drifting, a green door home;
 *  4. the Fish King's bar: his counter, the bubbling chalice, shelves of glowing orange bottles.
 * Overhead the sea's surface ripples with the sun burning through it; light falls in shafts, caustics dance on the
 * cobbles, bubbles rise everywhere. Buildings, props and creatures are Meshy models by id; the water is shaders.
 */
import { Color, Group, type Mesh, type MeshStandardMaterial, PointLight, Vector3 } from 'three';
import { ISLAND_PORTALS, SUNKEN } from '../data/world';
import { MODELS } from '../data/models';
import { cobbleFloor, seabed } from '../render/Floors';
import { glowSprite } from '../render/Glow';
import { patchSwim, patchWind } from '../render/Materials';
import { PALETTE } from '../render/palette';
import { causticFloor, lightShafts, risingBubbles, tickUnderwater, waterCeiling } from '../render/Underwater';
import { fire } from './Fire';
import type { Placement } from './Flora';
import type { ModelRig } from '../models/ModelRig';
import { modelLandmark } from './ModelLandmark';
import { PRESENT_MODELS } from '../data/colliderGrids';
import { portal, type PortalLink } from './Portal';
import type { RealmApi } from './Realms';
import { floorSlab } from './Walkways';

/**
 * Where the ways home come out on the island: in the lily pond's shallows 5 m east of the whirlpool, facing it (the
 * shore point east of the pond put you by the causeway's stairs, nowhere near the water you went down through).
 */
const POND_EXIT = { x: ISLAND_PORTALS.pond.x + 5, z: ISLAND_PORTALS.pond.z, yaw: Math.PI };
/** The jellyfish lantern's size on a fish (jelly-lantern.glb is 4.2 m with its tentacles: about 1.6 m). */
const CAGE_SCALE = 0.38;
/** How far ahead of its middle a blue fish's mouth is (per unit of its scale). */
const FISH_MOUTH = 1.15;
/** The sea castle's turn: its gate toward the drowned street (+z). */
const CASTLE_YAW = 0;
/** Rotation that turns a model's front (local +z) toward world direction `yaw` (cos, sin). */
const face = (yaw: number) => Math.PI / 2 - yaw;
const TEAL_FIRE = { core: 0x2ff0d0, inner: 0xc8fff4, ember: 0x10b8a0 };
const LANTERN = 0xffa040;

/** The sunken city's walkable floor (x0, x1, z0, z1): the road, the street and the square in one long slab. */
export const SUNKEN_FLOOR = [-1040, -960, -140, 70] as const;
/** Where the hero arrives from the pond, facing up the kelp road (north). */
export const SUNKEN_ARRIVAL = { x: SUNKEN.x, z: SUNKEN.z + 56 };

function restyle(model: ModelRig, fn: (mat: MeshStandardMaterial) => void): void {
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    fn(mat);
    m.material = mat;
  });
}

/** Builds the city into its realm; returns the ways home (the bubble column and the green door). */
export function buildSunken(api: RealmApi, link: (at: Vector3, radius: number, height: number, x: number, z: number, yaw: number, name: string) => PortalLink): PortalLink[] {
  const S = SUNKEN;
  const sy = S.y;
  const X = S.x;
  const links: PortalLink[] = [];
  api.realm(S.id);
  const glow = (color: number, size: number, x: number, y: number, z: number, opacity = 0.5) => {
    const s = glowSprite(color, size, opacity, true);
    s.position.set(x, y, z);
    api.group.add(s);
    return s;
  };
  const [fx0, fx1, fz0, fz1] = SUNKEN_FLOOR;
  const fw = fx1 - fx0, fd = fz1 - fz0, fcx = (fx0 + fx1) / 2, fcz = (fz0 + fz1) / 2;
  api.place(floorSlab(fcx, fcz, sy, fw, fd));
  // Unseen walls round the slab (beyond it the murk hides a long fall).
  api.place({ object: new Group(), footprints: [
    { kind: 'box', x: fx0 - 0.5, z: fcz, hw: 0.5, hd: fd / 2 + 1, top: sy + 6 }, { kind: 'box', x: fx1 + 0.5, z: fcz, hw: 0.5, hd: fd / 2 + 1, top: sy + 6 },
    { kind: 'box', x: fcx, z: fz0 - 0.5, hw: fw / 2 + 1, hd: 0.5, top: sy + 6 }, { kind: 'box', x: fcx, z: fz1 + 0.5, hw: fw / 2 + 1, hd: 0.5, top: sy + 6 },
  ] });
  // The sea bed all round (it hides the slab's edges in the murk), and the cobbled way from the kelp road through the
  // street into the square.
  api.group.add(seabed(fcx, fcz, 600, 600, sy));
  // (Stacked a couple of centimetres apart where they overlap, or the planes fight for the same pixels.)
  api.group.add(cobbleFloor(X, -40, 16, 130, sy + 0.02, 0, 0.45));
  api.group.add(cobbleFloor(X, -78, 46, 36, sy + 0.035, 0, 0.45));

  // ===== The water itself =====
  const fx = new Group();
  fx.add(causticFloor(fcx, fcz, fw, fd, sy));
  fx.add(waterCeiling(fcx, fcz, fw + 200, fd + 200, sy + 30, X + 6, -98));
  fx.add(lightShafts([
    { x: X + 3, y: sy + 30, z: -96, length: 34, width: 5 }, { x: X - 4, y: sy + 30, z: -74, length: 33, width: 3.5, tilt: 0.12 },
    { x: X + 2, y: sy + 30, z: -40, length: 32, width: 4, tilt: 0.22 }, { x: X - 3, y: sy + 30, z: -12, length: 32, width: 3, tilt: 0.15 },
    { x: X + 1, y: sy + 30, z: 20, length: 32, width: 3.5, tilt: 0.2 }, { x: X - 9, y: sy + 30, z: -86, length: 34, width: 2.5, tilt: 0.1 },
  ]));
  const bubbles = risingBubbles(fcx, fcz, fw, fd, sy, 30, 700);
  fx.add(bubbles.points);
  api.vfx({ group: fx, update: (dt) => { tickUnderwater(dt); bubbles.update(dt); } });

  // ===== 1. The kelp road (z 62 → 22) =====
  // (The jellyfish lanterns are carried by the fish now, lighting the road as they swim: see the drowned street.)
  // Kelp swaying and drowned trees in the fog either side.
  const kelp: Placement[] = [];
  const kelpTrees: Placement[] = [];
  for (let i = 0; i < 70; i++) {
    const side = i % 2 ? 1 : -1;
    const x = X + side * (6 + api.rnd() * 30);
    const z = 20 + api.rnd() * 48;
    kelp.push({ x, y: sy, z, yaw: api.rnd() * 6, scale: 0.7 + api.rnd() * 0.9 });
  }
  for (let i = 0; i < 14; i++) {
    const side = i % 2 ? 1 : -1;
    const x = X + side * (9 + api.rnd() * 24);
    const z = 22 + api.rnd() * 44;
    kelpTrees.push({ x, y: sy - 0.1, z, yaw: api.rnd() * 6, scale: 0.7 + api.rnd() * 0.4 });
  }
  api.flora('kelp', kelp, { shadows: false, patch: (mat) => patchWind(mat, 0.6) });
  api.flora('dead-forest-tree', kelpTrees, { patch: (mat) => { mat.color.lerp(new Color(0x1d4a52), 0.6); } });
  for (const t of kelpTrees) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: t.x, z: t.z, r: 0.35 * t.scale, top: sy + 6 }] });

  // ===== 2. The drowned street (z 18 → -56) =====
  const houseZs = [12, 2, -8, -18, -28, -38, -48];
  const HOUSE = PRESENT_MODELS.has('drowned-house') ? 'drowned-house' : 'village-house';
  houseZs.forEach((z, i) => {
    for (const side of [-1, 1]) {
      const x = X + side * (10.5 + (i % 2) * 0.8);
      const yaw = side < 0 ? 0 : Math.PI;
      api.place(modelLandmark(HOUSE, x, z, sy, { yaw: face(yaw), footprints: [{ kind: 'box', x, z, hw: 3.3, hd: 3.3, top: sy + 6 }],
        // Slate-blue under the water; its windows' warm light is drawn as glows (the lit-window patch would light the
        // thatch too). The reel's houses are slate-roofed: drowned-house replaces this once it is made.
        onLoad: (m) => { if (HOUSE === 'village-house') restyle(m, (mat) => { mat.color.lerp(new Color(0x2a4060), 0.65); }); } }));
      for (const dz of [-1.4, 1.4]) glow(LANTERN, 1.3, x - side * 3.4, sy + 2.4, z + dz, 0.5);
    }
  });
  // Orange lanterns hung from the house fronts on both sides, up the street.
  const lanterns: Placement[] = [];
  for (const z of [16, 6, -4, -14, -24, -34, -44, -54]) for (const side of [-1, 1]) {
    const x = X + side * 6.6;
    lanterns.push({ x, y: sy + 3.4, z, yaw: api.rnd() * 6, scale: 1 });
    glow(LANTERN, 2.4, x, sy + 3.3, z, 0.6);
  }
  api.flora('hanging-lantern', lanterns);
  // Market stalls under the lanterns (clear of the house fronts: the drowned houses are deeper than their boxes).
  for (const [dx, z, yaw] of [[-4.8, 0, 0], [4.8, -22, Math.PI], [-4.8, -41, 0]] as const) {
    const x = X + dx;
    api.place(modelLandmark('market-stall', x, z, sy, { yaw: face(yaw), footprints: [{ kind: 'box', x, z, hw: 1.2, hd: 1.8, top: sy + 1.1 }] }));
  }
  // Big blue fish swimming up and down the kelp road and the street, each carrying a jellyfish lantern under its jaw
  // (jelly-lantern.glb: an iron cage with a glowing jellyfish, hung on its ring): the fish light the drowned city.
  const fishSeed: Array<{ x: number; y: number; v: number; ph: number; scale: number }> = [];
  const fish: Placement[] = [];
  const cages: Placement[] = [];
  for (let i = 0; i < 12; i++) {
    const seed = { x: X + (api.rnd() - 0.5) * 12, y: sy + 4.5 + api.rnd() * 5, v: (api.rnd() < 0.5 ? -1 : 1) * (1.2 + api.rnd() * 1.2), ph: api.rnd() * 6, scale: 0.9 + api.rnd() * 0.5 };
    fishSeed.push(seed);
    fish.push({ x: seed.x, y: seed.y, z: 0, yaw: 0, scale: seed.scale });
    cages.push({ x: seed.x, y: seed.y, z: 0, yaw: 0, scale: CAGE_SCALE });
  }
  // Where fish `i` is at time `t`: back and forth from the kelp road's start to the castle gate (115 m), turning at
  // the ends; heading +1 swims toward +z.
  const swim = (i: number, t: number) => {
    const s = fishSeed[i];
    const span = 115, u = ((t * Math.abs(s.v) + s.ph * 10) % (span * 2)) / span;
    const out = u < 1;
    let z = 58 - (out ? u : 2 - u) * span;
    if (s.v < 0) z = -57 + (58 - z);
    const heading = (out ? -1 : 1) * (s.v < 0 ? -1 : 1);
    return { x: s.x + Math.sin(t * 0.4 + s.ph) * 2, y: s.y + Math.sin(t * 0.7 + s.ph) * 0.6, z, heading };
  };
  api.flora('blue-fish', fish, { shadows: false,
    patch: (mat, geo) => { geo.computeBoundingBox(); const bb = geo.boundingBox!; const axis = bb.max.x - bb.min.x > bb.max.z - bb.min.z ? 'x' : 'z'; patchSwim(mat, axis, bb.min[axis], bb.max[axis], (bb.max.y - bb.min.y) * 0.15); },
    update: (t, ps) => {
      ps.forEach((p, i) => { const w = swim(i, t); p.x = w.x; p.y = w.y; p.z = w.z; p.yaw = w.heading < 0 ? Math.PI : 0; });
      return true;
    } });
  // The lanterns hang from each fish's mouth (its front, FISH_MOUTH ahead of its middle, under the belly), swaying a
  // little behind it; the jellyfish inside glows (its own texture lit, and a halo).
  const cageH = MODELS['jelly-lantern'].height * CAGE_SCALE;
  api.flora('jelly-lantern', cages, { shadows: false,
    patch: (mat) => { if (mat.map) { mat.emissiveMap = mat.map; mat.emissive.setRGB(0.6, 0.85, 1); mat.emissiveIntensity = 0.9; } },
    update: (t, ps) => {
      ps.forEach((p, i) => { const w = swim(i, t); const sc = fishSeed[i].scale; p.x = w.x + Math.sin(t * 1.3 + i) * 0.08; p.z = w.z + w.heading * FISH_MOUTH * sc; p.y = w.y + 0.55 * sc - cageH; p.yaw = Math.sin(t * 0.9 + i) * 0.3; });
      return true;
    } });
  const halos = new Group();
  for (let i = 0; i < fishSeed.length; i++) halos.add(glowSprite(0x7ad8ff, 2.6, 0.55, true));
  // (Each halo on its cage as the flora last placed it: their clocks differ.)
  api.vfx({ group: halos, update: () => { halos.children.forEach((h, i) => { const c = cages[i]; h.position.set(c.x, c.y + cageH * 0.45, c.z); }); } });
  // ===== 3. The sea king's castle (z -60 -> -98): the square's walls, its open courtyard toward the street =====
  // Coral walls and towers round a courtyard (sea-castle.glb, measured: open floor x -1008..-994, z -62..-72, a narrow
  // lane on behind between the towers); the Fish King keeps his bar there, his coral throne and crown behind him.
  api.place(modelLandmark('sea-castle', X, -80, sy, { yaw: CASTLE_YAW }));
  const TH = { x: X, z: -71.2 };
  api.place(modelLandmark('coral-throne', TH.x, TH.z, sy, { yaw: face(Math.PI / 2), footprints: [{ kind: 'box', x: TH.x, z: TH.z, hw: 1, hd: 1.3, top: sy + 0.8 }] }));
  let ca = 0;
  api.place(modelLandmark('giant-crown', TH.x, TH.z, sy + 8.5, { collider: 'none', update: (dt, root) => { ca += dt; root.rotation.y = Math.sin(ca * 0.3) * 0.2; root.position.y = sy + 8.5 + Math.sin(ca * 0.8) * 0.2; } }));
  glow(0xffd070, 5, TH.x, sy + 9.4, TH.z, 0.3);
  // The teal hearth beside the throne.
  api.vfx(fire(X + 4.2, sy + 0.1, -70.5, 0.8, 20, TEAL_FIRE));
  // His counter before the throne: the bubbling chalice on it, shelves of glowing bottles against the walls either side.
  const barZ = -66.2;
  api.flora('tavern-table', [{ x: X, y: sy, z: barZ, yaw: 0, scale: 1.4 }]);
  api.place({ object: new Group(), footprints: [{ kind: 'box', x: X, z: barZ, hw: 2.2, hd: 0.8, top: sy + 1.3 }] });
  for (const side of [-1, 1]) {
    const x = X + side * 6.6;
    api.place(modelLandmark('bottle-shelf', x, -67.5, sy, { yaw: face(side < 0 ? 0 : Math.PI), footprints: [{ kind: 'box', x, z: -67.5, hw: 0.4, hd: 1.3, top: sy + 2.6 }] }));
    for (let k = 0; k < 4; k++) glow(LANTERN, 1.2, x - side * 0.3, sy + 0.8 + (k % 2) * 0.8, -67.5 + (k - 1.5) * 0.6, 0.45);
  }
  api.place(modelLandmark('chalice', X + 0.8, barZ, sy + 1.3, { collider: 'none' }));
  glow(0x9b4dff, 1.4, X + 0.8, sy + 1.85, barZ, 0.7);
  {
    const fizz = risingBubbles(X + 0.8, barZ, 0.3, 0.3, sy + 1.75, 0.8, 24);
    const g = new Group();
    g.add(fizz.points);
    api.vfx({ group: g, update: (dt) => fizz.update(dt) });
  }
  // Before the gate: the long tables of purple goblets and candles either side of the approach, coin tables, barrels,
  // red orb lamps flanking the gate.
  const goblets: Placement[] = [];
  const candles: Placement[] = [];
  for (const side of [-1, 1]) {
    const tx = X + side * 7.2, tz = -56;
    api.flora('tavern-table', [{ x: tx, y: sy, z: tz, yaw: Math.PI / 2, scale: 1 }]);
    api.place({ object: new Group(), footprints: [{ kind: 'box', x: tx, z: tz, hw: 0.6, hd: 1.6, top: sy + 0.95 }] });
    for (let k = 0; k < 4; k++) {
      const z = tz - 1.2 + k * 0.8;
      goblets.push({ x: tx + (k % 2 ? 0.25 : -0.25), y: sy + 0.95, z, yaw: api.rnd() * 6, scale: 0.6 });
      glow(0x9b4dff, 0.7, tx + (k % 2 ? 0.25 : -0.25), sy + 1.35, z, 0.5);
      if (k % 2 === 0) candles.push({ x: tx, y: sy + 0.95, z: z + 0.4, yaw: 0, scale: 1 });
    }
  }
  api.flora('chalice', goblets, { shadows: false, patch: (mat) => { mat.color.set(0x5a2a9a); mat.emissive?.set(0x3a1070); } });
  api.flora('candle', candles, { shadows: false });
  for (const c of candles) glow(0xffb050, 0.7, c.x, c.y + 0.35, c.z, 0.55);
  for (const dx of [-4.6, 4.6]) api.place(modelLandmark('coin-table', X + dx, -63.4, sy, { footprints: [{ kind: 'cyl', x: X + dx, z: -63.4, r: 1, top: sy + 0.9 }] }));
  const barrels: Placement[] = [[-10.6, -57.6], [-11.8, -59.2], [10.6, -57.6], [11.6, -59.4]].map(([dx, z]) => ({ x: X + dx, y: sy, z, yaw: api.rnd() * 6, scale: 1 }));
  api.flora('barrel', barrels);
  for (const b of barrels) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: b.x, z: b.z, r: 0.5, top: sy + 1.1 }] });
  for (const dx of [-3.6, 3.6]) {
    api.place(modelLandmark('orb-lamp', X + dx, -59.6, sy, { footprints: [{ kind: 'cyl', x: X + dx, z: -59.6, r: 0.3, top: sy + 2.2 }] }));
    glow(0xff3a2a, 2.2, X + dx, sy + 2, -59.6, 0.6);
  }
  // The green door home, by the castle's west corner (the reel's glowing green doorway).
  api.place(portal(X - 14, sy + 2.2, -58.5, 1.6, { vertical: true, facing: 0, colors: [0x0a3a1a, 0x3dff7a] }));
  links.push(link(new Vector3(X - 14, sy + 0.8, -58.5), 1.6, 3, POND_EXIT.x, POND_EXIT.z, POND_EXIT.yaw, 'The Lily Pond'));
  // Jellyfish drifting over the square, each with its glow.
  const jelly: Placement[] = [];
  const jellySeed: Array<{ cx: number; cz: number; r: number; h: number; s: number; p: number }> = [];
  for (let i = 0; i < 16; i++) {
    const seed = { cx: X + (api.rnd() - 0.5) * 40, cz: -50 - api.rnd() * 45, r: 2 + api.rnd() * 6, h: sy + 5 + api.rnd() * 10, s: 0.1 + api.rnd() * 0.2, p: api.rnd() * 6 };
    jellySeed.push(seed);
    jelly.push({ x: seed.cx, y: seed.h, z: seed.cz, yaw: 0, scale: 0.6 + api.rnd() * 0.8 });
  }
  api.flora('jellyfish', jelly, { shadows: false, update: (t, ps) => {
    ps.forEach((p, i) => { const s = jellySeed[i]; const a = t * s.s + s.p; p.x = s.cx + Math.cos(a) * s.r; p.z = s.cz + Math.sin(a) * s.r; p.y = s.h + Math.sin(t * 0.7 + s.p) * 1.2; p.yaw = -a; });
    return true;
  } });
  const glowJelly = new Group();
  for (let i = 0; i < 16; i++) glowJelly.add(glowSprite(PALETTE.rune, 2.2, 0.35, true));
  api.vfx({ group: glowJelly, update: () => { const t = performance.now() / 1000; glowJelly.children.forEach((c, i) => { const s = jellySeed[i]; const a = t * s.s + s.p; c.position.set(s.cx + Math.cos(a) * s.r, s.h + 0.6 + Math.sin(t * 0.7 + s.p) * 1.2, s.cz + Math.sin(a) * s.r); }); } });
  const hearth = new PointLight(0x2ff0d0, 50, 26, 1.6);
  hearth.position.set(X + 4.2, sy + 2.5, -70.5);
  api.group.add(hearth);

  // The bubble column home, behind where you arrive.
  const home = { x: X, z: SUNKEN_ARRIVAL.z + 8 };
  api.place(portal(home.x, sy + 0.06, home.z, 2.6, { vertical: false, colors: [PALETTE.abyss, PALETTE.moon], spin: 1 }));
  for (let k = 0; k < 8; k++) glow(PALETTE.moon, 0.8, home.x + (api.rnd() - 0.5) * 2, sy + 1 + k * 1.6, home.z + (api.rnd() - 0.5) * 2, 0.4);
  links.push(link(new Vector3(home.x, sy + 0.5, home.z), 2.2, 3, POND_EXIT.x, POND_EXIT.z, POND_EXIT.yaw, 'The Lily Pond'));
  api.realm(null);
  return links;
}

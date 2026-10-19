/**
 * Yung Lean's kingdom as the Lean Quarter (round 6, the @returndark reels): every lean sipper, the gold, the
 * diamonds and the dragons live here, in quarters off the plaza (data/world.ts LEAN_QUARTER):
 *  - the Skeleton Court, north (Def4LDkxikA, DeXn5rSPxR8, DeOemU1BOZF): the dragon throne, the lean fountains in a
 *    purple mist, the treasury, the skeleton lord's pavilion with his purple smoke, the galaxy bottles;
 *  - Bucket Street and the lean castle, west (DeaqHWJBBPw, DeXn5rSPxR8): purple houses, the bucket mimics and the
 *    chain-mail knights, the skeleton wizard in his floating diamonds, a castle pouring lean falls into its moat,
 *    a carriage at the gate under a floating gold gem;
 *  - the snow chapel, south-west (DeldocTvFiB): snow, a ruined chapel among graves and bare trees, the plague doctor
 *    on his treasure wagon; the chapel's door leads down to the crypt bar of sipping skeletons (Interiors.ts);
 *  - the sky dock, east (Den1ausBXai, DeYtKbMh76x): a floating island past the cup islands where a black dragon
 *    lounges with a knight and a skeleton tends the sky bar, a giant cup on a tower, islands with lamps.
 * Every structure is a Meshy model by id (nothing shows until its file exists); floors, mist, falls, flames,
 * sparkles and skies are procedural.
 */
import { Color, Group, type MeshStandardMaterial, type Mesh, Vector3 } from 'three';
import { GALAXY, LEAN_QUARTER } from '../data/world';
import { MODELS } from '../data/models';
import { flagstoneFloor, cobbleFloor, rockTop, snowGround } from '../render/Floors';
import { CHAPEL_DOOR } from './Interiors';
import { glowSprite } from '../render/Glow';
import { Glints, LEAN, meteors, mistLayers, ringedPlanet, skyVortex, tickLeanFx } from '../render/LeanFx';
import { clipAbove, patchLitWindows } from '../render/Materials';
import { PALETTE } from '../render/palette';
import { PipeSmoke } from '../render/Smoke';
import type { Footprint } from './Colliders';
import { cascade } from './Falls';
import { fire, PURPLE_FIRE } from './Fire';
import type { Placement } from './Flora';
import type { Interactable } from './Interact';
import type { ModelRig } from '../models/ModelRig';
import { modelLandmark } from './ModelLandmark';
import { PRESENT_MODELS } from '../data/colliderGrids';
import type { RealmApi } from './Realms';
import { floorSlab } from './Walkways';
import { waterSheet } from './Water';
import { ISLAND_TOP } from './Heart';

/** Rotation that turns a model's front (local +z) toward world direction `yaw` (cos, sin). */
const face = (yaw: number) => Math.PI / 2 - yaw;

/** The colour the lean falls and fountains glow (bloom-safe). */
const LEAN_FALL = new Color(0.62, 0.22, 1.25);

function restyle(model: ModelRig, fn: (mat: MeshStandardMaterial) => void): void {
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    fn(mat);
    m.material = mat;
  });
}

export interface LeanQuarterHooks {
  /** The world swirls (renderer.trip): a sip from a lean fountain. */
  trip(strength: number, seconds: number): void;
}

/** Builds the quarters into the kingdom realm; returns the fountains to sip from. */
export function buildLeanQuarter(api: RealmApi, hooks: LeanQuarterHooks): { interactables: Interactable[] } {
  const R = GALAXY;
  const Q = LEAN_QUARTER;
  const gy = R.y;
  const interactables: Interactable[] = [];
  api.realm(R.id);
  const glow = (color: number, size: number, x: number, y: number, z: number, opacity = 0.5) => {
    const s = glowSprite(color, size, opacity, true);
    s.position.set(x, y, z);
    api.group.add(s);
    return s;
  };
  const glints = new Glints(40, 14);
  const fx = new Group();
  fx.add(glints.group);
  const updates: Array<(dt: number) => void> = [];
  api.vfx({ group: fx, update: (dt) => { tickLeanFx(dt); glints.update(dt); for (const u of updates) u(dt); } });

  // ===== Floors and walls =====
  const rect = (r: readonly [number, number, number, number]) => ({ x: (r[0] + r[1]) / 2, z: (r[2] + r[3]) / 2, w: r[1] - r[0], d: r[3] - r[2] });
  const solid = (r: readonly [number, number, number, number], top: number): Footprint => { const c = rect(r); return { kind: 'box', x: c.x, z: c.z, hw: c.w / 2, hd: c.d / 2, top }; };
  const wall = (x: number, z: number, hw: number, hd: number): Footprint => ({ kind: 'box', x, z, hw, hd, top: gy + 6 });
  const court = rect(Q.court), street = rect(Q.street), moat = rect(Q.moat), yard = rect(Q.castleYard), snow = rect(Q.snow);
  api.group.add(flagstoneFloor(court.x, court.z, court.w, court.d, gy));
  api.group.add(cobbleFloor(street.x, street.z, street.w, street.d, gy));
  api.group.add(flagstoneFloor(yard.x, yard.z, yard.w, yard.d, gy, new Color(0.3, 0.1, 0.6)));
  api.group.add(snowGround(snow.x, snow.z, snow.w, snow.d, gy));
  api.place({ object: new Group(), footprints: [
    solid(Q.court, gy), solid(Q.street, gy), solid(Q.castleYard, gy), solid(Q.snow, gy), solid(Q.moat, gy - 2.2),
    // Unseen walls round the quarters (the plaza's east edge stays open onto the lean waves).
    wall(1000, -185.5, 60.5, 0.5), wall(1060.5, -135, 0.5, 50), wall(939.5, -112.5, 0.5, 72.5),
    wall(860, -40.5, 80.5, 0.5), wall(779.5, 17.5, 0.5, 58), wall(820, 75.5, 40, 0.5),
    wall(859.5, 125, 0.5, 50.5), wall(910, 175.5, 50.5, 0.5), wall(960.5, 125, 0.5, 50), wall(1010, 75.5, 50, 0.5),
  ] });

  // ===== The Skeleton Court, north (Def4LDkxikA) =====
  api.group.add(mistLayers(court.x, court.z - 5, court.w, court.d - 10, gy, 0x5a26b0, 0.26, 3));
  // The dragon throne at the court's head, the skeleton king on it (NPCs.ts), purple fire either side.
  api.place(modelLandmark('dragon-throne', 1000, -172, gy, { yaw: face(Math.PI / 2), footprints: [{ kind: 'box', x: 1000, z: -173, hw: 5, hd: 2.5, top: gy + 1 }] }));
  for (const dx of [-7.5, 7.5]) {
    api.place(modelLandmark('brazier', 1000 + dx, -166, gy, { footprints: [{ kind: 'cyl', x: 1000 + dx, z: -166, r: 0.6, top: gy + 1.3 }] }));
    api.vfx(fire(1000 + dx, gy + 1.5, -166, 0.7, 10, PURPLE_FIRE));
  }
  glints.add(new Vector3(1000, gy + 2.3, -170.4), new Vector3(), 0.25);
  glints.add(new Vector3(1000, gy + 1.9, -170.2), new Vector3(), 0.3);
  // The reel's two black dragons flanking the throne, heads up, facing down the court (+z: the model itself looks
  // about 27° to the left of its yaw, checked from the court).
  for (const side of [-1, 1]) api.place(modelLandmark('lean-dragon', 1000 + side * 8.5, -172, gy, { yaw: face(Math.PI * 0.35), scale: 0.85 }));
  // Dragon-head fountains along both sides, each pouring lean into its basin; tiered fountains down the aisle.
  for (const side of [-1, 1]) {
    for (const z of [-108, -138]) {
      const x = 1000 + side * 38;
      const dir = side < 0 ? 0 : Math.PI;
      api.place(modelLandmark('dragon-fountain', x, z, gy, { yaw: face(dir), footprints: [{ kind: 'box', x, z, hw: 2.2, hd: 2.2, top: gy + 1.2 }] }));
      // From the jaws (the head leans out over the basin) down into it, once the fountain exists.
      if (PRESENT_MODELS.has('dragon-fountain')) api.place(cascade({ x: x - side * 1.3, z, top: gy + 3.6, height: 2.6, width: 0.5, yaw: side < 0 ? Math.PI / 2 : -Math.PI / 2, curve: 0.5, color: LEAN_FALL }));
      glow(LEAN, 3.2, x - side * 1.8, gy + 1.2, z, 0.45);
    }
  }
  for (const x of [982, 1018]) {
    const z = -126;
    api.place(modelLandmark('lean-fountain', x, z, gy, { footprints: [{ kind: 'cyl', x, z, r: 1.6, top: gy + 1 }] }));
    glow(LEAN, 4.5, x, gy + 1.4, z, 0.55);
    if (PRESENT_MODELS.has('lean-fountain')) api.place(cascade({ x, z, top: gy + 3.1, height: 1.6, width: 0.8, curve: 0.3, color: LEAN_FALL }));
    const at = new Vector3(x, gy + 1, z);
    interactables.push({
      pos: at, range: 2.8, zone: R.id,
      label: () => 'Sip from the fountain',
      // One sip and the court spins.
      act: () => hooks.trip(0.55, 5),
    });
  }
  const courtBarrels: Placement[] = [[958, -122], [960, -126], [1042, -122], [1040, -125.5], [964, -152], [1036, -150]].map(([x, z]) => ({ x, y: gy, z, yaw: api.rnd() * 6, scale: 1 }));
  api.flora('barrel', courtBarrels);
  for (const b of courtBarrels) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: b.x, z: b.z, r: 0.5, top: gy + 1.1 }] });
  // Purple torches down the aisle.
  for (const z of [-96, -116, -136, -156]) for (const side of [-1, 1]) {
    const x = 1000 + side * 11;
    api.place(modelLandmark('torch-post', x, z, gy, { footprints: [{ kind: 'cyl', x, z, r: 0.25, top: gy + 2.4 }] }));
    api.vfx(fire(x, gy + 2.3, z, 0.35, 0, PURPLE_FIRE));
  }
  // The treasury in the court's west wing (DeOemU1BOZF): the stone throne, coin blocks, crystals and stalactites.
  api.place(modelLandmark('stone-throne', 956, -176, gy, { yaw: face(Math.PI / 2), footprints: [{ kind: 'box', x: 956, z: -176.4, hw: 1.2, hd: 1.6, top: gy + 0.9 }] }));
  const coins: Placement[] = [[950, -168], [962, -168], [948, -158], [966, -160], [953, -150], [968, -149]].map(([x, z]) => ({ x, y: gy, z, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 0.5 }));
  api.flora('coin-block', coins);
  for (const c of coins) { api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: c.x, z: c.z, r: 0.7 * c.scale, top: gy + 1.1 * c.scale }] }); glints.add(new Vector3(c.x, gy + 1.1 * c.scale, c.z), new Vector3(), 0.5); }
  const crystals: Placement[] = [];
  for (let i = 0; i < 12; i++) { const x = 945 + api.rnd() * 28; const z = -180 + api.rnd() * 36; crystals.push({ x, y: gy, z, yaw: api.rnd() * 6, scale: 0.6 + api.rnd() * 1.2 }); glow(PALETTE.dusk, 1.4, x, gy + 0.6, z, 0.4); }
  api.flora('purple-crystal', crystals, { shadows: false });
  // Stalactites of blue crystal hanging in the air over the gold, drifting (the reel's cave has no roof to show).
  const stal: Array<{ p: Placement; base: number; ph: number }> = [];
  for (let i = 0; i < 8; i++) { const base = gy + 12 + api.rnd() * 5; stal.push({ p: { x: 946 + api.rnd() * 26, y: base, z: -178 + api.rnd() * 32, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 0.8 }, base, ph: api.rnd() * 6 }); }
  api.flora('stalactite', stal.map((s) => s.p), { shadows: false, update: (t, ps) => { ps.forEach((p, i) => { p.y = stal[i].base + Math.sin(t * 0.5 + stal[i].ph) * 0.4; }); return true; } });
  for (const s of stal) glow(PALETTE.electric, 2.4, s.p.x, s.base - 1, s.p.z, 0.3);
  // The skeleton lord's pavilion in the east wing (DeXn5rSPxR8): he sits at the front of its great settee (facing the
  // court), Sir Cobalt on a stool beside him; his smoke is purple.
  api.place(modelLandmark('gothic-pavilion', 1043, -160, gy, { yaw: face(Math.PI) }));
  {
    // (Where the seated lord's feet are: his anchor at the settee's front edge, data/world ANCHORS.)
    const lord = new Vector3(1042.15, 24.53, -160);
    const smoke = new PipeSmoke(0xb36bff);
    // At his teeth, seated (the vape the gauntlet holds to his mouth in the reel).
    smoke.emitter.position.set(lord.x - 0.18, lord.y + 1.36, lord.z);
    fx.add(smoke.emitter, smoke.particles);
    updates.push((dt) => smoke.update(dt));
    glints.add(new Vector3(lord.x - 0.16, lord.y + 1.34, lord.z), new Vector3(), 0.05);
    glints.add(new Vector3(lord.x - 0.2, lord.y + 0.95, lord.z), new Vector3(), 0.12);
  }
  // The galaxy bottles (DeOemU1BOZF's starry hall): two long tables of them under the court's east wall.
  for (const z of [-120, -134]) {
    const tx = 1030;
    api.flora('tavern-table', [{ x: tx, y: gy, z, yaw: 0, scale: 1 }]);
    api.place({ object: new Group(), footprints: [{ kind: 'box', x: tx, z, hw: 1.6, hd: 0.6, top: gy + 0.95 }] });
    const bottles: Placement[] = [-1.2, -0.6, 0, 0.6, 1.2].map((dx) => ({ x: tx + dx, y: gy + 0.95, z: z + (api.rnd() - 0.5) * 0.3, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 0.4 }));
    api.flora('potion-bottle', bottles, { shadows: false });
    for (const b of bottles) glow(0x6a5dff, 0.6, b.x, b.y + 0.2, b.z, 0.55);
    api.flora('candle', [{ x: tx - 1.5, y: gy + 0.95, z, yaw: 0, scale: 1 }, { x: tx + 1.5, y: gy + 0.95, z, yaw: 0, scale: 1 }], { shadows: false });
  }

  // ===== Bucket Street and the lean castle, west (DeaqHWJBBPw, DeXn5rSPxR8) =====
  // Purple houses both sides of the street (z = 18), facing it.
  for (const x of [924, 906, 888, 870, 852]) {
    for (const [z, yaw] of [[4, Math.PI / 2], [32, -Math.PI / 2]] as const) {
      api.place(modelLandmark('purple-house', x, z, gy, { yaw: face(yaw), footprints: [{ kind: 'box', x, z, hw: 3.4, hd: 3.4, top: gy + 9 }], onLoad: (m) => restyle(m, (mat) => patchLitWindows(mat, 2.4, new Color(0.75, 0.35, 1.0))) }));
      glow(PALETTE.dusk, 3.5, x, gy + 7.5, z, 0.25);
    }
  }
  const STALLS = [{ x: 915, z: 8.6, yaw: Math.PI / 2 }, { x: 879, z: 27.4, yaw: -Math.PI / 2 }];
  for (const st of STALLS) api.place(modelLandmark('market-stall', st.x, st.z, gy, { yaw: face(st.yaw), footprints: [{ kind: 'box', x: st.x, z: st.z, hw: 1.8, hd: 1.2, top: gy + 1.1 }] }));
  api.place(modelLandmark('crystal-ball', STALLS[0].x - 0.6, STALLS[0].z + 0.3, gy + 1.1, { color: PALETTE.dusk }));
  glow(PALETTE.dusk, 1.6, STALLS[0].x - 0.6, gy + 1.5, STALLS[0].z + 0.3, 0.6);
  const shrooms: Placement[] = [];
  for (let x = 934; x > 842; x -= 7) for (const z of [11, 25]) {
    if (STALLS.some((st) => Math.hypot(st.x - x, st.z - z) < 3)) continue;
    shrooms.push({ x, y: gy, z, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 0.5 });
    glow(PALETTE.dusk, 1.8, x, gy + 2, z, 0.45);
  }
  api.flora('purple-mushroom', shrooms, { shadows: false });
  // (Old Hollowstaff, mid-street, is the diamond-throwing boss now: his diamonds circle him (Enemy orbitGems).)
  // The star brewer's tower at the street's north-west corner (DeQ-NnpvqF6).
  api.place(modelLandmark('round-tower', 872, -26, gy, { yaw: face(Math.PI / 2), footprints: [{ kind: 'cyl', x: 872, z: -26, r: 3.6, top: gy + 22 }] }));
  // The lean castle at the street's west end, its windows burning purple, lean pouring off its front into the moat.
  const C = Q.castle;
  api.place(modelLandmark('castle', C.x, C.z, gy, { yaw: face(0), onLoad: (m) => restyle(m, (mat) => patchLitWindows(mat, 2.6, new Color(0.7, 0.3, 1.0))) }));
  api.place(waterSheet(moat.x, moat.z, moat.w, moat.d, gy - 0.35, [0x1a0640, 0x7a32e0, 0xe0b8ff]));
  // (Swimmable: its bed is 2.2 m down.)
  api.water?.(Q.moat[0], Q.moat[1], Q.moat[2], Q.moat[3], gy - 0.35);
  for (const z of [5, 10.5, 25.5, 31]) api.place(cascade({ x: 815.5, z, top: gy + 15, height: 15.2, width: 2.4, yaw: Math.PI / 2, curve: 1, color: LEAN_FALL }));
  // The bridge to the gate, purple flames at its ends.
  api.place(floorSlab(moat.x, C.z, gy, moat.w + 0.4, 7));
  for (const dz of [-4, 4]) for (const x of [829.4, 814.8]) {
    api.place(modelLandmark('torch-post', x, C.z + dz, gy, { footprints: [{ kind: 'cyl', x, z: C.z + dz, r: 0.25, top: gy + 2.4 }] }));
    api.vfx(fire(x, gy + 2.3, C.z + dz, 0.4, x > 820 ? 8 : 0, PURPLE_FIRE));
  }
  // The carriage drawn up before the bridge (DeXn5rSPxR8), and the gold gem turning over the gate.
  api.place(modelLandmark('carriage', 840, C.z - 6, gy, { yaw: face(Math.PI) }));
  {
    let a = 0;
    const gemY = gy + 21;
    api.place(modelLandmark('gem', 816, C.z, gemY, { scale: 5, collider: 'none', onLoad: (m) => restyle(m, (mat) => { mat.color.setRGB(1, 0.72, 0.18); mat.emissive.setRGB(0.45, 0.28, 0.02); mat.metalness = 0.6; mat.roughness = 0.25; }),
      update: (dt, root) => { a += dt; root.rotation.y = a * 0.6; root.position.y = gemY + Math.sin(a * 0.9) * 0.5; } }));
    if (PRESENT_MODELS.has('gem')) {
      glow(0xffc040, 7, 816, gemY + 1.2, C.z, 0.45);
      glints.add(new Vector3(816, gemY + 1.2, C.z), new Vector3(), 1.4);
    }
  }
  // A purple vortex turning in the sky over the castle, and crystals growing in its yard.
  {
    const vortex = skyVortex(320);
    vortex.position.set(C.x - 160, gy + 150, C.z);
    vortex.lookAt(R.x, gy + 20, R.z);
    api.group.add(vortex);
    const yardCrystals: Placement[] = [];
    for (let i = 0; i < 16; i++) {
      const z = api.rnd() < 0.5 ? -38 + api.rnd() * 32 : 42 + api.rnd() * 30;
      const x = 783 + api.rnd() * 30;
      yardCrystals.push({ x, y: gy, z, yaw: api.rnd() * 6, scale: 1.2 + api.rnd() * 1.8 });
      glow(PALETTE.dusk, 2.6, x, gy + 1.2, z, 0.35);
    }
    api.flora('purple-crystal', yardCrystals, { shadows: false });
  }

  // ===== The snow chapel, south-west (DeldocTvFiB) =====
  api.group.add(mistLayers(snow.x, snow.z, snow.w, snow.d, gy, 0xc8d6ff, 0.16, 2));
  const CH = Q.chapel;
  const gate = { x: 950, z: 86 };
  api.place(modelLandmark('snow-chapel', CH.x, CH.z, gy, { yaw: face(Math.atan2(gate.z - CH.z, gate.x - CH.x)) }));
  // The gate the path comes in by: snow-capped pillars and a broken wooden gate hanging open.
  for (const dx of [-3.5, 3.5]) api.place(modelLandmark('snow-pillar', gate.x + dx, gate.z, gy, { footprints: [{ kind: 'box', x: gate.x + dx, z: gate.z, hw: 0.55, hd: 0.55, top: gy + 2.6 }] }));
  api.place(modelLandmark('broken-gate', gate.x + 5.6, gate.z + 1.8, gy, { yaw: face(Math.PI / 2 + 0.5), collider: 'none' }));
  // The path from the gate to the chapel door, lined with pillars and torches.
  const path: Array<[number, number]> = [];
  for (let k = 0; k <= 10; k++) {
    const t = k / 10;
    path.push([gate.x + (CH.x + 6 - gate.x) * t + Math.sin(t * Math.PI) * 6, gate.z + (CH.z - 10 - gate.z) * t]);
  }
  for (let k = 2; k < path.length - 1; k += 2) {
    const [x, z] = path[k];
    const [nx, nz] = path[k + 1];
    const sx = -(nz - z), sz = nx - x;
    const n = Math.hypot(sx, sz);
    for (const side of [-1, 1]) {
      const px = x + (sx / n) * 3.4 * side, pz = z + (sz / n) * 3.4 * side;
      if (k % 4 === 2) {
        api.place(modelLandmark('torch-post', px, pz, gy, { footprints: [{ kind: 'cyl', x: px, z: pz, r: 0.25, top: gy + 2.4 }] }));
        api.vfx(fire(px, gy + 2.3, pz, 0.35, side > 0 ? 6 : 0));
      } else api.place(modelLandmark('snow-pillar', px, pz, gy, { scale: 0.8, footprints: [{ kind: 'box', x: px, z: pz, hw: 0.45, hd: 0.45, top: gy + 2.1 }] }));
    }
  }
  // Snowed-in cottages along the graveyard's edges, their windows lit (the quarter stood bare but for the chapel).
  const cottages: Array<[number, number, number]> = [[865.5, 100, 0], [865.5, 120, 0], [954.5, 150, Math.PI], [954.5, 168, Math.PI]];
  for (const [hx, hz, yaw] of cottages) {
    api.place(modelLandmark('village-house', hx, hz, gy, { yaw: face(yaw), footprints: [{ kind: 'box', x: hx, z: hz, hw: 3.3, hd: 3.3, top: gy + 6 }],
      onLoad: (m) => restyle(m, (mat) => { mat.color.lerp(new Color(0xdfe8ff), 0.35); patchLitWindows(mat, 2.2); }) }));
    glow(0xffa040, 2, hx + Math.cos(yaw) * 3.6, gy + 2.4, hz, 0.5);
  }
  const clearOfCottages = (x: number, z: number) => cottages.every(([hx, hz]) => Math.hypot(hx - x, hz - z) > 6);
  // Graves in the snow either side of the path, bare black trees round the edges.
  const graveSets: Record<string, Placement[]> = { grave: [], 'rune-grave': [], 'grave-cross': [] };
  const clearOfPath = (x: number, z: number) => path.every(([px, pz]) => Math.hypot(px - x, pz - z) > 5);
  for (let i = 0; i < 160 && graveSets.grave.length + graveSets['rune-grave'].length + graveSets['grave-cross'].length < 36; i++) {
    const x = 866 + api.rnd() * 88, z = 92 + api.rnd() * 78;
    if (!clearOfPath(x, z) || !clearOfCottages(x, z) || Math.hypot(x - CH.x, z - CH.z) < 10 || Math.hypot(x - 931, z - 124) < 7) continue;
    const kind = (['grave', 'rune-grave', 'grave-cross'] as const)[i % 3];
    graveSets[kind].push({ x, y: gy - 0.05, z, yaw: face(Math.atan2(gate.z - z, gate.x - x)) + (api.rnd() - 0.5) * 0.4, scale: 0.8 + api.rnd() * 0.4 });
  }
  for (const [id, ps] of Object.entries(graveSets)) api.flora(id, ps);
  const trees: Placement[] = [];
  for (let i = 0; i < 80 && trees.length < 16; i++) {
    const edge = i % 4;
    const x = edge === 0 ? 863 + api.rnd() * 5 : edge === 1 ? 952 + api.rnd() * 5 : 866 + api.rnd() * 86;
    const z = edge === 2 ? 170 + api.rnd() * 3 : 95 + api.rnd() * 75;
    if (!clearOfPath(x, z) || !clearOfCottages(x, z) || Math.hypot(x - CH.x, z - CH.z) < 9) continue;
    trees.push({ x, y: gy - 0.1, z, yaw: api.rnd() * 6, scale: 0.8 + api.rnd() * 0.5 });
  }
  api.flora('dead-forest-tree', trees);
  for (const t of trees) api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: t.x, z: t.z, r: 0.35 * t.scale, top: gy + 6 }] });
  // The crypt bar is below, through the chapel's door (Interiors.ts): candlelight from the stair.
  glow(0xffa040, 3.2, CHAPEL_DOOR.x, gy + 1.4, CHAPEL_DOOR.z, 0.35);
  // The plague doctor on his treasure chest among the trees (one model with the chest, NPCs.ts): the chest is solid.
  api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: 931, z: 124.6, r: 1.15, top: gy + 1.3 }] });
  glow(0xffa040, 2.2, 929.6, gy + 1.8, 123, 0.5);
  glow(0xffa040, 2.2, 932.4, gy + 1.8, 125, 0.5);

  // ===== The sky dock, east (Den1ausBXai, DeYtKbMh76x) =====
  const D = Q.dock;
  const dockScale = 2.4;
  const dockBase = gy - MODELS['floating-island'].height * dockScale * ISLAND_TOP;
  // (Its model carries a giant dead tree: cut away above the floor, so the dock is open ground like the reel's, and a
  // tree of ordinary size stands at the back instead.)
  api.place(modelLandmark('floating-island', D.x, D.z, dockBase, { scale: dockScale, collider: 'manual', footprints: [{ kind: 'cyl', x: D.x, z: D.z, r: D.r, top: gy }], yaw: 0.6,
    onLoad: (m) => restyle(m, (mat) => clipAbove(mat, gy - 0.02)) }));
  if (PRESENT_MODELS.has('floating-island')) api.group.add(rockTop(D.x, D.z, D.r + 0.3, gy));
  api.place(modelLandmark('dead-forest-tree', D.x + 1, D.z + 9.8, gy, { scale: 1.2, yaw: 2.2 }));
  // Its underside glows through the cracks.
  for (let i = 0; i < 4; i++) glow(0xff6a20, 6, D.x + (api.rnd() - 0.5) * 8, dockBase + 4 + i * 3, D.z + (api.rnd() - 0.5) * 8, 0.18);
  // Grillmaw the black dragon lounging at the island's far side, Sir Velvet sipping beside him (NPCs.ts).
  {
    const dx = D.x + 6, dz = D.z + 3;
    let t = 0;
    const drips: Array<{ s: ReturnType<typeof glowSprite>; v: number; age: number }> = [];
    for (let i = 0; i < 10; i++) { const s = glowSprite(LEAN, 0.16, 0.9, true); s.visible = false; fx.add(s); drips.push({ s, v: 0, age: 0 }); }
    const mouth = new Vector3();
    let dripIn = 0;
    api.place(modelLandmark('lean-dragon', dx, dz, gy, { yaw: face(Math.PI * 0.9), footprints: [{ kind: 'cyl', x: dx, z: dz, r: 3.2, top: gy + 2.6 }],
      update: (dt, root, m) => {
        t += dt;
        // A slow breath, and lean dripping from his jaws (the reel's dragon drinks with a cup pressed to his teeth).
        root.scale.setScalar(1 + Math.sin(t * 0.9) * 0.008);
        if (!m) return;
        dripIn -= dt;
        root.updateWorldMatrix(true, false);
        if (dripIn <= 0) {
          dripIn = 0.25 + Math.random() * 0.5;
          const d = drips.find((x) => !x.s.visible);
          if (d) { root.localToWorld(mouth.set((Math.random() - 0.5) * 0.3, MODELS['lean-dragon'].height * 0.55, MODELS['lean-dragon'].height * 0.95)); d.s.position.copy(mouth); d.v = 0; d.age = 0; d.s.visible = true; }
        }
        for (const d of drips) { if (!d.s.visible) continue; d.age += dt; d.v -= 9.8 * dt; d.s.position.y += d.v * dt; if (d.age > 0.8 || d.s.position.y < gy) d.s.visible = false; }
      } }));
    glints.add(new Vector3(dx - 2.4, gy + 2.3, dz - 0.4), new Vector3(), 0.4);
  }
  // The sky bar: a booth on chains at the island's near side. It is shut (its window is part of the model), so Old Ribs
  // (NPCs.ts) serves at its front, north-west, over a table of cups with ice.
  api.place(modelLandmark('sky-bar', D.x - 5, D.z - 4, gy, { yaw: face(Math.PI * 0.75) }));
  {
    const tx = D.x - 7.8, tz = D.z - 1.1, ang = -Math.PI / 4;
    api.flora('tavern-table', [{ x: tx, y: gy, z: tz, yaw: ang, scale: 1 }]);
    // (A box turns the other way from a model's yaw: its local x runs along (cos rotY, sin rotY).)
    api.place({ object: new Group(), footprints: [{ kind: 'box', x: tx, z: tz, hw: 1.6, hd: 0.6, top: gy + 0.95, rotY: -ang }] });
    // Along the table's length (its local x, turned by `ang`).
    const along = (k: number) => ({ x: tx + Math.cos(ang) * k, z: tz - Math.sin(ang) * k });
    api.flora('lean-cup', [-0.6, 0, 0.6].map((k) => ({ ...along(k), y: gy + 0.97, yaw: 0, scale: 1 })), { shadows: false });
    api.flora('gem', [-1.1, -0.3, 1.0].map((k) => ({ ...along(k), y: gy + 0.97, yaw: api.rnd() * 6, scale: 0.18 })), { shadows: false });
  }
  // Gothic lamps round the dock's rim.
  const lamps: Placement[] = [];
  for (let i = 0; i < 5; i++) { const a = -2.4 + i * 1.1; lamps.push({ x: D.x + Math.cos(a) * (D.r - 1.2), y: gy, z: D.z + Math.sin(a) * (D.r - 1.2), yaw: api.rnd() * 6, scale: 1 }); }
  api.flora('gothic-lamp', lamps);
  for (const l of lamps) { api.place({ object: new Group(), footprints: [{ kind: 'cyl', x: l.x, z: l.z, r: 0.25, top: gy + 3.2 }] }); glow(0xffb050, 1.6, l.x, gy + 2.9, l.z, 0.55); }
  // Two more islands in the sky: one with lamps and a dead tree, one carrying a tower with a giant cup on top.
  {
    const x = 1218, z = -42, base = gy + 8;
    let a = Math.random() * 6;
    api.place(modelLandmark('floating-island', x, z, base, { scale: 1.2, collider: 'none', update: (dt, root) => { a += dt; root.position.y = base + Math.sin(a * 0.4) * 0.8; } }));
    glow(0xff6a20, 5, x, base + 2, z, 0.2);
  }
  {
    // Still (a bobbing island would slide through its tower), and without its tree (the tower stands where it grew).
    const ix = 1150, iz = -64, base = gy - 8;
    const top = base + MODELS['floating-island'].height * 1.4 * ISLAND_TOP;
    api.place(modelLandmark('floating-island', ix, iz, base, { scale: 1.4, collider: 'none', onLoad: (m) => restyle(m, (mat) => clipAbove(mat, top - 0.02)) }));
    if (PRESENT_MODELS.has('floating-island')) api.group.add(rockTop(ix, iz, 8, top));
    glow(0xff6a20, 5, ix, base + 2, iz, 0.2);
    api.place(modelLandmark('round-tower', ix, iz, top, { collider: 'none' }));
    // The cup rests on the tower's roof: its base ring (1.7 m across the radius) meets the cone 85% of the way up, and
    // the spire's tip ends inside the cup.
    const cupH = 7;
    const cupBase = top + MODELS['round-tower'].height * 0.85;
    api.place(modelLandmark('lean-cup', ix, iz, cupBase, { scale: cupH / MODELS['lean-cup'].height, collider: 'none' }));
    glow(LEAN, 12, ix, cupBase + cupH, iz, 0.35);
    api.place(cascade({ x: ix + 2.2, z: iz, top: cupBase + cupH * 0.9, height: 16, width: 1.4, yaw: Math.PI / 2, curve: 0.8, color: LEAN_FALL }));
  }

  // ===== The sky: a ringed planet in a pink nebula, meteors (DeOemU1BOZF) =====
  {
    const planet = ringedPlanet(46);
    planet.position.set(R.x - 260, gy + 190, R.z - 400);
    planet.lookAt(R.x, gy, R.z);
    api.group.add(planet);
    const m = meteors(new Vector3(R.x, gy, R.z), 280, 140);
    fx.add(m.group);
    updates.push((dt) => m.update(dt));
  }

  api.realm(null);
  return { interactables };
}

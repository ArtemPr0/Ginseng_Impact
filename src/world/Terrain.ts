/**
 * The island's ground. `terrainHeight` is the island's pure analytic sculpt (the plateau, its rolling hills, the river
 * and the eye, the pools, the peak, the gorge, the hamlet knoll, the rim lip, the level pads, the cliff into the
 * abyss); `Terrain` bakes it into a Heightfield (render/Ground.ts) once at startup, with the twelve ground layers and
 * the far tint per vertex, and draws it as a ChunkedGround under the splat material. `heightAt` is then exactly the
 * drawn surface (the triangle under the point), `slopeAt` its gradient; beyond the baked square the analytic sculpt
 * answers (the abyss, and the realms' far-off floors, which read it as "no island here").
 */
import { Color, type Group, type Vector3 } from 'three';
import { ChunkedGround, Heightfield, LAYER, type Sculpt } from '../render/Ground';
import { groundMaterial } from '../render/GroundMaterial';
import { Noise2D, lerp, smoothstep } from './noise';
import { FLATS, KNOLL, LAYOUT, PADS, VILLAGE } from '../data/world';

/** World layout constants (metres). The island is centred at ISLAND_CENTRE; the causeway runs along x = 0. */
export const WORLD = {
  size: 360,
  segments: 200,
  islandCentre: { x: 0, z: -36 },
  islandRadius: 124,
  cliffWidth: 18,
  abyssY: -90,
  cloudSeaY: -26,
  chasmCentreZ: -57,
  chasmHalfWidth: 15,
  corridorZ: { min: -123, max: 69 },
  /** Glowing green stream ravine (witch bridge) along x ≈ streamX. */
  streamX: -67,
  streamZ: { min: -42, max: 48 },
  /** Climbable peak for the lone-knight vantage. */
  peak: { x: -54, z: -93, height: 58, radius: 36 },
  /** Frozen realm: north-east quadrant. */
  frozen: { xFrom: 24, xTo: 57, zFrom: -12, zTo: -42 },
  desert: { x: 48, z: 60, r: 24 },
  dead: { x: 24, z: -102, r: 20 },
  pond: { x: -18, z: -18, r: 12 },
  /**
   * The forest gorge (01.16.36) cut north-west at the old troll gorge: its head under the peak's flank (a waterfall),
   * its floor falling to the island's cliff at the mouth, a stone bridge across at z = -124.
   */
  gorge: { x: -64, zHead: -106, zMouth: -146, floorHead: 1, floorMouth: -12, half: 5, rim: 12 },
} as const;

/**
 * The eye-shaped vortex pool (#28) where the river meets the road from the spawn: an ellipse, `a` half its length
 * (east–west, along the river) and `b` half its width.
 */
export const EYE = { x: 0, z: 15, a: 22, b: 14 } as const;

/** Signed distance to the eye pool's outline in metres (negative inside; exact on the axes, close elsewhere). */
export function eyeDistance(x: number, z: number): number {
  const u = (x - EYE.x) / EYE.a;
  const v = (z - EYE.z) / EYE.b;
  const k = Math.hypot(u, v);
  if (k < 1e-6) return -Math.min(EYE.a, EYE.b);
  // Scale the normalised distance by the local radius toward this point.
  const rx = (u / k) * EYE.a;
  const rz = (v / k) * EYE.b;
  return (k - 1) * Math.hypot(rx, rz);
}

/** The great river: polyline in world xz, flowing west. */
export const RIVER: ReadonlyArray<readonly [number, number]> = [
  [129, 4], [102, 13], [77, -2], [50, 4], [26, 10], [4, 16], [-18, 13], [-40, 4], [-58, 12], [-74, 20],
];
export const RIVER_LEVEL = 0.9;
export const RIVER_FLOOR = -1.6;

/** Distance from (x, z) to the nearest segment of a polyline (or of several). */
function polylineDistance(x: number, z: number, lines: ReadonlyArray<ReadonlyArray<readonly [number, number]>>): number {
  let best = Infinity;
  for (const line of lines) {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      let t = ((x - ax) * dx + (z - az) * dz) / l2;
      t = Math.max(0, Math.min(1, t));
      const ex = x - (ax + dx * t);
      const ez = z - (az + dz * t);
      const d2 = ex * ex + ez * ez;
      if (d2 < best) best = d2;
    }
  }
  return Math.sqrt(best);
}

/** Distance from a point to the river centre line. */
export function riverDistance(x: number, z: number): number {
  return polylineDistance(x, z, [RIVER]);
}

/** 0..1 inside the water channel. */
export function riverAt(x: number, z: number): number {
  const channel = 1 - smoothstep(4.8, 9.5, riverDistance(x, z));
  if (Math.abs(x - EYE.x) > EYE.a + 4 || Math.abs(z - EYE.z) > EYE.b + 4) return channel;
  return Math.max(channel, 1 - smoothstep(-3, 1, eyeDistance(x, z)));
}

/** 0..1 inside one of the koi pools (LAYOUT.tiers); its water level, if any. */
export function tierAt(x: number, z: number): { wet: number; water: number } {
  for (const t of LAYOUT.tiers) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d < t.r + 1) return { wet: 1 - smoothstep(t.r - 1.5, t.r + 0.5, d), water: t.water };
  }
  return { wet: 0, water: 0 };
}

/** Distance to the nearest footpath centre line (LAYOUT.paths). */
export function pathDistance(x: number, z: number): number {
  return polylineDistance(x, z, LAYOUT.paths);
}

/** 0..1 on a worn footpath (LAYOUT.paths): about 2.4 m wide with soft edges. */
export function pathAt(x: number, z: number): number {
  return 1 - smoothstep(0.9, 2.1, pathDistance(x, z));
}

/** 0..1 desert dunes (south-east). */
export function sandAt(x: number, z: number): number {
  return 1 - smoothstep(WORLD.desert.r - 14, WORLD.desert.r + 6, Math.hypot(x - WORLD.desert.x, z - WORLD.desert.z));
}

/** 0..1 the dead forest's red-purple floor (north-west). */
export function deadAt(x: number, z: number): number {
  return 1 - smoothstep(WORLD.dead.r - 12, WORLD.dead.r + 6, Math.hypot(x - WORLD.dead.x, z - WORLD.dead.z));
}

/** 0..1 how frozen a point is. */
export function frozenAt(x: number, z: number): number {
  return smoothstep(WORLD.frozen.xFrom, WORLD.frozen.xTo, x) * smoothstep(WORLD.frozen.zFrom, WORLD.frozen.zTo, z);
}

/** The witch stream's centre line at `z` (it winds a little). */
export function streamCentre(z: number, noise: Noise2D): number {
  return WORLD.streamX + noise.noise(z * 0.02, 7) * 6;
}

/** 0..1 inside the stream channel. */
export function streamAt(x: number, z: number, noise: Noise2D): number {
  const band = smoothstep(WORLD.streamZ.min - 10, WORLD.streamZ.min, z) * (1 - smoothstep(WORLD.streamZ.max, WORLD.streamZ.max + 10, z));
  return (1 - smoothstep(3.5, 7, Math.abs(x - streamCentre(z, noise)))) * band;
}

const CORRIDOR_FADE = 12;

/** Distance from (x, z) to a rectangle [x0, x1, z0, z1] (0 inside). */
function rectDistance(x: number, z: number, r: readonly [number, number, number, number]): number {
  const dx = Math.max(r[0] - x, 0, x - r[1]);
  const dz = Math.max(r[2] - z, 0, z - r[3]);
  return Math.hypot(dx, dz);
}

/** The causeway corridor's reach along z (1 inside WORLD.corridorZ, fading out over CORRIDOR_FADE past each end). */
function corridorEnds(z: number): number {
  if (z <= WORLD.corridorZ.min - CORRIDOR_FADE || z >= WORLD.corridorZ.max + CORRIDOR_FADE) return 0;
  return smoothstep(WORLD.corridorZ.min - CORRIDOR_FADE, WORLD.corridorZ.min, z) * (1 - smoothstep(WORLD.corridorZ.max, WORLD.corridorZ.max + CORRIDOR_FADE, z));
}

/**
 * 1 where the ground must stay as the base sculpt makes it (the level pads and their blends, the footpaths, the
 * river, the eye, the pools, the pond and the stream, the causeway corridor, the village and hamlet rectangles and
 * every FLATS disc), 0 in open ground, blending over 10-15 m: the rolling hills and the rim lip are scaled by its
 * complement.
 */
export function flatMask(x: number, z: number, noise: Noise2D): number {
  const B = FLATS.blend;
  let f = 0;
  for (const p of PADS) {
    const edge = p.r + p.blend;
    const d = Math.hypot(x - p.x, z - p.z);
    if (d < edge + B) f = Math.max(f, 1 - smoothstep(edge, edge + B, d));
    if (f >= 1) return 1;
  }
  f = Math.max(f, 1 - smoothstep(2.1, 9, pathDistance(x, z)));
  if (f >= 1) return 1;
  f = Math.max(f, 1 - smoothstep(14, 22, riverDistance(x, z)));
  if (f >= 1) return 1;
  if (Math.abs(x - EYE.x) < EYE.a + 20 && Math.abs(z - EYE.z) < EYE.b + 20) f = Math.max(f, 1 - smoothstep(4, 16, eyeDistance(x, z)));
  for (const t of LAYOUT.tiers) f = Math.max(f, 1 - smoothstep(t.r + 4, t.r + 14, Math.hypot(x - t.x, z - t.z)));
  f = Math.max(f, 1 - smoothstep(WORLD.pond.r + 8, WORLD.pond.r + 18, Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z)));
  f = Math.max(f, (1 - smoothstep(14, 26, Math.abs(x))) * corridorEnds(z));
  if (f >= 1) return 1;
  if (z > WORLD.streamZ.min - 20 && z < WORLD.streamZ.max + 20) {
    const band = smoothstep(WORLD.streamZ.min - 20, WORLD.streamZ.min - 8, z) * (1 - smoothstep(WORLD.streamZ.max + 8, WORLD.streamZ.max + 20, z));
    f = Math.max(f, (1 - smoothstep(7, 18, Math.abs(x - streamCentre(z, noise)))) * band);
  }
  for (const r of FLATS.rects) f = Math.max(f, 1 - smoothstep(0, B, rectDistance(x, z, r)));
  if (f >= 1) return 1;
  for (const c of FLATS.discs) {
    const d = Math.hypot(x - c.x, z - c.z);
    if (d < c.r + B) f = Math.max(f, 1 - smoothstep(c.r, c.r + B, d));
    if (f >= 1) return 1;
  }
  return f;
}

/** The rolling hills of the open ground (metres, roughly ±4.5): two octave bands, long swells and a finer ripple. */
export function hillsAt(x: number, z: number, noise: Noise2D): number {
  return noise.fbm(x * 0.018 + 31, z * 0.018 + 31, 3) * 4.5 + noise.fbm(x * 0.045, z * 0.045, 2) * 0.9;
}

/** The island's radius term at (x, z): distance from the centre plus the coastline's wobble (the cliff begins past WORLD.islandRadius). */
export function islandRadius(x: number, z: number, noise: Noise2D): number {
  const dx = x - WORLD.islandCentre.x;
  const dz = z - WORLD.islandCentre.z;
  return Math.hypot(dx, dz) + noise.fbm(x * 0.0134 + 9, z * 0.0134 + 9, 3) * 18;
}

/** The rock rim at the island's edge: +1.2 m rising from radius 110 to 118 and gone by 124, where the cliff falls. */
export function rimLip(r: number): number {
  return 1.2 * smoothstep(110, 118, r) * (1 - smoothstep(120, 124, r));
}

/**
 * The hamlet knoll's rise in metres at (x, z) (KNOLL): a disc blended at its edge, with a landing notch at the eye
 * bridge's north end from which the terrace climbs over `face` metres with two sharp risers, so the road from the
 * bridge goes up steps and the bridge keeps level banks at both ends.
 */
export function knollAt(x: number, z: number): number {
  const K = KNOLL;
  const d = Math.hypot(x - K.x, z - K.z);
  if (d >= K.r + K.blend) return 0;
  const env = 1 - smoothstep(K.r, K.r + K.blend, d);
  const L = K.landing;
  const s = Math.hypot(x - L.x, z - L.z);
  let rise = (K.rise - K.risers.length * K.riser) * smoothstep(L.r, L.r + L.face, s);
  for (const at of K.risers) rise += K.riser * smoothstep(at - K.riserRun, at + K.riserRun, s);
  return env * rise;
}

/**
 * Pure height function. Plateau island with a wobbly cliff edge and a chasm band across it. With `relief` (the game;
 * off only to compare against the bare sculpt) the open ground rolls in hills, the hamlet stands on its knoll and the
 * rim carries a rock lip; the gorge, the peak, the chasm, the river, the stream and the cliff carve exactly as they
 * always did, and the level pads win last.
 */
export function terrainHeight(x: number, z: number, noise: Noise2D, relief = true): number {
  const nx = x * 0.0067;
  const nz = z * 0.0067;
  const rolling = noise.fbm(nx, nz, 4) * 7;
  const detail = noise.noise(x * 0.03, z * 0.03) * 0.8;
  const r = islandRadius(x, z, noise);
  const island = smoothstep(WORLD.islandRadius + WORLD.cliffWidth, WORLD.islandRadius, r);
  const chasmCentre = WORLD.chasmCentreZ + noise.noise(x * 0.017, 3) * 6;
  const chasm = 1 - smoothstep(WORLD.chasmHalfWidth - 6, WORLD.chasmHalfWidth + 8, Math.abs(z - chasmCentre));
  const land = island * (1 - chasm);
  let plateau = 3 + rolling + detail;
  // Hills in the open ground and the rock lip along the rim, both off wherever the ground must stay level. They join
  // the base plateau here so that everything carved below (the corridor, the river, the pools, the gorge, the pads)
  // dominates them exactly as it dominated the old rolling.
  if (relief) {
    const flat = flatMask(x, z, noise);
    if (flat < 1) plateau += (1 - flat) * (hillsAt(x, z, noise) + rimLip(r));
  }
  // Flatten a corridor under the causeway so the raised road always sits above the ground. It fades out over
  // CORRIDOR_FADE past each end (it used to stop dead: a 3.6 m wall behind the north stairs, a 2.5 m step behind the spawn).
  const ends = corridorEnds(z);
  if (ends > 0) {
    const corridor = (1 - smoothstep(6, 14, Math.abs(x))) * ends;
    plateau = lerp(plateau, 3.2, corridor);
  }
  // Stream ravine.
  plateau -= 3.2 * streamAt(x, z, noise);
  // The hamlet knoll (after the corridor, which would flatten it under the causeway stairs; before the river and the
  // eye, whose beds and banks are carved into it).
  if (relief) plateau += knollAt(x, z);
  // The great river: raised banks, flat floor below the water line.
  const rd = riverDistance(x, z);
  if (rd < 18) {
    const bank = Math.max(plateau, 2.6);
    const bankMix = 1 - smoothstep(9.5, 18, rd);
    plateau = lerp(plateau, bank, bankMix);
    plateau = lerp(plateau, RIVER_FLOOR, 1 - smoothstep(4.8, 9.5, rd));
  }
  // The eye pool: banks raised around the lens, the floor funnelling down to the pupil.
  if (Math.abs(x - EYE.x) < EYE.a + 12 && Math.abs(z - EYE.z) < EYE.b + 12) {
    const ed = eyeDistance(x, z);
    if (ed < 12) {
      // Banks around the pool, but not across the river channel where it flows in and out at the tips.
      const channel = 1 - smoothstep(4.8, 9.5, rd);
      plateau = lerp(plateau, Math.max(plateau, 2.6), (1 - smoothstep(2, 12, ed)) * (1 - channel));
      const inside = 1 - smoothstep(-3, 1, ed);
      if (inside > 0) {
        const r = Math.hypot(x - EYE.x, z - EYE.z);
        plateau = lerp(plateau, lerp(-4, RIVER_FLOOR, smoothstep(3, 12, r)), inside);
      }
    }
  }
  // Koi pools stepping down to the eye: a stone rim a little above each pool's water, a basin under it.
  for (const t of LAYOUT.tiers) {
    const d = Math.hypot(x - t.x, z - t.z);
    if (d > t.r + 4) continue;
    plateau = lerp(plateau, Math.max(plateau, t.water + 0.5), 1 - smoothstep(t.r + 1, t.r + 4, d));
    plateau = lerp(plateau, t.water - 0.8, 1 - smoothstep(t.r - 1.5, t.r + 0.5, d));
  }
  // Lily pond: a shallow bowl.
  const pd0 = Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z);
  if (pd0 < WORLD.pond.r + 8) {
    const bowl = 1 - smoothstep(WORLD.pond.r - 3, WORLD.pond.r + 8, pd0);
    plateau = lerp(Math.max(plateau, 2.4), 0.2, bowl);
  }
  // Desert dunes.
  const sand = sandAt(x, z);
  if (sand > 0) plateau += sand * (2.2 * Math.abs(Math.sin(x * 0.08 + noise.noise(x * 0.01, z * 0.01) * 3 + z * 0.03)) + noise.fbm(x * 0.03 + 9, z * 0.03, 2) * 1.2);
  // The peak.
  const pd = Math.hypot(x - WORLD.peak.x, z - WORLD.peak.z);
  if (pd < WORLD.peak.radius) {
    const t = 1 - pd / WORLD.peak.radius;
    plateau += WORLD.peak.height * Math.pow(t, 1.7) + noise.fbm(x * 0.05, z * 0.05, 3) * 6 * t;
  }
  // The forest gorge: a steep cut whose floor falls from the head (under the peak) to the cliff at its mouth, with a
  // ramp up its west wall so nobody is trapped on the floor.
  const G = WORLD.gorge;
  if (z < G.zHead + 6 && z > G.zMouth - 30 && Math.abs(x - G.x) < G.rim + 14) {
    const cx = G.x + noise.noise(z * 0.05, 11) * 2;
    const along = Math.min(1, Math.max(0, (G.zHead - z) / (G.zHead - G.zMouth)));
    const floor = lerp(G.floorHead, G.floorMouth, along);
    const head = smoothstep(G.zHead + 3, G.zHead - 3, z);
    const dx = Math.abs(x - cx);
    // Ridges along both rims, so the gorge is deep from either side (its west side was low ground by the cliff).
    const ridgeTop = lerp(13, 6, along) + noise.noise(z * 0.08, x * 0.08) * 1.5;
    plateau = Math.max(plateau, lerp(plateau, ridgeTop, head * smoothstep(G.half, G.rim, dx) * (1 - smoothstep(G.rim + 2, G.rim + 11, dx))));
    const cut = head * (1 - smoothstep(G.half, G.rim, dx));
    const before = plateau;
    plateau = lerp(plateau, Math.min(plateau, floor), cut);
    // Exit ramp: from the floor at (-77, -114) up to the west rim at (-86, -106).
    const ax = G.x - 5, az = -114, bx = G.x - 14, bz = -106;
    const rx = bx - ax, rz = bz - az;
    const tt = Math.max(0, Math.min(1, ((x - ax) * rx + (z - az) * rz) / (rx * rx + rz * rz)));
    const rd = Math.hypot(x - (ax + rx * tt), z - (az + rz * tt));
    if (rd < 3.5) {
      const floorAtStart = lerp(G.floorHead, G.floorMouth, (G.zHead - az) / (G.zHead - G.zMouth));
      const ramp = lerp(floorAtStart, before, tt);
      plateau = lerp(plateau, Math.max(plateau, ramp), 1 - smoothstep(2, 3.5, rd));
    }
  }
  // Level pads for buildings and big creatures (always land inside).
  let padLand = 0;
  for (const p of PADS) {
    const dd = Math.hypot(x - p.x, z - p.z);
    if (dd >= p.r + p.blend) continue;
    const t = 1 - smoothstep(p.r, p.r + p.blend, dd);
    plateau = lerp(plateau, p.y, t);
    if (p.solid) padLand = Math.max(padLand, t);
  }
  return lerp(WORLD.abyssY, plateau, Math.max(land, padLand));
}

// ---- The island's surface: layer weights and the far tint ----

/** The spawn road's flagstones: from the spawn to the eye bridge, two stones abreast (Heart.ts), 3 m wide. */
const SPAWN_ROAD: ReadonlyArray<readonly [number, number]> = [[0, 58], [0, 32]];
/** The village street: cobbles in a 6 m band along z = VILLAGE.z between the two rows of houses. */
const STREET = { x0: VILLAGE.x - 30, x1: VILLAGE.x + 30, half: 3 } as const;

/** Distance from (x, z) to the nearest water's edge: the river channel, the eye, the pools, the pond and the stream. */
export function waterDistance(x: number, z: number, noise: Noise2D): number {
  let d = Math.max(0, riverDistance(x, z) - 6);
  if (Math.abs(x - EYE.x) < EYE.a + 12 && Math.abs(z - EYE.z) < EYE.b + 12) d = Math.min(d, Math.max(0, eyeDistance(x, z)));
  for (const t of LAYOUT.tiers) d = Math.min(d, Math.max(0, Math.hypot(x - t.x, z - t.z) - t.r));
  d = Math.min(d, Math.max(0, Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z) - WORLD.pond.r));
  if (z > WORLD.streamZ.min - 6 && z < WORLD.streamZ.max + 6) d = Math.min(d, Math.max(0, Math.abs(x - streamCentre(z, noise)) - 3.5));
  return d;
}

/** Paints layer `k` over the texture mix in `out` at weight `w` (what was there keeps 1 - w). */
function paint(out: Float32Array, k: number, w: number): void {
  if (w <= 0) return;
  if (w > 1) w = 1;
  for (let i = 0; i < LAYER.wet; i++) out[i] *= 1 - w;
  out[k] += w;
}

/**
 * The island as a Sculpt: the 360 m square at 1 m cells, `terrainHeight` for the height, the masks for the layers, the
 * old vertex colours for the tint (the island's cobalt night near and far; up close the layers lend it their pattern).
 */
export function islandSculpt(noise: Noise2D): Sculpt {
  const ground = new Color(0x121d48);
  const moss = new Color(0x163a33);
  const stone = new Color(0x3d4a80);
  const snow = new Color(0x9fb3e6);
  const streamBed = new Color(0x1a3a3a);
  const riverBed = new Color(0x0c1a4a);
  const sandColor = new Color(0xa9b2cf);
  const deadA = new Color(0x4a1430);
  const deadB = new Color(0x6a2a3c);
  const pathColor = new Color(0x34426f);
  const meadowAt = (x: number, z: number) => smoothstep(-0.2, 0.5, noise.fbm(x * 0.012 + 50, z * 0.012 + 50, 3));
  return {
    x0: -WORLD.size / 2,
    z0: -WORLD.size / 2,
    size: WORLD.size,
    cell: 1,
    voidBelow: WORLD.abyssY + 1,
    height: (x, z) => terrainHeight(x, z, noise),
    layers: (x, z, _h, slope, out) => {
      const steep = smoothstep(0.45, 0.8, slope);
      const river = riverAt(x, z);
      const stream = streamAt(x, z, noise);
      const path = pathAt(x, z);
      const fray = noise.fbm(x * 0.3 + 5, z * 0.3 + 5, 2);
      out[LAYER.grass] = 1;
      paint(out, LAYER.moss, meadowAt(x, z) * 0.75 * (1 - slope));
      // Rock on steep ground and along the cliff band (the lip and the face below it).
      paint(out, LAYER.rock, Math.max(steep, smoothstep(112, 124, islandRadius(x, z, noise))));
      paint(out, LAYER.snow, frozenAt(x, z) * (1 - smoothstep(0.5, 0.9, slope)));
      paint(out, LAYER.sand, sandAt(x, z));
      paint(out, LAYER.dead, deadAt(x, z));
      // Worn earth on the footpaths (not through water, not up a cliff).
      paint(out, LAYER.soil, path * (1 - river) * (1 - smoothstep(0.4, 0.8, slope)));
      // Cobbles along the village street, their edge frayed into the grass.
      if (x > STREET.x0 - 6 && x < STREET.x1 + 6 && Math.abs(z - VILLAGE.z) < STREET.half + 4) {
        const edge = STREET.half + fray * 1.2;
        const along = smoothstep(STREET.x0 - 3, STREET.x0 + 2, x + fray * 2) * (1 - smoothstep(STREET.x1 - 2, STREET.x1 + 3, x + fray * 2));
        paint(out, LAYER.cobble, (1 - smoothstep(edge - 0.6, edge + 0.6, Math.abs(z - VILLAGE.z))) * along);
      }
      // Flagstones on the spawn road and on the hamlet knoll's top (its steps and its core), frayed at the edges.
      let flag = 1 - smoothstep(1.1, 1.9, polylineDistance(x, z, [SPAWN_ROAD]) + fray * 0.4);
      const kd = Math.hypot(x - KNOLL.x, z - KNOLL.z);
      if (kd < KNOLL.r + KNOLL.blend) {
        const top = smoothstep(0.75, 0.97, knollAt(x, z) / KNOLL.rise);
        const ks = Math.hypot(x - KNOLL.landing.x, z - KNOLL.landing.z);
        const core = 1 - smoothstep(10, 14, kd + fray * 2.5);
        const steps = (1 - smoothstep(9.5, 12, ks + fray * 1.5)) * smoothstep(KNOLL.landing.r - 0.5, KNOLL.landing.r + 0.5, ks);
        flag = Math.max(flag, Math.max(top * core, steps) * (1 - river));
      }
      paint(out, LAYER.flagstone, flag);
      // Beds under the water: the river and the eye, the stream, the pools, the pond.
      const pond = 1 - smoothstep(WORLD.pond.r - 1, WORLD.pond.r + 1, Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z));
      paint(out, LAYER.seabed, Math.max(river, stream, tierAt(x, z).wet, pond));
      out[LAYER.wet] = 1 - smoothstep(0, 3, waterDistance(x, z, noise));
    },
    tint: (x, z, _h, slope, out) => {
      // The old vertex-colour pass, so the ground keeps the colours the island always had, near and far.
      const c = out.copy(ground);
      c.lerp(moss, meadowAt(x, z) * 0.75 * (1 - slope));
      c.lerp(stone, smoothstep(0.3, 0.85, slope));
      c.lerp(snow, frozenAt(x, z) * (1 - smoothstep(0.5, 0.9, slope)) * 0.85);
      c.lerp(streamBed, streamAt(x, z, noise) * 0.8);
      const river = riverAt(x, z);
      c.lerp(riverBed, river * 0.85);
      c.lerp(sandColor, sandAt(x, z) * 0.9);
      const dead = deadAt(x, z);
      if (dead > 0) c.lerp(noise.noise(x * 0.09, z * 0.09) > 0 ? deadA : deadB, dead * 0.85);
      if (Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z) < WORLD.pond.r) c.lerp(riverBed, 0.7);
      c.lerp(pathColor, pathAt(x, z) * (1 - river) * (1 - smoothstep(0.4, 0.8, slope)) * 0.8);
      c.multiplyScalar(1 + noise.noise(x * 0.2, z * 0.2) * 0.08);
    },
  };
}

export class Terrain {
  /** The baked island: exact heights, slopes and normals of the drawn ground. */
  readonly field: Heightfield;
  private ground: ChunkedGround | null = null;
  private readonly noise: Noise2D;

  /** The witch stream's centre line at `z`. */
  streamCentre(z: number): number {
    return streamCentre(z, this.noise);
  }

  constructor(seed = 1337) {
    this.noise = new Noise2D(seed);
    this.field = new Heightfield(islandSculpt(this.noise));
    const t0 = performance.now();
    this.field.bake();
    console.info(`terrain: island heightfield baked, ${this.field.n + 1}² vertices in ${(performance.now() - t0).toFixed(0)} ms`);
  }

  /**
   * The ground's chunk meshes (one group; add it to the scene). Built on first use so that the field can be queried
   * without a renderer (the tests, the minimap bake).
   */
  get group(): Group {
    return this.chunks().group;
  }

  /** The old name of the ground object: readers of `terrain.mesh` get the chunk group. */
  get mesh(): Group {
    return this.group;
  }

  private chunks(): ChunkedGround {
    if (!this.ground) this.ground = new ChunkedGround(this.field, groundMaterial(), { chunk: 32, lod: [64, 160], castShadowNear: true });
    return this.ground;
  }

  /** Once a frame: picks each chunk's level of detail by its distance from `focus` (the camera). */
  update(focus: Vector3): void {
    this.ground?.update(focus);
  }

  /** Height of the drawn ground at (x, z); beyond the baked square, the analytic sculpt (the abyss). */
  heightAt(x: number, z: number): number {
    if (this.field.contains(x, z)) return this.field.heightAt(x, z);
    return terrainHeight(x, z, this.noise);
  }

  /** slopeAt sampled once per metre and remembered (vegetation placement asks for the same spots over and over). */
  slopeAtCached(x: number, z: number): number {
    const N = 400;
    const i = Math.round(x) + 200;
    const k = Math.round(z) + 200 + 36;
    if (i < 0 || k < 0 || i >= N || k >= N) return this.slopeAt(x, z);
    const c = k * N + i;
    let v = this.slopeCache[c];
    if (Number.isNaN(v)) v = this.slopeCache[c] = this.slopeAt(Math.round(x), Math.round(z));
    return v;
  }
  private readonly slopeCache = new Float32Array(400 * 400).fill(NaN);

  /** 0 = flat, 1 = vertical: the gradient of the triangle under (x, z) mapped to [0, 1] (finite differences beyond the field). */
  slopeAt(x: number, z: number): number {
    if (this.field.contains(x, z)) return this.field.slopeAt(x, z);
    const e = 1.5;
    const gx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const gz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    const g = Math.hypot(gx, gz);
    return g / (1 + g);
  }
}

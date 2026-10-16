import { BufferAttribute, Color, Mesh, PlaneGeometry } from 'three';
import { surface } from '../render/Materials';
import { Noise2D, lerp, smoothstep } from './noise';
import { LAYOUT, PADS } from '../data/world';

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

/** Distance from a point to the river centre line. */
export function riverDistance(x: number, z: number): number {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const [ax, az] = RIVER[i];
    const [bx, bz] = RIVER[i + 1];
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
  return Math.sqrt(best);
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

/** 0..1 on a worn footpath (LAYOUT.paths): about 2.4 m wide with soft edges. */
export function pathAt(x: number, z: number): number {
  let best = Infinity;
  for (const line of LAYOUT.paths) {
    for (let i = 0; i < line.length - 1; i++) {
      const [ax, az] = line[i];
      const [bx, bz] = line[i + 1];
      const dx = bx - ax;
      const dz = bz - az;
      const l2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
      const ex = x - (ax + dx * t);
      const ez = z - (az + dz * t);
      const d2 = ex * ex + ez * ez;
      if (d2 < best) best = d2;
    }
  }
  return 1 - smoothstep(0.9, 2.1, Math.sqrt(best));
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

/** Pure height function. Plateau island with a wobbly cliff edge and a chasm band across it. */
export function terrainHeight(x: number, z: number, noise: Noise2D): number {
  const nx = x * 0.0067;
  const nz = z * 0.0067;
  const rolling = noise.fbm(nx, nz, 4) * 7;
  const detail = noise.noise(x * 0.03, z * 0.03) * 0.8;
  const dx = x - WORLD.islandCentre.x;
  const dz = z - WORLD.islandCentre.z;
  const wobble = noise.fbm(nx * 2 + 9, nz * 2 + 9, 3) * 18;
  const r = Math.hypot(dx, dz) + wobble;
  const island = smoothstep(WORLD.islandRadius + WORLD.cliffWidth, WORLD.islandRadius, r);
  const chasmCentre = WORLD.chasmCentreZ + noise.noise(x * 0.017, 3) * 6;
  const chasm = 1 - smoothstep(WORLD.chasmHalfWidth - 6, WORLD.chasmHalfWidth + 8, Math.abs(z - chasmCentre));
  const land = island * (1 - chasm);
  let plateau = 3 + rolling + detail;
  // Flatten a corridor under the causeway so the raised road always sits above the ground. It fades out over
  // CORRIDOR_FADE past each end (it used to stop dead: a 3.6 m wall behind the north stairs, a 2.5 m step behind the spawn).
  if (z > WORLD.corridorZ.min - CORRIDOR_FADE && z < WORLD.corridorZ.max + CORRIDOR_FADE) {
    const ends = smoothstep(WORLD.corridorZ.min - CORRIDOR_FADE, WORLD.corridorZ.min, z) * (1 - smoothstep(WORLD.corridorZ.max, WORLD.corridorZ.max + CORRIDOR_FADE, z));
    const corridor = (1 - smoothstep(6, 14, Math.abs(x))) * ends;
    plateau = lerp(plateau, 3.2, corridor);
  }
  // Stream ravine.
  plateau -= 3.2 * streamAt(x, z, noise);
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

export class Terrain {
  readonly mesh: Mesh;
  private readonly noise: Noise2D;

  /** The witch stream's centre line at `z`. */
  streamCentre(z: number): number {
    return streamCentre(z, this.noise);
  }

  constructor(seed = 1337) {
    this.noise = new Noise2D(seed);
    const geo = new PlaneGeometry(WORLD.size, WORLD.size, WORLD.segments, WORLD.segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
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
        const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z, this.noise);
      pos.setY(i, h);
      const slope = this.slopeAt(x, z);
      const meadow = smoothstep(-0.2, 0.5, this.noise.fbm(x * 0.012 + 50, z * 0.012 + 50, 3));
      c.copy(ground).lerp(moss, meadow * 0.75 * (1 - slope));
      c.lerp(stone, smoothstep(0.3, 0.85, slope));
      c.lerp(snow, frozenAt(x, z) * (1 - smoothstep(0.5, 0.9, slope)) * 0.85);
      c.lerp(streamBed, streamAt(x, z, this.noise) * 0.8);
      c.lerp(riverBed, riverAt(x, z) * 0.85);
      c.lerp(sandColor, sandAt(x, z) * 0.9);
      const dead = deadAt(x, z);
      if (dead > 0) c.lerp(this.noise.noise(x * 0.09, z * 0.09) > 0 ? deadA : deadB, dead * 0.85);
      if (Math.hypot(x - WORLD.pond.x, z - WORLD.pond.z) < WORLD.pond.r) c.lerp(riverBed, 0.7);
      c.lerp(pathColor, pathAt(x, z) * (1 - riverAt(x, z)) * (1 - smoothstep(0.4, 0.8, slope)) * 0.8);
      const mottle = 1 + this.noise.noise(x * 0.2, z * 0.2) * 0.08;
      colors[i * 3] = c.r * mottle;
      colors[i * 3 + 1] = c.g * mottle;
      colors[i * 3 + 2] = c.b * mottle;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.mesh = new Mesh(geo, surface({ vertexColors: true, roughness: 0.95 }));
    this.mesh.name = 'terrain';
    this.mesh.receiveShadow = true;
  }

  heightAt(x: number, z: number): number {
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

  /** 0 = flat, 1 = vertical. Finite-difference gradient magnitude mapped to [0, 1]. */
  slopeAt(x: number, z: number): number {
    const e = 1.5;
    const gx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const gz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    const g = Math.hypot(gx, gz);
    return g / (1 + g);
  }
}

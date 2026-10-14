import { BufferAttribute, Color, Mesh, PlaneGeometry, Vector3 } from 'three';
import { surface } from '../render/Materials';
import { Noise2D, lerp, smoothstep } from './noise';

/** World layout constants (metres). The island is centred at ISLAND_CENTRE; the causeway runs along x = 0. */
export const WORLD = {
  size: 560,
  segments: 280,
  islandCentre: { x: 0, z: -60 },
  islandRadius: 205,
  cliffWidth: 25,
  abyssY: -90,
  cloudSeaY: -26,
  chasmCentreZ: -95,
  chasmHalfWidth: 22,
  corridorZ: { min: -205, max: 115 },
  /** Glowing green stream ravine (witch bridge) along x ≈ streamX. */
  streamX: -112,
  streamZ: { min: -70, max: 80 },
  /** Climbable peak for the lone-knight vantage. */
  peak: { x: -90, z: -155, height: 88, radius: 58 },
  /** Frozen realm: north-east quadrant. */
  frozen: { xFrom: 40, xTo: 95, zFrom: -20, zTo: -70 },
} as const;

/** 0..1 how frozen a point is. */
export function frozenAt(x: number, z: number): number {
  return smoothstep(WORLD.frozen.xFrom, WORLD.frozen.xTo, x) * smoothstep(WORLD.frozen.zFrom, WORLD.frozen.zTo, z);
}

/** 0..1 inside the stream channel. */
export function streamAt(x: number, z: number, noise: Noise2D): number {
  const wobble = noise.noise(z * 0.02, 7) * 6;
  const band = smoothstep(WORLD.streamZ.min - 10, WORLD.streamZ.min, z) * (1 - smoothstep(WORLD.streamZ.max, WORLD.streamZ.max + 10, z));
  return (1 - smoothstep(3.5, 7, Math.abs(x - (WORLD.streamX + wobble)))) * band;
}

/** Pure height function. Plateau island with a wobbly cliff edge and a chasm band across it. */
export function terrainHeight(x: number, z: number, noise: Noise2D): number {
  const nx = x * 0.004;
  const nz = z * 0.004;
  const rolling = noise.fbm(nx, nz, 4) * 7;
  const detail = noise.noise(x * 0.03, z * 0.03) * 0.8;
  const dx = x - WORLD.islandCentre.x;
  const dz = z - WORLD.islandCentre.z;
  const wobble = noise.fbm(nx * 2 + 9, nz * 2 + 9, 3) * 30;
  const r = Math.hypot(dx, dz) + wobble;
  const island = smoothstep(WORLD.islandRadius + WORLD.cliffWidth, WORLD.islandRadius, r);
  const chasmCentre = WORLD.chasmCentreZ + noise.noise(x * 0.01, 3) * 10;
  const chasm = 1 - smoothstep(WORLD.chasmHalfWidth - 6, WORLD.chasmHalfWidth + 8, Math.abs(z - chasmCentre));
  const land = island * (1 - chasm);
  let plateau = 3 + rolling + detail;
  // Flatten a corridor under the causeway so the raised road always sits above the ground.
  if (z > WORLD.corridorZ.min && z < WORLD.corridorZ.max) {
    const corridor = 1 - smoothstep(6, 16, Math.abs(x));
    plateau = lerp(plateau, 3.2, corridor);
  }
  // Stream ravine.
  plateau -= 3.2 * streamAt(x, z, noise);
  // The peak.
  const pd = Math.hypot(x - WORLD.peak.x, z - WORLD.peak.z);
  if (pd < WORLD.peak.radius) {
    const t = 1 - pd / WORLD.peak.radius;
    plateau += WORLD.peak.height * Math.pow(t, 1.7) + noise.fbm(x * 0.05, z * 0.05, 3) * 6 * t;
  }
  return lerp(WORLD.abyssY, plateau, land);
}

export class Terrain {
  readonly mesh: Mesh;
  private readonly noise: Noise2D;

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

  /** 0 = flat, 1 = vertical. Finite-difference gradient magnitude mapped to [0, 1]. */
  slopeAt(x: number, z: number): number {
    const e = 1.5;
    const gx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const gz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    const g = Math.hypot(gx, gz);
    return g / (1 + g);
  }

  normalAt(x: number, z: number, out = new Vector3()): Vector3 {
    const e = 1.5;
    const gx = (this.heightAt(x + e, z) - this.heightAt(x - e, z)) / (2 * e);
    const gz = (this.heightAt(x, z + e) - this.heightAt(x, z - e)) / (2 * e);
    return out.set(-gx, 1, -gz).normalize();
  }
}

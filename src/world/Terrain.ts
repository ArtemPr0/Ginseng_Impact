import { BufferAttribute, Color, Mesh, PlaneGeometry, Vector3 } from 'three';
import { PALETTE } from '../render/palette';
import { ps1Lambert } from '../render/PS1Material';
import { Noise2D, lerp, smoothstep } from './noise';

/** World layout constants (metres). The island is centred at ISLAND_CENTRE; the causeway runs along x = 0. */
export const WORLD = {
  size: 560,
  segments: 140,
  islandCentre: { x: 0, z: -60 },
  islandRadius: 205,
  cliffWidth: 25,
  abyssY: -90,
  cloudSeaY: -26,
  chasmCentreZ: -95,
  chasmHalfWidth: 22,
} as const;

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
  const plateau = 3 + rolling + detail;
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
    const ground = new Color(0x2a3775);
    const stone = new Color(0x5a6aa8);
    const moss = new Color(PALETTE.witch);
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const h = terrainHeight(x, z, this.noise);
      pos.setY(i, h);
      const slope = this.slopeAt(x, z);
      c.copy(ground).lerp(stone, smoothstep(0.25, 0.9, slope));
      const mossy = smoothstep(0.35, 0.7, this.noise.noise(x * 0.02 + 50, z * 0.02 + 50));
      c.lerp(moss, mossy * 0.12 * (1 - slope));
      const mottle = 1 + this.noise.noise(x * 0.15, z * 0.15) * 0.12;
      colors[i * 3] = c.r * mottle;
      colors[i * 3 + 1] = c.g * mottle;
      colors[i * 3 + 2] = c.b * mottle;
    }
    geo.setAttribute('color', new BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    this.mesh = new Mesh(geo, ps1Lambert({ vertexColors: true }));
    this.mesh.name = 'terrain';
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

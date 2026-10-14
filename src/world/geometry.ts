import { BufferAttribute, BufferGeometry, Color } from 'three';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Noise2D } from './noise';

const rockNoise = new Noise2D(808);

/** Welds vertices, pushes them along their normals by layered noise, and recomputes smooth normals: weathered rock. */
export function rockify(geo: BufferGeometry, amplitude: number, frequency = 0.08, seedOffset = 0): BufferGeometry {
  const g = mergeVertices(geo, 1e-4);
  g.computeVertexNormals();
  const pos = g.attributes.position as BufferAttribute;
  const nor = g.attributes.normal as BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = rockNoise.fbm(x * frequency + y * 0.37 + seedOffset, z * frequency - y * 0.21 + seedOffset * 0.7, 3) * 0.7
      + rockNoise.noise(x * frequency * 4 + seedOffset, (y + z) * frequency * 4) * 0.3;
    pos.setXYZ(i, x + nor.getX(i) * n * amplitude, y + nor.getY(i) * n * amplitude, z + nor.getZ(i) * n * amplitude);
  }
  g.computeVertexNormals();
  return g;
}

/** Vertex colours: base tinted toward `moss` on upward-facing, noisy patches. */
export function tintRock(geo: BufferGeometry, base: number, moss: number, mossAmount = 0.5, seedOffset = 0): BufferGeometry {
  const pos = geo.attributes.position as BufferAttribute;
  const nor = geo.attributes.normal as BufferAttribute;
  const b = new Color(base);
  const m = new Color(moss);
  const c = new Color();
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const up = Math.max(0, nor.getY(i));
    const n = rockNoise.noise(pos.getX(i) * 0.3 + seedOffset, pos.getZ(i) * 0.3 + pos.getY(i) * 0.2) * 0.5 + 0.5;
    const shade = 0.85 + rockNoise.noise(pos.getX(i) * 1.1, pos.getY(i) * 1.1 + seedOffset) * 0.15;
    c.copy(b).lerp(m, Math.min(1, up * n * mossAmount * 1.6)).multiplyScalar(shade);
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3));
  return geo;
}

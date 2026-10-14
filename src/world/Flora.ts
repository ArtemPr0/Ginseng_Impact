import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, Color, Float32BufferAttribute,
  InstancedMesh, Matrix4, Object3D, Points, PointsMaterial, Group,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PALETTE } from '../render/palette';
import { ps1Lambert } from '../render/PS1Material';
import { glowTexture } from './Landmarks';

export interface Placement { x: number; y: number; z: number; yaw: number; scale: number }

function colorize(geo: BufferGeometry, color: number): BufferGeometry {
  const c = new Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3));
  return geo;
}

function instanced(geo: BufferGeometry, material: ReturnType<typeof ps1Lambert>, placements: Placement[]): InstancedMesh {
  const mesh = new InstancedMesh(geo, material, placements.length);
  const dummy = new Object3D();
  const m = new Matrix4();
  placements.forEach((p, i) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.yaw, 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    m.copy(dummy.matrix);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Dark stacked-cone pines (≈ 40 tris each), one instanced draw call. */
export function pines(placements: Placement[]): InstancedMesh {
  const trunk = colorize(new BoxGeometry(0.6, 3.2, 0.6).translate(0, 1.6, 0), PALETTE.bark);
  const canopyColor = 0x0f1f3f;
  const c1 = colorize(new ConeGeometry(3.2, 5, 5, 1, true).translate(0, 4.8, 0), canopyColor);
  const c2 = colorize(new ConeGeometry(2.5, 4.2, 5, 1, true).translate(0, 7.6, 0), canopyColor);
  const c3 = colorize(new ConeGeometry(1.6, 3.6, 5, 1, true).translate(0, 10.2, 0), 0x132650);
  const geo = mergeGeometries([trunk, c1, c2, c3], false)!;
  return instanced(geo, ps1Lambert({ vertexColors: true }), placements);
}

/** Glowing blue sunflowers: instanced stems + heads, and one Points cloud for the halos. */
export function sunflowers(placements: Placement[]): Group {
  const g = new Group();
  const stem = colorize(new BoxGeometry(0.08, 1.2, 0.08).translate(0, 0.6, 0), PALETTE.bark);
  const leaf = colorize(new BoxGeometry(0.5, 0.04, 0.2).translate(0.25, 0.5, 0), 0x163a3a);
  g.add(instanced(mergeGeometries([stem, leaf], false)!, ps1Lambert({ vertexColors: true }), placements));
  const petals = new BoxGeometry(0.55, 0.55, 0.06).translate(0, 1.25, 0.05);
  g.add(instanced(petals, ps1Lambert({ color: 0x1a2a7a, emissive: PALETTE.electric, emissiveIntensity: 0.55 }), placements));
  const centre = new BoxGeometry(0.22, 0.22, 0.08).translate(0, 1.25, 0.08);
  g.add(instanced(centre, ps1Lambert({ color: PALETTE.void }), placements));
  const pos: number[] = [];
  for (const p of placements) pos.push(p.x, p.y + 1.25 * p.scale, p.z);
  const pg = new BufferGeometry();
  pg.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const halos = new Points(pg, new PointsMaterial({ map: glowTexture(), color: PALETTE.cobalt, size: 1.6, transparent: true, opacity: 0.3, blending: AdditiveBlending, depthWrite: false, fog: true }));
  halos.frustumCulled = false;
  g.add(halos);
  return g;
}

import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, InstancedMesh, Matrix4, MeshBasicMaterial, Object3D, PlaneGeometry, Points, PointsMaterial,
  CanvasTexture,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patchWind, surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import { rockify } from './geometry';
import { glowTexture } from './Landmarks';

export interface Placement { x: number; y: number; z: number; yaw: number; scale: number }

function colorize(geo: BufferGeometry, color: number, variation = 0): BufferGeometry {
  const c = new Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const v = 1 + (Math.random() - 0.5) * variation;
    arr[i * 3] = c.r * v;
    arr[i * 3 + 1] = c.g * v;
    arr[i * 3 + 2] = c.b * v;
  }
  geo.setAttribute('color', new BufferAttribute(arr, 3));
  return geo;
}

function instanced(geo: BufferGeometry, material: InstancedMesh['material'], placements: Placement[], shadows = true): InstancedMesh {
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
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

/** Dark pines: cylinder trunk and four lumpy noise-displaced foliage tiers, one instanced draw call. */
export function pines(placements: Placement[]): InstancedMesh {
  const trunk = colorize(new CylinderGeometry(0.22, 0.5, 4.5, 7).translate(0, 2.2, 0), PALETTE.bark);
  const tiers: BufferGeometry[] = [];
  const tierSpec: Array<[number, number, number, number, number, number]> = [[3.6, 4.6, 4.2, 0x0c1a36, 0.2, -0.15], [2.9, 4.2, 6.6, 0x0e1f40, -0.25, 0.1], [2.3, 3.8, 8.9, 0x112548, 0.15, 0.2], [1.6, 3.4, 11.0, 0x142b52, -0.1, -0.2], [0.9, 2.8, 12.9, 0x173160, 0.05, 0.1]];
  for (const [r, h, y, color, dx, dz] of tierSpec) {
    const cone = rockify(new ConeGeometry(r, h, 11, 5, true), 0.55, 0.7, y * 3.1);
    tiers.push(colorize(cone.translate(dx, y, dz), color, 0.18));
  }
  const geo = mergeGeometries([trunk, ...tiers], false)!;
  return instanced(geo, surface({ vertexColors: true, side: DoubleSide }), placements);
}

/** Unlit glowing meadow flowers (bloom makes them shine): crossed quads with per-instance colour. */
export function flowers(placements: Placement[]): InstancedMesh {
  const quad = new PlaneGeometry(0.2, 0.2, 1, 2).translate(0, 0.16, 0);
  const geo = mergeGeometries([quad, quad.clone().rotateY(Math.PI / 2)], false)!;
  const mat = new MeshBasicMaterial({ color: 0xffffff, map: petalTexture(), alphaTest: 0.45, side: DoubleSide, toneMapped: false });
  patchWind(mat as unknown as Parameters<typeof patchWind>[0], 0.5);
  const mesh = instanced(geo, mat, placements, false);
  const palette = [new Color(PALETTE.blood).multiplyScalar(0.9), new Color(PALETTE.dusk).multiplyScalar(1.1), new Color(PALETTE.electric).multiplyScalar(1.2), new Color(PALETTE.rune).multiplyScalar(0.8), new Color(0xff5aa0).multiplyScalar(0.9)];
  placements.forEach((_, i) => mesh.setColorAt(i, palette[(i * 7 + Math.floor(i / 3)) % palette.length]));
  mesh.instanceColor!.needsUpdate = true;
  return mesh;
}

/** Glowing blue sunflowers: stems, emissive petal discs, dark centres, soft halos. */
export function sunflowers(placements: Placement[]): Group {
  const g = new Group();
  const stem = colorize(new CylinderGeometry(0.03, 0.05, 1.2, 5).translate(0, 0.6, 0), PALETTE.bark);
  const leaf = colorize(new PlaneGeometry(0.5, 0.18).rotateX(-0.6).translate(0.3, 0.5, 0), 0x163a3a);
  const stemMat = surface({ vertexColors: true, side: DoubleSide });
  patchWind(stemMat, 0.18);
  g.add(instanced(mergeGeometries([stem, leaf], false)!, stemMat, placements, false));
  const head = new PlaneGeometry(0.5, 0.5).translate(0, 1.25, 0);
  const petals = mergeGeometries([head, head.clone().rotateY(Math.PI / 2)], false)!;
  const petalMat = new MeshBasicMaterial({ map: sunflowerTexture(), alphaTest: 0.4, color: new Color(PALETTE.electric).multiplyScalar(0.85), toneMapped: false, side: DoubleSide });
  patchWind(petalMat as unknown as Parameters<typeof patchWind>[0], 0.18);
  g.add(instanced(petals, petalMat, placements, false));
  const pos: number[] = [];
  for (const p of placements) pos.push(p.x, p.y + 1.25 * p.scale, p.z);
  const pg = new BufferGeometry();
  pg.setAttribute('position', new Float32BufferAttribute(pos, 3));
  const halos = new Points(pg, new PointsMaterial({ map: glowTexture(), color: PALETTE.cobalt, size: 1.4, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false, fog: true }));
  halos.frustumCulled = false;
  g.add(halos);
  return g;
}

let sunTex: CanvasTexture | undefined;
function sunflowerTexture(): CanvasTexture {
  if (sunTex) return sunTex;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(size / 2 + Math.cos(a) * 34, size / 2 + Math.sin(a) * 34, 26, 9, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#060818';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 20, 0, Math.PI * 2);
  ctx.fill();
  sunTex = new CanvasTexture(canvas);
  return sunTex;
}

let petalTex: CanvasTexture | undefined;
function petalTexture(): CanvasTexture {
  if (petalTex) return petalTex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    ctx.beginPath();
    ctx.ellipse(size / 2 + Math.cos(a) * 14, size / 2 + Math.sin(a) * 14, 13, 8, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#9ab';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 6, 0, Math.PI * 2);
  ctx.fill();
  petalTex = new CanvasTexture(canvas);
  return petalTex;
}

/** Scattered boulders. */
export function boulders(placements: Placement[]): InstancedMesh {
  const geo = colorize(rockify(new BoxGeometry(1.6, 1.1, 1.3, 6, 5, 6), 0.3, 0.9, 5), PALETTE.stone, 0.15);
  return instanced(geo, surface({ vertexColors: true }), placements);
}

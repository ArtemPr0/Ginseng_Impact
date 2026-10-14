import {
  BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Group,
  InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PointLight, SphereGeometry, TorusGeometry,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import type { Footprint } from './Colliders';
import type { Placement } from './Flora';
import { rockify, tintRock } from './geometry';
import { glowSprite, type Landmark } from './Landmarks';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function gradientColor(geo: BufferGeometry, bottom: number, top: number, yMin: number, yMax: number, snowFrom = 0.72): BufferGeometry {
  const pos = geo.attributes.position as BufferAttribute;
  const b = new Color(bottom);
  const t = new Color(top);
  const snow = new Color(0x9fb3e6);
  const c = new Color();
  const arr = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const f = Math.min(1, Math.max(0, (pos.getY(i) - yMin) / (yMax - yMin)));
    c.copy(b).lerp(t, f);
    if (f > snowFrom) c.lerp(snow, (f - snowFrom) / (1 - snowFrom));
    arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b;
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

/** Silent mountain ranges beyond the cloud sea: a ring of fogged snow-capped peaks, plus nearer low ridges. */
export function mountains(centre: { x: number; z: number }): Group {
  const g = new Group();
  const rnd = rng(77);
  const mat = surface({ vertexColors: true, roughness: 1 });
  const add = (r: number, angle: number, radius: number, height: number, seed: number) => {
    const geo = rockify(new ConeGeometry(radius, height, 9, 6, true), radius * 0.22, 0.018, seed);
    gradientColor(geo, 0x0a1230, 0x2a3a7a, -height / 2, height / 2);
    const m = new Mesh(geo, mat);
    m.position.set(centre.x + Math.cos(angle) * r, -90 + height / 2, centre.z + Math.sin(angle) * r);
    m.rotation.y = rnd() * Math.PI;
    g.add(m);
  };
  for (let i = 0; i < 20; i++) {
    const angle = (i / 20) * Math.PI * 2 + (rnd() - 0.5) * 0.25;
    add(270 + rnd() * 60, angle, 55 + rnd() * 45, 130 + rnd() * 90, i * 3.7);
  }
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + 0.3 + (rnd() - 0.5) * 0.4;
    add(190 + rnd() * 35, angle, 40 + rnd() * 25, 60 + rnd() * 40, 100 + i * 2.1);
  }
  return g;
}

/** Frozen realm decor: ice crystal clusters and bare dead trees. */
export function frozenDecor(crystals: Placement[], deadTrees: Placement[]): Group {
  const g = new Group();
  const crystal = mergeGeometries([
    new ConeGeometry(0.35, 2.4, 6).translate(0, 1.2, 0),
    new ConeGeometry(0.22, 1.5, 6).rotateZ(0.5).translate(0.5, 0.6, 0.2),
    new ConeGeometry(0.18, 1.1, 6).rotateZ(-0.6).rotateY(1.2).translate(-0.4, 0.45, -0.3),
  ], false)!;
  const crystalMat = surface({ color: 0x5aa8ff, emissive: PALETTE.electric, emissiveIntensity: 0.55, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  g.add(instanced(crystal, crystalMat, crystals, false));
  const trunk = new CylinderGeometry(0.18, 0.4, 5, 7).translate(0, 2.5, 0);
  const branches: BufferGeometry[] = [trunk];
  const rnd = rng(5);
  for (let i = 0; i < 6; i++) {
    const b = new CylinderGeometry(0.05, 0.12, 2.2 + rnd() * 1.5, 5).translate(0, 1.2, 0);
    b.rotateZ(0.6 + rnd() * 0.6);
    b.rotateY(rnd() * Math.PI * 2);
    b.translate(0, 2.2 + rnd() * 2.4, 0);
    branches.push(b);
  }
  const tree = mergeGeometries(branches, false)!;
  const col = new Float32Array(tree.attributes.position.count * 3);
  const c = new Color(0x2d3258);
  for (let i = 0; i < col.length; i += 3) { col[i] = c.r; col[i + 1] = c.g; col[i + 2] = c.b; }
  tree.setAttribute('color', new BufferAttribute(col, 3));
  g.add(instanced(tree, surface({ vertexColors: true }), deadTrees));
  return g;
}

/** Rainy orchard: rows of round-canopied trees heavy with glowing fruit, and mirror puddles. */
export function orchard(cx: number, cz: number, heightAt: (x: number, z: number) => number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const rnd = rng(123);
  const trunkMat = surface({ color: 0x1c1f45, roughness: 0.9 });
  const canopyMat = surface({ vertexColors: true, roughness: 0.85 });
  const fruitPlacements: Placement[] = [];
  const fruitColors: Color[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const x = cx - 17.5 + i * 7 + (rnd() - 0.5) * 2;
      const z = cz - 17.5 + j * 7 + (rnd() - 0.5) * 2;
      const y = heightAt(x, z);
      const h = 2.8 + rnd() * 1.2;
      const trunk = new Mesh(new CylinderGeometry(0.22, 0.38, h, 8), trunkMat);
      trunk.position.set(x, y + h / 2 - 0.2, z);
      trunk.castShadow = true;
      const canopyGeo = rockify(new SphereGeometry(2.3 + rnd() * 0.6, 22, 16), 0.4, 0.9, i * 6 + j);
      tintRock(canopyGeo, 0x14304a, 0x1f4d46, 0.6, i * 6 + j);
      const canopy = new Mesh(canopyGeo, canopyMat);
      canopy.position.set(x, y + h + 1.4, z);
      canopy.castShadow = true;
      canopy.receiveShadow = true;
      g.add(trunk, canopy);
      footprints.push({ kind: 'cyl', x, z, r: 0.45, top: y + h });
      for (let k = 0; k < 14; k++) {
        const u = rnd() * Math.PI * 2;
        const v = (rnd() - 0.5) * Math.PI * 0.8;
        const r = 2.3 + rnd() * 0.5;
        fruitPlacements.push({ x: x + Math.cos(u) * Math.cos(v) * r, y: y + h + 1.4 + Math.sin(v) * r * 0.9, z: z + Math.sin(u) * Math.cos(v) * r, yaw: 0, scale: 0.7 + rnd() * 0.6 });
        fruitColors.push(new Color(rnd() < 0.6 ? PALETTE.blood : PALETTE.dusk).multiplyScalar(0.9));
      }
    }
  }
  const fruitMesh = instanced(new SphereGeometry(0.16, 8, 6), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), fruitPlacements, false);
  fruitPlacements.forEach((_, i) => fruitMesh.setColorAt(i, fruitColors[i]));
  fruitMesh.instanceColor!.needsUpdate = true;
  g.add(fruitMesh);
  for (let i = 0; i < 22; i++) {
    const x = cx + (rnd() - 0.5) * 50;
    const z = cz + (rnd() - 0.5) * 50;
    const puddle = new Mesh(new CircleGeometry(1 + rnd() * 2.2, 20), surface({ color: 0x0a1028, roughness: 0.25, metalness: 0.5, transparent: true, opacity: 0.5 }));
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.set(x, heightAt(x, z) + 0.04, z);
    puddle.scale.x = 1 + rnd() * 0.8;
    g.add(puddle);
  }
  return { object: g, footprints };
}

/** Forgotten castle on the cliff: curtain walls with crenellations, corner towers, a keep, a rune-lit gate and waving banners. */
export function castle(x: number, z: number, baseY: number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const stone = (w: number, h: number, d: number, seed: number, amp = 0.12, color = 0x3a4478) => {
    const geo = rockify(new BoxGeometry(w, h, d, Math.max(2, Math.round(w / 4)), Math.max(2, Math.round(h / 4)), Math.max(2, Math.round(d / 4))), amp, 0.15, seed);
    tintRock(geo, color, 0x1f4d46, 0.3, seed);
    const m = new Mesh(geo, surface({ vertexColors: true }));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const half = 32;
  const wallH = 12;
  const crenels: BufferGeometry[] = [];
  const walls: Array<[number, number, number, number]> = [[0, -half, half * 2, 3], [0, half, half * 2, 3], [-half, 0, 3, half * 2], [half, 0, 3, half * 2]];
  walls.forEach(([wx, wz, w, d], i) => {
    const wall = stone(w, wallH, d, 200 + i);
    wall.position.set(wx, wallH / 2, wz);
    g.add(wall);
    footprints.push({ kind: 'box', x: x + wx, z: z + wz, hw: w / 2, hd: d / 2, top: baseY + wallH });
    const along = w > d ? w : d;
    for (let k = -along / 2 + 1.5; k < along / 2; k += 3) {
      const c = new BoxGeometry(1.4, 1.6, 1.4);
      c.translate(w > d ? wx + k : wx, wallH + 0.8, w > d ? wz : wz + k);
      crenels.push(c);
    }
  });
  const crenelMesh = new Mesh(mergeGeometries(crenels, false)!, surface({ color: 0x2f3868 }));
  crenelMesh.castShadow = true;
  g.add(crenelMesh);
  const towerMat = surface({ vertexColors: true });
  const roofMat = surface({ color: 0x141a3c, roughness: 0.8 });
  const slitMat = surface({ color: PALETTE.void, emissive: PALETTE.rune, emissiveIntensity: 2 });
  const tower = (tx: number, tz: number, r: number, h: number, seed: number) => {
    const geo = rockify(new CylinderGeometry(r, r * 1.1, h, 18, 6), 0.2, 0.2, seed);
    tintRock(geo, 0x3a4478, 0x1f4d46, 0.3, seed);
    const t = new Mesh(geo, towerMat);
    t.position.set(tx, h / 2, tz);
    t.castShadow = true;
    t.receiveShadow = true;
    const roof = new Mesh(new ConeGeometry(r * 1.2, r * 1.7, 12), roofMat);
    roof.position.set(tx, h + r * 0.85, tz);
    roof.castShadow = true;
    g.add(t, roof);
    footprints.push({ kind: 'cyl', x: x + tx, z: z + tz, r, top: baseY + h });
    for (let k = 0; k < 4; k++) {
      const a = (k / 4) * Math.PI * 2 + 0.4;
      const slit = new Mesh(new BoxGeometry(0.5, 2.2, 0.3), slitMat);
      slit.position.set(tx + Math.cos(a) * r, h * (0.45 + 0.12 * (k % 2)), tz + Math.sin(a) * r);
      slit.rotation.y = -a + Math.PI / 2;
      g.add(slit);
    }
  };
  tower(-half, -half, 6.5, 30, 301);
  tower(half, -half, 6.5, 30, 302);
  tower(-half, half, 6.5, 30, 303);
  tower(half, half, 6.5, 30, 304);
  const keep = stone(24, 26, 22, 305, 0.15, 0x33406f);
  keep.position.set(0, 13, -8);
  g.add(keep);
  footprints.push({ kind: 'box', x, z: z - 8, hw: 12, hd: 11, top: baseY + 26 });
  tower(0, -8, 5, 44, 306);
  // Gatehouse on the south wall with a rune portal.
  tower(-6, half, 3.5, 18, 307);
  tower(6, half, 3.5, 18, 308);
  const gate = new Mesh(new PlaneGeometry(6, 8), new MeshBasicMaterial({ color: new Color(PALETTE.rune).multiplyScalar(1.2), toneMapped: false, side: DoubleSide, transparent: true, opacity: 0.85 }));
  gate.position.set(0, 4, half + 1.6);
  const gateGlow = glowSprite(PALETTE.rune, 16, 0.5, true);
  gateGlow.position.set(0, 4.5, half + 3);
  const gateLight = new PointLight(PALETTE.rune, 36, 22, 1.8);
  gateLight.position.set(0, 5, half + 5);
  g.add(gate, gateGlow, gateLight);
  // Banners.
  const banners: Array<{ mesh: Mesh; rest: Float32Array; phase: number }> = [];
  const bannerMat = surface({ color: 0x8a1020, roughness: 0.9, side: DoubleSide });
  const emblemMat = new MeshBasicMaterial({ color: PALETTE.moon, side: DoubleSide });
  const bannerAt = (bx: number, by: number, bz: number, phase: number) => {
    const pole = new Mesh(new CylinderGeometry(0.08, 0.1, 5, 6), surface({ color: PALETTE.bark }));
    pole.position.set(bx, by + 2.5, bz);
    const geo = new PlaneGeometry(1.4, 3.4, 2, 10);
    geo.translate(0.7, -1.7, 0);
    const banner = new Mesh(geo, bannerMat);
    banner.position.set(bx, by + 4.9, bz);
    const emblem = new Mesh(new CircleGeometry(0.35, 16), emblemMat);
    emblem.position.set(0.7, -1.5, 0.01);
    banner.add(emblem);
    g.add(pole, banner);
    banners.push({ mesh: banner, rest: new Float32Array((geo.attributes.position as BufferAttribute).array), phase });
  };
  bannerAt(-half + 2, 30, -half, 0);
  bannerAt(half + 2, 30, -half, 1);
  bannerAt(-half + 2, 30, half, 2);
  bannerAt(half + 2, 30, half, 3);
  bannerAt(-10, wallH, half + 1.6, 4);
  bannerAt(10, wallH, half + 1.6, 5);
  g.position.set(x, baseY, z);
  let t = 0;
  return {
    object: g,
    footprints,
    update(dt) {
      t += dt;
      for (const b of banners) {
        const pos = b.mesh.geometry.attributes.position as BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const rx = b.rest[i * 3];
          const ry = b.rest[i * 3 + 1];
          const f = rx / 1.4;
          pos.setXYZ(i, rx, ry + Math.sin(t * 3 + f * 5 + b.phase) * 0.06 * f, Math.sin(t * 4 + f * 6 + b.phase) * 0.22 * f + Math.sin(t * 1.3 + b.phase) * 0.1 * f);
        }
        pos.needsUpdate = true;
      }
    },
  };
}

/** Broken columns and half-arches. */
export function ruins(spots: Array<{ x: number; z: number; y: number; yaw: number; arch: boolean }>): Group {
  const g = new Group();
  const mat = surface({ vertexColors: true });
  spots.forEach((s, i) => {
    const piece = new Group();
    const col = (dx: number, h: number) => {
      const geo = rockify(new CylinderGeometry(0.6, 0.7, h, 12, 4), 0.07, 0.6, 500 + i * 3 + dx);
      tintRock(geo, 0x3a4478, 0x1f4d46, 0.5, 500 + i);
      const m = new Mesh(geo, mat);
      m.position.set(dx, h / 2, 0);
      m.castShadow = true;
      m.receiveShadow = true;
      piece.add(m);
    };
    if (s.arch) {
      col(-3, 6);
      col(3, 6);
      const geo = rockify(new TorusGeometry(3, 0.6, 8, 16, Math.PI), 0.06, 0.6, 600 + i);
      tintRock(geo, 0x3a4478, 0x1f4d46, 0.4, 600 + i);
      const arch = new Mesh(geo, mat);
      arch.position.y = 6;
      arch.castShadow = true;
      piece.add(arch);
    } else {
      col(0, 3 + (i % 3) * 1.5);
    }
    piece.position.set(s.x, s.y - 0.3, s.z);
    piece.rotation.y = s.yaw;
    g.add(piece);
  });
  return g;
}

/** Glowing mushrooms: instanced stems and emissive caps. */
export function mushrooms(placements: Placement[]): Group {
  const g = new Group();
  const stem = new CylinderGeometry(0.04, 0.07, 0.4, 7).translate(0, 0.2, 0);
  g.add(instanced(stem, surface({ color: 0x4a558f, roughness: 0.8 }), placements, false));
  const cap = new SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5).translate(0, 0.36, 0);
  const capMat = surface({ color: 0x1b2a7a, emissive: PALETTE.electric, emissiveIntensity: 0.4, roughness: 0.6 });
  g.add(instanced(cap, capMat, placements, false));
  return g;
}

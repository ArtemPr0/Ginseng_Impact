import {
  BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide,
  Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PointLight, SphereGeometry, TorusGeometry, Vector3,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patchWind, surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import type { Footprint } from './Colliders';
import type { Placement } from './Flora';
import { rockify, tintRock } from './geometry';
import { glowSprite, glowTexture, type Landmark } from './Landmarks';
import { fire, FIRE } from './Settlements';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

function stone(w: number, h: number, d: number, seed: number, color = 0x3a4478, amp = 0.1): Mesh {
  const geo = rockify(new BoxGeometry(w, h, d, Math.max(2, Math.round(w / 3)), Math.max(2, Math.round(h / 3)), Math.max(2, Math.round(d / 3))), amp, 0.15, seed);
  tintRock(geo, color, 0x1f4d46, 0.3, seed);
  const m = new Mesh(geo, surface({ vertexColors: true }));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function instance(geo: BufferGeometry, mat: InstancedMesh['material'], spots: Placement[], shadows = true): InstancedMesh {
  const mesh = new InstancedMesh(geo, mat, spots.length);
  const dummy = new Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.frustumCulled = false;
  mesh.castShadow = shadows;
  mesh.receiveShadow = shadows;
  return mesh;
}

/** Wizard tower on a needle of rock with a spiral stair of stone slabs and orbiting boulders. */
export function wizardTower(x: number, z: number, baseY: number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const needleGeo = rockify(new CylinderGeometry(6, 14, 70, 14, 12), 1.6, 0.08, 211);
  tintRock(needleGeo, 0x2e3870, 0x1f4d46, 0.35, 211);
  const needle = new Mesh(needleGeo, surface({ vertexColors: true }));
  needle.position.y = 35;
  needle.castShadow = true;
  needle.receiveShadow = true;
  g.add(needle);
  footprints.push({ kind: 'cyl', x, z, r: 6.2, top: baseY + 70 });
  // Tower.
  const body = new Mesh(new CylinderGeometry(4.2, 4.6, 24, 16), surface({ color: 0x3a4478 }));
  body.position.y = 70 + 12;
  body.castShadow = true;
  const roof = new Mesh(new ConeGeometry(5.2, 9, 16), surface({ color: 0x141a3c }));
  roof.position.y = 70 + 24 + 4.5;
  roof.castShadow = true;
  const balcony = new Mesh(new CylinderGeometry(5.6, 5.6, 0.6, 16), surface({ color: 0x2f3868 }));
  balcony.position.y = 70 + 14;
  g.add(body, roof, balcony);
  footprints.push({ kind: 'cyl', x, z, r: 4.6, top: baseY + 94 });
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const w = new Mesh(new PlaneGeometry(0.9, 1.6), new MeshBasicMaterial({ color: new Color(PALETTE.rune).multiplyScalar(1.2), toneMapped: false, side: DoubleSide }));
    w.position.set(Math.cos(a) * 4.3, 70 + 10 + (i % 2) * 7, Math.sin(a) * 4.3);
    w.rotation.y = -a + Math.PI / 2;
    g.add(w);
  }
  const beacon = glowSprite(PALETTE.rune, 14, 0.5, true);
  beacon.position.y = 70 + 30;
  g.add(beacon);
  const beaconLight = new PointLight(PALETTE.rune, 120, 60, 1.6);
  beaconLight.position.y = 70 + 29;
  g.add(beaconLight);
  // Spiral stairs around the needle.
  const stairMat = surface({ color: 0x4a5690 });
  for (let i = 0; i < 70; i++) {
    const a = i * 0.36;
    const y = 1 + i;
    const r = 6.5 + 7 * (1 - y / 70);
    const step = new Mesh(new BoxGeometry(2.4, 0.35, 1.3), stairMat);
    step.position.set(Math.cos(a) * r, y, Math.sin(a) * r);
    step.rotation.y = -a;
    step.castShadow = true;
    g.add(step);
    footprints.push({ kind: 'box', x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, hw: 1.2, hd: 0.65, top: baseY + y + 0.18, rotY: -a });
  }
  // Floating boulders.
  const boulders: Mesh[] = [];
  const rnd = rng(17);
  for (let i = 0; i < 9; i++) {
    const geo = rockify(new SphereGeometry(1.5 + rnd() * 2.5, 10, 7), 0.5, 0.6, 230 + i);
    tintRock(geo, 0x3a4478, 0x1f4d46, 0.4, 230 + i);
    const b = new Mesh(geo, surface({ vertexColors: true }));
    const a = rnd() * Math.PI * 2;
    b.position.set(Math.cos(a) * (18 + rnd() * 14), 30 + rnd() * 50, Math.sin(a) * (18 + rnd() * 14));
    b.castShadow = true;
    g.add(b);
    boulders.push(b);
  }
  g.position.set(x, baseY, z);
  let t = 0;
  return {
    object: g, footprints,
    update(dt) {
      t += dt;
      boulders.forEach((b, i) => { b.position.y += Math.sin(t * 0.5 + i) * 0.01; b.rotation.y += dt * 0.05; });
      beacon.scale.setScalar(14 + Math.sin(t * 2) * 1.5);
    },
  };
}

/** Horned demon church with a glowing arched door, flanked by cypresses and a graveyard. */
export function demonChurch(x: number, z: number, baseY: number, rotY: number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const nave = stone(16, 14, 26, 240, 0x2b3466);
  nave.position.set(0, 7, 0);
  const facade = stone(20, 22, 3, 241, 0x2b3466);
  facade.position.set(0, 11, 14);
  g.add(nave, facade);
  const hornMat = surface({ color: 0x0a0d2a, roughness: 0.5 });
  for (const side of [-1, 1]) {
    const horn = new Mesh(new ConeGeometry(1.6, 14, 8), hornMat);
    horn.position.set(side * 7.5, 22 + 6, 13.5);
    horn.rotation.z = -side * 0.55;
    horn.castShadow = true;
    const tip = new Mesh(new ConeGeometry(0.8, 7, 7), hornMat);
    tip.position.set(side * 12.5, 22 + 13, 13.2);
    tip.rotation.z = -side * 1.4;
    g.add(horn, tip);
    const buttress = stone(2.5, 10, 4, 242 + side, 0x2b3466);
    buttress.position.set(side * 9.5, 5, 10);
    g.add(buttress);
  }
  const eyeSockets = [[-4, 17], [4, 17]] as const;
  for (const [ex, ey] of eyeSockets) {
    const socket = new Mesh(new CircleGeometry(1.6, 16), new MeshBasicMaterial({ color: new Color(PALETTE.witch).multiplyScalar(1.1), toneMapped: false }));
    socket.position.set(ex, ey, 15.6);
    g.add(socket);
  }
  const door = new Mesh(new PlaneGeometry(5, 9), new MeshBasicMaterial({ color: new Color(PALETTE.witch).multiplyScalar(1.4), toneMapped: false, side: DoubleSide }));
  door.position.set(0, 4.5, 15.6);
  const arch = new Mesh(new TorusGeometry(3, 0.8, 8, 16, Math.PI), surface({ color: 0x1a1428 }));
  arch.position.set(0, 9, 15.7);
  const glow = glowSprite(PALETTE.witch, 18, 0.55, true);
  glow.position.set(0, 5, 18);
  const light = new PointLight(PALETTE.witch, 120, 40, 1.6);
  light.position.set(0, 6, 20);
  g.add(door, arch, glow, light);
  footprints.push({ kind: 'box', x, z, hw: 10, hd: 15.5, top: baseY + 22, rotY });
  // Cypresses.
  const cypMat = surface({ color: 0x08142a, roughness: 1 });
  for (let i = 0; i < 10; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const cz = 20 + Math.floor(i / 2) * 7;
    const cx = side * (14 + (i % 3) * 3);
    const cyp = new Mesh(new ConeGeometry(1.4, 14 + (i % 3) * 3, 8), cypMat);
    cyp.position.set(cx, 7 + (i % 3) * 1.5, cz);
    cyp.castShadow = true;
    g.add(cyp);
  }
  // Graveyard.
  const rnd = rng(66);
  for (let i = 0; i < 26; i++) {
    const gx = (rnd() - 0.5) * 36;
    const gz = 22 + rnd() * 30;
    const h = 1 + rnd() * 0.8;
    const grave = i % 4 === 0
      ? new Mesh(new BoxGeometry(1.0, h, 0.25), surface({ color: 0x2f3868 }))
      : new Mesh(new CylinderGeometry(0.5, 0.5, 0.25, 12, 1, false, 0, Math.PI).rotateX(Math.PI / 2).translate(0, h * 0.5, 0), surface({ color: 0x2f3868 }));
    if (i % 4 === 0) grave.position.set(gx, h / 2, gz);
    else {
      const slab = new Mesh(new BoxGeometry(1.0, h, 0.25), surface({ color: 0x2f3868 }));
      slab.position.set(gx, h / 2, gz);
      g.add(slab);
      grave.position.set(gx, h / 2, gz);
    }
    grave.rotation.y = (rnd() - 0.5) * 0.4;
    grave.rotation.z = (rnd() - 0.5) * 0.15;
    grave.castShadow = true;
    g.add(grave);
    if (i % 3 === 0) {
      const cross = new Mesh(new BoxGeometry(0.6, 0.1, 0.1), surface({ color: 0x2f3868 }));
      cross.position.set(gx, h * 0.7, gz);
      g.add(cross);
    }
  }
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  let t = 0;
  return { object: g, footprints, update(dt) { t += dt; glow.material.opacity = 0.45 + Math.sin(t * 3) * 0.1; light.intensity = 110 + Math.sin(t * 5) * 20; } };
}

/** Floating island with palms, a ruined temple and waterfalls pouring off its underside. */
export function palmIsland(x: number, y: number, z: number): Landmark & { palms: Placement[] } {
  const g = new Group();
  const rnd = rng(88);
  const rockGeo = rockify(new ConeGeometry(22, 26, 14, 6), 2.2, 0.12, 250);
  tintRock(rockGeo, 0x3a4478, 0x1f4d46, 0.6, 250);
  const rock = new Mesh(rockGeo, surface({ vertexColors: true }));
  rock.rotation.x = Math.PI;
  rock.castShadow = true;
  g.add(rock);
  const topGeo = rockify(new CylinderGeometry(22, 22, 2.5, 24, 2), 0.4, 0.3, 251);
  tintRock(topGeo, 0x1f4d46, 0x2a6a4a, 0.9, 251);
  const top = new Mesh(topGeo, surface({ vertexColors: true }));
  top.position.y = 1.2;
  top.receiveShadow = true;
  g.add(top);
  // Temple ruin.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const geo = rockify(new CylinderGeometry(0.7, 0.8, 4 + (i % 3) * 2, 12, 4), 0.07, 0.6, 260 + i);
    tintRock(geo, 0x4a5690, 0x1f4d46, 0.5, 260 + i);
    const col = new Mesh(geo, surface({ vertexColors: true }));
    col.position.set(Math.cos(a) * 5, 2.4 + (2 + (i % 3)), Math.sin(a) * 5);
    col.castShadow = true;
    g.add(col);
  }
  const altar = new Mesh(new BoxGeometry(3, 1.2, 2), surface({ color: 0x4a5690 }));
  altar.position.y = 3;
  const altarGlow = glowSprite(PALETTE.rune, 6, 0.4, true);
  altarGlow.position.y = 4.5;
  g.add(altar, altarGlow);
  // Waterfalls off the edge.
  const falls: Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + 0.4;
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(120,160,255,0.25)';
    ctx.fillRect(0, 0, 16, 128);
    ctx.fillStyle = 'rgba(230,240,255,0.9)';
    for (let k = 0; k < 8; k++) ctx.fillRect(k * 2, (k * 29) % 128, 1.2, 30);
    const tex = new (Object.getPrototypeOf(glowTexture()).constructor as typeof import('three').CanvasTexture)(canvas);
    tex.wrapS = tex.wrapT = 1000;
    tex.repeat.set(2, 4);
    const fall = new Mesh(new PlaneGeometry(4, 40), new MeshBasicMaterial({ map: tex, transparent: true, side: DoubleSide, depthWrite: false, color: new Color(1.2, 1.3, 1.6), toneMapped: false }));
    fall.position.set(Math.cos(a) * 21, -18, Math.sin(a) * 21);
    fall.rotation.y = -a + Math.PI / 2;
    g.add(fall);
    falls.push(fall);
  }
  const palms: Placement[] = [];
  for (let i = 0; i < 9; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 9 + rnd() * 10;
    palms.push({ x: x + Math.cos(a) * r, y: y + 2.4, z: z + Math.sin(a) * r, yaw: rnd() * Math.PI * 2, scale: 0.8 + rnd() * 0.6 });
  }
  g.position.set(x, y, z);
  let t = 0;
  return {
    object: g, footprints: [{ kind: 'cyl', x, z, r: 21, top: y + 2.4 }], palms,
    update(dt) { t += dt; g.position.y = y + Math.sin(t * 0.3) * 0.6; for (const f of falls) (f.material as MeshBasicMaterial).map!.offset.y += dt * 0.8; },
  };
}

/** Giant hollow tree with a round door, lit windows and glowing mushrooms at the base. */
export function treeHouse(x: number, z: number, baseY: number): Landmark {
  const g = new Group();
  const trunkGeo = rockify(new CylinderGeometry(5, 8, 42, 16, 10), 0.9, 0.2, 270);
  tintRock(trunkGeo, 0x1c1f45, 0x1f4d46, 0.45, 270);
  const trunk = new Mesh(trunkGeo, surface({ vertexColors: true, roughness: 1 }));
  trunk.position.y = 21;
  trunk.castShadow = true;
  g.add(trunk);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const rootGeo = rockify(new CylinderGeometry(0.6, 2.2, 10, 8, 4), 0.3, 0.6, 280 + i);
    tintRock(rootGeo, 0x1c1f45, 0x1f4d46, 0.5, 280 + i);
    const root = new Mesh(rootGeo, surface({ vertexColors: true }));
    root.position.set(Math.cos(a) * 7.5, 1.5, Math.sin(a) * 7.5);
    root.rotation.z = Math.cos(a) * 1.1;
    root.rotation.x = -Math.sin(a) * 1.1;
    g.add(root);
  }
  // Canopy.
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    const canGeo = rockify(new SphereGeometry(9, 14, 10), 1.2, 0.5, 290 + i);
    tintRock(canGeo, 0x0f2244, 0x1f4d46, 0.5, 290 + i);
    const can = new Mesh(canGeo, surface({ vertexColors: true }));
    can.position.set(Math.cos(a) * 8, 40 + (i % 2) * 4, Math.sin(a) * 8);
    can.castShadow = true;
    g.add(can);
  }
  const door = new Mesh(new CircleGeometry(2.2, 20), new MeshBasicMaterial({ color: new Color(FIRE).multiplyScalar(0.9), toneMapped: false }));
  door.position.set(0, 2.4, 7.2);
  const frame = new Mesh(new TorusGeometry(2.3, 0.35, 8, 20), surface({ color: 0x3a2e24 }));
  frame.position.set(0, 2.4, 7.2);
  g.add(door, frame);
  for (let i = 0; i < 4; i++) {
    const a = -1 + i * 0.7;
    const w = new Mesh(new CircleGeometry(0.7, 12), new MeshBasicMaterial({ color: new Color(FIRE).multiplyScalar(0.8), toneMapped: false }));
    w.position.set(Math.sin(a) * 6.2, 9 + i * 5, Math.cos(a) * 6.2);
    w.rotation.y = a;
    g.add(w);
  }
  const light = new PointLight(FIRE, 40, 20, 1.8);
  light.position.set(0, 3, 10);
  g.add(light);
  g.position.set(x, baseY, z);
  return { object: g, footprints: [{ kind: 'cyl', x, z, r: 6.5, top: baseY + 42 }] };
}

/** Ruined cathedral nave: two rows of pointed arches, a broken rose window wall, fog glow inside. */
export function ruinedNave(x: number, z: number, baseY: number, rotY: number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const mat = surface({ vertexColors: true });
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const geo = rockify(new CylinderGeometry(0.9, 1.0, 14 - (i % 3) * 3, 12, 6), 0.1, 0.5, 300 + i * 2 + side);
      tintRock(geo, 0x3a4478, 0x1f4d46, 0.5, 300 + i);
      const col = new Mesh(geo, mat);
      const h = 14 - (i % 3) * 3;
      col.position.set(side * 7, h / 2, -20 + i * 8);
      col.castShadow = true;
      g.add(col);
      footprints.push({ kind: 'cyl', x: x + side * 7, z: z - 20 + i * 8, r: 1, top: baseY + h });
      if (i < 5 && i % 3 !== 2) {
        const archGeo = rockify(new TorusGeometry(4, 0.7, 8, 18, Math.PI), 0.06, 0.6, 320 + i);
        tintRock(archGeo, 0x3a4478, 0x1f4d46, 0.4, 320 + i);
        const arch = new Mesh(archGeo, mat);
        arch.position.set(side * 7, 14, -16 + i * 8);
        arch.rotation.y = Math.PI / 2;
        arch.scale.y = 1.5;
        g.add(arch);
      }
    }
  }
  const wall = stone(20, 26, 2.5, 330, 0x2b3466);
  wall.position.set(0, 13, 30);
  g.add(wall);
  footprints.push({ kind: 'box', x, z: z + 30, hw: 10, hd: 1.25, top: baseY + 26, rotY });
  const rose = new Mesh(new CircleGeometry(4, 24), new MeshBasicMaterial({ color: new Color(PALETTE.electric).multiplyScalar(0.9), toneMapped: false, side: DoubleSide }));
  rose.position.set(0, 17, 28.6);
  const spokes = new Mesh(new TorusGeometry(4, 0.25, 6, 24), surface({ color: 0x1a1428 }));
  spokes.position.copy(rose.position);
  g.add(rose, spokes);
  for (let i = 0; i < 3; i++) {
    const fog = glowSprite(PALETTE.electric, 16, 0.14, true);
    fog.position.set(0, 3, -12 + i * 14);
    g.add(fog);
  }
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  return { object: g, footprints };
}

/** Free-standing stone arch gate (frozen valley). */
export function archGate(x: number, z: number, baseY: number, rotY: number, width = 12, height = 14): Landmark {
  const g = new Group();
  for (const side of [-1, 1]) {
    const pier = stone(3, height, 3, 340 + side, 0x4a5690, 0.12);
    pier.position.set(side * width / 2, height / 2, 0);
    g.add(pier);
  }
  const archGeo = rockify(new TorusGeometry(width / 2, 1.5, 8, 22, Math.PI), 0.08, 0.5, 345);
  tintRock(archGeo, 0x4a5690, 0x9fb3e6, 0.7, 345);
  const arch = new Mesh(archGeo, surface({ vertexColors: true }));
  arch.position.y = height;
  arch.castShadow = true;
  g.add(arch);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return {
    object: g,
    footprints: [
      { kind: 'box', x: x + (-width / 2) * c, z: z - (-width / 2) * s, hw: 1.5, hd: 1.5, top: baseY + height },
      { kind: 'box', x: x + (width / 2) * c, z: z - (width / 2) * s, hw: 1.5, hd: 1.5, top: baseY + height },
    ],
  };
}

/** Wooden plank bridge with rope rails. */
export function woodenBridge(ax: number, az: number, bx: number, bz: number, y: number): Landmark {
  const g = new Group();
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bz - az, bx - ax);
  const plank = surface({ color: 0x3a2e24, roughness: 0.95 });
  const n = Math.floor(len / 0.7);
  for (let i = 0; i < n; i++) {
    const p = new Mesh(new BoxGeometry(0.6, 0.12, 2.2), plank);
    p.position.set(-len / 2 + i * 0.7 + 0.35, Math.sin((i / n) * Math.PI) * -0.5, 0);
    p.rotation.y = (Math.random() - 0.5) * 0.04;
    p.castShadow = true;
    g.add(p);
  }
  const rope = surface({ color: 0x5a4a3a });
  for (const side of [-1, 1]) {
    for (let i = 0; i <= 6; i++) {
      const post = new Mesh(new CylinderGeometry(0.06, 0.07, 1.2, 6), rope);
      post.position.set(-len / 2 + (i / 6) * len, 0.5, side * 1.05);
      g.add(post);
    }
    const rail = new Mesh(new CylinderGeometry(0.04, 0.04, len, 6), rope);
    rail.rotation.z = Math.PI / 2;
    rail.position.set(0, 1.05, side * 1.05);
    g.add(rail);
  }
  g.position.set((ax + bx) / 2, y, (az + bz) / 2);
  g.rotation.y = -yaw;
  return { object: g, footprints: [{ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hw: len / 2, hd: 1.1, top: y + 0.06, rotY: -yaw }] };
}

/** Birch forest: white trunks with dark bands, sparse pale canopies, carpets of yellow fallen leaves. */
export function birches(spots: Placement[]): Group {
  const g = new Group();
  const trunk = new CylinderGeometry(0.16, 0.28, 11, 8, 6).translate(0, 5.5, 0);
  const tp = trunk.attributes.position as BufferAttribute;
  const col = new Float32Array(tp.count * 3);
  const white = new Color(0xd8dcf0);
  const dark = new Color(0x1a1a2a);
  const c = new Color();
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const band = Math.sin(y * 3.1 + Math.sin(y * 7) * 2) > 0.75 ? 1 : 0;
    c.copy(white).lerp(dark, band * 0.85);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  trunk.setAttribute('color', new BufferAttribute(col, 3));
  const trunkMesh = instance(trunk, surface({ vertexColors: true, roughness: 0.9 }), spots);
  const rnd = rng(23);
  const leafParts: BufferGeometry[] = [];
  for (let i = 0; i < 4; i++) {
    const leaf = rockify(new SphereGeometry(1.4, 8, 6), 0.4, 1.2, 350 + i);
    leaf.translate((rnd() - 0.5) * 2.4, 8 + rnd() * 3, (rnd() - 0.5) * 2.4);
    leafParts.push(leaf);
  }
  const leafGeo = mergeGeometries(leafParts, false)!;
  const lc = new Float32Array(leafGeo.attributes.position.count * 3);
  const leafCol = new Color(0x3a4a2a);
  for (let i = 0; i < lc.length; i += 3) { lc[i] = leafCol.r; lc[i + 1] = leafCol.g; lc[i + 2] = leafCol.b; }
  leafGeo.setAttribute('color', new BufferAttribute(lc, 3));
  const leafMesh = instance(leafGeo, surface({ vertexColors: true, roughness: 0.9 }), spots);
  g.add(trunkMesh, leafMesh);
  return g;
}

/** Yellow fallen leaves (ground and drifting on water). */
export function fallenLeaves(spots: Placement[], drift: boolean): { mesh: InstancedMesh; update: (dt: number) => void } {
  const geo = new PlaneGeometry(0.28, 0.2).rotateX(-Math.PI / 2);
  const mesh = instance(geo, new MeshBasicMaterial({ color: 0xe6c44a, side: DoubleSide, toneMapped: false }), spots, false);
  const dummy = new Object3D();
  let t = 0;
  return {
    mesh,
    update(dt) {
      if (!drift) return;
      t += dt;
      spots.forEach((s, i) => {
        dummy.position.set(s.x - ((t * 1.1 + i * 3.7) % 60), s.y + Math.sin(t * 2 + i) * 0.03, s.z + Math.sin(t * 0.5 + i) * 0.6);
        dummy.rotation.set(0, s.yaw + t * 0.3, 0);
        dummy.scale.setScalar(s.scale);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
    },
  };
}

/** Huge pale-pink cosmos flowers on tall stems. */
export function giantFlowers(spots: Placement[]): Group {
  const g = new Group();
  const stem = new CylinderGeometry(0.05, 0.08, 2.6, 6).translate(0, 1.3, 0);
  const stemMat = surface({ color: 0x1f4d46 });
  patchWind(stemMat, 0.3);
  g.add(instance(stem, stemMat, spots, false));
  const petals: BufferGeometry[] = [];
  for (let i = 0; i < 8; i++) {
    const p = new PlaneGeometry(0.5, 1.1, 1, 2).translate(0, 0.55, 0);
    p.rotateX(-1.25).rotateY((i / 8) * Math.PI * 2).translate(0, 2.6, 0);
    petals.push(p);
  }
  const petalGeo = mergeGeometries(petals, false)!;
  const petalMat = new MeshBasicMaterial({ color: 0xffb3d9, side: DoubleSide, toneMapped: false });
  patchWind(petalMat as unknown as Parameters<typeof patchWind>[0], 0.3);
  g.add(instance(petalGeo, petalMat, spots, false));
  const heart = new SphereGeometry(0.16, 8, 6).translate(0, 2.62, 0);
  g.add(instance(heart, new MeshBasicMaterial({ color: 0xfff1a8, toneMapped: false }), spots, false));
  return g;
}

/** Rose garden: dense red and blue blooms on low bushes. */
export function roseGarden(cx: number, cz: number, radius: number, heightAt: (x: number, z: number) => number, rnd: () => number): Group {
  const g = new Group();
  const spots: Placement[] = [];
  for (let i = 0; i < 700; i++) {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd()) * radius;
    const x = cx + Math.cos(a) * r;
    const z = cz + Math.sin(a) * r;
    spots.push({ x, y: heightAt(x, z), z, yaw: rnd() * Math.PI * 2, scale: 0.7 + rnd() * 0.9 });
  }
  const bush = rockify(new SphereGeometry(0.5, 8, 6), 0.15, 2, 360).translate(0, 0.35, 0);
  tintRock(bush, 0x0f3a2a, 0x1f4d46, 0.8, 360);
  g.add(instance(bush, surface({ vertexColors: true }), spots, false));
  const bloom = new SphereGeometry(0.13, 7, 5).translate(0, 0.75, 0);
  const bloomMesh = instance(bloom, new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), spots, false);
  const red = new Color(PALETTE.blood).multiplyScalar(0.75);
  const blue = new Color(PALETTE.electric).multiplyScalar(0.95);
  spots.forEach((_, i) => bloomMesh.setColorAt(i, i % 3 === 0 ? red : blue));
  bloomMesh.instanceColor!.needsUpdate = true;
  g.add(bloomMesh);
  return g;
}

/** Weeping willows: trunk + hanging strands of pale leaves. */
export function willows(spots: Placement[]): Group {
  const g = new Group();
  const trunk = rockify(new CylinderGeometry(0.35, 0.7, 7, 9, 5), 0.2, 0.9, 370).translate(0, 3.5, 0);
  tintRock(trunk, 0x2a2f55, 0x1f4d46, 0.5, 370);
  g.add(instance(trunk, surface({ vertexColors: true }), spots));
  const strands: BufferGeometry[] = [];
  const rnd = rng(9);
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 1.5 + rnd() * 3;
    const len = 4 + rnd() * 4;
    const s = new PlaneGeometry(0.12, len, 1, 4).translate(0, -len / 2, 0);
    const sp = s.attributes.position as BufferAttribute;
    for (let k = 0; k < sp.count; k++) { const y = sp.getY(k); sp.setX(k, sp.getX(k) + Math.sin(y * 0.8) * 0.2); }
    s.rotateY(a).translate(Math.cos(a) * r, 7.5 + rnd() * 1.5, Math.sin(a) * r);
    strands.push(s);
  }
  const strandMat = surface({ color: 0x9fb3e6, emissive: 0x4f7cff, emissiveIntensity: 0.25, side: DoubleSide, roughness: 0.9 });
  patchWind(strandMat, 0.5);
  g.add(instance(mergeGeometries(strands, false)!, strandMat, spots, false));
  const crown = rockify(new SphereGeometry(3.2, 12, 8), 0.6, 0.9, 371).translate(0, 7.8, 0);
  tintRock(crown, 0x1f3a4a, 0x1f4d46, 0.5, 371);
  g.add(instance(crown, surface({ vertexColors: true }), spots));
  return g;
}

/** Blue coral bushes (branching cones) for the frozen river banks. */
export function coral(spots: Placement[]): InstancedMesh {
  const rnd = rng(12);
  const parts: BufferGeometry[] = [];
  for (let i = 0; i < 14; i++) {
    const len = 0.8 + rnd() * 1.4;
    const b = new ConeGeometry(0.07, len, 5).translate(0, len / 2, 0);
    b.rotateZ((rnd() - 0.5) * 1.4).rotateY(rnd() * Math.PI * 2);
    parts.push(b);
  }
  const geo = mergeGeometries(parts, false)!;
  return instance(geo, surface({ color: 0x1b2a7a, emissive: PALETTE.electric, emissiveIntensity: 0.8 }), spots, false);
}

/** Dark hanging pods in the tall trees (sleeping things). */
export function hangingPods(spots: Placement[]): Group {
  const g = new Group();
  const trunk = new CylinderGeometry(0.4, 0.8, 22, 9).translate(0, 11, 0);
  const tc = new Float32Array(trunk.attributes.position.count * 3);
  const bc = new Color(0x1a1f3a);
  for (let i = 0; i < tc.length; i += 3) { tc[i] = bc.r; tc[i + 1] = bc.g; tc[i + 2] = bc.b; }
  trunk.setAttribute('color', new BufferAttribute(tc, 3));
  g.add(instance(trunk, surface({ vertexColors: true }), spots));
  const podParts: BufferGeometry[] = [];
  const rnd = rng(3);
  for (let i = 0; i < 3; i++) {
    const pod = rockify(new SphereGeometry(1.1, 10, 8), 0.3, 1.2, 380 + i);
    pod.scale(0.8, 1.5, 0.8);
    const a = rnd() * Math.PI * 2;
    pod.translate(Math.cos(a) * 2.2, 12 + rnd() * 6, Math.sin(a) * 2.2);
    podParts.push(pod);
    const cord = new CylinderGeometry(0.04, 0.04, 3, 4).translate(Math.cos(a) * 2.2, 14 + rnd() * 6 + 2, Math.sin(a) * 2.2);
    podParts.push(cord);
  }
  const podGeo = mergeGeometries(podParts, false)!;
  const pc = new Float32Array(podGeo.attributes.position.count * 3);
  const pcol = new Color(0x05070f);
  for (let i = 0; i < pc.length; i += 3) { pc[i] = pcol.r; pc[i + 1] = pcol.g; pc[i + 2] = pcol.b; }
  podGeo.setAttribute('color', new BufferAttribute(pc, 3));
  g.add(instance(podGeo, surface({ vertexColors: true, roughness: 1 }), spots));
  return g;
}

/** Black rock pinnacles rising from the cloud sea, and a glowing-sea shimmer. */
export function pinnacles(spots: Placement[], seaY: number): Group {
  const g = new Group();
  const rnd = rng(44);
  for (let i = 0; i < spots.length; i++) {
    const s = spots[i];
    const h = 14 + rnd() * 30;
    const geo = rockify(new ConeGeometry(4 + rnd() * 5, h, 9, 5), 1.2, 0.2, 400 + i);
    tintRock(geo, 0x0a0f2e, 0x1f4d46, 0.2, 400 + i);
    const m = new Mesh(geo, surface({ vertexColors: true, roughness: 1 }));
    m.position.set(s.x, seaY + h / 2 - 6, s.z);
    m.rotation.y = s.yaw;
    m.rotation.z = (rnd() - 0.5) * 0.3;
    g.add(m);
  }
  return g;
}

/** Candles along the causeway edge and red paper lanterns on the posts. */
export function causewayLights(points: Array<{ x: number; z: number; y: number }>, lanternEvery: number): Landmark {
  const g = new Group();
  const candleMat = surface({ color: 0xf0e6c8 });
  const flames: Sprite3[] = [];
  const lanternMat = new MeshBasicMaterial({ color: new Color(0xff2a2a).multiplyScalar(0.9), toneMapped: false });
  const lanternGlow: Array<ReturnType<typeof glowSprite>> = [];
  points.forEach((p, i) => {
    if (i % lanternEvery === 0) {
      const body = new Mesh(new CylinderGeometry(0.28, 0.28, 0.5, 10), lanternMat);
      body.position.set(p.x, p.y + 2.1, p.z);
      const cap = new Mesh(new CylinderGeometry(0.1, 0.32, 0.12, 10), surface({ color: 0x1a1428 }));
      cap.position.set(p.x, p.y + 2.4, p.z);
      const pole = new Mesh(new CylinderGeometry(0.04, 0.05, 1.9, 6), surface({ color: 0x1a1428 }));
      pole.position.set(p.x, p.y + 1.2, p.z);
      const halo = glowSprite(0xff2a2a, 2.6, 0.55, true);
      halo.position.set(p.x, p.y + 2.1, p.z);
      g.add(body, cap, pole, halo);
      lanternGlow.push(halo);
    } else if (i % 2 === 0) {
      const h = 0.18 + (i % 5) * 0.05;
      const candle = new Mesh(new CylinderGeometry(0.05, 0.06, h, 6), candleMat);
      candle.position.set(p.x, p.y + h / 2, p.z);
      g.add(candle);
      const f = fire(p.x, p.y + h, p.z, 0.1, 1.2);
      g.add(f.group);
      flames.push(f);
    }
  });
  let t = 0;
  return { object: g, footprints: [], update(dt) { t += dt; for (const f of flames) f.update(dt); lanternGlow.forEach((h, i) => { h.material.opacity = 0.45 + Math.sin(t * 2 + i) * 0.1; }); } };
}
type Sprite3 = { update: (dt: number) => void };

/** Crescent-shaped stone statue of a horned giant kneeling with clasped hands, in the dead forest. */
export function kneelingColossus(x: number, z: number, baseY: number, rotY: number): Landmark {
  const g = new Group();
  const rockMat = surface({ vertexColors: true, roughness: 0.95 });
  const part = (geo: BufferGeometry, seed: number) => { const r = rockify(geo, 0.25, 0.4, seed); tintRock(r, 0x46538c, 0x2a7a5a, 0.8, seed); const m = new Mesh(r, rockMat); m.castShadow = true; m.receiveShadow = true; return m; };
  const torso = part(new SphereGeometry(4.2, 18, 12), 410);
  torso.scale.set(1.1, 1.3, 0.9);
  torso.position.set(0, 8, 0);
  const head = part(new SphereGeometry(2.2, 16, 12), 411);
  head.position.set(0, 13.2, 0.6);
  g.add(torso, head);
  const hornMat = surface({ color: 0x1a1428, roughness: 0.6 });
  for (const side of [-1, 1]) {
    const horn = new Mesh(new ConeGeometry(0.5, 4.5, 7), hornMat);
    horn.position.set(side * 2.1, 15.2, 0.2);
    horn.rotation.z = -side * 0.8;
    g.add(horn);
    const shoulder = part(new SphereGeometry(2.2, 14, 10), 412 + side);
    shoulder.position.set(side * 4.6, 11, 0);
    const upperArm = part(new CylinderGeometry(1.2, 1.4, 6, 10, 3), 414 + side);
    upperArm.position.set(side * 5.4, 7.5, 1.5);
    upperArm.rotation.x = -0.6;
    upperArm.rotation.z = side * 0.3;
    const forearm = part(new CylinderGeometry(1.0, 1.2, 5.5, 10, 3), 416 + side);
    forearm.position.set(side * 3.2, 5.6, 4.6);
    forearm.rotation.x = -1.2;
    forearm.rotation.z = -side * 0.9;
    const thigh = part(new CylinderGeometry(1.8, 2.0, 7, 10, 3), 418 + side);
    thigh.position.set(side * 3.0, 2.5, 2.2);
    thigh.rotation.x = Math.PI / 2 - 0.2;
    g.add(shoulder, upperArm, forearm, thigh);
  }
  const hands = part(new SphereGeometry(1.8, 12, 9), 420);
  hands.position.set(0, 5.2, 5.6);
  hands.scale.set(1.4, 0.9, 1);
  g.add(hands);
  const orb = new Mesh(new SphereGeometry(0.8, 12, 9), surface({ color: PALETTE.void, emissive: PALETTE.witch, emissiveIntensity: 2.2 }));
  orb.position.set(0, 6.2, 5.6);
  const orbGlow = glowSprite(PALETTE.witch, 5, 0.5, true);
  orbGlow.position.copy(orb.position);
  g.add(orb, orbGlow);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  let t = 0;
  return { object: g, footprints: [{ kind: 'cyl', x, z, r: 6, top: baseY + 8 }], update(dt) { t += dt; orbGlow.scale.setScalar(5 + Math.sin(t * 1.5) * 0.8); } };
}

/** Flying koi: ribbon-bodied fish swimming lazy loops in the air above the floating islands. */
export function flyingKoi(cx: number, cy: number, cz: number, count: number): Landmark {
  const g = new Group();
  const koi: Array<{ obj: Group; phase: number; r: number; h: number; speed: number; segs: Mesh[] }> = [];
  for (let i = 0; i < count; i++) {
    const fish = new Group();
    const segs: Mesh[] = [];
    const colorA = i % 2 ? 0xffffff : 0xff7a2a;
    for (let k = 0; k < 6; k++) {
      const r = 0.45 * (1 - k / 7);
      const seg = new Mesh(new SphereGeometry(r, 10, 8), surface({ color: k % 2 === 0 ? colorA : 0xff3a10, emissive: k % 2 === 0 ? colorA : 0xff3a10, emissiveIntensity: 0.5, roughness: 0.4 }));
      seg.position.x = -k * 0.5;
      seg.scale.set(1.3, 1, 1);
      fish.add(seg);
      segs.push(seg);
    }
    const tail = new Mesh(new PlaneGeometry(0.9, 0.7), new MeshBasicMaterial({ color: 0xffa070, side: DoubleSide, transparent: true, opacity: 0.8, toneMapped: false }));
    tail.position.x = -3.2;
    fish.add(tail);
    segs.push(tail);
    const halo = glowSprite(0xffb070, 2.2, 0.35, true);
    fish.add(halo);
    g.add(fish);
    koi.push({ obj: fish, phase: (i / count) * Math.PI * 2, r: 14 + (i % 4) * 5, h: cy + (i % 3) * 4, speed: 0.25 + (i % 3) * 0.06, segs });
  }
  let t = 0;
  return {
    object: g, footprints: [],
    update(dt) {
      t += dt;
      for (const k of koi) {
        const a = t * k.speed + k.phase;
        const x = cx + Math.cos(a) * k.r;
        const z = cz + Math.sin(a) * k.r * 0.7;
        const y = k.h + Math.sin(t * 0.9 + k.phase * 3) * 2.5;
        k.obj.position.set(x, y, z);
        k.obj.rotation.y = -a - Math.PI / 2 + Math.PI;
        k.obj.rotation.z = Math.cos(t * 0.9 + k.phase * 3) * 0.3;
        k.segs.forEach((s, i) => { s.position.z = Math.sin(t * 6 + i * 0.7) * 0.18 * i; });
      }
    },
  };
}

/** A snake coiled on the stones that lifts its head when the player is near. */
export function snake(x: number, z: number, y: number): Landmark {
  const g = new Group();
  const mat = surface({ color: 0x0f1a3a, roughness: 0.4, metalness: 0.2 });
  const segs: Mesh[] = [];
  for (let i = 0; i < 26; i++) {
    const a = i * 0.55;
    const r = 1.6 - i * 0.045;
    const seg = new Mesh(new SphereGeometry(0.18 + (1 - i / 26) * 0.1, 8, 6), mat);
    seg.position.set(Math.cos(a) * r, 0.18 + i * 0.012, Math.sin(a) * r);
    g.add(seg);
    segs.push(seg);
  }
  const head = new Mesh(new SphereGeometry(0.3, 10, 8), mat);
  head.scale.set(1.4, 0.8, 1);
  head.position.copy(segs[segs.length - 1].position).add(new Vector3(0.3, 0.1, 0));
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.05, 6, 5), surface({ color: PALETTE.void, emissive: PALETTE.witch, emissiveIntensity: 2 }));
    eye.position.set(0.25, 0.12, side * 0.15);
    head.add(eye);
  }
  g.add(head);
  g.position.set(x, y, z);
  const rest = head.position.clone();
  let t = 0;
  return {
    object: g, footprints: [],
    update(dt, player) {
      t += dt;
      const d = Math.hypot(player.x - x, player.z - z);
      const lift = d < 6 ? 1 : 0;
      head.position.y += ((rest.y + lift * 0.9) - head.position.y) * Math.min(1, dt * 3);
      head.position.x = rest.x + Math.sin(t * 2) * 0.05;
      if (lift) head.lookAt(player.x - x, player.y + 1 - y, player.z - z);
      segs.forEach((s, i) => { s.position.y = 0.18 + i * 0.012 + Math.sin(t * 3 + i * 0.5) * 0.02 * lift; });
    },
  };
}

/**
 * Second batch of reel subjects (from the frames in docs/reference/frames): the log-hauling stone giant that walks
 * the village street, the spider that carries a chapel on its back, the flooded ruin where the Marsh Sovereign
 * waits, the troll's gorge and the boulders that float around the wizard's tower.
 *
 * Every creature here is a procedural stand-in that `World.place(landmark, modelId)` swaps for the Meshy GLB
 * when the file exists; the walking logic and footprints stay the same either way.
 */
import {
  BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh, PlaneGeometry, SphereGeometry, Vector3,
} from 'three';
import { surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import type { Footprint } from './Colliders';
import { rockify, tintRock } from './geometry';
import { glowSprite, type Landmark } from './Landmarks';

type HeightAt = (x: number, z: number) => number;

/** Moves `g` along a closed path at `speed`, facing the next waypoint (+x is forward), with the feet on the ground. */
function pathWalker(g: Group, path: Array<[number, number]>, speed: number, heightAt: HeightAt, lift = 0): (dt: number) => number {
  let seg = 0;
  let along = 0;
  const pos = new Vector3(path[0][0], 0, path[0][1]);
  g.position.copy(pos);
  return (dt) => {
    const a = path[seg];
    const b = path[(seg + 1) % path.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    along += dt * speed;
    if (along >= len) { along = 0; seg = (seg + 1) % path.length; }
    const t = Math.min(1, along / len);
    pos.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
    pos.y = Math.max(heightAt(pos.x, pos.z), -20) + lift;
    g.position.lerp(pos, Math.min(1, dt * 3));
    const yaw = Math.atan2(b[0] - g.position.x, b[1] - g.position.z) - Math.PI / 2;
    g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 1.5);
    return speed;
  };
}

const STONE_BLUE = 0x2a3a7a;
const STONE_DEEP = 0x161c48;

/** The stone giant hauling a bundle of logs through the village at night. Walks a loop; the GLB plays 'walk'. */
export function logGiant(path: Array<[number, number]>, heightAt: HeightAt): Landmark {
  const g = new Group();
  const rock = (geo: BoxGeometry | CylinderGeometry, seed: number) => {
    const r = rockify(geo, 0.12, 0.6, seed);
    tintRock(r, STONE_BLUE, STONE_DEEP, 0.35, seed);
    return new Mesh(r, surface({ vertexColors: true, roughness: 0.75 }));
  };
  const torso = rock(new BoxGeometry(2.2, 3.0, 1.6, 4, 6, 4), 11);
  torso.position.y = 4.4;
  const head = rock(new BoxGeometry(1.1, 1.3, 1.1, 3, 3, 3), 12);
  head.position.set(0.1, 6.5, 0);
  const eyeMat = surface({ color: PALETTE.void, emissive: PALETTE.electric, emissiveIntensity: 2.2 });
  for (const side of [-1, 1]) {
    const eye = new Mesh(new SphereGeometry(0.1, 8, 6), eyeMat);
    eye.position.set(0.62, 6.6, side * 0.28);
    g.add(eye);
  }
  const legs: Group[] = [];
  for (const side of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(0, 3.0, side * 0.65);
    const leg = rock(new BoxGeometry(0.9, 3.0, 0.9, 2, 5, 2), 13 + side);
    leg.position.y = -1.5;
    pivot.add(leg);
    legs.push(pivot);
    g.add(pivot);
    const arm = rock(new BoxGeometry(0.7, 2.8, 0.7, 2, 5, 2), 15 + side);
    arm.position.set(0.3, 4.6, side * 1.45);
    arm.rotation.x = side * -0.55;
    g.add(arm);
  }
  // The log bundle across the shoulders.
  const logMat = surface({ color: 0x3a2f36, roughness: 0.95 });
  const endMat = surface({ color: 0x8a7a70, roughness: 0.9 });
  for (let i = 0; i < 5; i++) {
    const r = 0.38 + (i % 2) * 0.08;
    const log = new Mesh(new CylinderGeometry(r, r, 8.5, 9), logMat);
    log.rotation.x = Math.PI / 2;
    log.position.set(-0.3 + (i % 3) * 0.55, 6.3 + Math.floor(i / 3) * 0.75 + (i % 2) * 0.1, (i - 2) * 0.1);
    log.castShadow = true;
    const cap = new Mesh(new CircleGeometry(r, 9), endMat);
    cap.position.set(log.position.x, log.position.y, log.position.z + 4.26);
    const cap2 = cap.clone();
    cap2.position.z = log.position.z - 4.26;
    cap2.rotation.y = Math.PI;
    g.add(log, cap, cap2);
  }
  g.add(torso, head);
  g.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
  const step = pathWalker(g, path, 1.5, heightAt);
  let phase = 0;
  return {
    object: g,
    footprints: [],
    clip: 'walk',
    update(dt) {
      step(dt);
      phase += dt * 2.6;
      legs[0].rotation.z = Math.sin(phase) * 0.45;
      legs[1].rotation.z = -Math.sin(phase) * 0.45;
      torso.position.y = 4.4 + Math.abs(Math.sin(phase)) * 0.12;
    },
  };
}

/** The spider that carries a chapel on its back along the cliffs. Eight jointed legs; red eyes; lit windows. */
export function spiderChapel(path: Array<[number, number]>, heightAt: HeightAt): Landmark {
  const g = new Group();
  const chitin = surface({ color: 0x1a2342, roughness: 0.55 });
  const body = new Mesh(rockify(new SphereGeometry(4.2, 18, 14), 0.2, 0.5, 41), chitin);
  body.position.set(1.5, 15, 0);
  const abdomen = new Mesh(rockify(new SphereGeometry(5.6, 18, 14), 0.25, 0.4, 42), chitin);
  abdomen.position.set(-5.5, 16.5, 0);
  abdomen.scale.set(1.2, 0.9, 1);
  g.add(body, abdomen);
  const eyeMat = surface({ color: PALETTE.void, emissive: PALETTE.blood, emissiveIntensity: 3 });
  for (const [ex, ey, ez] of [[5.3, 15.6, -0.9], [5.3, 15.6, 0.9], [5.0, 16.3, -0.4], [5.0, 16.3, 0.4]] as const) {
    const eye = new Mesh(new SphereGeometry(0.28, 8, 6), eyeMat);
    eye.position.set(ex, ey, ez);
    const halo = glowSprite(PALETTE.blood, 1.6, 0.6, true);
    halo.position.copy(eye.position);
    g.add(eye, halo);
  }
  // The chapel on its back.
  const stone = surface({ color: 0x4a5584, roughness: 0.85 });
  const roof = surface({ color: 0x3a2432, roughness: 0.9 });
  const nave = new Mesh(new BoxGeometry(9, 6, 6), stone);
  nave.position.set(-5.5, 23.5, 0);
  const naveRoof = new Mesh(new ConeGeometry(4.6, 3.6, 4), roof);
  naveRoof.rotation.y = Math.PI / 4;
  naveRoof.scale.set(1.5, 1, 1.05);
  naveRoof.position.set(-5.5, 28.3, 0);
  const tower = new Mesh(new BoxGeometry(2.8, 9, 2.8), stone);
  tower.position.set(-1.8, 27, 0);
  const spire = new Mesh(new ConeGeometry(2.1, 4.5, 4), roof);
  spire.rotation.y = Math.PI / 4;
  spire.position.set(-1.8, 33.7, 0);
  g.add(nave, naveRoof, tower, spire);
  const windowMat = surface({ color: PALETTE.void, emissive: PALETTE.moon, emissiveIntensity: 1.8 });
  for (let i = 0; i < 4; i++) {
    for (const side of [-1, 1]) {
      const w = new Mesh(new PlaneGeometry(0.7, 1.3), windowMat);
      w.position.set(-8.5 + i * 2.1, 23.6, side * 3.02);
      w.rotation.y = side > 0 ? 0 : Math.PI;
      g.add(w);
    }
  }
  // Eight legs: hip pivot on the body, knee high above, foot on the ground.
  const legs: Array<{ hip: Group; knee: Group; phaseOffset: number }> = [];
  const legMat = surface({ color: 0x141b36, roughness: 0.5 });
  for (let i = 0; i < 8; i++) {
    const side = i < 4 ? -1 : 1;
    const k = i % 4;
    const hip = new Group();
    hip.position.set(3.5 - k * 2.6, 14.5, side * 3.2);
    const upper = new Mesh(new CylinderGeometry(0.45, 0.6, 13, 8), legMat);
    upper.position.y = 6.5;
    const knee = new Group();
    knee.position.y = 13;
    const lower = new Mesh(new CylinderGeometry(0.25, 0.42, 20, 8), legMat);
    lower.position.y = -10;
    knee.add(lower);
    hip.add(upper, knee);
    hip.rotation.x = side * -1.05 - k * 0.04;
    hip.rotation.z = (k - 1.5) * 0.35;
    knee.rotation.x = side * 1.95;
    g.add(hip);
    legs.push({ hip, knee, phaseOffset: (i % 2 === 0 ? 0 : Math.PI) + k * 0.4 });
  }
  g.traverse((o) => { if ((o as Mesh).isMesh) o.castShadow = true; });
  const step = pathWalker(g, path, 2.4, heightAt, -0.5);
  let phase = 0;
  return {
    object: g,
    footprints: [],
    clip: 'walk',
    update(dt) {
      step(dt);
      phase += dt * 2.2;
      for (const l of legs) {
        const s = Math.sin(phase + l.phaseOffset);
        l.hip.rotation.y = s * 0.22;
        l.knee.rotation.x = (l.hip.position.z < 0 ? 1.95 : -1.95) * (1 - Math.max(0, s) * 0.12);
      }
      body.position.y = 15 + Math.sin(phase * 2) * 0.15;
    },
  };
}

/** A shallow flooded ruin: dark water, a ring of broken columns and a fallen wall. Home of the Marsh Sovereign. */
export function floodedRuin(x: number, z: number, y: number, radius = 24): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const water = new Mesh(new CircleGeometry(radius, 40), surface({ color: 0x0a1240, emissive: 0x1b2a6b, emissiveIntensity: 0.55, roughness: 0.15, transparent: true, opacity: 0.8 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(x, y + 0.3, z);
  g.add(water);
  const colMat = surface({ vertexColors: true, roughness: 0.9 });
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3;
    const r = radius * (0.55 + ((i * 37) % 10) / 25);
    const h = 4 + ((i * 53) % 9);
    const geo = rockify(new CylinderGeometry(1.0, 1.25, h, 10, 4), 0.1, 0.9, 60 + i);
    tintRock(geo, 0x3b4a86, 0x1f4d46, 0.3, 60 + i);
    const col = new Mesh(geo, colMat);
    col.position.set(x + Math.cos(a) * r, y + h / 2 - 0.4, z + Math.sin(a) * r);
    col.rotation.z = ((i % 3) - 1) * 0.08;
    col.castShadow = true;
    g.add(col);
    footprints.push({ kind: 'cyl', x: col.position.x, z: col.position.z, r: 1.4, top: y + h - 0.4 });
    if (i % 3 === 0) {
      const cap = new Mesh(rockify(new BoxGeometry(3.2, 1.0, 3.2, 3, 1, 3), 0.1, 0.9, 80 + i), colMat);
      tintRock(cap.geometry, 0x3b4a86, 0x1f4d46, 0.2, 80 + i);
      cap.position.set(col.position.x, y + h + 0.1, col.position.z);
      g.add(cap);
    }
  }
  const wallGeo = rockify(new BoxGeometry(22, 7, 2.4, 10, 4, 2), 0.18, 0.5, 91);
  tintRock(wallGeo, 0x34427a, 0x1f4d46, 0.35, 91);
  const wall = new Mesh(wallGeo, colMat);
  wall.position.set(x - radius * 0.2, y + 3.0, z - radius * 0.95);
  wall.rotation.y = 0.25;
  wall.castShadow = true;
  g.add(wall);
  footprints.push({ kind: 'box', x: wall.position.x, z: wall.position.z, hw: 11, hd: 1.2, top: y + 6.5, rotY: 0.25 });
  const arch = new Mesh(wallGeo.clone(), colMat);
  arch.scale.set(0.5, 1.4, 1);
  arch.position.set(x + radius * 0.8, y + 4.2, z + radius * 0.3);
  arch.rotation.y = -1.1;
  g.add(arch);
  footprints.push({ kind: 'box', x: arch.position.x, z: arch.position.z, hw: 5.5, hd: 1.2, top: y + 9, rotY: -1.1 });
  return { object: g, footprints };
}

/** Two rock walls that turn the chasm edge into the troll's gorge. The path runs along x between them. */
export function trollGorge(x: number, z: number, y: number, length = 44): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const mat = surface({ vertexColors: true, roughness: 0.85 });
  for (const [side, seed] of [[-1, 101], [1, 102]] as const) {
    const geo = rockify(new BoxGeometry(length, 15, 7, 14, 6, 3), 0.9, 0.25, seed);
    tintRock(geo, 0x2b3878, 0x1f4d46, 0.25, seed);
    const wall = new Mesh(geo, mat);
    wall.position.set(x + side * 4, y + 6.5, z + side * 11);
    wall.rotation.y = side * 0.12;
    wall.castShadow = true;
    wall.receiveShadow = true;
    g.add(wall);
    footprints.push({ kind: 'box', x: wall.position.x, z: wall.position.z, hw: length / 2, hd: 3.5, top: y + 14, rotY: side * 0.12 });
  }
  for (let i = 0; i < 9; i++) {
    const geo = rockify(new DodecahedronGeometry(0.9 + (i % 3) * 0.5, 1), 0.25, 0.9, 110 + i);
    tintRock(geo, 0x2b3878, 0x1f4d46, 0.3, 110 + i);
    const rock = new Mesh(geo, mat);
    rock.position.set(x - length * 0.42 + i * (length * 0.84 / 8), y + 0.4, z + ((i * 7) % 5 - 2) * 1.6);
    rock.castShadow = true;
    g.add(rock);
  }
  return { object: g, footprints };
}

/** Boulders drifting around a tower on a cloud-sea rock, slowly orbiting and bobbing. */
export function floatingRocks(x: number, z: number, y: number, count = 14): Landmark {
  const g = new Group();
  const mat = surface({ vertexColors: true, roughness: 0.9 });
  const rocks: Array<{ mesh: Mesh; radius: number; angle: number; speed: number; height: number; bob: number }> = [];
  for (let i = 0; i < count; i++) {
    const size = 1.4 + ((i * 29) % 7) * 0.5;
    const geo = rockify(new DodecahedronGeometry(size, 1), 0.35, 0.7, 130 + i);
    tintRock(geo, 0x2f3b80, 0x22305e, 0.15, 130 + i);
    const mesh = new Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.rotation.set(i * 0.7, i * 1.3, i * 0.4);
    g.add(mesh);
    rocks.push({ mesh, radius: 16 + ((i * 41) % 30), angle: (i / count) * Math.PI * 2, speed: 0.03 + ((i * 13) % 5) * 0.012, height: y + 8 + ((i * 23) % 62), bob: i * 1.1 });
  }
  let t = 0;
  return {
    object: g,
    footprints: [],
    update(dt) {
      t += dt;
      for (const r of rocks) {
        r.angle += dt * r.speed;
        r.mesh.position.set(x + Math.cos(r.angle) * r.radius, r.height + Math.sin(t * 0.4 + r.bob) * 1.2, z + Math.sin(r.angle) * r.radius);
        r.mesh.rotation.y += dt * 0.08;
      }
    },
  };
}

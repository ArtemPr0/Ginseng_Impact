import {
  BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Points,
  PointsMaterial, RepeatWrapping, SphereGeometry, TorusGeometry, Vector3, AdditiveBlending,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Rig } from '../characters/Rig';
import type { CharacterDef } from '../characters/roster';
import { PALETTE } from '../render/palette';
import { surface } from '../render/Materials';
import type { Footprint } from './Colliders';
import type { Placement } from './Flora';
import { rockify, tintRock } from './geometry';
import { glowSprite, glowTexture, type Landmark } from './Landmarks';
import { riverPoint } from './Water';
import { RIVER_LEVEL } from './Terrain';

export { FIRE, EMBER, fire } from './Fire';
import { FIRE, fire } from './Fire';

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** Torch on a post. */
export function torch(x: number, y: number, z: number): { group: Group; update: (dt: number) => void } {
  const post = new Mesh(new CylinderGeometry(0.06, 0.08, 2.2, 7), surface({ color: PALETTE.bark }));
  post.position.set(x, y + 1.1, z);
  const f = fire(x, y + 2.1, z, 0.45, 9);
  f.group.add(post);
  return f;
}

/** Cobblestone path: a strip of flattened rounded stones along a polyline. */
export function cobblePath(points: Array<[number, number]>, width: number, heightAt: (x: number, z: number) => number, rnd: () => number): InstancedMesh {
  const stone = rockify(new BoxGeometry(0.55, 0.14, 0.42, 3, 1, 3), 0.03, 2, 7);
  tintRock(stone, 0x3a4680, 0x1f4d46, 0.5, 11);
  const spots: Placement[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const tx = (bx - ax) / len;
    const tz = (bz - az) / len;
    for (let d = 0; d < len; d += 0.52) {
      for (let w = -width / 2; w < width / 2; w += 0.5) {
        const x = ax + tx * d - tz * w + (rnd() - 0.5) * 0.12;
        const z = az + tz * d + tx * w + (rnd() - 0.5) * 0.12;
        spots.push({ x, y: heightAt(x, z) + 0.04, z, yaw: Math.atan2(tz, tx) + (rnd() - 0.5) * 0.3, scale: 0.85 + rnd() * 0.35 });
      }
    }
  }
  const mesh = new InstancedMesh(stone, surface({ vertexColors: true, roughness: 0.8 }), spots.length);
  const dummy = new Object3D();
  const m = new Matrix4();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.set(s.scale, 1, s.scale);
    dummy.updateMatrix();
    m.copy(dummy.matrix);
    mesh.setMatrixAt(i, m);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Thatched house: stone walls, hip roof of straw, glowing window, chimney. */
function house(x: number, z: number, y: number, w: number, d: number, rotY: number, seed: number): { group: Group; footprints: Footprint[] } {
  const g = new Group();
  const wallGeo = rockify(new BoxGeometry(w, 3.2, d, 4, 3, 4), 0.05, 0.5, seed);
  tintRock(wallGeo, 0x2b3466, 0x1f4d46, 0.35, seed);
  const walls = new Mesh(wallGeo, surface({ vertexColors: true }));
  walls.position.y = 1.6;
  walls.castShadow = true;
  walls.receiveShadow = true;
  const roof = new Mesh(new ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4), surface({ color: 0x3a3524, roughness: 1 }));
  roof.position.y = 3.2 + 1.3;
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(w / Math.max(w, d), 1, d / Math.max(w, d));
  roof.castShadow = true;
  const straw = new Mesh(new ConeGeometry(Math.max(w, d) * 0.82, 0.5, 4), surface({ color: 0x4a4330, roughness: 1 }));
  straw.position.y = 3.2 + 0.1;
  straw.rotation.y = Math.PI / 4;
  straw.scale.copy(roof.scale);
  const window = new Mesh(new PlaneGeometry(0.7, 0.9), new MeshBasicMaterial({ color: new Color(FIRE).multiplyScalar(0.9), toneMapped: false }));
  window.position.set(w * 0.2, 1.7, d / 2 + 0.02);
  const door = new Mesh(new BoxGeometry(0.9, 2, 0.1), surface({ color: 0x1a1428 }));
  door.position.set(-w * 0.25, 1, d / 2 + 0.02);
  const chimney = new Mesh(new BoxGeometry(0.5, 1.6, 0.5), surface({ color: 0x2b3466 }));
  chimney.position.set(-w * 0.3, 4.6, -d * 0.2);
  g.add(walls, roof, straw, window, door, chimney);
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  return { group: g, footprints: [{ kind: 'box', x, z, hw: w / 2, hd: d / 2, top: y + 3.2, rotY }] };
}

/** Village street with thatched houses, torches, barrels and a well. */
export function village(cx: number, cz: number, heightAt: (x: number, z: number) => number): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const rnd = rng(909);
  const fires: Array<{ update: (dt: number) => void }> = [];
  const houses: Array<[number, number, number, number, number]> = [
    [-26, -9, 6, 5, 0.05], [-14, -10, 5, 5, -0.08], [-2, -9, 7, 5, 0.03], [10, -10, 5, 6, 0.1], [22, -9, 6, 5, -0.05],
    [-22, 11, 6, 5, Math.PI + 0.05], [-8, 12, 5, 5, Math.PI - 0.06], [6, 11, 7, 5, Math.PI + 0.02], [20, 12, 5, 5, Math.PI - 0.1],
  ];
  houses.forEach(([dx, dz, w, d, rot], i) => {
    const h = house(cx + dx, cz + dz, heightAt(cx + dx, cz + dz) - 0.2, w, d, rot, 300 + i);
    g.add(h.group);
    footprints.push(...h.footprints);
  });
  for (let dx = -28; dx <= 28; dx += 14) {
    for (const dz of [-5.5, 7.5]) {
      const t = torch(cx + dx, heightAt(cx + dx, cz + dz), cz + dz);
      g.add(t.group);
      fires.push(t);
    }
  }
  g.add(cobblePath([[cx - 34, cz + 1], [cx + 34, cz + 1]], 5, heightAt, rnd));
  // Well.
  const wellY = heightAt(cx + 4, cz + 1);
  const ring = new Mesh(new TorusGeometry(1.1, 0.35, 8, 16), surface({ color: 0x3a4680 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(cx + 4, wellY + 0.5, cz + 1);
  const wellWater = new Mesh(new CircleGeometry(0.9, 16), new MeshBasicMaterial({ color: PALETTE.electric, toneMapped: false }));
  wellWater.rotation.x = -Math.PI / 2;
  wellWater.position.set(cx + 4, wellY + 0.3, cz + 1);
  g.add(ring, wellWater);
  footprints.push({ kind: 'cyl', x: cx + 4, z: cz + 1, r: 1.4, top: wellY + 0.9 });
  // Barrels.
  for (let i = 0; i < 7; i++) {
    const bx = cx + (rnd() - 0.5) * 56;
    const bz = cz + (rnd() < 0.5 ? -6.5 : 8.5);
    const b = new Mesh(new CylinderGeometry(0.45, 0.4, 1.1, 10), surface({ color: 0x3a2e24 }));
    b.position.set(bx, heightAt(bx, bz) + 0.55, bz);
    b.castShadow = true;
    g.add(b);
    footprints.push({ kind: 'cyl', x: bx, z: bz, r: 0.5, top: heightAt(bx, bz) + 1.1 });
  }
  g.position.y = 0;
  return { object: g, footprints, update: (dt) => fires.forEach((f) => f.update(dt)) };
}

/** Tavern: a tall timbered inn with lanterns, a round table with two stools and mugs, under the moon. */
export function tavern(x: number, z: number, heightAt: (x: number, z: number) => number): Landmark & { seats: Array<{ x: number; z: number; yaw: number }> } {
  const g = new Group();
  const footprints: Footprint[] = [];
  const y = heightAt(x, z) - 0.2;
  const fires: Array<{ update: (dt: number) => void }> = [];
  const base = house(x, z - 6, y, 12, 9, 0, 777);
  base.group.children.forEach((c) => { if (c instanceof Mesh && c.geometry instanceof ConeGeometry) c.position.y += 2.2; });
  (base.group.children[0] as Mesh).scale.y = 1.7;
  (base.group.children[0] as Mesh).position.y = 1.6 * 1.7;
  g.add(base.group);
  footprints.push({ kind: 'box', x, z: z - 6, hw: 6, hd: 4.5, top: y + 5.4 });
  // Timber frame lines.
  const beam = surface({ color: 0x1a1428 });
  for (let i = -2; i <= 2; i++) {
    const b = new Mesh(new BoxGeometry(0.18, 5.4, 0.12), beam);
    b.position.set(x + i * 2.6, y + 2.7, z - 6 + 4.55);
    g.add(b);
  }
  const sign = new Mesh(new BoxGeometry(1.6, 0.9, 0.08), surface({ color: 0x3a2e24 }));
  sign.position.set(x + 3.5, y + 3.6, z - 6 + 4.6);
  const signText = new Mesh(new CircleGeometry(0.3, 16), new MeshBasicMaterial({ color: PALETTE.moon, toneMapped: false }));
  signText.position.set(x + 3.5, y + 3.6, z - 6 + 4.66);
  g.add(sign, signText);
  for (const lx of [-4.5, 4.5]) {
    const lantern = fire(x + lx, y + 3.0, z - 6 + 4.7, 0.35, 10);
    const cage = new Mesh(new BoxGeometry(0.4, 0.55, 0.4), surface({ color: 0x1a1428, transparent: true, opacity: 0.35 }));
    cage.position.set(x + lx, y + 3.2, z - 6 + 4.7);
    lantern.group.add(cage);
    g.add(lantern.group);
    fires.push(lantern);
  }
  // Table and stools in front.
  const table = new Mesh(new CylinderGeometry(1.1, 1.1, 0.12, 16), surface({ color: 0x4a3a2a, roughness: 0.7 }));
  table.position.set(x, y + 0.95, z + 2);
  table.castShadow = true;
  const leg = new Mesh(new CylinderGeometry(0.12, 0.16, 0.9, 8), surface({ color: 0x3a2e24 }));
  leg.position.set(x, y + 0.45, z + 2);
  g.add(table, leg);
  footprints.push({ kind: 'cyl', x, z: z + 2, r: 1.2, top: y + 1.0 });
  const seats = [{ x: x - 1.6, z: z + 2.2, yaw: 0 }, { x: x + 1.6, z: z + 2.2, yaw: Math.PI }];
  for (const s of seats) {
    const stool = new Mesh(new CylinderGeometry(0.32, 0.28, 0.5, 10), surface({ color: 0x3a2e24 }));
    stool.position.set(s.x, y + 0.25, s.z);
    g.add(stool);
  }
  for (const [mx, mz] of [[-0.45, 1.8], [0.5, 2.1], [0.1, 2.5]] as const) {
    const mug = new Mesh(new CylinderGeometry(0.11, 0.1, 0.22, 8), surface({ color: 0x8d7a5a, roughness: 0.5 }));
    mug.position.set(x + mx, y + 1.12, z + mz);
    const foam = new Mesh(new CylinderGeometry(0.11, 0.11, 0.05, 8), surface({ color: 0xf0e6c8 }));
    foam.position.set(x + mx, y + 1.25, z + mz);
    g.add(mug, foam);
  }
  const t1 = torch(x - 7, heightAt(x - 7, z + 4), z + 4);
  const t2 = torch(x + 7, heightAt(x + 7, z + 4), z + 4);
  g.add(t1.group, t2.group);
  fires.push(t1, t2);
  return { object: g, footprints, seats, update: (dt) => fires.forEach((f) => f.update(dt)) };
}

/** Campfire ring with a hanging kettle on a tripod, and three log seats. */
export function campfire(x: number, z: number, heightAt: (x: number, z: number) => number): Landmark & { seats: Array<{ x: number; z: number; yaw: number }> } {
  const g = new Group();
  const y = heightAt(x, z);
  const ring = new Mesh(new TorusGeometry(1.0, 0.22, 8, 14), surface({ color: 0x3a4680 }));
  ring.rotation.x = Math.PI / 2;
  ring.position.set(x, y + 0.15, z);
  g.add(ring);
  const logMat = surface({ color: 0x2a2018 });
  for (let i = 0; i < 4; i++) {
    const log = new Mesh(new CylinderGeometry(0.1, 0.12, 1.2, 7), logMat);
    log.position.set(x, y + 0.35, z);
    log.rotation.z = 0.9;
    log.rotation.y = (i / 4) * Math.PI;
    g.add(log);
  }
  const f = fire(x, y + 0.25, z, 1.5, 34);
  g.add(f.group);
  const tripod = surface({ color: 0x1a1428 });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    const pole = new Mesh(new CylinderGeometry(0.04, 0.05, 3.2, 6), tripod);
    pole.position.set(x + Math.cos(a) * 0.7, y + 1.5, z + Math.sin(a) * 0.7);
    pole.rotation.z = -Math.cos(a) * 0.4;
    pole.rotation.x = Math.sin(a) * 0.4;
    g.add(pole);
  }
  const kettle = new Mesh(new SphereGeometry(0.42, 14, 10), surface({ color: 0x2a2a3a, roughness: 0.5, metalness: 0.6 }));
  kettle.scale.y = 0.8;
  kettle.position.set(x, y + 1.6, z);
  const spout = new Mesh(new CylinderGeometry(0.05, 0.08, 0.5, 6), kettle.material);
  spout.position.set(x + 0.45, y + 1.75, z);
  spout.rotation.z = -0.9;
  const handle = new Mesh(new TorusGeometry(0.3, 0.03, 6, 12, Math.PI), kettle.material);
  handle.position.set(x, y + 1.95, z);
  const chain = new Mesh(new CylinderGeometry(0.02, 0.02, 1.0, 4), tripod);
  chain.position.set(x, y + 2.6, z);
  g.add(kettle, spout, handle, chain);
  const seats: Array<{ x: number; z: number; yaw: number }> = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.5;
    const sx = x + Math.cos(a) * 2.4;
    const sz = z + Math.sin(a) * 2.4;
    const seat = new Mesh(new CylinderGeometry(0.28, 0.28, 1.4, 8), logMat);
    seat.rotation.z = Math.PI / 2;
    seat.rotation.y = a + Math.PI / 2;
    seat.position.set(sx, heightAt(sx, sz) + 0.28, sz);
    g.add(seat);
    seats.push({ x: sx, z: sz, yaw: Math.atan2(z - sz, x - sx) });
  }
  // Steam from the kettle.
  const steam = glowSprite(0x8fa2ff, 1.6, 0.18, true);
  steam.position.set(x, y + 2.5, z);
  g.add(steam);
  let t = 0;
  return {
    object: g, footprints: [{ kind: 'cyl', x, z, r: 1.2, top: y + 0.4 }], seats,
    update(dt) { t += dt; f.update(dt); steam.position.y = y + 2.4 + Math.sin(t) * 0.2; steam.scale.setScalar(1.6 + Math.sin(t * 0.7) * 0.4); },
  };
}

/** Cloister: three stone arches on a cobbled floor with a kneeling knight's spot. */
export function cloister(x: number, z: number, heightAt: (x: number, z: number) => number): Landmark & { kneel: { x: number; z: number } } {
  const g = new Group();
  const y = heightAt(x, z);
  const rnd = rng(55);
  g.add(cobblePath([[x - 9, z], [x + 9, z]], 7, heightAt, rnd));
  const mat = surface({ vertexColors: true });
  for (let i = -1; i <= 1; i++) {
    const ax = x + i * 5.5;
    for (const side of [-1, 1]) {
      const geo = rockify(new CylinderGeometry(0.55, 0.65, 5, 12, 4), 0.06, 0.6, 60 + i * 3 + side);
      tintRock(geo, 0x3a4478, 0x1f4d46, 0.45, 60 + i);
      const col = new Mesh(geo, mat);
      col.position.set(ax + side * 2.4, y + 2.5, z - 3.5);
      col.castShadow = true;
      g.add(col);
    }
    const archGeo = rockify(new TorusGeometry(2.4, 0.55, 8, 18, Math.PI), 0.05, 0.6, 70 + i);
    tintRock(archGeo, 0x3a4478, 0x1f4d46, 0.35, 70 + i);
    const arch = new Mesh(archGeo, mat);
    arch.position.set(ax, y + 5, z - 3.5);
    arch.castShadow = true;
    g.add(arch);
  }
  const lintel = new Mesh(new BoxGeometry(17, 0.8, 1.4), surface({ color: 0x2f3868 }));
  lintel.position.set(x, y + 8.2, z - 3.5);
  lintel.castShadow = true;
  g.add(lintel);
  return { object: g, footprints: [{ kind: 'box', x, z: z - 3.5, hw: 8.5, hd: 0.7, top: y + 8.6 }], kneel: { x, z: z + 1 } };
}

/** Gnome observatory: a giant mushroom hut with a stone-tile cap, a round door, a balcony and a brass telescope. */
export function observatory(x: number, z: number, heightAt: (x: number, z: number) => number): Landmark & { perch: { x: number; z: number; y: number } } {
  const g = new Group();
  const y = heightAt(x, z);
  const stemGeo = rockify(new CylinderGeometry(2.6, 3.4, 6, 18, 5), 0.18, 0.5, 81);
  tintRock(stemGeo, 0x4a4a8a, 0x1f4d46, 0.5, 81);
  const stem = new Mesh(stemGeo, surface({ vertexColors: true }));
  stem.position.set(x, y + 3, z);
  stem.castShadow = true;
  const capGeo = rockify(new SphereGeometry(6.5, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), 0.25, 0.6, 82);
  tintRock(capGeo, 0x3a3a7a, 0x3a7a8a, 0.8, 82);
  const cap = new Mesh(capGeo, surface({ vertexColors: true, side: DoubleSide }));
  cap.position.set(x, y + 4.2, z);
  cap.castShadow = true;
  const door = new Mesh(new CircleGeometry(1.1, 18), new MeshBasicMaterial({ color: new Color(FIRE).multiplyScalar(0.7), toneMapped: false }));
  door.position.set(x, y + 1.6, z + 3.35);
  for (let i = 0; i < 3; i++) {
    const w = new Mesh(new CircleGeometry(0.35, 12), new MeshBasicMaterial({ color: new Color(FIRE).multiplyScalar(0.8), toneMapped: false }));
    const a = -0.9 + i * 0.9;
    w.position.set(x + Math.sin(a) * 3.2, y + 3.4, z + Math.cos(a) * 3.2);
    w.rotation.y = a;
    g.add(w);
  }
  // Balcony on the cap with a telescope.
  const deck = new Mesh(new CylinderGeometry(2.2, 2.2, 0.3, 16), surface({ color: 0x3a2e24 }));
  deck.position.set(x, y + 10.2, z);
  const rail = new Mesh(new TorusGeometry(2.2, 0.06, 6, 24), surface({ color: 0x1a1428 }));
  rail.rotation.x = Math.PI / 2;
  rail.position.set(x, y + 11.1, z);
  const tripod = new Mesh(new CylinderGeometry(0.08, 0.12, 1.3, 6), surface({ color: 0x1a1428 }));
  tripod.position.set(x + 0.6, y + 11.0, z - 0.4);
  const scope = new Mesh(new CylinderGeometry(0.16, 0.24, 2.2, 10), surface({ color: 0x8a6a2a, roughness: 0.3, metalness: 0.8 }));
  scope.position.set(x + 0.6, y + 11.9, z - 0.9);
  scope.rotation.x = -0.9;
  scope.rotation.z = 0.2;
  g.add(stem, cap, door, deck, rail, tripod, scope);
  // Spore glow.
  const halo = glowSprite(PALETTE.rune, 10, 0.18, true);
  halo.position.set(x, y + 6, z);
  g.add(halo);
  return {
    object: g,
    footprints: [{ kind: 'cyl', x, z, r: 3.2, top: y + 10.4 }],
    perch: { x: x - 0.4, z: z + 0.3, y: y + 10.35 },
  };
}

/** Throne of antlers and bone on a dais, flanked by candle clusters and braziers. */
export function throneHall(x: number, z: number, y: number, rotY: number): Landmark & { seat: { x: number; z: number; yaw: number } } {
  const g = new Group();
  const fires: Array<{ update: (dt: number) => void }> = [];
  const daisGeo = rockify(new BoxGeometry(9, 1.2, 7, 6, 2, 5), 0.04, 0.6, 91);
  tintRock(daisGeo, 0x2b3466, 0x1f4d46, 0.2, 91);
  const dais = new Mesh(daisGeo, surface({ vertexColors: true }));
  dais.position.y = 0.6;
  dais.receiveShadow = true;
  g.add(dais);
  const bone = surface({ color: 0xd8dcf0, roughness: 0.85 });
  const antler = surface({ color: 0x3a2e24, roughness: 0.9 });
  const seatBox = new Mesh(new BoxGeometry(2.0, 0.6, 1.6), surface({ color: 0x4a1020 }));
  seatBox.position.set(0, 1.5, -1.2);
  const back = new Mesh(new BoxGeometry(2.2, 3.2, 0.5), surface({ color: 0x2a1a2a }));
  back.position.set(0, 3.2, -2.0);
  g.add(seatBox, back);
  for (let i = 0; i < 14; i++) {
    const a = -1.2 + (i / 13) * 2.4;
    const h = 1.5 + Math.abs(Math.sin(i * 1.7)) * 2.6;
    const tine = new Mesh(new CylinderGeometry(0.03, 0.07, h, 5), i % 3 === 0 ? bone : antler);
    tine.position.set(Math.sin(a) * 1.3, 4.6 + h / 2 - 0.6, -2.0 - Math.cos(a) * 0.3);
    tine.rotation.z = -a * 0.6;
    tine.rotation.x = -0.25;
    g.add(tine);
  }
  for (const side of [-1, 1]) {
    const arm = new Mesh(new BoxGeometry(0.3, 0.6, 1.5), antler);
    arm.position.set(side * 1.05, 2.0, -1.2);
    const skull = new Mesh(new SphereGeometry(0.22, 10, 8), bone);
    skull.position.set(side * 1.05, 2.45, -0.55);
    g.add(arm, skull);
    for (let k = 0; k < 7; k++) {
      const cx = side * (2.8 + (k % 3) * 0.35);
      const cz = -2.2 + k * 0.5;
      const ch = 0.3 + ((k * 7) % 5) * 0.12;
      const candle = new Mesh(new CylinderGeometry(0.05, 0.06, ch, 6), surface({ color: 0xf0e6c8 }));
      candle.position.set(cx, 1.2 + ch / 2, cz);
      g.add(candle);
      const flame = fire(cx, 1.2 + ch, cz, 0.12, 2.2);
      g.add(flame.group);
      fires.push(flame);
    }
    const brazier = new Mesh(new CylinderGeometry(0.5, 0.35, 0.8, 10), surface({ color: 0x1a1428, metalness: 0.6, roughness: 0.4 }));
    brazier.position.set(side * 4.2, 1.6, 1.8);
    g.add(brazier);
    const bf = fire(side * 4.2, 2.0, 1.8, 0.7, 16);
    g.add(bf.group);
    fires.push(bf);
  }
  g.position.set(x, y, z);
  g.rotation.y = rotY;
  const seatWorld = new Vector3(0, 0, -1.2).applyAxisAngle(new Vector3(0, 1, 0), rotY).add(new Vector3(x, 0, z));
  return {
    object: g,
    footprints: [{ kind: 'box', x, z, hw: 4.5, hd: 3.5, top: y + 1.2, rotY }],
    seat: { x: seatWorld.x, z: seatWorld.z, yaw: rotY + Math.PI / 2 },
    update: (dt) => fires.forEach((f) => f.update(dt)),
  };
}

/** Rowing boat with two armoured knights, drifting the river loop. */
export function boat(startS: number, speed: number): Landmark {
  const g = new Group();
  const hullGeo = new BoxGeometry(5.2, 0.9, 1.9, 6, 1, 3);
  const hp = hullGeo.attributes.position as BufferAttribute;
  for (let i = 0; i < hp.count; i++) {
    const px = hp.getX(i);
    const taper = 1 - Math.pow(Math.abs(px) / 2.6, 2.2) * 0.7;
    hp.setZ(i, hp.getZ(i) * taper);
    if (hp.getY(i) < 0) hp.setZ(i, hp.getZ(i) * 0.6);
  }
  hullGeo.computeVertexNormals();
  const hull = new Mesh(hullGeo, surface({ color: 0x3a2e24, roughness: 0.9 }));
  hull.castShadow = true;
  g.add(hull);
  const inner = new Mesh(new BoxGeometry(4.6, 0.5, 1.4), surface({ color: 0x1a1428 }));
  inner.position.y = 0.3;
  g.add(inner);
  for (const dx of [-1.2, 0.8]) {
    const bench = new Mesh(new BoxGeometry(0.4, 0.1, 1.6), surface({ color: 0x4a3a2a }));
    bench.position.set(dx, 0.5, 0);
    g.add(bench);
  }
  const lantern = fire(2.3, 1.2, 0, 0.3, 8);
  const pole = new Mesh(new CylinderGeometry(0.04, 0.04, 1.2, 6), surface({ color: 0x1a1428 }));
  pole.position.set(2.3, 0.9, 0);
  g.add(lantern.group, pole);
  const knight: CharacterDef = { id: 'rower', name: 'Rower', title: '', element: 'fog', weapon: 'sword', maxHp: 1, atk: 1, look: { cloth: 0x0f1430, armour: 0x1e2246, skin: 0x8c93b8, accent: PALETTE.electric, bulk: 1.15, height: 1.85 } };
  const rowers = [new Rig(knight), new Rig({ ...knight, id: 'rower2' })];
  rowers.forEach((r, i) => {
    r.root.position.set(i === 0 ? -1.2 : 0.8, 0.25, 0);
    r.root.rotation.y = -Math.PI / 2;
    g.add(r.root);
  });
  const oars: Mesh[] = [];
  for (const side of [-1, 1]) {
    for (const dx of [-1.2, 0.8]) {
      const oar = new Mesh(new CylinderGeometry(0.04, 0.05, 3.2, 6), surface({ color: 0x4a3a2a }));
      oar.position.set(dx, 0.75, side * 1.0);
      oar.rotation.x = side * 1.0;
      g.add(oar);
      oars.push(oar);
    }
  }
  let s = startS;
  let t = 0;
  return {
    object: g,
    footprints: [],
    update(dt) {
      t += dt;
      s += dt * speed;
      const p = riverPoint(-s);
      g.position.set(p.x, RIVER_LEVEL + 0.05 + Math.sin(t * 1.4) * 0.06, p.z);
      g.rotation.y = -p.yaw;
      g.rotation.z = Math.sin(t * 1.1) * 0.03;
      lantern.update(dt);
      const r = Math.sin(t * 2.2);
      oars.forEach((o, i) => { const side = i < 2 ? -1 : 1; o.rotation.x = side * (1.0 + r * 0.35); o.rotation.y = r * 0.35; });
      for (const rw of rowers) rw.animate({ mode: 'ground', speed: 0, pose: 'row' }, dt);
    },
  };
}

/** A horse with a lantern-bearing knight riding a looping path. */
export function rider(path: Array<[number, number]>, speed: number, heightAt: (x: number, z: number) => number): Landmark {
  const g = new Group();
  const coat = surface({ color: 0x0b0f2e, roughness: 0.8 });
  const body = new Mesh(new BoxGeometry(1.9, 0.9, 0.8, 4, 2, 2), coat);
  const bp = body.geometry.attributes.position as BufferAttribute;
  for (let i = 0; i < bp.count; i++) bp.setY(i, bp.getY(i) * (1 - Math.pow(Math.abs(bp.getX(i)) / 0.95, 3) * 0.3));
  body.geometry.computeVertexNormals();
  body.position.y = 1.35;
  body.castShadow = true;
  const neck = new Mesh(new BoxGeometry(0.55, 1.0, 0.45), coat);
  neck.position.set(1.0, 1.95, 0);
  neck.rotation.z = -0.6;
  const head = new Mesh(new BoxGeometry(0.7, 0.4, 0.35), coat);
  head.position.set(1.5, 2.35, 0);
  head.rotation.z = -0.3;
  const mane = new Mesh(new BoxGeometry(0.9, 0.3, 0.12), surface({ color: 0x05060f }));
  mane.position.set(0.9, 2.2, 0);
  mane.rotation.z = -0.6;
  const tail = new Mesh(new BoxGeometry(0.15, 0.9, 0.15), surface({ color: 0x05060f }));
  tail.position.set(-1.0, 1.0, 0);
  tail.rotation.z = 0.5;
  g.add(body, neck, head, mane, tail);
  const legs: Group[] = [];
  for (const [lx, lz] of [[0.65, -0.3], [0.65, 0.3], [-0.65, -0.3], [-0.65, 0.3]] as const) {
    const pivot = new Group();
    pivot.position.set(lx, 1.05, lz);
    const upper = new Mesh(new CylinderGeometry(0.11, 0.09, 0.6, 7), coat);
    upper.position.y = -0.3;
    const lower = new Mesh(new CylinderGeometry(0.08, 0.07, 0.55, 7), coat);
    lower.position.y = -0.85;
    const hoof = new Mesh(new CylinderGeometry(0.09, 0.1, 0.12, 7), surface({ color: 0x05060f }));
    hoof.position.y = -1.1;
    pivot.add(upper, lower, hoof);
    g.add(pivot);
    legs.push(pivot);
  }
  const saddle = new Mesh(new BoxGeometry(0.7, 0.15, 0.6), surface({ color: 0x3a2e24 }));
  saddle.position.set(0, 1.85, 0);
  g.add(saddle);
  const knight = new Rig({ id: 'rider', name: 'Rider', title: '', element: 'fog', weapon: 'sword', maxHp: 1, atk: 1, look: { cloth: 0x14183a, armour: 0x2a3160, skin: 0x8c93b8, accent: PALETTE.electric, cape: true, bulk: 1.1, height: 1.85 } });
  knight.root.position.set(0, 1.55, 0);
  knight.root.rotation.y = -Math.PI / 2;
  g.add(knight.root);
  const lantern = fire(0.9, 1.2, 0.7, 0.3, 10);
  g.add(lantern.group);
  let seg = 0;
  let along = 0;
  let t = 0;
  const pos = new Vector3(path[0][0], 0, path[0][1]);
  return {
    object: g,
    footprints: [],
    update(dt) {
      t += dt;
      const a = path[seg];
      const b = path[(seg + 1) % path.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      along += dt * speed;
      if (along >= len) { along = 0; seg = (seg + 1) % path.length; }
      const u = Math.min(1, along / len);
      pos.set(a[0] + (b[0] - a[0]) * u, 0, a[1] + (b[1] - a[1]) * u);
      pos.y = heightAt(pos.x, pos.z);
      g.position.lerp(pos, Math.min(1, dt * 6));
      const yaw = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const target = -yaw;
      g.rotation.y += Math.atan2(Math.sin(target - g.rotation.y), Math.cos(target - g.rotation.y)) * Math.min(1, dt * 3);
      const ph = t * 7;
      legs.forEach((l, i) => { l.rotation.z = Math.sin(ph + (i % 2 === 0 ? 0 : Math.PI) + (i < 2 ? 0 : 0.5)) * 0.55; });
      body.position.y = 1.35 + Math.abs(Math.sin(ph)) * 0.05;
      knight.animate({ mode: 'ground', speed: 0, pose: 'ride' }, dt);
      lantern.update(dt);
    },
  };
}

/** Gnarled orchard trees: twisted trunks with a few heavy branches, sparse canopy. */
export function gnarledTrees(spots: Placement[]): Group {
  const g = new Group();
  const parts: BufferGeometry[] = [];
  const trunk = rockify(new CylinderGeometry(0.35, 0.7, 4.5, 9, 6), 0.22, 0.9, 123).translate(0, 2.2, 0);
  parts.push(trunk);
  const rnd = rng(31);
  for (let i = 0; i < 5; i++) {
    const branch = rockify(new CylinderGeometry(0.08, 0.26, 3.2 + rnd() * 1.5, 7, 4), 0.1, 1.2, 130 + i).translate(0, 1.6, 0);
    branch.rotateZ(0.8 + rnd() * 0.7);
    branch.rotateY((i / 5) * Math.PI * 2 + rnd() * 0.5);
    branch.translate(0, 3.2 + rnd() * 1.2, 0);
    parts.push(branch);
  }
  const geo = mergeGeometries(parts, false)!;
  tintRock(geo, 0x1c2246, 0x1f4d46, 0.6, 200);
  const mesh = new InstancedMesh(geo, surface({ vertexColors: true, roughness: 0.95 }), spots.length);
  const canopy = rockify(new SphereGeometry(1.6, 12, 8), 0.4, 1.2, 140);
  tintRock(canopy, 0x14304a, 0x1f4d46, 0.6, 201);
  const canopyMesh = new InstancedMesh(canopy, surface({ vertexColors: true }), spots.length * 3);
  const dummy = new Object3D();
  const m = new Matrix4();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set((rnd() - 0.5) * 0.25, s.yaw, (rnd() - 0.5) * 0.25);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    m.copy(dummy.matrix);
    mesh.setMatrixAt(i, m);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + s.yaw;
      dummy.position.set(s.x + Math.cos(a) * 1.8 * s.scale, s.y + (4.2 + k * 0.4) * s.scale, s.z + Math.sin(a) * 1.8 * s.scale);
      dummy.rotation.set(0, a, 0);
      dummy.scale.setScalar(s.scale * (0.8 + rnd() * 0.5));
      dummy.updateMatrix();
      canopyMesh.setMatrixAt(i * 3 + k, dummy.matrix);
    }
  });
  mesh.instanceMatrix.needsUpdate = true;
  canopyMesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = canopyMesh.castShadow = true;
  mesh.frustumCulled = canopyMesh.frustumCulled = false;
  g.add(mesh, canopyMesh);
  return g;
}

/** Fallen glowing fruit on the ground. */
export function fallenFruit(spots: Placement[]): InstancedMesh {
  const mesh = new InstancedMesh(new SphereGeometry(0.17, 8, 6), new MeshBasicMaterial({ color: 0xffffff, toneMapped: false }), spots.length);
  const dummy = new Object3D();
  const palette = [new Color(PALETTE.dusk).multiplyScalar(0.9), new Color(PALETTE.blood).multiplyScalar(0.8), new Color(0xff5aa0).multiplyScalar(0.7)];
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y + 0.12, s.z);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
    mesh.setColorAt(i, palette[i % 3]);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.instanceColor!.needsUpdate = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Giant glowing mushrooms: thick stems and wide emissive caps with gill glow underneath. */
export function giantMushrooms(spots: Placement[]): Group {
  const g = new Group();
  const stem = rockify(new CylinderGeometry(0.9, 1.5, 7, 12, 5), 0.2, 0.7, 151).translate(0, 3.5, 0);
  tintRock(stem, 0x4a4a8a, 0x2a6a7a, 0.5, 151);
  const cap = rockify(new SphereGeometry(4.2, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), 0.22, 0.6, 152).translate(0, 5.6, 0);
  const stemMesh = new InstancedMesh(stem, surface({ vertexColors: true }), spots.length);
  const capMesh = new InstancedMesh(cap, surface({ color: 0x1b2a7a, emissive: PALETTE.electric, emissiveIntensity: 0.7, roughness: 0.5, side: DoubleSide }), spots.length);
  const gills = new InstancedMesh(new CircleGeometry(4.0, 24).rotateX(Math.PI / 2).translate(0, 5.65, 0), new MeshBasicMaterial({ color: new Color(PALETTE.electric).multiplyScalar(0.9), toneMapped: false, side: DoubleSide }), spots.length);
  const dummy = new Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    stemMesh.setMatrixAt(i, dummy.matrix);
    capMesh.setMatrixAt(i, dummy.matrix);
    gills.setMatrixAt(i, dummy.matrix);
  });
  for (const mm of [stemMesh, capMesh, gills]) { mm.instanceMatrix.needsUpdate = true; mm.frustumCulled = false; }
  stemMesh.castShadow = capMesh.castShadow = true;
  g.add(stemMesh, capMesh, gills);
  return g;
}

/** Glowing flower-trees (dandelion-like crowns of light) and floating rock islands above them. */
export function flowerTrees(spots: Placement[], islands: Placement[]): { group: Group; update: (dt: number) => void } {
  const g = new Group();
  const trunk = rockify(new CylinderGeometry(0.3, 0.6, 7, 9, 6), 0.15, 0.8, 161).translate(0, 3.5, 0);
  tintRock(trunk, 0x1c3a3a, 0x1f4d46, 0.6, 161);
  const trunkMesh = new InstancedMesh(trunk, surface({ vertexColors: true }), spots.length);
  const crownParts: BufferGeometry[] = [];
  const rnd = rng(77);
  for (let i = 0; i < 18; i++) {
    const a = rnd() * Math.PI * 2;
    const e = rnd() * Math.PI * 0.5;
    const len = 2.2 + rnd() * 1.4;
    const stalk = new CylinderGeometry(0.03, 0.05, len, 4).translate(0, len / 2, 0);
    stalk.rotateX(e).rotateY(a).translate(0, 7, 0);
    crownParts.push(stalk);
  }
  const crownMesh = new InstancedMesh(mergeGeometries(crownParts, false)!, surface({ color: 0x1b2a7a, emissive: PALETTE.rune, emissiveIntensity: 0.9 }), spots.length);
  const dummy = new Object3D();
  const bulbs: number[] = [];
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    crownMesh.setMatrixAt(i, dummy.matrix);
    for (let k = 0; k < 18; k++) {
      const a = rnd() * Math.PI * 2;
      const e = rnd() * Math.PI * 0.5;
      const len = 2.2 + rnd() * 1.4;
      bulbs.push(s.x + Math.sin(a) * Math.sin(e) * len * s.scale, s.y + (7 + Math.cos(e) * len) * s.scale, s.z + Math.cos(a) * Math.sin(e) * len * s.scale);
    }
  });
  trunkMesh.instanceMatrix.needsUpdate = crownMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.frustumCulled = crownMesh.frustumCulled = false;
  trunkMesh.castShadow = true;
  const bg = new BufferGeometry();
  bg.setAttribute('position', new Float32BufferAttribute(bulbs, 3));
  const bulbPts = new Points(bg, new PointsMaterial({ map: glowTexture(), color: 0x9ff4ff, size: 1.3, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }));
  bulbPts.frustumCulled = false;
  g.add(trunkMesh, crownMesh, bulbPts);
  // Floating islands: inverted rocky cones with a mossy top and a small glowing tree.
  const islandMeshes: Mesh[] = [];
  islands.forEach((s, i) => {
    const geo = rockify(new ConeGeometry(4 * s.scale, 6 * s.scale, 9, 4), 0.5 * s.scale, 0.4, 170 + i);
    tintRock(geo, 0x3a4478, 0x1f4d46, 0.9, 170 + i);
    const isl = new Mesh(geo, surface({ vertexColors: true }));
    isl.rotation.x = Math.PI;
    isl.position.set(s.x, s.y, s.z);
    isl.castShadow = true;
    const topTree = new Mesh(new ConeGeometry(0.9 * s.scale, 2.6 * s.scale, 7), surface({ color: 0x1b2a7a, emissive: PALETTE.rune, emissiveIntensity: 0.6 }));
    topTree.position.set(s.x, s.y + 1.3 * s.scale, s.z);
    const glow = glowSprite(PALETTE.rune, 6 * s.scale, 0.3, true);
    glow.position.set(s.x, s.y - 2 * s.scale, s.z);
    g.add(isl, topTree, glow);
    islandMeshes.push(isl, topTree, glow as unknown as Mesh);
  });
  let t = 0;
  return {
    group: g,
    update(dt) {
      t += dt;
      islandMeshes.forEach((m, i) => { m.position.y += Math.sin(t * 0.4 + i) * 0.004; });
    },
  };
}

/** Palms for the desert. */
export function palms(spots: Placement[]): Group {
  const g = new Group();
  const trunk = new CylinderGeometry(0.18, 0.32, 7, 8, 6);
  const tp = trunk.attributes.position as BufferAttribute;
  for (let i = 0; i < tp.count; i++) { const y = tp.getY(i) + 3.5; tp.setX(i, tp.getX(i) + y * y * 0.02); }
  trunk.translate(0, 3.5, 0);
  const trunkMesh = new InstancedMesh(trunk, surface({ color: 0x3a3a5a, roughness: 0.9 }), spots.length);
  const fronds: BufferGeometry[] = [];
  for (let i = 0; i < 9; i++) {
    const f = new PlaneGeometry(0.6, 3.6, 1, 5).translate(0, 1.8, 0);
    const fp = f.attributes.position as BufferAttribute;
    for (let k = 0; k < fp.count; k++) { const y = fp.getY(k); fp.setZ(k, -y * y * 0.12); fp.setX(k, fp.getX(k) * (1 - y / 3.6)); }
    f.rotateX(-1.0).rotateY((i / 9) * Math.PI * 2).translate(0.98, 7, 0);
    fronds.push(f);
  }
  const frondMesh = new InstancedMesh(mergeGeometries(fronds, false)!, surface({ color: 0x1b3a4a, side: DoubleSide, roughness: 0.9 }), spots.length);
  const dummy = new Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    trunkMesh.setMatrixAt(i, dummy.matrix);
    frondMesh.setMatrixAt(i, dummy.matrix);
  });
  trunkMesh.instanceMatrix.needsUpdate = frondMesh.instanceMatrix.needsUpdate = true;
  trunkMesh.castShadow = frondMesh.castShadow = true;
  trunkMesh.frustumCulled = frondMesh.frustumCulled = false;
  g.add(trunkMesh, frondMesh);
  return g;
}

/** Snow-laden pines for the yeti's grove. */
export function snowPines(spots: Placement[]): InstancedMesh {
  const trunk = new CylinderGeometry(0.22, 0.5, 4.5, 7).translate(0, 2.2, 0);
  const tiers: BufferGeometry[] = [trunk];
  const tierSpec: Array<[number, number, number]> = [[3.6, 4.6, 4.2], [2.9, 4.2, 6.6], [2.3, 3.8, 8.9], [1.6, 3.4, 11.0], [0.9, 2.8, 12.9]];
  for (const [r, h, y] of tierSpec) tiers.push(rockify(new ConeGeometry(r, h, 11, 5, true), 0.45, 0.7, y * 2.3).translate(0, y, 0));
  const geo = mergeGeometries(tiers, false)!;
  const pos = geo.attributes.position as BufferAttribute;
  const nor = geo.attributes.normal as BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  const dark = new Color(0x0e1f40);
  const snow = new Color(0xb8c6ee);
  const bark = new Color(PALETTE.bark);
  const c = new Color();
  for (let i = 0; i < pos.count; i++) {
    const up = Math.max(0, nor.getY(i));
    c.copy(pos.getY(i) < 4.4 && Math.hypot(pos.getX(i), pos.getZ(i)) < 0.6 ? bark : dark).lerp(snow, up * up * 0.9);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const mesh = new InstancedMesh(geo, surface({ vertexColors: true, side: DoubleSide }), spots.length);
  const dummy = new Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Dead black trees for the red forest. */
export function deadForest(spots: Placement[]): InstancedMesh {
  const rnd = rng(41);
  const parts: BufferGeometry[] = [rockify(new CylinderGeometry(0.2, 0.55, 7, 7, 6), 0.12, 1.0, 181).translate(0, 3.5, 0)];
  for (let i = 0; i < 7; i++) {
    const b = new CylinderGeometry(0.03, 0.14, 2.6 + rnd() * 2, 5).translate(0, 1.3, 0);
    b.rotateZ(0.5 + rnd() * 0.8).rotateY(rnd() * Math.PI * 2).translate(0, 3.5 + rnd() * 3.2, 0);
    parts.push(b);
  }
  const geo = mergeGeometries(parts, false)!;
  const n = geo.attributes.position.count;
  const col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { col[i * 3] = 0.03; col[i * 3 + 1] = 0.03; col[i * 3 + 2] = 0.08; }
  geo.setAttribute('color', new BufferAttribute(col, 3));
  const mesh = new InstancedMesh(geo, surface({ vertexColors: true, roughness: 1 }), spots.length);
  const dummy = new Object3D();
  spots.forEach((s, i) => {
    dummy.position.set(s.x, s.y, s.z);
    dummy.rotation.set(0, s.yaw, 0);
    dummy.scale.setScalar(s.scale);
    dummy.updateMatrix();
    mesh.setMatrixAt(i, dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Teal waterfalls pouring between tall trees at the stream's source. */
export function tealFalls(spots: Array<{ x: number; z: number; top: number; height: number; width: number }>): Landmark {
  const g = new Group();
  const mats: MeshBasicMaterial[] = [];
  for (const s of spots) {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(55,245,255,0.3)';
    ctx.fillRect(0, 0, 16, 128);
    ctx.fillStyle = 'rgba(220,255,255,0.9)';
    for (let i = 0; i < 9; i++) ctx.fillRect(i * 1.8, (i * 23) % 128, 1.2, 30 + (i * 11) % 40);
    const texture = new CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = RepeatWrapping;
    texture.repeat.set(s.width / 2, s.height / 10);
    const mat = new MeshBasicMaterial({ map: texture, transparent: true, side: DoubleSide, depthWrite: false, color: new Color(1.0, 1.6, 1.7), toneMapped: false });
    const mesh = new Mesh(new PlaneGeometry(s.width, s.height), mat);
    mesh.position.set(s.x, s.top - s.height / 2, s.z);
    const mist = glowSprite(PALETTE.rune, s.width * 2.2, 0.35, true);
    mist.position.set(s.x, s.top - s.height + 2, s.z);
    g.add(mesh, mist);
    mats.push(mat);
  }
  return { object: g, footprints: [], update(dt) { for (const m of mats) (m.map as import('three').Texture).offset.y += dt * 1.1; } };
}


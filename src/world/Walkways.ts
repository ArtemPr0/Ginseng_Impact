/**
 * The walkable bridges: their stepped deck colliders, and plain slabs in the palette's `stone` colour that stand in
 * until their Meshy models (`witch-bridge`, `chasm-bridge` tiles) load. Allow-listed in the procedural audit.
 */
import { BoxGeometry, Group, Mesh } from 'three';
import { surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import type { Footprint } from './Colliders';
import type { Landmark } from './Landmarks';

type HeightAt = (x: number, z: number) => number;

const slabMat = () => surface({ color: PALETTE.stone, roughness: 1 });

function slab(w: number, h: number, d: number, x: number, y: number, z: number, rotY = 0): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), slabMat());
  m.position.set(x, y, z);
  m.rotation.y = rotY;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** How far below the walk surface a deck's underside is (arch crown and paving). */
const DECK_DEPTH = 0.9;

/** Rope-bridge tile model: width (x) of the file in metres once scaled to its registry height, and its deck height. */
const BRIDGE_TILE = 1.8 * (1.899 / 1.071);
const BRIDGE_DECK = 0.45;

/**
 * An arched wooden footbridge (the reference's bridge over the eye, #28) from (x, zA) to (x, zB): its walk surface rises
 * from `endY` at both ends to `crownY` in the middle in 0.5 m collider slices with railings, and its deck is a row of
 * `chasm-bridge` tiles pitched along the arch. `posts` are where the railing posts stand (candles go on them).
 */
export function archBridge(x: number, zA: number, zB: number, endY: number, crownY: number, halfWidth: number, tileHeight: number): Landmark & { tiles: Array<{ x: number; y: number; z: number; yaw: number; scale: number; pitch: number }>; posts: Array<{ x: number; y: number; z: number }>; surface(z: number): number } {
  const len = Math.abs(zB - zA);
  const dir = Math.sign(zB - zA);
  const surface = (z: number) => {
    const t = Math.min(1, Math.max(0, (z - zA) / (zB - zA)));
    return endY + (crownY - endY) * Math.sin(t * Math.PI);
  };
  const footprints: Footprint[] = [];
  const slices = Math.ceil(len / 0.5);
  for (let k = 0; k < slices; k++) {
    const z = zA + dir * (k + 0.5) * (len / slices);
    const top = surface(z);
    footprints.push({ kind: 'box', x, z, hw: halfWidth, hd: len / slices / 2 + 0.02, top, bottom: top - DECK_DEPTH });
    for (const side of [-1, 1]) footprints.push({ kind: 'box', x: x + side * (halfWidth + 0.15), z, hw: 0.15, hd: len / slices / 2 + 0.02, top: top + 1.0, bottom: top - DECK_DEPTH });
  }
  const n = Math.ceil(len / BRIDGE_TILE);
  const step = len / n;
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const z = zA + dir * (i + 0.5) * step;
    const dz = 0.25;
    const slope = (surface(z + dz) - surface(z - dz)) / (2 * dz);
    // The tile's local +z runs along the span (yaw π for a bridge heading -z); a rise toward +z tips the nose up.
    tiles.push({ x, y: surface(z) - tileHeight * BRIDGE_DECK, z, yaw: dir < 0 ? Math.PI : 0, scale: step / BRIDGE_TILE, pitch: -Math.atan(slope * dir) });
  }
  const posts = [];
  for (let z = zA; dir > 0 ? z <= zB + 0.01 : z >= zB - 0.01; z += dir * 3.6) {
    for (const side of [-1, 1]) posts.push({ x: x + side * (halfWidth + 0.15), y: surface(z), z });
  }
  return { object: new Group(), tiles, posts, footprints, surface };
}

/**
 * A plank walkway hung on chains from (ax, az, ay) to (bx, bz, by): `chasm-bridge` tiles pitched along the rise, its walk
 * surface in 0.6 m collider slices (a climb a body can walk).
 */
export function chainSpan(ax: number, az: number, ay: number, bx: number, bz: number, by: number, tileHeight: number): Landmark & { tiles: Array<{ x: number; y: number; z: number; yaw: number; scale: number; pitch: number }> } {
  const len = Math.hypot(bx - ax, bz - az);
  const rotY = Math.atan2(bz - az, bx - ax);
  const yaw = Math.atan2(bx - ax, bz - az);
  const pitch = -Math.atan2(by - ay, len);
  const n = Math.ceil(len / BRIDGE_TILE);
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    tiles.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t - tileHeight * BRIDGE_DECK, z: az + (bz - az) * t, yaw, scale: len / n / BRIDGE_TILE, pitch });
  }
  const slices = Math.ceil(len / 0.6);
  const footprints: Footprint[] = [];
  for (let k = 0; k < slices; k++) {
    const t = (k + 0.5) / slices;
    footprints.push({ kind: 'box', x: ax + (bx - ax) * t, z: az + (bz - az) * t, hw: len / slices / 2 + 0.03, hd: 1.3, top: ay + (by - ay) * t, rotY, bottom: ay + (by - ay) * t - 0.6 });
  }
  return { object: new Group(), tiles, footprints };
}

/** Deck, parapets and piers of the bridge over the witch stream. */
/**
 * The witches' humpback bridge (DeWji_1PuKW): 22 m along x. The walk surface follows the Meshy model's deck
 * profile (fractions of its height, measured at 11 points with scripts/model-measure-style sampling) in 0.5 m
 * collider slices; parapets run along both edges. `baseY` is where the model's base sits, `deckY` the crown.
 */
const WITCH_BRIDGE_PROFILE = [0.29, 0.43, 0.59, 0.73, 0.85, 0.85, 0.85, 0.73, 0.59, 0.43, 0.29];
export const WITCH_BRIDGE = { length: 22, height: 22 * (0.368 / 1.899), halfWidth: 2.3 };

/**
 * The witches' bridge's walkable deck over a crossing at streamX (its arch runs along x), `length` long (22 m is the
 * model at scale 1; shorter is the model scaled down whole, length/22, its rise and width with it).
 */
export function witchBridgeDeck(streamX: number, bridgeZ: number, heightAt: HeightAt, length: number = WITCH_BRIDGE.length): Landmark & { deckY: number; baseY: number; scale: number } {
  return stoneArch(streamX, bridgeZ, length, 'x', heightAt);
}

export interface StoneArch extends Landmark {
  /** The crown's walk surface. */
  deckY: number;
  /** Where the model's origin goes (its feet). */
  baseY: number;
  /** The model's scale (length / 22). */
  scale: number;
  /** The model's rotation about y (its arch runs along local x). */
  yaw: number;
  /** The tops of the parapets, about every 4 m each side (candles go on them). */
  posts: Array<{ x: number; y: number; z: number }>;
}

/**
 * The stone arch (witch-bridge.glb) as a crossing of any length, centred on (cx, cz), its arch running along x or z: the
 * model scaled whole (length / 22: its rise, width and parapets with it). Both ends start at the higher bank; with
 * `steps`, the lower bank climbs to its end by stair treads (no ledge to jump), each under a stair's rise.
 */
export function stoneArch(cx: number, cz: number, length: number, along: 'x' | 'z', heightAt: HeightAt, opts: { steps?: boolean } = {}): StoneArch {
  const k = length / WITCH_BRIDGE.length;
  const half = WITCH_BRIDGE.halfWidth * k;
  // A point `u` metres along the arch from its centre and `v` across it.
  const at = (u: number, v: number): [number, number] => (along === 'x' ? [cx + u, cz + v] : [cx + v, cz + u]);
  const box = (u: number, v: number, hu: number, hv: number, top: number, bottom: number): Footprint => {
    const [x, z] = at(u, v);
    return along === 'x' ? { kind: 'box', x, z, hw: hu, hd: hv, top, bottom } : { kind: 'box', x, z, hw: hv, hd: hu, top, bottom };
  };
  const groundAt = (u: number) => heightAt(...at(u, 0));
  const bank = Math.max(groundAt(-length / 2 - 0.5), groundAt(length / 2 + 0.5));
  const H = WITCH_BRIDGE.height * k;
  const baseY = bank + 0.1 - WITCH_BRIDGE_PROFILE[0] * H;
  const surface = (t: number) => {
    const f = Math.min(1, Math.max(0, t)) * (WITCH_BRIDGE_PROFILE.length - 1);
    const i = Math.min(WITCH_BRIDGE_PROFILE.length - 2, Math.floor(f));
    return baseY + H * (WITCH_BRIDGE_PROFILE[i] + (WITCH_BRIDGE_PROFILE[i + 1] - WITCH_BRIDGE_PROFILE[i]) * (f - i));
  };
  const g = new Group();
  const footprints: Footprint[] = [];
  // (Slices no longer than 0.45 m: on a long arch the profile's steepest step stays under a walker's trip height.)
  const slices = Math.max(44, Math.ceil(length / 0.45));
  const du = length / slices;
  for (let s = 0; s < slices; s++) {
    const t = (s + 0.5) / slices;
    const u = -length / 2 + t * length;
    const top = surface(t);
    footprints.push(box(u, 0, du / 2 + 0.02, half, top, top - DECK_DEPTH));
    for (const side of [-1, 1]) footprints.push(box(u, side * (half + 0.2), du / 2 + 0.02, 0.2, top + 0.9 * Math.max(1, k * 0.8), top - DECK_DEPTH));
  }
  const endTop = surface(0);
  if (opts.steps) {
    for (const side of [-1, 1]) {
      const ground = groundAt(side * (length / 2 + 1.5));
      const rise = endTop - ground;
      if (rise < 0.3) continue;
      const n = Math.ceil(rise / 0.35);
      for (let i = 0; i < n; i++) {
        const top = endTop - (rise * i) / n;
        footprints.push(box(side * (length / 2 + 0.225 + i * 0.45), 0, 0.25, half, top, top - 1.5));
      }
    }
  }
  const posts: StoneArch['posts'] = [];
  const nPosts = Math.max(2, Math.round(length / 4));
  for (let i = 0; i <= nPosts; i++) {
    const t = 0.04 + (0.92 * i) / nPosts;
    const u = -length / 2 + t * length;
    for (const side of [-1, 1]) { const [x, z] = at(u, side * (half + 0.2)); posts.push({ x, y: surface(t) + 0.9 * Math.max(1, k * 0.8), z }); }
  }
  // Stand-in until the model loads: a flat slab at the crown.
  const [sx, sz] = at(0, 0);
  g.add(along === 'x' ? slab(length, 0.6, half * 2, sx, surface(0.5) - 0.3, sz) : slab(half * 2, 0.6, length, sx, surface(0.5) - 0.3, sz));
  return { object: g, footprints, deckY: surface(0.5), baseY, scale: k, yaw: along === 'x' ? 0 : Math.PI / 2, posts };
}

/** A flat stone floor slab whose top is at `top` (the realms' ground until their floor models exist). */
export function floorSlab(x: number, z: number, top: number, w: number, d: number, rotY = 0): Landmark {
  const g = new Group();
  g.add(slab(w, 2, d, x, top - 1, z, rotY));
  return { object: g, footprints: [{ kind: 'box', x, z, hw: w / 2, hd: d / 2, top, rotY }] };
}

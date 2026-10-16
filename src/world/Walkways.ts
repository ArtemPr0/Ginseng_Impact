/**
 * Walkable placeholders for the structures the player stands on. Plain slabs in the palette's `stone`
 * colour that reproduce the colliders of the old causeway, chasm bridge and witch-bridge deck exactly, so
 * the island stays connected until their Meshy versions (`causeway-segment`, `causeway-stairs`,
 * `chasm-bridge`, `witch-bridge`) land. Allow-listed in the procedural audit.
 */
import { BoxGeometry, Group, Mesh } from 'three';
import { surface } from '../render/Materials';
import { PALETTE } from '../render/palette';
import type { Footprint } from './Colliders';
import type { CausewayConfig, Landmark } from './Landmarks';

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

/**
 * The tops of the raised edge stones along the causeway, one each side at the middle of every span (lanterns and
 * candles stand on these, on the bridge itself).
 */
export function causewayPostPoints(cfg: CausewayConfig, spanHeight: number): Array<{ x: number; z: number; y: number }> {
  const out: Array<{ x: number; z: number; y: number }> = [];
  for (const s of causewaySegments(cfg)) {
    for (let k = 0; k < 3; k++) {
      const z = s.zc + (k - 1) * (s.len / 3);
      for (const side of [-1, 1]) out.push({ x: cfg.x + side * SPAN_POST.x, z, y: s.top + spanHeight * SPAN_POST.rise });
    }
  }
  return out;
}

/** The causeway's collider segments: centre z, length and deck top of each. */
function causewaySegments(cfg: CausewayConfig): Array<{ zc: number; len: number; top: number }> {
  const length = cfg.zStart - cfg.zEnd;
  const n = Math.ceil(length / cfg.segmentLength);
  const len = length / n;
  return Array.from({ length: n }, (_, i) => ({ zc: cfg.zStart - (i + 0.5) * len, len, top: cfg.yStart + ((cfg.yEnd - cfg.yStart) * (i + 0.5)) / n }));
}

/** How far below the walk surface a deck's underside is (arch crown and paving). */
const DECK_DEPTH = 0.9;

/**
 * Span model (causeway-segment.glb, measured with scripts/model-measure.mjs and downward rays in the game): the deck's
 * crown at this fraction of the span's height; the paving reaches SPAN_HALF metres either side of the centre line
 * (the edge stones overhang a little further); a raised edge stone at the middle of each span, `x` out from the
 * centre, its top `rise` × height above the crown.
 */
const SPAN_DECK = 0.861;
const SPAN_HALF = 2.3;
const SPAN_WIDTH = 5.93;
const SPAN_POST = { x: 2.1, rise: (0.985 - SPAN_DECK) };
/**
 * Stairs model (causeway-stairs.glb, scripts/model-profile.mjs): the landing's walk surface at 0.825 of the height
 * over the first 27% of the length, steps down to 87% of it; length = 2.07 × height, width = 1.98 × height before the
 * width is fitted to the bridge.
 */
const STAIRS_LANDING = 0.825;
const STAIRS_LENGTH = 1.899 / 0.918;
const STAIRS_FLAT = 0.27;
const STAIRS_END = 0.87;
const STAIRS_WIDE = 1.818 / 0.918;

export interface CausewayBuild {
  /** Colliders and the stand-in piers over the chasm. */
  landmark: Landmark;
  /** Instances of the `causeway-segment` model (arched bridge span, registry height = span height). */
  spans: Array<{ x: number; y: number; z: number; yaw: number; scale: number }>;
  /**
   * Where the `causeway-stairs` model goes: feet on the ground, scaled so its landing meets the deck, and squeezed
   * across (`widthScale`, on top of the uniform scale) to the bridge's own width.
   */
  stairs: { x: number; y: number; z: number; height: number; widthScale: number };
  /** The same stairs at the north end, turned around, down to the head's plaza. */
  northStairs: { x: number; y: number; z: number; height: number; widthScale: number };
}

/**
 * The raised road: three Meshy bridge spans per collider segment (same stepped deck colliders as before), edge
 * colliders where the balustrade posts stood, and the stairs model at the south end with colliders that follow
 * its steps. Over the chasm the spans need piers; until a pier model exists a plain slab stands in.
 */
export function causewayWalk(cfg: CausewayConfig, groundAt: HeightAt, spanHeight: number): CausewayBuild {
  const g = new Group();
  const footprints: Footprint[] = [];
  const spans: CausewayBuild['spans'] = [];
  for (const { zc, len: segLen, top } of causewaySegments(cfg)) {
    for (let k = 0; k < 3; k++) spans.push({ x: cfg.x, y: top - spanHeight * SPAN_DECK, z: zc + (k - 1) * (segLen / 3), yaw: 0, scale: 1 });
    const ground = groundAt(cfg.x, zc);
    if (ground < top - 4) {
      const pierH = top - spanHeight - Math.max(ground, -95);
      g.add(slab(cfg.width * 0.55, pierH, segLen * 0.3, cfg.x, top - spanHeight - pierH / 2 + 0.3, zc));
    }
    // The deck is overhead: wherever the ground is far enough below, people walk under the arches. Only as wide as
    // the paving (no walking on air beside it).
    footprints.push({ kind: 'box', x: cfg.x, z: zc, hw: SPAN_HALF, hd: segLen / 2, top, bottom: top - DECK_DEPTH });
    // The raised edge stones at the middle of each span.
    for (let k = 0; k < 3; k++) for (const side of [-1, 1]) {
      footprints.push({ kind: 'box', x: cfg.x + side * SPAN_POST.x, z: zc + (k - 1) * (segLen / 3), hw: 0.3, hd: 0.7, top: top + spanHeight * SPAN_POST.rise, bottom: top - DECK_DEPTH });
    }
  }
  // Stairs at both ends: a landing flush with the deck, then steps down to the ground (south end falls south,
  // north end falls north).
  const stairsAt = (zEdge: number, deckY: number, dir: 1 | -1) => {
    const z0 = zEdge - dir * 0.5;
    // The foot of the flight lands where the ground is; its length depends on the rise, so settle the two together.
    let ground = groundAt(cfg.x, zEdge + dir * 6);
    for (let k = 0; k < 3; k++) ground = groundAt(cfg.x, z0 + dir * ((Math.max(0.5, deckY - ground) / STAIRS_LANDING) * STAIRS_LENGTH * STAIRS_END));
    const rise = Math.max(0.5, deckY - ground);
    const height = rise / STAIRS_LANDING;
    const len = height * STAIRS_LENGTH;
    const flat = len * STAIRS_FLAT;
    const hw = SPAN_WIDTH / 2 - 0.35;
    // The landing, the steps, and the balustrade either side (solid all the way down: no walking into the flight).
    footprints.push({ kind: 'box', x: cfg.x, z: z0 + dir * flat / 2, hw, hd: flat / 2, top: deckY });
    for (const side of [-1, 1]) footprints.push({ kind: 'box', x: cfg.x + side * (SPAN_WIDTH / 2 - 0.17), z: z0 + dir * (len * STAIRS_END) / 2, hw: 0.17, hd: (len * STAIRS_END) / 2, top: deckY + 1 });
    const steps = Math.max(1, Math.ceil(rise / 0.45));
    const run = (len * STAIRS_END - flat) / steps;
    for (let i = 1; i <= steps; i++) {
      const top = deckY - i * (rise / steps);
      const zc = z0 + dir * (flat + (i - 0.5) * run);
      footprints.push({ kind: 'box', x: cfg.x, z: zc, hw, hd: run / 2, top });
    }
    return { x: cfg.x, y: ground - 0.05, z: z0 + dir * len / 2, height, widthScale: SPAN_WIDTH / (height * STAIRS_WIDE) };
  };
  const stairs = stairsAt(cfg.zStart, cfg.yStart, 1);
  const northStairs = stairsAt(cfg.zEnd, cfg.yEnd, -1);
  return { landmark: { object: g, footprints }, spans, stairs, northStairs };
}

/** Rope-bridge tile model: width (x) of the file in metres once scaled to its registry height, and its deck height. */
const BRIDGE_TILE = 1.8 * (1.899 / 1.071);
const BRIDGE_DECK = 0.45;

/**
 * The rope bridge over the chasm: one walk collider for the whole span and a row of `chasm-bridge` deck tiles
 * (the Meshy file is a square railed deck section; local +z runs along the span).
 */
export function chasmBridge(ax: number, az: number, bx: number, bz: number, y: number, tileHeight: number): Landmark & { tiles: Array<{ x: number; y: number; z: number; yaw: number; scale: number }> } {
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bz - az, bx - ax);
  const n = Math.ceil(len / BRIDGE_TILE);
  const step = len / n;
  const tiles = [];
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    tiles.push({ x: ax + (bx - ax) * t, y: y - tileHeight * BRIDGE_DECK, z: az + (bz - az) * t, yaw: Math.atan2(bx - ax, bz - az), scale: step / BRIDGE_TILE });
  }
  return { object: new Group(), tiles, footprints: [{ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hw: len / 2, hd: 1.4, top: y, rotY: yaw, bottom: y - 0.6 }] };
}

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

/** Deck, parapets and piers of the bridge over the witch stream. */
/**
 * The witches' humpback bridge (DeWji_1PuKW): 22 m along x. The walk surface follows the Meshy model's deck
 * profile (fractions of its height, measured at 11 points with scripts/model-measure-style sampling) in 0.5 m
 * collider slices; parapets run along both edges. `baseY` is where the model's base sits, `deckY` the crown.
 */
const WITCH_BRIDGE_PROFILE = [0.29, 0.43, 0.59, 0.73, 0.85, 0.85, 0.85, 0.73, 0.59, 0.43, 0.29];
export const WITCH_BRIDGE = { length: 22, height: 22 * (0.368 / 1.899), halfWidth: 2.3 };

export function witchBridgeDeck(streamX: number, bridgeZ: number, heightAt: HeightAt): Landmark & { deckY: number; baseY: number } {
  const bank = Math.max(heightAt(streamX - 11.5, bridgeZ), heightAt(streamX + 11.5, bridgeZ));
  const H = WITCH_BRIDGE.height;
  const baseY = bank + 0.1 - WITCH_BRIDGE_PROFILE[0] * H;
  const surface = (t: number) => {
    const f = Math.min(1, Math.max(0, t)) * (WITCH_BRIDGE_PROFILE.length - 1);
    const i = Math.min(WITCH_BRIDGE_PROFILE.length - 2, Math.floor(f));
    return baseY + H * (WITCH_BRIDGE_PROFILE[i] + (WITCH_BRIDGE_PROFILE[i + 1] - WITCH_BRIDGE_PROFILE[i]) * (f - i));
  };
  const g = new Group();
  const footprints: Footprint[] = [];
  const slices = 44;
  for (let k = 0; k < slices; k++) {
    const t = (k + 0.5) / slices;
    const x = streamX - WITCH_BRIDGE.length / 2 + t * WITCH_BRIDGE.length;
    const top = surface(t);
    footprints.push({ kind: 'box', x, z: bridgeZ, hw: WITCH_BRIDGE.length / slices / 2 + 0.02, hd: WITCH_BRIDGE.halfWidth, top, bottom: top - DECK_DEPTH });
    for (const side of [-1, 1]) footprints.push({ kind: 'box', x, z: bridgeZ + side * (WITCH_BRIDGE.halfWidth + 0.2), hw: WITCH_BRIDGE.length / slices / 2 + 0.02, hd: 0.2, top: top + 0.9, bottom: top - DECK_DEPTH });
  }
  // Stand-in until the model loads: a flat slab at the crown.
  g.add(slab(WITCH_BRIDGE.length, 0.6, WITCH_BRIDGE.halfWidth * 2, streamX, surface(0.5) - 0.3, bridgeZ));
  return { object: g, footprints, deckY: surface(0.5), baseY };
}

/** A flat stone floor slab whose top is at `top` (the realms' ground until their floor models exist). */
export function floorSlab(x: number, z: number, top: number, w: number, d: number, rotY = 0): Landmark {
  const g = new Group();
  g.add(slab(w, 2, d, x, top - 1, z, rotY));
  return { object: g, footprints: [{ kind: 'box', x, z, hw: w / 2, hd: d / 2, top, rotY }] };
}

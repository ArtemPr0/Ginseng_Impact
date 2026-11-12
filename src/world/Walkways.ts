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
  for (const s of causewaySpans(cfg)) {
    for (const side of [-1, 1]) out.push({ x: cfg.x + side * SPAN_POST.x * s.scale, z: s.zc, y: s.top + spanHeight * s.scale * SPAN_POST.rise });
  }
  return out;
}

/** Span model length once scaled to its registry height (causeway-segment.glb is 1.362 × 0.434 × 1.900, long along z). */
export const SPAN_LENGTH = 5.93 * (1.9 / 1.362);

/**
 * The causeway's spans, end to end from zStart to zEnd: centre z, length, deck top at the centre and the scale that
 * makes the model exactly that long (every span the same, so no copy overlaps the next).
 */
function causewaySpans(cfg: CausewayConfig): Array<{ zc: number; len: number; top: number; scale: number }> {
  const length = cfg.zStart - cfg.zEnd;
  const n = Math.max(1, Math.round(length / SPAN_LENGTH));
  const len = length / n;
  return Array.from({ length: n }, (_, i) => ({ zc: cfg.zStart - (i + 0.5) * len, len, top: cfg.yStart + ((cfg.yEnd - cfg.yStart) * (i + 0.5)) / n, scale: len / SPAN_LENGTH }));
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
const SPAN_POST = { x: 2.1, rise: (0.985 - SPAN_DECK) };

export interface CausewayBuild {
  /** Colliders: the deck (fine steps along its slope) and the edge stones. */
  landmark: Landmark;
  /** Instances of the `causeway-segment` model (arched bridge span, registry height = span height), end to end. */
  spans: Array<{ x: number; y: number; z: number; yaw: number; scale: number }>;
  /** Piers under the joints where the bridge crosses the chasm: foot (the cloud sea or the chasm wall) and height to the arch feet. */
  piers: Array<{ x: number; y: number; z: number; height: number }>;
}

/** How long a piece of the deck collider is: its tops follow the slope in steps a walker never notices. */
const DECK_STEP = 2;

/**
 * The raised road over the chasm: one bridge from rim to rim. The arched spans lie end to end on one even slope (three
 * overlapping copies per segment, each segment a step higher, read as bridges stacked on bridges), the deck meets the
 * ground at both ends (no stairs, no pillar stubs under the approaches), and a pier stands under every joint over the
 * chasm, all alike. The approaches beyond the rims are ground road.
 */
export function causewayWalk(cfg: CausewayConfig, groundAt: HeightAt, spanHeight: number): CausewayBuild {
  const g = new Group();
  const footprints: Footprint[] = [];
  const spans: CausewayBuild['spans'] = [];
  const piers: CausewayBuild['piers'] = [];
  const all = causewaySpans(cfg);
  const slope = (cfg.yEnd - cfg.yStart) / (cfg.zStart - cfg.zEnd);
  for (const [i, { zc, len, top, scale }] of all.entries()) {
    spans.push({ x: cfg.x, y: top - spanHeight * scale * SPAN_DECK, z: zc, yaw: 0, scale });
    // The deck, in short pieces whose tops follow the slope; only as wide as the paving (no walking on air beside it).
    const pieces = Math.max(1, Math.round(len / DECK_STEP));
    for (let k = 0; k < pieces; k++) {
      const z = zc + len / 2 - ((k + 0.5) * len) / pieces;
      const y = cfg.yStart + (cfg.zStart - z) * slope;
      footprints.push({ kind: 'box', x: cfg.x, z, hw: SPAN_HALF * scale, hd: len / pieces / 2, top: y, bottom: y - DECK_DEPTH });
    }
    // The raised edge stones at the middle of the span.
    for (const side of [-1, 1]) {
      footprints.push({ kind: 'box', x: cfg.x + side * SPAN_POST.x * scale, z: zc, hw: 0.3, hd: 0.7, top: top + spanHeight * scale * SPAN_POST.rise, bottom: top - DECK_DEPTH });
    }
    // A pier under the joint at the span's north end, where the bridge is over the chasm (the last joint is the north
    // rim). A rock spire climbs out of the cloud sea (or the chasm wall) to the arch feet.
    if (i < all.length - 1) {
      const z = zc - len / 2;
      const ground = groundAt(cfg.x, z);
      const feet = cfg.yStart + (cfg.zStart - z) * slope - spanHeight * scale + 0.3;
      if (ground < feet - 12) {
        const base = Math.max(ground, -95);
        piers.push({ x: cfg.x, z, y: base, height: feet - base });
      }
    }
  }
  return { landmark: { object: g, footprints }, spans, piers };
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
  const k = length / WITCH_BRIDGE.length;
  const half = WITCH_BRIDGE.halfWidth * k;
  const bank = Math.max(heightAt(streamX - length / 2 - 0.5, bridgeZ), heightAt(streamX + length / 2 + 0.5, bridgeZ));
  const H = WITCH_BRIDGE.height * k;
  const baseY = bank + 0.1 - WITCH_BRIDGE_PROFILE[0] * H;
  const surface = (t: number) => {
    const f = Math.min(1, Math.max(0, t)) * (WITCH_BRIDGE_PROFILE.length - 1);
    const i = Math.min(WITCH_BRIDGE_PROFILE.length - 2, Math.floor(f));
    return baseY + H * (WITCH_BRIDGE_PROFILE[i] + (WITCH_BRIDGE_PROFILE[i + 1] - WITCH_BRIDGE_PROFILE[i]) * (f - i));
  };
  const g = new Group();
  const footprints: Footprint[] = [];
  const slices = 44;
  for (let s = 0; s < slices; s++) {
    const t = (s + 0.5) / slices;
    const x = streamX - length / 2 + t * length;
    const top = surface(t);
    footprints.push({ kind: 'box', x, z: bridgeZ, hw: length / slices / 2 + 0.02, hd: half, top, bottom: top - DECK_DEPTH });
    for (const side of [-1, 1]) footprints.push({ kind: 'box', x, z: bridgeZ + side * (half + 0.2), hw: length / slices / 2 + 0.02, hd: 0.2, top: top + 0.9, bottom: top - DECK_DEPTH });
  }
  // Stand-in until the model loads: a flat slab at the crown.
  g.add(slab(length, 0.6, half * 2, streamX, surface(0.5) - 0.3, bridgeZ));
  return { object: g, footprints, deckY: surface(0.5), baseY, scale: k };
}

/** A flat stone floor slab whose top is at `top` (the realms' ground until their floor models exist). */
export function floorSlab(x: number, z: number, top: number, w: number, d: number, rotY = 0): Landmark {
  const g = new Group();
  g.add(slab(w, 2, d, x, top - 1, z, rotY));
  return { object: g, footprints: [{ kind: 'box', x, z, hw: w / 2, hd: d / 2, top, rotY }] };
}

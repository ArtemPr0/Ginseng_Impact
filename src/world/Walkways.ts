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

/** Deck tops along the causeway where the balustrade posts stand (lanterns and candles use these). */
export function causewayPostPoints(cfg: CausewayConfig): Array<{ x: number; z: number; y: number }> {
  const out: Array<{ x: number; z: number; y: number }> = [];
  const length = cfg.zStart - cfg.zEnd;
  for (let z = cfg.zStart - 2; z > cfg.zEnd + 2; z -= cfg.postSpacing) {
    const t = (cfg.zStart - z) / length;
    const top = cfg.yStart + (cfg.yEnd - cfg.yStart) * t;
    for (const side of [-1, 1]) out.push({ x: cfg.x + side * (cfg.width / 2 - 0.4), z, y: top });
  }
  return out;
}

/** Span model proportions (scripts/model-measure.mjs): deck surface at this fraction of the span's height. */
const SPAN_DECK = 0.861;
/** Stairs model: the top landing's walk surface as a fraction of height; length/height ratio; landing share of the length. */
const STAIRS_LANDING = 0.59;
const STAIRS_LENGTH = 1.9 / 1.295;
const STAIRS_FLAT = 4 / 12;

export interface CausewayBuild {
  /** Colliders and the stand-in piers over the chasm. */
  landmark: Landmark;
  /** Instances of the `causeway-segment` model (arched bridge span, registry height = span height). */
  spans: Array<{ x: number; y: number; z: number; yaw: number; scale: number }>;
  /** Where the `causeway-stairs` model goes: feet on the ground, scaled so its landing meets the deck. */
  stairs: { x: number; y: number; z: number; height: number };
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
  const length = cfg.zStart - cfg.zEnd;
  const n = Math.ceil(length / cfg.segmentLength);
  const segLen = length / n;
  for (let i = 0; i < n; i++) {
    const zc = cfg.zStart - (i + 0.5) * segLen;
    const top = cfg.yStart + ((cfg.yEnd - cfg.yStart) * (i + 0.5)) / n;
    for (let k = 0; k < 3; k++) spans.push({ x: cfg.x, y: top - spanHeight * SPAN_DECK, z: zc + (k - 1) * (segLen / 3), yaw: 0, scale: 1 });
    const ground = groundAt(cfg.x, zc);
    if (ground < top - 4) {
      const pierH = top - spanHeight - Math.max(ground, -95);
      g.add(slab(cfg.width * 0.55, pierH, segLen * 0.3, cfg.x, top - spanHeight - pierH / 2 + 0.3, zc));
    }
    footprints.push({ kind: 'box', x: cfg.x, z: zc, hw: cfg.width / 2 + 0.3, hd: segLen / 2, top });
  }
  for (let z = cfg.zStart - 2; z > cfg.zEnd + 2; z -= cfg.postSpacing) {
    const t = (cfg.zStart - z) / length;
    const top = cfg.yStart + (cfg.yEnd - cfg.yStart) * t;
    for (const side of [-1, 1]) footprints.push({ kind: 'box', x: cfg.x + side * (cfg.width / 2 + 0.05), z, hw: 0.35, hd: 0.35, top: top + 0.6 });
  }
  // Stairs: landing flush with the deck at zStart, steps falling south to the ground.
  const groundS = groundAt(cfg.x, cfg.zStart + 6);
  const rise = Math.max(0.5, cfg.yStart - groundS);
  const height = rise / STAIRS_LANDING;
  const len = height * STAIRS_LENGTH;
  const z0 = cfg.zStart - 0.5;
  const flat = len * STAIRS_FLAT;
  footprints.push({ kind: 'box', x: cfg.x, z: z0 + flat / 2, hw: cfg.width / 2 + 1, hd: flat / 2, top: cfg.yStart });
  const steps = Math.max(1, Math.ceil(rise / 0.45));
  const run = (len * 0.92 - flat) / steps;
  for (let i = 1; i <= steps; i++) {
    const top = cfg.yStart - i * (rise / steps);
    const zc = z0 + flat + (i - 0.5) * run;
    footprints.push({ kind: 'box', x: cfg.x, z: zc, hw: cfg.width / 2 + 1, hd: run / 2, top });
  }
  return { landmark: { object: g, footprints }, spans, stairs: { x: cfg.x, y: groundS - 0.05, z: z0 + len / 2, height } };
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
  return { object: new Group(), tiles, footprints: [{ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hw: len / 2, hd: 1.4, top: y, rotY: -yaw }] };
}

/** Deck, parapets and piers of the bridge over the witch stream. */
export function witchBridgeDeck(streamX: number, bridgeZ: number, heightAt: HeightAt): Landmark & { deckY: number } {
  const deckY = heightAt(streamX - 9, bridgeZ) + 0.6;
  const g = new Group();
  const footprints: Footprint[] = [];
  g.add(slab(22, 0.9, 5, streamX, deckY, bridgeZ));
  footprints.push({ kind: 'box', x: streamX, z: bridgeZ, hw: 11, hd: 2.5, top: deckY + 0.45 });
  for (const side of [-1, 1]) {
    g.add(slab(22, 0.8, 0.4, streamX, deckY + 0.85, bridgeZ + side * 2.3));
    footprints.push({ kind: 'box', x: streamX, z: bridgeZ + side * 2.3, hw: 11, hd: 0.2, top: deckY + 1.25 });
    g.add(slab(2.4, 6, 4, streamX + side * 4, deckY - 3.2, bridgeZ));
  }
  return { object: g, footprints, deckY };
}

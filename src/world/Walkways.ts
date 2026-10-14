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

/** The raised road: stepped deck slabs, piers over the chasm, low post studs, stairs at the south end. */
export function causewaySlabs(cfg: CausewayConfig, groundAt: HeightAt): Landmark {
  const g = new Group();
  const footprints: Footprint[] = [];
  const length = cfg.zStart - cfg.zEnd;
  const n = Math.ceil(length / cfg.segmentLength);
  const segLen = length / n;
  for (let i = 0; i < n; i++) {
    const zc = cfg.zStart - (i + 0.5) * segLen;
    const top = cfg.yStart + ((cfg.yEnd - cfg.yStart) * (i + 0.5)) / n;
    g.add(slab(cfg.width + 0.6, 3, segLen, cfg.x, top - 1.5, zc));
    const ground = groundAt(cfg.x, zc);
    if (ground < top - 4) {
      const pierH = top - 3 - Math.max(ground, -95);
      g.add(slab(cfg.width * 0.7, pierH, segLen * 0.45, cfg.x, top - 3 - pierH / 2, zc));
    }
    footprints.push({ kind: 'box', x: cfg.x, z: zc, hw: cfg.width / 2 + 0.3, hd: segLen / 2, top });
  }
  for (let z = cfg.zStart - 2; z > cfg.zEnd + 2; z -= cfg.postSpacing) {
    const t = (cfg.zStart - z) / length;
    const top = cfg.yStart + (cfg.yEnd - cfg.yStart) * t;
    for (const side of [-1, 1]) {
      const px = cfg.x + side * (cfg.width / 2 + 0.05);
      g.add(slab(0.7, 0.5, 0.7, px, top + 0.25, z));
      footprints.push({ kind: 'box', x: px, z, hw: 0.35, hd: 0.35, top: top + 0.5 });
    }
  }
  const groundS = groundAt(cfg.x, cfg.zStart + 6);
  const steps = Math.max(1, Math.ceil((cfg.yStart - groundS) / 0.45));
  for (let i = 1; i <= steps; i++) {
    const top = cfg.yStart - i * 0.45;
    const zc = cfg.zStart + i * 1.1 - 0.55;
    g.add(slab(cfg.width, 3, 1.1, cfg.x, top - 1.5, zc));
    footprints.push({ kind: 'box', x: cfg.x, z: zc, hw: cfg.width / 2, hd: 0.55, top });
  }
  return { object: g, footprints };
}

/** One flat span across the chasm. */
export function chasmBridgeSlab(ax: number, az: number, bx: number, bz: number, y: number): Landmark {
  const len = Math.hypot(bx - ax, bz - az);
  const yaw = Math.atan2(bz - az, bx - ax);
  const g = new Group();
  g.add(slab(len, 0.12, 2.2, (ax + bx) / 2, y, (az + bz) / 2, -yaw));
  return { object: g, footprints: [{ kind: 'box', x: (ax + bx) / 2, z: (az + bz) / 2, hw: len / 2, hd: 1.1, top: y + 0.06, rotY: -yaw }] };
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

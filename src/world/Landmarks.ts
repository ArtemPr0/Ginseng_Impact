import { BoxGeometry, Group, Mesh } from 'three';
import { PALETTE } from '../render/palette';
import { ps1Lambert } from '../render/PS1Material';
import type { Footprint } from './Colliders';

export interface Landmark {
  object: Group;
  footprints: Footprint[];
}

/** A standing stone: tall box, slightly tapered by a second thinner box on top. Walkable top, climbable sides. */
export function monolith(x: number, z: number, baseY: number, w: number, h: number, d: number, rotY = 0): Landmark {
  const g = new Group();
  const stone = new Mesh(new BoxGeometry(w, h, d), ps1Lambert({ color: PALETTE.stone }));
  stone.position.y = h / 2;
  const cap = new Mesh(new BoxGeometry(w * 0.8, h * 0.08, d * 0.8), ps1Lambert({ color: 0x5a6aa8 }));
  cap.position.y = h + h * 0.04;
  g.add(stone, cap);
  g.position.set(x, baseY, z);
  g.rotation.y = rotY;
  return {
    object: g,
    footprints: [{ kind: 'box', x, z, hw: w / 2, hd: d / 2, top: baseY + h, rotY }],
  };
}

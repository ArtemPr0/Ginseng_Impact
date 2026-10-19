/**
 * A floating island you can land on (floating-island.glb, every island in the game): still, solid at its top (a
 * cylinder to stand on, open underneath so you fly under it), its giant dead tree clipped away at the floor (render
 * Materials.clipAbove) with an ordinary tree in its place, a mossy rock floor over the cut (render Floors.rockTop).
 */
import type { Mesh, MeshStandardMaterial } from 'three';
import { MODELS } from '../data/models';
import { PRESENT_MODELS } from '../data/colliderGrids';
import { rockTop } from '../render/Floors';
import { clipAbove } from '../render/Materials';
import type { ModelRig } from '../models/ModelRig';
import { ISLAND_TOP } from './Heart';
import type { Landmark } from './Landmarks';
import { modelLandmark } from './ModelLandmark';
import type { Group } from 'three';

/** Radius of the island's flat top per unit of scale (measured on the sky dock: 12 m at 2.4). */
const TOP_R = 5;

function restyle(model: ModelRig, fn: (mat: MeshStandardMaterial) => void): void {
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    fn(mat);
    m.material = mat;
  });
}

export interface IslandApi { place(l: Landmark): void; readonly group: Group }

/** Places a landable island with its base at `base`; returns its top height and the radius of its flat top. */
export function landableIsland(api: IslandApi, x: number, z: number, base: number, opts: { scale?: number; yaw?: number; tree?: boolean } = {}): { top: number; r: number } {
  const scale = opts.scale ?? 1;
  const H = MODELS['floating-island'].height * scale;
  const top = base + H * ISLAND_TOP;
  const r = TOP_R * scale;
  api.place(modelLandmark('floating-island', x, z, base, {
    scale, yaw: opts.yaw ?? 0, collider: 'manual',
    footprints: [{ kind: 'cyl', x, z, r, top, bottom: base + H * 0.12 }],
    onLoad: (m) => restyle(m, (mat) => clipAbove(mat, top - 0.02)),
  }));
  if (PRESENT_MODELS.has('floating-island')) api.group.add(rockTop(x, z, r + 0.3, top));
  if (opts.tree !== false) {
    const a = (opts.yaw ?? 0) + 2.1;
    const tx = x + Math.cos(a) * r * 0.55, tz = z + Math.sin(a) * r * 0.55;
    api.place(modelLandmark('dead-forest-tree', tx, tz, top - 0.1, { scale: 0.9 * Math.min(1.4, scale), yaw: a, collider: 'manual', footprints: [{ kind: 'cyl', x: tx, z: tz, r: 0.35, top: top + 5 }] }));
  }
  return { top, r };
}

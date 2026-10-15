import { CylinderGeometry, Group, Mesh, OctahedronGeometry } from 'three';
import { surface } from '../render/Materials';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import { MODELS } from '../data/models';

const warned = new Set<string>();

/** Logs once per model id so the startup console doubles as the Meshy to-do list. */
export function warnMissing(id: string, label?: string): void {
  if (warned.has(id)) return;
  warned.add(id);
  const def = MODELS[id];
  const what = label ?? def?.label ?? id;
  console.warn(def ? `[models] missing public/models/${def.file} for '${id}' (${what})` : `[models] '${id}' has no registry entry (${what})`);
}

/**
 * The one sanctioned procedural mesh: a small glowing marker on a thin pillar that stands wherever a Meshy
 * model is still missing, so spawn points and landmark spots stay visible from a distance.
 */
export class MissingModelPlaceholder {
  readonly group = new Group();
  private readonly gem: Mesh;
  private t = Math.random() * 6;

  constructor(color: number = PALETTE.rune) {
    this.gem = new Mesh(new OctahedronGeometry(0.3), surface({ color: PALETTE.void, emissive: color, emissiveIntensity: 1.2 }));
    this.gem.position.y = 1.2;
    const pillar = new Mesh(new CylinderGeometry(0.02, 0.02, 1.2, 6), surface({ color: PALETTE.void, emissive: color, emissiveIntensity: 0.4 }));
    pillar.position.y = 0.6;
    const halo = glowSprite(color, 1.6, 0.5, true);
    halo.position.y = 1.2;
    this.group.add(this.gem, pillar, halo);
    this.group.visible = SHOW_PLACEHOLDERS;
  }

  update(dt: number): void {
    this.t += dt;
    this.gem.rotation.y += dt;
    this.gem.position.y = 1.2 + Math.sin(this.t * 2) * 0.05;
  }
}

export function missingModelPlaceholder(id: string, color?: number, label?: string): MissingModelPlaceholder {
  warnMissing(id, label);
  return new MissingModelPlaceholder(color);
}

/** Glowing markers for models that do not exist yet are a debugging aid: shown only with `?placeholders`. */
export const SHOW_PLACEHOLDERS = typeof location !== 'undefined' && new URLSearchParams(location.search).has('placeholders');

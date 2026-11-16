/**
 * What each breakable model is made of (2026-11-16): the inside its cut faces show, the weight of its rubble, and
 * whether it is a tree (solid logs from the trunk, the crown flutters off) or soft and brief (flowers, mushrooms,
 * kelp: gone within seconds). Everything else breaks into solid pieces that stay.
 */
import type { BreakKind } from '../render/BreakMaterial';

export interface BreakLook { material: BreakKind; tree?: true; brief?: true }

const TREES = /(^|-)(tree|pine|birch|willow|palm|cypress)$|^palm/;
const SOFT = /flower|rose-bush|mushroom|kelp|jelly|fish|leaf|lily|fruit|candle/;
const WOOD = /barrel|table|stall|treehouse|boat|carriage|cart|bridge|torch-post|crate|bench|bottle-shelf|door|campfire|tavern$|crypt-bar|platform/;
const PLASTER = /house|church|chapel|cloister|pavilion|sky-bar|observatory/;
const CRYSTAL = /crystal|gem|diamond|galaxy|orb/;
const GLASS = /bottle|potion|lean-cup|glass/;
const METAL = /lamp|lantern|chalice|tankard|brazier|cauldron|chandelier|crown|gate|coin|ring-portal/;
const BONE = /skull|skeleton|bone/;

export function breakKindOf(id: string): BreakLook {
  if (TREES.test(id) && !/mushroom/.test(id)) return { material: 'wood', tree: true };
  if (SOFT.test(id)) return { material: 'wood', brief: true };
  if (BONE.test(id)) return { material: 'bone' };
  if (GLASS.test(id) && !/shelf/.test(id)) return { material: 'glass' };
  if (CRYSTAL.test(id)) return { material: 'crystal' };
  if (WOOD.test(id)) return { material: 'wood' };
  if (PLASTER.test(id)) return { material: 'plaster' };
  if (METAL.test(id)) return { material: 'metal' };
  return { material: 'stone' };
}

import type { EnemyKind } from '../data/enemies';

/** Who a summoning boss calls to its side: its own place's mobs (the kingdom's imps, the drowned city's anglers), else fog beasts. */
export function summonKind(caster: EnemyKind): EnemyKind {
  if (caster === 'rift-king') return 'styro-ghoul';
  if (caster === 'grouper') return 'angler';
  return 'beast';
}

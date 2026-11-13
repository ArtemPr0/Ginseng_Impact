import { ENEMY_DEFS, type EnemyKind } from '../data/enemies';

/** Who a summoning boss calls to its side: its own place's mobs (EnemyDef.summons), else fog beasts. */
export function summonKind(caster: EnemyKind): EnemyKind {
  return ENEMY_DEFS[caster].summons ?? 'beast';
}

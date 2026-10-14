import type { BrainParams } from '../combat/EnemyBrain';
import type { Element } from '../combat/Elements';

export type EnemyKind = 'wisp' | 'sentinel';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  maxHp: number;
  def: number;
  atk: number;
  speed: number;
  element: Element;
  hover: number;
  bodyRadius: number;
  height: number;
  brain: BrainParams;
  respawn: number;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  wisp: {
    kind: 'wisp', name: 'Fog Wisp', maxHp: 380, def: 20, atk: 55, speed: 3.6, element: 'fog', hover: 1.6, bodyRadius: 0.7, height: 1.4,
    brain: { aggroRange: 24, attackRange: 12, windup: 0.5, recover: 0.6, attackCooldown: 1.6, preferredRange: 8 }, respawn: 25,
  },
  sentinel: {
    kind: 'sentinel', name: 'Stone Sentinel', maxHp: 900, def: 60, atk: 95, speed: 2.2, element: 'stone', hover: 0, bodyRadius: 1.0, height: 2.6,
    brain: { aggroRange: 20, attackRange: 2.9, windup: 0.6, recover: 0.9, attackCooldown: 0.4 }, respawn: 30,
  },
};

export const ENEMY_SPAWNS: ReadonlyArray<{ kind: EnemyKind; x: number; z: number }> = [
  { kind: 'wisp', x: -14, z: 60 }, { kind: 'wisp', x: 16, z: 52 }, { kind: 'sentinel', x: -11, z: 40 }, { kind: 'sentinel', x: 14, z: 28 },
  { kind: 'wisp', x: -60, z: 52 }, { kind: 'wisp', x: -80, z: 36 }, { kind: 'wisp', x: -66, z: 28 },
  { kind: 'sentinel', x: -13, z: -50 }, { kind: 'wisp', x: 15, z: -56 }, { kind: 'wisp', x: 30, z: -44 },
  { kind: 'sentinel', x: -12, z: -188 }, { kind: 'sentinel', x: 14, z: -184 },
];

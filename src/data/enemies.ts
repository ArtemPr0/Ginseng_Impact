import type { BrainParams } from '../combat/EnemyBrain';
import type { Element } from '../combat/Elements';

export type EnemyKind = 'beast' | 'yeti' | 'shade' | 'warden' | 'wyrm' | 'rivershade' | 'croc' | 'passbeast' | 'troll' | 'lurker' | 'marshdemon' | 'hollowking';

export type BossAttackKind = 'slam' | 'boulder' | 'roar' | 'volley' | 'summon' | 'blink' | 'roots' | 'sweep' | 'breath' | 'charge' | 'bite';

export interface BossAttack { kind: BossAttackKind; range: number; windup: number; recover: number; weight: number }

export interface DropEntry { itemId: string; chance: number }

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
  boss?: boolean;
  title?: string;
  attacks?: BossAttack[];
  flying?: boolean;
  scale?: number;
  shards: [number, number];
  drops?: DropEntry[];
  /** Keeps the mob near its spawn (water-bound bosses). */
  leash?: number;
  /** Heavy walker: footsteps shake the camera and puff dust. */
  stomp?: boolean;
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  beast: {
    kind: 'beast', name: 'Fog Beast', maxHp: 650, def: 30, atk: 85, speed: 6.5, element: 'rot', hover: 0, bodyRadius: 0.9, height: 1.5,
    brain: { aggroRange: 28, attackRange: 3.6, windup: 0.45, recover: 1.1, attackCooldown: 0.7 }, respawn: 35, shards: [8, 16], drops: [{ itemId: 'beast-fang', chance: 0.5 }, { itemId: 'moon-dew', chance: 0.3 }],
  },
  passbeast: {
    kind: 'passbeast', stomp: true, name: 'The Pass Beast', title: 'Terror of the Mountain Pass', maxHp: 5200, def: 60, atk: 140, speed: 5.5, element: 'rot', hover: 0, bodyRadius: 2.4, height: 3.8, scale: 2.6, boss: true,
    brain: { aggroRange: 34, attackRange: 7, windup: 0.6, recover: 1.2, attackCooldown: 0.8 }, respawn: 180, shards: [120, 180],
    attacks: [{ kind: 'bite', range: 7, windup: 0.5, recover: 1.0, weight: 3 }, { kind: 'charge', range: 22, windup: 0.8, recover: 1.4, weight: 2 }, { kind: 'roar', range: 14, windup: 0.9, recover: 1.2, weight: 1 }],
    drops: [{ itemId: 'fang-cleaver', chance: 1 }, { itemId: 'beast-fang', chance: 1 }],
  },
  yeti: {
    kind: 'yeti', stomp: true, name: 'The Yeti', title: 'Lord of the Frozen Grove', maxHp: 7000, def: 80, atk: 160, speed: 3.4, element: 'lunar', hover: 0, bodyRadius: 2.0, height: 5.2, boss: true,
    brain: { aggroRange: 30, attackRange: 6, windup: 0.8, recover: 1.3, attackCooldown: 0.9 }, respawn: 240, shards: [160, 240],
    attacks: [{ kind: 'slam', range: 7, windup: 0.9, recover: 1.4, weight: 3 }, { kind: 'boulder', range: 30, windup: 0.9, recover: 1.0, weight: 2 }, { kind: 'roar', range: 16, windup: 1.0, recover: 1.5, weight: 1 }],
    drops: [{ itemId: 'glacier-maul', chance: 1 }, { itemId: 'yeti-pelt', chance: 1 }, { itemId: 'moon-dew', chance: 1 }],
  },
  shade: {
    kind: 'shade', name: 'The Horned Shade', title: 'Sovereign of the Drowned Ruins', maxHp: 6200, def: 50, atk: 130, speed: 3.0, element: 'astral', hover: 0.6, bodyRadius: 1.8, height: 7, boss: true,
    brain: { aggroRange: 34, attackRange: 18, windup: 0.8, recover: 1.1, attackCooldown: 0.7, preferredRange: 10 }, respawn: 240, shards: [160, 240],
    attacks: [{ kind: 'volley', range: 24, windup: 0.9, recover: 1.0, weight: 3 }, { kind: 'summon', range: 30, windup: 1.2, recover: 1.6, weight: 1 }, { kind: 'blink', range: 30, windup: 0.5, recover: 0.4, weight: 2 }, { kind: 'sweep', range: 5, windup: 0.6, recover: 1.0, weight: 3 }],
    drops: [{ itemId: 'horn-staff', chance: 1 }, { itemId: 'shade-horn', chance: 1 }, { itemId: 'star-chart', chance: 0.5 }],
  },
  rivershade: {
    kind: 'rivershade', name: 'The River Shade', title: 'What Rises from the Water', maxHp: 3800, def: 40, atk: 110, speed: 2.4, element: 'tide', hover: 0.2, bodyRadius: 1.5, height: 5, boss: true, leash: 26,
    brain: { aggroRange: 26, attackRange: 18, windup: 0.8, recover: 1.0, attackCooldown: 0.8, preferredRange: 9 }, respawn: 200, shards: [90, 140],
    attacks: [{ kind: 'volley', range: 22, windup: 0.8, recover: 1.0, weight: 3 }, { kind: 'summon', range: 30, windup: 1.2, recover: 1.5, weight: 1 }, { kind: 'sweep', range: 5, windup: 0.6, recover: 0.9, weight: 2 }],
    drops: [{ itemId: 'tide-blade', chance: 1 }, { itemId: 'river-pearl', chance: 1 }],
  },
  warden: {
    kind: 'warden', stomp: true, name: 'The Antlered Warden', title: 'Who Wades the Great River', maxHp: 9000, def: 90, atk: 170, speed: 2.6, element: 'rot', hover: 0, bodyRadius: 3.2, height: 15, boss: true, leash: 40,
    brain: { aggroRange: 40, attackRange: 9, windup: 1.0, recover: 1.6, attackCooldown: 1.0 }, respawn: 300, shards: [220, 320],
    attacks: [{ kind: 'roots', range: 24, windup: 1.1, recover: 1.6, weight: 3 }, { kind: 'sweep', range: 11, windup: 0.9, recover: 1.4, weight: 3 }, { kind: 'slam', range: 9, windup: 1.0, recover: 1.5, weight: 2 }],
    drops: [{ itemId: 'warden-bough', chance: 1 }, { itemId: 'warden-antler', chance: 1 }, { itemId: 'moon-dew', chance: 1 }],
  },
  wyrm: {
    kind: 'wyrm', name: 'The Moon Wyrm', title: 'That Circles the Lonely Towers', maxHp: 8000, def: 70, atk: 150, speed: 9, element: 'lunar', hover: 14, bodyRadius: 2.2, height: 3, boss: true, flying: true,
    brain: { aggroRange: 60, attackRange: 30, windup: 0.9, recover: 1.4, attackCooldown: 1.0, preferredRange: 16 }, respawn: 300, shards: [240, 340],
    attacks: [{ kind: 'breath', range: 26, windup: 1.1, recover: 1.5, weight: 3 }, { kind: 'charge', range: 40, windup: 0.8, recover: 1.6, weight: 2 }],
    drops: [{ itemId: 'wyrm-fang-blade', chance: 1 }, { itemId: 'wyrm-scale', chance: 1 }, { itemId: 'star-chart', chance: 1 }],
  },
  troll: {
    kind: 'troll', stomp: true, name: 'The Gorge Troll', title: 'Red-Eyed Keeper of the Chasm', maxHp: 6400, def: 85, atk: 150, speed: 4.6, element: 'stone', hover: 0, bodyRadius: 2.0, height: 4.6, boss: true, leash: 34,
    brain: { aggroRange: 30, attackRange: 6.5, windup: 0.7, recover: 1.2, attackCooldown: 0.8 }, respawn: 240, shards: [150, 220],
    attacks: [{ kind: 'slam', range: 7, windup: 0.8, recover: 1.3, weight: 3 }, { kind: 'charge', range: 24, windup: 0.7, recover: 1.4, weight: 2 }, { kind: 'boulder', range: 28, windup: 0.9, recover: 1.0, weight: 2 }],
    drops: [{ itemId: 'troll-club', chance: 1 }, { itemId: 'troll-hide', chance: 1 }, { itemId: 'moon-dew', chance: 1 }],
  },
  lurker: {
    kind: 'lurker', name: 'The Lake Lurker', title: 'What Watches from the Shallows', maxHp: 5200, def: 55, atk: 125, speed: 2.2, element: 'tide', hover: 0, bodyRadius: 1.6, height: 4.2, boss: true, leash: 13,
    brain: { aggroRange: 28, attackRange: 16, windup: 0.8, recover: 1.0, attackCooldown: 0.8, preferredRange: 8 }, respawn: 220, shards: [130, 200],
    attacks: [{ kind: 'volley', range: 20, windup: 0.8, recover: 1.0, weight: 3 }, { kind: 'sweep', range: 5, windup: 0.6, recover: 0.9, weight: 2 }, { kind: 'summon', range: 28, windup: 1.2, recover: 1.5, weight: 1 }],
    drops: [{ itemId: 'tide-hook', chance: 1 }, { itemId: 'moonstring-bow', chance: 1 }, { itemId: 'lurker-eye', chance: 1 }],
  },
  marshdemon: {
    kind: 'marshdemon', name: 'The Marsh Sovereign', title: 'Four Horns of the Flooded Nave', maxHp: 8600, def: 90, atk: 165, speed: 2.0, element: 'astral', hover: 0, bodyRadius: 2.6, height: 12, boss: true, leash: 18,
    brain: { aggroRange: 36, attackRange: 14, windup: 0.9, recover: 1.3, attackCooldown: 0.9, preferredRange: 6 }, respawn: 300, shards: [220, 320],
    attacks: [{ kind: 'sweep', range: 12, windup: 0.8, recover: 1.2, weight: 3 }, { kind: 'breath', range: 24, windup: 1.1, recover: 1.5, weight: 3 }, { kind: 'roar', range: 16, windup: 1.0, recover: 1.4, weight: 1 }, { kind: 'summon', range: 30, windup: 1.2, recover: 1.6, weight: 1 }],
    drops: [{ itemId: 'horned-glaive', chance: 1 }, { itemId: 'demon-horn', chance: 1 }, { itemId: 'star-chart', chance: 0.5 }],
  },
  hollowking: {
    kind: 'hollowking', name: 'The Hollow King', title: 'Whose Heart Is a Kingdom', maxHp: 12000, def: 110, atk: 180, speed: 0, element: 'astral', hover: 0, bodyRadius: 9, height: 42, boss: true, leash: 1,
    brain: { aggroRange: 70, attackRange: 70, windup: 1.2, recover: 1.6, attackCooldown: 1.0 }, respawn: 400, shards: [320, 460],
    attacks: [{ kind: 'volley', range: 70, windup: 1.2, recover: 1.4, weight: 3 }, { kind: 'summon', range: 70, windup: 1.4, recover: 1.8, weight: 2 }, { kind: 'roar', range: 40, windup: 1.2, recover: 1.6, weight: 1 }],
    drops: [{ itemId: 'hollow-crown', chance: 1 }, { itemId: 'king-rib', chance: 1 }, { itemId: 'star-chart', chance: 1 }],
  },
  croc: {
    kind: 'croc', name: 'Mire Crocodile', maxHp: 900, def: 45, atk: 95, speed: 4.2, element: 'tide', hover: 0, bodyRadius: 1.2, height: 1.0, leash: 30,
    brain: { aggroRange: 18, attackRange: 3.2, windup: 0.5, recover: 1.0, attackCooldown: 0.6 }, respawn: 60, shards: [8, 14], drops: [{ itemId: 'croc-hide', chance: 0.6 }],
  },
};

export const ENEMY_SPAWNS: ReadonlyArray<{ kind: EnemyKind; x: number; z: number }> = [
  { kind: 'yeti', x: 71, z: -90 }, { kind: 'shade', x: -20, z: -91 }, { kind: 'warden', x: 36, z: 7 }, { kind: 'wyrm', x: -99, z: -24 },
  { kind: 'rivershade', x: -60, z: 14 }, { kind: 'passbeast', x: -24, z: -120 },
  { kind: 'troll', x: -66, z: -129 }, { kind: 'lurker', x: -18, z: -18 }, { kind: 'marshdemon', x: 99, z: -11 }, { kind: 'hollowking', x: 24, z: -136 },
  { kind: 'croc', x: 90, z: 12 }, { kind: 'croc', x: 96, z: 17 }, { kind: 'croc', x: 78, z: 4 },
  // Field packs: the red-eyed black beasts of the mountain-pass reel (DeXeZ7rhGVi), in pairs.
  { kind: 'beast', x: -8, z: 34 }, { kind: 'beast', x: 9, z: 30 },
  { kind: 'beast', x: -38, z: 28 }, { kind: 'beast', x: -46, z: 19 },
  { kind: 'beast', x: 9, z: -34 }, { kind: 'beast', x: 18, z: -26 },
  { kind: 'beast', x: -7, z: -112 }, { kind: 'beast', x: 8, z: -109 },
  { kind: 'beast', x: -65, z: 53 }, { kind: 'beast', x: 55, z: 59 }, { kind: 'beast', x: -24, z: -101 },
];

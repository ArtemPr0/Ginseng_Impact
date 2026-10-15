import type { BrainParams } from '../combat/EnemyBrain';
import type { Element } from '../combat/Elements';

export type EnemyKind = 'beast' | 'bucket' | 'crystalgolem' | 'emberrider' | 'yeti' | 'shade' | 'warden' | 'wyrm' | 'rivershade' | 'croc' | 'passbeast' | 'troll' | 'lurker' | 'marshdemon' | 'hollowking' | 'skeleton' | 'loggiant';

export type BossAttackKind = 'slam' | 'boulder' | 'roar' | 'volley' | 'summon' | 'blink' | 'roots' | 'sweep' | 'breath' | 'charge' | 'bite' | 'logthrow' | 'punch' | 'grab';

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
  /** Wading: the feet never sink below this world height (stands in water with its body above it). */
  floatAt?: number;
  /** Sits at its spot (its spawn's yaw) until the player comes near, then gets up to fight; sits back down at home. */
  seated?: boolean;
  /** Falls apart into a heap of bones when it dies (instead of a death clip). */
  collapse?: boolean;
  /** Ignores the player until hit (then fights until it loses them). */
  neutral?: boolean;
  /** Wings that beat (a clip-less flyer): the root bone of each wing, how far (radians) and how often (Hz). */
  wings?: { right: string; left: string; amp: number; rate: number };
}

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  // DdjlyzyOcnK: the skeletons warming their bones at the campfire; they get up when you come close.
  skeleton: {
    kind: 'skeleton', name: 'Campfire Skeleton', maxHp: 560, def: 22, atk: 72, speed: 3.2, element: 'fog', hover: 0, bodyRadius: 0.45, height: 1.75,
    brain: { aggroRange: 10, attackRange: 1.9, windup: 0.55, recover: 0.9, attackCooldown: 0.6 }, respawn: 90, leash: 16, shards: [6, 12],
    drops: [{ itemId: 'old-bone', chance: 1 }, { itemId: 'old-bone', chance: 0.5 }], seated: true, collapse: true,
  },
  // The giant who hauls logs on his back: leave him be and he walks his road; hit him and he throws the logs.
  loggiant: {
    kind: 'loggiant', stomp: true, name: 'The Log Giant', title: 'Who Carries the Forest', maxHp: 5400, def: 80, atk: 135, speed: 2.1, element: 'stone', hover: 0, bodyRadius: 1.2, height: 4.2, boss: true,
    brain: { aggroRange: 24, attackRange: 4, windup: 0.8, recover: 1.2, attackCooldown: 0.9 }, respawn: 180, leash: 34, shards: [120, 180], neutral: true,
    attacks: [{ kind: 'logthrow', range: 26, windup: 1.0, recover: 1.3, weight: 3 }, { kind: 'punch', range: 4.4, windup: 0.6, recover: 1.0, weight: 3 }, { kind: 'grab', range: 3.4, windup: 0.7, recover: 1.7, weight: 2 }],
    drops: [{ itemId: 'moon-dew', chance: 1 }, { itemId: 'rune-shard', chance: 1 }],
  },
  // DeaqHWJBBPw: white buckets with grinning faces, full of blue crystals, scuttling on skeletal legs.
  bucket: {
    kind: 'bucket', name: 'Bucket Mimic', maxHp: 520, def: 25, atk: 62, speed: 3.4, element: 'stone', hover: 0, bodyRadius: 0.5, height: 1.0,
    brain: { aggroRange: 10, attackRange: 2.0, windup: 0.4, recover: 0.8, attackCooldown: 0.5 }, respawn: 30, leash: 16, shards: [4, 9], drops: [{ itemId: 'rune-shard', chance: 0.4 }, { itemId: 'moon-dew', chance: 0.2 }],
  },
  // Dd0wR9Jh2lH: a humanoid of blue crystal shards walking rippled sand.
  crystalgolem: {
    kind: 'crystalgolem', stomp: true, name: 'Crystal Golem', maxHp: 1700, def: 90, atk: 120, speed: 2.4, element: 'stone', hover: 0, bodyRadius: 1.0, height: 2.6,
    brain: { aggroRange: 12, attackRange: 3.2, windup: 0.7, recover: 1.0, attackCooldown: 0.6 }, respawn: 45, leash: 20, shards: [12, 20], drops: [{ itemId: 'rune-shard', chance: 0.8 }],
  },
  // Ddn0A49tnW7: a red-eyed rider on a black horse with a burning mane, through the dead wood.
  emberrider: {
    kind: 'emberrider', stomp: true, name: 'The Ember Rider', title: 'Who Rides the Dead Wood', maxHp: 6200, def: 70, atk: 150, speed: 5.5, element: 'blood', hover: 0, bodyRadius: 1.3, height: 2.7, boss: true,
    brain: { aggroRange: 18, attackRange: 5, windup: 0.6, recover: 1.2, attackCooldown: 0.8 }, respawn: 200, leash: 30, shards: [140, 200],
    attacks: [{ kind: 'charge', range: 18, windup: 0.7, recover: 1.3, weight: 3 }, { kind: 'breath', range: 8, windup: 0.9, recover: 1.4, weight: 2 }, { kind: 'roar', range: 12, windup: 0.9, recover: 1.2, weight: 1 }],
    drops: [{ itemId: 'beast-fang', chance: 1 }, { itemId: 'moon-dew', chance: 1 }],
  },
  beast: {
    kind: 'beast', name: 'Fog Beast', maxHp: 650, def: 30, atk: 85, speed: 3.6, element: 'rot', hover: 0, bodyRadius: 0.7, height: 1.5,
    brain: { aggroRange: 12, attackRange: 2.6, windup: 0.45, recover: 1.1, attackCooldown: 0.7 }, respawn: 35, leash: 22, shards: [8, 16], drops: [{ itemId: 'beast-fang', chance: 0.5 }, { itemId: 'moon-dew', chance: 0.3 }],
  },
  passbeast: {
    kind: 'passbeast', stomp: true, name: 'The Pass Beast', title: 'Terror of the Mountain Pass', maxHp: 5200, def: 60, atk: 140, speed: 4.8, element: 'rot', hover: 0, bodyRadius: 1.4, height: 2.4, boss: true,
    brain: { aggroRange: 18, attackRange: 4, windup: 0.6, recover: 1.2, attackCooldown: 0.8 }, respawn: 180, leash: 28, shards: [120, 180],
    attacks: [{ kind: 'bite', range: 4, windup: 0.5, recover: 1.0, weight: 3 }, { kind: 'charge', range: 16, windup: 0.8, recover: 1.4, weight: 2 }, { kind: 'roar', range: 12, windup: 0.9, recover: 1.2, weight: 1 }],
    drops: [{ itemId: 'fang-cleaver', chance: 1 }, { itemId: 'beast-fang', chance: 1 }],
  },
  yeti: {
    kind: 'yeti', stomp: true, name: 'The Yeti', title: 'Lord of the Frozen Grove', maxHp: 7000, def: 80, atk: 160, speed: 3.4, element: 'lunar', hover: 0, bodyRadius: 1.3, height: 3.2, boss: true,
    brain: { aggroRange: 18, attackRange: 4, windup: 0.8, recover: 1.3, attackCooldown: 0.9 }, respawn: 240, leash: 30, shards: [160, 240],
    attacks: [{ kind: 'slam', range: 5, windup: 0.9, recover: 1.4, weight: 3 }, { kind: 'boulder', range: 20, windup: 0.9, recover: 1.0, weight: 2 }, { kind: 'roar', range: 12, windup: 1.0, recover: 1.5, weight: 1 }],
    drops: [{ itemId: 'glacier-maul', chance: 1 }, { itemId: 'yeti-pelt', chance: 1 }, { itemId: 'moon-dew', chance: 1 }],
  },
  shade: {
    kind: 'shade', name: 'The Horned Shade', title: 'Sovereign of the Drowned Ruins', maxHp: 6200, def: 50, atk: 130, speed: 3.0, element: 'astral', hover: 0.6, bodyRadius: 3.4, height: 10, boss: true,
    brain: { aggroRange: 18, attackRange: 14, windup: 0.8, recover: 1.1, attackCooldown: 0.7, preferredRange: 8 }, respawn: 240, leash: 28, shards: [160, 240],
    attacks: [{ kind: 'volley', range: 16, windup: 0.9, recover: 1.0, weight: 3 }, { kind: 'summon', range: 20, windup: 1.2, recover: 1.6, weight: 1 }, { kind: 'blink', range: 16, windup: 0.5, recover: 0.4, weight: 2 }, { kind: 'sweep', range: 4, windup: 0.6, recover: 1.0, weight: 3 }],
    drops: [{ itemId: 'horn-staff', chance: 1 }, { itemId: 'shade-horn', chance: 1 }, { itemId: 'star-chart', chance: 0.5 }],
  },
  rivershade: {
    kind: 'rivershade', name: 'The River Shade', title: 'What Rises from the Water', maxHp: 3800, def: 40, atk: 110, speed: 2.4, element: 'tide', hover: 0.2, bodyRadius: 1.0, height: 3, boss: true, leash: 14,
    brain: { aggroRange: 15, attackRange: 13, windup: 0.8, recover: 1.0, attackCooldown: 0.8, preferredRange: 7 }, respawn: 200, shards: [90, 140],
    attacks: [{ kind: 'volley', range: 14, windup: 0.8, recover: 1.0, weight: 3 }, { kind: 'summon', range: 18, windup: 1.2, recover: 1.5, weight: 1 }, { kind: 'sweep', range: 4, windup: 0.6, recover: 0.9, weight: 2 }],
    drops: [{ itemId: 'tide-blade', chance: 1 }, { itemId: 'river-pearl', chance: 1 }],
  },
  warden: {
    kind: 'warden', stomp: true, name: 'The Antlered Warden', title: 'Who Wades the Great River', maxHp: 9000, def: 90, atk: 170, speed: 2.6, element: 'rot', hover: 0, bodyRadius: 1.8, height: 6.5, boss: true, leash: 26,
    brain: { aggroRange: 20, attackRange: 6, windup: 1.0, recover: 1.6, attackCooldown: 1.0 }, respawn: 300, shards: [220, 320],
    attacks: [{ kind: 'roots', range: 16, windup: 1.1, recover: 1.6, weight: 3 }, { kind: 'sweep', range: 7, windup: 0.9, recover: 1.4, weight: 3 }, { kind: 'slam', range: 6, windup: 1.0, recover: 1.5, weight: 2 }],
    drops: [{ itemId: 'warden-bough', chance: 1 }, { itemId: 'warden-antler', chance: 1 }, { itemId: 'moon-dew', chance: 1 }],
  },
  wyrm: {
    // moon-wyrm.glb's smart rig has no clips: its wings (the upper side chains, measured) beat by hand.
    wings: { right: 'Bone_035', left: 'Bone_037', amp: 0.55, rate: 1.1 },
    kind: 'wyrm', name: 'The Moon Wyrm', title: 'That Circles the Lonely Towers', maxHp: 8000, def: 70, atk: 150, speed: 9, element: 'lunar', hover: 14, bodyRadius: 2.2, height: 3, boss: true, flying: true,
    brain: { aggroRange: 30, attackRange: 22, windup: 0.9, recover: 1.4, attackCooldown: 1.0, preferredRange: 13 }, respawn: 300, leash: 45, shards: [240, 340],
    attacks: [{ kind: 'breath', range: 20, windup: 1.1, recover: 1.5, weight: 3 }, { kind: 'charge', range: 30, windup: 0.8, recover: 1.6, weight: 2 }],
    drops: [{ itemId: 'wyrm-fang-blade', chance: 1 }, { itemId: 'wyrm-scale', chance: 1 }, { itemId: 'star-chart', chance: 1 }],
  },
  troll: {
    kind: 'troll', stomp: true, name: 'The Gorge Troll', title: 'Red-Eyed Keeper of the Chasm', maxHp: 6400, def: 85, atk: 150, speed: 4.6, element: 'stone', hover: 0, bodyRadius: 1.3, height: 3.2, boss: true, leash: 26,
    brain: { aggroRange: 18, attackRange: 4.5, windup: 0.7, recover: 1.2, attackCooldown: 0.8 }, respawn: 240, shards: [150, 220],
    attacks: [{ kind: 'slam', range: 5, windup: 0.8, recover: 1.3, weight: 3 }, { kind: 'charge', range: 18, windup: 0.7, recover: 1.4, weight: 2 }, { kind: 'boulder', range: 20, windup: 0.9, recover: 1.0, weight: 2 }],
    drops: [{ itemId: 'troll-club', chance: 1 }, { itemId: 'troll-hide', chance: 1 }, { itemId: 'moon-dew', chance: 1 }],
  },
  lurker: {
    kind: 'lurker', name: 'The Lake Lurker', title: 'What Watches from the Shallows', maxHp: 5200, def: 55, atk: 125, speed: 2.2, element: 'tide', hover: 0, floatAt: 0.6, bodyRadius: 1.2, height: 2.8, boss: true, leash: 8,
    brain: { aggroRange: 14, attackRange: 12, windup: 0.8, recover: 1.0, attackCooldown: 0.8, preferredRange: 7 }, respawn: 220, shards: [130, 200],
    attacks: [{ kind: 'volley', range: 14, windup: 0.8, recover: 1.0, weight: 3 }, { kind: 'sweep', range: 4, windup: 0.6, recover: 0.9, weight: 2 }, { kind: 'summon', range: 16, windup: 1.2, recover: 1.5, weight: 1 }],
    drops: [{ itemId: 'tide-hook', chance: 1 }, { itemId: 'moonstring-bow', chance: 1 }, { itemId: 'lurker-eye', chance: 1 }],
  },
  marshdemon: {
    kind: 'marshdemon', name: 'The Marsh Sovereign', title: 'Four Horns of the Flooded Nave', maxHp: 8600, def: 90, atk: 165, speed: 2.0, element: 'astral', hover: 0, bodyRadius: 1.6, height: 5, boss: true, leash: 16,
    brain: { aggroRange: 18, attackRange: 10, windup: 0.9, recover: 1.3, attackCooldown: 0.9, preferredRange: 5 }, respawn: 300, shards: [220, 320],
    attacks: [{ kind: 'sweep', range: 7, windup: 0.8, recover: 1.2, weight: 3 }, { kind: 'breath', range: 16, windup: 1.1, recover: 1.5, weight: 3 }, { kind: 'roar', range: 12, windup: 1.0, recover: 1.4, weight: 1 }, { kind: 'summon', range: 18, windup: 1.2, recover: 1.6, weight: 1 }],
    drops: [{ itemId: 'horned-glaive', chance: 1 }, { itemId: 'demon-horn', chance: 1 }, { itemId: 'star-chart', chance: 0.5 }],
  },
  hollowking: {
    kind: 'hollowking', name: 'The Hollow King', title: 'Whose Heart Is a Kingdom', maxHp: 12000, def: 110, atk: 180, speed: 0, element: 'astral', hover: 0, bodyRadius: 2.5, height: 10, boss: true, leash: 1,
    brain: { aggroRange: 24, attackRange: 24, windup: 1.2, recover: 1.6, attackCooldown: 1.0 }, respawn: 400, shards: [320, 460],
    attacks: [{ kind: 'volley', range: 24, windup: 1.2, recover: 1.4, weight: 3 }, { kind: 'summon', range: 24, windup: 1.4, recover: 1.8, weight: 2 }, { kind: 'roar', range: 18, windup: 1.2, recover: 1.6, weight: 1 }],
    drops: [{ itemId: 'hollow-crown', chance: 1 }, { itemId: 'king-rib', chance: 1 }, { itemId: 'star-chart', chance: 1 }],
  },
  croc: {
    kind: 'croc', name: 'Mire Crocodile', maxHp: 900, def: 45, atk: 95, speed: 4.2, element: 'tide', hover: 0, bodyRadius: 1.2, height: 0.7, leash: 16,
    brain: { aggroRange: 10, attackRange: 3.6, windup: 0.5, recover: 1.0, attackCooldown: 0.6 }, respawn: 60, shards: [8, 14], drops: [{ itemId: 'croc-hide', chance: 0.6 }],
  },
};

/**
 * Where every enemy lives. Rules of the layout: nothing hostile within ~45 m of the spawn and the village; bosses
 * hold their own arenas off the roads, apart from each other; small mobs come in pairs at camps. Every enemy is
 * leashed to its spot and walks home (healing) once the player leaves (Enemy.update).
 */
/**
 * `yaw`: facing at the spot (seated mobs face their fire); `exact`: placed exactly there (a seat), not at the nearest
 * free ground; `patrol`: a route walked while not fighting (its home moves along it).
 */
export interface EnemySpawn { kind: EnemyKind; x: number; z: number; yaw?: number; exact?: boolean; patrol?: ReadonlyArray<readonly [number, number]> }

export const ENEMY_SPAWNS: ReadonlyArray<EnemySpawn> = [
  // Bosses
  { kind: 'yeti', x: 72, z: -94 },          // frozen grove, north-east
  { kind: 'shade', x: 66, z: -130 },        // the drowned stones on the north shore
  { kind: 'warden', x: 68, z: 38 },         // the clearing in the east forest, under the rain
  { kind: 'wyrm', x: 106, z: 22 },          // circling the lonely wizard tower
  { kind: 'rivershade', x: -62, z: 16 },    // rising from the witch stream by the bridge
  { kind: 'passbeast', x: -36, z: -140 },   // the mountain pass behind the peak
  { kind: 'troll', x: -70, z: -126 },       // the gorge
  { kind: 'lurker', x: -24, z: -14 },       // the lily pond's shallows (west of the whirlpool)
  { kind: 'marshdemon', x: 106, z: -18 },   // the flooded ruin's pool, east of the cathedral
  { kind: 'hollowking', x: 36, z: -146 },   // seated on the north shore, east of the head
  { kind: 'emberrider', x: 16, z: -122 },   // the dead wood east of the causeway's end
  // The log giant walks the old haul road by the skeleton camp, minding his own business until someone hits him.
  { kind: 'loggiant', x: -12, z: 36, patrol: [[-12, 36], [-26, 38], [-38, 40], [-26, 38]] },
  // The skeletons around the campfire by the village (DdjlyzyOcnK): seated on their barrels, facing the fire at (-24, 52).
  { kind: 'skeleton', x: -21.6, z: 53.4, yaw: Math.atan2(52 - 53.4, -24 + 21.6), exact: true },
  { kind: 'skeleton', x: -26.4, z: 53.4, yaw: Math.atan2(52 - 53.4, -24 + 26.4), exact: true },
  { kind: 'skeleton', x: -24, z: 49.2, yaw: Math.atan2(52 - 49.2, 0), exact: true },
  // Camps (pairs)
  { kind: 'croc', x: 108, z: 10 }, { kind: 'croc', x: 118, z: 6 }, { kind: 'croc', x: 100, z: 15 }, // the river mouth, east
  { kind: 'beast', x: -62, z: 36 }, { kind: 'beast', x: -66, z: 30 },      // west meadow, by the stream
  { kind: 'crystalgolem', x: 44, z: 62 }, { kind: 'crystalgolem', x: 52, z: 66 }, // deep in the desert
  // The bucket mimics' street in the galaxy city beyond the portal (see GALAXY in data/world.ts).
  { kind: 'bucket', x: 975, z: 20 }, { kind: 'bucket', x: 966, z: 22 }, { kind: 'bucket', x: 958, z: 18 }, { kind: 'bucket', x: 984, z: 18 },
];

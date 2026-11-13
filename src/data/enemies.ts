import type { BrainParams } from '../combat/EnemyBrain';
import type { Element } from '../combat/Elements';

export type EnemyKind = 'beast' | 'bucket' | 'crystalsentry' | 'emberrider' | 'yeti' | 'shade' | 'warden' | 'wyrm' | 'rivershade' | 'croc' | 'passbeast' | 'troll' | 'lurker' | 'marshdemon' | 'hollowking' | 'skeleton' | 'loggiant' | 'styro-ghoul' | 'lean-chucker' | 'rift-king' | 'spiderchapel' | 'lean-bubble' | 'dmt-entity' | 'cyclops' | 'cyclops-lord' | 'blood-eye' | 'trip-wizard' | 'galaxy-knight' | 'mail-knight' | 'diamond-wizard' | 'fish-guard' | 'angler' | 'grave-skeleton' | 'koi' | 'jellyfish' | 'archway-shade' | 'brazier-hermit' | 'vale-knight' | 'grouper';

/** What can circle a mob, and the projectile each flies as when thrown. */
export type OrbitModel = 'gem' | 'lean-cup';
export const ORBIT_SHOT: Record<OrbitModel, 'gem' | 'cup'> = { gem: 'gem', 'lean-cup': 'cup' };

export type BossAttackKind = 'slam' | 'boulder' | 'roar' | 'volley' | 'summon' | 'blink' | 'roots' | 'sweep' | 'breath' | 'charge' | 'bite' | 'logthrow' | 'punch' | 'grab' | 'cupmortar' | 'cupvolley' | 'snowstorm' | 'web' | 'webdrop' | 'hop' | 'kaleido' | 'eyebeam' | 'mirror' | 'glare' | 'thorns' | 'rainbow' | 'diamond';

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
  /** Who its 'summon' attack calls (its own place's mobs; fog beasts if unset). */
  summons?: EnemyKind;
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
  /** Never fights back; still dies when hit (decorative flyers you can shoot). */
  passive?: boolean;
  /** Wings that beat (a clip-less flyer): the root bone of each wing, how far (radians) and how often (Hz). */
  wings?: { right: string; left: string; amp: number; rate: number };
  /** Flying: never lower than this height above the ground under it (or above the hero, if higher), metres. */
  flyAbove?: number;
  /** A body that is not a model: a living bubble of lean (render/LeanBubble), `bodyRadius` across. */
  body?: 'bubble';
  /** Drawn as the dream sees it: every colour at once (render/Materials patchTrippy). */
  trippy?: boolean;
  /**
   * A giant eye (the Blood Eye): its iris and pupil are drawn over the model and follow the hero (render/EyeIris): the
   * eyeball's radius out to just over its painted pupil and the iris's radius (fractions of the model's height), and
   * the way the eye looks (x, y of a unit vector, z forward). blood-eye.glb, measured from its mesh and texture: the
   * painted pupil is a dome 0.2 across centred on (0.03, 0.22) with its peak 0.66 out (of 1.893), so the eye looks
   * 19 degrees up; the eye tilts to put that on the hero.
   */
  eye?: { iris: number; ball: number; size: number; axis: [number, number] };
  /** Colour of its eye beam (default the dream's cyan). */
  beamColor?: number;
  /** Its texture glows (emissive from its own colours) at this strength: the Blood Eye burns in the night. */
  glow?: number;
  /** Things circling it (a model, this many): its 'diamond' attack throws the one nearest the hero (ORBIT_SHOT). */
  orbit?: { model: OrbitModel; count: number };
  /** Lines it says (ids in data/voices): when it spots you, as it throws, as it dies, and when you fall. */
  voices?: { aggro: string[]; attack: string[]; death: string[]; win: string[] };
}

/** The Styro-Ghouls' high, autotuned lines (the user's script). */
const GHOUL_VOICES = {
  aggro: ['ghoul-aggro-1', 'ghoul-aggro-2'],
  attack: ['ghoul-attack-1', 'ghoul-attack-2', 'ghoul-attack-3'],
  death: ['ghoul-death-1', 'ghoul-death-2'],
  win: ['ghoul-win-1', 'ghoul-win-2'],
};

export const ENEMY_DEFS: Record<EnemyKind, EnemyDef> = {
  // The huge blue cyclops wading at the eye pool beside the hamlet (#28): minds his own business until hit, then
  // stamps, throws stones, and sweeps the bank with the yellow beam of his eye.
  cyclops: {
    kind: 'cyclops', stomp: true, name: 'The Cyclops', title: 'Who Wades the Eye', maxHp: 8800, def: 85, atk: 160, speed: 2.4, element: 'stone', hover: 0, bodyRadius: 2.2, height: 9, boss: true,
    neutral: true, floatAt: 0.9, beamColor: 0xffd23a, glow: 1.1,
    brain: { aggroRange: 22, attackRange: 7, windup: 1.0, recover: 1.4, attackCooldown: 1.0 }, respawn: 300, leash: 8, shards: [200, 300],
    attacks: [{ kind: 'slam', range: 8, windup: 1.0, recover: 1.4, weight: 3 }, { kind: 'boulder', range: 24, windup: 1.0, recover: 1.1, weight: 2 }, { kind: 'eyebeam', range: 26, windup: 1.1, recover: 1.3, weight: 2 }, { kind: 'roar', range: 14, windup: 1.0, recover: 1.4, weight: 1 }],
    drops: [{ itemId: 'moon-dew', chance: 1 }, { itemId: 'rune-shard', chance: 1 }],
  },
  // The cyclops at the end of the Alley of Graves (01.16.54), before the gothic tower: he throws the graves.
  'cyclops-lord': {
    kind: 'cyclops-lord', stomp: true, name: 'The Grave Cyclops', title: 'Keeper of the Alley', maxHp: 10500, def: 95, atk: 175, speed: 3.0, element: 'stone', hover: 0, bodyRadius: 1.9, height: 7, boss: true,
    beamColor: 0xffd23a, glow: 1.0,
    brain: { aggroRange: 24, attackRange: 6, windup: 0.9, recover: 1.3, attackCooldown: 0.9 }, respawn: 300, leash: 22, shards: [260, 360],
    attacks: [{ kind: 'slam', range: 7, windup: 0.9, recover: 1.3, weight: 3 }, { kind: 'boulder', range: 24, windup: 0.9, recover: 1.0, weight: 3 }, { kind: 'eyebeam', range: 26, windup: 1.0, recover: 1.2, weight: 2 }, { kind: 'roar', range: 14, windup: 1.0, recover: 1.4, weight: 1 }],
    drops: [{ itemId: 'star-chart', chance: 1 }, { itemId: 'moon-dew', chance: 1 }],
  },
  // The giant red spiky eyeball over the chasm (01.32.26): it watches the causeway, burns it with its stare, throws
  // its thorns, and pins whoever meets its glare.
  'blood-eye': {
    kind: 'blood-eye', name: 'The Blood Eye', title: 'That Watches the Chasm', maxHp: 7600, def: 60, atk: 150, speed: 3.5, element: 'blood', hover: 0, bodyRadius: 2.6, height: 6, boss: true,
    flying: true, flyAbove: 14, floatAt: 10, eye: { iris: 0x3a5cff, ball: 0.35, size: 0.135, axis: [0.035, 0.32] }, beamColor: 0xff2a2a, glow: 1.0,
    brain: { aggroRange: 34, attackRange: 30, windup: 1.0, recover: 1.2, attackCooldown: 0.9, preferredRange: 16 }, respawn: 300, leash: 40, shards: [220, 320],
    attacks: [{ kind: 'eyebeam', range: 30, windup: 1.0, recover: 1.2, weight: 3 }, { kind: 'thorns', range: 26, windup: 1.0, recover: 1.2, weight: 2 }, { kind: 'glare', range: 30, windup: 1.4, recover: 1.0, weight: 2 }],
    drops: [{ itemId: 'lurker-eye', chance: 1 }, { itemId: 'star-chart', chance: 1 }],
  },
  // The wizard in a rainbow robe who flies in the frog's dream (01.32.45): his ribbons and spells, when they touch you,
  // send the whole world swirling.
  'trip-wizard': {
    kind: 'trip-wizard', name: 'The Prism Wizard', title: 'Who Paints the Trip', maxHp: 4200, def: 50, atk: 115, speed: 4.5, element: 'astral', hover: 0, bodyRadius: 0.7, height: 1.9, boss: true,
    flying: true, flyAbove: 5, trippy: true,
    brain: { aggroRange: 28, attackRange: 24, windup: 0.9, recover: 1.0, attackCooldown: 0.7, preferredRange: 13 }, respawn: 25, leash: 60, shards: [260, 340],
    attacks: [{ kind: 'rainbow', range: 26, windup: 0.9, recover: 1.0, weight: 3 }, { kind: 'kaleido', range: 26, windup: 1.0, recover: 1.0, weight: 2 }, { kind: 'blink', range: 20, windup: 0.5, recover: 0.4, weight: 1 }],
    drops: [{ itemId: 'star-chart', chance: 1 }],
  },
  // Bubbles of lean come alive in the giant cups of the kingdom: they bob about in the lean and leap at you.
  'lean-bubble': {
    kind: 'lean-bubble', name: 'Lean Bubble', maxHp: 260, def: 10, atk: 58, speed: 3.2, element: 'astral', hover: 0, bodyRadius: 0.7, height: 1.4, body: 'bubble',
    brain: { aggroRange: 9, attackRange: 5, windup: 0.5, recover: 1.0, attackCooldown: 0.7 }, respawn: 45, leash: 4.2, shards: [3, 6],
    attacks: [{ kind: 'hop', range: 5, windup: 0.5, recover: 1.0, weight: 1 }],
  },
  // The Frog King as he really is, in his dream: a seven-metre god of every colour, floating over the fractal floor.
  // Rings of tripping orbs, a sweeping stare, a leap that lands where you stand, and reflections of himself.
  'dmt-entity': {
    kind: 'dmt-entity', name: 'The Frog God', title: 'Who Dreams You Back', maxHp: 3400, def: 50, atk: 110, speed: 3, element: 'astral', hover: 0.5, bodyRadius: 2.4, height: 7, boss: true, trippy: true,
    brain: { aggroRange: 55, attackRange: 30, windup: 1.0, recover: 1.1, attackCooldown: 0.6, preferredRange: 11 }, respawn: 20, leash: 60, shards: [420, 520],
    attacks: [
      { kind: 'kaleido', range: 30, windup: 1.0, recover: 1.0, weight: 3 },
      { kind: 'eyebeam', range: 26, windup: 0.9, recover: 1.2, weight: 2 },
      { kind: 'hop', range: 22, windup: 0.9, recover: 1.3, weight: 2 },
      { kind: 'mirror', range: 30, windup: 1.2, recover: 1.4, weight: 1 },
    ],
    // (No Third Eye here: the quest graph hands it over once, on the first kill, data/quests.ts trip 'god'.)
    drops: [{ itemId: 'moon-dew', chance: 1 }],
  },
  // The chapel on spider legs (DdmvaMvMvS4): it stalks the kingdom's snowfield past the graves on its own legs (no longer
  // hung in the sky over the island's west rim, 2026-11-03: dangling legs read as broken), and when you come near it spits webs that pin you where you stand and drops nets over where you are.
  spiderchapel: {
    kind: 'spiderchapel', name: 'The Spider Chapel', title: 'That Walks the Snow', maxHp: 9500, def: 85, atk: 140, speed: 4.5, element: 'fog', hover: 0, bodyRadius: 7, height: 28, boss: true,
    brain: { aggroRange: 18, attackRange: 18, windup: 1.0, recover: 1.4, attackCooldown: 1.2, preferredRange: 14 }, respawn: 360, leash: 60, shards: [260, 360],
    attacks: [{ kind: 'web', range: 36, windup: 1.0, recover: 1.4, weight: 3 }, { kind: 'webdrop', range: 30, windup: 1.2, recover: 1.5, weight: 2 }],
    drops: [{ itemId: 'star-chart', chance: 1 }, { itemId: 'rune-shard', chance: 1 }],
  },
  // Yung Lean's kingdom: short purple imps with leaking double cups on their backs, lobbing cups like mortar shells.
  'styro-ghoul': {
    kind: 'styro-ghoul', name: 'Styro-Ghoul', maxHp: 640, def: 28, atk: 66, speed: 3.6, element: 'astral', hover: 0, bodyRadius: 0.5, height: 1.25,
    brain: { aggroRange: 16, attackRange: 15, windup: 0.9, recover: 1.0, attackCooldown: 0.8, preferredRange: 9 }, respawn: 60, leash: 18, shards: [8, 14],
    attacks: [{ kind: 'cupmortar', range: 16, windup: 0.9, recover: 1.1, weight: 1 }],
    drops: [{ itemId: 'moon-dew', chance: 0.25 }], voices: GHOUL_VOICES,
  },
  // Their boss, enthroned in the domed pavilion: gets up when you come in and fills the room with exploding cups.
  'lean-chucker': {
    kind: 'lean-chucker', name: 'The Lean-Chucker', title: 'Who Holds the Pavilion', maxHp: 5200, def: 70, atk: 120, speed: 3.2, element: 'astral', hover: 0, bodyRadius: 0.8, height: 1.9, boss: true,
    brain: { aggroRange: 14, attackRange: 18, windup: 1.0, recover: 1.2, attackCooldown: 0.8, preferredRange: 8 }, respawn: 200, leash: 22, shards: [150, 220], seated: true,
    attacks: [{ kind: 'cupvolley', range: 20, windup: 1.0, recover: 1.3, weight: 3 }, { kind: 'cupmortar', range: 20, windup: 0.8, recover: 1.0, weight: 2 }, { kind: 'sweep', range: 5, windup: 0.6, recover: 1.0, weight: 1 }],
    drops: [{ itemId: 'rune-shard', chance: 1 }, { itemId: 'moon-dew', chance: 1 }], voices: GHOUL_VOICES,
  },
  // Old Hollowstaff on the bucket street (DeaqHWJBBPw's skeleton wizard): double cups of lean circle him (they were
  // diamonds; the playtest of 2026-11-12 asked for cups), and the one nearest you is thrown at you; it fills back in a
  // few seconds.
  'diamond-wizard': {
    kind: 'diamond-wizard', name: 'Old Hollowstaff', title: 'Who Throws His Cups', maxHp: 4800, def: 60, atk: 115, speed: 3.0, element: 'astral', hover: 0, bodyRadius: 0.7, height: 1.9, boss: true,
    brain: { aggroRange: 15, attackRange: 18, windup: 0.6, recover: 0.6, attackCooldown: 0.5, preferredRange: 9 }, respawn: 220, leash: 18, shards: [140, 210],
    attacks: [{ kind: 'diamond', range: 20, windup: 0.5, recover: 0.5, weight: 5 }, { kind: 'blink', range: 12, windup: 0.5, recover: 0.4, weight: 1 }, { kind: 'sweep', range: 3, windup: 0.6, recover: 1.0, weight: 1 }],
    drops: [{ itemId: 'rune-shard', chance: 1 }, { itemId: 'star-chart', chance: 0.4 }], collapse: true, orbit: { model: 'lean-cup', count: 9 },
  },
  // Yung Lean himself, off his throne when you challenge him: digital snow, cups, his ghouls.
  'rift-king': {
    kind: 'rift-king', summons: 'styro-ghoul', name: 'Yung Lean', title: 'King of the Sad Side of the World', maxHp: 9000, def: 80, atk: 135, speed: 3.6, element: 'astral', hover: 0, bodyRadius: 0.7, height: 1.85, boss: true,
    brain: { aggroRange: 34, attackRange: 14, windup: 1.0, recover: 1.2, attackCooldown: 0.7, preferredRange: 7 }, respawn: 1e9, leash: 45, shards: [300, 400],
    attacks: [{ kind: 'snowstorm', range: 24, windup: 1.2, recover: 1.0, weight: 3 }, { kind: 'cupmortar', range: 20, windup: 0.8, recover: 1.0, weight: 2 }, { kind: 'summon', range: 30, windup: 1.3, recover: 1.5, weight: 1 }, { kind: 'volley', range: 18, windup: 0.9, recover: 1.0, weight: 2 }],
    drops: [{ itemId: 'moon-dew', chance: 1 }],
  },
  // DdjlyzyOcnK: the skeletons warming their bones at the campfire; they get up when you come close.
  skeleton: {
    kind: 'skeleton', name: 'Campfire Skeleton', maxHp: 560, def: 22, atk: 72, speed: 3.2, element: 'fog', hover: 0, bodyRadius: 0.45, height: 1.75,
    brain: { aggroRange: 10, attackRange: 1.9, windup: 0.55, recover: 0.9, attackCooldown: 0.6 }, respawn: 90, leash: 16, shards: [6, 12],
    drops: [{ itemId: 'old-bone', chance: 1 }, { itemId: 'old-bone', chance: 0.5 }], seated: true, collapse: true,
  },
  // Out of the ground of the Alley of Graves while you walk it (CombatSystem.updateGraveRising): never respawned.
  'grave-skeleton': {
    kind: 'grave-skeleton', name: 'Risen Skeleton', maxHp: 420, def: 18, atk: 64, speed: 3.0, element: 'fog', hover: 0, bodyRadius: 0.45, height: 1.75,
    brain: { aggroRange: 12, attackRange: 1.9, windup: 0.55, recover: 0.9, attackCooldown: 0.7 }, respawn: 120, leash: 22, shards: [3, 7],
    drops: [{ itemId: 'old-bone', chance: 0.4 }], collapse: true,
  },
  // Round 9 (2026-11-10), from the reels: the hooded figure with the armoured gauntlet from the gothic archway
  // (DdnJDwBMUoj) haunting the dead wood and the gorge rim; the brown-robed hermit who lifts a fire brazier
  // (DdyN2PNyIxb) on the peak's flank and the Frost March; the red-caped knight of the vale's street (Dd5Bqt7vQ5T).
  'archway-shade': {
    kind: 'archway-shade', name: 'Archway Shade', maxHp: 720, def: 32, atk: 92, speed: 3.4, element: 'fog', hover: 0, bodyRadius: 0.5, height: 2.0,
    brain: { aggroRange: 13, attackRange: 2.4, windup: 0.5, recover: 1.0, attackCooldown: 0.7 }, respawn: 90, leash: 22, shards: [10, 18],
    drops: [{ itemId: 'old-bone', chance: 0.4 }, { itemId: 'moon-dew', chance: 0.25 }],
  },
  'brazier-hermit': {
    kind: 'brazier-hermit', name: 'Brazier Hermit', maxHp: 620, def: 26, atk: 84, speed: 3.0, element: 'blood', hover: 0, bodyRadius: 0.5, height: 1.9,
    brain: { aggroRange: 12, attackRange: 2.4, windup: 0.55, recover: 1.0, attackCooldown: 0.8 }, respawn: 90, leash: 20, shards: [8, 16],
    drops: [{ itemId: 'moon-dew', chance: 0.35 }],
  },
  'vale-knight': {
    kind: 'vale-knight', name: 'Vale Knight', maxHp: 950, def: 46, atk: 104, speed: 3.6, element: 'lunar', hover: 0, bodyRadius: 0.5, height: 1.9,
    brain: { aggroRange: 12, attackRange: 2.4, windup: 0.5, recover: 0.9, attackCooldown: 0.7 }, respawn: 120, leash: 22, shards: [12, 22],
    drops: [{ itemId: 'beast-fang', chance: 0.3 }, { itemId: 'moon-dew', chance: 0.3 }],
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
  // Round 6, the Lean Quarter. DeaqHWJBBPw: knights in faceted blue mail and gold chains walking Bucket Street.
  'mail-knight': {
    kind: 'mail-knight', name: 'Chain-Mail Knight', maxHp: 980, def: 55, atk: 88, speed: 3.0, element: 'stone', hover: 0, bodyRadius: 0.55, height: 1.95,
    brain: { aggroRange: 12, attackRange: 2.4, windup: 0.6, recover: 0.9, attackCooldown: 0.6 }, respawn: 60, leash: 18, shards: [8, 14],
    drops: [{ itemId: 'rune-shard', chance: 0.5 }],
  },
  // The sea king's castle in the Sunken City: fish-headed guards with tridents at its gate, anglerfish men in its lane.
  'fish-guard': {
    kind: 'fish-guard', neutral: true, name: 'Castle Fishguard', maxHp: 1100, def: 55, atk: 92, speed: 3.2, element: 'tide', hover: 0, bodyRadius: 0.55, height: 2.0,
    brain: { aggroRange: 10, attackRange: 2.6, windup: 0.6, recover: 0.9, attackCooldown: 0.6 }, respawn: 70, leash: 10, shards: [10, 16],
    drops: [{ itemId: 'rune-shard', chance: 0.4 }],
  },
  angler: {
    kind: 'angler', name: 'Deep Angler', maxHp: 900, def: 40, atk: 98, speed: 3.6, element: 'tide', hover: 0, bodyRadius: 0.55, height: 1.9,
    brain: { aggroRange: 9, attackRange: 2.4, windup: 0.5, recover: 0.8, attackCooldown: 0.5 }, respawn: 70, leash: 9, shards: [10, 16],
    drops: [{ itemId: 'moon-dew', chance: 0.3 }],
  },
  // DeOemU1BOZF: a knight in galaxy-patterned plate guarding the Skeleton Court's treasury.
  'galaxy-knight': {
    kind: 'galaxy-knight', stomp: true, name: 'Galaxy Knight', maxHp: 1900, def: 95, atk: 130, speed: 2.6, element: 'astral', hover: 0, bodyRadius: 0.7, height: 2.2,
    brain: { aggroRange: 12, attackRange: 3.0, windup: 0.8, recover: 1.0, attackCooldown: 0.7 }, respawn: 75, leash: 16, shards: [14, 24],
    drops: [{ itemId: 'star-chart', chance: 0.08 }, { itemId: 'rune-shard', chance: 0.7 }],
  },
  // Dd0wR9Jh2lH: a humanoid of blue crystal shards walking rippled sand.
  crystalsentry: {
    kind: 'crystalsentry', name: 'Crystal Sentry', maxHp: 1700, def: 90, atk: 120, speed: 3.2, element: 'stone', hover: 0, bodyRadius: 0.6, height: 1.95,
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
    kind: 'beast', name: 'Fog Beast', maxHp: 650, def: 30, atk: 85, speed: 3.6, element: 'rot', hover: 0, bodyRadius: 0.5, height: 1.85,
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
    // (4.5 m, haunting the cathedral's nave: at 10 m out on the shore he towered over everything.)
    kind: 'shade', name: 'The Horned Shade', title: 'Who Haunts the Cathedral', maxHp: 6200, def: 50, atk: 130, speed: 3.0, element: 'astral', hover: 0.3, bodyRadius: 1.5, height: 4.5, boss: true,
    brain: { aggroRange: 14, attackRange: 12, windup: 0.8, recover: 1.1, attackCooldown: 0.7, preferredRange: 7 }, respawn: 240, leash: 11, shards: [160, 240],
    attacks: [{ kind: 'volley', range: 14, windup: 0.9, recover: 1.0, weight: 3 }, { kind: 'summon', range: 16, windup: 1.2, recover: 1.6, weight: 1 }, { kind: 'blink', range: 10, windup: 0.5, recover: 0.4, weight: 2 }, { kind: 'sweep', range: 3, windup: 0.6, recover: 1.0, weight: 3 }],
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
    // (25 m seated: a king the size of a hill.)
    kind: 'hollowking', name: 'The Hollow King', title: 'Whose Heart Is a Kingdom', maxHp: 12000, def: 110, atk: 180, speed: 0, element: 'astral', hover: 0, bodyRadius: 6.2, height: 25, boss: true, leash: 1,
    brain: { aggroRange: 34, attackRange: 34, windup: 1.2, recover: 1.6, attackCooldown: 1.0 }, respawn: 400, shards: [320, 460],
    attacks: [{ kind: 'volley', range: 34, windup: 1.2, recover: 1.4, weight: 3 }, { kind: 'summon', range: 34, windup: 1.4, recover: 1.8, weight: 2 }, { kind: 'roar', range: 26, windup: 1.2, recover: 1.6, weight: 1 }],
    drops: [{ itemId: 'hollow-crown', chance: 1 }, { itemId: 'king-rib', chance: 1 }, { itemId: 'star-chart', chance: 1 }],
  },
  croc: {
    kind: 'croc', name: 'Mire Crocodile', maxHp: 900, def: 45, atk: 95, speed: 4.2, element: 'tide', hover: 0, bodyRadius: 1.2, height: 0.7, leash: 16,
    brain: { aggroRange: 10, attackRange: 3.6, windup: 0.5, recover: 1.0, attackCooldown: 0.6 }, respawn: 60, shards: [8, 14], drops: [{ itemId: 'croc-hide', chance: 0.6 }],
  },
  // Decorative flyers you can shoot: they circle their pools and never fight back.
  // The Sunken City's boss (the playtest of 2026-11-13): the drowned street's big blue grouper (DeVj-Z8POjl), grown to
  // the size of a cart, circling the ruined church; it calls the city's anglers when it is losing.
  grouper: {
    kind: 'grouper', summons: 'angler', name: 'Big Gerald', title: 'The Grouper Who Swallowed the Church Bell', maxHp: 7400, def: 60, atk: 145, speed: 5.5, element: 'tide', hover: 0, bodyRadius: 2.4, height: 3.2, boss: true,
    flying: true, flyAbove: 3.5, leash: 30,
    brain: { aggroRange: 18, attackRange: 12, windup: 0.8, recover: 1.1, attackCooldown: 0.9, preferredRange: 6 }, respawn: 240, shards: [150, 220],
    attacks: [{ kind: 'bite', range: 5, windup: 0.6, recover: 0.9, weight: 3 }, { kind: 'charge', range: 16, windup: 0.8, recover: 1.4, weight: 2 }, { kind: 'volley', range: 16, windup: 0.8, recover: 1.0, weight: 2 }, { kind: 'summon', range: 18, windup: 1.2, recover: 1.5, weight: 1 }],
    drops: [{ itemId: 'church-bell', chance: 1 }, { itemId: 'tide-hook', chance: 0.5 }],
  },
  koi: {
    kind: 'koi', name: 'Flying Koi', maxHp: 80, def: 5, atk: 0, speed: 3.2, element: 'tide', hover: 0, bodyRadius: 0.55, height: 0.6,
    flying: true, flyAbove: 1.9, passive: true, neutral: true, leash: 40,
    brain: { aggroRange: 0, attackRange: 0, windup: 0.5, recover: 0.5, attackCooldown: 1 }, respawn: 45, shards: [2, 5],
  },
  jellyfish: {
    kind: 'jellyfish', name: 'Dream Jelly', maxHp: 60, def: 0, atk: 0, speed: 1.4, element: 'astral', hover: 0, bodyRadius: 0.7, height: 1.2,
    flying: true, flyAbove: 8, passive: true, neutral: true, leash: 80, scale: 3,
    brain: { aggroRange: 0, attackRange: 0, windup: 0.5, recover: 0.5, attackCooldown: 1 }, respawn: 50, shards: [2, 4],
  },
};

/** A closed circle of waypoints for a flyer that drifts around a pool. */
function ring(cx: number, cz: number, r: number, n = 8): Array<readonly [number, number]> {
  const out: Array<readonly [number, number]> = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    out.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return out;
}

/**
 * Where every enemy lives. Rules of the layout: nothing hostile within ~45 m of the spawn and the village; bosses
 * hold their own arenas off the roads, apart from each other; small mobs come in pairs at camps. Every enemy is
 * leashed to its spot and walks home (healing) once the player leaves (Enemy.update).
 */
/**
 * `yaw`: facing at the spot (seated mobs face their fire); `exact`: placed exactly there (a seat), not at the nearest
 * free ground; `patrol`: a route walked while not fighting (its home moves along it).
 */
/** `sitY`: a seated mob's feet height while it sits (a seat higher than its legs are long: they dangle). */
export interface EnemySpawn { kind: EnemyKind; x: number; z: number; yaw?: number; exact?: boolean; patrol?: ReadonlyArray<readonly [number, number]>; sitY?: number }

export const ENEMY_SPAWNS: ReadonlyArray<EnemySpawn> = [
  // Bosses
  { kind: 'yeti', x: 72, z: -94 },          // frozen grove, north-east
  { kind: 'shade', x: 68, z: -17, exact: true },  // in the cathedral's nave, under the candles
  { kind: 'warden', x: 68, z: 38 },         // the clearing in the east forest, under the rain
  { kind: 'wyrm', x: 106, z: 22 },          // circling the lonely wizard tower
  { kind: 'rivershade', x: -67, z: 38 },    // rising from the witch stream, upstream of the bridge and Old Moss
  { kind: 'passbeast', x: -36, z: -140 },
  // The spider chapel walks its loop in the sky over the west cliffs (it used to be scenery).
  { kind: 'spiderchapel', x: 965, z: 170, exact: true, patrol: [[965, 170], [977, 162], [975, 188], [955, 182]] },   // the kingdom's snowfield past the graves (off its old perch over the void)
  { kind: 'troll', x: -64, z: -133, exact: true }, // on the gorge floor under the stone bridge
  { kind: 'lurker', x: -24, z: -14 },       // the lily pond's shallows (west of the whirlpool)
  { kind: 'marshdemon', x: 106, z: -13, exact: true },   // waist-deep in his mud pool, east of the cathedral
  { kind: 'hollowking', x: 36, z: -146 },   // seated on the north shore, east of the head
  { kind: 'emberrider', x: 16, z: -122 },   // the dead wood east of the causeway's end
  // The log giant walks the old haul road by the skeleton camp, minding his own business until someone hits him.
  { kind: 'loggiant', x: -38, z: 32, patrol: [[-38, 32], [-46, 30], [-52, 36], [-46, 30]] },
  // Round 5: the cyclops wading at the eye pool's east tip (#28), the Blood Eye over the chasm (01.32.26), the grave
  // cyclops at the end of the Alley of Graves (01.16.54) and its skeleton guards, the Prism Wizard in the dream.
  { kind: 'cyclops', x: 32, z: 4, exact: true, yaw: Math.PI },
  { kind: 'blood-eye', x: -14, z: -56, exact: true, patrol: [[-40, -56], [-14, -54], [12, -60], [-14, -54]] },
  // (The Grave Cyclops no longer waits at the alley's end: the candle ring raises him, Adventures / GRAVE_RING.)
  { kind: 'skeleton', x: -6, z: -945, yaw: -Math.PI / 2 }, { kind: 'skeleton', x: 6, z: -945, yaw: -Math.PI / 2 },
  { kind: 'trip-wizard', x: 62, z: 2628, exact: true },   // over the mushroom grove's edge, east of where you wake
  // The skeletons around the campfire by the village (DdjlyzyOcnK): seated on their barrels, facing the fire at (-24, 52).
  { kind: 'skeleton', x: -21.6, z: 53.4, yaw: Math.atan2(52 - 53.4, -24 + 21.6), exact: true },
  { kind: 'skeleton', x: -26.4, z: 53.4, yaw: Math.atan2(52 - 53.4, -24 + 26.4), exact: true },
  { kind: 'skeleton', x: -24, z: 49.2, yaw: Math.atan2(52 - 49.2, 0), exact: true },
  // Camps (pairs)
  { kind: 'croc', x: 108, z: 10 }, { kind: 'croc', x: 100, z: 9 }, { kind: 'croc', x: 100, z: 15 }, // the river's head pool, east (one was left on the cliff when the head moved, one lay on the bank slope)
  { kind: 'beast', x: -57, z: 44 }, { kind: 'beast', x: -63, z: 47 },      // west meadow, by the stream (not in it, and off Old Moss's bank)
  // More to meet on the island (2026-11-10: it had ten roaming hostiles): risen dead in the dead wood and by the ruined
  // nave, fog beasts at the gorge's head, crocodiles along the river and in the Marsh Sovereign's mud (DeJj8CDhL2f).
  { kind: 'grave-skeleton', x: 4, z: -104 }, { kind: 'grave-skeleton', x: 28, z: -112 }, { kind: 'grave-skeleton', x: -14, z: -108 },
  { kind: 'beast', x: -61, z: -112 }, { kind: 'beast', x: -65, z: -115 }, // (on the gorge floor below the gorge-head hoard; the head's step and the west wall are cliffs)
  { kind: 'croc', x: 46, z: 12 }, { kind: 'croc', x: 84, z: 8 }, { kind: 'croc', x: 110, z: -6 }, { kind: 'croc', x: 100, z: -8 },
  // Round 9: the archway shades in the dead wood and on the gorge's east rim, the brazier hermits in the kingdom, the
  // vale's knights on its street's far side.
  { kind: 'archway-shade', x: 20, z: -92 }, { kind: 'archway-shade', x: -50, z: -118 },
  // (The hermits by the Void Monk's ring portals on the kingdom's plaza: their reel is the galaxy cave, not the island.)
  { kind: 'brazier-hermit', x: 1030, z: 62 }, { kind: 'brazier-hermit', x: 985, z: 70 },
  { kind: 'vale-knight', x: 1035, z: 945 }, { kind: 'vale-knight', x: 960, z: 955 },
  { kind: 'crystalsentry', x: 74, z: 52 }, { kind: 'crystalsentry', x: 70, z: 59 }, // the desert's east end, off the Pale Bride's walk
  // Yung Lean's kingdom: Styro-Ghouls on the lean cups and round the plaza; the Lean-Chucker on the pavilion's throne.
  // (Off the cups: by the Lean-Chucker's pavilion and along the plaza; the cups belong to the lean bubbles.)
  { kind: 'styro-ghoul', x: 1028, z: -46 }, { kind: 'styro-ghoul', x: 1043, z: -47 }, { kind: 'styro-ghoul', x: 1040, z: -64 },
  { kind: 'styro-ghoul', x: 1046, z: 12 },
  // Bubbles bobbing in the lean of each giant cup.
  { kind: 'lean-bubble', x: 1080, z: 12, exact: true }, { kind: 'lean-bubble', x: 1084, z: 8, exact: true },
  { kind: 'lean-bubble', x: 1106, z: -10, exact: true }, { kind: 'lean-bubble', x: 1110, z: -14, exact: true }, { kind: 'lean-bubble', x: 1108, z: -9, exact: true },
  { kind: 'lean-bubble', x: 1134, z: 12, exact: true }, { kind: 'lean-bubble', x: 1138, z: 16, exact: true },
  // The Frog God waits in the middle of the dream.
  { kind: 'dmt-entity', x: 0, z: 2570, exact: true, yaw: Math.PI / 2 },
  { kind: 'styro-ghoul', x: 978, z: -32 }, { kind: 'styro-ghoul', x: 1022, z: -30 }, { kind: 'styro-ghoul', x: 1045, z: 48 },
  { kind: 'styro-ghoul', x: 990, z: 52 }, { kind: 'styro-ghoul', x: 1015, z: 44 },
  // On the front of the pavilion's throne: its seat (x 1034.5–1036.5) is 0.82 m above the dais and his hips sit 0.58 m
  // above his feet, so a small imp on a big throne sits with his legs dangling over the edge.
  { kind: 'lean-chucker', x: 1034.3, z: -55, yaw: Math.PI, exact: true, sitY: 24.56 },
  // Bucket Street in the kingdom's west quarter (LEAN_QUARTER in data/world.ts): the mimics and the chain-mail knights.
  // (Up and down the street's ends: the stalls and their keepers stand clear of them.)
  { kind: 'bucket', x: 967, z: 60 }, { kind: 'bucket', x: 951, z: 66 }, { kind: 'bucket', x: 929, z: 58 },
  { kind: 'bucket', x: 917, z: -24 }, { kind: 'bucket', x: 897, z: -28 }, { kind: 'bucket', x: 881, z: 62 },
  { kind: 'mail-knight', x: 941, z: 52 }, { kind: 'mail-knight', x: 893, z: 52 }, { kind: 'mail-knight', x: 909, z: 6 },
  { kind: 'diamond-wizard', x: 933, z: 18, exact: true, yaw: 0 },  // mid-street, where Old Hollowstaff stood
  // The Dragon's Vale's fields (it stood empty): fog beasts roaming the east meadow and the river's far bank, crystal
  // sentries in the stones under the crowned head, a pack by the floating castle's cliff.
  { kind: 'beast', x: 1045, z: 960 }, { kind: 'beast', x: 1052, z: 966 }, { kind: 'beast', x: 1060, z: 900 },
  { kind: 'beast', x: 1072, z: 860 }, { kind: 'beast', x: 1066, z: 856.4 }, { kind: 'beast', x: 930, z: 990 },
  { kind: 'crystalsentry', x: 930, z: 905 }, { kind: 'crystalsentry', x: 922, z: 940 },
  // Round the vale's new places (Pois.ts): the wolves in the north wood, the dead at their graves and their fire, sentries
  // at the fallen gate.
  { kind: 'beast', x: 880, z: 848.8 }, { kind: 'beast', x: 892, z: 851.9 }, { kind: 'beast', x: 870, z: 853.7 },
  { kind: 'beast', x: 1045, z: 842.9 }, { kind: 'beast', x: 1056, z: 846.5 },
  { kind: 'beast', x: 1012, z: 1019 }, { kind: 'beast', x: 988, z: 1022 }, // the vale's south meadow
  { kind: 'grave-skeleton', x: 890, z: 860 }, { kind: 'grave-skeleton', x: 874, z: 876 },
  { kind: 'grave-skeleton', x: 911, z: 833 }, { kind: 'grave-skeleton', x: 922, z: 842 }, { kind: 'grave-skeleton', x: 908, z: 842 },
  { kind: 'crystalsentry', x: 1008, z: 850.1 }, { kind: 'crystalsentry', x: 992, z: 842.9 },
  // The kingdom's margins: imps in the purple wood, the dead at their graves.
  { kind: 'styro-ghoul', x: 913, z: -56 }, { kind: 'styro-ghoul', x: 933, z: -50 }, { kind: 'styro-ghoul', x: 950, z: -60 },
  { kind: 'mail-knight', x: 865, z: -48 }, { kind: 'grave-skeleton', x: 998, z: 112 }, { kind: 'grave-skeleton', x: 869, z: 88 },
  // The drowned land beyond the city: anglers among the wrecks.
  { kind: 'angler', x: -1062, z: -52 }, { kind: 'angler', x: -938, z: -92 }, { kind: 'angler', x: -1066, z: 42 }, { kind: 'angler', x: -942, z: 50 },
  // Beyond the alley's walls.
  { kind: 'grave-skeleton', x: -21, z: -1090 }, { kind: 'grave-skeleton', x: 26, z: -1034 }, { kind: 'grave-skeleton', x: -27, z: -978 }, { kind: 'grave-skeleton', x: 27, z: -918 },
  // The snow quarter of the Lean Quarter: skeletons stalking the graves round the chapel.
  { kind: 'grave-skeleton', x: 913, z: 140 }, { kind: 'grave-skeleton', x: 958, z: 160 }, { kind: 'grave-skeleton', x: 973, z: 100 }, { kind: 'grave-skeleton', x: 908, z: 165 },
  // The Skeleton Court's treasury.
  { kind: 'galaxy-knight', x: 958, z: -148 }, { kind: 'galaxy-knight', x: 968, z: -160 },
  // The sea king's castle (Sunken.ts): two guards at its gate, two anglers in the lane behind the throne, two more by
  // the courtyard's walls.
  { kind: 'fish-guard', x: -1006, z: -60.5, exact: true, yaw: Math.PI / 2 }, { kind: 'fish-guard', x: -994, z: -60.5, exact: true, yaw: Math.PI / 2 },
  { kind: 'angler', x: -1000, z: -80, exact: true, yaw: Math.PI / 2 }, { kind: 'angler', x: -1000, z: -88, exact: true, yaw: Math.PI / 2 },
  // Big Gerald circles the drowned church behind the castle (Sunken.ts: the church at (-1000, -116)).
  { kind: 'grouper', x: -1016, z: -116, exact: true, patrol: [[-1016, -116], [-1011.3, -127.3], [-1000, -132], [-988.7, -127.3], [-984, -116], [-988.7, -104.7], [-1000, -100], [-1011.3, -104.7]] },
  // Flying koi over the lily pond and the heart's middle tier; dream koi and jellies over the Frog King's dream.
  ...[5, 7, 9, 11, 5, 7, 9].map((r, i) => ({ kind: 'koi' as const, x: -18 + Math.cos(i) * r, z: -18 + Math.sin(i) * r, exact: true, patrol: ring(-18, -18, r) })),
  ...[4, 6.5, 9, 4, 7].map((r, i) => ({ kind: 'koi' as const, x: -22 + Math.cos(i * 1.3) * r, z: 35 + Math.sin(i * 1.3) * r, exact: true, patrol: ring(-22, 35, r) })),
  ...[20, 35, 50, 28, 42, 18, 55, 30, 45, 22].map((r, i) => ({ kind: 'koi' as const, x: Math.cos(i * 0.7) * r, z: 2600 + Math.sin(i * 0.7) * r, exact: true, patrol: ring(0, 2600, r) })),
  ...[25, 40, 55, 30, 48, 35, 60, 22, 50, 38].map((r, i) => ({ kind: 'jellyfish' as const, x: Math.cos(i * 0.9 + 1) * r, z: 2600 + Math.sin(i * 0.9 + 1) * r, exact: true, patrol: ring(0, 2600, r, 6) })),
];

/**
 * Registry of real 3D assets. When a GLB exists at `public/models/<file>` the game uses it instead of the
 * procedural builder; when it is missing the procedural version stays. Generated with Meshy from reel frames.
 *
 * Clip names are matched case-insensitively and by substring, so "Idle", "idle_01" and "Armature|Idle" all work.
 */
export type ClipName = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'heavy' | 'cast' | 'hit' | 'death' | 'sit' | 'kneel' | 'roar' | 'fly';

export interface ModelDef {
  file: string;
  /**
   * Extra GLBs that each carry one animation for the same skeleton (Meshy exports one clip per file).
   * Key = clip key the game plays, value = file under `public/models/`. Missing files are skipped.
   */
  clipFiles?: Partial<Record<ClipName, string>>;
  /** Height the model should be scaled to, metres. */
  height: number;
  /** Rotate so the model's front faces local +z (Meshy's usual export), radians about y. */
  yaw?: number;
  /** Lift so the feet sit on the ground. */
  yOffset?: number;
  clips?: Partial<Record<ClipName, string>>;
  /** Where a pipe-smoke emitter sits, in metres relative to the feet (x forward, z to the model's left). */
  smoke?: { x: number; y: number; z: number };
  /** A boneless robe/cloak model: the rig animates it procedurally (hover, sway, hem wind) instead of clips. */
  robe?: boolean;
  /** Human-readable name for the missing-model warning and placeholder. */
  label?: string;
  /** Hand-held props: offset (metres) and rotation (radians) from the hand bone to the grip. */
  grip?: { x: number; y: number; z: number; rx: number; ry: number; rz: number };
}

const NPC_CLIPS = (pose: string): Partial<Record<ClipName, string>> => ({ idle: `${pose}|idle_02|idle|stance`, walk: 'walking|walk', run: 'running|run', attack: 'attack|slash|cast', hit: 'hit', death: 'dying|death', sit: 'sit|drink|read|idle', kneel: 'kneel|pray|idle' });
const stat = (file: string, height: number, label: string): ModelDef => ({ file, height, label });

/**
 * Clip lookup for Meshy animate exports: every added preset lands in one GLB named by the preset's English id
 * (Combat_Stance, Walking, Charged_Ground_Slam, Shouting_Angrily, Hit_Reaction, dying_backwards, ...).
 * Each entry lists alternatives; the first that matches a clip name (by substring) wins.
 */
const BOSS_CLIPS: Partial<Record<ClipName, string>> = {
  idle: 'combat_stance|stance|idle', walk: 'walking|walk', run: 'running|run', attack: 'charged_ground_slam|slam|attack|punch|smash|charged_spell|spell|cast',
  heavy: 'attack|punch|slam|spell|cast', roar: 'shouting|scream|roar|taunt', hit: 'hit_reaction|hit', death: 'dying|death|dead|fall',
};

export const MODELS: Record<string, ModelDef> = {
  // Party
  // Party (Meshy image-to-3D from docs/reference/frames, biped rig, preset clips)
  knight: { file: 'knight.glb', height: 1.95, clips: { idle: 'idle_02|idle|stance', walk: 'walking|walk', run: 'running|run', jump: 'basic_jump|jump', attack: 'right_hand_sword_slash|slash|attack', heavy: 'sword_judgment|judgment|slash', cast: 'sword_shout|shout|slash', hit: 'hit_reaction|hit', death: 'dying|death' } },
  archer: { file: 'archer.glb', height: 1.8, clips: { idle: 'idle_02|idle|stance', walk: 'walking|walk', run: 'running|run', jump: 'basic_jump|jump', attack: 'archery_shot|shot', heavy: 'archery_shot_1|shot', cast: 'archery_aim|aim|shot', hit: 'hit_reaction|hit', death: 'dying|death' } },
  wizard: { file: 'wizard.glb', height: 1.85, smoke: { x: 0.2, y: 1.12, z: 0.1 }, clips: { idle: 'idle_02|idle|stance', walk: 'walking|walk', run: 'running|run', jump: 'basic_jump|jump', attack: 'mage_soell_cast|spell|cast', heavy: 'charged_spell_cast|charged|cast', cast: 'charged_spell_cast|charged|cast', hit: 'hit_reaction|hit', death: 'dying|death' } },
  // Weapons the heroes pull out while attacking (the models' own baked weapons stay where they are)
  staff: { file: 'staff.glb', height: 1.9, label: "Orlan's staff: gnarled wood with a violet crystal", grip: { x: 0, y: -0.55, z: 0, rx: 0, ry: 0, rz: 0 } },
  greatsword: { file: 'greatsword.glb', height: 1.6, label: "Sir Aldric's greatsword", grip: { x: 0, y: -0.25, z: 0, rx: 0, ry: 0, rz: 0 } },
  // Bosses and mobs
  // Meshy animate exports bundle every added preset into one GLB; clip names are the preset's English ids.
  yeti: { file: 'yeti.glb', height: 5.2, clips: BOSS_CLIPS },
  shade: { file: 'horned-shade.glb', height: 7, clips: BOSS_CLIPS },
  warden: { file: 'antlered-warden.glb', height: 15, clips: BOSS_CLIPS },
  wyrm: { file: 'moon-wyrm.glb', height: 3, yOffset: 0, clips: { idle: 'fly|idle|hover', fly: 'fly|idle', attack: 'bite|attack' } },
  troll: { file: 'rock-troll.glb', height: 4.6, yaw: Math.PI, clips: BOSS_CLIPS },
  lurker: { file: 'lake-lurker.glb', height: 4.2, yOffset: -0.4, clips: BOSS_CLIPS },
  marshdemon: { file: 'marsh-demon.glb', height: 12, yOffset: -1.5, clips: BOSS_CLIPS },
  hollowking: { file: 'hollow-king.glb', height: 42, clips: BOSS_CLIPS },
  rivershade: { file: 'river-shade.glb', height: 5, clips: { idle: 'idle', walk: 'walk', attack: 'cast' } },
  passbeast: { file: 'fog-beast.glb', height: 3.8, clips: { idle: 'idle', walk: 'run', attack: 'bite' } },
  beast: { file: 'fog-beast.glb', height: 1.5, clips: { idle: 'idle', walk: 'run', attack: 'bite' } },
  sentinel: { file: 'stone-sentinel.glb', height: 2.6, clips: { idle: 'idle', walk: 'walk', attack: 'punch' } },
  wisp: { file: 'fog-wisp.glb', height: 1.4, clips: { idle: 'idle' } },
  croc: { file: 'crocodile.glb', height: 1.0, clips: { idle: 'idle', walk: 'walk', attack: 'bite' } },
  // NPCs and creatures
  frogking: { file: 'frog-king.glb', height: 6, clips: { idle: 'idle|breath' } },
  loggiant: { file: 'log-giant.glb', height: 7.5, clips: { idle: 'idle|stance', walk: 'carry|walking|walk' } },
  spiderchapel: { file: 'spider-chapel.glb', height: 34, clips: { idle: 'idle', walk: 'walk|crawl|run' } },
  colossus: { file: 'moon-shell-colossus.glb', height: 18, clips: { idle: 'crawl' } },
  king: { file: 'antlered-king.glb', height: 1.95, clips: { idle: 'sit', sit: 'sit' } },
  witch: { file: 'witch.glb', height: 1.85, clips: { idle: 'idle', walk: 'walk', cast: 'cast' } },
  // Landmarks (static)
  head: { file: 'giant-head.glb', height: 52, label: 'giant stone head with red eyes' },
  cathedral: { file: 'cathedral.glb', height: 118 },
  castle: { file: 'castle.glb', height: 44 },
  church: { file: 'demon-church.glb', height: 36 },
  tower: { file: 'wizard-tower.glb', height: 100 },
  treehouse: { file: 'tree-house.glb', height: 48 },

  // --- Meshy to-do: every entry below renders a placeholder until its file exists in public/models ---
  // Walkways and skyline (static)
  'causeway-segment': stat('causeway-segment.glb', 8, 'causeway deck segment with balustrade posts'),
  'causeway-stairs': stat('causeway-stairs.glb', 6, 'causeway stairs at the south end'),
  'chasm-bridge': stat('chasm-bridge.glb', 4, 'wooden rope bridge span across the chasm'),
  'witch-bridge': stat('witch-bridge.glb', 3, 'stone bridge over the witch stream'),
  nave: stat('ruined-nave.glb', 26, 'ruined nave with columns, arches and a rose window'),
  archgate: stat('arch-gate.glb', 14, 'frozen arch gate'),
  palmisland: stat('palm-island.glb', 28, 'floating palm island on an inverted rock'),
  'colossus-statue': stat('kneeling-colossus.glb', 15.5, 'kneeling horned colossus statue'),
  'burning-castle': stat('burning-castle.glb', 68, 'burning castle on the far shore'),
  // Settlements and props (static)
  'village-house': stat('village-house.glb', 5.8, 'thatched village house'),
  tavern: stat('tavern.glb', 7.6, 'tavern with its sign, table and stools'),
  well: stat('well.glb', 1.2, 'village well'),
  barrel: stat('barrel.glb', 1.1, 'wooden barrel'),
  'torch-post': stat('torch-post.glb', 2.6, 'torch on a post'),
  campfire: stat('campfire.glb', 2.8, 'campfire ring with tripod, kettle and three log seats'),
  cloister: stat('cloister.glb', 8.6, 'cloister: three stone arches on a cobbled floor'),
  observatory: stat('observatory.glb', 12, 'mushroom observatory hut with balcony and telescope'),
  throne: stat('throne.glb', 7.8, 'antler-and-bone throne on a dais with candles'),
  cauldron: stat('cauldron.glb', 1.4, 'iron cauldron over coals'),
  'lantern-post': stat('lantern-post.glb', 2.5, 'red paper lantern on a pole'),
  candle: stat('candle.glb', 0.3, 'candle'),
  'ruin-arch': stat('ruin-arch.glb', 6.6, 'ruined stone arch'),
  'ruin-column': stat('ruin-column.glb', 4.5, 'broken stone column'),
  'flooded-ruin': stat('flooded-ruin.glb', 9, 'flooded ruin: ring of columns, wall and arch'),
  monolith: stat('monolith.glb', 12, 'standing stone'),
  'troll-gorge': stat('troll-gorge.glb', 15, 'rock walls of the troll gorge'),
  'floating-rock': stat('floating-rock.glb', 3, 'floating boulder'),
  pinnacle: stat('pinnacle.glb', 30, 'sea pinnacle rising from the cloud sea'),
  mountain: stat('mountain.glb', 180, 'backdrop mountain'),
  orchard: stat('orchard.glb', 6, 'orchard of gnarled trees (one block)'),
  boat: { file: 'boat.glb', height: 1.9, label: 'rowing boat with two rowers', clips: { idle: 'row|idle' } },
  'horse-rider': { file: 'horse-rider.glb', height: 2.6, label: 'knight on horseback with a lantern', clips: { idle: 'idle', walk: 'walk|trot' } },
  koi: { file: 'flying-koi.glb', height: 1.2, label: 'flying koi', clips: { idle: 'swim|idle' } },
  snake: { file: 'snake.glb', height: 0.6, label: 'coiled snake', clips: { idle: 'idle' } },
  // NPC bodies (humanoid rigs; the pose name is the idle clip)
  'knight-npc': { file: 'knight-npc.glb', height: 1.9, label: 'sword-and-shield knight (Aldous, the Vigil, Dunmar)', clips: NPC_CLIPS('idle') },
  'knight-seated': { file: 'knight-seated.glb', height: 1.95, label: 'caped greatsword knight sitting on the cliff (Sir Halvard)', clips: NPC_CLIPS('sit') },
  'knight-rose': { file: 'knight-rose.glb', height: 1.95, label: 'black knight offering a rose (Sir Corvin)', clips: NPC_CLIPS('offer') },
  skeleton: { file: 'skeleton.glb', height: 1.75, label: 'skeleton (Rattle, Bone, Marrow)', clips: NPC_CLIPS('sit') },
  'skeleton-banner': { file: 'skeleton-banner.glb', height: 1.85, label: 'skeleton standard-bearer with banner and trident (Hollow Jack)', clips: NPC_CLIPS('banner') },
  'witch-cook': { file: 'witch-cook.glb', height: 1.8, label: 'skeleton cook in a chef hat with a spoon (Mother Marrow)', clips: NPC_CLIPS('stir') },
  bride: { file: 'bride.glb', height: 1.8, label: 'the Pale Bride', clips: NPC_CLIPS('walk') },
  maiden: { file: 'maiden.glb', height: 1.68, label: 'Elowen of the flower garden', clips: NPC_CLIPS('bow') },
  wanderer: { file: 'wanderer.glb', height: 1.85, label: 'hooded wanderer with a lantern (the Lanternbearer)', clips: NPC_CLIPS('walk') },
  'wizard-npc': { file: 'wizard-npc.glb', height: 1.8, label: 'wizard NPC (Mirren, Sel)', clips: NPC_CLIPS('idle') },
  gnome: { file: 'gnome.glb', height: 1.15, label: 'gnome astronomer with a telescope (Pim)', clips: NPC_CLIPS('telescope') },
  'frog-monk': { file: 'frog-monk.glb', height: 1.75, label: 'frog monk reading a book (Brother Croak)', clips: NPC_CLIPS('read') },
  'troll-fisher': { file: 'troll-fisher.glb', height: 2.6, label: 'troll fisher with a rod (Old Moss)', clips: NPC_CLIPS('fish') },
  goblin: { file: 'goblin.glb', height: 1.15, label: 'tavern goblin (Snik, Vrak)', clips: NPC_CLIPS('sit') },
  pilgrim: { file: 'pilgrim.glb', height: 1.8, label: 'river pilgrim', clips: NPC_CLIPS('walk') },
  ogre: { file: 'log-giant.glb', height: 3.1, label: 'ogre woodhauler (Grub) — reuses the log giant', clips: { idle: 'idle|stance', walk: 'carry|walking|walk' } },
  // Flora and decor (one file each, instanced)
  pine: stat('pine.glb', 13, 'pine tree'), 'snow-pine': stat('snow-pine.glb', 13, 'snow-laden pine'),
  birch: stat('birch.glb', 11, 'birch'), willow: stat('willow.glb', 9, 'willow'), palm: stat('palm.glb', 8, 'palm'),
  'gnarled-tree': stat('gnarled-tree.glb', 6, 'gnarled orchard tree'), 'dead-tree': stat('dead-tree.glb', 5.5, 'bare dead tree'),
  'dead-forest-tree': stat('dead-forest-tree.glb', 8, 'dead forest tree'), 'flower-tree': stat('flower-tree.glb', 10, 'glowing flower tree'),
  'floating-island': stat('floating-island.glb', 6, 'small floating rock island'),
  'giant-mushroom': stat('giant-mushroom.glb', 8, 'giant mushroom'), mushroom: stat('mushroom.glb', 0.45, 'small glowing mushroom'),
  sunflower: stat('sunflower.glb', 1.5, 'blue sunflower'), flower: stat('flower.glb', 0.35, 'meadow flower'),
  'giant-flower': stat('giant-flower.glb', 3, 'giant cosmos flower'), 'rose-bush': stat('rose-bush.glb', 0.9, 'rose bush'),
  boulder: stat('boulder.glb', 1.2, 'boulder'), 'ice-crystal': stat('ice-crystal.glb', 2.4, 'ice crystal cluster'),
  'pod-tree': stat('pod-tree.glb', 22, 'tree with hanging glowing pods'), coral: stat('coral.glb', 1.6, 'coral bush'),
  reed: stat('reed.glb', 2.4, 'reed clump'), 'lily-pad': stat('lily-pad.glb', 0.9, 'lily pad'), lotus: stat('lotus.glb', 0.5, 'lotus flower'),
  'fallen-leaf': stat('fallen-leaf.glb', 0.28, 'fallen leaf'), 'fallen-fruit': stat('fallen-fruit.glb', 0.35, 'fallen fruit'),
  cobblestone: stat('cobblestone.glb', 0.14, 'cobblestone'), cypress: stat('cypress.glb', 9, 'cypress'), grave: stat('grave.glb', 1.2, 'gravestone'),
};

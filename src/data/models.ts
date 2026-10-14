/**
 * Registry of real 3D assets. When a GLB exists at `public/models/<file>` the game uses it instead of the
 * procedural builder; when it is missing the procedural version stays. Generated with Meshy from reel frames.
 *
 * Clip names are matched case-insensitively and by substring, so "Idle", "idle_01" and "Armature|Idle" all work.
 */
export type ClipName = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'heavy' | 'cast' | 'hit' | 'death' | 'sit' | 'kneel' | 'roar' | 'fly' | 'drink' | 'bow' | 'lantern' | 'offer';

export interface ModelDef {
  file: string;
  /**
   * Extra GLBs that each carry one animation for the same skeleton (Meshy exports one clip per file).
   * Key = clip key the game plays, value = file under `public/models/`. Missing files are skipped.
   */
  clipFiles?: Partial<Record<ClipName, string>>;
  /** Size the model should be scaled to, metres: its height, or the extent along `fit` when set. */
  height: number;
  /** Which bounding-box axis `height` measures (default y). Walkway segments fit their length. */
  fit?: 'x' | 'y' | 'z';
  /** Rotate so the model's front faces local +z (Meshy's usual export), radians about y. */
  yaw?: number;
  /** Lift so the feet sit on the ground. */
  yOffset?: number;
  clips?: Partial<Record<ClipName, string>>;
  /** Where a pipe-smoke emitter sits: metres in the file's own frame (x = model's left, y up from the feet, z forward). */
  smoke?: { x: number; y: number; z: number };
  /** Where a held prop (staff) sits on a boneless body, same frame as `smoke`. */
  hand?: { x: number; y: number; z: number };
  /** A boneless robe/cloak model: the rig animates it procedurally (hover, sway, hem wind) instead of clips. */
  robe?: boolean;
  /** Human-readable name for the missing-model warning and placeholder. */
  label?: string;
  /**
   * Hand-held props: a pivot at (x, y, z) metres from the hand bone, rotated by (rx, ry, rz), with the prop slid
   * `slide` metres along its own up axis so the grip lands in the fist (props stand upright, point down).
   */
  grip?: { x: number; y: number; z: number; rx: number; ry: number; rz: number; slide: number };
}

/**
 * One clip map for every NPC body (Meshy biped presets: Idle_02, Walking, Running, Chair_Sit_Idle_M, Sit_and_Drink,
 * Kneel_on_One_Knee_and_Stand, Formal_Bow, Torch_Look_Around, Attack). Rig maps a pose to these keys; a body
 * without a clip falls back to idle. `_pose` is kept for call-site readability.
 */
const NPC_CLIPS = (_pose: string): Partial<Record<ClipName, string>> => ({
  idle: 'idle_02|idle|stance|combat', walk: 'walking|walk', run: 'running|run', attack: 'attack|slash|cast', hit: 'hit', death: 'dying|death',
  sit: 'chair_sit|sit_and_drink|sit', drink: 'sit_and_drink|drink|chair_sit', kneel: 'kneel|chair_sit', bow: 'formal_bow|bow', lantern: 'torch_look_around|torch', cast: 'charged_spell|spell|cast',
});
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
  wizard: { file: 'wizard.glb', height: 1.85, robe: true, smoke: { x: 0.2, y: 1.12, z: 0.1 }, hand: { x: -0.36, y: 0.98, z: 0.12 }, clips: { idle: 'idle_02|idle|stance', walk: 'walking|walk', run: 'running|run', jump: 'basic_jump|jump', attack: 'mage_soell_cast|spell|cast', heavy: 'charged_spell_cast|charged|cast', cast: 'charged_spell_cast|charged|cast', hit: 'hit_reaction|hit', death: 'dying|death' } },
  // Weapons the heroes pull out while attacking (the models' own baked weapons stay where they are)
  staff: { file: 'staff.glb', height: 1.75, label: "Orlan's plain wooden walking staff (wizard-full.png)", grip: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, slide: -1.05 } },
  greatsword: { file: 'greatsword.glb', height: 1.45, label: "Sir Aldric's hand-and-a-half sword (knight.png)", grip: { x: 0, y: 0.08, z: 0.02, rx: -Math.PI / 2, ry: 0, rz: 0, slide: -1.18 } },
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
  rivershade: { file: 'river-shade.glb', height: 5, yOffset: -1.2, label: 'hooded river shade with glowing eyes (DeUydbMvKqC, DeWZT3jvPCG)' },
  passbeast: { file: 'fog-beast.glb', height: 3.8, label: 'red-eyed black beast of the mountain pass (DeXeZ7rhGVi)', clips: { idle: 'combat_stance|idle_02|idle', walk: 'monster_walk|crawl|walking', run: 'running|run', attack: 'attack', roar: 'zombie_scream|scream', hit: 'hit_reaction|hit', death: 'dying|death' } },
  beast: { file: 'fog-beast.glb', height: 2.2, label: 'red-eyed black beast (DeXeZ7rhGVi)', clips: { idle: 'combat_stance|idle_02|idle', walk: 'monster_walk|crawl|walking', run: 'running|run', attack: 'attack', roar: 'zombie_scream|scream', hit: 'hit_reaction|hit', death: 'dying|death' } },
  croc: { file: 'crocodile.glb', height: 1.0, label: 'crocodile in the flooded ruins (DeJj8CDhL2f)' },
  // NPCs and creatures
  frogking: { file: 'frog-king.glb', height: 6, clips: { idle: 'idle|breath' } },
  loggiant: { file: 'log-giant.glb', height: 7.5, clips: { idle: 'idle|stance', walk: 'carry|walking|walk' } },
  spiderchapel: { file: 'spider-chapel.glb', height: 34, clips: { idle: 'idle', walk: 'walk|crawl|run' } },
  colossus: { file: 'moon-shell-colossus.glb', height: 18, clips: { idle: 'crawl' } },
  king: { file: 'antlered-king.glb', height: 1.95, label: 'the Antlered King (DedGUYetKjP)', clips: NPC_CLIPS('throne') },
  witch: { file: 'witch.glb', height: 1.85, label: 'coven witch in a pointed hat (DeWji_1PuKW)' },
  // Landmarks (static)
  head: { file: 'giant-head.glb', height: 52, label: 'giant stone head with red eyes' },
  cathedral: { file: 'cathedral.glb', height: 118 },
  castle: { file: 'castle.glb', height: 44 },
  church: { file: 'demon-church.glb', height: 24, label: 'horned demon church (DeDRVZwxJyO)' },
  tower: { file: 'wizard-tower.glb', height: 100 },
  treehouse: { file: 'tree-house.glb', height: 22, label: 'giant tree-house with a round door (DdKl7fKMO75)' },

  // --- Meshy to-do: every entry below renders a placeholder until its file exists in public/models ---
  // Walkways and skyline (static)
  'causeway-segment': stat('causeway-segment.glb', 1.89, 'arched cobbled bridge span (three per causeway segment)'),
  'causeway-stairs': stat('causeway-stairs.glb', 6, 'causeway stairs at the south end'),
  'chasm-bridge': stat('chasm-bridge.glb', 1.8, 'rope-bridge deck tile, repeated across the chasm (DeWji_1PuKW, DdnJDwBMUoj)'),
  'witch-bridge': { ...stat('witch-bridge.glb', 22, 'humpback stone footbridge over the witch stream (DeWji_1PuKW)'), fit: 'x' },
  nave: stat('ruined-nave.glb', 26, 'ruined nave with columns, arches and a rose window'),
  archgate: stat('arch-gate.glb', 14, 'frozen arch gate'),
  palmisland: stat('palm-island.glb', 28, 'floating palm island on an inverted rock'),
  'colossus-statue': stat('kneeling-colossus.glb', 15.5, 'kneeling horned colossus statue'),
  'burning-castle': stat('burning-castle.glb', 68, 'burning castle on the far shore'),
  // Settlements and props (static)
  'village-house': stat('village-house.glb', 5.8, 'thatched village house'),
  tavern: stat('tavern.glb', 7.6, 'tavern with its sign, table and stools'),
  'torch-post': stat('torch-post.glb', 2.6, 'torch on a post'),
  campfire: stat('campfire.glb', 0.75, 'stone campfire ring with a kettle tripod (DdjlyzyOcnK)'),
  cloister: stat('cloister.glb', 8.6, 'three pointed gothic arches on slender columns (DdKl7fKMO75)'),
  observatory: stat('observatory.glb', 12, 'mushroom observatory hut with balcony and telescope'),
  throne: stat('throne.glb', 4.5, 'antler-and-bone throne on a dais with candelabras (DedGUYetKjP)'),
  cauldron: stat('cauldron.glb', 1.4, 'iron cauldron over coals'),
  'lantern-post': stat('lantern-post.glb', 2.5, 'red paper lantern on a pole'),
  candle: stat('candle.glb', 0.3, 'candle'),
  'ruin-arch': stat('ruin-arch.glb', 6.6, 'ruined stone arch'),
  'ruin-column': stat('ruin-column.glb', 4.5, 'broken stone column'),
  'flooded-ruin': stat('flooded-ruin.glb', 9, 'flooded ruin: ring of columns, wall and arch'),
  'troll-gorge': stat('troll-gorge.glb', 15, 'rock walls of the troll gorge'),
  'floating-rock': stat('floating-rock.glb', 3, 'floating boulder'),
  pinnacle: stat('pinnacle.glb', 30, 'sea pinnacle rising from the cloud sea'),
  mountain: stat('mountain.glb', 180, 'backdrop mountain'),
  boat: { file: 'boat.glb', height: 1.9, yaw: -Math.PI / 2, label: 'rowing boat with a bow lantern (DdjlyzyOcnK, DdwXCyeSsXn)' },
  'horse-rider': { file: 'horse-rider.glb', height: 2.6, yaw: Math.PI / 2, label: 'knight on horseback with a lantern (DdmvaMvMvS4)' },
  koi: { file: 'flying-koi.glb', height: 1.2, label: 'flying koi', clips: { idle: 'swim|idle' } },
  snake: { file: 'snake.glb', height: 0.6, label: 'coiled snake', clips: { idle: 'idle' } },
  // NPC bodies (humanoid rigs; the pose name is the idle clip)
  'knight-npc': { file: 'knight-npc.glb', height: 1.9, label: 'armoured knight: tavern, rowing, kneeling, watching (DdfKgLsBmoA, DdjlyzyOcnK, DdKl7fKMO75)', clips: NPC_CLIPS('idle') },
  'knight-seated': { file: 'knight-seated.glb', height: 1.95, label: 'caped greatsword knight sitting on the cliff (Sir Halvard)', clips: NPC_CLIPS('sit') },
  'knight-rose': { file: 'knight-rose.glb', height: 1.95, label: 'black knight offering a rose (Sir Corvin)', clips: NPC_CLIPS('offer') },
  skeleton: { file: 'skeleton.glb', height: 1.75, label: 'skeletons at the campfire (DdjlyzyOcnK)', clips: NPC_CLIPS('sit') },
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
  ogre: { file: 'log-giant.glb', height: 3.1, label: 'ogre woodhauler (Grub) — reuses the log giant', clips: { idle: 'idle|stance', walk: 'carry|walking|walk' } },
  // Flora and decor (one file each, instanced)
  pine: stat('pine.glb', 13, 'pine tree'), 'snow-pine': stat('snow-pine.glb', 13, 'snow-laden pine'),
  birch: stat('birch.glb', 11, 'birch'), willow: stat('willow.glb', 9, 'willow'), palm: stat('palm.glb', 8, 'palm'),
  'gnarled-tree': stat('gnarled-tree.glb', 6, 'gnarled orchard tree'),
  'dead-forest-tree': stat('dead-forest-tree.glb', 8, 'dead forest tree'), 'flower-tree': stat('flower-tree.glb', 10, 'glowing flower tree'),
  'floating-island': stat('floating-island.glb', 6, 'small floating rock island'),
  'giant-mushroom': stat('giant-mushroom.glb', 8, 'giant mushroom'), mushroom: stat('mushroom.glb', 0.45, 'small glowing mushroom'),
  sunflower: stat('sunflower.glb', 1.5, 'blue sunflower'), flower: stat('flower.glb', 0.35, 'meadow flower'),
  'giant-flower': stat('giant-flower.glb', 3, 'giant cosmos flower'), 'rose-bush': stat('rose-bush.glb', 0.9, 'rose bush'),
  boulder: stat('boulder.glb', 1.2, 'boulder'),
  'pod-tree': stat('pod-tree.glb', 22, 'tree with hanging glowing pods'), coral: stat('coral.glb', 1.6, 'coral bush'),
  reed: stat('reed.glb', 2.4, 'reed clump'), 'lily-pad': stat('lily-pad.glb', 0.9, 'lily pad'), lotus: stat('lotus.glb', 0.5, 'lotus flower'),
  'fallen-leaf': stat('fallen-leaf.glb', 0.28, 'fallen leaf'), 'fallen-fruit': stat('fallen-fruit.glb', 0.35, 'fallen fruit'),
  cobblestone: stat('cobblestone.glb', 0.14, 'cobblestone'), cypress: stat('cypress.glb', 9, 'cypress'), grave: stat('grave.glb', 1.2, 'gravestone'),

  // --- Fifth batch of reels (2026-10-14 evening). Every id names its reel. ---
  // The galaxy city beyond the portal (DeOemU1BOZF, DeaqHWJBBPw, DeXn5rSPxR8, DeQ-NnpvqF6, Dd0wR9Jh2lH, DdyN2PNyIxb, DdnJDwBMUoj)
  'checker-road': { ...stat('checker-road.glb', 6, 'checkered stone causeway tile (DeOemU1BOZF)'), fit: 'z' },
  'round-tower': stat('round-tower.glb', 22, 'round medieval tower with lit windows and a conical roof (DeOemU1BOZF)'),
  'stone-throne': stat('stone-throne.glb', 3.2, 'grey stone throne of the skeleton king (DeOemU1BOZF)'),
  'coin-block': stat('coin-block.glb', 1.2, 'cracked stone block heaped with gold coins (DeOemU1BOZF)'),
  'purple-crystal': stat('purple-crystal.glb', 1.0, 'purple crystal (DeOemU1BOZF, DeaqHWJBBPw)'),
  'gothic-pavilion': stat('gothic-pavilion.glb', 9, 'gothic pavilion with a ribbed dome and round arched windows (DeXn5rSPxR8)'),
  'purple-house': stat('purple-house.glb', 9, 'half-timbered house with a purple roof (DeaqHWJBBPw)'),
  'purple-mushroom': stat('purple-mushroom.glb', 2.2, 'glowing purple mushroom (DeaqHWJBBPw)'),
  'galaxy-hall': stat('galaxy-hall.glb', 15, 'pillared hall with a river down its centre and crystal stalactites (Dd0wR9Jh2lH)'),
  'marble-throne': stat('marble-throne.glb', 4, 'cracked white marble throne (Dd0wR9Jh2lH)'),
  'ring-portal': stat('ring-portal.glb', 7, 'stone ring portal (DdyN2PNyIxb, DdnJDwBMUoj)'),
  brazier: stat('brazier.glb', 1.4, 'stone fire brazier (DdyN2PNyIxb)'),
  'market-stall': stat('market-stall.glb', 3.5, 'thatched goblin market stall with lanterns (DdnJDwBMUoj)'),
  'crystal-ball': stat('crystal-ball.glb', 0.5, 'purple crystal ball on a stand (DdnJDwBMUoj)'),
  'dragon-riders': { file: 'dragon-riders.glb', height: 6, label: 'black dragon with gold horns carrying the skeleton lord and the blue knight (DeYtKbMh76x)', clips: { idle: 'fly|idle', fly: 'fly' } },
  'skeleton-lord': { file: 'skeleton-lord.glb', height: 1.9, label: 'skeleton lord in a black fur cloak and gold chains (DeXn5rSPxR8)', clips: NPC_CLIPS('sit') },
  'blue-knight': { file: 'blue-knight.glb', height: 1.95, label: 'blue plate knight with a goblet (DeXn5rSPxR8)', clips: NPC_CLIPS('drink') },
  'skeleton-king': { file: 'skeleton-king.glb', height: 2.0, label: 'crowned skeleton king with gold chains and a galaxy cloak (DeOemU1BOZF)', clips: NPC_CLIPS('sit') },
  'skeleton-wizard': { file: 'skeleton-wizard.glb', height: 1.9, label: 'skeleton wizard with a gold crystal staff (DeaqHWJBBPw)', clips: NPC_CLIPS('idle') },
  'galaxy-wizard': { file: 'galaxy-wizard.glb', height: 1.9, label: 'galaxy-robed wizard pouring a glowing potion (DeQ-NnpvqF6)', clips: NPC_CLIPS('idle') },
  'galaxy-king': { file: 'galaxy-king.glb', height: 2.6, label: 'crowned galaxy king with glowing eyes (Dd0wR9Jh2lH)', clips: NPC_CLIPS('sit') },
  'void-monk': { file: 'void-monk.glb', height: 1.85, label: 'hooded monk whose face is a galaxy (DdyN2PNyIxb)', clips: NPC_CLIPS('idle') },
  bucket: { file: 'bucket-mimic.glb', height: 1.3, label: 'tooth-grinning bucket mimic on skeletal legs (DeaqHWJBBPw)', clips: BOSS_CLIPS },
  // The sunken city under the lake (DeVj-Z8POjl)
  'sunken-tavern': stat('sunken-tavern.glb', 12, 'underwater tavern with jellyfish windows and bottle shelves (DeVj-Z8POjl)'),
  'coral-throne': stat('coral-throne.glb', 3, 'coral throne (DeVj-Z8POjl)'),
  jellyfish: stat('jellyfish.glb', 1.4, 'glowing jellyfish (DeVj-Z8POjl)'),
  barrel: stat('barrel.glb', 1.1, 'wooden barrel (DeVj-Z8POjl)'),
  'giant-crown': stat('giant-crown.glb', 3, 'giant golden crown hanging over the hearth (DeVj-Z8POjl)'),
  'fish-king': { file: 'fish-king.glb', height: 2.1, label: 'crowned fish king with a lantern and a chalice (DeVj-Z8POjl)', clips: NPC_CLIPS('idle') },
  // On the island
  'face-tree': stat('face-tree.glb', 12, 'tree with a carved stone face and a round door (DeQ-NnpvqF6)'),
  'stepping-stone': { ...stat('stepping-stone.glb', 1.0, 'flat round stepping stone (DeQ-NnpvqF6)'), fit: 'x' },
  'hanging-lantern': stat('hanging-lantern.glb', 1.2, 'hanging lantern (DeQ-NnpvqF6)'),
  'mushroom-lamp': stat('mushroom-lamp.glb', 1.2, 'hanging glowing mushroom lamp (DaIqFavJWbd)'),
  'tavern-table': stat('tavern-table.glb', 1.0, 'long wooden tavern table with a pewter mug (DaIqFavJWbd)'),
  'world-tree': stat('world-tree.glb', 28, 'giant tree veined with glowing blue light (Ddn0A49tnW7)'),
  'rune-grave': stat('rune-grave.glb', 1.6, 'runic gravestone (Ddn0A49tnW7)'),
  'robed-priest': { file: 'robed-priest.glb', height: 1.9, label: 'robed figure raising its arms to the world tree (Ddn0A49tnW7)', clips: NPC_CLIPS('idle') },
  'spire-city': stat('spire-city.glb', 90, 'city of spires and aqueduct bridges beyond the cliffs (DdwXCyeSsXn)'),
  crystalgolem: { file: 'crystal-golem.glb', height: 3.2, label: 'golem of blue crystal shards (Dd0wR9Jh2lH)', clips: BOSS_CLIPS },
  emberrider: { file: 'ember-rider.glb', height: 3.0, label: 'red-eyed rider on a black horse with a burning mane (Ddn0A49tnW7)', clips: BOSS_CLIPS },
};

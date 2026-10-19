/**
 * Registry of real 3D assets. When a GLB exists at `public/models/<file>` the game uses it instead of the
 * procedural builder; when it is missing the procedural version stays. Generated with Meshy from reel frames.
 *
 * Clip names are matched case-insensitively and by substring, so "Idle", "idle_01" and "Armature|Idle" all work.
 */
export type ClipName = 'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'heavy' | 'cast' | 'hit' | 'death' | 'sit' | 'kneel' | 'roar' | 'fly' | 'drink' | 'bow' | 'lantern' | 'offer' | 'talk' | 'swim' | 'swimIdle' | 'throw' | 'punch' | 'grab' | 'stand' | 'climb';

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
  /**
   * 0..1: how much of the clips' arm rotation to give back to the rest pose. For rigs whose cloak or long arms are
   * skinned to the arm bones (the Horned Shade, the Gorge Troll), raised arms stretch the mesh into sheets or noodles.
   */
  armDamp?: number;
  /**
   * 0..1: how much of the hips' twist about the vertical to keep in every clip. Meshy's combat presets turn the whole
   * body 45° sideways in the stance and ~100° in the Attack swing, so a monster fights side-on; 0.25 keeps a hint.
   */
  faceForward?: number;
  /** Clip keys played left for right (the first clip named by each key's alternatives is mirrored at load). */
  mirror?: ClipName[];
  /** 0..1: how strongly the idle clip poses the body (a floating spirit should not crouch in a boxer's stance). */
  idleBlend?: number;
  /** A boneless robe/cloak model: the rig animates it procedurally (hover, sway, hem wind) instead of clips. */
  robe?: boolean;
  /** Human-readable name for the missing-model warning and placeholder. */
  label?: string;
  /** Base colour for a file that came without a texture (an untextured Meshy draft), until its texture pass. */
  tint?: number;
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
  // The wall climb is a Meshy preset exported from another rig of the same (Mixamo-template) skeleton, rotations only.
  knight: { file: 'knight.glb', clipFiles: { climb: 'hero-climb.glb' }, height: 1.95, mirror: ['idle'], clips: { idle: 'idle_02|idle|stance', walk: 'walking|walk', run: 'running|run', jump: 'basic_jump|jump', attack: 'right_hand_sword_slash|slash|attack', heavy: 'sword_judgment|judgment|slash', cast: 'sword_shout|shout|slash', hit: 'hit_reaction|hit', death: 'dying|death', drink: 'stand_and_drink|drink', swim: 'swim_forward|swim', swimIdle: 'swim_idle|swim' } },
  // Remade 2026-10-15 from frames/archer-v2.png (Meshy 7.1, A-pose, biped rig); her bow is archer-bow.glb in the left hand.
  archer: { file: 'archer.glb', clipFiles: { climb: 'hero-climb.glb' }, height: 1.8, clips: { idle: 'idle_03|idle', walk: 'walking|walk', run: 'running|run', jump: 'regular_jump|jump', attack: 'archery_shot|shot', heavy: 'archery_shot_1|shot', cast: 'archery_aim|aim|shot', hit: 'hit_reaction|hit', death: 'dying|death', swim: 'swim_forward|swim', swimIdle: 'swim_idle|swim' } },
  wizard: { file: 'wizard.glb', height: 1.85, robe: true, smoke: { x: -0.08, y: 1.19, z: 0.29 }, hand: { x: -0.36, y: 0.98, z: 0.12 }, clips: { idle: 'idle_02|idle|stance', walk: 'walking|walk', run: 'running|run', jump: 'basic_jump|jump', attack: 'mage_soell_cast|spell|cast', heavy: 'charged_spell_cast|charged|cast', cast: 'charged_spell_cast|charged|cast', hit: 'hit_reaction|hit', death: 'dying|death' } },
  // Weapons the heroes pull out while attacking (the models' own baked weapons stay where they are)
  staff: { file: 'staff.glb', height: 1.75, label: "Orlan's plain wooden walking staff (wizard-full.png)", grip: { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, slide: -1.05 } },
  // Wren's bow on its own (text-to-3D from her reference, docs/reference/frames/archer.png): she sits on it to fly.
  bow: { file: 'archer-bow.glb', height: 1.5, label: "Wren's recurve hunting bow (archer.png)" },
  greatsword: { file: 'greatsword.glb', height: 1.45, label: "Sir Aldric's hand-and-a-half sword (knight.png)", grip: { x: 0, y: 0.08, z: 0.02, rx: -Math.PI / 2, ry: 0, rz: 0, slide: -1.18 } },
  // Bosses and mobs
  // Meshy animate exports bundle every added preset into one GLB; clip names are the preset's English ids.
  yeti: { file: 'yeti.glb', height: 3.2, faceForward: 0.25, armDamp: 0.45, clips: BOSS_CLIPS },
  shade: { file: 'horned-shade.glb', height: 10, armDamp: 0.7, idleBlend: 0.3, faceForward: 0.25, clips: BOSS_CLIPS },
  warden: { file: 'antlered-warden.glb', height: 6.5, faceForward: 0.25, clips: BOSS_CLIPS },
  wyrm: { file: 'moon-wyrm.glb', height: 3, yOffset: 0, clips: { idle: 'fly|idle|hover', fly: 'fly|idle', attack: 'bite|attack' } },
  troll: { file: 'rock-troll.glb', height: 3.2, yaw: Math.PI, armDamp: 0.6, faceForward: 0.25, clips: BOSS_CLIPS },
  lurker: { file: 'lake-lurker.glb', height: 2.8, faceForward: 0.25, clips: BOSS_CLIPS },
  marshdemon: { file: 'marsh-demon.glb', height: 5, faceForward: 0.25, clips: BOSS_CLIPS },
  hollowking: { file: 'hollow-king.glb', height: 10, clips: BOSS_CLIPS },
  rivershade: { file: 'river-shade.glb', height: 3, faceForward: 0.3, label: 'hooded river shade with glowing eyes (DeUydbMvKqC, DeWZT3jvPCG)' },
  passbeast: { file: 'fog-beast.glb', height: 2.4, faceForward: 0.2, label: 'red-eyed black beast of the mountain pass (DeXeZ7rhGVi)', clips: { idle: 'combat_stance|idle_02|idle', walk: 'monster_walk|crawl|walking', run: 'running|run', attack: 'attack', roar: 'zombie_scream|scream', hit: 'hit_reaction|hit', death: 'dying|death' } },
  beast: { file: 'fog-beast.glb', height: 1.5, faceForward: 0.2, label: 'red-eyed black beast (DeXeZ7rhGVi)', clips: { idle: 'combat_stance|idle_02|idle', walk: 'monster_walk|crawl|walking', run: 'running|run', attack: 'attack', roar: 'zombie_scream|scream', hit: 'hit_reaction|hit', death: 'dying|death' } },
  croc: { file: 'crocodile.glb', height: 0.7, label: 'crocodile in the flooded ruins (DeJj8CDhL2f)' },
  // NPCs and creatures
  frogking: { file: 'frog-king.glb', height: 2.4, clips: { idle: 'idle|breath' } },
  // The Frog King as the dream shows him: a god, seven metres tall, every colour at once (the dream's boss).
  'dmt-entity': { file: 'frog-king.glb', height: 7, label: 'the Frog God of the dream (frog-king.glb, trippy shader)', clips: { idle: 'idle|breath' } },
  loggiant: { file: 'log-giant.glb', height: 4.2, clips: { idle: 'combat_stance|idle|stance', walk: 'carry|walking|walk', run: 'running|run', hit: 'hit_reaction|hit', throw: 'over_shoulder_throw|throw', grab: 'grip_and_throw|grip', punch: 'punch_forward_with_both|punch_combo|punch', attack: 'punch_combo|punch' } },
  spiderchapel: { file: 'spider-chapel.glb', height: 28, clips: { idle: 'idle', walk: 'walk|crawl|run' } },
  colossus: { file: 'moon-shell-colossus.glb', height: 9, clips: { idle: 'crawl' } },
  king: { file: 'antlered-king.glb', height: 1.95, label: 'the Antlered King (DedGUYetKjP)', clips: NPC_CLIPS('throne') },
  witch: { file: 'witch.glb', height: 1.85, label: 'coven witch in a pointed hat (DeWji_1PuKW)' },
  // Landmarks (static)
  head: { file: 'giant-head.glb', height: 26, label: 'giant stone head with red eyes' },
  cathedral: { file: 'cathedral.glb', height: 55 },
  castle: { file: 'castle.glb', height: 28 },
  church: { file: 'demon-church.glb', height: 15, label: 'horned demon church (DeDRVZwxJyO)' },
  tower: { file: 'wizard-tower.glb', height: 32 },
  treehouse: { file: 'tree-house.glb', height: 15, label: 'giant tree-house with a round door (DdKl7fKMO75)' },

  // --- Meshy to-do: every entry below renders a placeholder until its file exists in public/models ---
  // Walkways and skyline (static)
  'causeway-segment': stat('causeway-segment.glb', 1.89, 'arched cobbled bridge span (three per causeway segment)'),
  'causeway-stairs': stat('causeway-stairs.glb', 6, 'causeway stairs at the south end'),
  'chasm-bridge': stat('chasm-bridge.glb', 1.8, 'rope-bridge deck tile, repeated across the chasm (DeWji_1PuKW, DdnJDwBMUoj)'),
  'witch-bridge': { ...stat('witch-bridge.glb', 22, 'humpback stone footbridge over the witch stream (DeWji_1PuKW)'), fit: 'x' },
  nave: stat('ruined-nave.glb', 18, 'ruined nave with columns, arches and a rose window'),
  archgate: stat('arch-gate.glb', 10, 'frozen arch gate'),
  palmisland: stat('palm-island.glb', 28, 'floating palm island on an inverted rock'),
  'colossus-statue': stat('kneeling-colossus.glb', 12, 'kneeling horned colossus statue'),
  'burning-castle': stat('burning-castle.glb', 40, 'burning castle on the far shore'),
  // Settlements and props (static)
  'village-house': stat('village-house.glb', 5.8, 'thatched village house'),
  tavern: stat('tavern.glb', 7, 'tavern with its sign, table and stools'),
  'torch-post': stat('torch-post.glb', 2.4, 'torch on a post'),
  campfire: stat('campfire.glb', 0.75, 'stone campfire ring with a kettle tripod (DdjlyzyOcnK)'),
  cloister: stat('cloister.glb', 6.5, 'three pointed gothic arches on slender columns (DdKl7fKMO75)'),
  observatory: stat('observatory.glb', 7, 'mushroom observatory hut with balcony and telescope'),
  throne: stat('throne.glb', 3, 'antler-and-bone throne on a dais with candelabras (DedGUYetKjP)'),
  cauldron: stat('cauldron.glb', 1.1, 'iron cauldron over coals'),
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
  koi: { file: 'flying-koi.glb', height: 0.6, label: 'flying koi', clips: { idle: 'swim|idle' } },
  snake: { file: 'snake.glb', height: 0.35, label: 'coiled snake', clips: { idle: 'idle' } },
  // NPC bodies (humanoid rigs; the pose name is the idle clip)
  'knight-npc': { file: 'knight-npc.glb', height: 1.9, label: 'armoured knight: tavern, rowing, kneeling, watching (DdfKgLsBmoA, DdjlyzyOcnK, DdKl7fKMO75)', clips: NPC_CLIPS('idle') },
  'knight-seated': { file: 'knight-seated.glb', height: 1.95, label: 'caped greatsword knight sitting on the cliff (Sir Halvard)', clips: NPC_CLIPS('sit') },
  'knight-rose': { file: 'knight-rose.glb', height: 1.95, label: 'black knight offering a rose (Sir Corvin)', clips: NPC_CLIPS('offer') },
  skeleton: { file: 'skeleton.glb', height: 1.75, label: 'skeletons at the campfire (DdjlyzyOcnK)', clips: { ...NPC_CLIPS('sit'), attack: 'attack', hit: 'hit_reaction|hit', stand: 'sit_to_stand|stand', death: 'dying|death' } },
  'skeleton-banner': { file: 'skeleton-banner.glb', height: 1.85, label: 'skeleton standard-bearer with banner and trident (Hollow Jack)', clips: NPC_CLIPS('banner') },
  'witch-cook': { file: 'witch-cook.glb', height: 1.8, label: 'skeleton cook in a chef hat with a spoon (Mother Marrow)', clips: NPC_CLIPS('stir') },
  bride: { file: 'bride.glb', height: 1.8, label: 'the Pale Bride', clips: NPC_CLIPS('walk') },
  maiden: { file: 'maiden.glb', height: 1.68, label: 'Elowen of the flower garden', clips: NPC_CLIPS('bow') },
  // (The vale's beggar sits: the chair-sit clip borrowed from the knight NPC's rig of the same skeleton, rotations only.)
  wanderer: { file: 'wanderer.glb', clipFiles: { sit: 'npc-sit.glb' }, height: 1.85, label: 'hooded wanderer with a lantern (the Lanternbearer)', clips: NPC_CLIPS('walk') },
  'wizard-npc': { file: 'wizard-npc.glb', height: 1.8, label: 'wizard NPC (Mirren, Sel)', clips: NPC_CLIPS('idle') },
  gnome: { file: 'gnome.glb', height: 1.15, label: 'gnome astronomer with a telescope (Pim)', clips: NPC_CLIPS('telescope') },
  'frog-monk': { file: 'frog-monk.glb', height: 1.75, label: 'frog monk reading a book (Brother Croak)', clips: NPC_CLIPS('read') },
  'troll-fisher': { file: 'troll-fisher.glb', height: 2.4, label: 'troll fisher with a rod (Old Moss)', clips: NPC_CLIPS('fish') },
  goblin: { file: 'goblin.glb', height: 1.15, label: 'tavern goblin (Snik, Vrak)', clips: NPC_CLIPS('sit') },
  ogre: { file: 'log-giant.glb', height: 2.8, label: 'ogre woodhauler (Grub) — reuses the log giant', clips: { idle: 'idle|stance', walk: 'carry|walking|walk' } },
  // Flora and decor (one file each, instanced)
  pine: stat('pine.glb', 12, 'pine tree'), 'snow-pine': stat('snow-pine.glb', 11, 'snow-laden pine'),
  birch: stat('birch.glb', 10, 'birch'), willow: stat('willow.glb', 8, 'willow'), palm: stat('palm.glb', 8, 'palm'),
  'gnarled-tree': stat('gnarled-tree.glb', 6, 'gnarled orchard tree'),
  'dead-forest-tree': { ...stat('dead-forest-tree.glb', 10, 'dead gnarled leafless tree, black bark (world-look-28)'), tint: 0x1c1822 }, 'flower-tree': stat('flower-tree.glb', 7, 'glowing flower tree'),
  'floating-island': stat('floating-island.glb', 22, 'floating rock island with dead trees and chimney stumps (#28, 01.22.56)'),
  'giant-mushroom': stat('giant-mushroom.glb', 5, 'giant mushroom'), mushroom: stat('mushroom.glb', 0.45, 'small glowing mushroom'),
  sunflower: stat('sunflower.glb', 1.5, 'blue sunflower'), flower: stat('flower.glb', 0.35, 'meadow flower'),
  'giant-flower': stat('giant-flower.glb', 2.4, 'giant cosmos flower'), 'rose-bush': stat('rose-bush.glb', 0.9, 'rose bush'),
  boulder: stat('boulder.glb', 1.2, 'boulder'),
  'pod-tree': stat('pod-tree.glb', 12, 'tree with hanging glowing pods'), coral: stat('coral.glb', 1.6, 'coral bush'),
  reed: stat('reed.glb', 1.8, 'reed clump'), 'lily-pad': stat('lily-pad.glb', 0.9, 'lily pad'), lotus: stat('lotus.glb', 0.5, 'lotus flower'),
  'fallen-leaf': stat('fallen-leaf.glb', 0.28, 'fallen leaf'), 'fallen-fruit': stat('fallen-fruit.glb', 0.35, 'fallen fruit'),
  cobblestone: stat('cobblestone.glb', 0.14, 'cobblestone'), cypress: stat('cypress.glb', 9, 'cypress'), grave: { ...stat('grave.glb', 1.1, 'arched gothic headstone (shot-011654)'), tint: 0x5c6270 },

  // The user's own frames (docs/reference/frames/cup-gnome.png): Meshy 6 Lite draft, Meshy 7 image-guided texture, biped rig.
  'cup-gnome': { file: 'cup-gnome.glb', height: 1.25, label: 'gnome with a gold grill, gold chain and a purple cup (frames/cup-gnome.png)', clips: { idle: 'stand_and_drink|idle_03|idle_02', drink: 'stand_and_drink', talk: 'talk_with_hands_open', walk: 'walking', run: 'running' } },

  // --- Round 3 (2026-10-15): the user's own images and descriptions ---
  // Yung Lean, king of the realm beyond the portal (frames/rift-king.png): sits on the throne, stands to fight.
  'rift-king': { file: 'rift-king.glb', height: 1.85, faceForward: 0.3, label: 'Yung Lean in a white puffer coat with an ice crown (frames/rift-king.png)', clips: { idle: 'idle_03|idle', sit: 'chair_sit|sit', stand: 'sit_to_stand|stand', talk: 'talk_with_hands_open|talk', walk: 'walking|walk', run: 'running|run', attack: 'attack', heavy: 'charged_spell_cast|spell', cast: 'mage_s|charged_spell|cast', hit: 'hit_reaction|hit', death: 'dying|death' } },
  // Styro-Ghouls, the lean-chucking imps of his kingdom (the user's description); the boss is the same body, larger.
  'styro-ghoul': { file: 'styro-ghoul.glb', height: 1.25, faceForward: 0.3, label: 'purple imp in baggy streetwear with a double-cup backpack', clips: { idle: 'combat_stance|idle_03|idle', walk: 'walking|walk', run: 'running|run', attack: 'over_shoulder_throw|throw', heavy: 'crouch_pull_and_throw|throw', throw: 'over_shoulder_throw|throw', sit: 'chair_sit|sit', stand: 'sit_to_stand|stand', hit: 'hit_reaction|hit', death: 'dying|death' } },
  'lean-chucker': { file: 'styro-ghoul.glb', height: 1.9, faceForward: 0.3, tint: 0xd7b7ff, label: 'the Lean-Chucker, boss of the Styro-Ghouls', clips: { idle: 'combat_stance|idle_03|idle', walk: 'walking|walk', run: 'running|run', attack: 'over_shoulder_throw|throw', heavy: 'crouch_pull_and_throw|throw', throw: 'over_shoulder_throw|throw', sit: 'chair_sit|sit', stand: 'sit_to_stand|stand', hit: 'hit_reaction|hit', death: 'dying|death' } },
  // A double cup of lean (frames/lean-cup.png): the knight's cup, thrown cups, the giant cup islands, the signed cup.
  'lean-cup': stat('lean-cup.glb', 0.17, 'double white styrofoam cup of glowing purple lean (frames/lean-cup.png)'),
  'lean-cup-island': stat('lean-cup.glb', 22, 'giant double cup of lean, an island of the kingdom'),
  // Goldgrin's brother in the tree house: diamond grills, a job for the player.
  'gnome-brother': { file: 'gnome-brother.glb', height: 1.2, label: "Goldgrin's diamond-grilled brother", clips: { idle: 'idle_03|idle', talk: 'talk_with_hands_open|talk', offer: 'scheming_hand_rub|hand_rub', walk: 'walking|walk', run: 'running|run' } },
  'croak-bag': stat('croak-bag.glb', 1.1, 'burlap sack with Brother Croak inside'),
  'treehouse-door': { ...stat('treehouse-door.glb', 2.3, 'round plank door of the tree house'), tint: 0x5a3c26 },
  'treehouse-interior': stat('treehouse-interior.glb', 7, 'round room inside the tree house trunk'),
  'stone-lotus': { ...stat('stone-lotus.glb', 1.6, 'stone-carved lotus drifting on the green-tea streams'), tint: 0xb8b2c8 },

  // --- Fifth batch of reels (2026-10-14 evening). Every id names its reel. ---
  // The galaxy city beyond the portal (DeOemU1BOZF, DeaqHWJBBPw, DeXn5rSPxR8, DeQ-NnpvqF6, Dd0wR9Jh2lH, DdyN2PNyIxb, DdnJDwBMUoj)
  'checker-road': { ...stat('checker-road.glb', 6, 'checkered stone causeway tile (DeOemU1BOZF)'), fit: 'z' },
  'round-tower': stat('round-tower.glb', 18, 'round medieval tower with lit windows and a conical roof (DeOemU1BOZF)'),
  'stone-throne': stat('stone-throne.glb', 2.6, 'grey stone throne of the skeleton king (DeOemU1BOZF)'),
  'coin-block': stat('coin-block.glb', 1.2, 'cracked stone block heaped with gold coins (DeOemU1BOZF)'),
  'purple-crystal': stat('purple-crystal.glb', 1.0, 'purple crystal (DeOemU1BOZF, DeaqHWJBBPw)'),
  'gothic-pavilion': stat('gothic-pavilion.glb', 7, 'gothic pavilion with a ribbed dome and round arched windows (DeXn5rSPxR8)'),
  'purple-house': stat('purple-house.glb', 8, 'half-timbered house with a purple roof (DeaqHWJBBPw)'),
  'purple-mushroom': stat('purple-mushroom.glb', 2.2, 'glowing purple mushroom (DeaqHWJBBPw)'),
  'galaxy-hall': stat('galaxy-hall.glb', 15, 'pillared hall with a river down its centre and crystal stalactites (Dd0wR9Jh2lH)'),
  'marble-throne': stat('marble-throne.glb', 2.8, 'cracked white marble throne (Dd0wR9Jh2lH)'),
  'ring-portal': stat('ring-portal.glb', 5.5, 'stone ring portal (DdyN2PNyIxb, DdnJDwBMUoj)'),
  brazier: stat('brazier.glb', 1.4, 'stone fire brazier (DdyN2PNyIxb)'),
  'market-stall': stat('market-stall.glb', 3.2, 'thatched goblin market stall with lanterns (DdnJDwBMUoj)'),
  'crystal-ball': stat('crystal-ball.glb', 0.5, 'purple crystal ball on a stand (DdnJDwBMUoj)'),
  'dragon-riders': { file: 'dragon-riders.glb', height: 5, label: 'black dragon with gold horns carrying the skeleton lord and the blue knight (DeYtKbMh76x)', clips: { idle: 'fly|idle', fly: 'fly' } },
  'skeleton-lord': { file: 'skeleton-lord.glb', height: 1.9, label: 'skeleton lord in a black fur cloak and gold chains (DeXn5rSPxR8)', clips: NPC_CLIPS('sit') },
  'blue-knight': { file: 'blue-knight.glb', height: 1.95, label: 'blue plate knight with a goblet (DeXn5rSPxR8)', clips: NPC_CLIPS('drink') },
  'skeleton-king': { file: 'skeleton-king.glb', height: 2.0, label: 'crowned skeleton king with gold chains and a galaxy cloak (DeOemU1BOZF)', clips: NPC_CLIPS('sit') },
  'skeleton-wizard': { file: 'skeleton-wizard.glb', height: 1.9, label: 'skeleton wizard with a gold crystal staff (DeaqHWJBBPw)', clips: NPC_CLIPS('idle') },
  'galaxy-wizard': { file: 'galaxy-wizard.glb', height: 1.9, label: 'galaxy-robed wizard pouring a glowing potion (DeQ-NnpvqF6)', clips: NPC_CLIPS('idle') },
  'galaxy-king': { file: 'galaxy-king.glb', height: 2.2, label: 'crowned galaxy king with glowing eyes (Dd0wR9Jh2lH)', clips: NPC_CLIPS('sit') },
  'void-monk': { file: 'void-monk.glb', height: 1.85, label: 'hooded monk whose face is a galaxy (DdyN2PNyIxb)', clips: NPC_CLIPS('idle') },
  bucket: { file: 'bucket-mimic.glb', height: 1.0, label: 'tooth-grinning bucket mimic on skeletal legs (DeaqHWJBBPw)', clips: BOSS_CLIPS },
  // The sunken city under the lake (DeVj-Z8POjl)
  'sunken-tavern': stat('sunken-tavern.glb', 9, 'underwater tavern with jellyfish windows and bottle shelves (DeVj-Z8POjl)'),
  'coral-throne': stat('coral-throne.glb', 2.4, 'coral throne (DeVj-Z8POjl)'),
  jellyfish: stat('jellyfish.glb', 0.9, 'glowing jellyfish (DeVj-Z8POjl)'),
  barrel: stat('barrel.glb', 1.1, 'wooden barrel (DeVj-Z8POjl)'),
  'giant-crown': stat('giant-crown.glb', 2.2, 'giant golden crown hanging over the hearth (DeVj-Z8POjl)'),
  'fish-king': { file: 'fish-king.glb', height: 2.1, label: 'crowned fish king with a lantern and a chalice (DeVj-Z8POjl)', clips: NPC_CLIPS('idle') },
  // On the island
  'face-tree': stat('face-tree.glb', 10, 'tree with a carved stone face and a round door (DeQ-NnpvqF6)'),
  'stepping-stone': { ...stat('stepping-stone.glb', 1.0, 'flat round stepping stone (DeQ-NnpvqF6)'), fit: 'x' },
  'hanging-lantern': stat('hanging-lantern.glb', 1.2, 'hanging lantern (DeQ-NnpvqF6)'),
  'mushroom-lamp': stat('mushroom-lamp.glb', 1.2, 'hanging glowing mushroom lamp (DaIqFavJWbd)'),
  'tavern-table': { ...stat('tavern-table.glb', 1.0, 'long wooden tavern table (DaIqFavJWbd, DeVj-Z8POjl)'), tint: 0x5a3e26 },
  'world-tree': stat('world-tree.glb', 22, 'giant tree veined with glowing blue light (Ddn0A49tnW7)'),
  'rune-grave': { ...stat('rune-grave.glb', 1.6, 'pointed gothic headstone (Ddn0A49tnW7, shot-011654)'), tint: 0x585d6c },
  'grave-cross': { ...stat('grave-cross.glb', 1.8, 'celtic cross gravestone (shot-011654)'), tint: 0x5f6472 },
  'robed-priest': { file: 'robed-priest.glb', height: 1.9, label: 'robed figure raising its arms to the world tree (Ddn0A49tnW7)', clips: NPC_CLIPS('idle') },
  'spire-city': stat('spire-city.glb', 90, 'city of spires and aqueduct bridges beyond the cliffs (DdwXCyeSsXn)'),
  crystalgolem: { file: 'crystal-golem.glb', height: 2.6, faceForward: 0.3, label: 'golem of blue crystal shards (Dd0wR9Jh2lH)', clips: BOSS_CLIPS },
  emberrider: { file: 'ember-rider.glb', height: 2.7, label: 'red-eyed rider on a black horse with a burning mane (Ddn0A49tnW7)', clips: BOSS_CLIPS },
  // Round 5 (2026-10-16): the user's reference images (docs/reference/frames/shot-*.jpg, world-look-28.png).
  cyclops: { file: 'cyclops.glb', height: 9, faceForward: 0.25, armDamp: 0.7, label: 'huge blue one-eyed horned cyclops with claws (shot-011654, world-look-28)', clips: BOSS_CLIPS },
  'cyclops-lord': { file: 'cyclops.glb', height: 7, faceForward: 0.25, armDamp: 0.7, label: 'the cyclops at the end of the alley of graves (shot-011654)', clips: BOSS_CLIPS },
  'blood-eye': stat('blood-eye.glb', 6, 'giant floating red spiky eyeball with a blue iris (shot-013226)'),
  // The wizard of the dream: galaxy-wizard.glb flying, in the trippy shader (shot-013245).
  'trip-wizard': { file: 'galaxy-wizard.glb', height: 1.9, label: 'rainbow-robed wizard flying in the dream (shot-013245)', clips: { idle: 'idle_02|idle', walk: 'walking|walk', run: 'running|run', attack: 'mage_soell_cast|charged_spell|cast', heavy: 'charged_spell|mage', hit: 'hit_reaction|hit', death: 'dying|death' } },
  'moon-laugh': stat('moon-laugh.glb', 10, 'blue moon with a laughing face (shot-013117, shot-013029)'),
  'moon-grin': stat('moon-grin.glb', 10, 'blue moon with glowing eyes and a sharp-toothed grin (shot-013056)'),
  'stone-wall': { ...stat('stone-wall.glb', 1.2, 'low mossy dry-stone graveyard wall segment, 2.6 m long (shot-011654)'), tint: 0x4e5560 },
  whale: { ...stat('whale.glb', 3.6, 'humpback whale flying over the white flowers (DeSEl9PvPG_)'), tint: 0x2c3a58 },
  'giant-skull': { ...stat('giant-skull.glb', 7, 'giant ancient skull with a snake coiled round it (DefYcvutTow)'), tint: 0xcfc4a8 },
  // Round 6 (2026-10-18): the @returndark reels. Characters carry their cup, tankard or book in the mesh.
  // Yung Lean's kingdom, the Lean Quarter.
  'galaxy-knight': { file: 'galaxy-knight.glb', height: 2.2, faceForward: 0.3, label: 'knight in galaxy-patterned plate with a spiked helm and a galaxy-swirl greatsword (DeOemU1BOZF)', clips: BOSS_CLIPS },
  'mail-knight': { file: 'mail-knight.glb', height: 1.95, faceForward: 0.3, label: 'knight in faceted blue chain mail and a gold chain with a crystal spear (DeaqHWJBBPw)', clips: BOSS_CLIPS },
  'skeleton-red': { file: 'skeleton-red.glb', height: 1.85, label: 'green-eyed skeleton with gold grills in a red fur coat sipping a double cup (DeldocTvFiB)', clips: NPC_CLIPS('drink') },
  'skeleton-witch': { file: 'skeleton-witch.glb', height: 2.1, label: 'skeleton in a tall black witch hat and gold chain sipping a double cup (DeldocTvFiB)', clips: NPC_CLIPS('drink') },
  'gold-knight': { file: 'gold-knight.glb', height: 2.0, label: 'dark blue knight with gold trim and a skull medallion raising a glowing cup (DeldocTvFiB)', clips: NPC_CLIPS('drink') },
  // One piece with the treasure chest he sits on (the reel's wagon): a still body.
  'plague-doctor': stat('plague-doctor.glb', 2.4, 'plague doctor with glowing eyes, black hat and gold chain lounging on a riveted treasure chest with lanterns, sipping a lidded cup (DeldocTvFiB)'),
  'lean-dragon': stat('lean-dragon.glb', 4.2, 'black dragon with gold horns and a diamond grill lying down (Den1ausBXai, Def4LDkxikA, DeYtKbMh76x)'),
  'sky-bar': stat('sky-bar.glb', 5.5, 'floating wooden bar booth hung on chains, a skull sign and a purple menu board (Den1ausBXai)'),
  'gothic-lamp': stat('gothic-lamp.glb', 3.2, 'tall black iron gothic lamp post with a glowing lantern (Den1ausBXai, Def4LDkxikA)'),
  'dragon-throne': stat('dragon-throne.glb', 6.5, 'black and gold gothic throne flanked by two black dragon statues in gold chains (Def4LDkxikA)'),
  'dragon-fountain': stat('dragon-fountain.glb', 4.5, 'black dragon-head statue over a stone basin, a fountain (Def4LDkxikA)'),
  'lean-fountain': stat('lean-fountain.glb', 3.0, 'tiered carved stone fountain (Def4LDkxikA)'),
  carriage: stat('carriage.glb', 3.2, 'ornate black carriage with gold trim and gold wheels (DeXn5rSPxR8)'),
  gem: { ...stat('gem.glb', 0.5, 'faceted cut gemstone (DeXn5rSPxR8, DeaqHWJBBPw)'), tint: 0xe9f2ff },
  stalactite: { ...stat('stalactite.glb', 3.0, 'hanging blue crystal stalactite cluster (DeOemU1BOZF)'), tint: 0x6a7dff },
  'skull-pile': { ...stat('skull-pile.glb', 1.6, 'heap of old skulls (DeldocTvFiB)'), tint: 0xb9ad94 },
  // A room with a vaulted roof, open at the front: walked inside (Interiors.ts gives it hand-measured colliders).
  'crypt-bar': stat('crypt-bar.glb', 8, 'vaulted stone crypt bar, open at the front: an L-shaped bar with skull panels and stools, candle sconces (DeldocTvFiB)'),
  'snow-chapel': stat('snow-chapel.glb', 10, 'ruined gothic stone chapel with snow on its roof and ledges (DeldocTvFiB)'),
  'snow-pillar': { ...stat('snow-pillar.glb', 2.6, 'square stone gate pillar capped with snow (DeldocTvFiB)'), tint: 0x6d7686 },
  'broken-gate': { ...stat('broken-gate.glb', 1.9, 'broken leaning wooden gate (DeldocTvFiB)'), tint: 0x4a3a2c },
  'potion-bottle': { ...stat('potion-bottle.glb', 0.4, 'round glass potion bottle full of a swirling galaxy (DeOemU1BOZF)'), tint: 0x5a4dff },
  // The island: the Lantern Village, the Kings' Valley, the cloud sea (Dd5Bqt7vQ5T).
  'candle-head': { file: 'candle-head.glb', height: 1.95, label: 'man in a black suit whose head is a cluster of melting white candles, raising a candle-lit tankard (Dd5Bqt7vQ5T)', clips: NPC_CLIPS('drink') },
  dwarf: { file: 'dwarf.glb', height: 1.4, label: 'dwarf in blue armour with a long braided beard raising a wooden tankard (Dd5Bqt7vQ5T)', clips: NPC_CLIPS('drink') },
  'green-dragon': stat('green-dragon.glb', 7, 'huge green dragon lying down behind the village, head raised (Dd5Bqt7vQ5T)'),
  'spell-book': { ...stat('spell-book.glb', 0.35, 'open glowing spell book (Dd5Bqt7vQ5T)'), tint: 0x8a6a42 },
  'crowned-head': stat('crowned-head.glb', 14, 'giant crowned stone head of a king lying on a grassy hill (Dd5Bqt7vQ5T)'),
  'floating-castle': stat('floating-castle.glb', 40, 'gothic castle on a floating rock pouring waterfalls (Dd5Bqt7vQ5T)'),
  'chained-platform': stat('chained-platform.glb', 6, 'floating rock platform hung on iron chains with a lantern (Dd5Bqt7vQ5T)'),
  chandelier: { ...stat('chandelier.glb', 1.6, 'iron ring chandelier of melting candles (Dd5Bqt7vQ5T, DeOemU1BOZF)'), tint: 0x2e2a28 },
  // The Sunken City (DeVj-Z8POjl).
  diver: { file: 'diver.glb', height: 1.9, label: 'figure in a brass diving helmet with a glowing porthole and a long dark robe (DeVj-Z8POjl)', clips: NPC_CLIPS('walk') },
  'drowned-house': stat('drowned-house.glb', 7, 'narrow half-timbered house with a slate roof and warm lit windows, under the sea (DeVj-Z8POjl)'),
  'blue-fish': { ...stat('blue-fish.glb', 1.4, 'big blue grouper swimming between the houses (DeVj-Z8POjl)'), tint: 0x3a5f8f },
  'jelly-lantern': stat('jelly-lantern.glb', 4.2, 'iron post with a hanging cage lantern holding a glowing jellyfish (DeVj-Z8POjl)'),
  'bottle-shelf': { ...stat('bottle-shelf.glb', 2.6, 'wooden shelves of glowing orange bottles (DeVj-Z8POjl)'), tint: 0x6a4a2c },
  'orb-lamp': { ...stat('orb-lamp.glb', 2.2, 'iron lamp stand with glowing red glass orbs (DeVj-Z8POjl)'), tint: 0x2e2a28 },
  'coin-table': { ...stat('coin-table.glb', 0.9, 'round wooden table heaped with gold coins (DeVj-Z8POjl)'), tint: 0x8a5a2a },
  chalice: { ...stat('chalice.glb', 0.5, 'barnacle-crusted stone chalice (DeVj-Z8POjl)'), tint: 0x7a6a5a },
  kelp: { ...stat('kelp.glb', 4, 'tall swaying kelp (DeVj-Z8POjl)'), tint: 0x1f5a4a },
};

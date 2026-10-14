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
  /** Rotate so the model faces +x in the game's yaw convention (radians about y). */
  yaw?: number;
  /** Lift so the feet sit on the ground. */
  yOffset?: number;
  clips?: Partial<Record<ClipName, string>>;
}

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
  vesper: { file: 'vesper.glb', height: 1.8, clips: { idle: 'idle', walk: 'walk', run: 'run', jump: 'jump', attack: 'slash', heavy: 'heavy', cast: 'cast', hit: 'hit', death: 'death' } },
  morrow: { file: 'morrow.glb', height: 1.95, clips: { idle: 'idle', walk: 'walk', run: 'run', jump: 'jump', attack: 'slash', heavy: 'heavy', cast: 'cast', hit: 'hit', death: 'death' } },
  ashka: { file: 'ashka.glb', height: 1.75, clips: { idle: 'idle', walk: 'walk', run: 'run', jump: 'jump', attack: 'cast', heavy: 'cast', cast: 'cast', hit: 'hit', death: 'death' } },
  // Bosses and mobs
  // Meshy animate exports bundle every added preset into one GLB; clip names are the preset's English ids.
  yeti: { file: 'yeti.glb', height: 5.2, clips: BOSS_CLIPS },
  shade: { file: 'horned-shade.glb', height: 7, clips: BOSS_CLIPS },
  warden: { file: 'antlered-warden.glb', height: 15, clips: BOSS_CLIPS },
  wyrm: { file: 'moon-wyrm.glb', height: 3, yOffset: 0, clips: { idle: 'fly|idle|hover', fly: 'fly|idle', attack: 'bite|attack' } },
  troll: { file: 'rock-troll.glb', height: 4.6, clips: BOSS_CLIPS },
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
  head: { file: 'giant-head.glb', height: 52 },
  cathedral: { file: 'cathedral.glb', height: 118 },
  castle: { file: 'castle.glb', height: 44 },
  church: { file: 'demon-church.glb', height: 36 },
  tower: { file: 'wizard-tower.glb', height: 100 },
  treehouse: { file: 'tree-house.glb', height: 48 },
};

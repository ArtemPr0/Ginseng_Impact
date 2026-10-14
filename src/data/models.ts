/**
 * Registry of real 3D assets. When a GLB exists at `public/models/<file>` the game uses it instead of the
 * procedural builder; when it is missing the procedural version stays. Generated with Meshy from reel frames.
 *
 * Clip names are matched case-insensitively and by substring, so "Idle", "idle_01" and "Armature|Idle" all work.
 */
export interface ModelDef {
  file: string;
  /** Height the model should be scaled to, metres. */
  height: number;
  /** Rotate so the model faces +x in the game's yaw convention (radians about y). */
  yaw?: number;
  /** Lift so the feet sit on the ground. */
  yOffset?: number;
  clips?: Partial<Record<'idle' | 'walk' | 'run' | 'jump' | 'attack' | 'heavy' | 'cast' | 'hit' | 'death' | 'sit' | 'kneel' | 'roar' | 'fly', string>>;
}

export const MODELS: Record<string, ModelDef> = {
  // Party
  vesper: { file: 'vesper.glb', height: 1.8, clips: { idle: 'idle', walk: 'walk', run: 'run', jump: 'jump', attack: 'slash', heavy: 'heavy', cast: 'cast', hit: 'hit', death: 'death' } },
  morrow: { file: 'morrow.glb', height: 1.95, clips: { idle: 'idle', walk: 'walk', run: 'run', jump: 'jump', attack: 'slash', heavy: 'heavy', cast: 'cast', hit: 'hit', death: 'death' } },
  ashka: { file: 'ashka.glb', height: 1.75, clips: { idle: 'idle', walk: 'walk', run: 'run', jump: 'jump', attack: 'cast', heavy: 'cast', cast: 'cast', hit: 'hit', death: 'death' } },
  // Bosses and mobs
  yeti: { file: 'yeti.glb', height: 5.2, clips: { idle: 'idle', walk: 'walk', attack: 'punch', roar: 'roar', hit: 'hit', death: 'death' } },
  shade: { file: 'horned-shade.glb', height: 7, clips: { idle: 'idle', walk: 'walk', attack: 'cast', hit: 'hit', death: 'death' } },
  warden: { file: 'antlered-warden.glb', height: 15, clips: { idle: 'idle', walk: 'walk', attack: 'punch', hit: 'hit', death: 'death' } },
  wyrm: { file: 'moon-wyrm.glb', height: 3, yOffset: 0, clips: { idle: 'fly', fly: 'fly', attack: 'bite' } },
  rivershade: { file: 'river-shade.glb', height: 5, clips: { idle: 'idle', walk: 'walk', attack: 'cast' } },
  passbeast: { file: 'fog-beast.glb', height: 3.8, clips: { idle: 'idle', walk: 'run', attack: 'bite' } },
  beast: { file: 'fog-beast.glb', height: 1.5, clips: { idle: 'idle', walk: 'run', attack: 'bite' } },
  sentinel: { file: 'stone-sentinel.glb', height: 2.6, clips: { idle: 'idle', walk: 'walk', attack: 'punch' } },
  wisp: { file: 'fog-wisp.glb', height: 1.4, clips: { idle: 'idle' } },
  croc: { file: 'crocodile.glb', height: 1.0, clips: { idle: 'idle', walk: 'walk', attack: 'bite' } },
  // NPCs and creatures
  frogking: { file: 'frog-king.glb', height: 6, clips: { idle: 'idle' } },
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

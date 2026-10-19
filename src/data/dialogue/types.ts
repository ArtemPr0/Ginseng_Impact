/**
 * The shapes of NPC dialogue content (src/data/dialogue/<district>.ts). Pure data: the Mind (src/game/Mind.ts)
 * selects lines from these by the world state; nothing here may import three.js or the DOM.
 */
import type { EventKind, Feat, HeroId, Zone } from '../../game/Events';

export type Tone = 'dry' | 'warm' | 'grim' | 'manic' | 'sleepy';

export interface Persona {
  /** The NPC id from NPC_DEFS (src/world/NPCs.ts). */
  id: string;
  /** Where they live: events here reach them at once. */
  district: Zone;
  /** Other places whose news reaches them as rumour after `rumourDelay` seconds. */
  knows: Zone[];
  rumourDelay: number;
  tone: Tone;
  /** The running gag, if any (a short note for writers; the lines carry it). */
  gag?: string;
  /** One sentence of who they are, for the journal and for consistency across districts. */
  about: string;
}

/** Flags the world state sets once the player has done the thing. */
export type Flag =
  | 'licked' | 'ale' | 'fountain' | 'skyeyes' | 'carriage' | 'bounce' | 'flew' | 'swam' | 'climbed' | 'equipped-mythic'
  | 'wiped' | 'hired' | 'sold' | 'bought' | 'chest' | 'levelup' | 'crit' | 'sip';

/**
 * When a line applies. Every present field must hold. `event`/`feat`/`enemy` look at the recent events the NPC can
 * know about (own district at once, `knows` districts after the rumour delay, bosses everywhere after a minute).
 */
export interface Cond {
  event?: EventKind;
  /** With event 'feat': which feat. */
  feat?: Feat;
  /** With event 'kill' or 'hurt': the enemy kind (ENEMY_DEFS key, e.g. 'beast', 'cyclops'). */
  enemy?: string;
  /** With event 'kill': only bosses (true) or only mobs (false). */
  boss?: boolean;
  /** The hero the player is using right now. */
  hero?: HeroId;
  /** A quest id and the stage (or stages) it must be in, e.g. ['throne', 'active'] or ['silence', ['five', 'open']]. */
  quest?: [string, string | string[]];
  flag?: Flag;
  notFlag?: Flag;
  /** How many times the player has talked to this NPC before this conversation (0 = first meeting). */
  metMin?: number;
  metMax?: number;
  minShards?: number;
  maxShards?: number;
  /** An item id the player carries (ITEMS key), or does not. */
  item?: string;
  notItem?: string;
  zoneIs?: Zone;
  /** A boss kind the player has slain (ever), or that is still alive. */
  bossSlain?: string;
  bossAlive?: string;
  /** [enemy kind, at least this many kills]. */
  kills?: [string, number];
  /** The player was hurt within this many seconds. */
  hurtWithin?: number;
  /** The player is at least this level. */
  level?: number;
  /** The player has at least this many companions following. */
  companions?: number;
}

export type Slot = 'greet' | 'react' | 'topic' | 'bye' | 'bark';

/**
 * Actions a choice can run (the Mind maps them to game code):
 * 'close' | 'trade' | 'hire' | 'home' (send a companion home) | 'quest:<id>:<stage>' (advance a quest; the Mind
 * validates the step) | 'pay:<n>' (the player pays n shards; fails softly when short) | 'give:<itemId>' (the NPC
 * gives an item) | 'take:<itemId>' (the NPC takes an item the player carries) | 'lick' | 'ale' | 'challenge' |
 * 'bag-croak' | 'follow' (the NPC walks with the player: the bride) | 'reward:<n>' (the NPC gives the player n
 * shards) | 'flag:<flag>' (sets a world flag) | 'journal:<text>' (adds a note to the journal).
 */
export type Action = string;

export interface Choice {
  label: string;
  /** The line id to continue with (same NPC), or nothing to end after `action`. */
  to?: string;
  action?: Action;
  /** The choice is shown only when this holds. */
  when?: Cond;
}

export interface LineDef {
  /** Unique within the NPC, stable (memory records what was said by id). */
  id: string;
  slot: Slot;
  /**
   * The words. Templates: {hero} (Sir Aldric / Wren / Orlan), {heroTitle}, {lastKill} (the last enemy's name),
   * {lastBoss}, {district} (where the player is), {shards}, {kills:<kind>} (count), {level}, {met} (times met).
   * Keep lines short: one or two sentences, under ~160 characters.
   */
  text: string;
  when?: Cond;
  /** Base weight (default 1); salience of a matching recent event is added for 'react' lines. */
  weight?: number;
  /** Said at most once ever. */
  once?: boolean;
  /** A VOICES id (src/data/voices.ts) to play with the line. */
  voice?: string;
  choices?: Choice[];
}

export interface NpcDialogue {
  persona: Persona;
  lines: LineDef[];
}

/** NPC id → its persona and lines. */
export type DialogueBook = Record<string, NpcDialogue>;

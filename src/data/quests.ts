/**
 * The quest graph of the main story, "The Silent Kingdom" (the Five Voices): every quest's stages in order, what each
 * stage asks of the player (the journal line, the map marker), what the game pays, gives, takes or charges on entering
 * a stage, and what moves a quest on by itself (a kill, an item picked up, a feat, the bosses slain, other quests'
 * stages). Pure data and pure functions: no three.js, no DOM, nothing wired (game/Quests.ts becomes graph-driven later).
 *
 * How the game is meant to use it:
 *  - A book's 'quest:<id>:<stage>' choice is a step from the stage the quest is at: `canStep(id, current, stage,
 *    stages)`; when it holds, apply `rewardFor(id, stage, current)` (charge first: a player short of shards fails the
 *    step softly and nothing changes), then set the stage and announce it on the bus. A step to the stage the quest is
 *    already at applies nothing and announces nothing: canStep allows one only into the last stage (the choice that
 *    finished a quest, clicked twice or taken again from a line left open) and for the lick's waking, `rewardFor` with
 *    that `from` is undefined, and there is no stage to set. The books never pay; this graph pays, exactly once, on
 *    entering a stage, as each book's QUEST GRAPH EXPECTATIONS header says.
 *  - Every event goes through `triggersFor(e, stages, bossesSlain, slain)`; each step it returns is applied the same
 *    way (no reward when `unpaid`) if its quest is still at `from`. Each step announces a 'quest' event, which goes
 *    through `triggersFor` again: that is how chains settle (three bosses slain before Corvin asks: asked, then worthy).
 *  - The steps no talk or trigger takes are the game's own, validated like any other: croak active→bagged ('bag-croak')
 *    and bagged→returned (the sack put down by his father; anywhere else: bagged→active, Croak climbs out), trip
 *    none→done (waking from the dream), bride walking→done (she reaches the shore). Entering silence 'open' wakes the
 *    Hollow King (`wakes`); silence 'ended' starts the Ending.
 *
 * Where this departs from a book header, on purpose:
 *  - silence told→five waits for the five voices (FIVE_VOICES: the stage each voice is earned at), not for every
 *    king's quest to be 'done' (island-a): the Stone Head hears the voices on you ("I hear them in you"), so the
 *    cyclops's death can send you straight back to the head, the kings' purses left for later.
 *  - The two voices won by a kill are handed over by the graph as the kill registers (trip 'god': the Third Eye,
 *    grave 'slain': the Grave Crown), once; island-a and kingdom have them drop. The Grave Cyclops has no crown in its
 *    drops (and a respawning boss would drop a key item every time); the Frog God drops a Third Eye on every kill
 *    (data/enemies.ts), so that drop should go when this is wired, or the first kill hands out two.
 *  - The voices that are picked up (the Lost Sound, the Drowned Bell) are not given here: the pickup puts the item in
 *    the bag and is what moves the quest ('item' trigger on its 'loot' event), so 'found' pays nothing.
 *  - lean none→active gives no 'lean-cup' (realms names one): it is a model, not an item, no line checks for it, and
 *    the kingdom book has Yung Lean sign through the sound quest ('signed-cup' on sound 'done').
 *  - bride walking→done is the game's step when she reaches the shore, with `requires` bell 'found'; a 'stages'
 *    trigger would end her walk the moment it starts, since the book offers 'follow' only once the bell is done.
 */
import type { GameEvent, Zone } from '../game/Events';
import { ENEMY_SPAWNS } from './enemies';
import { ANCHORS, LAYOUT, TREEHOUSE_ROOM } from './world';

export type QuestId = 'silence' | 'throne' | 'croak' | 'trip' | 'crown' | 'lean' | 'sound' | 'bell' | 'grave' | 'penny' | 'books' | 'rose' | 'bride';

/** A spot for the minimap and the journal: world metres in `zone`. */
export interface Marker { x: number; z: number; zone: Zone }

/**
 * What entering a stage costs and pays, applied in this order: `charge` (the player pays it; when short, the step
 * fails softly and nothing changes), `take` (items handed over), `give` (items received), `shards` (paid to the player).
 */
export interface Reward { shards?: number; give?: string[]; take?: string[]; charge?: number }

export interface StageDef {
  /** The journal line: short, dry, Cinzel-friendly (letters and plain punctuation, no digits), under 90 characters. */
  objective: string;
  /** Where to go next. Every stage between 'none' and the last has one; on 'none' it is whoever gives the quest. */
  marker?: Marker;
  /** Paid once, on entering the stage from another stage (never on a step to the stage the quest is already at). */
  reward?: Reward;
  /**
   * The quest's last stage. Entering it again is a harmless no-op: canStep allows it, `rewardFor(id, stage, stage)` is
   * undefined and the header's recipe sets and announces nothing, so nothing is paid twice.
   */
  terminal?: boolean;
  /** Entering this stage also needs these quests at least at these stages (canStep checks them when given the stages). */
  requires?: Array<[QuestId, string]>;
  /** An ENEMY_DEFS kind that lies dormant until this stage is reached; the game wakes it then. */
  wakes?: string;
}

/**
 * What moves a quest from `from` to `to` without a talk:
 *  - kill: an enemy of that kind dies (a 'kill' event); `past` also counts a kill made before the quest reached
 *    `from` (the kill log, as Quests.start did: the Warden slain before the King asked);
 *  - bosses: at least that many different bosses slain (checked on every event);
 *  - item: the player picks that item up (a 'loot' event);
 *  - stages: every listed quest at least at its stage (checked on every event);
 *  - feat: a 'feat' event with that `what` (the lick; 'follow', the books' action for the Pale Bride).
 * `unpaid` skips the target stage's reward on this step (the lick: the dream is the Frog King's thanks, the 400 is for
 * the shards choice).
 */
export type Trigger = (
  | { on: 'kill'; enemy: string; from: string; to: string; past?: true }
  | { on: 'bosses'; atLeast: number; from: string; to: string }
  | { on: 'item'; item: string; from: string; to: string }
  | { on: 'stages'; all: Array<[QuestId, string]>; from: string; to: string }
  | { on: 'feat'; what: string; from: string; to: string }
) & { unpaid?: true };

export interface QuestNode {
  id: QuestId;
  title: string;
  kind: 'main' | 'side';
  /** Stage names in order, starting with 'none' (not given yet); the last one is the terminal stage. */
  order: string[];
  stages: Record<string, StageDef>;
  triggers: Trigger[];
  /** Steps outside the order that may be taken again and again, written `edge(from, to)`: the lick's 'done→done'. */
  repeatable?: string[];
  /** Steps past a stage that the books or the game take on purpose, written `edge(from, to)`. */
  shortcuts?: string[];
  /** The voice this quest earns (FIVE_VOICES has the stage it is earned at). */
  voice?: { item: string; label: string };
}

/** A step as `repeatable` and `shortcuts` write it. */
export const edge = (from: string, to: string): string => `${from}→${to}`;

/**
 * The five voices the Hollow King swallowed, in the order the Stone Head names the kings, each with the stage it is
 * earned at: the Antlered Signet (the King pays it out), the Third Eye (the Frog God's), the Lost Sound (picked up
 * in the mist), the Drowned Bell (picked up in the lane), the Grave Crown (off the Grave Cyclops).
 */
export const FIVE_VOICES: ReadonlyArray<{ quest: QuestId; stage: string; item: string; label: string }> = [
  { quest: 'throne', stage: 'done', item: 'antler-signet', label: 'the Antlered Signet' },
  { quest: 'trip', stage: 'god', item: 'third-eye', label: 'the Third Eye' },
  { quest: 'sound', stage: 'found', item: 'lost-sound', label: 'the Lost Sound' },
  { quest: 'bell', stage: 'found', item: 'drowned-bell', label: 'the Drowned Bell' },
  { quest: 'grave', stage: 'slain', item: 'grave-crown', label: 'the Grave Crown' },
];

function voiceOf(quest: QuestId): { item: string; label: string } | undefined {
  const v = FIVE_VOICES.find((f) => f.quest === quest);
  return v && { item: v.item, label: v.label };
}

// ----- Where things are (data/world.ts and data/enemies.ts, read once at load) -----

type XZ = { x: number; z: number };
const mark = (p: XZ, zone: Zone): Marker => ({ x: p.x, z: p.z, zone });
/** An NPC's home spot (ANCHORS); the origin if it is missing, which the marker test catches. */
const anchor = (id: string): XZ => (Object.hasOwn(ANCHORS, id) ? ANCHORS[id] : { x: 0, z: 0 });
/** Where an enemy kind is placed (ENEMY_SPAWNS); the origin if it is missing, which the marker test catches. */
const spawn = (kind: string): XZ => ENEMY_SPAWNS.find((s) => s.kind === kind) ?? { x: 0, z: 0 };

const AT = {
  head: mark(LAYOUT.head, 'island'),
  king: mark(anchor('king'), 'island'),
  warden: mark(spawn('warden'), 'island'),
  frogKing: mark(LAYOUT.frog, 'island'),
  croak: mark(anchor('croak'), 'island'),
  hollowKing: mark(spawn('hollowking'), 'island'),
  corvin: mark(anchor('rose-knight'), 'island'),
  elowen: mark(anchor('maiden'), 'island'),
  /** The first point of the Pale Bride's loop across the desert (world/NPCs.ts). */
  bride: mark({ x: 40, z: 60 }, 'island'),
  /** Where the desert's sand meets the south-east cliff: the shore she walks to (sand and land both ~1 here). */
  shore: mark({ x: 56, z: 68 }, 'island'),
  frogGod: mark(spawn('dmt-entity'), 'dream'),
  yungLean: mark(anchor('yunglean'), 'galaxy'),
  /** The far lean cup where the lost sound hums in the mist (world/Kingdom.ts soundAt). */
  farCup: mark({ x: 1136, z: 14 }, 'galaxy'),
  skeletonKing: mark(anchor('skeleton-king'), 'galaxy'),
  glintgrin: mark(TREEHOUSE_ROOM, 'treehouse'),
  fishKing: mark(anchor('fish-king'), 'sunken'),
  /** The lane behind the Fish King's throne, past his two anglers (data/enemies.ts), where the bell glows. */
  bellLane: mark({ x: -1000, z: -92 }, 'sunken'),
  graveCyclops: mark(spawn('cyclops-lord'), 'graveyard'),
  penny: mark(anchor('vale-beggar'), 'vale'),
  reader: mark(anchor('dragon-reader'), 'vale'),
  rattlebones: mark(anchor('crypt-red'), 'crypt-room'),
} as const;

// ----- The graph -----

export const QUEST_GRAPH: Record<QuestId, QuestNode> = {
  silence: {
    id: 'silence', title: 'The Silent Kingdom', kind: 'main',
    order: ['none', 'told', 'five', 'open', 'ended'],
    stages: {
      none: { objective: 'The Stone Head on the north shore has been waiting for someone to ask.', marker: AT.head },
      told: { objective: 'Earn a voice from each of the five kings. Begin with the Antlered King.', marker: AT.king },
      five: { objective: 'Five voices. Take them to the Stone Head on the north shore.', marker: AT.head },
      open: { objective: 'The Hollow King is awake on the shore east of the Stone Head. End him.', marker: AT.hollowKing, wakes: 'hollowking' },
      ended: { objective: 'The kingdom has its voices back. It has not stopped talking since.', terminal: true },
    },
    triggers: [
      { on: 'stages', all: FIVE_VOICES.map((v): [QuestId, string] => [v.quest, v.stage]), from: 'told', to: 'five' },
      { on: 'kill', enemy: 'hollowking', from: 'open', to: 'ended' },
    ],
  },
  throne: {
    id: 'throne', title: 'The Usurped Throne', kind: 'main',
    order: ['none', 'active', 'slain', 'done'],
    stages: {
      none: { objective: 'The Antlered King sits outside a castle he lost. He is hiring.', marker: AT.king },
      active: { objective: 'Slay the Antlered Warden in the east forest, under the rain.', marker: AT.warden },
      slain: { objective: 'Return to the Antlered King on his throne.', marker: AT.king },
      done: { objective: 'The Warden is dead and the King paid, generously, as he keeps saying.', terminal: true, reward: { shards: 1500, give: ['antler-signet'] } },
    },
    triggers: [{ on: 'kill', enemy: 'warden', from: 'active', to: 'slain', past: true }],
    voice: voiceOf('throne'),
  },
  croak: {
    id: 'croak', title: 'The Prodigal Croak', kind: 'main',
    order: ['none', 'active', 'bagged', 'returned', 'done'],
    stages: {
      none: { objective: 'The Frog King has lost his son again. He is in the hollow, worrying.', marker: AT.frogKing },
      active: { objective: "Find Croak, the Frog King's son. He likes the castle's shade.", marker: AT.croak },
      bagged: { objective: 'Carry Croak home to the Frog King and put the sack down by him.', marker: AT.frogKing },
      returned: { objective: 'Speak with the Frog King.', marker: AT.frogKing },
      // 400 for 'No, you must be sick or something' (the book's only quest:croak:done); the lick pays nothing.
      done: { objective: 'Croak is home. He has made peace with the sack, not with you.', terminal: true, reward: { shards: 400 } },
    },
    triggers: [
      // 'Uhh... sure' leads to '*lick*' while Croak is 'returned': done as the lick starts, without the shards.
      { on: 'feat', what: 'lick', from: 'returned', to: 'done', unpaid: true },
    ],
    // The sack put down away from his father: Croak climbs out, to be bagged again.
    repeatable: [edge('bagged', 'active')],
  },
  trip: {
    id: 'trip', title: "The Frog King's Dream", kind: 'main',
    order: ['none', 'done', 'god'],
    stages: {
      none: { objective: 'The Frog King offers a lick, as a sign of respect. Nobody has to.', marker: AT.frogKing },
      done: { objective: "A god waits in the Frog King's dream. Lick him again and slay it.", marker: AT.frogGod },
      god: { objective: 'The Frog God is dead. Its third eye is yours, and it still blinks.', terminal: true, reward: { give: ['third-eye'] } },
    },
    triggers: [
      { on: 'kill', enemy: 'dmt-entity', from: 'done', to: 'god' },
      // Slain on the first trip, before waking set 'done'.
      { on: 'kill', enemy: 'dmt-entity', from: 'none', to: 'god' },
    ],
    // Every lick ends in waking, which sets 'done' again; after the god it is refused (no way back from 'god').
    repeatable: [edge('done', 'done')],
    shortcuts: [edge('none', 'god')],
    voice: voiceOf('trip'),
  },
  sound: {
    id: 'sound', title: 'The Lost Sound', kind: 'main',
    order: ['none', 'active', 'found', 'done'],
    stages: {
      none: { objective: 'Yung Lean says the kingdom is going quiet. He sits on a porcelain throne.', marker: AT.yungLean },
      active: { objective: "Follow the blade's hum into the mist over the far cup, east of the plaza.", marker: AT.farCup, reward: { give: ['mist-blade'] } },
      found: { objective: 'Bring the lost sound back to Yung Lean.', marker: AT.yungLean },
      // The hero keeps the sound ("A sound kept is a sound shared"): nothing is taken.
      done: { objective: 'The snow is singing again. Yung Lean let you keep the sound.', terminal: true, reward: { shards: 800, give: ['signed-cup'] } },
    },
    triggers: [{ on: 'item', item: 'lost-sound', from: 'active', to: 'found' }],
    voice: voiceOf('sound'),
  },
  bell: {
    id: 'bell', title: 'The Drowned Bell', kind: 'main',
    order: ['none', 'active', 'found', 'done'],
    stages: {
      none: { objective: "The Fish King, under the lake, misses his city's voice.", marker: AT.fishKing },
      active: { objective: "Find the Drowned Bell in the lane behind the Fish King's throne.", marker: AT.bellLane },
      found: { objective: 'Show the Fish King his bell.', marker: AT.fishKing },
      // The hero keeps the bell.
      done: { objective: 'The Fish King let you keep the bell. The jellyfish have gone quiet.', terminal: true, reward: { shards: 700 } },
    },
    triggers: [{ on: 'item', item: 'drowned-bell', from: 'active', to: 'found' }],
    voice: voiceOf('bell'),
  },
  grave: {
    id: 'grave', title: 'The Grave Crown', kind: 'main',
    order: ['none', 'active', 'slain', 'done'],
    stages: {
      none: { objective: 'The Skeleton King wants his old crown back, off a cyclops.', marker: AT.skeletonKing },
      active: { objective: 'Slay the Grave Cyclops at the end of the Alley of Graves.', marker: AT.graveCyclops },
      // The crown stays with the hero ("Keep it; two crowns on one skull looks desperate").
      slain: { objective: "The crown is yours. Collect the Skeleton King's nine hundred.", marker: AT.skeletonKing, reward: { give: ['grave-crown'] } },
      done: { objective: 'Nine hundred shards, counted twice. The crown stays on your head.', terminal: true, reward: { shards: 900 } },
    },
    triggers: [{ on: 'kill', enemy: 'cyclops-lord', from: 'active', to: 'slain', past: true }],
    voice: voiceOf('grave'),
  },
  crown: {
    id: 'crown', title: 'Challenge the King', kind: 'side',
    order: ['none', 'done'],
    stages: {
      none: { objective: 'Yung Lean will get up off his throne if you ask him twice.', marker: AT.yungLean },
      // The purse is for the first win; the 'challenge' choice stays open and later wins pay nothing.
      done: { objective: 'Yung Lean beaten. He sat back down. The purse was for the first time.', terminal: true, reward: { shards: 600 } },
    },
    // He fights as the 'rift-king' boss, spawned only by the challenge.
    triggers: [{ on: 'kill', enemy: 'rift-king', from: 'none', to: 'done' }],
  },
  lean: {
    id: 'lean', title: 'Find Yung Lean', kind: 'side',
    order: ['none', 'active', 'signed', 'done'],
    stages: {
      none: { objective: 'Glintgrin, in the tree house, wants something for his brother.', marker: AT.glintgrin },
      active: { objective: 'Find Yung Lean beyond the galaxy portal and get a cup signed.', marker: AT.yungLean },
      signed: { objective: 'Bring the signed cup to Glintgrin in the tree house.', marker: AT.glintgrin },
      done: { objective: 'Glintgrin has his cup. Goldgrin still asks where Young Lean is.', terminal: true, reward: { shards: 1000, take: ['signed-cup'] } },
    },
    triggers: [],
    // Glintgrin takes the signed cup at 'active' too, when the hero walks in with it ('Hand over the cup').
    shortcuts: [edge('active', 'done')],
  },
  penny: {
    id: 'penny', title: "Old Penny's Secrets", kind: 'side',
    order: ['none', 'secret', 'done'],
    stages: {
      none: { objective: "Old Penny on the Vale's street sells a secret for twenty shards.", marker: AT.penny },
      secret: { objective: 'Old Penny has one more secret. It costs forty, and she likes regulars.', marker: AT.penny, reward: { charge: 20 } },
      done: { objective: "Old Penny told you everything, and gave you the dragon's charm.", terminal: true, reward: { charge: 40, give: ['lunar-charm'] } },
    },
    triggers: [],
  },
  books: {
    id: 'books', title: 'A Book for a Dragon', kind: 'side',
    order: ['none', 'active', 'done'],
    stages: {
      none: { objective: "Rattlebones in the Crypt Bar owns a ledger. The Vale's dragon needs a book.", marker: AT.rattlebones },
      active: { objective: "Give the Old Ledger to the Dragon's Reader in the Vale.", marker: AT.reader, reward: { charge: 60, give: ['old-ledger'] } },
      // No item back: the floating castle's falls brighten.
      done: { objective: "Verdigris sleeps on a century of debts. The castle's falls are brighter.", terminal: true, reward: { take: ['old-ledger'] } },
    },
    triggers: [],
  },
  rose: {
    id: 'rose', title: "Sir Corvin's Rose", kind: 'side',
    order: ['none', 'asked', 'worthy', 'answered'],
    stages: {
      none: { objective: 'Sir Corvin has held out a rose to Elowen for a very long time.', marker: AT.corvin },
      asked: { objective: 'Slay three of the great ones. Elowen is counting.', marker: AT.elowen },
      worthy: { objective: 'Tell Elowen what you have slain.', marker: AT.elowen },
      // Nothing to pay: the garden's 'answered' lines are the reward.
      answered: { objective: 'She said yes. He is still holding the rose.', terminal: true },
    },
    triggers: [{ on: 'bosses', atLeast: 3, from: 'asked', to: 'worthy' }],
  },
  bride: {
    id: 'bride', title: 'Where the Sand Ends', kind: 'side',
    order: ['none', 'walking', 'done'],
    stages: {
      none: { objective: 'The Pale Bride walks the desert, listening for bells.', marker: AT.bride },
      walking: { objective: 'Walk the Pale Bride to where the sand ends, south-east of the desert.', marker: AT.shore },
      // The game's step when she reaches the shore; she hears the bells only once the bell is out of the lane.
      done: { objective: 'The sand ended. He was not there. The bells were.', terminal: true, requires: [['bell', 'found']] },
    },
    // 'Walk with me.' runs the books' 'follow' action (offered once the bell is done).
    triggers: [{ on: 'feat', what: 'follow', from: 'none', to: 'walking' }],
  },
};

/** Every quest, in the graph's (and the journal's) order. */
export const QUEST_ORDER: readonly QuestId[] = Object.keys(QUEST_GRAPH) as QuestId[];

// ----- Reading the graph -----

/** The node for `id`, or undefined for a name that is not a quest (only the graph's own keys count). */
export function questNode(id: string): QuestNode | undefined {
  return Object.hasOwn(QUEST_GRAPH, id) ? QUEST_GRAPH[id as QuestId] : undefined;
}

/** The stage `id` is at in a stages record (a Quests snapshot): 'none' when it is missing. */
export function stageOf(stages: Record<string, string>, id: string): string {
  return Object.hasOwn(stages, id) && typeof stages[id] === 'string' ? stages[id] : 'none';
}

/** Where `stage` comes in quest `id`'s order (0 for 'none'), or -1 when either is unknown. */
export function stageIndex(id: string, stage: string): number {
  return questNode(id)?.order.indexOf(stage) ?? -1;
}

/** Whether quest `id` is at `stage` or past it (false when either is unknown, or its current stage is). */
export function isAtLeast(stages: Record<string, string>, id: string, stage: string): boolean {
  const want = stageIndex(id, stage);
  return want >= 0 && stageIndex(id, stageOf(stages, id)) >= want;
}

/** Whether `stages` meets what entering `def` requires. */
function meets(def: StageDef, stages: Record<string, string>): boolean {
  return (def.requires ?? []).every(([q, s]) => isAtLeast(stages, q, s));
}

/**
 * Whether quest `id` may go from `from` to `to`: the next stage in its order, a listed `repeatable` or `shortcuts`
 * step, or the terminal stage entered again (the choice that finished the quest, clicked twice or taken again from a
 * line left open: a no-op, which `rewardFor(id, to, from)` pays nothing for). Never backwards or past a stage
 * otherwise. Given the current `stages`, the target's `requires` must hold too (not on a re-entry).
 */
export function canStep(id: string, from: string, to: string, stages?: Record<string, string>): boolean {
  const node = questNode(id);
  if (!node) return false;
  const i = node.order.indexOf(from);
  const j = node.order.indexOf(to);
  if (i < 0 || j < 0) return false;
  const e = edge(from, to);
  const listed = (node.repeatable ?? []).includes(e) || (node.shortcuts ?? []).includes(e);
  if (!(j === i + 1 || listed || (i === j && node.stages[to].terminal === true))) return false;
  return i === j || stages === undefined || meets(node.stages[to], stages);
}

/**
 * What entering stage `to` of quest `id` costs and pays (undefined: nothing, or no such stage). Given `from`, the stage
 * the quest is at, a step to the stage it is already at pays nothing (a terminal re-entry, the lick's done→done): that
 * stage was paid for when it was first entered. The game passes `from` (the header's recipe); without it, this is the
 * stage's own reward, as the reward table reads it.
 */
export function rewardFor(id: string, to: string, from?: string): Reward | undefined {
  if (from === to) return undefined;
  const node = questNode(id);
  return node && node.order.includes(to) ? node.stages[to].reward : undefined;
}

/** A step a trigger takes: apply it when the quest is still at `from`; `unpaid` skips the stage's reward. */
export interface TriggeredStep { id: QuestId; from: string; to: string; unpaid?: true }

function fires(t: Trigger, e: GameEvent, stages: Record<string, string>, bossesSlain: number, slain: ReadonlySet<string>): boolean {
  switch (t.on) {
    case 'kill': return (e.kind === 'kill' && e.enemy === t.enemy) || (t.past === true && slain.has(t.enemy));
    case 'item': return e.kind === 'loot' && e.item === t.item;
    case 'feat': return e.kind === 'feat' && e.what === t.what;
    case 'bosses': return bossesSlain >= t.atLeast;
    case 'stages': return t.all.every(([q, s]) => isAtLeast(stages, q, s));
  }
}

/**
 * The steps event `e` causes, given every quest's current stage, how many different bosses have been slain
 * (WorldState.bossesSlain's kinds) and the kinds ever killed (the kill log, for `past` kill triggers). At most one step
 * per quest, from the stage it is at; 'stages' and 'bosses' triggers hold on any event once their state does. Pure:
 * nothing is applied here.
 */
export function triggersFor(e: GameEvent, stages: Record<string, string>, bossesSlain: number, slain: Iterable<string> = []): TriggeredStep[] {
  const log = new Set(slain);
  const out: TriggeredStep[] = [];
  for (const id of QUEST_ORDER) {
    const node = QUEST_GRAPH[id];
    const at = stageOf(stages, id);
    const t = node.triggers.find((tr) => tr.from === at && fires(tr, e, stages, bossesSlain, log) && meets(node.stages[tr.to], stages));
    if (t) out.push(t.unpaid ? { id, from: at, to: t.to, unpaid: true } : { id, from: at, to: t.to });
  }
  return out;
}

/** The voice items earned so far (FIVE_VOICES whose quest has reached the voice's stage), in the Stone Head's order. */
export function voicesHeld(stages: Record<string, string>): string[] {
  return FIVE_VOICES.filter((v) => isAtLeast(stages, v.quest, v.stage)).map((v) => v.item);
}

export interface JournalEntry { id: QuestId; title: string; kind: 'main' | 'side'; objective: string; done: boolean; marker?: Marker }

/**
 * The journal: every quest that has been given (not 'none', and at a stage the graph knows), with its current
 * objective; the main story first, then the side quests; within each, those in progress before those done. Markers
 * only on quests in progress.
 */
export function journal(stages: Record<string, string>): JournalEntry[] {
  const out: JournalEntry[] = [];
  for (const id of QUEST_ORDER) {
    const node = QUEST_GRAPH[id];
    const stage = stageOf(stages, id);
    if (stage === 'none' || !node.order.includes(stage)) continue;
    const def = node.stages[stage];
    const done = def.terminal === true;
    const entry: JournalEntry = { id, title: node.title, kind: node.kind, objective: def.objective, done };
    if (!done && def.marker) entry.marker = def.marker;
    out.push(entry);
  }
  const rank = (j: JournalEntry) => (j.kind === 'main' ? 0 : 2) + (j.done ? 1 : 0);
  return out.map((j, i) => ({ j, i })).sort((a, b) => rank(a.j) - rank(b.j) || a.i - b.i).map(({ j }) => j);
}

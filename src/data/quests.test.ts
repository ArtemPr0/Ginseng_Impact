/**
 * The quest graph (data/quests.ts) against the dialogue books, the item and enemy tables and the world: every stage a
 * book names exists and every step a book takes is one the graph allows; the rewards are the books' headers, paid once
 * (never again for a step to the stage a quest is at); the main story can be finished through every stage of every main
 * quest; the triggers fire when they should, and only then.
 */
import { describe, expect, it } from 'vitest';
import type { Feat, GameEvent, Zone } from '../game/Events';
import { parseAction } from '../game/actions';
import { itemDef } from '../items/Items';
import { DIALOGUE, QUEST_IDS } from './dialogue/index';
import type { Cond } from './dialogue/types';
import { ENEMY_DEFS } from './enemies';
import {
  FIVE_VOICES, QUEST_GRAPH, QUEST_ORDER, canStep, edge, isAtLeast, journal, rewardFor, stageIndex, triggersFor, voicesHeld,
  type QuestId, type QuestNode, type Reward,
} from './quests';
import { REALMS } from './world';

/** Keyed by the type, so the compiler insists on every member and allows no other. */
const ZONES: Record<Zone, true> = {
  island: true, galaxy: true, sunken: true, treehouse: true, dream: true, graveyard: true, vale: true, 'tavern-room': true, 'crypt-room': true,
};
const FEATS: Record<Feat, true> = {
  lick: true, ale: true, fountain: true, skyeye: true, carriage: true, bounce: true, fly: true, swim: true, dodge: true, crit: true,
  climb: true, attack: true, chest: true, levelup: true, sip: true,
};
/** The books' plain actions a feat trigger may name besides the Feats (announced as a feat once wired). */
const ACTION_FEATS = new Set(['follow']);
/** The steps outside the order the graph allows on purpose (each one explained in quests.ts). */
const OFF_ORDER = new Set(['croak:bagged→active', 'trip:done→done', 'trip:none→god', 'lean:active→done']);

const has = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);
const isEnemy = (kind: string): boolean => has(ENEMY_DEFS, kind);
const nodes = Object.values(QUEST_GRAPH);

/** Which zone (x, z) is in, the way main.ts decides it: inside a realm's radius, else the island. */
function zoneOf(x: number, z: number): Zone {
  return (REALMS.find((r) => Math.hypot(x - r.x, z - r.z) < r.radius)?.id as Zone | undefined) ?? 'island';
}

const kill = (enemy: string): GameEvent => ({ kind: 'kill', enemy, boss: isEnemy(enemy) && ENEMY_DEFS[enemy as keyof typeof ENEMY_DEFS].boss === true, at: { x: 0, y: 0, z: 0 } });
const loot = (item: string): GameEvent => ({ kind: 'loot', item, rarity: itemDef(item)?.rarity ?? 1 });
/** A feat event; 'follow' is not a Feat yet (the books' action for the Pale Bride), hence the cast. */
const feat = (what: string): GameEvent => ({ kind: 'feat', what: what as Feat });
const HURT: GameEvent = { kind: 'hurt', amount: 10, by: 'beast' };

/** The quest stages a condition gates on for quest `id` (null: it does not look at that quest). */
function gate(c: Cond | undefined, id: string): string[] | null {
  if (!c?.quest || c.quest[0] !== id) return null;
  return Array.isArray(c.quest[1]) ? c.quest[1] : [c.quest[1]];
}

/** Every (quest, stage) a book names: in a line's or a choice's condition, or as a choice's 'quest:<id>:<stage>'. */
function bookReferences(): Array<{ at: string; id: string; stage: string }> {
  const out: Array<{ at: string; id: string; stage: string }> = [];
  for (const [npc, book] of Object.entries(DIALOGUE)) {
    for (const line of book.lines) {
      const conds: Array<[string, Cond | undefined]> = [[line.id, line.when], ...(line.choices ?? []).map((c): [string, Cond | undefined] => [`${line.id} '${c.label}'`, c.when])];
      for (const [at, c] of conds) {
        if (!c?.quest) continue;
        for (const stage of gate(c, c.quest[0]) ?? []) out.push({ at: `${npc}/${at}`, id: c.quest[0], stage });
      }
      for (const c of line.choices ?? []) {
        const a = c.action === undefined ? null : parseAction(c.action);
        if (a?.kind === 'quest') out.push({ at: `${npc}/${line.id} '${c.label}' (action)`, id: a.id, stage: a.stage });
      }
    }
  }
  return out;
}

/**
 * A small game around the graph: the stages, the bosses slain and the kill log; every step taken the way quests.ts's
 * header says the game will: validated by canStep (with the stages), its reward noted as rewardFor gives it for that
 * step (none when the step is unpaid, and the graph's own none for a step to the stage the quest is at), then, unless
 * the quest is there already, the stage set and announced as a 'quest' event that goes through the triggers again.
 */
class Game {
  readonly stages: Record<string, string> = {};
  readonly bosses = new Set<string>();
  readonly killed = new Set<string>();
  /** 'quest:stage' of every step whose reward was paid. */
  readonly paid: string[] = [];
  /** 'quest:stage' of every step a trigger took. */
  readonly triggered: string[] = [];
  /** Every stage entered, in order. */
  private readonly entered: Array<[QuestId, string]> = [];

  /** The stages quest `id` has been at, in order, from 'none'. */
  visited(id: QuestId): string[] {
    return ['none', ...this.entered.filter(([q]) => q === id).map(([, s]) => s)];
  }

  /** A talk or one of the game's own steps: always the next stage in the order. */
  talk(id: QuestId, to: string): void {
    const from = this.stages[id] ?? 'none';
    expect(stageIndex(id, to), `${id}: ${from}→${to} by talk is not the next stage`).toBe(stageIndex(id, from) + 1);
    this.step(id, to, false);
  }

  /** Tries a step; false (and nothing changes) when the graph refuses it. */
  attempt(id: QuestId, to: string): boolean {
    if (!canStep(id, this.stages[id] ?? 'none', to, this.stages)) return false;
    this.step(id, to, false);
    return true;
  }

  private step(id: QuestId, to: string, unpaid: boolean): void {
    const from = this.stages[id] ?? 'none';
    expect(canStep(id, from, to, this.stages), `${id}: ${from}→${to}`).toBe(true);
    if (!unpaid && rewardFor(id, to, from)) this.paid.push(`${id}:${to}`);
    if (from === to) return; // there already: no stage to set, nothing to announce
    this.stages[id] = to;
    this.entered.push([id, to]);
    this.emit({ kind: 'quest', id, stage: to });
  }

  emit(e: GameEvent): void {
    if (e.kind === 'kill') { this.killed.add(e.enemy); if (e.boss) this.bosses.add(e.enemy); }
    for (const t of triggersFor(e, this.stages, this.bosses.size, this.killed)) {
      if ((this.stages[t.id] ?? 'none') !== t.from) continue;
      this.triggered.push(`${t.id}:${t.to}`);
      this.step(t.id, t.to, t.unpaid === true);
    }
  }
}

interface Purse { shards: number; bag: string[] }

/**
 * A step exactly as quests.ts's header writes the recipe, on a purse and a bag, with no re-entry check of its own:
 * canStep; then rewardFor with the stage the quest is at (the charge first, failing softly when short; then take, give,
 * shards); then the stage. False when the step fails.
 */
function recipe(stages: Record<string, string>, purse: Purse, id: QuestId, to: string): boolean {
  const from = stages[id] ?? 'none';
  if (!canStep(id, from, to, stages)) return false;
  const r = rewardFor(id, to, from);
  if ((r?.charge ?? 0) > purse.shards) return false;
  purse.shards -= r?.charge ?? 0;
  for (const item of r?.take ?? []) { const k = purse.bag.indexOf(item); if (k >= 0) purse.bag.splice(k, 1); }
  purse.bag.push(...(r?.give ?? []));
  purse.shards += r?.shards ?? 0;
  stages[id] = to;
  return true;
}

/** A quest's last stage. */
const lastOf = (q: QuestNode): string => q.order[q.order.length - 1];

describe('quest graph: shape', () => {
  it('has exactly the quests the dialogue books know (QUEST_IDS), each under its own id', () => {
    expect([...QUEST_ORDER].sort()).toEqual([...QUEST_IDS].sort());
    for (const id of QUEST_ORDER) expect(QUEST_GRAPH[id].id).toBe(id);
  });

  it("lays out every quest: 'none' first, one stage definition per stage, only the last terminal", () => {
    const problems: string[] = [];
    for (const q of nodes) {
      if (q.order[0] !== 'none') problems.push(`${q.id}: the order starts with '${q.order[0]}'`);
      if (new Set(q.order).size !== q.order.length) problems.push(`${q.id}: a stage is named twice`);
      if ([...q.order].sort().join() !== Object.keys(q.stages).sort().join()) problems.push(`${q.id}: the stages are not the order's`);
      q.order.forEach((s, i) => {
        const last = i === q.order.length - 1;
        if ((q.stages[s]?.terminal === true) !== last) problems.push(`${q.id}.${s}: terminal is ${q.stages[s]?.terminal}, the last stage is '${q.order.at(-1)}'`);
      });
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('writes every objective short and Cinzel-friendly: letters and plain punctuation, under 90 characters', () => {
    const problems: string[] = [];
    for (const q of nodes) {
      if (!q.title.trim()) problems.push(`${q.id}: no title`);
      for (const [s, def] of Object.entries(q.stages)) {
        const o = def.objective;
        if (!o.trim() || o.length >= 90) problems.push(`${q.id}.${s}: ${o.length} characters`);
        if (!/^[A-Za-z ,.';:?!-]+$/.test(o)) problems.push(`${q.id}.${s}: "${o}" has characters Cinzel may not carry`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('marks every stage in progress, in the zone its spot is in, and no finished one', () => {
    const problems: string[] = [];
    for (const q of nodes) {
      for (const [s, def] of Object.entries(q.stages)) {
        const inProgress = s !== 'none' && !def.terminal;
        if (inProgress && !def.marker) problems.push(`${q.id}.${s}: no marker`);
        if (def.terminal && def.marker) problems.push(`${q.id}.${s}: a finished quest has a marker`);
        const m = def.marker;
        if (!m) continue;
        // The origin is where a marker lands when its NPC or spawn has gone missing from the world tables.
        if (!Number.isFinite(m.x) || !Number.isFinite(m.z) || (m.x === 0 && m.z === 0)) problems.push(`${q.id}.${s}: marker at (${m.x}, ${m.z})`);
        if (!has(ZONES, m.zone)) problems.push(`${q.id}.${s}: '${m.zone}' is not a zone`);
        else if (zoneOf(m.x, m.z) !== m.zone) problems.push(`${q.id}.${s}: (${m.x}, ${m.z}) is in '${zoneOf(m.x, m.z)}', not '${m.zone}'`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('points every trigger, listed step, requirement and wake at real stages, enemies, items and feats', () => {
    const problems: string[] = [];
    for (const q of nodes) {
      for (const t of q.triggers) {
        const at = `${q.id} ${t.on} ${t.from}→${t.to}`;
        if (stageIndex(q.id, t.from) < 0 || stageIndex(q.id, t.to) < 0) problems.push(`${at}: not a stage of ${q.id}`);
        else if (!canStep(q.id, t.from, t.to)) problems.push(`${at}: not a step canStep allows`);
        if (t.on === 'kill' && !isEnemy(t.enemy)) problems.push(`${at}: '${t.enemy}' is not an enemy kind`);
        if (t.on === 'item' && !itemDef(t.item)) problems.push(`${at}: '${t.item}' is not an item`);
        if (t.on === 'feat' && !has(FEATS, t.what) && !ACTION_FEATS.has(t.what)) problems.push(`${at}: '${t.what}' is neither a feat nor a books' action`);
        if (t.on === 'bosses' && !(Number.isInteger(t.atLeast) && t.atLeast > 0)) problems.push(`${at}: atLeast ${t.atLeast}`);
        if (t.on === 'stages') for (const [rq, rs] of t.all) if (stageIndex(rq, rs) < 0) problems.push(`${at}: ${rq}.${rs} is not a stage`);
      }
      for (const e of [...(q.repeatable ?? []), ...(q.shortcuts ?? [])]) {
        const [from, to, ...rest] = e.split('→');
        if (rest.length || stageIndex(q.id, from) < 0 || stageIndex(q.id, to ?? '') < 0) problems.push(`${q.id}: '${e}' is not from→to between its stages`);
      }
      for (const [s, def] of Object.entries(q.stages)) {
        for (const [rq, rs] of def.requires ?? []) if (stageIndex(rq, rs) < 0) problems.push(`${q.id}.${s} requires ${rq}.${rs}, not a stage`);
        if (def.wakes !== undefined && !isEnemy(def.wakes)) problems.push(`${q.id}.${s} wakes '${def.wakes}', not an enemy kind`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('gives each voice to its own quest, as FIVE_VOICES lists them', () => {
    expect(FIVE_VOICES.map((v) => v.quest)).toEqual(['throne', 'trip', 'sound', 'bell', 'grave']);
    for (const q of nodes) {
      const v = FIVE_VOICES.find((f) => f.quest === q.id);
      expect(q.voice, q.id).toEqual(v ? { item: v.item, label: v.label } : undefined);
    }
    for (const v of FIVE_VOICES) {
      expect(stageIndex(v.quest, v.stage), `${v.quest}.${v.stage}`).toBeGreaterThan(0);
      expect(itemDef(v.item)?.rarity, v.item).toBe(4);
    }
  });
});

describe('quest graph and the dialogue books', () => {
  it('has every quest stage the books ask about or move to', () => {
    const refs = bookReferences();
    expect(refs.length).toBeGreaterThan(100);
    const misses = refs.filter((r) => stageIndex(r.id, r.stage) < 0).map((r) => `${r.at}: ${r.id}.${r.stage}`);
    expect(misses, `stages the books name that the graph lacks:\n${misses.join('\n')}`).toEqual([]);
  });

  it("allows every step a book's choice takes, from each stage the book offers it at", () => {
    const problems: string[] = [];
    let steps = 0;
    for (const [npc, book] of Object.entries(DIALOGUE)) {
      for (const line of book.lines) {
        for (const c of line.choices ?? []) {
          const a = c.action === undefined ? null : parseAction(c.action);
          if (a?.kind !== 'quest') continue;
          const at = `${npc}/${line.id} '${c.label}'`;
          const froms = gate(c.when, a.id) ?? gate(line.when, a.id);
          if (!froms) { problems.push(`${at}: moves ${a.id} to '${a.stage}' from any stage`); continue; }
          for (const from of froms) {
            steps++;
            if (!canStep(a.id, from, a.stage)) problems.push(`${at}: ${a.id} ${from}→${a.stage} is not a step`);
          }
        }
      }
    }
    expect(steps).toBeGreaterThan(20);
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

describe('quest graph: rewards', () => {
  it("pays what the books' headers say, and nothing anywhere else", () => {
    const expected: Record<string, Reward> = {
      'throne.done': { shards: 1500, give: ['antler-signet'] },
      // The shards choice only: the lick moves croak without them (below).
      'croak.done': { shards: 400 },
      'trip.god': { give: ['third-eye'] },
      'sound.active': { give: ['mist-blade'] },
      'sound.done': { shards: 800, give: ['signed-cup'] },
      'bell.done': { shards: 700 },
      'grave.slain': { give: ['grave-crown'] },
      'grave.done': { shards: 900 },
      'crown.done': { shards: 600 },
      'lean.done': { shards: 1000, take: ['signed-cup'] },
      'penny.secret': { charge: 20 },
      'penny.done': { charge: 40, give: ['lunar-charm'] },
      'books.active': { charge: 60, give: ['old-ledger'] },
      'books.done': { take: ['old-ledger'] },
    };
    const actual: Record<string, Reward> = {};
    for (const q of nodes) for (const s of q.order) { const r = rewardFor(q.id, s); if (r) actual[`${q.id}.${s}`] = r; }
    expect(actual).toEqual(expected);
    expect(rewardFor('throne', 'bogus')).toBeUndefined();
    expect(rewardFor('nope', 'done')).toBeUndefined();
  });

  it('gives and takes only items that exist', () => {
    const problems: string[] = [];
    for (const q of nodes) {
      for (const [s, def] of Object.entries(q.stages)) {
        for (const item of [...(def.reward?.give ?? []), ...(def.reward?.take ?? [])]) if (!itemDef(item)) problems.push(`${q.id}.${s}: '${item}' is not in ITEMS`);
        for (const n of [def.reward?.shards, def.reward?.charge]) if (n !== undefined && !(Number.isInteger(n) && n > 0)) problems.push(`${q.id}.${s}: ${n} shards`);
      }
    }
    for (const v of FIVE_VOICES) if (!itemDef(v.item)) problems.push(`voice '${v.item}' is not in ITEMS`);
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('hands each voice over exactly once: given on entering its stage, or picked up to enter it', () => {
    for (const v of FIVE_VOICES) {
      const gives = nodes.flatMap((q) => q.order.filter((s) => rewardFor(q.id, s)?.give?.includes(v.item)).map((s) => `${q.id}.${s}`));
      const pickedUp = QUEST_GRAPH[v.quest].triggers.some((t) => t.on === 'item' && t.item === v.item && t.to === v.stage);
      expect(gives, v.item).toEqual(pickedUp ? [] : [`${v.quest}.${v.stage}`]);
    }
  });

  it("pays the Frog King's 400 for the shards choice, and nothing for the lick", () => {
    const declined = new Game();
    for (const s of ['active', 'bagged', 'returned', 'done']) declined.talk('croak', s);
    expect(declined.paid).toEqual(['croak:done']);

    const licked = new Game();
    for (const s of ['active', 'bagged', 'returned']) licked.talk('croak', s);
    licked.emit(feat('lick'));
    expect(licked.stages.croak).toBe('done');
    expect(licked.paid).toEqual([]);
    // Licking again later moves nothing and pays nothing.
    licked.emit(feat('lick'));
    expect(licked.paid).toEqual([]);
  });

  it('pays nothing for a step to the stage a quest is already at, and each stage its due from the stage before', () => {
    const problems: string[] = [];
    for (const q of nodes) {
      q.order.forEach((s, i) => {
        if (rewardFor(q.id, s, s) !== undefined) problems.push(`${q.id} ${s}→${s} pays`);
        if (i > 0 && rewardFor(q.id, s, q.order[i - 1]) !== rewardFor(q.id, s)) problems.push(`${q.id} ${q.order[i - 1]}→${s} does not pay the stage's reward`);
      });
    }
    expect(problems, problems.join('\n')).toEqual([]);
    // The finished stages that pay: each one entered again as canStep allows, for nothing.
    const paying = nodes.filter((q) => rewardFor(q.id, lastOf(q)) !== undefined);
    expect(paying.map((q) => `${q.id}.${lastOf(q)}`)).toEqual(['throne.done', 'croak.done', 'trip.god', 'sound.done', 'bell.done', 'grave.done', 'crown.done', 'lean.done', 'penny.done', 'books.done']);
    for (const q of paying) {
      expect(canStep(q.id, lastOf(q), lastOf(q)), q.id).toBe(true);
      expect(rewardFor(q.id, lastOf(q), lastOf(q)), q.id).toBeUndefined();
    }
  });

  it("pays a finished quest once, however often its last step is taken: the header's recipe, to the letter", () => {
    // The Antlered King's 'Take the reward', clicked twice (or taken again from the line left open).
    const stages: Record<string, string> = { throne: 'slain' };
    const purse: Purse = { shards: 0, bag: [] };
    expect(recipe(stages, purse, 'throne', 'done')).toBe(true);
    expect(recipe(stages, purse, 'throne', 'done')).toBe(true);
    expect(stages.throne).toBe('done');
    expect(purse).toEqual({ shards: 1500, bag: ['antler-signet'] });
    // Every quest's last step, taken twice from the stage before it, with what it takes in the bag and shards to spare.
    for (const q of nodes) {
      const [before, last] = q.order.slice(-2);
      const s: Record<string, string> = { bell: 'found', [q.id]: before }; // the bride's shore needs the bell found
      const p: Purse = { shards: 100, bag: [...(rewardFor(q.id, last)?.take ?? [])] };
      expect(recipe(s, p, q.id, last), `${q.id} ${before}→${last}`).toBe(true);
      const once: Purse = { shards: p.shards, bag: [...p.bag] };
      expect(recipe(s, p, q.id, last), `${q.id} ${last}→${last}`).toBe(true);
      expect(p, `${q.id}.${last} entered again`).toEqual(once);
    }
  });
});

describe('the main story', () => {
  it('can be finished from nothing with talks, the four boss kills and the two pickups: every stage entered, every purse paid once', () => {
    const g = new Game();
    g.talk('silence', 'told');              // the Stone Head: 'I will gather them.'
    g.talk('throne', 'active');             // the Antlered King
    g.emit(kill('warden'));
    g.talk('throne', 'done');               // 'Take the reward'
    g.talk('croak', 'active');              // the Frog King
    g.talk('croak', 'bagged');              // 'bag-croak' on Brother Croak
    g.talk('croak', 'returned');            // the sack set down by his father
    g.talk('croak', 'done');                // 'No, you must be sick or something'
    g.talk('trip', 'done');                 // licked anyway ('Changed your mind?'), and woke
    g.emit(kill('dmt-entity'));             // the Frog God, on the second trip
    g.talk('sound', 'active');              // Yung Lean: the Bittersweet Blade
    g.emit(loot('lost-sound'));
    g.talk('sound', 'done');                // Yung Lean: 'Take the signed cup.'
    g.talk('bell', 'active');               // the Fish King
    g.emit(loot('drowned-bell'));
    g.talk('bell', 'done');                 // the Fish King: 'Keep it?'
    g.talk('grave', 'active');              // the Skeleton King
    g.emit(kill('cyclops-lord'));
    expect(g.stages.silence).toBe('five');  // the fifth voice: the Stone Head hears them
    g.talk('grave', 'done');                // the Skeleton King: 'Take the shards.'
    g.talk('silence', 'open');              // 'I will wake him.'
    g.emit(kill('hollowking'));
    expect(g.stages.silence).toBe('ended');
    expect(g.triggered).toEqual(['throne:slain', 'trip:god', 'sound:found', 'bell:found', 'grave:slain', 'silence:five', 'silence:ended']);
    expect(voicesHeld(g.stages)).toEqual(['antler-signet', 'third-eye', 'lost-sound', 'drowned-bell', 'grave-crown']);
    // Every stage of every main quest, in its order, each once.
    const main = nodes.filter((q) => q.kind === 'main');
    expect(main.map((q) => q.id)).toEqual(['silence', 'throne', 'croak', 'trip', 'sound', 'bell', 'grave']);
    for (const q of main) expect(g.visited(q.id), q.id).toEqual(q.order);
    // Every purse of the main story, each once.
    expect(g.paid).toEqual(['throne:done', 'croak:done', 'trip:god', 'sound:active', 'sound:done', 'bell:done', 'grave:slain', 'grave:done']);
  });

  it('counts the Frog God slain on the first trip, before waking, and never takes the eye back', () => {
    const g = new Game();
    for (const s of ['active', 'bagged', 'returned']) g.talk('croak', s);
    g.emit(feat('lick'));                   // 'Uhh... sure': croak done, unpaid; into the dream
    g.emit(kill('dmt-entity'));             // trip is still 'none'
    expect(g.stages.trip).toBe('god');
    expect(g.attempt('trip', 'done')).toBe(false); // waking: refused, the god stays slain
    expect(g.stages.trip).toBe('god');
    expect(g.attempt('trip', 'god')).toBe(true);   // a re-entry is a harmless no-op
    expect(g.paid).toEqual(['trip:god']);
  });

  it('counts a boss slain before its quest was given (the kill log), but never the Hollow King asleep', () => {
    const g = new Game();
    g.emit(kill('warden'));
    g.emit(kill('cyclops-lord'));
    g.emit(kill('hollowking'));
    g.talk('throne', 'active');
    expect(g.stages.throne).toBe('slain');
    g.talk('grave', 'active');
    expect(g.stages.grave).toBe('slain');
    // The rest of the five, as a save would restore them.
    Object.assign(g.stages, { silence: 'told', throne: 'done', trip: 'god', sound: 'found', bell: 'found' });
    g.emit(HURT);
    expect(g.stages.silence).toBe('five');
    g.talk('silence', 'open');
    expect(g.stages.silence).toBe('open');  // woken now; the old kill does not count
  });
});

describe('canStep', () => {
  it('takes the next stage only: no skipping, no going back, no staying, besides the listed steps', () => {
    const problems: string[] = [];
    for (const q of nodes) {
      q.order.forEach((from, i) => q.order.forEach((to, j) => {
        const want = j === i + 1 || (i === j && j === q.order.length - 1) || OFF_ORDER.has(`${q.id}:${edge(from, to)}`);
        if (canStep(q.id, from, to) !== want) problems.push(`${q.id} ${from}→${to}: ${!want}`);
      }));
    }
    expect(problems, problems.join('\n')).toEqual([]);
    expect(canStep('throne', 'none', 'slain')).toBe(false);
    expect(canStep('silence', 'told', 'open')).toBe(false);
    expect(canStep('sound', 'active', 'done')).toBe(false);
    expect(canStep('trip', 'god', 'done')).toBe(false);
    expect(canStep('lean', 'none', 'done')).toBe(false);
  });

  it('allows the lick again, the sack put down early, the cup at active and a finished quest again', () => {
    expect(canStep('trip', 'done', 'done')).toBe(true);
    expect(canStep('croak', 'bagged', 'active')).toBe(true);
    expect(canStep('lean', 'active', 'done')).toBe(true);
    expect(canStep('crown', 'done', 'done')).toBe(true);
    expect(canStep('silence', 'ended', 'ended')).toBe(true);
    expect(canStep('throne', 'active', 'active')).toBe(false);
  });

  it("checks a stage's requirements when given the stages", () => {
    expect(canStep('bride', 'walking', 'done', { bell: 'active' })).toBe(false);
    expect(canStep('bride', 'walking', 'done', { bell: 'found' })).toBe(true);
    expect(canStep('bride', 'walking', 'done', { bell: 'done' })).toBe(true);
    expect(canStep('bride', 'walking', 'done')).toBe(true);
    expect(canStep('bride', 'done', 'done', {})).toBe(true);
  });

  it('refuses unknown quests and stages, inherited names included', () => {
    expect(canStep('nope', 'none', 'active')).toBe(false);
    expect(canStep('constructor', 'none', 'active')).toBe(false);
    expect(canStep('throne', 'none', 'bogus')).toBe(false);
    expect(canStep('throne', 'constructor', 'active')).toBe(false);
  });
});

describe('triggersFor', () => {
  it('moves a quest on its kill, from the stage the trigger names, and nothing else', () => {
    expect(triggersFor(kill('warden'), { throne: 'active' }, 0)).toEqual([{ id: 'throne', from: 'active', to: 'slain' }]);
    for (const s of ['none', 'slain', 'done', 'bogus']) expect(triggersFor(kill('warden'), { throne: s }, 0), s).toEqual([]);
    expect(triggersFor(kill('yeti'), { throne: 'active' }, 0)).toEqual([]);
    expect(triggersFor(HURT, { throne: 'active' }, 0)).toEqual([]);
    expect(triggersFor(kill('cyclops-lord'), { grave: 'active', throne: 'active' }, 0)).toEqual([{ id: 'grave', from: 'active', to: 'slain' }]);
    expect(triggersFor(kill('hollowking'), { silence: 'five' }, 0)).toEqual([]);
    expect(triggersFor(kill('hollowking'), { silence: 'open' }, 0)).toEqual([{ id: 'silence', from: 'open', to: 'ended' }]);
    expect(triggersFor(kill('dmt-entity'), { trip: 'done' }, 0)).toEqual([{ id: 'trip', from: 'done', to: 'god' }]);
    expect(triggersFor(kill('dmt-entity'), { trip: 'god' }, 0)).toEqual([]);
    expect(triggersFor(kill('rift-king'), {}, 0)).toEqual([{ id: 'crown', from: 'none', to: 'done' }]);
    expect(triggersFor(kill('rift-king'), { crown: 'done' }, 0)).toEqual([]);
  });

  it('counts kills from the log only where the trigger says so', () => {
    expect(triggersFor(HURT, { throne: 'active' }, 0, ['warden'])).toEqual([{ id: 'throne', from: 'active', to: 'slain' }]);
    expect(triggersFor({ kind: 'quest', id: 'grave', stage: 'active' }, { grave: 'active' }, 0, new Set(['cyclops-lord']))).toEqual([{ id: 'grave', from: 'active', to: 'slain' }]);
    expect(triggersFor(HURT, { silence: 'open' }, 0, ['hollowking'])).toEqual([]);
    expect(triggersFor(HURT, { throne: 'none' }, 0, ['warden'])).toEqual([]);
  });

  it('moves a quest when its item is picked up', () => {
    expect(triggersFor(loot('lost-sound'), { sound: 'active' }, 0)).toEqual([{ id: 'sound', from: 'active', to: 'found' }]);
    expect(triggersFor(loot('lost-sound'), { sound: 'none' }, 0)).toEqual([]);
    expect(triggersFor(loot('drowned-bell'), { bell: 'active' }, 0)).toEqual([{ id: 'bell', from: 'active', to: 'found' }]);
    expect(triggersFor(loot('drowned-bell'), { bell: 'found' }, 0)).toEqual([]);
    expect(triggersFor(loot('moon-dew'), { bell: 'active', sound: 'active' }, 0)).toEqual([]);
    expect(triggersFor({ kind: 'trade', what: 'buy', item: 'drowned-bell' }, { bell: 'active' }, 0)).toEqual([]);
  });

  it('moves croak on the lick, unpaid, and the bride on follow', () => {
    expect(triggersFor(feat('lick'), { croak: 'returned' }, 0)).toEqual([{ id: 'croak', from: 'returned', to: 'done', unpaid: true }]);
    expect(triggersFor(feat('lick'), { croak: 'done' }, 0)).toEqual([]);
    expect(triggersFor(feat('ale'), { croak: 'returned' }, 0)).toEqual([]);
    expect(triggersFor(feat('follow'), { bell: 'done' }, 0)).toEqual([{ id: 'bride', from: 'none', to: 'walking' }]);
    expect(triggersFor(feat('follow'), { bell: 'done', bride: 'walking' }, 0)).toEqual([]);
  });

  it('makes Elowen count the great ones: three different bosses, on any event', () => {
    expect(triggersFor(HURT, { rose: 'asked' }, 3)).toEqual([{ id: 'rose', from: 'asked', to: 'worthy' }]);
    expect(triggersFor({ kind: 'quest', id: 'rose', stage: 'asked' }, { rose: 'asked' }, 4)).toEqual([{ id: 'rose', from: 'asked', to: 'worthy' }]);
    expect(triggersFor(HURT, { rose: 'asked' }, 2)).toEqual([]);
    expect(triggersFor(HURT, { rose: 'none' }, 5)).toEqual([]);
    expect(triggersFor(HURT, { rose: 'worthy' }, 5)).toEqual([]);
  });

  it('opens the five once every voice is earned, later stages included, and not one short', () => {
    const voices: Record<string, string> = { throne: 'done', trip: 'god', sound: 'found', bell: 'found', grave: 'slain' };
    const five = [{ id: 'silence', from: 'told', to: 'five' }];
    expect(triggersFor(HURT, { ...voices, silence: 'told' }, 0)).toEqual(five);
    expect(triggersFor(HURT, { ...voices, sound: 'done', bell: 'done', grave: 'done', silence: 'told' }, 0)).toEqual(five);
    expect(triggersFor(HURT, { ...voices, silence: 'none' }, 0)).toEqual([]);
    expect(triggersFor(HURT, { ...voices, silence: 'five' }, 0)).toEqual([]);
    for (const v of FIVE_VOICES) {
      const short = { ...voices, silence: 'told', [v.quest]: QUEST_GRAPH[v.quest].order[stageIndex(v.quest, v.stage) - 1] };
      expect(triggersFor(HURT, short, 0), `without ${v.item}`).toEqual([]);
    }
  });

  it('takes one step per quest, for every quest the event moves, and changes nothing itself', () => {
    const stages = { throne: 'active', rose: 'asked' };
    expect(triggersFor(kill('warden'), stages, 3)).toEqual([{ id: 'throne', from: 'active', to: 'slain' }, { id: 'rose', from: 'asked', to: 'worthy' }]);
    expect(stages).toEqual({ throne: 'active', rose: 'asked' });
  });
});

describe('stages, voices and the journal', () => {
  it('orders the stages and compares them', () => {
    expect(stageIndex('throne', 'none')).toBe(0);
    expect(stageIndex('throne', 'done')).toBe(3);
    expect(stageIndex('throne', 'bogus')).toBe(-1);
    expect(stageIndex('nope', 'none')).toBe(-1);
    expect(isAtLeast({ sound: 'done' }, 'sound', 'found')).toBe(true);
    expect(isAtLeast({ sound: 'found' }, 'sound', 'found')).toBe(true);
    expect(isAtLeast({ sound: 'active' }, 'sound', 'found')).toBe(false);
    expect(isAtLeast({}, 'sound', 'none')).toBe(true);
    expect(isAtLeast({ sound: 'bogus' }, 'sound', 'none')).toBe(false);
    expect(isAtLeast({ sound: 'done' }, 'sound', 'bogus')).toBe(false);
  });

  it('holds five voices once all are earned, and only those earned before', () => {
    expect(voicesHeld({})).toEqual([]);
    expect(voicesHeld({ throne: 'done', trip: 'god', sound: 'found', bell: 'found', grave: 'slain' })).toEqual(FIVE_VOICES.map((v) => v.item));
    expect(voicesHeld({ throne: 'done', trip: 'god', sound: 'done', bell: 'done', grave: 'done' })).toHaveLength(5);
    expect(voicesHeld({ throne: 'slain', trip: 'done', sound: 'active', bell: 'found', grave: 'active' })).toEqual(['drowned-bell']);
  });

  it('lists the quests given: the main story first, in progress before done, markers only where there is somewhere to go', () => {
    const j = journal({ crown: 'done', rose: 'asked', throne: 'done', silence: 'told', lean: 'none', books: 'bogus' });
    expect(j.map((e) => `${e.id}:${e.kind}:${e.done}`)).toEqual(['silence:main:false', 'throne:main:true', 'rose:side:false', 'crown:side:true']);
    expect(j[0]).toEqual({ id: 'silence', title: 'The Silent Kingdom', kind: 'main', objective: QUEST_GRAPH.silence.stages.told.objective, done: false, marker: QUEST_GRAPH.silence.stages.told.marker });
    expect(j[1].marker).toBeUndefined();
    expect(j[1].objective).toBe(QUEST_GRAPH.throne.stages.done.objective);
    expect(journal({})).toEqual([]);
  });
});

describe('the story items', () => {
  it('are key items: not sold, worth nothing, the voices mythic', () => {
    expect(itemDef('drowned-bell')).toMatchObject({ id: 'drowned-bell', name: 'The Drowned Bell', kind: 'key', value: 0, rarity: 4 });
    expect(itemDef('grave-crown')).toMatchObject({ id: 'grave-crown', name: 'The Grave Crown', kind: 'key', value: 0, rarity: 4 });
    expect(itemDef('old-ledger')).toMatchObject({ id: 'old-ledger', name: 'An Old Ledger', kind: 'key', value: 0 });
  });
});

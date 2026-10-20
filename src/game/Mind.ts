/**
 * The NPC mind: picks what an NPC says from its dialogue book by what the player has done (the world state), what
 * the NPC can know of it (its own district at once, the districts it `knows` after the rumour delay, a boss kill
 * anywhere after a minute) and what it has said before (no repeats within three minutes, `once` lines once ever).
 * Pure: no three.js, no DOM. The integration renders the nodes, executes the parsed actions, and emits the 'talk'
 * event for a conversation (before or after `open`: both orders count the meeting once).
 *
 * Conversation shape (`open`): the greet is `first`; when a reaction scored, the greet's single '…' choice leads to
 * it; the hub of choices (every eligible topic best first, the integration's `autoChoices`, then Leave → the bye
 * line) hangs off the last of those, unless the line carries its own `choices`, which always stand as written. A
 * node without choices is terminal (the bye). The topic order and the bye are settled when the conversation opens,
 * so every hub in it agrees. `choose` follows a choice's `to`; the integration executes the choice's action first,
 * then calls `choose`, so the next line's conditions see the new state.
 */
import type { Choice, Cond, DialogueBook, LineDef, Persona } from '../data/dialogue/types';
import type { GameEvent, HeroId, Zone } from './Events';
import { ENEMY_DEFS } from '../data/enemies';
import { ROSTER } from '../characters/roster';
import { REALMS } from '../data/world';
import { recordOf, type EventRecord, type WorldState } from './WorldState';
import { parseAction, type Action } from './actions';

export interface MindQuests { stage(id: string): string }

export interface MindCtx {
  state: WorldState;
  quests: MindQuests;
  book: DialogueBook;
  /** The selection jitter's random source (seeded in tests; Math.random by default). */
  rnd?: () => number;
  /** Overrides the state's clock (tests). */
  now?: number;
  /** Choices the integration adds to every hub (trade, hire, send home), for all NPCs or per NPC. */
  autoChoices?: Choice[] | ((npcId: string) => Choice[]);
}

export interface ResolvedChoice {
  label: string;
  to?: string;
  /** The parsed action for the integration to execute (null: none, or malformed). */
  action: Action | null;
  when?: Cond;
}

export interface Resolved {
  line: LineDef;
  /** The line's text with its templates expanded. */
  text: string;
  choices: ResolvedChoice[];
}

export interface Conversation {
  npcId: string;
  /** Every node this opening resolved, in order: greet, reaction, the topics on offer, bye. Empty: unknown NPC. */
  nodes: Resolved[];
  /** What the NPC says first. */
  first: Resolved;
}

/** A reaction is voiced only above this score. */
export const REACT_THRESHOLD = 1.2;
/** Seconds within which a line said again costs 4 points. */
export const REPEAT_WINDOW = 180;
/** Seconds within which the same bark is never repeated. */
export const BARK_WINDOW = 20;
/** Seconds after which a boss kill is news everywhere. */
export const BOSS_NEWS_DELAY = 60;
export const LEAVE_LABEL = 'Leave';
/** The greet's choice that leads to the reaction. */
export const CONTINUE_LABEL = '…';
export const UNKNOWN_ENEMY = 'that thing';

const HERO: Partial<Record<HeroId, { name: string; title: string }>> = Object.fromEntries(ROSTER.map((c) => [c.id, { name: c.name, title: c.title }]));

const ZONE_NAME: Record<string, string> = { island: 'The Island', ...Object.fromEntries(REALMS.map((r) => [r.id, r.name])) };

/** A zone's display name. */
export function zoneName(zone: Zone): string {
  return ZONE_NAME[zone] ?? zone;
}

/** An enemy kind's display name. */
export function enemyName(kind: string): string {
  return (ENEMY_DEFS as Record<string, { name: string } | undefined>)[kind]?.name ?? kind;
}

/**
 * How well the NPC knows of the event: 1 in its own district, 0.6 for a district it `knows` once the rumour delay
 * has passed, 1 for a boss kill anywhere after a minute, else 0.
 */
export function knowledge(persona: Persona, e: EventRecord, now: number): number {
  if (e.zone === persona.district) return 1;
  const age = now - e.t;
  let k = 0;
  if (persona.knows.includes(e.zone) && age >= persona.rumourDelay) k = 0.6;
  if (e.kind === 'kill' && e.data.boss === true && age >= BOSS_NEWS_DELAY) k = 1;
  return k;
}

/** Whether the condition says anything about an event. */
export function hasEventCond(c: Cond | undefined): boolean {
  return !!c && (c.event !== undefined || c.feat !== undefined || c.enemy !== undefined || c.boss !== undefined);
}

/** Whether the event parts of the condition describe this event (a condition without them matches any event). */
export function matchesEvent(c: Cond | undefined, e: EventRecord): boolean {
  if (!c) return true;
  if (c.event !== undefined && e.kind !== c.event) return false;
  if (c.feat !== undefined && !(e.kind === 'feat' && e.data.what === c.feat)) return false;
  if (c.boss !== undefined && !(e.kind === 'kill' && e.data.boss === c.boss)) return false;
  if (c.enemy !== undefined) {
    const who = e.kind === 'kill' ? e.data.enemy : e.kind === 'hurt' ? e.data.by : undefined;
    if (who !== c.enemy) return false;
  }
  return true;
}

function now(ctx: MindCtx): number {
  return ctx.now ?? ctx.state.time;
}

/** Times the player talked to the NPC before, straight from memory. */
function metRaw(npcId: string, ctx: MindCtx): number {
  return ctx.state.npc[npcId]?.met ?? 0;
}

/** The state parts of the condition (everything but the event fields). */
function holdsState(c: Cond, ctx: MindCtx, met: number): boolean {
  const s = ctx.state;
  if (c.hero !== undefined && s.hero !== c.hero) return false;
  if (c.quest !== undefined) {
    const [id, want] = c.quest;
    const cur = ctx.quests.stage(id);
    if (Array.isArray(want) ? !want.includes(cur) : cur !== want) return false;
  }
  if (c.flag !== undefined && !s.flags.has(c.flag)) return false;
  if (c.notFlag !== undefined && s.flags.has(c.notFlag)) return false;
  if (c.metMin !== undefined && met < c.metMin) return false;
  if (c.metMax !== undefined && met > c.metMax) return false;
  if (c.minShards !== undefined && s.shards < c.minShards) return false;
  if (c.maxShards !== undefined && s.shards > c.maxShards) return false;
  if (c.item !== undefined && !s.items.has(c.item)) return false;
  if (c.notItem !== undefined && s.items.has(c.notItem)) return false;
  if (c.zoneIs !== undefined && s.zone !== c.zoneIs) return false;
  if (c.bossSlain !== undefined && s.bossesSlain[c.bossSlain] === undefined) return false;
  if (c.bossAlive !== undefined && s.bossesSlain[c.bossAlive] !== undefined) return false;
  if (c.kills !== undefined && (s.kills[c.kills[0]] ?? 0) < c.kills[1]) return false;
  if (c.hurtWithin !== undefined && now(ctx) - s.lastHurtAt > c.hurtWithin) return false;
  if (c.level !== undefined && s.level < c.level) return false;
  if (c.companions !== undefined && s.companions < c.companions) return false;
  return true;
}

/** The recent events the NPC knows of. */
function known(persona: Persona, ctx: MindCtx): EventRecord[] {
  const t = now(ctx);
  return ctx.state.recent.filter((e) => knowledge(persona, e, t) > 0);
}

/** Whether the whole condition holds for this NPC now (event fields against the recent events it knows of). */
function holds(c: Cond | undefined, persona: Persona, ctx: MindCtx, met: number): boolean {
  if (!c) return true;
  if (!holdsState(c, ctx, met)) return false;
  if (hasEventCond(c)) return known(persona, ctx).some((e) => matchesEvent(c, e));
  return true;
}

/** Whether the line applies to this NPC now. `met` overrides the memory's count (a conversation in progress). */
export function eligible(line: LineDef, npcId: string, ctx: MindCtx, met: number = metRaw(npcId, ctx)): boolean {
  const npc = ctx.book[npcId];
  if (!npc) return false;
  return holds(line.when, npc.persona, ctx, met);
}

function mentionsHero(text: string, hero: HeroId): boolean {
  if (text.includes('{hero}') || text.includes('{heroTitle}')) return true;
  const h = HERO[hero];
  return !!h && text.includes(h.name);
}

/**
 * The line's score: weight, plus (for a reaction) the best salience × knowledge of a matching recent event, minus
 * 4 when said within three minutes and 1.5 per time said, −∞ for a `once` line already said, plus 1 when it names
 * the hero, plus a jitter of up to 0.5.
 */
export function score(line: LineDef, npcId: string, ctx: MindCtx): number {
  const s = ctx.state;
  const t = now(ctx);
  const npc = ctx.book[npcId];
  let v = line.weight ?? 1;
  if (line.slot === 'react' && npc && hasEventCond(line.when)) {
    let best = 0;
    for (const e of s.recent) {
      if (!matchesEvent(line.when, e)) continue;
      const k = knowledge(npc.persona, e, t);
      if (k > 0) best = Math.max(best, s.salience(e, t) * k);
    }
    v += best;
  }
  const said = s.npc[npcId]?.said[line.id];
  if (said) {
    if (line.once) return -Infinity;
    if (t - said.at < REPEAT_WINDOW) v -= 4;
    v -= 1.5 * said.n;
  }
  if (mentionsHero(line.text, s.hero)) v += 1;
  v += 0.5 * (ctx.rnd ?? Math.random)();
  return v;
}

/** The newest recent kill the NPC knows of (bosses only when `boss`), or null. */
function lastKnownKill(persona: Persona | undefined, ctx: MindCtx, boss: boolean): EventRecord | null {
  const t = now(ctx);
  const r = ctx.state.recent;
  for (let i = r.length - 1; i >= 0; i--) {
    const e = r[i];
    if (e.kind !== 'kill' || (boss && e.data.boss !== true)) continue;
    if (!persona || knowledge(persona, e, t) > 0) return e;
  }
  return null;
}

/** The boss slain last of all (the kill may have left the ring), or null. */
function lastBossEver(ctx: MindCtx): string | null {
  let best: string | null = null;
  let at = -Infinity;
  for (const [kind, t] of Object.entries(ctx.state.bossesSlain)) if (t > at) { at = t; best = kind; }
  return best;
}

/**
 * Fills the templates: {hero}, {heroTitle}, {lastKill}, {lastBoss}, {district}, {shards}, {level}, {met},
 * {kills:<kind>} (or {kills} for all). Unknown templates are left as written.
 */
export function expand(text: string, npcId: string, ctx: MindCtx, met: number = metRaw(npcId, ctx)): string {
  const s = ctx.state;
  const persona = ctx.book[npcId]?.persona;
  return text.replace(/\{([a-zA-Z]+)(?::([^}]*))?\}/g, (whole: string, key: string, arg: string | undefined) => {
    switch (key) {
      case 'hero': return HERO[s.hero]?.name ?? s.hero;
      case 'heroTitle': return HERO[s.hero]?.title ?? s.hero;
      case 'lastKill': {
        const e = lastKnownKill(persona, ctx, false);
        return e ? enemyName(String(e.data.enemy)) : UNKNOWN_ENEMY;
      }
      case 'lastBoss': {
        const e = lastKnownKill(persona, ctx, true);
        const kind = e ? String(e.data.enemy) : lastBossEver(ctx);
        return kind ? enemyName(kind) : UNKNOWN_ENEMY;
      }
      case 'district': return zoneName(s.zone);
      case 'shards': return String(s.shards);
      case 'level': return String(s.level);
      case 'met': return String(met);
      case 'kills': {
        if (arg) return String(s.kills[arg] ?? 0);
        let n = 0;
        for (const k of Object.values(s.kills)) n += k;
        return String(n);
      }
      default: return whole;
    }
  });
}

/** A choice label from the line's opening: its first sentence when short, else its first words. */
export function firstWords(text: string, max = 5): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  const sentence = (clean.match(/^[^.!?]*[.!?]?/)?.[0] ?? clean).trim();
  if (sentence.length > 0 && sentence.length <= 36 && sentence.split(' ').length <= 7) return sentence.replace(/[.,;:]$/, '');
  const words = clean.split(' ');
  const head = words.slice(0, max).join(' ').replace(/[.,;:!?]$/, '');
  return words.length > max ? `${head}…` : head;
}

/** A silent line for an NPC with nothing to say (or none in the book). */
const SILENT: LineDef = { id: '', slot: 'greet', text: '…' };

interface Session {
  npcId: string;
  /** Times met before this conversation (every condition in it uses this). */
  met: number;
  /** Lines said in this conversation (not offered again in its hub). */
  said: Set<string>;
  /** The hub's topic order, fixed when the conversation opened. */
  order: string[];
  /** The conversation's bye line (null: none in the book), settled at the first hub; undefined until then. */
  bye?: LineDef | null;
}

export class Mind {
  private session: Session | null = null;

  constructor(readonly ctx: MindCtx) {}

  /** The NPC's greeting, best first, or null (unknown NPC, nothing eligible). */
  greet(npcId: string): Resolved | null {
    const line = this.best(npcId, 'greet');
    return line ? this.resolve(npcId, line.line, false) : null;
  }

  /** The NPC's reaction to what the player did, when it matters enough (score above REACT_THRESHOLD). */
  react(npcId: string): Resolved | null {
    const best = this.best(npcId, 'react');
    return best && best.score > REACT_THRESHOLD ? this.resolve(npcId, best.line, false) : null;
  }

  /** Every topic the NPC can talk about now, best first. */
  topics(npcId: string): Resolved[] {
    return this.topicLines(npcId).map((l) => this.resolve(npcId, l, false));
  }

  bye(npcId: string): Resolved | null {
    const line = this.best(npcId, 'bye');
    return line ? this.resolve(npcId, line.line, false) : null;
  }

  /** The bark for an event the NPC just witnessed (the integration decides the range), never the same twice within 20 s. */
  bark(npcId: string, e: GameEvent): Resolved | null {
    const npc = this.ctx.book[npcId];
    if (!npc) return null;
    const s = this.ctx.state;
    const t = now(this.ctx);
    const rec = recordOf(e, t, s.zone, s.hero);
    const met = this.metOf(npcId);
    let best: LineDef | null = null;
    let bestScore = -Infinity;
    for (const l of npc.lines) {
      if (l.slot !== 'bark' || !matchesEvent(l.when, rec)) continue;
      if (l.when && !holdsState(l.when, this.ctx, met)) continue;
      const said = s.npc[npcId]?.said[l.id];
      if (said && t - said.at < BARK_WINDOW) continue;
      const v = score(l, npcId, this.ctx);
      if (v > bestScore) { best = l; bestScore = v; }
    }
    if (!best) return null;
    this.remember(npcId, best.id);
    return this.resolve(npcId, best, false);
  }

  /** Opens a conversation: greet → reaction (if any) → the hub of topics and automatic choices → bye. */
  open(npcId: string): Conversation {
    const npc = this.ctx.book[npcId];
    if (!npc) {
      this.session = null;
      return { npcId, nodes: [], first: { line: SILENT, text: SILENT.text, choices: [{ label: LEAVE_LABEL, action: { kind: 'close' } }] } };
    }
    this.session = { npcId, met: this.metBefore(npcId), said: new Set(), order: [] };
    const greet = this.best(npcId, 'greet')?.line ?? null;
    const reactBest = this.best(npcId, 'react');
    // A greet with its own choices stands as written: no room for a reaction after it.
    const react = reactBest && reactBest.score > REACT_THRESHOLD && !(greet?.choices?.length) ? reactBest.line : null;
    this.session.order = this.topicLines(npcId).map((l) => l.id);
    if (greet) this.remember(npcId, greet.id);
    if (react) this.remember(npcId, react.id);

    const nodes: Resolved[] = [];
    let first: Resolved;
    const reactNode = react ? this.resolve(npcId, react, true) : null;
    if (greet) {
      first = this.resolve(npcId, greet, !reactNode);
      if (reactNode) first.choices = [{ label: CONTINUE_LABEL, to: reactNode.line.id, action: null }];
    } else if (reactNode) {
      first = reactNode;
    } else {
      first = { line: SILENT, text: SILENT.text, choices: this.hub(npcId, SILENT.id) };
    }
    nodes.push(first);
    if (reactNode && first !== reactNode) nodes.push(reactNode);
    for (const l of this.topicLines(npcId)) nodes.push(this.resolve(npcId, l, true));
    const bye = this.byeFor(npcId);
    if (bye) nodes.push(this.resolve(npcId, bye, false));
    return { npcId, nodes, first };
  }

  /**
   * Follows a choice's `to` (after the integration has executed its action) to the next node, or null when the
   * conversation ends: no `to`, an unknown line, or a `once` line already said.
   */
  choose(npcId: string, choice: Partial<Choice> | ResolvedChoice): Resolved | null {
    const npc = this.ctx.book[npcId];
    if (!npc || !choice.to) return null;
    const line = npc.lines.find((l) => l.id === choice.to);
    if (!line) return null;
    if (line.once && this.ctx.state.npc[npcId]?.said[line.id]) return null;
    if (!this.session || this.session.npcId !== npcId) this.session = { npcId, met: this.metBefore(npcId), said: new Set(), order: [] };
    const node = this.resolve(npcId, line, true);
    this.remember(npcId, line.id);
    return node;
  }

  /** Marks the line said now (its score drops for three minutes; a `once` line is never said again). */
  remember(npcId: string, lineId: string): void {
    if (!lineId) return;
    const m = this.ctx.state.memoryOf(npcId);
    const t = now(this.ctx);
    const said = m.said[lineId];
    if (said) { said.n++; said.at = t; } else m.said[lineId] = { n: 1, at: t };
    if (this.session?.npcId === npcId) this.session.said.add(lineId);
  }

  // --- selection -------------------------------------------------------------------------------------------------

  /** Times met before the current conversation: the session's count while one is open. */
  private metOf(npcId: string): number {
    return this.session?.npcId === npcId ? this.session.met : this.metBefore(npcId);
  }

  /** The bye every Leave of the current conversation leads to, picked once per conversation; else the best now. */
  private byeFor(npcId: string): LineDef | null {
    const s = this.session;
    if (!s || s.npcId !== npcId) return this.best(npcId, 'bye')?.line ?? null;
    if (s.bye === undefined) s.bye = this.best(npcId, 'bye')?.line ?? null;
    return s.bye;
  }

  /** Times met before this conversation; a 'talk' event emitted for it before `open` (same tick) is not counted. */
  private metBefore(npcId: string): number {
    const m = this.ctx.state.npc[npcId];
    if (!m) return 0;
    return m.met > 0 && m.lastMet === now(this.ctx) ? m.met - 1 : m.met;
  }

  /** The best-scoring eligible line of the slot, or null. */
  private best(npcId: string, slot: LineDef['slot']): { line: LineDef; score: number } | null {
    const npc = this.ctx.book[npcId];
    if (!npc) return null;
    const met = this.metOf(npcId);
    let best: { line: LineDef; score: number } | null = null;
    for (const l of npc.lines) {
      if (l.slot !== slot || !holds(l.when, npc.persona, this.ctx, met)) continue;
      const v = score(l, npcId, this.ctx);
      if (v > -Infinity && (!best || v > best.score)) best = { line: l, score: v };
    }
    return best;
  }

  /** The eligible topic lines, best first (in the session's fixed order while a conversation is open). */
  private topicLines(npcId: string): LineDef[] {
    const npc = this.ctx.book[npcId];
    if (!npc) return [];
    const met = this.metOf(npcId);
    const scored: Array<{ line: LineDef; score: number }> = [];
    for (const l of npc.lines) {
      if (l.slot !== 'topic' || !holds(l.when, npc.persona, this.ctx, met)) continue;
      const v = score(l, npcId, this.ctx);
      if (v > -Infinity) scored.push({ line: l, score: v });
    }
    scored.sort((a, b) => b.score - a.score);
    const order = this.session?.npcId === npcId ? this.session.order : [];
    if (order.length) {
      const rank = (id: string) => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
      scored.sort((a, b) => rank(a.line.id) - rank(b.line.id));
    }
    return scored.map((x) => x.line);
  }

  /** The hub: every topic on offer (not this line, not said this conversation), the automatic choices, Leave. */
  private hub(npcId: string, lineId: string): ResolvedChoice[] {
    const npc = this.ctx.book[npcId];
    if (!npc) return [{ label: LEAVE_LABEL, action: { kind: 'close' } }];
    const met = this.metOf(npcId);
    const out: ResolvedChoice[] = [];
    for (const l of this.topicLines(npcId)) {
      if (l.id === lineId || this.session?.said.has(l.id)) continue;
      out.push({ label: this.labelFor(npc.lines, l, npcId, met), to: l.id, action: null });
    }
    const auto = typeof this.ctx.autoChoices === 'function' ? this.ctx.autoChoices(npcId) : this.ctx.autoChoices ?? [];
    for (const c of auto) if (holds(c.when, npc.persona, this.ctx, met)) out.push(this.choice(c));
    const bye = this.byeFor(npcId);
    out.push(bye ? { label: LEAVE_LABEL, to: bye.id, action: null } : { label: LEAVE_LABEL, action: { kind: 'close' } });
    return out;
  }

  /** A topic's label: a plain navigation choice elsewhere in the book that leads to it, else its first words. */
  private labelFor(lines: LineDef[], topic: LineDef, npcId: string, met: number): string {
    for (const l of lines) {
      for (const c of l.choices ?? []) {
        if (c.to === topic.id && !c.action && c.label.trim().split(/\s+/).length >= 2) return c.label;
      }
    }
    return firstWords(expand(topic.text, npcId, this.ctx, met));
  }

  private choice(c: Choice): ResolvedChoice {
    const out: ResolvedChoice = { label: c.label, action: c.action ? parseAction(c.action) : null };
    if (c.to !== undefined) out.to = c.to;
    if (c.when !== undefined) out.when = c.when;
    return out;
  }

  /** The line with its text expanded and its choices: its own (those whose `when` holds), else the hub when asked. */
  private resolve(npcId: string, line: LineDef, withHub: boolean): Resolved {
    const npc = this.ctx.book[npcId];
    const met = this.metOf(npcId);
    const text = expand(line.text, npcId, this.ctx, met);
    let choices = (line.choices ?? [])
      .filter((c) => !npc || holds(c.when, npc.persona, this.ctx, met))
      .map((c) => this.choice(c));
    if (withHub && choices.length === 0 && line.slot !== 'bye' && line.slot !== 'bark') choices = this.hub(npcId, line.id);
    return { line, text, choices };
  }
}

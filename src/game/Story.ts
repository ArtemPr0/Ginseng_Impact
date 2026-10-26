/**
 * The story: the NPCs speak from their dialogue books (data/dialogue) through the Mind, and what the player picks
 * moves the world. A book's 'quest:<id>:<stage>' steps the quest along the Five Voices graph (data/quests.ts), which
 * pays exactly once through the wallet; the sack, the lick, the ale and the challenge go to the adventures (the
 * dialogue world); Trade, Hire and Send home are offered in every hub where they apply. A step that chains on inside
 * the quests (the fifth voice already held, the Warden slain before the King asked) can leave the line a choice leads
 * to written for a stage the quest has left: the talk then goes on with the best topic for the stage it is at. The
 * Story also lets the quests hear the bus (kills, pickups, feats), banners each quest given and finished, and has the
 * NPCs nearby bark at what just happened, one voice at a time. No three.js, no DOM: the game hands in what it needs
 * (StoryDeps; main.ts builds them).
 *
 * The world state (`deps.state`) must listen to the same bus, built before the Story (`new WorldState(events)`): it
 * then records each event before the Story hears it. A conversation is recorded as a 'talk' event after the mind has
 * read how often the two have met; one the game announced itself in the same tick (main.ts's F) is not sent again.
 */
import { DIALOGUE, type Choice, type Cond, type DialogueBook, type LineDef } from '../data/dialogue/index';
import { QUEST_ORDER, isAtLeast, questNode, rewardFor } from '../data/quests';
import { voiceUrl } from '../data/voices';
import type { Action } from './actions';
import { dialogueFor, type DialogueChoice, type DialogueNode, type DialogueStep, type DialogueWorld } from './Dialogue';
import type { Events, GameEvent } from './Events';
import { LEAVE_LABEL, Mind, eligible, score, type Resolved, type ResolvedChoice } from './Mind';
import type { QuestWallet, Quests } from './Quests';
import type { WorldState } from './WorldState';

export interface StoryDeps {
  /** The quest state (Adventures owns it). */
  quests: Quests;
  /** The world state, listening to `events` (built before the Story). */
  state: WorldState;
  /** The game's bus: the Story listens to it and announces the talks on it. */
  events: Events;
  /** The purse and the bag the quest graph charges and pays through (Adventures' wallet, on the inventory). */
  wallet: QuestWallet;
  /** The sack, the lick, the ale, the challenge, the banners, and what the bag holds (Adventures' dialogue world). */
  dw: DialogueWorld;
  /** The NPC's shop is about to open (the HUD opens it on the 'trade' step the choice returns). */
  trade(npcId: string): void;
  /** Hires the NPC as a companion: 'full' (three already), 'poor' (short of shards), 'none' (not for hire). */
  hire(npcId: string): 'ok' | 'full' | 'poor' | 'none';
  /** Sends a following companion home; false when the NPC was not following. */
  dismiss(npcId: string): boolean;
  /** Whether the NPC can be hired at all (its def has a hire price). */
  isHireable(npcId: string): boolean;
  /** Whether the NPC follows the hero now (hired). */
  isFollowing(npcId: string): boolean;
  /** Whether the NPC keeps a shop. */
  hasShop(npcId: string): boolean;
  /** The books' 'follow': the NPC walks with the hero (the Pale Bride, to the shore). */
  follow(npcId: string): void;
  /** The NPCs within `r` metres of (x, z) that can show a speech bubble: nearest first, hidden ones left out. */
  npcsNear(x: number, z: number, r: number): Array<{ id: string; bubble(text: string): void }>;
  /** The books' 'journal:<text>': a note for the journal. */
  journal?(text: string): void;
  /** The Mind's selection jitter (seeded in tests; Math.random by default). */
  rnd?: () => number;
  /** Where the hero is (the barks at a hurt or a feat are heard from there); without it only kills are barked at. */
  playerAt?(): { x: number; z: number };
  /** The NPC's hire price, shown on the Hire choice. */
  hireCost?(npcId: string): number | undefined;
  /** How many companions follow the hero (the books' `companions` condition). */
  companions?(): number;
  /** The dialogue books (DIALOGUE by default; tests hand in their own). */
  book?: DialogueBook;
}

/** How far an NPC hears what happened: from where a kill fell, or from the hero for a hurt or a feat (metres). */
export const BARK_RANGE = { kill: 25, hurt: 12, feat: 8 } as const;
/** The feats people bark at. */
export const BARK_FEATS: ReadonlySet<string> = new Set(['fly', 'attack']);
/** Seconds an NPC keeps quiet after a bark. */
export const BARK_REST = 20;
/** Seconds after any bark before anyone barks again: in a crowd the hurts and kills do not go round every mouth. */
export const BARK_GAP = 5;

export const TRADE_LABEL = 'Trade';
export const HIRE_LABEL = 'Hire';
export const HOME_LABEL = 'Send home';
/** What an NPC answers a hire with, by how it went. */
export const HIRE_LINES: Record<ReturnType<StoryDeps['hire']>, string> = {
  ok: 'Lead on. I follow.',
  full: 'You already have three at your back. Come for me another time.',
  poor: 'Come back when your purse is heavier.',
  none: 'I am not for hire.',
};
/** A companion sent home. */
export const HOME_LINE = 'Home, then. I know the way.';
/** A step or a payment the purse cannot cover. */
export const SHORT_LINE = 'Come back when your purse is heavier.';
/** A 'take:<item>' for something the hero does not carry. */
export const MISSING_LINE = 'You do not have it.';

/**
 * The books' 'follow' (the Pale Bride walks with you) as the graph's bride trigger reads it: a feat. The bus's Feat has
 * no 'follow', so it never goes on the bus; the quests are handed it directly.
 */
const FOLLOW = { kind: 'feat', what: 'follow' } as unknown as GameEvent;

/** Every item the books' conditions ask after (`item`, `notItem`, on lines and on choices). */
function bookItems(book: DialogueBook): string[] {
  const out = new Set<string>();
  const add = (c: Cond | undefined): void => {
    if (c?.item) out.add(c.item);
    if (c?.notItem) out.add(c.notItem);
  };
  for (const npc of Object.values(book)) {
    for (const line of npc.lines) {
      add(line.when);
      for (const c of line.choices ?? []) add(c.when);
    }
  }
  return Array.from(out);
}

export class Story {
  readonly mind: Mind;
  private readonly book: DialogueBook;
  /** The items the books ask after, kept in the world state from `dw.has` (the bag is the game's). */
  private readonly itemIds: string[];
  /** When each NPC last barked (world-state seconds). */
  private readonly barkedAt = new Map<string, number>();
  /** When anyone last barked. */
  private lastBark = -Infinity;
  /** The talk open now: whom with, and how often the two had met before it (what the mind's conditions read). */
  private talk: { npcId: string; met: number } | null = null;
  private readonly off: () => void;

  constructor(private readonly d: StoryDeps) {
    this.book = d.book ?? DIALOGUE;
    this.itemIds = bookItems(this.book);
    this.mind = new Mind({ state: d.state, quests: d.quests, book: this.book, rnd: d.rnd, autoChoices: (id) => this.autoChoices(id) });
    // The chains a talk's step sets off count the bosses the world state knows (Elowen's three).
    d.quests.bossCount = () => Object.keys(d.state.bossesSlain).length;
    this.off = d.events.onAny((e) => this.hear(e));
  }

  /** Stops listening to the bus. */
  dispose(): void {
    this.off();
  }

  /**
   * The conversation with `npcId` as the HUD draws it: what the NPC says first (the mind's greet, a reaction behind it,
   * the hub of topics with Trade/Hire/Send home and Leave), every choice running its action and then following the
   * book to the next line ('close' when there is none). Someone without a book falls back to Dialogue.ts (the
   * rowers); null when there is nothing to say (the caller shows the NPC's ordinary lines).
   */
  open(npcId: string): DialogueNode | null {
    if (!Object.hasOwn(this.book, npcId)) {
      const node = dialogueFor(npcId, this.d.dw);
      if (node) this.talked(npcId);
      return node;
    }
    this.sync();
    this.talk = { npcId, met: this.metBefore(npcId) };
    const conv = this.mind.open(npcId);
    this.talked(npcId);
    return this.node(npcId, conv.first);
  }

  /**
   * The nearest NPCs with a book react to what just happened: a kill within 25 m of where it fell, a hurt within 12 m
   * of the hero, a flight or a swing within 8 m. The first whose mind has a bark for it says it in a bubble: one bubble
   * per event at most, none within 5 s of the last one anyone said (a crowd does not answer every blow in turn), and no
   * NPC barks twice within 20 s.
   */
  bark(e: GameEvent): void {
    const at = this.heardAt(e);
    if (!at) return;
    const now = this.d.state.time;
    // (A bark "in the future" is from before a save was loaded: it no longer counts.)
    const quiet = (last: number | undefined, rest: number) => last !== undefined && now >= last && now - last < rest;
    if (quiet(this.lastBark, BARK_GAP)) return;
    for (const n of this.d.npcsNear(at.x, at.z, at.r)) {
      if (!Object.hasOwn(this.book, n.id) || quiet(this.barkedAt.get(n.id), BARK_REST)) continue;
      const r = this.mind.bark(n.id, e);
      if (!r) continue;
      this.barkedAt.set(n.id, now);
      this.lastBark = now;
      n.bubble(r.text);
      return;
    }
  }

  /** Per step: the world state's clock. */
  update(dt: number): void {
    this.d.state.tick(dt);
  }

  // --- the bus -----------------------------------------------------------------------------------------------------

  /** Everything on the bus: the quests hear kills, pickups and feats (they settle their own steps' chains). */
  private hear(e: GameEvent): void {
    if (e.kind === 'kill' || e.kind === 'loot' || e.kind === 'feat') this.d.quests.onEvent(e, this.bosses(e), this.d.wallet);
    else if (e.kind === 'quest') this.banner(e.id, e.stage);
    if (e.kind === 'kill' || e.kind === 'hurt' || e.kind === 'feat') this.bark(e);
  }

  /** Different bosses slain, this kill included whether or not the world state has heard it yet. */
  private bosses(e: GameEvent): number {
    const slain = this.d.state.bossesSlain;
    const n = Object.keys(slain).length;
    return e.kind === 'kill' && e.boss && !Object.hasOwn(slain, e.enemy) ? n + 1 : n;
  }

  /**
   * A quest given ("Quest · title", as it leaves 'none') or finished ("title · complete"); the steps between show in
   * the tracker. Stepping back into a first stage is no new quest: Croak climbing out of the sack, a loaded save's
   * sack too (the quests know what each step left, so no talk or frame has to look first).
   */
  private banner(id: string, stage: string): void {
    const node = questNode(id);
    if (!node || !node.order.includes(stage)) return;
    if (node.stages[stage].terminal) this.d.dw.announce(`${node.title} · complete`);
    else if (!this.d.quests.isGiven(id) && node.order.indexOf(stage) === 1) this.d.dw.announce(`Quest · ${node.title}`);
  }

  /** Where an event is heard from, and how far: null for one nobody barks at (or nowhere to hear it from). */
  private heardAt(e: GameEvent): { x: number; z: number; r: number } | null {
    if (e.kind === 'kill') return { x: e.at.x, z: e.at.z, r: BARK_RANGE.kill };
    if (e.kind !== 'hurt' && !(e.kind === 'feat' && BARK_FEATS.has(e.what))) return null;
    const p = (e.kind === 'feat' ? e.at : undefined) ?? this.d.playerAt?.();
    return p ? { x: p.x, z: p.z, r: e.kind === 'hurt' ? BARK_RANGE.hurt : BARK_RANGE.feat } : null;
  }

  /**
   * The conversation on the bus, after the mind has read how often the two have met; not again when the game already
   * announced this one (the same NPC, this very tick: the mind counted that one out the same way).
   */
  private talked(npcId: string): void {
    const s = this.d.state;
    if (s.lastTalked === npcId && s.npc[npcId]?.lastMet === s.time) return;
    this.d.events.emit({ kind: 'talk', npc: npcId });
  }

  // --- the conversation --------------------------------------------------------------------------------------------

  /** The world state the books' conditions read, brought up to date: the purse, the items they ask after, the party. */
  private sync(): void {
    const s = this.d.state;
    s.setShards(this.d.wallet.shards());
    for (const id of this.itemIds) {
      if (this.d.dw.has(id)) s.items.add(id);
      else s.items.delete(id);
    }
    if (this.d.companions) s.setCompanions(this.d.companions());
  }

  /** The hub's automatic choices: Trade at a shop; Send home for a companion, else Hire for one who can be hired. */
  private autoChoices(npcId: string): Choice[] {
    const d = this.d;
    const out: Choice[] = [];
    if (d.hasShop(npcId)) out.push({ label: TRADE_LABEL, action: 'trade' });
    if (d.isFollowing(npcId)) out.push({ label: HOME_LABEL, action: 'home' });
    else if (d.isHireable(npcId)) {
      const cost = d.hireCost?.(npcId);
      out.push({ label: cost === undefined ? HIRE_LABEL : `${HIRE_LABEL} · ◆ ${cost}`, action: 'hire' });
    }
    return out;
  }

  /** A resolved line as the HUD's node: the expanded text, its recording, its choices (a closing line gets a Leave). */
  private node(npcId: string, r: Resolved): DialogueNode {
    const choices = r.choices.map((c) => this.choice(npcId, c));
    const node: DialogueNode = { line: r.text, choices: choices.length ? choices : [{ label: LEAVE_LABEL }] };
    if (r.line.voice) node.voice = voiceUrl(r.line.voice);
    return node;
  }

  private choice(npcId: string, c: ResolvedChoice): DialogueChoice {
    return { label: c.label, run: () => this.run(npcId, c) };
  }

  /** A choice picked: its action first (it may end the talk or answer in a line of its own), then the line it leads to. */
  private run(npcId: string, c: ResolvedChoice): DialogueStep {
    let next: Resolved | null;
    if (c.action) {
      const before = this.d.quests.snapshot();
      const step = this.act(npcId, c.action, c);
      // The next line's conditions see what the action changed (the purse, the bag).
      this.sync();
      if (step !== null) return step;
      next = this.after(npcId, c, before);
    } else {
      next = this.mind.choose(npcId, c);
    }
    return next ? this.node(npcId, next) : 'close';
  }

  /**
   * Where a choice goes once its action has run: the line the book names, while its `when` holds. A step can chain on
   * inside the quests (the fifth voice already held moves 'silence' on past 'told'; the Warden or the Grave Cyclops
   * slain before the quest was given moves it on past 'active'), leaving that line written for a stage the quest has
   * left: the talk then goes on with the best topic for where the quests are now, one about the quest the choice
   * stepped (or that its step moved on) before any other, and ends when there is none. Only after an action: a choice
   * that only leads somewhere follows the book as written (the Stone Head says where to begin before you take it on).
   */
  private after(npcId: string, c: ResolvedChoice, before: Record<string, string>): Resolved | null {
    const to = c.to === undefined ? undefined : this.book[npcId]?.lines.find((l) => l.id === c.to);
    if (!to || eligible(to, npcId, this.mind.ctx, this.metIn(npcId))) return this.mind.choose(npcId, c);
    const now = this.d.quests.snapshot();
    const about = new Set<string>(QUEST_ORDER.filter((id) => now[id] !== before[id]));
    if (c.action?.kind === 'quest') about.add(c.action.id);
    const line = this.bestTopic(npcId, about);
    return line ? this.mind.choose(npcId, { to: line.id }) : null;
  }

  /**
   * The topic the NPC would take up now, scored as the mind scores its hub (one said lately ranks low, a `once` line
   * said is out), one about a quest in `about` before any other; null when it has none.
   */
  private bestTopic(npcId: string, about: ReadonlySet<string>): LineDef | null {
    const ctx = this.mind.ctx;
    const met = this.metIn(npcId);
    let best: { line: LineDef; ours: boolean; score: number } | null = null;
    for (const line of this.book[npcId]?.lines ?? []) {
      if (line.slot !== 'topic' || !eligible(line, npcId, ctx, met)) continue;
      const v = score(line, npcId, ctx);
      if (v === -Infinity) continue;
      const q = line.when?.quest?.[0];
      const ours = q !== undefined && about.has(q);
      if (!best || (ours && !best.ours) || (ours === best.ours && v > best.score)) best = { line, ours, score: v };
    }
    return best?.line ?? null;
  }

  /**
   * Times met before the talk with `npcId` opening now, counted as the mind counts them (Mind's metBefore): a talk the
   * game announced this very tick is this one.
   */
  private metBefore(npcId: string): number {
    const m = this.d.state.npc[npcId];
    if (!m) return 0;
    return m.met > 0 && m.lastMet === this.d.state.time ? m.met - 1 : m.met;
  }

  /** The meeting count the talk open with `npcId` reads its conditions with (the mind's, for that talk). */
  private metIn(npcId: string): number {
    return this.talk?.npcId === npcId ? this.talk.met : this.metBefore(npcId);
  }

  /** Does what the action says; returns where the talk goes instead of the choice's line, or null to go on to it. */
  private act(npcId: string, a: Action, c: ResolvedChoice): DialogueStep | null {
    const d = this.d;
    switch (a.kind) {
      case 'close': return 'close';
      case 'trade': d.trade(npcId); return 'trade';
      case 'hire': return this.say(HIRE_LINES[d.hire(npcId)] ?? HIRE_LINES.none);
      case 'home': return d.dismiss(npcId) && c.to === undefined ? this.say(HOME_LINE) : null;
      case 'quest': return this.quest(a.id, a.stage);
      case 'pay': return d.wallet.spend(a.n) ? null : this.say(SHORT_LINE);
      case 'reward': d.wallet.pay(a.n); return null;
      case 'give': d.wallet.give(a.item); return null;
      case 'take': return d.wallet.take(a.item) ? null : this.say(MISSING_LINE);
      case 'flag': d.state.flags.add(a.flag); return null;
      case 'journal': d.journal?.(a.text); return null;
      case 'lick': d.dw.lick(); return null;
      case 'ale': d.dw.drinkAle(); return null;
      case 'challenge': d.dw.challengeKing(); return null;
      case 'bag-croak': d.dw.bagCroak(); return null;
      case 'follow': d.follow(npcId); d.quests.onEvent(FOLLOW, this.bosses(FOLLOW), d.wallet); return null;
    }
  }

  /**
   * A book's quest step, taken through the wallet. The books only step forward: with the quest at that stage or past
   * it already (a choice clicked twice, a line left open, an earlier stage's offer) the talk goes on (`after`) and
   * nothing is paid or moved back (Croak's way back to 'active' is the sack's, never a line's). Short of what the step
   * charges: the NPC says so and the talk stops there. Refused by the graph otherwise: the talk closes.
   */
  private quest(id: string, stage: string): DialogueStep | null {
    const q = this.d.quests;
    if (isAtLeast(q.snapshot(), id, stage)) return null;
    if (q.step(id, stage, this.d.wallet)) return null;
    const charge = rewardFor(id, stage, q.stage(id))?.charge ?? 0;
    if (charge > this.d.wallet.shards()) return this.say(SHORT_LINE);
    console.warn(`[story] quest:${id}:${stage} refused at '${q.stage(id)}'`);
    return 'close';
  }

  /** A line of the Story's own (an answer to a hire, a purse too light), then Leave. */
  private say(line: string): DialogueNode {
    return { line, choices: [{ label: LEAVE_LABEL }] };
  }
}

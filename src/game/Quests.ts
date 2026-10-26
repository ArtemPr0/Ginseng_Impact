/**
 * Quest state on the Five Voices graph (data/quests.ts): each quest is at one of its stages ('none' until it is
 * given). A step goes the way the graph's header says: `canStep` from the stage the quest is at, then what entering
 * the stage charges and pays (the charge first, failing softly when short; then take, give, shards), then the stage,
 * announced on the bus once. A step to the stage the quest is already at pays and announces nothing. Kills, pickups
 * and feats move quests through the graph's triggers (`onEvent`), and every step settles the chains it sets off (the
 * fifth voice moves 'silence' on). The tracker and the journal read the graph. Pure: no DOM, no Three.js.
 */
import type { Events, GameEvent } from './Events';
import {
  QUEST_ORDER, canStep, journal, questNode, rewardFor, stageIndex, triggersFor, voicesHeld, type JournalEntry, type QuestId,
  type Reward,
} from '../data/quests';

export type { QuestId } from '../data/quests';

/** What a step charges and pays through: the player's purse and bag (Adventures builds one on the inventory). */
export interface QuestWallet {
  /** Moon Shards carried. */
  shards(): number;
  /** Takes `n` shards; false, and nothing taken, when the player has fewer. */
  spend(n: number): boolean;
  /** Takes one of the item out of the bag; false when none is loose. */
  take(item: string): boolean;
  /** Puts one of the item in the bag. */
  give(item: string): void;
  /** Pays the player `n` shards. */
  pay(n: number): void;
}

const ORIGIN = { x: 0, y: 0, z: 0 };

/** The kinds of event that can move a quest: kills, pickups, feats and other quests' steps. */
const MOVES: ReadonlySet<GameEvent['kind']> = new Set<GameEvent['kind']>(['kill', 'loot', 'feat', 'quest']);

export class Quests {
  private readonly stages = new Map<QuestId, string>();
  /** Every enemy kind killed so far: a quest given after its kill still counts it (the graph's `past` triggers). */
  private readonly killed = new Set<string>();
  /** The bosses count `onEvent` was last given (what `bossCount` answers until someone wires the world state in). */
  private lastBosses = 0;
  /** Called after any change (the HUD redraws the tracker). */
  onChange: (() => void) | null = null;
  /** The bus every step is announced on (`quest {id, stage}`); the integration sets it. */
  events: Events | null = null;
  /**
   * What pays the steps nobody hands a wallet to: `kill`, `start`, and `onEvent` called without one. Adventures sets
   * it to its own (the inventory), so a kill's reward (the Third Eye, the Grave Crown, Yung Lean's purse) is paid.
   */
  wallet: QuestWallet | null = null;
  /** How many different bosses have been slain, for the chains a step sets off (the Story reads the world state). */
  bossCount: () => number = () => this.lastBosses;
  /** The step whose 'quest' event is going out on the bus now, and the stage it left. */
  private stepping: { id: QuestId; from: string } | null = null;

  /** The stage quest `id` is at ('none' until given, and for a name that is no quest). */
  stage(id: string): string {
    return this.stages.get(id as QuestId) ?? 'none';
  }

  /**
   * The header's recipe: when `canStep` allows `to` from the stage the quest is at (with every quest's stage, for a
   * stage's `requires`), apply what entering it costs and pays through `wallet` (the charge first: short of shards,
   * the step fails softly and nothing changes; then take, give, shards), then set the stage, announce it and settle
   * what it sets off. A step to the stage the quest is already at (a finished quest's last choice taken again, waking
   * from another lick) holds, but pays and announces nothing. False when the graph refuses the step or the charge
   * cannot be paid.
   */
  step(id: string, to: string, wallet: QuestWallet | null): boolean {
    return this.advance(id, to, wallet, false);
  }

  /**
   * Moves the quests an event moves (data/quests.ts `triggersFor`): a kill (also logged, for quests given later), a
   * pickup, a feat, another quest's step. Each is a step as `step` takes it, through `wallet` (unless the trigger is
   * `unpaid`); one that an earlier step of the same event already moved on is skipped. `bossesSlain` is how many
   * different bosses have fallen, this event's included. Other kinds of event move nothing.
   */
  onEvent(e: GameEvent, bossesSlain: number, wallet: QuestWallet | null = this.wallet): void {
    if (!MOVES.has(e.kind)) return;
    this.lastBosses = bossesSlain;
    if (e.kind === 'kill') this.killed.add(e.enemy);
    for (const t of triggersFor(e, this.snapshot(), bossesSlain, this.killed)) {
      if (this.stage(t.id) !== t.from) continue;
      this.advance(t.id, t.to, wallet, t.unpaid === true);
    }
  }

  /** An enemy of `kind` died (the combat's onKill): logged, and whatever it moves moved, paid through `wallet`. */
  kill(kind: string): void {
    this.onEvent({ kind: 'kill', enemy: kind, boss: false, at: ORIGIN }, this.bossCount());
  }

  /**
   * Puts quest `id` at `stage` without paying anything: the old setter, for callers outside the graph's steps (headless
   * scripts jumping ahead). A jump the graph does not allow is logged and taken all the same; a quest or stage the
   * graph does not have is refused (nothing could ever move it on). Announced like any step; it settles nothing.
   */
  set(id: string, stage: string): void {
    const node = questNode(id);
    if (!node || stageIndex(id, stage) < 0) {
      console.warn(`[quests] '${id}' has no stage '${stage}'`);
      return;
    }
    const from = this.stage(id);
    if (from === stage) return;
    if (!canStep(id, from, stage, this.snapshot())) console.warn(`[quests] ${id}: ${from} → ${stage} is not a step of the graph (set anyway)`);
    this.put(node.id, stage, from);
  }

  /** Gives quest `id` at `stage` (as `set`), then lets it move on at once: a kill made before it was given counts. */
  start(id: string, stage: string): void {
    this.set(id, stage);
    if (this.stage(id) === stage) this.onEvent({ kind: 'quest', id, stage }, this.bossCount());
  }

  /**
   * Whether quest `id` has been given (it is past 'none'). While its own step is being announced, whether it had been
   * before that step: a listener to the 'quest' event tells a quest just given (false) from one taken up again (Croak
   * climbing out of the sack: true), a loaded save's included (restore announces nothing; its stages are what count).
   */
  isGiven(id: string): boolean {
    if (this.stepping?.id === id) return this.stepping.from !== 'none';
    return this.stage(id) !== 'none';
  }

  /** True while the quest is given and not finished. */
  active(id: string): boolean {
    const node = questNode(id);
    const s = this.stage(id);
    return !!node && s !== 'none' && node.order.includes(s) && node.stages[s].terminal !== true;
  }

  /** The tracker: every quest in progress with its current objective, the main story first. */
  tracker(): Array<{ title: string; objective: string }> {
    return this.journal().filter((j) => !j.done).map((j) => ({ title: j.title, objective: j.objective }));
  }

  /** The journal (data/quests.ts `journal`): every quest given, main first, in progress before done, with markers. */
  journal(): JournalEntry[] {
    return journal(this.snapshot());
  }

  /** The voices earned so far, in the Stone Head's order. */
  voices(): string[] {
    return voicesHeld(this.snapshot());
  }

  /**
   * The dormant enemies the quests have woken: the `wakes` of every stage each quest has reached (the Hollow King from
   * silence 'open' on). A step announces its own; after `restore`, which announces nothing, the game wakes these.
   */
  woken(): string[] {
    const out: string[] = [];
    for (const id of QUEST_ORDER) {
      const node = questNode(id);
      if (!node) continue;
      for (const s of node.order.slice(0, node.order.indexOf(this.stage(id)) + 1)) {
        const kind = node.stages[s].wakes;
        if (kind && !out.includes(kind)) out.push(kind);
      }
    }
    return out;
  }

  /** Every quest's stage, in the graph's order (the save; the graph's own functions read this). */
  snapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const id of QUEST_ORDER) out[id] = this.stage(id);
    return out;
  }

  /**
   * Sets the stages from a snapshot without any step firing (no triggers, no rewards: the save already holds what
   * they gave). Unknown quests are ignored, and so is a stage the quest does not have (no step would ever move it on,
   * so the quest would be stuck there): it stays at 'none'. onChange fires once at the end.
   */
  restore(s: Record<string, string>): void {
    this.stages.clear();
    for (const [id, stage] of Object.entries(s)) {
      const node = questNode(id);
      if (!node || typeof stage !== 'string' || stageIndex(node.id, stage) <= 0) continue;
      this.stages.set(node.id, stage);
    }
    this.onChange?.();
  }

  /** The kinds killed so far (the kill log a save keeps, so a quest given later still counts them). */
  slain(): string[] {
    return Array.from(this.killed);
  }

  /** Puts the kill log back (replacing it) without moving any quest. */
  restoreSlain(list: readonly string[]): void {
    this.killed.clear();
    for (const kind of list) if (typeof kind === 'string') this.killed.add(kind);
  }

  /** `step`, or a trigger's step (`unpaid`: the stage's reward is skipped). */
  private advance(id: string, to: string, wallet: QuestWallet | null, unpaid: boolean): boolean {
    const node = questNode(id);
    if (!node) return false;
    const from = this.stage(node.id);
    if (!canStep(node.id, from, to, this.snapshot())) return false;
    const r = unpaid ? undefined : rewardFor(node.id, to, from);
    if (r && !this.settle(node.id, to, r, wallet)) return false;
    if (from === to) return true;
    this.put(node.id, to, from);
    // The chains the step sets off: the stages it completes, the kills made before it was given, the bosses counted.
    this.onEvent({ kind: 'quest', id: node.id, stage: to }, this.bossCount(), wallet);
    return true;
  }

  /** What entering a stage costs and pays, in the header's order; false (nothing changed) when the charge fails. */
  private settle(id: QuestId, to: string, r: Reward, wallet: QuestWallet | null): boolean {
    if (!wallet) {
      // Nothing to charge from: refused. Nothing to pay into: the step goes on, unpaid, and says so.
      if (r.charge) return false;
      console.warn(`[quests] ${id} → ${to}: no wallet, its reward goes unpaid`);
      return true;
    }
    if (r.charge && !wallet.spend(r.charge)) return false;
    for (const item of r.take ?? []) wallet.take(item);
    for (const item of r.give ?? []) wallet.give(item);
    if (r.shards) wallet.pay(r.shards);
    return true;
  }

  /** Sets the stage and tells the HUD and the bus (whose listeners can ask `isGiven` what it was before). */
  private put(id: QuestId, stage: string, from: string): void {
    this.stages.set(id, stage);
    this.onChange?.();
    const outer = this.stepping;
    this.stepping = { id, from };
    this.events?.emit({ kind: 'quest', id, stage });
    this.stepping = outer;
  }
}

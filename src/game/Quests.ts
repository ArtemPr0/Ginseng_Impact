/**
 * Quest state: each quest is at one named stage ('none' until it is given, 'done' once rewarded); the tracker shows
 * the objective of every quest in between. Pure: no DOM, no Three.js. Kills and items move quests along.
 */
import type { Events } from './Events';

export type QuestId = 'throne' | 'croak' | 'lean' | 'sound' | 'trip' | 'crown';

export interface QuestDef {
  id: QuestId;
  title: string;
  /** Objective shown in the tracker for each stage the quest can be at. */
  objectives: Record<string, string>;
}

export const QUESTS: Record<QuestId, QuestDef> = {
  throne: {
    id: 'throne', title: 'The Usurped Throne',
    objectives: {
      active: 'Slay the Antlered Warden in the east forest',
      slain: 'Return to the Antlered King on his throne',
    },
  },
  croak: {
    id: 'croak', title: 'The Prodigal Croak',
    objectives: {
      active: 'Find Croak, the Frog King\'s son',
      bagged: 'Carry Croak back to the Frog King (F to drop the bag)',
      returned: 'Speak with the Frog King',
    },
  },
  sound: {
    id: 'sound', title: 'The Lost Sound',
    objectives: {
      active: 'Go into the mist over the lean cups and bring back the sound',
      found: 'Bring the sound back to Yung Lean',
    },
  },
  // Not a quest you are given: 'done' once you have woken from the Frog King's dream (he lets you back in after).
  trip: { id: 'trip', title: "The Frog King's Dream", objectives: {} },
  // Not given either: 'done' once you have beaten Yung Lean (his purse is paid once).
  crown: { id: 'crown', title: 'Challenge the King', objectives: {} },
  lean: {
    id: 'lean', title: 'Find Yung Lean',
    objectives: {
      active: 'Find Yung Lean beyond the portal and bring back a signed cup',
      signed: 'Bring the signed cup to Goldgrin\'s brother in the tree house',
    },
  },
};

/** What kills move along: enemy kind → quest stage it completes. */
const KILL_STEPS: Array<{ kind: string; quest: QuestId; from: string; to: string }> = [
  { kind: 'warden', quest: 'throne', from: 'active', to: 'slain' },
];

/** The stages quest `id` can be at besides 'none': its objectives' and 'done' (just 'done' for the flag-like trip and crown). */
const knownStage = (id: QuestId, stage: unknown): stage is string => stage === 'done' || (typeof stage === 'string' && Object.hasOwn(QUESTS[id].objectives, stage));

export class Quests {
  private readonly stages = new Map<QuestId, string>();
  /** Called after any change (the HUD redraws the tracker). */
  onChange: (() => void) | null = null;
  /** The bus every step is announced on (`quest {id, stage}`); the integration sets it. */
  events: Events | null = null;

  stage(id: QuestId): string {
    return this.stages.get(id) ?? 'none';
  }

  set(id: QuestId, stage: string): void {
    if (this.stage(id) === stage) return;
    this.stages.set(id, stage);
    this.onChange?.();
    this.events?.emit({ kind: 'quest', id, stage });
  }

  /** True while the quest is given and not finished. */
  active(id: QuestId): boolean {
    const s = this.stage(id);
    return s !== 'none' && s !== 'done';
  }

  /** Kinds slain before their quest was given (the quest starts already done with that step). */
  private readonly killed = new Set<string>();

  /** An enemy of `kind` died. */
  kill(kind: string): void {
    this.killed.add(kind);
    for (const k of KILL_STEPS) if (k.kind === kind && this.stage(k.quest) === k.from) this.set(k.quest, k.to);
  }

  /** Gives quest `id` at `stage`, moved on at once by any kill made before it was given. */
  start(id: QuestId, stage: string): void {
    this.set(id, stage);
    for (const k of KILL_STEPS) if (k.quest === id && k.from === stage && this.killed.has(k.kind)) this.set(id, k.to);
  }

  /** Every quest's stage (the flag-like ones too: trip, crown), for the save. */
  snapshot(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const id of Object.keys(QUESTS) as QuestId[]) out[id] = this.stage(id);
    return out;
  }

  /**
   * Sets the stages from a snapshot without any step firing (no kill steps, no rewards: the save already holds what
   * they gave). Unknown quests are ignored, and so is a stage the quest does not have (no dialogue path would ever
   * move it on, so the quest would be stuck there): it stays at 'none'. onChange fires once at the end.
   */
  restore(s: Record<string, string>): void {
    this.stages.clear();
    for (const [id, stage] of Object.entries(s)) {
      if (!Object.hasOwn(QUESTS, id) || !knownStage(id as QuestId, stage)) continue;
      this.stages.set(id as QuestId, stage);
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

  /** The tracker: every quest in progress with its current objective. */
  tracker(): Array<{ title: string; objective: string }> {
    const out: Array<{ title: string; objective: string }> = [];
    for (const def of Object.values(QUESTS)) {
      const s = this.stage(def.id);
      const objective = def.objectives[s];
      if (objective) out.push({ title: def.title, objective });
    }
    return out;
  }
}

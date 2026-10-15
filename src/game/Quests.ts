/**
 * Quest state: each quest is at one named stage ('none' until it is given, 'done' once rewarded); the tracker shows
 * the objective of every quest in between. Pure: no DOM, no Three.js. Kills and items move quests along.
 */
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

export class Quests {
  private readonly stages = new Map<QuestId, string>();
  /** Called after any change (the HUD redraws the tracker). */
  onChange: (() => void) | null = null;

  stage(id: QuestId): string {
    return this.stages.get(id) ?? 'none';
  }

  set(id: QuestId, stage: string): void {
    if (this.stage(id) === stage) return;
    this.stages.set(id, stage);
    this.onChange?.();
  }

  /** True while the quest is given and not finished. */
  active(id: QuestId): boolean {
    const s = this.stage(id);
    return s !== 'none' && s !== 'done';
  }

  /** Kinds slain before their quest was given (the quest starts already done with that step). */
  private readonly slain = new Set<string>();

  /** An enemy of `kind` died. */
  kill(kind: string): void {
    this.slain.add(kind);
    for (const k of KILL_STEPS) if (k.kind === kind && this.stage(k.quest) === k.from) this.set(k.quest, k.to);
  }

  /** Gives quest `id` at `stage`, moved on at once by any kill made before it was given. */
  start(id: QuestId, stage: string): void {
    this.set(id, stage);
    for (const k of KILL_STEPS) if (k.quest === id && k.from === stage && this.slain.has(k.kind)) this.set(id, k.to);
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

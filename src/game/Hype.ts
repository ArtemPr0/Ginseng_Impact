/**
 * The game's hype man (the user, 2026-11-12: "make it dopamine based and satisfying ... in fact it needs to be
 * hilarious"): combo tiers called out as the streak climbs, multi-kills named, overkills spotted, and silly titles
 * earned for things the player does. Pure: no three.js, no DOM; CombatSystem and main.ts show and sound them.
 */
import type { GameEvent } from './Events';

export interface Callout {
  text: string;
  /** 1 (a nudge) .. 6 (the screen should shake): drives the callout's size, colour and sound. */
  tier: number;
}

/** Combo milestones: the streak count each is called at. */
export const COMBO_TIERS: ReadonlyArray<{ at: number; text: string }> = [
  { at: 5, text: 'Spicy!' },
  { at: 10, text: 'Saucy!!' },
  { at: 20, text: 'Unhinged' },
  { at: 35, text: 'Absolutely Leaned' },
  { at: 50, text: 'Frog-Licking Mad' },
  { at: 75, text: 'Somebody Call An Adult' },
  { at: 100, text: 'GINSENG IMPACT' },
];

/** Kills within this many seconds of the last make a chain. */
const CHAIN = 1.8;
const MULTI = ['', '', 'Double Tap!', 'Triple Sip!', 'Quad Squad!', 'PENTA?! In this economy?'];

/** Said over a body blown far past dead (picked at random). */
export const OVERKILL_QUIPS = [
  'Yeet.', 'Bonk.', 'OVERKILL', 'Sent to the shadow realm', 'Reduced to atoms', 'Rest in pieces', 'He had a family. Probably.',
  'Ow.', 'Absolutely deleted', 'Return to sender', 'No refunds', 'Gravity disagrees',
];

/** A blow of three times what the body had left, or more. */
export function isOverkill(damage: number, hpBefore: number): boolean {
  return hpBefore > 0 && damage >= hpBefore * 3;
}

export class Hype {
  private nextTier = 0;
  private chain = 0;
  private lastKill = -Infinity;

  constructor(private readonly rand: () => number = Math.random) {}

  /** A hit landed and the streak is now `count`: the tier it just reached, if any. */
  hit(count: number): Callout | null {
    if (count <= 1) this.nextTier = 0;
    const t = COMBO_TIERS[this.nextTier];
    if (!t || count < t.at) return null;
    this.nextTier++;
    return { text: t.text, tier: Math.min(6, this.nextTier) };
  }

  /** A kill at time `t` (seconds): the multi-kill it makes, if any. */
  kill(t: number): Callout | null {
    this.chain = t - this.lastKill <= CHAIN ? this.chain + 1 : 1;
    this.lastKill = t;
    const n = this.chain;
    if (n < 2) return null;
    return { text: MULTI[n] ?? `Lean Machine ×${n}`, tier: Math.min(6, n) };
  }

  /** A line for an overkill. */
  overkill(): Callout {
    return { text: OVERKILL_QUIPS[Math.floor(this.rand() * OVERKILL_QUIPS.length) % OVERKILL_QUIPS.length], tier: 3 };
  }
}

export interface TitleDef {
  id: string;
  title: string;
  quip: string;
  /** What counts toward it, and how many. */
  count: (e: GameEvent) => boolean;
  need: number;
}

const feat = (what: string) => (e: GameEvent) => e.kind === 'feat' && e.what === what;
const kill = (e: GameEvent) => e.kind === 'kill';

/** Silly titles for things the player does (each earned once, shown as a toast). */
export const TITLES: readonly TitleDef[] = [
  { id: 'first-blood', title: 'Murderhobo', quip: 'They started it. Probably.', count: kill, need: 1 },
  { id: 'pest-control', title: 'Pest Control', quip: 'Ten down. The island is filing a complaint.', count: kill, need: 10 },
  { id: 'hr-concerns', title: 'HR Has Concerns', quip: 'Fifty. Please stop.', count: kill, need: 50 },
  { id: 'big-game', title: 'Big Game Hunter', quip: 'That was somebody\'s boss.', count: (e) => e.kind === 'kill' && e.boss, need: 1 },
  { id: 'skill-issue', title: 'Skill Issue', quip: 'The floor was very comfortable.', count: (e) => e.kind === 'wipe', need: 1 },
  { id: 'toad-licker', title: 'Toad Licker', quip: 'Tastes like regret and colours.', count: feat('lick'), need: 1 },
  { id: 'hydrated', title: 'Hydrated (Purple)', quip: 'Your doctor has questions.', count: feat('sip'), need: 5 },
  { id: 'finders-keepers', title: 'Finders Keepers', quip: 'It wasn\'t locked. That\'s basically an invitation.', count: feat('chest'), need: 1 },
  { id: 'critical-thinker', title: 'Critical Thinker', quip: 'Hit it where it hurts.', count: feat('crit'), need: 1 },
  { id: 'frequent-flyer', title: 'Frequent Flyer', quip: 'Legroom: infinite.', count: feat('fly'), need: 1 },
  { id: 'moist', title: 'Moist', quip: 'You will be damp for days.', count: feat('swim'), need: 1 },
  { id: 'boing', title: 'Boing Enthusiast', quip: 'Mushrooms: 1. Dignity: 0.', count: feat('bounce'), need: 3 },
  { id: 'untouchable', title: 'Untouchable-ish', quip: 'Twenty dodges. Mostly on purpose.', count: feat('dodge'), need: 20 },
  { id: 'overleveled', title: 'Probably Overleveled', quip: 'Level ten. Mobs are whispering.', count: feat('levelup'), need: 9 },
  { id: 'social', title: 'Social Butterfly', quip: 'You talk to everyone. Everyone.', count: (e) => e.kind === 'talk', need: 12 },
  { id: 'shiny', title: 'Shiny Hoarder', quip: 'Ooh. Shiny.', count: (e) => e.kind === 'loot' && e.rarity >= 3, need: 1 },
  { id: 'middle-management', title: 'Middle Management', quip: 'You hired someone to hit things for you.', count: (e) => e.kind === 'trade' && e.what === 'hire', need: 1 },
  { id: 'capitalist', title: 'Capitalist', quip: 'Sold. No refunds.', count: (e) => e.kind === 'trade' && e.what === 'sell', need: 5 },
  { id: 'climber', title: 'Wall Enjoyer', quip: 'Stairs are for cowards.', count: feat('climb'), need: 1 },
  { id: 'tourist', title: 'Tourist', quip: 'Wrong turn? There are no wrong turns.', count: (e) => e.kind === 'zone', need: 6 },
];

export class Titles {
  private readonly got = new Set<string>();
  private readonly counts = new Map<string, number>();

  constructor(earned: readonly string[] = []) {
    for (const id of earned) this.got.add(id);
  }

  /** Counts the event toward every title; the one it completes, if any (at most one per event). */
  on(e: GameEvent): TitleDef | null {
    let won: TitleDef | null = null;
    for (const d of TITLES) {
      if (this.got.has(d.id) || !d.count(e)) continue;
      const n = (this.counts.get(d.id) ?? 0) + 1;
      this.counts.set(d.id, n);
      if (n >= d.need && !won) { this.got.add(d.id); won = d; }
    }
    return won;
  }

  earned(): string[] {
    return [...this.got];
  }

  snapshot(): string[] {
    return this.earned();
  }
}

/** Coins picked up close behind one another ring higher and higher (a semitone a coin, an octave at most). */
export class CoinStreak {
  private step = -1;
  private last = -Infinity;
  /** The step of a coin picked up at time `t` (seconds): 0 after a pause of more than 1.2 s. */
  hit(t: number): number {
    this.step = t - this.last > 1.2 ? 0 : Math.min(12, this.step + 1);
    this.last = t;
    return this.step;
  }
}

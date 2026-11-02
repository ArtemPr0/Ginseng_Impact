/**
 * The ending of the Silent Kingdom, on silence 'ended' (the Hollow King dead). Pure: the timeline and its curves;
 * the caller (main.ts with world/Concert.ts) moves the camera, the lights and the people.
 *
 *  1. awaken (8 s): the camera rides from the hero to the Stone Head, whose eyes turn rune-cyan; every lit window
 *     brightens (×3.5 for six seconds), the face moon un-crescents and warms, the aurora goes full; the score plays
 *     'ending'.
 *  2. concert (16 s): a curtain, then the Lean Quarter: every NPC in the crowd in Yung Lean's hall and spilling out of
 *     its door onto the plaza, fireworks over the roof, the whale looping low; then down the nave to the throne,
 *     Goldgrin's "There he is.", and the song's title card (the game's own song).
 *  3. credits (a stepped scroll on a navy panel), then "Continue — New Game+": the mobs ×1.5, the bosses come back,
 *     the voices stay. Free roam.
 *  4. after-party: the crowd stays in the hall until the player leaves the kingdom; then everyone goes home.
 */
import type { Events } from './Events';

export type EndingPhase = 'idle' | 'awaken' | 'concert' | 'credits' | 'afterparty' | 'done';

/** Seconds of the Stone Head's awakening, and of the concert before the credits. */
export const AWAKEN_SECONDS = 8;
export const CONCERT_SECONDS = 16;
/** The concert's two shots: the plaza (fireworks, whale, the crowd at the door) until here, then the nave. */
export const PLAZA_SHOT = 6;
/** When Goldgrin says it, and when the title card shows and for how long (seconds into the concert). */
export const BUBBLE_AT = 7;
export const CARD_AT = 9;
export const CARD_SECONDS = 6;

/** The song Yung Lean plays (the Score's 'ending'): the game's own, never a real song's title. */
export const SONG = { artist: 'Yung Lean', title: 'Five Voices Home' };
/** What Goldgrin says when the king of the sad side of the world comes on. */
export const GOLDGRIN_LINE = 'There he is.';

/** New Game+: what the mobs get (CombatSystem.beginPlus applies it). */
export const PLUS = { hp: 1.5, atk: 1.5 } as const;

/** The credits, top to bottom. */
export const CREDITS: readonly string[] = [
  'GINSENG IMPACT',
  'The Silent Kingdom',
  '',
  'The five voices came home.',
  'The Stone Head opened its eyes.',
  'Yung Lean sang. The plaza heard him.',
  'Goldgrin found him.',
  '',
  'Sir Aldric · The Weary Sentinel',
  'Wren',
  'Orlan · Wizard of the Blue Mountain',
  '',
  'Every song in this game was synthesised by the game itself.',
  'The voices are the kingdom’s own.',
  '',
  'Thank you for playing.',
];

/** The label of the button under the credits. */
export const CONTINUE_LABEL = 'Continue — New Game+';

const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface AwakenLook {
  /** 0..1 along the camera's ride from the hero to the head. */
  dolly: number;
  /** 0 = the head's own blood-red eyes, 1 = rune-cyan. */
  eyes: number;
  /** The lit windows' multiplier (Materials.WINDOWS). */
  windows: number;
  /** The face moon's crescent (0.72 on the island before, 0 full). */
  crescent: number;
  /** 0..1 the moon warms. */
  warm: number;
  /** 0..1 aurora (SkyEvents.update's auroraAmount). */
  aurora: number;
}

/** The island moon's crescent before the ending. */
export const MOON_CRESCENT = 0.72;
/** What the windows keep, and the moon, once the kingdom has its sound back (after the awakening's flare). */
export const AFTER = { windows: 1.25, crescent: 0, warm: 0.6 } as const;

/**
 * The awakening at `t` seconds (0..AWAKEN_SECONDS, and on: past the end it holds the after-look, the windows
 * settling from their ×3.5 flare to AFTER.windows).
 */
export function awakenLook(t: number): AwakenLook {
  const flare = smooth(0.8, 2.2, t) * (1 - smooth(6.8, 8.8, t));
  const settled = smooth(6.8, 8.8, t);
  return {
    dolly: smooth(0, AWAKEN_SECONDS - 0.6, t),
    eyes: smooth(2.6, 5, t),
    windows: 1 + 2.5 * flare + (AFTER.windows - 1) * settled,
    crescent: MOON_CRESCENT + (AFTER.crescent - MOON_CRESCENT) * smooth(1.5, 6.5, t),
    warm: smooth(2, 6.5, t) * (1 - (1 - AFTER.warm) * settled),
    aurora: smooth(0.5, 3.5, t),
  };
}

/** The ending's hooks into the game. */
export interface EndingHooks {
  events: Events;
  /** The score: 'ending'. */
  play(id: 'ending'): void;
  /** Every frame of the awakening (t seconds in, and its look). */
  awaken?(t: number, look: AwakenLook, dt: number): void;
  /** The curtain falls: the hero to the hall, the crowd gathers, the fireworks start. */
  concert?(): void;
  /** Every frame of the concert, `t` seconds in. */
  concertTick?(t: number, dt: number): void;
  /** Goldgrin's line, once. */
  bubble?(text: string): void;
  /** The title card, once. */
  titleCard?(artist: string, title: string, seconds: number): void;
  /** The credits roll; `onContinue` when the player presses the button. */
  credits(lines: readonly string[], button: string, onContinue: () => void): void;
  /** New Game+ begins. */
  onPlus(): void;
  /** True once the player has left the kingdom (the after-party ends). */
  leftParty?(): boolean;
  /** Everyone goes home. */
  disperse?(): void;
}

export class Ending {
  played = false;
  phase: EndingPhase = 'idle';
  /** Seconds into the current phase. */
  t = 0;
  /** True once the kingdom has its sound back (this run, or a save made after): the moon and windows keep the after-look. */
  after = false;
  private said = false;
  private carded = false;

  constructor(private readonly d: EndingHooks) {
    d.events.on('quest', (e) => {
      if (e.id === 'silence' && e.stage === 'ended') this.start();
    });
  }

  /** True while the ending owns the camera and the hero stands still (the awakening and the concert). */
  get cinematic(): boolean {
    return this.phase === 'awaken' || this.phase === 'concert';
  }

  /** True while the ending's own song should play over the zone's (until the after-party). */
  get holdsMusic(): boolean {
    return this.phase === 'awaken' || this.phase === 'concert' || this.phase === 'credits';
  }

  /** 0..1 through the concert (kept for older checks). */
  get concertT(): number {
    return this.phase === 'concert' ? Math.min(1, this.t / CONCERT_SECONDS) : this.phase === 'idle' || this.phase === 'awaken' ? 0 : 1;
  }

  /** A save from after the ending: the after-look, no replay. */
  restore(ended: boolean): void {
    if (!ended) return;
    this.after = true;
    this.played = true;
    if (this.phase === 'idle') this.phase = 'done';
  }

  /** Starts the ending once. A second 'ended' (a reload of the same moment) does not play it again. */
  start(): void {
    if (this.played) return;
    this.played = true;
    this.after = true;
    this.d.play('ending');
    this.phase = 'awaken';
    this.t = 0;
    this.said = this.carded = false;
    this.d.awaken?.(0, awakenLook(0), 0);
  }

  /** Advances the timeline by `dt` seconds (real time: it runs while the world is paused for the credits). */
  update(dt: number): void {
    if (this.phase === 'idle' || this.phase === 'done') return;
    this.t += dt;
    if (this.phase === 'awaken') {
      this.d.awaken?.(this.t, awakenLook(this.t), dt);
      if (this.t >= AWAKEN_SECONDS) {
        this.phase = 'concert';
        this.t = 0;
        this.d.concert?.();
      }
      return;
    }
    if (this.phase === 'concert') {
      this.d.concertTick?.(this.t, dt);
      if (!this.said && this.t >= BUBBLE_AT) { this.said = true; this.d.bubble?.(GOLDGRIN_LINE); }
      if (!this.carded && this.t >= CARD_AT) { this.carded = true; this.d.titleCard?.(SONG.artist, SONG.title, CARD_SECONDS); }
      if (this.t >= CONCERT_SECONDS) {
        this.phase = 'credits';
        this.t = 0;
        this.d.credits(CREDITS, CONTINUE_LABEL, () => {
          this.phase = 'afterparty';
          this.t = 0;
          this.d.onPlus();
        });
      }
      return;
    }
    if (this.phase === 'afterparty') {
      if (this.d.leftParty?.() ?? true) {
        this.phase = 'done';
        this.d.disperse?.();
      }
    }
  }
}

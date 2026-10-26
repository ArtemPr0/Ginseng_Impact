/**
 * The ending of the Silent Kingdom: when the Hollow King falls and the quest reaches 'ended', the plaza concert
 * plays (an 8-second camera dolly over the stage, the crowd, the whale, fireworks), then the credits roll.
 * Continuing starts New Game+ (the caller raises the mobs).
 */
import type { Events } from './Events';

export const CREDITS = [
  'The Silent Kingdom',
  'The five voices came home.',
  'Yung Lean sang. The plaza heard him.',
  'Goldgrin found him.',
  'Continue — New Game+',
];

/** Seconds the plaza dolly runs before the credits. */
export const CONCERT_SECONDS = 8;

export type EndingPhase = 'idle' | 'concert' | 'credits' | 'done';

export class Ending {
  played = false;
  phase: EndingPhase = 'idle';
  /** 0..1 through the concert dolly (set each frame while phase === 'concert'). */
  concertT = 0;
  private concertLeft = 0;

  constructor(private readonly d: {
    events: Events;
    play(id: string): void;
    /** Bring the hero to the plaza and set the stage (crowd, lights, whale cue). */
    concert?(): void;
    /** Called every frame during the dolly with t in 0..1 (camera / fireworks). */
    concertTick?(t: number, dt: number): void;
    credits(lines: string[], onContinue: () => void): void;
    onPlus(): void;
  }) {
    d.events.on('quest', (e) => {
      if (e.id === 'silence' && e.stage === 'ended') this.start();
    });
  }

  /** Starts the ending once. A second 'ended' (a reload of the same moment) does not roll the credits again. */
  start(): void {
    if (this.played) return;
    this.played = true;
    this.d.play('ending');
    if (this.d.concert) {
      this.phase = 'concert';
      this.concertLeft = CONCERT_SECONDS;
      this.concertT = 0;
      this.d.concert();
    } else {
      this.openCredits();
    }
  }

  /** Advances the concert dolly; when it ends, opens the credits. */
  update(dt: number): void {
    if (this.phase !== 'concert') return;
    this.concertLeft = Math.max(0, this.concertLeft - dt);
    this.concertT = 1 - this.concertLeft / CONCERT_SECONDS;
    this.d.concertTick?.(this.concertT, dt);
    if (this.concertLeft <= 0) this.openCredits();
  }

  private openCredits(): void {
    this.phase = 'credits';
    this.d.credits(CREDITS, () => {
      this.phase = 'done';
      this.d.onPlus();
    });
  }
}

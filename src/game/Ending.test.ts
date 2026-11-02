import { describe, expect, it } from 'vitest';
import { Events } from './Events';
import { AFTER, AWAKEN_SECONDS, CARD_AT, CONCERT_SECONDS, CONTINUE_LABEL, CREDITS, Ending, GOLDGRIN_LINE, MOON_CRESCENT, SONG, awakenLook, type EndingHooks } from './Ending';

function rig(extra: Partial<EndingHooks> = {}) {
  const events = new Events();
  const log: string[] = [];
  let cont: (() => void) | null = null;
  let left = false;
  const ending = new Ending({
    events,
    play: (id) => log.push(`play:${id}`),
    awaken: (t) => { if (t === 0) log.push('awaken'); },
    concert: () => log.push('concert'),
    bubble: (text) => log.push(`bubble:${text}`),
    titleCard: (artist, title) => log.push(`card:${artist}:${title}`),
    credits: (lines, button, onContinue) => { log.push(`credits:${lines.length}:${button}`); cont = onContinue; },
    onPlus: () => log.push('plus'),
    leftParty: () => left,
    disperse: () => log.push('disperse'),
    ...extra,
  });
  const run = (seconds: number) => { for (let t = 0; t < seconds; t += 0.05) ending.update(0.05); };
  return { events, ending, log, run, cont: () => cont, leave: () => { left = true; } };
}

describe('Ending', () => {
  it('plays when the Silent Kingdom ends, and only once', () => {
    const { events, ending, log } = rig();
    events.emit({ kind: 'quest', id: 'silence', stage: 'told' });
    expect(ending.played).toBe(false);
    events.emit({ kind: 'quest', id: 'silence', stage: 'ended' });
    events.emit({ kind: 'quest', id: 'silence', stage: 'ended' });
    expect(log.filter((l) => l === 'play:ending')).toHaveLength(1);
    expect(ending.phase).toBe('awaken');
    expect(ending.cinematic).toBe(true);
  });

  it('runs awaken → concert (bubble, title card) → credits → New Game+ → after-party → home', () => {
    const { events, ending, log, run, cont, leave } = rig();
    events.emit({ kind: 'quest', id: 'silence', stage: 'ended' });
    run(AWAKEN_SECONDS - 0.2);
    expect(ending.phase).toBe('awaken');
    run(0.4);
    expect(ending.phase).toBe('concert');
    run(CARD_AT + 0.2);
    expect(log).toContain(`bubble:${GOLDGRIN_LINE}`);
    expect(log).toContain(`card:${SONG.artist}:${SONG.title}`);
    run(CONCERT_SECONDS);
    expect(ending.phase).toBe('credits');
    expect(ending.cinematic).toBe(false);
    expect(ending.holdsMusic).toBe(true);
    expect(log).toContain(`credits:${CREDITS.length}:${CONTINUE_LABEL}`);
    cont()!();
    expect(log).toContain('plus');
    expect(ending.phase).toBe('afterparty');
    run(2);
    expect(log).not.toContain('disperse');
    leave();
    run(0.1);
    expect(ending.phase).toBe('done');
    expect(log.filter((l) => l === 'disperse')).toHaveLength(1);
    expect(log.indexOf('awaken')).toBeLessThan(log.indexOf('concert'));
  });

  it('the awakening: windows ×3.5 in the middle, the moon full and warm, the eyes cyan; it settles to the after-look', () => {
    const a = awakenLook(0);
    expect(a.windows).toBeCloseTo(1, 6);
    expect(a.crescent).toBeCloseTo(MOON_CRESCENT, 6);
    expect(a.eyes).toBe(0);
    const mid = awakenLook(4.5);
    expect(mid.windows).toBeCloseTo(3.5, 6);
    expect(mid.aurora).toBe(1);
    const end = awakenLook(AWAKEN_SECONDS);
    expect(end.eyes).toBe(1);
    expect(end.crescent).toBeCloseTo(AFTER.crescent, 6);
    expect(end.dolly).toBe(1);
    const later = awakenLook(20);
    expect(later.windows).toBeCloseTo(AFTER.windows, 6);
    expect(later.warm).toBeCloseTo(AFTER.warm, 6);
  });

  it('a save from after the ending keeps the after-look and never replays it', () => {
    const { events, ending, log } = rig();
    ending.restore(true);
    expect(ending.after).toBe(true);
    events.emit({ kind: 'quest', id: 'silence', stage: 'ended' });
    expect(log).not.toContain('play:ending');
  });

  it('the song title is the game’s own', () => {
    // (Never a real song's title: the user's rule for anything this game names.)
    expect(SONG.title).toBe('Five Voices Home');
  });
});

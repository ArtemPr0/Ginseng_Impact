import { describe, expect, it } from 'vitest';
import { Events } from './Events';
import { Ending } from './Ending';

describe('Ending', () => {
  it('plays when the Silent Kingdom ends, and only once', () => {
    const events = new Events();
    const songs: string[] = [];
    let lines = 0;
    let plus = 0;
    const ending = new Ending({
      events,
      play: (id) => songs.push(id),
      credits: (l, onContinue) => { lines = l.length; onContinue(); },
      onPlus: () => { plus++; },
    });
    events.emit({ kind: 'quest', id: 'silence', stage: 'told' });
    expect(ending.played).toBe(false);
    events.emit({ kind: 'quest', id: 'silence', stage: 'ended' });
    events.emit({ kind: 'quest', id: 'silence', stage: 'ended' });
    expect(songs).toEqual(['ending']);
    expect(lines).toBeGreaterThan(2);
    expect(plus).toBe(1);
    expect(ending.played).toBe(true);
  });

  it('runs an 8-second concert dolly before the credits when concert is wired', () => {
    const events = new Events();
    const ticks: number[] = [];
    let lines = 0;
    const ending = new Ending({
      events,
      play: () => {},
      concert: () => {},
      concertTick: (t) => { ticks.push(t); },
      credits: (l, onContinue) => { lines = l.length; onContinue(); },
      onPlus: () => {},
    });
    events.emit({ kind: 'quest', id: 'silence', stage: 'ended' });
    expect(ending.phase).toBe('concert');
    expect(lines).toBe(0);
    ending.update(4);
    expect(ending.concertT).toBeGreaterThan(0.4);
    expect(lines).toBe(0);
    ending.update(5);
    expect(ending.phase).toBe('done');
    expect(lines).toBeGreaterThan(2);
    expect(ticks.length).toBeGreaterThan(0);
  });
});

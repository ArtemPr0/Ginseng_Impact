import { describe, expect, it } from 'vitest';
import { ThroneKeeper } from './ThroneKeeper';

// The castle hall's surprise (the playtest of 2026-11-14: "inside the castle there seems to be nothing ... add something
// cool and interactive ... hilarious and funny ... the crown ... is not on anyone's head").
describe('the skeleton keeping the throne', () => {
  it('wears the crown and refuses twice, with different excuses, then gives the crown up on the third ask', () => {
    const k = new ThroneKeeper();
    expect(k.crown).toBe('keeper');
    expect(k.prompt()).toMatch(/ask/i);
    const a = k.ask();
    const b = k.ask();
    expect(a.give).toBe(false);
    expect(b.give).toBe(false);
    expect(a.line).not.toBe(b.line);
    const c = k.ask();
    expect(c.give).toBe(true);
    expect(k.crown).toBe('hero');
    expect(k.prompt()).toMatch(/sit/i);
  });

  it('keeps every line short enough to read at a glance', () => {
    const k = new ThroneKeeper();
    const lines = [k.ask().line, k.ask().line, k.ask().line, k.sit().line];
    k.leave();
    lines.push(k.ask().line);
    for (const l of lines) expect(l.length).toBeLessThanOrEqual(80);
  });

  it('takes the crown back when you leave, and gives it up on the first ask after that', () => {
    const k = new ThroneKeeper();
    k.ask(); k.ask(); k.ask();
    k.leave();
    expect(k.crown).toBe('keeper');
    expect(k.prompt()).toMatch(/ask/i);
    expect(k.ask().give).toBe(true);
  });

  it('only lets a crowned hero sit, and the throne answers every sitting', () => {
    const k = new ThroneKeeper();
    expect(k.sit().ok).toBe(false);
    k.ask(); k.ask(); k.ask();
    expect(k.sit().ok).toBe(true);
    expect(k.sit().ok).toBe(true);
  });
});

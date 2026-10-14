import { describe, expect, it } from 'vitest';
import { Party } from './Party';

const roster = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

describe('Party', () => {
  it('starts on the first member', () => {
    const p = new Party(roster);
    expect(p.active.id).toBe('a');
    expect(p.activeIndex).toBe(0);
  });

  it('switches by index and reports the swap', () => {
    const p = new Party(roster);
    expect(p.switchTo(2)).toEqual({ from: 0, to: 2 });
    expect(p.active.id).toBe('c');
  });

  it('ignores same-index, out-of-range, and swaps during cooldown', () => {
    const p = new Party(roster);
    expect(p.switchTo(0)).toBeNull();
    expect(p.switchTo(5)).toBeNull();
    expect(p.switchTo(1)).toEqual({ from: 0, to: 1 });
    expect(p.switchTo(2)).toBeNull(); // cooldown
    p.update(Party.cooldown);
    expect(p.switchTo(2)).toEqual({ from: 1, to: 2 });
  });
});

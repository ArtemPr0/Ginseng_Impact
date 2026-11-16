import { describe, expect, it } from 'vitest';

describe('spellRange (review 2026-11-16: the ring shows where the spell lands)', () => {
  it('Earthsplitter leaps at most LEAP_RANGE; the rest reach AIM_RANGE', async () => {
    const { spellRange, AIM_RANGE, LEAP_RANGE } = await import('./Aim');
    expect(LEAP_RANGE).toBe(12);
    expect(spellRange('earthsplitter')).toBe(LEAP_RANGE);
    expect(spellRange('fireball')).toBe(AIM_RANGE);
  });
});

describe('SpellBuffer (review 2026-11-16)', () => {
  it('a spell cast mid-swing waits up to 0.6 s for the hero to be free, then is dropped', async () => {
    const { SpellBuffer } = await import('./Aim');
    const b = new SpellBuffer();
    b.push(2);
    expect(b.peek(0.2)).toBe(2);
    expect(b.peek(0.2)).toBe(2);
    b.done();
    expect(b.peek(0.1)).toBeNull();
    b.push(3);
    expect(b.peek(0.5)).toBe(3);
    expect(b.peek(0.2)).toBeNull();
  });
});

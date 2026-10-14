import { describe, expect, it } from 'vitest';
import { applyElement, reactionFor, tickAura, AURA_DURATION, REACTIONS } from './Elements';

describe('reactionFor', () => {
  it('is symmetric and covers the three slice pairs', () => {
    expect(reactionFor('lunar', 'blood')).toBe('eclipse');
    expect(reactionFor('blood', 'lunar')).toBe('eclipse');
    expect(reactionFor('lunar', 'astral')).toBe('conduit');
    expect(reactionFor('blood', 'astral')).toBe('overload');
    expect(reactionFor('lunar', 'lunar')).toBeNull();
    expect(reactionFor('stone', 'lunar')).toBeNull();
  });
});

describe('applyElement', () => {
  it('creates an aura on a clean target', () => {
    const r = applyElement(null, 'lunar');
    expect(r.reaction).toBeNull();
    expect(r.aura).toEqual({ element: 'lunar', gauge: AURA_DURATION });
  });

  it('refreshes the same element', () => {
    const r = applyElement({ element: 'lunar', gauge: 1 }, 'lunar');
    expect(r.reaction).toBeNull();
    expect(r.aura?.gauge).toBe(AURA_DURATION);
  });

  it('reacts and consumes the aura on a reacting pair', () => {
    const r = applyElement({ element: 'lunar', gauge: 3 }, 'blood');
    expect(r.reaction).toBe('eclipse');
    expect(r.aura).toBeNull();
  });

  it('replaces the aura when the pair has no reaction', () => {
    const r = applyElement({ element: 'stone', gauge: 3 }, 'blood');
    expect(r.reaction).toBeNull();
    expect(r.aura?.element).toBe('blood');
  });

  it('physical hits leave the aura alone', () => {
    const r = applyElement({ element: 'lunar', gauge: 3 }, null);
    expect(r.reaction).toBeNull();
    expect(r.aura).toEqual({ element: 'lunar', gauge: 3 });
  });
});

describe('tickAura', () => {
  it('decays and expires', () => {
    expect(tickAura({ element: 'lunar', gauge: 1 }, 0.4)?.gauge).toBeCloseTo(0.6);
    expect(tickAura({ element: 'lunar', gauge: 0.3 }, 0.4)).toBeNull();
    expect(tickAura(null, 1)).toBeNull();
  });
});

describe('REACTIONS', () => {
  it('eclipse hits hardest, overload knocks back, conduit lowers defence', () => {
    expect(REACTIONS.eclipse.damageMult).toBeGreaterThan(REACTIONS.overload.damageMult);
    expect(REACTIONS.overload.knockback).toBeGreaterThan(0);
    expect(REACTIONS.conduit.defDown).toBeGreaterThan(0);
  });
});

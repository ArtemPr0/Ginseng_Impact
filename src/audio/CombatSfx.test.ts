import { describe, expect, it, vi } from 'vitest';
import type { Audio } from './Audio';
import { CombatSfx, hitMaterial } from './CombatSfx';

/** The engine's public face as CombatSfx sees it: a clock, an effects input and the two primitives (spied). */
function fakeAudio(unlocked = true) {
  const ctx = { currentTime: 3 };
  const a = {
    context: unlocked ? ctx : null,
    sfxInput: unlocked ? {} : null,
    toneAt: vi.fn(() => null),
    noiseAt: vi.fn(() => null),
  };
  return { a, ctx, sfx: new CombatSfx(a as unknown as Audio) };
}

describe('hitMaterial', () => {
  it('maps the bony, stony and ghostly kinds and calls the rest flesh', () => {
    for (const k of ['skeleton', 'grave-skeleton', 'diamond-wizard']) expect(hitMaterial(k)).toBe('bone');
    for (const k of ['crystalgolem', 'troll', 'warden', 'cyclops']) expect(hitMaterial(k)).toBe('stone');
    for (const k of ['shade', 'rivershade', 'blood-eye', 'dmt-entity', 'trip-wizard']) expect(hitMaterial(k)).toBe('ghost');
    for (const k of ['beast', 'yeti', 'croc', 'loggiant']) expect(hitMaterial(k)).toBe('flesh');
    // Never a prototype key.
    expect(hitMaterial('constructor')).toBe('flesh');
  });
});

describe('CombatSfx', () => {
  it('is silent until the engine is unlocked', () => {
    const { a, sfx } = fakeAudio(false);
    sfx.swing('blade');
    sfx.hit('bone', true, true);
    sfx.crit();
    sfx.heavyHit();
    sfx.effort('knight');
    expect(a.toneAt).not.toHaveBeenCalled();
    expect(a.noiseAt).not.toHaveBeenCalled();
  });

  it('plays every sound through the effects input, at the context clock', () => {
    const { a, sfx } = fakeAudio();
    for (const kind of ['blade', 'bow', 'staff'] as const) { sfx.swing(kind); sfx.swing(kind, true); }
    for (const m of ['flesh', 'bone', 'stone', 'ghost'] as const) sfx.hit(m);
    sfx.crit();
    sfx.heavyHit();
    for (const h of ['knight', 'archer', 'wizard']) sfx.effort(h);
    const calls = [...a.toneAt.mock.calls, ...a.noiseAt.mock.calls] as unknown as Array<[unknown, number]>;
    expect(calls.length).toBeGreaterThan(20);
    for (const [out, t] of calls) { expect(out).toBe(a.sfxInput); expect(t).toBeGreaterThanOrEqual(3); }
  });

  it('starts at most three hit sounds in 50 ms (a spin through a crowd), then lets them through again', () => {
    const { a, ctx, sfx } = fakeAudio();
    const hits = () => a.toneAt.mock.calls.length;
    for (let i = 0; i < 8; i++) sfx.hit('flesh');
    expect(hits()).toBe(3 * 1); // flesh: one tone per hit
    ctx.currentTime += 0.06;
    sfx.hit('flesh');
    expect(hits()).toBe(4);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { Game } from './Game';

/** A game whose frames are driven by hand: `step(ms)` runs one frame that many milliseconds after the last. */
function harness() {
  let queued: ((now: number) => void) | null = null;
  let now = 1000;
  vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => { queued = cb; return 1; });
  vi.stubGlobal('document', { addEventListener() {}, hidden: false });
  vi.spyOn(performance, 'now').mockReturnValue(now);
  const game = new Game();
  let updates = 0;
  let rendered = 0;
  game.add({ update: () => { updates++; }, render: (_a, dt) => { rendered += dt; } });
  game.start();
  return {
    game,
    step(ms: number) { now += ms; queued!(now); },
    get updates() { return updates; },
    get rendered() { return rendered; },
  };
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('Game slow motion', () => {
  it('runs the world at full speed normally', () => {
    const h = harness();
    for (let i = 0; i < 6; i++) h.step(50);
    expect(h.updates).toBe(18);
  });

  it('slows the simulation and the animation while slow motion lasts, then comes back', () => {
    const h = harness();
    h.game.slowMo = 1.2;
    for (let i = 0; i < 6; i++) h.step(50);
    // A third of the speed or less: 18 steps at full speed.
    expect(h.updates).toBeLessThanOrEqual(6);
    expect(h.rendered).toBeLessThan(0.3 * 0.5);
    for (let i = 0; i < 40; i++) h.step(50);
    expect(h.game.slowMo).toBeLessThanOrEqual(0);
    const before = h.updates;
    for (let i = 0; i < 6; i++) h.step(50);
    expect(h.updates - before).toBe(18);
  });
});

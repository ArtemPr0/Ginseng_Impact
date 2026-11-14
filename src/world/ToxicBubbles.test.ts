import { describe, expect, it } from 'vitest';
import { BubbleCycle } from './ToxicBubbles';

describe('a bubble on the poison water (the playtest of 2026-11-14: "add some popping bubbles")', () => {
  it('swells to its full size, then pops once and rests flat before the next one', () => {
    const b = new BubbleCycle(2, 0.5, 0);
    const scales: number[] = [];
    let pops = 0;
    let popAt = -1;
    for (let i = 0; i < 200; i++) {
      if (b.step(0.01) === 'pop') { pops++; popAt = i; }
      scales.push(b.scale);
    }
    expect(pops).toBe(1);
    // Growing until the pop (a wobble may ride on it but never shrinks it below what it was a tenth of a second ago).
    expect(Math.max(...scales.slice(0, popAt))).toBeGreaterThan(0.95);
    for (let i = 10; i < popAt; i++) expect(scales[i]).toBeGreaterThan(scales[i - 10] - 0.05);
    expect(scales[popAt]).toBe(0);
    expect(scales[Math.min(199, popAt + 20)]).toBe(0);
  });

  it('starts again after its rest, and many of them pop at different times', () => {
    const b = new BubbleCycle(1, 0.3, 0);
    let pops = 0;
    for (let i = 0; i < 400; i++) if (b.step(0.01) === 'pop') pops++;
    expect(pops).toBe(3);
    const phases = [0, 0.3, 0.6].map((ph) => { const q = new BubbleCycle(1, 0.3, ph); let first = -1; for (let i = 0; i < 200 && first < 0; i++) if (q.step(0.01) === 'pop') first = i; return first; });
    expect(new Set(phases).size).toBe(3);
  });
});

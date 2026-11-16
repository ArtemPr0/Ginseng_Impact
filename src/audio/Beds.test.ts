import { describe, expect, it } from 'vitest';
import { bedPlan } from './Beds';

describe('sound beds (v12: the tornado roars, the fire crackles, the black hole drones for as long as they last)', () => {
  for (const kind of ['tornado', 'fire', 'hole'] as const) {
    it(`${kind}: chunks overlap from start to end, swelling in and dying away`, () => {
      const p = bedPlan(kind, 6);
      expect(p.length).toBeGreaterThan(6);
      const starts = p.map((c) => c.at).sort((a, b) => a - b);
      expect(starts[0]).toBeLessThan(0.1);
      // No silence: each chunk starts before everything sounding before it has died.
      const bySt = [...p].sort((a, b) => a.at - b.at);
      let sounding = bySt[0].at + bySt[0].dur;
      for (let i = 1; i < bySt.length; i++) { expect(bySt[i].at).toBeLessThan(sounding + 0.05); sounding = Math.max(sounding, bySt[i].at + bySt[i].dur); }
      const end = Math.max(...p.map((c) => c.at + c.dur));
      expect(end).toBeGreaterThan(5.5);
      expect(end).toBeLessThan(7.5);
      const loudest = Math.max(...p.map((c) => c.peak));
      const mid = p.filter((c) => c.at > 2 && c.at < 4);
      expect(Math.max(...mid.map((c) => c.peak))).toBeGreaterThan(loudest * 0.6);
      expect(bySt[0].peak).toBeLessThan(loudest * 0.8);
      expect(bySt[bySt.length - 1].peak).toBeLessThan(loudest * 0.8);
      expect(loudest).toBeLessThanOrEqual(0.6);
    });
  }
  it('the black hole\'s drone rises in pitch as it grows', () => {
    const tones = bedPlan('hole', 5).filter((c) => c.tone);
    expect(tones.length).toBeGreaterThan(2);
    expect(tones[tones.length - 1].f0).toBeGreaterThan(tones[0].f0);
  });
});

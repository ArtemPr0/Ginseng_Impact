import { describe, expect, it } from 'vitest';
import { pickVariant, SampleBank, variation } from './SampleBank';

describe('SampleBank (recorded CC0 sounds, picked and varied)', () => {
  it('never the same variant twice running, when there is a choice', () => {
    let last = -1;
    for (let i = 0; i < 200; i++) {
      const v = pickVariant(5, last);
      expect(v).not.toBe(last);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(5);
      last = v;
    }
    expect(pickVariant(1, 0)).toBe(0);
  });
  it('each play a little different: pitch within ±6 %, gain within ±2 dB', () => {
    for (let i = 0; i < 200; i++) {
      const { rate, gain } = variation();
      expect(rate).toBeGreaterThanOrEqual(0.94);
      expect(rate).toBeLessThanOrEqual(1.06);
      expect(gain).toBeGreaterThanOrEqual(10 ** (-2 / 20) - 1e-9);
      expect(gain).toBeLessThanOrEqual(10 ** (2 / 20) + 1e-9);
    }
  });
  it('urls from the manifest; an unknown category plays nothing', () => {
    const bank = new SampleBank(null, { 'hit-flesh': ['a.m4a', 'b.m4a'] }, 'audio/sfx/');
    expect(bank.urls('hit-flesh')).toEqual(['audio/sfx/hit-flesh/a.m4a', 'audio/sfx/hit-flesh/b.m4a']);
    expect(bank.urls('nope')).toEqual([]);
    expect(bank.play('hit-flesh')).toBe(false);
  });
});

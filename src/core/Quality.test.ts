import { describe, expect, it } from 'vitest';
import { AutoQuality, nextMode, pickMode, settingsFor } from './Quality';

// The user's call of 2026-11-16: a Quality setting, Auto / High / Low, Auto picking by frame rate.
describe('Quality', () => {
  it('the URL wins, then what was saved, else Auto', () => {
    expect(pickMode('?quality=low', 'high')).toBe('low');
    expect(pickMode('', 'high')).toBe('high');
    expect(pickMode('', null)).toBe('auto');
    expect(pickMode('?quality=bogus', 'nonsense')).toBe('auto');
  });
  it('the button cycles Auto → High → Low → Auto', () => {
    expect(nextMode('auto')).toBe('high');
    expect(nextMode('high')).toBe('low');
    expect(nextMode('low')).toBe('auto');
  });
  it('Low halves what costs: lights, awake rubble, resolution, fracture variants', () => {
    const hi = settingsFor('high'), lo = settingsFor('low');
    expect(lo.lights).toBeLessThan(hi.lights);
    expect(lo.debris).toBeLessThan(hi.debris);
    expect(lo.maxRatio).toBeLessThan(hi.maxRatio);
    expect(lo.variants).toBe(1);
    expect(hi.variants).toBe(3);
  });
  it('Auto drops to Low after 3 s of slow frames at the lowest resolution, and never flaps back', () => {
    const a = new AutoQuality();
    expect(a.level).toBe('high');
    for (let t = 0; t < 2.5; t += 0.1) a.update(0.1, 30, true);
    expect(a.level).toBe('high');
    for (let t = 0; t < 1; t += 0.1) a.update(0.1, 30, true);
    expect(a.level).toBe('low');
    for (let t = 0; t < 30; t += 0.1) a.update(0.1, 8, false);
    expect(a.level).toBe('low');
  });
  it('slow frames that still have resolution to give do not count; a fast frame resets the count', () => {
    const a = new AutoQuality();
    for (let t = 0; t < 5; t += 0.1) a.update(0.1, 30, false);
    expect(a.level).toBe('high');
    for (let t = 0; t < 2; t += 0.1) a.update(0.1, 30, true);
    a.update(0.1, 12, true);
    for (let t = 0; t < 2; t += 0.1) a.update(0.1, 30, true);
    expect(a.level).toBe('high');
  });
});

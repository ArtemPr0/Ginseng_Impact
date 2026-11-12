import { describe, expect, it } from 'vitest';
import { pickGait } from './Gait';

// The Galaxy Knight (playtest 2026-11-12, "his legs don't move"): chasing at ~1 m/s, between its walk (0.77 m/s) and
// run (1.30 m/s) paces, it flipped gait every frame and each flip restarted the clip at 0.
const rates = [{ key: 'walk', rate: 0.77 }, { key: 'run', rate: 1.3 }];

describe('pickGait', () => {
  it('picks the gait whose natural pace is nearest, scaled to match', () => {
    expect(pickGait(rates, 0.8, '')).toEqual({ key: 'walk', scale: 0.8 / 0.77 });
    expect(pickGait(rates, 1.4, '')).toEqual({ key: 'run', scale: 1.4 / 1.3 });
  });

  it('keeps the gait it is in while the other is only a little nearer', () => {
    for (const v of [0.95, 1.0, 1.04, 0.98, 1.06]) expect(pickGait(rates, v, 'walk')?.key).toBe('walk');
    for (const v of [0.95, 1.0, 1.04, 0.98, 1.06]) expect(pickGait(rates, v, 'run')?.key).toBe('run');
  });

  it('changes gait once the other is clearly nearer', () => {
    expect(pickGait(rates, 1.35, 'walk')?.key).toBe('run');
    expect(pickGait(rates, 0.75, 'run')?.key).toBe('walk');
  });

  it('returns null with no locomotion clip', () => {
    expect(pickGait([], 1, '')).toBeNull();
  });
});

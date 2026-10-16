import { describe, expect, it } from 'vitest';
import { trimSilence } from './music';

describe('trimSilence', () => {
  it('drops the near-silence at both ends, across every channel', () => {
    const left = new Float32Array(100);
    const right = new Float32Array(100);
    left[10] = 0.5;
    right[80] = -0.2;
    left[90] = 0.001; // below the threshold: still silence
    expect(trimSilence([left, right])).toEqual({ start: 10, end: 81 });
  });

  it('keeps an all-silent track whole', () => {
    expect(trimSilence([new Float32Array(50)])).toEqual({ start: 0, end: 50 });
  });
});

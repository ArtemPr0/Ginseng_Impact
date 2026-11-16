/**
 * Sound beds (v12, 2026-11-16): a sound that lasts as long as its spell (the tornado's roar, the fire's crackle, the
 * black hole's drone), made of short overlapping chunks of filtered noise and tones, so it gusts and flickers rather
 * than holding one flat note. It swells in over the first second and dies away over the last. Pure: Audio.bed plays
 * the plan.
 */
export type BedKind = 'tornado' | 'fire' | 'hole';

export interface BedChunk {
  /** Seconds from now. */
  at: number;
  dur: number;
  peak: number;
  /** A tone (`tone` = its wave) instead of noise. */
  tone?: OscillatorType;
  filter: BiquadFilterType;
  f0: number;
  f1: number;
  q: number;
  attack: number;
}

const STEP: Record<BedKind, number> = { tornado: 0.45, fire: 0.3, hole: 0.6 };

export function bedPlan(kind: BedKind, seconds: number): BedChunk[] {
  const out: BedChunk[] = [];
  const step = STEP[kind];
  const n = Math.max(2, Math.ceil(seconds / step));
  for (let i = 0; i < n; i++) {
    const at = i * step;
    // Swell in over a second, die away over the last one and a half.
    const env = Math.max(0.15, Math.min(1, (at + step) / 1, (seconds - at) / 1.5));
    const r = Math.random();
    switch (kind) {
      case 'tornado':
        // A rushing roar whose pitch gusts, over a low churn.
        out.push({ at, dur: step * 2.2, peak: 0.42 * env * (0.75 + r * 0.25), filter: 'bandpass', f0: 280 + r * 500, f1: 500 + r * 700, q: 1.1, attack: step * 0.8 });
        if (i % 2 === 0) out.push({ at, dur: step * 3, peak: 0.3 * env, filter: 'lowpass', f0: 260, f1: 140, q: 0.7, attack: step });
        break;
      case 'fire':
        // A bed of soft roar under pops and snaps.
        out.push({ at, dur: step * 2.4, peak: 0.16 * env, filter: 'lowpass', f0: 700, f1: 380, q: 0.6, attack: step });
        out.push({ at: at + r * step, dur: 0.035, peak: 0.2 * env, filter: 'bandpass', f0: 1800 + r * 4000, f1: 1500, q: 4, attack: 0.002 });
        break;
      case 'hole': {
        // A low drone climbing as it grows, a sub hum, a hiss of what it is swallowing.
        const k = at / Math.max(0.1, seconds);
        out.push({ at, dur: step * 2, peak: 0.22 * env, tone: 'sawtooth', filter: 'lowpass', f0: 55 + k * 50, f1: 58 + k * 55, q: 0, attack: step * 0.8 });
        out.push({ at, dur: step * 2, peak: 0.24 * env, filter: 'bandpass', f0: 180 + k * 300, f1: 300 + k * 500, q: 2.5, attack: step * 0.8 });
        break;
      }
    }
  }
  return out;
}

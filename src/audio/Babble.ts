/**
 * NPC babble: every NPC says its lines in a voice of its own (the playtest of 2026-11-14: "NPC interactions are
 * boring… add unique voices… not too long"). A line becomes a run of pitched blips, one per syllable, shaped by the
 * voice's wave, pitch, vowel colour, wobble and breath, with pauses at commas and full stops and a rise at a question,
 * lasting as long as the line takes to type out (BABBLE_CPS). The same NPC always sounds the same, and the same line
 * the same. A line with a recorded voice (data/voices) plays that instead.
 *
 * Pure: `renderBabble` returns the samples; Audio.babble plays them on a voice channel.
 */
import type { Tone } from '../data/dialogue/types';

/** How fast a line types out in the dialogue box, characters per second; the babble lasts as long. */
export const BABBLE_CPS = 32;
/** The longest a babble runs (seconds): a long line keeps typing after the voice has said its piece. */
export const MAX_BABBLE = 3.6;

export type BabbleWave = 'sine' | 'triangle' | 'square' | 'saw';

export interface BabbleVoice {
  wave: BabbleWave;
  /** The voice's middle pitch (Hz). */
  pitch: number;
  /** How far syllables wander off it (semitones, either way). */
  spread: number;
  /** The vowel colour: where the voice's harmonics ring loudest (Hz). */
  formant: number;
  /** Vibrato depth, 0–1 (a frog's croak, a ghost's quaver). */
  wobble: number;
  /** Syllables per second at its natural pace (sleepy 6, chatty 15). */
  rate: number;
  /** Breath and rasp mixed in, 0–1 (a skeleton's dry rattle, a whisper). */
  breath: number;
}

/** Voices made by hand for the NPCs everyone remembers; everyone else gets one from their id and their tone. */
const OWN: Record<string, Partial<BabbleVoice>> = {
  'stone-head': { wave: 'saw', pitch: 62, spread: 1.5, formant: 420, wobble: 0.05, rate: 5.5, breath: 0.25 },
  frogking: { wave: 'square', pitch: 105, spread: 3, formant: 520, wobble: 0.55, rate: 8 },
  croak: { wave: 'square', pitch: 230, spread: 5, formant: 900, wobble: 0.45, rate: 14 },
  'cup-gnome': { wave: 'triangle', pitch: 330, spread: 6, formant: 1600, wobble: 0.1, rate: 15 },
  yunglean: { wave: 'sine', pitch: 140, spread: 1, formant: 700, wobble: 0.35, rate: 7, breath: 0.1 },
  'skeleton-king': { wave: 'square', pitch: 120, spread: 4, formant: 1200, wobble: 0.05, rate: 11, breath: 0.45 },
  'skeleton-lord': { wave: 'square', pitch: 150, spread: 5, formant: 1500, wobble: 0.05, rate: 12, breath: 0.5 },
  'crypt-bones': { wave: 'triangle', pitch: 200, spread: 7, formant: 1900, wobble: 0, rate: 13, breath: 0.55 },
  'lantern-witch': { wave: 'saw', pitch: 260, spread: 8, formant: 1400, wobble: 0.4, rate: 13 },
  'crypt-witch': { wave: 'saw', pitch: 290, spread: 9, formant: 1700, wobble: 0.5, rate: 14 },
  'vale-dragon': { wave: 'saw', pitch: 58, spread: 2, formant: 360, wobble: 0.15, rate: 6, breath: 0.4 },
  'plague-doctor': { wave: 'triangle', pitch: 125, spread: 2, formant: 480, wobble: 0.08, rate: 9, breath: 0.3 },
  'galaxy-wizard': { wave: 'sine', pitch: 180, spread: 9, formant: 1100, wobble: 0.3, rate: 10 },
  king: { wave: 'saw', pitch: 98, spread: 2.5, formant: 650, wobble: 0.04, rate: 8 },
  bride: { wave: 'triangle', pitch: 270, spread: 4, formant: 1300, wobble: 0.12, rate: 11 },
};

/** How a tone moves a voice: sleepy slow and low, manic quick, high and all over the place, grim low. */
const TONE: Record<Tone, { rate: number; pitch: number; spread: number; formant: number }> = {
  dry: { rate: 1, pitch: 1, spread: 0.6, formant: 1 },
  warm: { rate: 0.95, pitch: 1, spread: 1, formant: 0.88 },
  grim: { rate: 0.85, pitch: 0.75, spread: 0.8, formant: 0.85 },
  manic: { rate: 1.3, pitch: 1.2, spread: 1.4, formant: 1.1 },
  sleepy: { rate: 0.7, pitch: 0.8, spread: 0.7, formant: 0.9 },
};

const WAVES: BabbleWave[] = ['sine', 'triangle', 'square', 'saw'];

/** FNV-1a: a string's 32-bit hash. */
function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}

/** mulberry32: a small seeded generator. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The NPC's voice: its own if it has one, else drawn from its id, then moved by its tone. */
export function babbleVoice(npcId: string, tone?: Tone): BabbleVoice {
  const r = seeded(hash(npcId));
  const v: BabbleVoice = {
    wave: WAVES[Math.floor(r() * WAVES.length)],
    pitch: 100 + r() * 190,
    spread: 2 + r() * 4,
    formant: 550 + r() * 1500,
    wobble: r() < 0.2 ? 0.3 + r() * 0.35 : r() * 0.15,
    rate: 9 + r() * 5,
    breath: r() * 0.25,
  };
  if (tone) {
    const t = TONE[tone];
    v.rate *= t.rate; v.pitch *= t.pitch; v.spread *= t.spread; v.formant *= t.formant;
  }
  return { ...v, ...OWN[npcId] };
}

export interface Syllable {
  /** Start (s). */
  t: number;
  /** Length (s). */
  len: number;
  /** Pitch (Hz). */
  pitch: number;
  /** Loudness, 0–1. */
  amp: number;
}

const PAUSE: Record<string, number> = { ',': 0.09, ';': 0.12, ':': 0.12, '.': 0.2, '!': 0.2, '?': 0.2, '…': 0.25 };

/**
 * The syllables of a line in `v`'s voice: a chattier voice says more, shorter blips per word; commas and full stops
 * pause; a question rises at its end, an exclamation lifts and is louder. Stretched to the time the line takes to type
 * (capped at MAX_BABBLE).
 */
export function syllables(text: string, v: BabbleVoice): Syllable[] {
  const r = seeded(hash(text) ^ hash(`${v.wave}${v.pitch.toFixed(1)}`));
  const out: Syllable[] = [];
  const step = 1 / v.rate;
  let t = 0;
  let sentence: Syllable[] = [];
  const endSentence = (mark: string) => {
    if (!sentence.length) return;
    const last = sentence[sentence.length - 1];
    if (mark === '?') last.pitch = Math.max(v.pitch * 2 ** (5 / 12), (sentence[sentence.length - 2]?.pitch ?? 0) * 1.25);
    if (mark === '!') for (const s of sentence.slice(-2)) { s.pitch *= 2 ** (2 / 12); s.amp = 1; }
    sentence = [];
  };
  for (const token of text.match(/[\p{L}\p{N}']+|[.,;:!?…]/gu) ?? []) {
    if (PAUSE[token] !== undefined) {
      t += PAUSE[token];
      if ('.!?…'.includes(token)) endSentence(token);
      continue;
    }
    const n = Math.max(1, Math.round((token.length * v.rate) / 26));
    for (let i = 0; i < n; i++) {
      // A gentle fall across the sentence, each syllable off it by up to the voice's spread.
      const drift = -0.35 * sentence.length;
      const semi = (r() - 0.5) * 2 * v.spread + Math.max(-3, drift);
      const s = { t, len: step * 0.78, pitch: v.pitch * 2 ** (semi / 12), amp: 0.7 + r() * 0.25 };
      out.push(s);
      sentence.push(s);
      t += step;
    }
    t += step * 0.15;
  }
  endSentence('.');
  if (!out.length) return out;
  const natural = out[out.length - 1].t + out[out.length - 1].len;
  const k = Math.min(MAX_BABBLE, text.length / BABBLE_CPS) / natural;
  for (const s of out) { s.t *= k; s.len *= k; }
  return out;
}

/** How loud each harmonic of a wave is, before the vowel colour. */
function harmonic(wave: BabbleWave, k: number): number {
  switch (wave) {
    case 'sine': return k === 1 ? 1 : 0;
    case 'triangle': return k % 2 ? 1 / (k * k) : 0;
    case 'square': return k % 2 ? 1 / k : 0;
    case 'saw': return 1 / k;
  }
}

/** The line in `v`'s voice as mono samples at `sampleRate`, peaking at 0.8. */
export function renderBabble(text: string, v: BabbleVoice, sampleRate: number): Float32Array {
  const syl = syllables(text, v);
  if (!syl.length) return new Float32Array(0);
  const end = syl[syl.length - 1].t + syl[syl.length - 1].len + 0.05;
  const out = new Float32Array(Math.ceil(end * sampleRate));
  const noise = seeded(hash(text) + 7);
  const TAU = Math.PI * 2;
  for (const s of syl) {
    // The harmonics under 5 kHz, each weighted by the wave and by two vowel formants.
    const amps: number[] = [];
    for (let k = 1; k * s.pitch < 5000 && k <= 24; k++) {
      const f = k * s.pitch;
      const vowel = 0.3 + 1.6 * Math.exp(-(((f - v.formant) / (v.formant * 0.5)) ** 2)) + 0.6 * Math.exp(-(((f - v.formant * 2.4) / v.formant) ** 2));
      amps.push(harmonic(v.wave, k) * vowel);
    }
    const phases = new Float64Array(amps.length);
    const i0 = Math.floor(s.t * sampleRate);
    const n = Math.floor(s.len * sampleRate);
    let lp = 0;
    for (let i = 0; i < n && i0 + i < out.length; i++) {
      const u = i / n;
      const time = i / sampleRate;
      // A quick attack, a short hold, an easy fall; the pitch slides down a touch and wobbles.
      const env = Math.min(1, time / 0.006) * (u < 0.55 ? 1 : Math.exp(-(u - 0.55) * 7));
      const f0 = s.pitch * (1 - 0.04 * u) * (1 + v.wobble * 0.06 * Math.sin(TAU * 11 * time));
      let x = 0;
      for (let k = 0; k < amps.length; k++) {
        if (!amps[k]) continue;
        phases[k] += (TAU * (k + 1) * f0) / sampleRate;
        x += amps[k] * Math.sin(phases[k]);
      }
      lp += 0.35 * (noise() * 2 - 1 - lp);
      out[i0 + i] += (x * (1 - v.breath * 0.6) + lp * v.breath * 2.2) * env * s.amp;
    }
  }
  let peak = 0;
  for (const x of out) peak = Math.max(peak, Math.abs(x));
  if (peak > 0) for (let i = 0; i < out.length; i++) out[i] *= 0.8 / peak;
  return out;
}

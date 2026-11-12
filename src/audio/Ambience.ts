/**
 * The air of each place, all synthesised: a looped noise bed through a filter (wind, the drowned murk, a cellar's hush)
 * plus sparse one-shots (crickets by night, drips in the cellars). `zone()` is called every frame and acts on change;
 * beds crossfade. Everything runs through the same muffle as the music.
 */
import type { Audio } from './Audio';

export interface Air {
  /** Bed: filter type, cutoff Hz, Q, gain. */
  filter: BiquadFilterType; hz: number; q: number; gain: number;
  /** A one-shot every `every` seconds (±50 %): sine at `tick` Hz. */
  tick?: { hz: number; every: number; gain: number; seconds: number };
}

export const AIR: Record<string, Air> = {
  island: { filter: 'lowpass', hz: 420, q: 0.4, gain: 0.05, tick: { hz: 4300, every: 1.6, gain: 0.012, seconds: 0.05 } },
  galaxy: { filter: 'bandpass', hz: 300, q: 0.6, gain: 0.03 },
  vale: { filter: 'lowpass', hz: 520, q: 0.5, gain: 0.05, tick: { hz: 3900, every: 1.1, gain: 0.014, seconds: 0.06 } },
  graveyard: { filter: 'bandpass', hz: 240, q: 1.1, gain: 0.07 },
  sunken: { filter: 'lowpass', hz: 170, q: 0.7, gain: 0.12 },
  dream: { filter: 'bandpass', hz: 640, q: 2, gain: 0.025 },
  treehouse: { filter: 'lowpass', hz: 260, q: 0.4, gain: 0.025 },
  'tavern-room': { filter: 'lowpass', hz: 300, q: 0.4, gain: 0.03 },
  'castle-hall': { filter: 'lowpass', hz: 240, q: 0.5, gain: 0.03 },
  'crypt-room': { filter: 'lowpass', hz: 220, q: 0.6, gain: 0.04, tick: { hz: 1500, every: 2.8, gain: 0.03, seconds: 0.09 } },
};

export class Ambience {
  private here: string | null = null;
  private bed: { src: AudioBufferSourceNode; gain: GainNode } | null = null;
  private wait = 2;

  constructor(private readonly audio: Audio) {}

  /** Call every frame with the zone id (a realm's id, or null for the island). */
  zone(id: string | null, dt: number): void {
    const ctx = this.audio.context, out = this.audio.musicInput;
    if (!ctx || !out) return;
    const key = id ?? 'island';
    if (key !== this.here) { this.here = key; this.swap(ctx, out, AIR[key] ?? AIR.island); }
    const tick = (AIR[key] ?? AIR.island).tick;
    if (!tick) return;
    this.wait -= dt;
    if (this.wait > 0) return;
    this.wait = tick.every * (0.5 + Math.random());
    this.audio.toneAt(out, ctx.currentTime, 'sine', tick.hz, tick.hz * 0.97, tick.seconds, tick.gain);
  }

  private swap(ctx: AudioContext, out: AudioNode, air: Air): void {
    const now = ctx.currentTime;
    if (this.bed) {
      const { src, gain } = this.bed;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + 2);
      src.stop(now + 2.1);
    }
    // Four seconds of noise, looped: long enough that the ear finds no pattern.
    const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = air.filter; f.frequency.value = air.hz; f.Q.value = air.q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(air.gain, now + 2);
    src.connect(f); f.connect(gain); gain.connect(out);
    src.start(now);
    this.bed = { src, gain };
  }
}

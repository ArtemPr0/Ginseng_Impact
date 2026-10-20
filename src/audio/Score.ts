/**
 * The score: the game's own music, synthesised. A step sequencer over the song tables (songs.ts) built on the
 * Audio engine's primitives (toneAt, noiseAt, padAt): one song per place, crossfading when the zone changes, a
 * boss layer mixed over whatever plays, and the ending. Each song plays through its own GainNode into the engine's
 * muffle input, so the underwater and indoor muffle shapes the music as it does the effects. Steps are scheduled a
 * little ahead of the context's clock, from the game loop (`tick`) or from the score's own timer; when nothing
 * plays, nothing runs and nothing is allocated. Needs no browser beyond Web Audio: the tests drive it with a fake
 * context.
 */
import type { Audio } from './Audio';
import type { Zone } from '../game/Events';
import { REGISTER, SONGS, SONG_FOR_ZONE, STEPS_PER_BAR, decodeStep, holdSteps, hz, midiOf, patternBars, stepChar, stepSeconds, swingOffset, type Part, type Song, type SongId, type Step } from './songs';

/** How far ahead steps are scheduled (seconds of context time). */
const LOOKAHEAD = 0.2;
/** The score's own timer, for when the game loop is not driving tick(). */
const TICK_MS = 50;
/** A step this far in the past is skipped rather than fired late (a throttled, hidden tab catching up). */
const LATE = 0.1;
/** The boss layer doubles a slow song's grid, so it still drives. */
const LAYER_MIN_BPM = 76;

interface Track { part: Part; bars: string[] }

/** A song (or the boss layer) playing: its fader, its clock and every node it has sounding. */
interface Voice {
  id: SongId;
  song: Song;
  gain: GainNode;
  lp: BiquadFilterNode | null;
  level: number;
  /** The root the song's degrees resolve over (the layer borrows the current song's). */
  root: number;
  stepDur: number;
  swing: number;
  tracks: Track[];
  /** The next step to schedule and its context time. */
  step: number;
  next: number;
  nodes: { node: AudioScheduledSourceNode; end: number }[];
  /** When the fade-out ends and the nodes are stopped; null while playing. */
  releaseAt: number | null;
}

/** High notes a little quieter, so a bell or a pluck up top does not pierce. */
const soft = (f: number): number => Math.min(1, Math.sqrt(880 / f));

export class Score {
  private ctx: AudioContext | null = null;
  private bus: GainNode | null = null;
  private volume = 0.6;
  /** What should play; play(), stop() and layer() set it and tick() makes it so once the engine has a context. */
  private want: SongId | null = null;
  private wantLayer = false;
  private fade = 2;
  private layerFade = 1;
  private voice: Voice | null = null;
  private layerVoice: Voice | null = null;
  /** Voices fading out, until their release. */
  private readonly fading: Voice[] = [];
  private lastZone: string | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(private readonly audio: Audio) { audio.attach(this); }

  /** The song that plays, or will once the engine is unlocked (the boss layer is not a song). */
  get current(): SongId | null { return this.want; }

  /** True when nothing plays, fades or waits: the timer is off and tick() returns at once. */
  get idle(): boolean { return !this.want && !this.wantLayer && !this.voice && !this.layerVoice && this.fading.length === 0; }

  /** Crossfades to a song over `fadeSeconds`; asking for the song already playing does nothing. */
  play(id: SongId, fadeSeconds = 2): void {
    if (this.want === id) return;
    this.want = id;
    this.fade = fadeSeconds;
    this.run();
  }

  /** Fades the song (and the boss layer) out and, once silent, stops every node. */
  stop(fadeSeconds = 2): void {
    if (!this.want && !this.wantLayer) return;
    this.want = null;
    this.wantLayer = false;
    this.fade = fadeSeconds;
    this.layerFade = fadeSeconds;
    this.run();
  }

  /** The boss layer (kick, 808, riser, half-time snare) over whatever plays, on the current song's grid and root. */
  layer(id: 'boss', on: boolean, fadeSeconds = 1): void {
    void id;
    if (this.wantLayer === on) return;
    this.wantLayer = on;
    this.layerFade = fadeSeconds;
    this.run();
  }

  /**
   * The place the player is in, every frame (cheap: it acts only when the zone changes): each zone's song
   * crossfades in. Entering the kingdom goes through Audio.kingdom(): the underwater arrival and the hum, and the
   * licensed `kingdom` track when one is installed (the score then yields to it); leaving fades them. Every
   * quarter of the kingdom shares the Lean Quarter's song today, so `district` is accepted for later.
   */
  zone(zone: Zone | string, _district?: string | null): void {
    if (zone === this.lastZone) return;
    const from = this.lastZone;
    this.lastZone = zone;
    const id = (SONG_FOR_ZONE as Record<string, SongId | undefined>)[zone] ?? 'island';
    if (zone === 'galaxy') {
      this.audio.kingdom(true);
      if (this.audio.hasMusic('kingdom')) { this.quiet(this.fade); return; }
    } else if (from === 'galaxy') this.audio.kingdom(false);
    this.play(id);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.bus && this.ctx) this.bus.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
  }

  /**
   * Schedules the next LOOKAHEAD seconds of steps (at context time `now`, the context's clock when omitted),
   * starts and releases voices, and stops the nodes of a voice whose fade has ended. Call it from the game loop or
   * leave it to the score's timer; both may run, the work is the same either way.
   */
  tick(now?: number): void {
    if (this.idle) return;
    if (!this.ctx) {
      const ctx = this.audio.context;
      if (!ctx) return;
      this.init(ctx);
    }
    const t = now ?? this.ctx!.currentTime;
    this.reconcile(t);
    if (this.voice) this.schedule(this.voice, t);
    if (this.layerVoice) this.schedule(this.layerVoice, t);
    for (let i = this.fading.length - 1; i >= 0; i--) {
      const v = this.fading[i];
      this.schedule(v, t);
      if (v.releaseAt !== null && t >= v.releaseAt) { this.kill(v, t); this.fading.splice(i, 1); }
    }
    if (this.idle) this.stopTimer();
  }

  /** Stops everything at once (no fade) and the timer; the score can play again afterwards. */
  dispose(): void {
    this.want = null;
    this.wantLayer = false;
    const t = this.ctx?.currentTime ?? 0;
    for (const v of [this.voice, this.layerVoice, ...this.fading]) if (v) this.kill(v, t);
    this.voice = this.layerVoice = null;
    this.fading.length = 0;
    this.stopTimer();
  }

  private quiet(fade: number): void {
    if (!this.want) return;
    this.want = null;
    this.fade = fade;
    this.run();
  }

  private run(): void {
    if (!this.timer) this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
  }

  private stopTimer(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private init(ctx: AudioContext): void {
    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.bus.gain.value = this.volume;
    this.bus.connect(this.audio.musicInput ?? ctx.destination);
  }

  /** Makes what plays match what is wanted: releases, revives or starts the song and the layer. */
  private reconcile(t: number): void {
    if (this.voice && this.voice.id !== this.want) { this.release(this.voice, t, this.fade); this.voice = null; }
    if (this.want && !this.voice) this.voice = this.revive(this.want, t, this.fade) ?? this.start(SONGS[this.want], t, this.fade, null);
    if (this.layerVoice && !this.wantLayer) { this.release(this.layerVoice, t, this.layerFade); this.layerVoice = null; }
    if (this.wantLayer && !this.layerVoice) this.layerVoice = this.revive('boss', t, this.layerFade) ?? this.start(SONGS.boss, t, this.layerFade, this.voice);
  }

  /** A voice fading in over `fade` from `t`; a layer (`host` given) on the host's grid and root. */
  private start(song: Song, t: number, fade: number, host: Voice | null): Voice {
    const ctx = this.ctx!;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(song.gain, t + Math.max(0.01, fade));
    let lp: BiquadFilterNode | null = null;
    if (song.lowpass) {
      lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = song.lowpass;
      gain.connect(lp).connect(this.bus!);
    } else gain.connect(this.bus!);
    let bpm = song.bpm, root = song.root, swing = song.swing ?? 0, step = 0, next = t + 0.05;
    if (host) {
      const twice = host.song.bpm < LAYER_MIN_BPM ? 2 : 1;
      bpm = host.song.bpm * twice;
      root = host.root;
      swing = host.swing;
      next = host.next;
      step = host.step * twice;
    }
    const tracks = (Object.keys(song.parts) as Part[]).map((part) => ({ part, bars: patternBars(song.parts[part]!) }));
    return { id: song.id, song, gain, lp, level: song.gain, root, stepDur: stepSeconds(bpm), swing, tracks, step, next, nodes: [], releaseAt: null };
  }

  private release(v: Voice, t: number, fade: number): void {
    const g = v.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + Math.max(0.01, fade));
    v.releaseAt = t + fade + 0.05;
    this.fading.push(v);
  }

  /** A voice still fading out that is wanted again fades back in instead of restarting. */
  private revive(id: SongId, t: number, fade: number): Voice | null {
    const i = this.fading.findIndex((v) => v.id === id);
    if (i < 0) return null;
    const [v] = this.fading.splice(i, 1);
    const g = v.gain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v.level, t + Math.max(0.01, fade));
    v.releaseAt = null;
    return v;
  }

  private kill(v: Voice, t: number): void {
    for (const n of v.nodes) { try { n.node.stop(t); } catch { /* already ended */ } }
    v.nodes.length = 0;
    try { v.gain.disconnect(); v.lp?.disconnect(); } catch { /* never connected */ }
  }

  /** Schedules the voice's steps up to LOOKAHEAD ahead (and never past its release). */
  private schedule(v: Voice, t: number): void {
    if (v.next < t - LATE) {
      const missed = Math.ceil((t - v.next) / v.stepDur);
      v.next += missed * v.stepDur;
      v.step += missed;
    }
    const until = Math.min(t + LOOKAHEAD, v.releaseAt ?? Infinity);
    while (v.next < until) {
      this.playStep(v, v.step, v.next + swingOffset(v.step, v.stepDur, v.swing));
      v.next += v.stepDur;
      v.step++;
    }
    // Forget the nodes that have ended, so a long song does not keep every note it ever played.
    if (v.nodes.length > 48) {
      let k = 0;
      for (const n of v.nodes) if (n.end > t) v.nodes[k++] = n;
      v.nodes.length = k;
    }
  }

  private playStep(v: Voice, step: number, t: number): void {
    const song = v.song;
    const bar = Math.floor(step / STEPS_PER_BAR) % song.bars;
    const chord = song.chords[bar];
    for (const track of v.tracks) {
      const s = decodeStep(stepChar(track.bars, step, song.bars));
      if (!s) continue;
      this.hit(v, track.part, s, chord, holdSteps(track.bars, step, song.bars) * v.stepDur, t);
    }
  }

  /** One hit of a part at context time `t`: the instrument, from the engine's primitives, into the voice's fader. */
  private hit(v: Voice, part: Part, s: Step, chord: readonly number[], hold: number, t: number): void {
    const a = this.audio;
    const out = v.gain;
    const vel = s.velocity;
    const semis = v.song.octaves?.[part] ?? REGISTER[part];
    const f = (i: number): number => hz(midiOf(v.root, v.song.scale, chord[Math.min(i, chord.length - 1)]) + semis);
    const all = (): number[] => (s.index === null ? chord.map((_, i) => i) : [s.index]);
    const keep = (n: AudioScheduledSourceNode | null, length: number): void => { if (n) v.nodes.push({ node: n, end: t + length }); };
    switch (part) {
      case 'kick':
        keep(a.toneAt(out, t, 'sine', 120, 42, 0.3, 0.32 * vel, 0.002, 0.08), 0.5);
        break;
      case 'snare':
        keep(a.noiseAt(out, t, 0.22, 'bandpass', 1800, 1200, 1.2, 0.2 * vel, 0.002), 0.4);
        keep(a.toneAt(out, t, 'triangle', 200, 160, 0.08, 0.06 * vel), 0.3);
        break;
      case 'hats':
        keep(a.noiseAt(out, t, 0.03, 'highpass', 8000, 9000, 1, 0.07 * vel, 0.001), 0.2);
        break;
      case 'bass': {
        // The 808: a sine sagging a little in pitch, held to the next bass note but never longer than a beat.
        const d = Math.max(0.45, Math.min(hold, 4 * v.stepDur));
        const p = f(s.index ?? 0);
        keep(a.toneAt(out, t, 'sine', p, p / 1.1, d, 0.16 * vel, 0.01, 0.3), d + 0.5);
        break;
      }
      case 'pad': {
        const w = v.song.width ?? 8;
        for (const i of all()) for (const det of [-w, w]) keep(a.padAt(out, t, f(i), det, hold, 0.022 * vel), hold + 0.1);
        break;
      }
      case 'choir':
        // Three sines a few cents apart per tone, swelling up over the first part of the hold and sinking away.
        for (const i of all()) for (const det of [-7, 0, 7]) {
          const p = f(i) * Math.pow(2, det / 1200);
          keep(a.toneAt(out, t, 'sine', p, p, hold * 0.35, 0.012 * vel, hold * 0.4, hold * 0.25), hold + 0.2);
        }
        break;
      case 'drone':
        for (const det of [-4, 4]) keep(a.padAt(out, t, f(s.index ?? 0), det, hold, 0.03 * vel, 320), hold + 0.1);
        break;
      case 'pluck':
        // A plucked string: a triangle snapping up to pitch with a sine an octave up; a chord is strummed.
        all().forEach((i, k) => {
          const p = f(i);
          const g = vel * soft(p);
          const at = t + k * 0.015;
          keep(a.toneAt(out, at, 'triangle', p * 0.97, p, 0.3, 0.12 * g, 0.003, 0.25, 0.02), 0.7);
          keep(a.toneAt(out, at, 'sine', p * 2, p * 2, 0.18, 0.035 * g, 0.003, 0.12), 0.4);
        });
        break;
      case 'bells': {
        const p = f(s.index ?? 0);
        const g = vel * soft(p);
        keep(a.toneAt(out, t, 'sine', p, p, 1.2, 0.09 * g, 0.004, 0.9), 2.3);
        keep(a.toneAt(out, t, 'sine', p * 2.4, p * 2.4, 0.5, 0.025 * g, 0.004, 0.4), 1);
        keep(a.toneAt(out, t, 'triangle', p * 4, p * 4.01, 0.25, 0.012 * g, 0.003, 0.2), 0.5);
        break;
      }
      case 'riser': {
        // Noise and a saw climbing for the whole hold, peaking on the next downbeat.
        const p = f(0);
        keep(a.noiseAt(out, t, hold * 0.25, 'bandpass', 250, 5000, 1.6, 0.12 * vel, hold * 0.75, hold), hold + 0.3);
        keep(a.toneAt(out, t, 'sawtooth', p, p * 4, hold * 0.3, 0.04 * vel, hold * 0.7, 0.3, hold), hold + 0.5);
        break;
      }
    }
  }
}

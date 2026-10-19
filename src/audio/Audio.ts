import { musicUrl, trimSilence, type MusicSlot } from './music';

/** A decoded song and where its sound starts and ends (seconds, the silence at either end trimmed off). */
interface Song { buf: AudioBuffer; start: number; end: number }
/** A song (or a chain of them) playing through its own fader. */
interface Playing { gain: GainNode; sources: AudioBufferSourceNode[] }
/** Who a recorded line belongs to: a new line on a channel takes over from the one still playing there. */
export type VoiceChannel = 'npc' | 'mob' | 'head';
/** Seconds a line takes to fade out when another takes its channel. */
const VOICE_FADE = 0.06;

/**
 * Procedural sound engine: every effect is synthesised with Web Audio, except recorded voice lines
 * (`voice`, files under public/audio) and the songs (`title`, `kingdom`; see music.ts). Resumes on the first user
 * gesture; all methods are safe to call before that.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private readonly clips = new Map<string, Promise<AudioBuffer | null>>();
  /** The line each voice channel is saying (see voice). */
  private readonly voices = new Map<VoiceChannel, { src: AudioBufferSourceNode; gain: GainNode }>();
  /** How many lines each channel has been asked for: the newest is the one that plays (see voice). */
  private readonly voiceSeq = new Map<VoiceChannel, number>();
  /** A low-pass the whole mix runs through (wide open, except for the kingdom's underwater arrival). */
  private muffle: BiquadFilterNode | null = null;
  /** The kingdom's music while it plays: its bus, the hum, the step scheduler. */
  private kingdomMusic: { bus: GainNode; timer: number; next: number; step: number; started: number } | null = null;
  /** Songs skip the effects' compressor: their own bus, and their own low-pass for the underwater arrival. */
  private musicBus: GainNode | null = null;
  private musicLp: BiquadFilterNode | null = null;
  private readonly songs = new Map<MusicSlot, Promise<Song | null>>();
  private titleSong: Playing | null = null;
  private kingdomSong: Playing | null = null;
  volume = 0.6;
  musicVolume = 0.5;

  /** Call from a user gesture (click / keydown). */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.volume;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 6;
    this.muffle = this.ctx.createBiquadFilter();
    this.muffle.type = 'lowpass';
    this.muffle.frequency.value = 20000;
    this.master.connect(this.muffle).connect(comp).connect(this.ctx.destination);
    this.musicLp = this.ctx.createBiquadFilter();
    this.musicLp.type = 'lowpass';
    this.musicLp.frequency.value = 20000;
    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.musicLp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private get now(): number { return this.ctx!.currentTime; }

  /** True until the browser lets sound play (most wait for the first click or key press). */
  get suspended(): boolean { return this.ctx?.state !== 'running'; }

  /** Whether any of these slots has a song file. */
  hasMusic(...slots: MusicSlot[]): boolean { return slots.some((slot) => musicUrl(slot) !== null); }

  /**
   * The title screen's music: the intro sample once, then the loop on repeat, the loop starting on the intro's last
   * sample (both are decoded first, so there is no gap). `false` fades it out and lets the songs go.
   */
  title(on: boolean): void {
    if (!this.ctx) return;
    if (!on) {
      this.fadeOut(this.titleSong);
      this.titleSong = null;
      this.songs.delete('title-intro');
      this.songs.delete('title-loop');
      return;
    }
    if (this.titleSong) return;
    const play = this.playing();
    this.titleSong = play;
    void Promise.all([this.song('title-intro'), this.song('title-loop')]).then(([intro, loop]) => {
      if (this.titleSong !== play || !this.ctx) return;
      let t = this.ctx.currentTime + 0.05;
      if (intro) t = this.schedule(play, intro, t, false);
      if (loop) this.schedule(play, loop, t, true);
    });
  }

  /** Loads and decodes a slot's song once (null when it has no file or will not decode). */
  private song(slot: MusicSlot): Promise<Song | null> {
    let p = this.songs.get(slot);
    if (!p) {
      const url = musicUrl(slot);
      const ctx = this.ctx!;
      p = !url ? Promise.resolve(null) : fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => {
          const { start, end } = trimSilence(Array.from({ length: buf.numberOfChannels }, (_, i) => buf.getChannelData(i)));
          return { buf, start: start / buf.sampleRate, end: end / buf.sampleRate };
        })
        .catch((e: unknown) => { console.warn(`[music] '${slot}' would not play: ${String(e)}`); return null; });
      this.songs.set(slot, p);
    }
    return p;
  }

  private playing(): Playing {
    const gain = this.ctx!.createGain();
    gain.connect(this.musicBus!);
    return { gain, sources: [] };
  }

  /** Starts `song` at context time `t`, once or (`loop`) for ever; returns when a single play ends. */
  private schedule(p: Playing, song: Song, t: number, loop: boolean): number {
    const src = this.ctx!.createBufferSource();
    src.buffer = song.buf;
    src.connect(p.gain);
    if (loop) {
      src.loop = true;
      src.loopStart = song.start;
      src.loopEnd = song.end;
      src.start(t, song.start);
    } else src.start(t, song.start, song.end - song.start);
    p.sources.push(src);
    return t + song.end - song.start;
  }

  private fadeOut(p: Playing | null, tau = 0.5): void {
    if (!p || !this.ctx) return;
    p.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, tau);
    window.setTimeout(() => { for (const s of p.sources) s.stop(); p.gain.disconnect(); }, tau * 6000);
  }

  private env(node: AudioNode, a: number, peak: number, d: number, sustain = 0, r = 0.05, at = 0): GainNode {
    const g = this.ctx!.createGain();
    const t = this.now + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * (sustain || 0.001)), t + a + d);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d + r);
    node.connect(g).connect(this.master!);
    return g;
  }

  private noise(dur: number, filterType: BiquadFilterType, f0: number, f1: number, q: number, peak: number, at = 0, attack = 0.005): void {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf!;
    const flt = this.ctx.createBiquadFilter();
    flt.type = filterType;
    flt.Q.value = q;
    const t = this.now + at;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    src.connect(flt);
    this.env(flt, attack, peak, dur, 0, 0.03, at);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, peak: number, at = 0, attack = 0.004, release = 0.05): void {
    if (!this.ctx) return;
    const o = this.ctx.createOscillator();
    o.type = type;
    const t = this.now + at;
    o.frequency.setValueAtTime(f0, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    this.env(o, attack, peak, dur, 0, release, at);
    o.start(t);
    o.stop(t + dur + release + 0.1);
  }

  /** Blade whoosh. `heavy` is slower and lower. */
  swing(heavy = false): void {
    this.noise(heavy ? 0.26 : 0.14, 'bandpass', heavy ? 900 : 2200, heavy ? 180 : 400, 1.2, heavy ? 0.5 : 0.35, 0, heavy ? 0.03 : 0.01);
  }

  /** Flesh/stone impact with an optional elemental ping. */
  hit(elemental: boolean, heavy = false): void {
    if (!this.ctx) return;
    this.tone('sine', heavy ? 140 : 180, heavy ? 36 : 50, heavy ? 0.22 : 0.12, heavy ? 0.9 : 0.6);
    this.noise(heavy ? 0.12 : 0.06, 'lowpass', 2500, 300, 0.7, heavy ? 0.7 : 0.45);
    this.noise(0.03, 'highpass', 3000, 6000, 0.5, 0.25);
    if (elemental) {
      this.tone('triangle', 1320, 1760, 0.12, 0.18, 0.01);
      this.tone('sine', 2640, 2200, 0.2, 0.12, 0.02);
    }
  }

  /** Elemental reaction burst. */
  reaction(): void {
    this.tone('triangle', 660, 1320, 0.25, 0.3);
    this.tone('triangle', 990, 1980, 0.3, 0.2, 0.05);
    this.noise(0.35, 'bandpass', 1200, 4000, 0.8, 0.3);
  }

  /** Something died. */
  kill(boss = false): void {
    this.tone('sawtooth', 110, 30, boss ? 1.2 : 0.4, boss ? 0.8 : 0.4, 0, 0.01, 0.3);
    this.noise(boss ? 1.0 : 0.3, 'lowpass', 1800, 120, 0.8, boss ? 0.8 : 0.5);
    if (boss) { this.tone('sine', 55, 40, 1.6, 0.9, 0.05, 0.02, 0.4); this.tone('triangle', 880, 1760, 0.6, 0.25, 0.4); this.tone('triangle', 1320, 2640, 0.8, 0.2, 0.6); }
  }

  /** Loot chime: a rising two-note bell with sparkle. */
  loot(rarity = 1): void {
    const base = 1046 * Math.pow(1.19, rarity - 1);
    this.tone('sine', base, base, 0.35, 0.35, 0, 0.005, 0.25);
    this.tone('sine', base * 1.5, base * 1.5, 0.45, 0.3, 0.09, 0.005, 0.3);
    this.tone('triangle', base * 2, base * 2.01, 0.5, 0.12, 0.18, 0.005, 0.3);
    if (rarity >= 3) { this.tone('sine', base * 2.5, base * 2.5, 0.6, 0.2, 0.27, 0.005, 0.4); this.noise(0.4, 'highpass', 6000, 9000, 0.5, 0.12, 0.2); }
  }

  /** Something flying into you: a quick rising whoosh with a glint at the top. */
  absorb(): void {
    this.noise(0.28, 'bandpass', 500, 3200, 2.5, 0.16, 0, 0.02);
    this.tone('sine', 420, 1600, 0.26, 0.08, 0, 0.01, 0.06);
    this.tone('sine', 2093, 2093, 0.25, 0.07, 0.24, 0.003, 0.2);
  }

  /** A skeleton falling apart: dry bones clattering down, a couple of hollow knocks. */
  clatter(): void {
    for (let i = 0; i < 9; i++) {
      const at = Math.pow(i / 9, 1.4) * 0.75 + Math.random() * 0.04;
      this.noise(0.05, 'bandpass', 1800 + Math.random() * 1600, 2600, 5, 0.26 * (1 - i / 12), at, 0.002);
    }
    this.tone('sine', 220, 160, 0.08, 0.1, 0.1);
    this.tone('sine', 190, 140, 0.08, 0.08, 0.42);
  }

  /**
   * Yung Lean's kingdom: arriving, everything is muffled as if underwater and clears, and its song plays on repeat
   * (the `kingdom` slot). With no song, a distant autotuned hum drifts in and fades into a slow cloud-rap beat
   * (70 BPM: kick and 808, a half-time snare, hats with rolls, a dreamy pad over Am–F–C–G). `false` fades it away.
   */
  kingdom(on: boolean): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    if (!on) {
      this.fadeOut(this.kingdomSong, 0.6);
      this.kingdomSong = null;
      const m = this.kingdomMusic;
      if (!m) return;
      this.kingdomMusic = null;
      m.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.6);
      window.setTimeout(() => { window.clearInterval(m.timer); m.bus.disconnect(); }, 3000);
      return;
    }
    if (this.kingdomMusic || this.kingdomSong) return;
    const t0 = ctx.currentTime;
    for (const lp of [this.muffle, this.musicLp]) {
      if (!lp) continue;
      lp.frequency.cancelScheduledValues(t0);
      lp.frequency.setValueAtTime(320, t0);
      lp.frequency.exponentialRampToValueAtTime(20000, t0 + 2.8);
    }
    if (musicUrl('kingdom')) {
      const play = this.playing();
      this.kingdomSong = play;
      void this.song('kingdom').then((song) => {
        if (this.kingdomSong !== play || !this.ctx) return;
        if (song) { this.schedule(play, song, this.ctx.currentTime + 0.05, true); return; }
        // (A file that will not decode: the synthesised beat instead.)
        this.kingdomSong = null;
        this.kingdomBeat(this.ctx.currentTime);
      });
      return;
    }
    this.kingdomBeat(t0);
  }

  /** The kingdom's synthesised music, from `t0`: the hum, then the beat. */
  private kingdomBeat(t0: number): void {
    const ctx = this.ctx!;
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(this.master!);
    // The hum: two detuned saws through "oo" formants, snapping from note to note like autotune.
    const hum = ctx.createGain();
    hum.gain.setValueAtTime(0.0001, t0);
    hum.gain.exponentialRampToValueAtTime(0.06, t0 + 1.2);
    hum.gain.setValueAtTime(0.06, t0 + 6);
    hum.gain.exponentialRampToValueAtTime(0.0001, t0 + 11);
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 330; f1.Q.value = 5;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 880; f2.Q.value = 7;
    const mix = ctx.createGain(); mix.gain.value = 1;
    f1.connect(mix); f2.connect(mix); mix.connect(hum).connect(bus);
    const notes = [220, 261.6, 293.7, 329.6, 293.7, 261.6, 196, 220, 261.6, 329.6, 392, 329.6];
    for (const det of [-6, 7]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.detune.value = det;
      // Each note snaps up from the one before it (the first from itself), like autotune catching the pitch.
      o.frequency.setValueAtTime(notes[0], t0);
      notes.forEach((f, i) => { const t = t0 + 0.4 + i * 0.85; o.frequency.setValueAtTime(notes[(i + notes.length - 1) % notes.length], t); o.frequency.exponentialRampToValueAtTime(f, t + 0.035); });
      o.connect(f1); o.connect(f2);
      o.start(t0);
      o.stop(t0 + 12);
    }
    const m = { bus, timer: 0, next: t0 + 4, step: 0, started: t0 };
    const sixteenth = 60 / 70 / 4;
    const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [261.6, 329.6, 392], [196, 246.9, 293.7]];
    const fadeIn = (t: number) => Math.min(1, Math.max(0, (t - (t0 + 4)) / 6));
    m.timer = window.setInterval(() => {
      if (this.kingdomMusic !== m || !this.ctx) return;
      // A throttled timer (a hidden tab) falls behind: skip the steps already in the past instead of firing them all.
      if (m.next < this.ctx.currentTime - 0.1) {
        const missed = Math.ceil((this.ctx.currentTime - m.next) / sixteenth);
        m.next += missed * sixteenth;
        m.step += missed;
      }
      while (m.next < this.ctx.currentTime + 0.25) {
        const t = m.next;
        const at = t - this.ctx.currentTime;
        const step = m.step % 16;
        const bar = Math.floor(m.step / 16) % 4;
        const v = fadeIn(t);
        if (v > 0) {
          if (step === 0 || step === 7 || step === 10) { this.tone('sine', 120, 42, 0.3, 0.32 * v, at, 0.002, 0.08); this.tone('sine', chords[bar][0] / 4, chords[bar][0] / 4.4, 0.9, 0.16 * v, at, 0.01, 0.3); }
          if (step === 8) { this.noise(0.22, 'bandpass', 1800, 1200, 1.2, 0.2 * v, at, 0.002); this.tone('triangle', 200, 160, 0.08, 0.06 * v, at); }
          const roll = bar === 3 && step >= 13;
          if (step % 2 === 0 || roll) { this.noise(0.03, 'highpass', 8000, 9000, 1, (roll ? 0.05 : 0.07) * v, at, 0.001); if (roll) this.noise(0.03, 'highpass', 8000, 9000, 1, 0.04 * v, at + sixteenth / 3, 0.001); }
          if (step === 0) for (const f of chords[bar]) for (const det of [-8, 8]) this.padNote(f, det, t, sixteenth * 16, 0.022 * v, m.bus);
        }
        m.next += sixteenth;
        m.step++;
      }
    }, 60);
    this.kingdomMusic = m;
  }

  /** A soft detuned saw through a dark low-pass, swelling in and out over `dur` (the kingdom's pad). */
  private padNote(f: number, detune: number, t: number, dur: number, peak: number, out: AudioNode): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = detune;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + dur * 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp).connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  /** Coin clinks. */
  coins(n = 3): void {
    for (let i = 0; i < n; i++) {
      const f = 2400 + Math.random() * 1400;
      this.tone('triangle', f, f * 0.98, 0.07, 0.22, i * 0.06, 0.002, 0.06);
      this.tone('sine', f * 1.5, f * 1.48, 0.05, 0.12, i * 0.06 + 0.01, 0.002, 0.05);
    }
  }

  /** The player got hurt. */
  hurt(): void {
    this.tone('sine', 220, 80, 0.18, 0.5);
    this.noise(0.12, 'lowpass', 900, 200, 0.7, 0.4);
  }

  /** Boss roar: long filtered noise with a growl. */
  roar(): void {
    if (!this.ctx) return;
    this.noise(0.9, 'lowpass', 400, 1800, 0.6, 0.9, 0, 0.08);
    this.tone('sawtooth', 70, 48, 0.9, 0.5, 0, 0.06, 0.3);
    this.tone('square', 95, 60, 0.7, 0.2, 0.05, 0.06, 0.3);
  }

  stomp(): void {
    this.tone('sine', 90, 30, 0.3, 0.8);
    this.noise(0.18, 'lowpass', 600, 80, 0.8, 0.5);
  }

  /** Skill cast: a bright sweep. */
  cast(): void {
    this.tone('sine', 400, 1600, 0.3, 0.3);
    this.noise(0.3, 'bandpass', 800, 5000, 1.5, 0.25);
  }

  /** Burst: rising arpeggio and a boom. */
  burst(): void {
    [523, 659, 784, 1046, 1318].forEach((f, i) => this.tone('triangle', f, f, 0.25, 0.3, i * 0.06, 0.004, 0.15));
    this.tone('sine', 80, 30, 0.6, 0.9, 0.3);
    this.noise(0.6, 'lowpass', 3000, 200, 0.5, 0.6, 0.3);
  }

  dodge(): void {
    this.noise(0.18, 'bandpass', 600, 2400, 0.9, 0.3, 0, 0.02);
  }

  /** UI tick. */
  click(): void {
    this.tone('square', 1800, 1400, 0.03, 0.12, 0, 0.002, 0.03);
  }

  /** Hired a companion / bought something. */
  fanfare(): void {
    [659, 784, 1046].forEach((f, i) => this.tone('triangle', f, f, 0.3, 0.3, i * 0.1, 0.005, 0.2));
    this.coins(2);
  }

  heal(): void {
    this.tone('sine', 880, 1320, 0.4, 0.25, 0, 0.02, 0.3);
    this.tone('sine', 1320, 1760, 0.5, 0.15, 0.1, 0.02, 0.3);
  }

  talk(): void {
    this.tone('triangle', 520, 620, 0.08, 0.15, 0, 0.004, 0.06);
    this.tone('triangle', 620, 740, 0.08, 0.12, 0.08, 0.004, 0.06);
  }

  footstep(): void {
    this.noise(0.05, 'lowpass', 500, 120, 0.8, 0.12);
  }

  /** A short wet slurp through a straw (the cup gnome's sip), `gain` 0..1 for distance. */
  slurp(gain = 1): void {
    if (!this.ctx || gain <= 0.01) return;
    for (let i = 0; i < 3; i++) {
      const at = i * 0.11 + Math.random() * 0.03;
      this.noise(0.09, 'bandpass', 900 + Math.random() * 300, 2200, 6, 0.22 * gain, at, 0.01);
      this.tone('sine', 260 + i * 40, 520 + i * 60, 0.07, 0.05 * gain, at + 0.02);
    }
    this.tone('sine', 180, 120, 0.12, 0.06 * gain, 0.38);
  }

  /** A hand rummaging in a leather pouch. */
  rustle(): void {
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) this.noise(0.07, 'bandpass', 2400 + Math.random() * 1600, 1800, 2, 0.06, i * 0.09 + Math.random() * 0.03);
  }

  /** Munching a mushroom: soft, wet crunches. */
  munch(): void {
    if (!this.ctx) return;
    for (let i = 0; i < 4; i++) this.noise(0.06, 'lowpass', 1400, 500, 1, 0.12, i * 0.16 + Math.random() * 0.03, 0.004);
  }

  /**
   * Plays a recorded line from public/audio (loaded once) on `channel`, the line that channel was still saying fading
   * out under it: one speaker at a time among the NPCs, one among the mobs, the stone head on its own. A line whose
   * clip is still loading when a newer one is asked for on its channel is dropped. Resolves to the line's length in
   * seconds, 0 if it did not play.
   */
  async voice(url: string, gain = 1, channel: VoiceChannel = 'npc', rate = 1): Promise<number> {
    if (!this.ctx || gain <= 0.01) return 0;
    const seq = (this.voiceSeq.get(channel) ?? 0) + 1;
    this.voiceSeq.set(channel, seq);
    let p = this.clips.get(url);
    if (!p) {
      const ctx = this.ctx;
      p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))).then((b) => ctx.decodeAudioData(b)).catch(() => null);
      this.clips.set(url, p);
    }
    const buf = await p;
    // (A newer line took the channel while this one loaded: it plays, this one does not.)
    if (!buf || !this.ctx || this.voiceSeq.get(channel) !== seq) return 0;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = Math.min(1.5, gain * 1.2);
    src.connect(g).connect(this.master!);
    this.hush(channel);
    const line = { src, gain: g };
    this.voices.set(channel, line);
    src.onended = () => { if (this.voices.get(channel) === line) this.voices.delete(channel); };
    src.start();
    return buf.duration / rate;
  }

  /** Fades the line playing on `channel` out (VOICE_FADE) and stops it. */
  private hush(channel: VoiceChannel): void {
    const line = this.voices.get(channel);
    if (!line || !this.ctx) return;
    this.voices.delete(channel);
    const t = this.ctx.currentTime;
    line.gain.gain.setValueAtTime(line.gain.gain.value, t);
    line.gain.gain.linearRampToValueAtTime(0, t + VOICE_FADE);
    line.src.stop(t + VOICE_FADE);
  }
}

/**
 * Procedural sound engine: every effect is synthesised with Web Audio, except recorded voice lines
 * (`voice`, files under public/audio). Resumes on the first user gesture; all methods are safe to call before that.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private readonly clips = new Map<string, Promise<AudioBuffer | null>>();
  volume = 0.6;

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
    this.master.connect(comp).connect(this.ctx.destination);
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  private get now(): number { return this.ctx!.currentTime; }

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

  /** Plays a recorded line from public/audio (loaded once); resolves to its length in seconds, 0 if unavailable. */
  async voice(url: string, gain = 1, rate = 1): Promise<number> {
    if (!this.ctx || gain <= 0.01) return 0;
    let p = this.clips.get(url);
    if (!p) {
      const ctx = this.ctx;
      p = fetch(url).then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status))))).then((b) => ctx.decodeAudioData(b)).catch(() => null);
      this.clips.set(url, p);
    }
    const buf = await p;
    if (!buf || !this.ctx) return 0;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = this.ctx.createGain();
    g.gain.value = Math.min(1.5, gain * 1.2);
    src.connect(g).connect(this.master!);
    src.start();
    return buf.duration / rate;
  }
}

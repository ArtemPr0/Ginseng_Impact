import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Audio } from './Audio';
import { Score } from './Score';
import { MELODIC, PARTS, REGISTER, SONGS, SONG_FOR_ZONE, STEPS_PER_BAR, decodeStep, holdSteps, hz, midiOf, patternBars, stepChar, swingOffset, type Part, type SongId } from './songs';

/** Just enough of Web Audio for the score: params that remember their automation, nodes that remember start/stop and their connections. */
class FakeParam {
  events: { kind: string; v: number; t: number }[] = [];
  constructor(public value: number) {}
  setValueAtTime(v: number, t: number): void { this.value = v; this.events.push({ kind: 'set', v, t }); }
  linearRampToValueAtTime(v: number, t: number): void { this.events.push({ kind: 'lin', v, t }); }
  exponentialRampToValueAtTime(v: number, t: number): void { this.events.push({ kind: 'exp', v, t }); }
  setTargetAtTime(v: number, t: number): void { this.events.push({ kind: 'target', v, t }); }
  cancelScheduledValues(t: number): void { this.events.push({ kind: 'cancel', v: 0, t }); }
}
class FakeNode {
  out: FakeNode[] = [];
  disconnected = false;
  connect(n: FakeNode): FakeNode { this.out.push(n); return n; }
  disconnect(): void { this.disconnected = true; this.out = []; }
}
class FakeGain extends FakeNode { gain = new FakeParam(1); }
class FakeFilter extends FakeNode { type = ''; frequency = new FakeParam(350); Q = new FakeParam(1); }
class FakeSource extends FakeNode {
  started: number[] = [];
  stopped: number[] = [];
  start(t = 0): void { this.started.push(t); }
  stop(t = 0): void { this.stopped.push(t); }
}
class FakeOsc extends FakeSource { type = 'sine'; frequency = new FakeParam(440); detune = new FakeParam(0); }
class FakeBufferSource extends FakeSource { buffer: unknown = null; playbackRate = new FakeParam(1); loop = false; onended: (() => void) | null = null; }
class FakeContext {
  currentTime = 1;
  state = 'running';
  sampleRate = 48000;
  destination = new FakeNode();
  oscillators: FakeOsc[] = [];
  sources: FakeBufferSource[] = [];
  gains: FakeGain[] = [];
  filters: FakeFilter[] = [];
  resume(): Promise<void> { return Promise.resolve(); }
  createGain(): FakeGain { const g = new FakeGain(); this.gains.push(g); return g; }
  createDynamicsCompressor(): FakeNode { return Object.assign(new FakeNode(), { threshold: new FakeParam(0), ratio: new FakeParam(1) }); }
  createBiquadFilter(): FakeFilter { const f = new FakeFilter(); this.filters.push(f); return f; }
  createBuffer(_channels: number, len: number): { getChannelData(): Float32Array } { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource(): FakeBufferSource { const s = new FakeBufferSource(); this.sources.push(s); return s; }
  createOscillator(): FakeOsc { const o = new FakeOsc(); this.oscillators.push(o); return o; }
  decodeAudioData(): Promise<{ duration: number }> { return Promise.resolve({ duration: 1 }); }
}

let ctx: FakeContext;
class CapturedContext extends FakeContext { constructor() { super(); ctx = this; } }

const ids = Object.keys(SONGS) as SongId[];
/** Every oscillator and noise source made so far. */
const nodes = (): FakeSource[] => [...ctx.oscillators, ...ctx.sources];
/** The nodes made since `seen` was taken. */
const fresh = (seen: Set<FakeSource>): FakeSource[] => nodes().filter((n) => !seen.has(n));
/** A voice's fader: the gain whose fade-in ramps to `level`. */
const faderTo = (level: number): FakeGain | undefined => ctx.gains.find((g) => g.gain.events.some((e) => e.kind === 'lin' && Math.abs(e.v - level) < 1e-9));
const advance = (score: Score, seconds: number): void => { ctx.currentTime += seconds; score.tick(ctx.currentTime); };
const make = (): { audio: Audio; score: Score } => { const audio = new Audio(); audio.unlock(); return { audio, score: new Score(audio) }; };

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('window', { AudioContext: CapturedContext, setTimeout: globalThis.setTimeout.bind(globalThis) });
});
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('song tables', () => {
  it.each(ids)('%s is well formed', (id) => {
    const s = SONGS[id];
    expect(s.id).toBe(id);
    expect(s.bars).toBe(s.chords.length);
    expect(s.bpm).toBeGreaterThanOrEqual(50);
    expect(s.bpm).toBeLessThanOrEqual(140);
    expect(s.gain).toBeGreaterThan(0);
    expect(s.gain).toBeLessThanOrEqual(1);
    expect(s.root).toBeGreaterThanOrEqual(36);
    expect(s.root).toBeLessThanOrEqual(72);
    expect(s.scale).toEqual([...s.scale].sort((a, b) => a - b));
    expect(new Set(s.scale).size).toBe(s.scale.length);
    for (const semis of s.scale) { expect(semis).toBeGreaterThanOrEqual(0); expect(semis).toBeLessThan(12); }
    for (const chord of s.chords) expect(chord.length).toBeGreaterThan(0);
    if (s.swing !== undefined) { expect(s.swing).toBeGreaterThanOrEqual(0); expect(s.swing).toBeLessThanOrEqual(1); }
    const parts = Object.entries(s.parts) as [Part, string][];
    expect(parts.length).toBeGreaterThan(0);
    for (const [part, pattern] of parts) {
      expect(PARTS).toContain(part);
      const bars = patternBars(pattern);
      expect(pattern.replace(/\|/g, '').length % STEPS_PER_BAR).toBe(0);
      for (const bar of bars) expect(bar).toHaveLength(STEPS_PER_BAR);
      // The pattern cycles over the song, so it must divide it, or the loop would jump.
      expect(s.bars % bars.length).toBe(0);
      const allowed = MELODIC.has(part) ? /^[.x1-9a-g]+$/ : /^[.x1-9]+$/;
      for (const bar of bars) expect(bar).toMatch(allowed);
      // Every chord-tone letter names a tone the bar's chord has.
      for (let b = 0; b < s.bars; b++) for (const ch of bars[b % bars.length]) { const step = decodeStep(ch); if (step?.index != null) expect(step.index).toBeLessThan(s.chords[b].length); }
      // A part that never plays is a mistake in the table.
      expect(bars.join('').replace(/\./g, '').length).toBeGreaterThan(0);
    }
  });

  it('every zone has a song', () => {
    for (const id of Object.values(SONG_FOR_ZONE)) expect(SONGS[id]).toBeDefined();
    expect(SONG_FOR_ZONE.galaxy).toBe('lean');
    expect(SONG_FOR_ZONE['tavern-room']).toBe('tavern');
    expect(SONG_FOR_ZONE['crypt-room']).toBe('tavern');
    expect(SONG_FOR_ZONE.treehouse).toBe('island');
  });

  it('the Lean Quarter keeps the kingdom beat: 70 bpm, Am F C G, kick and 808 on 1 and the ands of 2 and 3, the snare on 3, hats with a roll every fourth bar', () => {
    const lean = SONGS.lean;
    expect(lean.bpm).toBe(70);
    expect(lean.parts.kick).toBe('x......x..x.....');
    expect(lean.parts.bass).toBe('x......x..x.....');
    expect(lean.parts.snare).toBe('........x.......');
    expect(patternBars(lean.parts.hats!)[3].slice(13)).not.toContain('.');
    // The pad chords as the old beat voiced them: A3 C4 E4, F3 A3 C4, C4 E4 G4, G3 B3 D4.
    const voicings = lean.chords.map((chord) => chord.map((d) => Math.round(hz(midiOf(lean.root, lean.scale, d)))));
    expect(voicings).toEqual([[220, 262, 330], [175, 220, 262], [262, 330, 392], [196, 247, 294]]);
    // The 808 under the A bar is A1 (55 Hz), as before.
    expect(hz(midiOf(lean.root, lean.scale, 0) + REGISTER.bass)).toBeCloseTo(55, 1);
  });
});

describe('step helpers', () => {
  it('decodes rests, hits, velocities and chord tones', () => {
    expect(decodeStep('.')).toBeNull();
    expect(decodeStep('x')).toEqual({ velocity: 1, index: null });
    expect(decodeStep('9')).toEqual({ velocity: 1, index: null });
    expect(decodeStep('3')!.velocity).toBeCloseTo(1 / 3);
    expect(decodeStep('a')).toEqual({ velocity: 0.85, index: 0 });
    expect(decodeStep('g')!.index).toBe(6);
    expect(decodeStep('|')).toBeNull();
  });

  it('cycles a pattern over the song and measures holds to the next hit', () => {
    const bars = patternBars('x...............|........x.......');
    expect(stepChar(bars, 0, 4)).toBe('x');
    expect(stepChar(bars, 24, 4)).toBe('x');
    expect(stepChar(bars, 32, 4)).toBe('x'); // bar 3 of the song: the pattern's first bar again
    expect(holdSteps(bars, 0, 4)).toBe(24);
    expect(holdSteps(bars, 24, 4)).toBe(8);
    expect(holdSteps(patternBars('x...............'), 0, 8)).toBe(16);
    expect(holdSteps(patternBars('x...............|................'), 0, 8)).toBe(32);
  });

  it('resolves scale degrees across the octaves', () => {
    const minor = SONGS.lean.scale;
    expect(midiOf(57, minor, 0)).toBe(57);
    expect(midiOf(57, minor, 2)).toBe(60); // C4 over A3
    expect(midiOf(57, minor, 7)).toBe(69); // the octave
    expect(midiOf(57, minor, -1)).toBe(55); // G3, the step below
    expect(midiOf(57, minor, -7)).toBe(45);
    expect(hz(69)).toBe(440);
  });

  it('swings only the odd sixteenths', () => {
    expect(swingOffset(0, 0.25, 0.4)).toBe(0);
    expect(swingOffset(1, 0.25, 0.4)).toBeCloseTo(0.05);
    expect(swingOffset(2, 0.25, 0.4)).toBe(0);
    expect(swingOffset(1, 0.25)).toBe(0);
  });
});

describe('Score', () => {
  it('is the one score of its engine', () => {
    const { audio, score } = make();
    expect(audio.score).toBe(score);
  });

  it('schedules the first steps at once and the next ones as the clock advances, always inside the look-ahead', () => {
    const { score } = make();
    score.play('lean');
    expect(score.current).toBe('lean');
    expect(nodes().length).toBeGreaterThan(0);
    for (const n of nodes()) { expect(n.started[0]).toBeGreaterThanOrEqual(ctx.currentTime); expect(n.started[0]).toBeLessThan(ctx.currentTime + 0.3); }
    const seen = new Set(nodes());
    const t0 = ctx.currentTime;
    for (let i = 0; i < 5; i++) advance(score, 0.1); // half a second of a running loop: steps 1..3, the hat on step 2
    const later = fresh(seen);
    expect(later.length).toBeGreaterThan(0);
    for (const n of later) { expect(n.started[0]).toBeGreaterThan(t0); expect(n.started[0]).toBeLessThan(ctx.currentTime + 0.3); }
    expect(nodes().every((n) => n.stopped.length === 1)).toBe(true); // every note knows when it ends
  });

  it('plays into its own fader through the muffle input, fading in over the crossfade time', () => {
    const { score } = make();
    score.play('lean', 2);
    const fader = faderTo(SONGS.lean.gain)!;
    expect(fader).toBeDefined();
    expect(fader.gain.events[0]).toEqual({ kind: 'set', v: 0, t: ctx.currentTime });
    expect(fader.gain.events[1]).toEqual({ kind: 'lin', v: SONGS.lean.gain, t: ctx.currentTime + 2 });
    const bus = fader.out[0] as FakeGain;
    expect(bus.gain.value).toBeCloseTo(0.6);
    expect(bus.out[0]).toBe(ctx.filters[0]); // the engine's muffle (the first filter unlock() makes)
  });

  it('asking for the song already playing does nothing', () => {
    const { score } = make();
    score.play('lean');
    const made = nodes().length;
    const gains = ctx.gains.length;
    score.play('lean');
    expect(nodes().length).toBe(made);
    expect(ctx.gains.length).toBe(gains);
  });

  it('crossfades: the old song ramps to silence while the new one ramps up', () => {
    const { score } = make();
    score.play('island', 2);
    const island = faderTo(SONGS.island.gain)!;
    advance(score, 0.3);
    score.play('vale', 1);
    expect(score.current).toBe('vale');
    const out = island.gain.events.slice(-3);
    expect(out[0].kind).toBe('cancel');
    expect(out[1].kind).toBe('set');
    expect(out[2]).toEqual({ kind: 'lin', v: 0, t: ctx.currentTime + 1 });
    const vale = faderTo(SONGS.vale.gain)!;
    expect(vale).toBeDefined();
    expect(vale).not.toBe(island);
    expect(vale.gain.events[1]).toEqual({ kind: 'lin', v: SONGS.vale.gain, t: ctx.currentTime + 1 });
  });

  it('stop() fades out, then stops every node and disconnects the fader; idle, it allocates nothing', () => {
    const { score } = make();
    score.play('lean');
    advance(score, 0.3);
    const fader = faderTo(SONGS.lean.gain)!;
    score.stop(1);
    expect(score.current).toBeNull();
    expect(fader.gain.events.at(-1)).toEqual({ kind: 'lin', v: 0, t: ctx.currentTime + 1 });
    expect(score.idle).toBe(false); // still fading
    advance(score, 1.2);
    expect(score.idle).toBe(true);
    expect(fader.disconnected).toBe(true);
    expect(nodes().every((n) => n.stopped.length === 2)).toBe(true); // the scheduled end, then the kill
    const made = nodes().length;
    const gains = ctx.gains.length;
    for (let i = 0; i < 20; i++) advance(score, 0.1);
    expect(nodes().length).toBe(made);
    expect(ctx.gains.length).toBe(gains);
  });

  it('a song still fading that is wanted again fades back in instead of restarting', () => {
    const { score } = make();
    score.play('lean');
    const fader = faderTo(SONGS.lean.gain)!;
    advance(score, 0.3);
    score.stop(2);
    advance(score, 0.5);
    score.play('lean', 1);
    expect(faderTo(SONGS.lean.gain)).toBe(fader);
    expect(fader.gain.events.at(-1)).toEqual({ kind: 'lin', v: SONGS.lean.gain, t: ctx.currentTime + 1 });
    expect(fader.disconnected).toBe(false);
  });

  it('zone() acts only on change and maps every zone to its song', () => {
    const { score } = make();
    score.zone('island');
    expect(score.current).toBe('island');
    const gains = ctx.gains.length;
    score.zone('island');
    score.zone('island', 'anything');
    score.zone('treehouse'); // the tree house keeps the island's song
    expect(score.current).toBe('island');
    expect(ctx.gains.length).toBe(gains);
    score.zone('tavern-room');
    expect(score.current).toBe('tavern');
    const tavernGains = ctx.gains.length;
    score.zone('crypt-room'); // the crypt bar shares the tavern's waltz: no new voice
    expect(score.current).toBe('tavern');
    expect(ctx.gains.length).toBe(tavernGains);
    for (const [zone, id] of [['sunken', 'sunken'], ['vale', 'vale'], ['graveyard', 'graveyard'], ['dream', 'dream']] as const) { score.zone(zone); expect(score.current).toBe(id); }
    score.zone('nowhere');
    expect(score.current).toBe('island');
  });

  it('entering the kingdom plays the underwater arrival and the Lean Quarter song; leaving fades it', () => {
    const { score } = make();
    score.zone('island');
    const muffle = ctx.filters[0];
    score.zone('galaxy', 'court');
    expect(score.current).toBe('lean');
    expect(muffle.frequency.events).toContainEqual({ kind: 'set', v: 320, t: ctx.currentTime });
    expect(ctx.oscillators.some((o) => o.type === 'sawtooth' && o.detune.value === 7)).toBe(true); // the hum
    const sweeps = muffle.frequency.events.length;
    score.zone('galaxy', 'snow'); // another quarter: nothing changes
    expect(muffle.frequency.events.length).toBe(sweeps);
    score.zone('vale');
    expect(score.current).toBe('vale');
    expect(faderTo(SONGS.lean.gain)!.gain.events.at(-1)!.v).toBe(0);
  });

  it('the old call path still works: Audio.kingdom() drives the score', () => {
    const { audio, score } = make();
    audio.kingdom(true);
    expect(score.current).toBe('lean');
    audio.kingdom(true);
    expect(nodes().length).toBeGreaterThan(0);
    audio.kingdom(false);
    expect(score.current).toBeNull();
    audio.kingdomBeat();
    expect(score.current).toBe('lean');
  });

  it('the boss layer mixes over the song on its grid, and toggles', () => {
    const { score } = make();
    score.play('sunken');
    advance(score, 0.3);
    const seen = new Set(nodes());
    score.layer('boss', true, 1);
    expect(score.current).toBe('sunken'); // the layer is not a song
    const layer = faderTo(SONGS.boss.gain)!;
    expect(layer).toBeDefined();
    expect(layer.gain.events[1]).toEqual({ kind: 'lin', v: SONGS.boss.gain, t: ctx.currentTime + 1 });
    for (let i = 0; i < 8; i++) advance(score, 0.1);
    const kicks = fresh(seen).filter((n) => n instanceof FakeOsc && n.frequency.events[0]?.v === 120);
    expect(kicks.length).toBeGreaterThan(0); // the sunken city has no kick of its own: these are the layer's
    const gains = ctx.gains.length;
    score.layer('boss', true);
    expect(ctx.gains.length).toBe(gains);
    score.layer('boss', false, 1);
    expect(layer.gain.events.at(-1)).toEqual({ kind: 'lin', v: 0, t: ctx.currentTime + 1 });
    advance(score, 1.2);
    expect(layer.disconnected).toBe(true);
    expect(score.current).toBe('sunken');
    expect(score.idle).toBe(false);
  });

  it('the boss layer plays alone when nothing else does, and stop() takes it down too', () => {
    const { score } = make();
    score.layer('boss', true);
    expect(score.current).toBeNull();
    expect(nodes().length).toBeGreaterThan(0);
    score.stop(1);
    advance(score, 1.2);
    expect(score.idle).toBe(true);
  });

  it('the sunken city plays through its low-pass', () => {
    const { score } = make();
    score.play('sunken');
    const lp = ctx.filters.find((f) => f.type === 'lowpass' && f.frequency.value === SONGS.sunken.lowpass);
    expect(lp).toBeDefined();
    expect(faderTo(SONGS.sunken.gain)!.out[0]).toBe(lp);
  });

  it('before the engine is unlocked nothing throws, and the song starts once it is', () => {
    const audio = new Audio();
    const score = new Score(audio);
    expect(() => { score.zone('island'); score.tick(0); score.setVolume(0.3); score.layer('boss', true); score.layer('boss', false); }).not.toThrow();
    expect(score.current).toBe('island');
    audio.unlock();
    score.tick(ctx.currentTime);
    expect(nodes().length).toBeGreaterThan(0);
    expect(ctx.gains[2].gain.value).toBeCloseTo(0.3); // the volume set before unlock
  });

  it('setVolume moves the bus', () => {
    const { score } = make();
    score.play('title');
    score.setVolume(0.25);
    const bus = faderTo(SONGS.title.gain)!.out[0] as FakeGain;
    expect(bus.gain.events.at(-1)).toMatchObject({ kind: 'target', v: 0.25 });
  });

  it('a throttled clock skips the steps it missed instead of firing them all', () => {
    const { score } = make();
    score.play('lean');
    const seen = new Set(nodes());
    advance(score, 5);
    // Five seconds is ~23 steps of the lean beat; only the look-ahead's worth of steps is scheduled, and none in the past.
    const later = fresh(seen);
    expect(later.length).toBeLessThan(12);
    for (const n of later) expect(n.started[0]).toBeGreaterThanOrEqual(ctx.currentTime - 0.1);
  });

  it.each(ids)('%s plays a whole loop without throwing', (id) => {
    const { score } = make();
    score.play(id, 0.5);
    const song = SONGS[id];
    const loop = song.bars * STEPS_PER_BAR * (60 / song.bpm / 4);
    for (let t = 0; t < loop + 0.5; t += 0.15) advance(score, 0.15);
    expect(nodes().length).toBeGreaterThan(song.bars);
    for (const n of nodes()) { expect(n.started).toHaveLength(1); expect(Number.isFinite(n.started[0])).toBe(true); }
    for (const o of ctx.oscillators) for (const e of o.frequency.events) { expect(e.v).toBeGreaterThan(0); expect(Number.isFinite(e.v)).toBe(true); }
    score.dispose();
    expect(score.idle).toBe(true);
  });
});

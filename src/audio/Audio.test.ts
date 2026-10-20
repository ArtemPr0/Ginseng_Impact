import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Audio } from './Audio';

/** Just enough of Web Audio for the voice lines: params that remember their ramps, sources that remember stop(). */
interface FakeParam { value: number; ramps: Array<[number, number]>; setValueAtTime(v: number, t: number): void; linearRampToValueAtTime(v: number, t: number): void; exponentialRampToValueAtTime(v: number, t: number): void; setTargetAtTime(v: number, t: number, tau: number): void; cancelScheduledValues(t: number): void }
interface FakeGain { gain: FakeParam; connect(n: unknown): unknown; disconnect(): void }
interface FakeSource { buffer: unknown; playbackRate: FakeParam; onended: (() => void) | null; started: number[]; stopped: number[]; connect(n: unknown): unknown; start(t?: number): void; stop(t?: number): void }

const param = (value: number): FakeParam => ({
  value, ramps: [],
  setValueAtTime(v) { this.value = v; },
  linearRampToValueAtTime(v, t) { this.ramps.push([v, t]); },
  exponentialRampToValueAtTime(v, t) { this.ramps.push([v, t]); },
  setTargetAtTime(v, t) { this.ramps.push([v, t]); },
  cancelScheduledValues() {},
});

class FakeContext {
  static sources: FakeSource[] = [];
  static gains: FakeGain[] = [];
  static reset(): void { FakeContext.sources = []; FakeContext.gains = []; }
  currentTime = 10;
  state = 'running';
  sampleRate = 48000;
  destination = {};
  resume(): Promise<void> { return Promise.resolve(); }
  createGain(): FakeGain { const g: FakeGain = { gain: param(1), connect: (n) => n, disconnect: () => {} }; FakeContext.gains.push(g); return g; }
  createDynamicsCompressor() { return { threshold: param(0), ratio: param(1), connect: (n: unknown) => n }; }
  createBiquadFilter() { return { type: '', frequency: param(0), Q: param(0), connect: (n: unknown) => n }; }
  createBuffer(_channels: number, len: number) { return { getChannelData: () => new Float32Array(len) }; }
  createBufferSource(): FakeSource {
    const s: FakeSource = { buffer: null, playbackRate: param(1), onended: null, started: [], stopped: [], connect: (n) => n, start(t = 0) { this.started.push(t); }, stop(t = 0) { this.stopped.push(t); } };
    FakeContext.sources.push(s);
    return s;
  }
  decodeAudioData(): Promise<{ duration: number }> { return Promise.resolve({ duration: 1.5 }); }
}

/** The sources and gains made by voice() so far (unlock() makes two gains of its own first). */
const lines = () => FakeContext.sources.map((src, i) => ({ src, gain: FakeContext.gains[i + 2] }));

describe('Audio.voice', () => {
  beforeEach(() => {
    FakeContext.reset();
    vi.stubGlobal('window', { AudioContext: FakeContext, setTimeout: globalThis.setTimeout.bind(globalThis) });
    vi.stubGlobal('fetch', async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(4) }));
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  const unlocked = (): Audio => { const a = new Audio(); a.unlock(); return a; };

  it('plays a line and resolves to its length', async () => {
    const audio = unlocked();
    expect(await audio.voice('/audio/a.mp3', 1, 'npc')).toBeCloseTo(1.5);
    const [a] = lines();
    expect(a.src.started).toHaveLength(1);
    expect(a.src.stopped).toHaveLength(0);
    expect(a.src.playbackRate.value).toBe(1);
  });

  it('a new line on a channel fades the one still playing there out over ~60 ms and stops it', async () => {
    const audio = unlocked();
    await audio.voice('/audio/a.mp3', 1, 'npc');
    await audio.voice('/audio/b.mp3', 1, 'npc');
    const [a, b] = lines();
    expect(a.src.stopped).toHaveLength(1);
    expect(a.src.stopped[0]).toBeCloseTo(10.06, 2);
    expect(a.gain.gain.ramps).toContainEqual([0, expect.closeTo(10.06, 2)]);
    expect(b.src.stopped).toHaveLength(0);
    expect(b.gain.gain.ramps).toHaveLength(0);
  });

  it('the NPCs are the default channel', async () => {
    const audio = unlocked();
    await audio.voice('/audio/a.mp3', 1);
    await audio.voice('/audio/b.mp3', 1, 'npc');
    const [a, b] = lines();
    expect(a.src.stopped).toHaveLength(1);
    expect(b.src.stopped).toHaveLength(0);
  });

  it('lines on different channels play over each other', async () => {
    const audio = unlocked();
    await audio.voice('/audio/a.mp3', 1, 'npc');
    await audio.voice('/audio/b.mp3', 1, 'mob');
    await audio.voice('/audio/c.mp3', 1, 'head');
    for (const l of lines()) expect(l.src.stopped).toHaveLength(0);
  });

  it('a line that has ended is left alone by the next one', async () => {
    const audio = unlocked();
    await audio.voice('/audio/a.mp3', 1, 'npc');
    const [a] = lines();
    a.src.onended?.();
    await audio.voice('/audio/b.mp3', 1, 'npc');
    expect(a.src.stopped).toHaveLength(0);
  });

  it('a line too far away to hear plays nothing and interrupts nothing', async () => {
    const audio = unlocked();
    await audio.voice('/audio/a.mp3', 1, 'npc');
    expect(await audio.voice('/audio/b.mp3', 0, 'npc')).toBe(0);
    const [a] = lines();
    expect(lines()).toHaveLength(1);
    expect(a.src.stopped).toHaveLength(0);
  });

  it('a line still loading when a newer one takes its channel never plays: the newest wins', async () => {
    const audio = unlocked();
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    vi.stubGlobal('fetch', async (url: string) => { if (url.endsWith('slow.mp3')) await gate; return { ok: true, arrayBuffer: async () => new ArrayBuffer(4) }; });
    const slow = audio.voice('/audio/slow.mp3', 1, 'npc');
    await audio.voice('/audio/b.mp3', 1, 'npc');
    release();
    expect(await slow).toBe(0);
    expect(lines()).toHaveLength(1);
    expect(lines()[0].src.stopped).toHaveLength(0);
  });
});

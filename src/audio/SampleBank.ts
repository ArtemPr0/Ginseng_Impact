/**
 * Recorded CC0 sound effects (quality pass of 2026-11-16; files in public/audio/sfx, credits in
 * docs/reference/sfx-credits.md, written by scripts/sfx-import.mjs). A category is several takes of one sound; each
 * play picks a different take than last time, a little higher or lower (±6 %) and louder or softer (±2 dB), so a
 * fight never repeats one sample. Files load on first use; the first play of a category only starts its loading.
 */
export type Manifest = Record<string, string[]>;

export function pickVariant(n: number, last: number): number {
  if (n <= 1) return 0;
  const v = Math.floor(Math.random() * (n - 1));
  return v >= last && last >= 0 ? v + 1 : v;
}

export function variation(): { rate: number; gain: number } {
  return { rate: 0.94 + Math.random() * 0.12, gain: 10 ** ((Math.random() * 4 - 2) / 20) };
}

export interface PlayOptions {
  gain?: number;
  /** Pitch on top of the random variation (0.8 = a lower, heavier take). */
  rate?: number;
  /** Seconds from now. */
  delay?: number;
  /** Where to send it (a panner for a sound in the world); the bank's output otherwise. */
  out?: AudioNode;
}

export class SampleBank {
  private readonly buffers = new Map<string, Promise<AudioBuffer | null>>();
  private readonly ready = new Map<string, AudioBuffer>();
  private readonly last = new Map<string, number>();

  constructor(private readonly ctx: AudioContext | null, private readonly manifest: Manifest, private readonly base = 'audio/sfx/', private readonly out?: AudioNode) {}

  urls(cat: string): string[] {
    return (this.manifest[cat] ?? []).map((f) => `${this.base}${cat}/${f}`);
  }

  /** Starts loading a category's takes (call ahead of the first fight to have them ready). */
  preload(cat: string): void {
    if (!this.ctx) return;
    for (const url of this.urls(cat)) this.load(url);
  }

  private load(url: string): Promise<AudioBuffer | null> {
    let p = this.buffers.get(url);
    if (!p && this.ctx) {
      const ctx = this.ctx;
      p = fetch(url)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((b) => ctx.decodeAudioData(b))
        .then((buf) => { this.ready.set(url, buf); return buf; })
        .catch(() => null);
      this.buffers.set(url, p);
    }
    return p ?? Promise.resolve(null);
  }

  /** Plays a take of `cat`; false when nothing could play yet (still loading, no audio, unknown category). */
  play(cat: string, o: PlayOptions = {}): boolean {
    const urls = this.urls(cat);
    const dest = o.out ?? this.out;
    if (!urls.length || !this.ctx || !dest) return false;
    const i = pickVariant(urls.length, this.last.get(cat) ?? -1);
    const buf = this.ready.get(urls[i]);
    if (!buf) { this.preload(cat); return false; }
    this.last.set(cat, i);
    const v = variation();
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = v.rate * (o.rate ?? 1);
    const g = this.ctx.createGain();
    g.gain.value = v.gain * (o.gain ?? 1);
    src.connect(g).connect(dest);
    src.start(this.ctx.currentTime + (o.delay ?? 0));
    src.onended = () => g.disconnect();
    return true;
  }
}

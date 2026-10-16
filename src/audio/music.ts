/**
 * Music slots: a song is a file in src/assets/music/ named after its slot, in any common format
 * (`title-intro.mp3`, `kingdom.m4a`, ...). A slot with no file stays silent (the kingdom falls back to its
 * synthesised beat). The files are the user's own and git-ignored: see src/assets/music/README.md.
 */
export type MusicSlot = 'title-intro' | 'title-loop' | 'kingdom';

const FILES = import.meta.glob('../assets/music/*.{mp3,m4a,aac,ogg,opus,wav,flac,webm}', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** The URL of the slot's file, or null when there is none. */
export function musicUrl(slot: MusicSlot): string | null {
  for (const [path, url] of Object.entries(FILES)) if (path.slice(path.lastIndexOf('/') + 1).replace(/\.[^.]+$/, '') === slot) return url;
  return null;
}

/** Below this a sample counts as silence (about -56 dB). */
const SILENCE = 0.0015;

/**
 * Where the sound starts and ends (sample indices, end exclusive), ignoring the near-silence a ripped track carries
 * at either end: trimmed, an intro runs straight into its loop and a loop repeats with no gap.
 */
export function trimSilence(channels: ReadonlyArray<Float32Array>, threshold = SILENCE): { start: number; end: number } {
  const len = channels[0]?.length ?? 0;
  const loud = (i: number) => channels.some((c) => Math.abs(c[i]) > threshold);
  let start = 0;
  while (start < len && !loud(start)) start++;
  let end = len;
  while (end > start && !loud(end - 1)) end--;
  // An all-silent track keeps its full length rather than vanishing.
  return start >= end ? { start: 0, end: len } : { start, end };
}

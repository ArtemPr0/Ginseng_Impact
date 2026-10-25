/**
 * The game's own music, as tables the step sequencer in Score.ts plays: every song is original and synthesised
 * (no recordings, no borrowed melodies), one per place, plus the boss layer and the ending. Pure data and pure
 * helpers: no Web Audio here, so the tables are testable in node.
 *
 * A song is a loop of `bars` bars of 16 steps (sixteenths at `bpm`). Each bar has a chord: a list of scale degrees
 * of `scale` (a semitone set) over `root` (MIDI); degree 7 is the octave of degree 0, −1 the step below the root.
 * A part is a step string: 16 characters per bar, bars separated by '|', the pattern cycled over the song (its
 * bar count must divide `bars`). Characters: '.' rest; 'x' a hit at full velocity; '1'..'9' a hit at that ninth of
 * full velocity; 'a'..'g' (melodic parts only) the chord tone at that index (a = the first). On a pad or a choir
 * 'x' and the digits play the whole chord; on a pluck they strum it; on a bass, bells or a drone they play the
 * chord's first tone. A sustained part (pad, choir, drone, riser, bass) holds until its next hit.
 */
import type { Zone } from '../game/Events';

export type SongId = 'title' | 'island' | 'lean' | 'sunken' | 'vale' | 'graveyard' | 'dream' | 'boss' | 'ending' | 'tavern';
export type Part = 'kick' | 'snare' | 'hats' | 'bass' | 'pad' | 'pluck' | 'bells' | 'choir' | 'drone' | 'riser';

export interface Song {
  id: SongId;
  bpm: number;
  /** MIDI note of scale degree 0 (57 = A3). */
  root: number;
  /** The scale as semitones above the root, ascending, within one octave. */
  scale: number[];
  bars: number;
  /** One chord per bar: scale degrees (length == bars). */
  chords: number[][];
  /** Step strings per part (see the module comment). */
  parts: Partial<Record<Part, string>>;
  /** The song's level into the score bus (≤ 1). */
  gain: number;
  /** 0..1: how far the odd sixteenths lean late. */
  swing?: number;
  /** A low-pass over the whole song (Hz): the sunken city's murk. */
  lowpass?: number;
  /** The pad's detune in cents (default 8): the vale's aurora pad is wide. */
  width?: number;
  /** Per-part transposition in semitones, replacing the part's default register (REGISTER). */
  octaves?: Partial<Record<Part, number>>;
}

export const STEPS_PER_BAR = 16;
export const PARTS: readonly Part[] = ['kick', 'snare', 'hats', 'bass', 'pad', 'pluck', 'bells', 'choir', 'drone', 'riser'];
/** The parts that take chord tones ('a'..'g'); the others are drums and the riser. */
export const MELODIC: ReadonlySet<Part> = new Set<Part>(['bass', 'pad', 'pluck', 'bells', 'choir', 'drone']);
/** Each part's default register, in semitones from the chord as written. */
export const REGISTER: Record<Part, number> = { kick: 0, snare: 0, hats: 0, bass: -24, pad: 0, pluck: 12, bells: 12, choir: 0, drone: -12, riser: 0 };
/** Which song each zone plays (every quarter of the kingdom shares the Lean Quarter's beat; the tree house keeps the island's). */
export const SONG_FOR_ZONE: Record<Zone, SongId> = {
  island: 'island', galaxy: 'lean', sunken: 'sunken', vale: 'vale', graveyard: 'graveyard', dream: 'dream',
  treehouse: 'island', 'tavern-room': 'tavern', 'crypt-room': 'tavern',
};

export const SCALES = {
  minor: [0, 2, 3, 5, 7, 8, 10],
  major: [0, 2, 4, 5, 7, 9, 11],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  /** Degrees are plain semitones: for chords that leave the key (the dream's hue cycle). */
  chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
} as const;

/** One step of a part decoded: how hard, and which chord tone (null: the part's default, the first tone or the whole chord). */
export interface Step { velocity: number; index: number | null }

/** What a step character asks for, or null for a rest (an unknown character is a rest; the tests keep the tables clean). */
export function decodeStep(ch: string): Step | null {
  if (ch === 'x') return { velocity: 1, index: null };
  if (ch >= '1' && ch <= '9') return { velocity: (ch.charCodeAt(0) - 48) / 9, index: null };
  if (ch >= 'a' && ch <= 'g') return { velocity: 0.85, index: ch.charCodeAt(0) - 97 };
  return null;
}

/** A pattern's bars (the '|'-separated 16-step strings). */
export function patternBars(pattern: string): string[] { return pattern.split('|'); }

/** The character a pattern has at a step of the song (the pattern cycling over the song's bars). */
export function stepChar(bars: readonly string[], step: number, songBars: number): string {
  const bar = Math.floor(step / STEPS_PER_BAR) % songBars;
  return bars[bar % bars.length]?.[step % STEPS_PER_BAR] ?? '.';
}

/** Steps from `step` to the pattern's next hit (the whole song when it has only this one). */
export function holdSteps(bars: readonly string[], step: number, songBars: number): number {
  const max = songBars * STEPS_PER_BAR;
  for (let k = 1; k < max; k++) if (stepChar(bars, step + k, songBars) !== '.') return k;
  return max;
}

/** The MIDI note of a scale degree over a root (degrees wrap into the octaves above and below). */
export function midiOf(root: number, scale: readonly number[], degree: number): number {
  const n = scale.length;
  const octave = Math.floor(degree / n);
  return root + octave * 12 + scale[((degree % n) + n) % n];
}

export function hz(midi: number): number { return 440 * Math.pow(2, (midi - 69) / 12); }

/** Seconds per sixteenth. */
export function stepSeconds(bpm: number): number { return 60 / bpm / 4; }

/** How late a step plays with swing: the odd sixteenths lean toward the next one. */
export function swingOffset(step: number, stepDur: number, swing = 0): number { return step % 2 === 1 ? swing * stepDur * 0.5 : 0; }

const title: Song = {
  id: 'title', bpm: 64, root: 57, scale: [...SCALES.minor], bars: 8, gain: 0.9,
  // Am(add9) Fmaj7 Dm7 Em7 | Am C6 Fmaj7 Esus4
  chords: [[0, 2, 4, 8], [-2, 0, 2, 4], [-4, -2, 0, 2], [-3, -1, 1, 3], [0, 2, 4, 7], [-5, -3, 0, 2], [-2, 0, 2, 4], [-3, 0, 1, 4]],
  parts: {
    pad: 'x...............',
    bells: 'c...............|........c.......|a...............|c...............|c.......b.......|d...............|a.......c.......|c.......d.......',
    choir: '................|................|................|................|4...............|4...............|4...............|4...............',
  },
};

const island: Song = {
  id: 'island', bpm: 70, root: 50, scale: [...SCALES.dorian], bars: 8, gain: 0.8, swing: 0.1,
  // Dm(add9) Dm7 Am7 G | Dm(add9) Fmaj7 C(add9) Am7
  chords: [[0, 2, 4, 8], [0, 2, 4, 6], [-3, -1, 1, 4], [-4, -2, 0, 3], [0, 2, 4, 8], [2, 4, 6, 9], [-1, 1, 3, 6], [-3, -1, 1, 4]],
  parts: {
    pad: 'x...............|................',
    pluck: 'c.......d.......|....b.....a.....|........c.......|c.........d.....|d.......c.......|....b.......a...|b.......c.......|......d.........',
    bells: '................|d...............|................|................|................|d...............|................|................',
  },
};

/** The Lean Quarter: the kingdom's cloud-rap beat as it was (70 BPM, kick and 808 on 1, the and of 2 and 3, a half-time snare, hats with a roll every fourth bar, a dreamy pad over Am F C G). */
const lean: Song = {
  id: 'lean', bpm: 70, root: 57, scale: [...SCALES.minor], bars: 4, gain: 0.9,
  chords: [[0, 2, 4], [-2, 0, 2], [2, 4, 6], [-1, 1, 3]],
  parts: {
    kick: 'x......x..x.....',
    bass: 'x......x..x.....',
    snare: '........x.......',
    hats: 'x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x.x.|x.x.x.x.x.x.x666',
    pad: 'x...............',
  },
};

const sunken: Song = {
  id: 'sunken', bpm: 56, root: 48, scale: [...SCALES.minor], bars: 8, gain: 0.85, lowpass: 1100, octaves: { bass: -12 },
  // Cm(add9) Cm(add9) Abmaj7 Fm(add9) | Cm Eb(add9) Bb(add9) Gm
  chords: [[0, 2, 4, 8], [0, 2, 4, 8], [-2, 0, 2, 4], [-4, -2, 0, 3], [0, 2, 4, 7], [2, 4, 6, 9], [-1, 1, 3, 6], [-3, -1, 1, 4]],
  parts: {
    pad: 'x...............|................',
    choir: '........6.......|................',
    bass: 'x...............|................',
    pluck: '..a.............|......b.........|...........c....|.....d..........',
  },
};

const vale: Song = {
  id: 'vale', bpm: 60, root: 48, scale: [...SCALES.lydian], bars: 8, gain: 0.85, width: 14,
  // Cmaj9 D(add9) Em7 D6 | Cmaj7 G(add9) Am9 D
  chords: [[0, 2, 4, 6, 8], [1, 3, 5, 8], [2, 4, 6, 8], [1, 3, 5, 6], [0, 2, 4, 6], [-3, -1, 1, 4], [-2, 0, 2, 4], [1, 3, 5, 8]],
  parts: {
    pad: 'x...............',
    choir: '5...............|................|................|................',
    bells: '........c.......|................|....d...........|................',
    pluck: '....a.......c...|..........b.....|................|......d.........',
  },
};

const graveyard: Song = {
  id: 'graveyard', bpm: 52, root: 52, scale: [...SCALES.phrygian], bars: 8, gain: 0.8,
  // Em Em(b9) F/E Em | Am/E F Dm E(b9)
  chords: [[0, 2, 4], [0, 1, 4], [1, 3, 5], [0, 2, 4, 7], [0, 3, 5], [1, 3, 5], [-1, 1, 3], [0, 1, 4, 7]],
  parts: {
    drone: 'x...............|................|................|................',
    pad: '........6.......|................',
    kick: '............4...|........5.......|................|..............34',
    bells: 'a...............|........b.......|................|a...............|................|........a.......|b...............|a...............',
  },
};

/** The frog's dream: the harmony cycles through three keys a major third apart, like the fog through the hues, every arpeggio climbing. */
const dream: Song = {
  id: 'dream', bpm: 100, root: 60, scale: [...SCALES.chromatic], bars: 6, gain: 0.8, octaves: { pluck: 0, bells: 0 },
  // Cmaj9 Emaj9 Abmaj9, twice
  chords: [[0, 4, 7, 11, 14, 16, 19], [4, 8, 11, 15, 18, 20, 23], [8, 12, 15, 19, 22, 24, 27], [0, 4, 7, 11, 14, 16, 19], [4, 8, 11, 15, 18, 20, 23], [8, 12, 15, 19, 22, 24, 27]],
  parts: {
    pluck: 'a.b.c.d.e.f.g...|a.c.e.g.f.d.b...|a.b.c.d.e.f.g.f.|c.d.e.f.g.e.c...|a.c.e.g.b.d.f...|a.b.c.d.e.f.g.e.',
    pad: '4...............',
    bass: 'x.......x.......',
    kick: '5...5...5...5...',
    hats: '4.4.4.4.4.4.4.4.|4.4.4.4.4.4.4.4.|4.4.4.4.4.4.4.44',
    bells: '................|................|g...............',
  },
};

/** A layer over whatever plays: it takes the current song's root and grid (Score), so these degrees and the tempo are only for when nothing else plays. */
const boss: Song = {
  id: 'boss', bpm: 92, root: 57, scale: [...SCALES.minor], bars: 4, gain: 0.9,
  chords: [[0], [0], [0], [-2]],
  parts: {
    kick: 'x..x..x...x.....|x..x..x...x...x.|x..x..x...x.....|x..x..x.x.x.x.x.',
    bass: 'x.....x...x.....|x.....x.........|x.....x...x.....|x.......x.......',
    snare: '........x.......|........x.......|........x.......|........x.....x.',
    riser: 'x...............|................|................|................',
  },
};

const ending: Song = {
  id: 'ending', bpm: 72, root: 50, scale: [...SCALES.major], bars: 16, gain: 0.9, octaves: { bass: -12 },
  // D D(add9) Bm7 G(add9) D/F# A Bm G | D F#m7 G A Bm G D/A Asus4
  chords: [
    [0, 2, 4, 7], [0, 2, 4, 8], [-2, 0, 2, 4], [-4, -2, 0, 3], [2, 4, 7, 9], [-3, -1, 1, 4], [-2, 0, 2, 5], [-4, -2, 0, 3],
    [0, 2, 4, 7], [2, 4, 6, 9], [3, 5, 7, 10], [4, 6, 8, 11], [5, 7, 9, 12], [3, 5, 7, 10], [4, 7, 9, 11], [4, 7, 8, 11],
  ],
  parts: {
    pad: '3...............|3...............|3...............|3...............|5...............|5...............|5...............|5...............|7...............|7...............|7...............|7...............|x...............|x...............|x...............|x...............',
    bells: '................|................|................|................|c...............|........d.......|c...............|........d.......|d...............|....d.......b...|c...............|b.......d.......|c...............|d...............|c.......b.......|d...............',
    choir: '................|................|................|................|................|................|................|................|5...............|5...............|5...............|5...............|8...............|8...............|8...............|8...............',
    bass: '................|................|................|................|................|................|................|................|x...............|x...............|x...............|x...............|x...............|x...............|x...............|x...............',
  },
};

/** The Candle Tavern and the crypt bar: a waltz on the 16-step grid, its three beats on steps 0, 5 and 11. */
const tavern: Song = {
  id: 'tavern', bpm: 112, root: 55, scale: [...SCALES.major], bars: 8, gain: 0.8, octaves: { bass: -12 },
  // G C/G D7 G | Em Cmaj7 Am7 D7
  chords: [[0, 2, 4, 7], [0, 3, 5, 7], [-3, -1, 1, 3], [0, 2, 4, 7], [-2, 0, 2, 5], [-4, -2, 0, 2], [1, 3, 5, 7], [-3, -1, 1, 3]],
  parts: {
    bass: 'x...............',
    pad: '.....5.....5....',
    hats: '.....2.....2....',
    pluck: 'a....b.....c....|c....b.....a....|b....c..d..c....|a.........x.....|c....d.....c....|c....b.....d....|c....b.....a....|c....b....x.....',
  },
};

export const SONGS: Record<SongId, Song> = { title, island, lean, sunken, vale, graveyard, dream, boss, ending, tavern };

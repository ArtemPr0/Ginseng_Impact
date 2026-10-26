import type { Audio } from './Audio';

/** What a blow lands on: a body, a skeleton, rock, or something that is barely there. */
export type HitMaterial = 'flesh' | 'bone' | 'stone' | 'ghost';
/** What the hero swings or looses: a blade, a bow, a staff. */
export type SwingKind = 'blade' | 'bow' | 'staff';

/** Every enemy kind that is not flesh (the rest are). */
const MATERIALS = new Map<string, HitMaterial>([
  ['skeleton', 'bone'], ['grave-skeleton', 'bone'], ['diamond-wizard', 'bone'],
  ['crystalgolem', 'stone'], ['troll', 'stone'], ['warden', 'stone'], ['cyclops', 'stone'], ['cyclops-lord', 'stone'],
  ['shade', 'ghost'], ['rivershade', 'ghost'], ['blood-eye', 'ghost'], ['dmt-entity', 'ghost'], ['trip-wizard', 'ghost'],
]);

/** The material an enemy kind's hits sound like (flesh unless the table says otherwise). */
export function hitMaterial(kind: string): HitMaterial {
  return MATERIALS.get(kind) ?? 'flesh';
}

/** How many hit sounds may start within HIT_WINDOW seconds: a spin through a crowd plays a few, not one per mob. */
const HIT_BURST = 3;
const HIT_WINDOW = 0.05;

/**
 * The fight's sounds, synthesised on the Audio engine's public primitives (toneAt / noiseAt into its effects input):
 * the swing of each weapon, a blow by what it lands on, the crit's sting, the heavy's boom and the heroes' efforts
 * (breathy noise bursts shaped like a grunt, never a voice). Silent until the engine is unlocked.
 */
export class CombatSfx {
  /** Context times of the latest hit sounds (the throttle). */
  private readonly recent: number[] = [];

  constructor(private readonly audio: Audio) {}

  /** The effects input and the context's clock, or null while the engine is locked. */
  private bus(): { out: AudioNode; t: number } | null {
    const ctx = this.audio.context;
    const out = this.audio.sfxInput;
    return ctx && out ? { out, t: ctx.currentTime } : null;
  }

  /** A blade's whoosh (a faint ring of steel in it), a bowstring's snap and the arrow's hiss, a staff's rising shimmer. */
  swing(kind: SwingKind, heavy = false): void {
    const b = this.bus();
    if (!b) return;
    const { out, t } = b;
    const a = this.audio;
    if (kind === 'blade') {
      if (heavy) {
        a.noiseAt(out, t, 0.3, 'bandpass', 1100, 180, 1.1, 0.5, 0.035);
        a.toneAt(out, t, 'sine', 150, 60, 0.24, 0.14, 0.03, 0.08);
      } else {
        a.noiseAt(out, t, 0.16, 'bandpass', 2600, 480, 1.3, 0.34, 0.012);
      }
      a.toneAt(out, t + 0.01, 'triangle', heavy ? 1500 : 2100, heavy ? 1250 : 1750, 0.07, 0.03, 0.004, 0.05);
    } else if (kind === 'bow') {
      const f = heavy ? 150 : 196;
      a.toneAt(out, t, 'triangle', f, f * 0.78, heavy ? 0.2 : 0.14, heavy ? 0.22 : 0.16, 0.002, 0.06);
      a.toneAt(out, t, 'sawtooth', f * 2, f * 1.55, 0.06, 0.04, 0.002, 0.04);
      a.noiseAt(out, t, 0.03, 'highpass', 3500, 5000, 0.7, 0.18, 0.001);
      a.noiseAt(out, t + 0.02, heavy ? 0.18 : 0.12, 'bandpass', 3200, 1400, 2, heavy ? 0.16 : 0.12, 0.01);
    } else {
      a.toneAt(out, t, 'sine', heavy ? 330 : 520, heavy ? 990 : 1560, heavy ? 0.22 : 0.14, heavy ? 0.16 : 0.12, 0.006, 0.08);
      a.noiseAt(out, t, heavy ? 0.26 : 0.18, 'bandpass', 1800, 6000, 3, 0.08, 0.01);
      if (heavy) a.toneAt(out, t + 0.03, 'triangle', 1320, 1980, 0.18, 0.06, 0.01, 0.1);
    }
  }

  /**
   * A blow on `material`: a thud and a slap on flesh, a dry clack-clack on bone, a ringing chink and grit on stone, an
   * airy falling whoosh through a ghost. `heavy` adds weight; `elemental` adds the element's ping.
   */
  hit(material: HitMaterial, heavy = false, elemental = false): void {
    const b = this.bus();
    if (!b) return;
    const { out, t } = b;
    while (this.recent.length && this.recent[0] < t - HIT_WINDOW) this.recent.shift();
    if (this.recent.length >= HIT_BURST) return;
    this.recent.push(t);
    const a = this.audio;
    switch (material) {
      case 'flesh':
        a.toneAt(out, t, 'sine', heavy ? 130 : 170, heavy ? 40 : 55, heavy ? 0.2 : 0.11, heavy ? 0.8 : 0.55);
        a.noiseAt(out, t, heavy ? 0.1 : 0.06, 'lowpass', 2200, 300, 0.7, heavy ? 0.6 : 0.4);
        break;
      case 'bone':
        a.noiseAt(out, t, 0.035, 'bandpass', 2600, 1800, 5, 0.45, 0.001);
        a.noiseAt(out, t + 0.03, 0.03, 'bandpass', 1900, 1400, 6, 0.3, 0.001);
        a.toneAt(out, t, 'square', 820, 560, 0.03, 0.06, 0.001, 0.03);
        if (heavy) a.toneAt(out, t, 'sine', 120, 45, 0.15, 0.5);
        break;
      case 'stone':
        a.toneAt(out, t, 'triangle', 1250, 1180, 0.09, 0.14, 0.001, 0.08);
        a.toneAt(out, t, 'sine', 2500, 2440, 0.12, 0.06, 0.001, 0.1);
        a.noiseAt(out, t, 0.05, 'highpass', 2500, 4000, 0.6, 0.3, 0.001);
        if (heavy) {
          a.toneAt(out, t, 'sine', 95, 35, 0.28, 0.75);
          a.noiseAt(out, t, 0.2, 'lowpass', 900, 100, 0.7, 0.45);
        }
        break;
      case 'ghost':
        a.toneAt(out, t, 'sine', heavy ? 600 : 720, heavy ? 240 : 360, 0.22, 0.2, 0.01, 0.12);
        a.noiseAt(out, t, 0.25, 'bandpass', 900, 3200, 4, 0.12, 0.02);
        a.toneAt(out, t, 'triangle', 1440, 1080, 0.18, 0.05, 0.01, 0.1);
        break;
    }
    if (elemental) {
      a.toneAt(out, t + 0.01, 'triangle', 1320, 1760, 0.12, 0.16);
      a.toneAt(out, t + 0.02, 'sine', 2640, 2200, 0.2, 0.1);
    }
  }

  /** A crit: a bright rising sting with a glint on top. */
  crit(): void {
    const b = this.bus();
    if (!b) return;
    const { out, t } = b;
    this.audio.toneAt(out, t, 'triangle', 1568, 2349, 0.09, 0.22, 0.002, 0.08);
    this.audio.toneAt(out, t + 0.04, 'sine', 3136, 3136, 0.16, 0.12, 0.002, 0.12);
    this.audio.noiseAt(out, t, 0.1, 'highpass', 6000, 9000, 0.5, 0.12, 0.002);
  }

  /** A heavy blow landing: a low boom under the hit. */
  heavyHit(): void {
    const b = this.bus();
    if (!b) return;
    const { out, t } = b;
    this.audio.toneAt(out, t, 'sine', 105, 34, 0.34, 0.9, 0.004, 0.12);
    this.audio.noiseAt(out, t, 0.26, 'lowpass', 1400, 90, 0.8, 0.6);
    this.audio.toneAt(out, t, 'square', 70, 45, 0.12, 0.1, 0.004, 0.06);
  }

  /**
   * The hero putting their weight into a move: a short breath forced through a narrow band (a low one for Sir Aldric,
   * higher for Wren, a hiss for Orlan). Unpitched noise only, never a voice.
   */
  effort(hero: string): void {
    const b = this.bus();
    if (!b) return;
    const { out, t } = b;
    const a = this.audio;
    if (hero === 'archer') {
      a.noiseAt(out, t, 0.08, 'bandpass', 820, 560, 4, 0.13, 0.008);
      a.noiseAt(out, t, 0.06, 'bandpass', 2000, 1500, 5, 0.05, 0.008);
    } else if (hero === 'wizard') {
      a.noiseAt(out, t, 0.12, 'bandpass', 600, 380, 3.5, 0.13, 0.01);
      a.noiseAt(out, t + 0.02, 0.1, 'highpass', 2500, 3500, 0.7, 0.06, 0.02);
    } else {
      a.noiseAt(out, t, 0.11, 'bandpass', 420, 260, 4, 0.18, 0.008);
      a.noiseAt(out, t, 0.08, 'bandpass', 1100, 700, 5, 0.07, 0.008);
    }
  }
}

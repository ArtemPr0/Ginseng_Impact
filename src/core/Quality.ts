/**
 * The Quality setting (the user's call of 2026-11-16): Auto / High / Low in the pause screen, kept in localStorage
 * (`ginseng.quality`), `?quality=low` in the URL overriding it. Auto plays High and drops to Low for good when frames
 * stay slow for 3 s with the resolution already as low as the renderer's governor takes it.
 */
export type QualityMode = 'auto' | 'high' | 'low';
export type QualityLevel = 'high' | 'low';

export const QUALITY_KEY = 'ginseng.quality';

const MODES: QualityMode[] = ['auto', 'high', 'low'];
const isMode = (v: unknown): v is QualityMode => typeof v === 'string' && (MODES as string[]).includes(v);

export function pickMode(search: string, stored: string | null): QualityMode {
  const q = new URLSearchParams(search).get('quality');
  if (isMode(q)) return q;
  return isMode(stored) ? stored : 'auto';
}

export function nextMode(m: QualityMode): QualityMode {
  return MODES[(MODES.indexOf(m) + 1) % MODES.length];
}

export interface QualitySettings {
  /** Highest pixel ratio the renderer may use. */
  maxRatio: number;
  /** Point lights in the pool (LightBudget). */
  lights: number;
  /** Rubble pieces awake at once before the rest are frozen (DebrisSim cap). */
  debris: number;
  /** Ways each building can break (fracture variants cached per model). */
  variants: number;
}

export function settingsFor(level: QualityLevel): QualitySettings {
  return level === 'high'
    ? { maxRatio: 1.25, lights: 6, debris: 300, variants: 3 }
    : { maxRatio: 0.9, lights: 3, debris: 150, variants: 1 };
}

/** Auto: High until 3 s of slow frames (over 25 ms) at the lowest resolution, then Low for the rest of the session. */
export class AutoQuality {
  level: QualityLevel = 'high';
  private slow = 0;

  update(dt: number, frameMs: number, atMinRatio: boolean): QualityLevel {
    if (this.level === 'low') return this.level;
    if (frameMs > 25 && atMinRatio) this.slow += dt; else this.slow = 0;
    if (this.slow >= 3) this.level = 'low';
    return this.level;
  }
}

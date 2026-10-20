import type { ClipName } from '../data/models';

/**
 * The heroes' moves as windows of their Meshy clips: the single source of truth for what the body plays and when the
 * game lands the blow. Every number here was measured with `node scripts/clip-strike.mjs public/models/<hero>.glb`
 * (the sword hand's peak speed is the blow; `--curve <clip>` shows the wind-up and the settle), never guessed.
 *
 * `from`/`to` are seconds in the SOURCE clip; `strike` is 0..1 of the CUT; `speed` is the cut's playback rate, so a
 * move lasts (to − from) / speed seconds in the game and its damage lands at `strike` of that.
 */
export interface ClipCut {
  /** The source clip, by the registry key of MODELS[hero].clips (or clipFiles). */
  key: ClipName;
  /** Seconds into the source clip (default: the whole clip). */
  from?: number;
  to?: number;
  /** Where in the cut the blow lands, 0..1 (the blade bites, the arrow leaves, the bolt is loosed). */
  strike?: number;
  /** Played left for right (ModelRig registers the mirror as `<clip>#m`). */
  mirror?: boolean;
  /** Crossfade into the cut, seconds (the rig's default when unset). */
  fade?: number;
  /** Playback rate, default 1. */
  speed?: number;
  /** The hips never rise above their rest height: the controller owns the leap (jump cuts). */
  groundHips?: boolean;
  /**
   * Keep the clip's travel on the ground (the hips' x/z). Off by default: the controller owns every step and lunge,
   * so a cut's hips are held where the clip starts (Sword_Judgment leaps a metre forward). A death keeps its fall.
   */
  keepRoot?: boolean;
}

export interface JumpClips {
  key: ClipName;
  /** The take-off window of the jump clip (seconds in the source): the crouch and the spring, played at 1×. */
  takeoff: [number, number];
  /** Fraction of the take-off cut held in the air (the tuck at the apex). */
  apex: number;
  /** The landing: the impact crouch, played once the feet are down. */
  land: ClipCut;
}

export interface HeroClips {
  attack: [ClipCut, ClipCut, ClipCut];
  heavy: ClipCut;
  /** The frame held while the heavy charges: a fraction of `charge` when set, else of `heavy`. */
  heavyHold: number;
  /** A separate clip for the charge (Wren aims; Sir Aldric holds his own wind-up). */
  charge?: ClipCut;
  skill: ClipCut;
  burst?: ClipCut;
  /** A big hit (≥ 15 % of max HP, the caller decides): the whole reaction. */
  hit: ClipCut;
  /** A small hit: the reaction's upper body layered over whatever the hero is doing. */
  hitLayer: RegExp;
  dodge: ClipCut;
  /** Held on its last frame. */
  death: ClipCut;
  jump: JumpClips;
  walk: ClipName;
  run: ClipName;
}

export type HeroId = 'knight' | 'archer' | 'wizard';

/**
 * Seconds each source clip lasts on disk (clip-strike.mjs, 2026-10-19), so the cuts can be checked against them.
 * Orlan's file is a static robe (zero bones): his rows are the procedural fallback's own timings, measured by nothing.
 */
export const SOURCE_SECONDS: Record<HeroId, Partial<Record<ClipName, number>>> = {
  // knight.glb: Idle_02 1.875, Walking 1.042, Running 0.667, Basic_Jump 5.875, Right_Hand_Sword_Slash 1.5, Sword_Judgment 4.333,
  // Sword_Shout 6.208, Hit_Reaction 1.667, Stand_Dodge 1.417, dying_backwards 2.208, Stand_and_Drink 8.875, Swim_Forward 4.5,
  // Swim_Idle 3.0; hero-climb.glb: climbing_up_wall 2.0.
  knight: { idle: 1.875, walk: 1.042, run: 0.667, jump: 5.875, attack: 1.5, heavy: 4.333, cast: 6.208, hit: 1.667, dodge: 1.417, death: 2.208, drink: 8.875, swim: 4.5, swimIdle: 3.0, climb: 2.0 },
  // archer.glb: Idle_03 4.292, Walking 1.042, Running 0.667, Regular_Jump 1.875, Archery_Shot 5.0, Archery_Shot_1 1.0,
  // Archery_Aim_with_Lateral_Scan 5.0, Hit_Reaction 1.667, Stand_Dodge 1.417, dying_backwards 2.208, Swim_Forward 4.5, Swim_Idle 3.0.
  archer: { idle: 4.292, walk: 1.042, run: 0.667, jump: 1.875, attack: 5.0, heavy: 1.0, cast: 5.0, hit: 1.667, dodge: 1.417, death: 2.208, swim: 4.5, swimIdle: 3.0, climb: 2.0 },
  wizard: { idle: 1, walk: 1, run: 1, jump: 0.45, attack: 0.5, heavy: 0.8, cast: 0.45, hit: 0.5, dodge: 0.5, death: 1.2 },
};

/**
 * Sir Aldric (knight.glb). Right_Hand_Sword_Slash: wind-up 0.39, blow 0.52, settled 1.3. Sword_Judgment is a leaping
 * overhead slam: crouch 0.2–0.44, the raise to 0.88, the blow 0.98, a kneel to 1.7, then a flourish nobody needs.
 * Sword_Shout: the sword raised by 1.2 (the shout), the cut 2.1–2.6 (blow 2.41), a rebound to 3.0. Basic_Jump: crouch
 * 1.44–1.55, spring, apex 2.04, impact 2.34–2.45 into a deep crouch (the clip lifts the hips 0.63 h: physics owns that,
 * see groundHips). Hit_Reaction flinches 0.1–0.4, settles by 1.3; Stand_Dodge rolls 0.14–0.75; dying_backwards staggers
 * 0.4–1.0, is down by 1.41. His second hit is the same slash, tighter: a mirrored slash would put the cut in his cup
 * hand (the off-hand moves at 44 % of the sword hand's speed in this clip).
 */
const KNIGHT: HeroClips = {
  attack: [
    { key: 'attack', from: 0.2, to: 0.95, strike: 0.43, speed: 1.25, fade: 0.08 },
    { key: 'attack', from: 0.26, to: 0.95, strike: 0.38, speed: 1.3, fade: 0.06 },
    { key: 'heavy', from: 0.44, to: 1.34, strike: 0.6, speed: 1.1, fade: 0.08 },
  ],
  heavy: { key: 'heavy', from: 0.2, to: 1.7, strike: 0.52, speed: 1.3, fade: 0.1 },
  heavyHold: 0.24,
  skill: { key: 'cast', from: 1.8, to: 2.75, strike: 0.64, speed: 1.1, fade: 0.1 },
  hit: { key: 'hit', from: 0, to: 1.25, speed: 1.4, fade: 0.06 },
  hitLayer: /spine|neck|head|arm/i,
  dodge: { key: 'dodge', from: 0.1, to: 1.05, speed: 1.75, fade: 0.06 },
  death: { key: 'death', from: 0.3, to: 2.2, fade: 0.12, keepRoot: true },
  jump: { key: 'jump', takeoff: [1.45, 2.04], apex: 1, land: { key: 'jump', from: 2.3, to: 2.62, fade: 0.08, groundHips: true } },
  walk: 'walk',
  run: 'run',
};

/**
 * Wren (archer.glb). Archery_Shot: the draw 0.1–0.6, the anchor, the release at 1.13 (the string hand drops to 1.5),
 * then a 2.4 s re-nock nobody needs. Archery_Shot_1: a one-second draw and release, the string leaves the fingers at
 * 0.47. Archery_Aim_with_Lateral_Scan holds a steady draw for its first 0.8 s (the charge). Regular_Jump: crouch 0.1–0.3,
 * apex 0.79, impact 1.27, standing by 1.7.
 */
const ARCHER: HeroClips = {
  attack: [
    { key: 'attack', from: 0.25, to: 1.5, strike: 0.7, speed: 2.2, fade: 0.08 },
    { key: 'heavy', from: 0.05, to: 0.75, strike: 0.6, speed: 1.3, fade: 0.08 },
    { key: 'attack', from: 0.25, to: 1.5, strike: 0.7, speed: 1.8, fade: 0.08 },
  ],
  heavy: { key: 'heavy', from: 0.3, to: 0.95, strike: 0.26, fade: 0.1 },
  heavyHold: 0.4,
  charge: { key: 'cast', from: 0, to: 0.8, fade: 0.12 },
  skill: { key: 'attack', from: 0.1, to: 1.55, strike: 0.71, speed: 1.8, fade: 0.1 },
  hit: { key: 'hit', from: 0, to: 1.25, speed: 1.4, fade: 0.06 },
  hitLayer: /spine|neck|head|arm/i,
  dodge: { key: 'dodge', from: 0.1, to: 1.05, speed: 1.75, fade: 0.06 },
  death: { key: 'death', from: 0.3, to: 2.2, fade: 0.12, keepRoot: true },
  jump: { key: 'jump', takeoff: [0.2, 0.8], apex: 1, land: { key: 'jump', from: 1.15, to: 1.5, fade: 0.08, groundHips: true } },
  walk: 'walk',
  run: 'run',
};

/**
 * Orlan (wizard.glb is a boneless robe, so these are the procedural fallback's timings: Rig.driveStaticModel leans
 * into the cast and thrusts the staff at `strike`). When his rigged body lands, these rows get measured like the others.
 */
const WIZARD: HeroClips = {
  attack: [
    { key: 'attack', from: 0, to: 0.4, strike: 0.4 },
    { key: 'attack', from: 0, to: 0.4, strike: 0.4 },
    { key: 'attack', from: 0, to: 0.5, strike: 0.4 },
  ],
  heavy: { key: 'heavy', from: 0, to: 0.8, strike: 0.6 },
  heavyHold: 0.3,
  skill: { key: 'cast', from: 0, to: 0.45, strike: 0.4 },
  hit: { key: 'hit', from: 0, to: 0.5 },
  hitLayer: /spine|neck|head|arm/i,
  dodge: { key: 'dodge', from: 0, to: 0.5 },
  death: { key: 'death', from: 0, to: 1.2 },
  jump: { key: 'jump', takeoff: [0, 0.3], apex: 1, land: { key: 'jump', from: 0.3, to: 0.45 } },
  walk: 'walk',
  run: 'run',
};

export const HERO_CLIPS: Record<HeroId, HeroClips> = { knight: KNIGHT, archer: ARCHER, wizard: WIZARD };

/** The hero's clip table, or null for a body that is not a hero (NPCs, companions). */
export function heroClipsOf(id: string): HeroClips | null {
  return (HERO_CLIPS as Record<string, HeroClips>)[id] ?? null;
}

/** Seconds the cut spans in its source clip. */
export function cutSpan(hero: string, cut: ClipCut): number {
  const src = (SOURCE_SECONDS as Record<string, Partial<Record<ClipName, number>>>)[hero]?.[cut.key] ?? 1;
  return (cut.to ?? src) - (cut.from ?? 0);
}

/** Seconds the cut takes in the game: its span at its speed. */
export function cutSeconds(hero: string, cut: ClipCut): number {
  return cutSpan(hero, cut) / (cut.speed ?? 1);
}

/** Where the blow lands, 0..1 of the cut. */
export function cutStrike(cut: ClipCut): number {
  return cut.strike ?? 0.4;
}

/** The cut a swing or cast of this kind plays. */
export function moveCut(clips: HeroClips, kind: number | 'skill' | 'heavy' | 'burst' | undefined): ClipCut | null {
  if (kind === undefined) return null;
  if (kind === 'heavy') return clips.heavy;
  if (kind === 'skill') return clips.skill;
  if (kind === 'burst') return clips.burst ?? null;
  return clips.attack[Math.max(0, Math.min(2, kind))];
}

/** The light combo's game durations and hit fractions, for the ComboTracker (generic timings for a non-hero id). */
export function comboTiming(hero: string): { durations: number[]; strikes: number[] } {
  const clips = heroClipsOf(hero);
  if (!clips) return { durations: [0.45, 0.45, 0.6], strikes: [0.45, 0.45, 0.45] };
  return { durations: clips.attack.map((c) => cutSeconds(hero, c)), strikes: clips.attack.map(cutStrike) };
}

/**
 * The heavy: how long the swing lasts, where its blow lands, and how far into it the charge already stands when the
 * button is released (the held wind-up frame, unless a separate charge clip was held: then the swing starts fresh).
 */
export function heavyTiming(hero: string): { duration: number; strike: number; startAt: number } {
  const clips = heroClipsOf(hero);
  if (!clips) return { duration: 0.8, strike: 0.6, startAt: 0 };
  return { duration: cutSeconds(hero, clips.heavy), strike: cutStrike(clips.heavy), startAt: clips.charge ? 0 : clips.heavyHold };
}

/** The skill (E): its cast time and the fraction of it at which it fires. */
export function skillTiming(hero: string): { duration: number; strike: number } {
  const clips = heroClipsOf(hero);
  if (!clips) return { duration: 0.6, strike: 0.5 };
  return { duration: cutSeconds(hero, clips.skill), strike: cutStrike(clips.skill) };
}

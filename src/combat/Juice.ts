/**
 * Cartoon combat (the playtest of 2026-11-14: "fighting style and animations are boring… make them cool, unique,
 * addictive to watch, funny, entertaining… not realistic"). Pure numbers for CombatSystem, Enemy and main:
 * - a body squashes flat on a hit and springs back past upright (squash);
 * - every blow shouts its sound in a comic word, each weapon its own (BONK);
 * - the hero lunges into a light swing, stopping short of the body in front (lungeReach);
 * - the blade's finisher spins the hero once round (spinAngle), the charged heavy leaps into a slam (leapVelocity);
 * - a boss dies in slow motion (slowMoScale).
 */
import type { WeaponKind } from '../characters/roster';

/** How a hit squashes a body `t` seconds after it, at strength `k` (0–1): height and width scales, volume kept. */
export function squash(t: number, k: number): { y: number; xz: number } {
  if (k <= 0 || t < 0) return { y: 1, xz: 1 };
  const y = 1 - 0.28 * k * Math.exp(-t * 10) * Math.cos(t * 26);
  return { y, xz: 1 / Math.sqrt(y) };
}

export interface BonkWords { light: readonly string[]; finisher: readonly string[]; heavy: readonly string[] }

const BLADE: BonkWords = {
  light: ['BONK', 'WHACK', 'CLANG', 'THWACK', 'SMACK'],
  finisher: ['WHIRLWIND!', 'TORNADO!', 'SPIN CITY!'],
  heavy: ['KA-THOOM!', 'KRAKA-BOOM!', 'SPLAT!'],
};

/** The sound each weapon's blows make. */
export const BONK: Record<WeaponKind, BonkWords> = {
  sword: BLADE,
  greatsword: BLADE,
  bow: { light: ['THWIP', 'SHUNK', 'PLINK', 'THOK'], finisher: ['BULLSEYE!', 'YOINK!'], heavy: ['KER-CHUNK!', 'SNIPED!'] },
  staff: { light: ['ZAP', 'FZZT', 'BZZT', 'POP'], finisher: ['KABOOM!', 'ZORP!'], heavy: ['KA-ZAAAP!', 'MEGA ZAP!'] },
};

/** The `n`th word for a blow: a light hit's, the finisher's (combo hit 2, and the skill) or the heavy's. */
export function bonkWord(weapon: WeaponKind, kind: number | 'heavy' | 'skill', n: number): string {
  const w = BONK[weapon];
  const list = kind === 'heavy' ? w.heavy : kind === 2 || kind === 'skill' ? w.finisher : w.light;
  return list[Math.abs(Math.floor(n)) % list.length];
}

/** How far short of a body a lunge stops (m). */
export const LUNGE_STOP = 0.6;

/** How far to lunge (m, up to `max`) toward a body whose near side is `gap` metres away. */
export function lungeReach(gap: number, max: number): number {
  return Math.max(0, Math.min(max, gap - LUNGE_STOP));
}

/**
 * A leap's take-off speed: up (vy) and along (vh) so it comes down `airTime` seconds later `distance` metres on, under
 * `gravity` rising and `gravity × fall` falling (the controller's heavier fall).
 */
export function leapVelocity(airTime: number, distance: number, gravity: number, fall: number): { vy: number; vh: number } {
  return { vy: (gravity * airTime) / (1 + 1 / Math.sqrt(fall)), vh: distance / Math.max(0.05, airTime) };
}

/**
 * How much heavier gravity runs through a leap of `airTime` seconds so it still peaks `apex` metres up (a cartoon leap:
 * up fast, a hang, down hard). Never lighter than the world's own (1).
 */
export function leapGravity(airTime: number, apex: number, gravity: number, fall: number): number {
  const a = 1 + 1 / Math.sqrt(fall);
  return Math.max(1, (2 * a * a * apex) / (gravity * Math.max(0.05, airTime) ** 2));
}

/** The finisher's spin: the body's turn (radians) at swing progress `p`, once round, eased in and out. */
export function spinAngle(p: number): number {
  const u = Math.max(0, Math.min(1, (p - 0.08) / 0.62));
  return Math.PI * 2 * u * u * (3 - 2 * u);
}

/** A boss's death in slow motion: this long (real seconds) at this speed, the last EASE seconds easing back. */
export const SLOW_MO = { seconds: 1.2, scale: 0.3, ease: 0.4 };

/** The world's speed with `left` seconds of slow motion to go. */
export function slowMoScale(left: number): number {
  if (left <= 0) return 1;
  if (left >= SLOW_MO.ease) return SLOW_MO.scale;
  const u = 1 - left / SLOW_MO.ease;
  return SLOW_MO.scale + (1 - SLOW_MO.scale) * u * u * (3 - 2 * u);
}

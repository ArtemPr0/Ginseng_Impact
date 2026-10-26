import type { BossAttack, BossAttackKind, EnemyDef } from '../data/enemies';
import { PALETTE } from '../render/palette';

/**
 * Where each enemy move lands, and the ground warning that shows it while the body winds up (CombatFx.telegraph).
 * One table for both: CombatSystem's damage checks read the same reaches, half-angles and landing points the
 * warnings are drawn with, so what the ground shows is where the blow lands.
 */

/** A warning's shape (CombatFx.telegraph): a ring round its middle, a cone from its apex, or a disc. */
export type WarnShape = 'ring' | 'cone' | 'disc';

/**
 * Where a warning stands: on the body, facing its way (`body`); on whom it fights (`mark`); from the body toward whom
 * it fights (`lunge`: a charge, a spat web); at where the throw will come down (`landing`, see landing()).
 */
export type WarnAnchor = 'body' | 'mark' | 'lunge' | 'landing';

/**
 * A warning's shape, anchor, size (m), half-width (rad) and colour. `handoff`: the blow lands after the wind-up (a throw
 * still in the air, roots still coming up), so the wind-up fills it only to HANDOFF and the move's own warning (the
 * throw's landing, the delayed strike's) carries the fill on to the edge as it lands.
 */
export interface WarnSpec { shape: WarnShape; anchor: WarnAnchor; size: number; half: number; color: number; handoff?: boolean }

/** How far a hand-off warning fills during the wind-up; the rest fills while the throw flies or the strike comes. */
export const HANDOFF = 0.5;

/** Its colour: blood for a blow that hurts, dusk for one that holds you (webs, the glare, the grab), rune for a throw or a cast at range. */
export const WARN_COLOR = { blow: PALETTE.blood, hold: PALETTE.dusk, range: PALETTE.rune } as const;

/** The plain swing (a mob with no move list): its reach past the attack range, and its half-width (60 degrees). */
export const MELEE_EXTRA = 0.6;
export const MELEE_HALF = Math.PI / 3;
/** Half-widths of the bosses' cone moves (radians). */
export const SWEEP_HALF = 1.3;
export const BREATH_HALF = 0.4;
export const PUNCH_HALF = 0.8;
export const GRAB_HALF = 0.9;
/** The roar's push reaches this far round the body (m). */
export const ROAR_REACH = 16;
/** The roots burst up this far round the spot they were aimed at (m). */
export const ROOTS_RADIUS = 3.2;
/** The net falls this wide (m). */
export const WEBDROP_RADIUS = 4;
/** The glare's ring round whom it holds (m). */
export const GLARE_RADIUS = 1.6;
/** The snowstorm: four patches of static round whom it was cast at (offsets in m), each this wide. */
export const SNOW_PATCHES: ReadonlyArray<readonly [number, number]> = [[0, 0], [4, 2], [-3, 4], [2, -4]];
export const SNOW_RADIUS = 2.6;
/** The cup volley's three cups, round the lead point (offsets in m). */
export const CUP_SPREAD: ReadonlyArray<readonly [number, number]> = [[0, 0], [2.8, 1.5], [-2.4, -2.2]];
/** How near a thrown body's shot must pass to strike (its radius), and the hero's own half-width added to it. */
export const SHOT_RADIUS: Partial<Record<BossAttackKind, number>> = { boulder: 1.5, logthrow: 1.3, cupmortar: 1.1, cupvolley: 1.1, diamond: 0.75 };
export const BODY_REACH = 0.5;
/** Seconds of the mark's running a throw leads it by, and the height over its feet it aims at. */
const LEAD: Partial<Record<BossAttackKind, readonly [number, number]>> = {
  boulder: [0.3, 0.5], logthrow: [0.3, 0.6], cupmortar: [0.5, 0.3], cupvolley: [0.5, 0.3], diamond: [0.25, 1],
};
/** A lunge's touch: a body this much farther than its own radius is struck while it runs (CombatSystem's contact window). */
export const CONTACT_REACH = 1.2;
/** The rate the knock a lunge is pushed with dies away at (1/s, Enemy.stepTo): a push of p carries the body p / KNOCK_DECAY metres. */
export const KNOCK_DECAY = 7;

const scaleOf = (def: EnemyDef): number => def.scale ?? 1;

/** 0..1 of a lunge's push that still fits before the body would run into whom it fights (a lunge stops at the target). */
export function lungeRoom(def: EnemyDef, dist: number): number {
  return Math.max(0, Math.min(1, (dist - (def.bodyRadius + 1)) / 2.6));
}

/**
 * The push a lunge starts with toward whom it fights, `dist` away (Enemy.update adds it to the body's knock): a charge
 * 18 and a bite 8 (as much as fits before it runs into them), a leap 2.2 a metre of the way; 0 for anything else.
 */
export function lungePush(def: EnemyDef, kind: BossAttackKind, dist: number): number {
  switch (kind) {
    case 'charge': return 18 * lungeRoom(def, dist);
    case 'bite': return 8 * lungeRoom(def, dist);
    case 'hop': return dist * 2.2;
    default: return 0;
  }
}

/** The plain swing's reach. */
export function meleeReach(def: EnemyDef): number {
  return def.brain.attackRange + MELEE_EXTRA;
}

/** The slam's shock: everything on the ground this near the body. */
export function slamRadius(def: EnemyDef): number {
  return def.bodyRadius * scaleOf(def) + 6;
}

/** How far a cone move reaches: the move's range plus as much of the body as its swing carries. */
export function coneReach(def: EnemyDef, kind: BossAttackKind, range: number): number {
  const r = def.bodyRadius * scaleOf(def);
  switch (kind) {
    case 'breath': return range + r + 4;
    case 'punch': return range + r * 0.5;
    default: return range + r; // sweep, grab
  }
}

/**
 * Where a throw at `mark` comes down (the lob's target, or a diamond's aim): the mark's place led by its running, the
 * `k`th of the cup volley's three spread round it.
 */
export function landing(kind: BossAttackKind, mark: { x: number; y: number; z: number; vx: number; vz: number }, k = 0): { x: number; y: number; z: number } {
  const [lead, up] = LEAD[kind] ?? [0, 0];
  const [ox, oz] = kind === 'cupvolley' ? CUP_SPREAD[k] ?? CUP_SPREAD[0] : [0, 0];
  return { x: mark.x + mark.vx * lead + ox, y: mark.y + up, z: mark.z + mark.vz * lead + oz };
}

/** How many warnings a move draws at once (the cup volley's three cups; one for everything else). */
export function warnCount(kind: BossAttackKind | undefined): number {
  return kind === 'cupvolley' ? CUP_SPREAD.length : 1;
}

/**
 * The warning a wind-up shows: its shape, where it stands, its size (metres: a ring's or disc's radius, a cone's
 * length) and half-width, its colour; null for a move with nothing to show on the ground (a summons, a blink, the
 * sprays of orbs and thorns, whose shots are their own warning). `attack` is the boss move chosen for this wind-up,
 * null for a mob's plain swing; `dist` how far off whom it fights stands as the wind-up starts (a lunge's run and a
 * spat web's lane are measured to them).
 */
export function warnSpec(def: EnemyDef, attack: BossAttack | null, dist: number): WarnSpec | null {
  const r = def.bodyRadius * scaleOf(def);
  if (!attack) return { shape: 'cone', anchor: 'body', size: meleeReach(def), half: MELEE_HALF, color: WARN_COLOR.blow };
  const k = attack.kind;
  switch (k) {
    case 'slam': return { shape: 'ring', anchor: 'body', size: slamRadius(def), half: 0, color: WARN_COLOR.blow };
    case 'roar': return { shape: 'ring', anchor: 'body', size: ROAR_REACH, half: 0, color: WARN_COLOR.blow };
    case 'sweep': return { shape: 'cone', anchor: 'body', size: coneReach(def, k, attack.range), half: SWEEP_HALF, color: WARN_COLOR.blow };
    case 'breath': return { shape: 'cone', anchor: 'body', size: coneReach(def, k, attack.range), half: BREATH_HALF, color: WARN_COLOR.blow };
    case 'punch': return { shape: 'cone', anchor: 'body', size: coneReach(def, k, attack.range), half: PUNCH_HALF, color: WARN_COLOR.blow };
    case 'grab': return { shape: 'cone', anchor: 'body', size: coneReach(def, k, attack.range), half: GRAB_HALF, color: WARN_COLOR.hold };
    // A lunge: a short cone along the run, as long as the run and the touch at its end.
    case 'charge': case 'bite': case 'hop':
      return { shape: 'cone', anchor: 'lunge', size: r + lungePush(def, k, dist) / KNOCK_DECAY + CONTACT_REACH, half: 0.35, color: WARN_COLOR.blow };
    case 'roots': return { shape: 'ring', anchor: 'mark', size: ROOTS_RADIUS, half: 0, color: WARN_COLOR.range, handoff: true };
    case 'snowstorm': return { shape: 'ring', anchor: 'mark', size: snowReach(), half: 0, color: WARN_COLOR.range, handoff: true };
    case 'boulder': case 'logthrow': case 'cupmortar': case 'cupvolley': case 'diamond': return landingWarn(k);
    case 'webdrop': return { shape: 'disc', anchor: 'mark', size: WEBDROP_RADIUS, half: 0, color: WARN_COLOR.hold, handoff: true };
    // Three webs spat along a narrow lane, out to a little past whom they are spat at.
    case 'web': return { shape: 'cone', anchor: 'lunge', size: Math.min(attack.range, dist + 2), half: 0.2, color: WARN_COLOR.hold };
    // The glare holds whoever faces the eye as it opens: a ring round its mark (the banner says to look away).
    case 'glare': return { shape: 'ring', anchor: 'mark', size: GLARE_RADIUS, half: 0, color: WARN_COLOR.hold, handoff: true };
    default: return null;
  }
}

/** Where a throw comes down: a disc as wide as its shot strikes (its radius and a body's half-width), in the colour of things thrown at range. */
export function landingWarn(kind: BossAttackKind): WarnSpec {
  return { shape: 'disc', anchor: 'landing', size: (SHOT_RADIUS[kind] ?? 1) + BODY_REACH, half: 0, color: WARN_COLOR.range, handoff: true };
}

/** The snowstorm's whole reach round its mark: the farthest patch's middle plus its width. */
export function snowReach(): number {
  let far = 0;
  for (const [x, z] of SNOW_PATCHES) far = Math.max(far, Math.hypot(x, z));
  return far + SNOW_RADIUS;
}

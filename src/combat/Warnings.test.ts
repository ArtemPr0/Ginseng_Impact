import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS, type BossAttack, type BossAttackKind } from '../data/enemies';
import { PALETTE } from '../render/palette';
import {
  BREATH_HALF, coneReach, CONTACT_REACH, KNOCK_DECAY, landing, lungePush, lungeRoom, MELEE_HALF, meleeReach, PUNCH_HALF, ROOTS_RADIUS,
  SHOT_RADIUS, BODY_REACH, slamRadius, snowReach, SNOW_PATCHES, SNOW_RADIUS, SWEEP_HALF, warnCount, warnSpec, WEBDROP_RADIUS,
} from './Warnings';

const move = (kind: BossAttackKind, range = 8): BossAttack => ({ kind, range, windup: 1, recover: 1, weight: 1 });
const beast = ENEMY_DEFS.beast;
const cyclops = ENEMY_DEFS.cyclops;

describe('warnSpec: the ground warning each wind-up shows', () => {
  it('a plain swing: a 60-degree blood cone on the body, as long as the blow reaches', () => {
    const w = warnSpec(beast, null, 2)!;
    expect(w).toMatchObject({ shape: 'cone', anchor: 'body', size: beast.brain.attackRange + 0.6, half: Math.PI / 3, color: PALETTE.blood });
    expect(w.size).toBe(meleeReach(beast));
    expect(w.half).toBe(MELEE_HALF);
    expect(w.handoff).toBeFalsy();
  });

  it('slam, roar: rings round the body, the very radius the shock strikes', () => {
    expect(warnSpec(cyclops, move('slam'), 5)).toMatchObject({ shape: 'ring', anchor: 'body', size: slamRadius(cyclops), color: PALETTE.blood });
    expect(warnSpec(cyclops, move('roar'), 5)).toMatchObject({ shape: 'ring', anchor: 'body', size: 16 });
  });

  it('sweep, breath, punch: cones of the move\'s own width and reach (the damage check reads the same numbers)', () => {
    expect(warnSpec(cyclops, move('sweep', 6), 3)).toMatchObject({ shape: 'cone', size: coneReach(cyclops, 'sweep', 6), half: SWEEP_HALF });
    expect(warnSpec(cyclops, move('breath', 10), 3)).toMatchObject({ shape: 'cone', size: coneReach(cyclops, 'breath', 10), half: BREATH_HALF });
    expect(warnSpec(cyclops, move('punch', 4), 3)).toMatchObject({ shape: 'cone', size: coneReach(cyclops, 'punch', 4), half: PUNCH_HALF });
    expect(warnSpec(cyclops, move('grab', 3.4), 3)).toMatchObject({ shape: 'cone', color: PALETTE.dusk });
  });

  it('throws: a rune disc at the landing point, as wide as the shot strikes, handed on to the shot in the air', () => {
    for (const k of ['boulder', 'logthrow', 'cupmortar', 'cupvolley', 'diamond'] as const) {
      const w = warnSpec(cyclops, move(k), 12)!;
      expect(w).toMatchObject({ shape: 'disc', anchor: 'landing', color: PALETTE.rune, handoff: true });
      expect(w.size).toBeCloseTo((SHOT_RADIUS[k] ?? 1) + BODY_REACH);
    }
  });

  it('roots, snow, net, glare: on whom it fights; control in dusk, the rest in rune; the delayed strike carries the fill on', () => {
    expect(warnSpec(cyclops, move('roots'), 8)).toMatchObject({ shape: 'ring', anchor: 'mark', size: ROOTS_RADIUS, color: PALETTE.rune, handoff: true });
    expect(warnSpec(cyclops, move('snowstorm'), 8)).toMatchObject({ shape: 'ring', anchor: 'mark', size: snowReach(), handoff: true });
    expect(warnSpec(cyclops, move('webdrop'), 8)).toMatchObject({ shape: 'disc', anchor: 'mark', size: WEBDROP_RADIUS, color: PALETTE.dusk, handoff: true });
    expect(warnSpec(cyclops, move('glare'), 8)).toMatchObject({ shape: 'ring', anchor: 'mark', color: PALETTE.dusk, handoff: true });
    expect(warnSpec(cyclops, move('web', 20), 8)).toMatchObject({ shape: 'cone', anchor: 'lunge', size: 10, color: PALETTE.dusk });
  });

  it('a lunge: a short cone along the run, as long as the push carries the body plus its touch', () => {
    const d = 10;
    const w = warnSpec(beast, move('charge', 18), d)!;
    expect(w).toMatchObject({ shape: 'cone', anchor: 'lunge' });
    expect(w.size).toBeCloseTo(beast.bodyRadius * (beast.scale ?? 1) + lungePush(beast, 'charge', d) / KNOCK_DECAY + CONTACT_REACH);
  });

  it('a summons, a blink, the sprays of orbs: nothing on the ground', () => {
    for (const k of ['summon', 'blink', 'volley', 'kaleido', 'eyebeam', 'thorns', 'rainbow', 'mirror'] as const) expect(warnSpec(cyclops, move(k), 8)).toBeNull();
  });
});

describe('landing / lunges', () => {
  const mark = { x: 10, y: 2, z: -4, vx: 3, vz: -2 };

  it('leads a running mark by the throw\'s lead and aims a little over its feet', () => {
    expect(landing('boulder', mark)).toEqual({ x: 10.9, y: 2.5, z: -4.6 });
    const still = { ...mark, vx: 0, vz: 0 };
    expect(landing('logthrow', still)).toEqual({ x: 10, y: 2.6, z: -4 });
  });

  it('spreads the cup volley\'s three cups round the lead point', () => {
    const still = { ...mark, vx: 0, vz: 0 };
    expect(warnCount('cupvolley')).toBe(3);
    expect(warnCount('boulder')).toBe(1);
    expect(warnCount(undefined)).toBe(1);
    const spots = [0, 1, 2].map((k) => landing('cupvolley', still, k));
    expect(spots[0]).toEqual({ x: 10, y: 2.3, z: -4 });
    expect(spots[1].x).toBeCloseTo(12.8);
    expect(spots[2].z).toBeCloseTo(-6.2);
  });

  it('keeps the old pushes: charge 18 and bite 8 as far as they fit, a leap 2.2 a metre', () => {
    expect(lungePush(beast, 'charge', 20)).toBe(18 * lungeRoom(beast, 20));
    expect(lungePush(beast, 'bite', 20)).toBe(8);
    expect(lungePush(beast, 'hop', 4)).toBeCloseTo(8.8);
    expect(lungePush(beast, 'slam', 4)).toBe(0);
    expect(lungeRoom(beast, beast.bodyRadius + 1)).toBe(0);
  });

  it('the snow\'s whole reach covers its farthest patch', () => {
    for (const [x, z] of SNOW_PATCHES) expect(Math.hypot(x, z) + SNOW_RADIUS).toBeLessThanOrEqual(snowReach() + 1e-9);
  });
});

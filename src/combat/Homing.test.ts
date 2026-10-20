import { Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { chainTo, RETARGET_RANGE, steer, type NearestQuarry, type Steered } from './Homing';

/** A skeleton-sized body standing at (x, z). */
interface Mob { id: number; alive: boolean; pos: { x: number; y: number; z: number }; def: { height: number; scale?: number; bodyRadius: number } }
const mob = (id: number, x: number, z: number): Mob => ({ id, alive: true, pos: { x, y: 0, z }, def: { height: 1.8, bodyRadius: 0.5 } });

function nearestOf(mobs: Mob[]): NearestQuarry<Mob> {
  return (x, z, range, exclude) => {
    let best: Mob | null = null;
    let bestD = range;
    for (const m of mobs) {
      if (!m.alive || exclude.has(m.id)) continue;
      const d = Math.hypot(m.pos.x - x, m.pos.z - z);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  };
}

type Arrow = Steered<Mob> & { hit: Set<number>; chains: number; life: number };

/** A Moon Volley arrow as CombatSystem.moonVolley looses it: 24 m/s, a little up, homing on `target` after 0.12 s, one chain. */
function volleyArrow(target: Mob, yaw = 0): Arrow {
  return {
    pos: new Vector3(0, 1.3, 0),
    vel: new Vector3(Math.cos(yaw), 0.12, Math.sin(yaw)).normalize().multiplyScalar(24),
    hit: new Set(),
    homing: { target, point: null, delay: 0.12, turn: 5, age: 0 },
    chains: 1,
    life: 4,
  };
}

/**
 * Flies an arrow the way CombatSystem's projectile loop does, at 60 steps a second: steer, move, out at the ground; the
 * first standing body it reaches that it has not struck yet takes the hit (radius 1 + the body's); with a chain left it
 * goes on (CombatSystem: the nearest other within 8 m, at 22 m/s, 1.2 s more to live), else it is spent. Returns the ids
 * it struck, in order.
 */
function fly(a: Arrow, mobs: Mob[]): number[] {
  const nearest = nearestOf(mobs);
  const struck: number[] = [];
  const dt = 1 / 60;
  while (a.life > 0) {
    a.life -= dt;
    steer(a, dt, nearest);
    a.pos.addScaledVector(a.vel, dt);
    if (a.pos.y < -0.2) break;
    for (const m of mobs) {
      if (!m.alive || a.hit.has(m.id)) continue;
      if (Math.hypot(m.pos.x - a.pos.x, m.pos.z - a.pos.z) > 1 + m.def.bodyRadius) continue;
      if (Math.abs(m.pos.y + m.def.height * 0.5 - a.pos.y) >= 2.5 + m.def.height * 0.5) continue;
      a.hit.add(m.id);
      struck.push(m.id);
      const next = a.chains > 0 ? nearest(m.pos.x, m.pos.z, 8, a.hit) : null;
      if (!next) return struck;
      a.chains--;
      chainTo(a, next, 22);
      a.life = 1.2;
      break;
    }
  }
  return struck;
}

describe('chaining homing arrows (Moon Volley)', () => {
  it('goes on to a second body when the first survives the hit', () => {
    // The mark stands 10 m out; the next 7 m past it, off to the side (inside the 8 m chain range). The mark survives.
    const mark = mob(1, 10, 0);
    const next = mob(2, 10, 7);
    const arrow = volleyArrow(mark);
    expect(fly(arrow, [mark, next])).toEqual([1, 2]);
    expect(arrow.chains).toBe(0);
  });

  it('chains off each of three stunned skeletons, whichever it was loosed at', () => {
    // Three in a loose row, every arrow of the fan at one of them in turn (the volley shares its marks round the fan).
    const pack = [mob(1, 9, -3), mob(2, 11, 0), mob(3, 9, 3.5)];
    for (let i = 0; i < 6; i++) {
      const fan = ((i / 5) * 2 - 1) * ((22 * Math.PI) / 180);
      const struck = fly(volleyArrow(pack[i % 3], fan), pack);
      // (An arrow can meet a body standing in front of its mark first: it chains on from that one.)
      expect(struck).toHaveLength(2);
      expect(new Set(struck).size).toBe(2);
    }
  });

  it('chainTo aims the shot at the next body and makes it the steering target', () => {
    const struckMob = mob(1, 10, 0);
    const next = mob(2, 14, 3);
    const a = volleyArrow(struckMob);
    a.pos.set(9.2, 1, 0);
    a.homing!.point = new Vector3(1, 2, 3);
    chainTo(a, next, 22);
    expect(a.homing!.target).toBe(next);
    expect(a.homing!.point).toBeNull();
    expect(a.vel.length()).toBeCloseTo(22, 6);
    const to = new Vector3(14 - 9.2, 0.6 - 1, 3).normalize();
    expect(a.vel.clone().normalize().dot(to)).toBeCloseTo(1, 6);
  });

  it('a shot with no steering (a chained staff bolt) is only re-aimed', () => {
    const next = mob(2, 5, 5);
    const bolt: Steered<Mob> = { pos: new Vector3(0, 1, 0), vel: new Vector3(22, 0, 0), hit: new Set([1]), homing: null };
    chainTo(bolt, next, 22);
    expect(bolt.homing).toBeNull();
    expect(bolt.vel.clone().normalize().dot(new Vector3(5, -0.4, 5).normalize())).toBeCloseTo(1, 6);
  });
});

describe('steer', () => {
  const steered = (target: Mob | null, hit: number[] = []): Steered<Mob> & { hit: Set<number> } => ({
    pos: new Vector3(0, 1, 0), vel: new Vector3(20, 0, 0), hit: new Set(hit),
    homing: { target, point: null, delay: 0, turn: 5, age: 0 },
  });

  it('lets go of a body it already struck, though it still stands, for the nearest other', () => {
    const struckMob = mob(1, 3, 0);
    const near = mob(2, 6, 4);
    const far = mob(3, 14, -9);
    const s = steered(struckMob, [1]);
    steer(s, 1 / 60, nearestOf([struckMob, near, far]));
    expect(s.homing!.target).toBe(near);
  });

  it('with nobody else about, flies straight on past a body it struck, and at the spot of one that fell', () => {
    const struckMob = mob(1, 3, 0);
    const s = steered(struckMob, [1]);
    steer(s, 1 / 60, nearestOf([struckMob]));
    expect(s.homing!.target).toBeNull();
    expect(s.homing!.point).toBeNull();
    expect(s.vel.x).toBe(20); // not turned back toward it
    const fallen = mob(4, 3, 2);
    fallen.alive = false;
    const f = steered(fallen);
    steer(f, 1 / 60, nearestOf([fallen]));
    expect(f.homing!.target).toBeNull();
    expect(f.homing!.point).toEqual(new Vector3(3, 0.5, 2));
  });

  it('trades a fallen body for the nearest standing one within RETARGET_RANGE only', () => {
    const fallen = mob(1, 3, 0);
    fallen.alive = false;
    const out = mob(2, RETARGET_RANGE + 1, 0);
    const s = steered(fallen);
    steer(s, 1 / 60, nearestOf([fallen, out]));
    expect(s.homing!.target).toBeNull();
    const inside = mob(3, RETARGET_RANGE - 1, 0);
    const t = steered(fallen);
    steer(t, 1 / 60, nearestOf([fallen, out, inside]));
    expect(t.homing!.target).toBe(inside);
  });

  it('waits out its delay, then turns toward the body, keeping its speed', () => {
    const m = mob(1, 0, 10);
    const s = steered(m);
    s.homing!.delay = 0.1;
    steer(s, 0.05, nearestOf([m]));
    expect(s.vel.toArray()).toEqual([20, 0, 0]);
    steer(s, 0.06, nearestOf([m]));
    expect(s.vel.z).toBeGreaterThan(0);
    expect(s.vel.length()).toBeCloseTo(20, 6);
    expect(s.homing!.turn).toBeCloseTo(5.3, 6);
  });
});

import { describe, expect, it } from 'vitest';
import { canHandGrab, canLift, flightStep, handHold, impactDamage, mindHold, steerTo, throwVelocity, type Flight } from './Carry';

// The user's request of 2026-11-16: the wizard picks up objects, mobs and buildings and throws them; the knight picks a
// mob up one-handed, carries it and throws it.
const mob = (o: Partial<{ height: number; scale: number; boss: boolean; flying: boolean; speed: number; body: unknown; eye: boolean; seated: boolean }> = {}) =>
  ({ height: 1.8, scale: 1, boss: false, flying: false, speed: 3, ...o }) as never;

describe('who can be picked up', () => {
  it('the knight lifts anything up to troll size that walks; never a boss, a flyer, a rooted thing', () => {
    expect(canHandGrab(mob())).toBe(true);
    expect(canHandGrab(mob({ height: 2.2, scale: 1.3 }))).toBe(true);
    expect(canHandGrab(mob({ height: 4.2 }))).toBe(false);
    expect(canHandGrab(mob({ boss: true }))).toBe(false);
    expect(canHandGrab(mob({ flying: true }))).toBe(false);
    expect(canHandGrab(mob({ speed: 0 }))).toBe(false);
    expect(canHandGrab(mob({ eye: true }))).toBe(false);
  });
  it('the wizard lifts bigger things (and flyers), never a boss', () => {
    expect(canLift(mob({ height: 4.2 }))).toBe(true);
    expect(canLift(mob({ flying: true }))).toBe(true);
    expect(canLift(mob({ height: 9 }))).toBe(false);
    expect(canLift(mob({ boss: true }))).toBe(false);
  });
});

describe('holding', () => {
  it('one-handed: the mob hangs from his raised fist in front of him, feet off the ground', () => {
    const p = handHold({ x: 0, y: 0, z: 0 }, Math.PI / 2, 1.8);
    // facing (cos yaw, sin yaw): yaw π/2 faces +z
    expect(p.z).toBeGreaterThan(0.6);
    expect(p.z).toBeLessThan(1.3);
    expect(Math.abs(p.x)).toBeLessThan(0.3);
    // The neck at his fist (~2.1 m): the feet hang just off the ground.
    expect(p.y + 1.8 * 0.85).toBeCloseTo(2.1, 1);
    expect(p.y).toBeGreaterThan(0);
  });
  it('by the mind: floating a few metres ahead and up, bobbing', () => {
    const a = mindHold({ x: 0, y: 0, z: 0 }, 0, 0), b = mindHold({ x: 0, y: 0, z: 0 }, 0, 0.7);
    expect(a.x).toBeGreaterThan(2.5);
    expect(a.y).toBeGreaterThan(2);
    expect(a.y).not.toBeCloseTo(b.y, 3);
  });
  it('steering a loose piece to a point: towards it, cancelling gravity, slower when close', () => {
    const far = steerTo({ x: 0, y: 0, z: 0 }, { x: 4, y: 0, z: 0 }, 0.016, 9.81);
    const near = steerTo({ x: 0, y: 0, z: 0 }, { x: 0.2, y: 0, z: 0 }, 0.016, 9.81);
    expect(far.vx).toBeGreaterThan(near.vx);
    expect(far.vy).toBeCloseTo(9.81 * 0.016, 5);
    expect(Math.hypot(far.vx, far.vy, far.vz)).toBeLessThan(30);
  });
});

describe('throwing', () => {
  it('heavier goes slower; a throw always rises a little', () => {
    const light = throwVelocity({ x: 0, y: 0, z: 1 }, 'hand', 1), heavy = throwVelocity({ x: 0, y: 0, z: 1 }, 'hand', 4);
    expect(light.z).toBeGreaterThan(heavy.z);
    expect(light.y).toBeGreaterThan(0);
    const mind = throwVelocity({ x: 1, y: -0.3, z: 0 }, 'mind', 1);
    expect(mind.x).toBeGreaterThan(light.z);
  });
  it('a thrown body flies an arc and lands on the ground with its impact speed', () => {
    const f: Flight = { vx: 10, vy: 4, vz: 0, spin: 6, angle: 0 };
    const p = { x: 0, y: 2, z: 0 };
    let hit = 0, t = 0;
    while (!hit && t < 5) { hit = flightStep(f, p, 0.016, () => 0); t += 0.016; }
    expect(hit).toBeGreaterThan(5);
    expect(p.y).toBe(0);
    expect(p.x).toBeGreaterThan(5);
    expect(p.x).toBeLessThan(20);
  });
  it('impact hurts more for heavier and faster, nothing for a gentle drop', () => {
    expect(impactDamage(1, 2)).toBe(0);
    expect(impactDamage(1, 14)).toBeGreaterThan(impactDamage(1, 8));
    expect(impactDamage(3, 10)).toBeGreaterThan(impactDamage(1, 10));
  });
});

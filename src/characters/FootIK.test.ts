import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { footPlan, legIK } from './FootIK';

/** Where the leg's joints go under the solve: the knee turned by `upper`, the ankle by `upper·lower` about the knee. */
function apply(hip: Vector3, knee: Vector3, ankle: Vector3, upper: Quaternion, lower: Quaternion): { knee: Vector3; ankle: Vector3 } {
  const k = knee.clone().sub(hip).applyQuaternion(upper).add(hip);
  const a = ankle.clone().sub(knee).applyQuaternion(lower).applyQuaternion(upper).add(k);
  return { knee: k, ankle: a };
}

describe('legIK (two bones: thigh and shin)', () => {
  const hip = new Vector3(0, 1, 0);
  // A leg a little bent, the knee forward (+z).
  const knee = new Vector3(0, 0.55, 0.05);
  const ankle = new Vector3(0, 0.1, 0);
  const side = new Vector3(1, 0, 0);

  it('puts the ankle on a raised target, the bones keeping their lengths', () => {
    const target = new Vector3(0, 0.3, 0.02);
    const r = legIK(hip, knee, ankle, target, side);
    const p = apply(hip, knee, ankle, r.upper, r.lower);
    expect(p.ankle.distanceTo(target)).toBeLessThan(1e-3);
    expect(p.knee.distanceTo(hip)).toBeCloseTo(knee.distanceTo(hip), 5);
    expect(p.ankle.distanceTo(p.knee)).toBeCloseTo(ankle.distanceTo(knee), 5);
    // Bent more, and still forward: knees never fold backwards.
    expect(p.knee.z).toBeGreaterThan(0.05);
  });

  it('a straight leg bends forward about its side axis', () => {
    const k = new Vector3(0, 0.55, 0), a = new Vector3(0, 0.1, 0);
    const target = new Vector3(0, 0.35, 0);
    const r = legIK(hip, k, a, target, side);
    const p = apply(hip, k, a, r.upper, r.lower);
    expect(p.ankle.distanceTo(target)).toBeLessThan(1e-3);
    expect(Math.abs(p.knee.z)).toBeGreaterThan(0.1);
  });

  it('out of reach: the leg straightens toward the target and stops', () => {
    const target = new Vector3(0, -0.5, 0);
    const r = legIK(hip, knee, ankle, target, side);
    const p = apply(hip, knee, ankle, r.upper, r.lower);
    const reach = knee.distanceTo(hip) + ankle.distanceTo(knee);
    expect(p.ankle.distanceTo(hip)).toBeGreaterThan(reach * 0.99);
    expect(p.ankle.y).toBeLessThan(ankle.y);
  });
});

describe('footPlan (how far the hips drop and each foot rises)', () => {
  it('flat ground: nothing moves', () => {
    expect(footPlan(0, 0, 0, 0.4, 0.5)).toEqual({ drop: 0, raiseL: 0, raiseR: 0, planted: true });
  });

  it('across a slope: the hips drop to the low foot, the high foot rises by the step between', () => {
    const p = footPlan(0, 0.12, -0.1, 0.4, 0.5);
    expect(p.drop).toBeCloseTo(-0.1, 6);
    expect(p.raiseL).toBeCloseTo(0.22, 6);
    expect(p.raiseR).toBeCloseTo(0, 6);
  });

  it('a foot over a hole or a step too high is left alone (limits)', () => {
    const p = footPlan(0, 0.9, -2, 0.4, 0.5);
    expect(p.drop).toBeCloseTo(-0.4, 6);
    expect(p.raiseL).toBeLessThanOrEqual(0.5);
    expect(p.raiseR).toBe(0);
  });

  it('both feet on higher ground than the body: they are not lifted (the controller stands on the highest point)', () => {
    const p = footPlan(0, 0.05, 0.08, 0.4, 0.5);
    expect(p.drop).toBe(0);
    expect(p.raiseL).toBeCloseTo(0.05, 6);
    expect(p.raiseR).toBeCloseTo(0.08, 6);
  });
});

describe('footPlan says when the ground is out of the feet\'s reach (review: a steep slope stood the body upright with a foot sunk)', () => {
  it('reachable ground: planted', () => {
    expect(footPlan(0, 0.12, -0.1, 0.4, 0.5).planted).toBe(true);
  });
  it('a drop past its limit, or a foot left where the clip has it: not planted (the body keeps its slope lean)', () => {
    expect(footPlan(0, 0.9, -2, 0.4, 0.5).planted).toBe(false);
    expect(footPlan(0, 0.9, 0, 0.4, 0.5).planted).toBe(false);
  });
});


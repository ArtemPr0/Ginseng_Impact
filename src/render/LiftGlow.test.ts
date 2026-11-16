import { describe, expect, it } from 'vitest';
import { LiftGlow } from './LiftGlow';

describe('LiftGlow (what Telekinesis would lift glows under the crosshair)', () => {
  it('hidden with nothing to lift', () => {
    const g = new LiftGlow();
    g.update(0.016, null);
    expect(g.group.visible).toBe(false);
  });
  it('rings the target at its size, and fades in', () => {
    const g = new LiftGlow();
    g.update(0.016, { kind: 'building', x: 4, y: 1, z: -2, r: 3 });
    expect(g.group.visible).toBe(true);
    expect(g.group.position.x).toBe(4);
    expect(g.group.position.z).toBe(-2);
    expect(g.group.scale.x).toBeCloseTo(3, 1);
    const a0 = g.strength;
    g.update(0.1, { kind: 'building', x: 4, y: 1, z: -2, r: 3 });
    expect(g.strength).toBeGreaterThan(a0);
  });
});

import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { GroundFires } from './GroundFire';

describe('GroundFires (v12: the reel\'s fires left burning after a blast)', () => {
  it('a blast leaves tongues of flame scattered over its area, on the ground', () => {
    const f = new GroundFires(120);
    f.ignite(new Vector3(10, 2, 0), 4, 20, () => 2);
    expect(f.live).toBe(20);
    for (const t of f.list()) {
      expect(Math.hypot(t.x - 10, t.z)).toBeLessThanOrEqual(4);
      expect(t.y).toBe(2);
    }
    expect(f.geometry.instanceCount).toBe(20);
  });
  it('they flare up, burn for 8-15 s and die down', () => {
    const f = new GroundFires(120);
    f.ignite(new Vector3(0, 0, 0), 3, 10, () => 0);
    const s0 = f.list()[0].shown;
    for (let i = 0; i < 10; i++) f.update(0.1);
    expect(f.list()[0].shown).toBeGreaterThan(s0);
    for (let i = 0; i < 60; i++) f.update(0.1);
    expect(f.live).toBe(10);
    for (let i = 0; i < 100; i++) f.update(0.1);
    expect(f.live).toBe(0);
    expect(f.mesh.visible).toBe(false);
  });
  it('says where it burns (mobs standing in it take damage)', () => {
    const f = new GroundFires(120);
    f.ignite(new Vector3(0, 0, 0), 2, 12, () => 0);
    f.update(0.5);
    expect(f.burning(0, 0, 1.5)).toBe(true);
    expect(f.burning(20, 20, 1)).toBe(false);
  });
  it('never more than its cap (High 120, Low 40): the oldest go out first', () => {
    const f = new GroundFires(40);
    for (let i = 0; i < 6; i++) f.ignite(new Vector3(i * 10, 0, 0), 3, 20, () => 0);
    expect(f.live).toBe(40);
    expect(f.list().every((t) => t.x > 15)).toBe(true);
  });
});

describe('GroundFires light (critic round 2: the fires read as pale cones and hazed the frame)', () => {
  const frag = (new GroundFires(10).mesh.material as unknown as { fragmentShader: string }).fragmentShader;
  it('each tongue has a hot core down its middle and darker orange-red edges, not one solid pale shape', () => {
    expect(frag).toMatch(/float core\s*=/);
    expect(frag).toMatch(/heat\s*\*=?\s*.*core|core\s*\*\s*heat/);
  });
  it('shines at most about its own colour (the bloom glows, it does not haze the frame)', () => {
    const m = /\* \(([0-9.]+) \+ heat \* ([0-9.]+)\)/.exec(frag);
    expect(m).not.toBeNull();
    expect(Number(m![1]) + Number(m![2])).toBeLessThanOrEqual(1.25);
  });
});


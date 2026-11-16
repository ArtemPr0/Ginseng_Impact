import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Billow } from './Billow';

describe('Billow (billowing dust and smoke that lingers)', () => {
  it('a cloud is many puffs that live their life and are gone; the pool wraps', () => {
    const s = new Billow(64);
    s.cloud(new Vector3(0, 0, 0), 6, 0x8890a0, { puffs: 20, life: 6 });
    expect(s.live).toBe(20);
    s.update(3);
    expect(s.live).toBe(20);
    s.update(5);
    expect(s.live).toBe(0);
    expect(s.mesh.visible).toBe(false);
    for (let i = 0; i < 10; i++) s.cloud(new Vector3(), 2, 0xffffff, { puffs: 10, life: 5 });
    expect(s.live).toBe(64);
  });
  it('puffs start round the base inside the radius and rise', () => {
    const s = new Billow(32);
    s.cloud(new Vector3(10, 2, -4), 3, 0x777777, { puffs: 16, life: 4 });
    for (let i = 0; i < 16; i++) {
      const p = s.startOf(i);
      expect(Math.hypot(p.x - 10, p.z + 4)).toBeLessThanOrEqual(3.01);
      expect(s.velOf(i).y).toBeGreaterThan(0);
    }
  });
});

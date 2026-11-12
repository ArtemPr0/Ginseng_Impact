import { describe, expect, it } from 'vitest';
import { launch, yeetStep } from './Yeet';

describe('yeet', () => {
  it('launches a body up and away from the blow, spinning', () => {
    const y = launch(1, 0, 1);
    expect(y.vx).toBeGreaterThan(4);
    expect(Math.abs(y.vz)).toBeLessThan(1e-9);
    expect(y.vy).toBeGreaterThan(6);
    expect(Math.abs(y.spin)).toBeGreaterThan(4);
  });

  it('flies an arc and comes to rest on the ground', () => {
    const y = launch(0, 1, 1);
    const p = { x: 0, y: 0, z: 0 };
    let top = 0;
    let t = 0;
    while (!y.landed && t < 10) { yeetStep(y, p, 1 / 60, () => 0); top = Math.max(top, p.y); t += 1 / 60; }
    expect(y.landed).toBe(true);
    expect(top).toBeGreaterThan(1.5);
    expect(p.z).toBeGreaterThan(3);
    expect(p.y).toBe(0);
    expect(t).toBeLessThan(3);
  });

  it('a bigger body flies less far', () => {
    const fly = (mass: number) => { const y = launch(1, 0, mass); const p = { x: 0, y: 0, z: 0 }; for (let i = 0; i < 600 && !y.landed; i++) yeetStep(y, p, 1 / 60, () => 0); return p.x; };
    expect(fly(3)).toBeLessThan(fly(1));
  });
});

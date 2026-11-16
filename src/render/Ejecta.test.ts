import { describe, expect, it } from 'vitest';
import { Ejecta, EJECTA_LIFE } from './Ejecta';

describe('Ejecta (clods of earth thrown out of a fresh crater)', () => {
  it('more for a bigger, deeper hole; thrown up and out; they land and lie, then go', () => {
    const e = new Ejecta(() => 0);
    e.spawn(0, 0, 0, 1.2, 0.3);
    const small = e.sim.pieces.length;
    e.spawn(20, 0, 0, 3.5, 1.5);
    expect(e.sim.pieces.length - small).toBeGreaterThan(small);
    expect(e.sim.pieces.every((p) => p.vy > 0)).toBe(true);
    for (let t = 0; t < 4; t += 1 / 30) e.update(1 / 30);
    expect(e.sim.pieces.every((p) => p.y < 1)).toBe(true);
    for (let t = 0; t < EJECTA_LIFE + 2; t += 0.25) e.update(0.25);
    expect(e.sim.pieces.length).toBe(0);
    expect(e.group.children.length).toBe(0);
  });
});

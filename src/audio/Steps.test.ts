import { describe, expect, it } from 'vitest';
import { LAYER, LAYER_COUNT } from '../render/Ground';
import { StepClock, surfaceOf } from './Steps';

describe('footsteps (recorded, by surface)', () => {
  it('the ground layer under the foot picks the surface; standing on a built thing is stone', () => {
    const w = new Uint8Array(LAYER_COUNT);
    w[LAYER.grass] = 255;
    expect(surfaceOf(w, false)).toBe('grass');
    w[LAYER.grass] = 40; w[LAYER.snow] = 200;
    expect(surfaceOf(w, false)).toBe('snow');
    w.fill(0); w[LAYER.cobble] = 180; w[LAYER.soil] = 60;
    expect(surfaceOf(w, false)).toBe('stone');
    expect(surfaceOf(null, false)).toBe('grass');
    expect(surfaceOf(w, true)).toBe('stone');
  });
  it('a step each stride: longer strides running, none standing still or in the air', () => {
    const c = new StepClock();
    let n = 0;
    for (let t = 0; t < 2; t += 1 / 60) if (c.update(1 / 60, 2, true)) n++;
    expect(n).toBeGreaterThanOrEqual(4);
    expect(n).toBeLessThanOrEqual(6);
    let r = 0;
    for (let t = 0; t < 2; t += 1 / 60) if (c.update(1 / 60, 7, true)) r++;
    expect(r).toBeGreaterThan(n);
    expect(r).toBeLessThan(14);
    let still = 0;
    for (let t = 0; t < 2; t += 1 / 60) if (c.update(1 / 60, 0, true) || c.update(1 / 60, 6, false)) still++;
    expect(still).toBe(0);
  });
});

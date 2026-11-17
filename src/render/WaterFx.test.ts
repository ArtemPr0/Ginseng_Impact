import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { WaterFx } from './WaterFx';

describe('WaterFx (the reel\'s water: a whip, a wave, a shield)', () => {
  it('a ribbon along points shows, ripples, and is gone after its life', () => {
    const w = new WaterFx();
    w.ribbon([new Vector3(0, 1, 0), new Vector3(0, 1.5, 4), new Vector3(0, 1, 8)], { width: 0.5, life: 1 });
    w.update(0.1);
    expect(w.count).toBe(1);
    expect(w.verts).toBeGreaterThan(12);
    for (let i = 0; i < 20; i++) w.update(0.1);
    expect(w.count).toBe(0);
    expect(w.verts).toBe(0);
  });
  it('an upright one (a shield) stands: its strip runs up, not flat', () => {
    const w = new WaterFx();
    w.ribbon([new Vector3(-2, 0, 3), new Vector3(0, 0, 3.6), new Vector3(2, 0, 3)], { width: 2.4, life: 2, upright: true });
    w.update(0.05);
    const pos = w.mesh.geometry.getAttribute('position');
    let top = -Infinity;
    for (let i = 0; i < w.verts; i++) top = Math.max(top, pos.getY(i));
    expect(top).toBeGreaterThan(2);
  });
});

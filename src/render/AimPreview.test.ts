import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AimPreview } from './AimPreview';
import { aimShape } from '../combat/Aim';

const view = (id: string, extra = {}) => ({
  shape: aimShape(id, 4), from: new Vector3(0, 1.5, 0), to: new Vector3(0, 0, 15), dir: { x: 0, z: 1 }, color: 0xff7a1a, far: false, ...extra,
});

describe('AimPreview draws every shape it is given', () => {
  for (const id of ['fireball', 'starfall', 'fire-tornado', 'gale-shot', 'wrecking-charge', 'stone-wall', 'black-hole']) {
    it(id, () => {
      const p = new AimPreview(() => 0);
      p.show(view(id), 0.016);
      expect(p.group.visible).toBe(true);
      expect(p.count).toBeGreaterThan(12);
    });
  }
  it('the arc rises over the middle of the flight', () => {
    const p = new AimPreview(() => 0);
    p.show(view('fireball'), 0.016);
    const pos = (p.group.children[0] as unknown as { geometry: { attributes: { position: { array: Float32Array } } } }).geometry.attributes.position.array;
    let top = 0;
    for (let i = 1; i < p.count * 3; i += 3) top = Math.max(top, pos[i]);
    expect(top).toBeGreaterThan(2.5);
  });
  it('nothing for a spell with no aim (Blood Moon)', () => {
    const p = new AimPreview(() => 0);
    p.show(view('blood-moon'), 0.016);
    expect(p.group.visible).toBe(false);
  });
});

describe('AimPreview: the second page', () => {
  it('a ring round the hero is drawn round him, not at the crosshair', () => {
    const p = new AimPreview(() => 0);
    p.show(view('stone-ring', { shape: aimShape('stone-ring', 4.5) }), 0.016);
    const pos = (p.group.children[0] as unknown as { geometry: { attributes: { position: { array: Float32Array } } } }).geometry.attributes.position.array;
    let far = 0;
    for (let i = 0; i < p.count * 3; i += 3) far = Math.max(far, Math.hypot(pos[i], pos[i + 2]));
    expect(far).toBeLessThan(5);
  });
  it('a wall before him stands ahead of him', () => {
    const p = new AimPreview(() => 0);
    p.show(view('earth-wall', { shape: aimShape('earth-wall') }), 0.016);
    const pos = (p.group.children[0] as unknown as { geometry: { attributes: { position: { array: Float32Array } } } }).geometry.attributes.position.array;
    let z = 0;
    for (let i = 0; i < p.count * 3; i += 3) z = Math.max(z, pos[i + 2]);
    expect(z).toBeLessThan(4);
    expect(z).toBeGreaterThan(1.5);
  });
});

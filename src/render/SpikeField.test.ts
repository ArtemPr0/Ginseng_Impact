import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { SpikeField } from './SpikeField';

const rock = () => { const g = new Group(); const m = new Mesh(new BoxGeometry(2, 30, 2), new MeshStandardMaterial()); m.position.y = 15; g.add(m); return g; };
const tipY = (f: SpikeField, i: number) => {
  const m = new Matrix4();
  f.mesh!.getMatrixAt(i, m);
  return new Vector3(0, 1, 0).applyMatrix4(m).y;
};

describe('SpikeField (the reel\'s spiky rocks bursting out of the ground)', () => {
  it('a spike erupts out of the ground to its height, stands, then sinks back and is gone', () => {
    const f = new SpikeField(rock());
    f.raise(new Vector3(3, 0, 4), { height: 2.4, width: 0.8, delay: 0, life: 1.5 });
    expect(f.count).toBe(1);
    f.update(0.01);
    expect(tipY(f, 0)).toBeLessThan(1.2);
    f.update(0.3);
    expect(tipY(f, 0)).toBeGreaterThan(2.2);
    for (let t = 0; t < 3; t += 0.1) f.update(0.1);
    expect(f.count).toBe(0);
  });
  it('a delayed one waits under the ground', () => {
    const f = new SpikeField(rock());
    f.raise(new Vector3(0, 0, 0), { height: 2, width: 0.6, delay: 0.5, life: 1 });
    f.update(0.2);
    expect(tipY(f, 0)).toBeLessThanOrEqual(0.01);
  });
  it('no model: it still counts (the spell still works), draws nothing', () => {
    const f = new SpikeField(null);
    f.raise(new Vector3(0, 0, 0), { height: 2, width: 0.6, delay: 0, life: 1 });
    f.update(0.1);
    expect(f.mesh).toBeNull();
    expect(f.count).toBe(1);
  });
});

describe('SpikeField.drop (a wall of spikes kicked apart sinks at once)', () => {
  it('only the spikes with that tag start sinking now', () => {
    const f = new SpikeField(rock());
    f.raise(new Vector3(0, 0, 0), { height: 2, width: 0.6, delay: 0, life: 10, tag: 'wall' });
    f.raise(new Vector3(3, 0, 0), { height: 2, width: 0.6, delay: 0, life: 10 });
    f.update(0.5);
    f.drop('wall');
    f.update(0.6);
    expect(f.count).toBe(1);
  });
});

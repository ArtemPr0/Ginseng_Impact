import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { MindBeam } from './MindBeam';

describe('MindBeam (v12: Telekinesis shows — a violet beam from his hand to what he holds, a field round it)', () => {
  it('hidden while nothing is held', () => {
    const b = new MindBeam();
    b.update(0.016, null);
    expect(b.group.visible).toBe(false);
  });
  it('runs from his hand to the hold, with a field round what is held at its size', () => {
    const b = new MindBeam();
    const from = new Vector3(0, 1.5, 0), to = new Vector3(0, 3, 4);
    for (let i = 0; i < 10; i++) b.update(0.05, { from, to, r: 2 });
    expect(b.group.visible).toBe(true);
    const beam = b.group.getObjectByName('mind-beam')!;
    expect(beam.position.distanceTo(new Vector3().addVectors(from, to).multiplyScalar(0.5))).toBeLessThan(1e-6);
    expect(beam.scale.y).toBeCloseTo(from.distanceTo(to), 5);
    const dir = new Vector3(0, 1, 0).applyQuaternion(beam.quaternion);
    expect(dir.dot(new Vector3().subVectors(to, from).normalize())).toBeGreaterThan(0.999);
    const field = b.group.getObjectByName('mind-field')!;
    expect(field.position.distanceTo(to)).toBeLessThan(1e-6);
    expect(field.scale.x).toBeGreaterThan(2);
  });
  it('fades out when he lets go', () => {
    const b = new MindBeam();
    b.update(0.2, { from: new Vector3(), to: new Vector3(0, 0, 3), r: 1 });
    for (let i = 0; i < 10; i++) b.update(0.1, null);
    expect(b.group.visible).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { Blood } from './Blood';

describe('Blood (2026-11-17: red, realistic)', () => {
  it('a spurt flies, falls and stains the ground where it lands', () => {
    const b = new Blood(() => 0);
    b.pulse(new Vector3(0, 1.4, 0), new Vector3(1, 0.4, 0).normalize(), 1);
    expect(b.live).toBeGreaterThan(15);
    for (let i = 0; i < 40; i++) b.update(0.05);
    expect(b.live).toBe(0);
    let stains = 0;
    b.group.traverse((o) => { if (o.visible && (o as { geometry?: { type: string } }).geometry?.type === 'CircleGeometry') stains++; });
    expect(stains).toBeGreaterThan(0);
  });
});

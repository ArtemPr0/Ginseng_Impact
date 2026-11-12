import { describe, expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { BLUNT, blunt } from './Blunt';

describe('the Skeleton Lord\'s blunt (built in code)', () => {
  const b = blunt();
  it('is a real-size rolled blunt along +x: about 11 cm, a finger thick, wider at the lit end', () => {
    const size = new Box3().setFromObject(b.object).getSize(new Vector3());
    expect(size.x).toBeGreaterThan(0.09);
    expect(size.x).toBeLessThan(0.13);
    expect(size.y).toBeLessThan(0.03);
    expect(BLUNT.tipR).toBeGreaterThan(BLUNT.baseR);
  });
  it('has its ember at the far end, where the smoke comes from', () => {
    expect(b.ember.x).toBeCloseTo(BLUNT.length, 6);
  });
});

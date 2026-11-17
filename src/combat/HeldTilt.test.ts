import { describe, expect, it } from 'vitest';
import { Object3D, Vector3 } from 'three';
import { applyHeldTilt } from './Enemy';

describe('applyHeldTilt (review: the swing tilted about the body\'s own turned axis)', () => {
  it('a swing along world x tips the body the same way whichever way it faces', () => {
    for (const yaw of [0, Math.PI / 2, 2.3]) {
      const o = new Object3D();
      o.rotation.y = yaw;
      applyHeldTilt(o.rotation, 0, -0.4);
      o.updateMatrixWorld(true);
      const up = new Vector3(0, 1, 0).applyQuaternion(o.quaternion);
      expect(up.x).toBeGreaterThan(0.3);
      expect(Math.abs(up.z)).toBeLessThan(0.05);
    }
  });
});

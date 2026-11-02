import { describe, expect, it } from 'vitest';
import { REALMS } from '../data/world';
import { AIR } from './Ambience';

describe('AIR', () => {
  it('gives every place its own air, quiet under the music', () => {
    for (const id of ['island', ...REALMS.map((r) => r.id).filter((r) => r !== 'galaxy'), 'galaxy']) {
      expect(AIR[id], id).toBeDefined();
      expect(AIR[id].gain).toBeLessThanOrEqual(0.15);
    }
  });
});

import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { spellMissile } from './SpellMissile';

describe('spellMissile (what flies for a spell)', () => {
  it('a fireball is a burning orb (animated shader), not a flat ball', () => {
    const m = spellMissile('fireball', 0xff6a1a);
    expect(m.object.getObjectByName('fire-orb')).toBeTruthy();
    m.update(0.1, new Vector3(0, 0, 1));
    expect(m.time).toBeCloseTo(0.1);
  });
  it('arrow spells fly as real arrows pointing along their flight, with a glowing head', () => {
    for (const id of ['moonbomb', 'frost-arrow', 'storm-arrow']) {
      const m = spellMissile(id, 0x88ccff);
      expect(m.object.getObjectByName('arrow:stuck')).toBeTruthy();
      m.update(0.016, new Vector3(1, 0, 0));
      // +z of the missile turned onto +x.
      const z = new Vector3(0, 0, 1).applyQuaternion(m.object.quaternion);
      expect(z.x).toBeCloseTo(1, 3);
    }
  });
});

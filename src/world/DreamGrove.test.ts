import { describe, expect, it } from 'vitest';
import { CONTROLLER } from '../player/CharacterController';
import { BOUNCE_V, dreamGrove, EYE } from './DreamGrove';

function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

describe('the dream\'s mushroom grove (where the canal village stood)', () => {
  const g = dreamGrove(seeded(3));
  const all = [...g.chain, ...g.scatter];

  it('is many kinds of mushroom: every model, in many colours', () => {
    expect(new Set(all.map((m) => m.kind)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(all.map((m) => m.tint)).size).toBeGreaterThanOrEqual(4);
    expect(all.length).toBeGreaterThanOrEqual(40);
  });

  it('has a chain of bouncy caps you can hop along, cap to cap, from the ground up', () => {
    const c = g.chain;
    expect(c.length).toBeGreaterThanOrEqual(10);
    for (const m of c) expect(m.bouncy).toBe(true);
    // The first is in reach of an ordinary jump.
    expect(c[0].top).toBeLessThan((CONTROLLER.jumpSpeed ** 2) / (2 * CONTROLLER.gravity) - 0.2);
    const apex = (BOUNCE_V ** 2) / (2 * CONTROLLER.gravity);
    for (let i = 1; i < c.length; i++) {
      const d = Math.hypot(c[i].dx - c[i - 1].dx, c[i].dz - c[i - 1].dz);
      expect(d, `hop ${i}`).toBeLessThanOrEqual(6.5);
      expect(d, `hop ${i}: caps apart`).toBeGreaterThanOrEqual(c[i].r + c[i - 1].r + 0.3);
      expect(c[i].top - c[i - 1].top, `hop ${i}: climb`).toBeLessThan(apex * 0.5);
    }
  });

  it('keeps out of the eye pool, and no two mushrooms stand in each other', () => {
    for (const m of all) expect((m.dx / EYE.rx) ** 2 + (m.dz / EYE.rz) ** 2).toBeGreaterThan(1.15);
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
      expect(Math.hypot(all[i].dx - all[j].dx, all[i].dz - all[j].dz)).toBeGreaterThanOrEqual(all[i].r + all[j].r);
    }
  });
});

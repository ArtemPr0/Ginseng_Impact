import { describe, expect, it } from 'vitest';
import { SPELLS, SpellBook } from './Spells';
import { aimPoint, AIM_RANGE } from './Aim';

describe('SPELLS', () => {
  it('every hero has five spells, each with a name, an icon and its own colour', () => {
    for (const hero of ['knight', 'archer', 'wizard']) {
      const book = SPELLS[hero];
      expect(book).toHaveLength(5);
      for (const s of book) {
        expect(s.name.length).toBeGreaterThan(2);
        expect(s.icon).toMatch(/<(path|circle|polygon|polyline|line|ellipse)/);
        expect(s.cooldown).toBeGreaterThan(s.id === 'telekinesis' ? 1 : 3);
      }
    }
    const all = Object.values(SPELLS).flat();
    expect(new Set(all.map((s) => s.id)).size).toBe(15);
  });
});

describe('SpellBook', () => {
  it('cooldowns are per hero and keep running while the hero is benched', () => {
    const b = new SpellBook();
    expect(b.ready('knight', 0)).toBe(true);
    b.use('knight', 0);
    expect(b.ready('knight', 0)).toBe(false);
    expect(b.ready('archer', 0)).toBe(true);
    b.update(SPELLS.knight[0].cooldown + 0.1);
    expect(b.ready('knight', 0)).toBe(true);
  });
  it('fraction runs from 1 when used to 0 when ready', () => {
    const b = new SpellBook();
    b.use('wizard', 2);
    expect(b.fraction('wizard', 2)).toBeCloseTo(1);
    b.update(SPELLS.wizard[2].cooldown / 2);
    expect(b.fraction('wizard', 2)).toBeCloseTo(0.5, 1);
  });
});

describe('aimPoint', () => {
  const flat = () => 0;
  it('a ray down onto flat ground lands where it meets it', () => {
    const p = aimPoint({ x: 0, y: 10, z: 0 }, { x: 1, y: -1, z: 0 }, flat);
    expect(p.x).toBeCloseTo(10, 0);
    expect(p.y).toBe(0);
  });
  it('a ray at the sky lands on the ground at most AIM_RANGE away', () => {
    const p = aimPoint({ x: 0, y: 2, z: 0 }, { x: 0, y: 0.3, z: 1 }, flat);
    expect(Math.hypot(p.x, p.z)).toBeLessThanOrEqual(AIM_RANGE + 0.01);
    expect(p.z).toBeGreaterThan(AIM_RANGE - 1);
    expect(p.y).toBe(0);
  });
  it('stops at a hill in the way', () => {
    const hill = (x: number) => (x > 6 ? 5 : 0);
    const p = aimPoint({ x: 0, y: 2, z: 0 }, { x: 1, y: -0.05, z: 0 }, hill);
    expect(p.x).toBeGreaterThan(5.5);
    expect(p.x).toBeLessThan(7);
    expect(p.y).toBe(5);
  });
});

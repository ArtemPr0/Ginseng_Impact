import { describe, expect, it } from 'vitest';
import { MAX_LEVEL, Progress, atkMult, hpMult, xpFor, xpForKill } from './Progress';

describe('Progress curve', () => {
  it('starts at 60 and climbs every level', () => {
    expect(xpFor(1)).toBe(60);
    expect(xpFor(2)).toBe(182);
    for (let l = 1; l < MAX_LEVEL; l++) expect(xpFor(l + 1)).toBeGreaterThan(xpFor(l));
    expect(xpFor(MAX_LEVEL)).toBe(Math.round(60 * Math.pow(MAX_LEVEL, 1.6)));
  });

  it('pays a 25th of the HP for a kill and 400 more for a boss', () => {
    expect(xpForKill({ maxHp: 1000 })).toBe(40);
    expect(xpForKill({ maxHp: 1000, boss: false })).toBe(40);
    expect(xpForKill({ maxHp: 12000, boss: true })).toBe(880);
    expect(xpForKill({ maxHp: 30 })).toBe(1);
  });

  it('scales attack 3% and HP 4% a level, clamped to the cap', () => {
    expect(atkMult(1)).toBe(1);
    expect(hpMult(1)).toBe(1);
    expect(atkMult(11)).toBeCloseTo(1.3);
    expect(hpMult(11)).toBeCloseTo(1.4);
    expect(atkMult(MAX_LEVEL)).toBeCloseTo(1.87);
    expect(hpMult(MAX_LEVEL)).toBeCloseTo(2.16);
    expect(atkMult(99)).toBeCloseTo(atkMult(MAX_LEVEL));
    expect(hpMult(0)).toBe(1);
    expect(atkMult(Number.NaN)).toBe(1);
  });
});

describe('Progress', () => {
  it('returns the levels gained and carries the remainder over', () => {
    const p = new Progress();
    expect(p.level).toBe(1);
    expect(p.toNext()).toBe(60);
    expect(p.add(59)).toBe(0);
    expect(p.level).toBe(1);
    expect(p.toNext()).toBe(1);
    expect(p.add(1)).toBe(1);
    expect(p.level).toBe(2);
    expect(p.xp).toBe(0);
    expect(p.add(xpFor(2) + xpFor(3) + 5)).toBe(2);
    expect(p.level).toBe(4);
    expect(p.xp).toBe(5);
    expect(p.toNext()).toBe(xpFor(4) - 5);
  });

  it('ignores nothing and nonsense', () => {
    const p = new Progress();
    expect(p.add(0)).toBe(0);
    expect(p.add(-50)).toBe(0);
    expect(p.add(Number.NaN)).toBe(0);
    expect(p.xp).toBe(0);
  });

  it('caps at the max level', () => {
    const p = new Progress();
    expect(p.add(1e9)).toBe(MAX_LEVEL - 1);
    expect(p.level).toBe(MAX_LEVEL);
    expect(p.xp).toBe(0);
    expect(p.toNext()).toBe(0);
    expect(p.add(500)).toBe(0);
    expect(p.level).toBe(MAX_LEVEL);
  });

  it('round-trips a snapshot and clamps a bad one', () => {
    const p = new Progress();
    p.add(xpFor(1) + 17);
    const s = p.snapshot();
    expect(s).toEqual({ xp: 17, level: 2 });
    const q = new Progress();
    q.restore(JSON.parse(JSON.stringify(s)));
    expect(q.snapshot()).toEqual(s);
    expect(q.toNext()).toBe(p.toNext());
    q.restore({ xp: 1e9, level: 99 });
    expect(q.level).toBe(MAX_LEVEL);
    expect(q.xp).toBe(0);
    q.restore({ xp: -5, level: 0 });
    expect(q.level).toBe(1);
    expect(q.xp).toBe(0);
    // Experience past the level's bar is held just under it (the next kill levels you).
    q.restore({ xp: 999, level: 3 });
    expect(q.level).toBe(3);
    expect(q.xp).toBe(xpFor(3) - 1);
    expect(q.add(1)).toBe(1);
  });
});

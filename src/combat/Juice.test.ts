import { describe, expect, it } from 'vitest';
import { BONK, LUNGE_STOP, bonkWord, leapGravity, leapVelocity, lungeReach, slowMoScale, spinAngle, squash } from './Juice';

// The playtest of 2026-11-14: "fighting style and animations are boring… make them cool, unique, addictive to watch,
// funny, entertaining… not realistic". Cartoon rules: bodies squash on a hit and spring back, blows shout their sound,
// the hero lunges into a swing, spins on the finisher, leaps into the heavy, and a boss dies in slow motion.
describe('squash and stretch', () => {
  it('squashes a body flat on the hit, wider as it flattens', () => {
    const s = squash(0, 1);
    expect(s.y).toBeLessThan(0.8);
    expect(s.xz).toBeGreaterThan(1.1);
    // (About the same volume: a cartoon squash, not a shrink.)
    expect(s.y * s.xz * s.xz).toBeCloseTo(1, 1);
  });

  it('springs back past upright, then settles', () => {
    let over = 0;
    for (let t = 0.02; t < 0.3; t += 0.01) over = Math.max(over, squash(t, 1).y);
    expect(over).toBeGreaterThan(1.04);
    const late = squash(0.6, 1);
    expect(Math.abs(late.y - 1)).toBeLessThan(0.005);
    expect(Math.abs(late.xz - 1)).toBeLessThan(0.005);
  });

  it('a light hit squashes less than a big one; none at all is still', () => {
    expect(squash(0, 0.3).y).toBeGreaterThan(squash(0, 1).y);
    expect(squash(0, 0)).toEqual({ y: 1, xz: 1 });
  });
});

describe('comic words', () => {
  it('each weapon shouts its own sounds', () => {
    const all = (w: keyof typeof BONK) => [...BONK[w].light, ...BONK[w].finisher, ...BONK[w].heavy];
    const blade = new Set(all('greatsword'));
    for (const w of ['bow', 'staff'] as const) for (const word of all(w)) expect(blade.has(word), word).toBe(false);
    for (const word of all('bow')) expect(all('staff')).not.toContain(word);
  });

  it('cycles through the words, the finisher and the heavy louder than a light hit', () => {
    const seen = new Set([0, 1, 2, 3].map((n) => bonkWord('greatsword', 0, n)));
    expect(seen.size).toBeGreaterThan(2);
    expect(BONK.greatsword.finisher).toContain(bonkWord('greatsword', 2, 0));
    expect(BONK.greatsword.heavy).toContain(bonkWord('greatsword', 'heavy', 5));
    expect(bonkWord('bow', 1, 7)).toBe(bonkWord('bow', 1, 7));
    for (const w of Object.values(BONK)) for (const word of [...w.light, ...w.finisher, ...w.heavy]) expect(word).toBe(word.toUpperCase());
  });
});

describe('the lunge', () => {
  it('steps the whole way with no one close, and stops short of a body in reach', () => {
    expect(lungeReach(Infinity, 1.4)).toBe(1.4);
    expect(lungeReach(10, 1.4)).toBe(1.4);
    expect(lungeReach(1.2, 1.4)).toBeCloseTo(1.2 - LUNGE_STOP);
    expect(lungeReach(0.3, 1.4)).toBe(0);
  });
});

describe('the leap', () => {
  it('lands after the air time asked for, the distance asked for away', () => {
    const g = 26, fall = 1.55, T = 0.5, dist = 3;
    const v = leapVelocity(T, dist, g, fall);
    let y = 0, x = 0, vy = v.vy, t = 0;
    const dt = 1 / 600;
    do { vy -= g * (vy < 0 ? fall : 1) * dt; y += vy * dt; x += v.vh * dt; t += dt; } while (y > 0 && t < 2);
    expect(t).toBeCloseTo(T, 1);
    expect(x).toBeCloseTo(dist, 0);
    expect(v.vy).toBeGreaterThan(3);
  });
});

describe('the leap, cartoon-high', () => {
  it('a short leap gets heavier gravity, so it still peaks high and lands on time', () => {
    const g = 26, fall = 1.55, T = 0.35;
    const k = leapGravity(T, 1.6, g, fall);
    expect(k).toBeGreaterThan(1);
    const v = leapVelocity(T, 2, g * k, fall);
    let y = 0, top = 0, vy = v.vy, t = 0;
    const dt = 1 / 600;
    do { vy -= g * k * (vy < 0 ? fall : 1) * dt; y += vy * dt; top = Math.max(top, y); t += dt; } while (y > 0 && t < 2);
    expect(top).toBeGreaterThan(1.5);
    expect(t).toBeCloseTo(T, 1);
  });

  it('a long leap keeps the world\'s own gravity', () => {
    expect(leapGravity(1.2, 1.6, 26, 1.55)).toBe(1);
  });
});

describe('the spin finisher', () => {
  it('turns once round over the swing, eased, starting and ending square', () => {
    expect(spinAngle(0)).toBe(0);
    expect(spinAngle(1)).toBeCloseTo(Math.PI * 2);
    let prev = 0;
    for (let p = 0; p <= 1; p += 0.05) { const a = spinAngle(p); expect(a).toBeGreaterThanOrEqual(prev - 1e-9); prev = a; }
    expect(spinAngle(0.5)).toBeGreaterThan(Math.PI * 0.6);
  });
});

describe('boss-kill slow motion', () => {
  it('slows the world to a crawl, then eases it back', () => {
    expect(slowMoScale(0)).toBe(1);
    expect(slowMoScale(1.2)).toBeLessThan(0.4);
    expect(slowMoScale(0.2)).toBeGreaterThan(slowMoScale(1.2));
    expect(slowMoScale(0.2)).toBeLessThan(1);
  });
});

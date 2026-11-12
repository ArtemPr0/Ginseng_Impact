import { describe, expect, it } from 'vitest';
import { COMBO_TIERS, Hype, isOverkill, TITLES, Titles, CoinStreak } from './Hype';

describe('Hype: combo callouts', () => {
  it('calls out each combo tier once, as the streak reaches it', () => {
    const h = new Hype(() => 0);
    const calls: string[] = [];
    for (let n = 1; n <= 12; n++) { const c = h.hit(n); if (c) calls.push(c.text); }
    expect(calls).toEqual([COMBO_TIERS[0].text, COMBO_TIERS[1].text]);
  });

  it('starts over when the streak drops', () => {
    const h = new Hype(() => 0);
    for (let n = 1; n <= 5; n++) h.hit(n);
    expect(h.hit(1)).toBeNull();
    for (let n = 2; n <= 4; n++) h.hit(n);
    expect(h.hit(5)?.text).toBe(COMBO_TIERS[0].text);
  });

  it('raises the tier with the combo', () => {
    const h = new Hype(() => 0);
    const tiers: number[] = [];
    for (let n = 1; n <= 100; n++) { const c = h.hit(n); if (c) tiers.push(c.tier); }
    expect(tiers).toEqual([...tiers].sort((a, b) => a - b));
    expect(tiers.length).toBe(COMBO_TIERS.length);
  });
});

describe('Hype: multi-kills', () => {
  it('names two, three and more kills close together', () => {
    const h = new Hype(() => 0);
    expect(h.kill(10)).toBeNull();
    expect(h.kill(10.5)?.text).toMatch(/double/i);
    expect(h.kill(11.2)?.text).toMatch(/triple/i);
    const four = h.kill(12);
    expect(four?.tier).toBeGreaterThan(2);
  });

  it('lets the chain lapse after a pause', () => {
    const h = new Hype(() => 0);
    h.kill(10); h.kill(10.5);
    expect(h.kill(14)).toBeNull();
  });
});

describe('isOverkill', () => {
  // (Measured at level 1 against a 650-HP beast: light hits 47-76, heavies 199-252, skills up to 303.)
  it('is a big blow (30 % of the body\'s whole health) that is also twice what it had left', () => {
    expect(isOverkill(227, 100, 650)).toBe(true); // a heavy finishing a worn-down beast
    expect(isOverkill(303, 150, 650)).toBe(true); // a skill
    expect(isOverkill(76, 20, 650)).toBe(false); // a light tap on a sliver: an ordinary finish
    expect(isOverkill(300, 200, 650)).toBe(false); // big, but only just enough
    expect(isOverkill(50, 0, 650)).toBe(false); // already dead
    expect(isOverkill(50, 100, 650)).toBe(false); // not even a kill
  });
});

describe('Titles', () => {
  it('awards each title once, on the event that earns it', () => {
    const t = new Titles();
    expect(t.on({ kind: 'kill', enemy: 'skeleton', boss: false, at: { x: 0, y: 0, z: 0 } })?.id).toBe('first-blood');
    expect(t.on({ kind: 'kill', enemy: 'skeleton', boss: false, at: { x: 0, y: 0, z: 0 } })).toBeNull();
    expect(t.on({ kind: 'wipe' })?.id).toBe('skill-issue');
    expect(t.on({ kind: 'wipe' })).toBeNull();
  });

  it('counts toward the ones that need many', () => {
    const t = new Titles();
    const won: string[] = [];
    for (let i = 0; i < 50; i++) { const w = t.on({ kind: 'kill', enemy: 'beast', boss: false, at: { x: 0, y: 0, z: 0 } }); if (w) won.push(w.id); }
    expect(won).toEqual(['first-blood', 'pest-control', 'hr-concerns']);
  });

  it('remembers what was earned across a save', () => {
    const t = new Titles();
    t.on({ kind: 'wipe' });
    const u = new Titles(t.snapshot());
    expect(u.on({ kind: 'wipe' })).toBeNull();
    expect(u.earned()).toContain('skill-issue');
  });

  it('keeps its progress across a save: forty kills, a reload, ten more earns the fifty', () => {
    const k = { kind: 'kill', enemy: 'beast', boss: false, at: { x: 0, y: 0, z: 0 } } as const;
    const t = new Titles();
    for (let i = 0; i < 40; i++) t.on(k);
    const u = new Titles(t.snapshot(), t.progress());
    const won: string[] = [];
    for (let i = 0; i < 10; i++) { const w = u.on(k); if (w) won.push(w.id); }
    expect(won).toEqual(['hr-concerns']);
  });

  it('gives "Level ten" on reaching level ten, whenever the levels were gained', () => {
    const t = new Titles();
    expect(t.on({ kind: 'feat', what: 'levelup', level: 9 })).toBeNull();
    expect(t.on({ kind: 'feat', what: 'levelup', level: 10 })?.id).toBe('overleveled');
    const u = new Titles();
    for (let level = 2; level < 10; level++) expect(u.on({ kind: 'feat', what: 'levelup', level })?.id).not.toBe('overleveled'); // nine level-ups, still below ten
  });

  it('keeps every title short and gives it a quip', () => {
    for (const d of TITLES) {
      expect(d.title.length).toBeLessThanOrEqual(26);
      expect(d.quip.length).toBeGreaterThan(0);
      expect(d.quip.length).toBeLessThanOrEqual(70);
    }
    expect(new Set(TITLES.map((d) => d.id)).size).toBe(TITLES.length);
  });
});

describe('the coin streak', () => {
  it('climbs a step with each coin picked up close behind the last, up to an octave, and starts over after a pause', () => {
    const s = new CoinStreak();
    expect([0, 0.3, 0.6, 0.9].map((t) => s.hit(t))).toEqual([0, 1, 2, 3]);
    expect(s.hit(3)).toBe(0);
    let last = 0;
    for (let i = 1; i < 30; i++) last = s.hit(3 + i * 0.1);
    expect(last).toBe(12);
  });
});

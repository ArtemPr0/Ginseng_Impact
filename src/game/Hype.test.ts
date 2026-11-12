import { describe, expect, it } from 'vitest';
import { COMBO_TIERS, Hype, isOverkill, TITLES, Titles } from './Hype';

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
  it('is a blow of three times what the body had left, or more', () => {
    expect(isOverkill(300, 100)).toBe(true);
    expect(isOverkill(299, 100)).toBe(false);
    expect(isOverkill(50, 0)).toBe(false);
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

  it('keeps every title short and gives it a quip', () => {
    for (const d of TITLES) {
      expect(d.title.length).toBeLessThanOrEqual(26);
      expect(d.quip.length).toBeGreaterThan(0);
      expect(d.quip.length).toBeLessThanOrEqual(70);
    }
    expect(new Set(TITLES.map((d) => d.id)).size).toBe(TITLES.length);
  });
});

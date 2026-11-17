import { describe, expect, it } from 'vitest';
import { AIM_WALK, BAR, barActs, barPage, chargeMove, barKey, heroKey, LmbGesture, SpellBar, spellPress } from './SpellBar';
import { SPELLS } from './Spells';

describe('BAR (the user calls of 2026-11-16: keys 1-7 pick, right click casts)', () => {
  it('every hero has seven slots in the order the user approved', () => {
    expect(BAR.knight.slice(0, 7).map((s) => s.name)).toEqual(['Crimson Cleave', 'Lean Cyclone', 'Earthsplitter', 'Wrecking Charge', 'Chain Hook', 'Blood Moon', 'Stone Wall']);
    expect(BAR.archer.slice(0, 7).map((s) => s.name)).toEqual(['Moon Volley', 'Trip Volley', 'Moonbomb Arrow', 'Frost Arrow', 'Storm Arrow', 'Gale Shot', 'Storm Tornado']);
    expect(BAR.wizard.slice(0, 7).map((s) => s.name)).toEqual(['Starfall', 'Pipe Dream', 'Fireball', 'Black Hole', 'Fire Tornado', 'Overgrowth', 'Telekinesis']);
  });
  it('slot 1 is the skill, slot 2 the burst, the rest the spell book in order', () => {
    for (const hero of ['knight', 'archer', 'wizard']) {
      expect(BAR[hero][0].action).toEqual({ kind: 'skill' });
      expect(BAR[hero][1].action).toEqual({ kind: 'burst' });
      for (let i = 2; i < 7; i++) expect(BAR[hero][i].action).toEqual({ kind: 'spell', slot: i - 2 });
      // Page 2 (Shift+1-7): the reel moves, slots 7-13.
      expect(BAR[hero]).toHaveLength(14);
      for (let k = 0; k < 7; k++) expect(BAR[hero][7 + k].action).toEqual({ kind: 'spell', slot: 5 + k });
      expect(SPELLS[hero]).toHaveLength(12);
    }
  });
  it('only telekinesis is held; every slot has an icon and a colour', () => {
    const held = Object.values(BAR).flat().filter((s) => s.hold).map((s) => s.name);
    expect(held).toEqual(['Telekinesis']);
    for (const s of Object.values(BAR).flat()) {
      expect(s.icon).toMatch(/<(path|circle|polygon|polyline|line|ellipse|rect)/);
      expect(s.color).toBeGreaterThan(0);
    }
  });
});

describe('keys', () => {
  it('Digit1-7 pick slots 0-6, nothing else does', () => {
    expect(['Digit1', 'Digit4', 'Digit7'].map((c) => barKey(c))).toEqual([0, 3, 6]);
    expect(barKey('Digit8')).toBeNull();
    expect(barKey('KeyZ')).toBeNull();
  });
  it('Shift+1-7 pick the second page (slots 7-13); page() tells which page a slot is on', () => {
    expect(['Digit1', 'Digit7'].map((c) => barKey(c, true))).toEqual([7, 13]);
    expect(barKey('Digit3', false)).toBe(2);
    expect(barPage(3)).toBe(0);
    expect(barPage(9)).toBe(1);
  });
  it('F1-F3 switch hero', () => {
    expect(['F1', 'F2', 'F3'].map(heroKey)).toEqual([0, 1, 2]);
    expect(heroKey('F4')).toBeNull();
    expect(heroKey('Digit1')).toBeNull();
  });
});

describe('SpellBar', () => {
  it('remembers a pick per hero; starts on the first real spell', () => {
    const b = new SpellBar();
    expect(b.selected('wizard')).toBe(2);
    b.select('wizard', 6);
    b.select('knight', 0);
    expect(b.selected('wizard')).toBe(6);
    expect(b.selected('knight')).toBe(0);
    expect(b.current('wizard').name).toBe('Telekinesis');
  });
  it('ignores slots off the bar', () => {
    const b = new SpellBar();
    b.select('archer', 14);
    expect(b.selected('archer')).toBe(2);
  });
});

describe('LmbGesture (tap = combo, hold = charged heavy)', () => {
  it('a press swings at once; a short release is not a heavy', () => {
    const g = new LmbGesture();
    let o = g.update(0.016, true);
    expect(o.attack).toBe(true);
    expect(o.heavyHeld).toBe(false);
    o = g.update(0.1, true);
    expect(o.attack).toBe(false);
    o = g.update(0.016, false);
    expect(o.heavyRelease).toBe(false);
  });
  it('held past the threshold charges a heavy, and letting go releases it', () => {
    const g = new LmbGesture();
    g.update(0.016, true);
    let o = g.update(0.2, true);
    expect(o.heavyHeld).toBe(false);
    o = g.update(0.2, true);
    expect(o.heavyHeld).toBe(true);
    o = g.update(0.016, false);
    expect(o.heavyRelease).toBe(true);
    expect(o.heavyHeld).toBe(false);
    o = g.update(0.016, false);
    expect(o.heavyRelease).toBe(false);
  });
});

describe('spellPress (a press on a spell slot)', () => {
  it('casts when ready; with his Stone Wall standing, pressing it again kicks the wall, cooldown or not', () => {
    expect(spellPress('fireball', true, false)).toBe('cast');
    expect(spellPress('fireball', false, false)).toBe('none');
    expect(spellPress('stone-wall', false, true)).toBe('kick');
    expect(spellPress('stone-wall', true, true)).toBe('kick');
    expect(spellPress('stone-wall', true, false)).toBe('cast');
  });
});

describe('barActs', () => {
  it('casts only on a buffered right click; the aim reaches as far as the picked slot meanwhile', () => {
    // Slot 3 picked, no right click: nothing is cast (it was cast every frame it was ready, 2026-11-16).
    const idle = barActs('knight', null, 2);
    expect(idle.cast).toBeUndefined();
    expect(idle.aim).toEqual(BAR.knight[2].action);
    // A right click buffered on slot 3 casts it.
    const click = barActs('knight', 2, 2);
    expect(click.cast).toEqual(BAR.knight[2].action);
    // A buffered cast wins over a slot picked since.
    expect(barActs('knight', 2, 4).cast).toEqual(BAR.knight[2].action);
    expect(barActs('knight', 2, 4).aim).toEqual(BAR.knight[2].action);
  });
});

describe('spellPress and the wall model', () => {
  it('Stone Wall is not cast (nor its cooldown spent) while its stone model loads', () => {
    expect(spellPress('stone-wall', true, false, false)).toBe('none');
    expect(spellPress('stone-wall', true, false, true)).toBe('cast');
    expect(spellPress('fireball', true, false, false)).toBe('cast');
  });
});

describe('chargeMove', () => {
  it('Wren walks slowly with her bow drawn; the others stand to wind up', () => {
    expect(chargeMove('archer', true)).toBe(AIM_WALK);
    expect(AIM_WALK).toBeGreaterThan(0.2);
    expect(AIM_WALK).toBeLessThan(0.6);
    expect(chargeMove('knight', true)).toBe(0);
    expect(chargeMove('wizard', true)).toBe(0);
    expect(chargeMove('knight', false)).toBe(1);
  });
});

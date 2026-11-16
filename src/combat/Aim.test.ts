import { describe, expect, it } from 'vitest';
import { AimHold, aimShape } from './Aim';

describe('AimHold (hold a spell key to aim, release to cast)', () => {
  it('holding shows the aim; releasing casts that spell once', () => {
    const a = new AimHold();
    a.press(1);
    expect(a.slot).toBe(1);
    expect(a.update(0.5, true, false)).toBeNull();
    expect(a.aiming).toBe(true);
    expect(a.update(0.02, false, false)).toBe(1);
    expect(a.aiming).toBe(false);
    expect(a.update(0.02, false, false)).toBeNull();
  });

  it('a quick tap casts too, on release', () => {
    const a = new AimHold();
    a.press(0);
    expect(a.update(0.05, false, false)).toBe(0);
  });

  it('right mouse or Escape while aiming cancels: nothing is cast', () => {
    const a = new AimHold();
    a.press(2);
    a.update(0.3, true, false);
    expect(a.update(0.02, true, true)).toBeNull();
    expect(a.aiming).toBe(false);
    expect(a.update(0.02, false, false)).toBeNull();
  });

  it('a second key while aiming is ignored (the first spell is still being aimed)', () => {
    const a = new AimHold();
    a.press(0);
    a.press(3);
    expect(a.slot).toBe(0);
  });
});

describe('aimShape: what the preview draws for each spell', () => {
  it('an area spell a ring of its radius; the charge and the tornado a lane; the gale a cone; the blood moon nothing', () => {
    expect(aimShape('fireball', 4.5)).toEqual({ kind: 'ring', radius: 4.5 });
    expect(aimShape('wrecking-charge', 2.4)).toEqual({ kind: 'lane', length: 12, width: 4.8 });
    expect(aimShape('fire-tornado', 3).kind).toBe('lane');
    expect(aimShape('gale-shot', 9)).toEqual({ kind: 'cone', radius: 9, angle: expect.any(Number) });
    expect(aimShape('blood-moon', 0)).toEqual({ kind: 'none' });
  });
});

describe('spellRange (review 2026-11-16: the ring shows where the spell lands)', () => {
  it('Earthsplitter leaps at most LEAP_RANGE; the rest reach AIM_RANGE', async () => {
    const { spellRange, AIM_RANGE, LEAP_RANGE } = await import('./Aim');
    expect(LEAP_RANGE).toBe(12);
    expect(spellRange('earthsplitter')).toBe(LEAP_RANGE);
    expect(spellRange('fireball')).toBe(AIM_RANGE);
  });
});

describe('after a cancel or a release (review 2026-11-16)', () => {
  it('a right-click cancel does not turn into a heavy: right mouse counts again only once it is let go', () => {
    const a = new AimHold();
    expect(a.heavyOk(true)).toBe(true);
    a.press(1);
    a.update(0.1, true, true);
    expect(a.heavyOk(true)).toBe(false);
    expect(a.heavyOk(true)).toBe(false);
    expect(a.heavyOk(false)).toBe(true);
    expect(a.heavyOk(true)).toBe(true);
  });

  it('a spell released mid-swing waits up to 0.6 s for the hero to be free, then is dropped', async () => {
    const { SpellBuffer } = await import('./Aim');
    const b = new SpellBuffer();
    b.push(2);
    expect(b.peek(0.2)).toBe(2);
    expect(b.peek(0.2)).toBe(2);
    b.done();
    expect(b.peek(0.1)).toBeNull();
    b.push(3);
    expect(b.peek(0.5)).toBe(3);
    expect(b.peek(0.2)).toBeNull();
  });
});

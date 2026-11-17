import { describe, expect, it } from 'vitest';
import { MushroomRise, RISE } from './MushroomRise';

/** Wren standing on what grows under her (the controller does this through the collider). */
function run(m: MushroomRise, seconds: number, held: boolean, me: { x: number; y: number; z: number }) {
  for (let t = 0; t < seconds; t += 1 / 60) {
    m.update(1 / 60, held, me, () => 0);
    let g = 0;
    for (const s of m.shrooms) if (Math.hypot(me.x - s.x, me.z - s.z) < RISE.r) g = Math.max(g, s.collider.top);
    me.y = Math.max(me.y, g);
  }
}

describe('Wren rises on mushrooms while Space is held (playtest 2026-11-17)', () => {
  it('holding: a mushroom grows under her every beat, each a tier higher, up to the cap', () => {
    const m = new MushroomRise();
    const me = { x: 0, y: 0, z: 0 };
    run(m, 4, true, me);
    expect(m.shrooms.length).toBe(RISE.max);
    expect(me.y).toBeCloseTo(RISE.max * RISE.tier, 1);
  });
  it('a tap does nothing (that is her jump)', () => {
    const m = new MushroomRise();
    run(m, 0.1, true, { x: 0, y: 0, z: 0 });
    run(m, 1, false, { x: 0, y: 0, z: 0 });
    expect(m.shrooms.length).toBe(0);
  });
  it('they are solid while they stand, and leave (collider and all) when their time is up', () => {
    const m = new MushroomRise();
    const added: unknown[] = [];
    m.onAdd = (f) => added.push(f);
    m.onRemove = (f) => added.splice(added.indexOf(f), 1);
    const me = { x: 0, y: 0, z: 0 };
    run(m, 1, true, me);
    expect(added.length).toBe(m.shrooms.length);
    expect(added.length).toBeGreaterThan(0);
    run(m, RISE.life + 2, false, me);
    expect(m.shrooms.length).toBe(0);
    expect(added.length).toBe(0);
  });
  it('letting go and holding again on top does not climb past the cap', () => {
    const m = new MushroomRise();
    const me = { x: 0, y: 0, z: 0 };
    run(m, 4, true, me);
    run(m, 0.5, false, me);
    const n = m.shrooms.length;
    run(m, 1, true, me);
    expect(m.shrooms.length).toBe(n);
  });
});

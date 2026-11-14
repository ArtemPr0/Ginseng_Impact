import { describe, expect, it } from 'vitest';
import { ENEMY_DEFS } from '../data/enemies';
import { MODELS } from '../data/models';
import { throwBurst, throwScale, throwTrail, type FxLike } from './Throws';

// The playtest of 2026-11-14: "replace that big white circle with fireballs or something", "make them fun like the npcs
// that throw lean cups", "not just some white cube or circle". Every boss that shot bolts or lobbed the boulder (a 10 m
// pale glow) throws a thing of its own place instead: flaming boulders, witchfire skulls, poison bottles, koi, lily pads.
const throwers = Object.values(ENEMY_DEFS).filter((d) => d.attacks?.some((a) => a.kind === 'volley' || a.kind === 'boulder'));

function fakeFx() {
  const calls: Array<{ fn: string; color?: number; size?: number; n?: number }> = [];
  const fx: FxLike = {
    sparks: (_at, _dir, n, color) => { calls.push({ fn: 'sparks', n, color: Number(color) }); },
    flash: (_at, color, size) => { calls.push({ fn: 'flash', color: Number(color), size }); },
    shock: (_at, color, radius) => { calls.push({ fn: 'shock', color: Number(color), size: radius }); },
    dust: (_at, size) => { calls.push({ fn: 'dust', size }); },
  };
  return { fx, calls };
}
const at = { x: 0, y: 0, z: 0 } as never;

describe('what the bosses throw', () => {
  it('every boss that shot bolts or lobbed the boulder throws a model of its own, sized like a real thing', () => {
    expect(throwers.length).toBeGreaterThan(8);
    for (const d of throwers) {
      expect(d.throws, d.kind).toBeDefined();
      expect(MODELS[d.throws!.model], `${d.kind}: ${d.throws!.model}`).toBeDefined();
      expect(d.throws!.size, d.kind).toBeGreaterThanOrEqual(0.5);
      expect(d.throws!.size, d.kind).toBeLessThanOrEqual(2.6);
      expect(throwScale(d.throws!) * MODELS[d.throws!.model].height).toBeCloseTo(d.throws!.size, 6);
    }
  });

  it('the boulder throwers hurl burning rocks or ice, not a pale glow', () => {
    for (const d of throwers.filter((x) => x.attacks!.some((a) => a.kind === 'boulder'))) {
      if (d.throws!.trail === 'fire') expect(d.throws!.model, d.kind).toBe('boulder');
      else expect(d.throws, d.kind).toMatchObject({ model: 'purple-crystal', trail: 'frost' });
    }
    // (The yeti's rock, frosted, stayed a dark rock in the murk: he throws a chunk of ice.)
    expect(ENEMY_DEFS.yeti.throws!.model).toBe('purple-crystal');
  });

  it('the grave witch throws poison that pools, the river things throw fish and lily pads that splash', () => {
    expect(ENEMY_DEFS['grave-witch'].throws).toMatchObject({ model: 'potion-bottle', burst: 'poison' });
    expect(ENEMY_DEFS.rivershade.throws).toMatchObject({ model: 'koi', burst: 'splash', spin: 'flop' });
    expect(ENEMY_DEFS.lurker.throws).toMatchObject({ model: 'lily-pad', burst: 'splash', spin: 'frisbee' });
    expect(ENEMY_DEFS.necromancer.throws).toMatchObject({ model: 'giant-skull', trail: 'witchfire' });
  });
});

describe('a throw in flight and where it lands', () => {
  it('leaves a trail of its own colour as it flies, a few motes a beat, never a flood', () => {
    const { fx, calls } = fakeFx();
    let acc = 0;
    for (let i = 0; i < 60; i++) acc = throwTrail(fx, { model: 'boulder', size: 1.8, trail: 'fire', burst: 'crater', spin: 'tumble' }, at, at, 1 / 60, acc);
    const motes = calls.filter((c) => c.fn === 'sparks').reduce((n, c) => n + (c.n ?? 0), 0);
    expect(motes).toBeGreaterThan(10);
    expect(motes).toBeLessThan(120);
    expect(calls.every((c) => c.color !== 0xffffff)).toBe(true);
  });

  it('bursts in its own way: a flaming boulder craters and shakes, a bottle pools poison, nothing flashes a huge white disc', () => {
    const crater = fakeFx();
    const r = throwBurst(crater.fx, { model: 'boulder', size: 1.8, trail: 'fire', burst: 'crater', spin: 'tumble' }, at);
    expect(r.shake).toBeGreaterThanOrEqual(0.5);
    expect(crater.calls.some((c) => c.fn === 'shock')).toBe(true);
    const bottle = fakeFx();
    expect(throwBurst(bottle.fx, { model: 'potion-bottle', size: 0.6, trail: 'poison', burst: 'poison', spin: 'tumble' }, at).puddle).toBe('poison');
    for (const burst of ['crater', 'witchfire', 'splash', 'poison', 'frost', 'shatter'] as const) {
      const { fx, calls } = fakeFx();
      throwBurst(fx, { model: 'boulder', size: 1.8, trail: 'fire', burst, spin: 'tumble' }, at);
      for (const c of calls.filter((x) => x.fn === 'flash')) expect((c.size ?? 0) <= 3 || c.color !== 0xffffff, burst).toBe(true);
    }
  });
});

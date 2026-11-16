import { describe, expect, it } from 'vitest';
import { Heightfield, LAYER, type Sculpt } from '../render/Ground';
import { Craters, craterProfile, HEAL_S, MAX_DEPTH } from './Craters';

const flat = (): Sculpt => ({
  x0: -20, z0: -20, size: 40, cell: 1,
  height: () => 2,
  layers: (_x, _z, _h, _s, out) => { out[LAYER.grass] = 1; },
});

function setup(canDig = () => true) {
  const field = new Heightfield(flat());
  field.bake();
  const refreshed: Array<Array<number | boolean>> = [];
  const c = new Craters(field, { refresh: (...b) => refreshed.push(b), canDig });
  return { field, c, refreshed };
}

describe('craterProfile', () => {
  it('is a bowl, deepest in the middle, with a raised rim, and flat beyond it', () => {
    expect(craterProfile(0, 4, 1)).toBeCloseTo(-1);
    expect(craterProfile(2, 4, 1)).toBeLessThan(0);
    expect(craterProfile(2, 4, 1)).toBeGreaterThan(-1);
    expect(craterProfile(4.6, 4, 1)).toBeGreaterThan(0);
    expect(craterProfile(7, 4, 1)).toBe(0);
  });
});

describe('Craters', () => {
  it('digs the ground at once, where heightAt reads it, and redraws the chunks there', () => {
    const { field, c, refreshed } = setup();
    expect(c.crater(0, 0, 4, 1)).toBe(true);
    expect(field.heightAt(0, 0)).toBeCloseTo(1, 1);
    expect(field.heightAt(15, 15)).toBeCloseTo(2);
    expect(refreshed.length).toBe(1);
  });

  it('never deeper than MAX_DEPTH, and its sides stay walkable', () => {
    const { field, c } = setup();
    c.crater(0, 0, 3, 5);
    expect(field.heightAt(0, 0)).toBeGreaterThanOrEqual(2 - MAX_DEPTH - 1e-3);
    let steepest = 0;
    for (let x = -6; x < 6; x += 0.5) steepest = Math.max(steepest, field.slopeAt(x, 0.3));
    expect(steepest).toBeLessThan(0.55);
  });

  it('only scorches where it may not dig (under a building, on water)', () => {
    const { field, c } = setup(() => false);
    expect(c.crater(0, 0, 4, 1)).toBe(false);
    expect(field.heightAt(0, 0)).toBeCloseTo(2);
    const i = field.indexOf(20, 20);
    expect(field.tints[i * 3]).toBeLessThan(0.05);
  });

  it('burns the ground dark and freezes it pale', () => {
    const { field, c } = setup();
    const i = field.indexOf(20, 20);
    c.scorch(0, 0, 3, 'burnt');
    expect(field.layers[i * 12 + LAYER.dead]).toBeGreaterThan(150);
    const j = field.indexOf(30, 30);
    c.scorch(10, 10, 3, 'frozen');
    expect(field.layers[j * 12 + LAYER.snow]).toBeGreaterThan(150);
    expect(field.tints[j * 3 + 2]).toBeGreaterThan(0.4);
  });

  it('heals back to exactly what it was', () => {
    const { field, c } = setup();
    const i = field.indexOf(20, 20);
    const t0 = [...field.tints.slice(i * 3, i * 3 + 3)];
    const l0 = [...field.layers.slice(i * 12, i * 12 + 12)];
    c.crater(0, 0, 4, 1);
    c.scorch(0, 0, 4, 'burnt');
    c.update(HEAL_S * 0.5);
    expect(field.heightAt(0, 0)).toBeGreaterThan(1);
    expect(field.heightAt(0, 0)).toBeLessThan(2);
    c.update(HEAL_S);
    expect(field.heightAt(0, 0)).toBe(2);
    expect([...field.tints.slice(i * 3, i * 3 + 3)]).toEqual(t0);
    expect([...field.layers.slice(i * 12, i * 12 + 12)]).toEqual(l0);
    expect(c.healing).toBe(0);
  });

  it('a second crater on the first digs deeper, still within MAX_DEPTH', () => {
    const { field, c } = setup();
    c.crater(0, 0, 4, 0.8);
    c.crater(0, 0, 4, 0.8);
    expect(field.heightAt(0, 0)).toBeLessThan(1.3);
    expect(field.heightAt(0, 0)).toBeGreaterThanOrEqual(2 - MAX_DEPTH - 1e-3);
  });

  it('bombed again and again a hole goes down to 3 m and widens, its sides always walkable (2026-11-16)', () => {
    const { field, c } = setup();
    for (let i = 0; i < 6; i++) c.crater(0, 0, 5, 1.6);
    expect(MAX_DEPTH).toBe(3);
    expect(field.heightAt(0, 0)).toBeLessThan(2 - 2.2);
    expect(field.heightAt(0, 0)).toBeGreaterThanOrEqual(2 - MAX_DEPTH - 1e-3);
    let steepest = 0;
    for (let x = -14; x < 14; x += 0.25) for (const z of [0.3, 2.1, -3.7]) steepest = Math.max(steepest, field.slopeAt(x, z));
    expect(steepest).toBeLessThan(0.55);
  });

  it('a crater that heals while another still heals gets its grass back (review 2026-11-16)', () => {
    const { c, refreshed } = setup();
    c.crater(-12, -12, 3, 1);
    for (let t = 0; t < HEAL_S * 0.6; t += 0.5) c.update(0.5);
    c.crater(12, 12, 3, 1);
    refreshed.length = 0;
    for (let t = 0; t < HEAL_S * 0.5; t += 0.5) c.update(0.5);
    expect(c.healing).toBeGreaterThan(0);
    const regrew = refreshed.filter((b) => b[4] === true) as number[][];
    expect(regrew.some((b) => b[0] <= -12 && b[2] >= -12 && b[1] <= -12 && b[3] >= -12)).toBe(true);
  });

  it('knows where the ground is marked (no grass grows there until it heals)', () => {
    const { c } = setup();
    c.scorch(0, 0, 3, 'burnt');
    expect(c.marked(0.4, 0.2)).toBe(true);
    expect(c.marked(15, 15)).toBe(false);
    c.update(HEAL_S + 1);
    expect(c.marked(0.4, 0.2)).toBe(false);
  });

  it('tells the redraw when healing is over, so grass can grow back', () => {
    const { c, refreshed } = setup();
    c.crater(0, 0, 4, 1);
    expect(refreshed.at(-1)![4]).toBe(true);
    c.update(1);
    expect(refreshed.at(-1)![4]).toBe(false);
    c.update(HEAL_S);
    expect(refreshed.at(-1)![4]).toBe(true);
  });
});

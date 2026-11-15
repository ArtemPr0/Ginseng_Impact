import { describe, expect, it } from 'vitest';
import { HeightWorld } from '../world/Colliders';
import { HERO_R, pushOut, SolidBodies, type PushBody, type SolidBody } from './Solid';

const flat = { heightAt: () => 0 };

function frog(x: number, z: number, y = 0.5): SolidBody {
  return { pos: { x, y, z }, alive: true, def: { solid: { r: 3, top: 5 } } };
}

describe('SolidBodies', () => {
  it('lets the hero land on a solid body: its top is the ground over it', () => {
    const world = new HeightWorld(flat);
    const bodies = new SolidBodies(world.moving);
    const f = frog(10, 10);
    bodies.after(f);
    expect(world.heightAt(10, 10, 9)).toBeCloseTo(5.5);
    expect(world.heightAt(14, 10, 9)).toBe(0);
  });

  it('follows the body as it moves', () => {
    const world = new HeightWorld(flat);
    const bodies = new SolidBodies(world.moving);
    const f = frog(10, 10);
    bodies.after(f);
    f.pos.x = 30;
    bodies.after(f);
    expect(world.heightAt(10, 10, 9)).toBe(0);
    expect(world.heightAt(30, 10, 9)).toBeCloseTo(5.5);
  });

  it('is out of the way while the body itself steps (it must not climb onto itself)', () => {
    const world = new HeightWorld(flat);
    const bodies = new SolidBodies(world.moving);
    const f = frog(10, 10);
    bodies.after(f);
    bodies.before(f);
    expect(world.heightAt(10, 10, 0.5)).toBe(0);
  });

  it('is gone once the body is dead', () => {
    const world = new HeightWorld(flat);
    const bodies = new SolidBodies(world.moving);
    const f = frog(10, 10);
    bodies.after(f);
    f.alive = false;
    bodies.after(f);
    expect(world.heightAt(10, 10, 9)).toBe(0);
  });

  it('ignores bodies that are not solid', () => {
    const world = new HeightWorld(flat);
    const bodies = new SolidBodies(world.moving);
    bodies.after({ pos: { x: 0, y: 0, z: 0 }, alive: true, def: {} });
    expect(world.moving.length).toBe(0);
  });

  it('stands aside while shots fly (its own orbs start inside it), then comes back', () => {
    const world = new HeightWorld(flat);
    const bodies = new SolidBodies(world.moving);
    const f = frog(10, 10);
    bodies.after(f);
    let during = NaN;
    bodies.aside(() => { during = world.heightAt(10, 10, 9); });
    expect(during).toBe(0);
    expect(world.heightAt(10, 10, 9)).toBeCloseTo(5.5);
  });
});

// The full pass of 2026-11-15: the hero walked through the Hollow King (6 m across) and off the cliff behind him.
// A body on foot stands its ground: the hero is put back at its edge.
describe('pushOut', () => {
  const body = (x: number, z: number, r: number, extra: Partial<PushBody> = {}): PushBody => ({ pos: { x, y: 0, z }, r, alive: true, ...extra });
  const free = () => false;
  it('puts a hero inside a body back on its edge, along the line from its centre', () => {
    const p = { x: 1, y: 0, z: 0 };
    pushOut(p, [body(0, 0, 3)], free);
    expect(p.x).toBeCloseTo(3 + HERO_R, 5);
    expect(p.z).toBeCloseTo(0, 5);
  });
  it('leaves the hero alone outside, over or under a body, or by a dead or flying one', () => {
    const p = { x: 5, y: 0, z: 0 };
    pushOut(p, [body(0, 0, 3)], free);
    expect(p.x).toBe(5);
    const up = { x: 1, y: 4, z: 0 };
    pushOut(up, [body(0, 0, 3, { height: 3 })], free);
    expect(up.x).toBe(1);
    const q = { x: 1, y: 0, z: 0 };
    pushOut(q, [body(0, 0, 3, { alive: false }), body(0, 0, 3, { flying: true })], free);
    expect(q.x).toBe(1);
  });
  it('never puts the hero into a wall', () => {
    const p = { x: 1, y: 0, z: 0 };
    pushOut(p, [body(0, 0, 3)], (x) => x > 2);
    expect(p.x).toBe(1);
  });
});

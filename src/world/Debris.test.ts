import { describe, expect, it } from 'vitest';
import { DebrisSim, MAX_ACTIVE } from './Debris';

const flat = () => 0;
const run = (sim: DebrisSim, s: number, dt = 1 / 60) => { for (let t = 0; t < s; t += dt) sim.step(dt); };

describe('DebrisSim', () => {
  it('a dropped piece falls, lands on the ground and comes to rest', () => {
    const sim = new DebrisSim(flat);
    const p = sim.add({ x: 0, y: 5, z: 0, r: 0.3 });
    run(sim, 4);
    expect(p.y).toBeCloseTo(0.3, 1);
    expect(p.awake).toBe(false);
  });

  it('bounces fewer than three times', () => {
    const sim = new DebrisSim(flat);
    const p = sim.add({ x: 0, y: 8, z: 0, r: 0.3 });
    run(sim, 4);
    expect(p.bounces).toBeLessThan(3);
  });

  it('slides to a stop on the ground (friction)', () => {
    const sim = new DebrisSim(flat);
    const p = sim.add({ x: 0, y: 0.3, z: 0, r: 0.3, vx: 6 });
    run(sim, 4);
    expect(p.x).toBeGreaterThan(0.5);
    expect(p.x).toBeLessThan(8);
    expect(p.awake).toBe(false);
  });

  it('follows the ground it lands on', () => {
    const sim = new DebrisSim((x) => (x > 0 ? 3 : 0));
    const p = sim.add({ x: 2, y: 9, z: 0, r: 0.25 });
    run(sim, 4);
    expect(p.y).toBeCloseTo(3.25, 1);
  });

  it('never has more than MAX_ACTIVE awake', () => {
    const sim = new DebrisSim(flat);
    for (let i = 0; i < MAX_ACTIVE + 120; i++) sim.add({ x: (i % 30) * 2, y: 0.3, z: Math.floor(i / 30) * 2, r: 0.3, vx: 1 });
    expect(sim.active).toBeLessThanOrEqual(MAX_ACTIVE);
    sim.step(1 / 60);
    expect(sim.active).toBeLessThanOrEqual(MAX_ACTIVE);
  });

  it('pieces dropped on one spot pile up higher than one piece', () => {
    const sim = new DebrisSim(flat);
    const ps = [];
    for (let i = 0; i < 25; i++) ps.push(sim.add({ x: (i % 5) * 0.05, y: 1 + i * 0.7, z: 0, r: 0.3 }));
    run(sim, 6);
    expect(Math.max(...ps.map((p) => p.y))).toBeGreaterThan(0.75);
  });

  it('wakes and pushes pieces near a blast', () => {
    const sim = new DebrisSim(flat);
    const p = sim.add({ x: 1, y: 0.3, z: 0, r: 0.3 });
    run(sim, 2);
    expect(p.awake).toBe(false);
    sim.blast(0, 0, 0, 3, 10);
    expect(p.awake).toBe(true);
    expect(p.vx).toBeGreaterThan(0);
    expect(p.vy).toBeGreaterThan(0);
  });

  it('a resting piece whose ground drops away falls again', () => {
    let floor = 2;
    const sim = new DebrisSim(() => floor);
    const p = sim.add({ x: 0, y: 2.3, z: 0, r: 0.3 });
    run(sim, 2);
    expect(p.awake).toBe(false);
    floor = 0;
    run(sim, 3);
    expect(p.y).toBeCloseTo(0.3, 1);
  });

  it('drops pieces that fall into the void', () => {
    const sim = new DebrisSim(() => -1000);
    sim.add({ x: 0, y: 0, z: 0, r: 0.3 });
    run(sim, 5);
    expect(sim.pieces.length).toBe(0);
  });
});

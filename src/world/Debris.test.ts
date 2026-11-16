import { describe, expect, it } from 'vitest';
import { Quaternion, Vector3 } from 'three';
import { DebrisSim, GRAVITY, MAX_ACTIVE } from './Debris';

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

  it('falls at real gravity', () => {
    expect(GRAVITY).toBeCloseTo(9.81, 1);
  });

  it('a box comes to rest flat on its broad face, its half-height up', () => {
    const sim = new DebrisSim(flat);
    // A slab 2 x 0.3 x 1.2 m, dropped tumbling at a slant.
    const q = new Quaternion().setFromAxisAngle(new Vector3(1, 0.4, 0.2).normalize(), 0.9);
    const p = sim.add({ x: 0, y: 3, z: 0, r: 1.2, box: { x: 1, y: 0.15, z: 0.6 }, q, wx: 2, wz: -3 });
    run(sim, 6);
    expect(p.awake).toBe(false);
    expect(p.y).toBeGreaterThan(0.1);
    expect(p.y).toBeLessThan(0.22);
    // Its thin axis (local y) points up or down.
    const up = new Vector3(0, 1, 0).applyQuaternion(new Quaternion(p.qx, p.qy, p.qz, p.qw));
    expect(Math.abs(up.y)).toBeGreaterThan(0.95);
  });

  it('a box landing on its corner tips over instead of standing on it', () => {
    const sim = new DebrisSim(flat);
    const q = new Quaternion().setFromEuler({ x: Math.PI / 4, y: 0, z: Math.PI / 5, order: 'XYZ' } as never);
    const p = sim.add({ x: 0, y: 2, z: 0, r: 0.9, box: { x: 0.5, y: 0.5, z: 0.5 }, q });
    run(sim, 6);
    expect(p.y).toBeCloseTo(0.5, 1);
  });

  it('three boxes dropped on each other stack and stay stacked', () => {
    const sim = new DebrisSim(flat);
    const b = { x: 0.6, y: 0.25, z: 0.6 };
    const ps = [0, 1, 2].map((i) => sim.add({ x: i * 0.05, y: 0.25 + i * 0.6, z: 0, r: 0.9, box: b }));
    run(sim, 6);
    const ys = ps.map((p) => p.y).sort((a, c) => a - c);
    expect(ys[0]).toBeCloseTo(0.25, 1);
    expect(ys[1]).toBeGreaterThan(0.6);
    expect(ys[2]).toBeGreaterThan(1.1);
  });

  it('each bounce of a dropped box is lower than the last', () => {
    const sim = new DebrisSim(flat);
    const p = sim.add({ x: 0, y: 6, z: 0, r: 0.5, box: { x: 0.3, y: 0.3, z: 0.3 } });
    const peaks: number[] = [];
    let up = false, prev = p.y;
    for (let t = 0; t < 4; t += 1 / 120) {
      sim.step(1 / 120);
      if (p.y > prev) up = true;
      else if (up && p.y < prev) { if (prev > 0.4) peaks.push(prev); up = false; }
      prev = p.y;
    }
    for (let i = 1; i < peaks.length; i++) expect(peaks[i]).toBeLessThan(peaks[i - 1]);
  });

  it('over the cap it freezes pieces where they are, never deletes one in the air', () => {
    const sim = new DebrisSim(flat, 10);
    const ps = [];
    for (let i = 0; i < 20; i++) ps.push(sim.add({ x: i * 2, y: 5, z: 0, r: 0.3 }));
    expect(sim.active).toBeLessThanOrEqual(10);
    expect(ps.every((p) => !p.dead)).toBe(true);
  });

  it('a piece placed where it stood does not jump on its first step (no pop when a building turns to chunks)', () => {
    const sim = new DebrisSim(flat);
    const b = { x: 0.5, y: 0.5, z: 0.5 };
    // Two chunks of a wall touching each other, standing on the ground.
    const a = sim.add({ x: 0, y: 0.5, z: 0, r: 0.9, box: b });
    const c = sim.add({ x: 0.95, y: 0.5, z: 0, r: 0.9, box: b });
    sim.step(1 / 60);
    expect(Math.abs(a.x)).toBeLessThan(0.02);
    expect(Math.abs(c.x - 0.95)).toBeLessThan(0.02);
  });

  it('a heap of thirty tumbling chunks settles: all asleep, none sunk into the ground, none flung away', () => {
    const sim = new DebrisSim(flat);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const ps = [];
    for (let i = 0; i < 30; i++) {
      const b = { x: 0.2 + rnd() * 0.6, y: 0.1 + rnd() * 0.3, z: 0.2 + rnd() * 0.5 };
      const q = new Quaternion().setFromAxisAngle(new Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).normalize(), rnd() * 3);
      ps.push(sim.add({ x: (rnd() - 0.5) * 3, y: 1 + i * 0.4, z: (rnd() - 0.5) * 3, r: Math.hypot(b.x, b.y, b.z), box: b, q, wx: rnd() * 4 - 2, wz: rnd() * 4 - 2 }));
    }
    run(sim, 10);
    expect(ps.filter((p) => p.awake).length).toBeLessThanOrEqual(1);
    for (const p of ps) {
      expect(p.y).toBeGreaterThan(0.05);
      expect(Math.hypot(p.x, p.z)).toBeLessThan(8);
    }
  });
});

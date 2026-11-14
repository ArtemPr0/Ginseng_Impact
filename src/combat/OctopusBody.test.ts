import { describe, expect, it } from 'vitest';
import { armAngles, nearestArm, octoDeform, type OctoPose } from './OctopusBody';

// The octopus boss (the playtest of 2026-11-14: "make a massive octopus as the boss and make his attacks look very cool
// and animated"): its model is one unrigged mesh lying with its eight arms spread, so its arms move in the vertex shader;
// octoDeform is that shader's arithmetic.
const R = 1;
const rest: OctoPose = { time: 0, pulse: 0, lift: 0, dir: 0, spin: 0, wave: 0, reachX: 0, reachZ: 0 };
const at = (x: number, z: number, pose: Partial<OctoPose>) => octoDeform([x, 0, z], R, { ...rest, ...pose });

describe('the octopus arms', () => {
  it('never moves the body in the middle', () => {
    for (const pose of [{ pulse: 1 }, { lift: 1, dir: 1 }, { spin: 2 }, { wave: 1, time: 3 }]) {
      const [x, y, z] = at(0, 0, pose);
      expect(Math.hypot(x, y, z)).toBeLessThan(1e-9);
    }
  });

  it('lifts the arm toward its target high and leaves the arm behind it down (the tentacle slam winds up)', () => {
    const toward = at(0.9, 0, { lift: 1, dir: 0 });
    const away = at(-0.9, 0, { lift: 1, dir: 0 });
    expect(toward[1]).toBeGreaterThan(0.6);
    expect(Math.abs(away[1])).toBeLessThan(0.01);
    // And reaches out a little along it.
    expect(toward[0]).toBeGreaterThan(0.9);
    // A negative lift (the slam) drives the same arm down.
    expect(at(0.9, 0, { lift: -0.3, dir: 0 })[1]).toBeLessThan(0);
  });

  it('stretches that arm out to a target beyond its length (a rubbery cartoon arm), the others staying put', () => {
    const far = at(0.9, 0, { lift: 1, dir: 0, reachX: 1 });
    expect(far[0]).toBeGreaterThan(1.6);
    expect(at(0, 0.9, { lift: 1, dir: 0, reachX: 1 })[2]).toBeCloseTo(0.9, 6);
  });

  it('bends that arm\'s tip sideways onto a target off its line', () => {
    const bent = at(0.9, 0, { lift: 1, dir: 0, reachX: 0.3, reachZ: 0.4 });
    expect(bent[2]).toBeGreaterThan(0.3);
    expect(at(-0.9, 0, { lift: 1, dir: 0, reachX: 0.3, reachZ: 0.4 })[2]).toBeCloseTo(0, 6);
  });

  it('curls every tip down and in on a swim pulse', () => {
    for (const a of [0, 1, 2, 3, 4, 5]) {
      const [x, y, z] = at(Math.cos(a) * 0.9, Math.sin(a) * 0.9, { pulse: 1 });
      expect(y).toBeLessThan(-0.15);
      expect(Math.hypot(x, z)).toBeLessThan(0.9);
    }
  });

  it('twists the arms round the middle on a whirlpool, more at the tips, keeping their reach', () => {
    const tip = at(0.9, 0, { spin: 1 });
    const mid = at(0.3, 0, { spin: 1 });
    expect(Math.hypot(tip[0], tip[2])).toBeCloseTo(0.9, 6);
    expect(Math.atan2(tip[2], tip[0])).toBeGreaterThan(Math.atan2(mid[2], mid[0]) + 0.3);
  });
});

describe('finding the arms on the mesh', () => {
  // A star of eight arms (a thin ribbon of points out along each), turned 10 degrees, round a lump of body.
  const arms = Array.from({ length: 8 }, (_, i) => 0.1745 + (i / 8) * Math.PI * 2);
  const pts: number[] = [];
  for (let k = 0; k < 300; k++) { const a = k * 2.4; pts.push(Math.cos(a) * 0.2, 0.1, Math.sin(a) * 0.2); }
  for (const a of arms) for (let r = 0.05; r <= 1; r += 0.01) for (const off of [-0.03, 0, 0.03]) pts.push(Math.cos(a + off) * r, -0.1, Math.sin(a + off) * r);

  it('finds the eight arms where they lie', () => {
    const found = armAngles(pts, 1);
    expect(found).toHaveLength(8);
    for (const a of arms) {
      const d = Math.min(...found.map((f) => Math.abs(Math.atan2(Math.sin(f - a), Math.cos(f - a)))));
      expect(d).toBeLessThan(0.06);
    }
  });

  it('picks the arm nearest a direction, across the wrap', () => {
    const found = armAngles(pts, 1);
    expect(nearestArm(found, 0.3)).toBeCloseTo(arms[0], 1);
    expect(nearestArm(found, -0.55)).toBeCloseTo(arms[7] - Math.PI * 2, 1);
    expect(nearestArm([], 1.2)).toBe(1.2);
  });
});

describe('the whirlpool spin', async () => {
  const { BufferGeometry, Float32BufferAttribute, Mesh, MeshStandardMaterial } = await import('three');
  const { OctopusBody } = await import('./OctopusBody');
  const make = () => {
    const pts: number[] = [];
    for (let i = 0; i < 8; i++) for (let r = 0.1; r <= 1; r += 0.05) pts.push(Math.cos(i * 0.785) * r, 0, Math.sin(i * 0.785) * r);
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(pts, 3));
    const mat = new MeshStandardMaterial();
    const mesh = new Mesh(g, mat);
    return { mesh, body: new OctopusBody(mesh, g, [mat], 1) };
  };
  const idle = { state: 'chase', attack: null, mark: { x: 5, y: 0, z: 0 }, moving: false };

  it('spins the whole body round, the arms trailing behind it a little, never wound into a coil', () => {
    const { mesh, body } = make();
    body.spinFor(2);
    let maxTwist = 0;
    for (let t = 0; t < 1.5; t += 1 / 30) { body.drive(1 / 30, idle); maxTwist = Math.max(maxTwist, Math.abs(body.pose.spin)); }
    expect(Math.abs(mesh.rotation.y)).toBeGreaterThan(3);
    expect(maxTwist).toBeGreaterThan(0.3);
    expect(maxTwist).toBeLessThanOrEqual(1.2);
  });

  it('comes to rest facing the way it faced, the arms straight again', () => {
    const { mesh, body } = make();
    body.spinFor(1.3);
    for (let t = 0; t < 6; t += 1 / 30) body.drive(1 / 30, idle);
    const turn = mesh.rotation.y / (Math.PI * 2);
    expect(Math.abs(turn - Math.round(turn))).toBeLessThan(0.01);
    expect(Math.abs(body.pose.spin)).toBeLessThan(0.01);
  });
});

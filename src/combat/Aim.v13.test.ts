import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { AimHold, aimShape, flightPoint, holeLift, shotArc, tornadoPath, tornadoStep, HOLE_LIFT } from './Aim';

describe('AimHold (playtest 2026-11-17: hold right click to aim, release casts, Esc cancels)', () => {
  it('pressing starts aiming; letting go casts once', () => {
    const a = new AimHold();
    expect(a.update(true, false, 3).release).toBe(false);
    expect(a.aiming).toBe(true);
    expect(a.update(true, false, 3).release).toBe(false);
    const r = a.update(false, false, 3);
    expect(r.release).toBe(true);
    expect(r.slot).toBe(3);
    expect(a.aiming).toBe(false);
    expect(a.update(false, false, 3).release).toBe(false);
  });
  it('Esc cancels: letting go afterwards casts nothing, and the next press aims again', () => {
    const a = new AimHold();
    a.update(true, false, 2);
    a.update(true, true, 2);
    expect(a.aiming).toBe(false);
    expect(a.update(false, false, 2).release).toBe(false);
    a.update(true, false, 2);
    expect(a.aiming).toBe(true);
  });
  it('picking another slot mid-aim cancels', () => {
    const a = new AimHold();
    a.update(true, false, 2);
    a.update(true, false, 4);
    expect(a.aiming).toBe(false);
    expect(a.update(false, false, 4).release).toBe(false);
  });
});

describe('aimShape: every spell shows what it will do', () => {
  it('shots fly an arc, blasts are rings, tornadoes a path, walls a wall, the black hole a marker', () => {
    expect(aimShape('fireball').kind).toBe('arc');
    expect(aimShape('moonbomb').kind).toBe('arc');
    expect(aimShape('starfall').kind).toBe('ring');
    expect(aimShape('overgrowth').kind).toBe('ring');
    expect(aimShape('fire-tornado').kind).toBe('path');
    expect(aimShape('storm-tornado').kind).toBe('path');
    expect(aimShape('gale-shot').kind).toBe('cone');
    expect(aimShape('wrecking-charge').kind).toBe('lane');
    expect(aimShape('stone-wall').kind).toBe('wall');
    expect(aimShape('black-hole').kind).toBe('marker');
  });
});

describe('the preview is the real flight', () => {
  it('flightPoint is the shot\'s path: from the hand, up by its arc in the middle, onto the target', () => {
    const a = new Vector3(0, 1.5, 0), b = new Vector3(0, 0, 20), o = new Vector3();
    expect(flightPoint(a, b, 0, 2.5, o).distanceTo(a)).toBeCloseTo(0, 6);
    expect(flightPoint(a, b, 1, 2.5, o).distanceTo(b)).toBeCloseTo(0, 6);
    expect(flightPoint(a, b, 0.5, 2.5, o).y).toBeCloseTo(0.75 + 2.5, 6);
    expect(shotArc('fireball')).toBe(2.5);
  });
  it('tornadoPath walks the same steps the tornado takes', () => {
    const dir = { x: 1, z: 0 };
    const path = tornadoPath({ x: 0, z: 0 }, dir, 18, 7, 0.1);
    let x = 0, z = 0;
    for (let t = 0.1; t <= 7 + 1e-9; t += 0.1) { const s = tornadoStep(t, 0.1, dir, 18, 7); x += s.x; z += s.z; }
    const end = path[path.length - 1];
    expect(end.x).toBeCloseTo(x, 4);
    expect(end.z).toBeCloseTo(z, 4);
    expect(end.x).toBeGreaterThan(15);
    // It weaves off its line.
    expect(Math.max(...path.map((p) => Math.abs(p.z)))).toBeGreaterThan(0.5);
  });
});

describe('the black hole goes where it is put (playtest: in the ground halfway, inside a building)', () => {
  it('open ground: high in the sky by default; the wheel brings it down into the ground, clamped', () => {
    expect(holeLift(0, false)).toBe(HOLE_LIFT.sky);
    expect(holeLift(-50, false)).toBe(HOLE_LIFT.min);
    expect(holeLift(50, false)).toBe(HOLE_LIFT.max);
  });
  it('aimed at a building: it opens inside it, where the crosshair meets it', () => {
    expect(holeLift(0, true)).toBe(HOLE_LIFT.inside);
  });
});

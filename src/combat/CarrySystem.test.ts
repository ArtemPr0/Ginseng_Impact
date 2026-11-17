import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CarrySystem, type CarryHost } from './CarrySystem';
import type { Enemy } from './Enemy';

function mob(x: number, z: number, over: Record<string, unknown> = {}): Enemy {
  return { alive: true, held: false, pos: new Vector3(x, 0, z), object: { rotation: { z: 0 } }, def: { height: 1.8, bodyRadius: 0.4, scale: 1, ...over } } as unknown as Enemy;
}

function host(o: { aim: Vector3 | null; enemies?: Enemy[]; pieces?: { x: number; y: number; z: number; dead?: boolean }[]; building?: boolean }): CarryHost {
  return {
    enemies: () => o.enemies ?? [],
    hero: () => ({ pos: new Vector3(0, 0, 0), yaw: 0, grounded: true }),
    heroId: () => 'wizard',
    aimAt: () => o.aim,
    lookDir: () => new Vector3(1, 0, 0),
    debris: () => [{ pieces: o.pieces ?? [] }] as never,
    breakAt: () => 0,
    building: (x, z) => (o.building ? { x, y: 0, z, r: 3 } : null),
    hit: () => {},
    groundAt: () => 0,
    fx: { shock: () => {}, dust: () => {}, sparks: () => {} },
    shake: () => {},
    sound: { grab: () => {}, throw: () => {}, land: () => {} },
  };
}

describe('CarrySystem.liftTarget (what Orlan\'s Telekinesis would take: it glows under the crosshair)', () => {
  it('a mob near the crosshair comes first', () => {
    const e = mob(10, 1);
    const t = new CarrySystem(host({ aim: new Vector3(10, 0, 0), enemies: [e], pieces: [{ x: 10, y: 0, z: 0 }], building: true })).liftTarget();
    expect(t?.kind).toBe('mob');
    expect(t?.e).toBe(e);
  });
  it('bosses and giants are too heavy; then loose rubble; then a small building', () => {
    const boss = mob(10, 0, { boss: true });
    expect(new CarrySystem(host({ aim: new Vector3(10, 0, 0), enemies: [boss], pieces: [{ x: 10.5, y: 0, z: 0 }] })).liftTarget()?.kind).toBe('rubble');
    expect(new CarrySystem(host({ aim: new Vector3(10, 0, 0), enemies: [boss], building: true })).liftTarget()?.kind).toBe('building');
  });
  it('nothing past 22 m, and nothing when the crosshair has no ground', () => {
    expect(new CarrySystem(host({ aim: new Vector3(30, 0, 0), enemies: [mob(30, 0)] })).liftTarget()).toBeNull();
    expect(new CarrySystem(host({ aim: null })).liftTarget()).toBeNull();
  });
});

describe('CarrySystem.holding (where the Telekinesis beam runs to)', () => {
  it('nothing held: null; a mob lifted: the hold ahead of him, sized to the mob', () => {
    const e = mob(6, 0);
    const c = new CarrySystem(host({ aim: new Vector3(6, 0, 0), enemies: [e] }));
    expect(c.holding()).toBeNull();
    c.update(0.016, { attack: false, heavyHeld: true, grab: false } as never);
    const h = c.holding();
    expect(h).not.toBeNull();
    expect(h!.r).toBeGreaterThan(0.5);
    expect(h!.to.y).toBeGreaterThan(1);
  });
});

describe('Telekinesis cooldown', () => {
  it('no lift while it cools; the throw spends it', () => {
    const e = mob(6, 0);
    let ready = false, spent = 0;
    const h = { ...host({ aim: new Vector3(6, 0, 0), enemies: [e] }), mindReady: () => ready, mindSpent: () => { spent++; } };
    const c = new CarrySystem(h);
    c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    expect(c.mind).toBeNull();
    c.update(0.016, { attack: false, heavyHeld: false, grab: false });
    ready = true;
    c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    expect(c.mind).not.toBeNull();
    expect(spent).toBe(0);
    c.update(0.016, { attack: false, heavyHeld: false, grab: false });
    expect(c.mind).toBeNull();
    expect(spent).toBe(1);
  });
});

describe('CarrySystem.glowTarget (the glow under the crosshair)', () => {
  it('looks again at most ten times a second', () => {
    let scans = 0;
    const base = host({ aim: new Vector3(6, 0, 0), enemies: [mob(6, 0)] });
    const c = new CarrySystem({ ...base, enemies: () => { scans++; return base.enemies(); } });
    const a = c.glowTarget(0.016);
    expect(a?.kind).toBe('mob');
    for (let i = 0; i < 4; i++) expect(c.glowTarget(0.016)).toBe(a);
    expect(scans).toBe(1);
    c.glowTarget(0.05);
    expect(scans).toBe(2);
  });
});

// ------------------------------------------------------------------------------- v13 (playtest 2026-11-17)
import { THROW_G, flightStep, aimedVelocity } from './Carry';

function whole() {
  const log = { moves: 0, landed: null as null | { x: number; y: number; z: number }, broke: [] as number[] };
  const b = {
    x: 6, y: 0, z: 0, r: 2.5, height: 5,
    move: () => { log.moves++; },
    land: (x: number, y: number, z: number) => { log.landed = { x, y, z }; },
  };
  return { b, log };
}

describe('Telekinesis lifts a building whole (playtest 2026-11-17: "he automatically breaks it into pieces")', () => {
  it('nothing breaks on the lift: the building rises in one piece', () => {
    const { b, log } = whole();
    let breaks = 0;
    const h = { ...host({ aim: new Vector3(6, 0, 0), building: true }), breakAt: () => { breaks++; return 1; }, takeBuilding: () => b };
    const c = new CarrySystem(h);
    c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    for (let i = 0; i < 30; i++) c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    expect(breaks).toBe(0);
    expect(log.moves).toBeGreaterThan(10);
    expect(c.holding()).not.toBeNull();
  });
  it('left click throws it at the crosshair; it lands there and breaks only where it hits', () => {
    const { b, log } = whole();
    const breaks: number[] = [];
    let aim = new Vector3(6, 0, 0);
    const h = { ...host({ aim: null, building: true }), aimAt: () => aim, breakAt: (_x: number, _y: number, _z: number, r: number) => { breaks.push(r); return 1; }, takeBuilding: () => b };
    const c = new CarrySystem(h);
    c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    for (let i = 0; i < 40; i++) c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    aim = new Vector3(18, 0, 4);
    c.update(0.016, { attack: true, heavyHeld: true, grab: false });
    for (let i = 0; i < 300 && !log.landed; i++) c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    expect(log.landed).not.toBeNull();
    expect(Math.hypot(log.landed!.x - 18, log.landed!.z - 4)).toBeLessThan(2);
    expect(breaks.length).toBeGreaterThanOrEqual(1);
    expect(Math.max(...breaks)).toBeLessThanOrEqual(3);
  });
  it('letting go of right click without throwing sets it down where it hangs', () => {
    const { b, log } = whole();
    const h = { ...host({ aim: new Vector3(6, 0, 0), building: true }), takeBuilding: () => b };
    const c = new CarrySystem(h);
    for (let i = 0; i < 20; i++) c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    c.update(0.016, { attack: false, heavyHeld: false, grab: false });
    for (let i = 0; i < 200 && !log.landed; i++) c.update(0.016, { attack: false, heavyHeld: false, grab: false });
    expect(log.landed).not.toBeNull();
    expect(Math.hypot(log.landed!.x, log.landed!.z)).toBeLessThan(10);
  });
});

describe('Telekinesis: left click throws a mob at the crosshair', () => {
  it('it flies to where the crosshair is', () => {
    const e = mob(6, 0);
    (e as unknown as { thrown: unknown }).thrown = null;
    let aim = new Vector3(6, 0, 0);
    const h = { ...host({ aim: null, enemies: [e] }), aimAt: () => aim };
    const c = new CarrySystem(h);
    for (let i = 0; i < 30; i++) c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    aim = new Vector3(16, 0, -6);
    c.update(0.016, { attack: true, heavyHeld: true, grab: false });
    const f = (e as unknown as { thrown: { vx: number; vy: number; vz: number; spin: number; angle: number } }).thrown;
    expect(f).toBeTruthy();
    const p = { x: e.pos.x, y: e.pos.y, z: e.pos.z };
    for (let i = 0; i < 400; i++) if (flightStep(f, p, 1 / 120, () => 0)) break;
    expect(Math.hypot(p.x - 16, p.z + 6)).toBeLessThan(1.5);
  });
});

describe('aimedVelocity', () => {
  it('a ballistic throw that lands on the target', () => {
    const v = aimedVelocity({ x: 0, y: 2, z: 0 }, { x: 12, y: 0, z: 5 }, THROW_G, 20);
    const p = { x: 0, y: 2, z: 0 };
    const f = { vx: v.x, vy: v.y, vz: v.z, spin: 0, angle: 0 };
    for (let i = 0; i < 600; i++) if (flightStep(f, p, 1 / 240, () => 0)) break;
    expect(Math.hypot(p.x - 12, p.z - 5)).toBeLessThan(0.3);
  });
});

describe('Sir Aldric swings a mob he holds as a club (playtest 2026-11-17)', () => {
  it('left click swings it: the mob in front is hit, so is the one he holds, and he keeps hold', () => {
    const held = mob(1.5, 0, { speed: 3 });
    const other = mob(2.2, 0.8, { speed: 3 });
    (held as unknown as { id: number }).id = 1; (other as unknown as { id: number }).id = 2;
    const hits: unknown[] = [];
    const h = { ...host({ aim: new Vector3(10, 0, 0), enemies: [held, other] }), heroId: () => 'knight', hit: (e: Enemy) => { hits.push(e); } };
    const c = new CarrySystem(h);
    c.update(0.016, { attack: false, heavyHeld: false, grab: true });
    expect(c.hand?.e).toBe(held);
    for (let i = 0; i < 20; i++) c.update(0.016, { attack: false, heavyHeld: false, grab: false });
    c.update(0.016, { attack: true, heavyHeld: false, grab: false });
    for (let i = 0; i < 40; i++) c.update(0.016, { attack: false, heavyHeld: false, grab: false });
    expect(hits).toContain(other);
    expect(hits).toContain(held);
    expect(c.hand?.e).toBe(held);
  });
  it('G again throws it at the crosshair', () => {
    const held = mob(1.5, 0, { speed: 3 });
    const h = { ...host({ aim: new Vector3(4, 0, 9), enemies: [held] }), heroId: () => 'knight' };
    const c = new CarrySystem(h);
    c.update(0.016, { attack: false, heavyHeld: false, grab: true });
    for (let i = 0; i < 20; i++) c.update(0.016, { attack: false, heavyHeld: false, grab: false });
    c.update(0.016, { attack: false, heavyHeld: false, grab: true });
    expect(c.hand).toBeNull();
    const f = (held as unknown as { thrown: { vx: number; vz: number } }).thrown;
    expect(f.vz).toBeGreaterThan(Math.abs(f.vx) * 0.5);
  });
});

describe('throwPreview (the arc to where a held thing will land)', () => {
  it('nothing held: null; a mob lifted: from the hold to the crosshair, its arc as high as the real flight', () => {
    const e = mob(6, 0);
    let aim = new Vector3(6, 0, 0);
    const c = new CarrySystem({ ...host({ aim: null, enemies: [e] }), aimAt: () => aim });
    expect(c.throwPreview()).toBeNull();
    for (let i = 0; i < 30; i++) c.update(0.016, { attack: false, heavyHeld: true, grab: false });
    aim = new Vector3(18, 0, 0);
    const p = c.throwPreview()!;
    expect(p.to.distanceTo(aim)).toBeLessThan(1e-6);
    // The real flight's peak over the line between its ends, by stepping it.
    const v = aimedVelocity(p.from, aim, THROW_G, 24 / Math.sqrt(1));
    const f = { vx: v.x, vy: v.y, vz: v.z, spin: 0, angle: 0 };
    const q = { x: p.from.x, y: p.from.y, z: p.from.z };
    let sag = 0;
    for (let i = 0; i < 2000; i++) {
      const k = (q.x - p.from.x) / (aim.x - p.from.x);
      sag = Math.max(sag, q.y - (p.from.y + (aim.y - p.from.y) * k));
      if (flightStep(f, q, 1 / 2000, () => -50)) break;
      if (q.x >= aim.x) break;
    }
    expect(p.arc).toBeCloseTo(sag, 1);
  });
});

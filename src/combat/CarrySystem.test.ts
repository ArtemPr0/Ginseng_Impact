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

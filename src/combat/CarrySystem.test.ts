import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { CarrySystem, type CarryHost } from './CarrySystem';
import type { Enemy } from './Enemy';

function mob(x: number, z: number, over: Record<string, unknown> = {}): Enemy {
  return { alive: true, held: false, pos: new Vector3(x, 0, z), def: { height: 1.8, bodyRadius: 0.4, scale: 1, ...over } } as unknown as Enemy;
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

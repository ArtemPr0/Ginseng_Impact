import { describe, expect, it, vi } from 'vitest';
import { Group, Vector3 } from 'three';

// The rig builds its body with the DOM (canvas textures): a bare stand-in that records what it was told.
vi.mock('../characters/Rig', () => ({
  Rig: class {
    root = new Group();
    trailObject = new Group();
    poses: unknown[] = [];
    animate(pose: unknown): void { this.poses.push(pose); }
  },
}));
vi.mock('../models/ModelRig', () => ({ yawToRotation: (y: number) => y }));

const { Companion } = await import('./Companion');

const def = { id: 'test', name: 'Tester', title: '', hire: { cost: 1, atk: 50, maxHp: 1000, ranged: false } } as never;
const make = () => new Companion(def, new Vector3(), () => 0, 0);
const step = (c: InstanceType<typeof Companion>, dt: number, foe = false) =>
  c.update(dt, new Vector3(), 0, foe ? [{ id: 1, pos: new Vector3(6, 0, 0), alive: true, aggro: true }] as never : []);

describe('Companion.hurt: fought by the mobs', () => {
  it('loses the blow, is covered a moment after it, and its body is told (big or a flinch)', () => {
    const c = make();
    expect(c.hurt(100)).toBe(true);
    expect(c.hp).toBe(900);
    // Covered: a second orb of the same volley does nothing.
    expect(c.hurt(100)).toBe(false);
    expect(c.hp).toBe(900);
    step(c, 0.4);
    expect(c.hurt(200)).toBe(true);
    expect(c.hp).toBe(700);
    step(c, 0.05);
    const rig = c.rig as unknown as { poses: Array<{ hurt?: { big: boolean } }> };
    expect(rig.poses.at(-1)?.hurt?.big).toBe(true);
  });

  it('never goes below 0; at 0 it is down and takes no more', () => {
    const c = make();
    c.hurt(5000);
    expect(c.hp).toBe(0);
    expect(c.down).toBe(true);
    step(c, 1);
    expect(c.hurt(10)).toBe(false);
    // (Down stays down: no breath back once beaten; main sends it home.)
    for (let i = 0; i < 10; i++) step(c, 1);
    expect(c.hp).toBe(0);
  });

  it('gets its breath back once out of the fight a while, never past its max', () => {
    const c = make();
    c.hurt(500);
    for (let i = 0; i < 3; i++) step(c, 1, true);
    expect(c.hp).toBe(500);
    for (let i = 0; i < 4; i++) step(c, 1);
    expect(c.hp).toBe(500);
    for (let i = 0; i < 60; i++) step(c, 1);
    expect(c.hp).toBe(1000);
  });
});

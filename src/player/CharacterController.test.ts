import { describe, expect, it } from 'vitest';
import { CONTROLLER, createControllerState, stepController, type ControllerInput, type WorldQuery } from './CharacterController';

const flat: WorldQuery = { heightAt: () => 0 };
const idle = (): ControllerInput => ({ move: { x: 0, z: 0 }, sprint: false, jump: false, jumpHeld: false, glide: false, climbHeld: false });

function run(input: ControllerInput, steps: number, world = flat, s = createControllerState({ x: 0, y: 0, z: 0 })) {
  for (let i = 0; i < steps; i++) stepController(s, input, world, 1 / 60);
  return s;
}

describe('stepController — ground', () => {
  it('stays grounded and still with no input', () => {
    const s = run(idle(), 60);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(0);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeCloseTo(0);
  });

  it('reaches walk speed and faces the movement direction', () => {
    const s = run({ ...idle(), move: { x: 0, z: -1 } }, 90);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeCloseTo(CONTROLLER.walkSpeed, 1);
    expect(s.pos.z).toBeLessThan(-4);
    expect(Math.cos(s.yaw - Math.atan2(-1, 0))).toBeCloseTo(1, 3);
  });

  it('sprints faster and drains stamina, then recovers when idle', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 }, sprint: true }, 120);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeCloseTo(CONTROLLER.sprintSpeed, 1);
    expect(s.stamina).toBeLessThan(CONTROLLER.maxStamina);
    const drained = s.stamina;
    run(idle(), 120, flat, s);
    expect(s.stamina).toBeGreaterThan(drained);
  });

  it('cannot sprint with empty stamina', () => {
    const s = createControllerState({ x: 0, y: 0, z: 0 });
    s.stamina = 0;
    run({ ...idle(), move: { x: 1, z: 0 }, sprint: true }, 90, flat, s);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeCloseTo(CONTROLLER.walkSpeed, 1);
  });

  it('follows terrain height while walking', () => {
    const hill: WorldQuery = { heightAt: (x) => Math.max(0, x * 0.3) };
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 120, hill);
    expect(s.pos.x).toBeGreaterThan(5);
    expect(s.pos.y).toBeCloseTo(hill.heightAt(s.pos.x, s.pos.z), 1);
    expect(s.mode).toBe('ground');
  });
});

describe('stepController — air', () => {
  it('jumps, rises, and lands back on the ground', () => {
    const s = run({ ...idle(), jump: true }, 1);
    expect(s.mode).toBe('air');
    expect(s.vel.y).toBeCloseTo(CONTROLLER.jumpSpeed - CONTROLLER.gravity / 60);
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      stepController(s, idle(), flat, 1 / 60);
      peak = Math.max(peak, s.pos.y);
    }
    expect(peak).toBeGreaterThan(1.3);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(0);
  });

  it('does not double jump', () => {
    const s = run({ ...idle(), jump: true }, 1);
    stepController(s, idle(), flat, 1 / 60);
    const vyBefore = s.vel.y;
    stepController(s, { ...idle(), jump: true }, flat, 1 / 60);
    expect(s.vel.y).toBeLessThan(vyBefore);
  });

  it('falls off a ledge into the air state', () => {
    const ledge: WorldQuery = { heightAt: (x) => (x > 2 ? -10 : 0) };
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 60, ledge);
    expect(s.mode).toBe('air');
    expect(s.pos.y).toBeLessThan(0);
  });
});

import { describe, expect, it } from 'vitest';
import { CONTROLLER, createControllerState, stepController, type ControllerInput, type WorldQuery } from './CharacterController';

const flat: WorldQuery = { heightAt: () => 0 };
const idle = (): ControllerInput => ({ move: { x: 0, z: 0 }, sprint: false, jump: false, jumpHeld: false, fly: false, climbHeld: false });

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
    const s = run({ ...idle(), jump: true, jumpHeld: true }, 1);
    expect(s.mode).toBe('air');
    expect(s.vel.y).toBeCloseTo(CONTROLLER.jumpSpeed);
    let peak = 0;
    for (let i = 0; i < 120; i++) {
      stepController(s, { ...idle(), jumpHeld: true }, flat, 1 / 60);
      peak = Math.max(peak, s.pos.y);
    }
    expect(peak).toBeGreaterThan(1.5);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(0);
  });

  it('a tapped jump is a shorter hop than a held one', () => {
    const peakOf = (held: boolean) => {
      const s = run({ ...idle(), jump: true, jumpHeld: true }, 1);
      let peak = 0;
      for (let i = 0; i < 90; i++) { stepController(s, { ...idle(), jumpHeld: held && i < 60 }, flat, 1 / 60); peak = Math.max(peak, s.pos.y); }
      return peak;
    };
    expect(peakOf(false)).toBeLessThan(peakOf(true) * 0.8);
  });

  it('buffers a jump pressed just before landing', () => {
    const s = createControllerState({ x: 0, y: 0.3, z: 0 });
    s.mode = 'air';
    s.vel.y = -2;
    stepController(s, { ...idle(), jump: true, jumpHeld: true }, flat, 1 / 60);
    for (let i = 0; i < 6 && s.mode === 'air'; i++) stepController(s, { ...idle(), jumpHeld: true }, flat, 1 / 60);
    stepController(s, { ...idle(), jumpHeld: true }, flat, 1 / 60);
    expect(s.vel.y).toBeGreaterThan(0);
  });

  it('bounces off a tall wall in mid-air instead of landing on its top', () => {
    const block: WorldQuery = { heightAt: (x) => (x >= 1 ? 10 : 0) };
    const s = createControllerState({ x: 0, y: 1.5, z: 0 });
    s.mode = 'air';
    s.vel.x = 6;
    s.vel.y = 1;
    run(idle(), 60, block, s);
    expect(s.pos.y).toBeLessThan(3);
    expect(s.pos.x).toBeLessThan(1);
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

describe('stepController — climb', () => {
  /** A 70° wall starting at x = 2: h = (x - 2) * 2.75 for x > 2, up to 12 m. */
  const wall: WorldQuery = { heightAt: (x) => Math.min(12, Math.max(0, (x - 2) * 2.75)) };

  it('enters climb mode when walking into a steep slope and ascends slowly', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 120, wall);
    expect(s.mode).toBe('climb');
    expect(s.pos.y).toBeGreaterThan(1);
    expect(s.pos.y).toBeLessThan(8);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeLessThan(CONTROLLER.walkSpeed);
    expect(s.stamina).toBeLessThan(CONTROLLER.maxStamina);
  });

  it('holds position on the wall with no input but keeps draining stamina', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 90, wall);
    const y = s.pos.y;
    const st = s.stamina;
    run(idle(), 60, wall, s);
    expect(s.mode).toBe('climb');
    expect(s.pos.y).toBeCloseTo(y, 1);
    expect(s.stamina).toBeLessThan(st);
  });

  it('tops out onto walkable ground', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 60 * 12, wall);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(12, 0);
  });

  it('falls when stamina runs out', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 90, wall);
    s.stamina = 0.1;
    run({ ...idle(), move: { x: 1, z: 0 } }, 12, wall, s);
    expect(s.mode).toBe('air');
  });

  it('jumps off the wall', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 90, wall);
    stepController(s, { ...idle(), jump: true }, wall, 1 / 60);
    expect(s.mode).toBe('air');
    expect(s.vel.y).toBeGreaterThan(0);
    expect(s.vel.x).toBeLessThan(0); // pushed away from the wall
  });

  it('blocks walking up a steep slope with empty stamina', () => {
    const s = createControllerState({ x: 0, y: 0, z: 0 });
    s.stamina = 0;
    run({ ...idle(), move: { x: 1, z: 0 } }, 120, wall, s);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeLessThan(0.5);
  });
});

describe('stepController — fly', () => {
  const airborne = (y = 6) => { const s = createControllerState({ x: 0, y, z: 0 }); s.mode = 'air'; s.airborneFor = 0.5; return s; };

  it('takes off from a jump, not from standing on the ground', () => {
    const grounded = run({ ...idle(), fly: true }, 1);
    expect(grounded.mode).not.toBe('fly');
    const s = airborne(1.2);
    stepController(s, { ...idle(), fly: true }, flat, 1 / 60);
    expect(s.mode).toBe('fly');
  });

  it('cruises forward, climbs while ascend is held and sinks gently without it', () => {
    const s = airborne();
    stepController(s, { ...idle(), fly: true }, flat, 1 / 60);
    run({ ...idle(), move: { x: 0, z: -1 }, ascend: true }, 90, flat, s);
    expect(s.mode).toBe('fly');
    expect(s.pos.y).toBeGreaterThan(8);
    expect(s.pos.z).toBeLessThan(-6);
    const y = s.pos.y;
    run({ ...idle(), move: { x: 0, z: -1 } }, 150, flat, s);
    expect(s.pos.y).toBeLessThan(y);
    expect(s.pos.y).toBeGreaterThan(y - 4);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeCloseTo(CONTROLLER.flySpeed, 0);
    expect(s.stamina).toBeLessThan(CONTROLLER.maxStamina);
  });

  it('boosts with sprint and dives with descend, landing on the ground', () => {
    const s = airborne(20);
    stepController(s, { ...idle(), fly: true }, flat, 1 / 60);
    run({ ...idle(), move: { x: 1, z: 0 }, sprint: true }, 90, flat, s);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeGreaterThan(CONTROLLER.flySpeed + 2);
    run({ ...idle(), descend: true }, 60 * 4, flat, s);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(0);
  });

  it('stops flying on request and when stamina runs out', () => {
    const s = airborne(30);
    stepController(s, { ...idle(), fly: true }, flat, 1 / 60);
    stepController(s, { ...idle(), stopFly: true }, flat, 1 / 60);
    expect(s.mode).toBe('air');
    const t = airborne(30);
    stepController(t, { ...idle(), fly: true }, flat, 1 / 60);
    t.stamina = 0.05;
    run(idle(), 10, flat, t);
    expect(t.mode).toBe('air');
  });

  it('does not fly through walls', () => {
    const block: WorldQuery = { heightAt: (x) => (x >= 5 ? 30 : 0) };
    const s = airborne(6);
    stepController(s, { ...idle(), fly: true }, block, 1 / 60);
    run({ ...idle(), move: { x: 1, z: 0 } }, 120, block, s);
    expect(s.pos.x).toBeLessThan(5);
  });
});

describe('stepController — vertical walls (landmark footprints)', () => {
  /** An 8 m block occupying x in [3, 40]. */
  const block: WorldQuery = { heightAt: (x) => (x >= 3 && x <= 40 ? 8 : 0) };

  it('does not teleport onto a wall top; it starts climbing at the base', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 60, block);
    expect(s.mode).toBe('climb');
    expect(s.pos.x).toBeLessThan(3.2);
    expect(s.pos.y).toBeLessThan(4);
  });

  it('climbs the wall vertically and tops out onto the roof', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 60 * 6, block);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(8, 1);
    expect(s.pos.x).toBeGreaterThan(3);
  });

  it('climbs back down with reverse input and stands at the base', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 60 * 3, block);
    expect(s.mode).toBe('climb');
    const y = s.pos.y;
    run({ ...idle(), move: { x: -1, z: 0 } }, 60 * 4, block, s);
    expect(s.pos.y).toBeLessThan(y);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(0, 1);
  });
});

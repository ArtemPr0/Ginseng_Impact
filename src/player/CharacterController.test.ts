import { describe, expect, it } from 'vitest';
import { CONTROLLER, createControllerState, startDash, stepController, type ControllerInput, type WorldQuery } from './CharacterController';

const flat: WorldQuery = { heightAt: () => 0 };
const idle = (): ControllerInput => ({ move: { x: 0, z: 0 }, sprint: false, jump: false, jumpHeld: false, fly: false });

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
    // (Half a second: after that the bar refills and the hero may grab the wall again.)
    run({ ...idle(), move: { x: 1, z: 0 } }, 30, wall, s);
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

  it('cruises forward, climbs while ascend is held and falls, faster and faster, without it', () => {
    const s = airborne();
    stepController(s, { ...idle(), fly: true }, flat, 1 / 60);
    run({ ...idle(), move: { x: 0, z: -1 }, ascend: true }, 90, flat, s);
    expect(s.mode).toBe('fly');
    expect(s.pos.y).toBeGreaterThan(8);
    expect(s.pos.z).toBeLessThan(-6);
    const y = s.pos.y;
    run({ ...idle(), move: { x: 0, z: -1 } }, 60, flat, s);
    const vy1 = s.vel.y;
    run({ ...idle(), move: { x: 0, z: -1 } }, 60, flat, s);
    expect(s.mode).toBe('fly');
    expect(s.vel.y).toBeLessThan(vy1);
    expect(s.vel.y).toBeLessThan(-5);
    expect(s.pos.y).toBeLessThan(y - 1);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeCloseTo(CONTROLLER.flySpeed, 0);
    expect(s.stamina).toBeLessThan(CONTROLLER.maxStamina);
    // Space again catches the fall.
    run({ ...idle(), ascend: true }, 60, flat, s);
    expect(s.vel.y).toBeGreaterThan(0);
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

describe('stepController — stamina', () => {
  it('drains at the drain scale (the rowers\' ale halves it)', () => {
    const sprint = { ...idle(), move: { x: 1, z: 0 }, sprint: true };
    const a = run(sprint, 60);
    const b = createControllerState({ x: 0, y: 0, z: 0 });
    b.drainScale = 0.5;
    run(sprint, 60, flat, b);
    expect(CONTROLLER.maxStamina - b.stamina).toBeCloseTo((CONTROLLER.maxStamina - a.stamina) / 2, 1);
  });
});

describe('stepController — slowed', () => {
  it('walks at the speed scale (a puddle of lean)', () => {
    const s = createControllerState({ x: 0, y: 0, z: 0 });
    s.speedScale = 0.6;
    run({ ...idle(), move: { x: 1, z: 0 } }, 60, flat, s);
    expect(s.pos.x).toBeLessThan(CONTROLLER.walkSpeed * 0.65);
    expect(s.pos.x).toBeGreaterThan(CONTROLLER.walkSpeed * 0.5);
  });
});

describe('stepController — thrown', () => {
  it('flies where it was thrown, unsteered, then lands and takes control back', () => {
    const s = createControllerState({ x: 0, y: 3, z: 0 });
    s.mode = 'air';
    s.vel = { x: 16, y: 9.5, z: 0 };
    s.flung = 1.5;
    run(idle(), 120, flat, s);
    expect(s.mode).toBe('ground');
    expect(s.pos.x).toBeGreaterThan(10);
    expect(s.flung).toBe(0);
  });
});

describe('stepController — swim', () => {
  /** Dry land for x < 4, a bank down to a 3 m deep channel beyond, water surface at 1. */
  const river: WorldQuery = {
    heightAt: (x) => (x < 4 ? 0 : Math.max(-2, -(x - 4) * 0.8)),
    waterAt: (x) => (x >= 3 ? 1 : null),
  };

  it('wades in until the water floats you, then swims at the surface', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 60 * 3, river);
    expect(s.mode).toBe('swim');
    run(idle(), 120, river, s);
    expect(s.pos.y).toBeCloseTo(1 - CONTROLLER.swimFloat, 0);
    const x = s.pos.x;
    run({ ...idle(), move: { x: 1, z: 0 } }, 60, river, s);
    expect(s.pos.x - x).toBeGreaterThan(1.5);
    expect(s.pos.x - x).toBeLessThan(CONTROLLER.swimSpeed + 0.2);
  });

  it('walks back out where it shallows, and falling in splashes down into a swim', () => {
    const s = run({ ...idle(), move: { x: 1, z: 0 } }, 60 * 4, river);
    run({ ...idle(), move: { x: -1, z: 0 } }, 60 * 6, river, s);
    expect(s.mode).toBe('ground');
    expect(s.pos.x).toBeLessThan(4);
    const t = createControllerState({ x: 9, y: 6, z: 0 });
    t.mode = 'air';
    run(idle(), 120, river, t);
    expect(t.mode).toBe('swim');
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

describe('stepController — dash (the dodge roll)', () => {
  it('carries the hero at least 3.5 m and is over within 0.3 s, ending in a walk (no long slide)', () => {
    const s = createControllerState({ x: 0, y: 0, z: 0 });
    startDash(s, { x: 1, z: 0 });
    run(idle(), 18, flat, s); // 0.3 s
    expect(s.pos.x).toBeGreaterThanOrEqual(3.5);
    expect(s.dashLeft).toBe(0);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(0);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeLessThanOrEqual(CONTROLLER.walkSpeed + 1e-9);
    const x = s.pos.x;
    run(idle(), 30, flat, s);
    expect(s.pos.x - x).toBeLessThan(0.5);
    expect(Math.hypot(s.vel.x, s.vel.z)).toBeCloseTo(0);
  });

  it('holds its direction and speed against the stick and the ground drag while it lasts', () => {
    const s = createControllerState({ x: 0, y: 0, z: 0 });
    startDash(s, { x: 0, z: -1 });
    run({ ...idle(), move: { x: 1, z: 0 } }, 6, flat, s); // 0.1 s in
    expect(s.dashLeft).toBeGreaterThan(0);
    expect(s.vel.z).toBeCloseTo(-CONTROLLER.dashSpeed);
    expect(s.vel.x).toBeCloseTo(0);
  });

  it('normalises the direction, and backsteps when there is none', () => {
    const s = createControllerState({ x: 0, y: 0, z: 0 });
    startDash(s, { x: 3, z: 4 });
    expect(s.dashDir.x).toBeCloseTo(0.6);
    expect(s.dashDir.z).toBeCloseTo(0.8);
    const t = createControllerState({ x: 0, y: 0, z: 0 });
    t.yaw = 0; // faces +x
    startDash(t, { x: 0, z: 0 });
    expect(t.dashDir.x).toBeCloseTo(-1);
    expect(t.dashDir.z).toBeCloseTo(0);
  });

  it('cannot be jumped out of (the roll finishes on the ground)', () => {
    const s = createControllerState({ x: 0, y: 0, z: 0 });
    startDash(s, { x: 1, z: 0 });
    run({ ...idle(), jump: true, jumpHeld: true }, 6, flat, s);
    expect(s.mode).toBe('ground');
    expect(s.pos.y).toBeCloseTo(0);
  });
});

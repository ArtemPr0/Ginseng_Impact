/**
 * Kinematic third-person controller. Pure: no Three.js, no DOM. Mutates the passed state in place
 * and returns it. Modes: ground, air (M1); climb, glide (M2).
 */
export type Mode = 'ground' | 'air' | 'climb' | 'glide';

export interface Vec3 { x: number; y: number; z: number }

export interface ControllerState {
  pos: Vec3;
  vel: Vec3;
  /** Facing angle, radians; 0 faces +x, π/2 faces +z (atan2(z, x)). */
  yaw: number;
  mode: Mode;
  stamina: number;
  /** Seconds since the mode last changed. */
  modeTime: number;
  /** Seconds the character has been grounded (used for coyote time). */
  groundedFor: number;
  airborneFor: number;
  /** Seconds since stamina was last spent. */
  staminaIdle: number;
}

export interface ControllerInput {
  /** World-space move direction, length ≤ 1 (already rotated by camera yaw). */
  move: { x: number; z: number };
  sprint: boolean;
  /** Edge: jump pressed this step. */
  jump: boolean;
  jumpHeld: boolean;
  /** Edge: glide toggled this step. */
  glide: boolean;
  climbHeld: boolean;
}

export interface WorldQuery {
  heightAt(x: number, z: number): number;
}

export const CONTROLLER = {
  walkSpeed: 4.5,
  sprintSpeed: 8,
  groundAccel: 40,
  groundDecel: 50,
  airAccel: 12,
  turnRate: 14,
  gravity: 24,
  jumpSpeed: 8.6,
  coyoteTime: 0.12,
  maxStamina: 100,
  sprintDrain: 15,
  staminaRegen: 25,
  staminaRegenDelay: 0.6,
  groundSnap: 0.35,
} as const;

export function createControllerState(pos: Vec3): ControllerState {
  return {
    pos: { ...pos },
    vel: { x: 0, y: 0, z: 0 },
    yaw: -Math.PI / 2,
    mode: 'ground',
    stamina: CONTROLLER.maxStamina,
    modeTime: 0,
    groundedFor: 0,
    airborneFor: 0,
    staminaIdle: 0,
  };
}

function setMode(s: ControllerState, mode: Mode): void {
  if (s.mode !== mode) {
    s.mode = mode;
    s.modeTime = 0;
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  const d = target - current;
  if (Math.abs(d) <= maxDelta) return target;
  return current + Math.sign(d) * maxDelta;
}

function turnToward(yaw: number, target: number, maxDelta: number): number {
  let d = target - yaw;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  if (Math.abs(d) <= maxDelta) return target;
  return yaw + Math.sign(d) * maxDelta;
}

export function stepController(s: ControllerState, input: ControllerInput, world: WorldQuery, dt: number): ControllerState {
  s.modeTime += dt;
  const moveLen = Math.hypot(input.move.x, input.move.z);
  const wantsMove = moveLen > 0.01;
  const canSprint = input.sprint && wantsMove && s.stamina > 0;

  // --- horizontal velocity ---
  const targetSpeed = wantsMove ? (canSprint ? CONTROLLER.sprintSpeed : CONTROLLER.walkSpeed) * Math.min(1, moveLen) : 0;
  const tx = wantsMove ? (input.move.x / moveLen) * targetSpeed : 0;
  const tz = wantsMove ? (input.move.z / moveLen) * targetSpeed : 0;
  const grounded = s.mode === 'ground';
  const accel = grounded ? (wantsMove ? CONTROLLER.groundAccel : CONTROLLER.groundDecel) : CONTROLLER.airAccel;
  s.vel.x = approach(s.vel.x, tx, accel * dt);
  s.vel.z = approach(s.vel.z, tz, accel * dt);

  if (wantsMove) {
    s.yaw = turnToward(s.yaw, Math.atan2(input.move.z, input.move.x), CONTROLLER.turnRate * dt);
  }

  // --- stamina ---
  if (canSprint) {
    s.stamina = Math.max(0, s.stamina - CONTROLLER.sprintDrain * dt);
    s.staminaIdle = 0;
  } else {
    s.staminaIdle += dt;
    if (s.staminaIdle >= CONTROLLER.staminaRegenDelay) {
      s.stamina = Math.min(CONTROLLER.maxStamina, s.stamina + CONTROLLER.staminaRegen * dt);
    }
  }

  // --- vertical ---
  if (grounded) {
    s.groundedFor += dt;
    s.airborneFor = 0;
  } else {
    s.airborneFor += dt;
    s.groundedFor = 0;
  }

  const canJump = grounded || (s.mode === 'air' && s.airborneFor <= CONTROLLER.coyoteTime && s.vel.y <= 0);
  if (input.jump && canJump) {
    s.vel.y = CONTROLLER.jumpSpeed;
    setMode(s, 'air');
  }

  if (s.mode === 'air') {
    s.vel.y -= CONTROLLER.gravity * dt;
  }

  // --- integrate ---
  s.pos.x += s.vel.x * dt;
  s.pos.z += s.vel.z * dt;
  s.pos.y += s.vel.y * dt;

  // --- ground contact ---
  const ground = world.heightAt(s.pos.x, s.pos.z);
  if (s.mode === 'ground') {
    if (s.pos.y <= ground + CONTROLLER.groundSnap) {
      s.pos.y = ground;
      s.vel.y = 0;
    } else {
      setMode(s, 'air');
    }
  } else if (s.mode === 'air' && s.vel.y <= 0 && s.pos.y <= ground) {
    s.pos.y = ground;
    s.vel.y = 0;
    setMode(s, 'ground');
  }

  return s;
}

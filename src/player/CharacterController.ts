/**
 * Kinematic third-person controller. Pure: no Three.js, no DOM. Mutates the passed state in place
 * and returns it. Modes: ground, air, climb (steep terrain and walls), fly (each hero's own way of flying:
 * Orlan levitates, Sir Aldric spreads his cape, Wren rides her bow), swim (water deeper than chest height).
 */
export type Mode = 'ground' | 'air' | 'climb' | 'fly' | 'swim';

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
  groundedFor: number;
  airborneFor: number;
  /** Seconds since stamina was last spent. */
  staminaIdle: number;
  /** Unit horizontal direction into the climbed surface. */
  climbDir: { x: number; z: number };
  /** Seconds left of a buffered jump press (pressed just before landing). */
  jumpBuffer: number;
}

export interface ControllerInput {
  /** World-space move direction, length ≤ 1 (already rotated by camera yaw). */
  move: { x: number; z: number };
  sprint: boolean;
  /** Edge: jump pressed this step. */
  jump: boolean;
  jumpHeld: boolean;
  /** Edge: take off (in the air) — the same key as jump. */
  fly: boolean;
  /** Held while flying: climb / dive. */
  ascend?: boolean;
  descend?: boolean;
  /** Edge: stop flying and fall. */
  stopFly?: boolean;
  climbHeld: boolean;
}

export interface WorldQuery {
  /** Surface height under (x, z); with `y` (the asker's feet) overhangs they fit under are skipped. */
  heightAt(x: number, z: number, y?: number): number;
  /** Underside of the lowest overhang above feet at `y` (a bridge deck), or Infinity. */
  ceilingAt?(x: number, z: number, y: number): number;
  /** Height of the water surface at (x, z), or null where there is no water. */
  waterAt?(x: number, z: number): number | null;
}

/** True when (x, z) is water deep enough to swim in for feet at `y`; returns the surface height (else null). */
function swimmable(world: WorldQuery, x: number, z: number, y: number): number | null {
  const w = world.waterAt?.(x, z);
  if (w === undefined || w === null) return null;
  return w - world.heightAt(x, z, y) >= CONTROLLER.swimDepth ? w : null;
}

/** Height of a hero's head above the feet (for ceilings). */
const HEAD = 1.8;

/** Stops a rise into an overhang: the head meets the deck's underside instead of passing through it. */
function bumpCeiling(world: WorldQuery, s: ControllerState, startY: number): void {
  if (!world.ceilingAt || s.pos.y <= startY) return;
  const c = world.ceilingAt(s.pos.x, s.pos.z, startY);
  if (s.pos.y + HEAD > c) { s.pos.y = Math.max(startY, c - HEAD); if (s.vel.y > 0) s.vel.y = 0; }
}

export const CONTROLLER = {
  walkSpeed: 4.5,
  sprintSpeed: 8,
  groundAccel: 40,
  groundDecel: 50,
  airAccel: 16,
  turnRate: 14,
  gravity: 26,
  /** Gravity multiplier while falling: a quick, weighty descent instead of a floaty one. */
  fallGravity: 1.55,
  /** Releasing jump while rising cuts the rise to this fraction (short hops). */
  jumpCut: 0.45,
  jumpSpeed: 9.6,
  jumpBufferTime: 0.14,
  coyoteTime: 0.12,
  maxFallSpeed: 38,
  maxStamina: 100,
  sprintDrain: 15,
  staminaRegen: 25,
  staminaRegenDelay: 0.6,
  groundSnap: 0.35,
  /** tan(angle): slopes steeper than this are climbed, not walked. */
  walkableGradient: 1.2,
  slideSpeed: 5,
  climbSpeed: 2.2,
  climbDrain: 10,
  climbJumpSpeed: 7,
  climbPush: 3,
  /** A rise taller than this within one step is a wall, whatever the sampled gradient says. */
  stepHeight: 0.5,
  climbProbe: 0.6,
  /** Flight: cruise and boosted speed, climb and dive rates. */
  flySpeed: 9,
  flyBoostSpeed: 14,
  flyAccel: 10,
  flyClimbSpeed: 5.5,
  flyDiveSpeed: 14,
  /** Letting go of the climb key: the hero drops, faster and faster, up to this speed (Space catches the fall). */
  flyFallSpeed: 9,
  flyFallAccel: 7,
  flyDrain: 5,
  flyClimbDrain: 9,
  flyBoostDrain: 8,
  /** Seconds in the air (or metres above the ground) before taking off is allowed. */
  flyMinAirTime: 0.12,
  /** Highest flight above the surface below. */
  flyCeiling: 55,
  /** Stamina needed to take off. */
  flyMinStamina: 8,
  /** Swimming: water at least this deep (surface over the bed) floats you; the feet hang this far under the surface. */
  swimDepth: 1.3,
  swimFloat: 1.05,
  swimSpeed: 2.6,
  swimSprintSpeed: 4.4,
  swimAccel: 6,
  swimSprintDrain: 12,
  /** Jumping out at a bank: the ground just ahead must be at most this far above the surface. */
  swimClimbOut: 0.9,
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
    climbDir: { x: 1, z: 0 },
    jumpBuffer: 0,
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

/** Finite-difference terrain gradient: (gx, gz) points uphill, g = |gradient| = tan(slope). */
function gradientAt(world: WorldQuery, x: number, z: number, y?: number): { gx: number; gz: number; g: number } {
  const e = 0.5;
  const gx = (world.heightAt(x + e, z, y) - world.heightAt(x - e, z, y)) / (2 * e);
  const gz = (world.heightAt(x, z + e, y) - world.heightAt(x, z - e, y)) / (2 * e);
  return { gx, gz, g: Math.hypot(gx, gz) };
}

/** True only when the ground under the character is steep on both sides (a slope, not the base of a wall). */
function onSteepSlope(world: WorldQuery, x: number, z: number, y?: number): boolean {
  const e = 0.5;
  const h = world.heightAt(x, z, y);
  const gxp = Math.abs(world.heightAt(x + e, z, y) - h) / e;
  const gxm = Math.abs(h - world.heightAt(x - e, z, y)) / e;
  const gzp = Math.abs(world.heightAt(x, z + e, y) - h) / e;
  const gzm = Math.abs(h - world.heightAt(x, z - e, y)) / e;
  const g = Math.hypot(Math.min(gxp, gxm), Math.min(gzp, gzm));
  return g > CONTROLLER.walkableGradient;
}

function spendStamina(s: ControllerState, amount: number): void {
  s.stamina = Math.max(0, s.stamina - amount);
  s.staminaIdle = 0;
}

/**
 * Horizontal move from (x, z) by (dx, dz) for something whose feet are at `y`: returns false when a wall taller
 * than a step stands in the way (the caller then climbs, stops, or slides).
 */
function blockedAhead(world: WorldQuery, x: number, z: number, dx: number, dz: number, y: number): boolean {
  return world.heightAt(x + dx, z + dz, y) > y + CONTROLLER.stepHeight;
}

/** Turns a horizontal velocity that runs into a wall into a slide along it (keeps the free axis). */
function slideAlongWall(world: WorldQuery, s: ControllerState, dt: number): void {
  const y = s.pos.y;
  const fx = !blockedAhead(world, s.pos.x, s.pos.z, s.vel.x * dt, 0, y);
  const fz = !blockedAhead(world, s.pos.x, s.pos.z, 0, s.vel.z * dt, y);
  if (!fx) s.vel.x = 0;
  if (!fz) s.vel.z = 0;
  if (fx && fz && blockedAhead(world, s.pos.x, s.pos.z, s.vel.x * dt, s.vel.z * dt, y)) { s.vel.x = 0; s.vel.z = 0; }
}

export function stepController(s: ControllerState, input: ControllerInput, world: WorldQuery, dt: number): ControllerState {
  s.modeTime += dt;
  const moveLen = Math.hypot(input.move.x, input.move.z);
  const wantsMove = moveLen > 0.01;
  const mx = wantsMove ? input.move.x / moveLen : 0;
  const mz = wantsMove ? input.move.z / moveLen : 0;
  const moveScale = Math.min(1, moveLen);
  let spent = false;

  if (s.mode === 'ground') s.groundedFor += dt; else s.groundedFor = 0;
  if (s.mode !== 'ground') s.airborneFor += dt; else s.airborneFor = 0;
  if (input.jump) s.jumpBuffer = CONTROLLER.jumpBufferTime; else s.jumpBuffer = Math.max(0, s.jumpBuffer - dt);

  switch (s.mode) {
    case 'ground': {
      const canSprint = input.sprint && wantsMove && s.stamina > 0;
      const here = gradientAt(world, s.pos.x, s.pos.z, s.pos.y);
      let tx = 0;
      let tz = 0;
      if (here.g > 0 && onSteepSlope(world, s.pos.x, s.pos.z, s.pos.y)) {
        // Standing on a cliff face without climbing: slide down.
        tx = (-here.gx / here.g) * CONTROLLER.slideSpeed;
        tz = (-here.gz / here.g) * CONTROLLER.slideSpeed;
      } else if (wantsMove) {
        const speed = (canSprint ? CONTROLLER.sprintSpeed : CONTROLLER.walkSpeed) * moveScale;
        tx = mx * speed;
        tz = mz * speed;
      }
      const accel = wantsMove ? CONTROLLER.groundAccel : CONTROLLER.groundDecel;
      s.vel.x = approach(s.vel.x, tx, accel * dt);
      s.vel.z = approach(s.vel.z, tz, accel * dt);
      if (wantsMove) s.yaw = turnToward(s.yaw, Math.atan2(mz, mx), CONTROLLER.turnRate * dt);
      if (canSprint) {
        spendStamina(s, CONTROLLER.sprintDrain * dt);
        spent = true;
      }
      if (input.jump || s.jumpBuffer > 0) {
        s.jumpBuffer = 0;
        s.vel.y = CONTROLLER.jumpSpeed;
        setMode(s, 'air');
        slideAlongWall(world, s, dt);
        s.pos.x += s.vel.x * dt;
        s.pos.z += s.vel.z * dt;
        s.pos.y += s.vel.y * dt;
        break;
      }
      const oldY = s.pos.y;
      const nx = s.pos.x + s.vel.x * dt;
      const nz = s.pos.z + s.vel.z * dt;
      const ground = world.heightAt(nx, nz, oldY);
      const ahead = gradientAt(world, nx, nz, oldY);
      const rise = ground - oldY;
      const steep = (ahead.g > CONTROLLER.walkableGradient && rise > 0.05) || rise > CONTROLLER.stepHeight;
      if (steep) {
        if (wantsMove && s.stamina > 0) {
          // Stay at the base; climbing moves us from here.
          s.climbDir = { x: mx, z: mz };
          s.vel.x = s.vel.z = s.vel.y = 0;
          s.yaw = Math.atan2(mz, mx);
          setMode(s, 'climb');
        } else {
          s.vel.x = s.vel.z = 0; // blocked
        }
        break;
      }
      s.pos.x = nx;
      s.pos.z = nz;
      if (rise >= -CONTROLLER.groundSnap) {
        s.pos.y = ground;
        s.vel.y = 0;
      } else {
        setMode(s, 'air');
      }
      // Wading in until the water is deep enough to float.
      const surface = swimmable(world, s.pos.x, s.pos.z, s.pos.y);
      if (surface !== null && s.pos.y <= surface - CONTROLLER.swimFloat) setMode(s, 'swim');
      break;
    }

    case 'air': {
      // Keep the speed you jumped with (a sprint jump carries), steer toward the stick.
      const carried = Math.max(CONTROLLER.walkSpeed, Math.hypot(s.vel.x, s.vel.z));
      s.vel.x = approach(s.vel.x, mx * carried * moveScale, CONTROLLER.airAccel * dt);
      s.vel.z = approach(s.vel.z, mz * carried * moveScale, CONTROLLER.airAccel * dt);
      if (wantsMove) s.yaw = turnToward(s.yaw, Math.atan2(mz, mx), CONTROLLER.turnRate * dt);
      const groundHere = world.heightAt(s.pos.x, s.pos.z, s.pos.y);
      if (input.jump && s.airborneFor <= CONTROLLER.coyoteTime && s.vel.y <= 0) {
        s.vel.y = CONTROLLER.jumpSpeed;
      } else if (input.fly && s.stamina >= CONTROLLER.flyMinStamina && (s.airborneFor >= CONTROLLER.flyMinAirTime || s.pos.y - groundHere > 1)) {
        setMode(s, 'fly');
        s.vel.y = Math.max(s.vel.y, 2.5);
        s.jumpBuffer = 0;
        break;
      }
      // Short hop: letting go of jump while still rising cuts the rise.
      if (!input.jumpHeld && s.vel.y > 0 && s.modeTime > 0.05) s.vel.y *= Math.pow(CONTROLLER.jumpCut, dt * 12);
      s.vel.y -= CONTROLLER.gravity * (s.vel.y < 0 ? CONTROLLER.fallGravity : 1) * dt;
      s.vel.y = Math.max(s.vel.y, -CONTROLLER.maxFallSpeed);
      // A wall in the way: grab it when steering into it, otherwise bounce off it instead of landing on its top.
      if (blockedAhead(world, s.pos.x, s.pos.z, s.vel.x * dt, s.vel.z * dt, s.pos.y)) {
        if (wantsMove && s.stamina > 0 && blockedAhead(world, s.pos.x, s.pos.z, mx * 0.4, mz * 0.4, s.pos.y)) {
          s.climbDir = { x: mx, z: mz };
          s.vel.x = s.vel.z = s.vel.y = 0;
          s.yaw = Math.atan2(mz, mx);
          setMode(s, 'climb');
          break;
        }
        slideAlongWall(world, s, dt);
      }
      const airStartY = s.pos.y;
      s.pos.x += s.vel.x * dt;
      s.pos.z += s.vel.z * dt;
      s.pos.y += s.vel.y * dt;
      bumpCeiling(world, s, airStartY);
      const ground = world.heightAt(s.pos.x, s.pos.z, airStartY);
      const surface = swimmable(world, s.pos.x, s.pos.z, airStartY);
      if (surface !== null && s.vel.y <= 0 && s.pos.y <= surface - CONTROLLER.swimFloat * 0.6) {
        // Splash down: the dive carries a little under, then the water floats you back up.
        s.vel.y *= 0.25;
        setMode(s, 'swim');
        break;
      }
      if (s.vel.y <= 0 && s.pos.y <= ground) {
        s.pos.y = ground;
        s.vel.y = 0;
        setMode(s, 'ground');
      }
      break;
    }

    case 'swim': {
      const surface = world.waterAt?.(s.pos.x, s.pos.z) ?? null;
      const bed = world.heightAt(s.pos.x, s.pos.z, s.pos.y);
      // Out of the water, or into the shallows: stand up and walk.
      if (surface === null || surface - bed < CONTROLLER.swimDepth - 0.15) {
        s.pos.y = Math.max(s.pos.y, bed);
        s.vel.y = 0;
        setMode(s, s.pos.y <= bed + 0.05 ? 'ground' : 'air');
        break;
      }
      const sprinting = input.sprint && wantsMove && s.stamina > 0;
      if (sprinting) { spendStamina(s, CONTROLLER.swimSprintDrain * dt); spent = true; }
      const speed = wantsMove ? (sprinting ? CONTROLLER.swimSprintSpeed : CONTROLLER.swimSpeed) * moveScale : 0;
      s.vel.x = approach(s.vel.x, mx * speed, CONTROLLER.swimAccel * dt);
      s.vel.z = approach(s.vel.z, mz * speed, CONTROLLER.swimAccel * dt);
      if (wantsMove) s.yaw = turnToward(s.yaw, Math.atan2(mz, mx), CONTROLLER.turnRate * 0.5 * dt);
      // Bob up to the floating height (feet under the surface) with a gentle swell.
      const float = surface - CONTROLLER.swimFloat + Math.sin(s.modeTime * 2.1) * 0.04;
      s.vel.y = approach(s.vel.y, (float - s.pos.y) * 3, 12 * dt);
      // Jump out where the bank ahead is low enough to haul yourself onto.
      if (input.jump) {
        const ahead = world.heightAt(s.pos.x + Math.cos(s.yaw) * 0.9, s.pos.z + Math.sin(s.yaw) * 0.9, surface);
        if (ahead <= surface + CONTROLLER.swimClimbOut && surface - ahead < CONTROLLER.swimDepth) {
          s.vel.y = CONTROLLER.jumpSpeed * 0.75;
          s.pos.y = Math.max(s.pos.y, surface - 0.4);
          setMode(s, 'air');
          break;
        }
      }
      if (blockedAhead(world, s.pos.x, s.pos.z, s.vel.x * dt, s.vel.z * dt, s.pos.y + CONTROLLER.swimFloat - 0.3)) slideAlongWall(world, s, dt);
      s.pos.x += s.vel.x * dt;
      s.pos.z += s.vel.z * dt;
      s.pos.y += s.vel.y * dt;
      break;
    }

    case 'climb': {
      // Refine the climb direction from the surface just ahead (handles slopes and vertical steps).
      let { x: ux, z: uz } = s.climbDir;
      const probe = gradientAt(world, s.pos.x + ux * 0.5, s.pos.z + uz * 0.5, s.pos.y);
      if (probe.g > 0.5) {
        ux = probe.gx / probe.g;
        uz = probe.gz / probe.g;
        s.climbDir = { x: ux, z: uz };
      }
      s.yaw = Math.atan2(uz, ux);
      spendStamina(s, CONTROLLER.climbDrain * dt);
      spent = true;
      if (input.jump || s.stamina <= 0) {
        s.vel.x = -ux * CONTROLLER.climbPush;
        s.vel.z = -uz * CONTROLLER.climbPush;
        s.vel.y = input.jump ? CONTROLLER.climbJumpSpeed : 0;
        setMode(s, 'air');
        s.pos.x += s.vel.x * dt;
        s.pos.z += s.vel.z * dt;
        s.pos.y += s.vel.y * dt;
        break;
      }
      const up = (mx * ux + mz * uz) * moveScale;
      const rx = -uz;
      const rz = ux;
      const side = (mx * rx + mz * rz) * moveScale;
      const cosSlope = 1 / Math.sqrt(1 + probe.g * probe.g);
      const step = CONTROLLER.climbSpeed * dt;
      const startX = s.pos.x;
      const startZ = s.pos.z;
      // Vertical motion along the surface.
      s.pos.y += step * up;
      // Horizontal advance into the surface, only while the surface ahead is not far above us.
      const adv = step * up * cosSlope;
      const ax = s.pos.x + ux * adv;
      const az = s.pos.z + uz * adv;
      if (world.heightAt(ax, az, s.pos.y) <= s.pos.y + 0.4) {
        s.pos.x = ax;
        s.pos.z = az;
      }
      // Sideways along the surface.
      const sx = s.pos.x + rx * side * step;
      const sz = s.pos.z + rz * side * step;
      if (world.heightAt(sx, sz, s.pos.y) <= s.pos.y + 0.4) {
        s.pos.x = sx;
        s.pos.z = sz;
      }
      const under = world.heightAt(s.pos.x, s.pos.z, s.pos.y);
      if (s.pos.y < under) s.pos.y = under;
      s.vel.x = (s.pos.x - startX) / dt;
      s.vel.z = (s.pos.z - startZ) / dt;
      s.vel.y = 0;
      // Top-out: the surface ahead is at our height and walkable.
      const topX = s.pos.x + ux * CONTROLLER.climbProbe;
      const topZ = s.pos.z + uz * CONTROLLER.climbProbe;
      const topH = world.heightAt(topX, topZ, s.pos.y);
      if (topH <= s.pos.y + 0.3 && gradientAt(world, topX, topZ, s.pos.y).g < CONTROLLER.walkableGradient) {
        s.pos.x = topX;
        s.pos.z = topZ;
        s.pos.y = topH;
        setMode(s, 'ground');
        break;
      }
      // Reached the bottom while descending onto walkable ground.
      if (up <= 0 && s.pos.y <= under + 0.01 && gradientAt(world, s.pos.x, s.pos.z, s.pos.y).g < CONTROLLER.walkableGradient) {
        s.pos.y = under;
        setMode(s, 'ground');
      }
      break;
    }

    case 'fly': {
      if (input.stopFly || s.stamina <= 0) {
        setMode(s, 'air');
        break;
      }
      const boost = input.sprint && wantsMove;
      const ground = world.heightAt(s.pos.x, s.pos.z, s.pos.y);
      const climbing = !!input.ascend && s.pos.y - ground < CONTROLLER.flyCeiling;
      spendStamina(s, (CONTROLLER.flyDrain + (climbing ? CONTROLLER.flyClimbDrain : 0) + (boost ? CONTROLLER.flyBoostDrain : 0)) * dt);
      spent = true;
      if (climbing) s.vel.y = approach(s.vel.y, CONTROLLER.flyClimbSpeed, 12 * dt);
      else if (input.descend) s.vel.y = approach(s.vel.y, -CONTROLLER.flyDiveSpeed, 18 * dt);
      else s.vel.y = approach(s.vel.y, -CONTROLLER.flyFallSpeed, CONTROLLER.flyFallAccel * dt);
      const speed = wantsMove ? (boost ? CONTROLLER.flyBoostSpeed : CONTROLLER.flySpeed) * moveScale : 0;
      s.vel.x = approach(s.vel.x, mx * speed, (wantsMove ? CONTROLLER.flyAccel : 4) * dt);
      s.vel.z = approach(s.vel.z, mz * speed, (wantsMove ? CONTROLLER.flyAccel : 4) * dt);
      if (wantsMove) s.yaw = turnToward(s.yaw, Math.atan2(mz, mx), CONTROLLER.turnRate * 0.6 * dt);
      if (blockedAhead(world, s.pos.x, s.pos.z, s.vel.x * dt, s.vel.z * dt, s.pos.y)) slideAlongWall(world, s, dt);
      const flyStartY = s.pos.y;
      s.pos.x += s.vel.x * dt;
      s.pos.z += s.vel.z * dt;
      s.pos.y += s.vel.y * dt;
      bumpCeiling(world, s, flyStartY);
      const below = world.heightAt(s.pos.x, s.pos.z, flyStartY);
      if (s.pos.y <= below) {
        s.pos.y = below;
        s.vel.y = 0;
        setMode(s, 'ground');
      }
      break;
    }
  }

  if (!spent) {
    s.staminaIdle += dt;
    if (s.staminaIdle >= CONTROLLER.staminaRegenDelay) {
      s.stamina = Math.min(CONTROLLER.maxStamina, s.stamina + CONTROLLER.staminaRegen * dt);
    }
  }
  return s;
}

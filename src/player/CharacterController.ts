/**
 * Kinematic third-person controller. Pure: no Three.js, no DOM. Mutates the passed state in place
 * and returns it. Modes: ground, air, climb (steep terrain), glide.
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
  groundedFor: number;
  airborneFor: number;
  /** Seconds since stamina was last spent. */
  staminaIdle: number;
  /** Unit horizontal direction into the climbed surface. */
  climbDir: { x: number; z: number };
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
  glideFallSpeed: 1.9,
  glideSpeed: 6.5,
  glideAccel: 9,
  glideDrain: 7,
  glideMinHeight: 2.5,
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
function gradientAt(world: WorldQuery, x: number, z: number): { gx: number; gz: number; g: number } {
  const e = 0.5;
  const gx = (world.heightAt(x + e, z) - world.heightAt(x - e, z)) / (2 * e);
  const gz = (world.heightAt(x, z + e) - world.heightAt(x, z - e)) / (2 * e);
  return { gx, gz, g: Math.hypot(gx, gz) };
}

/** True only when the ground under the character is steep on both sides (a slope, not the base of a wall). */
function onSteepSlope(world: WorldQuery, x: number, z: number): boolean {
  const e = 0.5;
  const h = world.heightAt(x, z);
  const gxp = Math.abs(world.heightAt(x + e, z) - h) / e;
  const gxm = Math.abs(h - world.heightAt(x - e, z)) / e;
  const gzp = Math.abs(world.heightAt(x, z + e) - h) / e;
  const gzm = Math.abs(h - world.heightAt(x, z - e)) / e;
  const g = Math.hypot(Math.min(gxp, gxm), Math.min(gzp, gzm));
  return g > CONTROLLER.walkableGradient;
}

function spendStamina(s: ControllerState, amount: number): void {
  s.stamina = Math.max(0, s.stamina - amount);
  s.staminaIdle = 0;
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

  switch (s.mode) {
    case 'ground': {
      const canSprint = input.sprint && wantsMove && s.stamina > 0;
      const here = gradientAt(world, s.pos.x, s.pos.z);
      let tx = 0;
      let tz = 0;
      if (here.g > 0 && onSteepSlope(world, s.pos.x, s.pos.z)) {
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
      if (input.jump) {
        s.vel.y = CONTROLLER.jumpSpeed;
        setMode(s, 'air');
        s.pos.x += s.vel.x * dt;
        s.pos.z += s.vel.z * dt;
        s.pos.y += s.vel.y * dt;
        break;
      }
      const oldY = s.pos.y;
      const nx = s.pos.x + s.vel.x * dt;
      const nz = s.pos.z + s.vel.z * dt;
      const ground = world.heightAt(nx, nz);
      const ahead = gradientAt(world, nx, nz);
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
      break;
    }

    case 'air': {
      s.vel.x = approach(s.vel.x, mx * CONTROLLER.walkSpeed * moveScale, CONTROLLER.airAccel * dt);
      s.vel.z = approach(s.vel.z, mz * CONTROLLER.walkSpeed * moveScale, CONTROLLER.airAccel * dt);
      if (wantsMove) s.yaw = turnToward(s.yaw, Math.atan2(mz, mx), CONTROLLER.turnRate * dt);
      const groundHere = world.heightAt(s.pos.x, s.pos.z);
      if (input.jump && s.airborneFor <= CONTROLLER.coyoteTime && s.vel.y <= 0) {
        s.vel.y = CONTROLLER.jumpSpeed;
      } else if (input.glide && s.stamina > 0 && s.pos.y - groundHere > CONTROLLER.glideMinHeight) {
        setMode(s, 'glide');
        s.vel.y = Math.max(s.vel.y, -CONTROLLER.glideFallSpeed);
        break;
      }
      s.vel.y -= CONTROLLER.gravity * dt;
      s.pos.x += s.vel.x * dt;
      s.pos.z += s.vel.z * dt;
      s.pos.y += s.vel.y * dt;
      const ground = world.heightAt(s.pos.x, s.pos.z);
      if (s.vel.y <= 0 && s.pos.y <= ground) {
        s.pos.y = ground;
        s.vel.y = 0;
        setMode(s, 'ground');
      }
      break;
    }

    case 'climb': {
      // Refine the climb direction from the surface just ahead (handles slopes and vertical steps).
      let { x: ux, z: uz } = s.climbDir;
      const probe = gradientAt(world, s.pos.x + ux * 0.5, s.pos.z + uz * 0.5);
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
      if (world.heightAt(ax, az) <= s.pos.y + 0.4) {
        s.pos.x = ax;
        s.pos.z = az;
      }
      // Sideways along the surface.
      const sx = s.pos.x + rx * side * step;
      const sz = s.pos.z + rz * side * step;
      if (world.heightAt(sx, sz) <= s.pos.y + 0.4) {
        s.pos.x = sx;
        s.pos.z = sz;
      }
      const under = world.heightAt(s.pos.x, s.pos.z);
      if (s.pos.y < under) s.pos.y = under;
      s.vel.x = (s.pos.x - startX) / dt;
      s.vel.z = (s.pos.z - startZ) / dt;
      s.vel.y = 0;
      // Top-out: the surface ahead is at our height and walkable.
      const topX = s.pos.x + ux * CONTROLLER.climbProbe;
      const topZ = s.pos.z + uz * CONTROLLER.climbProbe;
      const topH = world.heightAt(topX, topZ);
      if (topH <= s.pos.y + 0.3 && gradientAt(world, topX, topZ).g < CONTROLLER.walkableGradient) {
        s.pos.x = topX;
        s.pos.z = topZ;
        s.pos.y = topH;
        setMode(s, 'ground');
        break;
      }
      // Reached the bottom while descending onto walkable ground.
      if (up <= 0 && s.pos.y <= under + 0.01 && gradientAt(world, s.pos.x, s.pos.z).g < CONTROLLER.walkableGradient) {
        s.pos.y = under;
        setMode(s, 'ground');
      }
      break;
    }

    case 'glide': {
      spendStamina(s, CONTROLLER.glideDrain * dt);
      spent = true;
      if (input.glide || s.stamina <= 0) {
        setMode(s, 'air');
        break;
      }
      s.vel.y = approach(s.vel.y, -CONTROLLER.glideFallSpeed, 8 * dt);
      const target = wantsMove ? CONTROLLER.glideSpeed * moveScale : 0;
      s.vel.x = approach(s.vel.x, mx * target, (wantsMove ? CONTROLLER.glideAccel : 2) * dt);
      s.vel.z = approach(s.vel.z, mz * target, (wantsMove ? CONTROLLER.glideAccel : 2) * dt);
      if (wantsMove) s.yaw = turnToward(s.yaw, Math.atan2(mz, mx), CONTROLLER.turnRate * dt);
      s.pos.x += s.vel.x * dt;
      s.pos.z += s.vel.z * dt;
      s.pos.y += s.vel.y * dt;
      const ground = world.heightAt(s.pos.x, s.pos.z);
      if (s.pos.y <= ground) {
        s.pos.y = ground;
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

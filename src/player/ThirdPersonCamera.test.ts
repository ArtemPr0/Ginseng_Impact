import { PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { ThirdPersonCamera } from './ThirdPersonCamera';

/** A camera rig over open ground far below (nothing blocks the spring arm), settled on the hero's head at `focus`. */
function rig(focus: Vector3, yaw = 0): ThirdPersonCamera {
  const tpc = new ThirdPersonCamera(new PerspectiveCamera(60, 16 / 9, 0.1, 500), { heightAt: () => -100 });
  tpc.yaw = yaw;
  tpc.snapTo(focus);
  return tpc;
}

/** Runs the rig for `seconds` at 60 frames a second, locked on to `lock`. */
function run(tpc: ThirdPersonCamera, focus: Vector3, lock: Vector3 | undefined, seconds: number): void {
  for (let i = 0; i < Math.round(seconds * 60); i++) tpc.update(focus, 1 / 60, lock);
}

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

describe('ThirdPersonCamera lock-on', () => {
  const head = new Vector3(4, 1.6, -3);

  it('eases the yaw round until it looks over the hero at the target, whichever side it stands', () => {
    for (const [dx, dz] of [[0, -12], [12, 0], [-9, 9], [5, 14], [-14, -2]]) {
      const lock = new Vector3(head.x + dx, 1, head.z + dz);
      const tpc = rig(head, 2.4);
      run(tpc, head, lock, 3);
      // The yaw convention: atan2(-dx, -dz) faces (dx, dz) (yaw 0 looks toward -z).
      expect(wrap(tpc.yaw - Math.atan2(-dx, -dz))).toBeCloseTo(0, 3);
      const look = tpc.forward();
      const to = new Vector3(dx, 0, dz).normalize();
      expect(look.dot(to)).toBeCloseTo(1, 4);
      // Framed: the target sits on the screen's vertical middle line, in front of the camera.
      const onScreen = lock.clone().project(tpc.camera);
      expect(Math.abs(onScreen.x)).toBeLessThan(0.02);
      expect(onScreen.z).toBeLessThan(1);
      // And it is behind the hero as the camera sees them: the camera, the hero, then the target.
      expect(tpc.camera.position.distanceTo(lock)).toBeGreaterThan(tpc.camera.position.distanceTo(head));
    }
  });

  it('eases rather than snaps: one frame turns 1 - e^(-5/60) of the way', () => {
    const lock = new Vector3(head.x + 10, 1, head.z);
    const tpc = rig(head, 0);
    const want = Math.atan2(-10, 0);
    tpc.update(head, 1 / 60, lock);
    expect(tpc.yaw).toBeCloseTo(want * (1 - Math.exp(-5 / 60)), 6);
  });

  it('turns the short way round across ±π', () => {
    const tpc = rig(head, 3.0);
    // The target sits at yaw -3.0: 0.28 rad on round past π, not 6 rad back.
    const want = -3.0;
    const lock = new Vector3(head.x - Math.sin(want) * 10, 1, head.z - Math.cos(want) * 10);
    tpc.update(head, 1 / 60, lock);
    expect(tpc.yaw).toBeGreaterThan(3.0);
    run(tpc, head, lock, 3);
    expect(wrap(tpc.yaw - want)).toBeCloseTo(0, 3);
  });

  it('holds the yaw with no target, and with one closer than 1.5 m (no direction to tell)', () => {
    const tpc = rig(head, 1.1);
    run(tpc, head, undefined, 1);
    expect(tpc.yaw).toBe(1.1);
    run(tpc, head, new Vector3(head.x + 1, 0, head.z + 0.8), 1);
    expect(tpc.yaw).toBe(1.1);
  });

  it('keeps pulling back while locked: the mouse turns the rig, the lock eases it home again', () => {
    const lock = new Vector3(head.x, 1, head.z - 15);
    const tpc = rig(head, 0);
    run(tpc, head, lock, 1);
    tpc.rotate(-400, 0); // a flick of the mouse
    expect(Math.abs(wrap(tpc.yaw))).toBeGreaterThan(0.5);
    run(tpc, head, lock, 3);
    expect(wrap(tpc.yaw)).toBeCloseTo(0, 3);
  });
});

import { PerspectiveCamera, Vector3 } from 'three';

export interface CameraWorld {
  heightAt(x: number, z: number): number;
}

/**
 * Orbit spring-arm camera. Yaw is also the movement reference frame.
 * yaw = 0 looks toward -z (north); positive yaw rotates clockwise when viewed from above.
 */
export class ThirdPersonCamera {
  yaw = 0;
  pitch = 0.22;
  distance = 4.6;
  sensitivity = 0.0022;
  private readonly focus = new Vector3();
  private readonly desired = new Vector3();
  private initialised = false;

  constructor(readonly camera: PerspectiveCamera, private readonly world: CameraWorld) {}

  rotate(dx: number, dy: number): void {
    this.yaw -= dx * this.sensitivity;
    this.pitch = Math.min(1.2, Math.max(-0.35, this.pitch + dy * this.sensitivity));
  }

  /** Converts an input-space axis (x right, z forward) to a world-space direction using the camera yaw. */
  moveToWorld(axis: { x: number; z: number }): { x: number; z: number } {
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    // forward (z=+1) must map to the camera's horizontal look direction: (-sin(yaw), -cos(yaw)).
    return {
      x: axis.x * cos - axis.z * sin,
      z: -axis.x * sin - axis.z * cos,
    };
  }

  /** Forward unit vector on the ground plane. */
  forward(out = new Vector3()): Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  update(target: Vector3, dt: number): void {
    const k = 1 - Math.exp(-dt * 14);
    if (!this.initialised) {
      this.focus.copy(target);
      this.initialised = true;
    } else {
      this.focus.lerp(target, k);
    }
    const cp = Math.cos(this.pitch);
    this.desired.set(
      this.focus.x + Math.sin(this.yaw) * cp * this.distance,
      this.focus.y + Math.sin(this.pitch) * this.distance,
      this.focus.z + Math.cos(this.yaw) * cp * this.distance,
    );
    // Keep the camera above the terrain.
    const floor = this.world.heightAt(this.desired.x, this.desired.z) + 0.6;
    if (this.desired.y < floor) this.desired.y = floor;
    this.camera.position.copy(this.desired);
    this.camera.lookAt(this.focus);
  }

  snapTo(target: Vector3): void {
    this.initialised = false;
    this.update(target, 0);
  }
}

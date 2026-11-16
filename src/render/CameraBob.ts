/**
 * A gentle camera bob while the hero walks (from the user's screenshots of 2026-11-15): the camera rises and falls a
 * few centimetres with each step, a little more at a sprint, and eases out when the hero stops.
 */
export class CameraBob {
  private phase = 0;
  private amp = 0;

  /** Metres to lift the camera this frame, walking at `speed` m/s on the ground (0 off it). */
  step(dt: number, speed: number): number {
    const target = speed < 0.5 ? 0 : Math.min(0.045, 0.006 * speed);
    // (The bob's size follows the pace in a quarter of a second; it never snaps.)
    this.amp += (target - this.amp) * Math.min(1, dt * 4);
    if (this.amp < 1e-4 && target === 0) { this.amp = 0; return 0; }
    // About two steps a second at a walk.
    this.phase += dt * Math.max(speed, 3) * 1.25;
    return Math.sin(this.phase * Math.PI) * this.amp;
  }
}

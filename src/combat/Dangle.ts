/**
 * A body held by the neck (Sir Aldric's fist, Orlan's mind) swinging from its grip (playtest 2026-11-17: "make it
 * swing in a realistic and funny way"): a spherical pendulum of length `len` hung under the grip. When the holder
 * moves off, the body lags and swings back; when he stops it overshoots, then settles. `dx`, `dz` are the feet's offset
 * from straight under the grip; `tiltX`, `tiltZ` the body's tilt to match. Pure.
 */
const G = 9.81;
/** Damping: a few swings, then still (a body squirms, it is not a clock pendulum). */
const DAMP = 1.6;

export class Dangle {
  dx = 0; dz = 0;
  private vx = 0; private vz = 0;
  private gx = NaN; private gz = NaN;
  private gvx = 0; private gvz = 0;

  constructor(private readonly len: number) {}

  /** Swings it as if struck (m/s at the feet). */
  kick(vx: number, vz: number): void { this.vx += vx; this.vz += vz; }

  /** One step with the grip at (x, z). */
  update(dt: number, x: number, z: number): void {
    if (dt <= 0) return;
    if (Number.isNaN(this.gx)) { this.gx = x; this.gz = z; }
    const vx = (x - this.gx) / dt, vz = (z - this.gz) / dt;
    const ax = (vx - this.gvx) / dt, az = (vz - this.gvz) / dt;
    this.gx = x; this.gz = z; this.gvx = vx; this.gvz = vz;
    const L = Math.max(0.3, this.len);
    // Gravity pulls it back under the grip; the grip's acceleration pushes it the other way.
    const k = G / L;
    this.vx += (-k * this.dx - DAMP * this.vx - Math.max(-60, Math.min(60, ax))) * dt;
    this.vz += (-k * this.dz - DAMP * this.vz - Math.max(-60, Math.min(60, az))) * dt;
    this.dx += this.vx * dt;
    this.dz += this.vz * dt;
    // Never past horizontal.
    const r = Math.hypot(this.dx, this.dz), max = L * 0.95;
    if (r > max) { this.dx *= max / r; this.dz *= max / r; this.vx *= 0.5; this.vz *= 0.5; }
  }

  /** The body's tilt about world x (its feet swung along z) and about world z (along x), radians. */
  get tiltX(): number { return Math.asin(Math.max(-1, Math.min(1, this.dz / Math.max(0.3, this.len)))); }
  get tiltZ(): number { return -Math.asin(Math.max(-1, Math.min(1, this.dx / Math.max(0.3, this.len)))); }
}

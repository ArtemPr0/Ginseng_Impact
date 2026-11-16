/**
 * Camera shake from trauma (quality pass of 2026-11-16, replacing white-noise jitter): smooth low-frequency noise
 * that nudges the camera a few centimetres and turns it a degree or two, scaled by trauma squared, so a small hit is a
 * twitch and a collapse a real lurch, and it never buzzes.
 */
export interface ShakeOffset { x: number; y: number; z: number; pitch: number; yaw: number; roll: number }

/** Smooth 1D noise in [-1, 1]: sines at unrelated frequencies. */
function wobble(t: number, seed: number): number {
  return (Math.sin(t * 7.1 + seed) * 0.5 + Math.sin(t * 11.3 + seed * 2.3) * 0.3 + Math.sin(t * 17.2 + seed * 4.1) * 0.2);
}

export function shakeOffset(t: number, trauma: number): ShakeOffset {
  const k = Math.max(0, Math.min(1, trauma)) ** 2;
  if (k === 0) return { x: 0, y: 0, z: 0, pitch: 0, yaw: 0, roll: 0 };
  return {
    x: wobble(t, 1.1) * 0.12 * k,
    y: wobble(t, 2.7) * 0.1 * k,
    z: wobble(t, 4.3) * 0.06 * k,
    pitch: wobble(t, 6.1) * 0.03 * k,
    yaw: wobble(t, 7.9) * 0.03 * k,
    roll: wobble(t, 9.4) * 0.045 * k,
  };
}

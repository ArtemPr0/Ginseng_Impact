/**
 * Spell aiming (the user's call of 2026-11-15: a crosshair; the rune circle lands where it points, at most AIM_RANGE
 * metres off, or on the mob locked with Tab): a ray from the camera through the screen's centre marched over the ground.
 */
export const AIM_RANGE = 25;
/** Farthest Sir Aldric's Earthsplitter leap carries him. */
export const LEAP_RANGE = 12;

/** How far from the hero a spell may land (the aim ring clamps to it, so it shows where the spell really lands). */
export function spellRange(id: string): number {
  return id === 'earthsplitter' ? LEAP_RANGE : AIM_RANGE;
}

interface P { x: number; y: number; z: number }

/** Where a ray from `o` along `d` first meets the ground, no further than AIM_RANGE across it (then straight down). */
export function aimPoint(o: P, d: P, heightAt: (x: number, z: number, y: number) => number, range = AIM_RANGE): P {
  const flat = Math.hypot(d.x, d.z) || 1e-6;
  // Steps of 0.4 m across the ground.
  const k = 0.4 / flat;
  const sx = d.x * k, sy = d.y * k, sz = d.z * k;
  const n = Math.floor(range / 0.4);
  let x = o.x, y = o.y, z = o.z;
  for (let i = 0; i < n; i++) {
    x += sx; y += sy; z += sz;
    const g = heightAt(x, z, y + 1);
    if (y <= g) return { x, y: g, z };
  }
  return { x, y: heightAt(x, z, o.y + 2), z };
}

/** A spell released while the hero was busy (mid-swing): offered to combat each frame until cast, at most 0.6 s. */
export class SpellBuffer {
  private slot: number | null = null;
  private left = 0;

  push(slot: number): void { this.slot = slot; this.left = 0.6; }

  /** The slot to try this frame, or null. */
  peek(dt: number): number | null {
    if (this.slot === null) return null;
    this.left -= dt;
    if (this.left < 0) { this.slot = null; return null; }
    return this.slot;
  }

  /** Combat cast it. */
  done(): void { this.slot = null; }
}

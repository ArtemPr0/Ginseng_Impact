/**
 * Spell aiming (the user's call of 2026-11-15: a crosshair; the rune circle lands where it points, at most AIM_RANGE
 * metres off, or on the mob locked with Tab): a ray from the camera through the screen's centre marched over the ground.
 */
export const AIM_RANGE = 25;

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

/**
 * Hold to aim (the user's call of 2026-11-16): pressing a spell key starts aiming (the preview follows the
 * crosshair), releasing it casts there; right mouse or Escape while aiming cancels and spends nothing. A tap casts
 * on release just the same.
 */
export class AimHold {
  slot: number | null = null;
  held = 0;

  get aiming(): boolean { return this.slot !== null; }

  press(slot: number): void {
    if (this.slot !== null) return;
    this.slot = slot;
    this.held = 0;
  }

  /** `down`: the aimed spell's key is still held; `cancel`: right mouse or Escape. Returns the slot to cast now. */
  update(dt: number, down: boolean, cancel: boolean): number | null {
    if (this.slot === null) return null;
    if (cancel) { this.slot = null; return null; }
    this.held += dt;
    if (down) return null;
    const s = this.slot;
    this.slot = null;
    return s;
  }
}

export type AimShape =
  | { kind: 'ring'; radius: number }
  | { kind: 'lane'; length: number; width: number }
  | { kind: 'cone'; radius: number; angle: number }
  | { kind: 'none' };

/** The preview a spell shows while it is aimed, at its real size (SpellCast's numbers). */
export function aimShape(id: string, radius: number): AimShape {
  switch (id) {
    case 'wrecking-charge': return { kind: 'lane', length: 12, width: radius * 2 };
    case 'fire-tornado': return { kind: 'lane', length: 15, width: radius * 2 };
    case 'gale-shot': return { kind: 'cone', radius, angle: 0.55 };
    case 'blood-moon': return { kind: 'none' };
    default: return { kind: 'ring', radius: Math.max(1.2, radius) };
  }
}

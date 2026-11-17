/**
 * Spell aiming (the user's call of 2026-11-15: a crosshair; the rune circle lands where it points, at most AIM_RANGE
 * metres off, or on the mob locked with Tab): a ray from the camera through the screen's centre marched over the ground.
 */
export const AIM_RANGE = 25;
/** Farthest Sir Aldric's Earthsplitter leap carries him. */
export const LEAP_RANGE = 12;

/** How far from the hero a spell may land (the aim ring clamps to it, so it shows where the spell really lands). */
export function spellRange(id: string): number {
  return id === 'earthsplitter' ? LEAP_RANGE : id === 'spike-row' ? 18 : AIM_RANGE;
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

// ------------------------------------------------------------------------------------------- hold to aim (v13)

/**
 * Hold right click to aim, let go to cast (playtest 2026-11-17): while held the spell's path or landing shows
 * (AimPreview); Esc, losing the pointer or picking another slot cancels, and the release then casts nothing.
 */
export class AimHold {
  aiming = false;
  private slot = -1;
  private cancelled = false;

  /** `down`: right mouse held; `cancel`: Esc (or the pointer lost); `picked`: the bar's selected slot. */
  update(down: boolean, cancel: boolean, picked: number): { release: boolean; slot: number } {
    if (this.aiming && (cancel || picked !== this.slot)) { this.aiming = false; this.cancelled = true; }
    if (!down) {
      const release = this.aiming;
      this.aiming = false;
      this.cancelled = false;
      return { release, slot: this.slot };
    }
    if (!this.aiming && !this.cancelled) { this.aiming = true; this.slot = picked; }
    return { release: false, slot: this.slot };
  }
}

export type AimShape =
  | { kind: 'none' }
  /** `self`: round the hero, not at the crosshair (Stone Ring). */
  | { kind: 'ring'; radius: number; self?: boolean }
  | { kind: 'lane'; length: number; width: number }
  | { kind: 'cone'; radius: number; angle: number }
  | { kind: 'arc'; arc: number; radius: number }
  | { kind: 'path'; run: number; life: number; radius: number }
  /** `ahead`: stands this far before the hero (Earth Wall, Water Shield), not at the crosshair. */
  | { kind: 'wall'; width: number; ahead?: number }
  | { kind: 'marker'; radius: number };

/** How high each shot arcs over its flight (metres at the middle). */
const ARCS: Record<string, number> = { fireball: 2.5, moonbomb: 1.5, 'frost-arrow': 0.3, 'storm-arrow': 0.3, boulder: 3, 'fire-fist': 0.3 };
export function shotArc(id: string): number { return ARCS[id] ?? 0.3; }

/** Fire tornado: 18 m in 7 s; storm tornado: 6 m in 6 s. */
export const TORNADO_RUNS: Record<string, { run: number; life: number }> = { 'fire-tornado': { run: 18, life: 7 }, 'storm-tornado': { run: 6, life: 6 } };

/** What the preview draws for spell `id` (its blast `radius` where it has one). */
export function aimShape(id: string, radius = 3): AimShape {
  switch (id) {
    case 'fireball': case 'moonbomb': case 'frost-arrow': case 'storm-arrow':
      return { kind: 'arc', arc: shotArc(id), radius };
    case 'fire-tornado': case 'storm-tornado':
      return { kind: 'path', ...TORNADO_RUNS[id], radius };
    case 'gale-shot': return { kind: 'cone', radius, angle: 0.55 };
    case 'wrecking-charge': return { kind: 'lane', length: 12, width: 2 * radius };
    case 'earthsplitter': return { kind: 'lane', length: LEAP_RANGE, width: 3 };
    case 'stone-wall': return { kind: 'wall', width: 6 };
    case 'black-hole': return { kind: 'marker', radius };
    case 'telekinesis': case 'blood-moon': return { kind: 'none' };
    case 'chain-hook': return { kind: 'lane', length: 20, width: 5 };
    // The second page (ReelMoves.ts).
    case 'spike-row': return { kind: 'lane', length: 18, width: 3 };
    case 'fire-wave': return { kind: 'lane', length: 12, width: 5 };
    case 'fire-dash': return { kind: 'lane', length: 10, width: 3.2 };
    case 'wave-surf': return { kind: 'lane', length: 12, width: 3.6 };
    case 'water-whip': return { kind: 'lane', length: 14, width: 2 };
    case 'ice-ramp': return { kind: 'lane', length: 10.8, width: 1.6 };
    case 'pillars': return { kind: 'lane', length: 16, width: 5 };
    case 'dust-kick': return { kind: 'cone', radius: 5, angle: 0.9 };
    case 'ice-discs': return { kind: 'cone', radius: 16, angle: 0.25 };
    case 'stone-ring': return { kind: 'ring', radius, self: true };
    case 'earth-wall': return { kind: 'wall', width: 4, ahead: 2.4 };
    case 'water-shield': return { kind: 'wall', width: 4.6, ahead: 2.6 };
    case 'ice-wall': return { kind: 'wall', width: 6 };
    case 'boulder': case 'fire-fist': return { kind: 'arc', arc: shotArc(id), radius };
    case 'rock-armor': case 'fire-jets': case 'flame-body': return { kind: 'none' };
    default: return { kind: 'ring', radius };
  }
}

interface V3 { x: number; y: number; z: number; set(x: number, y: number, z: number): V3 }

/** Where a shot flying from `a` to `b` with `arc` is at `k` (0-1) of its flight (SpellCast flies them so). */
export function flightPoint<T extends V3>(a: V3, b: V3, k: number, arc: number, out: T): T {
  out.set(a.x + (b.x - a.x) * k, a.y + (b.y - a.y) * k + Math.sin(k * Math.PI) * arc, a.z + (b.z - a.z) * k);
  return out;
}

/** A tornado's move over `dt` at age `t`: along `dir` at run/life m/s, weaving off its line (the reel's). */
export function tornadoStep(t: number, dt: number, dir: { x: number; z: number }, run: number, life: number): { x: number; z: number } {
  const step = (run / life) * dt;
  const weave = Math.sin(t * 1.3) * 1.6 + Math.sin(t * 2.9 + 1) * 0.6;
  return { x: dir.x * step + weave * dt * -dir.z, z: dir.z * step + weave * dt * dir.x };
}

/** The whole path a tornado started at `from` will take (points every `dt`), for the preview. */
export function tornadoPath(from: { x: number; z: number }, dir: { x: number; z: number }, run: number, life: number, dt = 0.1): Array<{ x: number; z: number }> {
  const out = [{ x: from.x, z: from.z }];
  let x = from.x, z = from.z;
  for (let t = dt; t <= life + 1e-9; t += dt) { const s = tornadoStep(t, dt, dir, run, life); x += s.x; z += s.z; out.push({ x, z }); }
  return out;
}

/** How high over the crosshair's point the black hole opens: in the sky over open ground, inside what it is aimed at. */
export const HOLE_LIFT = { sky: 10, inside: 0, min: -2, max: 10 } as const;

/** The black hole's height off its aim point: the default for where it is aimed, moved by the wheel, clamped. */
export function holeLift(wheel: number, onBuilding: boolean): number {
  const base = onBuilding ? HOLE_LIFT.inside : HOLE_LIFT.sky;
  return Math.max(HOLE_LIFT.min, Math.min(HOLE_LIFT.max, base + wheel));
}

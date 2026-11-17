/**
 * Picking things up and throwing them (the user's request of 2026-11-16): Sir Aldric grabs a mob one-handed by the
 * neck, carries it and throws it; Orlan lifts mobs, rubble and whole small buildings with his mind (hold the heavy
 * button) and hurls them where he looks. The pure parts: who can be lifted, where a held thing hangs, how it is
 * steered, thrown, flies and lands, and what the landing does.
 */

/** What decides whether a mob can be picked up (its EnemyDef). */
export interface Liftable {
  height: number; scale?: number; boss?: boolean; flying?: boolean; speed: number;
  body?: unknown; eye?: unknown; seated?: boolean; floatAt?: number;
}

const tall = (d: Liftable) => d.height * (d.scale ?? 1);

/** One-handed: up to troll size (under ~3.2 m), on its feet, not a boss. */
export function canHandGrab(d: Liftable): boolean {
  return !d.boss && !d.flying && d.speed > 0 && !d.body && !d.eye && !d.seated && d.floatAt === undefined && tall(d) < 3.2;
}

/** By the mind: anything not a boss up to 6 m, flyers too. */
export function canLift(d: Liftable): boolean {
  return !d.boss && !d.body && !d.eye && tall(d) <= 6;
}

/** A body's mass for throwing (1: a person), by its height. */
export function massOf(d: Liftable): number {
  return Math.max(0.5, (tall(d) / 1.8) ** 2);
}

type P = { x: number; y: number; z: number };

/** Where a mob `h` tall hangs from the knight's raised fist (its feet position): neck in the fist at ~2.1 m. */
export function handHold(hero: P, yaw: number, h: number): P {
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  return { x: hero.x + fx * 0.95, y: hero.y + 2.1 - h * 0.85, z: hero.z + fz * 0.95 };
}

/** Where Orlan holds what he lifts: 3.2 m ahead, 2.6 m up, bobbing slowly. */
export function mindHold(hero: P, yaw: number, t: number): P {
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  return { x: hero.x + fx * 3.2, y: hero.y + 2.6 + Math.sin(t * 2.2) * 0.25, z: hero.z + fz * 3.2 };
}

/** Velocity that brings a loose piece at `from` to `to` (gravity `g` this step cancelled), capped at 25 m/s. */
export function steerTo(from: P, to: P, dt: number, g: number): { vx: number; vy: number; vz: number } {
  let vx = (to.x - from.x) * 7, vy = (to.y - from.y) * 7, vz = (to.z - from.z) * 7;
  const s = Math.hypot(vx, vy, vz);
  if (s > 25) { vx *= 25 / s; vy *= 25 / s; vz *= 25 / s; }
  return { vx, vy: vy + g * dt, vz };
}

/** A throw along `dir` (need not be level): by hand ~13 m/s, by the mind ~24 m/s, slower for heavy things. */
export function throwVelocity(dir: P, by: 'hand' | 'mind', mass: number): P {
  const l = Math.hypot(dir.x, dir.y, dir.z) || 1;
  const s = (by === 'hand' ? 13 : 24) / Math.sqrt(Math.max(0.5, mass));
  return { x: (dir.x / l) * s, y: (dir.y / l) * s + (by === 'hand' ? 4 : 2.5), z: (dir.z / l) * s };
}

export interface Flight { vx: number; vy: number; vz: number; spin: number; angle: number }

/** The game's gravity for thrown bodies (as Yeet's flights). */
export const THROW_G = 22;

/** One step of a thrown body; returns its impact speed when it hits the ground this step, else 0. */
export function flightStep(f: Flight, p: P, dt: number, groundAt: (x: number, z: number) => number): number {
  f.vy -= THROW_G * dt;
  p.x += f.vx * dt; p.y += f.vy * dt; p.z += f.vz * dt;
  f.angle += f.spin * dt;
  const g = groundAt(p.x, p.z);
  if (p.y <= g && f.vy < 0) {
    const speed = Math.hypot(f.vx, f.vy, f.vz);
    p.y = g;
    return Math.max(speed, 1e-3);
  }
  return 0;
}

/** Damage share (of the thrower's attack) a landing or a collision does: nothing under 4 m/s. */
export function impactDamage(mass: number, speed: number): number {
  if (speed < 4) return 0;
  return (speed - 4) * 0.22 * Math.sqrt(mass);
}

/**
 * A throw from `from` that lands on `to` under gravity `g`, flying at about `speed` m/s across the ground (at least a
 * third of a second in the air): the crosshair's throw (playtest 2026-11-17).
 */
export function aimedVelocity(from: P, to: P, g: number, speed: number): P {
  const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
  const T = Math.max(0.35, Math.hypot(dx, dz) / speed);
  return { x: dx / T, y: (dy + 0.5 * g * T * T) / T, z: dz / T };
}

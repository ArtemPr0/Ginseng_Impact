import type { Footprint } from '../world/Colliders';

/** What SolidBodies needs of an enemy: where it is, whether it lives, and its def's `solid` (EnemyDef.solid). */
export interface SolidBody {
  pos: { x: number; y: number; z: number };
  alive: boolean;
  def: { solid?: { r: number; top: number } };
}

/**
 * Enemies you can stand on (EnemyDef.solid: the Frog God). Each gets a moving cylinder in the height world (radius `r`,
 * its top `top` metres over the body's feet) that follows it every step. `before` hides it while the body itself
 * steps, so it never climbs onto its own back; `after` puts it back where the body now is (or hides it for good once
 * it dies).
 */
export class SolidBodies {
  private readonly shapes = new Map<SolidBody, Footprint & { kind: 'cyl' }>();

  constructor(private readonly moving: Footprint[]) {}

  before(e: SolidBody): void {
    const f = this.shapes.get(e);
    if (f) f.top = -Infinity;
  }

  after(e: SolidBody): void {
    const solid = e.def.solid;
    if (!solid) return;
    let f = this.shapes.get(e);
    if (!f) {
      f = { kind: 'cyl', x: e.pos.x, z: e.pos.z, r: solid.r, top: -Infinity };
      this.shapes.set(e, f);
      this.moving.push(f);
    }
    f.x = e.pos.x;
    f.z = e.pos.z;
    f.top = e.alive ? e.pos.y + solid.top : -Infinity;
  }

  /** Runs `fn` with every body out of the height world (shots: a body's own orbs start inside it), then puts them back. */
  aside(fn: () => void): void {
    const tops: number[] = [];
    for (const f of this.shapes.values()) { tops.push(f.top); f.top = -Infinity; }
    try { fn(); } finally { let i = 0; for (const f of this.shapes.values()) f.top = tops[i++]; }
  }
}

/** The hero's own half-width against a body. */
export const HERO_R = 0.4;

/** A body the hero cannot walk through: its centre, radius, and (optional) height for walking over or under it. */
export interface PushBody {
  pos: { x: number; y: number; z: number };
  r: number;
  alive: boolean;
  height?: number;
  flying?: boolean;
}

/**
 * Puts a hero who has walked into a body back at its edge (the full pass of 2026-11-15: the hero walked through the
 * Hollow King, 6 m across, and off the cliff behind him). Bodies that are dead, flying, or not at the hero's height
 * (from 1 m under their feet to their top) are passed by, and a push that would land in a wall (`blocked`) is not made.
 */
export function pushOut(p: { x: number; y: number; z: number }, bodies: Iterable<PushBody>, blocked: (x: number, z: number) => boolean): void {
  for (const b of bodies) {
    if (!b.alive || b.flying) continue;
    if (p.y < b.pos.y - 1 || p.y > b.pos.y + (b.height ?? 2)) continue;
    const dx = p.x - b.pos.x, dz = p.z - b.pos.z;
    const reach = b.r + HERO_R;
    const d = Math.hypot(dx, dz);
    if (d >= reach) continue;
    const ux = d > 1e-4 ? dx / d : 1, uz = d > 1e-4 ? dz / d : 0;
    const nx = b.pos.x + ux * reach, nz = b.pos.z + uz * reach;
    if (blocked(nx, nz)) continue;
    p.x = nx;
    p.z = nz;
  }
}

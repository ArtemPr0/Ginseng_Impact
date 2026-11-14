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

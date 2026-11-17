/**
 * Wren's mushroom rise (playtest 2026-11-17, after the reel's ice ramp): hold Space and a giant mushroom grows up under
 * her every beat, each a tier higher than the last, lifting her up to RISE.max tiers. Each one is solid (a cylinder
 * collider whose top grows with it) and stands for RISE.life seconds, then sinks away. Letting go stops the growing;
 * she can jump off. Pure: the caller adds and removes the colliders (onAdd, onRemove) and draws the mushrooms.
 */
export const RISE = {
  /** Metres each mushroom stands over the one before. */
  tier: 1.2,
  /** Seconds between mushrooms while Space is held. */
  every: 0.35,
  max: 6,
  life: 8,
  /** Seconds a mushroom takes to grow to its height, and to sink at the end. */
  grow: 0.25,
  sink: 0.5,
  /** Space held this long before the first one (a tap is her jump). */
  hold: 0.2,
  /** Its cap's radius (m): what she stands on. */
  r: 0.9,
};

export interface Shroom {
  x: number; z: number;
  /** The ground under it, and how high its cap stands at full height. */
  ground: number; height: number;
  t: number;
  collider: { kind: 'cyl'; x: number; z: number; r: number; top: number };
}

export class MushroomRise {
  readonly shrooms: Shroom[] = [];
  onAdd?: (f: Shroom['collider']) => void;
  onRemove?: (f: Shroom['collider']) => void;
  private held = 0;
  private since = 0;
  /** Tiers grown this hold, and the ground the hold began on. */
  private tiers = 0;
  private base = 0;

  /** One step: `held` Space is down (and she may rise: Wren, on her feet or on her mushrooms). */
  update(dt: number, held: boolean, me: { x: number; y: number; z: number }, groundAt: (x: number, z: number) => number): void {
    if (held) {
      if (this.held === 0) { this.tiers = 0; this.base = me.y; this.since = RISE.every; }
      this.held += dt;
      this.since += dt;
      const ground = groundAt(me.x, me.z);
      // (Never more than RISE.max tiers over the real ground: holding again on top does not climb on for ever.)
      if (this.held >= RISE.hold && this.since >= RISE.every && this.tiers < RISE.max && me.y - ground < RISE.max * RISE.tier - 0.1) {
        this.since = 0;
        this.tiers++;
        const top = Math.max(me.y, this.base + (this.tiers - 1) * RISE.tier) + RISE.tier;
        const collider = { kind: 'cyl' as const, x: me.x, z: me.z, r: RISE.r, top: ground };
        this.shrooms.push({ x: me.x, z: me.z, ground, height: top - ground, t: 0, collider });
        this.onAdd?.(collider);
      }
    } else this.held = 0;
    for (let i = this.shrooms.length - 1; i >= 0; i--) {
      const s = this.shrooms[i];
      s.t += dt;
      if (s.t >= RISE.life + RISE.sink) {
        this.shrooms.splice(i, 1);
        this.onRemove?.(s.collider);
        continue;
      }
      s.collider.top = s.ground + s.height * this.scale(s);
    }
  }

  /** How grown a mushroom is now (0 to 1): growing, standing, sinking. */
  scale(s: Shroom): number {
    if (s.t < RISE.grow) { const k = s.t / RISE.grow; return 1 - (1 - k) * (1 - k); }
    if (s.t > RISE.life) return Math.max(0, 1 - (s.t - RISE.life) / RISE.sink);
    return 1;
  }

  /** Takes every mushroom away at once (she switched hero, left the area). */
  clear(): void {
    for (const s of this.shrooms) this.onRemove?.(s.collider);
    this.shrooms.length = 0;
    this.held = 0;
  }
}

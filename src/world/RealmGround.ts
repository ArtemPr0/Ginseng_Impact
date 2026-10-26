/**
 * The four sculpted realms as heightfields (data/sculpts.ts). Height queries use the analytic sculpt until a realm
 * is entered, then the baked field, which is the surface ChunkedGround draws. Baking waits for the first visit so
 * the island still starts at once. Meshes are built only by render/Ground.ts.
 */
import { Group, type Vector3 } from 'three';
import { ABYSS_Y, landDistance, REALM_SCULPTS, realmHeight, sculptFor, type RealmSculpt } from '../data/sculpts';
import { REALMS } from '../data/world';
import { ChunkedGround, Heightfield } from '../render/Ground';
import { groundMaterial } from '../render/GroundMaterial';
import type { Footprint } from './Colliders';
import { Noise2D } from './noise';

const PAD = 40;

interface Drawn { field: Heightfield; chunks: ChunkedGround }

export class RealmGrounds {
  private readonly noise = new Noise2D(1337);
  private readonly drawn = new Map<string, Drawn>();
  private readonly rimCache = new Map<string, Footprint[]>();
  private readonly near: Array<{ id: RealmSculpt['id']; x: number; z: number; r2: number }>;

  constructor() {
    this.near = (Object.keys(REALM_SCULPTS) as Array<RealmSculpt['id']>).map((id) => {
      const R = REALMS.find((r) => r.id === id)!;
      const r = R.radius + PAD;
      return { id, x: R.x, z: R.z, r2: r * r };
    });
  }

  /**
   * The sculpted surface at (x, z), or null when no realm's land is there (the island, the void, an interior).
   * Past a realm's cliff the analytic height is the abyss, which counts as "not this realm" so the island's own
   * abyss answer is unchanged.
   */
  heightAt(x: number, z: number): number | null {
    for (const n of this.near) {
      const dx = x - n.x;
      const dz = z - n.z;
      if (dx * dx + dz * dz > n.r2) continue;
      const mesh = this.drawn.get(n.id);
      if (mesh?.field.contains(x, z)) {
        const h = mesh.field.heightAt(x, z);
        if (h > ABYSS_Y + 1) return h;
        continue;
      }
      const h = realmHeight(REALM_SCULPTS[n.id], x, z, this.noise);
      if (h > ABYSS_Y + 1) return h;
    }
    return null;
  }

  /**
   * Box colliders every ~4 m along the sculpted land's rim (`top`: local ground + 6 m). Cached per realm id.
   */
  rimFootprints(id: string): Footprint[] {
    const hit = this.rimCache.get(id);
    if (hit) return hit;
    if (!(id in REALM_SCULPTS)) return [];
    const sculpt = REALM_SCULPTS[id as RealmSculpt['id']];
    const realm = REALMS.find((r) => r.id === id)!;
    const { x: cx, z: cz, radius: R } = realm;
    const steps = Math.max(12, Math.round((2 * Math.PI * R) / 4));
    const out: Footprint[] = [];
    for (let i = 0; i < steps; i++) {
      const a = (i / steps) * Math.PI * 2;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      const r = this.rimRadius(sculpt, cx, cz, cos, sin, R);
      if (r === null) continue;
      const x = cx + cos * r;
      const z = cz + sin * r;
      out.push({
        kind: 'box',
        x,
        z,
        hw: 2.2,
        hd: 1.1,
        top: realmHeight(sculpt, x, z, this.noise) + 6,
        rotY: a + Math.PI / 2,
      });
    }
    this.rimCache.set(id, out);
    return out;
  }

  /** Outward from `(cx, cz)` along `(cos, sin)` until `landDistance` crosses zero (metres). */
  private rimRadius(sculpt: RealmSculpt, cx: number, cz: number, cos: number, sin: number, hintR: number): number | null {
    const dist = (r: number) => landDistance(sculpt, cx + cos * r, cz + sin * r, this.noise);
    if (dist(0) >= 0) return null;
    let hi = hintR * 1.1;
    const cap = hintR * 2.5;
    while (dist(hi) < 0 && hi < cap) hi += hintR * 0.2;
    if (dist(hi) < 0) return null;
    let lo = 0;
    for (let k = 0; k < 28; k++) {
      const mid = (lo + hi) / 2;
      if (dist(mid) < 0) lo = mid;
      else hi = mid;
    }
    const r = (lo + hi) / 2;
    if (Math.abs(dist(r)) > 1.5) return null;
    return r;
  }

  /** Bakes and draws `id` into `parent` the first time the player enters it. */
  ensure(id: string, parent: Group): void {
    if (this.drawn.has(id) || !(id in REALM_SCULPTS)) return;
    const sculpt = REALM_SCULPTS[id as RealmSculpt['id']];
    const field = new Heightfield(sculptFor(sculpt, this.noise));
    const chunks = new ChunkedGround(field, groundMaterial(), { chunk: 32, lod: [64, 160], castShadowNear: true });
    parent.add(chunks.group);
    this.drawn.set(id, { field, chunks });
  }

  /** Level of detail for the grounds that have been baked. */
  update(focus: Vector3): void {
    for (const d of this.drawn.values()) d.chunks.update(focus);
  }
}

import { AdditiveBlending, BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, OctahedronGeometry, Scene, Vector3 } from 'three';
import { ITEMS, RARITY_COLOR } from '../items/Items';
import { PALETTE } from '../render/palette';
import { surface } from '../render/Materials';
import { glowSprite } from '../world/Landmarks';
import type { DropEntry } from '../data/enemies';

export type Drop = { kind: 'item'; itemId: string; count: number } | { kind: 'shards'; amount: number };

/** Rolls a drop table. Pure. */
export function rollDrops(table: DropEntry[] | undefined, shards: [number, number], rnd: () => number = Math.random): Drop[] {
  const out: Drop[] = [];
  const amount = Math.round(shards[0] + rnd() * (shards[1] - shards[0]));
  if (amount > 0) out.push({ kind: 'shards', amount });
  for (const d of table ?? []) if (rnd() < d.chance) out.push({ kind: 'item', itemId: d.itemId, count: 1 });
  return out;
}

interface Pickup { drop: Drop; object: Group; pos: Vector3; vel: Vector3; life: number; spin: number; landed: boolean }

/** World pickups: shard motes that fly to the player, item crystals that are taken with F. */
export class LootField {
  readonly pickups: Pickup[] = [];
  private readonly tmp = new Vector3();

  constructor(private readonly scene: Scene, private readonly heightAt: (x: number, z: number) => number) {}

  spawn(drops: Drop[], at: Vector3): void {
    for (const drop of drops) {
      if (drop.kind === 'shards') {
        const motes = Math.min(8, Math.max(2, Math.round(drop.amount / 6)));
        for (let i = 0; i < motes; i++) this.place({ kind: 'shards', amount: i === 0 ? drop.amount - Math.floor(drop.amount / motes) * (motes - 1) : Math.floor(drop.amount / motes) }, at);
      } else this.place(drop, at);
    }
  }

  private place(drop: Drop, at: Vector3): void {
    const object = new Group();
    let spin = 1.5;
    if (drop.kind === 'shards') {
      const m = new Mesh(new OctahedronGeometry(0.16, 0), new MeshBasicMaterial({ color: new Color(PALETTE.moon).multiplyScalar(1.4), toneMapped: false }));
      object.add(m, glowSprite(PALETTE.electric, 0.9, 0.7, true));
      spin = 4;
    } else {
      const def = ITEMS[drop.itemId];
      const color = RARITY_COLOR[def.rarity];
      const core = new Mesh(def.kind === 'weapon' ? new BoxGeometry(0.12, 0.9, 0.05) : new OctahedronGeometry(0.28, 0), surface({ color: PALETTE.void, emissive: color, emissiveIntensity: 2.5 }));
      core.position.y = 0.5;
      object.add(core, glowSprite(color, 2.2 + def.rarity * 0.5, 0.6, true));
      const pillar = new Mesh(new BoxGeometry(0.3, 6, 0.3), new MeshBasicMaterial({ color, transparent: true, opacity: 0.12, blending: AdditiveBlending, depthWrite: false }));
      pillar.position.y = 3;
      object.add(pillar);
    }
    object.position.copy(at);
    this.scene.add(object);
    const a = Math.random() * Math.PI * 2;
    this.pickups.push({
      drop, object, pos: at.clone(), vel: new Vector3(Math.cos(a) * 3, 6 + Math.random() * 3, Math.sin(a) * 3),
      life: 0, spin, landed: false,
    });
  }

  /** Nearest item pickup within `range` of the player, for the F prompt. */
  nearest(player: Vector3, range: number): Pickup | null {
    let best: Pickup | null = null;
    let bd = range;
    for (const p of this.pickups) {
      if (p.drop.kind !== 'item') continue;
      const d = this.tmp.copy(p.pos).sub(player).length();
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  take(p: Pickup): Drop {
    this.scene.remove(p.object);
    this.pickups.splice(this.pickups.indexOf(p), 1);
    return p.drop;
  }

  /** Physics + shard magnet. Returns shards collected this step. */
  update(dt: number, player: Vector3): number {
    let collected = 0;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life += dt;
      if (!p.landed) {
        p.vel.y -= 18 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const g = this.heightAt(p.pos.x, p.pos.z) + 0.15;
        if (p.pos.y <= g && p.vel.y < 0) { p.pos.y = g; p.landed = true; }
      } else if (p.drop.kind === 'shards' && p.life > 0.6) {
        const d = this.tmp.copy(player).add(new Vector3(0, 1, 0)).sub(p.pos);
        const dist = d.length();
        if (dist < 4.5) {
          p.pos.addScaledVector(d.normalize(), (14 + (4.5 - dist) * 8) * dt);
          if (dist < 0.6) { collected += p.drop.amount; this.scene.remove(p.object); this.pickups.splice(i, 1); continue; }
        }
      }
      p.object.position.copy(p.pos);
      p.object.rotation.y += dt * p.spin;
      if (p.landed) p.object.position.y += Math.sin(p.life * 3) * 0.08 + 0.1;
    }
    return collected;
  }
}

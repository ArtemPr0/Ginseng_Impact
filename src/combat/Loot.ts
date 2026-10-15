import { BoxGeometry, Color, Group, Mesh, MeshBasicMaterial, OctahedronGeometry, Scene, type Sprite, Vector3 } from 'three';
import { ITEMS, RARITY_COLOR } from '../items/Items';
import { PALETTE } from '../render/palette';
import { surface } from '../render/Materials';
import { glowSprite } from '../render/Glow';
import { disposeObject } from '../render/dispose';
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

/** A taken item on its way into the hero: lifts, spirals in, shrinks to a spark. */
interface Absorbing { object: Group; from: Vector3; t: number; turn: number }

/** A little starburst where something was absorbed. */
interface Sparkle { sprites: Sprite[]; t: number; at: Vector3 }

/** World pickups: shard motes that fly to the player, item crystals that are taken with F. */
export class LootField {
  readonly pickups: Pickup[] = [];
  private readonly tmp = new Vector3();
  private readonly chest = new Vector3();
  private readonly absorbing: Absorbing[] = [];
  private readonly sparkles: Sparkle[] = [];
  /** Called when a taken item reaches the hero (its rarity, 0 for shards): the whoosh and chime. */
  onAbsorbed: ((rarity: number) => void) | null = null;

  constructor(private readonly scene: Scene, private readonly heightAt: (x: number, z: number, y?: number) => number) {}

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
      // Just the crystal itself in a soft glow (no beam of light).
      object.add(core, glowSprite(color, 1.1 + def.rarity * 0.2, 0.45, true));
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

  /** Takes an item pickup: it is yours at once, and flies into you over the next half second. */
  take(p: Pickup): Drop {
    const i = this.pickups.indexOf(p);
    if (i < 0) return p.drop;
    this.pickups.splice(i, 1);
    this.absorbing.push({ object: p.object, from: p.object.position.clone(), t: 0, turn: Math.random() < 0.5 ? 1 : -1 });
    return p.drop;
  }

  private sparkle(at: Vector3, color: number): void {
    const sprites: Sprite[] = [];
    for (let i = 0; i < 6; i++) { const s = glowSprite(i % 2 ? color : PALETTE.moon, 0.3, 0.9, true); s.position.copy(at); this.scene.add(s); sprites.push(s); }
    this.sparkles.push({ sprites, t: 0, at: at.clone() });
  }

  /** Physics + shard magnet. Returns shards collected this step. */
  update(dt: number, player: Vector3): number {
    let collected = 0;
    // Taken items: up off the ground, then a tightening spiral into the hero's chest, shrinking to a spark.
    const chest = this.chest.set(player.x, player.y + 1.15, player.z);
    for (let i = this.absorbing.length - 1; i >= 0; i--) {
      const a = this.absorbing[i];
      a.t += dt / 0.6;
      const k = Math.min(1, a.t);
      const ease = k * k * (3 - 2 * k);
      const lift = Math.sin(Math.min(1, k * 2) * Math.PI) * 0.7;
      const r = (1 - ease) * 0.9;
      const ang = k * Math.PI * 3 * a.turn;
      a.object.position.set(
        a.from.x + (chest.x - a.from.x) * ease + Math.cos(ang) * r,
        a.from.y + (chest.y - a.from.y) * ease + lift,
        a.from.z + (chest.z - a.from.z) * ease + Math.sin(ang) * r,
      );
      a.object.rotation.y += dt * 14;
      a.object.scale.setScalar(Math.max(0.05, 1 - ease * 0.95));
      if (k >= 1) {
        this.scene.remove(a.object);
        disposeObject(a.object);
        this.absorbing.splice(i, 1);
        this.sparkle(chest, PALETTE.rune);
        this.onAbsorbed?.(1);
      }
    }
    for (let i = this.sparkles.length - 1; i >= 0; i--) {
      const s = this.sparkles[i];
      s.t += dt / 0.4;
      s.sprites.forEach((sp, j) => {
        const a = (j / s.sprites.length) * Math.PI * 2;
        sp.position.set(s.at.x + Math.cos(a) * s.t * 0.7, s.at.y + Math.sin(a * 2) * s.t * 0.3, s.at.z + Math.sin(a) * s.t * 0.7);
        sp.material.opacity = 0.9 * (1 - s.t);
        sp.scale.setScalar(0.3 * (1 - s.t * 0.6));
      });
      if (s.t >= 1) { for (const sp of s.sprites) { this.scene.remove(sp); sp.material.dispose(); } this.sparkles.splice(i, 1); }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.life += dt;
      // Left lying for long, or fallen off the world: gone.
      if (p.life > (p.drop.kind === 'shards' ? 120 : 300) || p.pos.y < -100) { this.scene.remove(p.object); disposeObject(p.object); this.pickups.splice(i, 1); continue; }
      if (!p.landed) {
        p.vel.y -= 18 * dt;
        p.pos.addScaledVector(p.vel, dt);
        const g = this.heightAt(p.pos.x, p.pos.z, p.pos.y) + 0.15;
        if (p.pos.y <= g && p.vel.y < 0) { p.pos.y = g; p.landed = true; }
      } else if (p.drop.kind === 'shards' && p.life > 0.6) {
        const d = this.tmp.copy(player).sub(p.pos);
        d.y += 1;
        const dist = d.length();
        if (dist < 4.5) {
          p.pos.addScaledVector(d.normalize(), (14 + (4.5 - dist) * 8) * dt);
          if (dist < 0.6) { collected += p.drop.amount; this.scene.remove(p.object); disposeObject(p.object); this.pickups.splice(i, 1); this.sparkle(p.pos, PALETTE.electric); continue; }
        }
      }
      p.object.position.copy(p.pos);
      p.object.rotation.y += dt * p.spin;
      if (p.landed) p.object.position.y += Math.sin(p.life * 3) * 0.08 + 0.1;
    }
    return collected;
  }
}

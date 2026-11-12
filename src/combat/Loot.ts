import { BoxGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, Scene, type Sprite, Vector3 } from 'three';
import { ITEMS, RARITY_COLOR, rollAffix, type Affix } from '../items/Items';
import { PALETTE } from '../render/palette';
import { surface } from '../render/Materials';
import { glowSprite } from '../render/Glow';
import { disposeObject } from '../render/dispose';
import type { DropEntry } from '../data/enemies';

/** One coin's geometry and gold, shared by every coin on the ground (disposeObject skips them: `userData.shared`). */
const COIN_R = 0.13;
const coinGeometry = new CylinderGeometry(COIN_R, COIN_R, 0.028, 24, 1).rotateX(Math.PI / 2);
const coinFace = new CylinderGeometry(COIN_R * 0.72, COIN_R * 0.72, 0.034, 24, 1).rotateX(Math.PI / 2);
const coinGold = new MeshStandardMaterial({ color: 0xffb627, metalness: 0.85, roughness: 0.32, emissive: 0x7a4a00, emissiveIntensity: 0.55 });
const coinStamp = new MeshStandardMaterial({ color: 0xffd25e, metalness: 0.9, roughness: 0.22, emissive: 0x8a5a08, emissiveIntensity: 0.6 });

/** A gold coin standing on its rim (faces along z), with a raised stamped face. */
function goldCoin(): Group {
  const g = new Group();
  const rim = new Mesh(coinGeometry, coinGold);
  const face = new Mesh(coinFace, coinStamp);
  rim.userData.shared = face.userData.shared = true;
  g.add(rim, face);
  return g;
}

/** An item on the ground; a dropped weapon carries the affix it rolled (the pickup hands it to `inventory.add`). */
export type ItemDrop = { kind: 'item'; itemId: string; count: number; affix?: Affix };
export type Drop = ItemDrop | { kind: 'shards'; amount: number };

/** Rolls a drop table; weapons roll an affix by their rarity. Pure and seedable through `rnd`. */
export function rollDrops(table: DropEntry[] | undefined, shards: [number, number], rnd: () => number = Math.random): Drop[] {
  const out: Drop[] = [];
  const amount = Math.round(shards[0] + rnd() * (shards[1] - shards[0]));
  if (amount > 0) out.push({ kind: 'shards', amount });
  for (const d of table ?? []) {
    if (!(rnd() < d.chance)) continue;
    const drop: ItemDrop = { kind: 'item', itemId: d.itemId, count: 1 };
    const def = ITEMS[d.itemId];
    const affix = def?.kind === 'weapon' ? rollAffix(def.rarity, rnd) : null;
    if (affix) drop.affix = affix;
    out.push(drop);
  }
  return out;
}

interface Pickup { drop: Drop; object: Group; pos: Vector3; vel: Vector3; life: number; spin: number; landed: boolean }

/** A taken item on its way into the hero: lifts, spirals in, shrinks to a spark. */
interface Absorbing { object: Group; from: Vector3; t: number; turn: number; rarity: number }

/** A little starburst where something was absorbed. */
interface Sparkle { sprites: Sprite[]; t: number; at: Vector3 }

/** World pickups: gold coins that fly to the player, item crystals that are taken with F. */
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
      // A gold coin standing on its rim and spinning (the currency: the kingdom's coin heaps, coin-block/coin-table):
      // a stamped face on each side, a milled rim, a warm glint for the bloom.
      object.add(goldCoin());
      object.add(glowSprite(0xffc23a, 0.55, 0.5, true));
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
    const rarity = p.drop.kind === 'item' ? ITEMS[p.drop.itemId].rarity : 0;
    this.absorbing.push({ object: p.object, from: p.object.position.clone(), t: 0, turn: Math.random() < 0.5 ? 1 : -1, rarity });
    return p.drop;
  }

  private sparkle(at: Vector3, color: number): void {
    const sprites: Sprite[] = [];
    for (let i = 0; i < 6; i++) { const s = glowSprite(i % 2 ? color : PALETTE.moon, 0.3, 0.9, true); s.position.copy(at); this.scene.add(s); sprites.push(s); }
    this.sparkles.push({ sprites, t: 0, at: at.clone() });
  }

  /** Physics + coin magnet. Returns the coins collected this step. */
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
        this.sparkle(chest, a.rarity > 0 ? RARITY_COLOR[a.rarity as 1 | 2 | 3 | 4] : PALETTE.rune);
        this.onAbsorbed?.(a.rarity);
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
          if (dist < 0.6) { collected += p.drop.amount; this.scene.remove(p.object); disposeObject(p.object); this.pickups.splice(i, 1); this.sparkle(p.pos, 0xffc23a); continue; }
        }
      }
      p.object.position.copy(p.pos);
      p.object.rotation.y += dt * p.spin;
      if (p.landed) p.object.position.y += Math.sin(p.life * 3) * 0.08 + 0.1;
    }
    return collected;
  }
}

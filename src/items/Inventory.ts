import { ITEMS, canWield, type ItemDef, type WeaponClass } from './Items';

export interface InvEntry { uid: number; itemId: string; count: number; equippedBy?: string }

let nextUid = 1;

/** Pure inventory: stacks, equipment per character, Moon Shards (the currency, `shards`). */
export class Inventory {
  readonly entries: InvEntry[] = [];
  shards = 0;

  def(itemId: string): ItemDef {
    const d = ITEMS[itemId];
    if (!d) throw new Error(`Unknown item ${itemId}`);
    return d;
  }

  /** Adds an item; stackables merge. Returns the entry uid. */
  add(itemId: string, count = 1): number {
    const d = this.def(itemId);
    if (d.kind !== 'weapon') {
      const existing = this.entries.find((e) => e.itemId === itemId);
      if (existing) { existing.count += count; return existing.uid; }
    }
    const e: InvEntry = { uid: nextUid++, itemId, count: d.kind === 'weapon' ? 1 : count };
    this.entries.push(e);
    if (d.kind === 'weapon' && count > 1) for (let i = 1; i < count; i++) this.entries.push({ uid: nextUid++, itemId, count: 1 });
    return e.uid;
  }

  count(itemId: string): number {
    return this.entries.filter((e) => e.itemId === itemId).reduce((n, e) => n + e.count, 0);
  }

  has(itemId: string): boolean {
    return this.count(itemId) > 0;
  }

  remove(itemId: string, count = 1): boolean {
    if (this.count(itemId) < count) return false;
    let left = count;
    for (let i = this.entries.length - 1; i >= 0 && left > 0; i--) {
      const e = this.entries[i];
      if (e.itemId !== itemId || e.equippedBy) continue;
      const take = Math.min(left, e.count);
      e.count -= take;
      left -= take;
      if (e.count <= 0) this.entries.splice(i, 1);
    }
    return left === 0;
  }

  /** Equips the entry on the character whose weapon hand is `weaponClass` (it takes every class WEAPON_ACCEPTS lists for it). */
  equip(uid: number, characterId: string, weaponClass: WeaponClass): boolean {
    const e = this.entries.find((x) => x.uid === uid);
    if (!e) return false;
    const d = this.def(e.itemId);
    if (d.kind !== 'weapon' || !canWield(weaponClass, d.weaponClass)) return false;
    for (const other of this.entries) if (other.equippedBy === characterId) other.equippedBy = undefined;
    e.equippedBy = characterId;
    return true;
  }

  unequip(characterId: string): void {
    for (const e of this.entries) if (e.equippedBy === characterId) e.equippedBy = undefined;
  }

  equipped(characterId: string): InvEntry | undefined {
    return this.entries.find((e) => e.equippedBy === characterId);
  }

  /** Sells `count` of an entry; returns shards gained (0 if refused). */
  sell(uid: number, count = 1): number {
    const e = this.entries.find((x) => x.uid === uid);
    if (!e || e.equippedBy) return 0;
    const n = Math.min(count, e.count);
    const gain = this.def(e.itemId).value * n;
    e.count -= n;
    if (e.count <= 0) this.entries.splice(this.entries.indexOf(e), 1);
    this.shards += gain;
    return gain;
  }

  spend(amount: number): boolean {
    if (this.shards < amount) return false;
    this.shards -= amount;
    return true;
  }

  /** The strongest charm carried counts, and only that one (charms do not stack; the charm slot comes later). */
  damageMult(): number {
    let m = 1;
    for (const e of this.entries) {
      const d = this.def(e.itemId);
      if (d.dmgMult && d.dmgMult > m) m = d.dmgMult;
    }
    return m;
  }

  reveals(): boolean {
    return this.entries.some((e) => this.def(e.itemId).reveals);
  }
}

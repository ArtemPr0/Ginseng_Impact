import { canWield, itemDef, type Affix, type ItemDef, type WeaponClass } from './Items';

export interface InvEntry {
  uid: number;
  itemId: string;
  count: number;
  /** The character wielding it (weapons). */
  equippedBy?: string;
  /** Rolled bonus lines (weapons from drops). An affixed entry never stacks with a plain one. */
  affix?: Affix;
  /** The character wearing it in their charm slot (charms; one per hero). */
  charmOf?: string;
}

/** The bag as a save sees it: every entry without its uid (restore renumbers them) and the shards. */
export interface InvSnapshot { shards: number; entries: Array<Omit<InvEntry, 'uid'>> }

let nextUid = 1;

/** Weapons and charms are one to an entry (each is wielded or worn on its own); everything else stacks. */
const single = (d: ItemDef): boolean => d.kind === 'weapon' || d.kind === 'charm';
/** The most entries one saved weapon or charm stack unfolds into (a hand-edited count of 1e9 would hang the tab). */
const MAX_SINGLES = 99;

/** Pure inventory: stacks, equipment per character, the charm slot per character, Moon Shards (the currency, `shards`). */
export class Inventory {
  readonly entries: InvEntry[] = [];
  shards = 0;

  /** The item's definition; throws for an id that names no item (Items.itemDef: never an inherited key like 'constructor'). */
  def(itemId: string): ItemDef {
    const d = itemDef(itemId);
    if (!d) throw new Error(`Unknown item ${itemId}`);
    return d;
  }

  /**
   * Adds an item; plain stackables merge (an affixed item is its own entry). Weapons and charms never stack: each is
   * its own entry, so two heroes wear one lunar charm each and the spare still sells. Returns the (first) entry uid.
   */
  add(itemId: string, count = 1, affix?: Affix): number {
    const d = this.def(itemId);
    if (!single(d) && !affix) {
      const existing = this.entries.find((e) => e.itemId === itemId && !e.affix);
      if (existing) { existing.count += count; return existing.uid; }
    }
    const e = this.push(itemId, single(d) ? 1 : count, affix);
    if (single(d)) for (let i = 1; i < count; i++) this.push(itemId, 1, affix);
    return e.uid;
  }

  private push(itemId: string, count: number, affix?: Affix): InvEntry {
    const e: InvEntry = { uid: nextUid++, itemId, count };
    if (affix) e.affix = { ...affix };
    this.entries.push(e);
    return e;
  }

  count(itemId: string): number {
    return this.entries.filter((e) => e.itemId === itemId).reduce((n, e) => n + e.count, 0);
  }

  has(itemId: string): boolean {
    return this.count(itemId) > 0;
  }

  /** How many of an item are neither wielded nor worn (what `remove` may take). */
  loose(itemId: string): number {
    return this.entries.filter((e) => e.itemId === itemId && !e.equippedBy && !e.charmOf).reduce((n, e) => n + e.count, 0);
  }

  /**
   * Removes `count` of an item from its loose entries (never from a wielded weapon or a worn charm). All or nothing:
   * when fewer than `count` are loose it takes none and returns false.
   */
  remove(itemId: string, count = 1): boolean {
    if (this.loose(itemId) < count) return false;
    let left = count;
    for (let i = this.entries.length - 1; i >= 0 && left > 0; i--) {
      const e = this.entries[i];
      if (e.itemId !== itemId || e.equippedBy || e.charmOf) continue;
      const take = Math.min(left, e.count);
      e.count -= take;
      left -= take;
      if (e.count <= 0) this.entries.splice(i, 1);
    }
    return left === 0;
  }

  /** Removes `count` from one entry by uid (dropping an affixed weapon takes that very one); refused while worn. */
  removeEntry(uid: number, count = 1): boolean {
    const e = this.entries.find((x) => x.uid === uid);
    if (!e || e.equippedBy || e.charmOf || e.count < count) return false;
    e.count -= count;
    if (e.count <= 0) this.entries.splice(this.entries.indexOf(e), 1);
    return true;
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

  /** Puts a charm in `characterId`'s slot: one per hero, and a charm another hero wears moves over. */
  equipCharm(uid: number, characterId: string): boolean {
    const e = this.entries.find((x) => x.uid === uid);
    if (!e || this.def(e.itemId).kind !== 'charm') return false;
    for (const other of this.entries) if (other.charmOf === characterId) other.charmOf = undefined;
    e.charmOf = characterId;
    return true;
  }

  unequipCharm(characterId: string): void {
    for (const e of this.entries) if (e.charmOf === characterId) e.charmOf = undefined;
  }

  /** The charm in `characterId`'s slot, if any. */
  charmOf(characterId: string): InvEntry | null {
    return this.entries.find((e) => e.charmOf === characterId) ?? null;
  }

  /** Sells `count` of an entry; returns shards gained (0 if refused: wielded or worn). */
  sell(uid: number, count = 1): number {
    const e = this.entries.find((x) => x.uid === uid);
    if (!e || e.equippedBy || e.charmOf) return 0;
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

  /**
   * Damage multiplier from charms. With a character id: the charm in that hero's slot alone (1 with none). Without:
   * the strongest charm carried, for callers that do not pass the hero yet.
   */
  damageMult(characterId?: string): number {
    if (characterId !== undefined) {
      const c = this.charmOf(characterId);
      return c ? this.def(c.itemId).dmgMult ?? 1 : 1;
    }
    let m = 1;
    for (const e of this.entries) {
      const d = this.def(e.itemId);
      if (d.dmgMult && d.dmgMult > m) m = d.dmgMult;
    }
    return m;
  }

  /** Flat attack from the wielded weapon and its affix (what CombatSystem.atkOf adds to the hero's own attack). */
  atkBonus(characterId: string): number {
    const w = this.equipped(characterId);
    return w ? (this.def(w.itemId).atk ?? 0) + (w.affix?.atk ?? 0) : 0;
  }

  /** Extra crit chance (0..1) from the worn charm's affix and the wielded weapon's. */
  critBonus(characterId: string): number {
    return (this.charmOf(characterId)?.affix?.crit ?? 0) + (this.equipped(characterId)?.affix?.crit ?? 0);
  }

  /** Flat max HP from the worn charm's affix and the wielded weapon's. */
  hpBonus(characterId: string): number {
    return (this.charmOf(characterId)?.affix?.hp ?? 0) + (this.equipped(characterId)?.affix?.hp ?? 0);
  }

  reveals(): boolean {
    return this.entries.some((e) => this.def(e.itemId).reveals);
  }

  /** The bag for a save: entries without uids, plain data only. */
  snapshot(): InvSnapshot {
    const entries = this.entries.map((e) => {
      const s: Omit<InvEntry, 'uid'> = { itemId: e.itemId, count: e.count };
      if (e.equippedBy) s.equippedBy = e.equippedBy;
      if (e.charmOf) s.charmOf = e.charmOf;
      if (e.affix) s.affix = { ...e.affix };
      return s;
    });
    return { shards: this.shards, entries };
  }

  /**
   * Replaces the bag with a snapshot's; entries get fresh uids. An entry whose item no longer exists (or whose id is no
   * item at all: 'constructor', '__proto__') is dropped, and a hand-edited save is kept sane: a weapon or charm with
   * count n becomes n entries (at most MAX_SINGLES), only a weapon is wielded and only a charm worn, and where the save
   * gives one hero two of either the first wins.
   */
  restore(s: InvSnapshot): void {
    this.entries.length = 0;
    this.shards = Math.max(0, Math.floor(s.shards)) || 0;
    for (const e of s.entries) {
      const d = itemDef(e.itemId);
      if (!d) continue;
      let n = Math.floor(e.count);
      if (single(d)) n = Math.min(n, MAX_SINGLES);
      if (!(n > 0)) continue;
      const first = this.push(e.itemId, single(d) ? 1 : n, e.affix);
      if (d.kind === 'weapon' && e.equippedBy && !this.equipped(e.equippedBy)) first.equippedBy = e.equippedBy;
      if (d.kind === 'charm' && e.charmOf && !this.charmOf(e.charmOf)) first.charmOf = e.charmOf;
      if (single(d)) for (let i = 1; i < n; i++) this.push(e.itemId, 1, e.affix);
    }
  }
}

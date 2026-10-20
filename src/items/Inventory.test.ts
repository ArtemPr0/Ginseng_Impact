import { describe, expect, it } from 'vitest';
import { Inventory } from './Inventory';
import { WEAPON_ACCEPTS, entryName } from './Items';

describe('Inventory', () => {
  it('stacks materials and consumables, keeps weapons and charms as separate entries', () => {
    const inv = new Inventory();
    inv.add('moon-dew', 2);
    inv.add('moon-dew', 1);
    inv.add('travelers-blade');
    inv.add('travelers-blade');
    inv.add('lunar-charm');
    inv.add('lunar-charm', 2);
    expect(inv.count('moon-dew')).toBe(3);
    expect(inv.entries.filter((e) => e.itemId === 'moon-dew')).toHaveLength(1);
    expect(inv.entries.filter((e) => e.itemId === 'travelers-blade')).toHaveLength(2);
    expect(inv.entries.filter((e) => e.itemId === 'lunar-charm').map((e) => e.count)).toEqual([1, 1, 1]);
    expect(inv.count('lunar-charm')).toBe(3);
  });

  it('removes and refuses to go negative', () => {
    const inv = new Inventory();
    inv.add('moon-dew', 2);
    expect(inv.remove('moon-dew', 1)).toBe(true);
    expect(inv.remove('moon-dew', 5)).toBe(false);
    expect(inv.count('moon-dew')).toBe(1);
  });

  it('equips a weapon only for a matching class, one per character', () => {
    const inv = new Inventory();
    const a = inv.add('travelers-blade');
    const b = inv.add('glacier-maul');
    expect(inv.equip(a, 'vesper', 'sword')).toBe(true);
    expect(inv.equip(b, 'vesper', 'sword')).toBe(false);
    expect(inv.equip(b, 'morrow', 'greatsword')).toBe(true);
    expect(inv.equipped('vesper')?.itemId).toBe('travelers-blade');
    expect(inv.equipped('morrow')?.itemId).toBe('glacier-maul');
    const c = inv.add('crown-blade');
    expect(inv.equip(c, 'vesper', 'sword')).toBe(true);
    expect(inv.equipped('vesper')?.itemId).toBe('crown-blade');
    expect(inv.entries.find((e) => e.uid === a)?.equippedBy).toBeUndefined();
  });

  it('cannot sell or drop an equipped weapon, and selling pays the item value', () => {
    const inv = new Inventory();
    const a = inv.add('travelers-blade');
    inv.equip(a, 'vesper', 'sword');
    expect(inv.sell(a)).toBe(0);
    inv.add('beast-fang', 3);
    const fang = inv.entries.find((e) => e.itemId === 'beast-fang')!.uid;
    expect(inv.sell(fang, 2)).toBe(28);
    expect(inv.count('beast-fang')).toBe(1);
    expect(inv.shards).toBe(28);
  });

  it('spends shards only when affordable and applies charm multipliers', () => {
    const inv = new Inventory();
    inv.shards = 100;
    expect(inv.spend(120)).toBe(false);
    expect(inv.spend(60)).toBe(true);
    expect(inv.shards).toBe(40);
    expect(inv.damageMult()).toBe(1);
    inv.add('lunar-charm');
    expect(inv.damageMult()).toBeCloseTo(1.15);
  });

  it('lets the knight (a greatsword hand) equip a sword or a greatsword, never a bow', () => {
    expect(WEAPON_ACCEPTS.greatsword).toEqual(['greatsword', 'sword']);
    expect(WEAPON_ACCEPTS.sword).toEqual(['sword']);
    expect(WEAPON_ACCEPTS.bow).toEqual(['bow']);
    expect(WEAPON_ACCEPTS.staff).toEqual(['staff']);
    const inv = new Inventory();
    const blade = inv.add('mist-blade'); // Yung Lean's reward: a sword
    const maul = inv.add('glacier-maul'); // a greatsword
    const bow = inv.add('hunters-bow');
    expect(inv.equip(blade, 'knight', 'greatsword')).toBe(true);
    expect(inv.equipped('knight')?.itemId).toBe('mist-blade');
    expect(inv.equip(bow, 'knight', 'greatsword')).toBe(false);
    expect(inv.equipped('knight')?.itemId).toBe('mist-blade');
    expect(inv.equip(maul, 'knight', 'greatsword')).toBe(true);
    expect(inv.equipped('knight')?.itemId).toBe('glacier-maul');
    // A sword hand takes no greatsword, a bow hand only bows.
    expect(inv.equip(maul, 'vesper', 'sword')).toBe(false);
    expect(inv.equip(blade, 'archer', 'bow')).toBe(false);
    expect(inv.equip(bow, 'archer', 'bow')).toBe(true);
  });

  it('counts only the strongest charm carried, not every charm stacked', () => {
    const inv = new Inventory();
    inv.add('lunar-charm'); // +15%
    inv.add('hollow-crown'); // +30%
    inv.add('antler-signet'); // +25%
    expect(inv.damageMult()).toBeCloseTo(1.3);
    inv.remove('hollow-crown');
    expect(inv.damageMult()).toBeCloseTo(1.25);
  });
});

describe('Inventory — the charm slot', () => {
  it('wears one charm per hero, and a charm moves between heroes', () => {
    const inv = new Inventory();
    const lunar = inv.add('lunar-charm');
    const crown = inv.add('hollow-crown');
    expect(inv.charmOf('knight')).toBeNull();
    expect(inv.damageMult('knight')).toBe(1);
    expect(inv.equipCharm(lunar, 'knight')).toBe(true);
    expect(inv.charmOf('knight')?.itemId).toBe('lunar-charm');
    expect(inv.damageMult('knight')).toBeCloseTo(1.15);
    expect(inv.damageMult('archer')).toBe(1);
    // A second charm on the same hero replaces the first.
    expect(inv.equipCharm(crown, 'knight')).toBe(true);
    expect(inv.charmOf('knight')?.itemId).toBe('hollow-crown');
    expect(inv.entries.find((e) => e.uid === lunar)?.charmOf).toBeUndefined();
    expect(inv.damageMult('knight')).toBeCloseTo(1.3);
    // Re-equipping on another hero moves it over.
    expect(inv.equipCharm(crown, 'archer')).toBe(true);
    expect(inv.charmOf('knight')).toBeNull();
    expect(inv.charmOf('archer')?.itemId).toBe('hollow-crown');
    expect(inv.damageMult('knight')).toBe(1);
    expect(inv.damageMult('archer')).toBeCloseTo(1.3);
    // Only charms go in the slot.
    expect(inv.equipCharm(inv.add('moon-dew'), 'knight')).toBe(false);
    expect(inv.equipCharm(inv.add('travelers-blade'), 'knight')).toBe(false);
    expect(inv.equipCharm(9999, 'knight')).toBe(false);
    inv.unequipCharm('archer');
    expect(inv.charmOf('archer')).toBeNull();
  });

  it('keeps the old call form: without a hero id the strongest charm carried counts', () => {
    const inv = new Inventory();
    inv.add('lunar-charm');
    const crown = inv.add('hollow-crown');
    expect(inv.damageMult()).toBeCloseTo(1.3);
    inv.equipCharm(crown, 'wizard');
    expect(inv.damageMult()).toBeCloseTo(1.3);
    expect(inv.damageMult('wizard')).toBeCloseTo(1.3);
    expect(inv.damageMult('knight')).toBe(1);
  });

  it('keeps charms one to an entry: two bought at the market, two heroes wear one each, the spare sells', () => {
    const inv = new Inventory();
    inv.shards = 400;
    // The village market sells the lunar charm at 180 (world/NPCs): the shop spends, then adds.
    expect(inv.spend(180)).toBe(true);
    const first = inv.add('lunar-charm');
    expect(inv.spend(180)).toBe(true);
    const second = inv.add('lunar-charm');
    expect(second).not.toBe(first);
    expect(inv.entries.filter((e) => e.itemId === 'lunar-charm').map((e) => e.count)).toEqual([1, 1]);
    expect(inv.count('lunar-charm')).toBe(2);
    expect(inv.equipCharm(first, 'knight')).toBe(true);
    expect(inv.equipCharm(second, 'archer')).toBe(true);
    expect(inv.charmOf('knight')?.uid).toBe(first);
    expect(inv.charmOf('archer')?.uid).toBe(second);
    expect(inv.damageMult('knight')).toBeCloseTo(1.15);
    expect(inv.damageMult('archer')).toBeCloseTo(1.15);
    // Moving one hero's charm leaves the other's where it is.
    expect(inv.equipCharm(second, 'wizard')).toBe(true);
    expect(inv.charmOf('knight')?.uid).toBe(first);
    expect(inv.charmOf('archer')).toBeNull();
    expect(inv.charmOf('wizard')?.uid).toBe(second);
    // A third, out of a chest, is the spare: it sells (and drops); the worn ones do not.
    const spare = inv.add('lunar-charm');
    expect(inv.sell(first)).toBe(0);
    expect(inv.remove('lunar-charm', 2)).toBe(false);
    expect(inv.sell(spare)).toBe(90);
    expect(inv.shards).toBe(400 - 360 + 90);
    expect(inv.count('lunar-charm')).toBe(2);
    expect(inv.charmOf('knight')?.uid).toBe(first);
    expect(inv.charmOf('wizard')?.uid).toBe(second);
    // A count splits the same way, and remove takes the loose ones only.
    inv.add('lunar-charm', 2);
    expect(inv.entries.filter((e) => e.itemId === 'lunar-charm')).toHaveLength(4);
    expect(inv.remove('lunar-charm', 2)).toBe(true);
    expect(inv.count('lunar-charm')).toBe(2);
    expect(inv.charmOf('knight')?.uid).toBe(first);
    expect(inv.charmOf('wizard')?.uid).toBe(second);
  });

  it('refuses to sell or drop a worn charm', () => {
    const inv = new Inventory();
    const lunar = inv.add('lunar-charm');
    inv.equipCharm(lunar, 'knight');
    expect(inv.sell(lunar)).toBe(0);
    expect(inv.remove('lunar-charm')).toBe(false);
    expect(inv.removeEntry(lunar)).toBe(false);
    expect(inv.count('lunar-charm')).toBe(1);
    inv.unequipCharm('knight');
    expect(inv.sell(lunar)).toBe(90);
  });
});

describe('Inventory — affixes', () => {
  it('keeps an affixed weapon as its own entry and adds its lines to the wielder', () => {
    const inv = new Inventory();
    const plain = inv.add('fang-cleaver');
    const moon = inv.add('fang-cleaver', 1, { atk: 8, crit: 0.05, name: 'of the Moon' });
    expect(moon).not.toBe(plain);
    expect(inv.entries).toHaveLength(2);
    expect(inv.entries.find((e) => e.uid === moon)?.affix).toEqual({ atk: 8, crit: 0.05, name: 'of the Moon' });
    expect(inv.entries.find((e) => e.uid === plain)?.affix).toBeUndefined();
    expect(inv.atkBonus('knight')).toBe(0);
    inv.equip(plain, 'knight', 'greatsword');
    expect(inv.atkBonus('knight')).toBe(40);
    expect(inv.critBonus('knight')).toBe(0);
    inv.equip(moon, 'knight', 'greatsword');
    expect(inv.atkBonus('knight')).toBe(48);
    expect(inv.critBonus('knight')).toBeCloseTo(0.05);
    expect(inv.hpBonus('knight')).toBe(0);
    expect(inv.atkBonus('archer')).toBe(0);
    expect(entryName('fang-cleaver', inv.equipped('knight')!.affix)).toBe('Fang Cleaver of the Moon');
    expect(entryName('fang-cleaver')).toBe('Fang Cleaver');
  });

  it('never stacks an affixed item with a plain one', () => {
    const inv = new Inventory();
    inv.add('moon-dew', 2);
    inv.add('moon-dew', 1, { hp: 40, name: 'of the Tide' });
    expect(inv.count('moon-dew')).toBe(3);
    expect(inv.entries).toHaveLength(2);
    inv.add('moon-dew');
    expect(inv.entries).toHaveLength(2);
    expect(inv.entries.find((e) => !e.affix)?.count).toBe(3);
    expect(inv.entries.find((e) => e.affix)?.count).toBe(1);
    // Two affixed weapons at once: one entry each, both with the lines.
    inv.add('travelers-blade', 2, { atk: 5, name: 'of the Rot' });
    expect(inv.entries.filter((e) => e.itemId === 'travelers-blade').map((e) => e.affix?.atk)).toEqual([5, 5]);
  });

  it('sums crit and HP from the worn charm and the wielded weapon', () => {
    const inv = new Inventory();
    const charm = inv.add('third-eye', 1, { crit: 0.03, hp: 100, name: 'of the Astral' });
    const bow = inv.add('moonstring-bow', 1, { crit: 0.05, hp: 50, name: 'of the Fog' });
    inv.equipCharm(charm, 'archer');
    inv.equip(bow, 'archer', 'bow');
    expect(inv.critBonus('archer')).toBeCloseTo(0.08);
    expect(inv.hpBonus('archer')).toBe(150);
    expect(inv.atkBonus('archer')).toBe(42);
    expect(inv.damageMult('archer')).toBeCloseTo(1.25);
    expect(inv.critBonus('knight')).toBe(0);
  });

  it('drops one entry by uid, the very one picked', () => {
    const inv = new Inventory();
    const plain = inv.add('fang-cleaver');
    const moon = inv.add('fang-cleaver', 1, { atk: 8, name: 'of the Moon' });
    expect(inv.removeEntry(moon)).toBe(true);
    expect(inv.entries.map((e) => e.uid)).toEqual([plain]);
    expect(inv.removeEntry(moon)).toBe(false);
    inv.add('moon-dew', 3);
    const dew = inv.entries.find((e) => e.itemId === 'moon-dew')!.uid;
    expect(inv.removeEntry(dew, 2)).toBe(true);
    expect(inv.count('moon-dew')).toBe(1);
    expect(inv.removeEntry(dew, 2)).toBe(false);
    expect(inv.removeEntry(dew)).toBe(true);
    expect(inv.has('moon-dew')).toBe(false);
  });
});

describe('Inventory — snapshot and restore', () => {
  it('round-trips the bag as plain data, renumbering the uids', () => {
    const inv = new Inventory();
    inv.shards = 77;
    inv.add('moon-dew', 2);
    const cleaver = inv.add('fang-cleaver', 1, { atk: 8, crit: 0.05, name: 'of the Moon' });
    inv.equip(cleaver, 'knight', 'greatsword');
    inv.equipCharm(inv.add('lunar-charm'), 'archer');
    inv.add('star-chart');
    const s = inv.snapshot();
    expect(s.shards).toBe(77);
    expect(s.entries).toEqual([
      { itemId: 'moon-dew', count: 2 },
      { itemId: 'fang-cleaver', count: 1, equippedBy: 'knight', affix: { atk: 8, crit: 0.05, name: 'of the Moon' } },
      { itemId: 'lunar-charm', count: 1, charmOf: 'archer' },
      { itemId: 'star-chart', count: 1 },
    ]);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
    const b = new Inventory();
    b.add('beast-fang', 9);
    b.restore(JSON.parse(JSON.stringify(s)));
    expect(b.snapshot()).toEqual(s);
    expect(b.shards).toBe(77);
    expect(b.has('beast-fang')).toBe(false);
    expect(b.equipped('knight')?.itemId).toBe('fang-cleaver');
    expect(b.atkBonus('knight')).toBe(48);
    expect(b.charmOf('archer')?.itemId).toBe('lunar-charm');
    expect(b.reveals()).toBe(true);
    const uids = b.entries.map((e) => e.uid);
    expect(new Set(uids).size).toBe(uids.length);
    for (const e of inv.entries) expect(uids).not.toContain(e.uid);
    // The snapshot is a copy: changing the bag afterwards leaves it alone.
    b.entries[1].affix!.atk = 99;
    expect(s.entries[1].affix?.atk).toBe(8);
  });

  it('drops entries whose item no longer exists and mends bad counts', () => {
    const inv = new Inventory();
    inv.restore({ shards: -4, entries: [{ itemId: 'gone-item', count: 1 }, { itemId: 'moon-dew', count: 0 }, { itemId: 'rune-shard', count: 2.7 }, { itemId: 'old-bone', count: 0.5 }] });
    expect(inv.shards).toBe(0);
    expect(inv.entries).toEqual([{ uid: expect.any(Number), itemId: 'rune-shard', count: 2 }]);
  });

  it('restores a charm or weapon stack one to an entry, and keeps a hand-edited save sane', () => {
    const inv = new Inventory();
    inv.restore({ shards: 5, entries: [
      { itemId: 'lunar-charm', count: 3, charmOf: 'knight' },
      { itemId: 'hollow-crown', count: 1, charmOf: 'knight' },                   // a second charm on the knight: the first wins
      { itemId: 'moon-dew', count: 2, charmOf: 'archer', equippedBy: 'archer' }, // a consumable is neither worn nor wielded
      { itemId: 'travelers-blade', count: 3, equippedBy: 'wizard', affix: { atk: 5, name: 'of the Rot' } },
      { itemId: 'glacier-maul', count: 1, equippedBy: 'wizard' },                // a second weapon in the wizard's hand: the first wins
    ] });
    expect(inv.shards).toBe(5);
    expect(inv.entries.filter((e) => e.itemId === 'lunar-charm').map((e) => e.count)).toEqual([1, 1, 1]);
    expect(inv.entries.filter((e) => e.charmOf === 'knight')).toHaveLength(1);
    expect(inv.charmOf('knight')?.itemId).toBe('lunar-charm');
    expect(inv.entries.find((e) => e.itemId === 'hollow-crown')?.charmOf).toBeUndefined();
    expect(inv.charmOf('archer')).toBeNull();
    expect(inv.equipped('archer')).toBeUndefined();
    expect(inv.entries.find((e) => e.itemId === 'moon-dew')).toEqual({ uid: expect.any(Number), itemId: 'moon-dew', count: 2 });
    expect(inv.entries.filter((e) => e.itemId === 'travelers-blade').map((e) => [e.count, e.affix?.atk])).toEqual([[1, 5], [1, 5], [1, 5]]);
    expect(inv.entries.filter((e) => e.equippedBy === 'wizard')).toHaveLength(1);
    expect(inv.equipped('wizard')?.itemId).toBe('travelers-blade');
    expect(inv.entries.find((e) => e.itemId === 'glacier-maul')?.equippedBy).toBeUndefined();
    // The two spare charms sell one at a time; the knight's does not.
    const spare = inv.entries.find((e) => e.itemId === 'lunar-charm' && !e.charmOf)!;
    expect(inv.sell(spare.uid)).toBe(90);
    expect(inv.sell(inv.charmOf('knight')!.uid)).toBe(0);
    expect(inv.count('lunar-charm')).toBe(2);
    // And it snapshots back as single entries.
    expect(inv.snapshot().entries.filter((e) => e.itemId === 'lunar-charm')).toEqual([{ itemId: 'lunar-charm', count: 1, charmOf: 'knight' }, { itemId: 'lunar-charm', count: 1 }]);
  });
});

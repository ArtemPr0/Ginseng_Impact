import { describe, expect, it } from 'vitest';
import { Inventory } from './Inventory';
import { WEAPON_ACCEPTS } from './Items';

describe('Inventory', () => {
  it('stacks materials and consumables, keeps weapons as separate entries', () => {
    const inv = new Inventory();
    inv.add('moon-dew', 2);
    inv.add('moon-dew', 1);
    inv.add('travelers-blade');
    inv.add('travelers-blade');
    expect(inv.count('moon-dew')).toBe(3);
    expect(inv.entries.filter((e) => e.itemId === 'travelers-blade')).toHaveLength(2);
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

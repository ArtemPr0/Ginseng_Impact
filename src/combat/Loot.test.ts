import { describe, expect, it } from 'vitest';
import { rollDrops, type ItemDrop } from './Loot';
import { AFFIX_TOKENS, ITEMS, rollAffix } from '../items/Items';

/** mulberry32: a small seeded generator for repeatable rolls. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NAMES = Object.values(AFFIX_TOKENS).map((t) => `of the ${t}`);
const lineCount = (a: { atk?: number; hp?: number; crit?: number } | undefined) => a ? ['atk', 'hp', 'crit'].filter((k) => a[k as 'atk' | 'hp' | 'crit'] !== undefined).length : 0;

describe('rollDrops', () => {
  it('always yields shards in range and items by chance', () => {
    const seq = [0.5, 0.1, 0.9];
    let i = 0;
    const rnd = () => seq[i++ % seq.length];
    const drops = rollDrops([{ itemId: 'beast-fang', chance: 0.5 }, { itemId: 'moon-dew', chance: 0.5 }], [10, 20], rnd);
    expect(drops[0]).toEqual({ kind: 'shards', amount: 15 });
    expect(drops.slice(1)).toEqual([{ kind: 'item', itemId: 'beast-fang', count: 1 }]);
  });

  it('guaranteed drops always appear, and a mythic weapon comes with its lines', () => {
    const drops = rollDrops([{ itemId: 'glacier-maul', chance: 1 }], [0, 0], () => 0.999);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({ kind: 'item', itemId: 'glacier-maul', count: 1 });
    const affix = (drops[0] as ItemDrop).affix!;
    expect(affix.element).toBe('astral');
    expect(affix.name).toBe('of the Astral');
    expect(lineCount(affix)).toBe(2);
  });

  it('still works without a generator (the old call form)', () => {
    const drops = rollDrops([{ itemId: 'moon-dew', chance: 1 }], [5, 5]);
    expect(drops).toEqual([{ kind: 'shards', amount: 5 }, { kind: 'item', itemId: 'moon-dew', count: 1 }]);
  });

  it('rolls the same drops for the same seed, different ones for another', () => {
    const table = [{ itemId: 'glacier-maul', chance: 1 }, { itemId: 'witch-staff', chance: 0.7 }, { itemId: 'beast-fang', chance: 0.6 }];
    const a = rollDrops(table, [10, 60], seeded(7));
    expect(a).toEqual(rollDrops(table, [10, 60], seeded(7)));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(rollDrops(table, [10, 60], seeded(8))));
  });

  it('gives weapons an affix by rarity and materials none', () => {
    const byRarity: Record<number, string> = { 1: 'travelers-blade', 2: 'witch-staff', 3: 'crown-blade', 4: 'glacier-maul' };
    for (let seed = 1; seed <= 40; seed++) {
      for (const [rarity, itemId] of Object.entries(byRarity)) {
        const drop = rollDrops([{ itemId, chance: 1 }], [0, 0], seeded(seed))[0] as ItemDrop;
        expect(drop.kind).toBe('item');
        expect(ITEMS[itemId].rarity).toBe(Number(rarity));
        const a = drop.affix;
        if (rarity === '1') { expect(a).toBeUndefined(); continue; }
        expect(a).toBeDefined();
        expect(NAMES).toContain(a!.name);
        expect(lineCount(a)).toBe(rarity === '2' ? 1 : 2);
        if (rarity === '4') {
          expect(a!.element).toBeDefined();
          expect(a!.name).toBe(`of the ${AFFIX_TOKENS[a!.element!]}`);
        } else expect(a!.element).toBeUndefined();
        if (a!.atk !== undefined) { expect(a!.atk).toBeGreaterThanOrEqual(4); expect(a!.atk).toBeLessThanOrEqual(rarity === '4' ? 24 : rarity === '3' ? 18 : 12); }
        if (a!.hp !== undefined) { expect(a!.hp).toBeGreaterThanOrEqual(40); expect(a!.hp).toBeLessThanOrEqual(160); expect(a!.hp % 10).toBe(0); }
        if (a!.crit !== undefined) { expect(a!.crit).toBeGreaterThanOrEqual(0.03); expect(a!.crit).toBeLessThanOrEqual(0.08); }
      }
      const fang = rollDrops([{ itemId: 'warden-antler', chance: 1 }, { itemId: 'rot-salve', chance: 1 }], [0, 0], seeded(seed));
      expect(fang).toEqual([{ kind: 'item', itemId: 'warden-antler', count: 1 }, { kind: 'item', itemId: 'rot-salve', count: 1 }]);
    }
  });
});

describe('rollAffix', () => {
  it('rolls nothing for a common item', () => {
    expect(rollAffix(1, () => 0.5)).toBeNull();
    expect(rollAffix(0, () => 0.5)).toBeNull();
  });

  it('follows the generator exactly', () => {
    // Everything at the bottom of its range: the first token, the attack line at its floor.
    expect(rollAffix(2, () => 0)).toEqual({ name: 'of the Moon', atk: 4 });
    expect(rollAffix(3, () => 0)).toEqual({ name: 'of the Moon', atk: 6, hp: 40 });
    expect(rollAffix(4, () => 0)).toEqual({ name: 'of the Moon', element: 'lunar', atk: 8, hp: 40 });
    // And at the top: the last token, the crit line then the HP line, at their ceilings.
    expect(rollAffix(2, () => 0.999999)).toEqual({ name: 'of the Astral', crit: 0.08 });
    expect(rollAffix(4, () => 0.999999)).toEqual({ name: 'of the Astral', element: 'astral', crit: 0.08, hp: 160 });
    // The same sequence twice rolls the same affix.
    expect(rollAffix(4, seeded(99))).toEqual(rollAffix(4, seeded(99)));
  });

  it('never rolls the same line twice', () => {
    for (let seed = 1; seed <= 60; seed++) {
      const a = rollAffix(4, seeded(seed))!;
      expect(lineCount(a)).toBe(2);
    }
  });
});

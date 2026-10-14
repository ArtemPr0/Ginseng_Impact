import { describe, expect, it } from 'vitest';
import { rollDrops } from './Loot';

describe('rollDrops', () => {
  it('always yields shards in range and items by chance', () => {
    const seq = [0.5, 0.1, 0.9];
    let i = 0;
    const rnd = () => seq[i++ % seq.length];
    const drops = rollDrops([{ itemId: 'beast-fang', chance: 0.5 }, { itemId: 'moon-dew', chance: 0.5 }], [10, 20], rnd);
    expect(drops[0]).toEqual({ kind: 'shards', amount: 15 });
    expect(drops.slice(1)).toEqual([{ kind: 'item', itemId: 'beast-fang', count: 1 }]);
  });

  it('guaranteed drops always appear', () => {
    const drops = rollDrops([{ itemId: 'glacier-maul', chance: 1 }], [0, 0], () => 0.999);
    expect(drops).toEqual([{ kind: 'item', itemId: 'glacier-maul', count: 1 }]);
  });
});

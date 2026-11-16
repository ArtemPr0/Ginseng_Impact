import { describe, expect, it } from 'vitest';
import { breakKindOf } from './BreakKinds';

describe('breakKindOf: what a thing is made of when it breaks', () => {
  it('trees are wood and fall as logs; flowers, mushrooms and kelp are soft and brief', () => {
    for (const id of ['pine', 'birch', 'willow', 'gnarled-tree', 'snow-pine', 'palm']) expect(breakKindOf(id)).toEqual({ material: 'wood', tree: true });
    for (const id of ['flower', 'sunflower', 'rose-bush', 'mushroom', 'giant-mushroom', 'kelp', 'jellyfish']) expect(breakKindOf(id).brief).toBe(true);
  });

  it('boulders, graves and castles are stone; barrels, tables and houses wood; crystals crystal; bottles glass', () => {
    for (const id of ['boulder', 'grave', 'rune-grave', 'castle', 'cathedral', 'round-tower', 'stone-wall']) expect(breakKindOf(id)).toEqual({ material: 'stone' });
    for (const id of ['barrel', 'tavern-table', 'market-stall', 'treehouse', 'boat']) expect(breakKindOf(id).material).toBe('wood');
    expect(breakKindOf('village-house').material).toBe('plaster');
    expect(breakKindOf('purple-crystal').material).toBe('crystal');
    expect(breakKindOf('potion-bottle').material).toBe('glass');
    expect(breakKindOf('gothic-lamp').material).toBe('metal');
    expect(breakKindOf('skull-pile').material).toBe('bone');
  });

  it('nothing solid is brief any more (rocks and barrels used to shrink away like leaves)', () => {
    for (const id of ['boulder', 'barrel', 'grave', 'gem', 'tavern-table', 'skull-pile']) expect(breakKindOf(id).brief).toBeUndefined();
  });
});

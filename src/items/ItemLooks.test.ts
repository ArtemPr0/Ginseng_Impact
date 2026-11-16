import { describe, expect, it } from 'vitest';
import { ITEMS } from './Items';
import { ICON_KEYS, ITEM_LOOKS, itemGlow, lookKey } from './ItemLooks';
import { MODELS } from '../data/models';

// The playtest of 2026-11-14: loot drops "must look unique, not just some white cube or circle… fix this issue all
// around the game". Every item drops as a thing of its own: a small copy of a reel model it is (a potion bottle, the
// crown, a spell book, the hero's own sword, bow or staff, recoloured), or, until its own model is made, its own drawn
// icon (a fang, a hide, a horn, a bell) in its own colour.
describe('what every item looks like on the ground', () => {
  const ids = Object.keys(ITEMS);

  it('every item has a look: a registered model at a size you can see, or a drawn icon', () => {
    for (const id of ids) {
      const look = ITEM_LOOKS[id];
      expect(look, id).toBeDefined();
      if ('model' in look) {
        expect(MODELS[look.model], `${id}: ${look.model}`).toBeDefined();
        expect(look.size, id).toBeGreaterThanOrEqual(0.35);
        expect(look.size, id).toBeLessThanOrEqual(1.3);
      } else if ('icon' in look) expect(ICON_KEYS, id).toContain(look.icon);
      else expect(['log', 'stone', 'plank'], id).toContain(look.make);
    }
  });

  it("wood, stone and planks drop as what they are (the knight's harvest, 2026-11-16)", () => {
    expect(ITEM_LOOKS.wood).toMatchObject({ make: 'log' });
    expect(ITEM_LOOKS.stone).toMatchObject({ make: 'stone' });
    expect(ITEM_LOOKS.plank).toMatchObject({ make: 'plank' });
    for (const id of ['wood', 'stone', 'plank']) expect(ITEMS[id].kind).toBe('material');
  });

  it('no two items look the same', () => {
    const keys = ids.map((id) => lookKey(ITEM_LOOKS[id]));
    expect(new Set(keys).size).toBe(ids.length);
  });

  it('weapons drop as weapons: blades as the sword, bows as the bow, staves as the staff', () => {
    for (const id of ['travelers-blade', 'tide-blade', 'mist-blade']) expect(ITEM_LOOKS[id]).toMatchObject({ model: 'greatsword' });
    for (const id of ['hunters-bow', 'moonstring-bow']) expect(ITEM_LOOKS[id]).toMatchObject({ model: 'bow' });
    for (const id of ['witch-staff', 'horn-staff']) expect(ITEM_LOOKS[id]).toMatchObject({ model: 'staff' });
  });

  it('no item is drawn or glows white (a common item glowed the very white circle the playtest named)', () => {
    const colourful = (c: number) => Math.max((c >> 16) & 255, (c >> 8) & 255, c & 255) - Math.min((c >> 16) & 255, (c >> 8) & 255, c & 255);
    for (const id of ids) {
      const look = ITEM_LOOKS[id];
      if (look.tint !== undefined) expect(colourful(look.tint), `${id} tint`).toBeGreaterThan(24);
      expect(itemGlow(id), `${id} glow`).toBeTypeOf('number');
      expect(colourful(itemGlow(id)), `${id} glow`).toBeGreaterThan(24);
    }
  });
});

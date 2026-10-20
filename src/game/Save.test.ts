import { describe, expect, it } from 'vitest';
import { SAVE_INTERVAL, SAVE_KEY, Save, migrate, type SaveV1, type StorageLike } from './Save';
import { Inventory } from '../items/Inventory';

/** An in-memory localStorage. */
function memory(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => { map.set(k, v); }, removeItem: (k) => { map.delete(k); } };
}

function sample(): SaveV1 {
  const inv = new Inventory();
  inv.shards = 77;
  inv.add('moon-dew', 2);
  inv.equip(inv.add('fang-cleaver', 1, { atk: 8, crit: 0.05, name: 'of the Moon' }), 'knight', 'greatsword');
  inv.equipCharm(inv.add('lunar-charm'), 'archer');
  return {
    v: 1, t: 1_700_000_000_000, zone: 'galaxy', pos: { x: 1000, y: 24, z: -50 }, yaw: 0.5, hero: 'knight',
    hp: { knight: 1700, archer: 900, wizard: 650 }, inventory: inv.snapshot(),
    quests: { throne: 'active', trip: 'done' }, flags: ['licked', 'ale'],
    progress: { xp: 10, level: 2 }, bosses: { yeti: { slainAt: 1_699_999_000_000 } },
    chests: ['gorge-head'], companions: ['vigil'], newGamePlus: false,
  };
}

describe('Save', () => {
  it('round-trips through storage', () => {
    const storage = memory();
    const save = new Save(storage);
    expect(save.has()).toBe(false);
    expect(save.load()).toBeNull();
    const s = sample();
    save.write(s);
    expect(storage.map.has(SAVE_KEY)).toBe(true);
    expect(save.has()).toBe(true);
    expect(save.load()).toEqual(s);
    // And what comes back restores into a bag whose numbers are numbers.
    const back = new Inventory();
    back.restore(save.load()!.inventory);
    expect(back.atkBonus('knight')).toBe(48);
    expect(back.critBonus('knight')).toBeCloseTo(0.05);
    expect(back.charmOf('archer')?.itemId).toBe('lunar-charm');
    // Another Save on the same storage (the next page load) reads it too; another key does not.
    expect(new Save(storage).load()).toEqual(s);
    expect(new Save(storage, 'other').load()).toBeNull();
    save.clear();
    expect(save.has()).toBe(false);
    expect(storage.map.size).toBe(0);
  });

  it('refuses anything malformed', () => {
    const storage = memory();
    const save = new Save(storage);
    const bad = (text: string) => { storage.map.set(SAVE_KEY, text); return save.load(); };
    expect(bad('not json')).toBeNull();
    expect(bad('null')).toBeNull();
    expect(bad('[]')).toBeNull();
    expect(bad('42')).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), v: 2 }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), v: '1' }))).toBeNull();
    const without = (key: keyof SaveV1) => { const s: Partial<SaveV1> = sample(); delete s[key]; return JSON.stringify(s); };
    for (const key of ['t', 'zone', 'pos', 'yaw', 'hero', 'hp', 'inventory', 'quests', 'flags', 'progress', 'bosses', 'chests', 'companions', 'newGamePlus'] as const) {
      expect(bad(without(key)), key).toBeNull();
    }
    expect(bad(JSON.stringify({ ...sample(), zone: 'moon' }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), zone: 'constructor' }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), pos: { x: '1', y: 2, z: 3 } }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), hp: { knight: 'full' } }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), quests: { throne: 2 } }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), flags: ['a', 1] }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), bosses: { yeti: {} } }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), inventory: { shards: 1, entries: [{ count: 1 }] } }))).toBeNull();
    expect(bad(JSON.stringify({ ...sample(), inventory: { shards: 1, entries: [{ itemId: 'x', count: 1, affix: { atk: 2 } }] } }))).toBeNull();
    // An affix's lines must be finite numbers and its element one of the seven: atk '9' would reach computeDamage as "409".
    const affixed = (affix: unknown) => JSON.stringify({ ...sample(), inventory: { shards: 1, entries: [{ itemId: 'fang-cleaver', count: 1, equippedBy: 'knight', affix }] } });
    expect(bad(affixed({ name: 'of the Moon', atk: '9' }))).toBeNull();
    expect(bad(affixed({ name: 'of the Moon', crit: 'lots' }))).toBeNull();
    expect(bad(affixed({ name: 'of the Moon', element: 'plasma' }))).toBeNull();
    expect(bad(affixed({ name: 'of the Moon', hp: null }))).toBeNull();
    expect(bad(affixed({ name: 'of the Moon', element: 'constructor' }))).toBeNull();
    expect(bad(affixed({ name: 'of the Moon', atk: 9, hp: 40, crit: 0.05, element: 'lunar' }))).not.toBeNull();
    expect(bad(JSON.stringify({ ...sample(), newGamePlus: 'no' }))).toBeNull();
    // `state` is optional, and extra fields are no harm.
    expect(bad(JSON.stringify({ ...sample(), state: { kills: 3 }, extra: true }))).not.toBeNull();
    expect(migrate(undefined)).toBeNull();
    expect(migrate(sample())).toEqual(sample());
    expect(migrate({ ...sample(), v: 7 })).toBeNull();
  });

  it('autosaves when dirty and a minute has passed since the last write', () => {
    const storage = memory();
    const save = new Save(storage);
    let writes = 0;
    const snap = () => { writes++; return sample(); };
    expect(save.tick(SAVE_INTERVAL * 2, snap)).toBe(false); // nothing changed yet: nothing written, however long
    expect(writes).toBe(0);
    save.markDirty();
    expect(save.tick(0, snap)).toBe(true); // two minutes since the start: due at once
    expect(writes).toBe(1);
    expect(save.has()).toBe(true);
    // Otherwise the clock counts from the start: the first write comes a minute in.
    const fresh = new Save(memory());
    fresh.markDirty();
    expect(fresh.tick(SAVE_INTERVAL - 1, snap)).toBe(false);
    expect(fresh.tick(1, snap)).toBe(true);
    expect(writes).toBe(2);
    expect(fresh.has()).toBe(true);
    // Written and clean: nothing more until something changes, and then not for another minute.
    expect(fresh.tick(SAVE_INTERVAL * 3, snap)).toBe(false);
    fresh.markDirty();
    expect(fresh.tick(0, snap)).toBe(true);
    expect(writes).toBe(3);
    fresh.markDirty();
    expect(fresh.tick(SAVE_INTERVAL - 0.5, snap)).toBe(false);
    expect(fresh.tick(0.5, snap)).toBe(true);
    expect(writes).toBe(4);
    // An explicit write resets the clock and the flag; the minute counts from that write, dirty or not.
    fresh.markDirty();
    fresh.write(sample());
    expect(fresh.tick(SAVE_INTERVAL - 1, snap)).toBe(false);
    fresh.markDirty();
    expect(fresh.tick(0.5, snap)).toBe(false);
    expect(fresh.tick(0.5, snap)).toBe(true);
    expect(writes).toBe(5);
  });

  it('ignores a NaN, infinite or negative dt, so the minute throttle stays', () => {
    const save = new Save(memory());
    let writes = 0;
    const snap = () => { writes++; return sample(); };
    save.markDirty();
    expect(save.tick(NaN, snap)).toBe(false);
    expect(save.tick(-5, snap)).toBe(false);
    expect(save.tick(Infinity, snap)).toBe(false);
    expect(save.tick(SAVE_INTERVAL - 1, snap)).toBe(false);
    expect(save.tick(1, snap)).toBe(true);
    expect(writes).toBe(1);
    // The clock is still sane afterwards: the next write waits its minute out.
    save.markDirty();
    expect(save.tick(NaN, snap)).toBe(false);
    expect(save.tick(0, snap)).toBe(false);
    expect(save.tick(SAVE_INTERVAL, snap)).toBe(true);
    expect(writes).toBe(2);
  });

  it('survives a storage that throws', () => {
    const broken: StorageLike = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('full'); },
      removeItem: () => { throw new Error('denied'); },
    };
    const save = new Save(broken);
    expect(save.has()).toBe(false);
    expect(save.load()).toBeNull();
    expect(save.write(sample())).toBe(false);
    expect(() => save.clear()).not.toThrow();
    save.markDirty();
    expect(save.tick(SAVE_INTERVAL, () => sample())).toBe(false);
  });

  it('stays dirty when the storage refuses, and tries again a minute later', () => {
    const storage = memory();
    let full = true;
    const flaky: StorageLike = { ...storage, setItem: (k, v) => { if (full) throw new Error('QuotaExceededError'); storage.setItem(k, v); } };
    const save = new Save(flaky);
    let snapshots = 0;
    const snap = () => { snapshots++; return sample(); };
    save.markDirty();
    expect(save.tick(SAVE_INTERVAL, snap)).toBe(false);
    expect(snapshots).toBe(1);
    expect(save.has()).toBe(false);
    // Not every frame: the next try waits the interval out again.
    expect(save.tick(SAVE_INTERVAL - 1, snap)).toBe(false);
    expect(snapshots).toBe(1);
    full = false;
    expect(save.tick(1, snap)).toBe(true);
    expect(snapshots).toBe(2);
    expect(save.load()).toEqual(sample());
    // Written and clean again.
    expect(save.tick(SAVE_INTERVAL * 2, snap)).toBe(false);
  });
});

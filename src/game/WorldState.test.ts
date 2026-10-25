import { describe, expect, it } from 'vitest';
import { Events, type GameEvent } from './Events';
import { NEVER, RECENT_RING, WorldState, magnitude, recordOf } from './WorldState';

const AT = { x: 1, y: 2, z: 3 };
const kill = (enemy: string, boss = false): GameEvent => ({ kind: 'kill', enemy, boss, at: AT });

describe('WorldState', () => {
  it('starts empty on the island as the knight', () => {
    const s = new WorldState();
    expect(s.time).toBe(0);
    expect(s.zone).toBe('island');
    expect(s.hero).toBe('knight');
    expect(s.level).toBe(1);
    expect(s.shards).toBe(0);
    expect(s.recent).toEqual([]);
    expect(s.lastHurtAt).toBe(NEVER);
    expect(s.lastTalked).toBeNull();
  });

  it('records every event from the bus, stamped with the time, zone and hero', () => {
    const ev = new Events();
    const s = new WorldState(ev);
    s.tick(4.5);
    ev.emit(kill('beast'));
    expect(s.recent).toEqual([{ kind: 'kill', t: 4.5, zone: 'island', hero: 'knight', data: { enemy: 'beast', boss: false, x: 1, y: 2, z: 3 } }]);
    s.dispose();
    ev.emit(kill('beast'));
    expect(s.recent).toHaveLength(1);
  });

  it('counts kills and remembers when each boss fell', () => {
    const s = new WorldState();
    s.record(kill('beast'));
    s.record(kill('beast'));
    s.tick(30);
    s.record(kill('yeti', true));
    expect(s.kills).toEqual({ beast: 2, yeti: 1 });
    expect(s.bossesSlain).toEqual({ yeti: 30 });
  });

  it('tracks hurts, downs and wipes', () => {
    const s = new WorldState();
    s.tick(10);
    s.record({ kind: 'hurt', amount: 40, by: 'troll' });
    s.record({ kind: 'hurt', amount: 15, by: 'beast' });
    expect(s.damageTaken).toBe(55);
    expect(s.lastHurtAt).toBe(10);
    expect(s.lastHurtBy).toBe('beast');
    s.record({ kind: 'down', hero: 'archer' });
    expect(s.deaths).toBe(1);
    expect(s.recent.at(-1)?.data).toEqual({ hero: 'archer' });
    expect(s.flags.has('wiped')).toBe(false);
    s.record({ kind: 'wipe' });
    expect(s.wipes).toBe(1);
    expect(s.flags.has('wiped')).toBe(true);
  });

  it('follows zone changes into visited and stamps the record with the new zone', () => {
    const s = new WorldState();
    s.tick(5);
    s.record({ kind: 'zone', zone: 'galaxy', from: 'island' });
    expect(s.zone).toBe('galaxy');
    expect(s.visited).toEqual({ galaxy: { first: 5, last: 5, n: 1 } });
    expect(s.recent.at(-1)).toMatchObject({ zone: 'galaxy', data: { zone: 'galaxy', from: 'island' } });
    s.tick(20);
    s.record({ kind: 'zone', zone: 'island', from: 'galaxy' });
    s.tick(20);
    s.record({ kind: 'zone', zone: 'galaxy', from: 'island' });
    expect(s.visited.galaxy).toEqual({ first: 5, last: 45, n: 2 });
    expect(s.visited.island).toEqual({ first: 25, last: 25, n: 1 });
  });

  it('follows hero switches and stamps later records with the new hero', () => {
    const s = new WorldState();
    s.record({ kind: 'hero', hero: 'wizard' });
    expect(s.hero).toBe('wizard');
    expect(s.recent.at(-1)?.hero).toBe('wizard');
    s.record(kill('beast'));
    expect(s.recent.at(-1)?.hero).toBe('wizard');
  });

  it('remembers meetings per NPC', () => {
    const s = new WorldState();
    expect(s.memoryOf('king')).toEqual({ met: 0, lastMet: NEVER, said: {}, mood: 0 });
    s.tick(12);
    s.record({ kind: 'talk', npc: 'king' });
    s.tick(3);
    s.record({ kind: 'talk', npc: 'king' });
    s.record({ kind: 'talk', npc: 'frogking' });
    expect(s.npc.king).toMatchObject({ met: 2, lastMet: 15 });
    expect(s.npc.frogking.met).toBe(1);
    expect(s.lastTalked).toBe('frogking');
  });

  it('sets the trade flags, and equipped-mythic for a rarity-4 item', () => {
    const s = new WorldState();
    s.record({ kind: 'trade', what: 'buy', item: 'moon-dew' });
    s.record({ kind: 'trade', what: 'sell', item: 'beast-fang' });
    s.record({ kind: 'trade', what: 'hire', item: 'gob-a' });
    s.record({ kind: 'trade', what: 'dismiss', item: 'gob-a' });
    s.record({ kind: 'trade', what: 'equip', item: 'moon-dew' });
    expect(s.flags.has('bought')).toBe(true);
    expect(s.flags.has('sold')).toBe(true);
    expect(s.flags.has('hired')).toBe(true);
    expect(s.flags.has('equipped-mythic')).toBe(false);
    s.record({ kind: 'trade', what: 'equip', item: 'warden-antler' });
    expect(s.flags.has('equipped-mythic')).toBe(true);
  });

  it('knows a generated item is mythic from the loot event that brought it', () => {
    const s = new WorldState();
    s.record({ kind: 'loot', item: 'blade#7', rarity: 4 });
    expect(s.flags.size).toBe(0);
    s.record({ kind: 'trade', what: 'equip', item: 'blade#7' });
    expect(s.flags.has('equipped-mythic')).toBe(true);
    s.record({ kind: 'trade', what: 'equip', item: 'never-looted' });
    expect(s.recent.at(-1)?.data).toEqual({ what: 'equip', item: 'never-looted' });
  });

  it('keeps quest steps as records only', () => {
    const s = new WorldState();
    s.record({ kind: 'quest', id: 'throne', stage: 'active' });
    expect(s.recent.at(-1)?.data).toEqual({ id: 'throne', stage: 'active' });
    expect(s.flags.size).toBe(0);
  });

  it('maps feats to flags and counters', () => {
    const s = new WorldState();
    const feats = [
      ['lick', 'licked'], ['ale', 'ale'], ['fountain', 'fountain'], ['skyeye', 'skyeyes'], ['carriage', 'carriage'],
      ['bounce', 'bounce'], ['fly', 'flew'], ['swim', 'swam'], ['climb', 'climbed'], ['crit', 'crit'], ['chest', 'chest'],
      ['levelup', 'levelup'], ['sip', 'sip'],
    ] as const;
    for (const [what, flag] of feats) {
      expect(s.flags.has(flag)).toBe(false);
      s.record({ kind: 'feat', what });
      expect(s.flags.has(flag)).toBe(true);
    }
    s.record({ kind: 'feat', what: 'dodge' });
    s.record({ kind: 'feat', what: 'dodge' });
    s.record({ kind: 'feat', what: 'crit', at: AT });
    s.record({ kind: 'feat', what: 'attack' });
    expect(s.dodges).toBe(2);
    expect(s.crits).toBe(2);
    expect(s.flags.size).toBe(feats.length);
    expect(s.recent.at(-2)?.data).toEqual({ what: 'crit', x: 1, y: 2, z: 3 });
  });

  it('keeps only the last 24 events, newest last', () => {
    const s = new WorldState();
    for (let i = 0; i < 40; i++) { s.tick(1); s.record(kill(`e${i}`)); }
    expect(s.recent).toHaveLength(RECENT_RING);
    expect(s.recent[0].data.enemy).toBe('e16');
    expect(s.recent.at(-1)?.data.enemy).toBe('e39');
    expect(s.recent.at(-1)?.t).toBe(40);
  });

  it('weighs events and decays their salience with age', () => {
    const r = (e: GameEvent) => recordOf(e, 0, 'island', 'knight');
    expect(magnitude(r(kill('yeti', true)))).toBe(5);
    expect(magnitude(r(kill('beast')))).toBe(2);
    expect(magnitude(r({ kind: 'hurt', amount: 1, by: 'beast' }))).toBe(1.5);
    expect(magnitude(r({ kind: 'down', hero: 'knight' }))).toBe(3);
    expect(magnitude(r({ kind: 'wipe' }))).toBe(4);
    expect(magnitude(r({ kind: 'feat', what: 'lick' }))).toBe(1.5);
    expect(magnitude(r({ kind: 'loot', item: 'yeti-pelt', rarity: 3 }))).toBe(2);
    expect(magnitude(r({ kind: 'loot', item: 'moon-dew', rarity: 1 }))).toBe(0.5);
    expect(magnitude(r({ kind: 'trade', what: 'buy', item: 'moon-dew' }))).toBe(0.5);
    expect(magnitude(r({ kind: 'zone', zone: 'vale', from: 'island' }))).toBe(0.5);
    expect(magnitude(r({ kind: 'quest', id: 'throne', stage: 'done' }))).toBe(2);

    const s = new WorldState();
    s.tick(100);
    s.record(kill('yeti', true));
    const e = s.recent[0];
    expect(s.salience(e)).toBeCloseTo(5);
    expect(s.salience(e, 160)).toBeCloseTo(5 / Math.E);
    expect(s.salience(e, 220)).toBeCloseTo(5 / (Math.E * Math.E));
    s.tick(60);
    expect(s.salience(e)).toBeCloseTo(5 / Math.E);
    expect(s.salience(e, 50)).toBeCloseTo(5);
  });

  it('round-trips through a JSON snapshot', () => {
    const s = new WorldState();
    s.tick(77);
    s.record(kill('beast'));
    s.record(kill('warden', true));
    s.record({ kind: 'hurt', amount: 9, by: 'beast' });
    s.record({ kind: 'zone', zone: 'vale', from: 'island' });
    s.record({ kind: 'hero', hero: 'archer' });
    s.record({ kind: 'talk', npc: 'king' });
    s.record({ kind: 'feat', what: 'lick' });
    s.record({ kind: 'feat', what: 'dodge' });
    s.setItems(['signed-cup', 'moon-dew']);
    s.setShards(321);
    s.setLevel(6);
    s.setCompanions(2);
    s.memoryOf('king').said['king.greet'] = { n: 2, at: 70 };
    s.memoryOf('king').mood = 0.5;

    const json = JSON.stringify(s.snapshot());
    const t = new WorldState();
    t.restore(JSON.parse(json));
    expect(t.snapshot()).toEqual(s.snapshot());
    expect(t.time).toBe(77);
    expect(t.zone).toBe('vale');
    expect(t.hero).toBe('archer');
    expect(t.items).toEqual(new Set(['signed-cup', 'moon-dew']));
    expect(t.flags).toEqual(new Set(['licked']));
    expect(t.kills).toEqual({ beast: 1, warden: 1 });
    expect(t.bossesSlain).toEqual({ warden: 77 });
    expect(t.npc.king).toEqual({ met: 1, lastMet: 77, said: { 'king.greet': { n: 2, at: 70 } }, mood: 0.5 });
    expect(t.recent).toHaveLength(8);
    expect(t.recent).not.toBe(s.recent);
    // The restored state is independent of the source.
    t.record(kill('beast'));
    expect(s.kills.beast).toBe(1);
  });

  it('restores an older or partial snapshot with defaults', () => {
    const s = new WorldState();
    s.record(kill('beast'));
    s.restore({ time: 5, shards: 10 });
    expect(s.time).toBe(5);
    expect(s.shards).toBe(10);
    expect(s.kills).toEqual({});
    expect(s.recent).toEqual([]);
    expect(s.flags.size).toBe(0);
    expect(s.lastHurtAt).toBe(NEVER);
  });

  it('takes the purse, level, party and bag from the integration', () => {
    const s = new WorldState();
    s.setShards(50);
    s.setLevel(3);
    s.setCompanions(1);
    s.setItems(new Set(['lost-sound']));
    expect(s.shards).toBe(50);
    expect(s.level).toBe(3);
    expect(s.companions).toBe(1);
    expect(s.items.has('lost-sound')).toBe(true);
    s.setItems([]);
    expect(s.items.size).toBe(0);
  });
});

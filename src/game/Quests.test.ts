import { afterEach, describe, expect, it, vi } from 'vitest';
import { QUEST_GRAPH, QUEST_ORDER } from '../data/quests';
import { Events, type GameEvent } from './Events';
import { Quests, type QuestWallet } from './Quests';

const AT = { x: 0, y: 0, z: 0 };
const kill = (enemy: string, boss = false): GameEvent => ({ kind: 'kill', enemy, boss, at: AT });
const loot = (item: string): GameEvent => ({ kind: 'loot', item, rarity: 4 });

/** A purse and a bag that count what went through them. */
function purse(shards = 0, bag: string[] = []) {
  const p = { shards, bag: [...bag], paid: 0, given: [] as string[], taken: [] as string[] };
  const wallet: QuestWallet = {
    shards: () => p.shards,
    spend: (n) => { if (p.shards < n) return false; p.shards -= n; return true; },
    take: (item) => { const i = p.bag.indexOf(item); if (i < 0) return false; p.bag.splice(i, 1); p.taken.push(item); return true; },
    give: (item) => { p.bag.push(item); p.given.push(item); },
    pay: (n) => { p.shards += n; p.paid += n; },
  };
  return { p, wallet };
}

/** Quests announcing on a bus; every step announced, as 'id:stage'. */
function onBus() {
  const q = new Quests();
  const events = new Events();
  const steps: string[] = [];
  events.on('quest', (e) => steps.push(`${e.id}:${e.stage}`));
  q.events = events;
  return { q, events, steps };
}

const objective = (id: keyof typeof QUEST_GRAPH, stage: string): string => QUEST_GRAPH[id].stages[stage].objective;
const NONE: Record<string, string> = Object.fromEntries(QUEST_ORDER.map((id) => [id, 'none']));

afterEach(() => { vi.restoreAllMocks(); });

describe('Quests', () => {
  it('starts every quest at none and tracks the ones in progress, the main story first, with the graph\'s objectives', () => {
    const q = new Quests();
    const { wallet } = purse();
    expect(q.stage('throne')).toBe('none');
    expect(q.stage('no-such-quest')).toBe('none');
    expect(q.tracker()).toEqual([]);
    expect(q.step('rose', 'asked', wallet)).toBe(true);
    expect(q.step('throne', 'active', wallet)).toBe(true);
    expect(q.tracker()).toEqual([
      { title: 'The Usurped Throne', objective: objective('throne', 'active') },
      { title: "Sir Corvin's Rose", objective: objective('rose', 'asked') },
    ]);
    expect(q.active('throne')).toBe(true);
    q.kill('warden');
    expect(q.step('throne', 'done', wallet)).toBe(true);
    expect(q.tracker().map((t) => t.title)).toEqual(["Sir Corvin's Rose"]);
    expect(q.active('throne')).toBe(false);
    expect(q.journal().map((j) => [j.id, j.done])).toEqual([['throne', true], ['rose', false]]);
  });

  it('moves the throne quest on when the Warden dies, and only then', () => {
    const q = new Quests();
    let changes = 0;
    q.onChange = () => changes++;
    q.step('throne', 'active', null);
    q.kill('yeti');
    expect(q.stage('throne')).toBe('active');
    q.kill('warden');
    expect(q.stage('throne')).toBe('slain');
    expect(changes).toBe(2);
    // A Warden slain before the King asked counts the moment the quest is given (the kill log).
    const r = new Quests();
    r.kill('warden');
    expect(r.stage('throne')).toBe('none');
    expect(r.step('throne', 'active', null)).toBe(true);
    expect(r.stage('throne')).toBe('slain');
  });

  it('announces each step on the bus once, and never a stage it is already at', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { q, steps } = onBus();
    const { wallet } = purse();
    q.step('throne', 'active', wallet);
    q.step('throne', 'active', wallet);
    q.kill('warden');
    q.kill('warden');
    q.step('throne', 'done', wallet);
    q.step('throne', 'done', wallet);
    expect(steps).toEqual(['throne:active', 'throne:slain', 'throne:done']);
    // The old setters: a quest given after its kill, the start and the step it skips to, both announced.
    q.kill('warden');
    q.start('throne', 'active');
    expect(steps.slice(3)).toEqual(['throne:active', 'throne:slain']);
    expect(warn).toHaveBeenCalledTimes(1); // done → active is no step of the graph: said, and taken anyway
  });

  it('pays the throne once: 1500 shards and the Antlered Signet, however often the reward is taken', () => {
    const { q, steps } = onBus();
    const { p, wallet } = purse(40);
    expect(q.step('throne', 'done', wallet)).toBe(false); // not before the Warden is dead
    q.step('throne', 'active', wallet);
    q.onEvent(kill('warden', true), 1, wallet);
    expect(q.stage('throne')).toBe('slain');
    expect(p).toMatchObject({ shards: 40, paid: 0, given: [] });
    expect(q.step('throne', 'done', wallet)).toBe(true);
    expect(p).toMatchObject({ shards: 1540, paid: 1500, given: ['antler-signet'] });
    // 'Take the reward' clicked again, or taken again from the line left open: holds, pays nothing, says nothing.
    expect(q.step('throne', 'done', wallet)).toBe(true);
    q.onEvent(kill('warden', true), 1, wallet);
    expect(p).toMatchObject({ shards: 1540, paid: 1500, given: ['antler-signet'], bag: ['antler-signet'] });
    expect(steps).toEqual(['throne:active', 'throne:slain', 'throne:done']);
  });

  it("charges first: Old Penny's secrets fail softly when the purse is short, and nothing changes", () => {
    const { q, steps } = onBus();
    const { p, wallet } = purse(10);
    expect(q.step('penny', 'secret', wallet)).toBe(false);
    expect(q.stage('penny')).toBe('none');
    expect(p).toMatchObject({ shards: 10, given: [] });
    expect(steps).toEqual([]);
    p.shards = 25;
    expect(q.step('penny', 'secret', wallet)).toBe(true);
    expect(p.shards).toBe(5);
    expect(q.step('penny', 'done', wallet)).toBe(false); // forty for the second
    expect(q.stage('penny')).toBe('secret');
    expect(p).toMatchObject({ shards: 5, given: [] });
    p.shards = 45;
    expect(q.step('penny', 'done', wallet)).toBe(true);
    expect(p).toMatchObject({ shards: 5, given: ['lunar-charm'] });
    expect(q.step('penny', 'done', wallet)).toBe(true); // a finished quest entered again: charged nothing
    expect(p).toMatchObject({ shards: 5, given: ['lunar-charm'] });
    expect(steps).toEqual(['penny:secret', 'penny:done']);
    // With no purse at all a charge cannot be made: refused.
    expect(new Quests().step('penny', 'secret', null)).toBe(false);
  });

  it("takes what a stage takes and gives what it gives: the Reader's ledger, Glintgrin's cup", () => {
    const q = new Quests();
    const { p, wallet } = purse(100);
    q.step('books', 'active', wallet);
    expect(p).toMatchObject({ shards: 40, bag: ['old-ledger'] });
    q.step('books', 'done', wallet);
    expect(p).toMatchObject({ shards: 40, bag: [], taken: ['old-ledger'] });
    // The cup signed before the gnome asked: 'Deal.' then 'Hand over the cup' (active → done, a step the graph allows).
    p.bag.push('signed-cup');
    q.step('lean', 'active', wallet);
    expect(q.step('lean', 'done', wallet)).toBe(true);
    expect(p).toMatchObject({ shards: 1040, bag: [], taken: ['old-ledger', 'signed-cup'] });
  });

  it("settles the chains a step sets off: the fifth voice moves 'silence' on to 'five'", () => {
    const { q, steps } = onBus();
    const { p, wallet } = purse();
    q.step('silence', 'told', wallet);
    // The Antlered Signet.
    q.step('throne', 'active', wallet);
    q.onEvent(kill('warden', true), 1, wallet);
    q.step('throne', 'done', wallet);
    // The Third Eye: the Frog God slain on the first trip, before waking.
    q.onEvent(kill('dmt-entity', true), 2, wallet);
    // The Lost Sound and the Drowned Bell, picked up.
    q.step('sound', 'active', wallet);
    q.onEvent(loot('lost-sound'), 2, wallet);
    q.step('bell', 'active', wallet);
    q.onEvent(loot('drowned-bell'), 2, wallet);
    expect(q.voices()).toEqual(['antler-signet', 'third-eye', 'lost-sound', 'drowned-bell']);
    expect(q.stage('silence')).toBe('told');
    // The Grave Crown: the cyclops's death is the fifth voice; the Stone Head hears them all at once.
    q.step('grave', 'active', wallet);
    q.onEvent(kill('cyclops-lord', true), 3, wallet);
    expect(q.stage('grave')).toBe('slain');
    expect(q.stage('silence')).toBe('five');
    expect(steps.slice(-2)).toEqual(['grave:slain', 'silence:five']);
    expect(p.given).toEqual(['antler-signet', 'third-eye', 'mist-blade', 'grave-crown']);
    expect(q.tracker()[0]).toEqual({ title: 'The Silent Kingdom', objective: objective('silence', 'five') });
    // The head wakes him, and his death ends it.
    q.step('silence', 'open', wallet);
    q.onEvent(kill('hollowking', true), 4, wallet);
    expect(q.stage('silence')).toBe('ended');
  });

  it('fires a kill trigger only from the stage it names, and pays what it pays once', () => {
    const q = new Quests();
    const { p, wallet } = purse();
    // The Hollow King asleep (silence not 'open'): his death ends nothing, then or later.
    q.onEvent(kill('hollowking', true), 1, wallet);
    q.step('silence', 'told', wallet);
    expect(q.stage('silence')).toBe('told');
    // The Frog God: the eye on the first kill, nothing on the next (he respawns).
    q.onEvent(kill('dmt-entity', true), 2, wallet);
    q.onEvent(kill('dmt-entity', true), 2, wallet);
    expect(q.stage('trip')).toBe('god');
    expect(p.given).toEqual(['third-eye']);
    // Waking after the god is slain does not take it back.
    expect(q.step('trip', 'done', wallet)).toBe(false);
    expect(q.stage('trip')).toBe('god');
    // The Grave Cyclops slain before the Skeleton King asked: counted when he asks, the crown handed over once.
    q.onEvent(kill('cyclops-lord', true), 3, wallet);
    expect(q.stage('grave')).toBe('none');
    q.step('grave', 'active', wallet);
    expect(q.stage('grave')).toBe('slain');
    q.onEvent(kill('cyclops-lord', true), 3, wallet);
    expect(p.given).toEqual(['third-eye', 'grave-crown']);
    // A finished quest is moved by nothing.
    q.step('grave', 'done', wallet);
    q.onEvent(kill('cyclops-lord', true), 3, wallet);
    expect(q.stage('grave')).toBe('done');
    expect(p.paid).toBe(900);
  });

  it('moves croak on with the lick, unpaid: the dream is the thanks', () => {
    const q = new Quests();
    const { p, wallet } = purse();
    for (const s of ['active', 'bagged', 'returned']) q.step('croak', s, wallet);
    q.onEvent({ kind: 'feat', what: 'lick' }, 0, wallet);
    expect(q.stage('croak')).toBe('done');
    expect(p.paid).toBe(0);
    // The shards choice afterwards: the quest is finished, nothing more to pay.
    expect(q.step('croak', 'done', wallet)).toBe(true);
    expect(p.paid).toBe(0);
  });

  it("pays a kill's reward through its own wallet (Adventures sets it), and counts the bosses it is told of", () => {
    const q = new Quests();
    const { p, wallet } = purse();
    q.wallet = wallet;
    q.kill('rift-king');
    expect(q.stage('crown')).toBe('done');
    expect(p.paid).toBe(600);
    q.kill('rift-king');
    expect(p.paid).toBe(600);
    // Elowen counts three different great ones: once three have fallen, Corvin's ask is answered on the spot.
    let bosses = 3;
    q.bossCount = () => bosses;
    q.step('rose', 'asked', wallet);
    expect(q.stage('rose')).toBe('worthy');
    const r = new Quests();
    bosses = 2;
    r.bossCount = () => bosses;
    r.step('rose', 'asked', wallet);
    expect(r.stage('rose')).toBe('asked');
    r.onEvent(kill('yeti', true), 3, wallet);
    expect(r.stage('rose')).toBe('worthy');
  });

  it('hears kills, pickups, feats and quest steps, and nothing else', () => {
    const { q, steps } = onBus();
    q.step('throne', 'active', null);
    q.restoreSlain(['warden']);
    for (const e of [{ kind: 'hurt', amount: 5, by: 'beast' }, { kind: 'talk', npc: 'king' }, { kind: 'zone', zone: 'vale', from: 'island' }] as GameEvent[]) q.onEvent(e, 0);
    expect(q.stage('throne')).toBe('active');
    // Any pickup is heard, and a Warden in the kill log counts on any event that is.
    q.onEvent(loot('moon-dew'), 0);
    expect(q.stage('throne')).toBe('slain');
    expect(steps).toEqual(['throne:active', 'throne:slain']);
  });

  it('keeps set() for the old callers: a jump the graph refuses is said and taken, a stage it lacks is refused', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { q, steps } = onBus();
    q.set('throne', 'active');
    expect(warn).not.toHaveBeenCalled();
    q.set('throne', 'done');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(q.stage('throne')).toBe('done');
    q.set('throne', 'bogus');
    q.set('nope', 'active');
    q.set('constructor', 'active');
    expect(warn).toHaveBeenCalledTimes(4);
    expect(q.stage('throne')).toBe('done');
    expect(steps).toEqual(['throne:active', 'throne:done']);
  });
});

describe('Quests — the save', () => {
  it('snapshots every quest of the graph, in its order', () => {
    const q = new Quests();
    expect(Object.keys(q.snapshot())).toEqual([...QUEST_ORDER]);
    q.step('throne', 'active', null);
    q.step('trip', 'done', null);
    expect(q.snapshot()).toEqual({ ...NONE, throne: 'active', trip: 'done' });
  });

  it('restores stages without firing any step, with one onChange at the end', () => {
    const q = new Quests();
    let changes = 0;
    q.onChange = () => changes++;
    q.step('sound', 'active', purse().wallet);
    changes = 0;
    q.restore({ throne: 'active', croak: 'returned', trip: 'done', bogus: 'whatever', constructor: 'nope' });
    expect(changes).toBe(1);
    expect(q.stage('throne')).toBe('active');
    expect(q.stage('croak')).toBe('returned');
    expect(q.stage('trip')).toBe('done');
    // Replaced, not merged: what the snapshot does not name is back at none.
    expect(q.stage('sound')).toBe('none');
    expect(q.tracker().map((t) => t.title)).toEqual(['The Usurped Throne', 'The Prodigal Croak', "The Frog King's Dream"]);
    // A kill logged before the restore does not move a restored quest (the save already settled that).
    const r = new Quests();
    r.kill('warden');
    r.restore({ throne: 'active' });
    expect(r.stage('throne')).toBe('active');
    expect(r.snapshot()).toEqual({ ...NONE, throne: 'active' });
    // A stage the quest does not have (no step would ever move it on) is ignored, so the quest is not stuck.
    const s = new Quests();
    s.restore({ throne: 'bogus', trip: 'active', croak: 'constructor', lean: 'none', sound: 'done', crown: 'done' });
    expect(s.snapshot()).toEqual({ ...NONE, sound: 'done', crown: 'done' });
    expect(s.active('throne')).toBe(false);
    expect(s.tracker()).toEqual([]);
  });

  it('keeps the kill log across a save: a quest accepted later still counts the kill', () => {
    const a = new Quests();
    a.kill('warden');
    a.kill('yeti');
    expect(a.slain().sort()).toEqual(['warden', 'yeti']);
    const b = new Quests();
    b.restoreSlain(a.slain());
    expect(b.stage('throne')).toBe('none');
    b.start('throne', 'active');
    expect(b.stage('throne')).toBe('slain');
    b.restoreSlain([]);
    expect(b.slain()).toEqual([]);
  });
});

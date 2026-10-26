import { describe, expect, it } from 'vitest';
import type { Cond, DialogueBook, LineDef } from '../data/dialogue/types';
import type { GameEvent } from './Events';
import { WorldState, recordOf } from './WorldState';
import { formatAction, parseAction, type Action } from './actions';
import {
  BARK_WINDOW, CONTINUE_LABEL, LEAVE_LABEL, Mind, REPEAT_WINDOW, eligible, expand, firstWords, knowledge, score, type MindCtx,
} from './Mind';

const AT = { x: 0, y: 0, z: 0 };
const kill = (enemy: string, boss = false): GameEvent => ({ kind: 'kill', enemy, boss, at: AT });

/** Two NPCs: a smith on the island who hears kingdom news after 30 s, and a bartender in the kingdom who hears nothing from elsewhere. */
const BOOK: DialogueBook = {
  brannoc: {
    persona: { id: 'brannoc', district: 'island', knows: ['galaxy'], rumourDelay: 30, tone: 'dry', about: 'The smith.' },
    lines: [
      { id: 'b.greet.first', slot: 'greet', text: 'What are you doing here?', when: { metMax: 0 } },
      { id: 'b.greet.again', slot: 'greet', text: 'You again, {hero}.', when: { metMin: 1 } },
      { id: 'b.greet.alt', slot: 'greet', text: 'Back so soon.', when: { metMin: 1 }, weight: 0.4 },
      { id: 'b.react.beast', slot: 'react', text: 'You killed {lastKill}. It owed me money.', when: { event: 'kill', enemy: 'beast' } },
      { id: 'b.react.boss', slot: 'react', text: '{lastBoss} is dead. I heard it fall.', when: { event: 'kill', boss: true } },
      { id: 'b.react.hurt', slot: 'react', text: 'You bleed on my floor.', when: { event: 'hurt' } },
      { id: 'b.react.fly', slot: 'react', text: 'You flew past my chimney.', when: { event: 'feat', feat: 'fly' } },
      { id: 'b.topic.warden', slot: 'topic', ask: 'About the Warden', text: 'The Warden. It sulks in the east forest.', when: { quest: ['throne', 'none'] }, weight: 3, choices: [
        { label: 'I will do it.', action: 'quest:throne:active', to: 'b.topic.go' },
        { label: 'What would I get?', to: 'b.topic.offer' },
        { label: 'Not now.', action: 'close' },
      ] },
      { id: 'b.topic.offer', slot: 'topic', ask: 'What would I get?', text: 'Shards. A great many of them, {hero}.', when: { quest: ['throne', 'none'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'b.topic.go', slot: 'topic', ask: 'About the Warden still', text: 'Then go. It is under the rain.', when: { quest: ['throne', 'active'] }, choices: [{ label: 'Leave', action: 'close' }] },
      { id: 'b.topic.self', slot: 'topic', ask: 'Who were you before?', text: 'I was a king once. Then I was a smith. The smith pays better.' },
      { id: 'b.topic.secret', slot: 'topic', ask: 'Any secrets?', text: 'A secret: the river is not a river.', once: true },
      { id: 'b.topic.rich', slot: 'topic', ask: 'About my fortune', text: 'You carry {shards} shards at level {level}. We have met {met} times.', when: { minShards: 100 } },
      { id: 'b.bye.go', slot: 'bye', text: 'Go. Mind the step.' },
      { id: 'b.bye.rain', slot: 'bye', text: 'Rain is coming. Go before it does.' },
      { id: 'b.bark.kill', slot: 'bark', text: 'Nice.', when: { event: 'kill' }, weight: 2 },
      { id: 'b.bark.any', slot: 'bark', text: 'Oi.' },
      { id: 'b.bark.snow', slot: 'bark', text: 'The snow is singing.', when: { quest: ['sound', 'done'] }, weight: 2 },
    ],
  },
  bartender: {
    persona: { id: 'bartender', district: 'galaxy', knows: [], rumourDelay: 60, tone: 'warm', about: 'Pours.' },
    lines: [
      { id: 't.greet', slot: 'greet', text: 'Drink?' },
      { id: 't.react.beast', slot: 'react', text: 'A beast died somewhere, I hear.', when: { event: 'kill', enemy: 'beast' } },
      { id: 't.react.boss', slot: 'react', text: 'They say {lastBoss} fell.', when: { event: 'kill', boss: true } },
      { id: 't.topic.ale', slot: 'topic', ask: 'About the ale', text: 'The ale is from the island.' },
    ],
  },
};

/** A small seeded generator so two minds can be compared. */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 2 ** 32; };
}

function mk(over: Partial<MindCtx> = {}, stages: Record<string, string> = {}) {
  const state = new WorldState();
  const ctx: MindCtx = { state, quests: { stage: (id) => stages[id] ?? 'none' }, book: BOOK, rnd: () => 0, ...over };
  return { state, ctx, mind: new Mind(ctx) };
}

const ids = (nodes: Array<{ line: LineDef }>) => nodes.map((n) => n.line.id);

describe('knowledge', () => {
  const smith = BOOK.brannoc.persona;
  const rec = (zone: 'island' | 'galaxy' | 'vale', boss = false) => recordOf(kill('beast', boss), 0, zone, 'knight');

  it('is immediate in the own district, delayed for known districts, nothing elsewhere', () => {
    expect(knowledge(smith, rec('island'), 0)).toBe(1);
    expect(knowledge(smith, rec('island'), 1000)).toBe(1);
    expect(knowledge(smith, rec('galaxy'), 29)).toBe(0);
    expect(knowledge(smith, rec('galaxy'), 30)).toBe(0.6);
    expect(knowledge(smith, rec('vale'), 1000)).toBe(0);
  });

  it('spreads a boss kill everywhere after a minute', () => {
    expect(knowledge(smith, rec('vale', true), 59)).toBe(0);
    expect(knowledge(smith, rec('vale', true), 60)).toBe(1);
    expect(knowledge(smith, rec('galaxy', true), 30)).toBe(0.6);
    expect(knowledge(smith, rec('galaxy', true), 60)).toBe(1);
  });
});

describe('eligible', () => {
  const line = (when: Cond): LineDef => ({ id: 'x', slot: 'topic', text: 'x', when });

  function setup() {
    const t = mk({ now: 100 }, { throne: 'active' });
    const s = t.state;
    s.flags.add('licked');
    s.memoryOf('brannoc').met = 2;
    s.setShards(30);
    s.setItems(['signed-cup']);
    s.setLevel(4);
    s.setCompanions(1);
    s.time = 95;
    s.record({ kind: 'hurt', amount: 1, by: 'beast' });
    s.record(kill('beast'));
    s.record(kill('beast'));
    s.record(kill('beast'));
    s.record(kill('yeti', true));
    s.time = 100;
    return t;
  }

  it('holds for every condition that matches the state', () => {
    const { ctx } = setup();
    const good: Cond[] = [
      {}, { hero: 'knight' }, { quest: ['throne', 'active'] }, { quest: ['throne', ['none', 'active']] }, { flag: 'licked' }, { notFlag: 'ale' },
      { metMin: 2 }, { metMax: 2 }, { minShards: 30 }, { maxShards: 30 }, { item: 'signed-cup' }, { notItem: 'lost-sound' }, { zoneIs: 'island' },
      { bossSlain: 'yeti' }, { bossAlive: 'warden' }, { kills: ['beast', 3] }, { hurtWithin: 5 }, { level: 4 }, { companions: 1 },
      { event: 'kill' }, { event: 'kill', enemy: 'beast' }, { enemy: 'beast' }, { event: 'kill', boss: true }, { boss: false }, { event: 'hurt', enemy: 'beast' },
      { event: 'kill', enemy: 'yeti', boss: true, hero: 'knight', metMin: 1 },
    ];
    for (const when of good) expect(eligible(line(when), 'brannoc', ctx), JSON.stringify(when)).toBe(true);
    expect(eligible({ id: 'y', slot: 'greet', text: 'y' }, 'brannoc', ctx)).toBe(true);
  });

  it('fails for every condition the state contradicts', () => {
    const { ctx } = setup();
    const bad: Cond[] = [
      { hero: 'archer' }, { quest: ['throne', 'none'] }, { quest: ['throne', ['none', 'done']] }, { quest: ['croak', 'active'] }, { flag: 'ale' },
      { notFlag: 'licked' }, { metMin: 3 }, { metMax: 1 }, { minShards: 31 }, { maxShards: 29 }, { item: 'lost-sound' }, { notItem: 'signed-cup' },
      { zoneIs: 'galaxy' }, { bossSlain: 'warden' }, { bossAlive: 'yeti' }, { kills: ['beast', 4] }, { kills: ['troll', 1] }, { hurtWithin: 4 },
      { level: 5 }, { companions: 2 }, { event: 'down' }, { event: 'kill', enemy: 'troll' }, { event: 'feat', feat: 'fly' }, { feat: 'lick' },
      { event: 'hurt', enemy: 'troll' }, { event: 'kill', enemy: 'beast', boss: true },
    ];
    for (const when of bad) expect(eligible(line(when), 'brannoc', ctx), JSON.stringify(when)).toBe(false);
  });

  it('only counts the events the NPC can know of', () => {
    const { state, ctx } = mk({ now: 10 });
    state.record({ kind: 'zone', zone: 'galaxy', from: 'island' });
    state.record(kill('beast'));
    expect(eligible(line({ event: 'kill' }), 'brannoc', ctx)).toBe(false);
    expect(eligible(line({ event: 'kill' }), 'bartender', ctx)).toBe(true);
    ctx.now = 30;
    expect(eligible(line({ event: 'kill' }), 'brannoc', ctx)).toBe(true);
  });

  it('is false for an NPC that is not in the book', () => {
    const { ctx } = mk();
    expect(eligible(line({}), 'nobody', ctx)).toBe(false);
  });
});

describe('greet', () => {
  it('picks by how often they have met', () => {
    const { state, mind } = mk();
    expect(mind.greet('brannoc')?.line.id).toBe('b.greet.first');
    state.memoryOf('brannoc').met = 2;
    const again = mind.greet('brannoc');
    expect(again?.line.id).toBe('b.greet.again');
    expect(again?.text).toBe('You again, Sir Aldric.');
    state.record({ kind: 'hero', hero: 'archer' });
    expect(mind.greet('brannoc')?.text).toBe('You again, Wren.');
  });

  it('scores a line that names the hero a point higher', () => {
    const { ctx } = mk();
    expect(score(BOOK.brannoc.lines[1], 'brannoc', ctx)).toBe(2);
    expect(score(BOOK.brannoc.lines[2], 'brannoc', ctx)).toBeCloseTo(0.4);
  });
});

describe('react', () => {
  it('reacts to a kill in its own district at once, with the enemy named', () => {
    const { state, ctx, mind } = mk({ now: 5 });
    expect(mind.react('brannoc')).toBeNull();
    state.record(kill('beast'));
    const r = mind.react('brannoc');
    expect(r?.line.id).toBe('b.react.beast');
    expect(r?.text).toBe('You killed Fog Beast. It owed me money.');
    expect(score(BOOK.brannoc.lines[3], 'brannoc', ctx)).toBeCloseTo(1 + 2 * Math.exp(-5 / 60));
  });

  it('hears of a kill in a known district only after the rumour delay', () => {
    const { state, ctx, mind } = mk({ now: 10 });
    state.record({ kind: 'zone', zone: 'galaxy', from: 'island' });
    state.record(kill('beast'));
    expect(mind.react('brannoc')).toBeNull();
    expect(mind.react('bartender')?.line.id).toBe('t.react.beast');
    ctx.now = 30;
    expect(mind.react('brannoc')?.line.id).toBe('b.react.beast');
    expect(score(BOOK.brannoc.lines[3], 'brannoc', ctx)).toBeCloseTo(1 + 0.6 * 2 * Math.exp(-30 / 60));
  });

  it('never hears of a mob kill in a district it does not know, but hears of a boss after a minute', () => {
    const { state, ctx, mind } = mk({ now: 1000 });
    state.record(kill('beast'));
    expect(mind.react('bartender')).toBeNull();
    state.time = 1000;
    state.record(kill('yeti', true));
    ctx.now = 1030;
    expect(mind.react('bartender')).toBeNull();
    ctx.now = 1060;
    const r = mind.react('bartender');
    expect(r?.line.id).toBe('t.react.boss');
    expect(r?.text).toBe('They say The Yeti fell.');
  });

  it('voices the most salient thing it knows', () => {
    const a = mk({ now: 10 });
    a.state.record(kill('yeti', true));
    a.state.time = 5;
    a.state.record(kill('beast'));
    expect(a.mind.react('brannoc')?.line.id).toBe('b.react.boss');
    expect(a.mind.react('brannoc')?.text).toBe('The Yeti is dead. I heard it fall.');

    const b = mk({ now: 60 });
    b.state.record(kill('yeti', true));
    b.state.time = 59;
    b.state.record(kill('beast'));
    expect(b.mind.react('brannoc')?.line.id).toBe('b.react.beast');
  });

  it('stays quiet once the event has faded below the threshold', () => {
    const { state, ctx, mind } = mk({ now: 600 });
    state.record(kill('beast'));
    expect(mind.react('brannoc')).toBeNull();
    ctx.rnd = () => 0.9;
    expect(mind.react('brannoc')?.line.id).toBe('b.react.beast');
  });

  it('voices a remark about the hero or the state with no event behind it only by weight and luck, then lets it fade', () => {
    // The books write reactions like `when: { hero: 'knight', metMin: 1 }`: no event, so no salience is added.
    const remark: LineDef = { id: 'b.react.knight', slot: 'react', text: 'A knight. The last one rusted.', when: { hero: 'knight', metMin: 1 } };
    const book: DialogueBook = { ...BOOK, brannoc: { ...BOOK.brannoc, lines: [...BOOK.brannoc.lines, remark] } };
    const { state, ctx, mind } = mk({ book, now: 0 });
    expect(mind.react('brannoc')).toBeNull();
    state.memoryOf('brannoc').met = 1;
    expect(score(remark, 'brannoc', ctx)).toBe(1);
    expect(mind.react('brannoc')).toBeNull();
    ctx.rnd = () => 0.9;
    expect(mind.react('brannoc')?.line.id).toBe('b.react.knight');
    mind.remember('brannoc', 'b.react.knight');
    expect(mind.react('brannoc')).toBeNull();
    ctx.now = 1000;
    expect(score(remark, 'brannoc', ctx)).toBeCloseTo(1 - 1.5 + 0.45);
    expect(mind.react('brannoc')).toBeNull();
    const heavy: LineDef = { ...remark, id: 'b.react.heavy', weight: 3 };
    const { mind: sure } = mk({ book: { ...BOOK, brannoc: { ...BOOK.brannoc, lines: [...BOOK.brannoc.lines, heavy] } } });
    sure.ctx.state.memoryOf('brannoc').met = 1;
    expect(sure.react('brannoc')?.line.id).toBe('b.react.heavy');
  });
});

describe('repeats', () => {
  it('avoids a line said within three minutes', () => {
    const { state, ctx, mind } = mk({ now: 0 });
    state.memoryOf('brannoc').met = 1;
    expect(mind.greet('brannoc')?.line.id).toBe('b.greet.again');
    mind.remember('brannoc', 'b.greet.again');
    expect(state.npc.brannoc.said['b.greet.again']).toEqual({ n: 1, at: 0 });
    ctx.now = 10;
    expect(mind.greet('brannoc')?.line.id).toBe('b.greet.alt');
    expect(score(BOOK.brannoc.lines[1], 'brannoc', ctx)).toBe(2 - 4 - 1.5);
    ctx.now = REPEAT_WINDOW;
    expect(mind.greet('brannoc')?.line.id).toBe('b.greet.again');
    expect(score(BOOK.brannoc.lines[1], 'brannoc', ctx)).toBe(2 - 1.5);
  });

  it('says a once line once ever', () => {
    const { mind } = mk();
    expect(ids(mind.topics('brannoc'))).toContain('b.topic.secret');
    const said = mind.choose('brannoc', { to: 'b.topic.secret' });
    expect(said?.text).toBe('A secret: the river is not a river.');
    expect(ids(mind.topics('brannoc'))).not.toContain('b.topic.secret');
    expect(mind.choose('brannoc', { to: 'b.topic.secret' })).toBeNull();
    expect(score(BOOK.brannoc.lines[11], 'brannoc', mind.ctx)).toBe(-Infinity);
  });
});

describe('expand', () => {
  it('fills every template', () => {
    const { state, ctx } = mk({ now: 0 });
    state.setShards(150);
    state.setLevel(4);
    state.memoryOf('brannoc').met = 3;
    expect(expand('{hero} / {heroTitle}', 'brannoc', ctx)).toBe('Sir Aldric / The Weary Sentinel');
    expect(expand('{lastKill} | {lastBoss}', 'brannoc', ctx)).toBe('that thing | that thing');
    expect(expand('{district}', 'brannoc', ctx)).toBe('The Island');
    expect(expand('{shards} {level} {met}', 'brannoc', ctx)).toBe('150 4 3');
    expect(expand('{kills:beast} {kills}', 'brannoc', ctx)).toBe('0 0');
    expect(expand('{foo} {}', 'brannoc', ctx)).toBe('{foo} {}');

    state.record(kill('beast'));
    state.record(kill('beast'));
    state.record(kill('yeti', true));
    state.record(kill('troll', true));
    state.record(kill('beast'));
    expect(expand('{lastKill} | {lastBoss}', 'brannoc', ctx)).toBe('Fog Beast | The Gorge Troll');
    expect(expand('{kills:beast} {kills:yeti} {kills}', 'brannoc', ctx)).toBe('3 1 5');

    state.record({ kind: 'zone', zone: 'galaxy', from: 'island' });
    state.record({ kind: 'hero', hero: 'wizard' });
    expect(expand('{district} {hero}', 'brannoc', ctx)).toBe("Yung Lean's Kingdom Orlan");
  });

  it('names only the kills the NPC knows of, and falls back to the last boss ever', () => {
    const { state, ctx } = mk({ now: 0 });
    state.record({ kind: 'zone', zone: 'galaxy', from: 'island' });
    state.record(kill('beast'));
    state.record(kill('yeti', true));
    expect(expand('{lastKill}', 'brannoc', ctx)).toBe('that thing');
    expect(expand('{lastBoss}', 'brannoc', ctx)).toBe('The Yeti');
    expect(expand('{lastKill}', 'bartender', ctx)).toBe('The Yeti');
    ctx.now = 30;
    expect(expand('{lastKill}', 'brannoc', ctx)).toBe('The Yeti');
    expect(expand('{lastBoss}', 'nobody', ctx)).toBe('The Yeti');
  });

  it('expands the lines it resolves', () => {
    const { state, mind } = mk();
    state.setShards(150);
    state.setLevel(4);
    state.memoryOf('brannoc').met = 3;
    const rich = mind.topics('brannoc').find((t) => t.line.id === 'b.topic.rich');
    expect(rich?.text).toBe('You carry 150 shards at level 4. We have met 3 times.');
  });
});

describe('topics', () => {
  it('offers a quest topic only in its stage, best first', () => {
    const none = mk({}, { throne: 'none' });
    expect(ids(none.mind.topics('brannoc'))).toEqual(['b.topic.warden', 'b.topic.offer', 'b.topic.self', 'b.topic.secret']);
    const active = mk({}, { throne: 'active' });
    expect(ids(active.mind.topics('brannoc'))).toEqual(['b.topic.go', 'b.topic.self', 'b.topic.secret']);
    const done = mk({}, { throne: 'done' });
    expect(ids(done.mind.topics('brannoc'))).toEqual(['b.topic.self', 'b.topic.secret']);
  });

  it('resolves a topic with its own choices parsed', () => {
    const { mind } = mk();
    const warden = mind.topics('brannoc')[0];
    expect(warden.choices).toEqual([
      { label: 'I will do it.', to: 'b.topic.go', action: { kind: 'quest', id: 'throne', stage: 'active' } },
      { label: 'What would I get?', to: 'b.topic.offer', action: null },
      { label: 'Not now.', action: { kind: 'close' } },
    ]);
  });
});

describe('bark', () => {
  it('matches the bark to the event and the state', () => {
    const { mind } = mk();
    expect(mind.bark('brannoc', kill('beast'))?.text).toBe('Nice.');
    const { mind: other } = mk();
    expect(other.bark('brannoc', { kind: 'hurt', amount: 5, by: 'beast' })?.text).toBe('Oi.');
    const { mind: snowy } = mk({}, { sound: 'done' });
    expect(snowy.bark('brannoc', { kind: 'hurt', amount: 5, by: 'beast' })?.text).toBe('The snow is singing.');
    expect(mk().mind.bark('bartender', kill('beast'))).toBeNull();
  });

  it('never repeats a bark within twenty seconds', () => {
    const { state, ctx, mind } = mk({ now: 0 });
    expect(mind.bark('brannoc', kill('beast'))?.line.id).toBe('b.bark.kill');
    expect(state.npc.brannoc.said['b.bark.kill']).toEqual({ n: 1, at: 0 });
    ctx.now = 5;
    expect(mind.bark('brannoc', kill('beast'))?.line.id).toBe('b.bark.any');
    ctx.now = 6;
    expect(mind.bark('brannoc', kill('beast'))).toBeNull();
    ctx.now = BARK_WINDOW + 1;
    expect(mind.bark('brannoc', kill('beast'))?.line.id).toBe('b.bark.kill');
  });
});

describe('open', () => {
  it('greets, offers the topics and the bye, and remembers what it said', () => {
    const { state, mind } = mk({ now: 0 });
    const conv = mind.open('brannoc');
    expect(conv.npcId).toBe('brannoc');
    expect(conv.first.line.id).toBe('b.greet.first');
    expect(conv.first.text).toBe('What are you doing here?');
    expect(state.npc.brannoc.said).toEqual({ 'b.greet.first': { n: 1, at: 0 } });
    expect(conv.first.choices.map((c) => [c.label, c.to ?? null, c.action])).toEqual([
      ['About the Warden', 'b.topic.warden', null],
      ['What would I get?', 'b.topic.offer', null],
      ['Who were you before?', 'b.topic.self', null],
      ['Any secrets?', 'b.topic.secret', null],
      [LEAVE_LABEL, 'b.bye.go', null],
    ]);
    expect(ids(conv.nodes)).toEqual(['b.greet.first', 'b.topic.warden', 'b.topic.offer', 'b.topic.self', 'b.topic.secret', 'b.bye.go']);
    expect(conv.nodes.at(-1)?.choices).toEqual([]);
  });

  it('leads through the reaction when one scored', () => {
    const { state, ctx, mind } = mk({ now: 5 });
    state.record(kill('beast'));
    const conv = mind.open('brannoc');
    expect(conv.first.line.id).toBe('b.greet.first');
    expect(conv.first.choices).toEqual([{ label: CONTINUE_LABEL, to: 'b.react.beast', action: null }]);
    expect(conv.nodes[1].line.id).toBe('b.react.beast');
    expect(conv.nodes[1].text).toBe('You killed Fog Beast. It owed me money.');
    expect(conv.nodes[1].choices.map((c) => c.to)).toEqual(['b.topic.warden', 'b.topic.offer', 'b.topic.self', 'b.topic.secret', 'b.bye.go']);
    expect(Object.keys(state.npc.brannoc.said).sort()).toEqual(['b.greet.first', 'b.react.beast']);
    const next = mind.choose('brannoc', conv.first.choices[0]);
    expect(next?.line.id).toBe('b.react.beast');
    expect(next?.choices.map((c) => c.to)).toEqual(['b.topic.warden', 'b.topic.offer', 'b.topic.self', 'b.topic.secret', 'b.bye.go']);
    // Remembered when the conversation opened; following the '…' does not count it a second time.
    expect(state.npc.brannoc.said['b.react.beast']).toEqual({ n: 1, at: 5 });
    // Said once, not once ever: a fresh kill long after brings it back.
    state.tick(395);
    state.record(kill('beast'));
    expect(new Mind({ ...ctx, now: 400 }).open('brannoc').first.choices.map((c) => c.to)).toEqual(['b.react.beast']);

    // A once reaction is reached the same way (not cut off by its own once check), counted once, and never again.
    const book: DialogueBook = {
      ...BOOK,
      brannoc: { ...BOOK.brannoc, lines: BOOK.brannoc.lines.map((l) => (l.id === 'b.react.beast' ? { ...l, once: true } : l)) },
    };
    const once = mk({ now: 5, book });
    once.state.record(kill('beast'));
    const conv2 = once.mind.open('brannoc');
    expect(conv2.first.choices).toEqual([{ label: CONTINUE_LABEL, to: 'b.react.beast', action: null }]);
    const reaction = once.mind.choose('brannoc', conv2.first.choices[0]);
    expect(reaction?.line.id).toBe('b.react.beast');
    expect(reaction?.text).toBe('You killed Fog Beast. It owed me money.');
    expect(reaction?.choices.map((c) => c.to)).toEqual(['b.topic.warden', 'b.topic.offer', 'b.topic.self', 'b.topic.secret', 'b.bye.go']);
    expect(once.state.npc.brannoc.said['b.react.beast']).toEqual({ n: 1, at: 5 });
    once.state.tick(395);
    once.state.record(kill('beast'));
    expect(new Mind({ ...once.ctx, now: 400 }).open('brannoc').first.choices.map((c) => c.to)).not.toContain('b.react.beast');
  });

  it('follows choices to the next node and ends on the bye', () => {
    const { state, mind } = mk({ now: 0 });
    const conv = mind.open('brannoc');
    const warden = mind.choose('brannoc', conv.first.choices[0]);
    expect(warden?.text).toBe('The Warden. It sulks in the east forest.');
    expect(warden?.choices[0]).toEqual({ label: 'I will do it.', to: 'b.topic.go', action: { kind: 'quest', id: 'throne', stage: 'active' } });
    expect(state.npc.brannoc.said['b.topic.warden']).toEqual({ n: 1, at: 0 });
    expect(mind.choose('brannoc', warden!.choices[2])).toBeNull();

    const self = mind.choose('brannoc', { to: 'b.topic.self' });
    expect(self?.choices.map((c) => c.to)).toEqual(['b.topic.offer', 'b.topic.secret', 'b.bye.go']);

    const bye = mind.choose('brannoc', conv.first.choices.at(-1)!);
    expect(bye?.line.id).toBe('b.bye.go');
    expect(bye?.text).toBe('Go. Mind the step.');
    expect(bye?.choices).toEqual([]);
    expect(state.npc.brannoc.said['b.bye.go']).toEqual({ n: 1, at: 0 });
    expect(mind.choose('brannoc', { to: 'b.nowhere' })).toBeNull();
    expect(mind.choose('brannoc', { label: 'Leave', action: 'close' })).toBeNull();
  });

  it('leads every Leave of one conversation to the same bye line', () => {
    const { mind } = mk();
    const conv = mind.open('brannoc');
    const leave = { label: LEAVE_LABEL, to: 'b.bye.go', action: null };
    expect(conv.nodes.at(-1)!.line.id).toBe('b.bye.go');
    expect(conv.first.choices.at(-1)).toEqual(leave);
    // The bye is settled when the conversation opens, even if its score drops meanwhile.
    mind.remember('brannoc', 'b.bye.go');
    expect(mind.choose('brannoc', { to: 'b.topic.self' })!.choices.at(-1)).toEqual(leave);
    expect(mind.choose('brannoc', { to: 'b.topic.secret' })!.choices.at(-1)).toEqual(leave);
    // The warden line carries its own choices: no hub, so its last choice is the author's.
    expect(mind.choose('brannoc', { to: 'b.topic.warden' })!.choices.at(-1)).toEqual({ label: 'Not now.', action: { kind: 'close' } });
    // The next conversation picks afresh, and the bye said a moment ago loses to the other.
    expect(mind.open('brannoc').nodes.at(-1)!.line.id).toBe('b.bye.rain');
  });

  it('adds the automatic choices that hold', () => {
    const { state, ctx, mind } = mk();
    ctx.autoChoices = [{ label: 'Trade', action: 'trade' }, { label: 'Hire', action: 'hire', when: { minShards: 50 } }];
    let labels = mind.open('brannoc').first.choices.map((c) => c.label);
    expect(labels).toContain('Trade');
    expect(labels).not.toContain('Hire');
    expect(mind.open('brannoc').first.choices.find((c) => c.label === 'Trade')?.action).toEqual({ kind: 'trade' });
    state.setShards(60);
    labels = mind.open('brannoc').first.choices.map((c) => c.label);
    expect(labels.slice(-3)).toEqual(['Trade', 'Hire', LEAVE_LABEL]);
    ctx.autoChoices = (npcId) => (npcId === 'bartender' ? [{ label: 'Ale', action: 'ale' }] : []);
    expect(mind.open('bartender').first.choices.map((c) => c.label)).toEqual(['About the ale', 'Ale', LEAVE_LABEL]);
    expect(mind.open('brannoc').first.choices.map((c) => c.label)).not.toContain('Ale');
  });

  it('counts the meeting once whether the talk event comes before or after', () => {
    const before = mk({ now: 0 });
    before.state.record({ kind: 'talk', npc: 'brannoc' });
    expect(before.mind.open('brannoc').first.line.id).toBe('b.greet.first');
    expect(before.mind.choose('brannoc', { to: 'b.topic.rich' })?.text).toContain('met 0 times');

    const after = mk();
    expect(after.mind.open('brannoc').first.line.id).toBe('b.greet.first');
    after.state.record({ kind: 'talk', npc: 'brannoc' });
    after.state.tick(1);
    expect(after.mind.open('brannoc').first.line.id).toBe('b.greet.again');
    expect(after.mind.choose('brannoc', { to: 'b.topic.rich' })?.text).toContain('met 1 times');
  });

  it('closes without a bye line and keeps a greet with its own choices', () => {
    const book: DialogueBook = {
      quiet: { persona: { id: 'quiet', district: 'vale', knows: [], rumourDelay: 0, tone: 'sleepy', about: 'Quiet.' }, lines: [
        { id: 'q.greet', slot: 'greet', text: 'Mm.', choices: [{ label: 'Bye', action: 'close' }] },
        { id: 'q.react', slot: 'react', text: 'You hit it.', when: { event: 'kill' }, weight: 5 },
        { id: 'q.topic', slot: 'topic', ask: 'About the sheep', text: 'Sheep.' },
      ] },
      mute: { persona: { id: 'mute', district: 'vale', knows: [], rumourDelay: 0, tone: 'sleepy', about: 'Mute.' }, lines: [
        { id: 'm.topic', slot: 'topic', ask: 'About the wool', text: 'Wool.' },
      ] },
    };
    const { state, mind } = mk({ book });
    state.record({ kind: 'zone', zone: 'vale', from: 'island' });
    state.record(kill('beast'));
    const conv = mind.open('quiet');
    expect(conv.first.choices).toEqual([{ label: 'Bye', action: { kind: 'close' } }]);
    expect(ids(conv.nodes)).toEqual(['q.greet', 'q.topic']);
    expect(state.npc.quiet.said['q.react']).toBeUndefined();
    const sheep = mind.choose('quiet', { to: 'q.topic' });
    expect(sheep?.choices).toEqual([{ label: LEAVE_LABEL, action: { kind: 'close' } }]);

    const silent = mind.open('mute');
    expect(silent.first.line.id).toBe('');
    expect(silent.first.text).toBe('…');
    expect(silent.first.choices.map((c) => c.label)).toEqual(['About the wool', LEAVE_LABEL]);
    expect(ids(silent.nodes)).toEqual(['', 'm.topic']);
  });

  it('never throws for an NPC that is not in the book', () => {
    const { mind } = mk();
    expect(mind.greet('nobody')).toBeNull();
    expect(mind.react('nobody')).toBeNull();
    expect(mind.topics('nobody')).toEqual([]);
    expect(mind.bye('nobody')).toBeNull();
    expect(mind.bark('nobody', kill('beast'))).toBeNull();
    const conv = mind.open('nobody');
    expect(conv.nodes).toEqual([]);
    expect(conv.first.choices).toEqual([{ label: LEAVE_LABEL, action: { kind: 'close' } }]);
    expect(mind.choose('nobody', { to: 'x' })).toBeNull();
    expect(() => mind.remember('nobody', 'x')).not.toThrow();
  });

  it('is deterministic for a fixed random source', () => {
    const run = (seed: number) => {
      const { state, ctx, mind } = mk({ rnd: lcg(seed), now: 20 });
      state.record(kill('beast'));
      state.record(kill('yeti', true));
      state.record({ kind: 'hurt', amount: 3, by: 'beast' });
      const conv = mind.open('brannoc');
      const out = [ids(conv.nodes).join(','), conv.first.choices.map((c) => c.label).join('|'), conv.nodes[1]?.text];
      out.push(mind.choose('brannoc', { to: 'b.topic.self' })?.choices.map((c) => c.label).join('|') ?? '');
      out.push(mind.bark('brannoc', kill('beast'))?.line.id ?? '');
      ctx.now = 40;
      out.push(mind.open('brannoc').first.line.id);
      return out;
    };
    expect(run(7)).toEqual(run(7));
    expect(run(99)).toEqual(run(99));
  });
});

describe('firstWords', () => {
  it('takes a short first sentence, else the first words', () => {
    expect(firstWords('The Warden. It sulks in the east forest.')).toBe('The Warden');
    expect(firstWords('I buy what the great ones drop. Fangs, horns.')).toBe('I buy what the great ones drop');
    expect(firstWords('My crown was antlers before it was gold.')).toBe('My crown was antlers before…');
    expect(firstWords('Five voices?')).toBe('Five voices?');
    expect(firstWords('  Shards.   A great many. ')).toBe('Shards');
    expect(firstWords('Mm')).toBe('Mm');
  });
});

describe('parseAction', () => {
  it('parses the bare actions', () => {
    for (const kind of ['close', 'trade', 'hire', 'home', 'lick', 'ale', 'challenge', 'bag-croak', 'follow'] as const) {
      expect(parseAction(kind)).toEqual({ kind });
    }
  });

  it('parses the actions with arguments', () => {
    expect(parseAction('quest:throne:active')).toEqual({ kind: 'quest', id: 'throne', stage: 'active' });
    expect(parseAction('pay:60')).toEqual({ kind: 'pay', n: 60 });
    expect(parseAction('reward:1500')).toEqual({ kind: 'reward', n: 1500 });
    expect(parseAction('pay:0')).toEqual({ kind: 'pay', n: 0 });
    expect(parseAction('give:signed-cup')).toEqual({ kind: 'give', item: 'signed-cup' });
    expect(parseAction('take:old-ledger')).toEqual({ kind: 'take', item: 'old-ledger' });
    expect(parseAction('flag:licked')).toEqual({ kind: 'flag', flag: 'licked' });
    expect(parseAction('journal:The Old Ledger. Take it to the Dragon: he reads.')).toEqual({ kind: 'journal', text: 'The Old Ledger. Take it to the Dragon: he reads.' });
    expect(parseAction('  close  ')).toEqual({ kind: 'close' });
  });

  it('returns null for malformed or unknown ids', () => {
    const bad = [
      '', ':', 'dance', 'close:now', 'lick:frog', 'quest', 'quest:throne', 'quest:throne:', 'quest::active', 'quest:throne:active:more',
      'pay', 'pay:', 'pay:abc', 'pay:-5', 'pay:5.5', 'pay:1e3', 'reward:', 'give', 'give:', 'give:a:b', 'take:', 'flag', 'flag:',
      'flag:a:b', 'journal', 'journal:',
    ];
    for (const id of bad) expect(parseAction(id), id).toBeNull();
  });

  it('formats every action back to the id it was parsed from', () => {
    const ids = ['close', 'trade', 'hire', 'home', 'lick', 'ale', 'challenge', 'bag-croak', 'follow', 'quest:silence:told', 'pay:20',
      'reward:900', 'give:antler-signet', 'take:signed-cup', 'flag:wiped', 'journal:Enlisted in Hollow Jack\'s crew: no pay.'];
    for (const id of ids) {
      const a = parseAction(id) as Action;
      expect(a).not.toBeNull();
      expect(formatAction(a)).toBe(id);
    }
  });
});

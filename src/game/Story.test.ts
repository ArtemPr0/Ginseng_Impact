import { Group, type Sprite } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DIALOGUE, type DialogueBook } from '../data/dialogue/index';
import { VOICES, voiceUrl } from '../data/voices';
import { ANCHORS, LAYOUT } from '../data/world';
import { Npc, NPC_DEFS } from '../world/NPCs';
import type { DialogueNode, DialogueStep, DialogueWorld } from './Dialogue';
import { Events, type GameEvent } from './Events';
import { CONTINUE_LABEL, LEAVE_LABEL, enemyName, firstWords } from './Mind';
import { Quests, type QuestWallet } from './Quests';
import {
  BARK_RANGE, BARK_REST, HIRE_LINES, HOME_LABEL, HOME_LINE, MISSING_LINE, SHORT_LINE, Story, TRADE_LABEL, type StoryDeps,
} from './Story';
import { WorldState } from './WorldState';

// The NPC bodies never load a file here: the bubble the barks show is what the Npc tests below are about.
vi.mock('../characters/Rig', () => ({ Rig: class { root = new Group(); model = null; holdCup(): void {} } }));

const kill = (enemy: string, boss: boolean, x = 0, z = 0): GameEvent => ({ kind: 'kill', enemy, boss, at: { x, y: 0, z } });

/** A line's words as the book has them. */
function text(npc: string, id: string): string {
  const line = DIALOGUE[npc]?.lines.find((l) => l.id === id);
  if (!line) throw new Error(`${npc} has no line ${id}`);
  return line.text;
}

const labels = (node: DialogueNode): string[] => node.choices.map((c) => c.label);

/** Runs the choice labelled `label` (the test fails when there is none) the way the HUD does. */
function pick(node: DialogueNode, label: string): DialogueStep {
  const c = node.choices.find((x) => x.label === label);
  expect(c, `no choice '${label}' among ${JSON.stringify(labels(node))}`).toBeDefined();
  return c!.run ? c!.run() : 'close';
}

/** The node a step leads to (the test fails when the talk closed or went to the shop instead). */
function asNode(step: DialogueStep): DialogueNode {
  expect(typeof step, `the talk went to '${String(step)}'`).toBe('object');
  return step as DialogueNode;
}

interface Opts {
  shards?: number;
  bag?: string[];
  shops?: string[];
  /** NPC id → hire price. */
  hire?: Record<string, number>;
  /** Who stands where, for the barks. */
  npcs?: Array<{ id: string; x: number; z: number }>;
  book?: DialogueBook;
}

/** A Story on fakes: a purse and a bag, a log of what the game was asked to do, the bubbles shown. */
function setup(o: Opts = {}) {
  const events = new Events();
  const state = new WorldState(events);
  const quests = new Quests();
  quests.events = events;
  const purse = { shards: o.shards ?? 0, bag: [...(o.bag ?? [])], paid: 0 };
  const wallet: QuestWallet = {
    shards: () => purse.shards,
    spend: (n) => { if (purse.shards < n) return false; purse.shards -= n; return true; },
    take: (item) => { const i = purse.bag.indexOf(item); if (i < 0) return false; purse.bag.splice(i, 1); return true; },
    give: (item) => { purse.bag.push(item); },
    pay: (n) => { purse.shards += n; purse.paid += n; },
  };
  const log: string[] = [];
  const dw: DialogueWorld = {
    has: (id) => purse.bag.includes(id),
    bagCroak: () => { log.push('bag-croak'); },
    lick: () => { log.push('lick'); },
    drinkAle: () => { log.push('ale'); },
    challengeKing: () => { log.push('challenge'); },
    announce: (t) => { log.push(`announce ${t}`); },
  };
  const following = new Set<string>();
  const price = o.hire ?? {};
  const bubbles: Array<[string, string]> = [];
  const talks: string[] = [];
  events.on('talk', (e) => talks.push(e.npc));
  const player = { x: 0, z: 0 };
  const deps: StoryDeps = {
    quests, state, events, wallet, dw,
    trade: (id) => { log.push(`trade ${id}`); },
    hire: (id) => {
      const cost = price[id];
      if (cost === undefined) return 'none';
      if (following.size >= 3) return 'full';
      if (purse.shards < cost) return 'poor';
      purse.shards -= cost;
      following.add(id);
      return 'ok';
    },
    dismiss: (id) => following.delete(id),
    isHireable: (id) => price[id] !== undefined,
    isFollowing: (id) => following.has(id),
    hasShop: (id) => (o.shops ?? []).includes(id),
    follow: (id) => { log.push(`follow ${id}`); },
    npcsNear: (x, z, r) => (o.npcs ?? [])
      .map((n) => ({ n, d: Math.hypot(n.x - x, n.z - z) }))
      .filter((m) => m.d <= r)
      .sort((a, b) => a.d - b.d)
      .map(({ n }) => ({ id: n.id, bubble: (t: string) => { bubbles.push([n.id, t]); } })),
    journal: (t) => { log.push(`journal ${t}`); },
    rnd: () => 0,
    playerAt: () => player,
    hireCost: (id) => price[id],
    companions: () => following.size,
    book: o.book,
  };
  return { story: new Story(deps), events, state, quests, purse, log, bubbles, talks, following, player };
}

describe('Story.open: the NPCs speak from their books', () => {
  it('greets a first meeting with a met-0 line, then the hub of topics, Trade and Leave; the meeting counted once', () => {
    const t = setup({ shops: ['king'] });
    const node = t.story.open('king')!;
    expect(node.line).toBe(text('king', 'king.greet.first'));
    expect(t.talks).toEqual(['king']);
    expect(t.state.npc.king.met).toBe(1);
    expect(labels(node)[0]).toBe(firstWords(text('king', 'king.topic.ask')));
    expect(labels(node).slice(-2)).toEqual([TRADE_LABEL, LEAVE_LABEL]);
    // The next time is the second meeting: no first-meeting line.
    t.story.update(1);
    expect(t.state.time).toBe(1);
    expect(t.story.open('king')!.line).not.toBe(text('king', 'king.greet.first'));
    expect(t.state.npc.king.met).toBe(2);
    expect(t.talks).toEqual(['king', 'king']);
  });

  it('counts the meeting once when the game announced the talk itself, in the same tick', () => {
    const t = setup();
    t.events.emit({ kind: 'talk', npc: 'king' });
    expect(t.story.open('king')!.line).toBe(text('king', 'king.greet.first'));
    expect(t.talks).toEqual(['king']);
    expect(t.state.npc.king.met).toBe(1);
  });

  it('leads with a reaction to a kill in its district, naming the kill', () => {
    const t = setup();
    t.story.open('king');
    t.story.update(5);
    t.events.emit(kill('wyrm', true, 3, 4));
    const greet = t.story.open('king')!;
    expect(labels(greet)).toEqual([CONTINUE_LABEL]);
    const react = asNode(pick(greet, CONTINUE_LABEL));
    expect(react.line).toContain(enemyName('wyrm'));
    expect(react.line).toBe(text('king', 'king.react.boss').replace('{lastBoss}', enemyName('wyrm')));
    expect(labels(react).at(-1)).toBe(LEAVE_LABEL);
  });

  it('plays a line\'s recording, and gives a closing line a Leave', () => {
    const t = setup();
    t.quests.restore({ throne: 'none' });
    const ask = asNode(pick(t.story.open('king')!, firstWords(text('king', 'king.topic.ask'))));
    expect(ask.voice).toBe(voiceUrl('king-ask'));
    const bye = asNode(pick(t.story.open('king')!, LEAVE_LABEL));
    expect(bye.choices).toEqual([{ label: LEAVE_LABEL }]);
  });
});

describe('Story: the books move the quests', () => {
  it('steps the throne through the King\'s book and pays once, however often the reward is taken', () => {
    const t = setup();
    t.quests.restore({ throne: 'slain' });
    const thanks = asNode(pick(t.story.open('king')!, firstWords(text('king', 'king.topic.thanks'))));
    expect(thanks.line).toBe(text('king', 'king.topic.thanks'));
    expect(thanks.voice).toBe(voiceUrl('king-thanks'));
    const purse = asNode(pick(thanks, 'Take the reward'));
    expect(t.quests.stage('throne')).toBe('done');
    expect(purse.line).toBe(text('king', 'king.topic.purse'));
    expect(t.purse).toMatchObject({ shards: 1500, paid: 1500, bag: ['antler-signet'] });
    expect(t.log).toContain('announce The Usurped Throne · complete');
    // The same choice again, from the line left open: nothing paid twice; its next line was said once, so it closes.
    expect(pick(thanks, 'Take the reward')).toBe('close');
    expect(t.purse).toMatchObject({ shards: 1500, paid: 1500, bag: ['antler-signet'] });
  });

  it('banners a quest given, and lets the bus move it: the Warden\'s death, as the King asked', () => {
    const t = setup();
    const ask = asNode(pick(t.story.open('king')!, firstWords(text('king', 'king.topic.ask'))));
    expect(asNode(pick(ask, "I'll do it.")).line).toBe(text('king', 'king.topic.go'));
    expect(t.quests.stage('throne')).toBe('active');
    expect(t.log).toContain('announce Quest · The Usurped Throne');
    t.events.emit(kill('warden', true));
    expect(t.quests.stage('throne')).toBe('slain');
    // A kill's reward is paid through the Story's wallet: the Frog God's eye, once.
    t.events.emit(kill('dmt-entity', true));
    t.events.emit(kill('dmt-entity', true));
    expect(t.purse.bag).toEqual(['third-eye']);
  });

  it("gates Old Penny's twenty on the purse, and stops short when the purse has emptied meanwhile", () => {
    const poor = setup({ shards: 10 });
    const ask = asNode(pick(poor.story.open('vale-beggar')!, firstWords(text('vale-beggar', 'vale-beggar.topic.ask'))));
    expect(labels(ask)).toEqual(['I have not got it.', 'Not today.']);

    const t = setup({ shards: 25 });
    const offer = asNode(pick(t.story.open('vale-beggar')!, firstWords(text('vale-beggar', 'vale-beggar.topic.ask'))));
    expect(labels(offer)[0]).toBe('Here. Twenty.');
    t.purse.shards = 5;
    expect(asNode(pick(offer, 'Here. Twenty.')).line).toBe(SHORT_LINE);
    expect(t.quests.stage('penny')).toBe('none');
    t.purse.shards = 25;
    expect(asNode(pick(offer, 'Here. Twenty.')).line).toBe(text('vale-beggar', 'vale-beggar.topic.secret'));
    expect(t.quests.stage('penny')).toBe('secret');
    expect(t.purse.shards).toBe(5);
  });

  it("still offers the Frog King's lick to a player who took the shards instead", () => {
    const t = setup();
    t.quests.restore({ croak: 'returned' });
    const reward = asNode(pick(t.story.open('frogking')!, firstWords(text('frogking', 'frogking.topic.reward'))));
    expect(reward.voice).toBe(voiceUrl('frog-reward'));
    expect(asNode(pick(reward, 'No, you must be sick or something')).line).toBe(text('frogking', 'frogking.topic.declined'));
    expect(t.quests.stage('croak')).toBe('done');
    expect(t.purse.paid).toBe(400);
    // Back another day: the dream is not lost.
    t.story.update(10);
    const changed = asNode(pick(t.story.open('frogking')!, firstWords(text('frogking', 'frogking.topic.changed'))));
    expect(pick(changed, '*lick*')).toBe('close');
    expect(t.log).toContain('lick');
    expect(t.purse.paid).toBe(400);
  });

  it("ends Croak's quest with the lick, unpaid: the dream is the Frog King's thanks", () => {
    const t = setup();
    t.quests.restore({ croak: 'returned' });
    const reward = asNode(pick(t.story.open('frogking')!, firstWords(text('frogking', 'frogking.topic.reward'))));
    const licked = asNode(pick(reward, 'Uhh... sure'));
    expect(licked.line).toBe(text('frogking', 'frogking.topic.licked'));
    expect(pick(licked, '*lick*')).toBe('close');
    expect(t.log).toContain('lick');
    // The adventures' lick puts the feat on the bus as the dream begins: the graph's trigger finishes the quest.
    t.events.emit({ kind: 'feat', what: 'lick' });
    expect(t.quests.stage('croak')).toBe('done');
    expect(t.purse.paid).toBe(0);
    expect(t.log).toContain('announce The Prodigal Croak · complete');
  });

  it("bags Croak with his own book's 'In you go.'", () => {
    const t = setup();
    t.quests.restore({ croak: 'active' });
    const busted = asNode(pick(t.story.open('croak')!, firstWords(text('croak', 'croak.topic.busted'))));
    const sacked = asNode(pick(busted, 'Put him in the bag'));
    expect(sacked.voice).toBe(voiceUrl('croak-bagged'));
    expect(pick(sacked, 'In you go.')).toBe('close');
    expect(t.log).toContain('bag-croak');
  });

  it("never steps a quest back from a line left open, and banners a quest given only once", () => {
    const t = setup();
    const given = () => t.log.filter((l) => l === 'announce Quest · The Prodigal Croak').length;
    const ask = asNode(pick(t.story.open('frogking')!, firstWords(text('frogking', 'frogking.topic.ask'))));
    expect(asNode(pick(ask, "I'll find him.")).line).toBe(text('frogking', 'frogking.topic.where'));
    expect(t.quests.stage('croak')).toBe('active');
    expect(given()).toBe(1);
    // Croak in the sack meanwhile; the Frog King's offer, still on the screen, is taken again: he stays in the sack.
    t.quests.step('croak', 'bagged', null);
    pick(ask, "I'll find him.");
    expect(t.quests.stage('croak')).toBe('bagged');
    // Put down away from his father he climbs out (the graph's bagged→active): the same quest, not a new one.
    t.quests.step('croak', 'active', null);
    expect(t.quests.stage('croak')).toBe('active');
    expect(given()).toBe(1);
  });

  it("walks the Pale Bride to the shore once the bell is done: 'follow' moves her quest", () => {
    const t = setup();
    const feats: string[] = [];
    t.events.on('feat', (e) => feats.push(e.what));
    t.quests.restore({ bell: 'done' });
    const bells = asNode(pick(t.story.open('bride')!, firstWords(text('bride', 'bride.topic.bells'))));
    expect(pick(bells, 'Walk with me.')).toBe('close');
    expect(t.log).toContain('follow bride');
    expect(t.quests.stage('bride')).toBe('walking');
    expect(t.log).toContain("announce Quest · Where the Sand Ends");
    // (Her 'follow' is the graph's trigger, handed to the quests: the bus carries no such feat.)
    expect(feats).toEqual([]);
  });

  it("answers Corvin at once when three great ones have fallen already (the world state's bosses)", () => {
    const t = setup();
    for (const boss of ['wyrm', 'marshdemon', 'shade']) t.events.emit(kill(boss, true, 500, 500));
    t.story.update(400);
    const ask = asNode(pick(t.story.open('rose-knight')!, firstWords(text('rose-knight', 'rose-knight.topic.ask'))));
    pick(ask, "I'll speak for you.");
    expect(t.quests.stage('rose')).toBe('worthy');
  });

  it('runs every other action of the books: flags, notes, pay, reward, give, take, the challenge', () => {
    const book: DialogueBook = {
      smith: {
        persona: { id: 'smith', district: 'island', knows: [], rumourDelay: 0, tone: 'dry', about: 'A smith.' },
        lines: [
          { id: 'smith.greet.hm', slot: 'greet', text: 'Hm.', choices: [
            { label: 'Flag', action: 'flag:bought', to: 'smith.topic.after' },
            { label: 'Note', action: 'journal:The smith hums.', to: 'smith.topic.after' },
            { label: 'Pay', action: 'pay:30', to: 'smith.topic.after' },
            { label: 'Tip', action: 'reward:5', to: 'smith.topic.after' },
            { label: 'Give', action: 'give:moon-dew', to: 'smith.topic.after' },
            { label: 'Take', action: 'take:old-bone', to: 'smith.topic.after' },
            { label: 'Ale', action: 'ale', to: 'smith.topic.after' },
            { label: 'Fight', action: 'challenge' },
          ] },
          { id: 'smith.topic.after', slot: 'topic', text: 'Done. You carry {shards}.' },
        ],
      },
    };
    const t = setup({ book, shards: 10 });
    const hm = t.story.open('smith')!;
    expect(asNode(pick(hm, 'Flag')).line).toBe('Done. You carry 10.');
    expect(t.state.flags.has('bought')).toBe(true);
    pick(hm, 'Note');
    expect(t.log).toContain('journal The smith hums.');
    expect(asNode(pick(hm, 'Pay')).line).toBe(SHORT_LINE);
    t.purse.shards = 40;
    expect(asNode(pick(hm, 'Pay')).line).toBe('Done. You carry 10.');
    expect(asNode(pick(hm, 'Tip')).line).toBe('Done. You carry 15.');
    pick(hm, 'Give');
    expect(t.purse.bag).toEqual(['moon-dew']);
    expect(asNode(pick(hm, 'Take')).line).toBe(MISSING_LINE);
    t.purse.bag.push('old-bone');
    pick(hm, 'Take');
    expect(t.purse.bag).toEqual(['moon-dew']);
    pick(hm, 'Ale');
    expect(pick(hm, 'Fight')).toBe('close');
    expect(t.log.filter((l) => l === 'ale' || l === 'challenge')).toEqual(['ale', 'challenge']);
  });
});

describe('Story: Trade, Hire, Send home', () => {
  it('offers Trade only at a shop, and the shop opens on it', () => {
    const t = setup({ shops: ['king'], hire: { vigil: 200 } });
    const king = t.story.open('king')!;
    expect(labels(king)).toContain(TRADE_LABEL);
    expect(labels(king).some((l) => l.startsWith('Hire') || l === HOME_LABEL)).toBe(false);
    expect(pick(king, TRADE_LABEL)).toBe('trade');
    expect(t.log).toContain('trade king');
    expect(labels(t.story.open('vigil')!)).not.toContain(TRADE_LABEL);
  });

  it('offers Hire (with the price) to one who can be hired, then Send home while he follows', () => {
    const t = setup({ shards: 250, hire: { vigil: 200 } });
    const first = t.story.open('vigil')!;
    expect(labels(first).slice(-2)).toEqual(['Hire · ◆ 200', LEAVE_LABEL]);
    expect(labels(first)).not.toContain(HOME_LABEL);
    const hired = asNode(pick(first, 'Hire · ◆ 200'));
    expect(hired.line).toBe(HIRE_LINES.ok);
    expect(hired.choices).toEqual([{ label: LEAVE_LABEL }]);
    expect(t.following.has('vigil')).toBe(true);
    t.story.update(1);
    const later = t.story.open('vigil')!;
    expect(labels(later).slice(-2)).toEqual([HOME_LABEL, LEAVE_LABEL]);
    expect(labels(later).some((l) => l.startsWith('Hire'))).toBe(false);
    expect(asNode(pick(later, HOME_LABEL)).line).toBe(HOME_LINE);
    expect(t.following.size).toBe(0);
  });

  it('tells a player short of the price so', () => {
    const t = setup({ shards: 100, hire: { vigil: 200 } });
    expect(asNode(pick(t.story.open('vigil')!, 'Hire · ◆ 200')).line).toBe(HIRE_LINES.poor);
    expect(t.following.size).toBe(0);
  });

  it('offers neither to one who keeps no shop and takes no hire', () => {
    const t = setup({ shops: ['king'], hire: { vigil: 200 } });
    const ls = labels(t.story.open('croak')!);
    expect(ls.at(-1)).toBe(LEAVE_LABEL);
    expect(ls.some((l) => l === TRADE_LABEL || l === HOME_LABEL || l.startsWith('Hire'))).toBe(false);
  });
});

describe('Story.bark', () => {
  const npcs = [{ id: 'nobody', x: 1, z: 0 }, { id: 'king', x: 2, z: 0 }, { id: 'vigil', x: 6, z: 0 }, { id: 'cook', x: 80, z: 0 }];

  it('has the nearest NPC with a book bark at a kill: one bubble per event, one bark per NPC per twenty seconds', () => {
    const t = setup({ npcs });
    t.events.emit(kill('beast', false, 0, 0));
    expect(t.bubbles.map(([id]) => id)).toEqual(['king']);
    expect(DIALOGUE.king.lines.filter((l) => l.slot === 'bark').map((l) => l.text)).toContain(t.bubbles[0][1]);
    t.events.emit(kill('beast', false, 0, 0));
    expect(t.bubbles.map(([id]) => id)).toEqual(['king', 'vigil']);
    t.events.emit(kill('beast', false, 0, 0));
    expect(t.bubbles).toHaveLength(2);
    t.story.update(BARK_REST);
    t.events.emit(kill('beast', false, 0, 0));
    expect(t.bubbles.map(([id]) => id)).toEqual(['king', 'vigil', 'king']);
  });

  it('hears a kill within 25 m of where it fell, a hurt within 12 m and a flight within 8 m of the hero', () => {
    const t = setup({ npcs: [{ id: 'king', x: 10, z: 0 }] });
    t.player.x = -10;
    t.events.emit(kill('beast', false, 10 + BARK_RANGE.kill + 1, 0));
    t.events.emit({ kind: 'hurt', amount: 5, by: 'beast' });
    t.events.emit({ kind: 'feat', what: 'fly' });
    expect(t.bubbles).toEqual([]);
    t.player.x = 10 - BARK_RANGE.hurt + 1;
    t.events.emit({ kind: 'feat', what: 'fly' });
    t.events.emit({ kind: 'feat', what: 'swim' });
    expect(t.bubbles).toEqual([]);
    t.events.emit({ kind: 'hurt', amount: 5, by: 'beast' });
    expect(t.bubbles).toHaveLength(1);
    t.story.update(BARK_REST);
    t.player.x = 10 - BARK_RANGE.feat + 1;
    t.events.emit({ kind: 'feat', what: 'fly' });
    expect(t.bubbles).toHaveLength(2);
    t.story.update(BARK_REST);
    t.events.emit(kill('beast', false, 10 + BARK_RANGE.kill - 1, 0));
    expect(t.bubbles).toHaveLength(3);
  });

  it('can be asked directly, and skips those without a book', () => {
    const t = setup({ npcs: [{ id: 'nobody', x: 0, z: 0 }] });
    t.story.bark(kill('beast', false));
    expect(t.bubbles).toEqual([]);
  });
});

describe('Story: those without a book', () => {
  it('falls back to Dialogue.ts for the rowers, the talk recorded once', () => {
    const t = setup();
    const node = t.story.open('rowers')!;
    expect(node.line).toBe(VOICES['rower-offer'].text);
    expect(labels(node)).toEqual(["I'm sober today.", 'My wife would kill me.', 'Hell yeah!']);
    expect(asNode(pick(node, 'Hell yeah!')).line).toBe(VOICES['rower-yeah'].text);
    expect(t.log).toContain('ale');
    expect(t.talks).toEqual(['rowers']);
    expect(t.story.open('no-one-at-all')).toBeNull();
  });
});

describe('Story: every book', () => {
  it('opens for every NPC with a book, and every choice three steps deep leads to a line, the shop or the end', () => {
    const shops = NPC_DEFS.filter((d) => d.shop?.length).map((d) => d.id);
    const hire = Object.fromEntries(NPC_DEFS.filter((d) => d.hire).map((d) => [d.id, d.hire!.cost]));
    let steps = 0;
    for (const id of Object.keys(DIALOGUE)) {
      const t = setup({ shards: 5000, shops, hire });
      const first = t.story.open(id);
      expect(first, id).not.toBeNull();
      let level: DialogueNode[] = [first!];
      for (let depth = 0; depth < 3 && level.length; depth++) {
        const next: DialogueNode[] = [];
        for (const node of level) {
          expect(node.line.length, `${id}: an empty line`).toBeGreaterThan(0);
          expect(node.choices.length, `${id}: "${node.line}" has no way on`).toBeGreaterThan(0);
          for (const c of node.choices) {
            const step = c.run ? c.run() : 'close';
            steps++;
            if (typeof step === 'object') next.push(step);
            else expect(['close', 'trade'], `${id}: '${c.label}'`).toContain(step);
          }
        }
        level = next;
      }
    }
    expect(steps).toBeGreaterThan(Object.keys(DIALOGUE).length * 3);
  });
});

describe('Npc.bubble: what the barks show', () => {
  /** Enough of a canvas for a speech bubble; it remembers the words it was handed. */
  function canvas(): string[] {
    const drawn: string[] = [];
    const ctx = {
      font: '', fillStyle: '', strokeStyle: '', lineWidth: 0, textAlign: '', textBaseline: '',
      clearRect() {}, measureText: (t: string) => ({ width: t.length * 14 }), fillRect() {}, strokeRect() {},
      beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill() {}, fillText(t: string) { drawn.push(t); },
    };
    vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) });
    return drawn;
  }
  const def = (id: string) => NPC_DEFS.find((d) => d.id === id)!;
  const sprites = (g: Group) => g.children.filter((c): c is Sprite => c.type === 'Sprite');
  afterEach(() => { vi.unstubAllGlobals(); });

  it('says a bark in the bubble over his head, and nothing while he is out of the world', () => {
    const drawn = canvas();
    const king = new Npc(def('king'), { x: 0, z: 0 }, () => 0);
    king.bubble('Bring it to the throne.');
    expect(drawn).toEqual(['Bring it to the throne.']);
    expect(sprites(king.object)[0].visible).toBe(true);
    king.hidden = true;
    king.bubble('Kneel or do not.');
    expect(drawn).toEqual(['Bring it to the throne.']);
  });

  it("hangs a bodiless talker's bubble in the group he stands in: the Stone Head's at its mouth, before its face", () => {
    canvas();
    const head = def('stone-head');
    expect(head).toMatchObject({ invisible: true, talkRange: 30 });
    // Where the player stands before the face: on the causeway's line, short of the chin (the head's collider reaches
    // about 6 m in front of its centre), with the causeway's end within talking range.
    const at = ANCHORS['stone-head'];
    expect(at.x).toBe(LAYOUT.head.x);
    expect(at.z).toBeGreaterThan(LAYOUT.head.z + 6);
    expect(LAYOUT.causeway.zEnd - at.z).toBeLessThan(head.talkRange!);
    const group = new Group();
    // (The rise before the face is ~7.6 m high there.)
    const n = new Npc(head, at, () => 7.6);
    group.add(n.object);
    expect(n.object.visible).toBe(false);
    n.bubble('Still here.');
    expect(sprites(n.object)).toEqual([]);
    const [b] = sprites(group);
    expect(b.visible).toBe(true);
    expect(b.position.x).toBeCloseTo(at.x);
    expect(b.position.z).toBeCloseTo(at.z);
    // StoneHead.ts's mouth (14.4 m) less the 1.4 m its own bubble hangs below it.
    expect(b.position.y).toBeCloseTo(13);
    // The world re-showing the island after a realm leaves a finished bubble hidden.
    expect(b.userData.hidden).toBe(true);
  });
});

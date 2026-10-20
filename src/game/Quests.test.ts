import { describe, expect, it } from 'vitest';
import { VOICES } from '../data/voices';
import { dialogueFor, type DialogueWorld } from './Dialogue';
import { QUESTS, Quests } from './Quests';

describe('Quests', () => {
  it('starts every quest at none and tracks only the ones in progress', () => {
    const q = new Quests();
    expect(q.stage('throne')).toBe('none');
    expect(q.tracker()).toEqual([]);
    q.set('throne', 'active');
    expect(q.tracker()).toEqual([{ title: 'The Usurped Throne', objective: 'Slay the Antlered Warden in the east forest' }]);
    q.set('throne', 'done');
    expect(q.tracker()).toEqual([]);
    expect(q.active('throne')).toBe(false);
  });

  it('moves the throne quest on when the Warden dies, and only then', () => {
    const q = new Quests();
    let changes = 0;
    q.onChange = () => changes++;
    q.kill('warden');
    expect(q.stage('throne')).toBe('none');
    q.set('throne', 'active');
    q.kill('yeti');
    expect(q.stage('throne')).toBe('active');
    q.kill('warden');
    expect(q.stage('throne')).toBe('slain');
    expect(changes).toBe(2);
  });
});

describe('Quests — the save', () => {
  it('snapshots every quest, the flag-like ones too', () => {
    const q = new Quests();
    expect(Object.keys(q.snapshot()).sort()).toEqual(Object.keys(QUESTS).sort());
    q.set('throne', 'active');
    q.set('trip', 'done');
    expect(q.snapshot()).toEqual({ throne: 'active', croak: 'none', lean: 'none', sound: 'none', trip: 'done', crown: 'none' });
  });

  it('restores stages without firing any step, with one onChange at the end', () => {
    const q = new Quests();
    let changes = 0;
    q.onChange = () => changes++;
    q.set('sound', 'found');
    changes = 0;
    q.restore({ throne: 'active', croak: 'returned', trip: 'done', bogus: 'whatever', constructor: 'nope' });
    expect(changes).toBe(1);
    expect(q.stage('throne')).toBe('active');
    expect(q.stage('croak')).toBe('returned');
    expect(q.stage('trip')).toBe('done');
    // Replaced, not merged: what the snapshot does not name is back at none.
    expect(q.stage('sound')).toBe('none');
    expect(q.tracker().map((t) => t.title)).toEqual(['The Usurped Throne', 'The Prodigal Croak']);
    // A kill logged before the restore does not move a restored quest (the save already settled that).
    const r = new Quests();
    r.kill('warden');
    r.restore({ throne: 'active' });
    expect(r.stage('throne')).toBe('active');
    expect(r.snapshot()).toEqual({ ...new Quests().snapshot(), throne: 'active' });
  });

  it('keeps the kill log across a save: a quest given later still counts the kill', () => {
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

/** The Frog King's hollow: what his conversation does to the game, counted. */
function hollow(q: Quests): { w: DialogueWorld; n: { paid: number; licks: number } } {
  const n = { paid: 0, licks: 0 };
  const quiet = () => {};
  const w: DialogueWorld = {
    quests: q, pay: (x) => { n.paid += x; }, give: quiet, has: () => false, take: () => false,
    bagCroak: quiet, lick: () => { n.licks++; }, drinkAle: quiet, challengeKing: quiet, announce: quiet,
  };
  return { w, n };
}

describe('The Frog King', () => {
  it('still offers the lick to a player who took the shards instead', () => {
    const q = new Quests();
    const { w, n } = hollow(q);
    q.set('croak', 'returned');
    const reward = dialogueFor('frogking', w)!;
    expect(reward.line).toBe(VOICES['frog-reward'].text);
    reward.choices.find((c) => c.label.startsWith('No'))!.run!();
    expect(n.paid).toBe(400);
    expect(q.stage('croak')).toBe('done');
    expect(q.stage('trip')).toBe('none');
    // Back another day: the dream is not lost.
    const later = dialogueFor('frogking', w)!;
    expect(later.line).toBe('Changed your mind? You may still lick me.');
    expect(later.choices.find((c) => c.label === '*lick*')!.run!()).toBe('close');
    expect(n.licks).toBe(1);
  });

  it('keeps the door to the dream open once you have been and come back', () => {
    const q = new Quests();
    const { w, n } = hollow(q);
    q.set('croak', 'done');
    q.set('trip', 'done');
    const node = dialogueFor('frogking', w)!;
    expect(node.line).toBe(VOICES['frog-anytime'].text);
    node.choices.find((c) => c.label === '*lick*')!.run!();
    expect(n.licks).toBe(1);
  });
});

import { describe, expect, it } from 'vitest';
import { VOICES } from '../data/voices';
import { dialogueFor, type DialogueWorld } from './Dialogue';
import { Events } from './Events';
import { Quests } from './Quests';

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

  it('announces each step on the bus once, and never a stage it is already at', () => {
    const q = new Quests();
    const events = new Events();
    const steps: string[] = [];
    events.on('quest', (e) => steps.push(`${e.id}:${e.stage}`));
    q.events = events;
    q.set('throne', 'active');
    q.set('throne', 'active');
    q.kill('warden');
    q.kill('warden');
    q.set('throne', 'done');
    expect(steps).toEqual(['throne:active', 'throne:slain', 'throne:done']);
    // A quest given after its kill: the start and the step it skips to, both announced.
    q.kill('warden');
    q.start('throne', 'active');
    expect(steps.slice(3)).toEqual(['throne:active', 'throne:slain']);
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

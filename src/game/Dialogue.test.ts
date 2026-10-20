import { describe, expect, it } from 'vitest';
import { DIALOGUE } from '../data/dialogue/index';
import { VOICES, voiceUrl } from '../data/voices';
import { dialogueFor, type DialogueNode, type DialogueWorld } from './Dialogue';

/** A dialogue world that counts the beers. */
function world(): { w: DialogueWorld; ales: () => number } {
  let ales = 0;
  const quiet = () => {};
  const w: DialogueWorld = { has: () => false, bagCroak: quiet, lick: quiet, drinkAle: () => { ales++; }, challengeKing: quiet, announce: quiet };
  return { w, ales: () => ales };
}

describe('dialogueFor: the talk without a book', () => {
  it("offers the rowers' beer: two ways to refuse, and the ale", () => {
    const { w, ales } = world();
    const offer = dialogueFor('rowers', w)!;
    expect(offer.line).toBe(VOICES['rower-offer'].text);
    expect(offer.voice).toBe(voiceUrl('rower-offer'));
    const answer = (label: string) => offer.choices.find((c) => c.label === label)!.run!() as DialogueNode;
    expect(answer("I'm sober today.").line).toBe(VOICES['rower-sober'].text);
    expect(answer('My wife would kill me.').line).toBe(VOICES['rower-wife'].text);
    expect(ales()).toBe(0);
    const yeah = answer('Hell yeah!');
    expect(yeah.line).toBe(VOICES['rower-yeah'].text);
    expect(yeah.choices.map((c) => [c.label, c.run])).toEqual([['Leave', undefined]]);
    expect(ales()).toBe(1);
  });

  it('has nothing for anyone with a dialogue book (the Story speaks for them)', () => {
    const { w } = world();
    for (const id of Object.keys(DIALOGUE)) expect(dialogueFor(id, w), id).toBeNull();
    expect(dialogueFor('nobody', w)).toBeNull();
  });
});

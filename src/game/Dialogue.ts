/**
 * Conversations with choices. A node is a line (with its recorded voice when it has one) and the player's answers;
 * an answer's `run` changes the world (quests, rewards, the sack, a beer) and says where the talk goes next: another
 * node, 'close', 'trade' (the NPC's shop) or 'more' (the NPC's ordinary lines). No answer → it closes.
 */
import { VOICES, voiceUrl } from '../data/voices';
import type { Quests } from './Quests';

export type DialogueStep = DialogueNode | 'close' | 'trade' | 'more';

export interface DialogueChoice { label: string; run?: () => DialogueStep }

export interface DialogueNode { line: string; voice?: string; choices: DialogueChoice[] }

/** What a conversation can do to the game. */
export interface DialogueWorld {
  quests: Quests;
  /** Pays the player `n` Moon Shards. */
  pay(n: number): void;
  give(itemId: string): void;
  has(itemId: string): boolean;
  take(itemId: string): boolean;
  /** Croak goes into the sack on the hero's back. */
  bagCroak(): void;
  /** Off into the Frog King's dream for two minutes. */
  lick(): void;
  /** The rowers' beer: stamina drains slower for a while. */
  drinkAle(): void;
  announce(text: string): void;
}

/** A recorded line as a node (text from the voice table). */
function say(id: string, choices: DialogueChoice[]): DialogueNode {
  return { line: VOICES[id].text, voice: voiceUrl(id), choices };
}
const LEAVE: DialogueChoice = { label: 'Leave' };

/** The opening node for talking to `npcId` now, or null when the NPC only has ordinary lines. */
export function dialogueFor(npcId: string, w: DialogueWorld): DialogueNode | null {
  const q = w.quests;
  switch (npcId) {
    case 'king': {
      const s = q.stage('throne');
      const accept: DialogueChoice = {
        label: "I'll do it.",
        run: () => { q.set('throne', 'active'); w.announce('Quest · The Usurped Throne'); return { line: 'Then go. It sulks in the east forest, under the rain.', choices: [LEAVE] }; },
      };
      const trade: DialogueChoice = { label: 'Trade', run: () => 'trade' };
      if (s === 'none') {
        return say('king-ask', [
          accept,
          { label: 'What would I get?', run: () => ({ line: 'Shards. A great many. And my signet, which makes any blade hungrier. Very generous, as I said.', choices: [accept, { label: 'Not now.' }] }) },
          trade,
          { label: 'Not now.' },
        ]);
      }
      if (s === 'active') return say('king-wait', [trade, LEAVE]);
      if (s === 'slain') {
        return say('king-thanks', [{
          label: 'Take the reward',
          run: () => { w.pay(1500); w.give('antler-signet'); q.set('throne', 'done'); w.announce('The Usurped Throne · complete'); return 'close'; },
        }]);
      }
      return null;
    }
    case 'brother': {
      const s = q.stage('lean');
      if (s === 'none') {
        return say('brother-greet', [
          { label: 'Deal.', run: () => { q.set('lean', 'active'); w.announce('Quest · Find Yung Lean'); return { line: 'Bet. He sits on a porcelain throne past the galaxy portal. Bring the cup back here.', choices: [LEAVE] }; } },
          { label: 'Not my business.' },
        ]);
      }
      if (s !== 'done' && w.has('signed-cup')) {
        return say('brother-paid', [{
          label: 'Hand over the cup',
          run: () => { w.take('signed-cup'); w.pay(1000); q.set('lean', 'done'); w.announce('Find Yung Lean · complete'); return 'close'; },
        }]);
      }
      if (s !== 'done') return say('brother-wait', [LEAVE]);
      return null;
    }
    case 'frogking': {
      const s = q.stage('croak');
      if (s === 'none') {
        return say('frog-ask', [
          { label: "I'll find him.", run: () => { q.set('croak', 'active'); w.announce('Quest · The Prodigal Croak'); return 'close'; } },
          { label: 'Not my problem.' },
        ]);
      }
      if (s === 'active' || s === 'bagged') return say('frog-wait', [LEAVE]);
      if (s === 'returned') {
        return say('frog-reward', [
          { label: 'No, you must be sick or something', run: () => { w.pay(400); q.set('croak', 'done'); w.announce('The Prodigal Croak · complete'); return say('frog-declined', [LEAVE]); } },
          { label: 'Uhh... sure', run: () => { q.set('croak', 'done'); w.announce('The Prodigal Croak · complete'); return say('frog-licked', [{ label: '*lick*', run: () => { w.lick(); return 'close'; } }]); } },
        ]);
      }
      return null;
    }
    case 'croak': {
      if (q.stage('croak') !== 'active') return null;
      const bag: DialogueChoice = { label: 'Put him in the bag', run: () => { w.bagCroak(); return 'close'; } };
      return say('croak-busted', [
        { label: 'Your father wants you home.', run: () => ({ line: 'Ribbit. Tell him I moved to the lotus pond. Permanently.', choices: [bag, LEAVE] }) },
        bag,
        LEAVE,
      ]);
    }
    case 'rowers':
      return say('rower-offer', [
        { label: "I'm sober today.", run: () => say('rower-sober', [LEAVE]) },
        { label: 'My wife would kill me.', run: () => say('rower-wife', [LEAVE]) },
        { label: 'Hell yeah!', run: () => { w.drinkAle(); return say('rower-yeah', [LEAVE]); } },
      ]);
  }
  return null;
}

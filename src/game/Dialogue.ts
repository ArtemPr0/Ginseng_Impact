/**
 * Conversations as the HUD draws them (Hud.dialogue): a node is a line (with its recorded voice when it has one) and
 * the player's answers; an answer's `run` changes the world and says where the talk goes next: another node, 'close'
 * or 'trade' (the NPC's shop). No answer → it closes. Every NPC speaks from its dialogue book through the Story
 * (game/Story.ts), which builds these nodes; what is left here is the one talk without a book: the rowers' beer.
 */
import { VOICES, voiceUrl } from '../data/voices';

export type DialogueStep = DialogueNode | 'close' | 'trade';

export interface DialogueChoice { label: string; run?: () => DialogueStep }

export interface DialogueNode { line: string; voice?: string; choices: DialogueChoice[] }

/**
 * What a conversation can do to the game besides the quests and the purse (the Story steps those along the quest
 * graph, through the wallet).
 */
export interface DialogueWorld {
  has(itemId: string): boolean;
  /** Croak goes into the sack on the hero's back. */
  bagCroak(): void;
  /** Off into the Frog King's dream for four minutes. */
  lick(): void;
  /** The rowers' beer: stamina drains slower for a while. */
  drinkAle(): void;
  /** Yung Lean gets up from his throne to fight. */
  challengeKing(): void;
  announce(text: string): void;
}

/** A recorded line as a node (text from the voice table). */
function say(id: string, choices: DialogueChoice[]): DialogueNode {
  return { line: VOICES[id].text, voice: voiceUrl(id), choices };
}
const LEAVE: DialogueChoice = { label: 'Leave' };

/** The conversation with someone who has no dialogue book (the rowers on the river boats), or null. */
export function dialogueFor(npcId: string, w: DialogueWorld): DialogueNode | null {
  if (npcId !== 'rowers') return null;
  return say('rower-offer', [
    { label: "I'm sober today.", run: () => say('rower-sober', [LEAVE]) },
    { label: 'My wife would kill me.', run: () => say('rower-wife', [LEAVE]) },
    { label: 'Hell yeah!', run: () => { w.drinkAle(); return say('rower-yeah', [LEAVE]); } },
  ]);
}

/**
 * Every NPC's dialogue book in one place: the island (two books), Yung Lean's kingdom and the realms (the tree
 * house, the Crypt Bar, the Candle Tavern and the Vale, the Sunken City). Pure data for the Mind (src/game/Mind.ts).
 */
import type { DialogueBook } from './types';
import { ISLAND_A } from './island-a';
import { ISLAND_B } from './island-b';
import { KINGDOM } from './kingdom';
import { REALMS } from './realms';

export * from './types';

/** One book from several; an NPC written in two books is a mistake, caught when the module loads. */
function merge(...books: DialogueBook[]): DialogueBook {
  const out: DialogueBook = {};
  for (const book of books) {
    for (const [id, npc] of Object.entries(book)) {
      if (Object.prototype.hasOwnProperty.call(out, id)) throw new Error(`dialogue: NPC '${id}' has a book in two files`);
      out[id] = npc;
    }
  }
  return out;
}

/** NPC id → persona and lines, for every NPC in NPC_DEFS and the Stone Head. */
export const DIALOGUE: DialogueBook = merge(ISLAND_A, ISLAND_B, KINGDOM, REALMS);

/** Items the story adds later (the quests give and take them); not in ITEMS yet. */
export const NEW_ITEM_IDS: readonly string[] = ['drowned-bell', 'grave-crown', 'old-ledger'];

/** Every quest the books advance or ask about ('quest:<id>:<stage>' actions, Cond.quest). */
export const QUEST_IDS: readonly string[] = ['silence', 'throne', 'croak', 'trip', 'crown', 'lean', 'sound', 'bell', 'grave', 'penny', 'books', 'rose', 'bride'];

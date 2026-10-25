/**
 * The dialogue books, checked against the game's tables: every NPC in DIALOGUE is a real NPC (NPC_DEFS, or the
 * Stone Head landmark) in real zones; every line points only at enemies, items, quests, voices, flags, templates
 * and lines that exist; every slot has enough lines not to repeat; every NPC_DEFS id has a book.
 */
import { describe, expect, it } from 'vitest';
import type { Zone } from '../../game/Events';
import { ENEMY_DEFS } from '../enemies';
import { VOICES } from '../voices';
import { ITEMS } from '../../items/Items';
import { NPC_DEFS } from '../../world/NPCs';
import { DIALOGUE, NEW_ITEM_IDS, QUEST_IDS } from './index';
import type { Cond, Flag, LineDef, NpcDialogue, Slot } from './types';

/** Keyed by the type, so the compiler insists on every member and allows no other. */
const ZONES: Record<Zone, true> = {
  island: true, galaxy: true, sunken: true, treehouse: true, dream: true, graveyard: true, vale: true, 'tavern-room': true, 'crypt-room': true,
};
const FLAGS: Record<Flag, true> = {
  licked: true, ale: true, fountain: true, skyeyes: true, carriage: true, bounce: true, flew: true, swam: true, climbed: true,
  'equipped-mythic': true, wiped: true, hired: true, sold: true, bought: true, chest: true, levelup: true, crit: true, sip: true,
};
/** The fewest lines a slot needs so an NPC does not repeat itself. */
const SLOT_MIN: Record<Slot, number> = { greet: 3, react: 10, topic: 2, bye: 2, bark: 3 };
const MAX_TEXT = 160;
const MAX_BARK = 60;
const TEMPLATES = new Set(['hero', 'heroTitle', 'lastKill', 'lastBoss', 'district', 'shards', 'level', 'met']);
const PLAIN_ACTIONS = new Set(['close', 'trade', 'hire', 'home', 'lick', 'ale', 'challenge', 'bag-croak', 'follow']);

const has = (table: object, key: string): boolean => Object.prototype.hasOwnProperty.call(table, key);
const NPC_IDS = new Set(NPC_DEFS.map((d) => d.id));
const isZone = (z: string): boolean => has(ZONES, z);
const isEnemy = (kind: string): boolean => has(ENEMY_DEFS, kind);
const isItem = (id: string): boolean => has(ITEMS, id) || NEW_ITEM_IDS.includes(id);
const isQuest = (id: string): boolean => QUEST_IDS.includes(id);
const isFlag = (f: string): boolean => has(FLAGS, f);

const npcs: Array<[string, NpcDialogue]> = Object.entries(DIALOGUE);

/** Every line of every NPC, with the NPC's id. */
function* allLines(): Generator<[string, LineDef]> {
  for (const [id, npc] of npcs) for (const line of npc.lines) yield [id, line];
}

/** The conditions on a line and on its choices, each labelled for the failure message. */
function conds(line: LineDef): Array<[string, Cond]> {
  const out: Array<[string, Cond]> = [];
  if (line.when) out.push(['when', line.when]);
  line.choices?.forEach((c, i) => { if (c.when) out.push([`choice ${i} '${c.label}'`, c.when]); });
  return out;
}

/** What is wrong with an action (see types.ts for the documented forms), or null. */
function actionProblem(action: string): string | null {
  if (PLAIN_ACTIONS.has(action)) return null;
  const m = /^(quest|pay|give|take|reward|flag|journal):([\s\S]*)$/.exec(action);
  if (!m) return `unknown action '${action}'`;
  const [, kind, arg] = m;
  switch (kind) {
    case 'quest': {
      const parts = arg.split(':');
      if (parts.length !== 2 || !parts[0] || !parts[1]) return `'${action}' is not quest:<id>:<stage>`;
      return isQuest(parts[0]) ? null : `'${action}': unknown quest '${parts[0]}'`;
    }
    case 'pay':
    case 'reward':
      return /^[1-9]\d*$/.test(arg) ? null : `'${action}' needs a whole number of shards`;
    case 'give':
    case 'take':
      return isItem(arg) ? null : `'${action}': unknown item '${arg}'`;
    case 'flag':
      return isFlag(arg) ? null : `'${action}': unknown flag '${arg}'`;
    case 'journal':
      return arg.trim() ? null : `'${action}' has no note`;
  }
  return null;
}

/** What is wrong with the {templates} in a piece of text. */
function templateProblems(text: string): string[] {
  const out: string[] = [];
  for (const m of text.matchAll(/\{([^{}]*)\}/g)) {
    const t = m[1];
    if (TEMPLATES.has(t)) continue;
    if (t.startsWith('kills:')) {
      const kind = t.slice('kills:'.length);
      if (!isEnemy(kind)) out.push(`{${t}}: '${kind}' is not an enemy kind`);
    } else out.push(`unknown template {${t}}`);
  }
  if ((text.match(/\{/g) ?? []).length !== (text.match(/\}/g) ?? []).length) out.push('unbalanced braces');
  return out;
}

describe('dialogue books', () => {
  it('cover every NPC in NPC_DEFS', () => {
    const missing = NPC_DEFS.map((d) => d.id).filter((id) => !has(DIALOGUE, id));
    expect(missing, `NPCs without a dialogue book: ${missing.join(', ')}`).toEqual([]);
  });

  it('belong to real NPCs in real zones', () => {
    const problems: string[] = [];
    for (const [id, npc] of npcs) {
      if (id !== 'stone-head' && !NPC_IDS.has(id)) problems.push(`${id}: not an NPC_DEFS id`);
      if (npc.persona.id !== id) problems.push(`${id}: persona.id is '${npc.persona.id}'`);
      if (!isZone(npc.persona.district)) problems.push(`${id}: district '${npc.persona.district}' is not a zone`);
      for (const z of npc.persona.knows) if (!isZone(z)) problems.push(`${id}: knows '${z}', which is not a zone`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('give every line a unique id of the form <npcId>.<slot>.<name>', () => {
    const problems: string[] = [];
    for (const [id, npc] of npcs) {
      const seen = new Set<string>();
      for (const line of npc.lines) {
        if (seen.has(line.id)) problems.push(`${id}: line id '${line.id}' is used twice`);
        seen.add(line.id);
        const prefix = `${id}.${line.slot}.`;
        if (!line.id.startsWith(prefix) || line.id.length === prefix.length) problems.push(`${id}: line id '${line.id}' should start with '${prefix}'`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('have enough lines in every slot', () => {
    const problems: string[] = [];
    for (const [id, npc] of npcs) {
      for (const slot of Object.keys(SLOT_MIN) as Slot[]) {
        const n = npc.lines.filter((l) => l.slot === slot).length;
        if (n < SLOT_MIN[slot]) problems.push(`${id}: ${n} ${slot} lines, needs ${SLOT_MIN[slot]}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('keep lines short', () => {
    const problems: string[] = [];
    for (const [id, line] of allLines()) {
      const max = line.slot === 'bark' ? MAX_BARK : MAX_TEXT;
      if (line.text.length > max) problems.push(`${id}/${line.id}: ${line.text.length} chars, at most ${max}: "${line.text}"`);
      if (!line.text.trim()) problems.push(`${id}/${line.id}: empty text`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('refer only to known enemies, items and quests', () => {
    const problems: string[] = [];
    for (const [id, line] of allLines()) {
      for (const [where, c] of conds(line)) {
        const at = `${id}/${line.id} ${where}`;
        for (const key of ['enemy', 'bossSlain', 'bossAlive'] as const) {
          const kind = c[key];
          if (kind !== undefined && !isEnemy(kind)) problems.push(`${at}: ${key} '${kind}' is not an enemy kind`);
        }
        if (c.kills && !isEnemy(c.kills[0])) problems.push(`${at}: kills '${c.kills[0]}' is not an enemy kind`);
        for (const key of ['item', 'notItem'] as const) {
          const item = c[key];
          if (item !== undefined && !isItem(item)) problems.push(`${at}: ${key} '${item}' is not an item`);
        }
        if (c.quest && !isQuest(c.quest[0])) problems.push(`${at}: quest '${c.quest[0]}' is not a quest`);
        if (c.flag !== undefined && !isFlag(c.flag)) problems.push(`${at}: flag '${c.flag}' is not a flag`);
        if (c.notFlag !== undefined && !isFlag(c.notFlag)) problems.push(`${at}: notFlag '${c.notFlag}' is not a flag`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('use only the documented templates', () => {
    const problems: string[] = [];
    for (const [id, line] of allLines()) {
      for (const p of templateProblems(line.text)) problems.push(`${id}/${line.id}: ${p}`);
      for (const c of line.choices ?? []) for (const p of templateProblems(c.label)) problems.push(`${id}/${line.id} choice '${c.label}': ${p}`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('point every choice at a line of the same NPC', () => {
    const problems: string[] = [];
    for (const [id, npc] of npcs) {
      const ids = new Set(npc.lines.map((l) => l.id));
      for (const line of npc.lines) {
        for (const c of line.choices ?? []) {
          if (c.to !== undefined && !ids.has(c.to)) problems.push(`${id}/${line.id} choice '${c.label}': no line '${c.to}'`);
          if (c.to === undefined && c.action === undefined) problems.push(`${id}/${line.id} choice '${c.label}': neither to nor action`);
          if (!c.label.trim()) problems.push(`${id}/${line.id}: a choice has no label`);
        }
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('use only the documented actions', () => {
    const problems: string[] = [];
    for (const [id, line] of allLines()) {
      for (const c of line.choices ?? []) {
        if (c.action === undefined) continue;
        const p = actionProblem(c.action);
        if (p) problems.push(`${id}/${line.id} choice '${c.label}': ${p}`);
      }
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });

  it('play only recorded voices', () => {
    const problems: string[] = [];
    for (const [id, line] of allLines()) {
      if (line.voice !== undefined && !has(VOICES, line.voice)) problems.push(`${id}/${line.id}: voice '${line.voice}' is not in VOICES`);
    }
    expect(problems, problems.join('\n')).toEqual([]);
  });
});

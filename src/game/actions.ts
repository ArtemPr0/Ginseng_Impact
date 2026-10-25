/**
 * Choice actions: the strings in the dialogue books ('quest:throne:active', 'pay:60', 'give:signed-cup' ...) parsed
 * into a tagged union the integration can execute. The vocabulary is documented on `Action` in
 * src/data/dialogue/types.ts. Pure: no three.js, no DOM.
 */
export type Action =
  | { kind: 'close' }
  | { kind: 'trade' }
  | { kind: 'hire' }
  | { kind: 'home' }
  | { kind: 'quest'; id: string; stage: string }
  | { kind: 'pay'; n: number }
  | { kind: 'reward'; n: number }
  | { kind: 'give'; item: string }
  | { kind: 'take'; item: string }
  | { kind: 'flag'; flag: string }
  | { kind: 'journal'; text: string }
  | { kind: 'lick' }
  | { kind: 'ale' }
  | { kind: 'challenge' }
  | { kind: 'bag-croak' }
  | { kind: 'follow' };

/** The actions that take no argument. */
type Bare = 'close' | 'trade' | 'hire' | 'home' | 'lick' | 'ale' | 'challenge' | 'bag-croak' | 'follow';

const BARE = new Set<string>(['close', 'trade', 'hire', 'home', 'lick', 'ale', 'challenge', 'bag-croak', 'follow'] satisfies Bare[]);

/** A whole non-negative number of shards. */
function count(s: string | undefined): number | null {
  if (s === undefined || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
}

/** The action an id string names, or null when it is malformed or unknown. */
export function parseAction(s: string): Action | null {
  const id = s.trim();
  if (!id) return null;
  const sep = id.indexOf(':');
  const head = sep < 0 ? id : id.slice(0, sep);
  const rest = sep < 0 ? undefined : id.slice(sep + 1);
  if (BARE.has(head)) return rest === undefined ? { kind: head as Bare } : null;
  switch (head) {
    case 'quest': {
      const parts = rest?.split(':') ?? [];
      if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
      return { kind: 'quest', id: parts[0], stage: parts[1] };
    }
    case 'pay':
    case 'reward': {
      const n = count(rest);
      return n === null ? null : { kind: head, n };
    }
    case 'give':
    case 'take':
      return rest && !rest.includes(':') ? { kind: head, item: rest } : null;
    case 'flag':
      return rest && !rest.includes(':') ? { kind: 'flag', flag: rest } : null;
    case 'journal':
      // The note may itself contain colons.
      return rest ? { kind: 'journal', text: rest } : null;
    default:
      return null;
  }
}

/** The id string for an action (the inverse of `parseAction`). */
export function formatAction(a: Action): string {
  switch (a.kind) {
    case 'quest': return `quest:${a.id}:${a.stage}`;
    case 'pay': case 'reward': return `${a.kind}:${a.n}`;
    case 'give': case 'take': return `${a.kind}:${a.item}`;
    case 'flag': return `flag:${a.flag}`;
    case 'journal': return `journal:${a.text}`;
    default: return a.kind;
  }
}

/**
 * The game's event bus: one place every system announces what just happened (a kill, a hurt, a zone change, a
 * trade, a quest step, a feat), so NPC minds, the world state, the journal and the save can react without the
 * systems knowing about each other. Pure: no three.js, no DOM.
 */
export type Zone = 'island' | 'galaxy' | 'sunken' | 'treehouse' | 'dream' | 'graveyard' | 'vale' | 'tavern-room' | 'crypt-room';

export type HeroId = 'knight' | 'archer' | 'wizard';

/** Things the player does that are not kills or hurts but that people notice. */
export type Feat =
  | 'lick' | 'ale' | 'fountain' | 'skyeye' | 'carriage' | 'bounce' | 'fly' | 'swim' | 'dodge' | 'crit' | 'climb'
  | 'attack' | 'chest' | 'levelup' | 'sip';

export type GameEvent =
  | { kind: 'kill'; enemy: string; boss: boolean; at: { x: number; y: number; z: number } }
  | { kind: 'hurt'; amount: number; by: string }
  | { kind: 'down'; hero: HeroId }
  | { kind: 'wipe' }
  | { kind: 'zone'; zone: Zone; from: Zone }
  | { kind: 'hero'; hero: HeroId }
  | { kind: 'talk'; npc: string }
  | { kind: 'loot'; item: string; rarity: number }
  | { kind: 'trade'; what: 'buy' | 'sell' | 'equip' | 'hire' | 'dismiss'; item: string }
  | { kind: 'quest'; id: string; stage: string }
  | { kind: 'feat'; what: Feat; at?: { x: number; y: number; z: number } };

export type EventKind = GameEvent['kind'];
export type EventOf<K extends EventKind> = Extract<GameEvent, { kind: K }>;
export type Listener<K extends EventKind> = (e: EventOf<K>) => void;

export class Events {
  private readonly listeners = new Map<EventKind, Set<(e: GameEvent) => void>>();
  private readonly any = new Set<(e: GameEvent) => void>();

  /** Subscribes to one kind of event; returns the unsubscribe function. */
  on<K extends EventKind>(kind: K, fn: Listener<K>): () => void {
    let set = this.listeners.get(kind);
    if (!set) this.listeners.set(kind, (set = new Set()));
    const wrapped = fn as (e: GameEvent) => void;
    set.add(wrapped);
    return () => { set!.delete(wrapped); };
  }

  /** Subscribes to every event (the world state, the save's dirty flag). */
  onAny(fn: (e: GameEvent) => void): () => void {
    this.any.add(fn);
    return () => { this.any.delete(fn); };
  }

  /** Delivers to every listener; a listener that throws does not stop the others. */
  emit(e: GameEvent): void {
    const set = this.listeners.get(e.kind);
    if (set) for (const fn of Array.from(set)) { try { fn(e); } catch (err) { console.error('[events]', e.kind, err); } }
    for (const fn of Array.from(this.any)) { try { fn(e); } catch (err) { console.error('[events]', e.kind, err); } }
  }
}

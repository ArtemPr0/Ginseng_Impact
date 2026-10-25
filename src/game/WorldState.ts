/**
 * The world state: everything the NPC minds, the journal and the save need to know about what the player has done,
 * kept up to date from the event bus (src/game/Events.ts) and serialisable in one snapshot. Pure: no three.js, no
 * DOM. The integration feeds it the clock (`tick`), the purse, the level, the party and the bag; everything else
 * arrives as events.
 */
import type { EventKind, Events, Feat, GameEvent, HeroId, Zone } from './Events';
import type { Flag } from '../data/dialogue/types';
import { ITEMS } from '../items/Items';

/** One event as it happened: when, where, with which hero, and the event's own fields flattened into `data`. */
export interface EventRecord {
  kind: EventKind;
  t: number;
  zone: Zone;
  hero: HeroId;
  data: Record<string, string | number | boolean>;
}

/** What one NPC remembers of the player. */
export interface NpcMemory {
  /** Conversations so far (the 'talk' event). */
  met: number;
  lastMet: number;
  /** Line id → how often it was said and when last. */
  said: Record<string, { n: number; at: number }>;
  /** Reserved for the integration (−1..1); the selector does not read it yet. */
  mood: number;
}

export interface Visit { first: number; last: number; n: number }

/** The plain-data form of the state (JSON-safe). */
export interface WorldStateSnapshot {
  v: 1;
  time: number;
  zone: Zone;
  hero: HeroId;
  level: number;
  shards: number;
  kills: Record<string, number>;
  bossesSlain: Record<string, number>;
  deaths: number;
  wipes: number;
  damageTaken: number;
  lastHurtAt: number;
  lastHurtBy: string | null;
  dodges: number;
  crits: number;
  visited: Partial<Record<Zone, Visit>>;
  flags: string[];
  items: string[];
  companions: number;
  recent: EventRecord[];
  npc: Record<string, NpcMemory>;
  lastTalked: string | null;
}

/** How many recent events are kept (newest last). */
export const RECENT_RING = 24;
/** Seconds for an event's salience to fall to 1/e. */
export const SALIENCE_DECAY = 60;
/** "Never": far enough in the past that no `within` test can match it. */
export const NEVER = -1e9;

/** Feats that set a world flag (dodge only counts; attack is recorded only). */
const FEAT_FLAG: Partial<Record<Feat, Flag>> = {
  lick: 'licked', ale: 'ale', fountain: 'fountain', skyeye: 'skyeyes', carriage: 'carriage', bounce: 'bounce',
  fly: 'flew', swim: 'swam', climb: 'climbed', crit: 'crit', chest: 'chest', levelup: 'levelup', sip: 'sip',
};

/** The event as a record stamped with when and where it happened. */
export function recordOf(e: GameEvent, t: number, zone: Zone, hero: HeroId): EventRecord {
  const data: EventRecord['data'] = {};
  switch (e.kind) {
    case 'kill': data.enemy = e.enemy; data.boss = e.boss; data.x = e.at.x; data.y = e.at.y; data.z = e.at.z; break;
    case 'hurt': data.amount = e.amount; data.by = e.by; break;
    case 'down': data.hero = e.hero; break;
    case 'wipe': break;
    case 'zone': data.zone = e.zone; data.from = e.from; break;
    case 'hero': data.hero = e.hero; break;
    case 'talk': data.npc = e.npc; break;
    case 'loot': data.item = e.item; data.rarity = e.rarity; break;
    case 'trade': data.what = e.what; data.item = e.item; break;
    case 'quest': data.id = e.id; data.stage = e.stage; break;
    case 'feat': data.what = e.what; if (e.at) { data.x = e.at.x; data.y = e.at.y; data.z = e.at.z; } break;
  }
  return { kind: e.kind, t, zone, hero, data };
}

/** How much an event matters the moment it happens; `WorldState.salience` decays it. */
export function magnitude(e: EventRecord): number {
  switch (e.kind) {
    case 'kill': return e.data.boss === true ? 5 : 2;
    case 'hurt': return 1.5;
    case 'down': return 3;
    case 'wipe': return 4;
    case 'feat': return 1.5;
    case 'loot': return typeof e.data.rarity === 'number' && e.data.rarity >= 3 ? 2 : 0.5;
    case 'trade': return 0.5;
    case 'zone': return 0.5;
    case 'quest': return 2;
    case 'hero': return 0.5;
    case 'talk': return 0.25;
    default: return 0;
  }
}

function freshMemory(): NpcMemory {
  return { met: 0, lastMet: NEVER, said: {}, mood: 0 };
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export class WorldState {
  /** Game seconds, advanced by `tick`. */
  time = 0;
  zone: Zone = 'island';
  hero: HeroId = 'knight';
  level = 1;
  shards = 0;
  /** Enemy kind → kills. */
  kills: Record<string, number> = {};
  /** Boss kind → the time it was (last) slain. */
  bossesSlain: Record<string, number> = {};
  deaths = 0;
  wipes = 0;
  damageTaken = 0;
  lastHurtAt = NEVER;
  lastHurtBy: string | null = null;
  dodges = 0;
  crits = 0;
  visited: Partial<Record<Zone, Visit>> = {};
  flags = new Set<Flag | string>();
  /** Carried item ids, kept in sync by the integration via `setItems`. */
  items = new Set<string>();
  companions = 0;
  /** The last RECENT_RING events, newest last. */
  recent: EventRecord[] = [];
  npc: Record<string, NpcMemory> = {};
  lastTalked: string | null = null;

  private readonly off: (() => void) | null;

  constructor(events?: Events) {
    this.off = events ? events.onAny((e) => this.record(e)) : null;
  }

  /** Stops listening to the bus. */
  dispose(): void {
    this.off?.();
  }

  tick(dt: number): void {
    this.time += dt;
  }

  setItems(ids: Iterable<string>): void {
    this.items = new Set(ids);
  }

  setShards(n: number): void {
    this.shards = n;
  }

  setLevel(n: number): void {
    this.level = n;
  }

  setCompanions(n: number): void {
    this.companions = n;
  }

  /** The NPC's memory, created on first use. */
  memoryOf(npcId: string): NpcMemory {
    return this.npc[npcId] ?? (this.npc[npcId] = freshMemory());
  }

  /** What the bus subscription calls: folds the event into the counters and flags and keeps it in `recent`. */
  record(e: GameEvent): void {
    const t = this.time;
    switch (e.kind) {
      case 'kill':
        this.kills[e.enemy] = (this.kills[e.enemy] ?? 0) + 1;
        if (e.boss) this.bossesSlain[e.enemy] = t;
        break;
      case 'hurt':
        this.damageTaken += e.amount;
        this.lastHurtAt = t;
        this.lastHurtBy = e.by;
        break;
      case 'down':
        this.deaths++;
        break;
      case 'wipe':
        this.wipes++;
        this.flags.add('wiped');
        break;
      case 'zone': {
        const v = this.visited[e.zone];
        if (v) { v.last = t; v.n++; } else this.visited[e.zone] = { first: t, last: t, n: 1 };
        this.zone = e.zone;
        break;
      }
      case 'hero':
        this.hero = e.hero;
        break;
      case 'talk': {
        const m = this.memoryOf(e.npc);
        m.met++;
        m.lastMet = t;
        this.lastTalked = e.npc;
        break;
      }
      case 'loot':
        break;
      case 'trade':
        if (e.what === 'buy') this.flags.add('bought');
        else if (e.what === 'sell') this.flags.add('sold');
        else if (e.what === 'hire') this.flags.add('hired');
        else if (e.what === 'equip' && this.rarityOf(e.item) === 4) this.flags.add('equipped-mythic');
        break;
      case 'quest':
        break;
      case 'feat': {
        const flag = FEAT_FLAG[e.what];
        if (flag) this.flags.add(flag);
        if (e.what === 'dodge') this.dodges++;
        else if (e.what === 'crit') this.crits++;
        break;
      }
    }
    // Stamped after the fold, so a zone or hero change is recorded where (and as whom) the player now is.
    this.recent.push(recordOf(e, t, this.zone, this.hero));
    if (this.recent.length > RECENT_RING) this.recent.splice(0, this.recent.length - RECENT_RING);
  }

  /** The item's rarity from the table, or from the loot event that brought it (generated items). */
  private rarityOf(itemId: string): number {
    const def = ITEMS[itemId];
    if (def) return def.rarity;
    for (let i = this.recent.length - 1; i >= 0; i--) {
      const r = this.recent[i];
      if (r.kind === 'loot' && r.data.item === itemId && typeof r.data.rarity === 'number') return r.data.rarity;
    }
    return 0;
  }

  /** How much the event still matters at `now`: its magnitude decayed by e^−(age / 60 s). */
  salience(e: EventRecord, now: number = this.time): number {
    return magnitude(e) * Math.exp(-Math.max(0, now - e.t) / SALIENCE_DECAY);
  }

  snapshot(): WorldStateSnapshot {
    return {
      v: 1,
      time: this.time,
      zone: this.zone,
      hero: this.hero,
      level: this.level,
      shards: this.shards,
      kills: clone(this.kills),
      bossesSlain: clone(this.bossesSlain),
      deaths: this.deaths,
      wipes: this.wipes,
      damageTaken: this.damageTaken,
      lastHurtAt: this.lastHurtAt,
      lastHurtBy: this.lastHurtBy,
      dodges: this.dodges,
      crits: this.crits,
      visited: clone(this.visited),
      flags: Array.from(this.flags),
      items: Array.from(this.items),
      companions: this.companions,
      recent: clone(this.recent),
      npc: clone(this.npc),
      lastTalked: this.lastTalked,
    };
  }

  /** Replaces the state with a snapshot; missing fields (an older save) keep their defaults. */
  restore(s: Partial<WorldStateSnapshot>): void {
    const fresh = new WorldState();
    this.time = s.time ?? fresh.time;
    this.zone = s.zone ?? fresh.zone;
    this.hero = s.hero ?? fresh.hero;
    this.level = s.level ?? fresh.level;
    this.shards = s.shards ?? fresh.shards;
    this.kills = s.kills ? clone(s.kills) : {};
    this.bossesSlain = s.bossesSlain ? clone(s.bossesSlain) : {};
    this.deaths = s.deaths ?? 0;
    this.wipes = s.wipes ?? 0;
    this.damageTaken = s.damageTaken ?? 0;
    this.lastHurtAt = s.lastHurtAt ?? NEVER;
    this.lastHurtBy = s.lastHurtBy ?? null;
    this.dodges = s.dodges ?? 0;
    this.crits = s.crits ?? 0;
    this.visited = s.visited ? clone(s.visited) : {};
    this.flags = new Set(s.flags ?? []);
    this.items = new Set(s.items ?? []);
    this.companions = s.companions ?? 0;
    this.recent = s.recent ? clone(s.recent).slice(-RECENT_RING) : [];
    this.npc = {};
    for (const [id, m] of Object.entries(s.npc ?? {})) this.npc[id] = { ...freshMemory(), ...clone(m) };
    this.lastTalked = s.lastTalked ?? null;
  }
}

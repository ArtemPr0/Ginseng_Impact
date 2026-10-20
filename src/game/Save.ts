/**
 * The save file: one JSON document under one storage key, written when something changed and a minute has passed
 * (`tick`), or at once (`write`) at the moments that matter. Pure: no three.js, no DOM; the storage is handed in
 * (localStorage in the game, a Map in the tests).
 */
import type { Zone } from './Events';
import type { InvSnapshot } from '../items/Inventory';

export interface SaveV1 {
  v: 1;
  /** When it was written (ms since the epoch). */
  t: number;
  zone: Zone;
  pos: { x: number; y: number; z: number };
  yaw: number;
  /** The active hero. */
  hero: string;
  /** Each hero's HP by id. */
  hp: Record<string, number>;
  inventory: InvSnapshot;
  /** Quest id → stage (Quests.snapshot). */
  quests: Record<string, string>;
  /** Feats and flags set so far (WorldState). */
  flags: string[];
  /** WorldState snapshot, once it exists. */
  state?: unknown;
  progress: { xp: number; level: number };
  /** Bosses slain, by kind, with the time (ms) they fell: their respawn clocks pick up from there. */
  bosses: Record<string, { slainAt: number }>;
  /** Chest ids opened (data/chests). */
  chests: string[];
  /** Companion NPC ids hired. */
  companions: string[];
  newGamePlus: boolean;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const SAVE_KEY = 'ginseng.save.v1';
/** Seconds between autosaves. */
export const SAVE_INTERVAL = 60;

const ZONES: Record<Zone, true> = { island: true, galaxy: true, sunken: true, treehouse: true, dream: true, graveyard: true, vale: true, 'tavern-room': true, 'crypt-room': true };

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStrList = (v: unknown): v is string[] => Array.isArray(v) && v.every(isStr);
const isRecordOf = <T>(v: unknown, ok: (x: unknown) => x is T): v is Record<string, T> => isObj(v) && Object.values(v).every(ok);

function isInventory(v: unknown): v is InvSnapshot {
  if (!isObj(v) || !isNum(v.shards) || !Array.isArray(v.entries)) return false;
  return v.entries.every((e) => isObj(e) && isStr(e.itemId) && isNum(e.count)
    && (e.equippedBy === undefined || isStr(e.equippedBy)) && (e.charmOf === undefined || isStr(e.charmOf))
    && (e.affix === undefined || (isObj(e.affix) && isStr(e.affix.name))));
}

/** A version-1 document with every required field of the right shape, or null. */
function validateV1(raw: Record<string, unknown>): SaveV1 | null {
  const ok = raw.v === 1 && isNum(raw.t)
    && isStr(raw.zone) && ZONES[raw.zone as Zone] === true
    && isObj(raw.pos) && isNum(raw.pos.x) && isNum(raw.pos.y) && isNum(raw.pos.z)
    && isNum(raw.yaw) && isStr(raw.hero)
    && isRecordOf(raw.hp, isNum)
    && isInventory(raw.inventory)
    && isRecordOf(raw.quests, isStr)
    && isStrList(raw.flags)
    && isObj(raw.progress) && isNum(raw.progress.xp) && isNum(raw.progress.level)
    && isRecordOf(raw.bosses, (b): b is { slainAt: number } => isObj(b) && isNum(b.slainAt))
    && isStrList(raw.chests) && isStrList(raw.companions)
    && typeof raw.newGamePlus === 'boolean';
  return ok ? (raw as unknown as SaveV1) : null;
}

/** Brings a parsed document of any version up to the current one; null when it is not a save we can use. */
export function migrate(raw: unknown): SaveV1 | null {
  if (!isObj(raw)) return null;
  switch (raw.v) {
    case 1: return validateV1(raw);
    // Later versions convert here, oldest first, then fall into validateV1.
    default: return null;
  }
}

export class Save {
  private dirty = false;
  private clock = 0;
  private lastWrite = 0;

  constructor(private readonly storage: StorageLike, readonly key = SAVE_KEY) {}

  /** True when a usable save is stored (the title shows CONTINUE). */
  has(): boolean {
    return this.load() !== null;
  }

  /** The stored save, or null when there is none or it is malformed (never throws). */
  load(): SaveV1 | null {
    try {
      const text = this.storage.getItem(this.key);
      if (text === null) return null;
      return migrate(JSON.parse(text));
    } catch {
      return null;
    }
  }

  /**
   * Writes now (zone changes, quest steps, boss kills, chests) and resets the autosave clock. False when the storage
   * refused (full or denied): the save stays dirty, and the next tick past the interval tries again.
   */
  write(s: SaveV1): boolean {
    let ok = true;
    try { this.storage.setItem(this.key, JSON.stringify(s)); } catch { ok = false; }
    this.dirty = !ok;
    this.lastWrite = this.clock;
    return ok;
  }

  clear(): void {
    try { this.storage.removeItem(this.key); } catch { /* nothing to clear */ }
    this.dirty = false;
  }

  /** Something worth keeping changed: the next tick past the interval writes. */
  markDirty(): void {
    this.dirty = true;
  }

  /**
   * Advances the autosave clock; writes `snapshot()` when dirty and SAVE_INTERVAL seconds have passed since the last
   * write (or attempt). Returns whether it wrote.
   */
  tick(dt: number, snapshot: () => SaveV1): boolean {
    this.clock += Math.max(0, dt);
    if (!this.dirty || this.clock - this.lastWrite < SAVE_INTERVAL) return false;
    return this.write(snapshot());
  }
}

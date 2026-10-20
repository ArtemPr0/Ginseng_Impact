/**
 * Treasure chests at the points of interest, every one on real ground (the terrain or a realm's floor, outside the
 * buildings' footprints, clear of the NPCs' spots and the walkers' paths). Pure data: no three.js.
 *  - a hoard is the cracked coin block (coin-block.glb, DeOemU1BOZF) heaped with gold, glinting;
 *  - a cache is a barrel (barrel.glb) with a little put by;
 *  - a mimic looks like a hoard but is the bucket mob (data/enemies 'bucket') lying dormant until you reach for it.
 * `table` is a drop table like an enemy's (combat/Loot rollDrops), `shards` the Moon Shards inside, `respawn` the
 * seconds before an opened chest fills again.
 */
import type { Zone } from '../game/Events';

export type ChestKind = 'hoard' | 'cache' | 'mimic';

export interface ChestDef {
  id: string;
  zone: Zone;
  x: number;
  z: number;
  kind: ChestKind;
  table: Array<{ itemId: string; chance: number }>;
  shards: [number, number];
  respawn: number;
}

/** Seconds before an opened chest fills again. */
export const CHEST_RESPAWN = 900;

export const CHESTS: ChestDef[] = [
  // ----- The island -----
  // On the forest gorge's floor beside the stream, under the waterfall at its head (the troll keeps the far end).
  { id: 'gorge-head', zone: 'island', x: -67.5, z: -110, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [40, 100],
    table: [{ itemId: 'rune-shard', chance: 0.7 }, { itemId: 'wisp-ember', chance: 0.5 }, { itemId: 'troll-hide', chance: 0.2 }, { itemId: 'moon-dew', chance: 0.5 }, { itemId: 'troll-club', chance: 0.03 }] },
  // Before the cathedral's west front (its wall ends at x 48), off the river road.
  { id: 'cathedral-front', zone: 'island', x: 44, z: -18, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [40, 110],
    table: [{ itemId: 'wisp-ember', chance: 0.7 }, { itemId: 'rune-shard', chance: 0.5 }, { itemId: 'shade-horn', chance: 0.12 }, { itemId: 'lotus-tea', chance: 0.4 }, { itemId: 'horn-staff', chance: 0.03 }] },
  // The Frost March: in the snow north of the chasm, between the broken column and the colossus's shore.
  { id: 'frost-march', zone: 'island', x: 92, z: -88, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [50, 120],
    table: [{ itemId: 'wisp-ember', chance: 0.6 }, { itemId: 'yeti-pelt', chance: 0.15 }, { itemId: 'rot-salve', chance: 0.3 }, { itemId: 'moon-dew', chance: 0.4 }, { itemId: 'glacier-maul', chance: 0.03 }] },
  // The castle terrace, east of the gate and the Antlered King's throne (the south wall ends at z 1).
  { id: 'castle-terrace', zone: 'island', x: -84, z: 5, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [40, 100],
    table: [{ itemId: 'sentinel-core', chance: 0.3 }, { itemId: 'rune-shard', chance: 0.6 }, { itemId: 'lotus-tea', chance: 0.4 }, { itemId: 'moon-dew', chance: 0.4 }, { itemId: 'crown-blade', chance: 0.05 }] },
  // Past the world tree's roots on the north side (they end at z -117), away from the graves and the priest.
  { id: 'world-tree', zone: 'island', x: 44, z: -122, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [40, 110],
    table: [{ itemId: 'rune-shard', chance: 0.8 }, { itemId: 'wisp-ember', chance: 0.5 }, { itemId: 'rot-salve', chance: 0.3 }, { itemId: 'moon-dew', chance: 0.4 }, { itemId: 'warden-bough', chance: 0.03 }] },
  // The ruined arch in the dead wood east of the causeway's end.
  { id: 'ruin-north', zone: 'island', x: 12, z: -99, kind: 'cache', respawn: CHEST_RESPAWN, shards: [15, 35],
    table: [{ itemId: 'old-bone', chance: 0.6 }, { itemId: 'wisp-ember', chance: 0.6 }, { itemId: 'moon-dew', chance: 0.4 }, { itemId: 'travelers-blade', chance: 0.08 }] },
  // The broken column on the Frost March's edge, west of the yeti's grove.
  { id: 'ruin-east', zone: 'island', x: 76, z: -88, kind: 'cache', respawn: CHEST_RESPAWN, shards: [15, 40],
    table: [{ itemId: 'beast-fang', chance: 0.5 }, { itemId: 'rune-shard', chance: 0.6 }, { itemId: 'lotus-tea', chance: 0.4 }, { itemId: 'hunters-bow', chance: 0.08 }] },
  // A hoard half-buried in the dunes south of the desert's crystal golems: the bucket under the gold.
  { id: 'desert-mimic', zone: 'island', x: 56, z: 48, kind: 'mimic', respawn: CHEST_RESPAWN, shards: [40, 100],
    table: [{ itemId: 'sentinel-core', chance: 0.35 }, { itemId: 'croc-hide', chance: 0.5 }, { itemId: 'rot-salve', chance: 0.3 }, { itemId: 'witch-staff', chance: 0.06 }] },
  // ----- Yung Lean's kingdom -----
  // The Skeleton Court's treasury, among the coin blocks of its west wing (the galaxy knights guard it).
  { id: 'court-treasury', zone: 'galaxy', x: 957, z: -154, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [60, 120],
    table: [{ itemId: 'sentinel-core', chance: 0.4 }, { itemId: 'rune-shard', chance: 0.6 }, { itemId: 'rot-salve', chance: 0.4 }, { itemId: 'lotus-tea', chance: 0.4 }, { itemId: 'crown-blade', chance: 0.06 }] },
  // In the snow among the graves west of the chapel.
  { id: 'chapel-graves', zone: 'galaxy', x: 884, z: 150, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [40, 100],
    table: [{ itemId: 'old-bone', chance: 0.7 }, { itemId: 'wisp-ember', chance: 0.5 }, { itemId: 'rot-salve', chance: 0.3 }, { itemId: 'moon-dew', chance: 0.4 }, { itemId: 'tide-blade', chance: 0.03 }] },
  // Bucket Street: one more bucket among the buckets, at the head of the street by the first purple house.
  { id: 'street-mimic', zone: 'galaxy', x: 900, z: 10, kind: 'mimic', respawn: CHEST_RESPAWN, shards: [40, 100],
    table: [{ itemId: 'lotus-tea', chance: 0.5 }, { itemId: 'rune-shard', chance: 0.5 }, { itemId: 'wisp-ember', chance: 0.5 }, { itemId: 'witch-staff', chance: 0.06 }] },
  // ----- The Sunken City -----
  // The square before the sea castle's gate, between the long tables of goblets.
  { id: 'sunken-square', zone: 'sunken', x: -1000, z: -52, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [50, 120],
    table: [{ itemId: 'croc-hide', chance: 0.5 }, { itemId: 'river-pearl', chance: 0.2 }, { itemId: 'moon-dew', chance: 0.5 }, { itemId: 'rot-salve', chance: 0.3 }, { itemId: 'tide-blade', chance: 0.04 }] },
  // ----- The Dragon's Vale -----
  // On the grass beside the cobbled path from the stone bridge, at the foot of the crowned head's hill.
  { id: 'vale-hill', zone: 'vale', x: 936, z: 937, kind: 'cache', respawn: CHEST_RESPAWN, shards: [15, 40],
    table: [{ itemId: 'lotus-tea', chance: 0.5 }, { itemId: 'beast-fang', chance: 0.5 }, { itemId: 'old-bone', chance: 0.4 }, { itemId: 'hunters-bow', chance: 0.08 }] },
  // ----- The Alley of Graves -----
  // In the alley just past the candle shrine, on the way to the cyclops.
  { id: 'grave-shrine', zone: 'graveyard', x: 0, z: -984, kind: 'hoard', respawn: CHEST_RESPAWN, shards: [40, 110],
    table: [{ itemId: 'old-bone', chance: 0.7 }, { itemId: 'shade-horn', chance: 0.1 }, { itemId: 'rot-salve', chance: 0.4 }, { itemId: 'wisp-ember', chance: 0.4 }, { itemId: 'horn-staff', chance: 0.03 }] },
];

export function chestById(id: string): ChestDef | undefined {
  return CHESTS.find((c) => c.id === id);
}

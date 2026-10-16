/** Placement of everything in the first area. Units are metres; the causeway runs north (−z) along x = 0. */
export const LAYOUT = {
  spawn: { x: 0, z: 59 },
  /** The rope bridge over the chasm, west of the cathedral: south end on the rim, north end by the dead wood. */
  chasmBridge: { ax: 26, az: -38, bx: 27, bz: -84 },
  /**
   * Footpaths worn into the ground (Terrain colours them; nothing grows on them). They tie the spawn to the village,
   * the tavern, the bridges, the portals and every landmark, and keep clear of the mobs' camps.
   */
  paths: [
    [[0, 64], [-8, 70], [-58, 70]],
    [[2, 64], [14, 69], [32, 70], [46, 62], [56, 58]],
    [[-4, 60], [-18, 56], [-34, 50], [-48, 40], [-56, 22], [-56, 9]],
    [[-78, 9], [-90, -2], [-96, -12]],
    [[6, 58], [16, 44], [34, 34], [52, 32], [66, 30], [80, 36]],
    [[-6, 56], [-6, 46]],
    // The flagstone road from the spawn to the wooden bridge over the eye (the reference shot, #28).
    [[0, 58], [0, 32]],
    // From the hamlet on the far bank to the pond and the frog hollow, and east to the rope bridge.
    [[0, -2], [-10, -4], [-14, -6], [-30, -10], [-43, -17]],
    [[2, -5], [6, -10], [18, -18], [30, -24], [34, -24]],
    [[22, -20], [26, -36]],
    [[0, -134], [0, -140]],
    [[-2, -112], [-12, -108]],
    [[27, -86], [44, -90], [52, -90]],
    [[-4, -96], [-16, -88], [-36, -88]],
    // Into the forest gorge, over its stone bridge and on to the overlook.
    [[-4, -114], [-24, -116], [-42, -120], [-51, -124]],
    [[-77, -124], [-86, -116]],
  ] as Array<Array<[number, number]>>,
  /** The raised road starts on the eye's north bank (its stairs climb from the hamlet) and runs over the chasm. */
  // (yEnd: four 0.45 m risers between its spans, each low enough to walk up; 1 m ledges stopped the hero.)
  causeway: { x: 0, zStart: -10, zEnd: -115, width: 6, yStart: 6, yEnd: 7.8, postSpacing: 8, segmentLength: 24.7 },
  head: { x: 0, z: -146, height: 26 },
  /** The cathedral's long axis runs east–west; its west front faces the river road. */
  cathedral: { x: 64, z: -24, yaw: Math.PI / 2 },
  /** The mud pool east of the cathedral, home of the Marsh Sovereign: a basin (PADS) filled to `mud` (world y). */
  floodedRuin: { x: 106, z: -13, r: 9, mud: 4.9 },
  forest: { innerRadius: 72, outerRadius: 119, count: 420 },
  flowerMeadows: [
    // The white meadow the horse rider crosses (the whale reel's field of white flowers, DeSEl9PvPG_).
    { x: 28, z: 46, r: 16, count: 600, white: true },
    { x: -24, z: -12, r: 17, count: 180, white: false },
    { x: 54, z: -72, r: 16, count: 150, white: false },
  ],
  sunflowerFields: [
    { x: -42, z: 26, r: 19, count: 190 },
    { x: 44, z: 55, r: 15, count: 140 },
    { x: -43, z: -19, r: 11, count: 100 },
  ],
  frog: { x: -54, z: -26 },
  coven: { streamX: -67, zMin: -42, zMax: 48, bridgeZ: 9 },
  /**
   * On the plateau north-west of the chasm, its whole rock base on land (castle.glb is 29 × 31 m: at z = -24 its north
   * wall hung over the chasm's cliff, which begins around z = -34).
   */
  castle: { x: -94, z: -12, yaw: 0 },
  /** The Antlered King's throne before the castle gate, facing the road south. */
  throne: { x: -94, z: 8 },
  church: { x: -66, z: 57 },
  /** The wizard's lonely tower on the east cliffs, where the Moon Wyrm circles. */
  tower: { x: 93, z: 42 },
  treehouse: { x: -90, z: 30 },
  orchard: { x: 60, z: 24 },
  rainZone: { x: 60, z: 24, radius: 30 },
  snowZone: { x: 72, z: -48, radius: 40 },
  frozenRect: { xFrom: 33, xTo: 114, zFrom: -105, zTo: -18 },
  /** The moon-shell colossus crawls the east shore, outside every building. */
  colossusPath: [[84, -90], [90, -110], [84, -130], [90, -110]] as Array<[number, number]>,
  /** The world tree west of the causeway's north end (its roots must not cross the road). */
  worldTree: { x: 44, z: -104 },
  /** Walkers that roam among the buildings without touching them. */
  logGiantPath: [[-38, 30], [-46, 26], [-52, 32], [-46, 26]] as Array<[number, number]>,
  /** Pim's observatory north of the village, clear of the houses. */
  observatory: { x: -46, z: 48 },
  riderPath: [[8, 48], [24, 48], [40, 42], [24, 48]] as Array<[number, number]>,
  ruins: [
    { x: -8, z: 43, yaw: 0.3, arch: true }, { x: 20, z: 24, yaw: -0.4, arch: false }, { x: -2, z: -21, yaw: 0.9, arch: false },
    { x: 8, z: -96, yaw: 0.2, arch: true }, { x: 31, z: -28, yaw: 1.1, arch: true }, { x: 80, z: -84, yaw: -0.7, arch: false },
    { x: -24, z: 60, yaw: 0.5, arch: false }, { x: 36, z: -78, yaw: 0.0, arch: false },
  ],
  cloudSea: { y: -26 },
  /**
   * Three koi pools stepping down toward the eye, each spilling into the next (the whale reel's tiered pond,
   * DeSEl9PvPG_): centre, radius and water level (world y).
   */
  tiers: [
    { x: -12, z: 32, r: 6, water: 1.6 },
    { x: -22, z: 35, r: 5.5, water: 4.0 },
    { x: -31, z: 38, r: 5, water: 6.4 },
  ],
  /** The hamlet on the eye's north bank, around the causeway stairs: [x, z, yaw]. */
  hamlet: [[7, -6, 0], [15, -5, 0.1], [24, -5, -0.08], [8, -18, 0.3], [26, -14, -0.3], [-8, -5, 0]] as ReadonlyArray<readonly [number, number, number]>,
} as const;

/**
 * Village street centre and its house slots: [dx, dz, width, depth, rotY]. The street runs east–west at z = 70;
 * the north row faces south onto it, the south row faces north (the island's edge is just behind it).
 */
export const VILLAGE = {
  x: -34, z: 70,
  houses: [
    [-18, -6, 6, 5, 0.04], [-6, -6, 5, 5, -0.06], [6, -6, 7, 5, 0.03], [18, -6, 5, 6, 0.08],
    [-14, 6, 6, 5, Math.PI + 0.05], [-2, 6, 5, 5, Math.PI - 0.06], [10, 6, 7, 5, Math.PI + 0.02], [22, 6, 5, 5, Math.PI - 0.08],
  ] as ReadonlyArray<readonly [number, number, number, number, number]>,
  /** Torch posts on both edges of the street, in the gaps between the houses. */
  torches: [[-24, -2.8], [-12, -2.8], [0, -2.8], [12, -2.8], [24, -2.8], [-20, 2.8], [-8, 2.8], [4, 2.8], [16, 2.8], [28, 2.8]] as ReadonlyArray<readonly [number, number]>,
} as const;

/**
 * Where each standing/sitting NPC lives (world metres). `dy` lifts a seated pose onto its seat; `y` pins an
 * absolute height (a balcony perch). Loop NPCs start at the first point of their path instead.
 */
export const ANCHORS: Record<string, { x: number; z: number; dy?: number; y?: number }> = {
  aldous: { x: 18.4, z: 68.2, dy: 0.5 }, mirren: { x: 21.6, z: 68.2, dy: 0.5 },
  'gob-a': { x: 21.2, z: 66.8, dy: 0.5 }, 'gob-b': { x: 23.0, z: 66.0, dy: 0.5 },
  // Seated on barrels around the campfire at (-24, 52); `seat` is the barrel under each.
  rattle: { x: -21.6, z: 53.4, dy: 0.02 }, bone: { x: -26.4, z: 53.4, dy: 0.02 }, marrow: { x: -24, z: 49.2, dy: 0.02 },
  vigil: { x: 32, z: 69 },
  pim: { x: -46, z: 53.5 },
  king: { x: -94, z: 8 },
  // Hidden in the castle's shadow, off its west wall, far from his father (he likes the shady places).
  croak: { x: -112, z: 2 },
  frogking: { x: -54, z: -26 },
  cook: { x: 25.6, z: 77 },
  moss: { x: -56, z: 19, dy: 0.02 },
  sentry: { x: -40, z: -90, dy: 0.02 },
  standard: { x: -54, z: -93 },
  'rose-knight': { x: 16, z: 34 }, maiden: { x: 18.2, z: 33 },
  // Dunmar guards the door of Yung Lean's hall; Sel watches the street of purple houses (both in the kingdom).
  'watcher-knight': { x: 1000, z: -51.8 }, 'watcher-mage': { x: 994, z: 21 },
  'cup-gnome': { x: 6.5, z: 64 },
  // Fifth batch of reels.
  // (Beside the middle tavern table, not inside it: the table at (-40, -24) is solid once its model exists.)
  grumble: { x: -40, z: -22 },
  priest: { x: 36, z: -96 },
  'lantern-witch': { x: -106, z: 14 },
  'skeleton-king': { x: 965, z: -57, dy: 0.6 },
  'skeleton-wizard': { x: 948, z: 20 },
  'galaxy-wizard': { x: 952, z: -20 },
  yunglean: { x: 1000, z: -74.6, dy: 0.8 },
  'void-monk': { x: 1008, z: 66 },
  // Behind their stalls between the purple houses of the bucket street (Realms.ts places the stalls).
  'market-a': { x: 972, z: 10.4 }, 'market-b': { x: 956, z: 29.6 },
  'fish-king': { x: -1000, z: -10 },
};

/**
 * Realms beyond the island, reached through portals. They float far out over the cloud sea on their own floors,
 * so they never overlap the island's terrain. `fog` replaces the island fog while the player is inside.
 */
export interface RealmDef {
  id: string;
  name: string;
  x: number;
  z: number;
  /** Walk surface height. */
  y: number;
  /** Half extent of the realm, for "is the player inside". */
  radius: number;
  fog: { color: number; density: number };
  /** Bubbles and murk (the sunken city). */
  underwater?: boolean;
  /** The fog colour cycles through the hues (the frog's dream). */
  cycle?: boolean;
  /** Has its own sky dome: the island's moon, stars and aurora are switched off there. */
  ownSky?: boolean;
}

/** The galaxy city beyond the portal (DeOemU1BOZF, DeaqHWJBBPw, DeXn5rSPxR8, DeQ-NnpvqF6, Dd0wR9Jh2lH, DdyN2PNyIxb, DdnJDwBMUoj). */
/** Beyond the portal: Yung Lean's kingdom (it was the galaxy city; the id stays). */
export const GALAXY: RealmDef = { id: 'galaxy', name: "Yung Lean's Kingdom", x: 1000, z: 0, y: 24, radius: 190, fog: { color: 0x3a1a52, density: 0.0055 }, ownSky: true };
/** The sunken city under the lake (DeVj-Z8POjl). */
export const SUNKEN: RealmDef = { id: 'sunken', name: 'The Sunken City', x: -1000, z: 0, y: -48, radius: 90, fog: { color: 0x07304a, density: 0.034 }, underwater: true };
/** The round room inside the tree house trunk (Goldgrin's brother). */
/** (Its own sky: the trunk is open at the top, and above the room there is only the dark of the hollow, no moon.) */
export const TREEHOUSE_ROOM: RealmDef = { id: 'treehouse', name: 'Inside the Tree House', x: -1000, z: 700, y: 0, radius: 30, fog: { color: 0x120a26, density: 0.02 }, ownSky: true };
/** The Frog King's dream: two minutes you cannot leave (licking a DMT frog). */
export const DREAM: RealmDef = { id: 'dream', name: "The Frog King's Dream", x: 0, z: 2600, y: 0, radius: 170, fog: { color: 0x3a0f6b, density: 0.0035 }, cycle: true, ownSky: true };
/**
 * The Alley of Graves behind the demon church's door (01.16.54): purple fog, amber storm clouds (the island sky's
 * 'graveyard' preset, so not its own dome), the cyclops at the far end.
 */
export const GRAVEYARD: RealmDef = { id: 'graveyard', name: 'The Alley of Graves', x: 0, z: -1000, y: 0, radius: 125, fog: { color: 0x2a1446, density: 0.014 } };
export const REALMS: readonly RealmDef[] = [GALAXY, SUNKEN, TREEHOUSE_ROOM, DREAM, GRAVEYARD];

/** Portal ends on the island. */
export const ISLAND_PORTALS = {
  /** The swirling portal at the end of the stepping stones by the face tree (DeQ-NnpvqF6). */
  galaxy: { x: -56, z: -10, faceTree: { x: -47, z: -2 } },
  /** The whirlpool in the lily pond: the way down to the sunken city. */
  pond: { x: -18, z: -18, shore: { x: -3, z: -18 } },
} as const;

/**
 * Level ground pads: the terrain inside `r` is flattened to `y`, blending back over `blend` metres. Where buildings and
 * big creatures stand. `solid` pads are land even where the island would end (only under the castle).
 */
export const PADS: ReadonlyArray<{ x: number; z: number; r: number; y: number; blend: number; solid?: boolean }> = [
  { x: -94, z: -12, r: 21, y: 4.4, blend: 8, solid: true }, // castle (its whole rock base) and its terrace
  { x: -94, z: 8, r: 6, y: 4.4, blend: 5 },
  { x: 68, z: 38, r: 13, y: 2.5, blend: 8 },      // the Antlered Warden's clearing in the east forest
  { x: 44, z: -104, r: 17, y: 1.2, blend: 8 },    // the world tree
  { x: 66, z: -130, r: 13, y: 0.8, blend: 8 },    // the Horned Shade's drowned stones
  { x: -54, z: -26, r: 6, y: 1.8, blend: 5 },     // the Frog King's hollow
  { x: -112, z: 2, r: 3, y: 4.4, blend: 4 },      // Brother Croak hiding in the castle's shadow
  { x: -54, z: -93, r: 2.2, y: 61.0, blend: 3 },  // Hollow Jack on the peak's summit, his banner over the island
  { x: 16, z: -122, r: 7, y: 4.6, blend: 5 },     // the Ember Rider
  { x: 106, z: -13, r: 8, y: 3.4, blend: 4 },     // the Marsh Sovereign's mud basin (filled to 4.9)
  { x: -40, z: -90, r: 1.6, y: 28.4, blend: 2.5 }, // Sir Halvard's seat on the cliff
  { x: -56, z: 19, r: 2, y: 1.5, blend: 2.5 },     // Old Moss fishing from the bank (above the river's waterline)
  { x: -8, z: -5, r: 4, y: 2.8, blend: 3 },       // the hamlet's west house on the eye's bank
];

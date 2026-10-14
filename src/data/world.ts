/** Placement of everything in the first area. Units are metres; the causeway runs north (−z) along x = 0. */
export const LAYOUT = {
  spawn: { x: 0, z: 59 },
  causeway: { x: 0, zStart: 62, zEnd: -115, width: 6, yStart: 6, yEnd: 11, postSpacing: 8, segmentLength: 24.7 },
  head: { x: 0, z: -139, height: 52 },
  cathedral: { x: 76, z: -28 },
  forest: { innerRadius: 72, outerRadius: 119, count: 420 },
  flowerMeadows: [
    { x: 24, z: 42, r: 20, count: 220 },
    { x: -24, z: -12, r: 17, count: 180 },
    { x: 54, z: -72, r: 16, count: 150 },
  ],
  sunflowerFields: [
    { x: -42, z: 26, r: 19, count: 190 },
    { x: 44, z: 55, r: 15, count: 140 },
    { x: -43, z: -19, r: 11, count: 100 },
  ],
  frog: { x: -52, z: -32 },
  coven: { streamX: -67, zMin: -42, zMax: 48, bridgeZ: 9 },
  castle: { x: -99, z: -42 },
  orchard: { x: 60, z: 24 },
  rainZone: { x: 60, z: 24, radius: 30 },
  snowZone: { x: 72, z: -48, radius: 40 },
  frozenRect: { xFrom: 33, xTo: 114, zFrom: -105, zTo: -18 },
  colossusPath: [[99, -90], [107, -54], [103, -18], [96, 18], [84, 54], [90, 24], [99, -24], [102, -66]] as Array<[number, number]>,
  ruins: [
    { x: -8, z: 43, yaw: 0.3, arch: true }, { x: 9, z: 20, yaw: -0.4, arch: false }, { x: -9, z: -13, yaw: 0.9, arch: false },
    { x: 10, z: -90, yaw: 0.2, arch: true }, { x: 49, z: -37, yaw: 1.1, arch: true }, { x: 58, z: -59, yaw: -0.7, arch: false },
    { x: -24, z: 60, yaw: 0.5, arch: false }, { x: 36, z: -78, yaw: 0.0, arch: false },
  ],
  waterfalls: [
    { x: -20, z: -44, width: 9, height: 72 },
    { x: 23, z: -70, width: 7, height: 72 },
  ],
  cloudSea: { y: -26 },
} as const;

/** Village street centre and its nine house slots: [dx, dz, width, depth, rotY]. */
export const VILLAGE = {
  x: -33, z: 76,
  houses: [
    [-26, -9, 6, 5, 0.05], [-14, -10, 5, 5, -0.08], [-2, -9, 7, 5, 0.03], [10, -10, 5, 6, 0.1], [22, -9, 6, 5, -0.05],
    [-22, 11, 6, 5, Math.PI + 0.05], [-8, 12, 5, 5, Math.PI - 0.06], [6, 11, 7, 5, Math.PI + 0.02], [20, 12, 5, 5, Math.PI - 0.1],
  ] as ReadonlyArray<readonly [number, number, number, number, number]>,
  /** Torch posts along the street. */
  torches: [[-28, -4], [-18, -4], [-8, -4], [2, -4], [12, -4], [22, -4], [-24, 6], [-10, 6], [8, 6], [20, 6]] as ReadonlyArray<readonly [number, number]>,
} as const;

/**
 * Where each standing/sitting NPC lives (world metres). `dy` lifts a seated pose onto its seat; `y` pins an
 * absolute height (a balcony perch). Loop NPCs start at the first point of their path instead.
 */
export const ANCHORS: Record<string, { x: number; z: number; dy?: number; y?: number }> = {
  aldous: { x: 18.4, z: 68.2, dy: 0.5 }, mirren: { x: 21.6, z: 68.2, dy: 0.5 },
  'gob-a': { x: 21.2, z: 66.8, dy: 0.5 }, 'gob-b': { x: 23.0, z: 66.0, dy: 0.5 },
  rattle: { x: -21.9, z: 53.2, dy: 0.5 }, bone: { x: -26.1, z: 53.3, dy: 0.5 }, marrow: { x: -24.1, z: 49.6, dy: 0.5 },
  vigil: { x: 32, z: 69 },
  pim: { x: -44, z: 64.2 },
  king: { x: -99, z: -32.2, dy: 1.2 },
  croak: { x: -2, z: -22, dy: 0.5 },
  cook: { x: 25.6, z: 77 },
  moss: { x: -58, z: 19, dy: 0.5 },
  sentry: { x: -40, z: -90, dy: 0.5 },
  standard: { x: -54, z: -93 },
  'rose-knight': { x: 16, z: 34 }, maiden: { x: 18.2, z: 33 },
  'watcher-knight': { x: -18, z: -43 }, 'watcher-mage': { x: -15, z: -44 },
  // Fifth batch of reels.
  grumble: { x: -40, z: -24, dy: 1.0 },
  priest: { x: -9, z: -96 },
  'lantern-witch': { x: -114, z: 16 },
  'skeleton-lord': { x: 1033, z: -55, dy: 0.5 }, 'blue-knight': { x: 1037, z: -55, dy: 0.5 },
  'skeleton-king': { x: 965, z: -57, dy: 0.6 },
  'skeleton-wizard': { x: 948, z: 20 },
  'galaxy-wizard': { x: 952, z: -20 },
  'galaxy-king': { x: 1000, z: -74, dy: 0.8 },
  'void-monk': { x: 1008, z: 66 },
  'market-a': { x: 1137, z: 11 }, 'market-b': { x: 1143, z: 19 },
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
}

/** The galaxy city beyond the portal (DeOemU1BOZF, DeaqHWJBBPw, DeXn5rSPxR8, DeQ-NnpvqF6, Dd0wR9Jh2lH, DdyN2PNyIxb, DdnJDwBMUoj). */
export const GALAXY: RealmDef = { id: 'galaxy', name: 'The Galaxy City', x: 1000, z: 0, y: 24, radius: 190, fog: { color: 0x1d1650, density: 0.0075 } };
/** The sunken city under the lake (DeVj-Z8POjl). */
export const SUNKEN: RealmDef = { id: 'sunken', name: 'The Sunken City', x: -1000, z: 0, y: -48, radius: 90, fog: { color: 0x07304a, density: 0.034 }, underwater: true };
export const REALMS: readonly RealmDef[] = [GALAXY, SUNKEN];

/** Portal ends on the island. */
export const ISLAND_PORTALS = {
  /** The swirling portal at the end of the stepping stones by the face tree (DeQ-NnpvqF6). */
  galaxy: { x: -56, z: -10, faceTree: { x: -47, z: -2 } },
  /** The whirlpool in the lily pond: the way down to the sunken city. */
  pond: { x: -18, z: -18, shore: { x: -3, z: -18 } },
} as const;

import type { Zone } from '../game/Events';

/** Placement of everything in the first area. Units are metres; the causeway runs north (−z) along x = 0. */
export const LAYOUT = {
  spawn: { x: 0, z: 59 },
  /** The rope bridge over the chasm, west of the cathedral: south end on the rim, north end by the dead wood. */
  // (Its south end on the rim at z -32.5: at -38 the last 4 m hung over the chasm; the deck is a chain span, so both
  // ends sit on their own bank.)
  chasmBridge: { ax: 26, az: -32.5, bx: 27, bz: -85 },
  /**
   * Footpaths worn into the ground (Terrain colours them; nothing grows on them). They tie the spawn to the village,
   * the tavern, the bridges, the portals and every landmark, and keep clear of the mobs' camps.
   */
  paths: [
    [[0, 64], [-8, 70], [-58, 70]],
    [[2, 64], [14, 69], [32, 70], [46, 62], [56, 58]],
    // From the village corner up the river's south bank to the witches' bridge (it used to ford the channel).
    [[-4, 60], [-18, 56], [-34, 50], [-48, 40], [-54, 32]],
    // From the face tree's stepping stones down to the bridge's east foot.
    [[-53, -8], [-56, 9]],
    [[-78, 9], [-90, -2], [-96, -12]],
    [[6, 58], [16, 44], [34, 34], [52, 32], [66, 30], [80, 36]],
    [[-6, 56], [-6, 46]],
    // The flagstone road from the spawn to the wooden bridge over the eye (the reference shot, #28).
    [[0, 58], [0, 32]],
    // From the hamlet on the far bank to the pond and the frog hollow, and east to the rope bridge.
    [[0, -2], [-10, -4], [-14, -6], [-30, -10], [-43, -17]],
    [[2, -5], [6, -10], [18, -18], [30, -24], [34, -24]],
    [[22, -20], [26, -32.5]],
    // The road over the chasm: up from the hamlet to the causeway's south rim, and on from its north rim to the head.
    [[0, -4], [0, -30]],
    [[0, -82], [0, -92], [-4, -96]],
    [[0, -134], [0, -140]],
    [[-2, -112], [-12, -108]],
    [[27, -86], [44, -90], [52, -90]],
    [[-4, -96], [-16, -88], [-36, -88]],
    // Into the forest gorge, over its stone bridge and on to the overlook.
    [[-4, -114], [-24, -116], [-42, -120], [-51, -124]],
    [[-77, -124], [-86, -116]],
  ] as Array<Array<[number, number]>>,
  /** The causeway: one stone bridge over the chasm, rim to rim (z -34 and -79), its deck 0.25 m over the ground at each end. */
  causeway: { x: 0, zStart: -30, zEnd: -82, width: 6, yStart: 4.45, yEnd: 3.45 },
  head: { x: 0, z: -146, height: 26 },
  /**
   * The cathedral's long axis runs east–west; its west front faces the river road. Between the chasm and the river
   * there is 34 m of ground: at full size its south aisle hung 80 m over the chasm, so it stands at 0.7 (38 m) where
   * all of it is on land (overhang audit), its feet at y (the ground's 5th percentile under it).
   */
  // (At 0.65 and z -17 its south feet clear the river's bank and its north wall the chasm's lip, which 0.7 did not.)
  cathedral: { x: 68, z: -17, yaw: Math.PI / 2, scale: 0.65, y: 3.6 },
  /** The mud pool east of the cathedral, home of the Marsh Sovereign: a basin (PADS) filled to `mud` (world y). */
  floodedRuin: { x: 106, z: -13, r: 8, mud: 3.3 },
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
  coven: { streamX: -67, zMin: -42, zMax: 40, bridgeZ: 9 },
  /**
   * On the plateau north-west of the chasm, its whole rock base on land (castle.glb is 29 × 31 m: at z = -24 its north
   * wall hung over the chasm's cliff, which begins around z = -34).
   */
  castle: { x: -94, z: -12, yaw: 0 },
  /** The Antlered King's throne before the castle gate, facing the road south. */
  throne: { x: -94, z: 8 },
  church: { x: -66, z: 57 },
  /** The wizard's lonely tower on the east cliffs, where the Moon Wyrm circles (back from the edge: at (93, 42) a third of its rock hung over the drop). */
  tower: { x: 83, z: 32 },
  /** (4 m in from the west cliff: at -90 its rock hung over the drop.) */
  treehouse: { x: -86, z: 30 },
  orchard: { x: 60, z: 24 },
  rainZone: { x: 60, z: 24, radius: 30 },
  /** Snow: the Frost March (the island's frozen north-east, see Terrain.frozenAt) and the kingdom's snow chapel. */
  snowZones: [{ x: 84, z: -78, radius: 48 }, { x: 900, z: 122, radius: 52 }],
  frozenRect: { xFrom: 33, xTo: 114, zFrom: -105, zTo: -18 },
  /** The moon-shell colossus crawls the east shore, outside every building. */
  colossusPath: [[84, -90], [90, -110], [84, -130], [90, -110]] as Array<[number, number]>,
  /** The world tree west of the causeway's north end (its roots must not cross the road). */
  worldTree: { x: 44, z: -104 },
  /** Walkers that roam among the buildings without touching them. */
  logGiantPath: [[-38, 32], [-46, 30], [-52, 36], [-46, 30]] as Array<[number, number]>,
  /** Pim's observatory north of the village, clear of the houses. */
  observatory: { x: -46, z: 48 },
  riderPath: [[8, 48], [24, 48], [40, 42], [24, 48]] as Array<[number, number]>,
  ruins: [
    { x: -8, z: 43, yaw: 0.3, arch: true }, { x: 20, z: 24, yaw: -0.4, arch: false }, { x: -30, z: -30, yaw: 0.9, arch: false },
    { x: 26, z: -102, yaw: 0.2, arch: true }, { x: 31, z: -28, yaw: 1.1, arch: true }, { x: 80, z: -84, yaw: -0.7, arch: false },
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

/** How far each kind of island model sinks below the ground it stands on (World.ts, Heart.ts, Realms.ts and the placement guard read one table). */
export const SINK = { house: 0.2, ruin: 0.3, church: 0.4, throne: 0.05, treehouse: 0.6, tower: 1.5, faceTree: 0.3, head: 3, castle: 0.6 } as const;

/**
 * A building or prop set on the island's ground (World.ts): its model, where it stands, the way it faces, its scale,
 * how far its base sinks below the ground (`sink`), the spot the ground is sampled at when not its own centre (`at`:
 * a building whose feet are set from its doorstep), or a fixed base (`fixedY`). `rockBase` marks a model that brings
 * its own rock and may sit deep in a hillside (the tower, the tree house). IslandTruth.test.ts measures every entry.
 */
export interface LandmarkSpot { id: string; x: number; z: number; yaw?: number; scale?: number; sink?: number; at?: { x: number; z: number }; fixedY?: number; rockBase?: boolean }
/** The island's watching eyes in the sky (render/SkyEyes): they glare when shot. None hangs over the Blood Eye's chasm patrol. */
export const SKY_EYES: readonly { x: number; y: number; z: number; size: number }[] = [
  { x: -56, y: 36, z: -14, size: 9 }, { x: 52, y: 42, z: -104, size: 11 }, { x: -92, y: 44, z: -122, size: 10 },
  { x: 74, y: 46, z: 8, size: 10 }, { x: -62, y: 40, z: 28, size: 8 }, { x: 8, y: 56, z: -120, size: 13 },
];

/** The island's free-standing buildings and props that no other table places (the big landmarks live in LAYOUT). */
export const LANDMARKS: readonly LandmarkSpot[] = [
  // (The ruined nave stood beside the stone head at (18, -136), inside the Hollow King's body: it is in the Sunken City now.)
  // On the Frost March's flat north of the chasm (at (70, -72) it stood on the chasm's north cliff face).
  { id: 'archgate', x: 56, z: -84, yaw: 0, sink: 0.3 },
  { id: 'colossus-statue', x: 10, z: -96, yaw: 0.9, sink: 0.5 },
  // The island tavern by the spawn: its feet set from its doorstep on the street side.
  { id: 'tavern', x: 20, z: 63, sink: 0.2, at: { x: 20, z: 66 } },
  { id: 'campfire', x: -24, z: 52 },
  // The cloister's arches, out to where its height is sampled (z 68).
  // (1.5 m east of where it stood: the tavern's footing blend reached its west arches.)
  { id: 'cloister', x: 33.5, z: 64.5, at: { x: 33.5, z: 68 } },
  { id: 'observatory', x: LAYOUT.observatory.x, z: LAYOUT.observatory.z, sink: 0.2 },
  { id: 'cauldron', x: 24, z: 77 },
  // The gothic gate (DeSEl9PvPG_) beside the road to the stone head, a ruined gate into the old precinct: its steps
  // face the road (local +z turned to -x), the arch is walked through. (On the road itself it sat in the 4 m climb to
  // the head's chin, and its footing made a bank across the path.)
  { id: 'candle-gate', x: 37, z: -128, yaw: -Math.PI / 2, sink: 0.3 },
];

/**
 * Village street centre and its house slots: [dx, dz, width, depth, rotY]. The street runs east–west at z = 70;
 * the north row faces south onto it, the south row faces north (the island's edge is just behind it).
 */
export const VILLAGE = {
  x: -34, z: 70,
  houses: [
    // (Set as they were built, not in a line: along the street, then a second row behind the south side.)
    [-18, -7.5, 6, 5, 0.2], [-7, -6.5, 5, 5, -0.14], [5, -8.5, 7, 5, 0.26], [18, -6.5, 5, 6, 0.1],
    [-15, 7, 6, 5, Math.PI + 0.22], [-3, 8.5, 5, 5, Math.PI - 0.16], [9, 6.8, 7, 5, Math.PI + 0.1], [23, 8, 5, 5, Math.PI - 0.24],
    [-21, 20, 6, 5, Math.PI + 0.42], [-1, 21, 6, 5, Math.PI - 0.32], [15, 20, 6, 5, Math.PI + 0.18],
  ] as ReadonlyArray<readonly [number, number, number, number, number]>,
  /** Torch posts on both edges of the street, in the gaps between the houses. */
  torches: [[-24, -2.8], [-12, -2.8], [0, -2.8], [12, -2.8], [24, -2.8], [-20, 2.8], [-8, 2.8], [4, 2.8], [16, 2.8], [28, 2.8]] as ReadonlyArray<readonly [number, number]>,
} as const;

/**
 * Where each standing/sitting NPC lives (world metres). `dy` lifts a seated pose onto its seat; `y` pins an
 * absolute height (a balcony perch). Loop NPCs start at the first point of their path instead.
 */
export const ANCHORS: Record<string, { x: number; z: number; dy?: number; y?: number }> = {
  // The Stone Head (bodiless, LAYOUT.head): where you stand before its face, on the rise 4 m short of its chin (the
  // head's collider starts at z -140), so its bubble hangs just in front of the mouth and 30 m reach the causeway's end.
  'stone-head': { x: 0, z: -136 },
  // Round the island tavern's yard table (World.ts, x 22.9..26.1, z 70.2..71.4), on barrel stools.
  aldous: { x: 23.6, z: 72.3, dy: 0.02 }, mirren: { x: 25.4, z: 72.3, dy: 0.02 },
  'gob-a': { x: 23.6, z: 69.3, dy: 0.02 }, 'gob-b': { x: 25.4, z: 69.3, dy: 0.02 },
  // Seated on barrels around the campfire at (-24, 52); `seat` is the barrel under each.
  rattle: { x: -21.6, z: 53.4, dy: 0.02 }, bone: { x: -26.4, z: 53.4, dy: 0.02 }, marrow: { x: -24, z: 49.2, dy: 0.02 },
  vigil: { x: 32, z: 69 },
  pim: { x: -46, z: 53.5 },
  king: { x: -94, z: 8 },
  // Hidden in the castle's shadow, off its west wall, far from his father (he likes the shady places).
  croak: { x: -112, z: 2 },
  frogking: { x: -54, z: -26 },
  cook: { x: 25.6, z: 77 },
  moss: { x: -56, z: 30, dy: 0.38 },
  sentry: { x: -40, z: -90, dy: 0.02 },
  standard: { x: -54, z: -93 },
  'rose-knight': { x: 16, z: 34 }, maiden: { x: 18.2, z: 33 },
  // Dunmar guards the door of Yung Lean's hall; Sel watches the head of Bucket Street (both in the kingdom).
  'watcher-knight': { x: 1000, z: -51.8 }, 'watcher-mage': { x: 937, z: 24 },
  'cup-gnome': { x: 6.5, z: 64 },
  // Fifth batch of reels.
  // (Beside the middle tavern table, not inside it: the table at (-40, -24) is solid once its model exists.)
  grumble: { x: -40, z: -22 },
  priest: { x: 36, z: -96 },
  'lantern-witch': { x: -106, z: 14 },
  // The Lean Quarter (round 6, see LEAN_QUARTER): the Skeleton Court, Bucket Street, the snow chapel, the sky dock.
  // On the dragon throne's seat (ray-probed: 25.38, its front edge at z -171.1), hips 0.12 over it, 0.3 in from the edge.
  'skeleton-king': { x: 1000, z: -171.0, y: 24.76 },
  'galaxy-wizard': { x: 872, z: -18 },
  // The lord at the front of the pavilion's settee (ray-probed: seat 25.03, 1.8 m deep, front edge x 1042.4; sat at
  // its back his shins sank into it), Sir Cobalt on a stool at his side.
  'skeleton-lord': { x: 1042.15, z: -160, y: 24.53 }, 'court-knight': { x: 1042.3, z: -158.3, dy: 0.02 },
  'potion-brewer': { x: 1026, z: -127 },
  bartender: { x: 1173.0, z: 10.1 }, 'dock-knight': { x: 1181, z: 7.5, dy: 0.06 },
  // On the snow flat at snowY(124.6) ≈ 26.1 (SNOW_FLATS plague-doctor); GroundQuery sets y.
  'plague-doctor': { x: 931, z: 124.6, dy: 0 },
  // Down in the crypt bar (Interiors.ts, CRYPT_ROOM): two along the west counter facing the way in, Knuckles on a
  // barrel against the east counter facing them; Sir Gilt before the back counter's skulls.
  'crypt-red': { x: -1001.9, z: 1299.6 }, 'crypt-witch': { x: -1001.9, z: 1301.3 }, 'crypt-bones': { x: -998.7, z: 1300.6, dy: 0.02 },
  'gold-knight': { x: -1000.4, z: 1297.4 },
  yunglean: { x: 1000, z: -74.6, dy: 0.8 },
  'void-monk': { x: 1008, z: 66 },
  // Behind their stalls between the purple houses of the bucket street (Realms.ts places the stalls).
  'market-a': { x: 915, z: 6.4 }, 'market-b': { x: 879, z: 29.6 },
  // Inside the vale's tavern (Interiors.ts, TAVERN_ROOM): Waxwick behind the long table with the hearth at his back,
  // a dwarf at each end of it (the table: x -1001.6..-998.4, z 999.6..1000.8).
  waxwick: { x: -1000, z: 999.05 }, brannoc: { x: -1002.2, z: 1000.3 }, hilde: { x: -997.8, z: 1000.3 },
  // The Dragon's Vale (Vale.ts): the reader on the dragon's claw, the street's folk.
  'dragon-reader': { x: 995.0, z: 904.6, dy: 0.02 },
  // Inside the carriage at the lean castle's bridge (world/Carriage.ts moves him with it).
  'carriage-count': { x: 840, z: 12.8, y: 24.8 },
  // Before the green dragon's head (his neck turns to watch you; Vale.ts).
  'vale-dragon': { x: 996.5, z: 908 },
  'vale-knight': { x: 1004.5, z: 958 }, 'vale-beggar': { x: 994.4, z: 966, dy: 0.02 }, 'vale-merchant': { x: 1005.0, z: 941.4 },
  // Behind his counter in the sea castle's courtyard, his throne at his back (Sunken.ts).
  'fish-king': { x: -1000, z: -68.6 },
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
  /** A room (the tavern, the crypt): the island's drifting mist and motes stay outside. */
  indoors?: boolean;
}

/** The galaxy city beyond the portal (DeOemU1BOZF, DeaqHWJBBPw, DeXn5rSPxR8, DeQ-NnpvqF6, Dd0wR9Jh2lH, DdyN2PNyIxb, DdnJDwBMUoj). */
/** Beyond the portal: Yung Lean's kingdom (it was the galaxy city; the id stays). */
export const GALAXY: RealmDef = { id: 'galaxy', name: "Yung Lean's Kingdom", x: 1000, z: 0, y: 24, radius: 300, fog: { color: 0x3a1a52, density: 0.0055 }, ownSky: true };

/**
 * The kingdom's quarters (round 6, the @returndark reels), each a walkable floor off the plaza (x 940..1060,
 * z -85..75): the Skeleton Court north, Bucket Street and the lean castle west, the snow chapel south-west, the sky
 * dock east beyond the cup islands. Rectangles are [x0, x1, z0, z1].
 */
export const LEAN_QUARTER = {
  court: [940, 1060, -185, -85] as const,
  street: [828, 940, -40, 75] as const,
  /** The lean moat in front of the castle (a sunken channel) and the castle's own ground behind it. */
  moat: [816, 828, -40, 75] as const,
  castleYard: [780, 816, -40, 75] as const,
  snow: [860, 960, 75, 175] as const,
  castle: { x: 800, z: 18 },
  chapel: { x: 900, z: 152 },
  dock: { x: 1180, z: 12, r: 12 },
};

export type LeanDistrict = 'court' | 'street' | 'castle' | 'snow' | 'dock';

/** Which quarter of the kingdom (x, z) is in, or null on the plaza and the cups (they keep the vaporwave look). */
export function leanDistrict(x: number, z: number): LeanDistrict | null {
  const Q = LEAN_QUARTER;
  const inside = (r: readonly [number, number, number, number], pad = 0) => x > r[0] - pad && x < r[1] + pad && z > r[2] - pad && z < r[3] + pad;
  if (inside(Q.court)) return 'court';
  if (inside(Q.snow)) return 'snow';
  if (inside(Q.castleYard) || inside(Q.moat)) return 'castle';
  if (inside(Q.street)) return 'street';
  if (Math.hypot(x - Q.dock.x, z - Q.dock.z) < Q.dock.r + 25) return 'dock';
  return null;
}

/**
 * The quarters' night (the @returndark reels are moonlit, not pink): fog, how far the kingdom's sky darkens (0..1),
 * and the renderer look (Renderer.LOOKS) to blend toward.
 */
export const DISTRICT_AIR: Record<LeanDistrict, { fog: number; density: number; night: number; look: string }> = {
  court: { fog: 0x120a28, density: 0.012, night: 1, look: 'lean-night' },
  street: { fog: 0x170c33, density: 0.01, night: 0.9, look: 'lean-night' },
  castle: { fog: 0x170c33, density: 0.009, night: 0.9, look: 'lean-night' },
  snow: { fog: 0x1c2644, density: 0.014, night: 1, look: 'lean-snow' },
  dock: { fog: 0x2a1446, density: 0.006, night: 0.55, look: 'galaxy' },
};
/**
 * How each place is lit (main.ts blends toward it): the hemisphere's sky and ground colours and strength, the moon's
 * strength, the fill light's colour and strength, and how far the fill swings round behind the camera (0: fixed in
 * the south-east; 1: from the camera, so whoever you look at is lit from the front). The reels' characters keep their
 * true colours at night (white mimics, a green dragon); under the island's cobalt sky alone they read blue-black.
 * Keys: a realm id, 'lean' for the kingdom's night quarters; anything else is lit like the island.
 */
export interface ZoneLight { sky: number; ground: number; hemi: number; moon: number; fill: number; fillColor: number; cameraFill: number }
export const ZONE_LIGHT: Record<string, ZoneLight> = {
  island: { sky: 0x1a2cff, ground: 0x141c4a, hemi: 0.95, moon: 1.5, fill: 0.75, fillColor: 0x8fa5f0, cameraFill: 0 },
  lean: { sky: 0x5a4ab8, ground: 0x150a2a, hemi: 0.75, moon: 1.3, fill: 1.1, fillColor: 0xe6dcff, cameraFill: 1 },
  vale: { sky: 0x3a4ac0, ground: 0x0a1a1a, hemi: 0.7, moon: 1.4, fill: 1.0, fillColor: 0xe0e6ff, cameraFill: 1 },
  // Indoors: no moon; the hearth and the candles light the room (their own point lights), a dim warm fill for faces.
  'tavern-room': { sky: 0x6a3a1c, ground: 0x180a04, hemi: 0.7, moon: 0, fill: 0.85, fillColor: 0xffb878, cameraFill: 1 },
  'crypt-room': { sky: 0x3a3048, ground: 0x0a0806, hemi: 0.6, moon: 0, fill: 0.7, fillColor: 0xffc890, cameraFill: 1 },
  // The castle hall: cobalt under its captive moon (its own light), blue flames between the pillars.
  'castle-hall': { sky: 0x2a3a9a, ground: 0x0a0c1e, hemi: 0.75, moon: 0, fill: 0.8, fillColor: 0xb8c8ff, cameraFill: 1 },
};
/** The sunken city under the lake (DeVj-Z8POjl). */
export const SUNKEN: RealmDef = { id: 'sunken', name: 'The Sunken City', x: -1000, z: 0, y: -48, radius: 160, fog: { color: 0x0a3a4e, density: 0.024 }, underwater: true };
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
/**
 * The candle ring on the alley's floor between two braziers (Graveyard.ts): step into it and the Grave Cyclops climbs
 * out of the ground up the alley ahead of you (Adventures; he no longer waits at the alley's end). `rise` is where.
 */
export const GRAVE_RING = { x: 0, z: -980, r: 1.6, rise: { x: 0, z: -998, yaw: Math.PI / 2 } } as const;
/**
 * The Dragon's Vale (reel Dd5Bqt7vQ5T), through the lantern arch at the east end of the island's village street: a
 * village street with a tavern yard, a green dragon lying at its end, a crowned stone head on a hill by a river under
 * the aurora, and a castle floating over the clouds beyond. The island's sky shows over it (the VALE preset).
 */
export const VALE: RealmDef = { id: 'vale', name: "The Dragon's Vale", x: 1000, z: 900, y: 0, radius: 190, fog: { color: 0x0c2032, density: 0.008 } };
/**
 * Inside the vale's tavern (Dd5Bqt7vQ5T's toast): a firelit room behind the tavern's door, its own small realm. Soot
 * dark beyond the hearth wall and the barrel stacks (its own dark, no sky).
 */
export const TAVERN_ROOM: RealmDef = { id: 'tavern-room', name: 'The Candle Tavern', x: -1000, z: 1000, y: 0, radius: 30, fog: { color: 0x140a06, density: 0.045 }, ownSky: true, indoors: true };
/**
 * The crypt bar under the snow chapel (DeldocTvFiB): green-eyed skeletons sipping at a stone bar under a vault, skulls
 * and melting candles, Sir Gilt toasting the dead. Its own dark, no sky.
 */
export const CRYPT_ROOM: RealmDef = { id: 'crypt-room', name: 'The Crypt Bar', x: -1000, z: 1300, y: 0, radius: 30, fog: { color: 0x0b0a10, density: 0.04 }, ownSky: true, indoors: true };
/**
 * Inside the island castle (the playtest of 2026-11-12: "press F and enter the castle, put something cool there"):
 * the Moon Throne Hall (world/CastleHall.ts), a pillared vault with an empty throne under a captive moon.
 */
export const CASTLE_HALL: RealmDef = { id: 'castle-hall', name: 'The Moon Throne Hall', x: -1000, z: 1600, y: 0, radius: 40, fog: { color: 0x070a1e, density: 0.028 }, ownSky: true, indoors: true };
export const REALMS: readonly RealmDef[] = [GALAXY, SUNKEN, TREEHOUSE_ROOM, DREAM, GRAVEYARD, VALE, TAVERN_ROOM, CRYPT_ROOM, CASTLE_HALL];

/**
 * The cloud sea's top layer in each place (world y; CloudSea lays its other two layers 9 and 22 m under it), or null
 * where there is none: under the lake (the Sunken City's floor is at -48) and in the rooms. main.ts eases the clouds
 * toward the level of the place the hero is in.
 */
export const CLOUD_LEVEL: Record<Zone, number | null> = {
  island: LAYOUT.cloudSea.y, galaxy: -16, vale: -30, graveyard: -30, dream: -40,
  sunken: null, treehouse: null, 'tavern-room': null, 'crypt-room': null, 'castle-hall': null,
};

/** A sky as reflected in water and polished ground (SKY_SHARED's horizon, mid, zenith and cloud colours). */
export interface RealmSky { horizon: number; mid: number; zenith: number; cloud: number }
/**
 * Each realm's own sky for its water and gloss to reflect: main.ts blends SKY_SHARED toward the realm's, and back to
 * the island dome's own colours on the island. The vale, the alley and the drowned city show the island dome with
 * their SKIES preset, so theirs are the preset's colours (the drowned city's: the lake's teal murk); the dream's is its
 * tie-dye nebula's violet; the rooms' their own dark. The kingdom's darkens with its night: Kingdom.ts
 * kingdomSkyColors() works it out from the dome's own colours, so it has no entry here.
 */
export const REALM_SKY: Partial<Record<Zone, RealmSky>> = {
  vale: { horizon: 0x13405a, mid: 0x0a2048, zenith: 0x030818, cloud: 0x3a6a9a },
  graveyard: { horizon: 0x3a1460, mid: 0x5a2a28, zenith: 0x1a0c06, cloud: 0xd88a2a },
  dream: { horizon: 0x5a2a8a, mid: 0x34125e, zenith: 0x10051f, cloud: 0xc860f0 },
  sunken: { horizon: 0x0a3a4e, mid: 0x0a3a4e, zenith: 0x02101a, cloud: 0x0a3a4e },
  treehouse: { horizon: 0x1e1236, mid: 0x120a26, zenith: 0x06040e, cloud: 0x3a2a5a },
  'tavern-room': { horizon: 0x2a1408, mid: 0x180a04, zenith: 0x0a0402, cloud: 0x6a3a1c },
  'crypt-room': { horizon: 0x1c1824, mid: 0x100c14, zenith: 0x060508, cloud: 0x3a3048 },
  'castle-hall': { horizon: 0x141c48, mid: 0x0a1030, zenith: 0x04060f, cloud: 0x3a4a9a },
};

/** Portal ends on the island. */
export const ISLAND_PORTALS = {
  /** The swirling portal at the end of the stepping stones by the face tree (DeQ-NnpvqF6). */
  galaxy: { x: -56, z: -10, faceTree: { x: -47, z: -2 } },
  /** The lantern arch at the east end of the village street: the road to the Dragon's Vale. */
  vale: { x: -5, z: 70 },
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
  { x: 106, z: -13, r: 6, y: 1.8, blend: 2 },     // the Marsh Sovereign's mud basin (filled to 3.3, under its banks all round)
  { x: -40, z: -90, r: 1.6, y: 28.4, blend: 2.5 }, // Sir Halvard's seat on the cliff
  { x: -56, z: 30, r: 2, y: 1.5, blend: 4 },       // Old Moss fishing from the bank (above the river's waterline)
  // The village's ground: two level pads over the street hollow and the coast's bulge (per-house footings dug pits).
  { x: -32, z: 75, r: 25, y: 2.8, blend: 2.5 },
  { x: -50, z: 78, r: 20, y: 2.8, blend: 4 },
  { x: -8, z: -5, r: 4, y: 2.8, blend: 3 },       // the hamlet's west house on the eye's bank
];

/**
 * The hamlet knoll (the reference frame's village terrace, world-look-28): the ground within `r` of (x, z) is raised
 * `rise` metres, blending back over `blend`. The eye bridge lands at `landing` (its north end) on the old bank level;
 * from there the terrace climbs over `face` metres with a `riser`-high step at each of the `risers` distances from the
 * landing (each ramped over ±`riserRun`), so the road from the bridge climbs steps (Terrain.knollAt). The risers sit
 * 1.8 m apart so a 1 m stride never takes both, and clear of the hamlet's houses and torches (Terrain.test.ts).
 */
export const KNOLL = {
  x: 12, z: -10, r: 18, blend: 10, rise: 2.2,
  landing: { x: 0, z: -3, r: 1.5, face: 8 },
  risers: [3.6, 5.4] as readonly number[], riser: 0.45, riserRun: 0.3,
} as const;

/**
 * Where the island's relief (Terrain.reliefAt) leaves the ground exactly as the bare sculpt makes it. The rolling hills
 * (and the rim lip) are off on these footprints, on the pads out to their blends (PADS), round every NPC's spot, on the
 * footpaths' trodden core and on the water and its banks, and come back past each over a short ramp; everywhere else
 * the island rolls in full (the old mask also flattened every blend 12 m further and every path 9 m out, which left a
 * fifth of the land rolling). Discs {x, z, r}; rects [x0, x1, z0, z1]. A building added to the island gets its
 * footprint here (its collider grid's extent, Colliders.gridFootprint, turned by its yaw), or it stands on a slope.
 */
export interface FlatDisc { x: number; z: number; r: number }
export type FlatRect = readonly [number, number, number, number];
export const FLATS: {
  ramp: number; bank: number; margin: number; path: number;
  water: { river: number; eye: number; tier: number; pond: number; stream: number };
  discs: readonly FlatDisc[]; rects: readonly FlatRect[]; npcs: readonly FlatDisc[];
} = {
  /**
   * The hills come back past a level edge over at least `ramp` metres, and over as many more as their height needs for
   * the bank they make to rise no steeper than `bank` (the hero walks up to 1.2; a pit round a house would read as one).
   */
  ramp: 3,
  bank: 0.5,
  /**
   * Level ground kept round every footprint (discs and rects) before the ramp begins: doorsteps, porches and the props
   * set by a door stand on the bare sculpt too.
   */
  margin: 3,
  /** Half-width of a footpath's trodden core (its soil, pathAt), level along the path: every path keeps its 0.35. */
  path: 2.1,
  /**
   * The water's level cores (metres): the river's channel (from its centre line), the eye's rim (from its outline),
   * the koi pools' stone rims and the lily pond's shore (from their edges), the stream's ravine (from its centre line).
   * The carves themselves keep every pool's water in its basin and lift the river's banks; hills beyond only roll them.
   */
  water: { river: 9.5, eye: 2, tier: 1, pond: 2, stream: 5 },
  discs: [
    { x: 20, z: 63, r: 6 }, // the island tavern (its grid: 8.2 x 7.7 m)
    { x: -24, z: 52, r: 3.5 }, // the skeletons' campfire ring and their barrels
    { x: -46, z: 48, r: 6 }, // Pim's observatory (7.9 x 7.8 m)
    { x: -47, z: -2, r: 9 }, // the face tree (13 x 10.8 m)
    { x: -56, z: -10, r: 4 }, // the galaxy portal
    { x: -40, z: -26, r: 9 }, // the mushroom tavern's tables and lantern poles (7.5 m out)
    { x: 0, z: -146, r: 8.5 }, // the stone head (10.3 x 12.4 m, sunk 3 m)
    // The hamlet knoll's top and its houses (the farthest, at (26, -14), reaches 18.9 m out).
    { x: KNOLL.x, z: KNOLL.z, r: KNOLL.r + 2 },
    // Model slots waiting for their GLB (they render nothing yet): the frozen arch gate, the colossus statue by the dead
    // wood, and the ruins.
    { x: 37, z: -128, r: 6 }, // the candle gate
    { x: 56, z: -84, r: 5 },
    { x: 10, z: -96, r: 6 },
    ...LAYOUT.ruins.map((r) => ({ x: r.x, z: r.z, r: 3.5 })),
    // The bridges' ends: each deck is set from the higher of its two banks (Walkways), so both stay as they were.
    { x: LAYOUT.chasmBridge.ax, z: LAYOUT.chasmBridge.az, r: 3 },
    { x: LAYOUT.chasmBridge.bx, z: LAYOUT.chasmBridge.bz, r: 3 },
    { x: -64 - 11.3, z: -124, r: 3 }, // the gorge's stone bridge (Heart.ts, WORLD.gorge.x ± 11.3)
    { x: -64 + 11.3, z: -124, r: 3 },
  ],
  rects: [
    [-58, -6, 60, 80], // the village: its two street rows of houses (6.4 x 5.5 m each) and the street between them (the back row stands on the village pads)
    [50.2, 85.8, -28.4, -5.6], // the cathedral at 0.65 (35.6 x 22.8 m, its long axis east-west), its feet at a fixed y
    [-72.2, -59.8, 48.1, 65.9], // the demon church (16.8 x 11.3 m, turned to face east)
    [72.3, 93.7, 16.9, 47.1], // the wizard's tower on its rock (20.4 x 29.2 m)
    [-96.5, -75.5, 18.4, 41.6], // the tree house (22.2 x 20 m, turned)
    [28, 39, 63.5, 68.5], // the cloister's arches, out to where its height is sampled (z 68)
    [-80, -54, 6, 12], // the witches' bridge over the stream (its 23 m deck, both banks)
  ],
  // Every NPC's spot on the island, 2 m round (realm anchors lie far outside the island's square).
  npcs: Object.values(ANCHORS).filter((a) => Math.abs(a.x) < 200 && Math.abs(a.z) < 200).map((a) => ({ x: a.x, z: a.z, r: 2 })),
};

/**
 * Level footings under the buildings: inside `r` the ground is flattened to the height of the disc's own centre (or
 * `y`), blending back over `blend`, so a house stands level at the height it was already placed at. Models with their
 * own rock base (the wizard's tower, the tree house) keep it.
 */
export const FOOTINGS: ReadonlyArray<{ x: number; z: number; r: number; blend: number; y?: number }> = [
  // (The big ones first: a house beside one keeps its own level, the later disc wins.)
  { x: LAYOUT.church.x, z: LAYOUT.church.z, r: 8.5, blend: 2 },
  // The cathedral: two discs along its length (one r 14 disc dammed the river: its channel floor rose 1.8 m under the south aisle).
  { x: LAYOUT.cathedral.x - 9.5, z: LAYOUT.cathedral.z, r: 11, blend: 3, y: LAYOUT.cathedral.y },
  { x: LAYOUT.cathedral.x + 9.5, z: LAYOUT.cathedral.z, r: 11, blend: 3, y: LAYOUT.cathedral.y },
  // (The village houses stand on the village pads, PADS: a footing each dug a pit round every house in the street hollow.)
  // (Tight: terraced on the knoll. The west house has its PAD; the one by the road, cut into the bank, blends over 2.5 m so the path past it stays walkable.)
  ...LAYOUT.hamlet.filter(([x]) => x !== -8).map(([x, z]) => ({ x, z, r: 3.5, blend: x === 7 ? 2.5 : 1.2 })),
  { x: 33.5, z: 64.5, r: 5.2, blend: 5.5 }, // the cloister (before the tavern, whose level wins between them; a long blend keeps the street between them walkable)
  { x: 20, z: 63, r: 5.6, blend: 3 },    // the tavern
  { x: -46, z: 48, r: 5.5, blend: 4 },   // the observatory
  { x: -24, z: 52, r: 4, blend: 2 },     // the skeletons' campfire and their barrels
  { x: ISLAND_PORTALS.galaxy.faceTree.x, z: ISLAND_PORTALS.galaxy.faceTree.z, r: 7.5, blend: 2 }, // the face tree
  { x: 56, z: -84, r: 4.5, blend: 2 },   // the arch gate on the Frost March
  { x: LAYOUT.treehouse.x, z: LAYOUT.treehouse.z, r: 10, blend: 2.5 },
  { x: 10, z: -96, r: 4.6, blend: 2 },   // the colossus statue
  { x: 37, z: -128, r: 5, blend: 2.5 },  // the candle gate (beside the road it sat in the Ember Rider's pad)
  ...LAYOUT.ruins.map((r) => ({ x: r.x, z: r.z, r: r.arch ? 3.2 : 1.6, blend: r.arch ? 1.8 : 1.2 })),
];

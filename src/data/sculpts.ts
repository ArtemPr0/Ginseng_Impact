/**
 * The realm sculpts: pure data and pure functions that give every realm beyond the island (Yung Lean's kingdom, the
 * Dragon's Vale, the Sunken City, the Alley of Graves) real ground instead of flat slabs. Nothing here touches
 * three.js or the DOM: `sculptFor` adapts a realm to render/Ground.ts's `Sculpt`, and the mesh and collision wiring
 * (RealmGround, GroundQuery, World) consumes that.
 *
 * The one rule: **pads keep their height, everything else rolls.** A pad is flat (or gently sloped by a function) at
 * exactly the height the placements on it assume today (the realm's floor, a sunken moat bed, a raised grave plot), so
 * nothing that stands on a pad moves. Between the pads the ground rolls with low hills; the land is the pads dilated by
 * a margin with an fbm-warped border; past the border a lip, then a cliff falling to the abyss (or a seabed falling
 * away in the murk), so every realm reads as a floating rock over the cloud sea, like the reels.
 *
 * Height, inside the land: `base + hills · (1 − padMask) + extraHills`, then the pads lerp to their y over their blend
 * (the sequential PADS formula of world/Terrain.ts, so a later pad overrides an earlier one), then each water rect
 * raises its banks above the water and cuts down to its bed, then the lip rises over the last LIP_RISE metres off the
 * pads. Outside: one smooth fall from that height to WORLD.abyssY that passes `base − drop` exactly `width` metres past
 * the border, or for a seabed a gentle fall over `fall` metres. A cliff's smoothstep is 4.2 to 4.6 steep straight across
 * the border at its steepest, no shelf; where the border's fbm warp bends it the warp's own gradient adds to that, so the
 * steepest cliff ground is about 6.2 (the kingdom's; the vale's 6.0, the alley's 5.5).
 *
 * Sharp edges are drawn exactly: every realm bakes at REALM_CELL on a world-aligned grid, and a pad with a linear blend
 * one cell wide off a rect on grid lines (the moat's bed, the grave plots) rises across exactly one column of cells,
 * which the baked grid draws just as the sculpt has it along the rect's sides. In its four corner cells the rise rounds
 * off (up to 0.18 m from the drawn at a grave plot's corners, where nothing stands), and at the moat's open ends, under
 * the water, the rolling ground beyond meets it; there, as everywhere else, the sculpt equals the drawn ground at the
 * vertices only.
 *
 * Things that float over the void (the lean cups, the sky islands and the sky dock, the vale's floating castle and its
 * platforms) are `clear` zones: the land is cut back from them far enough that the cliff has already fallen below them.
 *
 * Layers: each realm paints a default ground (with an accent patched in by fbm), then its layer rects in order, each
 * taking its coverage from what lies under it through an fbm-warped border with an optional fray (a ragged edge eaten
 * into by holes, so a marble plaza crumbles into cobble and snow drifts onto stone instead of ending in a line), then
 * the beds under the water; rock by slope and on the cliff band; `wet` within 3 m of water. The eleven texture weights
 * always sum to 1, so no vertex is ever black.
 */
import { GROUND_ALBEDO, LAYER, LAYER_COUNT, LAYER_TINT, TEXTURE_LAYERS, WET_DARKEN, type Sculpt } from '../render/Ground';
import { type Noise2D, lerp, smoothstep } from '../world/noise';
import { WORLD } from '../world/Terrain';
import { MODELS } from './models';
import { GALAXY, GRAVEYARD, LEAN_QUARTER, SUNKEN, VALE } from './world';

// ---------- types ----------

/** [x0, x1, z0, z1] in world metres. */
export type Rect = readonly [x0: number, x1: number, z0: number, z1: number];
export interface Disc { x: number; z: number; r: number }
/** A capsule: every point within `r` of the segment a → b (a path, a ramp). */
export interface Seg { ax: number; az: number; bx: number; bz: number; r: number }
/** A shape: the union of whichever parts are set. */
export interface Shape { rect?: Rect; disc?: Disc; seg?: Seg }
export type LayerName = keyof typeof LAYER;

/** Level ground at `y` (a number, or a function of x, z for a slope or a ramp), blending back over `blend` metres outside its shape. */
export interface Pad extends Shape {
  y: number | ((x: number, z: number) => number);
  blend: number;
  /**
   * How the blend eases: 'smooth' (the default, the PADS smoothstep) or 'linear', a straight rise. A linear blend one
   * cell wide off a rect whose edges lie on grid lines is drawn exactly by the baked grid (a sharp edge: a moat wall,
   * a raised plot), so what stands by it on the sculpt's height stands on the drawn ground.
   */
  ease?: 'smooth' | 'linear';
  /** How far the land extends past this pad (default: the realm's `land.margin`). */
  margin?: number;
  /** How far the land's border wanders here (default: the realm's `land.wobble`). */
  wobble?: number;
  /** For messages and tests. */
  name?: string;
}

/** A ground texture painted over a shape, its border warped by fbm (`warp` metres) and blended over `blend` metres; `fray` 0..1 eats a ragged, holed edge. */
export interface LayerRect extends Shape {
  layer: LayerName;
  warp: number;
  blend: number;
  fray?: number;
}

/**
 * Swimmable water over a rect: its surface `level` and the `bed` the ground is cut to. The ground round it is raised to
 * FREEBOARD above the water (fully for WATER_BANK metres, fading out by BANK_OUT); inside, the bank slopes down to the
 * bed over `bank` metres (default WATER_BANK; 0 = a channel cut straight down). `cut: false` leaves the ground under
 * the water to the pads (a walled channel whose bed is a pad with grid-exact walls inside the sheet: the lean moat).
 */
export interface WaterRect { rect: Rect; level: number; bed: number; bank?: number; cut?: boolean }

/** A dome of extra relief: `height` at its centre, easing to 0 at `disc.r`; `falloff` 0..1 is the share of the radius the ease takes (1 = a full smoothstep dome). */
export interface ExtraHill { disc: Disc; height: number; falloff: number }

/** A shape that counts as land without being a pad (the meadows a realm's mobs roam, a hill). */
export interface LandShape extends Shape { margin?: number; wobble?: number; name?: string }

/** Something floating over the void that the ground must stay below: under all of `disc`, the ground is lower than `below`. */
export interface Floater { name: string; disc: Disc; below: number }

export interface RealmSculpt {
  id: 'galaxy' | 'vale' | 'sunken' | 'graveyard';
  /** The realm's floor height (RealmDef.y). */
  base: number;
  /** In order: a later pad overrides an earlier one where they overlap. */
  pads: Pad[];
  /** Low fbm hills between the pads: amplitude in metres, wavelength in metres, a per-realm seed; `mask` (0..1) fades them. */
  hills: { amp: number; wavelength: number; seed: number; mask?: (x: number, z: number) => number };
  /** The land: the pads (and `extra` shapes) dilated by their margin, the border warped ±wobble by fbm; or one disc (the seabed). */
  land: { kind: 'pads'; margin: number; wobble: number; extra?: LandShape[] } | { kind: 'disc'; disc: Disc; wobble?: number };
  /** Past the land: a lip at the rim then a cliff `drop` metres down over `width` metres on to the abyss, or a seabed falling to the abyss over `fall` metres. */
  edge: { kind: 'cliff'; drop: number; width: number; lip: number } | { kind: 'seabed'; fall?: number };
  water?: WaterRect[];
  layerRects: LayerRect[];
  defaultLayer: LayerName;
  /** Patches of a second texture in the default ground, by fbm: `cover` is their greatest weight; `flat` keeps them off slopes. */
  accent?: { layer: LayerName; wavelength: number; cover: number; flat?: boolean };
  /** Baseline `wet` everywhere (the sunken city is under water). */
  wet?: number;
  /** Grass tufts grow here (where the grass/moss weight allows). */
  grass?: boolean;
  /** The cloud sea's level in world y while the player is here, or null for none. */
  cloudSea: number | null;
  sky: 'island' | 'kingdom' | 'dream';
  extraHills?: ExtraHill[];
  /** Floating things the land keeps clear of. */
  clear?: Floater[];
}

// ---------- constants ----------

/**
 * Realm grid cell in metres (the island bakes at 1 m). Every realm's grid is world-aligned: its vertices sit at
 * multiples of REALM_CELL, which the sharp edges (the moat's walls, the grave plots' rises) are laid on.
 */
export const REALM_CELL = 1.5;
/** The land mask falls from 1 to 0 over the last metres inside the warped border. */
export const LAND_SOFT = 3;
/** The lip rises over this many metres inside the border (off the pads only). */
export const LIP_RISE = 4;
/** Default width of the bank inside a water rect, from the shore down to its bed. */
export const WATER_BANK = 3;
/** Outside a water rect the ground is raised to FREEBOARD above the water over its first WATER_BANK metres, fading out by BANK_OUT. */
export const BANK_OUT = 8;
export const FREEBOARD = 0.3;
/** Default run of a seabed edge, from the land's rim down to the abyss (a gradient of at most 0.9 for the sunken city's 42 m). */
export const SEABED_FALL = 70;
/** The wavelength of the fbm that warps every land border. */
export const BORDER_WAVELENGTH = 70;
/** How far the far tint leans from the layers' own colours toward the island's palette (navy/moss/stone/snow/seabed). */
export const TINT_PALETTE_MIX = 0.35;
/** The abyss every cliff ends in (one source of truth with the island). */
export const ABYSS_Y = WORLD.abyssY;

// ---------- shapes ----------

/** Signed distance to a rect's border (negative inside), as render/glsl.ts's sdRect. */
export function sdRect(x: number, z: number, r: Rect): number {
  const cx = (r[0] + r[1]) * 0.5, cz = (r[2] + r[3]) * 0.5;
  const dx = Math.abs(x - cx) - (r[1] - r[0]) * 0.5;
  const dz = Math.abs(z - cz) - (r[3] - r[2]) * 0.5;
  const ox = dx > 0 ? dx : 0, oz = dz > 0 ? dz : 0;
  // (Math.sqrt, not Math.hypot: these run a few hundred thousand times per bake.)
  return Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(dx, dz), 0);
}

export function sdDisc(x: number, z: number, d: Disc): number {
  const dx = x - d.x, dz = z - d.z;
  return Math.sqrt(dx * dx + dz * dz) - d.r;
}

/** Where along a segment (0 at a, 1 at b) the nearest point to (x, z) lies. */
export function segT(x: number, z: number, s: Seg): number {
  const dx = s.bx - s.ax, dz = s.bz - s.az;
  const l2 = dx * dx + dz * dz;
  if (l2 < 1e-9) return 0;
  return Math.min(1, Math.max(0, ((x - s.ax) * dx + (z - s.az) * dz) / l2));
}

export function sdSeg(x: number, z: number, s: Seg): number {
  const t = segT(x, z, s);
  const dx = x - (s.ax + (s.bx - s.ax) * t), dz = z - (s.az + (s.bz - s.az) * t);
  return Math.sqrt(dx * dx + dz * dz) - s.r;
}

/** Signed distance to a shape (the union of its parts); +Infinity for an empty shape. */
export function sdShape(x: number, z: number, s: Shape): number {
  let d = Infinity;
  if (s.rect) d = Math.min(d, sdRect(x, z, s.rect));
  if (s.disc) d = Math.min(d, sdDisc(x, z, s.disc));
  if (s.seg) d = Math.min(d, sdSeg(x, z, s.seg));
  return d;
}

/** The axis-aligned bounds of a shape. */
export function shapeBounds(s: Shape): { x0: number; x1: number; z0: number; z1: number } {
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  if (s.rect) { x0 = Math.min(x0, s.rect[0]); x1 = Math.max(x1, s.rect[1]); z0 = Math.min(z0, s.rect[2]); z1 = Math.max(z1, s.rect[3]); }
  if (s.disc) { x0 = Math.min(x0, s.disc.x - s.disc.r); x1 = Math.max(x1, s.disc.x + s.disc.r); z0 = Math.min(z0, s.disc.z - s.disc.r); z1 = Math.max(z1, s.disc.z + s.disc.r); }
  if (s.seg) {
    const g = s.seg;
    x0 = Math.min(x0, g.ax - g.r, g.bx - g.r); x1 = Math.max(x1, g.ax + g.r, g.bx + g.r);
    z0 = Math.min(z0, g.az - g.r, g.bz - g.r); z1 = Math.max(z1, g.az + g.r, g.bz + g.r);
  }
  return { x0, x1, z0, z1 };
}

/** The height of one extra hill at (x, z). */
export function hillHeight(h: ExtraHill, x: number, z: number): number {
  const dx = x - h.disc.x, dz = z - h.disc.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  if (d >= h.disc.r) return 0;
  const f = Math.min(1, Math.max(1e-3, h.falloff));
  return h.height * (1 - smoothstep(h.disc.r * (1 - f), h.disc.r, d));
}

/**
 * A rect moved onto the realm grid: each edge in to the nearest grid line (a multiple of REALM_CELL), then `inset`
 * whole cells further in. A pad on such a rect with a linear blend of REALM_CELL rises across exactly one column of
 * cells, which the baked grid draws just as the sculpt has it.
 */
export function onGrid(r: Rect, inset = 0): Rect {
  const c = REALM_CELL;
  // (The 1e-9 keeps an edge that is on a line up to rounding where it is, rather than a whole cell further in.)
  const up = (v: number) => Math.ceil(v / c - 1e-9) * c, down = (v: number) => Math.floor(v / c + 1e-9) * c;
  return [up(r[0]) + inset * c, down(r[1]) - inset * c, up(r[2]) + inset * c, down(r[3]) - inset * c];
}

/** A pad's height at (x, z). */
export function padY(p: Pad, x: number, z: number): number {
  return typeof p.y === 'number' ? p.y : p.y(x, z);
}

/** The inverse of smoothstep(0, 1, t) on [0, 1]. */
function smoothstepInverse(v: number): number {
  return 0.5 - Math.sin(Math.asin(Math.min(1, Math.max(-1, 1 - 2 * v))) / 3);
}

// ---------- the kingdom (galaxy) ----------

const Q = LEAN_QUARTER;
const GY = GALAXY.y;
/** The plaza (Kingdom.ts: the porcelain floor and its box, x 940..1060, z -85..75). */
export const PLAZA: Rect = [940, 1060, -85, 75];
/** The lean moat's water and bed (LeanQuarter.ts: the sheet and `api.water` at gy − 0.35 over Q.moat, the channel's floor box at gy − 2.2). */
export const MOAT_LEVEL = GY - 0.35;
export const MOAT_BED = GY - 2.2;
/**
 * The moat's level bed: Q.moat (x 816..828, z −40..75) on the grid and one cell in. Its walls are linear one-cell
 * rises from it to the banks' grid lines (x 816 and 828, z −39 and 75: −40 is off the grid), so the drawn channel is
 * exactly the sculpt's and lies inside the water sheet, and the banks outside it stay level above the water (no dry
 * trench along them; between z −40 and −39 the sheet's end is under the bank).
 */
export const MOAT_BED_RECT: Rect = onGrid(Q.moat, 1);
/** The snow quarter climbs 3 m from the plaza's level toward the chapel (level again from z 150). */
export const snowY = (z: number): number => GY + 3 * smoothstep(80, 150, z);
/**
 * The chapel's own level ground (LEAN_QUARTER.chapel). Interiors.ts's crypt door (its interactable at (902.6, 146.5))
 * and the crypt's way back up (a teleport to (904.8, 144.1)) are on it, at 27: both still use GALAXY.y (24), 3 m into
 * the ground, until step 6 puts them at h().
 */
export const CHAPEL_PAD: Disc = { x: Q.chapel.x, z: Q.chapel.z, r: 14 };
export const CHAPEL_Y = 27;
/**
 * Level ground under the snow quarter's clusters: the four cottages (LeanQuarter.ts, boxes hw 3.3) and the plague
 * doctor on his chest (931, 124.6) at the slope's height at their middle (the plan sweeps them to h()), and the gate the
 * path comes in by (its pillars at (950 ± 3.5, 86), the broken gate at (955.6, 87.8)) at the floor's own GY, so it
 * stays where it stands.
 */
export const SNOW_FLATS: ReadonlyArray<Disc & { name: string; y: number }> = [
  { name: 'cottage-nw', x: 865.5, z: 100, r: 5, y: snowY(100) }, { name: 'cottage-w', x: 865.5, z: 120, r: 5, y: snowY(120) },
  { name: 'cottage-e', x: 954.5, z: 150, r: 5, y: snowY(150) }, { name: 'cottage-se', x: 954.5, z: 168, r: 5, y: snowY(168) },
  { name: 'plague-doctor', x: 931, z: 124.6, r: 3, y: snowY(124.6) },
  { name: 'snow-gate', x: 951, z: 86.5, r: 6, y: GY },
];
/** The cup islands (Kingdom.ts `cups`): 22 m lean cups floating east of the plaza, their lean at gy, their foot at gy − 0.96 H. */
export const CUPS: ReadonlyArray<readonly [number, number]> = [[1082, 10], [1108, -12], [1136, 14]];
const CUP_H = MODELS['lean-cup-island'].height;
/** The cup's lean (its walkable floor) radius: Kingdom.ts ISLAND_R × H. */
export const CUP_R = 0.28 * CUP_H;
const CUP_FOOT = GY - CUP_H * 0.96;
/** The floating-island model's half-width at scale 1 (its collider grid: 0.26 H). */
const ISLAND_HALF = 0.26 * MODELS['floating-island'].height;
/** world/Heart.ts ISLAND_TOP: a floating island's walkable top, as a share of its height above its foot. */
const ISLAND_TOP = 0.46;
/**
 * The sky dock (LeanQuarter.ts): the floating-island model at scale 2.4, its top the dock's floor at gy, its foot
 * (at gy − 24.3, its underside's glows above it) far down in the void. It floats like the cups: no land reaches it, and
 * Old Ribs and Sir Velvet (ANCHORS bartender, dock-knight) stand on its own collider.
 */
const DOCK_SCALE = 2.4;
export const DOCK: Floater = {
  name: 'sky-dock',
  disc: { x: Q.dock.x, z: Q.dock.z, r: ISLAND_HALF * DOCK_SCALE + 0.4 },
  below: GY - MODELS['floating-island'].height * DOCK_SCALE * ISLAND_TOP,
};

/** The kingdom's things over the void east of the plaza: the cups, the two sky islands and the dock of LeanQuarter.ts. */
const GALAXY_FLOATERS: Floater[] = [
  ...CUPS.map(([x, z], i): Floater => ({ name: `cup-${i}`, disc: { x, z, r: 0.29 * CUP_H + 0.4 }, below: CUP_FOOT })),
  { name: 'island-tree', disc: { x: 1088, z: -50, r: ISLAND_HALF * 1.2 + 0.4 }, below: GY + 4 },
  { name: 'island-tower', disc: { x: 1124, z: -40, r: ISLAND_HALF * 1.4 + 0.4 }, below: GY - 4 },
  DOCK,
];

const GALAXY_SCULPT: RealmSculpt = {
  id: 'galaxy',
  base: GY,
  pads: [
    // (The plaza's east edge stays open onto the lean waves: its land ends 5 m out, so the cups float as they do.)
    { name: 'plaza', rect: PLAZA, y: GY, blend: 8, margin: 5, wobble: 2 },
    { name: 'court', rect: Q.court, y: GY, blend: 8 },
    { name: 'street', rect: Q.street, y: GY, blend: 8 },
    { name: 'castle-yard', rect: Q.castleYard, y: GY, blend: 8 },
    { name: 'snow', rect: Q.snow, y: (_x, z) => snowY(z), blend: 8 },
    { name: 'chapel', disc: CHAPEL_PAD, y: CHAPEL_Y, blend: 6 },
    ...SNOW_FLATS.map((d): Pad => ({ name: d.name, disc: { x: d.x, z: d.z, r: d.r }, y: d.y, blend: 4 })),
    // Last: the sunken channel, its walls one-cell linear rises on grid lines inside the sheet (the water leaves it be).
    { name: 'moat-bed', rect: MOAT_BED_RECT, y: MOAT_BED, blend: REALM_CELL, ease: 'linear' },
  ],
  // No hills on the plaza's open east edge, where the lean waves leave for the cups.
  hills: { amp: 3, wavelength: 60, seed: 11, mask: (x) => 1 - smoothstep(1040, 1058, x) },
  land: {
    kind: 'pads', margin: 28, wobble: 5,
    // Rolling ground south of the plaza (behind the ring portals), held back from the cups' line.
    extra: [{ name: 'plaza-south', rect: [956, 1044, 76, 80], margin: 18, wobble: 3 }],
  },
  edge: { kind: 'cliff', drop: 70, width: 22, lip: 1.2 },
  water: [{ rect: Q.moat, level: MOAT_LEVEL, bed: MOAT_BED, cut: false }],
  layerRects: [
    { rect: Q.court, layer: 'flagstone', warp: 5, blend: 10 },
    { rect: Q.castleYard, layer: 'flagstone', warp: 4, blend: 8 },
    { rect: Q.street, layer: 'cobble', warp: 5, blend: 10, fray: 0.2 },
    // The plaza's marble: a bounded terrace whose edges crumble into the cobble, the court's slabs and the rock round it.
    { rect: PLAZA, layer: 'marble', warp: 6, blend: 12, fray: 0.35 },
    // (5 m north of the quarter, so the snow drifts onto the street's and the plaza's stone; frayed into the rock south.)
    { rect: [Q.snow[0], Q.snow[1], Q.snow[2] - 5, Q.snow[3]], layer: 'snow', warp: 7, blend: 12, fray: 0.3 },
  ],
  defaultLayer: 'rock',
  accent: { layer: 'moss', wavelength: 28, cover: 0.85, flat: true },
  grass: false,
  cloudSea: GY - 40,
  sky: 'kingdom',
  clear: GALAXY_FLOATERS,
};

// ---------- the Dragon's Vale ----------

const VY = VALE.y;
/** The crowned head as Vale.ts places it: at (X − 85, Z + 20), turned face(0.25) = π/2 − 0.25, half again its registry size. */
export const CROWNED_HEAD = { x: VALE.x - 85, z: VALE.z + 20, yaw: Math.PI / 2 - 0.25, scale: 1.5 } as const;
/**
 * The head's level seat. crowned-head.glb at that scale is 21 m tall and lies on its own mound: its floor-touching
 * collider cells (colliderGrids.ts, `low` > 0) spread 32 × 24 m, out to 17.7 m from where it is placed, and their
 * enclosing circle is r 16.56 about (914.9, 918.4). The seat is that circle and 0.94 m more, level all over, so no part
 * of the mound floats or sinks wherever its model stands at h() on it.
 */
export const VALE_HEAD_SEAT: Disc = { x: 914.9, z: 918.4, r: 17.5 };
/**
 * The seat's height: what the cobbled path climbs, at under 0.28, on its 18 m straight run from the bridge's bank to the
 * seat between Vale.ts's braziers (the plan's 9 m dome would take a gradient of 0.5 there).
 */
export const VALE_HEAD_Y = VY + 5;
/** The crowned head's hill: a mesa whose level top is the seat, easing down to the meadows by r 40 (the fbm hills masked off on it). */
export const VALE_DOME: ExtraHill = { disc: { x: VALE_HEAD_SEAT.x, z: VALE_HEAD_SEAT.z, r: 40 }, height: VALE_HEAD_Y - VY, falloff: 1 - VALE_HEAD_SEAT.r / 40 };
/** The river (Vale.ts: riverX = X − 45, 10 m wide, z0..z1 = Z − 120..Z + 125), its surface at vy − 0.35 over a bed 2.2 m down. */
export const VALE_RIVER: WaterRect = { rect: [VALE.x - 50, VALE.x - 40, VALE.z - 120, VALE.z + 125], level: VY - 0.35, bed: VY - 2.2 };
/** The bridge's banks (Vale.ts: the braziers at riverX ± 6.5, bridgeZ ± 3; the slab deck spans the water on its own collider). */
export const VALE_BANKS: readonly [Rect, Rect] = [[VALE.x - 55, VALE.x - 50, VALE.z + 35, VALE.z + 45], [VALE.x - 40, VALE.x - 35, VALE.z + 35, VALE.z + 45]];
/**
 * The cobbled path from the bridge up to the head: Vale.ts's cobble line (from the bridge's west end (949, 939) along
 * −(2, 1)/√5) as far as the head's seat, which it meets just short of the brazier pair at (928, 928.5) ± 2.8 m. It
 * starts on the west bank (clear of the water) and is 4 m wide.
 */
const PATH_DIR = { x: -2 / Math.sqrt(5), z: -1 / Math.sqrt(5) };
const PATH_A = { x: 947.5, z: 939 + (947.5 - 949) * 0.5 };
const PATH_LEN = (() => {
  // The first point along the line from A that is on the seat.
  const ox = PATH_A.x - VALE_HEAD_SEAT.x, oz = PATH_A.z - VALE_HEAD_SEAT.z;
  const b = ox * PATH_DIR.x + oz * PATH_DIR.z;
  const c = ox * ox + oz * oz - VALE_HEAD_SEAT.r * VALE_HEAD_SEAT.r;
  return -b - Math.sqrt(b * b - c);
})();
export const VALE_PATH: Seg = { ax: PATH_A.x, az: PATH_A.z, bx: PATH_A.x + PATH_DIR.x * PATH_LEN, bz: PATH_A.z + PATH_DIR.z * PATH_LEN, r: 2 };
/** Where the path leaves the bank and starts to climb (the west bank's edge, x = X − 55). */
const PATH_FLAT = (PATH_A.x - VALE_BANKS[0][0]) / -PATH_DIR.x;
/** The climb's gradient: the seat's height over the path's run from the bank (5 m over 18 m: 0.277). */
export const VALE_PATH_GRADE = (VALE_HEAD_Y - VY) / (PATH_LEN - PATH_FLAT);
/** The path's height: level on the bank, a straight climb to the seat (a cone round the seat meets it there). */
export const valePathY = (x: number, z: number): number => {
  const s = segT(x, z, VALE_PATH) * PATH_LEN;
  const ramp = VY + VALE_PATH_GRADE * Math.max(0, s - PATH_FLAT);
  const cone = VALE_HEAD_Y - VALE_PATH_GRADE * Math.max(0, sdDisc(x, z, VALE_HEAD_SEAT));
  return Math.min(VALE_HEAD_Y, Math.max(ramp, cone));
};
/** The path as a polyline from the bank over the seat to where the head stands (for the gradient check). */
export const VALE_HEAD_PATH: ReadonlyArray<readonly [number, number]> = [[VALE_PATH.ax, VALE_PATH.az], [VALE_PATH.bx, VALE_PATH.bz], [CROWNED_HEAD.x, CROWNED_HEAD.z]];
/** The floating castle (Vale.ts: X + 130, Z + 10, its rock's foot at vy + 18; half-width 0.37 H) and its chained platforms. */
const VALE_FLOATERS: Floater[] = [
  { name: 'floating-castle', disc: { x: VALE.x + 130, z: VALE.z + 10, r: 0.375 * MODELS['floating-castle'].height + 0.5 }, below: VY + 18 },
  ...([[106, -6, 3], [108, 30, 7], [152, -22, 11], [150, 44, 2]] as const).map(([dx, dz, y], i): Floater => ({
    name: `chained-platform-${i}`, disc: { x: VALE.x + dx, z: VALE.z + dz, r: 0.46 * MODELS['chained-platform'].height + 0.5 }, below: VY + y,
  })),
];

const VALE_SCULPT: RealmSculpt = {
  id: 'vale',
  base: VY,
  pads: [
    // (The green dragon at twice its size: 24 × 22 m round (X, Z − 8).)
    { name: 'dragon', disc: { x: VALE.x, z: VALE.z - 8, r: 24 }, y: VY, blend: 6 },
    // (The houses' boxes reach x 984.5 and 1015.5: the street holds 2 m wider than the plan's 986..1014.)
    { name: 'street', rect: [VALE.x - 16, VALE.x + 16, VALE.z, VALE.z + 110], y: VY, blend: 6 },
    // (The yard is at Z + 58..92: the tavern at +76, tables at +73/+78.4, the fire at +66, barrels to +84.)
    { name: 'tavern-yard', rect: [VALE.x + 4, VALE.x + 34, VALE.z + 58, VALE.z + 92], y: VY, blend: 6 },
    { name: 'arrival', rect: [VALE.x - 8, VALE.x + 8, VALE.z + 104, VALE.z + 116], y: VY, blend: 6 },
    { name: 'bridge-west-bank', rect: VALE_BANKS[0], y: VY, blend: 4 },
    { name: 'bridge-east-bank', rect: VALE_BANKS[1], y: VY, blend: 4 },
    { name: 'crowned-head', disc: VALE_HEAD_SEAT, y: VALE_HEAD_Y, blend: 6 },
    // A spur up the hill: the path's wide blend makes its flanks gentle slopes, not an embankment.
    { name: 'head-path', seg: VALE_PATH, y: valePathY, blend: 10 },
  ],
  // (Off on the crowned head's hill, so it is the smooth mesa its seat needs; back in full past 55 m from its middle.)
  hills: {
    amp: 3.5, wavelength: 55, seed: 23,
    mask: (x, z) => {
      const dx = x - VALE_DOME.disc.x, dz = z - VALE_DOME.disc.z;
      return smoothstep(VALE_DOME.disc.r - 5, VALE_DOME.disc.r + 15, Math.sqrt(dx * dx + dz * dz));
    },
  },
  land: {
    kind: 'pads', margin: 35, wobble: 5,
    // Beyond the pads' 35 m: the hill, the river to both its ends, and the meadows the mobs roam (the fog beasts by the
    // tavern, east toward the castle and over the river; the golems on the hill). The cliff falls east of x ≈ 1085, so the
    // floating castle (x 1115..1145) and its chained platforms (x 1103+) stay over the void.
    extra: [
      { name: 'hill', disc: VALE_DOME.disc },
      { name: 'river-south', disc: { x: VALE.x - 48, z: VALE.z - 88, r: 34 }, margin: 12 },
      { name: 'river-north', disc: { x: VALE.x - 52, z: VALE.z + 110, r: 22 }, margin: 12 },
      { name: 'west-meadow', disc: { x: VALE.x - 70, z: VALE.z + 85, r: 20 }, margin: 10 },
      { name: 'east-meadow', rect: [VALE.x + 40, VALE.x + 70, VALE.z - 55, VALE.z + 5], margin: 12 },
    ],
  },
  edge: { kind: 'cliff', drop: 60, width: 20, lip: 1 },
  water: [VALE_RIVER],
  extraHills: [VALE_DOME],
  layerRects: [
    // The street's cobbles (cobbleFloor was 12 m wide, Z − 15..+115), the path's, the yard trodden to soil round the fire.
    { rect: [VALE.x - 6, VALE.x + 6, VALE.z - 14, VALE.z + 114], layer: 'cobble', warp: 3, blend: 6, fray: 0.3 },
    { seg: VALE_PATH, layer: 'cobble', warp: 1.5, blend: 3, fray: 0.3 },
    { disc: { x: VALE.x + 19, z: VALE.z + 66, r: 7 }, layer: 'soil', warp: 2, blend: 5, fray: 0.4 },
    // The crown: the head's mound stands on bare rock, frayed into the grass of the seat's rim.
    { disc: { x: CROWNED_HEAD.x, z: CROWNED_HEAD.z, r: 14 }, layer: 'rock', warp: 3, blend: 7, fray: 0.3 },
  ],
  defaultLayer: 'grass',
  accent: { layer: 'moss', wavelength: 33, cover: 0.7 },
  grass: true,
  cloudSea: VY - 30,
  sky: 'island',
  clear: VALE_FLOATERS,
};

// ---------- the Sunken City ----------

/** The city's walkable floor (Sunken.ts SUNKEN_FLOOR: the kelp road, the street and the square in one slab). */
export const SUNKEN_PAD: Rect = [-1040, -960, -140, 70];
/**
 * How far the dunes reach from the city's middle before the seabed falls away (the plan's 300 m, cut back): 54 m past
 * the slab's farthest corner (146 m out), further than the murk (fog 0.024) lets anything show; the fall takes
 * SEABED_FALL more. So the field bakes at REALM_CELL like every realm, in 135k vertices (the kingdom's: 118k), not 280k.
 */
export const SEABED_R = 200;

const SUNKEN_SCULPT: RealmSculpt = {
  id: 'sunken',
  base: SUNKEN.y,
  pads: [{ name: 'floor', rect: SUNKEN_PAD, y: SUNKEN.y, blend: 6 }],
  hills: { amp: 1.2, wavelength: 30, seed: 5 },
  land: { kind: 'disc', disc: { x: SUNKEN.x, z: SUNKEN.z, r: SEABED_R } },
  edge: { kind: 'seabed', fall: SEABED_FALL },
  layerRects: [
    // The cobbled way (Sunken.ts: cobbleFloor(X, −40, 16, 130)) and the square before the castle (cobbleFloor(X, −78, 46, 36)).
    { rect: [SUNKEN.x - 8, SUNKEN.x + 8, -105, 25], layer: 'cobble', warp: 3, blend: 6, fray: 0.35 },
    { rect: [SUNKEN.x - 23, SUNKEN.x + 23, -96, -60], layer: 'cobble', warp: 3, blend: 6, fray: 0.35 },
  ],
  defaultLayer: 'seabed',
  accent: { layer: 'sand', wavelength: 25, cover: 0.6 },
  wet: 0.6,
  grass: false,
  cloudSea: null,
  sky: 'island',
};

// ---------- the Alley of Graves ----------

const GX = GRAVEYARD.x, GZ = GRAVEYARD.z;
/**
 * The alley's level floor (Graveyard.ts: the floor box runs z ± 120): x ±3, out to where the plots' rises begin under
 * the walls (those stand at x ±3.4, their alley faces at ±2.78, so they stand on the floor and are banked behind).
 */
export const ALLEY_PAD: Rect = [GX - 3, GX + 3, GZ - 120, GZ + 120];
/**
 * The raised grave plots. Graveyard.ts's boxes span x ±(4.5..16), z −1068..−916 (at x ± 10.25, hw 5.75, z R.z + 8 ± 76),
 * top y0 + 0.6. On the grid their level tops hold x ±(4.5..15), z −1068..−916.5, every grave on them (|x| 5.0..12.6,
 * z −1042.8..−918.7), and each rises linearly over the one column of cells round that, so the drawn plot is exactly the
 * sculpt's: x ±(3..4.5) under and behind the alley's walls (their alley faces stay on the level floor at x ±2.78),
 * ±(15..16.5) at the outer edge, z −1069.5..−1068 and −916.5..−915 at the ends. (A rise of 0.6 m cannot fit between the
 * walls' plot faces at ±4.02 and the first graves at ±5.0 in 1.5 m cells; the walls hide it.) The dead trees Graveyard.ts
 * scatters over |x| 14..20 straddle the outer rise, so step 7 stands every one at h(), which is exact on the drawn ground
 * there. (As under today's plot boxes, two arena braziers (±8, −1062) and the sitting skeletons' stones (±6, −944.7)
 * stand at y0 inside the plots, 0.6 m deep.)
 */
export const PLOT_PADS: readonly [Rect, Rect] = [onGrid([GX + 4.5, GX + 16, GZ - 68, GZ + 84]), onGrid([GX - 16, GX - 4.5, GZ - 68, GZ + 84])];
export const PLOT_Y = GRAVEYARD.y + 0.6;
/** The cyclops lord's arena before the gothic tower (ENEMY_SPAWNS: (0, −1068), a boss's 30 m territory). */
export const ARENA_PAD: Disc = { x: GX, z: GZ - 68, r: 30 };

const GRAVEYARD_SCULPT: RealmSculpt = {
  id: 'graveyard',
  base: GRAVEYARD.y,
  pads: [
    { name: 'alley', rect: ALLEY_PAD, y: GRAVEYARD.y, blend: 3, margin: 20 },
    // Before the plots: graves and the plots' trees stand on them as far south as z −1050, inside the arena's circle.
    { name: 'arena', disc: ARENA_PAD, y: GRAVEYARD.y, blend: 4, margin: 8 },
    { name: 'plot-east', rect: PLOT_PADS[0], y: PLOT_Y, blend: REALM_CELL, ease: 'linear' },
    { name: 'plot-west', rect: PLOT_PADS[1], y: PLOT_Y, blend: REALM_CELL, ease: 'linear' },
  ],
  // Mounds beyond the plots' trees only (they stand on level floor out to |x| 20, the mist sprites low over it).
  hills: { amp: 2, wavelength: 40, seed: 31, mask: (x) => smoothstep(21, 30, Math.abs(x - GX)) },
  land: { kind: 'pads', margin: 22, wobble: 4 },
  edge: { kind: 'cliff', drop: 40, width: 15, lip: 0.8 },
  layerRects: [
    // The alley's cracked slabs (the old shader painted |x| < 2.6..3.2), rock beyond the plots.
    { rect: [GX - 3, GX + 3, GZ - 122, GZ + 122], layer: 'flagstone', warp: 1.5, blend: 3, fray: 0.45 },
    { rect: [GX + 20, GX + 60, GZ - 180, GZ + 180], layer: 'rock', warp: 6, blend: 12, fray: 0.3 },
    { rect: [GX - 60, GX - 20, GZ - 180, GZ + 180], layer: 'rock', warp: 6, blend: 12, fray: 0.3 },
  ],
  defaultLayer: 'moss',
  accent: { layer: 'dead', wavelength: 14, cover: 0.45 },
  grass: true,
  cloudSea: GRAVEYARD.y - 30,
  sky: 'island',
};

export const REALM_SCULPTS: Record<RealmSculpt['id'], RealmSculpt> = {
  galaxy: GALAXY_SCULPT,
  vale: VALE_SCULPT,
  sunken: SUNKEN_SCULPT,
  graveyard: GRAVEYARD_SCULPT,
};

// ---------- the realm compiled ----------

/**
 * A realm compiled once into flat arrays (shape parts, pads, layers, water, floaters), so the per-point functions run
 * over typed arrays rather than the data's many object shapes: a bake asks a few hundred thousand points.
 */
interface Compiled {
  /** Shape parts: kind (0 rect, 1 disc, 2 capsule) and 5 numbers each (rect: cx, cz, hx, hz; disc: x, z, r; capsule: ax, az, bx, bz, r). */
  kind: Uint8Array;
  part: Float64Array;
  /** The land is parts [0, landParts) (the pads', then the extra shapes'), each grown by its margin and warped by its wobble. */
  landParts: number;
  margin: Float64Array;
  wobble: Float64Array;
  /** A disc of land instead (the seabed): x, z, r, wobble. */
  disc: readonly [number, number, number, number] | null;
  /** Pads in order: their parts [start, end), blend (smoothstep, or `linear`), and height (a number, or `fn`). */
  pads: Array<{ start: number; end: number; blend: number; linear: boolean; y: number; fn: ((x: number, z: number) => number) | null }>;
  /** Layer rects in order: their parts, texture index, warp, blend, fray, how far past the shape they can reach and how deep inside they are solid. */
  layers: Array<{ start: number; end: number; layer: number; warp: number; blend: number; fray: number; reach: number; solid: number }>;
  /** Water rects: cx, cz, hx, hz, level, bed, bank, cut (1 or 0) (WATER_STRIDE each). */
  water: Float64Array;
  /** Extra hills (domes): x, z, r, inner radius, height (5 each). */
  domes: Float64Array;
  /** Floaters: x, z, r, gap (4 each): the land keeps `gap` metres back from each disc. */
  clear: Float64Array;
  /** The fbm hills: amplitude, 1 / wavelength, offsets, mask. */
  amp: number;
  invL: number;
  ox: number;
  oz: number;
  mask: ((x: number, z: number) => number) | null;
  /** The edge: a cliff (drop, width, lip) or a seabed (fall). */
  cliff: boolean;
  drop: number;
  width: number;
  lip: number;
  fall: number;
  /** How far past the border the edge reaches the abyss. */
  reach: number;
}

const COMPILED = new WeakMap<RealmSculpt, Compiled>();
const WATER_STRIDE = 8;

/** The cliff from `top` at the border down past base − drop at `width` to the abyss (one smoothstep, no shelf). */
function cliffHeight(top: number, e: number, base: number, drop: number, width: number): number {
  const bottom = base - drop;
  if (top <= bottom + 1e-6) return lerp(top, ABYSS_Y, smoothstep(0, 2 * width, e));
  const run = width / smoothstepInverse((top - bottom) / (top - ABYSS_Y));
  return top - (top - ABYSS_Y) * smoothstep(0, run, e);
}

function compile(s: RealmSculpt): Compiled {
  const done = COMPILED.get(s);
  if (done) return done;
  const kinds: number[] = [], nums: number[] = [], margins: number[] = [], wobbles: number[] = [];
  const push = (sh: Shape, margin = 0, wobble = 0): { start: number; end: number } => {
    const start = kinds.length;
    if (sh.rect) { const r = sh.rect; kinds.push(0); nums.push((r[0] + r[1]) * 0.5, (r[2] + r[3]) * 0.5, (r[1] - r[0]) * 0.5, (r[3] - r[2]) * 0.5, 0); margins.push(margin); wobbles.push(wobble); }
    if (sh.disc) { const d = sh.disc; kinds.push(1); nums.push(d.x, d.z, d.r, 0, 0); margins.push(margin); wobbles.push(wobble); }
    if (sh.seg) { const g = sh.seg; kinds.push(2); nums.push(g.ax, g.az, g.bx, g.bz, g.r); margins.push(margin); wobbles.push(wobble); }
    return { start, end: kinds.length };
  };
  const L = s.land;
  const pads = s.pads.map((p) => {
    const r = L.kind === 'pads' ? push(p, p.margin ?? L.margin, p.wobble ?? L.wobble) : push(p);
    return { ...r, blend: p.blend, linear: p.ease === 'linear', y: typeof p.y === 'number' ? p.y : 0, fn: typeof p.y === 'number' ? null : p.y };
  });
  if (L.kind === 'pads' && L.extra) for (const l of L.extra) push(l, l.margin ?? L.margin, l.wobble ?? L.wobble);
  const landParts = L.kind === 'pads' ? kinds.length : 0;
  const layers = s.layerRects.map((l) => ({
    ...push(l), layer: LAYER[l.layer], warp: l.warp, blend: l.blend, fray: l.fray ?? 0,
    reach: l.blend * 0.5 + l.warp + 0.5, solid: l.blend * 1.25 + l.warp + 0.5,
  }));
  const water: number[] = [];
  for (const w of s.water ?? []) water.push((w.rect[0] + w.rect[1]) * 0.5, (w.rect[2] + w.rect[3]) * 0.5, (w.rect[1] - w.rect[0]) * 0.5, (w.rect[3] - w.rect[2]) * 0.5, w.level, w.bed, w.bank ?? WATER_BANK, w.cut === false ? 0 : 1);
  const domes: number[] = [];
  for (const h of s.extraHills ?? []) domes.push(h.disc.x, h.disc.z, h.disc.r, h.disc.r * (1 - Math.min(1, Math.max(1e-3, h.falloff))), h.height);
  const edge = s.edge;
  const cliff = edge.kind === 'cliff';
  const drop = cliff ? edge.drop : 0, width = cliff ? edge.width : 0, lip = cliff ? edge.lip : 0;
  const fall = cliff ? 0 : edge.fall ?? SEABED_FALL;
  // The rim never stands lower than the lowest pad, bed or floor less the hills.
  let low = s.base, high = s.base;
  for (const p of s.pads) if (typeof p.y === 'number') { low = Math.min(low, p.y); high = Math.max(high, p.y); }
  for (const w of s.water ?? []) low = Math.min(low, w.bed);
  const lowTop = low - s.hills.amp - 1;
  const reach = !cliff ? fall : lowTop <= s.base - drop ? 2 * width : width / smoothstepInverse((lowTop - s.base + drop) / (lowTop - ABYSS_Y));
  // Each floater's gap: the least distance past the border at which even the highest rim has fallen 0.5 m below it.
  const clear: number[] = [];
  const topHigh = high + s.hills.amp + lip + 0.5;
  for (const f of s.clear ?? []) {
    const under = (e: number) => (cliff ? cliffHeight(topHigh, e, s.base, drop, width) : lerp(topHigh, ABYSS_Y, smoothstep(0, fall, e))) <= f.below - 0.5;
    let lo = 0, hi = 4 * reach + 10;
    if (under(0)) hi = 0;
    for (let i = 0; i < 48 && hi > 0; i++) { const mid = (lo + hi) / 2; if (under(mid)) hi = mid; else lo = mid; }
    clear.push(f.disc.x, f.disc.z, f.disc.r, hi);
  }
  const H = s.hills;
  const c: Compiled = {
    kind: Uint8Array.from(kinds), part: Float64Array.from(nums), landParts, margin: Float64Array.from(margins), wobble: Float64Array.from(wobbles),
    disc: L.kind === 'disc' ? [L.disc.x, L.disc.z, L.disc.r, L.wobble ?? 0] : null,
    pads, layers, water: Float64Array.from(water), domes: Float64Array.from(domes), clear: Float64Array.from(clear),
    amp: H.amp, invL: 1 / H.wavelength, ox: H.seed * 7.31, oz: -H.seed * 3.17, mask: H.mask ?? null,
    cliff, drop, width, lip, fall, reach,
  };
  COMPILED.set(s, c);
  return c;
}

/** Signed distance to a box by its centre and half extents (sdRect's arithmetic, allocation-free). */
function sdBox(x: number, z: number, cx: number, cz: number, hx: number, hz: number): number {
  const dx = Math.abs(x - cx) - hx, dz = Math.abs(z - cz) - hz;
  const ox = dx > 0 ? dx : 0, oz = dz > 0 ? dz : 0;
  return Math.sqrt(ox * ox + oz * oz) + Math.min(Math.max(dx, dz), 0);
}

/** Signed distance to compiled part `i`. */
function sdPart(c: Compiled, i: number, x: number, z: number): number {
  const P = c.part, o = i * 5;
  const k = c.kind[i];
  if (k === 0) return sdBox(x, z, P[o], P[o + 1], P[o + 2], P[o + 3]);
  if (k === 1) {
    const dx = x - P[o], dz = z - P[o + 1];
    return Math.sqrt(dx * dx + dz * dz) - P[o + 2];
  }
  const ax = P[o], az = P[o + 1], ex = P[o + 2] - ax, ez = P[o + 3] - az;
  const l2 = ex * ex + ez * ez;
  let t = l2 < 1e-9 ? 0 : ((x - ax) * ex + (z - az) * ez) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = x - ax - ex * t, dz = z - az - ez * t;
  return Math.sqrt(dx * dx + dz * dz) - P[o + 4];
}

/** Signed distance to the union of parts [start, end). */
function sdParts(c: Compiled, start: number, end: number, x: number, z: number): number {
  let d = Infinity;
  for (let i = start; i < end; i++) { const v = sdPart(c, i, x, z); if (v < d) d = v; }
  return d;
}

// ---------- pads, land, height ----------

const PAD_TMP = { mask: 0, y: 0 };

/** The pads' sequential blend at (x, z) into `out` (allocation-free; see padMask). */
function padBlend(c: Compiled, base: number, x: number, z: number, out: { mask: number; y: number }): { mask: number; y: number } {
  // h = lerp(free, y, mask) after each pad's lerp(h, py, t): mask' = 1 − (1 − mask)(1 − t), y' = (mask (1 − t) y + t py) / mask'.
  let m = 0, y = base;
  const pads = c.pads;
  for (let i = 0; i < pads.length; i++) {
    const p = pads[i];
    const d = sdParts(c, p.start, p.end, x, z);
    if (d >= p.blend) continue;
    const t = d <= 0 ? 1 : p.linear ? 1 - d / p.blend : 1 - smoothstep(0, p.blend, d);
    if (t <= 0) continue;
    const py = p.fn ? p.fn(x, z) : p.y;
    const m2 = 1 - (1 - m) * (1 - t);
    y = t >= 1 ? py : (m * (1 - t) * y + t * py) / m2;
    m = m2;
  }
  out.mask = m;
  out.y = y;
  return out;
}

/**
 * How much the pads hold (x, z), 0..1, and the height they hold it at: the realm's ground there is
 * `lerp(free, y, mask)`, exactly the sequential `PADS` blend of world/Terrain.ts (a later pad overrides an earlier one).
 */
export function padMask(s: RealmSculpt, x: number, z: number): { mask: number; y: number } {
  return padBlend(compile(s), s.base, x, z, { mask: 0, y: 0 });
}

/** The land border's fbm warp at (x, z), about −1..1. */
function borderWarp(x: number, z: number, noise: Noise2D): number {
  return noise.fbm(x / BORDER_WAVELENGTH + 41.3, z / BORDER_WAVELENGTH - 17.9, 2);
}

/** The land's signed distance at (x, z) for a given border warp `w` (−1..1). */
function landSd(c: Compiled, x: number, z: number, w: number): number {
  let e: number;
  const D = c.disc;
  if (D) {
    const dx = x - D[0], dz = z - D[1];
    e = Math.sqrt(dx * dx + dz * dz) - D[2] - D[3] * w;
  } else {
    e = Infinity;
    for (let i = 0; i < c.landParts; i++) { const v = sdPart(c, i, x, z) - c.margin[i] - c.wobble[i] * w; if (v < e) e = v; }
  }
  const F = c.clear;
  for (let i = 0; i < F.length; i += 4) {
    const dx = x - F[i], dz = z - F[i + 1];
    const v = F[i + 3] + F[i + 2] - Math.sqrt(dx * dx + dz * dz);
    if (v > e) e = v;
  }
  return e;
}

/**
 * Signed distance to the land's warped border in metres: negative inside, positive past it (where the cliff or the
 * seabed's fall is). The pads (and extra shapes) dilated by their margin, warped ±wobble, with the floaters cut out.
 */
export function landDistance(s: RealmSculpt, x: number, z: number, noise: Noise2D): number {
  return landSd(compile(s), x, z, borderWarp(x, z, noise));
}

/** 1 on the land, 0 past its border, falling over the last LAND_SOFT metres inside the warped border. */
export function landMask(s: RealmSculpt, x: number, z: number, noise: Noise2D): number {
  return 1 - smoothstep(-LAND_SOFT, 0, landDistance(s, x, z, noise));
}

/** Banks raised above each water rect's surface round it, the ground inside cut down to its bed (unless a pad shapes it). */
function applyWater(c: Compiled, x: number, z: number, h: number): number {
  const W = c.water;
  for (let i = 0; i < W.length; i += WATER_STRIDE) {
    const d = sdBox(x, z, W[i], W[i + 1], W[i + 2], W[i + 3]);
    if (d >= BANK_OUT) continue;
    const shore = W[i + 4] + FREEBOARD;
    if (d > 0) {
      if (h < shore) h = lerp(h, shore, 1 - smoothstep(WATER_BANK, BANK_OUT, d));
      continue;
    }
    if (!W[i + 7]) continue;
    const bank = W[i + 6];
    h = bank > 0 ? lerp(Math.max(h, shore), W[i + 5], smoothstep(0, bank, -d)) : W[i + 5];
  }
  return h;
}

/**
 * The realm's ground height at (x, z). Inside the land: `base + hills · (1 − padMask) + extraHills`, the pads lerped
 * to their y, the water rects cut to their beds, the lip rising toward the border off the pads. Past the border: the
 * cliff falls `drop` metres over `width` metres and on to WORLD.abyssY (or the seabed falls away gently).
 */
export function realmHeight(s: RealmSculpt, x: number, z: number, noise: Noise2D): number {
  const c = compile(s);
  const e = landSd(c, x, z, borderWarp(x, z, noise));
  if (e >= c.reach) return ABYSS_Y;
  const pm = padBlend(c, s.base, x, z, PAD_TMP);
  let free = s.base;
  if (c.amp !== 0 && pm.mask < 1) {
    const m = c.mask ? c.mask(x, z) : 1;
    if (m > 0) free += c.amp * m * (1 - pm.mask) * noise.fbm(x * c.invL + c.ox, z * c.invL + c.oz, 3);
  }
  const X = c.domes;
  for (let i = 0; i < X.length; i += 5) {
    const dx = x - X[i], dz = z - X[i + 1];
    const d = Math.sqrt(dx * dx + dz * dz);
    if (d < X[i + 2]) free += X[i + 4] * (1 - smoothstep(X[i + 3], X[i + 2], d));
  }
  let h = pm.mask > 0 ? lerp(free, pm.y, pm.mask) : free;
  if (c.water.length) h = applyWater(c, x, z, h);
  if (c.cliff) {
    h += c.lip * (1 - pm.mask) * smoothstep(-LIP_RISE, 0, e);
    if (e > 0) h = cliffHeight(h, e, s.base, c.drop, c.width);
  } else if (e > 0) h = lerp(h, ABYSS_Y, smoothstep(0, c.fall, e));
  return h;
}

// ---------- layers ----------

/** Paints `layer` over the texture weights with coverage `c` (what lies under keeps 1 − c of itself). */
function paint(out: Float32Array, layer: number, c: number): void {
  if (!(c > 0)) return;
  if (c >= 1) {
    for (let i = 0; i < TEXTURE_LAYERS; i++) out[i] = 0;
    out[layer] = 1;
    return;
  }
  for (let i = 0; i < TEXTURE_LAYERS; i++) out[i] *= 1 - c;
  out[layer] += c;
}

/** A layer rect's coverage at (x, z): its fbm-warped border blended over `blend`, its fringe frayed into holes. */
function coverage(c: Compiled, L: Compiled['layers'][number], x: number, z: number, noise: Noise2D | null): number {
  let d = sdParts(c, L.start, L.end, x, z);
  if (d > L.reach) return 0;
  // Deeper inside than the warp and the frayed fringe can reach: solid.
  if (d < -L.solid) return 1;
  if (noise && L.warp > 0) {
    const k = 1 / (6 * L.warp);
    d += L.warp * noise.fbm(x * k + 3.3, z * k + 8.8, 2);
  }
  let v = 1 - smoothstep(-L.blend * 0.5, L.blend * 0.5, d);
  if (v > 0 && noise && L.fray > 0) {
    const edge = smoothstep(-L.blend * 1.25, L.blend * 0.25, d);
    if (edge > 0) {
      const n = 0.5 + 0.5 * noise.fbm(x * 0.33 + 17.1, z * 0.33 - 5.3, 2);
      const th = 1 - L.fray * edge;
      v *= 1 - smoothstep(th - 0.06, th + 0.06, n);
    }
  }
  return v;
}

/** The layer weights; with `noise` null, the noise-free version (unwarped borders, no fray, the accent at its mean). */
function layerWeights(s: RealmSculpt, x: number, z: number, slope: number, noise: Noise2D | null, out: Float32Array): void {
  const c = compile(s);
  for (let i = 0; i < LAYER_COUNT; i++) out[i] = 0;
  // Wet within 3 m of water (or everywhere, under the sea).
  let wet = s.wet ?? 0;
  const W = c.water;
  for (let i = 0; i < W.length; i += WATER_STRIDE) wet = Math.max(wet, 1 - smoothstep(0, 3, sdBox(x, z, W[i], W[i + 1], W[i + 2], W[i + 3])));
  out[LAYER.wet] = Math.min(1, Math.max(0, wet));
  // Out on the cliff band and beyond, nothing but rock.
  const e = landSd(c, x, z, noise ? borderWarp(x, z, noise) : 0);
  const band = c.cliff ? smoothstep(-1.5, 1.5, e) : 0;
  if (band >= 1) { out[LAYER.rock] = 1; return; }
  out[LAYER[s.defaultLayer]] = 1;
  const a = s.accent;
  if (a) {
    let k = noise ? smoothstep(-0.15, 0.4, noise.fbm(x / a.wavelength + 13.7, z / a.wavelength - 4.1, 3)) : 0.35;
    if (a.flat) k *= 1 - smoothstep(0.2, 0.45, slope);
    paint(out, LAYER[a.layer], k * a.cover);
  }
  const layers = c.layers;
  for (let i = 0; i < layers.length; i++) paint(out, layers[i].layer, coverage(c, layers[i], x, z, noise));
  // The bed under the water.
  for (let i = 0; i < W.length; i += WATER_STRIDE) {
    paint(out, LAYER.seabed, 1 - smoothstep(-1.5, 0.5, sdBox(x, z, W[i], W[i + 1], W[i + 2], W[i + 3])));
  }
  paint(out, LAYER.rock, Math.max(smoothstep(0.45, 0.8, slope), band));
}

/**
 * The 12 layer weights (render/Ground.ts LAYER order) at (x, z) into `out`: the default ground and its accent, the
 * layer rects (fbm-warped borders, frayed fringes), the beds under the water, rock by slope (smoothstep 0.45..0.8) and on
 * the cliff band, `wet` near water. The eleven texture weights sum to 1.
 */
export function realmLayers(s: RealmSculpt, x: number, z: number, _h: number, slope: number, noise: Noise2D, out: Float32Array): void {
  layerWeights(s, x, z, slope, noise, out);
}

// ---------- far tint ----------

/** A '0xrrggbb' sRGB colour as linear rgb (three's Color does the same on `new Color(hex)`). */
function linear(hex: number): readonly [number, number, number] {
  const c = (v: number) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return [c((hex >> 16) & 255), c((hex >> 8) & 255), c(hex & 255)];
}

/** The island's ground palette (world/Terrain.ts's vertex colours), in linear rgb. */
export const ISLAND_PALETTE = {
  navy: linear(0x121d48), moss: linear(0x163a33), stone: linear(0x3d4a80), snow: linear(0x9fb3e6),
  riverBed: linear(0x0c1a4a), sand: linear(0xa9b2cf), dead: linear(0x4a1430), path: linear(0x34426f),
} as const;

/** Each texture layer's colour in the island's palette (rock: navy on the level, stone on slopes; marble keeps its own). */
function paletteOf(k: number, slope: number, out: [number, number, number]): void {
  const P = ISLAND_PALETTE;
  let c: readonly number[];
  switch (k) {
    case LAYER.grass: case LAYER.moss: c = P.moss; break;
    case LAYER.rock: {
      const t = smoothstep(0.3, 0.85, slope);
      out[0] = lerp(P.navy[0], P.stone[0], t); out[1] = lerp(P.navy[1], P.stone[1], t); out[2] = lerp(P.navy[2], P.stone[2], t);
      return;
    }
    case LAYER.soil: case LAYER.flagstone: case LAYER.cobble: c = P.path; break;
    case LAYER.snow: c = P.snow; break;
    case LAYER.sand: c = P.sand; break;
    case LAYER.dead: c = P.dead; break;
    case LAYER.seabed: c = P.riverBed; break;
    default: { const t = LAYER_TINT[k]; out[0] = t[0] * GROUND_ALBEDO; out[1] = t[1] * GROUND_ALBEDO; out[2] = t[2] * GROUND_ALBEDO; return; }
  }
  out[0] = c[0]; out[1] = c[1]; out[2] = c[2];
}

const TINT_W = new Float32Array(LAYER_COUNT);
const TINT_C: [number, number, number] = [0, 0, 0];

/**
 * The far tint at (x, z) (linear albedo, what the ground shows past the detail distance): the layers' own average
 * colours at the lit albedo, leaned TINT_PALETTE_MIX toward the island's palette (navy/moss/stone/snow/seabed), darkened
 * where wet. `weights` are the layer weights there if known (sculptFor passes realmLayers'); without them the
 * noise-free weights are used.
 */
export function realmTint(s: RealmSculpt, x: number, z: number, _h: number, slope: number, out: { r: number; g: number; b: number }, weights?: ArrayLike<number>): void {
  let w: ArrayLike<number>;
  if (weights) w = weights;
  else {
    layerWeights(s, x, z, slope, null, TINT_W);
    w = TINT_W;
  }
  let sum = 0, lr = 0, lg = 0, lb = 0, pr = 0, pg = 0, pb = 0;
  for (let k = 0; k < TEXTURE_LAYERS; k++) {
    const wk = w[k] > 0 ? w[k] : 0;
    if (wk === 0) continue;
    sum += wk;
    const t = LAYER_TINT[k];
    lr += t[0] * wk; lg += t[1] * wk; lb += t[2] * wk;
    paletteOf(k, slope, TINT_C);
    pr += TINT_C[0] * wk; pg += TINT_C[1] * wk; pb += TINT_C[2] * wk;
  }
  if (sum <= 1e-6) {
    // Nothing painted: grass, as the bake does.
    const t = LAYER_TINT[LAYER.grass];
    lr = t[0]; lg = t[1]; lb = t[2];
    paletteOf(LAYER.grass, slope, TINT_C);
    [pr, pg, pb] = TINT_C;
    sum = 1;
  }
  const wet = Math.min(1, Math.max(0, w[LAYER.wet] || 0));
  const dark = 1 - WET_DARKEN * wet;
  const k = GROUND_ALBEDO * dark / sum;
  const m = TINT_PALETTE_MIX;
  out.r = lerp(lr * k, (pr / sum) * dark, m);
  out.g = lerp(lg * k, (pg / sum) * dark, m);
  out.b = lerp(lb * k, (pb / sum) * dark, m);
}

// ---------- the grid ----------

/**
 * The square the realm's ground is baked over: the land's bounds (every shape grown by its margin and wobble), grown
 * by how far the edge reaches, made square and snapped to the world-aligned grid (corner and vertices at multiples of
 * REALM_CELL, where the sharp edges lie).
 */
export function realmField(s: RealmSculpt): { x0: number; z0: number; size: number } {
  const cell = REALM_CELL;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const grow = (b: { x0: number; x1: number; z0: number; z1: number }, m: number) => {
    x0 = Math.min(x0, b.x0 - m); x1 = Math.max(x1, b.x1 + m); z0 = Math.min(z0, b.z0 - m); z1 = Math.max(z1, b.z1 + m);
  };
  const L = s.land;
  if (L.kind === 'disc') grow(shapeBounds({ disc: L.disc }), L.wobble ?? 0);
  else {
    for (const p of s.pads) grow(shapeBounds(p), (p.margin ?? L.margin) + (p.wobble ?? L.wobble));
    if (L.extra) for (const l of L.extra) grow(shapeBounds(l), (l.margin ?? L.margin) + (l.wobble ?? L.wobble));
  }
  const reach = compile(s).reach + 2 * cell;
  x0 -= reach; x1 += reach; z0 -= reach; z1 += reach;
  // (Two cells over: snapping the corner down to the grid can shift the square by up to one.)
  const n = Math.ceil(Math.max(x1 - x0, z1 - z0) / cell) + 2;
  const size = n * cell;
  const snap = (c: number) => Math.floor((c - size / 2) / cell) * cell;
  return { x0: snap((x0 + x1) / 2), z0: snap((z0 + z1) / 2), size };
}

/**
 * The realm as render/Ground.ts's Sculpt: its field square at REALM_CELL, chunks that are all abyss skipped
 * (`voidBelow`), and height/layers/tint closures over this module's functions. The tint reuses the weights `layers`
 * just wrote for the same vertex (Heightfield.bake asks for both in turn).
 */
export function sculptFor(s: RealmSculpt, noise: Noise2D): Sculpt {
  const f = realmField(s);
  const last = new Float32Array(LAYER_COUNT);
  let lx = NaN, lz = NaN, ls = NaN;
  return {
    x0: f.x0,
    z0: f.z0,
    size: f.size,
    cell: REALM_CELL,
    voidBelow: ABYSS_Y + 1,
    height: (x, z) => realmHeight(s, x, z, noise),
    layers: (x, z, h, slope, out) => {
      realmLayers(s, x, z, h, slope, noise, out);
      last.set(out);
      lx = x; lz = z; ls = slope;
    },
    tint: (x, z, h, slope, out) => {
      if (x !== lx || z !== lz || slope !== ls) {
        realmLayers(s, x, z, h, slope, noise, last);
        lx = x; lz = z; ls = slope;
      }
      realmTint(s, x, z, h, slope, out, last);
    },
  };
}

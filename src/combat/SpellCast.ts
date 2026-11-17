/**
 * The twelve spells in the game (Spells.ts holds their numbers; the user's calls of 2026-11-15). Each is built from the
 * pieces the fight already has — hits, the cast's flash and sparks, shock rings, dust — plus what the destruction pass
 * added: smashing what stands (Breakables), digging and scorching the ground (Craters), tearing limbs (Blood Moon), and
 * a rune circle where it is aimed. A shot flies from the hero's hand to the aim point and lands there.
 */
import { Color, Group, Mesh, MeshStandardMaterial, OctahedronGeometry, Vector3, type Object3D } from 'three';
import { ChainFx } from '../render/ChainFx';
import { SpikeField } from '../render/SpikeField';
import { WaterFx } from '../render/WaterFx';
import { EARTH_DUST, ReelMoves } from './ReelMoves';
export { EARTH_DUST };
import type { ControllerState } from '../player/CharacterController';
import type { CombatFx } from '../render/CombatFx';
import type { Audio } from '../audio/Audio';
import type { DebrisSim, Piece } from '../world/Debris';
import type { BlowKind } from '../world/Breakables';
import { RuneCircles } from '../render/RuneCircle';
import { Explosions } from '../render/Explosion';
import { GroundFires } from '../render/GroundFire';
import { BlackHoleFx, FireTornadoFx, StormTornadoFx } from '../render/VortexFx';
import { LEAP_RANGE, flightPoint, shotArc, tornadoStep, HOLE_LIFT } from './Aim';
import { StoneWall, STAND, wallSource } from './StoneWall';
import { Lightning } from '../render/Lightning';
import { spellMissile, type SpellMissile } from '../render/SpellMissile';
import { SPELLS, type SpellDef } from './Spells';
import type { Element } from './Elements';
import type { Enemy } from './Enemy';

/** Lights a spell holds or flashes (LightBudget). */
const _white = new Color(0xffffff);

export interface SpellLights {
  flash(at: Vector3, color: number, intensity: number, distance: number, seconds: number): void;
  hold(color: number, intensity: number, distance: number): { pos: Vector3; intensity: number; done: boolean };
}

export interface SpellHost {
  readonly enemies: Enemy[];
  readonly controller: ControllerState;
  readonly fx: CombatFx;
  readonly audio: Audio;
  readonly scene: Object3D;
  element(): Element;
  /** A spell's blow on `e` (the hero's attack times `mult`). */
  hit(e: Enemy, mult: number, knockback: number, hitStop: number, at?: Vector3): void;
  reachable(e: Enemy, r: number, at: Vector3): boolean;
  smash(x: number, y: number, z: number, r: number, kind: BlowKind): void;
  /** Damage over time on `e` (a fire it stands in): no kick, no combo, no heavy-hit feel. Falls back to `hit`. */
  burn?(e: Enemy, mult: number, knockback?: number, hitStop?: number): void;
  /** A vortex tears up to `count` standing blocks loose within `r` of (x, z); returns how many came loose. */
  tear?(x: number, z: number, r: number, count: number): number;
  dig(x: number, z: number, r: number, depth: number, scorch?: 'burnt' | 'frozen'): void;
  shake(n: number): void;
  heightAt(x: number, z: number, y: number): number;
  /** Every live debris sim (rubble, body parts): the black hole and the winds move their pieces. */
  debris(): DebrisSim[];
  /** Blood Moon on for `seconds` (red sky, every blow severs, kills heal). */
  bloodMoon(seconds: number): void;
  /** Rock Armor: the hero takes half damage for `seconds`. */
  armor?(seconds: number): void;
  announce(text: string): void;
  /** A short line under the crosshair ("No target"). */
  tip?(text: string): void;
  /** A fresh copy of a reel flora model (Overgrowth), or null before it loads. */
  sprout?(ids: string[]): { object: Group; scale: number } | null;
  /** A loaded Meshy model by id (the Stone Wall's stone), or null while it loads (asking starts the load). */
  model?(id: string): Object3D | null;
  /** A solid trunk at (x, z) while a grown tree stands; returns its remover. */
  solid?(x: number, z: number, r: number, top: number): () => void;
  lights?: SpellLights;
  /** Billowing smoke or dust rising from (at), `r` metres across at its base (render/Billow). */
  smoke?: (at: Vector3, r: number, color: number, life: number) => void;
}

interface Flight { mesh: Object3D; missile: SpellMissile; from: Vector3; to: Vector3; t: number; T: number; arc: number; spell: SpellDef; color: number }
interface Hole { at: Vector3; cy: number; t: number; tick: number; tearAt: number; fx: BlackHoleFx; light?: { pos: Vector3; intensity: number; done: boolean }; lifted: Map<Enemy, { a: number; r: number }>; eaten: Set<Enemy> }
interface Tornado {
  kind: 'fire' | 'storm';
  at: Vector3; dir: { x: number; z: number }; t: number; tick: number; scorch: number; tearAt: number; boltAt: number;
  fx: FireTornadoFx | StormTornadoFx; light?: { pos: Vector3; intensity: number; done: boolean };
  /** Mobs whirled up its funnel: angle round it, height climbed, seconds up. */
  lifted: Map<Enemy, { a: number; y: number; t: number }>;
}
interface Plant { obj: Group; to: number; t: number; grow: number; life: number; remove?: () => void }
interface Rooted { e: Enemy; left: number; tick: number }
interface Slam { at: Vector3; t: number }
interface Charge { left: number; dir: { x: number; z: number }; hit: Set<number>; tear?: number }

/** The reel's stacked circles: how many over each spell's target, and how high the top one stands. */
/** Earthsplitter's fissure: how fast it runs (m/s), a burst of spikes every FISSURE_STEP m, each reaching this far. */
const FISSURE_SPEED = 26, FISSURE_STEP = 0.75, FISSURE_REACH = 1.5;
const RUNE_STACK: Partial<Record<string, { stack: number; height: number }>> = {
  fireball: { stack: 3, height: 7 }, moonbomb: { stack: 3, height: 6 }, 'storm-arrow': { stack: 2, height: 9 },
  'frost-arrow': { stack: 2, height: 3 }, earthsplitter: { stack: 2, height: 3 }, 'black-hole': { stack: 4, height: 10 },
  starfall: { stack: 3, height: 12 }, 'moon-volley': { stack: 2, height: 8 }, 'trip-volley': { stack: 2, height: 5 },
  'stone-wall': { stack: 2, height: 3 }, 'storm-tornado': { stack: 3, height: 10 }, overgrowth: { stack: 2, height: 4 },
};

const HOLE_S = 5.5;
/** The black hole opens this high over where it is aimed (the reel: in the sky, over the temple). */
const HOLE_UP = 10;
/** How big its disc is drawn, over BlackHoleFx's own size (in the sky it must read from the ground). */
const HOLE_SIZE = 2.4;
/** A body this close to the core is eaten. */
const HOLE_EAT = 1.6;
const TORNADO_S = 7;
const TORNADO_RUN = 18;
const STORM_S = 6;
const STORM_RUN = 6;
const PLANT_LIFE = 20;

const _v = new Vector3();
const _w = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

function ground(p: Vector3, h: SpellHost): Vector3 { p.y = h.heightAt(p.x, p.z, p.y + 2); return p; }


/** How big each bar skill's landing is (metres round, fires left, blocks torn off, smoke share). */
const SKILL_IMPACT = {
  star: { r: 1.8, fires: 3, tear: 5, smoke: 0.8 },
  crescent: { r: 1.6, fires: 0, tear: 8, smoke: 0.6 },
  arrow: { r: 0.6, fires: 0, tear: 2, smoke: 0.3 },
} as const;

/**
 * The black hole's collapse: a deep violet blast (a pale violet let the white-hot core take over, and it burst as a
 * flat white disc) and a flash that lights the scene round it without blowing it out.
 */
/** Gale Shot's cone: ±0.55 rad (about 32°) off her heading. */
const GALE_HALF = 0.55;

/** The trail id Wrecking Charge's speed wake owns. */
const CHARGE_TRAIL = 'wrecking-charge';

export const HOLE_BURST = { hot: 0x7a3cff, flash: 60 } as const;

/**
 * Moonbomb's landing (playtest 2026-11-17: "it blinds the screen"): a cold blue burst, not the old ice-white cloud
 * that bloomed to white, a light that stays modest, and the reel's ice shards (Flowbound, video 2 t37) flying out.
 */
export const MOON_BURST = { hot: 0x2f6fd0, light: 18, size: 0.8, shards: 16 } as const;
/** Chain Hook: how far down the crosshair's line it reaches, and how far off that line it still catches. */
export const HOOK = { reach: 20, side: 2.5 } as const;

const SHARD_LIFE = 4;
let shardGeo: OctahedronGeometry | null = null;
let shardMat: MeshStandardMaterial | null = null;
interface Shard { mesh: Mesh; p: Piece; t: number; sim: DebrisSim }

export class SpellCast {
  readonly runes = new RuneCircles();
  readonly lightning = new Lightning(6);
  /** The reel's volumetric blasts and the fires they leave (v12). */
  readonly explosions = new Explosions(600);
  readonly fires = new GroundFires(120);
  private burnTick = 0;
  /** Sir Aldric's Stone Wall: the one standing, and those kicked or crumbled whose rubble still lies about. */
  private wall: StoneWall | null = null;
  private readonly rubble: StoneWall[] = [];
  /** Earthsplitter's fissure running to its end: where it is along its line, who it has tossed. */
  private fissure: { from: Vector3; end: Vector3; dir: { x: number; z: number }; len: number; d: number; next: number; hit: Set<Enemy> } | null = null;
  private spikeField: SpikeField | null = null;
  private iceField: SpikeField | null = null;
  private readonly water = new WaterFx();
  /** The second page's moves (Shift+1-7). */
  readonly reel: ReelMoves;
  private readonly flights: Flight[] = [];
  private readonly holes: Hole[] = [];
  private readonly tornados: Tornado[] = [];
  private readonly plants: Plant[] = [];
  private readonly rooted: Rooted[] = [];
  private slam: Slam | null = null;
  private charge: Charge | null = null;
  private readonly shards: Shard[] = [];
  readonly chain = new ChainFx();
  /** Seconds each frozen body has left, by enemy id (killed while frozen, it shatters into ice). */
  readonly frozen = new Map<number, number>();
  /** How high over its aim point the next black hole opens (set while it is aimed; Aim.holeLift). */
  holeLift: number = HOLE_LIFT.sky;

  constructor(private readonly h: SpellHost) {
    h.scene.add(this.runes.group);
    h.scene.add(this.explosions.mesh, this.fires.mesh);
    h.scene.add(this.lightning.group);
    h.scene.add(this.chain.mesh);
    h.scene.add(this.water.mesh);
    this.reel = new ReelMoves(h, {
      blast: (at, r, mult, knock, stop, skip) => this.blast(at, r, mult, knock, stop, skip),
      boom: (at, color, r, shake) => this.boom(at, color, r, shake),
      quake: (at, r, shake) => this.quake(at, r, shake),
      spikes: () => this.spikes,
      ice: () => this.ice,
      water: this.water,
      explosions: this.explosions,
      fires: this.fires,
      iceBurst: (at, s) => this.iceBurst(at, s),
      shot: (s, from, to, T, arc) => this.fly(s, from, to, T, arc),
      lineTarget: (from, aim) => hookTarget(this.h.enemies.filter((e) => e.alive && !e.held), from, aim),
    });
  }

  /** Casts `hero`'s spell in `slot` at `aim` (the crosshair's ground point). */
  cast(hero: string, slot: number, aim: Vector3): SpellDef | null {
    const s = SPELLS[hero]?.[slot];
    if (!s) return null;
    const h = this.h;
    const c = h.controller;
    const hand = new Vector3(c.pos.x + Math.cos(c.yaw) * 0.6, c.pos.y + 1.5, c.pos.z + Math.sin(c.yaw) * 0.6);
    // The cast itself: a flash at the hand in the spell's colour.
    h.fx.flash(hand, _c.set(s.color).multiplyScalar(0.8), 1.6);
    h.fx.sparks(hand, UP, 10, s.color, 4, 0.9);
    this.runes.tip(hand, aim, s.color, 0.35);
    // The mobs under where it is aimed see the circle open: some jump clear (Enemy.dodge).
    if (s.aimed && s.radius > 0 && s.id !== 'telekinesis' && s.id !== 'stone-wall') {
      for (const e of h.enemies) if (e.alive && Math.hypot(e.pos.x - aim.x, e.pos.z - aim.z) < s.radius + 1) e.dodge?.(aim.x, aim.z, s.radius);
    }
    switch (s.id) {
      case 'moonbomb': case 'fireball': case 'frost-arrow': case 'storm-arrow': {
        const fast = s.id === 'frost-arrow' || s.id === 'storm-arrow' ? 46 : s.id === 'moonbomb' ? 34 : 24;
        const T = Math.max(0.15, hand.distanceTo(aim) / fast);
        this.runes.cast(aim, s.color, { radius: s.radius, hold: T, ...RUNE_STACK[s.id] });
        this.fly(s, hand, aim, T, shotArc(s.id));
        h.audio.spell('whoosh');
        break;
      }
      case 'earthsplitter': {
        // (Playtest 2026-11-17: no leap.) He kneels and strikes the ground; a fissure of spiky rocks races from him to
        // the aim point (at most 12 m), tossing what stands on its line, and bursts there in a ring of spikes.
        const dx = aim.x - c.pos.x, dz = aim.z - c.pos.z, l = Math.hypot(dx, dz) || 1;
        const len = Math.max(3, Math.min(LEAP_RANGE, l));
        const dir = { x: dx / l, z: dz / l };
        // (Its end on what was aimed at: a deck or a roof he aims at is where it bursts, not the land under it.)
        const end = new Vector3(c.pos.x + dir.x * len, l <= LEAP_RANGE ? aim.y : c.pos.y, c.pos.z + dir.z * len);
        ground(end, h);
        this.fissure = { from: new Vector3(c.pos.x, c.pos.y, c.pos.z), end, dir, len, d: 0.8, next: 0.8, hit: new Set() };
        this.runes.cast(end, s.color, { radius: s.radius, hold: len / FISSURE_SPEED, ...RUNE_STACK[s.id] });
        h.fx.dust(_v.set(c.pos.x + dir.x * 0.8, c.pos.y, c.pos.z + dir.z * 0.8), 1.4);
        h.shake(0.45);
        h.audio.spell('rumble');
        break;
      }
      case 'wrecking-charge': {
        const dir = { x: Math.cos(c.yaw), z: Math.sin(c.yaw) };
        c.dashDir = dir;
        c.dashLeft = 0.45;
        c.dashSpeedNow = 12 / 0.45;
        c.dashPlant = true;
        this.charge = { left: 0.45, dir, hit: new Set() };
        h.audio.spell('charge');
        h.shake(0.3);
        break;
      }
      case 'chain-hook': this.hook(s, hand, aim); break;
      case 'blood-moon':
        h.bloodMoon(8);
        h.announce('BLOOD MOON');
        h.audio.spell('moon');
        h.shake(0.4);
        break;
      case 'gale-shot': this.gale(s); break;
      case 'black-hole': {
        // The reel: the circles stack up off the ground to where it opens, high in the sky.
        this.runes.cast(aim, s.color, { radius: 3.5, hold: HOLE_S, ...RUNE_STACK[s.id] });
        const fx = new BlackHoleFx(s.color, HOLE_S);
        const cy = aim.y + this.holeLift;
        this.holeLift = HOLE_UP;
        fx.group.position.set(aim.x, cy, aim.z);
        h.scene.add(fx.group);
        const light = h.lights?.hold(s.color, 0, 34);
        light?.pos.copy(fx.group.position);
        this.holes.push({ at: aim.clone(), cy, eaten: new Set(), t: 0, tick: 0, tearAt: 0.6, fx, light, lifted: new Map() });
        // Space tears open: a flash and a ring, dust sucked toward it.
        h.lights?.flash(fx.group.position, 0xe8d8ff, 80, 40, 0.4);
        h.fx.shock(aim, s.color, 9, 0.6);
        h.shake(0.3);
        h.audio.spell('vortex');
        h.audio.bed('hole', HOLE_S);
        break;
      }
      case 'fire-tornado': {
        // Toward the crosshair (the path the preview drew), else the way he faces.
        const ax = aim.x - c.pos.x, az = aim.z - c.pos.z, al = Math.hypot(ax, az);
        const dir = al > 0.5 ? { x: ax / al, z: az / al } : { x: Math.cos(c.yaw), z: Math.sin(c.yaw) };
        const at = ground(new Vector3(c.pos.x + dir.x * 2.5, c.pos.y, c.pos.z + dir.z * 2.5), h);
        const fx = new FireTornadoFx(s.color);
        fx.group.name = 'fire-tornado';
        fx.group.position.copy(at);
        fx.group.scale.setScalar(0.01);
        h.scene.add(fx.group);
        const light = h.lights?.hold(0xff7a28, 0, 20);
        this.tornados.push({ kind: 'fire', at, dir, t: 0, tick: 0, scorch: 0, tearAt: 0.3, boltAt: 0, fx, light, lifted: new Map() });
        h.audio.spell('wind');
        h.audio.spell('crackle');
        h.audio.bed('tornado', TORNADO_S);
        h.audio.bed('fire', TORNADO_S);
        break;
      }
      case 'storm-tornado': {
        // At the crosshair, under a storm cloud that spreads over the sky; it drifts away from Wren.
        this.runes.cast(aim, s.color, { radius: s.radius, hold: 0.5, ...RUNE_STACK[s.id] });
        const dx = aim.x - c.pos.x, dz = aim.z - c.pos.z, l = Math.hypot(dx, dz) || 1;
        const fx = new StormTornadoFx();
        const at = aim.clone();
        fx.group.position.copy(at);
        h.scene.add(fx.group);
        const light = h.lights?.hold(0xbfd0ff, 0, 30);
        // The shelf cloud over it, spreading out across the sky.
        this.explosions.cloud(new Vector3(at.x, at.y + 12.5, at.z), 18, 70, STORM_S + 1);
        this.tornados.push({ kind: 'storm', at, dir: { x: dx / l, z: dz / l }, t: 0, tick: 0, scorch: 0, tearAt: 0.3, boltAt: 0.6, fx, light, lifted: new Map() });
        h.shake(0.3);
        h.audio.spell('wind');
        h.audio.bed('tornado', STORM_S);
        break;
      }
      case 'overgrowth': this.overgrow(s, aim); break;
      case 'stone-wall': {
        // Out of the ground at the crosshair, across his line of sight (an old one standing crumbles first).
        if (this.wall) this.dropWall();
        const at = ground(aim.clone(), h);
        const src = this.wallStone();
        if (src) {
          this.wall = new StoneWall(src, at, c.yaw, (x, z) => h.heightAt(x, z, at.y + 3), h.solid);
          // (Its stones stay hidden while it stands: what shows is the earth itself rising, below. Kicked or
          // crumbled, they are what flies and lies about.)
          this.wall.batch.group.visible = false;
          h.scene.add(this.wall.batch.group);
        }
        this.earthWall(at, c.yaw);
        h.fx.shock(at, s.color, 4, 0.5);
        for (let k = -2; k <= 2; k++) h.fx.dust(_v.set(at.x - Math.sin(c.yaw) * k * 1.4, at.y + 0.2, at.z + Math.cos(c.yaw) * k * 1.4), 1.3);
        h.smoke?.(at, 2.5, 0x3a3f52, 2.5);
        h.shake(0.45);
        h.audio.spell('rumble');
        break;
      }
      default: this.reel.cast(s, hand, aim);
    }
    return s;
  }

  update(dt: number): void {
    const h = this.h;
    this.runes.update(dt);
    this.lightning.update(dt);
    this.explosions.update(dt);
    this.fires.update(dt);
    this.walls(dt);
    const c0 = h.controller;
    this.chain.update(dt, _v.set(c0.pos.x + Math.cos(c0.yaw) * 0.6, c0.pos.y + 1.5, c0.pos.z + Math.sin(c0.yaw) * 0.6));
    for (let i = this.shards.length - 1; i >= 0; i--) {
      const sh = this.shards[i];
      sh.t += dt;
      const end = Math.min(1, (SHARD_LIFE - sh.t) / 0.8);
      if (end < 1) sh.mesh.scale.setScalar(Math.max(0.01, end));
      if (sh.t >= SHARD_LIFE) { sh.sim.remove(sh.p); sh.mesh.removeFromParent(); this.shards.splice(i, 1); }
    }
    // Mobs standing in the fires burn, a little every half second.
    this.burnTick -= dt;
    if (this.burnTick <= 0 && this.fires.live) {
      this.burnTick = 0.5;
      for (const e of h.enemies) if (e.alive && this.fires.burning(e.pos.x, e.pos.z, 0.9)) (h.burn ?? h.hit)(e, 0.12, 0, 0);
    }
    for (const [id, left] of this.frozen) { if (left - dt <= 0) this.frozen.delete(id); else this.frozen.set(id, left - dt); }
    // Shots in flight.
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.T);
      _w.copy(f.mesh.position);
      flightPoint(f.from, f.to, k, f.arc, f.mesh.position);
      f.missile.update(dt, _w.subVectors(f.mesh.position, _w));
      // Embers (a fireball) or a faint glittering wake (an arrow) left behind.
      h.fx.sparks(f.mesh.position, _w.set(0, 0.3, 0), f.spell.id === 'fireball' ? 3 : 1, f.color, 1.2, 1.0);
      if (k >= 1) { f.mesh.removeFromParent(); f.missile.dispose(); this.flights.splice(i, 1); this.land(f.spell, f.to); }
    }
    if (this.slam && (this.slam.t -= dt) <= 0) { const at = this.slam.at; this.slam = null; this.earthsplit(at); }
    if (this.fissure) this.runFissure(dt);
    this.reel.update(dt);
    // (Through the getters: a field drawing nothing picks up its model once it has loaded.)
    if (this.spikeField) this.spikes.update(dt);
    if (this.iceField) this.ice.update(dt);
    this.water.update(dt);
    if (this.charge) this.charging(dt);
    for (let i = this.holes.length - 1; i >= 0; i--) if (this.hole(this.holes[i], dt)) this.holes.splice(i, 1);
    for (let i = this.tornados.length - 1; i >= 0; i--) if (this.tornado(this.tornados[i], dt)) this.tornados.splice(i, 1);
    for (let i = this.rooted.length - 1; i >= 0; i--) {
      const r = this.rooted[i];
      r.left -= dt; r.tick -= dt;
      if (r.tick <= 0 && r.e.alive) { r.tick = 0.18; h.fx.sparks(_v.set(r.e.pos.x, r.e.pos.y + 0.2, r.e.pos.z), UP, 3, 0x6dff9a, 1.6, 0.8); }
      if (r.left <= 0 || !r.e.alive) this.rooted.splice(i, 1);
    }
    for (let i = this.plants.length - 1; i >= 0; i--) {
      const p = this.plants[i];
      p.t += dt;
      // Grows with an overshoot, like it sprang up; shrinks back into the ground at the end of its life.
      const g = Math.min(1, p.t / p.grow);
      const pop = g < 1 ? 1 - (1 - g) ** 3 * Math.cos(g * 7) : 1;
      const end = Math.max(0, Math.min(1, (p.life - p.t) / 1.2));
      p.obj.scale.setScalar(Math.max(1e-3, p.to * pop * end));
      if (p.t >= p.life) { p.obj.removeFromParent(); p.remove?.(); this.plants.splice(i, 1); }
    }
  }

  // ------------------------------------------------------------------------------------------------ pieces of spells

  private fly(s: SpellDef, from: Vector3, to: Vector3, T: number, arc: number): void {
    const missile = spellMissile(s.id, s.color);
    const mesh = missile.object;
    mesh.position.copy(from);
    this.h.scene.add(mesh);
    this.flights.push({ mesh, missile, from: from.clone(), to: to.clone(), t: 0, T, arc, spell: s, color: s.color });
  }

  /** The spiky rocks (one instanced draw; the Meshy rock spire, or the sea pinnacle until it is made). */
  private spikeOwn = false;
  private iceOwn = false;

  get spikes(): SpikeField {
    // (Rebuilt when its model arrives, and again when the reel's own rock replaces the stand-in, spikes kept.)
    if (!this.spikeField || !this.spikeField.mesh || (!this.spikeOwn && this.h.model?.('spiky-rock'))) {
      const own = this.h.model?.('spiky-rock') ?? null;
      const src = own ?? this.h.model?.('pinnacle') ?? null;
      if (!this.spikeField || src) {
        this.spikeOwn = !!own;
        this.spikeField?.mesh?.removeFromParent();
        const old = this.spikeField;
        this.spikeField = new SpikeField(src);
        if (old) this.spikeField.adopt(old);
        if (this.spikeField.mesh) this.h.scene.add(this.spikeField.mesh);
      }
    }
    return this.spikeField!;
  }

  /**
   * Stone Wall's look (playtest 2026-11-17: "an elemental earth wall, not bricks"): a packed row of jagged rocks bursting
   * up out of cracked ground across his line of sight, from the middle out, tall and leaning every which way, a lower
   * row before and behind it. They stand as long as the wall and sink when it goes.
   */
  private earthWall(at: Vector3, yaw: number): void {
    const h = this.h;
    const side = { x: -Math.sin(yaw), z: Math.cos(yaw) }, fwd = { x: Math.cos(yaw), z: Math.sin(yaw) };
    for (let s = -3; s <= 3.001; s += 0.42) {
      for (const [off, tall] of [[0, 2.3], [-0.45, 1.2], [0.45, 1.2]] as const) {
        if (off !== 0 && Math.random() < 0.35) continue;
        const j = (Math.random() - 0.5) * 0.25;
        const p = new Vector3(at.x + side.x * (s + j) + fwd.x * off, 0, at.z + side.z * (s + j) + fwd.z * off);
        p.y = Math.min(h.heightAt(p.x, p.z, at.y + 3), at.y + 0.25);
        // Tallest in the middle, ragged along the top.
        const k = 1 - Math.abs(s) / 3.6;
        this.spikes.raise(p, {
          height: tall * (0.75 + 0.35 * k) + Math.random() * 0.7, width: 0.55 + Math.random() * 0.35,
          delay: Math.abs(s) * 0.05, life: STAND, tag: 'wall',
          lean: { x: (Math.random() - 0.5) * 0.35 + fwd.z * off * 0.5, z: (Math.random() - 0.5) * 0.35 - fwd.x * off * 0.5 },
        });
      }
      if (Math.random() < 0.5) h.dig(at.x + side.x * s, at.z + side.z * s, 0.8, 0.15, 'burnt');
    }
  }

  /** Ice crystals (Wren's ramp and wall): the reel's ice crystal, else the purple crystal turned to ice. */
  get ice(): SpikeField {
    // (As the spikes: the stand-in until the reel's own ice has loaded, then that, the crystals kept.)
    if (!this.iceField || !this.iceField.mesh || (!this.iceOwn && this.h.model?.('ice-crystal'))) {
      const own = this.h.model?.('ice-crystal') ?? null;
      const src = own ?? this.h.model?.('purple-crystal') ?? null;
      if (!this.iceField || src) {
        this.iceOwn = !!own;
        this.iceField?.mesh?.removeFromParent();
        const old = this.iceField;
        this.iceField = new SpikeField(src, own ? undefined : (m) => {
          // (Opaque and mostly lit, not glowing: see-through, emissive crystals packed in a wall merged into one flat blue
          // shape, headless check 2026-11-17.)
          m.color.set(0xcfeeff);
          m.emissive?.set(0x1d4f86);
          m.emissiveIntensity = 0.22;
          m.roughness = 0.3;
          m.metalness = 0.05;
          m.emissiveMap = null;
          m.transparent = false;
          m.opacity = 1;
        });
        if (old) this.iceField.adopt(old);
        if (this.iceField.mesh) this.h.scene.add(this.iceField.mesh);
      }
    }
    return this.iceField!;
  }

  /** The fissure runs on: spikes burst up along it, each tossing the mobs on its spot; at the end, the burst. */
  private runFissure(dt: number): void {
    const f = this.fissure!;
    const h = this.h;
    const s = SPELLS.knight[0];
    f.d = Math.min(f.len, f.d + FISSURE_SPEED * dt);
    while (f.next <= f.d) {
      const side = { x: -f.dir.z, z: f.dir.x };
      const at = new Vector3(f.from.x + f.dir.x * f.next, 0, f.from.z + f.dir.z * f.next);
      at.y = h.heightAt(at.x, at.z, f.from.y + 2);
      // Two or three spikes a step, jagged either side of the line, leaning out of it and forward.
      const n = 2 + (Math.random() < 0.4 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const o = (i - (n - 1) / 2) * 0.55 + (Math.random() - 0.5) * 0.3;
        const p = new Vector3(at.x + side.x * o, at.y, at.z + side.z * o);
        const tall = 1.1 + Math.random() * 1.1 + (f.next / f.len) * 0.6;
        this.spikes.raise(p, { height: tall, width: 0.5 + Math.random() * 0.35, delay: 0, life: 1.6 + Math.random() * 0.4,
          lean: { x: f.dir.x * o * 0.35 + (Math.random() - 0.5) * 0.2, z: f.dir.z * o * 0.35 + (Math.random() - 0.5) * 0.2 } });
      }
      h.fx.dust(at, 0.8);
      for (const e of h.enemies.slice()) {
        if (!e.alive || f.hit.has(e) || !h.reachable(e, FISSURE_REACH, at)) continue;
        f.hit.add(e);
        h.hit(e, s.mult * 0.45, 2.5, 0.1, _w.set(e.pos.x, e.pos.y + 0.6, e.pos.z).clone());
        if (e.alive && !e.def.boss && !e.def.flying && e.def.speed > 0) e.leap(0.5, 1.8);
      }
      // (It breaks only what it runs under.)
      h.smash(at.x, at.y + 0.4, at.z, 1.1, 'skill');
      h.dig(at.x, at.z, 0.9, 0.25, 'burnt');
      f.next += FISSURE_STEP;
    }
    if (f.d >= f.len) {
      this.fissure = null;
      this.earthsplit(f.end, f.hit);
    }
  }

  /** Everything in `r` of `at` takes `mult`, thrown off `knock`; returns who was hit. */
  private blast(at: Vector3, r: number, mult: number, knock: number, stop = 0.08, skip?: Set<Enemy>): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.h.enemies.slice()) {
      if (!e.alive || skip?.has(e) || !this.h.reachable(e, r, at)) continue;
      this.h.hit(e, mult, knock, stop, _w.set(e.pos.x, e.pos.y + 1, e.pos.z).clone());
      out.push(e);
    }
    return out;
  }

  /** The look of a big landing: two flashes, a shock ring, sparks and smoke, the screen shaking. */
  /** An earth impact (Earthsplitter's end, a boulder): dust and grit thrown up, a shock ring, a dim light; no flash. */
  private quake(at: Vector3, r: number, shake: number): void {
    const h = this.h;
    _v.set(at.x, at.y + 0.6, at.z);
    h.lights?.flash(_w.set(at.x, at.y + 1.2, at.z), 0x9a7a52, 4 + r * 2, r * 4, 0.4);
    h.fx.shock(at, EARTH_DUST, r * 1.5, 0.5);
    h.fx.sparks(_v, UP, 30, 0x7a6a58, 9, 1.0);
    h.fx.dust(at, r * 0.8);
    h.fx.dust(_v.set(at.x, at.y + 1.4, at.z), r * 0.5);
    this.explosions.burst(at, r * 1.1, { hot: EARTH_DUST, smoke: 1.4, heat: 0 });
    h.shake(shake);
  }

  private boom(at: Vector3, color: number, r: number, shake: number): void {
    const h = this.h;
    _v.set(at.x, at.y + 0.8, at.z);
    h.fx.flash(_v, _c.set(color), r * 1.1);
    h.fx.flash(_v, _c.set(0xffffff).multiplyScalar(0.7), r * 0.5);
    // The blast lights the ground, the walls and the bodies round it.
    h.lights?.flash(_w.set(at.x, at.y + 1.5, at.z), _c.set(color).lerp(new Color(0xffffff), 0.35).getHex(), 18 + r * 9, r * 5, 0.55);
    h.fx.shock(at, color, r * 1.6, 0.5);
    h.fx.shock(at, 0xffffff, r * 0.9, 0.3);
    h.fx.sparks(_v, UP, 40, color, 11, 1.0);
    h.fx.dust(at, r * 0.6);
    h.fx.dust(_v.set(at.x, at.y + 1.6, at.z), r * 0.45);
    h.shake(shake);
    // The reel's fireball: a billowing cloud swelling out white-hot, cooling through the spell's colour to smoke that
    // rolls up and thins over a few seconds, dust rolling out round its foot (render/Explosion).
    this.explosions.burst(at, r * 1.5, { hot: color });
    // A column of smoke rising long after.
    h.smoke?.(at, r * 0.35, 0x1e202c, 6);
  }

  private land(s: SpellDef, at: Vector3): void {
    const h = this.h;
    switch (s.id) {
      case 'fireball':
        this.blast(at, s.radius, s.mult, 5, 0.1);
        this.boom(at, s.color, s.radius, 0.75);
        // The grass keeps burning where it landed (the reel).
        this.fires.ignite(at, s.radius * 0.85, 26, (x, z) => h.heightAt(x, z, at.y + 2));
        h.smash(at.x, at.y + 0.8, at.z, s.radius * 0.8, 'spell');
        h.dig(at.x, at.z, s.radius * 0.6, 1.1, 'burnt');
        h.dig(at.x, at.z, s.radius, 0, 'burnt');
        h.audio.spell('whoomph');
        h.audio.spell('crackle');
        h.audio.bed('fire', 7);
        break;
      case 'moonbomb':
        this.blast(at, s.radius, s.mult, 6, 0.1);
        this.iceBurst(at, s);
        h.smash(at.x, at.y + 0.8, at.z, s.radius * 0.8, 'spell');
        h.dig(at.x, at.z, s.radius * 0.55, 0.8, 'frozen');
        h.audio.spell('whoomph');
        h.audio.spell('frost');
        break;
      case 'frost-arrow': {
        for (const e of this.blast(at, s.radius, s.mult, 0, 0.05)) {
          if (!e.alive || e.def.boss) continue;
          e.afflict('stun', 3);
          this.frozen.set(e.id, 3);
          h.fx.sparks(_v.set(e.pos.x, e.pos.y + 1, e.pos.z), UP, 10, 0xd8fbff, 2.5, 1.0);
        }
        h.fx.flash(_v.set(at.x, at.y + 0.6, at.z), _c.set(s.color), s.radius);
        h.fx.shock(at, 0xd8fbff, s.radius * 1.3, 0.6);
        h.fx.sparks(_v, UP, 30, 0xeaffff, 5, 1.0);
        // A burst of freezing mist rolling out over the frozen ground.
        this.impact(at, 0xd8fbff, s.radius * 0.7, { tear: 4 });
        h.dig(at.x, at.z, s.radius, 0, 'frozen');
        h.shake(0.3);
        h.audio.spell('frost');
        break;
      }
      case 'storm-arrow': {
        this.bolt(_w.set(at.x, at.y + 18, at.z).clone(), at, s.color);
        let from = at.clone();
        const hit = new Set<number>();
        for (const e of this.blast(at, s.radius, s.mult, 3)) hit.add(e.id);
        // Then it jumps on through up to five more, each to the nearest within 8 m.
        for (let n = 0; n < 5; n++) {
          let best: Enemy | null = null, bd = 8;
          for (const e of h.enemies) {
            if (!e.alive || hit.has(e.id)) continue;
            const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
            if (d < bd) { bd = d; best = e; }
          }
          if (!best) break;
          hit.add(best.id);
          const to = new Vector3(best.pos.x, best.pos.y + 1, best.pos.z);
          this.bolt(from.clone().setY(from.y + 1), to, s.color);
          h.hit(best, s.mult * 0.7, 2, 0.04, to);
          from = to;
        }
        h.fx.flash(_v.set(at.x, at.y + 1, at.z), _c.set(0xffffff), 4);
        this.impact(at, 0xcfd8ff, s.radius, { fires: 4, tear: 6 });
        h.dig(at.x, at.z, 1.6, 0.3, 'burnt');
        h.smash(at.x, at.y + 0.8, at.z, 2, 'spell');
        h.shake(0.45);
        h.audio.spell('zap');
        break;
      }
      default: this.reel.land(s, at);
    }
  }

  /** A branching lightning bolt from `a` to `b` (render/Lightning), lighting the ground, sparks where it lands. */
  private bolt(a: Vector3, b: Vector3, color: number): void {
    const h = this.h;
    this.lightning.strike(a, b, _c.set(color).lerp(_white, 0.35), a.distanceTo(b) > 8 ? 0.45 : 0.25);
    h.lights?.flash(b, 0xcfe6ff, 40, 24, 0.3);
    h.fx.flash(b, 0xffffff, 1.4);
    h.fx.sparks(b, UP, 14, 0xdff0ff, 5, 1.0);
  }

  private earthsplit(at: Vector3, already?: Set<Enemy>): void {
    const s = SPELLS.knight[0];
    const h = this.h;
    for (const e of this.blast(at, s.radius, s.mult, 3, 0.14, already)) {
      if (e.alive && !e.def.boss && !e.def.flying && e.def.speed > 0) e.leap(0.7, 2.2);
    }
    this.quake(at, s.radius, 1.0);
    h.smash(at.x, at.y + 0.6, at.z, s.radius, 'burst');
    h.dig(at.x, at.z, 3.6, 1.5);
    h.dig(at.x, at.z, s.radius + 1, 0, 'burnt');
    // Rocks thrown up out of the crater.
    for (const sim of h.debris()) sim.blast(at.x, at.y, at.z, s.radius + 2, 9);
    h.tear?.(at.x, at.z, s.radius + 1.5, 24);
    // Spiky rocks burst up in a ring round it, leaning out, and a cluster in the middle (the reel's earth spikes).
    const ring = 14;
    for (let i = 0; i < ring; i++) {
      const a = (i / ring) * Math.PI * 2 + Math.random() * 0.3;
      const r = s.radius * (0.55 + Math.random() * 0.35);
      const p = new Vector3(at.x + Math.cos(a) * r, 0, at.z + Math.sin(a) * r);
      p.y = h.heightAt(p.x, p.z, at.y + 3);
      this.spikes.raise(p, { height: 1.8 + Math.random() * 1.4, width: 0.6 + Math.random() * 0.4, delay: (r / s.radius) * 0.12, life: 2.4,
        lean: { x: Math.sin(a) * 0.45, z: -Math.cos(a) * 0.45 } });
    }
    for (let i = 0; i < 4; i++) this.spikes.raise(new Vector3(at.x + (Math.random() - 0.5) * 1.2, at.y, at.z + (Math.random() - 0.5) * 1.2), { height: 2.6 + Math.random() * 1.2, width: 0.8, delay: 0.05, life: 2.4 });
    h.audio.spell('rumble');
  }

  private charging(dt: number): void {
    const h = this.h;
    const ch = this.charge!;
    const c = h.controller;
    ch.left -= dt;
    const s = SPELLS.knight[1];
    const ax = c.pos.x + ch.dir.x * 1.6, az = c.pos.z + ch.dir.z * 1.6;
    // Through walls: what is just ahead breaks first, so the rush carries on through the hole.
    h.smash(ax, c.pos.y + 1, az, s.radius, 'burst');
    // Blocks burst off the walls he rams through (every tenth of a second).
    ch.tear = (ch.tear ?? 0) - dt;
    if (ch.tear <= 0) { ch.tear = 0.1; h.tear?.(ax, az, s.radius + 0.5, 6); }
    h.fx.dust(_v.set(c.pos.x, c.pos.y, c.pos.z), 0.8);
    h.fx.sparks(_v.set(c.pos.x, c.pos.y + 1, c.pos.z), _w.set(-ch.dir.x, 0.3, -ch.dir.z), 4, s.color, 5, 0.5);
    // A crimson speed wake streaming off him, knees to shoulders (released when the rush ends, it fades out).
    h.fx.trail(CHARGE_TRAIL, _v.set(c.pos.x, c.pos.y + 0.35, c.pos.z), _w.set(c.pos.x, c.pos.y + 1.55, c.pos.z), s.color, ch.left > 0);
    for (const e of h.enemies.slice()) {
      if (!e.alive || ch.hit.has(e.id) || Math.hypot(e.pos.x - ax, e.pos.z - az) > s.radius + e.def.bodyRadius * (e.def.scale ?? 1)) continue;
      ch.hit.add(e.id);
      h.hit(e, s.mult, 9, 0.08);
      if (!e.def.boss && !e.def.flying && e.def.speed > 0) e.leap(0.6, 1.4);
    }
    if (ch.left <= 0) { this.charge = null; h.shake(0.5); h.fx.shock(_v.set(c.pos.x, c.pos.y, c.pos.z), s.color, 4); }
  }

  private hook(s: SpellDef, hand: Vector3, aim: Vector3): void {
    const h = this.h;
    const c = h.controller;
    const best = hookTarget(h.enemies, c.pos, aim);
    const end = best ? new Vector3(best.pos.x, best.pos.y + 1.2, best.pos.z)
      : _w.set(aim.x - c.pos.x, 0, aim.z - c.pos.z).setLength(Math.min(HOOK.reach, Math.hypot(aim.x - c.pos.x, aim.z - c.pos.z))).add(c.pos).setY(aim.y + 1).clone();
    // The chain: real links shoot out to where it caught and reel back in.
    this.chain.fire(hand, end);
    h.fx.sparks(end, UP, 10, 0xdfe3f0, 3, 0.8);
    h.audio.spell('chain');
    if (best && !best.def.boss && best.def.speed > 0) {
      // Yanked to his feet (a small one); a big one only staggers.
      const dx = c.pos.x - best.pos.x, dz = c.pos.z - best.pos.z, d = Math.hypot(dx, dz) || 1;
      const big = (best.def.scale ?? 1) * best.def.height >= 3;
      if (!big) {
        const nx = c.pos.x - (dx / d) * 1.6, nz = c.pos.z - (dz / d) * 1.6;
        best.pos.x = nx; best.pos.z = nz; best.pos.y = h.heightAt(nx, nz, c.pos.y + 1);
        best.leap(0.35, 0.8);
      }
      best.afflict('stun', 1.2);
      h.hit(best, s.mult, 0, 0.1, end);
      h.shake(0.3);
    } else if (best) { h.hit(best, s.mult, 0, 0.1, end); h.shake(0.3); }
    else {
      h.tip?.('No target');
      // Caught on a wall: it pulls a chunk of what stands there.
      h.smash(end.x, end.y + 0.5, end.z, s.radius, 'heavy');
    }
  }

  /** Moonbomb's landing: a cold blue burst and ice shards flying out (MOON_BURST). */
  private iceBurst(at: Vector3, s: SpellDef): void {
    const h = this.h;
    _v.set(at.x, at.y + 0.8, at.z);
    h.fx.flash(_v, _c.set(MOON_BURST.hot), s.radius * 0.7);
    h.lights?.flash(_w.set(at.x, at.y + 1.5, at.z), MOON_BURST.hot, MOON_BURST.light, s.radius * 4, 0.45);
    h.fx.shock(at, s.color, s.radius * 1.3, 0.5);
    h.fx.sparks(_v, UP, 24, 0xbfe8ff, 9, 1.0);
    h.fx.dust(at, s.radius * 0.5);
    h.shake(0.6);
    this.explosions.burst(at, s.radius * MOON_BURST.size, { hot: MOON_BURST.hot, smoke: 0.35 });
    if (!shardGeo) {
      shardGeo = new OctahedronGeometry(1, 0);
      shardGeo.scale(0.5, 1.4, 0.5);
      shardMat = new MeshStandardMaterial({ color: 0xa8dcff, emissive: 0x1d4f86, emissiveIntensity: 0.6, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.85 });
    }
    const sim = this.wallSim();
    if (!sim) return;
    for (let i = 0; i < MOON_BURST.shards; i++) {
      const a = (i / MOON_BURST.shards) * Math.PI * 2 + Math.random() * 0.4;
      const size = 0.12 + Math.random() * 0.16;
      const mesh = new Mesh(shardGeo, shardMat!);
      mesh.name = 'ice-shard';
      mesh.scale.set(size, size, size);
      h.scene.add(mesh);
      const sp = 6 + Math.random() * 7;
      const p = sim.add({
        x: at.x + Math.cos(a) * 0.5, y: at.y + 0.8, z: at.z + Math.sin(a) * 0.5, r: size * 1.4,
        box: { x: size * 0.5, y: size * 1.4, z: size * 0.5 },
        vx: Math.cos(a) * sp, vy: 4 + Math.random() * 6, vz: Math.sin(a) * sp,
        wx: (Math.random() - 0.5) * 14, wy: (Math.random() - 0.5) * 14, wz: (Math.random() - 0.5) * 14,
        density: 900, obj: mesh,
      });
      this.shards.push({ mesh, p, t: 0, sim });
    }
  }

  private gale(s: SpellDef): void {
    const h = this.h;
    const c = h.controller;
    const fx = Math.cos(c.yaw), fz = Math.sin(c.yaw);
    for (const e of h.enemies.slice()) {
      if (!e.alive) continue;
      const dx = e.pos.x - c.pos.x, dz = e.pos.z - c.pos.z, d = Math.hypot(dx, dz);
      if (d > s.radius || d < 0.01 || (dx * fx + dz * fz) / d < Math.cos(GALE_HALF)) continue;
      h.hit(e, s.mult, 10, 0.05);
      if (!e.def.boss && !e.def.flying && e.def.speed > 0) e.leap(0.8, 2.4);
    }
    for (let k = 1; k <= 3; k++) {
      const x = c.pos.x + fx * k * 3, z = c.pos.z + fz * k * 3;
      h.smash(x, c.pos.y + 1, z, 1.2 + k * 0.6, 'heavy');
      // The wind rips the blocks off whatever stands in its cone, and they fly with it (the push below).
      h.tear?.(x, z, 1.5 + k * 0.7, 3 + k * 2);
      h.fx.dust(_v.set(x, c.pos.y + 0.3, z), 1 + k * 0.3);
      h.fx.sparks(_v.set(x, c.pos.y + 1, z), _w.set(fx, 0.15, fz), 10, s.color, 12, 0.35);
    }
    for (const sim of h.debris()) sim.push(c.pos.x + fx * 5, c.pos.z + fz * 5, 6, (p) => { p.vx += fx * 14; p.vz += fz * 14; p.vy += 4; sim.wake(p); });
    // The wind itself: pale crescents sweeping out across the cone to its reach, at the knees, the waist and the chest.
    [0.5, 1.1, 1.7].forEach((y, k) => h.fx.arc(_v.set(c.pos.x, c.pos.y + y, c.pos.z), c.yaw, (k - 1) * 0.12, s.radius * (0.7 + k * 0.15), s.color, GALE_HALF));
    h.shake(0.35);
    h.audio.spell('wind');
  }

  /**
   * A spell hit lands as the reel's blast (v12): a billowing cloud `r` metres round in `color` (white-hot through the
   * colour to smoke), `fires` flames left burning, `tear` blocks torn off anything standing there.
   */
  impact(at: Vector3, color: number, r: number, o: { fires?: number; tear?: number; smoke?: number } = {}): void {
    const h = this.h;
    this.explosions.burst(at, r * 1.5, { hot: color, smoke: o.smoke });
    if (o.fires) this.fires.ignite(at, r * 0.8, o.fires, (x, z) => h.heightAt(x, z, at.y + 2));
    if (o.tear) h.tear?.(at.x, at.z, r * 1.2, o.tear);
  }

  /** Where a bar skill's shot lands (CombatSystem's projectiles): a falling star, the crescent breaking, a volley arrow. */
  skillImpact(kind: 'star' | 'crescent' | 'arrow', at: Vector3, color: number): void {
    const k = SKILL_IMPACT[kind];
    this.impact(at, color, k.r, { fires: k.fires, tear: k.tear, smoke: k.smoke });
  }

  /** The Meshy dry-stone wall cut into blocks (null while its model loads). */
  private wallStone(): ReturnType<typeof wallSource> {
    // (Cut from the earth's own jagged rock, the spikes' model: kicked, rock flies, never the dry-stone wall's bricks.
    // Headless check 2026-11-17.)
    const m = this.h.model?.('spiky-rock') ?? this.h.model?.('pinnacle');
    return m ? wallSource(m) : null;
  }

  /** The wall's stone model has loaded (no wall can be raised before). */
  wallLoaded(): boolean { return this.wallStone() !== null; }

  /** A Stone Wall stands (casting it again kicks it). */
  wallUp(): boolean { return !!this.wall?.up; }

  /** Sir Aldric kicks his wall apart: its blocks fly along his facing. */
  kickWall(): void {
    const w = this.wall;
    if (!w?.up) return;
    const h = this.h;
    // Along the way he faces as he kicks (he may have walked round it since he raised it).
    w.batch.group.visible = true;
    this.spikeField?.drop('wall');
    w.kick(this.wallSim(), 16, h.controller.yaw);
    this.rubble.push(w);
    this.wall = null;
    const c = h.controller;
    h.fx.shock(_v.set(c.pos.x + Math.cos(c.yaw) * 2, c.pos.y, c.pos.z + Math.sin(c.yaw) * 2), 0xc9a27a, 4, 0.4);
    h.shake(0.6);
    h.audio.spell('rumble');
  }

  private dropWall(): void {
    const w = this.wall;
    if (!w) return;
    // (Worn out, the rocks sink back into the ground; its stones stay unseen, so no wall of blocks stands up again.)
    this.spikeField?.drop('wall');
    w.crumble(this.wallSim());
    this.rubble.push(w);
    this.wall = null;
  }

  /** The debris sim the wall's blocks go to (the world's rubble, else the first). */
  private wallSim(): DebrisSim {
    const all = this.h.debris();
    return all[1] ?? all[0];
  }

  private walls(dt: number): void {
    const h = this.h;
    if (this.wall) {
      this.wall.update(dt);
      if (this.wall.t > STAND) this.dropWall();
    }
    const s = SPELLS.knight[4];
    for (let i = this.rubble.length - 1; i >= 0; i--) {
      const w = this.rubble[i];
      w.update(dt);
      // Kicked blocks still flying smash into the mobs they reach, and break what they hit.
      for (const p of w.flying()) {
        for (const e of h.enemies) {
          if (!e.alive || Math.hypot(e.pos.x - p.x, e.pos.y + 1 - p.y, e.pos.z - p.z) > p.r + 0.9 || !w.strike(e)) continue;
          h.hit(e, s.mult, 7, 0.08, _v.set(p.x, p.y, p.z));
          h.fx.dust(_v, 0.8);
        }
      }
      if (w.finished) { w.dispose(this.wallSim()); this.rubble.splice(i, 1); }
    }
  }

  /** A mob reaches the black hole's core: killed, and its body shrinks away into it. */
  private eat(o: Hole, e: Enemy): void {
    o.lifted.delete(e);
    const h = this.h;
    h.hit(e, 999, 0, 0.05, _v.set(e.pos.x, e.pos.y + 1, e.pos.z).clone());
    e.held = false;
    e.swallow = 1;
    o.eaten.add(e);
    h.fx.sparks(_v, UP, 18, 0xe8d8ff, -4, 0.6);
    h.fx.flash(_v, _c.set(0x8a3dff), 1.5);
    h.shake(0.2);
  }

  /** Returns true when the black hole is done. */
  private hole(o: Hole, dt: number): boolean {
    const h = this.h;
    const s = SPELLS.wizard[1];
    o.t += dt;
    o.tick -= dt;
    o.fx.update(o.t, dt);
    o.fx.group.scale.multiplyScalar(HOLE_SIZE);
    const cx = o.at.x, cz = o.at.z, cy = o.cy;
    const R = s.radius;
    const pull = Math.min(1, o.t / 0.8);
    if (o.light) o.light.intensity = o.fx.group.scale.x * (10 + Math.sin(o.t * 5) * 3);
    // What stands under it is torn apart block by block, the top first, and goes up (the reel's temple).
    if (o.t >= o.tearAt && o.t < HOLE_S - 0.4) {
      o.tearAt = o.t + 0.2;
      h.tear?.(cx, cz, R, 6);
    }
    // Mobs are lifted off their feet and spiral up under it, round and round, nearer the higher they go.
    for (const e of h.enemies) {
      if (o.lifted.has(e) || !e.alive || e.def.boss || e.def.flying || e.held || o.t > HOLE_S - 0.5) continue;
      const d = Math.hypot(e.pos.x - cx, e.pos.z - cz);
      if (d > R) continue;
      e.held = true;
      o.lifted.set(e, { a: Math.atan2(e.pos.z - cz, e.pos.x - cx), r: Math.max(1.5, d) });
    }
    for (const [e, m] of o.lifted) {
      if (!e.alive) { e.held = false; o.lifted.delete(e); continue; }
      // Round and round, nearer and faster, until the core takes it.
      m.r = Math.max(0, m.r - 0.9 * dt);
      m.a += (1.6 + 5 / Math.max(0.6, m.r)) * dt;
      const ty = cy - 0.4 - m.r * 0.6;
      e.pos.x = cx + Math.cos(m.a) * m.r;
      e.pos.z = cz + Math.sin(m.a) * m.r;
      e.pos.y += (ty - e.pos.y) * Math.min(1, 1.4 * dt * pull);
      // Into the core: eaten (playtest 2026-11-17: "it should actually eat objects and mobs").
      if (Math.hypot(e.pos.x - cx, e.pos.y + 0.6 - cy, e.pos.z - cz) < HOLE_EAT) this.eat(o, e);
    }
    // Bodies shrinking away into it.
    for (const e of o.eaten) {
      // (Enemy keeps a swallowed body this small and hidden once it is; its death fade never shows it again.)
      e.swallow *= Math.exp(-6 * dt);
      e.object.scale.setScalar(e.swallow * (e.def.scale ?? 1));
      e.pos.x += (cx - e.pos.x) * Math.min(1, 6 * dt); e.pos.z += (cz - e.pos.z) * Math.min(1, 6 * dt);
      if (e.swallow < 0.05) { e.swallow = 0; e.object.visible = false; o.eaten.delete(e); }
    }
    // Pieces spiral up into it and are ground away to nothing in the core.
    for (const sim of h.debris()) {
      sim.push(cx, cz, R + 2, (p: Piece, dx: number, dz: number, d: number) => {
        sim.wake(p);
        const k = pull * dt;
        const inv = 1 / Math.max(0.5, d);
        // Round (tangent), in, and up: lifted against gravity, faster the closer to the core.
        p.vx += (-dz * inv * 9 - dx * inv * 4) * k;
        p.vz += (dx * inv * 9 - dz * inv * 4) * k;
        p.vy += (9.81 + (cy - p.y) * 1.6) * k;
        const damp = Math.exp(-1.2 * dt);
        p.vx *= damp; p.vy *= damp; p.vz *= damp;
        const ob = p.obj as Object3D | undefined;
        if (Math.hypot(dx, p.y - cy, dz) < 2.2 && ob?.scale) {
          ob.scale.multiplyScalar(0.88);
          if (ob.scale.x < 0.05) p.dead = true;
        }
      });
    }
    if (o.tick <= 0) {
      o.tick = 0.5;
      for (const e of this.blast(new Vector3(cx, o.at.y, cz), 3.5, s.mult, 0, 0.02)) void e;
      // Dust and grit dragged in off the ground all round.
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2, r = R * (0.6 + Math.random() * 0.4);
        h.fx.dust(_v.set(cx + Math.cos(a) * r, h.heightAt(cx + Math.cos(a) * r, cz + Math.sin(a) * r, o.at.y + 2), cz + Math.sin(a) * r), 0.8);
      }
      h.fx.sparks(_v.set(cx, cy, cz), UP, 14, 0xe8d8ff, -6, 0.8);
    }
    if (o.t < HOLE_S) return false;
    // It collapses to a point and bursts: everything it held is flung out and falls.
    o.fx.dispose();
    if (o.light) o.light.done = true;
    const top = new Vector3(cx, cy, cz);
    h.lights?.flash(top, 0xc8a8ff, HOLE_BURST.flash, 60, 0.7);
    this.explosions.burst(top, 6, { hot: HOLE_BURST.hot, smoke: 0.6 });
    h.fx.shock(o.at, 0xe8d8ff, 14, 0.8);
    for (const e of o.eaten) { e.swallow = 0; e.object.visible = false; e.object.scale.setScalar(0); }
    o.eaten.clear();
    for (const [e] of o.lifted) {
      e.held = false;
      const dx = e.pos.x - cx, dz = e.pos.z - cz, l = Math.hypot(dx, dz) || 1;
      e.thrown = { vx: (dx / l) * 9, vy: 4, vz: (dz / l) * 9, spin: (Math.random() < 0.5 ? -1 : 1) * 7, angle: 0 };
      e.onThrownLand = (x, speed) => { x.onThrownLand = undefined; if (x.alive) h.hit(x, s.mult * (1 + speed / 8), 4, 0.06); };
    }
    o.lifted.clear();
    h.smash(cx, o.at.y + 1, cz, 4, 'spell');
    h.dig(cx, cz, 3.4, 1.4);
    for (const sim of h.debris()) sim.blast(cx, cy, cz, R + 4, 12);
    h.shake(0.9);
    h.audio.spell('whoomph');
    return true;
  }

  /** Returns true when the tornado (fire or storm) is done. */
  private tornado(o: Tornado, dt: number): boolean {
    const h = this.h;
    const storm = o.kind === 'storm';
    const s = storm ? SPELLS.archer[4] : SPELLS.wizard[2];
    const life = storm ? STORM_S : TORNADO_S;
    o.t += dt;
    const run = storm ? STORM_RUN : TORNADO_RUN;
    const step = (run / life) * dt;
    // Along its line, weaving off it as it runs (the reel's tornado): Aim.tornadoStep, the path its preview drew.
    const mv = tornadoStep(o.t, dt, o.dir, run, life);
    o.at.x += mv.x; o.at.z += mv.z;
    ground(o.at, h);
    o.fx.group.position.copy(o.at);
    const fade = Math.min(1, o.t / 0.45, (life - o.t) / 0.5);
    if (o.fx instanceof StormTornadoFx) o.fx.update(o.t, dt, o.dir, life);
    else {
      o.fx.update(o.t, dt, o.dir);
      // The reel's fire tornado towers: half again as tall as the old one.
      o.fx.group.scale.setScalar(Math.max(0.01, (fade < 1 ? 1 - (1 - fade) ** 2 : 1) * 1.5));
    }
    if (o.light) { o.light.pos.set(o.at.x, o.at.y + 3, o.at.z); o.light.intensity = Math.max(0, fade) * (storm ? 8 : 10 + Math.random() * 4); }
    if (!storm) {
      // Embers climbing in a spiral, flung out at the top.
      for (let k = 0; k < 4; k++) {
        const a = o.t * 9 + k * 1.6, y = Math.random() * 9.5, r = 0.8 + y * 0.32;
        h.fx.sparks(_v.set(o.at.x + Math.cos(a) * r, o.at.y + y, o.at.z + Math.sin(a) * r), _w.set(-Math.sin(a), 1.4, Math.cos(a)), 1, k % 2 ? 0xffb040 : 0xffe0a0, 4 + y * 0.6, 0.9);
      }
    }
    o.scorch -= dt;
    if (o.scorch <= 0) {
      o.scorch = 0.3;
      if (!storm) {
        h.dig(o.at.x, o.at.z, 1.6, 0, 'burnt');
        // Fires left burning along its path (the reel).
        this.fires.ignite(o.at, 1.8, 2, (x, z) => h.heightAt(x, z, o.at.y + 2));
      }
      // The skirt: dust and grit whirled up round the base.
      for (let k = 0; k < (storm ? 4 : 2); k++) { const a = Math.random() * Math.PI * 2; h.fx.dust(_v.set(o.at.x + Math.cos(a) * 2, o.at.y + 0.2, o.at.z + Math.sin(a) * 2), storm ? 1.6 : 1.1); }
    }
    // Lightning out of the storm cloud, setting the grass alight where it strikes.
    if (storm && o.t >= o.boltAt && o.t < life - 0.5) {
      o.boltAt = o.t + 0.8 + Math.random() * 0.6;
      const a = Math.random() * Math.PI * 2, r = 3 + Math.random() * 7;
      const to = ground(new Vector3(o.at.x + Math.cos(a) * r, o.at.y, o.at.z + Math.sin(a) * r), h);
      this.lightning.strike(_v.set(to.x + (Math.random() - 0.5) * 4, o.at.y + 12, to.z + (Math.random() - 0.5) * 4), to, 0xdfe8ff, 0.45);
      h.lights?.flash(to, 0xdfe8ff, 50, 22, 0.15);
      this.blast(to, 2, s.mult, 2, 0.04);
      this.fires.ignite(to, 1.2, 3, (x, z) => h.heightAt(x, z, to.y + 2));
      h.dig(to.x, to.z, 1, 0.2, 'burnt');
      h.audio.spell('zap');
    }
    // What stands in its way is torn apart and goes up the funnel, block by block.
    if (o.t >= o.tearAt && o.t < life - 0.3) {
      o.tearAt = o.t + 0.2;
      h.tear?.(o.at.x, o.at.z, s.radius + 1.5, 4);
    }
    const R = s.radius + 1;
    for (const sim of h.debris()) sim.push(o.at.x, o.at.z, R, (p, dx, dz, d) => {
      sim.wake(p);
      const inv = 1 / Math.max(0.4, d);
      p.vx += (-dz * inv * 14 - dx * inv * 3) * dt * 6 + o.dir.x * step * 2;
      p.vz += (dx * inv * 14 - dz * inv * 3) * dt * 6 + o.dir.z * step * 2;
      p.vy = Math.max(p.vy, p.y - o.at.y < 9 ? 7 : -1);
    });
    // Mobs it reaches are whirled up its funnel and flung out near the top.
    for (const e of h.enemies) {
      if (o.lifted.has(e) || !e.alive || e.def.boss || e.def.flying || e.held || e.def.speed === 0 || o.t > life - 0.4) continue;
      if (Math.hypot(e.pos.x - o.at.x, e.pos.z - o.at.z) > R) continue;
      e.held = true;
      o.lifted.set(e, { a: Math.atan2(e.pos.z - o.at.z, e.pos.x - o.at.x), y: 0, t: 0 });
    }
    for (const [e, m] of o.lifted) {
      if (!e.alive) { e.held = false; o.lifted.delete(e); continue; }
      m.t += dt;
      m.a += 7 * dt;
      m.y = Math.min(8, m.y + 4.5 * dt);
      const r = 1.2 + m.y * 0.25;
      e.pos.x = o.at.x + Math.cos(m.a) * r; e.pos.y = o.at.y + m.y; e.pos.z = o.at.z + Math.sin(m.a) * r;
      if (m.t > 1.6 || o.t > life - 0.4) this.fling(o, e, m.a, s);
    }
    o.tick -= dt;
    if (o.tick <= 0) {
      o.tick = 0.4;
      this.blast(o.at, s.radius, s.mult, 1.5, 0.02);
      h.smash(o.at.x, o.at.y + 1.2, o.at.z, s.radius, 'heavy');
    }
    if (o.t < life) return false;
    for (const [e, m] of o.lifted) this.fling(o, e, m.a, s);
    o.fx.dispose();
    if (o.light) o.light.done = true;
    return true;
  }

  /** Out of a tornado's funnel: flung off along its spin, hurt by the landing. */
  private fling(o: Tornado, e: Enemy, a: number, s: SpellDef): void {
    o.lifted.delete(e);
    e.held = false;
    e.thrown = { vx: -Math.sin(a) * 10 + Math.cos(a) * 3, vy: 3, vz: Math.cos(a) * 10 + Math.sin(a) * 3, spin: 7, angle: 0 };
    const h = this.h;
    e.onThrownLand = (x, speed) => { x.onThrownLand = undefined; if (x.alive) h.hit(x, s.mult * (1 + speed / 8), 4, 0.06); };
  }

  private overgrow(s: SpellDef, at: Vector3): void {
    const h = this.h;
    this.runes.show(at, s.radius * 0.6, s.color, 2);
    h.audio.spell('grow');
    // The tree in the middle (a reel flower-tree, else a pod tree), growing in two seconds; flowers burst round it.
    const tree = h.sprout?.(['flower-tree', 'pod-tree']);
    if (tree) {
      tree.object.position.copy(at);
      h.scene.add(tree.object);
      this.plants.push({ obj: tree.object, to: tree.scale, t: 0, grow: 2, life: PLANT_LIFE, remove: h.solid?.(at.x, at.z, 0.45, at.y + 4) });
    }
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + Math.random() * 0.6, r = 1.6 + Math.random() * 3;
      const p = ground(new Vector3(at.x + Math.cos(a) * r, at.y, at.z + Math.sin(a) * r), h);
      const f = h.sprout?.(['flower', 'sunflower', 'rose-bush'].sort(() => Math.random() - 0.5));
      if (!f) continue;
      f.object.position.copy(p);
      h.scene.add(f.object);
      this.plants.push({ obj: f.object, to: f.scale, t: -0.1 * i, grow: 0.7, life: PLANT_LIFE - 2 + Math.random() * 3 });
    }
    // Glowing roots hold every body near for three seconds.
    for (const e of this.blast(at, s.radius, s.mult, 0, 0.03)) {
      if (!e.alive || e.def.boss) continue;
      e.afflict('stun', 3);
      this.rooted.push({ e, left: 3, tick: 0 });
    }
    // The roots heave up through anything built there, prising its blocks loose; earth bursts out round them.
    h.tear?.(at.x, at.z, s.radius, 10);
    for (let k = 0; k < 6; k++) { const a = (k / 6) * Math.PI * 2; h.fx.dust(_v.set(at.x + Math.cos(a) * s.radius * 0.6, at.y + 0.2, at.z + Math.sin(a) * s.radius * 0.6), 1.1); }
    h.fx.shock(at, s.color, s.radius * 1.4, 0.8);
    h.fx.flash(_v.set(at.x, at.y + 0.5, at.z), _c.set(s.color), 3);
    h.fx.sparks(_v, UP, 30, s.color, 4, 0.8);
  }
}

/** Chain Hook's catch: the nearest live mob down the line from the hero to the crosshair (HOOK.reach), at most HOOK.side off it. */
export function hookTarget<E extends { alive: boolean; pos: { x: number; z: number } }>(enemies: readonly E[], from: { x: number; z: number }, aim: { x: number; z: number }): E | null {
  let dx = aim.x - from.x, dz = aim.z - from.z;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  let best: E | null = null, bd = Infinity;
  for (const e of enemies) {
    if (!e.alive) continue;
    const ex = e.pos.x - from.x, ez = e.pos.z - from.z;
    const along = ex * dx + ez * dz;
    if (along < 0.5 || along > HOOK.reach) continue;
    const side = Math.abs(ex * dz - ez * dx);
    // Near the line counts most: a mob just off it beats one far down it.
    const score = side * 3 + along * 0.2;
    if (side <= HOOK.side && score < bd) { bd = score; best = e; }
  }
  return best;
}

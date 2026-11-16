/**
 * The twelve spells in the game (Spells.ts holds their numbers; the user's calls of 2026-11-15). Each is built from the
 * pieces the fight already has — hits, the cast's flash and sparks, shock rings, dust — plus what the destruction pass
 * added: smashing what stands (Breakables), digging and scorching the ground (Craters), tearing limbs (Blood Moon), and
 * a rune circle where it is aimed. A shot flies from the hero's hand to the aim point and lands there.
 */
import { Color, Group, Vector3, type Object3D } from 'three';
import { startLeap, type ControllerState } from '../player/CharacterController';
import type { CombatFx } from '../render/CombatFx';
import type { Audio } from '../audio/Audio';
import type { DebrisSim, Piece } from '../world/Debris';
import type { BlowKind } from '../world/Breakables';
import { RuneCircles } from '../render/RuneCircle';
import { Explosions } from '../render/Explosion';
import { GroundFires } from '../render/GroundFire';
import { BlackHoleFx, FireTornadoFx, StormTornadoFx } from '../render/VortexFx';
import { LEAP_RANGE } from './Aim';
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
  /** A vortex tears up to `count` standing blocks loose within `r` of (x, z); returns how many came loose. */
  tear?(x: number, z: number, r: number, count: number): number;
  dig(x: number, z: number, r: number, depth: number, scorch?: 'burnt' | 'frozen'): void;
  shake(n: number): void;
  heightAt(x: number, z: number, y: number): number;
  /** Every live debris sim (rubble, body parts): the black hole and the winds move their pieces. */
  debris(): DebrisSim[];
  /** Blood Moon on for `seconds` (red sky, every blow severs, kills heal). */
  bloodMoon(seconds: number): void;
  announce(text: string): void;
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
interface Hole { at: Vector3; t: number; tick: number; tearAt: number; fx: BlackHoleFx; light?: { pos: Vector3; intensity: number; done: boolean }; lifted: Map<Enemy, { a: number; r: number }> }
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
  /** Earthsplitter's slabs standing, and how long they stand yet. */
  private readonly slabs: Array<{ w: StoneWall; left: number }> = [];
  private readonly flights: Flight[] = [];
  private readonly holes: Hole[] = [];
  private readonly tornados: Tornado[] = [];
  private readonly plants: Plant[] = [];
  private readonly rooted: Rooted[] = [];
  private slam: Slam | null = null;
  private charge: Charge | null = null;
  /** Seconds each frozen body has left, by enemy id (killed while frozen, it shatters into ice). */
  readonly frozen = new Map<number, number>();

  constructor(private readonly h: SpellHost) {
    h.scene.add(this.runes.group);
    h.scene.add(this.explosions.mesh, this.fires.mesh);
    h.scene.add(this.lightning.group);
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
        this.fly(s, hand, aim, T, s.id === 'fireball' ? 2.5 : s.id === 'moonbomb' ? 1.5 : 0.3);
        h.audio.spell('whoosh');
        break;
      }
      case 'earthsplitter': {
        // Up and over to the aim point (at most 12 m), down on it 0.7 s later: the slam lands as he does.
        const dx = aim.x - c.pos.x, dz = aim.z - c.pos.z;
        const d = Math.min(LEAP_RANGE, Math.hypot(dx, dz));
        // (Its height from the aim, so a bridge or a deck he lands on is the ground, not the land under it.)
        this.slam = { at: new Vector3(c.pos.x + (dx / (Math.hypot(dx, dz) || 1)) * d, Math.hypot(dx, dz) <= LEAP_RANGE ? aim.y : c.pos.y, c.pos.z + (dz / (Math.hypot(dx, dz) || 1)) * d), t: 0.7 };
        ground(this.slam.at, h);
        this.runes.cast(this.slam.at, s.color, { radius: s.radius, hold: 0.7, ...RUNE_STACK[s.id] });
        this.leap(dx, dz, 0.7, d);
        h.audio.spell('charge');
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
        fx.group.position.set(aim.x, aim.y + HOLE_UP, aim.z);
        h.scene.add(fx.group);
        const light = h.lights?.hold(s.color, 0, 34);
        light?.pos.copy(fx.group.position);
        this.holes.push({ at: aim.clone(), t: 0, tick: 0, tearAt: 0.6, fx, light, lifted: new Map() });
        // Space tears open: a flash and a ring, dust sucked toward it.
        h.lights?.flash(fx.group.position, 0xe8d8ff, 80, 40, 0.4);
        h.fx.shock(aim, s.color, 9, 0.6);
        h.shake(0.3);
        h.audio.spell('vortex');
        break;
      }
      case 'fire-tornado': {
        const dir = { x: Math.cos(c.yaw), z: Math.sin(c.yaw) };
        const at = ground(new Vector3(c.pos.x + dir.x * 2.5, c.pos.y, c.pos.z + dir.z * 2.5), h);
        const fx = new FireTornadoFx(s.color);
        fx.group.position.copy(at);
        fx.group.scale.setScalar(0.01);
        h.scene.add(fx.group);
        const light = h.lights?.hold(0xff7a28, 0, 20);
        this.tornados.push({ kind: 'fire', at, dir, t: 0, tick: 0, scorch: 0, tearAt: 0.3, boltAt: 0, fx, light, lifted: new Map() });
        h.audio.spell('wind');
        h.audio.spell('crackle');
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
          h.scene.add(this.wall.batch.group);
        }
        h.fx.shock(at, s.color, 4, 0.5);
        for (let k = -2; k <= 2; k++) h.fx.dust(_v.set(at.x - Math.sin(c.yaw) * k * 1.4, at.y + 0.2, at.z + Math.cos(c.yaw) * k * 1.4), 1.3);
        h.smoke?.(at, 2.5, 0x3a3f52, 2.5);
        h.shake(0.45);
        h.audio.spell('rumble');
        break;
      }
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
    // Mobs standing in the fires burn, a little every half second.
    this.burnTick -= dt;
    if (this.burnTick <= 0 && this.fires.live) {
      this.burnTick = 0.5;
      for (const e of h.enemies) if (e.alive && this.fires.burning(e.pos.x, e.pos.z, 0.9)) h.hit(e, 0.12, 0, 0);
    }
    for (const [id, left] of this.frozen) { if (left - dt <= 0) this.frozen.delete(id); else this.frozen.set(id, left - dt); }
    // Shots in flight.
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.T);
      _w.copy(f.mesh.position);
      f.mesh.position.lerpVectors(f.from, f.to, k);
      f.mesh.position.y += Math.sin(k * Math.PI) * f.arc;
      f.missile.update(dt, _w.subVectors(f.mesh.position, _w));
      // Embers (a fireball) or a faint glittering wake (an arrow) left behind.
      h.fx.sparks(f.mesh.position, _w.set(0, 0.3, 0), f.spell.id === 'fireball' ? 3 : 1, f.color, 1.2, 1.0);
      if (k >= 1) { f.mesh.removeFromParent(); f.missile.dispose(); this.flights.splice(i, 1); this.land(f.spell, f.to); }
    }
    if (this.slam && (this.slam.t -= dt) <= 0) { const at = this.slam.at; this.slam = null; this.earthsplit(at); }
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

  private leap(dx: number, dz: number, air: number, dist: number): void {
    const c = this.h.controller;
    // (The controller's own leap: up and over, unsteered, down on time.)
    startLeap(c, { x: dx, z: dz }, air, dist);
  }

  /** Everything in `r` of `at` takes `mult`, thrown off `knock`; returns who was hit. */
  private blast(at: Vector3, r: number, mult: number, knock: number, stop = 0.08): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.h.enemies.slice()) {
      if (!e.alive || !this.h.reachable(e, r, at)) continue;
      this.h.hit(e, mult, knock, stop, _w.set(e.pos.x, e.pos.y + 1, e.pos.z).clone());
      out.push(e);
    }
    return out;
  }

  /** The look of a big landing: two flashes, a shock ring, sparks and smoke, the screen shaking. */
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
        break;
      case 'moonbomb':
        this.blast(at, s.radius, s.mult, 6, 0.1);
        this.boom(at, s.color, s.radius, 0.85);
        h.smash(at.x, at.y + 0.8, at.z, s.radius * 0.8, 'spell');
        h.dig(at.x, at.z, s.radius * 0.55, 1.2, 'burnt');
        h.audio.spell('whoomph');
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

  private earthsplit(at: Vector3): void {
    const s = SPELLS.knight[0];
    const h = this.h;
    for (const e of this.blast(at, s.radius, s.mult, 3, 0.14)) {
      if (e.alive && !e.def.boss && !e.def.flying && e.def.speed > 0) e.leap(0.7, 2.2);
    }
    this.boom(at, s.color, s.radius, 1.0);
    h.smash(at.x, at.y + 0.6, at.z, s.radius, 'burst');
    h.dig(at.x, at.z, 3.6, 1.5);
    h.dig(at.x, at.z, s.radius + 1, 0, 'burnt');
    // Rocks thrown up out of the crater.
    for (const sim of h.debris()) sim.blast(at.x, at.y, at.z, s.radius + 2, 9);
    h.tear?.(at.x, at.z, s.radius + 1.5, 24);
    // Slabs of stone burst up round it, leaning out, and break up a few seconds later.
    const src = this.wallStone();
    if (src) {
      const slabs = new StoneWall(src, at, 0, (x, z) => h.heightAt(x, z, at.y + 3), undefined, { r: s.radius * 0.8, count: 14 });
      h.scene.add(slabs.batch.group);
      this.slabs.push({ w: slabs, left: 2.6 });
    }
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
    let best: Enemy | null = null, bd = 3;
    for (const e of h.enemies) {
      if (!e.alive) continue;
      const d = Math.hypot(e.pos.x - aim.x, e.pos.z - aim.z);
      if (d < bd) { bd = d; best = e; }
    }
    const end = best ? new Vector3(best.pos.x, best.pos.y + 1.2, best.pos.z) : aim.clone().setY(aim.y + 1);
    // The chain: a line of steel glints out to where it caught.
    const n = Math.max(4, Math.round(hand.distanceTo(end) / 0.6));
    for (let i = 0; i <= n; i++) h.fx.sparks(_v.lerpVectors(hand, end, i / n), UP, 1, 0xdfe3f0, 0.6, 1.0);
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
    } else if (best) h.hit(best, s.mult, 0, 0.1, end);
    else {
      // Caught on a wall: it comes down (the chain pulls a chunk of what stands there).
      h.smash(aim.x, aim.y + 1.5, aim.z, s.radius + 0.6, 'burst');
      h.shake(0.3);
    }
  }

  private gale(s: SpellDef): void {
    const h = this.h;
    const c = h.controller;
    const fx = Math.cos(c.yaw), fz = Math.sin(c.yaw);
    for (const e of h.enemies.slice()) {
      if (!e.alive) continue;
      const dx = e.pos.x - c.pos.x, dz = e.pos.z - c.pos.z, d = Math.hypot(dx, dz);
      if (d > s.radius || d < 0.01 || (dx * fx + dz * fz) / d < Math.cos(0.55)) continue;
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
    const m = this.h.model?.('stone-wall');
    return m ? wallSource(m) : null;
  }

  /** A Stone Wall stands (casting it again kicks it). */
  wallUp(): boolean { return !!this.wall?.up; }

  /** Sir Aldric kicks his wall apart: its blocks fly along his facing. */
  kickWall(): void {
    const w = this.wall;
    if (!w?.up) return;
    const h = this.h;
    w.kick(this.wallSim());
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
    for (let i = this.slabs.length - 1; i >= 0; i--) {
      const sl = this.slabs[i];
      sl.w.update(dt);
      if ((sl.left -= dt) <= 0) { sl.w.crumble(this.wallSim()); this.rubble.push(sl.w); this.slabs.splice(i, 1); }
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

  /** Returns true when the black hole is done. */
  private hole(o: Hole, dt: number): boolean {
    const h = this.h;
    const s = SPELLS.wizard[1];
    o.t += dt;
    o.tick -= dt;
    o.fx.update(o.t, dt);
    o.fx.group.scale.multiplyScalar(HOLE_SIZE);
    const cx = o.at.x, cz = o.at.z, cy = o.at.y + HOLE_UP;
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
      m.r = Math.max(2.2, m.r - 0.9 * dt);
      m.a += (1.6 + 5 / m.r) * dt;
      const ty = cy - 1.5 - m.r * 0.6;
      e.pos.x = cx + Math.cos(m.a) * m.r;
      e.pos.z = cz + Math.sin(m.a) * m.r;
      e.pos.y += (ty - e.pos.y) * Math.min(1, 1.4 * dt * pull);
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
    h.lights?.flash(top, 0xf0e4ff, 120, 60, 0.7);
    this.explosions.burst(top, 6, { hot: 0xc9a0ff, smoke: 0.6 });
    h.fx.shock(o.at, 0xe8d8ff, 14, 0.8);
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
    const step = ((storm ? STORM_RUN : TORNADO_RUN) / life) * dt;
    o.at.x += o.dir.x * step; o.at.z += o.dir.z * step;
    // It wanders off its line as it runs (the reel's tornado weaves).
    const weave = Math.sin(o.t * 1.3) * 1.6 + Math.sin(o.t * 2.9 + 1) * 0.6;
    o.at.x += weave * dt * -o.dir.z; o.at.z += weave * dt * o.dir.x;
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

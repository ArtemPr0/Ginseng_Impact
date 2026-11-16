/**
 * The twelve spells in the game (Spells.ts holds their numbers; the user's calls of 2026-11-15). Each is built from the
 * pieces the fight already has — hits, the cast's flash and sparks, shock rings, dust — plus what the destruction pass
 * added: smashing what stands (Breakables), digging and scorching the ground (Craters), tearing limbs (Blood Moon), and
 * a rune circle where it is aimed. A shot flies from the hero's hand to the aim point and lands there.
 */
import {
  AdditiveBlending, NormalBlending, CanvasTexture, Color, Group, Mesh, MeshBasicMaterial, SphereGeometry, Sprite, SpriteMaterial,
  Vector3, type Object3D, type Texture,
} from 'three';
import { startLeap, type ControllerState } from '../player/CharacterController';
import type { CombatFx } from '../render/CombatFx';
import type { Audio } from '../audio/Audio';
import type { DebrisSim, Piece } from '../world/Debris';
import type { BlowKind } from '../world/Breakables';
import { RuneCircles } from '../render/RuneCircle';
import { BlackHoleFx, FireTornadoFx } from '../render/VortexFx';
import { LEAP_RANGE } from './Aim';
import { Lightning } from '../render/Lightning';
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
  /** A solid trunk at (x, z) while a grown tree stands; returns its remover. */
  solid?(x: number, z: number, r: number, top: number): () => void;
  lights?: SpellLights;
}

interface Flight { mesh: Mesh; from: Vector3; to: Vector3; t: number; T: number; arc: number; spell: SpellDef; color: number }
interface Hole { at: Vector3; t: number; tick: number; fx: BlackHoleFx; light?: { pos: Vector3; intensity: number; done: boolean } }
interface Tornado { at: Vector3; dir: { x: number; z: number }; t: number; tick: number; scorch: number; fx: FireTornadoFx; light?: { pos: Vector3; intensity: number; done: boolean } }
interface Plant { obj: Group; to: number; t: number; grow: number; life: number; remove?: () => void }
interface Rooted { e: Enemy; left: number; tick: number }
interface Slam { at: Vector3; t: number }
interface Charge { left: number; dir: { x: number; z: number }; hit: Set<number> }
/** A blast's fireball (glowing, quick) or its smoke (dark, slow, rising). */
interface Puff { mesh: Sprite; mat: SpriteMaterial; t: number; life: number; r: number; rise: number; smoke: boolean }

const HOLE_S = 4;
const TORNADO_S = 5;
const TORNADO_RUN = 15;
const PLANT_LIFE = 20;

const _v = new Vector3();
const _w = new Vector3();
const _c = new Color();
const UP = new Vector3(0, 1, 0);

function ground(p: Vector3, h: SpellHost): Vector3 { p.y = h.heightAt(p.x, p.z, p.y + 2); return p; }

/** A soft round puff (bright middle, no edge), drawn once: fireballs glow with it, smoke billows with it. */
let softTex: Texture | null = null;
function soft(): Texture | null {
  if (softTex || typeof document === 'undefined') return softTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  grad.addColorStop(0.7, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  // A little breakup, so smoke is not a perfect disc.
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, d = 20 + Math.random() * 30;
    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.beginPath(); g.arc(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 6 + Math.random() * 10, 0, Math.PI * 2); g.fill();
  }
  softTex = new CanvasTexture(c);
  return softTex;
}

export class SpellCast {
  readonly runes = new RuneCircles();
  readonly lightning = new Lightning(6);
  private readonly flights: Flight[] = [];
  private readonly holes: Hole[] = [];
  private readonly tornados: Tornado[] = [];
  private readonly plants: Plant[] = [];
  private readonly rooted: Rooted[] = [];
  private slam: Slam | null = null;
  private charge: Charge | null = null;
  private readonly puffs: Puff[] = [];
  private readonly orbGeo = new SphereGeometry(1, 14, 10);
  /** Seconds each frozen body has left, by enemy id (killed while frozen, it shatters into ice). */
  readonly frozen = new Map<number, number>();

  constructor(private readonly h: SpellHost) {
    h.scene.add(this.runes.group);
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
    switch (s.id) {
      case 'moonbomb': case 'fireball': case 'frost-arrow': case 'storm-arrow': {
        const fast = s.id === 'frost-arrow' || s.id === 'storm-arrow' ? 46 : s.id === 'moonbomb' ? 34 : 24;
        const T = Math.max(0.15, hand.distanceTo(aim) / fast);
        this.runes.show(aim, s.radius, s.color, T);
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
        this.runes.show(this.slam.at, s.radius, s.color, 0.7);
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
        this.runes.show(aim, 3, s.color, HOLE_S);
        const fx = new BlackHoleFx(s.color, HOLE_S);
        fx.group.position.set(aim.x, aim.y + 3.2, aim.z);
        h.scene.add(fx.group);
        const light = h.lights?.hold(s.color, 0, 22);
        light?.pos.copy(fx.group.position);
        this.holes.push({ at: aim.clone(), t: 0, tick: 0, fx, light });
        // Space tears open: a flash and a ring, dust sucked toward it.
        h.lights?.flash(fx.group.position, 0xe8d8ff, 60, 30, 0.35);
        h.fx.shock(aim, s.color, 7, 0.5);
        h.shake(0.25);
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
        this.tornados.push({ at, dir, t: 0, tick: 0, scorch: 0, fx, light });
        h.audio.spell('wind');
        h.audio.spell('crackle');
        break;
      }
      case 'overgrowth': this.overgrow(s, aim); break;
    }
    return s;
  }

  update(dt: number): void {
    const h = this.h;
    this.runes.update(dt);
    this.lightning.update(dt);
    for (const [id, left] of this.frozen) { if (left - dt <= 0) this.frozen.delete(id); else this.frozen.set(id, left - dt); }
    // Shots in flight.
    for (let i = this.flights.length - 1; i >= 0; i--) {
      const f = this.flights[i];
      f.t += dt;
      const k = Math.min(1, f.t / f.T);
      f.mesh.position.lerpVectors(f.from, f.to, k);
      f.mesh.position.y += Math.sin(k * Math.PI) * f.arc;
      f.mesh.rotation.y += dt * 9;
      h.fx.sparks(f.mesh.position, _w.set(0, 0.3, 0), 2, f.color, 1.2, 1.0);
      if (k >= 1) { f.mesh.removeFromParent(); this.flights.splice(i, 1); this.land(f.spell, f.to); }
    }
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.t += dt;
      const k = p.t / p.life;
      if (k >= 1) { p.mesh.removeFromParent(); p.mat.dispose(); this.puffs.splice(i, 1); continue; }
      const grow = 1 - (1 - Math.min(1, k * (p.smoke ? 2.5 : 4))) ** 3;
      p.mesh.scale.setScalar(p.r * 2.2 * grow);
      p.mat.rotation += dt * (p.smoke ? 0.15 : 0.6);
      p.mesh.position.y += p.rise * dt;
      p.mat.opacity = p.smoke ? 0.55 * Math.min(1, k * 6) * (1 - k) ** 1.5 : 0.9 * (1 - k) ** 2;
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
    const mesh = new Mesh(this.orbGeo, new MeshBasicMaterial({ color: _c.set(s.color).multiplyScalar(1.4), blending: AdditiveBlending, transparent: true, depthWrite: false }));
    mesh.scale.setScalar(s.id === 'fireball' ? 0.45 : s.id === 'moonbomb' ? 0.32 : 0.18);
    mesh.position.copy(from);
    this.h.scene.add(mesh);
    this.flights.push({ mesh, from: from.clone(), to: to.clone(), t: 0, T, arc, spell: s, color: s.color });
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
    // The fireball itself swelling out and gone in under a second, a white-hot core inside it, then smoke that rises
    // and thins slowly (the screenshots: slow fades, nothing popping off).
    this.puff(at, r * 0.75, color, 0.8, 0, false);
    this.puff(at, r * 0.4, 0xfff4d8, 0.45, 0, false);
    for (let i = 0; i < 4; i++) {
      const a = i * 1.7;
      this.puff(_v.set(at.x + Math.cos(a) * r * 0.25, at.y + 0.6, at.z + Math.sin(a) * r * 0.25), r * (0.45 + i * 0.08), 0x16182a, 3.2 + i * 0.4, 0.8 + i * 0.2, true);
    }
  }

  private puff(at: Vector3, r: number, color: number, life: number, rise: number, smoke: boolean): void {
    const mat = new SpriteMaterial({ map: soft(), color, transparent: true, opacity: 0, depthWrite: false, blending: smoke ? NormalBlending : AdditiveBlending });
    mat.rotation = Math.random() * Math.PI * 2;
    const mesh = new Sprite(mat);
    mesh.position.set(at.x, at.y + (smoke ? 0.4 : 0.6), at.z);
    mesh.scale.setScalar(0.01);
    this.h.scene.add(mesh);
    this.puffs.push({ mesh, mat, t: 0, life, r, rise, smoke });
  }

  private land(s: SpellDef, at: Vector3): void {
    const h = this.h;
    switch (s.id) {
      case 'fireball':
        this.blast(at, s.radius, s.mult, 5, 0.1);
        this.boom(at, s.color, s.radius, 0.75);
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
      h.fx.dust(_v.set(x, c.pos.y + 0.3, z), 1 + k * 0.3);
      h.fx.sparks(_v.set(x, c.pos.y + 1, z), _w.set(fx, 0.15, fz), 10, s.color, 12, 0.35);
    }
    for (const sim of h.debris()) sim.push(c.pos.x + fx * 5, c.pos.z + fz * 5, 6, (p) => { p.vx += fx * 14; p.vz += fz * 14; p.vy += 4; sim.wake(p); });
    h.shake(0.35);
    h.audio.spell('wind');
  }

  /** Returns true when the black hole is done. */
  private hole(o: Hole, dt: number): boolean {
    const h = this.h;
    const s = SPELLS.wizard[1];
    o.t += dt;
    o.tick -= dt;
    o.fx.update(o.t, dt);
    const cx = o.at.x, cz = o.at.z, cy = o.at.y + 3.2;
    // A violet glow pulsing on the ground and the bodies round it.
    if (o.light) o.light.intensity = o.fx.group.scale.x * (14 + Math.sin(o.t * 5) * 4);
    // Pulls everything in: bodies slide to it, pieces fly to it and are ground away to nothing at the middle.
    for (const e of h.enemies) {
      if (!e.alive || e.def.boss) continue;
      const dx = cx - e.pos.x, dz = cz - e.pos.z, d = Math.hypot(dx, dz);
      if (d > s.radius || d < 0.6) continue;
      const step = Math.min(d - 0.6, 5 * dt);
      e.shove((dx / d) * step, (dz / d) * step);
    }
    for (const sim of h.debris()) {
      sim.push(cx, cz, s.radius, (p: Piece, dx: number, dz: number, d: number) => {
        sim.wake(p);
        const k = 18 * dt / Math.max(0.5, d);
        p.vx -= dx * k; p.vz -= dz * k; p.vy += (cy - p.y) * 2 * dt + 0.9;
        const o = p.obj as Object3D | undefined;
        if (d < 1.4 && Math.abs(p.y - cy) < 1.5 && o?.scale) {
          o.scale.multiplyScalar(0.9);
          if (o.scale.x < 0.05) p.dead = true;
        }
      });
    }
    if (o.tick <= 0) {
      o.tick = 0.5;
      this.blast(new Vector3(cx, o.at.y, cz), 3.5, s.mult, 0, 0.02);
      // Dust and grit dragged in off the ground all round.
      for (let k = 0; k < 3; k++) {
        const a = Math.random() * Math.PI * 2, r = s.radius * (0.6 + Math.random() * 0.4);
        h.fx.dust(_v.set(cx + Math.cos(a) * r, h.heightAt(cx + Math.cos(a) * r, cz + Math.sin(a) * r, o.at.y + 2), cz + Math.sin(a) * r), 0.8);
      }
      h.fx.sparks(_v.set(cx, cy, cz), UP, 10, 0xe8d8ff, -5, 0.7);
    }
    if (o.t < HOLE_S) return false;
    // It collapses to a point and bursts.
    o.fx.dispose();
    if (o.light) o.light.done = true;
    h.lights?.flash(_v.set(cx, cy, cz), 0xf0e4ff, 90, 40, 0.6);
    h.fx.shock(o.at, 0xe8d8ff, 10, 0.7);
    const at = new Vector3(cx, o.at.y, cz);
    this.blast(at, 5, 2.5, 7, 0.12);
    this.boom(at, s.color, 5, 0.9);
    h.smash(cx, o.at.y + 1, cz, 4, 'spell');
    h.dig(cx, cz, 3.4, 1.4);
    for (const sim of h.debris()) sim.blast(cx, cy, cz, 6, 10);
    h.audio.spell('whoomph');
    return true;
  }

  /** Returns true when the fire tornado is done. */
  private tornado(o: Tornado, dt: number): boolean {
    const h = this.h;
    const s = SPELLS.wizard[2];
    o.t += dt;
    const step = (TORNADO_RUN / TORNADO_S) * dt;
    o.at.x += o.dir.x * step; o.at.z += o.dir.z * step;
    ground(o.at, h);
    // It wanders a little off its line as it runs.
    o.at.x += Math.sin(o.t * 1.7) * 0.9 * dt * -o.dir.z; o.at.z += Math.sin(o.t * 1.7) * 0.9 * dt * o.dir.x;
    o.fx.group.position.copy(o.at);
    o.fx.update(o.t, dt, o.dir);
    const fade = Math.min(1, o.t / 0.45, (TORNADO_S - o.t) / 0.5);
    o.fx.group.scale.setScalar(Math.max(0.01, fade < 1 ? 1 - (1 - fade) ** 2 : 1));
    if (o.light) { o.light.pos.set(o.at.x, o.at.y + 2.5, o.at.z); o.light.intensity = fade * (16 + Math.random() * 6); }
    // Embers climbing in a spiral, flung out at the top.
    for (let k = 0; k < 4; k++) {
      const a = o.t * 9 + k * 1.6, y = Math.random() * 6.5, r = 0.6 + y * 0.32;
      h.fx.sparks(_v.set(o.at.x + Math.cos(a) * r, o.at.y + y, o.at.z + Math.sin(a) * r), _w.set(-Math.sin(a), 1.4, Math.cos(a)), 1, k % 2 ? 0xffb040 : 0xffe0a0, 4 + y * 0.6, 0.9);
    }
    o.scorch -= dt;
    if (o.scorch <= 0) {
      o.scorch = 0.3;
      h.dig(o.at.x, o.at.z, 1.4, 0, 'burnt');
      // The skirt: dust and grit whirled up round the base.
      for (let k = 0; k < 2; k++) { const a = Math.random() * Math.PI * 2; h.fx.dust(_v.set(o.at.x + Math.cos(a) * 1.6, o.at.y + 0.2, o.at.z + Math.sin(a) * 1.6), 1.1); }
    }
    for (const sim of h.debris()) sim.push(o.at.x, o.at.z, s.radius + 1, (p, dx, dz) => { sim.wake(p); p.vx += -dz * 6 * dt * 10 + o.dir.x * 2; p.vz += dx * 6 * dt * 10 + o.dir.z * 2; p.vy = Math.max(p.vy, 6); });
    o.tick -= dt;
    if (o.tick <= 0) {
      o.tick = 0.4;
      for (const e of this.blast(o.at, s.radius, s.mult, 1.5, 0.02)) if (e.alive && !e.def.boss && !e.def.flying && e.def.speed > 0) e.leap(0.9, 2.6);
      h.smash(o.at.x, o.at.y + 1.2, o.at.z, s.radius, 'heavy');
    }
    if (o.t < TORNADO_S) return false;
    o.fx.dispose();
    if (o.light) o.light.done = true;
    return true;
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
    h.fx.shock(at, s.color, s.radius * 1.4, 0.8);
    h.fx.flash(_v.set(at.x, at.y + 0.5, at.z), _c.set(s.color), 3);
    h.fx.sparks(_v, UP, 30, s.color, 4, 0.8);
  }
}

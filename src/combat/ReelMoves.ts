/**
 * The second spell page (Shift+1-7; playtest 2026-11-17: "copy all abilities from the 2 videos, tailored to the game"):
 * the Flowbound reels' moves, seven per hero. Sir Aldric bends earth (v1: spike rings, spike rows, a ripped-up
 * boulder, pillars kicked forward, a slab of earth for cover, a dust kick, stone armour); Orlan bends fire (v1/v2: fire
 * jets to fly on, a sweeping wave, a ring, a column, a dash on a trail of fire, a burning body, a flaming fist); Wren
 * bends water and ice (v2: an ice ramp, a water shield, a burst of ice shards, a water whip, wave surfing, an ice
 * wall, thrown ice discs). Each move is a few short tasks run every step (they end themselves); what they draw is the
 * spell system's own (spikes, explosions, ground fire, ice shards) and bent water (WaterFx).
 */
import { Vector3, type Object3D } from 'three';
import type { SpellHost } from './SpellCast';
import type { SpellDef } from './Spells';
import type { Enemy } from './Enemy';
import type { SpikeField } from '../render/SpikeField';
import type { WaterFx } from '../render/WaterFx';
import type { Explosions } from '../render/Explosion';
import type { GroundFires } from '../render/GroundFire';
import { flightPoint } from './Aim';

/** What the spell system lends the moves. */
export interface ReelKit {
  blast(at: Vector3, r: number, mult: number, knock: number, stop?: number, skip?: Set<Enemy>): Enemy[];
  boom(at: Vector3, color: number, r: number, shake: number): void;
  spikes(): SpikeField;
  ice(): SpikeField;
  water: WaterFx;
  explosions: Explosions;
  fires: GroundFires;
  iceBurst(at: Vector3, s: SpellDef): void;
  /** A shot flying from `from` to `to` in T seconds on `arc`; it lands through ReelMoves.land. */
  shot(s: SpellDef, from: Vector3, to: Vector3, T: number, arc: number): void;
  /** The mob nearest the line from `from` toward `aim` (Chain Hook's search). */
  lineTarget(from: Vector3, aim: Vector3): Enemy | null;
}

const FIRE = 0xff6a1a;
const DUST = 0xd8c09a;
const UP = new Vector3(0, 1, 0);
/** Walls and ramps: how long they stand (s). */
const EARTH_WALL_S = 6, SHIELD_S = 6, ICE_WALL_S = 8, RAMP_S = 8;
/** Water Whip's reach (m): its aim preview's lane is as long. */
export const WHIP_REACH = 14;

type Task = (dt: number) => boolean;

const _v = new Vector3();

export class ReelMoves {
  private readonly tasks: Task[] = [];
  private tags = 0;

  constructor(private readonly h: SpellHost, private readonly k: ReelKit) {}

  /** Tasks still running (tests). */
  get running(): number { return this.tasks.length; }

  update(dt: number): void {
    for (let i = this.tasks.length - 1; i >= 0; i--) if (this.tasks[i](dt)) this.tasks.splice(i, 1);
  }

  // --- helpers ------------------------------------------------------------------------------------------------------

  private ground(p: Vector3, above = 2): Vector3 { p.y = this.h.heightAt(p.x, p.z, p.y + above); return p; }

  /** The flat way from the hero to `aim` (his facing when it is on him). */
  private heading(aim: Vector3): { x: number; z: number; d: number } {
    const c = this.h.controller;
    const dx = aim.x - c.pos.x, dz = aim.z - c.pos.z, d = Math.hypot(dx, dz);
    return d > 0.5 ? { x: dx / d, z: dz / d, d } : { x: Math.cos(c.yaw), z: Math.sin(c.yaw), d: 0 };
  }

  private canToss(e: Enemy): boolean { return !e.def.boss && !e.def.flying && e.def.speed > 0; }

  /** Hits each mob within `r` of `at` not in `once` (adding it), for `mult`, thrown `knock`; returns them. */
  private hitAt(at: Vector3, r: number, mult: number, knock: number, once: Set<Enemy>): Enemy[] {
    const out: Enemy[] = [];
    for (const e of this.h.enemies.slice()) {
      if (!e.alive || once.has(e) || !this.h.reachable(e, r, at)) continue;
      once.add(e);
      this.h.hit(e, mult, knock, 0.06, new Vector3(e.pos.x, e.pos.y + 0.8, e.pos.z));
      out.push(e);
    }
    return out;
  }

  /** A row of solid posts from `a` to `b`, `top` metres over the ground, that go after `seconds`. */
  private posts(a: Vector3, b: Vector3, step: number, r: number, top: number, seconds: number): void {
    if (!this.h.solid) return;
    const removers: Array<() => void> = [];
    const n = Math.max(1, Math.round(a.distanceTo(b) / step));
    for (let i = 0; i <= n; i++) {
      const p = this.ground(new Vector3().lerpVectors(a, b, i / n));
      removers.push(this.h.solid(p.x, p.z, r, p.y + top));
    }
    let t = 0;
    this.tasks.push((dt) => { if ((t += dt) < seconds) return false; for (const f of removers) f(); return true; });
  }

  /** A packed row of rocks (or ice) along a line through `at` across `yaw`, `width` long, standing `seconds`. */
  private rockRow(field: SpikeField, at: Vector3, side: { x: number; z: number }, width: number, tall: number, seconds: number, tag: string): void {
    for (let s = -width / 2; s <= width / 2 + 1e-3; s += 0.45) {
      const p = this.ground(new Vector3(at.x + side.x * (s + (Math.random() - 0.5) * 0.2), at.y, at.z + side.z * (s + (Math.random() - 0.5) * 0.2)), 3);
      const mid = 1 - Math.abs(s) / (width * 0.6);
      field.raise(p, { height: tall * (0.75 + 0.3 * mid) + Math.random() * 0.5, width: 0.6 + Math.random() * 0.35, delay: Math.abs(s) * 0.04, life: seconds, tag,
        lean: { x: (Math.random() - 0.5) * 0.3, z: (Math.random() - 0.5) * 0.3 } });
    }
  }

  /**
   * A front running from `from` along `dir` for `len` metres at `speed`: every `step` metres `onStep` runs at the
   * front's ground point.
   */
  private run(from: Vector3, dir: { x: number; z: number }, len: number, speed: number, step: number, onStep: (at: Vector3, d: number) => void): void {
    let d = 0, next = step * 0.5;
    this.tasks.push((dt) => {
      d = Math.min(len, d + speed * dt);
      while (next <= d) {
        onStep(this.ground(new Vector3(from.x + dir.x * next, from.y, from.z + dir.z * next)), next);
        next += step;
      }
      return d >= len;
    });
  }

  // --- the moves ----------------------------------------------------------------------------------------------------

  cast(s: SpellDef, hand: Vector3, aim: Vector3): void {
    const h = this.h, c = h.controller, k = this.k;
    const me = new Vector3(c.pos.x, c.pos.y, c.pos.z);
    const way = this.heading(aim);
    const side = { x: -way.z, z: way.x };
    switch (s.id) {
      // Sir Aldric -------------------------------------------------------------------------------------------------
      case 'stone-ring': {
        // He kneels and strikes: two rings of spikes burst up round him, leaning out, flinging what is near.
        for (const [r, n, tall] of [[2.2, 12, 1.6], [3.6, 16, 2.2]] as const) {
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + Math.random() * 0.2;
            const p = this.ground(new Vector3(me.x + Math.cos(a) * r, me.y, me.z + Math.sin(a) * r));
            k.spikes().raise(p, { height: tall + Math.random() * 0.8, width: 0.55 + Math.random() * 0.3, delay: r * 0.03, life: 1.8, lean: { x: Math.sin(a) * 0.5, z: -Math.cos(a) * 0.5 } });
          }
        }
        for (const e of k.blast(me, s.radius, s.mult, 6, 0.12)) if (e.alive && this.canToss(e)) e.leap(0.6, 2.2);
        h.fx.dust(me, 2.5);
        h.fx.shock(me, s.color, s.radius * 1.4, 0.5);
        h.smash(me.x, me.y + 0.5, me.z, s.radius * 0.6, 'skill');
        h.shake(0.6);
        h.audio.spell('rumble');
        break;
      }
      case 'spike-row': {
        // A long row of spikes races out to the crosshair (up to 18 m).
        const once = new Set<Enemy>();
        const len = Math.max(4, Math.min(18, way.d || 12));
        this.run(me, way, len, 30, 0.7, (at, d) => {
          for (let i = 0; i < 2; i++) {
            const o = (i - 0.5) * 0.45;
            k.spikes().raise(new Vector3(at.x + side.x * o, at.y, at.z + side.z * o), { height: 1 + Math.random() * 0.9 + d * 0.04, width: 0.45 + Math.random() * 0.25, delay: 0, life: 1.4,
              lean: { x: way.x * 0.25 + (Math.random() - 0.5) * 0.2, z: way.z * 0.25 + (Math.random() - 0.5) * 0.2 } });
          }
          for (const e of this.hitAt(at, s.radius, s.mult, 3, once)) if (e.alive && this.canToss(e)) e.leap(0.4, 1.4);
          h.fx.dust(at, 0.6);
          h.smash(at.x, at.y + 0.3, at.z, 0.9, 'skill');
        });
        h.shake(0.35);
        h.audio.spell('rumble');
        break;
      }
      case 'boulder': {
        // Torn up out of the ground at his feet and hurled on a high arc at the crosshair.
        const from = this.ground(new Vector3(me.x + way.x * 1.2, me.y, me.z + way.z * 1.2));
        for (let i = 0; i < 5; i++) k.spikes().raise(new Vector3(from.x + (Math.random() - 0.5) * 1.4, from.y, from.z + (Math.random() - 0.5) * 1.4), { height: 0.7 + Math.random() * 0.5, width: 0.45, delay: 0, life: 0.6 });
        h.fx.dust(from, 1.5);
        h.dig(from.x, from.z, 1.2, 0.4);
        const to = aim.clone();
        const T = Math.max(0.4, from.distanceTo(to) / 18);
        const src = h.model?.('boulder') ?? null;
        const rock: Object3D | null = src ? src.clone(true) : null;
        if (rock) { rock.scale.setScalar(1.3); h.scene.add(rock); }
        let t = 0;
        const start = from.clone().setY(from.y + 1.6);
        this.tasks.push((dt) => {
          t += dt;
          const f = Math.min(1, t / T);
          if (rock) { flightPoint(start, to, f, 3, rock.position); rock.rotation.x += dt * 6; rock.rotation.z += dt * 3; }
          if (f < 1) return false;
          rock?.removeFromParent();
          k.blast(to, s.radius, s.mult, 6, 0.12);
          k.boom(to, s.color, s.radius, 0.6);
          h.smash(to.x, to.y + 0.6, to.z, 2.5, 'heavy');
          h.dig(to.x, to.z, 2, 0.6);
          for (const sim of h.debris()) sim.blast(to.x, to.y, to.z, 4, 7);
          return true;
        });
        h.audio.spell('charge');
        break;
      }
      case 'pillars': {
        // Three pillars of rock rise before him (solid), and he kicks them forward as a volley of stone.
        const base = new Vector3(me.x + way.x * 2.6, me.y, me.z + way.z * 2.6);
        const spots = [-1.7, 0, 1.7].map((o) => this.ground(new Vector3(base.x + side.x * o, me.y, base.z + side.z * o)));
        const tag = `pillars${this.tags++}`;
        const removers: Array<() => void> = [];
        for (const p of spots) {
          k.spikes().raise(p, { height: 3.4, width: 1.15, delay: 0, life: 0.8, tag, lean: { x: 0, z: 0 } });
          if (h.solid) removers.push(h.solid(p.x, p.z, 0.65, p.y + 3.4));
          h.fx.dust(p, 1.2);
        }
        let t = 0;
        this.tasks.push((dt) => {
          if ((t += dt) < 0.8) return false;
          for (const f of removers) f();
          k.spikes().drop(tag);
          h.shake(0.4);
          h.audio.spell('rumble');
          const once = new Set<Enemy>();
          const src = h.model?.('boulder') ?? null;
          for (const p of spots) {
            const rock = src ? src.clone(true) : null;
            if (rock) { rock.scale.setScalar(1.1); h.scene.add(rock); }
            this.run(p, way, 14, 22, 0.5, (at, d) => {
              if (rock) { rock.position.set(at.x, at.y + 0.9, at.z); rock.rotation.x += 0.6; }
              h.fx.dust(at, 0.5);
              this.hitAt(at, s.radius, s.mult, 8, once);
              if (d >= 13.5) rock?.removeFromParent();
            });
          }
          return true;
        });
        break;
      }
      case 'earth-wall': {
        // A tall slab of raw earth heaves up right before him: cover, solid, for six seconds.
        const at = new Vector3(me.x + way.x * 2.4, me.y, me.z + way.z * 2.4);
        const tag = `earthwall${this.tags++}`;
        this.rockRow(k.spikes(), at, side, 4, 4, EARTH_WALL_S, tag);
        this.posts(new Vector3(at.x - side.x * 2, at.y, at.z - side.z * 2), new Vector3(at.x + side.x * 2, at.y, at.z + side.z * 2), 0.8, 0.55, 4, EARTH_WALL_S);
        for (let o = -2; o <= 2; o += 1) h.dig(at.x + side.x * o, at.z + side.z * o, 0.8, 0.2, 'burnt');
        h.fx.dust(at, 2);
        h.shake(0.5);
        h.audio.spell('rumble');
        break;
      }
      case 'dust-kick': {
        // A kick into the ground: a wave of dust and grit blasts the cone in front of him back.
        const cos = Math.cos(0.9);
        for (const e of h.enemies.slice()) {
          if (!e.alive) continue;
          const dx = e.pos.x - me.x, dz = e.pos.z - me.z, l = Math.hypot(dx, dz);
          if (l > s.radius + 0.4 || (l > 0.5 && (dx * way.x + dz * way.z) / l < cos)) continue;
          h.hit(e, s.mult, 9, 0.08, new Vector3(e.pos.x, e.pos.y + 0.8, e.pos.z));
        }
        for (let i = 1; i <= 3; i++) k.explosions.burst(this.ground(new Vector3(me.x + way.x * i * 1.5, me.y, me.z + way.z * i * 1.5)), 1.2 + i * 0.4, { hot: DUST });
        h.fx.dust(me, 1.4);
        h.shake(0.35);
        h.audio.spell('whoosh');
        break;
      }
      case 'rock-armor': {
        // Plates of stone close over him: half damage for six seconds.
        h.armor?.(6);
        let t = 0, puff = 0;
        this.tasks.push((dt) => {
          t += dt;
          if ((puff -= dt) <= 0) { puff = 0.45; h.fx.dust(_v.set(c.pos.x, c.pos.y + 0.6, c.pos.z), 0.6); h.fx.sparks(_v.set(c.pos.x, c.pos.y + 1.2, c.pos.z), UP, 4, s.color, 2, 1); }
          return t >= 6;
        });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          k.spikes().raise(this.ground(new Vector3(me.x + Math.cos(a) * 0.9, me.y, me.z + Math.sin(a) * 0.9)), { height: 0.9, width: 0.5, delay: 0, life: 0.4, lean: { x: -Math.sin(a) * 0.5, z: Math.cos(a) * 0.5 } });
        }
        h.fx.shock(me, s.color, 3, 0.4);
        h.audio.spell('rumble');
        break;
      }
      // Orlan --------------------------------------------------------------------------------------------------------
      case 'fire-jets': {
        // Jets of fire from his feet throw him up; he glides on them for four seconds, flame pouring down.
        c.vel.y = 11;
        c.mode = 'air';
        k.blast(me, s.radius, s.mult, 4, 0.06);
        k.explosions.burst(me, 1.8, { hot: FIRE });
        this.k.fires.ignite(me, 1.6, 8, (x, z) => h.heightAt(x, z, me.y + 2));
        let t = 0;
        this.tasks.push((dt) => {
          t += dt;
          if (c.vel.y < -2) c.vel.y = -2;
          h.fx.sparks(_v.set(c.pos.x, c.pos.y + 0.1, c.pos.z), _v.clone().set(0, -1, 0), 4, FIRE, 6, 0.4);
          return t >= 4 || c.mode === 'ground';
        });
        h.audio.spell('whoosh');
        break;
      }
      case 'fire-wave': {
        // A wall of flame five metres wide sweeps out twelve metres before him.
        const once = new Set<Enemy>();
        this.run(me, way, s.radius, 14, 0.9, (at) => {
          for (const o of [-2, 0, 2]) {
            const p = new Vector3(at.x + side.x * o, at.y, at.z + side.z * o);
            k.explosions.burst(p, 1.1, { hot: FIRE });
            this.hitAt(p, 1.4, s.mult, 4, once);
          }
          this.k.fires.ignite(at, 2.4, 4, (x, z) => h.heightAt(x, z, at.y + 2));
        });
        h.audio.spell('whoosh');
        break;
      }
      case 'fire-ring': {
        // Fire bursts up in a ring round the target.
        const at = aim.clone();
        for (let i = 0; i < 10; i++) {
          const a = (i / 10) * Math.PI * 2;
          k.explosions.burst(this.ground(new Vector3(at.x + Math.cos(a) * 3.5, at.y, at.z + Math.sin(a) * 3.5)), 1.3, { hot: FIRE });
        }
        k.blast(at, s.radius, s.mult, 5, 0.1);
        this.k.fires.ignite(at, s.radius, 18, (x, z) => h.heightAt(x, z, at.y + 2));
        h.lights?.flash(_v.set(at.x, at.y + 1.5, at.z), FIRE, 16, 12, 0.5);
        h.shake(0.35);
        h.audio.spell('whoomph');
        break;
      }
      case 'fire-column': {
        // A pillar of flame roars up out of the ground at the crosshair, throwing what stands there up.
        const at = aim.clone();
        for (const e of k.blast(at, s.radius, s.mult, 2, 0.12)) if (e.alive && this.canToss(e)) e.leap(0.7, 3);
        h.lights?.flash(_v.set(at.x, at.y + 3, at.z), 0xff8a2a, 20, 16, 0.9);
        let t = 0, next = 0;
        this.tasks.push((dt) => {
          t += dt;
          while (next <= t && next < 1) { k.explosions.burst(new Vector3(at.x, at.y + next * 9, at.z), 1.1 + (1 - next) * 0.6, { hot: 0xff8a2a }); next += 0.08; }
          return t >= 1;
        });
        this.k.fires.ignite(at, 2, 10, (x, z) => h.heightAt(x, z, at.y + 2));
        h.shake(0.45);
        h.audio.spell('whoomph');
        break;
      }
      case 'fire-dash': {
        // A dash on a trail of fire: ten metres in a third of a second, burning what he passes.
        c.dashDir = { x: way.x, z: way.z };
        c.dashLeft = 0.35;
        c.dashSpeedNow = 10 / 0.35;
        c.dashPlant = true;
        const once = new Set<Enemy>();
        this.run(me, way, 10, 10 / 0.35, 0.8, (at) => {
          this.hitAt(at, s.radius, s.mult, 4, once);
          this.k.fires.ignite(at, 0.8, 3, (x, z) => h.heightAt(x, z, at.y + 2));
          h.fx.sparks(_v.copy(at).setY(at.y + 0.6), UP, 6, FIRE, 4, 0.8);
        });
        h.audio.spell('whoosh');
        break;
      }
      case 'flame-body': {
        // He bursts into flame for six seconds: what stands by him burns, twice a second.
        let t = 0, tick = 0;
        this.tasks.push((dt) => {
          t += dt;
          h.fx.sparks(_v.set(c.pos.x, c.pos.y + 1 + Math.random(), c.pos.z), UP, 2, s.color, 2.5, 1);
          if ((tick -= dt) <= 0) {
            tick = 0.5;
            const at = new Vector3(c.pos.x, c.pos.y, c.pos.z);
            for (const e of h.enemies.slice()) if (e.alive && h.reachable(e, s.radius, at)) h.hit(e, s.mult, 0.6, 0.02, new Vector3(e.pos.x, e.pos.y + 1, e.pos.z));
          }
          return t >= 6;
        });
        k.explosions.burst(me, 1.4, { hot: s.color });
        h.audio.spell('whoosh');
        break;
      }
      case 'fire-fist': {
        // A flaming fist punched out at the crosshair: it hits hard and throws them back.
        k.shot(s, hand, aim, Math.max(0.12, hand.distanceTo(aim) / 32), 0.3);
        h.audio.spell('whoosh');
        break;
      }
      // Wren ---------------------------------------------------------------------------------------------------------
      case 'ice-ramp': {
        // An ice path rises from her feet ahead of her, up to three metres over ten: walk up it, jump off it.
        const tag = `ramp${this.tags++}`;
        const removers: Array<() => void> = [];
        for (let i = 0; i < 8; i++) {
          const d = 1.2 + i * 1.2;
          const p = this.ground(new Vector3(me.x + way.x * d, me.y, me.z + way.z * d));
          const top = me.y + (i + 1) * 0.4;
          if (top <= p.y) continue;
          k.ice().raise(p, { height: top - p.y, width: 1.4, delay: i * 0.05, life: RAMP_S, tag, lean: { x: -way.z * 0, z: 0 } });
          if (h.solid) removers.push(h.solid(p.x, p.z, 0.8, top));
        }
        let t = 0;
        this.tasks.push((dt) => { if ((t += dt) < RAMP_S) return false; for (const f of removers) f(); return true; });
        h.fx.sparks(me, UP, 16, s.color, 4, 1);
        h.audio.spell('frost');
        break;
      }
      case 'water-shield': {
        // A curved wall of water rises before her: it stops what runs at her and pushes it off.
        const pts: Vector3[] = [];
        for (let i = -2; i <= 2; i++) {
          const o = i * 1.1, bow = (1 - (i * i) / 4) * 0.7;
          pts.push(this.ground(new Vector3(me.x + way.x * (2.2 + bow) + side.x * o, me.y, me.z + way.z * (2.2 + bow) + side.z * o)));
        }
        k.water.ribbon(pts, { width: 2.6, life: SHIELD_S, upright: true, color: s.color });
        if (h.solid) {
          const removers = pts.map((p) => h.solid!(p.x, p.z, 0.6, p.y + 2.6));
          let t = 0;
          this.tasks.push((dt) => {
            t += dt;
            for (const e of h.enemies) if (e.alive) for (const p of pts) {
              const dx = e.pos.x - p.x, dz = e.pos.z - p.z, l = Math.hypot(dx, dz);
              if (l < 1.1 && l > 1e-3) e.shove((dx / l) * 3 * dt, (dz / l) * 3 * dt);
            }
            if (t < SHIELD_S) return false;
            for (const f of removers) f();
            return true;
          });
        }
        h.audio.spell('whoosh');
        break;
      }
      case 'ice-shards': {
        // A burst of ice shards at the crosshair: they cut, slow, and fly out across the ground.
        const at = aim.clone();
        k.iceBurst(at, s);
        for (const e of k.blast(at, s.radius, s.mult, 4, 0.08)) e.afflict('slow', 3, 0.5);
        h.audio.spell('frost');
        break;
      }
      case 'water-whip': {
        // A whip of water lashes out along her aim, catches the first one on it and drags it to her.
        // (As far as its preview lane reaches: Aim's 'water-whip' lane, WHIP_REACH.)
        const found = k.lineTarget(me, aim);
        const e = found && Math.hypot(found.pos.x - me.x, found.pos.z - me.z) <= WHIP_REACH ? found : null;
        const end = e ? new Vector3(e.pos.x, e.pos.y + 1, e.pos.z) : new Vector3(me.x + way.x * WHIP_REACH, me.y + 1, me.z + way.z * WHIP_REACH);
        const mid = new Vector3().lerpVectors(hand, end, 0.5).setY(Math.max(hand.y, end.y) + 1.2);
        k.water.ribbon([hand.clone(), mid, end], { width: 0.35, life: 0.7, grow: 0.3, color: s.color });
        if (!e) { h.tip?.('No target'); break; }
        let t = 0, struck = false;
        this.tasks.push((dt) => {
          t += dt;
          if (!struck && t >= 0.15) { struck = true; h.hit(e, s.mult, 0, 0.08, end.clone()); }
          if (struck && e.alive && !e.def.boss) {
            const dx = c.pos.x - e.pos.x, dz = c.pos.z - e.pos.z, l = Math.hypot(dx, dz);
            if (l > 2.2) { const k2 = Math.min(1, dt * 9); e.pos.x += dx * k2 * (1 - 2.2 / l); e.pos.z += dz * k2 * (1 - 2.2 / l); }
          }
          return t >= 0.6;
        });
        h.audio.spell('whoosh');
        break;
      }
      case 'wave-surf': {
        // She rides a wave twelve metres forward: it knocks what it meets aside.
        c.dashDir = { x: way.x, z: way.z };
        c.dashLeft = 0.6;
        c.dashSpeedNow = 12 / 0.6;
        c.dashPlant = true;
        const pts = [0, 4, 8, 12].map((d) => this.ground(new Vector3(me.x + way.x * d, me.y, me.z + way.z * d)).setY(me.y + 0.15));
        k.water.ribbon(pts, { width: 2.2, life: 1.2, grow: 0.5, color: s.color });
        const once = new Set<Enemy>();
        this.run(me, way, 12, 20, 0.8, (at) => {
          for (const e of this.hitAt(at, s.radius, s.mult, 2, once)) {
            const sx = (e.pos.x - at.x) * side.x + (e.pos.z - at.z) * side.z >= 0 ? 1 : -1;
            e.shove(side.x * sx * 2.5, side.z * sx * 2.5);
          }
          h.fx.sparks(_v.copy(at).setY(at.y + 0.3), UP, 5, 0xdff6ff, 3, 0.8);
        });
        h.audio.spell('whoosh');
        break;
      }
      case 'ice-wall': {
        // A wall of ice crystals shoots up across the crosshair: solid for eight seconds.
        const at = aim.clone();
        this.rockRow(k.ice(), at, side, 6, 2.6, ICE_WALL_S, `icewall${this.tags++}`);
        this.posts(new Vector3(at.x - side.x * 3, at.y, at.z - side.z * 3), new Vector3(at.x + side.x * 3, at.y, at.z + side.z * 3), 1, 0.6, 2.6, ICE_WALL_S);
        h.fx.sparks(_v.copy(at).setY(at.y + 1), UP, 20, s.color, 5, 1);
        h.audio.spell('frost');
        break;
      }
      case 'ice-discs': {
        // Three blades of ice thrown in a fan: each cuts through all it passes for sixteen metres.
        const src = h.model?.('ice-crystal') ?? h.model?.('purple-crystal') ?? null;
        for (const turn of [-0.2, 0, 0.2]) {
          const dir = { x: way.x * Math.cos(turn) - way.z * Math.sin(turn), z: way.x * Math.sin(turn) + way.z * Math.cos(turn) };
          const disc = src ? src.clone(true) : null;
          if (disc) { disc.scale.set(0.6, 0.15, 0.6); h.scene.add(disc); }
          const once = new Set<Enemy>();
          this.run(me, dir, 16, 28, 0.5, (at, d) => {
            if (disc) { disc.position.set(at.x, at.y + 1.2, at.z); disc.rotation.y += 1.2; }
            this.hitAt(_v.copy(at), s.radius, s.mult, 2, once);
            h.fx.sparks(_v.copy(at).setY(at.y + 1.2), UP, 1, s.color, 1, 0.6);
            if (d >= 15.6) disc?.removeFromParent();
          });
        }
        h.audio.spell('whoosh');
        break;
      }
    }
  }

  /** A shot the moves threw lands (Fire Fist). */
  land(s: SpellDef, at: Vector3): void {
    if (s.id === 'fire-fist') {
      this.k.blast(at, s.radius, s.mult, 10, 0.12);
      this.k.boom(at, s.color, s.radius, 0.5);
      this.h.smash(at.x, at.y + 0.8, at.z, 1.6, 'skill');
    }
  }
}

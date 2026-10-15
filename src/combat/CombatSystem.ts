import { BoxGeometry, Group, Mesh, PerspectiveCamera, Scene, Vector3, ConeGeometry, CylinderGeometry } from 'three';
import type { Audio } from '../audio/Audio';
import type { CharacterDef } from '../characters/roster';
import type { Game } from '../core/Game';
import { ENEMY_DEFS, ENEMY_SPAWNS, type BossAttackKind, type EnemyDef } from '../data/enemies';
import type { Inventory } from '../items/Inventory';
import { ITEMS } from '../items/Items';
import type { ControllerState, WorldQuery } from '../player/CharacterController';
import type { Party } from '../player/Party';
import { PALETTE } from '../render/palette';
import { surface } from '../render/Materials';
import type { Sky } from '../render/Sky';
import type { Hud } from '../ui/Hud';
import { glowSprite } from '../render/Glow';
import { ComboTracker, Cooldown, computeDamage, inCone, inRadius } from './Combat';
import { ELEMENT_COLOR, REACTIONS, applyElement, type Element, type ReactionId } from './Elements';
import { Enemy } from './Enemy';
import { LootField, rollDrops } from './Loot';
import { COMBO, SKILLS, type AttackDef, type GroundEffectDef } from './Skills';
import { Vfx } from './Vfx';
import { PRESENT_MODELS } from '../data/colliderGrids';
import type { HeightWorld } from '../world/Colliders';

interface Projectile {
  pos: Vector3; vel: Vector3; life: number; owner: 'player' | 'enemy';
  atk: number; mult: number; element: Element | null; radius: number; object: Group;
  chains: number; chainRange: number; hit: Set<number>; knockback: number; hitStop: number;
  /** Arrows fly point-first; bolts tumble. */
  kind: 'bolt' | 'arrow';
}

interface GroundZone { pos: Vector3; def: GroundEffectDef; left: number; tick: number; atk: number; remove: () => void }

export interface CombatInput { attack: boolean; heavyHeld: boolean; heavyRelease: boolean; skill: boolean; burst: boolean; dodge: boolean }

export interface CombatDeps {
  scene: Scene; world: WorldQuery; sky: Sky; hud: Hud; camera: PerspectiveCamera; game: Game; audio: Audio; inventory: Inventory;
  controller: ControllerState; party: Party<CharacterDef>; spawn: Vector3;
  /** Called when the active character falls and another must take over. */
  onForceSwitch?: (index: number) => void;
  /** Camera shake request, 0..1. */
  onShake?: (amount: number) => void;
  /** Dodge roll accepted: the caller applies the dash. */
  onDodge?: () => void;
  /** An enemy of this kind died (quests listen). */
  onKill?: (kind: string) => void;
  /** Where the active character's projectiles leave from (staff tip, bow hand); null → in front of the chest. */
  muzzle?: (me: CharacterDef) => Vector3 | null;
}

const PLAYER_DEF = 30;
const aim = new Vector3();
const IFRAMES = 0.6;
const BURST_MAX = 100;

/** Owns enemies, projectiles, ground zones, VFX, loot, player HP and the attack/skill/burst flow. */
export class CombatSystem {
  enemies: Enemy[] = [];
  readonly loot: LootField;
  private readonly projectiles: Projectile[] = [];
  private readonly zones: GroundZone[] = [];
  private readonly vfx = new Vfx();
  private readonly combos = new Map<string, ComboTracker>();
  private readonly cooldowns = new Map<string, Cooldown>();
  readonly hp = new Map<string, number>();
  private casting: { def: CharacterDef; t: number; fired: boolean } | null = null;
  private heavy: { t: number; fired: boolean; charge: number } | null = null;
  private heavyCharge = 0;
  private burstCast: { t: number; fired: boolean } | null = null;
  burstEnergy = 0;
  private iframes = 0;
  private frenzyLeft = 0;
  private readonly delayed: Array<{ t: number; fn: () => void }> = [];
  private readonly contact = new Map<number, number>();
  private readonly tmp = new Vector3();
  private readonly screen = new Vector3();

  constructor(private readonly d: CombatDeps) {
    d.scene.add(this.vfx.group);
    this.loot = new LootField(d.scene, (x, z, y) => d.world.heightAt(x, z, y));
    for (const s of ENEMY_SPAWNS) {
      // An enemy without its model would be an invisible attacker: it waits until the file exists.
      if (!PRESENT_MODELS.has(s.kind)) continue;
      const at = this.freeSpot(s.x, s.z);
      this.spawnEnemy(ENEMY_DEFS[s.kind], at.x, at.z);
    }
    for (const c of d.party.members) {
      const combo = COMBO[c.weapon];
      this.combos.set(c.id, new ComboTracker(combo.durations, combo.hitFraction));
      this.cooldowns.set(c.id, new Cooldown(SKILLS[c.id].cooldown));
      this.hp.set(c.id, c.maxHp);
    }
  }

  /** The nearest spot to (x, z) on open ground: never inside a building's outline or over the void. */
  private freeSpot(x: number, z: number): { x: number; z: number } {
    const w = this.d.world as Partial<HeightWorld> & WorldQuery;
    const ok = (px: number, pz: number) => !(w.blocked?.(px, pz)) && (w.groundAt ? w.groundAt(px, pz) : w.heightAt(px, pz)) > -20;
    if (ok(x, z)) return { x, z };
    for (let r = 2; r <= 30; r += 2) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        const px = x + Math.cos(a) * r;
        const pz = z + Math.sin(a) * r;
        if (ok(px, pz)) return { x: px, z: pz };
      }
    }
    return { x, z };
  }

  /** Every enemy gives up the chase and walks home (the player crossed a portal or respawned). */
  resetAggro(): void {
    for (const e of this.enemies) e.disengage();
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      if (this.projectiles[i].owner !== 'enemy') continue;
      this.d.scene.remove(this.projectiles[i].object);
      this.projectiles.splice(i, 1);
    }
    this.contact.clear();
  }

  private spawnEnemy(def: EnemyDef, x: number, z: number, noRespawn = false): Enemy {
    const e = new Enemy(def, { x, z }, this.d.world);
    e.noRespawn = noRespawn;
    e.onStomp = (sx, sy, sz) => {
      this.vfx.burst(new Vector3(sx, sy + 0.2, sz), 0x5a6aa8, 14, 3.5, 0.45);
      const dist = Math.hypot(sx - this.d.controller.pos.x, sz - this.d.controller.pos.z);
      this.d.onShake?.(Math.max(0, 0.35 - dist * 0.02));
      if (dist < 40) this.d.audio.stomp();
    };
    this.enemies.push(e);
    this.d.scene.add(e.object);
    return e;
  }

  private get active(): CharacterDef {
    return this.d.party.active;
  }

  private get combo(): ComboTracker {
    return this.combos.get(this.active.id)!;
  }

  /** Attack value including the equipped weapon and buffs. */
  private atkOf(me: CharacterDef): number {
    const w = this.d.inventory.equipped(me.id);
    const bonus = w ? ITEMS[w.itemId].atk ?? 0 : 0;
    return (me.atk + bonus) * (this.frenzyLeft > 0 ? 1.5 : 1);
  }

  /** The element a character applies with elemental hits (weapon may override). */
  private elementOf(me: CharacterDef): Element {
    const w = this.d.inventory.equipped(me.id);
    return (w && ITEMS[w.itemId].element) || me.element;
  }

  /** True while a swing or cast locks movement. */
  get busy(): boolean {
    return this.combo.swinging || this.casting !== null || this.heavy !== null || this.burstCast !== null;
  }

  get charging(): number {
    return this.heavyCharge;
  }

  /** 0..1 animation progress for the rig, or undefined when idle. */
  get attackProgress(): number | undefined {
    if (this.burstCast) return Math.min(1, this.burstCast.t / 1.0);
    if (this.heavy) return Math.min(1, this.heavy.t / 0.8);
    if (this.heavyCharge > 0) return Math.min(0.42, this.heavyCharge * 0.42);
    if (this.casting) return Math.min(1, this.casting.t / SKILLS[this.casting.def.id].castTime);
    return this.combo.swinging ? this.combo.progress : undefined;
  }

  /** Seconds the current swing or cast lasts, so the body's clip can be fitted to it. */
  get attackDuration(): number | undefined {
    if (this.burstCast) return 1.0;
    if (this.heavy) return 0.8;
    if (this.heavyCharge > 0) return undefined;
    if (this.casting) return SKILLS[this.casting.def.id].castTime;
    return this.combo.swinging ? this.combo.duration : undefined;
  }

  get attackKind(): number | 'skill' | 'heavy' | 'burst' | undefined {
    if (this.burstCast) return 'burst';
    if (this.heavy || this.heavyCharge > 0) return 'heavy';
    if (this.casting) return 'skill';
    return this.combo.swinging ? this.combo.currentHit : undefined;
  }

  onSwitch(): void {
    this.casting = null;
    this.heavy = null;
    this.heavyCharge = 0;
    for (const c of this.combos.values()) { c.swinging = false; c.swingTime = 0; }
  }

  healActive(amount: number): void {
    const me = this.active;
    this.hp.set(me.id, Math.min(me.maxHp, (this.hp.get(me.id) ?? 0) + amount));
    this.vfx.burst(this.playerPos().clone().add(new Vector3(0, 1, 0)), PALETTE.witch, 14, 3, 0.35);
    this.d.audio.heal();
  }

  applyFrenzy(seconds: number): void {
    this.frenzyLeft = Math.max(this.frenzyLeft, seconds);
  }

  /** A companion lands a hit on an enemy. */
  companionStrike(enemyId: number, atk: number): void {
    const e = this.enemies.find((x) => x.id === enemyId);
    if (e && e.alive) { this.hitEnemy(e, atk, 1.0, null, 0.8, 0.0); }
  }

  private playerPos(): Vector3 {
    const p = this.d.controller.pos;
    return this.tmp.set(p.x, p.y, p.z);
  }

  private softLock(range: number): void {
    const c = this.d.controller;
    let best: Enemy | null = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dd = Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z);
      if (dd < bestD) { bestD = dd; best = e; }
    }
    if (best) c.yaw = Math.atan2(best.pos.z - c.pos.z, best.pos.x - c.pos.x);
  }

  update(dt: number, input: CombatInput): void {
    const d = this.d;
    const c = d.controller;
    const me = this.active;
    this.iframes = Math.max(0, this.iframes - dt);
    this.frenzyLeft = Math.max(0, this.frenzyLeft - dt);
    for (const cd of this.cooldowns.values()) cd.update(dt);
    for (let i = this.delayed.length - 1; i >= 0; i--) { this.delayed[i].t -= dt; if (this.delayed[i].t <= 0) { this.delayed[i].fn(); this.delayed.splice(i, 1); } }
    const grounded = c.mode === 'ground';
    // Only Wren can shoot from the air (riding her bow); everyone else fights on their feet.
    const canShoot = grounded || (c.mode === 'fly' && me.weapon === 'bow');

    // --- dodge ---
    if (input.dodge && grounded && !this.burstCast) {
      this.iframes = Math.max(this.iframes, 0.5);
      this.casting = null;
      this.heavy = null;
      this.heavyCharge = 0;
      for (const cb of this.combos.values()) { cb.swinging = false; }
      d.audio.dodge();
      d.onDodge?.();
    }

    // --- light attack ---
    if (input.attack && canShoot && !this.casting && !this.heavy && !this.burstCast && this.heavyCharge === 0) {
      this.softLock(7);
      const started = this.combo.press(0);
      if (started !== null) { this.spawnSlash(me, COMBO[me.weapon].hits[started]); d.audio.swing(false); }
    }
    const prevHit = this.combo.currentHit;
    const prevSwinging = this.combo.swinging;
    const hit = this.combo.update(dt);
    if (this.combo.swinging && (!prevSwinging || this.combo.currentHit !== prevHit) && this.combo.swingTime < dt * 1.5 && prevSwinging) {
      this.spawnSlash(me, COMBO[me.weapon].hits[this.combo.currentHit]);
      d.audio.swing(false);
    }
    if (hit !== null) this.resolveAttack(me, COMBO[me.weapon].hits[hit]);

    // --- heavy attack (hold RMB to charge, release to swing) ---
    if (input.heavyHeld && canShoot && !this.busy) {
      this.heavyCharge = Math.min(1, this.heavyCharge + dt / 1.1);
      if (this.heavyCharge > 0.3 && this.heavyCharge - dt / 1.1 <= 0.3) this.vfx.impact(this.playerPos().clone().add(new Vector3(0, 1.2, 0)), ELEMENT_COLOR[this.elementOf(me)], 1.2);
    }
    if ((input.heavyRelease || (!input.heavyHeld && this.heavyCharge > 0)) && this.heavyCharge > 0 && !this.heavy) {
      this.softLock(8);
      this.heavy = { t: 0, fired: false, charge: this.heavyCharge };
      this.heavyCharge = 0;
      d.audio.swing(true);
      const ranged = me.weapon === 'staff' || me.weapon === 'bow';
      const range = ranged ? 12 : 4.2;
      if (!ranged) this.vfx.slash(this.playerPos(), c.yaw, ELEMENT_COLOR[this.elementOf(me)], range, 1.25);
    }
    if (this.heavy) {
      this.heavy.t += dt;
      if (!this.heavy.fired && this.heavy.t >= 0.8 * 0.6) {
        this.heavy.fired = true;
        const ch = this.heavy.charge;
        const def: AttackDef = me.weapon === 'staff'
          ? { mult: 1.8 + ch * 1.8, element: 'own', shape: { kind: 'bolt', range: 16, chains: 2, chainRange: 7 }, knockback: 1 + ch * 2, hitStop: 0.06 + ch * 0.08 }
          : me.weapon === 'bow'
          ? { mult: 2.0 + ch * 2.2, element: 'own', shape: { kind: 'bolt', range: 34, chains: 0, chainRange: 0 }, knockback: 2 + ch * 3, hitStop: 0.07 + ch * 0.08 }
          : { mult: 1.7 + ch * 1.9, element: ch > 0.5 ? 'own' : null, shape: { kind: 'cone', range: 4.2, halfAngle: 1.25 }, knockback: 3 + ch * 5, hitStop: 0.09 + ch * 0.1 };
        this.resolveAttack(me, def);
        if (ch > 0.5) this.vfx.shockwave(this.playerPos(), ELEMENT_COLOR[this.elementOf(me)], 4 + ch * 3);
        d.onShake?.(0.2 + ch * 0.4);
      }
      if (this.heavy.t >= 0.8) this.heavy = null;
    }

    // --- skill ---
    const cd = this.cooldowns.get(me.id)!;
    if (input.skill && grounded && !this.busy && cd.ready) {
      this.softLock(9);
      cd.use();
      this.casting = { def: me, t: 0, fired: false };
      d.audio.cast();
      const skill = SKILLS[me.id];
      if (skill.attack.shape.kind === 'cone') this.vfx.slash(this.playerPos(), c.yaw, ELEMENT_COLOR[this.elementOf(me)], skill.attack.shape.range, skill.attack.shape.halfAngle);
    }
    if (this.casting) {
      const skill = SKILLS[this.casting.def.id];
      this.casting.t += dt;
      if (!this.casting.fired && this.casting.t >= skill.castTime * skill.hitFraction) {
        this.casting.fired = true;
        this.resolveAttack(this.casting.def, skill.attack);
        if (skill.ground) this.addZone({ ...skill.ground, element: this.elementOf(this.casting.def) }, this.atkOf(this.casting.def));
        this.vfx.burst(this.playerPos().clone().add(new Vector3(0, 1, 0)), ELEMENT_COLOR[this.elementOf(this.casting.def)], 16, 6);
      }
      if (this.casting.t >= skill.castTime) this.casting = null;
    }

    // --- burst (Q) ---
    if (input.burst && grounded && !this.busy && this.burstEnergy >= BURST_MAX) {
      this.burstEnergy = 0;
      this.burstCast = { t: 0, fired: false };
      this.iframes = Math.max(this.iframes, 1.0);
      d.audio.burst();
      d.sky.setBloodMoon(true);
    }
    if (this.burstCast) {
      this.burstCast.t += dt;
      const el = this.elementOf(me);
      if (!this.burstCast.fired && this.burstCast.t >= 0.4) {
        this.burstCast.fired = true;
        this.resolveAttack(me, { mult: 4.5, element: 'own', shape: { kind: 'radius', radius: 7.5 }, knockback: 7, hitStop: 0.16 });
        this.addZone({ radius: 6, duration: 6, tickMult: 0.6, tickEvery: 0.8, element: el }, this.atkOf(me));
        this.vfx.shockwave(this.playerPos(), ELEMENT_COLOR[el], 12);
        this.vfx.burst(this.playerPos().clone().add(new Vector3(0, 1, 0)), ELEMENT_COLOR[el], 40, 9, 0.6);
        this.vfx.impact(this.playerPos().clone().add(new Vector3(0, 1.5, 0)), ELEMENT_COLOR[el], 8);
        d.onShake?.(1);
      }
      if (this.burstCast.t >= 1.0) this.burstCast = null;
    }

    // --- enemies ---
    const pp = { x: c.pos.x, y: c.pos.y, z: c.pos.z };
    let anyAggro = false;
    let bossNear: Enemy | null = null;
    for (const e of this.enemies) {
      const action = e.update(dt, pp);
      anyAggro ||= e.aggro;
      if (e.def.boss && e.aggro && e.alive) bossNear = bossNear ?? e;
      if (action?.kind === 'melee') {
        const inRange = inCone({ x: e.pos.x, z: e.pos.z }, e.yaw, { x: c.pos.x, z: c.pos.z }, e.def.brain.attackRange + 0.6, 1.0);
        this.vfx.slash(new Vector3(e.pos.x, e.pos.y, e.pos.z), e.yaw, PALETTE.ultramarine, e.def.brain.attackRange, 1.0);
        if (inRange) this.damagePlayer(e.def.atk, e.def.element);
      } else if (action?.kind === 'bolt') {
        this.enemyBolt(e, 0);
      } else if (action?.kind === 'boss') {
        this.bossAction(e, action.attack);
      }
      // Contact damage window after a charge or bite.
      const win = this.contact.get(e.id);
      if (win !== undefined) {
        const left = win - dt;
        if (left <= 0) this.contact.delete(e.id);
        else {
          this.contact.set(e.id, left);
          if (Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < e.def.bodyRadius * (e.def.scale ?? 1) + 1.2) { this.damagePlayer(e.def.atk * 1.2, e.def.element); this.contact.delete(e.id); this.d.onShake?.(0.7); }
        }
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && e.noRespawn && !e.object.visible) { d.scene.remove(e.object); this.enemies.splice(i, 1); }
    }
    d.sky.setBloodMoon(anyAggro || this.burstCast !== null);
    if (bossNear) d.hud.setBoss(bossNear.def.name, bossNear.def.title ?? '', bossNear.hp / bossNear.def.maxHp, true);
    else d.hud.setBoss('', '', 0, false);

    // --- projectiles ---
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.object.position.copy(p.pos);
      if (p.kind === 'arrow') p.object.lookAt(aim.copy(p.pos).add(p.vel));
      else p.object.rotation.y += dt * 12;
      let dead = p.life <= 0 || p.pos.y < d.world.heightAt(p.pos.x, p.pos.z, p.pos.y) - 0.2;
      if (p.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.alive || p.hit.has(e.id)) continue;
          const sc = e.def.scale ?? 1;
          if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) <= p.radius + e.def.bodyRadius * sc && Math.abs(e.pos.y + e.def.height * sc * 0.5 - p.pos.y) < 2.5 + e.def.height * sc * 0.5) {
            p.hit.add(e.id);
            this.hitEnemy(e, p.atk, p.mult, p.element, p.knockback, p.hitStop);
            if (p.chains > 0) {
              const next = this.nearestEnemy(e.pos.x, e.pos.z, p.chainRange, p.hit);
              if (next) {
                p.chains--;
                p.vel.set(next.pos.x - p.pos.x, next.pos.y + 0.6 - p.pos.y, next.pos.z - p.pos.z).normalize().multiplyScalar(22);
                p.life = 1.2;
              } else dead = true;
            } else dead = true;
            break;
          }
        }
      } else if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < p.radius + 0.5 && Math.abs(c.pos.y + 1 - p.pos.y) < 1.6 + p.radius) {
        this.damagePlayer(p.atk * p.mult, p.element);
        dead = true;
      }
      if (dead) {
        this.vfx.impact(p.pos, p.owner === 'player' ? ELEMENT_COLOR[p.element ?? 'lunar'] : PALETTE.rune, 1.6);
        d.scene.remove(p.object);
        this.projectiles.splice(i, 1);
      }
    }

    // --- ground zones ---
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.left -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.def.tickEvery;
        for (const e of this.enemies) {
          if (e.alive && inRadius({ x: z.pos.x, z: z.pos.z }, { x: e.pos.x, z: e.pos.z }, z.def.radius + e.def.bodyRadius * (e.def.scale ?? 1))) {
            this.hitEnemy(e, z.atk, z.def.tickMult, z.def.element, 0, 0);
          }
        }
      }
      if (z.left <= 0) { z.remove(); this.zones.splice(i, 1); }
    }

    // --- loot ---
    const got = this.loot.update(dt, this.playerPos());
    if (got > 0) { d.inventory.shards += got; d.audio.coins(Math.min(3, Math.ceil(got / 5))); d.hud.shardPop(got); }

    this.vfx.update(dt);
    d.hud.setHp(this.hp.get(me.id)!, me.maxHp);
    d.hud.setSkill(SKILLS[me.id].name, cd.fraction, cd.ready && grounded);
    d.hud.setBurst(this.burstEnergy / BURST_MAX, this.burstEnergy >= BURST_MAX && grounded);
    d.hud.setCharge(this.heavyCharge);
    d.hud.setShards(d.inventory.shards);
    d.hud.setFrenzy(this.frenzyLeft);
  }

  private enemyBolt(e: Enemy, spread: number, speed = 13, mult = 1): void {
    const c = this.d.controller;
    const sc = e.def.scale ?? 1;
    const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.6, e.pos.z);
    const dir = new Vector3(c.pos.x, c.pos.y + 1, c.pos.z).sub(from).normalize();
    if (spread !== 0) {
      const cs = Math.cos(spread);
      const sn = Math.sin(spread);
      const x = dir.x * cs - dir.z * sn;
      const z = dir.x * sn + dir.z * cs;
      dir.x = x; dir.z = z;
    }
    this.spawnProjectile(from, dir.multiplyScalar(speed), 'enemy', e.def.atk, mult, e.def.element, 0.8, ELEMENT_COLOR[e.def.element], 0, 0, 0, 0);
  }

  private bossAction(e: Enemy, kind: BossAttackKind): void {
    const c = this.d.controller;
    const at = new Vector3(e.pos.x, e.pos.y, e.pos.z);
    const dist = Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z);
    const color = ELEMENT_COLOR[e.def.element];
    const sc = e.def.scale ?? 1;
    switch (kind) {
      case 'slam': {
        const r = e.def.bodyRadius * sc + 6;
        this.vfx.shockwave(at, color, r * 1.6);
        this.vfx.burst(at, 0x5a6aa8, 30, 6, 0.6);
        this.d.onShake?.(1);
        this.d.audio.stomp();
        if (dist < r && c.mode === 'ground') this.damagePlayer(e.def.atk * 1.4, e.def.element);
        break;
      }
      case 'boulder': {
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * 0.9, e.pos.z);
        const dir = new Vector3(c.pos.x, c.pos.y + 0.5, c.pos.z).sub(from);
        const len = dir.length();
        dir.normalize().multiplyScalar(16);
        dir.y += len * 0.25;
        this.spawnProjectile(from, dir, 'enemy', e.def.atk, 1.3, 'stone', 1.5, 0x8a96c8, 0, 0, 0, 0, 2.2);
        break;
      }
      case 'roar': {
        this.d.audio.roar();
        this.vfx.shockwave(at.clone().add(new Vector3(0, e.def.height * sc * 0.6, 0)), color, 14);
        this.d.onShake?.(0.9);
        if (dist < 16) {
          const dx = c.pos.x - e.pos.x;
          const dz = c.pos.z - e.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          c.vel.x += (dx / l) * 14;
          c.vel.z += (dz / l) * 14;
          c.vel.y = Math.max(c.vel.y, 5);
          c.mode = 'air';
          this.damagePlayer(e.def.atk * 0.4, e.def.element);
        }
        break;
      }
      case 'volley':
        for (const s of [-0.28, 0, 0.28]) this.enemyBolt(e, s, 15, 0.8);
        this.d.audio.cast();
        break;
      case 'summon': {
        this.vfx.impact(at.clone().add(new Vector3(0, 3, 0)), color, 5);
        for (let i = 0; i < 2; i++) {
          const a = Math.random() * Math.PI * 2;
          const m = this.spawnEnemy(ENEMY_DEFS.beast, e.pos.x + Math.cos(a) * 4, e.pos.z + Math.sin(a) * 4, true);
          m.brain.state = 'chase';
        }
        this.d.audio.cast();
        break;
      }
      case 'blink': {
        this.vfx.impact(at.clone().add(new Vector3(0, 3, 0)), color, 6);
        const bx = c.pos.x - Math.cos(c.yaw) * 4;
        const bz = c.pos.z - Math.sin(c.yaw) * 4;
        e.pos.x = bx;
        e.pos.z = bz;
        e.yaw = Math.atan2(c.pos.z - bz, c.pos.x - bx);
        this.vfx.impact(new Vector3(bx, e.pos.y + 3, bz), color, 6);
        this.d.audio.dodge();
        break;
      }
      case 'roots': {
        const tx = c.pos.x;
        const tz = c.pos.z;
        const ty = this.d.world.heightAt(tx, tz);
        const warn = this.vfx.zone(new Vector3(tx, ty, tz), 3.2, color, 0.75);
        this.delayed.push({ t: 0.7, fn: () => {
          warn();
          const p = new Vector3(tx, ty, tz);
          this.vfx.shockwave(p, color, 5);
          this.vfx.burst(p.clone().add(new Vector3(0, 0.5, 0)), 0x1f4d46, 24, 7, 0.5);
          this.d.audio.stomp();
          if (Math.hypot(c.pos.x - tx, c.pos.z - tz) < 3.2 && c.mode === 'ground') this.damagePlayer(e.def.atk * 1.2, e.def.element);
        } });
        break;
      }
      case 'sweep': {
        const range = (e.currentAttack?.range ?? 6) + e.def.bodyRadius * sc;
        this.vfx.slash(at.clone().add(new Vector3(0, e.def.height * sc * 0.4, 0)), e.yaw, color, range, 1.3);
        this.d.onShake?.(0.5);
        if (inCone({ x: e.pos.x, z: e.pos.z }, e.yaw, { x: c.pos.x, z: c.pos.z }, range, 1.3)) this.damagePlayer(e.def.atk * 1.1, e.def.element);
        break;
      }
      case 'breath': {
        this.d.audio.roar();
        for (let i = 0; i < 6; i++) this.delayed.push({ t: i * 0.08, fn: () => this.enemyBolt(e, (Math.random() - 0.5) * 0.25, 24, 0.35) });
        if (inCone({ x: e.pos.x, z: e.pos.z }, e.yaw, { x: c.pos.x, z: c.pos.z }, 26, 0.4)) this.damagePlayer(e.def.atk * 0.9, e.def.element);
        break;
      }
      case 'charge':
      case 'bite':
        this.contact.set(e.id, kind === 'charge' ? 0.9 : 0.4);
        if (kind === 'bite') this.vfx.slash(at.clone().add(new Vector3(0, 1, 0)), e.yaw, color, e.def.bodyRadius * sc + 2, 0.8);
        break;
    }
  }

  private spawnSlash(me: CharacterDef, def: AttackDef): void {
    if (def.shape.kind !== 'cone') return;
    const color = def.element === 'own' ? ELEMENT_COLOR[this.elementOf(me)] : PALETTE.cloth;
    this.vfx.slash(this.playerPos(), this.d.controller.yaw, color, def.shape.range, def.shape.halfAngle);
  }

  private nearestEnemy(x: number, z: number, range: number, exclude?: Set<number>): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (!e.alive || exclude?.has(e.id)) continue;
      const dd = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (dd < bestD) { bestD = dd; best = e; }
    }
    return best;
  }

  private resolveAttack(me: CharacterDef, def: AttackDef): void {
    const c = this.d.controller;
    const element: Element | null = def.element === 'own' ? this.elementOf(me) : null;
    const atk = this.atkOf(me);
    const origin = { x: c.pos.x, z: c.pos.z };
    if (def.shape.kind === 'bolt') {
      const target = this.nearestEnemy(c.pos.x, c.pos.z, def.shape.range);
      const from = this.d.muzzle?.(me) ?? new Vector3(c.pos.x + Math.cos(c.yaw) * 0.6, c.pos.y + 1.3, c.pos.z + Math.sin(c.yaw) * 0.6);
      const dir = target
        ? new Vector3(target.pos.x - from.x, target.pos.y + 0.5 - from.y, target.pos.z - from.z).normalize()
        : new Vector3(Math.cos(c.yaw), 0.05, Math.sin(c.yaw));
      const arrow = me.weapon === 'bow';
      this.spawnProjectile(from, dir.multiplyScalar(arrow ? 26 : 22), 'player', atk, def.mult, element, 1.0, ELEMENT_COLOR[this.elementOf(me)], def.shape.chains, def.shape.chainRange, def.knockback, def.hitStop, 0.24, arrow ? 'arrow' : 'bolt');
      return;
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const sc = e.def.scale ?? 1;
      const t = { x: e.pos.x, z: e.pos.z };
      const ok = def.shape.kind === 'cone'
        ? inCone(origin, c.yaw, t, def.shape.range + e.def.bodyRadius * sc, def.shape.halfAngle)
        : inRadius(origin, t, def.shape.radius + e.def.bodyRadius * sc);
      if (ok) this.hitEnemy(e, atk, def.mult, element, def.knockback, def.hitStop);
    }
  }

  private hitEnemy(e: Enemy, atk: number, mult: number, element: Element | null, knockback: number, hitStop: number): void {
    const c = this.d.controller;
    const { aura, reaction } = applyElement(e.aura, element);
    e.aura = aura;
    const dmg = computeDamage({ atk: atk * this.d.inventory.damageMult(), multiplier: mult, defense: e.def.def - e.defDown.amount, reaction });
    const kdx = e.pos.x - c.pos.x;
    const kdz = e.pos.z - c.pos.z;
    const kl = Math.hypot(kdx, kdz) || 1;
    const kb = { x: kdx / kl, z: kdz / kl };
    const bossKb = e.def.boss ? 0.15 : 1;
    const died = e.takeDamage(dmg, kb, (knockback + (reaction ? REACTIONS[reaction].knockback : 0)) * bossKb);
    const sc = e.def.scale ?? 1;
    const at = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.5, e.pos.z);
    const color = element ? ELEMENT_COLOR[element] : PALETTE.cloth;
    this.vfx.impact(at, color, 1.8);
    this.vfx.burst(at, color, 8, 4, 0.3);
    this.showNumber(at, dmg, color, false);
    this.d.game.hitStop = Math.max(this.d.game.hitStop, hitStop);
    this.d.onShake?.(hitStop * 2.5);
    this.d.audio.hit(element !== null, hitStop >= 0.08);
    this.burstEnergy = Math.min(BURST_MAX, this.burstEnergy + 6);
    if (reaction) { this.applyReaction(e, reaction, dmg, at); this.d.audio.reaction(); }
    if (died) this.onEnemyDeath(e, at);
  }

  private onEnemyDeath(e: Enemy, at: Vector3): void {
    this.vfx.burst(at, PALETTE.moon, 24, 7, 0.5);
    this.vfx.shockwave(new Vector3(e.pos.x, e.pos.y, e.pos.z), ELEMENT_COLOR[e.def.element], e.def.boss ? 14 : 5);
    this.d.hud.removeEnemyBar(e.id);
    this.d.audio.kill(!!e.def.boss);
    this.d.onKill?.(e.def.kind);
    this.burstEnergy = Math.min(BURST_MAX, this.burstEnergy + 18);
    const drops = rollDrops(e.def.drops, e.def.shards);
    this.loot.spawn(drops, new Vector3(e.pos.x, this.d.world.heightAt(e.pos.x, e.pos.z) + 1, e.pos.z));
    if (e.def.boss) { this.d.hud.announce(`${e.def.name} falls`); this.d.onShake?.(1); }
  }

  private applyReaction(target: Enemy, id: ReactionId, dmg: number, at: Vector3): void {
    const r = REACTIONS[id];
    this.vfx.shockwave(new Vector3(target.pos.x, target.pos.y, target.pos.z), r.color, Math.max(3, r.aoeRadius * 2));
    this.showNumber(at.clone().add(new Vector3(0, 0.6, 0)), r.name, r.color, true);
    this.d.game.hitStop = Math.max(this.d.game.hitStop, 0.1);
    if (id === 'conduit') target.defDown = { amount: r.defDown, left: r.defDownDuration };
    if (r.aoeRadius > 0) {
      for (const e of this.enemies) {
        if (!e.alive || e === target) continue;
        if (inRadius({ x: target.pos.x, z: target.pos.z }, { x: e.pos.x, z: e.pos.z }, r.aoeRadius + e.def.bodyRadius)) {
          const dx = e.pos.x - target.pos.x;
          const dz = e.pos.z - target.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          const splash = Math.max(1, Math.round(dmg * 0.5));
          const died = e.takeDamage(splash, { x: dx / l, z: dz / l }, e.def.boss ? 0 : r.knockback);
          const p = new Vector3(e.pos.x, e.pos.y + e.def.height * 0.5, e.pos.z);
          this.vfx.impact(p, r.color, 1.4);
          this.showNumber(p, splash, r.color, false);
          if (died) this.onEnemyDeath(e, p);
        }
      }
    }
  }

  private addZone(def: GroundEffectDef, atk: number): void {
    const c = this.d.controller;
    const pos = new Vector3(c.pos.x + Math.cos(c.yaw) * 2, c.pos.y, c.pos.z + Math.sin(c.yaw) * 2);
    pos.y = this.d.world.heightAt(pos.x, pos.z);
    const remove = this.vfx.zone(pos, def.radius, ELEMENT_COLOR[def.element], def.duration);
    this.zones.push({ pos, def, left: def.duration, tick: 0.05, atk, remove });
  }

  private spawnProjectile(from: Vector3, vel: Vector3, owner: 'player' | 'enemy', atk: number, mult: number, element: Element | null, radius: number, color: number, chains: number, chainRange: number, knockback: number, hitStop: number, size = 0.24, kind: 'bolt' | 'arrow' = 'bolt'): void {
    const object = new Group();
    if (kind === 'arrow') {
      // A real arrow: shaft along +z (the direction lookAt points), glowing head, two fletching vanes.
      // Sized to read at play distance: a thick pale shaft, a glowing head and a short light trail behind it.
      const shaft = new Mesh(new CylinderGeometry(0.032, 0.032, 1.15, 6), surface({ color: PALETTE.cloth, emissive: PALETTE.moon, emissiveIntensity: 0.6 }));
      shaft.rotation.x = Math.PI / 2;
      const head = new Mesh(new ConeGeometry(0.08, 0.26, 6), surface({ color: PALETTE.stone, emissive: color, emissiveIntensity: 3 }));
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.7;
      const vane = new Mesh(new BoxGeometry(0.016, 0.2, 0.28), surface({ color: PALETTE.cloth, emissive: color, emissiveIntensity: 1.2 }));
      vane.position.z = -0.48;
      const vane2 = vane.clone();
      vane2.rotation.z = Math.PI / 2;
      const glow = glowSprite(color, 0.9, 0.75, true);
      glow.position.z = 0.7;
      object.add(shaft, head, vane, vane2, glow);
      for (let k = 1; k <= 4; k++) {
        const t = glowSprite(color, 0.5 - k * 0.07, 0.45 - k * 0.08, true);
        t.position.z = -0.5 - k * 0.45;
        object.add(t);
      }
      object.position.copy(from);
      object.lookAt(aim.copy(from).add(vel));
    } else {
      const core = new Mesh(new BoxGeometry(size, size, size), surface({ color: PALETTE.void, emissive: color, emissiveIntensity: 3 }));
      core.rotation.set(0.7, 0.7, 0);
      object.add(core, glowSprite(color, 1.1 * (size / 0.24), 0.8, true));
      object.position.copy(from);
    }
    this.d.scene.add(object);
    this.projectiles.push({ pos: from.clone(), vel, life: 2.5, owner, atk, mult, element, radius, object, chains, chainRange, hit: new Set(), knockback, hitStop, kind });
  }

  private damagePlayer(atk: number, _element: Element | null): void {
    if (this.iframes > 0) return;
    const me = this.active;
    const dmg = computeDamage({ atk, multiplier: 1, defense: PLAYER_DEF });
    const hp = Math.max(0, this.hp.get(me.id)! - dmg);
    this.hp.set(me.id, hp);
    this.iframes = IFRAMES;
    const at = this.playerPos().clone().add(new Vector3(0, 1.9, 0));
    this.showNumber(at, dmg, PALETTE.blood, false);
    this.vfx.impact(at, PALETTE.blood, 1.6);
    this.d.hud.flashDamage();
    this.d.audio.hurt();
    this.d.onShake?.(0.4);
    if (hp <= 0) this.onCharacterDown();
  }

  private onCharacterDown(): void {
    const party = this.d.party;
    const next = party.members.findIndex((m) => (this.hp.get(m.id) ?? 0) > 0);
    if (next >= 0) {
      this.d.hud.announce(`${this.active.name} falls`);
      this.d.onForceSwitch?.(next);
    } else {
      this.d.hud.announce('The fog takes you');
      for (const m of party.members) this.hp.set(m.id, m.maxHp);
      const c = this.d.controller;
      c.pos = { x: this.d.spawn.x, y: this.d.spawn.y, z: this.d.spawn.z };
      c.vel = { x: 0, y: 0, z: 0 };
      c.mode = 'ground';
      for (const e of this.enemies) if (e.aggro) { e.brain.state = 'idle'; }
    }
  }

  private showNumber(worldPos: Vector3, value: number | string, color: number, big: boolean): void {
    this.screen.copy(worldPos).project(this.d.camera);
    if (this.screen.z > 1) return;
    const x = (this.screen.x + 1) / 2 * window.innerWidth;
    const y = (1 - this.screen.y) / 2 * window.innerHeight;
    this.d.hud.damageNumber(x, y, String(value), color, big);
  }

  /** Per-frame: enemy animation and HUD projection. */
  render(dt: number): void {
    const cam = this.d.camera;
    for (const e of this.enemies) {
      e.animate(dt, !e.aggro && Math.hypot(e.pos.x - cam.position.x, e.pos.z - cam.position.z) > 110);
      if (!e.alive) continue;
      const sc = e.def.scale ?? 1;
      const dist = Math.hypot(e.pos.x - cam.position.x, e.pos.z - cam.position.z);
      this.screen.set(e.pos.x, e.pos.y + e.def.height * sc + 0.4, e.pos.z).project(cam);
      const visible = this.screen.z < 1 && Math.abs(this.screen.x) < 1.1 && Math.abs(this.screen.y) < 1.1 && dist < (e.def.boss ? 120 : 60) && (e.aggro || e.hp < e.def.maxHp) && !e.def.boss;
      this.d.hud.enemyBar(e.id, e.def.name, (this.screen.x + 1) / 2 * window.innerWidth, (1 - this.screen.y) / 2 * window.innerHeight, e.hp / e.def.maxHp, e.aura ? ELEMENT_COLOR[e.aura.element] : null, visible, e.aura ? e.aura.element : null);
    }
  }
}

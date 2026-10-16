import { BoxGeometry, BufferGeometry, CircleGeometry, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, PerspectiveCamera, Scene, Vector3, ConeGeometry, CylinderGeometry, TorusGeometry, MeshBasicMaterial, AdditiveBlending, DoubleSide, Sprite, SpriteMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Audio } from '../audio/Audio';
import type { CharacterDef } from '../characters/roster';
import type { Game } from '../core/Game';
import { ENEMY_DEFS, ENEMY_SPAWNS, type BossAttackKind, type EnemyDef, type EnemyKind } from '../data/enemies';
import { voiceUrl } from '../data/voices';
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
import { Enemy, type EnemyHome } from './Enemy';
import { LootField, rollDrops } from './Loot';
import { BURST, COMBO, CYCLONE, SKILLS, type AttackDef, type BurstKind, type GroundEffectDef } from './Skills';
import { disposeObject } from '../render/dispose';
import { puffTexture } from '../render/Smoke';
import { loadModel, ModelRig } from '../models/ModelRig';
import { Vfx } from './Vfx';
import { PRESENT_MODELS } from '../data/colliderGrids';
import type { HeightWorld } from '../world/Colliders';

interface Projectile {
  pos: Vector3; vel: Vector3; life: number; owner: 'player' | 'enemy';
  atk: number; mult: number; element: Element | null; radius: number; object: Group;
  chains: number; chainRange: number; hit: Set<number>; knockback: number; hitStop: number;
  /** Arrows fly point-first; bolts tumble; logs tumble end over end under gravity; rings fly face-on; fire flickers. */
  kind: ProjectileKind;
  /** Falls (m/s²): thrown logs arc. */
  gravity: number;
  /** A hit also poisons (witch orbs, the snail's rings). */
  poison: { dps: number; seconds: number } | null;
  color: number;
  /**
   * Steers itself (arrows off Wren's ridden bow, her trip volley): after `delay` it turns toward the target mob (or
   * the point, once the mob is gone), tighter and tighter, keeping its speed.
   */
  homing: { target: Enemy | null; point: Vector3 | null; delay: number; turn: number; age: number } | null;
  /** Drawn swaying off its true path (metres), like it is tripping. */
  wobble: number;
  /** What else a hit does (the trip volley's daze and confusion). */
  onHit: ((e: Enemy) => void) | null;
  /** A hit on the hero pins them in a web for this many seconds. */
  web: number;
  /** Materials whose colour cycles through every hue (the trip volley). */
  rainbow: Array<{ color: { setHSL(h: number, s: number, l: number): unknown } }>;
  seed: number;
}

type ProjectileKind = 'bolt' | 'arrow' | 'log' | 'ring' | 'fire' | 'cup' | 'trip' | 'web' | 'orb';

/** A shot from something that is not an enemy (witches, the snail, the dragon), aimed at the hero. */
export interface HostileShot { speed: number; color: number; atk: number; kind?: ProjectileKind; size?: number; radius?: number; poison?: { dps: number; seconds: number }; spread?: number }

interface GroundZone { pos: Vector3; def: GroundEffectDef; left: number; tick: number; atk: number; remove: () => void }

export interface CombatInput { attack: boolean; heavyHeld: boolean; heavyRelease: boolean; skill: boolean; burst: boolean; dodge: boolean }

export interface CombatDeps {
  scene: Scene; world: WorldQuery; sky: Sky; hud: Hud; camera: PerspectiveCamera; game: Game; audio: Audio; inventory: Inventory;
  controller: ControllerState; party: Party<CharacterDef>; spawn: Vector3;
  /** Called when the active character falls and another must take over. */
  onForceSwitch?: (index: number) => void;
  /** Camera shake request, 0..1. */
  onShake?: (amount: number) => void;
  /** The world swirls (Renderer.trip): a rainbow spell landed on the hero. */
  onTrip?: (strength: number, seconds: number) => void;
  /** Dodge roll accepted: the caller applies the dash. */
  onDodge?: () => void;
  /** An enemy of this kind died (quests listen). */
  onKill?: (kind: string) => void;
  /** Where the active character's projectiles leave from (staff tip, bow hand); null → in front of the chest. */
  muzzle?: (me: CharacterDef) => Vector3 | null;
  /** The whole party fell: the hero is back at the spawn (the caller lets go of boats and the like). */
  onWipe?: () => void;
}

/** Orlan's smoke: a cloud that lingers where he blew it, and the puffs that make it. */
interface SmokeCloud { pos: Vector3; r: number; left: number; life: number; tick: number; puffs: Array<{ s: Sprite; to: Vector3; from: Vector3; spin: number; size: number; delay: number }> }

/** The Frog God's reflections: his body, a breath of his strength, gone at a touch. */
const MIRROR_DEF: EnemyDef = {
  ...ENEMY_DEFS['dmt-entity'], name: 'Reflection', title: undefined, boss: false, maxHp: 1, atk: 80, shards: [0, 0], drops: [],
  brain: { aggroRange: 60, attackRange: 30, windup: 1.2, recover: 1.6, attackCooldown: 1.2, preferredRange: 12 },
  attacks: [{ kind: 'kaleido', range: 30, windup: 1.2, recover: 1.6, weight: 1 }],
};

/** How many summoned mobs one caster keeps at a time. */
const SUMMON_CAP = 4;
let thrownCup: GLTF | null = null;
void loadModel('lean-cup').then((g) => { thrownCup = g; });

const PLAYER_DEF = 30;
const aim = new Vector3();
const side = new Vector3();
const want = new Vector3();
const IFRAMES = 0.6;
const BURST_MAX = 100;

/**
 * Something that is not an enemy but reacts to being shot (the sky eyes, the eye pool): player shots that pass within
 * `radius` of `pos` call `onHit`. `aim` targets are what a shot with no enemy in range flies at when the hero faces one.
 */
export interface ShotTarget {
  pos: Vector3;
  radius: number;
  active(): boolean;
  onHit(at: Vector3): void;
  aim?: boolean;
}

/** Owns enemies, projectiles, ground zones, VFX, loot, player HP and the attack/skill/burst flow. */
export class CombatSystem {
  enemies: Enemy[] = [];
  /** Shootable things that are not enemies (World registers them). */
  readonly targets: ShotTarget[] = [];
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
  private poisonLeft = 0;
  private poisonDps = 0;
  private poisonTick = 0;
  /** A giant's grab: who holds the hero and for how long so far. */
  private grab: { e: Enemy; t: number } | null = null;
  /** Purple puddles of spilled lean (Sizzlin' Slowness while you stand in one), and how long the slow lasts. */
  private readonly puddles: Array<{ pos: Vector3; r: number; left: number; mesh: Mesh }> = [];
  private slowLeft = 0;
  /** Caught in a spider's web: held where you stand (seconds left), and the web drawn around you. */
  private webLeft = 0;
  private webMesh: Group | null = null;
  private mireLeft = 0;
  /** Voice lines: who last spoke and when (so a pack does not talk over itself), and each enemy's last state. */
  private voiceClock = 0;
  private readonly lastState = new Map<number, string>();
  private burstCast: { t: number; fired: boolean; kind: BurstKind; shots: number; tick: number } | null = null;
  burstEnergy = 0;
  private iframes = 0;
  private dodgeCd = 0;
  private readonly clouds: SmokeCloud[] = [];
  /** Mobs each caster has summoned (capped, and sent away with their caster). */
  private readonly summoned = new Map<number, Enemy[]>();
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
      if (!PRESENT_MODELS.has(s.kind) && !ENEMY_DEFS[s.kind].body) continue;
      const at = s.exact ? { x: s.x, z: s.z } : this.freeSpot(s.x, s.z);
      this.spawnEnemy(ENEMY_DEFS[s.kind], at.x, at.z, false, { yaw: s.yaw, patrol: s.patrol, sitY: s.sitY });
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
      this.removeProjectile(i);
    }
    this.contact.clear();
    // Whatever the bosses called up goes back where it came from.
    for (const list of this.summoned.values()) for (const m of list) if (this.enemies.includes(m)) this.despawn(m);
    this.summoned.clear();
  }

  private removeProjectile(i: number): void {
    const p = this.projectiles[i];
    this.d.scene.remove(p.object);
    disposeObject(p.object, p.kind === 'cup');
    this.projectiles.splice(i, 1);
  }

  private spawnEnemy(def: EnemyDef, x: number, z: number, noRespawn = false, home: Partial<EnemyHome> = {}): Enemy {
    const e = new Enemy(def, { ...home, x, z }, this.d.world);
    e.noRespawn = noRespawn;
    e.onCollapse = () => this.d.audio.clatter();
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

  /** True while a swing or cast locks movement (spinning in the lean cyclone, Sir Aldric walks). */
  get busy(): boolean {
    const b = this.burstCast;
    const spinning = b?.kind === 'cyclone' && b.t >= CYCLONE.pour;
    return this.combo.swinging || this.casting !== null || this.heavy !== null || (b !== null && !spinning);
  }

  /** The burst in progress (the rig animates the cyclone's pour and spin from it). */
  get burstState(): { kind: BurstKind; t: number } | undefined {
    return this.burstCast ? { kind: this.burstCast.kind, t: this.burstCast.t } : undefined;
  }

  get charging(): number {
    return this.heavyCharge;
  }

  /** 0..1 animation progress for the rig, or undefined when idle. */
  get attackProgress(): number | undefined {
    if (this.burstCast) return Math.min(1, this.burstCast.t / BURST[this.active.id].time);
    if (this.heavy) return Math.min(1, this.heavy.t / 0.8);
    if (this.heavyCharge > 0) return Math.min(0.42, this.heavyCharge * 0.42);
    if (this.casting) return Math.min(1, this.casting.t / SKILLS[this.casting.def.id].castTime);
    return this.combo.swinging ? this.combo.progress : undefined;
  }

  /** Seconds the current swing or cast lasts, so the body's clip can be fitted to it. */
  get attackDuration(): number | undefined {
    if (this.burstCast) return BURST[this.active.id].time;
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
    this.burstCast = null;
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
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.frenzyLeft = Math.max(0, this.frenzyLeft - dt);
    for (const cd of this.cooldowns.values()) cd.update(dt);
    for (let i = this.delayed.length - 1; i >= 0; i--) { this.delayed[i].t -= dt; if (this.delayed[i].t <= 0) { this.delayed[i].fn(); this.delayed.splice(i, 1); } }
    // Poison: a tick every half second, through any dodge.
    if (this.poisonLeft > 0) {
      this.poisonLeft -= dt;
      this.poisonTick -= dt;
      if (this.poisonTick <= 0) {
        this.poisonTick = 0.5;
        const hp = Math.max(0, this.hp.get(me.id)! - this.poisonDps * 0.5);
        this.hp.set(me.id, hp);
        this.showNumber(this.playerPos().clone().add(new Vector3(0, 1.8, 0)), Math.round(this.poisonDps * 0.5), PALETTE.witch, false);
        if (hp <= 0) { this.poisonLeft = 0; this.onCharacterDown(); }
      }
    }
    // Held in a giant's fist: lifted, shaken, then thrown.
    if (this.grab) {
      const g = this.grab;
      g.t += dt;
      const e = g.e;
      const fx = Math.cos(e.yaw);
      const fz = Math.sin(e.yaw);
      const reach = e.def.bodyRadius * (e.def.scale ?? 1) + 1.1;
      const lift = Math.min(1, g.t / 0.4);
      c.pos.x = e.pos.x + fx * reach;
      c.pos.z = e.pos.z + fz * reach;
      c.pos.y = e.pos.y + e.def.height * (0.35 + 0.25 * lift) + Math.sin(g.t * 26) * 0.06;
      c.vel.x = c.vel.y = c.vel.z = 0;
      c.mode = 'air';
      if (g.t >= 0.85 || !e.alive) {
        this.grab = null;
        // Thrown about twelve metres the way the giant faces.
        c.vel.x = fx * 16;
        c.vel.z = fz * 16;
        c.vel.y = 9.5;
        c.flung = 1.5;
        this.iframes = 0;
        if (e.alive) this.damagePlayer(e.def.atk * 1.2, e.def.element);
        this.d.onShake?.(0.7);
        this.d.audio.roar();
      }
    }
    // Puddles of lean: standing in one keeps you slowed (and the world tilts); they shrink away after a while.
    this.voiceClock = Math.max(0, this.voiceClock - dt);
    this.slowLeft = Math.max(0, this.slowLeft - dt);
    this.webLeft = Math.max(0, this.webLeft - dt);
    this.mireLeft = Math.max(0, this.mireLeft - dt);
    this.updateWebbed();
    for (let i = this.puddles.length - 1; i >= 0; i--) {
      const p = this.puddles[i];
      p.left -= dt;
      const k = Math.min(1, p.left / 1.2);
      p.mesh.scale.setScalar(Math.max(0.05, k));
      if (c.mode === 'ground' && Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < p.r * k && Math.abs(c.pos.y - p.pos.y) < 1) this.slowLeft = Math.max(this.slowLeft, 1.4);
      if (p.left <= 0) { this.d.scene.remove(p.mesh); disposeObject(p.mesh); this.puddles.splice(i, 1); }
    }
    // Spotting you: a talking mob says so as it starts the chase.
    for (const e of this.enemies) {
      const was = this.lastState.get(e.id);
      if (was === 'idle' && e.state === 'chase') this.say(e, e.def.voices?.aggro);
      this.lastState.set(e.id, e.state);
    }
    const grounded = c.mode === 'ground';
    const flying = c.mode === 'fly';
    // From the air: Wren shoots off the bow she rides, Orlan casts as he floats, Sir Aldric swings at whatever is
    // close (his charged swing and the skills want his feet on the ground).
    const canShoot = grounded || flying;
    const canHeavy = grounded || (flying && me.weapon !== 'greatsword');
    const burstKind = BURST[me.id].kind;
    const canBurst = grounded || (flying && burstKind !== 'cyclone');

    // --- dodge (a short cooldown: no chaining rolls into permanent invulnerability) ---
    if (input.dodge && grounded && !this.burstCast && this.dodgeCd <= 0) {
      this.dodgeCd = 0.9;
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
      const started = this.combo.press();
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
    if (input.heavyHeld && canHeavy && !this.busy) {
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
    if (input.skill && grounded && !this.busy && this.heavyCharge === 0 && cd.ready) {
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

    // --- burst (Q): each hero's own ---
    if (input.burst && canBurst && !this.busy && this.heavyCharge === 0 && this.burstEnergy >= BURST_MAX) {
      this.burstEnergy = 0;
      this.burstCast = { t: 0, fired: false, kind: burstKind, shots: 0, tick: 0 };
      this.iframes = Math.max(this.iframes, 1.0);
      d.audio.burst();
      d.sky.setBloodMoon(true);
      d.hud.announce(BURST[me.id].name);
    }
    if (this.burstCast) {
      const b = this.burstCast;
      b.t += dt;
      if (b.kind === 'cyclone') this.cyclone(me, b, dt);
      else if (b.kind === 'trip') {
        // Ten arrows, one every 0.1 s.
        while (b.shots < 10 && b.t >= 0.3 + b.shots * 0.1) { this.tripArrow(me, b.shots); b.shots++; }
      } else if (!b.fired && b.t >= 0.45) {
        b.fired = true;
        this.blowSmoke();
      }
      if (b.t >= BURST[me.id].time) this.burstCast = null;
    }

    // --- enemies ---
    const pp = { x: c.pos.x, y: c.pos.y, z: c.pos.z };
    let anyAggro = false;
    let bossNear: Enemy | null = null;
    for (const e of this.enemies) {
      // Turned on its own by Orlan's smoke: it goes for another mob (and cannot see the hero at all).
      if (e.status.brawl > 0 && !e.brawling) e.brawlTarget = this.brawlFoe(e);
      const foe = e.brawling ? e.brawlTarget : null;
      const action = e.update(dt, foe ? foe.pos : pp);
      if (foe) { if (action) this.brawlHit(e, foe); continue; }
      anyAggro ||= e.aggro && e.status.confuse <= 0;
      if (e.def.boss && e.aggro && e.alive) bossNear = bossNear ?? e;
      if (action?.kind === 'melee') {
        const inRange = inCone({ x: e.pos.x, z: e.pos.z }, e.yaw, { x: c.pos.x, z: c.pos.z }, e.def.brain.attackRange + 0.6, 1.0);
        this.vfx.slash(new Vector3(e.pos.x, e.pos.y, e.pos.z), e.yaw, PALETTE.ultramarine, e.def.brain.attackRange, 1.0);
        if (inRange) this.damagePlayer(e.def.atk, e.def.element);
      } else if (action?.kind === 'boss') {
        this.bossAction(e, action.attack);
      }
      // Contact damage window after a charge or bite.
      const win = this.contact.get(e.id);
      if (win !== undefined) {
        const left = win - dt;
        const sc = e.def.scale ?? 1;
        if (left <= 0 || !e.alive) this.contact.delete(e.id);
        else {
          this.contact.set(e.id, left);
          const level = c.pos.y > e.pos.y - 1.5 && c.pos.y < e.pos.y + e.def.height * sc;
          if (level && Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < e.def.bodyRadius * sc + 1.2) { this.damagePlayer(e.def.atk * 1.2, e.def.element); this.contact.delete(e.id); this.d.onShake?.(0.7); }
        }
      }
    }
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && e.noRespawn && !e.object.visible) this.despawn(e);
    }
    d.sky.setBloodMoon(anyAggro || this.burstCast !== null);
    if (bossNear) d.hud.setBoss(bossNear.def.name, bossNear.def.title ?? '', bossNear.hp / bossNear.def.maxHp, true);
    else d.hud.setBoss('', '', 0, false);

    // --- projectiles ---
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      if (p.gravity) p.vel.y -= p.gravity * dt;
      if (p.homing) this.steer(p, dt);
      p.pos.addScaledVector(p.vel, dt);
      p.object.position.copy(p.pos);
      if (p.wobble > 0) {
        // Off its true line, swaying both ways as if the arrow were seeing things.
        const age = 4 - p.life;
        side.set(-p.vel.z, 0, p.vel.x).normalize();
        p.object.position.addScaledVector(side, Math.sin(age * 13 + p.seed) * p.wobble).y += Math.cos(age * 9 + p.seed * 2) * p.wobble * 0.7;
        p.object.scale.setScalar(1 + Math.sin(age * 20 + p.seed) * 0.25);
      }
      if (p.rainbow.length) {
        const h = (performance.now() / 1000 * 1.4 + p.seed) % 1;
        p.rainbow.forEach((m, k) => m.color.setHSL((h + k * 0.13) % 1, 1, 0.6));
      }
      if (p.kind === 'arrow' || p.kind === 'ring' || p.kind === 'trip' || p.kind === 'web') p.object.lookAt(aim.copy(p.object.position).add(p.vel));
      if (p.kind === 'web') p.object.rotateZ(dt * 3);
      else if (p.kind === 'log' || p.kind === 'cup') { p.object.rotation.x += dt * 7; p.object.rotation.y += dt * 1.3; }
      else if (p.kind === 'fire') p.object.scale.setScalar(1 + (2.5 - p.life) * 0.6);
      else p.object.rotation.y += dt * 12;
      // (Asked as a point, not a person: the ground query keeps a body's head room under overhangs, which would
      // break a shot flying close under a roof.)
      let dead = p.life <= 0 || p.pos.y < d.world.heightAt(p.pos.x, p.pos.z, p.pos.y - 1.8) - 0.2;
      if (p.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.alive || p.hit.has(e.id)) continue;
          const sc = e.def.scale ?? 1;
          if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) <= p.radius + e.def.bodyRadius * sc && Math.abs(e.pos.y + e.def.height * sc * 0.5 - p.pos.y) < 2.5 + e.def.height * sc * 0.5) {
            p.hit.add(e.id);
            this.hitEnemy(e, p.atk, p.mult, p.element, p.knockback, p.hitStop);
            p.onHit?.(e);
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
        if (!dead) for (const t of this.targets) {
          if (!t.active() || t.pos.distanceTo(p.pos) > p.radius + t.radius) continue;
          t.onHit(p.pos.clone());
          dead = true;
          break;
        }
      } else if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < p.radius + 0.5 && Math.abs(c.pos.y + 1 - p.pos.y) < 1.6 + p.radius) {
        const shielded = this.iframes > 0;
        this.damagePlayer(p.atk * p.mult, p.element);
        if (p.poison) this.poisonPlayer(p.poison.dps, p.poison.seconds);
        if (p.web > 0 && !shielded) this.ensnare(p.web);
        if (p.kind === 'trip' && !shielded) this.d.onTrip?.(0.6, 3);
        dead = true;
      }
      if (dead) {
        this.vfx.impact(p.pos, p.owner === 'player' ? ELEMENT_COLOR[p.element ?? 'lunar'] : p.color, p.kind === 'log' ? 3.5 : 1.6);
        if (p.kind === 'log') { this.vfx.burst(p.pos.clone(), 0x5a6aa8, 18, 5, 0.5); this.d.onShake?.(0.4); this.d.audio.stomp(); }
        if (p.kind === 'cup') this.spawnPuddle(p.pos);
        if (p.kind === 'trip') for (const col of [0xff5ad6, 0x37f5ff, 0x5dff3a, 0x8b3dff]) this.vfx.burst(p.pos.clone(), col, 6, 4, 0.4);
        this.removeProjectile(i);
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
            this.hitEnemy(e, z.atk, z.def.tickMult, z.def.element, 0, 0, false);
          }
        }
      }
      if (z.left <= 0) { z.remove(); this.zones.splice(i, 1); }
    }

    this.updateClouds(dt);

    // --- loot ---
    const got = this.loot.update(dt, this.playerPos());
    if (got > 0) { d.inventory.shards += got; d.audio.coins(Math.min(3, Math.ceil(got / 5))); d.hud.shardPop(got); }

    this.vfx.update(dt);
    d.hud.setHp(this.hp.get(me.id)!, me.maxHp);
    d.hud.setSkill(SKILLS[me.id].name, cd.fraction, cd.ready && grounded);
    d.hud.setBurst(this.burstEnergy / BURST_MAX, this.burstEnergy >= BURST_MAX && canBurst, BURST[me.id].name);
    d.hud.setCharge(this.heavyCharge);
    d.hud.setShards(d.inventory.shards);
    d.hud.setFrenzy(this.frenzyLeft);
  }

  /**
   * Sir Aldric's lean cyclone: the pour (the rig tips the cup over the blade), then a spin that cuts everything
   * around him every 0.3 s and splashes it with lean: slowed to a crawl, moving and striking.
   */
  private cyclone(me: CharacterDef, b: { t: number; tick: number; fired: boolean }, dt: number): void {
    if (b.t < CYCLONE.pour) return;
    b.tick -= dt;
    if (b.tick > 0) return;
    b.tick = 0.3;
    const c = this.d.controller;
    const at = this.playerPos().clone();
    const last = b.t + 0.3 >= CYCLONE.pour + CYCLONE.spin;
    const radius = last ? 5 : 3.8;
    for (const e of this.enemies) {
      if (!e.alive || !this.reachable(e, radius, at)) continue;
      this.hitEnemy(e, this.atkOf(me), last ? 1.6 : 0.7, this.elementOf(me), last ? 4 : 1.2, 0.02, false);
      e.afflict('slow', 2.6, 0.35);
      this.vfx.burst(new Vector3(e.pos.x, e.pos.y + e.def.height * (e.def.scale ?? 1) * 0.6, e.pos.z), 0xb36bff, 8, 3, 0.35);
    }
    this.vfx.burst(at.clone().add(new Vector3(0, 1.1, 0)), 0xb36bff, 12, 6, 0.4);
    if (!b.fired || last) { this.vfx.shockwave(new Vector3(c.pos.x, c.pos.y, c.pos.z), 0x8b3dff, radius * 1.4); b.fired = true; }
    this.d.audio.swing(last);
  }

  /**
   * A lob from `from` to `to` under gravity `g` that takes about `T` seconds, flattened under a roof (a pavilion's dome,
   * a hall's vault) so the arc's top stays half a metre under the ceiling instead of breaking on it.
   */
  private lob(from: Vector3, to: Vector3, T: number, g: number): Vector3 {
    const w = this.d.world as Partial<HeightWorld> & WorldQuery;
    const roof = w.ceilingAt?.(from.x, from.z, from.y) ?? Infinity;
    const room = roof - from.y - 0.5;
    // The arc rises g·T²/8 over the straight line between the ends (plus whatever the line itself climbs).
    if (Number.isFinite(room)) T = Math.max(0.45, Math.min(T, Math.sqrt((8 * Math.max(0.2, room - Math.max(0, to.y - from.y))) / g)));
    const vel = to.clone().sub(from).divideScalar(T);
    vel.y += 0.5 * g * T;
    return vel;
  }

  /** True when `e`'s body is within `radius` of `at` across the ground and roughly level with it. */
  private reachable(e: Enemy, radius: number, at: Vector3): boolean {
    const sc = e.def.scale ?? 1;
    if (Math.hypot(e.pos.x - at.x, e.pos.z - at.z) > radius + e.def.bodyRadius * sc) return false;
    return at.y + 1 > e.pos.y - radius * 0.6 && at.y + 1 < e.pos.y + e.def.height * sc + radius * 0.6;
  }

  /**
   * One of Wren's trip-volley arrows: launched up and out in a fan, then each picks a mob (or, with none about, a
   * random spot on the ground) and wanders in on it, swaying and changing colour; a hit dazes, then confuses.
   */
  private tripArrow(me: CharacterDef, i: number): void {
    const c = this.d.controller;
    const from = this.d.muzzle?.(me) ?? new Vector3(c.pos.x, c.pos.y + 1.4, c.pos.z);
    const near = this.enemies
      .filter((e) => e.alive && Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 34)
      .sort((a, b) => Math.hypot(a.pos.x - c.pos.x, a.pos.z - c.pos.z) - Math.hypot(b.pos.x - c.pos.x, b.pos.z - c.pos.z));
    const target = near.length ? near[i % near.length] : null;
    let point: Vector3 | null = null;
    if (!target) {
      const a = c.yaw + (Math.random() - 0.5) * 2.4;
      const r = 6 + Math.random() * 12;
      const x = c.pos.x + Math.cos(a) * r;
      const z = c.pos.z + Math.sin(a) * r;
      point = new Vector3(x, this.d.world.heightAt(x, z, c.pos.y + 2), z);
    }
    const fan = c.yaw + (i - 4.5) * 0.24;
    const vel = new Vector3(Math.cos(fan), 0.5 + Math.random() * 0.45, Math.sin(fan)).normalize().multiplyScalar(17);
    this.spawnProjectile(from, vel, 'player', this.atkOf(me), 1.15, this.elementOf(me), 1.0, 0xff5ad6, 0, 0, 0.8, 0.03, 0.24, 'trip', {
      homing: { target, point, delay: 0.12 + Math.random() * 0.18, turn: 2.6 + Math.random() * 2, age: 0 },
      wobble: 0.3 + Math.random() * 0.3,
      onHit: (e) => { e.afflict('stun', e.def.boss ? 0.8 : 1.6); e.afflict('confuse', e.def.boss ? 2.2 : 4.2); },
    });
    this.d.audio.swing(false);
  }

  /** Turns a steering projectile toward its mob (or point), tighter as it goes, keeping its speed. */
  private steer(p: Projectile, dt: number): void {
    const h = p.homing!;
    h.age += dt;
    if (h.age < h.delay) return;
    if (h.target && !h.target.alive) {
      // Its mob fell: the nearest other one, or the spot where it stood.
      const next = this.nearestEnemy(p.pos.x, p.pos.z, 20, p.hit);
      if (!next) h.point = new Vector3(h.target.pos.x, h.target.pos.y + 0.5, h.target.pos.z);
      h.target = next;
    }
    if (h.target) {
      const sc = h.target.def.scale ?? 1;
      want.set(h.target.pos.x, h.target.pos.y + h.target.def.height * sc * 0.5, h.target.pos.z);
    } else if (h.point) want.copy(h.point);
    else return;
    const speed = p.vel.length();
    want.sub(p.pos).normalize().multiplyScalar(speed);
    p.vel.lerp(want, 1 - Math.exp(-h.turn * dt)).setLength(speed);
    h.turn += dt * 5;
  }

  /** Orlan's pipe dream: a great cloud of smoke rolls out from his pipe and hangs over everything around him. */
  private blowSmoke(): void {
    const c = this.d.controller;
    const pos = new Vector3(c.pos.x, c.pos.y, c.pos.z);
    const pipe = new Vector3(c.pos.x + Math.cos(c.yaw) * 0.3, c.pos.y + 1.25, c.pos.z + Math.sin(c.yaw) * 0.3);
    const cloud: SmokeCloud = { pos, r: 11, left: 8.5, life: 8.5, tick: 0, puffs: [] };
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const rr = Math.sqrt(Math.random()) * cloud.r;
      const to = new Vector3(pos.x + Math.cos(a) * rr, pos.y + 0.6 + Math.random() * 3.2, pos.z + Math.sin(a) * rr);
      const s = new Sprite(new SpriteMaterial({ map: puffTexture(), color: i % 3 ? 0xa79ad8 : 0xc9c2ee, transparent: true, opacity: 0, depthWrite: false }));
      s.position.copy(pipe);
      s.material.rotation = Math.random() * 6.28;
      this.d.scene.add(s);
      cloud.puffs.push({ s, to, from: pipe.clone(), spin: (Math.random() - 0.5) * 0.6, size: 2.6 + Math.random() * 3.2, delay: Math.random() * 0.9 });
    }
    this.clouds.push(cloud);
    this.d.audio.cast();
  }

  /** Smoke clouds: puffs roll out and drift; every mob inside is turned on its own (or loses the hero, alone). */
  private updateClouds(dt: number): void {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cl = this.clouds[i];
      cl.left -= dt;
      const age = cl.life - cl.left;
      const fade = Math.min(1, cl.left / 1.5);
      for (const p of cl.puffs) {
        const k = Math.max(0, Math.min(1, (age - p.delay) / 1.6));
        const e = 1 - (1 - k) * (1 - k);
        p.s.position.lerpVectors(p.from, p.to, e);
        p.s.position.y += Math.sin(age * 0.6 + p.spin * 9) * 0.3;
        p.s.material.rotation += p.spin * dt;
        const sz = 0.4 + p.size * e;
        p.s.scale.set(sz, sz, 1);
        p.s.material.opacity = 0.5 * Math.min(1, k * 3) * fade;
      }
      cl.tick -= dt;
      if (cl.tick <= 0 && age > 0.4) {
        cl.tick = 0.4;
        for (const e of this.enemies) {
          if (!e.alive || e.brawling || !this.reachable(e, cl.r, cl.pos)) continue;
          const foe = this.brawlFoe(e);
          if (foe) { e.brawlTarget = foe; e.afflict('brawl', e.def.boss ? 4.5 : 7.5); }
          else e.afflict('confuse', e.def.boss ? 3 : 6);
        }
      }
      if (cl.left <= 0) {
        for (const p of cl.puffs) { this.d.scene.remove(p.s); p.s.material.dispose(); }
        this.clouds.splice(i, 1);
      }
    }
  }

  /** The mob a smoked mob turns on: the nearest other one still standing, within 24 m. */
  private brawlFoe(e: Enemy): Enemy | null {
    let best: Enemy | null = null;
    let bd = 24;
    for (const o of this.enemies) {
      if (o === e || !o.alive) continue;
      const dd = Math.hypot(o.pos.x - e.pos.x, o.pos.z - e.pos.z);
      if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }

  /** A smoked mob's blow lands on the mob it was turned on, which turns on it in return. */
  private brawlHit(e: Enemy, foe: Enemy): void {
    const dx = foe.pos.x - e.pos.x;
    const dz = foe.pos.z - e.pos.z;
    const l = Math.hypot(dx, dz) || 1;
    const sc = e.def.scale ?? 1;
    const reach = e.def.brain.attackRange + e.def.bodyRadius * sc + foe.def.bodyRadius * (foe.def.scale ?? 1) + 1;
    this.vfx.slash(new Vector3(e.pos.x, e.pos.y, e.pos.z), e.yaw, PALETTE.blood, Math.min(6, e.def.brain.attackRange + 1), 1.0);
    if (l > reach) return;
    const dmg = computeDamage({ atk: e.def.atk, multiplier: 1.4, defense: foe.def.def });
    const died = foe.takeDamage(dmg, { x: dx / l, z: dz / l }, foe.def.boss ? 0.3 : 2.5);
    const at = new Vector3(foe.pos.x, foe.pos.y + foe.def.height * (foe.def.scale ?? 1) * 0.5, foe.pos.z);
    this.vfx.impact(at, PALETTE.blood, 1.8);
    this.showNumber(at, dmg, PALETTE.blood, false);
    this.d.audio.hit(false, false);
    if (!foe.brawling && foe.status.stun <= 0 && foe.alive) { foe.brawlTarget = e; foe.afflict('brawl', 3); }
    if (died) this.onEnemyDeath(foe, at);
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
        // Lobbed on an arc that lands where the hero is heading.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.9, e.pos.z);
        const to = new Vector3(c.pos.x + c.vel.x * 0.3, c.pos.y + 0.5, c.pos.z + c.vel.z * 0.3);
        const g = 16;
        const vel = this.lob(from, to, Math.max(0.8, Math.min(1.8, 0.6 + dist / 20)), g);
        this.spawnProjectile(from, vel, 'enemy', e.def.atk, 1.3, 'stone', 1.5, 0x8a96c8, 0, 0, 0, 0, 2.2, 'bolt', { gravity: g });
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
        // A few at a time (never a farm): they stand on open ground, drop nothing, and leave with their caster.
        const list = (this.summoned.get(e.id) ?? []).filter((m) => m.alive && this.enemies.includes(m));
        this.summoned.set(e.id, list);
        const kind = e.def.kind === 'rift-king' ? 'styro-ghoul' : 'beast';
        if (list.length >= SUMMON_CAP || !PRESENT_MODELS.has(kind)) { this.d.audio.roar(); break; }
        this.vfx.impact(at.clone().add(new Vector3(0, 3, 0)), color, 5);
        for (let i = 0; i < Math.min(2, SUMMON_CAP - list.length); i++) {
          const a = Math.random() * Math.PI * 2;
          const spot = this.freeSpot(e.pos.x + Math.cos(a) * 4, e.pos.z + Math.sin(a) * 4);
          const m = this.spawnEnemy(ENEMY_DEFS[kind], spot.x, spot.z, true);
          m.summoned = true;
          m.brain.state = 'chase';
          list.push(m);
        }
        this.d.audio.cast();
        break;
      }
      case 'blink': {
        const bx = c.pos.x - Math.cos(c.yaw) * 4;
        const bz = c.pos.z - Math.sin(c.yaw) * 4;
        // Only onto open ground near its own level (never into a wall or over a drop).
        const w = this.d.world as Partial<HeightWorld> & WorldQuery;
        if (w.blocked?.(bx, bz) || Math.abs(this.d.world.heightAt(bx, bz, e.pos.y + 2) - (e.pos.y - e.def.hover)) > 3) break;
        this.vfx.impact(at.clone().add(new Vector3(0, 3, 0)), color, 6);
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
        // The blast itself reaches as far as the move does, at about its own height.
        const reach = (e.currentAttack?.range ?? 10) + e.def.bodyRadius * sc + 4;
        if (Math.abs(c.pos.y - e.pos.y) < 6 && inCone({ x: e.pos.x, z: e.pos.z }, e.yaw, { x: c.pos.x, z: c.pos.z }, reach, 0.4)) this.damagePlayer(e.def.atk * 0.9, e.def.element);
        break;
      }
      case 'cupmortar':
      case 'cupvolley': {
        // Cups lobbed like mortar shells: one at you, or three around you.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 1.05, e.pos.z);
        const targets = kind === 'cupvolley' ? [[0, 0], [2.8, 1.5], [-2.4, -2.2]] : [[0, 0]];
        for (const [ox, oz] of targets) {
          const to = new Vector3(c.pos.x + c.vel.x * 0.5 + ox, c.pos.y + 0.3, c.pos.z + c.vel.z * 0.5 + oz);
          const g = 16;
          const vel = this.lob(from, to, Math.max(0.8, Math.min(1.6, 0.6 + dist / 18)), g);
          this.spawnProjectile(from.clone(), vel, 'enemy', e.def.atk, 1, 'astral', 1.1, 0xb36bff, 0, 0, 0, 0, 1, 'cup', { gravity: g });
        }
        this.d.audio.swing(false);
        this.say(e, e.def.voices?.attack, 0.4);
        break;
      }
      case 'web': {
        // Three webs spat down at the hero from the spinnerets (under the chapel), leading a moving target a little.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.25, e.pos.z);
        for (const s of [-0.12, 0, 0.12]) {
          const to = new Vector3(c.pos.x + c.vel.x * 0.6, c.pos.y + 1, c.pos.z + c.vel.z * 0.6);
          const dir = to.sub(from).normalize();
          const x = dir.x * Math.cos(s) - dir.z * Math.sin(s);
          dir.z = dir.x * Math.sin(s) + dir.z * Math.cos(s);
          dir.x = x;
          this.spawnProjectile(from.clone(), dir.multiplyScalar(19), 'enemy', e.def.atk, 0.6, e.def.element, 1.3, PALETTE.moon, 0, 0, 0, 0, 1.6, 'web', { web: 1.8 });
        }
        this.d.audio.cast();
        break;
      }
      case 'webdrop': {
        // A net let down over where the hero stands: a pale ring warns, then the web falls; inside it, you are caught.
        const tx = c.pos.x;
        const tz = c.pos.z;
        const ty = this.d.world.heightAt(tx, tz, c.pos.y + 1);
        const warn = this.vfx.zone(new Vector3(tx, ty, tz), 4, PALETTE.moon, 1.1);
        this.delayed.push({ t: 1.0, fn: () => {
          warn();
          const net = webDisc(4.2, 0.7);
          net.rotation.x = -Math.PI / 2;
          net.position.set(tx, ty + 0.15, tz);
          this.d.scene.add(net);
          this.vfx.burst(new Vector3(tx, ty + 0.5, tz), PALETTE.moon, 20, 5, 0.4);
          this.delayed.push({ t: 4, fn: () => { this.d.scene.remove(net); disposeObject(net); } });
          if (Math.hypot(c.pos.x - tx, c.pos.z - tz) < 4 && c.pos.y < ty + 3) { this.damagePlayer(e.def.atk * 0.7, e.def.element); this.ensnare(2.4); }
        } });
        this.d.audio.cast();
        break;
      }
      case 'hop': {
        // A leap that lands on you: a bubble bumps into you; the Frog God comes down with a wave of colour.
        this.contact.set(e.id, e.def.body ? 0.6 : 0.95);
        if (!e.def.body) {
          this.delayed.push({ t: 0.85, fn: () => {
            if (!e.alive) return;
            const at = new Vector3(e.pos.x, e.pos.y - e.def.hover, e.pos.z);
            for (const [r, col] of [[9, 0xff5ad6], [6.5, 0x37f5ff], [4, 0x5dff3a]] as const) this.vfx.shockwave(at, col, r);
            this.d.onShake?.(0.8);
            this.d.audio.stomp();
            if (Math.hypot(c.pos.x - e.pos.x, c.pos.z - e.pos.z) < 6 && c.pos.y < at.y + 2.5) this.damagePlayer(e.def.atk * 1.2, e.def.element);
          } });
        }
        break;
      }
      case 'kaleido': {
        // Three rings of tripping orbs, each turned a little against the last, rolling outward like a kaleidoscope.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.5, e.pos.z);
        const n = e.summoned ? 8 : 14;
        for (let ring = 0; ring < 3; ring++) {
          this.delayed.push({ t: ring * 0.28, fn: () => {
            if (!e.alive) return;
            const speed = 8.5;
            const vy = (c.pos.y + 1 - from.y) / Math.max(0.5, dist / speed);
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + ring * 0.22;
              this.spawnProjectile(from.clone(), new Vector3(Math.cos(a) * speed, vy, Math.sin(a) * speed), 'enemy', e.def.atk, e.summoned ? 0.3 : 0.45, e.def.element, 0.7, 0xff5ad6, 0, 0, 0, 0, 1.1, 'orb', { wobble: 0.25 });
            }
          } });
        }
        this.d.audio.cast();
        break;
      }
      case 'eyebeam': {
        // A stare that sweeps across you: a stream of orbs from its eyes, swinging from one side to the other.
        const eyes = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.82, e.pos.z);
        const base = Math.atan2(c.pos.z - e.pos.z, c.pos.x - e.pos.x);
        const dir = Math.random() < 0.5 ? 1 : -1;
        for (let i = 0; i < 16; i++) {
          this.delayed.push({ t: i * 0.075, fn: () => {
            if (!e.alive) return;
            const a = base + dir * (-0.75 + (1.5 * i) / 15);
            const speed = 26;
            const vy = (c.pos.y + 1 - eyes.y) / Math.max(0.3, dist / speed);
            this.spawnProjectile(eyes.clone(), new Vector3(Math.cos(a) * speed, vy, Math.sin(a) * speed), 'enemy', e.def.atk, 0.35, e.def.element, 0.6, e.def.beamColor ?? 0x37f5ff, 0, 0, 0, 0, 0.8, 'orb');
          } });
        }
        this.d.audio.roar();
        break;
      }
      case 'glare': {
        // It gathers a red stare at its eye; whoever is facing it when it opens is held there (look away!).
        const eye = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.5, e.pos.z);
        this.vfx.impact(eye, 0xff2a2a, 7);
        this.d.hud.announce('The eye is gathering a glare · look away');
        this.delayed.push({ t: 1.1, fn: () => {
          if (!e.alive) return;
          const toEye = Math.atan2(e.pos.z - c.pos.z, e.pos.x - c.pos.x);
          const facing = Math.abs(Math.atan2(Math.sin(toEye - c.yaw), Math.cos(toEye - c.yaw))) < (50 * Math.PI) / 180;
          this.vfx.shockwave(eye, 0xff2a2a, 18);
          this.d.audio.roar();
          if (facing && Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 40) { this.damagePlayer(e.def.atk * 0.6, e.def.element); this.ensnare(1.8); }
        } });
        break;
      }
      case 'thorns': {
        // A ring of red thorns flung out of its spikes, falling toward where the hero stands.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.5, e.pos.z);
        const n = 16;
        const speed = 12;
        const vy = (c.pos.y + 1 - from.y) / Math.max(0.5, dist / speed);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.spawnProjectile(from.clone(), new Vector3(Math.cos(a) * speed, vy, Math.sin(a) * speed), 'enemy', e.def.atk, 0.5, e.def.element, 0.7, 0xff2a2a, 0, 0, 0, 0, 0.9, 'arrow');
        }
        this.d.audio.cast();
        break;
      }
      case 'rainbow': {
        // Rainbow ribbons that curve in from both sides; one touch and the world swirls.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.7, e.pos.z);
        const base = Math.atan2(c.pos.z - e.pos.z, c.pos.x - e.pos.x);
        for (let i = 0; i < 6; i++) {
          this.delayed.push({ t: i * 0.12, fn: () => {
            if (!e.alive) return;
            const a = base + (i % 2 ? 1 : -1) * (0.6 + (i >> 1) * 0.25);
            const v = new Vector3(Math.cos(a) * 11, 1.5, Math.sin(a) * 11);
            this.spawnProjectile(from.clone(), v, 'enemy', e.def.atk, 0.45, e.def.element, 0.8, 0xff5ad6, 0, 0, 0, 0, 1.0, 'trip', {
              homing: { target: null, point: new Vector3(c.pos.x, c.pos.y + 1, c.pos.z), delay: 0.25, turn: 2.4, age: 0 },
            });
          } });
        }
        this.d.audio.cast();
        break;
      }
      case 'mirror': {
        // Reflections of himself around you: they throw rings of their own and break at a touch (and vanish after a while).
        const list = (this.summoned.get(e.id) ?? []).filter((m) => m.alive && this.enemies.includes(m));
        this.summoned.set(e.id, list);
        for (let i = 0; i < 3 - list.length; i++) {
          const a = Math.random() * Math.PI * 2;
          const m = this.spawnEnemy(MIRROR_DEF, c.pos.x + Math.cos(a) * 11, c.pos.z + Math.sin(a) * 11, true);
          m.summoned = true;
          m.brain.state = 'chase';
          list.push(m);
          this.vfx.burst(new Vector3(m.pos.x, m.pos.y + 3, m.pos.z), 0xff5ad6, 20, 6, 0.5);
          this.delayed.push({ t: 12, fn: () => { if (this.enemies.includes(m)) { this.vfx.burst(new Vector3(m.pos.x, m.pos.y + 3, m.pos.z), 0x37f5ff, 16, 5, 0.4); this.despawn(m); } } });
        }
        this.d.audio.cast();
        break;
      }
      case 'snowstorm': {
        // Digital snow: squares of static fall where the hero stands and around, then burst.
        for (const [ox, oz] of [[0, 0], [4, 2], [-3, 4], [2, -4]]) {
          const tx = c.pos.x + ox, tz = c.pos.z + oz;
          const ty = this.d.world.heightAt(tx, tz, c.pos.y + 1);
          const warn = this.vfx.zone(new Vector3(tx, ty, tz), 2.6, 0x9ad8ff, 0.9);
          this.delayed.push({ t: 0.9, fn: () => {
            warn();
            const p = new Vector3(tx, ty, tz);
            this.vfx.burst(p.clone().add(new Vector3(0, 1.5, 0)), 0xdff4ff, 26, 6, 0.6);
            this.vfx.shockwave(p, 0x9ad8ff, 4);
            if (Math.hypot(c.pos.x - tx, c.pos.z - tz) < 2.6) this.damagePlayer(e.def.atk, e.def.element);
          } });
        }
        this.d.audio.cast();
        break;
      }
      case 'logthrow': {
        // A log pulled off his back, lobbed over the shoulder to land where the hero stands.
        const from = new Vector3(e.pos.x - Math.cos(e.yaw) * 0.4, e.pos.y + e.def.height * sc * 0.95, e.pos.z - Math.sin(e.yaw) * 0.4);
        const to = new Vector3(c.pos.x + c.vel.x * 0.3, c.pos.y + 0.6, c.pos.z + c.vel.z * 0.3);
        const g = 18;
        const vel = this.lob(from, to, Math.max(0.7, Math.min(1.7, 0.55 + dist / 22)), g);
        this.spawnProjectile(from, vel, 'enemy', e.def.atk, 1.3, 'stone', 1.3, 0x8a96c8, 0, 0, 0, 0, 1, 'log', { gravity: g });
        this.d.audio.swing(true);
        break;
      }
      case 'punch': {
        const range = (e.currentAttack?.range ?? 4) + e.def.bodyRadius * sc * 0.5;
        this.vfx.slash(at.clone().add(new Vector3(0, e.def.height * sc * 0.5, 0)), e.yaw, color, range, 0.8);
        this.d.onShake?.(0.6);
        this.d.audio.stomp();
        if (inCone({ x: e.pos.x, z: e.pos.z }, e.yaw, { x: c.pos.x, z: c.pos.z }, range, 0.8)) {
          this.damagePlayer(e.def.atk * 1.1, e.def.element);
          const dx = c.pos.x - e.pos.x;
          const dz = c.pos.z - e.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          c.vel.x += (dx / l) * 9;
          c.vel.z += (dz / l) * 9;
          c.vel.y = Math.max(c.vel.y, 4);
          c.mode = 'air';
        }
        break;
      }
      case 'grab': {
        const range = (e.currentAttack?.range ?? 3.4) + e.def.bodyRadius * sc;
        if (!this.grab && inCone({ x: e.pos.x, z: e.pos.z }, e.yaw, { x: c.pos.x, z: c.pos.z }, range, 0.9)) {
          this.grab = { e, t: 0 };
          this.damagePlayer(e.def.atk * 0.4, e.def.element);
          this.d.hud.announce('Grabbed!');
        }
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
      const aimY = target ? target.pos.y + Math.min(0.5, target.def.height * (target.def.scale ?? 1) * 0.45) + (target.def.flying ? target.def.height * (target.def.scale ?? 1) * 0.3 : 0) : 0;
      const dir = target
        ? new Vector3(target.pos.x - from.x, aimY - from.y, target.pos.z - from.z).normalize()
        : new Vector3(Math.cos(c.yaw), 0.05, Math.sin(c.yaw));
      const arrow = me.weapon === 'bow';
      if (arrow && c.mode === 'fly') {
        // Off the bow she rides: the arrow drops out under her, then finds its way (down, across, or back up).
        const ahead = target ? null : new Vector3(c.pos.x + Math.cos(c.yaw) * 22, 0, c.pos.z + Math.sin(c.yaw) * 22);
        if (ahead) ahead.y = this.d.world.heightAt(ahead.x, ahead.z, c.pos.y);
        const down = new Vector3(Math.cos(c.yaw) * 0.35, -1, Math.sin(c.yaw) * 0.35).normalize().multiplyScalar(18);
        this.spawnProjectile(from, down, 'player', atk, def.mult, element, 1.0, ELEMENT_COLOR[this.elementOf(me)], def.shape.chains, def.shape.chainRange, def.knockback, def.hitStop, 0.24, 'arrow', {
          homing: { target, point: ahead, delay: 0.07, turn: 9, age: 0 },
        });
        return;
      }
      // Nothing to fight in range: a shot fired while facing a sky eye flies at it.
      const sky = target ? null : this.aimTarget(from, c.yaw);
      if (sky) dir.copy(sky.pos).sub(from).normalize();
      const speed = arrow ? 26 : 22;
      this.spawnProjectile(from, dir.multiplyScalar(speed), 'player', atk, def.mult, element, 1.0, ELEMENT_COLOR[this.elementOf(me)], def.shape.chains, def.shape.chainRange, def.knockback, def.hitStop, 0.24, arrow ? 'arrow' : 'bolt');
      if (sky) { const shot = this.projectiles[this.projectiles.length - 1]; shot.life = Math.max(shot.life, sky.pos.distanceTo(from) / speed + 0.4); }
      return;
    }
    const reach = def.shape.kind === 'cone' ? def.shape.range : def.shape.radius;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const sc = e.def.scale ?? 1;
      // A swing from the air reaches only what is about level with it.
      if (c.pos.y + 1 < e.pos.y - reach * 0.6 || c.pos.y + 1 > e.pos.y + e.def.height * sc + reach * 0.6) continue;
      const t = { x: e.pos.x, z: e.pos.z };
      const ok = def.shape.kind === 'cone'
        ? inCone(origin, c.yaw, t, def.shape.range + e.def.bodyRadius * sc, def.shape.halfAngle)
        : inRadius(origin, t, def.shape.radius + e.def.bodyRadius * sc);
      if (ok) this.hitEnemy(e, atk, def.mult, element, def.knockback, def.hitStop);
    }
  }

  /** The aimable target most nearly ahead of the hero (within about 25° of their facing and 110 m), if any. */
  private aimTarget(from: Vector3, yaw: number): ShotTarget | null {
    let best: ShotTarget | null = null;
    let bestDot = Math.cos((25 * Math.PI) / 180);
    for (const t of this.targets) {
      if (!t.aim || !t.active()) continue;
      const dx = t.pos.x - from.x;
      const dz = t.pos.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > 110 || d < 1) continue;
      const dot = (dx * Math.cos(yaw) + dz * Math.sin(yaw)) / d;
      if (dot > bestDot) { bestDot = dot; best = t; }
    }
    return best;
  }

  /** `energy`: whether the hit charges the burst (lingering zones and spins do not, or a burst would refill itself). */
  private hitEnemy(e: Enemy, atk: number, mult: number, element: Element | null, knockback: number, hitStop: number, energy = true): void {
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
    if (energy) this.burstEnergy = Math.min(BURST_MAX, this.burstEnergy + 6);
    if (reaction) { this.applyReaction(e, reaction, dmg, at); this.d.audio.reaction(); }
    if (died) this.onEnemyDeath(e, at);
  }

  private onEnemyDeath(e: Enemy, at: Vector3): void {
    this.vfx.burst(at, PALETTE.moon, 24, 7, 0.5);
    this.vfx.shockwave(new Vector3(e.pos.x, e.pos.y, e.pos.z), ELEMENT_COLOR[e.def.element], e.def.boss ? 14 : 5);
    this.d.hud.removeEnemyBar(e.id);
    this.d.audio.kill(!!e.def.boss);
    this.d.onKill?.(e.def.kind);
    this.voiceClock = 0;
    this.say(e, e.def.voices?.death);
    this.burstEnergy = Math.min(BURST_MAX, this.burstEnergy + 18);
    // Summoned mobs drop nothing (they would be an endless farm).
    if (!e.summoned) this.loot.spawn(rollDrops(e.def.drops, e.def.shards), new Vector3(e.pos.x, this.d.world.heightAt(e.pos.x, e.pos.z, e.pos.y + 1) + 1, e.pos.z));
    if (e.def.boss) { this.d.hud.announce(`${e.def.name} falls`); this.d.onShake?.(1); }
    // Its summons go with it.
    const called = this.summoned.get(e.id);
    if (called) {
      for (const m of called) if (m.alive && this.enemies.includes(m)) { this.vfx.burst(new Vector3(m.pos.x, m.pos.y + 1, m.pos.z), ELEMENT_COLOR[m.def.element], 12, 4, 0.4); this.despawn(m); }
      this.summoned.delete(e.id);
    }
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

  private spawnProjectile(from: Vector3, vel: Vector3, owner: 'player' | 'enemy', atk: number, mult: number, element: Element | null, radius: number, color: number, chains: number, chainRange: number, knockback: number, hitStop: number, size = 0.24, kind: ProjectileKind = 'bolt', extra: { gravity?: number; poison?: { dps: number; seconds: number }; homing?: Projectile['homing']; wobble?: number; onHit?: (e: Enemy) => void; web?: number } = {}): void {
    const object = new Group();
    const rainbow: Projectile['rainbow'] = [];
    if (kind === 'log') {
      // A log off the giant's back: rough bark, pale cut ends, tumbling end over end.
      const bark = new Mesh(new CylinderGeometry(0.28 * size, 0.32 * size, 2.4 * size, 9), surface({ color: PALETTE.bark, roughness: 1 }));
      bark.rotation.z = Math.PI / 2;
      for (const sx of [-1, 1]) {
        const end = new Mesh(new CylinderGeometry(0.27 * size, 0.27 * size, 0.04, 9), surface({ color: 0x8a7a66 }));
        end.rotation.z = Math.PI / 2;
        end.position.x = sx * 1.21 * size;
        object.add(end);
      }
      object.add(bark);
      object.position.copy(from);
    } else if (kind === 'ring') {
      // A glowing ring flying face-on (the snail's tentacle shots).
      const ring = new Mesh(new TorusGeometry(0.45 * size, 0.07 * size, 8, 28), new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: AdditiveBlending, side: DoubleSide, depthWrite: false, toneMapped: false }));
      object.add(ring, glowSprite(color, 1.6 * size, 0.5, true));
      object.position.copy(from);
    } else if (kind === 'cup') {
      // A double cup of lean (lean-cup.glb), brimming purple, end over end, trailing its glow.
      if (thrownCup) {
        const rig = new ModelRig('lean-cup', thrownCup);
        rig.root.scale.setScalar(2.6 * size);
        rig.root.position.y = -0.2 * size;
        object.add(rig.root);
      }
      const lean = new Mesh(new CircleGeometry(0.19 * size, 12), new MeshBasicMaterial({ color: 0x9b3dff, toneMapped: false }));
      lean.rotation.x = -Math.PI / 2;
      lean.position.y = 0.17 * size;
      object.add(lean, glowSprite(0xb36bff, 1.1 * size, 0.6, true));
      object.position.copy(from);
    } else if (kind === 'orb') {
      // A tripping orb: a bright core and a halo, both running through every colour.
      const core = glowSprite(color, 0.7 * size, 0.95, true);
      const halo = glowSprite(color, 1.6 * size, 0.45, true);
      object.add(core, halo);
      rainbow.push(core.material, halo.material);
      object.position.copy(from);
    } else if (kind === 'web') {
      // A spun web flying face-on: spokes and rings of pale silk, turning as it comes.
      object.add(webDisc(1.1 * size, 0.85));
      object.add(glowSprite(PALETTE.moon, 1.4 * size, 0.25, true));
      object.position.copy(from);
    } else if (kind === 'trip') {
      // A tripping arrow: a glowing shaft and head that run through every colour, with a rainbow trail.
      const shaftMat = new MeshBasicMaterial({ color, toneMapped: false });
      const headMat = new MeshBasicMaterial({ color, toneMapped: false });
      const shaft = new Mesh(new CylinderGeometry(0.035, 0.035, 1.15, 6), shaftMat);
      shaft.rotation.x = Math.PI / 2;
      const head = new Mesh(new ConeGeometry(0.1, 0.3, 6), headMat);
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.72;
      object.add(shaft, head);
      rainbow.push(shaftMat, headMat);
      for (let k = 0; k < 6; k++) {
        const t = glowSprite(color, 0.75 - k * 0.09, 0.8 - k * 0.1, true);
        t.position.z = 0.7 - k * 0.42;
        object.add(t);
        rainbow.push(t.material as SpriteMaterial);
      }
      object.position.copy(from);
      object.lookAt(aim.copy(from).add(vel));
    } else if (kind === 'fire') {
      // A gout of fire: a few overlapping glows that swell as they fly.
      for (let i = 0; i < 4; i++) { const g = glowSprite(i % 2 ? color : PALETTE.moon, (0.9 - i * 0.12) * size, 0.85 - i * 0.12, true); g.position.set((Math.random() - 0.5) * 0.3 * size, (Math.random() - 0.5) * 0.3 * size, -i * 0.25 * size); object.add(g); }
      object.position.copy(from);
    } else if (kind === 'arrow') {
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
    this.projectiles.push({
      pos: from.clone(), vel, life: kind === 'log' || kind === 'trip' || extra.homing ? 4 : 2.5, owner, atk, mult, element, radius, object, chains, chainRange,
      hit: new Set(), knockback, hitStop, kind, gravity: extra.gravity ?? 0, poison: extra.poison ?? null, color,
      homing: extra.homing ?? null, wobble: extra.wobble ?? 0, onHit: extra.onHit ?? null, rainbow, seed: Math.random() * 10, web: extra.web ?? 0,
    });
  }

  /** A shot at the hero from something in the world (witches' orbs, the snail's rings, dragon fire). */
  hostileShot(from: Vector3, s: HostileShot): void {
    const c = this.d.controller;
    const dir = new Vector3(c.pos.x, c.pos.y + 1, c.pos.z).sub(from).normalize();
    if (s.spread) {
      const cs = Math.cos(s.spread);
      const sn = Math.sin(s.spread);
      const x = dir.x * cs - dir.z * sn;
      dir.z = dir.x * sn + dir.z * cs;
      dir.x = x;
    }
    this.spawnProjectile(from.clone(), dir.multiplyScalar(s.speed), 'enemy', s.atk, 1, 'rot', s.radius ?? 0.6, s.color, 0, 0, 0, 0, s.size ?? 1, s.kind ?? 'bolt', { poison: s.poison });
  }

  /** Damage from the world itself (the toxic stream): a hit and, if given, poison. */
  hazard(atk: number, poison?: { dps: number; seconds: number }): void {
    this.damagePlayer(atk, 'rot');
    if (poison) this.poisonPlayer(poison.dps, poison.seconds);
  }

  /** A boss that is not in the spawn list (Yung Lean off his throne): placed, angry, never respawning. */
  spawnBoss(kind: EnemyKind, x: number, z: number, yaw = 0): Enemy {
    const e = this.spawnEnemy(ENEMY_DEFS[kind], x, z, true, { yaw });
    e.brain.state = 'chase';
    return e;
  }

  /** Takes an enemy out of the world for good (its own material copies freed; the shared geometry stays cached). */
  despawn(e: Enemy): void {
    this.d.scene.remove(e.object);
    disposeObject(e.object, true);
    this.d.hud.removeEnemyBar(e.id);
    const i = this.enemies.indexOf(e);
    if (i >= 0) this.enemies.splice(i, 1);
    this.lastState.delete(e.id);
    this.contact.delete(e.id);
    if (this.grab?.e === e) this.grab = null;
    for (const o of this.enemies) if (o.brawlTarget === e) o.brawlTarget = null;
  }

  /** Wading in mud: slowed for a moment (refreshed while you are in it). */
  mire(seconds: number): void {
    this.mireLeft = Math.max(this.mireLeft, seconds);
  }

  /** Seconds left of wading through mud. */
  get mired(): number {
    return this.mireLeft;
  }

  /** Caught in a web: held for `seconds` (a fresh web resets the time, it never stacks). */
  private ensnare(seconds: number): void {
    this.webLeft = Math.max(this.webLeft, seconds);
    this.d.hud.announce('Webbed!');
  }

  /** The web wrapped around a caught hero, shown while it holds. */
  private updateWebbed(): void {
    const on = this.webLeft > 0;
    if (on && !this.webMesh) {
      this.webMesh = new Group();
      for (let i = 0; i < 3; i++) { const w = webDisc(0.9, 0.6); w.rotation.y = (i * Math.PI) / 3; w.position.y = 1; this.webMesh.add(w); }
      this.d.scene.add(this.webMesh);
    }
    if (this.webMesh) {
      this.webMesh.visible = on;
      const c = this.d.controller.pos;
      if (on) this.webMesh.position.set(c.x, c.y, c.z);
    }
  }

  /** Seconds left in a web (the hero cannot move). */
  get webbed(): number {
    return this.webLeft;
  }

  /** Seconds left of Sizzlin' Slowness (−40% speed, the screen tilts). */
  get slowed(): number {
    return this.slowLeft;
  }

  /** The hero's afflictions, for the HUD. */
  get debuffs(): Array<{ name: string; left: number }> {
    const out: Array<{ name: string; left: number }> = [];
    if (this.poisonLeft > 0) out.push({ name: 'Poisoned', left: this.poisonLeft });
    if (this.slowLeft > 0) out.push({ name: "Sizzlin' Slowness", left: this.slowLeft });
    if (this.webLeft > 0) out.push({ name: 'Webbed', left: this.webLeft });
    return out;
  }

  /** One of an enemy's lines (data/voices ids), heard over distance; one at a time across the pack. */
  private say(e: Enemy, lines: string[] | undefined, chance = 1): void {
    if (!lines?.length || this.voiceClock > 0 || Math.random() > chance) return;
    const c = this.d.controller;
    const d = Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z);
    if (d > 30) return;
    this.voiceClock = 2.2;
    void this.d.audio.voice(voiceUrl(lines[Math.floor(Math.random() * lines.length)]), Math.max(0.25, 1 - d / 30));
  }

  /** A burst cup leaves a puddle of lean that slows whoever stands in it. */
  private spawnPuddle(at: Vector3): void {
    const y = this.d.world.heightAt(at.x, at.z, at.y + 1) + 0.04;
    const mesh = new Mesh(new CircleGeometry(2.4, 24), new MeshBasicMaterial({ color: 0x8a2be2, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(at.x, y, at.z);
    mesh.add(glowSprite(0xb36bff, 3.2, 0.35, true));
    this.d.scene.add(mesh);
    this.puddles.push({ pos: new Vector3(at.x, y, at.z), r: 2.4, left: 6, mesh });
    this.vfx.burst(new Vector3(at.x, y + 0.3, at.z), 0xb36bff, 14, 4, 0.5);
  }

  /** Poison: damage every half second for a while (refreshed, never stacked). */
  poisonPlayer(dps: number, seconds: number): void {
    this.poisonDps = Math.max(this.poisonDps * (this.poisonLeft > 0 ? 1 : 0), dps);
    this.poisonLeft = Math.max(this.poisonLeft, seconds);
  }

  /** Seconds of poison left (the HUD shows it as a buff). */
  get poisoned(): number {
    return this.poisonLeft;
  }

  /** True while a giant holds the hero (no moving until thrown). */
  get held(): boolean {
    return this.grab !== null;
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
    // A ghoul who saw it gloats.
    const c = this.d.controller;
    const gloat = this.enemies.find((e) => e.alive && e.aggro && e.def.voices && Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 25);
    if (gloat) { this.voiceClock = 0; this.say(gloat, gloat.def.voices!.win); }
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
      c.flung = 0;
      // A clean slate: every mob walks home and heals, nothing still in flight or pending lands on the fresh party.
      this.resetAggro();
      this.delayed.length = 0;
      this.grab = null;
      this.poisonLeft = 0;
      this.slowLeft = 0;
      this.webLeft = 0;
      this.casting = null;
      this.heavy = null;
      this.heavyCharge = 0;
      this.burstCast = null;
      this.iframes = 2;
      this.d.onWipe?.();
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

/** A spider's web: spokes and rings of pale silk in the xy plane, `r` metres across the middle. */
function webDisc(r: number, opacity: number): Group {
  const g = new Group();
  const pts: number[] = [];
  const spokes = 10;
  for (let i = 0; i < spokes; i++) {
    const a = (i / spokes) * Math.PI * 2;
    pts.push(0, 0, 0, Math.cos(a) * r, Math.sin(a) * r, 0);
  }
  for (const k of [0.3, 0.55, 0.8, 1]) {
    for (let i = 0; i < spokes; i++) {
      const a0 = (i / spokes) * Math.PI * 2;
      const a1 = ((i + 1) / spokes) * Math.PI * 2;
      // Sagging between the spokes, as silk does.
      const sag = 0.9;
      pts.push(Math.cos(a0) * r * k, Math.sin(a0) * r * k, 0, Math.cos((a0 + a1) / 2) * r * k * sag, Math.sin((a0 + a1) / 2) * r * k * sag, 0);
      pts.push(Math.cos((a0 + a1) / 2) * r * k * sag, Math.sin((a0 + a1) / 2) * r * k * sag, 0, Math.cos(a1) * r * k, Math.sin(a1) * r * k, 0);
    }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pts, 3));
  g.add(new LineSegments(geo, new LineBasicMaterial({ color: PALETTE.moon, transparent: true, opacity, depthWrite: false, toneMapped: false })));
  return g;
}

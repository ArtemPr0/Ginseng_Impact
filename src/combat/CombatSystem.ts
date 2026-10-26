import { BoxGeometry, BufferGeometry, CircleGeometry, Color, Float32BufferAttribute, Group, LineBasicMaterial, LineSegments, Mesh, PerspectiveCamera, Scene, Vector3, ConeGeometry, CylinderGeometry, TorusGeometry, MeshBasicMaterial, AdditiveBlending, DoubleSide, Sprite, SpriteMaterial } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import type { Audio } from '../audio/Audio';
import { CombatSfx, hitMaterial } from '../audio/CombatSfx';
import type { CharacterDef } from '../characters/roster';
import type { Game } from '../core/Game';
import { ENEMY_DEFS, ENEMY_SPAWNS, type BossAttackKind, type EnemyDef, type EnemyKind } from '../data/enemies';
import type { ClipName } from '../data/models';
import { voiceUrl } from '../data/voices';
import type { Events, HeroId } from '../game/Events';
import type { Inventory } from '../items/Inventory';
import { ITEMS } from '../items/Items';
import type { ControllerState, WorldQuery } from '../player/CharacterController';
import type { Party } from '../player/Party';
import { PALETTE } from '../render/palette';
import type { CombatFx } from '../render/CombatFx';
import { crescentShot, starShot } from '../render/ShotFx';
import { GRAVEYARD } from '../data/world';
import { surface } from '../render/Materials';
import type { Sky } from '../render/Sky';
import type { Hud } from '../ui/Hud';
import { glowSprite } from '../render/Glow';
import { CastCharge, ComboTracker, Cooldown, CRIT_CHANCE, computeDamage, cutWindow, HIT_ENERGY, HitStreak, inCone, inRadius, LockOn, patchHeight, pierceStop, RIDE_UP, rideBase, rollHit } from './Combat';
import { ELEMENT_COLOR, REACTIONS, applyElement, type Element, type ReactionId } from './Elements';
import { dissolveEdge, Enemy, separate, type EnemyHome, type Mark } from './Enemy';
import { AttackTokens } from './EnemyBrain';
import {
  BODY_REACH, BREATH_HALF, coneReach, CONTACT_REACH, GLARE_RADIUS, GRAB_HALF, HANDOFF, landing, landingWarn, MELEE_HALF, meleeReach, PUNCH_HALF, ROAR_REACH,
  ROOTS_RADIUS, SHOT_RADIUS, slamRadius, SNOW_PATCHES, SNOW_RADIUS, SWEEP_HALF, WARN_COLOR, warnCount, WEBDROP_RADIUS, warnSpec,
  type WarnShape, type WarnSpec,
} from './Warnings';
import { chainTo, steer, type Homing, type NearestQuarry } from './Homing';
import { LootField, rollDrops } from './Loot';
import { BURST, COMBO, CYCLONE, SKILLS, type AttackDef, type BurstKind, type CrescentShape, type GroundEffectDef, type HitShape, type StarfallShape, type VolleyShape } from './Skills';
import { comboTiming, cutSpan, heavyTiming, heroClipsOf, moveCut, skillTiming } from '../characters/heroClips';
import { atkMult, hpMult } from '../game/Progress';
import { WORLD } from '../world/Terrain';
import { disposeObject } from '../render/dispose';
import { puffTexture } from '../render/Smoke';
import { loadModel, ModelRig } from '../models/ModelRig';
import { Vfx } from './Vfx';
import { PRESENT_MODELS } from '../data/colliderGrids';
import type { HeightWorld } from '../world/Colliders';

interface Projectile {
  pos: Vector3; vel: Vector3; life: number; owner: 'player' | 'enemy';
  /** The enemy kind that shot it (named in the hurt it does); null for a shot from the world (witches, the snail). */
  by: string | null;
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
   * Steers itself (arrows off Wren's ridden bow, Moon Volley, her trip volley; Homing.ts): after `delay` it turns toward
   * the target mob (or the point, once the mob is gone), tighter and tighter, keeping its speed; a chain hands it on.
   */
  homing: Homing<Enemy> | null;
  /** Drawn swaying off its true path (metres), like it is tripping. */
  wobble: number;
  /** What else a hit does (the trip volley's daze and confusion). */
  onHit: ((e: Enemy) => void) | null;
  /** A hit on the hero pins them in a web for this many seconds. */
  web: number;
  /** Materials whose colour cycles through every hue (the trip volley). */
  rainbow: Array<{ color: { setHSL(h: number, s: number, l: number): unknown } }>;
  seed: number;
  /** Seconds since it was loosed. */
  age: number;
  /** Where it set off (how far it has gone). */
  from: Vector3;
  /**
   * The CombatFx ribbon drawn behind it ('arrow0'/'arrow1' for Wren's arrows, 'trip0'-'trip2' for three of her trip
   * volley's, 'bolt' for Orlan's, 'star0'/'star1' for Starfall's falling stars; a newer shot takes an id over; no more
   * than SHOT_RIBBONS shots draw one at once), and the ribbon's half-width.
   */
  trail: string | null;
  trailW: number;
  /** Cuts through every mob it touches, once each, and flies on (the crescent). */
  pierce: boolean;
  /** Bursts over this many metres where it lands or meets a body (Starfall's stars); 0 = an ordinary hit. */
  aoe: number;
  /** Rides the ground this many metres above it (the crescent); 0 = flies free. */
  ground: number;
  /** The burning ground it leaves along its path (the crescent). */
  burn: BurnPath | null;
  /** The crescent's fade (in at the launch, out at the end of its run). */
  fade: { value: number } | null;
  /** Orlan's star, turned as it flies so its points twinkle. */
  twinkle: SpriteMaterial | null;
  /** The burst charge its cast shares (Moon Volley's arrows, Starfall's stars: Combat.CastCharge); null: each hit charges. */
  cast: CastCharge | null;
  /** A throw's landing warning on the ground where it comes down (throwAt), filling over `flight` seconds in the air. */
  warn: Warning | null;
  flight: number;
}

type ProjectileKind = 'bolt' | 'arrow' | 'log' | 'ring' | 'fire' | 'cup' | 'trip' | 'web' | 'orb' | 'gem' | 'crescent' | 'star';

/** A shot from something that is not an enemy (witches, the snail, the dragon), aimed at the hero. */
export interface HostileShot { speed: number; color: number; atk: number; kind?: ProjectileKind; size?: number; radius?: number; poison?: { dps: number; seconds: number }; spread?: number }

interface GroundZone { pos: Vector3; def: GroundEffectDef; left: number; tick: number; atk: number; remove: () => void; group: ZoneGroup | null }

/**
 * A companion the enemies fight as well as the hero (world/Companion; main passes its list): where it stands, its HP,
 * and an enemy's blow on it (false when the blow found it covered or already down).
 */
export interface CombatAlly { readonly pos: { x: number; y: number; z: number }; readonly hp: number; hurt(amount: number): boolean }

/**
 * A ground warning the fight drives a step at a time (CombatFx.driveTelegraph): its slot id, which of its move's
 * warnings it is (the cup volley's three), its shape, and where it stands and faces.
 */
interface Warning { id: number; k: number; spec: WarnSpec; at: Vector3; yaw: number }

/** Whom an enemy aims at: their feet, and their running (the hero's; a companion's is not led). */
interface Aim { x: number; y: number; z: number; vx: number; vz: number }

/** A job due later (a delayed strike, a cleanup), and the warning of where it lands, filling as it comes. */
interface Delayed { t: number; fn: () => void; cleanup?: boolean; warn?: { w: Warning; total: number; from: number; follow?: (at: Vector3) => void } }

/**
 * Patches of ground laid by one cast: a mob standing in several is ticked by one of them, not by each; all of them are
 * drawn as one strip (`lay` adds a patch to it: Vfx.path).
 */
interface ZoneGroup { last: Map<number, number>; lay: ((at: Vector3) => void) | null }

/** The burning ground a crescent lays: a patch every `every` metres of its run, all of one ZoneGroup. */
interface BurnPath { def: GroundEffectDef; atk: number; every: number; next: number; group: ZoneGroup }

/** What else a blow is (see hitEnemy). */
interface HitOpts {
  /** Charges the burst (default); lingering zones, the smoke and the spin do not, or a burst would refill itself. */
  energy?: boolean;
  /** A heavy blow (the heavy, a finisher, the skill): a ground shock, a bigger kick, the fov punch, the boom. Default: hit-stop ≥ 0.08. */
  heavy?: boolean;
  /** A tick of something that lingers (a burning patch, the smoke): never a crit, no kick, no combo, a small spark. */
  dot?: boolean;
  /** A companion's blow: never a crit, no kick, no combo. */
  companion?: boolean;
  /** Where it struck (a shot's head); by default the body's side facing the hero, at about the swing's height. */
  at?: Vector3;
  /**
   * The body's place in a piercing shot's line, 1 being the first it cuts (0: not a piercing shot): past the first, the
   * blow's hit-stop and its reaction's are cut to Combat.pierceStop's.
   */
  pierced?: number;
  /** The cast it is a shot of (Moon Volley, Starfall): the burst is charged through it, per body rather than per hit (Combat.CastCharge). */
  cast?: CastCharge | null;
}

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
  /** The game's event bus: kills, hurts, falls, wipes and dodges are announced on it. */
  events?: Events;
  /** The pooled combat effects (render/CombatFx.ts): main owns them, adds their group and updates them every frame. */
  fx: CombatFx;
  /** The active hero's weapon ends this frame (Rig.weaponTips): the blade's ribbon, sparks off the blade. */
  weaponTips?: (guard: Vector3, tip: Vector3) => boolean;
  /** A camera impulse of `amount` metres along `dir` (ThirdPersonCamera.kick). */
  onKick?: (dir: Vector3, amount: number) => void;
  /** The fov eased out by `delta` degrees and back over `seconds` (ThirdPersonCamera.punchFov). */
  onPunch?: (delta: number, seconds: number) => void;
  /** The grade's hit pulse, 0..1 (Renderer.pulse). */
  onPulse?: (strength: number) => void;
  /** Random numbers for the crit rolls (Math.random unless a test injects its own). */
  rnd?: () => number;
  /** The companions following the hero: the enemies fight them too (main passes its list). */
  allies?: () => ReadonlyArray<CombatAlly>;
}

/** Orlan's smoke: a cloud that lingers where he blew it, the puffs that make it, and his attack when he blew it. */
interface SmokeCloud { pos: Vector3; r: number; left: number; life: number; tick: number; atk: number; puffs: Array<{ s: Sprite; to: Vector3; from: Vector3; spin: number; size: number; delay: number }> }

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
/** A diamond Old Hollowstaff throws (gem.glb). */
let thrownGem: GLTF | null = null;
void loadModel('gem').then((g) => { thrownGem = g; });

const PLAYER_DEF = 30;
const aim = new Vector3();
const side = new Vector3();
const IFRAMES = 0.6;
const BURST_MAX = 100;
/** A reaction's freeze of the fight (on a piercing shot's bodies past its first, Combat.pierceStop's cut of it). */
const REACTION_STOP = 0.1;
/** Seconds a fallen hero lies there (dying_backwards is down by then) before the party switches or wipes. */
const DOWN_HOLD = 1.2;
/** A hit of this share of max HP or more throws the whole body (the full Hit_Reaction); less is a flinch. */
const BIG_HIT = 0.15;
/**
 * Where each blade clip actually cuts, in seconds of the source clip (heroClips.ts has the measurements): the slash
 * from the end of its wind-up (0.39) through the blow (0.52) to the follow-through; Sword_Judgment from the top of the
 * raise down through the blow (0.98); Sword_Shout's cut (2.1-2.6). The blade's ribbon and its whoosh live in these.
 */
const BLADE_CUTS: Record<string, Partial<Record<ClipName, readonly [number, number]>>> = {
  knight: { attack: [0.39, 0.78], heavy: [0.72, 1.2], cast: [2.1, 2.6] },
};

/** A part (0..1) of a move's cut: the span in which the blade cuts. */
type Window = readonly [number, number];

/**
 * A hero's move timings and blade windows: constant data from heroClips.ts and BLADE_CUTS, built once per hero
 * (CombatSystem.timesOf), so the paths that run every step and every frame (the blade's ribbon, the rig's progress)
 * read numbers instead of building fresh objects.
 */
interface MoveTimes {
  heavy: { readonly duration: number; readonly strike: number; readonly startAt: number };
  skill: { readonly duration: number; readonly strike: number };
  /** Where the blade cuts in each move's cut: the three light hits, the heavy, the skill (null: no cut to read). */
  blade: { readonly attack: ReadonlyArray<Window | null>; readonly heavy: Window | null; readonly skill: Window | null };
}

function moveTimes(hero: string): MoveTimes {
  const clips = heroClipsOf(hero);
  const blade = (kind: number | 'heavy' | 'skill'): Window | null => {
    const cut = clips ? moveCut(clips, kind) : null;
    if (!cut) return null;
    const from = cut.from ?? 0;
    return cutWindow(from, from + cutSpan(hero, cut), cut.strike ?? 0.4, BLADE_CUTS[hero]?.[cut.key]);
  };
  return {
    heavy: heavyTiming(hero),
    skill: skillTiming(hero),
    blade: { attack: [blade(0), blade(1), blade(2)], heavy: blade('heavy'), skill: blade('skill') },
  };
}

/** The lean's purple: the cyclone's ribbon, its puddles, the drops flung off the blade. */
const LEAN_PURPLE = 0xb36bff;
/**
 * The trip volley's three brightest arrows, by their place in it (both flanks of the fan and its middle, early, midway
 * and late), each with a ribbon of its own for its whole flight: three of CombatFx's four ribbon slots (her arrows'
 * two let go as the volley starts, see tripArrow, and her arrows draw none while any of these three flies, see
 * nextArrowTrail).
 */
const TRIP_RIBBONS = new Map<number, string>([[1, 'trip0'], [5, 'trip1'], [8, 'trip2']]);
/**
 * Ribbons shots may draw at once: CombatFx's four less the blade's. A fifth live id would take a slot from a live ribbon
 * every step, all of them fed on one CombatFx clock tick (spawnProjectile holds the line).
 */
const SHOT_RIBBONS = 3;
/** The lean cyclone's trail keeps this many puddles wet at once; laying another starts the oldest drying up. */
const CYCLONE_PUDDLES = 4;
/** A puddle's last seconds, shrinking away. */
const PUDDLE_DRY = 1.2;
/** How high the crescent rides over the ground (its horns skim it). */
const CRESCENT_BASE = 0.2;
/** The smoke's damage each 0.4 s tick, a share of Orlan's attack. */
const SMOKE_TICK = 0.2;
const UP = new Vector3(0, 1, 0);
const NOOP = (): void => {};
const _v = new Vector3();
const _w = new Vector3();
const _g = new Vector3();
const _t = new Vector3();
const _side = new Vector3();
const _col = new Color();
const MOON = new Color(PALETTE.moon);

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
  /**
   * Purple puddles of spilled lean, and how long the slow lasts: a cup's puddle slows the hero standing in it
   * (Sizzlin' Slowness); one the lean cyclone splashed slows the mobs that wade in instead.
   */
  private readonly puddles: Array<{ pos: Vector3; r: number; left: number; mesh: Mesh; hero: boolean }> = [];
  private slowLeft = 0;
  /** Caught in a spider's web: held where you stand (seconds left), and the web drawn around you. */
  private webLeft = 0;
  private webMesh: Group | null = null;
  private mireLeft = 0;
  /** Voice lines: who last spoke and when (so a pack does not talk over itself), and each enemy's last state. */
  private voiceClock = 0;
  private readonly lastState = new Map<number, string>();
  private burstCast: { t: number; fired: boolean; kind: BurstKind; shots: number; tick: number; puddle: number } | null = null;
  burstEnergy = 0;
  private iframes = 0;
  private dodgeCd = 0;
  /** What the hero's body is told: the last hit (how long ago, whether it was big), the dodge in progress, the fall. */
  private hurt: { t: number; big: boolean } | null = null;
  private dodge: { t: number } | null = null;
  /** Down: the death clip plays for DOWN_HOLD seconds before the next hero takes over (or the fog takes the party). */
  private downed: { t: number } | null = null;
  private readonly clouds: SmokeCloud[] = [];
  /** Mobs each caster has summoned (capped, and sent away with their caster). */
  private readonly summoned = new Map<number, Enemy[]>();
  private frenzyLeft = 0;
  /** Callbacks due later (`cleanup` ones tidy the scene and still run when a wipe drops the rest). */
  private readonly delayed: Delayed[] = [];
  private readonly contact = new Map<number, number>();
  private readonly tmp = new Vector3();
  private readonly screen = new Vector3();
  private readonly fx: CombatFx;
  private readonly sfx: CombatSfx;
  private readonly rnd: () => number;
  /** The combo counter (hits in a row, 1.2 s apart at most). */
  private readonly streak = new HitStreak(1.2);
  /** Tab's lock-on (Combat.ts LockOn): the camera keeps its target framed, swings turn to it, shots and spells go for it. */
  private readonly lock = new LockOn<Enemy>();
  /** Whether the boss layer of the score is on (a boss has the hero in its sights). */
  private bossMusic = false;
  /** Seconds of fighting (the ground patches' shared ticks count on it). */
  private clock = 0;
  /** This step's strongest camera kick, whether the fov punches, the grade's pulse, a crit's sting, a heavy's boom: applied once, at the end of the step. */
  private readonly feel = { kick: 0, dir: new Vector3(), punch: false, pulse: 0, crit: false, boom: false };
  /** Enemies that already flashed this step (a volley landing at once glows, it does not blow out white). */
  private readonly flashed = new Set<number>();
  /** The blade was cutting last step (its whoosh plays on the way in), and its ribbon was fed last frame. */
  private bladeWas = false;
  private bladeFed = false;
  /** The cast circle is up; seconds to the next mote off the charging weapon. */
  private runeOn = false;
  private chargeSpark = 0;
  /** Which shot draws each ribbon id, and the round-robin counters for Wren's arrows and Starfall's stars. */
  private readonly trailOwners = new Map<string, Projectile>();
  private arrowTrails = 0;
  private starTrails = 0;
  /** Where a steering shot looks for another body (Homing.steer), bound once rather than a closure a step. */
  private readonly nearest: NearestQuarry<Enemy> = (x, z, range, exclude) => this.nearestEnemy(x, z, range, exclude);
  /** Each hero's move timings and blade windows (moveTimes), built once. */
  private readonly times = new Map<string, MoveTimes>();
  /** The melee mobs' attack tokens: two strike at once, the rest of a pack waits its turn (EnemyBrain.AttackTokens). */
  private readonly tokens = new AttackTokens<Enemy>(2);
  /** Whom the enemies fight this step: the hero's place, then each companion still standing (Enemy.update's marks). */
  private readonly marks: Mark[] = [];
  private readonly allies: CombatAlly[] = [];
  /** A brawling mob's one mark: its foe's place. */
  private readonly brawlMark: Mark[] = [];
  /** The aggro bodies on foot a pack parts each step (Enemy.separate). */
  private readonly pack: Enemy[] = [];
  /** Each winding-up enemy's warnings, by enemy id (an empty list: a wind-up with nothing to show on the ground). */
  private readonly windups = new Map<number, Warning[]>();
  /** The rolling counter for warnings that outlive a wind-up (a throw's landing, a delayed strike). */
  private warnSeq = 0;
  private readonly aimTmp: Aim = { x: 0, y: 0, z: 0, vx: 0, vz: 0 };

  constructor(private readonly d: CombatDeps) {
    this.fx = d.fx;
    this.sfx = new CombatSfx(d.audio);
    this.rnd = d.rnd ?? Math.random;
    d.scene.add(this.vfx.group);
    this.loot = new LootField(d.scene, (x, z, y) => d.world.heightAt(x, z, y));
    for (const s of ENEMY_SPAWNS) {
      // An enemy without its model would be an invisible attacker: it waits until the file exists.
      if (!PRESENT_MODELS.has(s.kind) && !ENEMY_DEFS[s.kind].body) continue;
      const at = s.exact ? { x: s.x, z: s.z } : this.freeSpot(s.x, s.z);
      this.spawnEnemy(ENEMY_DEFS[s.kind], at.x, at.z, false, { yaw: s.yaw, patrol: s.patrol, sitY: s.sitY });
    }
    for (const c of d.party.members) {
      // Each hit lasts as long as its clip cut and lands on the cut's measured blow (heroClips.ts).
      const timing = comboTiming(c.id);
      this.combos.set(c.id, new ComboTracker(timing.durations, timing.strikes));
      this.cooldowns.set(c.id, new Cooldown(SKILLS[c.id].cooldown));
      this.hp.set(c.id, c.maxHp);
      this.times.set(c.id, moveTimes(c.id));
    }
  }

  /** A hero's move timings and blade windows (built on first use for anyone not in the party at the start). */
  private timesOf(id: string): MoveTimes {
    let t = this.times.get(id);
    if (!t) { t = moveTimes(id); this.times.set(id, t); }
    return t;
  }

  /** The nearest spot to (x, z) on open ground: never inside a building's outline or over the void. */
  private freeSpot(x: number, z: number): { x: number; z: number } {
    const w = this.d.world as Partial<HeightWorld> & WorldQuery;
    const ok = (px: number, pz: number) => !(w.blocked?.(px, pz)) && (w.groundAt ? w.groundAt(px, pz) : w.heightAt(px, pz)) > WORLD.abyssY + 2;
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
    // Nobody winds up any more: the pack's turns and the wind-ups' warnings go with it.
    this.tokens.clear();
    for (const list of this.windups.values()) for (const w of list) this.fx.endTelegraph(w.id);
    this.windups.clear();
    for (const p of this.projectiles.filter((q) => q.owner === 'enemy')) this.removeProjectile(p);
    this.contact.clear();
    this.lockTarget = null;
    // Whatever the bosses called up goes back where it came from.
    for (const list of this.summoned.values()) for (const m of list) if (this.enemies.includes(m)) this.despawn(m);
    this.summoned.clear();
  }

  /** By reference, not index: a hit can wipe the party, and the wipe clears projectiles under the loop's feet. */
  private removeProjectile(p: Projectile): void {
    const i = this.projectiles.indexOf(p);
    if (i < 0) return;
    this.releaseTrail(p);
    // A throw's landing warning fills to its edge as the shot comes down, and goes.
    if (p.warn) { this.fx.driveTelegraph(p.warn.id, 1, p.warn.at); p.warn = null; }
    this.d.scene.remove(p.object);
    // (The crescent's shape is shared, like the props' geometry.)
    disposeObject(p.object, p.kind === 'cup' || p.kind === 'gem' || p.kind === 'crescent');
    this.projectiles.splice(i, 1);
  }

  /** The shot lets go of its ribbon (which fades out). */
  private releaseTrail(p: Projectile): void {
    if (!p.trail) return;
    this.fx.trail(p.trail, p.pos, p.pos, 0, false);
    if (this.trailOwners.get(p.trail) === p) this.trailOwners.delete(p.trail);
    p.trail = null;
  }

  /**
   * The next of Wren's two arrow ribbons, round-robin (the newest two arrows in the air draw one); none while any of her
   * trip volley's three still flies (they live 4 s and she shoots again once the volley's 1.6 s are up: their three and
   * her two would be five ids for CombatFx's four slots).
   */
  private nextArrowTrail(): string | undefined {
    return this.tripRibbonsFlying() ? undefined : `arrow${this.arrowTrails++ % 2}`;
  }

  /** True while a shot still in the air draws one of the trip volley's ribbons (TRIP_RIBBONS). */
  private tripRibbonsFlying(): boolean {
    for (const id of TRIP_RIBBONS.values()) if (this.trailOwners.has(id)) return true;
    return false;
  }

  /** Whatever shot draws ribbon `id` lets go of it (it fades out). */
  private releaseRibbon(id: string): void {
    const p = this.trailOwners.get(id);
    if (p) this.releaseTrail(p);
  }

  private spawnEnemy(def: EnemyDef, x: number, z: number, noRespawn = false, home: Partial<EnemyHome> = {}): Enemy {
    const e = new Enemy(def, { ...home, x, z }, this.d.world);
    e.hpScale = this.plus;
    e.hp = def.maxHp * this.plus;
    e.noRespawn = noRespawn;
    // A melee mob takes turns with its pack (two striking at once); a boss or a mob that keeps its distance needs no token.
    if (!def.boss && !((def.brain.preferredRange ?? 0) > 0)) e.tokens = this.tokens;
    e.onDissolve = () => this.dissolveBurst(e);
    e.onCollapse = () => this.d.audio.clatter();
    e.onStomp = (sx, sy, sz) => {
      this.fx.dust(_v.set(sx, sy + 0.1, sz), 2.2);
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

  /** Party level (Progress). Attack and max HP scale with it. */
  level = 1;

  /** Attack value including the equipped weapon, its affix, the level, and buffs. */
  private atkOf(me: CharacterDef): number {
    return (me.atk + this.d.inventory.atkBonus(me.id)) * atkMult(this.level) * (this.frenzyLeft > 0 ? 1.5 : 1);
  }

  /** Max HP including charm and weapon affixes and the level. */
  private maxOf(me: CharacterDef): number {
    return (me.maxHp + this.d.inventory.hpBonus(me.id)) * hpMult(this.level);
  }

  /** The element a character applies with elemental hits (weapon may override). */
  private elementOf(me: CharacterDef): Element {
    const w = this.d.inventory.equipped(me.id);
    return (w && ITEMS[w.itemId].element) || me.element;
  }

  /** True while a swing or cast locks movement (spinning in the lean cyclone, Sir Aldric walks), or the hero is down. */
  get busy(): boolean {
    const b = this.burstCast;
    const spinning = b?.kind === 'cyclone' && b.t >= CYCLONE.pour;
    return this.combo.swinging || this.casting !== null || this.heavy !== null || (b !== null && !spinning) || this.downed !== null;
  }

  /** The burst in progress (the rig animates the cyclone's pour and spin from it). */
  get burstState(): { kind: BurstKind; t: number } | undefined {
    return this.burstCast ? { kind: this.burstCast.kind, t: this.burstCast.t } : undefined;
  }

  get charging(): number {
    return this.heavyCharge;
  }

  /** The last hit on the hero: seconds ago and whether it was big (for the body's reaction); undefined once it is old. */
  get hurtState(): { t: number; big: boolean } | undefined {
    return this.hurt ? { t: this.hurt.t, big: this.hurt.big } : undefined;
  }

  /** The dodge in progress: seconds since it began. */
  get dodgeState(): { t: number } | undefined {
    return this.dodge ? { t: this.dodge.t } : undefined;
  }

  /** The active hero has fallen (the death clip plays until the switch). */
  get dead(): boolean {
    return this.downed !== null;
  }

  /** 0..1 animation progress for the rig, or undefined when idle. */
  get attackProgress(): number | undefined {
    if (this.burstCast) return Math.min(1, this.burstCast.t / BURST[this.active.id].time);
    if (this.heavy) return Math.min(1, this.heavy.t / this.timesOf(this.active.id).heavy.duration);
    // Charging: the wind-up builds toward the held frame (the body holds it; Orlan's robe leans into it).
    if (this.heavyCharge > 0) { const hold = this.timesOf(this.active.id).heavy.startAt; return Math.min(hold, this.heavyCharge * hold); }
    if (this.casting) return Math.min(1, this.casting.t / this.timesOf(this.casting.def.id).skill.duration);
    return this.combo.swinging ? this.combo.progress : undefined;
  }

  /** Seconds the current swing or cast lasts, so the body's clip can be fitted to it. */
  get attackDuration(): number | undefined {
    if (this.burstCast) return BURST[this.active.id].time;
    if (this.heavy) return this.timesOf(this.active.id).heavy.duration;
    if (this.heavyCharge > 0) return undefined;
    if (this.casting) return this.timesOf(this.casting.def.id).skill.duration;
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
    this.hurt = null;
    this.dodge = null;
    this.downed = null;
    for (const c of this.combos.values()) { c.swinging = false; c.swingTime = 0; }
  }

  healActive(amount: number): void {
    const me = this.active;
    this.hp.set(me.id, Math.min(this.maxOf(me), (this.hp.get(me.id) ?? 0) + amount));
    const at = _v.copy(this.playerPos()).add(UP);
    this.fx.sparks(at, UP, 14, PALETTE.witch, 3, 1.2);
    this.fx.flash(at, PALETTE.witch, 1.6);
    this.d.audio.heal();
  }

  applyFrenzy(seconds: number): void {
    this.frenzyLeft = Math.max(this.frenzyLeft, seconds);
  }

  /** A companion lands a hit on an enemy. */
  companionStrike(enemyId: number, atk: number): void {
    const e = this.enemies.find((x) => x.id === enemyId);
    if (e && e.alive) { this.hitEnemy(e, atk, 1.0, null, 0.8, 0.0, { companion: true }); }
  }

  private playerPos(): Vector3 {
    const p = this.d.controller.pos;
    return this.tmp.set(p.x, p.y, p.z);
  }

  /** Turns the hero to the enemy to strike: the locked-on one (wherever it is), else the nearest within `range`. */
  private softLock(range: number): void {
    const c = this.d.controller;
    const lock = this.lockTarget;
    if (lock?.alive) { c.yaw = Math.atan2(lock.pos.z - c.pos.z, lock.pos.x - c.pos.x); return; }
    let best: Enemy | null = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const dd = Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z);
      if (dd < bestD) { bestD = dd; best = e; }
    }
    if (best) c.yaw = Math.atan2(best.pos.z - c.pos.z, best.pos.x - c.pos.x);
  }

  /** The enemy Tab locked on to, or null. */
  get lockTarget(): Enemy | null {
    return this.lock.target;
  }

  set lockTarget(e: Enemy | null) {
    this.lock.target = e;
  }

  /**
   * Tab: locks on to the nearest living enemy within LOCK_RANGE in front of the camera (`forward`, its look on the
   * ground), else the nearest within that range at all (Combat.ts pickLockTarget); Tab again lets go. Returns the
   * target, or null.
   */
  toggleLock(forward: { x: number; z: number }): Enemy | null {
    return this.lock.toggle(this.d.controller.pos, forward, this.enemies);
  }

  /** The point the camera keeps framed while locked on (the target's middle, no higher than its chest for a giant), or undefined. */
  lockPoint(out: Vector3): Vector3 | undefined {
    const e = this.lockTarget;
    if (!e?.alive) return undefined;
    return out.set(e.pos.x, e.pos.y + Math.min(e.def.height * (e.def.scale ?? 1) * 0.55, 2.5), e.pos.z);
  }

  update(dt: number, input: CombatInput): void {
    // Whom the enemies fight this step: the hero, then every companion still standing.
    this.gatherMarks();
    this.updateGraveRising(dt);
    this.clock += dt;
    this.streak.update(dt);
    // The lock lets go of a target that fell or is too far to matter (despawn lets go of one that left the world).
    this.lock.update(this.d.controller.pos);
    const d = this.d;
    const c = d.controller;
    const me = this.active;
    this.iframes = Math.max(0, this.iframes - dt);
    this.dodgeCd = Math.max(0, this.dodgeCd - dt);
    this.frenzyLeft = Math.max(0, this.frenzyLeft - dt);
    // What the body is shown: the hit and the dodge age out; a fallen hero lies there, then the party moves on. The
    // hold stops only the hero's own moves (below): mobs, shots, pending jobs, puddles and the effects run on, so the
    // killing blow's burst finishes and nothing fights in place.
    if (this.hurt) { this.hurt.t += dt; if (this.hurt.t > 1.2) this.hurt = null; }
    if (this.dodge) { this.dodge.t += dt; if (this.dodge.t > 1) this.dodge = null; }
    if (this.downed) {
      this.downed.t += dt;
      if (this.downed.t >= DOWN_HOLD) { this.downed = null; this.finishDown(); return; }
    }
    const down = this.downed !== null;
    for (const cd of this.cooldowns.values()) cd.update(dt);
    // (Taken off the list before it runs: a callback can wipe the party, which empties the list mid-loop.)
    for (let i = this.delayed.length - 1; i >= 0; i--) {
      const job = this.delayed[i];
      if (!job) { i = this.delayed.length; continue; }
      job.t -= dt;
      if (job.t > 0) {
        // Its warning fills as it comes (on the fight's own clock: a hit-stop holds it with the strike).
        const w = job.warn;
        if (w) { w.follow?.(w.w.at); this.showWarning(w.w, w.from + (1 - w.from) * (1 - job.t / w.total)); }
        continue;
      }
      this.delayed.splice(i, 1);
      job.fn();
      if (i > this.delayed.length) i = this.delayed.length;
    }
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
        if (e.alive) this.damagePlayer(e.def.atk * 1.2, e.def.element, e.def.kind);
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
      const k = Math.min(1, p.left / PUDDLE_DRY);
      p.mesh.scale.setScalar(Math.max(0.05, k));
      if (p.hero) {
        for (const e of this.enemies) {
          if (e.alive && !e.def.flying && Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) < p.r * k + e.def.bodyRadius * (e.def.scale ?? 1) && Math.abs(e.pos.y - p.pos.y) < 1.5) e.afflict('slow', 1, 0.5);
        }
      } else if (c.mode === 'ground' && Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < p.r * k && Math.abs(c.pos.y - p.pos.y) < 1) this.slowLeft = Math.max(this.slowLeft, 1.4);
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
    // From the air: Wren shoots off the bow she rides, Orlan casts as he floats, Sir Aldric swings from under his cape:
    // every hero's attacks, skill and burst work in flight as on the ground.
    const canShoot = grounded || flying;
    const canHeavy = grounded || flying;
    const canBurst = grounded || flying;

    // --- dodge (a short cooldown: no chaining rolls into permanent invulnerability) ---
    if (input.dodge && grounded && !down && !this.burstCast && this.dodgeCd <= 0) {
      this.dodgeCd = 0.9;
      this.iframes = Math.max(this.iframes, 0.5);
      this.casting = null;
      this.heavy = null;
      this.heavyCharge = 0;
      for (const cb of this.combos.values()) { cb.swinging = false; }
      this.dodge = { t: 0 };
      d.audio.dodge();
      d.onDodge?.();
      d.events?.emit({ kind: 'feat', what: 'dodge' });
    }

    // --- light attack ---
    // (The swing's sound comes with its cut: the blade's whoosh as the blade starts cutting, a bow's or a staff's as the
    // shot leaves; the swing's crescent comes with the blow, in resolveAttack.)
    let begun: number | null = null;
    if (input.attack && canShoot && !down && !this.casting && !this.heavy && !this.burstCast && this.heavyCharge === 0) {
      this.softLock(7);
      begun = this.combo.press();
    }
    const prevHit = this.combo.currentHit;
    const prevSwinging = this.combo.swinging;
    const hit = this.combo.update(dt);
    // A buffered press chained the next hit in.
    if (prevSwinging && this.combo.swinging && this.combo.currentHit !== prevHit) begun = this.combo.currentHit;
    // The finisher takes some effort.
    if (begun === 2) this.sfx.effort(me.id);
    if (hit !== null) this.resolveAttack(me, COMBO[me.weapon].hits[hit], hit);

    // --- heavy attack (hold RMB to charge, release to swing) ---
    if (input.heavyHeld && canHeavy && !this.busy) {
      this.heavyCharge = Math.min(1, this.heavyCharge + dt / 1.1);
      if (this.heavyCharge > 0.3 && this.heavyCharge - dt / 1.1 <= 0.3) this.fx.flash(_v.copy(this.playerPos()).add(_w.set(0, 1.2, 0)), ELEMENT_COLOR[this.elementOf(me)], 1.2);
    }
    if ((input.heavyRelease || (!input.heavyHeld && this.heavyCharge > 0)) && this.heavyCharge > 0 && !this.heavy && !down) {
      this.softLock(8);
      // The swing picks up at the wind-up frame the charge held (heroClips.ts), and lands on the clip's blow.
      const timing = this.timesOf(me.id).heavy;
      this.heavy = { t: timing.startAt * timing.duration, fired: false, charge: this.heavyCharge };
      this.heavyCharge = 0;
      this.sfx.effort(me.id);
    }
    if (this.heavy) {
      const timing = this.timesOf(me.id).heavy;
      this.heavy.t += dt;
      if (!this.heavy.fired && this.heavy.t >= timing.duration * timing.strike) {
        this.heavy.fired = true;
        const ch = this.heavy.charge;
        const def: AttackDef = me.weapon === 'staff'
          ? { mult: 1.8 + ch * 1.8, element: 'own', shape: { kind: 'bolt', range: 16, chains: 2, chainRange: 7 }, knockback: 1 + ch * 2, hitStop: 0.06 + ch * 0.08 }
          : me.weapon === 'bow'
          ? { mult: 2.0 + ch * 2.2, element: 'own', shape: { kind: 'bolt', range: 34, chains: 0, chainRange: 0 }, knockback: 2 + ch * 3, hitStop: 0.07 + ch * 0.08 }
          : { mult: 1.7 + ch * 1.9, element: ch > 0.5 ? 'own' : null, shape: { kind: 'cone', range: 4.2, halfAngle: 1.25 }, knockback: 3 + ch * 5, hitStop: 0.09 + ch * 0.1 };
        this.resolveAttack(me, def, 'heavy');
        this.feel.punch = true;
        // The greatsword comes down on the ground: a ring and a puff of dust where it struck, the ground shaking.
        if (me.weapon !== 'staff' && me.weapon !== 'bow' && ch > 0.5) {
          const color = ELEMENT_COLOR[this.elementOf(me)];
          const fx = c.pos.x + Math.cos(c.yaw) * 1.8;
          const fz = c.pos.z + Math.sin(c.yaw) * 1.8;
          const at = _v.set(fx, this.d.world.heightAt(fx, fz, c.pos.y + 1), fz);
          this.fx.shock(at, color, 4 + ch * 3);
          this.fx.dust(at, 1.4 + ch);
          d.onShake?.(0.1 + ch * 0.25);
        }
      }
      if (this.heavy.t >= timing.duration) this.heavy = null;
    }

    // --- skill ---
    const cd = this.cooldowns.get(me.id)!;
    if (input.skill && (grounded || flying) && !this.busy && this.heavyCharge === 0 && cd.ready) {
      this.softLock(9);
      cd.use();
      this.casting = { def: me, t: 0, fired: false };
      d.audio.cast();
      this.sfx.effort(me.id);
    }
    if (this.casting) {
      const skill = SKILLS[this.casting.def.id];
      // The cast lasts as long as its clip cut and fires on the cut's measured blow (heroClips.ts).
      const timing = this.timesOf(this.casting.def.id).skill;
      this.casting.t += dt;
      if (!this.casting.fired && this.casting.t >= timing.duration * timing.strike) {
        this.casting.fired = true;
        const color = ELEMENT_COLOR[this.elementOf(this.casting.def)];
        this.fx.flash(_v.copy(this.playerPos()).add(_w.set(0, 1.1, 0)), _col.set(color).multiplyScalar(0.7), 2);
        // (The crescent lays the skill's burning ground along its own path; any other skill's goes down in front.)
        this.resolveAttack(this.casting.def, skill.attack, 'skill', skill.ground);
        if (skill.ground && skill.attack.shape.kind !== 'crescent') {
          const at = this.ahead(2);
          this.addZone({ ...skill.ground, element: this.elementOf(this.casting.def) }, this.atkOf(this.casting.def), at);
          this.fx.dust(at, 1.4);
        }
      }
      if (this.casting.t >= timing.duration) this.casting = null;
    }

    // The cast circle under the hero while the heavy charges or a skill is cast; motes rising slowly off the charging
    // weapon (the blade, the staff's knob, the bow hand) every 0.15 s.
    const circle = this.heavyCharge > 0 || this.casting !== null;
    if (circle || this.runeOn) {
      this.fx.rune(_v.set(c.pos.x, c.pos.y, c.pos.z), ELEMENT_COLOR[this.elementOf(me)], circle);
      this.runeOn = circle;
    }
    if (this.heavyCharge > 0) {
      this.chargeSpark -= dt;
      if (this.chargeSpark <= 0 && this.d.weaponTips?.(_g, _t)) {
        this.chargeSpark = 0.15;
        this.fx.sparks(_t, UP, 3, ELEMENT_COLOR[this.elementOf(me)], 1.6, 0.35);
      }
    } else this.chargeSpark = 0;

    // --- burst (Q): each hero's own ---
    if (input.burst && canBurst && !this.busy && this.heavyCharge === 0 && this.burstEnergy >= BURST_MAX) {
      this.burstEnergy = 0;
      this.burstCast = { t: 0, fired: false, kind: BURST[me.id].kind, shots: 0, tick: 0, puddle: 0 };
      this.iframes = Math.max(this.iframes, 1.0);
      d.audio.burst();
      this.sfx.effort(me.id);
      this.feel.punch = true;
      this.feel.pulse = Math.max(this.feel.pulse, 0.25);
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
        this.blowSmoke(me);
      }
      if (b.t >= BURST[me.id].time) this.burstCast = null;
    }

    // The blade starts cutting: its whoosh (heavier for the heavy, the finisher, the skill and the spin).
    const blade = this.bladeColor() !== null;
    if (blade && !this.bladeWas) {
      const k = this.attackKind;
      this.sfx.swing('blade', k === 'heavy' || k === 'skill' || k === 'burst' || k === 2);
    }
    this.bladeWas = blade;

    // --- enemies ---
    let anyAggro = false;
    let bossNear: Enemy | null = null;
    // A boss in the fight, for the score: one after the hero, or one the smoke turned on its own for a while (the boss
    // layer plays on through its brawl instead of fading out and back in).
    let bossFight = false;
    for (const e of this.enemies) {
      // Turned on its own by Orlan's smoke: it goes for another mob (and cannot see the hero at all).
      if (e.status.brawl > 0 && !e.brawling) e.brawlTarget = this.brawlFoe(e);
      const foe = e.brawling ? e.brawlTarget : null;
      if (foe) this.brawlMark[0] = foe.pos;
      const action = e.update(dt, foe ? this.brawlMark : this.marks);
      // Its wind-up's warning on the ground, filling with the wind-up (gone with a blow that will not come).
      this.warnWindup(e, foe !== null);
      const boss = !!e.def.boss && e.aggro && e.alive;
      bossFight ||= boss;
      if (foe) { if (action) this.brawlHit(e, foe); continue; }
      anyAggro ||= e.aggro && e.status.confuse <= 0;
      if (boss) bossNear = bossNear ?? e;
      if (action?.kind === 'melee') this.meleeBlow(e);
      else if (action?.kind === 'boss') this.bossAction(e, action.attack);
      // Contact damage window after a charge, a bite or a leap: the first bodies it runs into (the hero, a companion).
      const win = this.contact.get(e.id);
      if (win !== undefined) {
        const left = win - dt;
        const sc = e.def.scale ?? 1;
        if (left <= 0 || !e.alive) this.contact.delete(e.id);
        else {
          this.contact.set(e.id, left);
          const reach = e.def.bodyRadius * sc + CONTACT_REACH;
          const touching = (x: number, z: number, y: number): boolean => y > e.pos.y - 1.5 && y < e.pos.y + e.def.height * sc && Math.hypot(e.pos.x - x, e.pos.z - z) < reach;
          const hero = touching(c.pos.x, c.pos.z, c.pos.y);
          if (this.strike(e, 1.2, touching) > 0) { this.contact.delete(e.id); if (hero) this.d.onShake?.(0.7); }
        }
      }
    }
    // The pack takes turns: a token goes back once its holder's blow is done (recovering, dead, gone home, dazed off it).
    this.tokens.settle((e) => e.alive && !e.brawling && (e.state === 'windup' || e.state === 'attack'));
    // ...and does not stand in itself: aggro bodies on foot part (Enemy.separate).
    const pack = this.pack;
    pack.length = 0;
    for (const e of this.enemies) if (e.alive && e.aggro && !e.def.flying) pack.push(e);
    if (pack.length > 1) separate(pack, dt);
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive && e.noRespawn && !e.object.visible) this.despawn(e);
    }
    d.sky.setBloodMoon(anyAggro || this.burstCast !== null);
    if (bossNear) d.hud.setBoss(bossNear.def.name, bossNear.def.title ?? '', bossNear.hp / bossNear.def.maxHp, true);
    else d.hud.setBoss('', '', 0, false);
    // The score's boss layer: on while a boss has the hero in its sights (or brawls in the smoke), off once it falls or
    // gives up the chase.
    if (bossFight !== this.bossMusic) {
      this.bossMusic = bossFight;
      d.audio.score.layer('boss', bossFight);
    }

    // --- projectiles ---
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.age += dt;
      if (p.gravity) p.vel.y -= p.gravity * dt;
      if (p.homing) steer(p, dt, this.nearest);
      p.pos.addScaledVector(p.vel, dt);
      let blocked = false;
      if (p.ground > 0) {
        // Riding the ground (Combat.rideBase): up a slope and down again; a wall, or a step it cannot ride up, breaks
        // it; over a drop it holds its height.
        const w = d.world as Partial<HeightWorld> & WorldQuery;
        const base = p.pos.y - p.ground;
        const to = w.blocked?.(p.pos.x, p.pos.z) ? null : rideBase(base, d.world.heightAt(p.pos.x, p.pos.z, base + RIDE_UP));
        if (to === null) blocked = true;
        else p.pos.y = to + p.ground;
      }
      p.object.position.copy(p.pos);
      if (p.wobble > 0) {
        // Off its true line, swaying both ways as if the arrow were seeing things.
        const age = p.age;
        side.set(-p.vel.z, 0, p.vel.x).normalize();
        p.object.position.addScaledVector(side, Math.sin(age * 13 + p.seed) * p.wobble).y += Math.cos(age * 9 + p.seed * 2) * p.wobble * 0.7;
        p.object.scale.setScalar(1 + Math.sin(age * 20 + p.seed) * 0.25);
      }
      if (p.rainbow.length) {
        const h = (performance.now() / 1000 * 1.4 + p.seed) % 1;
        p.rainbow.forEach((m, k) => m.color.setHSL((h + k * 0.13) % 1, 1, 0.6));
      }
      if (p.kind === 'arrow' || p.kind === 'ring' || p.kind === 'trip' || p.kind === 'web' || p.kind === 'crescent') p.object.lookAt(aim.copy(p.object.position).add(p.vel));
      if (p.kind === 'web') p.object.rotateZ(dt * 3);
      else if (p.kind === 'log' || p.kind === 'cup') { p.object.rotation.x += dt * 7; p.object.rotation.y += dt * 1.3; }
      else if (p.kind === 'gem') { p.object.rotation.y += dt * 12; p.object.rotation.x += dt * 3; }
      else if (p.kind === 'fire') p.object.scale.setScalar(1 + (2.5 - p.life) * 0.6);
      else if (p.kind === 'star') { if (p.twinkle) p.twinkle.rotation += dt * 4; }
      else if (p.kind !== 'crescent') p.object.rotation.y += dt * 12;
      if (p.fade) p.fade.value = Math.max(0, Math.min(1, p.age / 0.06, p.life / 0.12));
      if (p.trail) this.feedTrail(p);
      // A throw's landing warning fills as it falls; it shows the edge as the shot comes down (removeProjectile).
      if (p.warn) {
        // (Past its landing time, a shot that flew on, a diamond that missed: the warning shows its edge and goes.)
        if (p.age >= p.flight) { this.fx.driveTelegraph(p.warn.id, 1, p.warn.at); p.warn = null; }
        else this.showWarning(p.warn, Math.min(0.99, HANDOFF + (1 - HANDOFF) * (p.age / Math.max(0.05, p.flight))));
      }
      if (p.burn) {
        // The burning ground, a patch every `every` metres of the run (the first a metre out).
        const gone = Math.hypot(p.pos.x - p.from.x, p.pos.z - p.from.z);
        while (gone >= p.burn.next) { this.layBurn(p); p.burn.next += p.burn.every; }
      }
      if (p.kind === 'crescent') this.fx.sparks(_v.set(p.pos.x, p.pos.y + 0.6, p.pos.z), _w.copy(p.vel).multiplyScalar(-0.1).add(UP), 1, p.color, 3, 0.7);
      let dead = blocked || p.life <= 0;
      if (!dead && p.ground === 0) {
        if (p.aoe > 0) {
          // A falling star bursts where it meets the ground (a deck it falls onto counts).
          const gy = d.world.heightAt(p.pos.x, p.pos.z, p.pos.y + 0.5);
          if (p.pos.y <= gy + 0.1) { dead = true; p.pos.y = Math.max(p.pos.y, gy); }
        } else {
          // (Asked as a point, not a person: the ground query keeps a body's head room under overhangs, which would
          // break a shot flying close under a roof.)
          dead = p.pos.y < d.world.heightAt(p.pos.x, p.pos.z, p.pos.y - 1.8) - 0.2;
        }
      }
      if (p.owner === 'player') {
        // (A shot can still strike on the step it dies: an arrow at a mob's feet meets the mob and the ground at once.)
        for (const e of this.enemies) {
          if (!e.alive || p.hit.has(e.id)) continue;
          const sc = e.def.scale ?? 1;
          if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) > p.radius + e.def.bodyRadius * sc) continue;
          // A falling star meets a body only inside it; anything else catches whatever is roughly level with it.
          if (p.aoe > 0 ? p.pos.y > e.pos.y + e.def.height * sc + 0.3 || p.pos.y < e.pos.y - 0.3 : Math.abs(e.pos.y + e.def.height * sc * 0.5 - p.pos.y) >= 2.5 + e.def.height * sc * 0.5) continue;
          // (The star's burst strikes it, with everything else under it.)
          if (p.aoe > 0) { dead = true; break; }
          p.hit.add(e.id);
          // (The crescent freezes the fight on the first body it cuts and only catches on each after, a reaction there
          // too, its blows as heavy; a shot of a many-shot skill charges the burst through its cast.)
          this.hitEnemy(e, p.atk, p.mult, p.element, p.knockback, p.hitStop, { at: p.object.position, heavy: p.hitStop >= 0.08, pierced: p.pierce ? p.hit.size : 0, cast: p.cast });
          p.onHit?.(e);
          // The crescent cuts on through.
          if (p.pierce) continue;
          if (p.chains > 0) {
            const next = this.nearestEnemy(e.pos.x, e.pos.z, p.chainRange, p.hit);
            if (next) {
              // On to the next body: aimed at it and, homing, chasing it (Moon Volley's arrows), never the one it struck.
              p.chains--;
              chainTo(p, next, 22);
              p.life = 1.2;
            } else dead = true;
          } else dead = true;
          break;
        }
        // (The crescent rides the ground under the sky eyes.)
        if (!dead && !p.pierce) for (const t of this.targets) {
          if (!t.active() || t.pos.distanceTo(p.pos) > p.radius + t.radius) continue;
          t.onHit(p.pos.clone());
          dead = true;
          break;
        }
      } else if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < p.radius + BODY_REACH && Math.abs(c.pos.y + 1 - p.pos.y) < 1.6 + p.radius) {
        const shielded = this.iframes > 0;
        this.damagePlayer(p.atk * p.mult, p.element, p.by ?? 'hazard');
        if (p.poison) this.poisonPlayer(p.poison.dps, p.poison.seconds);
        if (p.web > 0 && !shielded) this.ensnare(p.web);
        if (p.kind === 'trip' && !shielded) this.d.onTrip?.(0.6, 3);
        dead = true;
      } else {
        // A companion in its way takes it instead (the blow only: webs, poison and the trip are the hero's).
        for (const a of this.allies) {
          if (a.hp <= 0 || Math.hypot(a.pos.x - p.pos.x, a.pos.z - p.pos.z) >= p.radius + BODY_REACH || Math.abs(a.pos.y + 1 - p.pos.y) >= 1.6 + p.radius) continue;
          this.hurtAlly(a, p.atk * p.mult);
          dead = true;
          break;
        }
      }
      if (dead) {
        if (p.aoe > 0) this.starBurst(p);
        else if (p.kind === 'crescent') {
          // The wave breaks: a last patch of burning ground where it stopped, unless one lies just behind.
          if (p.burn && Math.hypot(p.pos.x - p.from.x, p.pos.z - p.from.z) - (p.burn.next - p.burn.every) > p.burn.every * 0.5) this.layBurn(p);
          this.fx.flash(_v.set(p.pos.x, p.pos.y + 0.7, p.pos.z), p.color, 2.2);
        } else if (p.owner === 'player') this.fx.flash(p.pos, _col.set(ELEMENT_COLOR[p.element ?? 'lunar']).multiplyScalar(0.6), 1.4);
        else this.fx.flash(p.pos, p.color, p.kind === 'log' ? 3.5 : 1.6);
        if (p.kind === 'log') { this.fx.dust(p.pos, 2.4); this.d.onShake?.(0.4); this.d.audio.stomp(); }
        if (p.kind === 'cup') this.spawnPuddle(p.pos);
        if (p.kind === 'trip') for (const col of [0xff5ad6, 0x37f5ff, 0x5dff3a, 0x8b3dff]) this.fx.sparks(p.pos, UP, 6, col, 4, 1.0);
        this.removeProjectile(p);
      }
    }

    // --- ground zones ---
    for (let i = this.zones.length - 1; i >= 0; i--) {
      const z = this.zones[i];
      z.left -= dt;
      z.tick -= dt;
      if (z.tick <= 0) {
        z.tick = z.def.tickEvery;
        for (const e of this.enemies.slice()) {
          if (!e.alive || !inRadius({ x: z.pos.x, z: z.pos.z }, { x: e.pos.x, z: e.pos.z }, z.def.radius + e.def.bodyRadius * (e.def.scale ?? 1))) continue;
          // One cast's patches overlap: a mob in several is ticked as often as one would tick it.
          if (z.group) {
            const last = z.group.last.get(e.id);
            if (last !== undefined && this.clock - last < z.def.tickEvery * 0.9) continue;
            z.group.last.set(e.id, this.clock);
          }
          this.hitEnemy(e, z.atk, z.def.tickMult, z.def.element, 0, 0, { energy: false, dot: true });
        }
      }
      if (z.left <= 0) { z.remove(); this.zones.splice(i, 1); }
    }

    this.updateClouds(dt);

    // --- loot ---
    const got = this.loot.update(dt, this.playerPos());
    if (got > 0) { d.inventory.shards += got; d.audio.coins(Math.min(3, Math.ceil(got / 5))); d.hud.shardPop(got); }

    this.vfx.update(dt);
    d.hud.setHp(this.hp.get(me.id)!, this.maxOf(me));
    d.hud.setSkill(SKILLS[me.id].name, cd.fraction, cd.ready && (grounded || flying));
    d.hud.setBurst(this.burstEnergy / BURST_MAX, this.burstEnergy >= BURST_MAX && canBurst, BURST[me.id].name);
    d.hud.setCharge(this.heavyCharge);
    d.hud.setShards(d.inventory.shards);
    d.hud.setFrenzy(this.frenzyLeft);
    d.hud.setCombo(this.streak.count);
    d.hud.setCrosshair(this.attackKind !== undefined);
    this.flushFeel();
  }

  /** Asks for a camera kick away from (x, z) (toward the camera, on the ground): the strongest of the step wins. */
  private kick(x: number, z: number, amount: number): void {
    if (amount <= this.feel.kick) return;
    const cam = this.d.camera.position;
    this.feel.dir.set(cam.x - x, 0, cam.z - z);
    this.feel.kick = amount;
  }

  /** The step's feel, once: one kick (the strongest), one fov punch, one pulse, one crit sting, one heavy boom. */
  private flushFeel(): void {
    const f = this.feel;
    if (f.kick > 0) { this.d.onKick?.(f.dir, f.kick); f.kick = 0; }
    if (f.punch) { this.d.onPunch?.(4, 0.18); f.punch = false; }
    if (f.pulse > 0) { this.d.onPulse?.(f.pulse); f.pulse = 0; }
    if (f.crit) { this.sfx.crit(); f.crit = false; }
    if (f.boom) { this.sfx.heavyHit(); f.boom = false; }
    this.flashed.clear();
  }

  /** Feeds a shot's ribbon: its drawn position, the ribbon turned to face the camera. */
  private feedTrail(p: Projectile): void {
    const o = p.object.position;
    const cam = this.d.camera.position;
    _side.copy(p.vel).cross(_v.set(cam.x - o.x, cam.y - o.y, cam.z - o.z));
    if (_side.lengthSq() < 1e-6) _side.set(-p.vel.z, 0, p.vel.x);
    if (_side.lengthSq() < 1e-6) _side.set(1, 0, 0);
    _side.setLength(p.trailW);
    this.fx.trail(p.trail!, _g.copy(o).add(_side), _t.copy(o).sub(_side), p.color, true);
  }

  /**
   * A patch of the crescent's burning ground on the ground under it, and the dust it kicks up (Combat.patchHeight); none
   * over a drop it sails across at its own height, where the patch, its dust and its tick (across the ground only) would
   * hang in the air over whatever stands below.
   */
  private layBurn(p: Projectile): void {
    const b = p.burn!;
    const base = p.pos.y - p.ground;
    const y = patchHeight(base, this.d.world.heightAt(p.pos.x, p.pos.z, base + RIDE_UP));
    if (y === null) return;
    const at = new Vector3(p.pos.x, y, p.pos.z);
    this.addZone(b.def, b.atk, at, b.group);
    this.fx.dust(at, 1.3);
  }

  /** A falling star bursts: everything within its radius is struck, with a flash, sparks, a ring and dust. */
  private starBurst(p: Projectile): void {
    const at = p.pos;
    for (const e of this.enemies.slice()) {
      if (!e.alive || p.hit.has(e.id) || !this.reachable(e, p.aoe, at)) continue;
      p.hit.add(e.id);
      this.hitEnemy(e, p.atk, p.mult, p.element, p.knockback, p.hitStop, { cast: p.cast });
    }
    this.fx.flash(_v.set(at.x, at.y + 0.5, at.z), _col.set(p.color).multiplyScalar(0.8), 3);
    this.fx.flash(_v, _col.copy(MOON).multiplyScalar(0.6), 1.4);
    this.fx.sparks(_v.set(at.x, at.y + 0.2, at.z), UP, 18, p.color, 8, 0.9);
    this.fx.shock(at, p.color, p.aoe * 1.6);
    this.fx.dust(at, 1.2);
    this.d.audio.stomp();
  }

  /** The ground `dist` metres in front of the hero. */
  private ahead(dist: number): Vector3 {
    const c = this.d.controller;
    const x = c.pos.x + Math.cos(c.yaw) * dist;
    const z = c.pos.z + Math.sin(c.yaw) * dist;
    return new Vector3(x, this.d.world.heightAt(x, z, c.pos.y + 1), z);
  }

  /**
   * The colour of the blade's ribbon while Sir Aldric's cut is live (his cached windows, MoveTimes.blade) or the cyclone
   * spins; null otherwise. Runs every step and every frame, so it only reads numbers: nothing is built.
   */
  private bladeColor(): number | null {
    const me = this.active;
    if (me.weapon !== 'sword' && me.weapon !== 'greatsword') return null;
    const b = this.burstCast;
    if (b) return b.kind === 'cyclone' && b.t >= CYCLONE.pour + 0.15 && b.t < CYCLONE.pour + CYCLONE.spin - 0.1 ? LEAN_PURPLE : null;
    if (this.heavyCharge > 0 || this.downed) return null;
    // (The move in progress, as attackKind and attackProgress would say: the heavy, the skill, a light hit.)
    const t = this.timesOf(me.id);
    let w: Window | null;
    let p: number;
    if (this.heavy) { w = t.blade.heavy; p = this.heavy.t / t.heavy.duration; }
    else if (this.casting) { w = t.blade.skill; p = this.casting.t / t.skill.duration; }
    else if (this.combo.swinging) { w = t.blade.attack[this.combo.currentHit] ?? null; p = this.combo.progress; }
    else return null;
    p = Math.min(1, p);
    return w && p >= w[0] && p <= w[1] ? ELEMENT_COLOR[this.elementOf(me)] : null;
  }

  /**
   * Sir Aldric's lean cyclone: the pour (the rig tips the cup over the blade), then a spin that cuts everything
   * around him every 0.3 s and splashes it with lean: slowed to a crawl, moving and striking. While he spins, lean
   * flies off the blade's tip and puddles behind him every 0.6 s (a puddle slows the mobs that wade in, never him): a
   * trail of CYCLONE_PUDDLES at most, the oldest drying up as the next is laid.
   */
  private cyclone(me: CharacterDef, b: { t: number; tick: number; fired: boolean; puddle: number }, dt: number): void {
    if (b.t < CYCLONE.pour) return;
    const c = this.d.controller;
    if (b.t < CYCLONE.pour + CYCLONE.spin) {
      // A spark off the tip, out along the turn (the rig turns the body anticlockwise seen from above).
      if (this.d.weaponTips?.(_g, _t)) this.fx.sparks(_t, _w.set(_t.z - c.pos.z, 0.35, c.pos.x - _t.x), 1, LEAN_PURPLE, 7, 0.35);
      b.puddle -= dt;
      if (b.puddle <= 0 && c.mode === 'ground') {
        b.puddle = 0.6;
        // Spinning on the spot keeps one puddle fresh rather than stacking them; on the move each 0.6 s leaves its own.
        const here = this.puddles.find((p) => p.hero && Math.hypot(p.pos.x - c.pos.x, p.pos.z - c.pos.z) < 1.2);
        if (here) here.left = 6;
        else {
          this.spawnPuddle(this.playerPos(), 'hero');
          // A trail, not a lake (eight discs on the move were the transparent-plane budget on their own).
          let wet = 0;
          for (let i = this.puddles.length - 1; i >= 0; i--) {
            const q = this.puddles[i];
            if (q.hero && q.left > PUDDLE_DRY && ++wet > CYCLONE_PUDDLES) q.left = PUDDLE_DRY;
          }
        }
      }
    }
    b.tick -= dt;
    if (b.tick > 0) return;
    b.tick = 0.3;
    const at = this.playerPos().clone();
    const last = b.t + 0.3 >= CYCLONE.pour + CYCLONE.spin;
    const radius = last ? 5 : 3.8;
    for (const e of this.enemies.slice()) {
      if (!e.alive || !this.reachable(e, radius, at)) continue;
      this.hitEnemy(e, this.atkOf(me), last ? 1.6 : 0.7, this.elementOf(me), last ? 4 : 1.2, 0.02, { energy: false, heavy: last });
      e.afflict('slow', 2.6, 0.35);
      this.fx.sparks(_v.set(e.pos.x, e.pos.y + e.def.height * (e.def.scale ?? 1) * 0.6, e.pos.z), UP, 8, LEAN_PURPLE, 3, 1.0);
    }
    this.fx.sparks(_v.copy(at).add(_w.set(0, 1.1, 0)), UP, 12, LEAN_PURPLE, 6, 1.0);
    if (!b.fired || last) { this.fx.shock(at, 0x8b3dff, radius * 1.4); b.fired = true; }
    this.sfx.swing('blade', last);
    if (last) this.feel.punch = true;
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
   * random spot on the ground) and wanders in on it, swaying and changing colour; a hit dazes, then confuses. Three of
   * them (TRIP_RIBBONS) burn brighter and draw a ribbon of their own all the way.
   */
  private tripArrow(me: CharacterDef, i: number): void {
    const c = this.d.controller;
    // (The volley's three ribbons and her two arrows' would be five ids for CombatFx's four slots, stolen back and forth
    // every frame: arrows still in the air from before the volley let theirs go as it starts, and her arrows draw none
    // until these three are down, see nextArrowTrail.)
    if (i === 0) { this.releaseRibbon('arrow0'); this.releaseRibbon('arrow1'); }
    const ribbon = TRIP_RIBBONS.get(i);
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
      trail: ribbon, trailW: 0.07, bright: ribbon !== undefined,
    });
    this.sfx.swing('bow');
  }

  /** Orlan's pipe dream: a great cloud of smoke rolls out from his pipe and hangs over everything around him. */
  private blowSmoke(me: CharacterDef): void {
    const c = this.d.controller;
    const pos = new Vector3(c.pos.x, c.pos.y, c.pos.z);
    const pipe = new Vector3(c.pos.x + Math.cos(c.yaw) * 0.3, c.pos.y + 1.25, c.pos.z + Math.sin(c.yaw) * 0.3);
    const cloud: SmokeCloud = { pos, r: 11, left: 8.5, life: 8.5, tick: 0, atk: this.atkOf(me), puffs: [] };
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

  /**
   * Smoke clouds: puffs roll out and drift; every mob inside chokes on it (SMOKE_TICK of Orlan's attack each 0.4 s) and
   * is turned on its own (or loses the hero, alone).
   */
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
        for (const e of this.enemies.slice()) {
          if (!e.alive || !this.reachable(e, cl.r, cl.pos)) continue;
          this.hitEnemy(e, cl.atk, SMOKE_TICK, null, 0, 0, { energy: false, dot: true });
          if (!e.alive || e.brawling) continue;
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
    this.fx.arc(_g.set(e.pos.x, e.pos.y + 1.1, e.pos.z), e.yaw, 0, Math.min(6, e.def.brain.attackRange + 1), PALETTE.blood, 1.0);
    if (l > reach) return;
    const dmg = computeDamage({ atk: e.def.atk, multiplier: 1.4, defense: foe.def.def });
    const died = foe.takeDamage(dmg, { x: dx / l, z: dz / l }, foe.def.boss ? 0.3 : 2.5);
    const at = new Vector3(foe.pos.x, foe.pos.y + foe.def.height * (foe.def.scale ?? 1) * 0.5, foe.pos.z);
    this.fx.flash(at, PALETTE.blood, 1.8);
    this.fx.sparks(at, _w.set(dx / l, 0.35, dz / l), 8, PALETTE.blood, 5);
    this.showNumber(at, dmg, PALETTE.blood, false, foe.id);
    this.sfx.hit(hitMaterial(foe.def.kind));
    if (!foe.brawling && foe.status.stun <= 0 && foe.alive) { foe.brawlTarget = e; foe.afflict('brawl', 3); }
    if (died) this.onEnemyDeath(foe, at);
  }

  /** This step's marks: the hero's place, then every companion still standing (and the companions themselves). */
  private gatherMarks(): void {
    this.marks.length = 0;
    this.allies.length = 0;
    this.marks.push(this.d.controller.pos);
    for (const a of this.d.allies?.() ?? []) {
      if (a.hp <= 0) continue;
      this.allies.push(a);
      this.marks.push(a.pos);
    }
  }

  /** Whom `e` aims at, into `out`: the companion it went for (if it still stands), else the hero with their running for a lead. */
  private aimOf(e: Enemy, out: Aim): Aim {
    const m = e.mark;
    if (m) for (const a of this.allies) {
      if (a.pos !== m || a.hp <= 0) continue;
      out.x = a.pos.x; out.y = a.pos.y; out.z = a.pos.z; out.vx = 0; out.vz = 0;
      return out;
    }
    const c = this.d.controller;
    out.x = c.pos.x; out.y = c.pos.y; out.z = c.pos.z; out.vx = c.vel.x; out.vz = c.vel.z;
    return out;
  }

  /**
   * An enemy's blow lands on everyone `inside` holds (asked with their feet: x, z, y, and whether it is the hero): the
   * hero (damagePlayer) and every companion still standing (hurtAlly), `mult` of its attack. Returns how many it struck.
   */
  private strike(e: Enemy, mult: number, inside: (x: number, z: number, y: number, hero: boolean) => boolean): number {
    const c = this.d.controller;
    let n = 0;
    if (inside(c.pos.x, c.pos.z, c.pos.y, true)) { this.damagePlayer(e.def.atk * mult, e.def.element, e.def.kind); n++; }
    for (const a of this.allies) if (a.hp > 0 && inside(a.pos.x, a.pos.z, a.pos.y, false)) { this.hurtAlly(a, e.def.atk * mult); n++; }
    return n;
  }

  /** An enemy's blow on a companion: as much as the hero would take, a flash and the number over it. */
  private hurtAlly(a: CombatAlly, atk: number): void {
    const dmg = computeDamage({ atk, multiplier: 1, defense: PLAYER_DEF });
    if (!a.hurt(dmg)) return;
    const at = _v.set(a.pos.x, a.pos.y + 1.8, a.pos.z);
    this.fx.flash(at, PALETTE.blood, 1.2);
    this.showNumber(at, dmg, PALETTE.blood, false);
  }

  /** A mob's plain swing lands: its crescent, and the blow on everyone in its cone (the warning drew it: meleeReach, MELEE_HALF). */
  private meleeBlow(e: Enemy): void {
    const reach = meleeReach(e.def);
    this.fx.arc(_g.set(e.pos.x, e.pos.y + 1.1, e.pos.z), e.yaw, 0, reach, PALETTE.ultramarine, MELEE_HALF);
    this.strike(e, 1, (x, z) => inCone(e.pos, e.yaw, { x, z }, reach, MELEE_HALF));
  }

  /** The ground under a body's feet (a flyer's: the ground below it). */
  private feetOf(e: Enemy): number {
    return e.def.flying ? this.d.world.heightAt(e.pos.x, e.pos.z, e.pos.y) : e.pos.y - e.def.hover;
  }

  /**
   * An enemy's wind-up warning (Warnings.warnSpec), drawn as the wind-up starts and driven each step after (CombatFx.
   * driveTelegraph) with the brain's own wind-up, so a hit-stop, a slow or a daze holds the sweep with the body and it
   * reaches the edge exactly as the blow lands. It follows the body, whom it aims at, or the throw's landing point
   * (Warnings.landing, the very point the throw goes to) as they move. A blow that will not come (the body fell, was
   * dazed or confused off it, gave up the chase, was turned on its own) puts it out at once. Brawls show none.
   */
  private warnWindup(e: Enemy, brawl: boolean): void {
    let list = this.windups.get(e.id);
    if (e.state !== 'windup' || !e.alive || brawl || e.returning) {
      if (!list) return;
      const landed = e.alive && e.state === 'attack' && !brawl;
      for (const w of list) {
        // (A hand-off warning goes out here: the throw's or the delayed strike's own warning takes it on from HANDOFF.)
        if (landed && !w.spec.handoff) { this.poseWarning(e, w); this.fx.driveTelegraph(w.id, 1, w.at, w.yaw); }
        else this.fx.endTelegraph(w.id);
      }
      this.windups.delete(e.id);
      return;
    }
    if (!list) {
      const aim = this.aimOf(e, this.aimTmp);
      const spec = warnSpec(e.def, e.currentAttack, Math.hypot(aim.x - e.pos.x, aim.z - e.pos.z));
      list = [];
      if (spec) for (let k = 0; k < warnCount(e.currentAttack?.kind); k++) list.push({ id: e.id * 4 + k, k, spec, at: new Vector3(), yaw: 0 });
      this.windups.set(e.id, list);
    }
    const fill = e.windupFill;
    for (const w of list) {
      this.poseWarning(e, w);
      this.showWarning(w, w.spec.handoff ? fill * HANDOFF : fill);
    }
  }

  /** Where a wind-up's warning stands now (its anchor: Warnings.WarnAnchor) and which way it faces. */
  private poseWarning(e: Enemy, w: Warning): void {
    switch (w.spec.anchor) {
      case 'body':
        w.at.set(e.pos.x, this.feetOf(e), e.pos.z);
        w.yaw = e.yaw;
        return;
      case 'lunge': {
        const a = this.aimOf(e, this.aimTmp);
        w.at.set(e.pos.x, this.feetOf(e), e.pos.z);
        w.yaw = Math.atan2(a.z - e.pos.z, a.x - e.pos.x);
        return;
      }
      case 'mark': {
        const a = this.aimOf(e, this.aimTmp);
        w.at.set(a.x, this.d.world.heightAt(a.x, a.z, a.y + 1), a.z);
        w.yaw = 0;
        return;
      }
      case 'landing': {
        const p = landing(e.currentAttack?.kind ?? 'boulder', this.aimOf(e, this.aimTmp), w.k);
        w.at.set(p.x, this.d.world.heightAt(p.x, p.z, p.y + 1), p.z);
        w.yaw = 0;
      }
    }
  }

  /** Shows warning `w` at `fill`, drawing it afresh when it has no slot (new, taken by another warning, or let go in a pause). */
  private showWarning(w: Warning, fill: number): void {
    if (this.fx.driveTelegraph(w.id, fill, w.at, w.yaw)) return;
    this.fx.telegraph(w.id, w.spec.shape, w.at, w.yaw, w.spec.size, 1, w.spec.color, w.spec.half);
    this.fx.driveTelegraph(w.id, fill);
  }

  /** A slot id for a warning that outlives its wind-up (a rolling run of negative ids, clear of the wind-ups' and Starfall's). */
  private nextWarnId(): number {
    return -1000 - (this.warnSeq++ % 64);
  }

  /**
   * A strike `seconds` from now (the roots, the net, the snow, the glare's opening): `fn` lands it, and a `shape` warning
   * `size` across at `at` fills to its edge as it comes, driven by the job's own countdown (`follow` moves it each step;
   * `fn` returning false means it never came: the warning goes out unfilled). It takes the wind-up's warning on from
   * HANDOFF (the wind-up filled it that far).
   */
  private strikeLater(seconds: number, shape: WarnShape, size: number, color: number, at: Vector3, fn: () => boolean | void, follow?: (at: Vector3) => void): void {
    const w: Warning = { id: this.nextWarnId(), k: 0, spec: { shape, anchor: 'mark', size, half: 0, color }, at: at.clone(), yaw: 0 };
    this.showWarning(w, HANDOFF);
    this.delayed.push({
      t: seconds, warn: { w, total: seconds, from: HANDOFF, follow },
      fn: () => {
        if (fn() === false) this.fx.endTelegraph(w.id);
        else this.fx.driveTelegraph(w.id, 1, w.at);
      },
    });
  }

  /**
   * A body's throw lobbed onto `to` (Warnings.landing: a boulder, a log, a cup) under gravity `g`, about `T` seconds in
   * the air, struck by within its SHOT_RADIUS; its landing warning lies on the ground there, filling on from HANDOFF
   * (the wind-up's share) as it falls.
   */
  private throwAt(e: Enemy, kind: BossAttackKind, from: Vector3, to: { x: number; y: number; z: number }, T: number, g: number, mult: number, color: number, size: number, shot: ProjectileKind): void {
    const target = new Vector3(to.x, to.y, to.z);
    const vel = this.lob(from, target, T, g);
    const p = this.spawnProjectile(from, vel, 'enemy', e.def.atk, mult, kind === 'cupmortar' || kind === 'cupvolley' ? 'astral' : 'stone', SHOT_RADIUS[kind] ?? 1, color, 0, 0, 0, 0, size, shot, { gravity: g, by: e.def.kind });
    // (The lob's own time in the air, a roof having flattened it: along the ground at its speed along the ground.)
    const across = Math.hypot(target.x - from.x, target.z - from.z);
    const speed = Math.hypot(vel.x, vel.z);
    p.flight = speed > 1e-3 ? across / speed : T;
    this.warnShot(p, kind, target);
  }

  /** A shot's landing warning at `target` (on the ground under it), filling on from HANDOFF over `p.flight` seconds. */
  private warnShot(p: Projectile, kind: BossAttackKind, target: { x: number; y: number; z: number }): void {
    p.warn = { id: this.nextWarnId(), k: 0, spec: landingWarn(kind), at: new Vector3(target.x, this.d.world.heightAt(target.x, target.z, target.y + 1), target.z), yaw: 0 };
    this.showWarning(p.warn, HANDOFF);
  }

  /** A dead body starts to burn away (Enemy.burnAway): one shock on the ground under it and a spray of sparks, in its element's colour. */
  private dissolveBurst(e: Enemy): void {
    const color = dissolveEdge(e.def.element);
    const sc = e.def.scale ?? 1;
    this.fx.shock(_v.set(e.pos.x, this.feetOf(e), e.pos.z), color, Math.max(2.5, e.radius * 2.5), 0.5);
    this.fx.sparks(_v.set(e.pos.x, e.pos.y + e.def.height * sc * 0.25, e.pos.z), UP, e.def.boss ? 30 : 16, color, e.def.boss ? 6 : 4, 1.0);
  }

  private enemyBolt(e: Enemy, spread: number, speed = 13, mult = 1): void {
    const sc = e.def.scale ?? 1;
    const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.6, e.pos.z);
    const t = this.aimOf(e, this.aimTmp);
    const dir = new Vector3(t.x, t.y + 1, t.z).sub(from).normalize();
    if (spread !== 0) {
      const cs = Math.cos(spread);
      const sn = Math.sin(spread);
      const x = dir.x * cs - dir.z * sn;
      const z = dir.x * sn + dir.z * cs;
      dir.x = x; dir.z = z;
    }
    this.spawnProjectile(from, dir.multiplyScalar(speed), 'enemy', e.def.atk, mult, e.def.element, 0.8, ELEMENT_COLOR[e.def.element], 0, 0, 0, 0, 0.24, 'bolt', { by: e.def.kind });
  }

  /**
   * A boss move (or a mob's, from its move list) lands, aimed at whom the body fights (aimOf: a boss always the hero, a
   * mob maybe a companion). Its reach is the warning's (Warnings): every body inside takes it (strike), the hero and
   * the companions alike; the throws and the delayed strikes leave their landing warnings on the ground.
   */
  private bossAction(e: Enemy, kind: BossAttackKind): void {
    const c = this.d.controller;
    const t = this.aimOf(e, { x: 0, y: 0, z: 0, vx: 0, vz: 0 });
    const at = new Vector3(e.pos.x, e.pos.y, e.pos.z);
    const dist = Math.hypot(e.pos.x - t.x, e.pos.z - t.z);
    const color = ELEMENT_COLOR[e.def.element];
    const sc = e.def.scale ?? 1;
    switch (kind) {
      case 'diamond': {
        // The circling diamond nearest its mark, thrown straight at them, leading a little.
        const from = e.takeGem(t);
        if (!from) { this.enemyBolt(e, 0, 14); break; }
        const to = landing('diamond', t);
        const vel = new Vector3(to.x, to.y, to.z).sub(from).normalize().multiplyScalar(17);
        const gem = this.spawnProjectile(from, vel, 'enemy', e.def.atk, 1.15, e.def.element, SHOT_RADIUS.diamond ?? 0.75, 0xdff2ff, 0, 0, 1.5, 0, 1, 'gem', { by: e.def.kind });
        // Its landing warning fills on as it flies (straight, at 17 m/s) and ends as it strikes.
        gem.flight = from.distanceTo(_g.set(to.x, to.y, to.z)) / 17;
        this.warnShot(gem, 'diamond', to);
        this.d.audio.swing(false);
        break;
      }
      case 'slam': {
        const r = slamRadius(e.def);
        this.fx.shock(at, color, r * 1.6);
        this.fx.dust(at, 3.2);
        this.d.onShake?.(1);
        this.d.audio.stomp();
        // (On the ground only: a hero in the air clears it.)
        this.strike(e, 1.4, (x, z, _y, hero) => Math.hypot(x - e.pos.x, z - e.pos.z) < r && (!hero || c.mode === 'ground'));
        break;
      }
      case 'boulder': {
        // Lobbed on an arc that lands where its mark is heading.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.9, e.pos.z);
        this.throwAt(e, 'boulder', from, landing('boulder', t), Math.max(0.8, Math.min(1.8, 0.6 + dist / 20)), 16, 1.3, 0x8a96c8, 2.2, 'bolt');
        break;
      }
      case 'roar': {
        this.d.audio.roar();
        this.fx.shock(_v.copy(at).add(_w.set(0, e.def.height * sc * 0.6, 0)), color, ROAR_REACH);
        this.d.onShake?.(0.9);
        const inside = (x: number, z: number): boolean => Math.hypot(x - e.pos.x, z - e.pos.z) < ROAR_REACH;
        if (inside(c.pos.x, c.pos.z)) {
          const dx = c.pos.x - e.pos.x;
          const dz = c.pos.z - e.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          c.vel.x += (dx / l) * 14;
          c.vel.z += (dz / l) * 14;
          c.vel.y = Math.max(c.vel.y, 5);
          c.mode = 'air';
        }
        this.strike(e, 0.4, inside);
        break;
      }
      case 'volley':
        for (const sp of [-0.28, 0, 0.28]) this.enemyBolt(e, sp, 15, 0.8);
        this.d.audio.cast();
        break;
      case 'summon': {
        // A few at a time (never a farm): they stand on open ground, drop nothing, and leave with their caster.
        const list = (this.summoned.get(e.id) ?? []).filter((m) => m.alive && this.enemies.includes(m));
        this.summoned.set(e.id, list);
        const kind = e.def.kind === 'rift-king' ? 'styro-ghoul' : 'beast';
        if (list.length >= SUMMON_CAP || !PRESENT_MODELS.has(kind)) { this.d.audio.roar(); break; }
        this.fx.flash(_v.copy(at).add(_w.set(0, 3, 0)), color, 5);
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
        // (A flyer only needs open air: its own height is not the ground's.)
        if (w.blocked?.(bx, bz) || (!e.def.flying && Math.abs(this.d.world.heightAt(bx, bz, e.pos.y + 2) - (e.pos.y - e.def.hover)) > 3)) break;
        this.fx.flash(_v.copy(at).add(_w.set(0, 3, 0)), color, 6);
        e.pos.x = bx;
        e.pos.z = bz;
        // (A blink is a jump through the air: it arrives facing the hero, no turn needed.)
        e.yaw = Math.atan2(c.pos.z - bz, c.pos.x - bx);
        this.fx.flash(_v.set(bx, e.pos.y + 3, bz), color, 6);
        this.d.audio.dodge();
        break;
      }
      case 'roots': {
        // The ground bursts under where its mark stood: the ring warns while the roots come up.
        const tx = t.x;
        const tz = t.z;
        const p = new Vector3(tx, this.d.world.heightAt(tx, tz, t.y + 1), tz);
        this.strikeLater(0.7, 'ring', ROOTS_RADIUS, WARN_COLOR.range, p, () => {
          this.fx.shock(p, color, 5);
          this.fx.dust(p, 2.6);
          this.d.audio.stomp();
          this.strike(e, 1.2, (x, z, _y, hero) => Math.hypot(x - tx, z - tz) < ROOTS_RADIUS && (!hero || c.mode === 'ground'));
        });
        break;
      }
      case 'sweep': {
        const range = coneReach(e.def, 'sweep', e.currentAttack?.range ?? 6);
        this.fx.arc(_v.set(e.pos.x, e.pos.y + e.def.height * sc * 0.4, e.pos.z), e.yaw, 0, range, color, SWEEP_HALF);
        this.d.onShake?.(0.5);
        this.strike(e, 1.1, (x, z) => inCone(e.pos, e.yaw, { x, z }, range, SWEEP_HALF));
        break;
      }
      case 'breath': {
        this.d.audio.roar();
        for (let i = 0; i < 6; i++) this.delayed.push({ t: i * 0.08, fn: () => { if (e.alive) this.enemyBolt(e, (Math.random() - 0.5) * 0.25, 24, 0.35); } });
        // The blast itself reaches as far as the move does, at about its own height.
        const reach = coneReach(e.def, 'breath', e.currentAttack?.range ?? 10);
        this.strike(e, 0.9, (x, z, y) => Math.abs(y - e.pos.y) < 6 && inCone(e.pos, e.yaw, { x, z }, reach, BREATH_HALF));
        break;
      }
      case 'cupmortar':
      case 'cupvolley': {
        // Cups lobbed like mortar shells: one at its mark, or three around them.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 1.05, e.pos.z);
        const T = Math.max(0.8, Math.min(1.6, 0.6 + dist / 18));
        for (let k = 0; k < warnCount(kind); k++) this.throwAt(e, kind, from.clone(), landing(kind, t, k), T, 16, 1, 0xb36bff, 1, 'cup');
        this.d.audio.swing(false);
        this.say(e, e.def.voices?.attack, 0.4);
        break;
      }
      case 'web': {
        // Three webs spat down at its mark from the spinnerets (under the chapel), leading a moving target a little.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.25, e.pos.z);
        for (const sp of [-0.12, 0, 0.12]) {
          const to = new Vector3(t.x + t.vx * 0.6, t.y + 1, t.z + t.vz * 0.6);
          const dir = to.sub(from).normalize();
          const x = dir.x * Math.cos(sp) - dir.z * Math.sin(sp);
          dir.z = dir.x * Math.sin(sp) + dir.z * Math.cos(sp);
          dir.x = x;
          this.spawnProjectile(from.clone(), dir.multiplyScalar(19), 'enemy', e.def.atk, 0.6, e.def.element, 1.3, PALETTE.moon, 0, 0, 0, 0, 1.6, 'web', { web: 1.8, by: e.def.kind });
        }
        this.d.audio.cast();
        break;
      }
      case 'webdrop': {
        // A net let down over where its mark stands: the disc warns, then the web falls; inside it, you are caught.
        const tx = t.x;
        const tz = t.z;
        const ty = this.d.world.heightAt(tx, tz, t.y + 1);
        this.strikeLater(1.0, 'disc', WEBDROP_RADIUS, WARN_COLOR.hold, new Vector3(tx, ty, tz), () => {
          const net = webDisc(4.2, 0.7);
          net.rotation.x = -Math.PI / 2;
          net.position.set(tx, ty + 0.15, tz);
          this.d.scene.add(net);
          this.fx.sparks(_v.set(tx, ty + 0.5, tz), UP, 20, PALETTE.moon, 5, 1.0);
          this.delayed.push({ t: 4, cleanup: true, fn: () => { this.d.scene.remove(net); disposeObject(net); } });
          const inside = (x: number, z: number, y: number): boolean => Math.hypot(x - tx, z - tz) < WEBDROP_RADIUS && y < ty + 3;
          const caught = inside(c.pos.x, c.pos.z, c.pos.y);
          this.strike(e, 0.7, inside);
          if (caught) this.ensnare(2.4);
        });
        this.d.audio.cast();
        break;
      }
      case 'hop': {
        // A leap that lands on you: a bubble bumps into you; the Frog God comes down with a wave of colour.
        this.contact.set(e.id, e.def.body ? 0.6 : 0.95);
        if (!e.def.body) {
          this.delayed.push({ t: 0.85, fn: () => {
            if (!e.alive) return;
            const land = new Vector3(e.pos.x, e.pos.y - e.def.hover, e.pos.z);
            for (const [r, col] of [[9, 0xff5ad6], [6.5, 0x37f5ff], [4, 0x5dff3a]] as const) this.fx.shock(land, col, r);
            this.d.onShake?.(0.8);
            this.d.audio.stomp();
            this.strike(e, 1.2, (x, z, y) => Math.hypot(x - e.pos.x, z - e.pos.z) < 6 && y < land.y + 2.5);
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
            const vy = (this.aimOf(e, this.aimTmp).y + 1 - from.y) / Math.max(0.5, dist / speed);
            for (let i = 0; i < n; i++) {
              const a = (i / n) * Math.PI * 2 + ring * 0.22;
              this.spawnProjectile(from.clone(), new Vector3(Math.cos(a) * speed, vy, Math.sin(a) * speed), 'enemy', e.def.atk, e.summoned ? 0.3 : 0.45, e.def.element, 0.7, 0xff5ad6, 0, 0, 0, 0, 1.1, 'orb', { wobble: 0.25, by: e.def.kind });
            }
          } });
        }
        this.d.audio.cast();
        break;
      }
      case 'eyebeam': {
        // A stare that sweeps across its mark: a stream of orbs from its eyes, swinging from one side to the other.
        const eyes = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.82, e.pos.z);
        const base = Math.atan2(t.z - e.pos.z, t.x - e.pos.x);
        const dir = Math.random() < 0.5 ? 1 : -1;
        for (let i = 0; i < 16; i++) {
          this.delayed.push({ t: i * 0.075, fn: () => {
            if (!e.alive) return;
            const a = base + dir * (-0.75 + (1.5 * i) / 15);
            const speed = 26;
            const vy = (this.aimOf(e, this.aimTmp).y + 1 - eyes.y) / Math.max(0.3, dist / speed);
            this.spawnProjectile(eyes.clone(), new Vector3(Math.cos(a) * speed, vy, Math.sin(a) * speed), 'enemy', e.def.atk, 0.35, e.def.element, 0.6, e.def.beamColor ?? 0x37f5ff, 0, 0, 0, 0, 0.8, 'orb', { rainbow: !e.def.beamColor, by: e.def.kind });
          } });
        }
        this.d.audio.roar();
        break;
      }
      case 'glare': {
        // It gathers a red stare at its eye; whoever is facing it when it opens is held there (look away!). The ring
        // round the hero fills until it opens (it follows them: where they look is what counts, not where they stand).
        const eye = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.5, e.pos.z);
        this.fx.flash(eye, 0xff2a2a, 7);
        this.d.hud.announce('The eye is gathering a glare · look away', { priority: 1 });
        const follow = (p: Vector3): void => { p.set(c.pos.x, this.d.world.heightAt(c.pos.x, c.pos.z, c.pos.y + 1), c.pos.z); };
        const ring = new Vector3();
        follow(ring);
        this.strikeLater(1.1, 'ring', GLARE_RADIUS, WARN_COLOR.hold, ring, () => {
          if (!e.alive) return false;
          const toEye = Math.atan2(e.pos.z - c.pos.z, e.pos.x - c.pos.x);
          const facing = Math.abs(Math.atan2(Math.sin(toEye - c.yaw), Math.cos(toEye - c.yaw))) < (50 * Math.PI) / 180;
          this.fx.shock(eye, 0xff2a2a, 18);
          this.d.audio.roar();
          if (facing && Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 40) { this.damagePlayer(e.def.atk * 0.6, e.def.element, e.def.kind); this.ensnare(1.8); }
        }, follow);
        break;
      }
      case 'thorns': {
        // A ring of red thorns flung out of its spikes, falling toward where its mark stands.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.5, e.pos.z);
        const n = 16;
        const speed = 12;
        const vy = (t.y + 1 - from.y) / Math.max(0.5, dist / speed);
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2;
          this.spawnProjectile(from.clone(), new Vector3(Math.cos(a) * speed, vy, Math.sin(a) * speed), 'enemy', e.def.atk, 0.5, e.def.element, 0.7, 0xff2a2a, 0, 0, 0, 0, 0.9, 'arrow', { by: e.def.kind });
        }
        this.d.audio.cast();
        break;
      }
      case 'rainbow': {
        // Rainbow ribbons that curve in from both sides; one touch and the world swirls.
        const from = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.7, e.pos.z);
        const base = Math.atan2(t.z - e.pos.z, t.x - e.pos.x);
        for (let i = 0; i < 6; i++) {
          this.delayed.push({ t: i * 0.12, fn: () => {
            if (!e.alive) return;
            const a = base + (i % 2 ? 1 : -1) * (0.6 + (i >> 1) * 0.25);
            const v = new Vector3(Math.cos(a) * 11, 1.5, Math.sin(a) * 11);
            const m = this.aimOf(e, this.aimTmp);
            this.spawnProjectile(from.clone(), v, 'enemy', e.def.atk, 0.45, e.def.element, 0.8, 0xff5ad6, 0, 0, 0, 0, 1.0, 'trip', {
              homing: { target: null, point: new Vector3(m.x, m.y + 1, m.z), delay: 0.25, turn: 2.4, age: 0 }, by: e.def.kind,
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
          this.fx.sparks(_v.set(m.pos.x, m.pos.y + 3, m.pos.z), UP, 20, 0xff5ad6, 6, 1.0);
          this.delayed.push({ t: 12, fn: () => { if (this.enemies.includes(m)) { this.fx.sparks(_v.set(m.pos.x, m.pos.y + 3, m.pos.z), UP, 16, 0x37f5ff, 5, 1.0); this.despawn(m); } } });
        }
        this.d.audio.cast();
        break;
      }
      case 'snowstorm': {
        // Digital snow: squares of static fall where its mark stands and around, each warned where it will burst.
        for (const [ox, oz] of SNOW_PATCHES) {
          const tx = t.x + ox;
          const tz = t.z + oz;
          const p = new Vector3(tx, this.d.world.heightAt(tx, tz, t.y + 1), tz);
          this.strikeLater(0.9, 'disc', SNOW_RADIUS, WARN_COLOR.range, p, () => {
            this.fx.sparks(_v.copy(p).add(_w.set(0, 1.5, 0)), UP, 26, 0xdff4ff, 6, 1.0);
            this.fx.shock(p, 0x9ad8ff, 4);
            this.strike(e, 1, (x, z) => Math.hypot(x - tx, z - tz) < SNOW_RADIUS);
          });
        }
        this.d.audio.cast();
        break;
      }
      case 'logthrow': {
        // A log pulled off his back, lobbed over the shoulder to land where its mark is heading.
        const from = new Vector3(e.pos.x - Math.cos(e.yaw) * 0.4, e.pos.y + e.def.height * sc * 0.95, e.pos.z - Math.sin(e.yaw) * 0.4);
        this.throwAt(e, 'logthrow', from, landing('logthrow', t), Math.max(0.7, Math.min(1.7, 0.55 + dist / 22)), 18, 1.3, 0x8a96c8, 1, 'log');
        this.d.audio.swing(true);
        break;
      }
      case 'punch': {
        const range = coneReach(e.def, 'punch', e.currentAttack?.range ?? 4);
        this.fx.arc(_v.set(e.pos.x, e.pos.y + e.def.height * sc * 0.5, e.pos.z), e.yaw, 0, range, color, PUNCH_HALF);
        this.d.onShake?.(0.6);
        this.d.audio.stomp();
        const inside = (x: number, z: number): boolean => inCone(e.pos, e.yaw, { x, z }, range, PUNCH_HALF);
        const hit = inside(c.pos.x, c.pos.z);
        this.strike(e, 1.1, inside);
        if (hit) {
          // Knocked flying.
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
        // The hero is lifted and thrown (the hold below); a companion in its hands only takes the squeeze.
        const range = coneReach(e.def, 'grab', e.currentAttack?.range ?? 3.4);
        const inside = (x: number, z: number): boolean => inCone(e.pos, e.yaw, { x, z }, range, GRAB_HALF);
        if (!this.grab && !this.downed && inside(c.pos.x, c.pos.z)) {
          this.grab = { e, t: 0 };
          this.damagePlayer(e.def.atk * 0.4, e.def.element, e.def.kind);
          this.d.hud.announce('Grabbed!', { priority: 1 });
        }
        for (const a of this.allies) if (a.hp > 0 && inside(a.pos.x, a.pos.z)) this.hurtAlly(a, e.def.atk * 0.4);
        break;
      }
      case 'charge':
      case 'bite':
        this.contact.set(e.id, kind === 'charge' ? 0.9 : 0.4);
        if (kind === 'bite') this.fx.arc(_v.set(e.pos.x, e.pos.y + 1, e.pos.z), e.yaw, 0, e.def.bodyRadius * sc + 2, color, 0.8);
        break;
    }
  }

  private nearestEnemy(x: number, z: number, range: number, exclude?: ReadonlySet<number>): Enemy | null {
    let best: Enemy | null = null;
    let bestD = range;
    for (const e of this.enemies) {
      if (!e.alive || exclude?.has(e.id)) continue;
      const dd = Math.hypot(e.pos.x - x, e.pos.z - z);
      if (dd < bestD) { bestD = dd; best = e; }
    }
    return best;
  }

  /**
   * Who a shot or a spell goes for: the locked-on enemy while it is within `range` of (x, z), else the nearest living
   * enemy within it (none in `exclude`).
   */
  private markFor(range: number, x = this.d.controller.pos.x, z = this.d.controller.pos.z, exclude?: ReadonlySet<number>): Enemy | null {
    const lt = this.lockTarget;
    if (lt?.alive && !exclude?.has(lt.id) && Math.hypot(lt.pos.x - x, lt.pos.z - z) <= range) return lt;
    return this.nearestEnemy(x, z, range, exclude);
  }

  /**
   * A move lands, on the clip's blow. `phase` is which move: a light hit's index, the heavy or the skill (the swing's
   * crescent leans with it); `ground` is the skill's burning ground, laid by the crescent along its path.
   */
  private resolveAttack(me: CharacterDef, def: AttackDef, phase: number | 'heavy' | 'skill', ground?: GroundEffectDef): void {
    const c = this.d.controller;
    const element: Element | null = def.element === 'own' ? this.elementOf(me) : null;
    const atk = this.atkOf(me);
    const shape = def.shape;
    switch (shape.kind) {
      case 'bolt': this.shoot(me, def, shape, phase); return;
      case 'crescent': this.cleave(me, def, shape, ground); return;
      case 'volley': this.moonVolley(me, def, shape); return;
      case 'starfall': this.starfall(me, def, shape); return;
      default: break;
    }
    if (shape.kind === 'cone') {
      // The swing's crescent at the blow, in the swing's plane: the light hits tilted one way then the other, the
      // heavy's chop leaning down across, the skill flat; as wide and as long as the cut's reach.
      const pitch = phase === 'heavy' ? -0.6 : phase === 'skill' ? 0 : phase % 2 === 0 ? 0.35 : -0.35;
      const color = element ? ELEMENT_COLOR[element] : PALETTE.cloth;
      this.fx.arc(_v.set(c.pos.x, c.pos.y + 1.2, c.pos.z), c.yaw, pitch, shape.range, color, shape.halfAngle);
    }
    const origin = { x: c.pos.x, z: c.pos.z };
    const reach = shape.kind === 'cone' ? shape.range : shape.radius;
    const heavy = phase === 'heavy' || def.hitStop >= 0.08;
    for (const e of this.enemies.slice()) {
      if (!e.alive) continue;
      const sc = e.def.scale ?? 1;
      // A swing from the air reaches only what is about level with it.
      if (c.pos.y + 1 < e.pos.y - reach * 0.6 || c.pos.y + 1 > e.pos.y + e.def.height * sc + reach * 0.6) continue;
      const t = { x: e.pos.x, z: e.pos.z };
      const ok = shape.kind === 'cone'
        ? inCone(origin, c.yaw, t, shape.range + e.def.bodyRadius * sc, shape.halfAngle)
        : inRadius(origin, t, shape.radius + e.def.bodyRadius * sc);
      if (ok) this.hitEnemy(e, atk, def.mult, element, def.knockback, def.hitStop, { heavy });
    }
  }

  /**
   * A bolt or an arrow off the staff's knob or the bow hand, at the locked-on enemy or the nearest in range (else a sky
   * eye ahead, else straight on). Wren's arrows draw one of the two arrow ribbons; Orlan's bolt is a star with a short
   * ribbon of its own.
   */
  private shoot(me: CharacterDef, def: AttackDef, shape: Extract<HitShape, { kind: 'bolt' }>, phase: number | 'heavy' | 'skill'): void {
    const c = this.d.controller;
    const element: Element | null = def.element === 'own' ? this.elementOf(me) : null;
    const atk = this.atkOf(me);
    const color = ELEMENT_COLOR[this.elementOf(me)];
    const target = this.markFor(shape.range);
    const from = this.d.muzzle?.(me) ?? new Vector3(c.pos.x + Math.cos(c.yaw) * 0.6, c.pos.y + 1.3, c.pos.z + Math.sin(c.yaw) * 0.6);
    const aimY = target ? target.pos.y + Math.min(0.5, target.def.height * (target.def.scale ?? 1) * 0.45) + (target.def.flying ? target.def.height * (target.def.scale ?? 1) * 0.3 : 0) : 0;
    const dir = target
      ? new Vector3(target.pos.x - from.x, aimY - from.y, target.pos.z - from.z).normalize()
      : new Vector3(Math.cos(c.yaw), 0.05, Math.sin(c.yaw));
    const arrow = me.weapon === 'bow';
    const heavy = phase === 'heavy';
    this.sfx.swing(arrow ? 'bow' : 'staff', heavy);
    const look = arrow ? { trail: this.nextArrowTrail(), trailW: 0.05 } : { trail: 'bolt', trailW: heavy ? 0.14 : 0.09 };
    const kind: ProjectileKind = arrow ? 'arrow' : 'star';
    const size = arrow ? 0.24 : heavy ? 1.25 : 0.85;
    if (arrow && c.mode === 'fly') {
      // Off the bow she rides: the arrow drops out under her, then finds its way (down, across, or back up).
      // (No enemy in range: a sky eye ahead is the mark, else the ground ahead.)
      const sky = target ? null : this.aimTarget(from, c.yaw);
      const ahead = target ? null : sky ? sky.pos.clone() : new Vector3(c.pos.x + Math.cos(c.yaw) * 22, 0, c.pos.z + Math.sin(c.yaw) * 22);
      if (ahead && !sky) ahead.y = this.d.world.heightAt(ahead.x, ahead.z, c.pos.y);
      const down = new Vector3(Math.cos(c.yaw) * 0.35, -1, Math.sin(c.yaw) * 0.35).normalize().multiplyScalar(18);
      const shot = this.spawnProjectile(from, down, 'player', atk, def.mult, element, 1.0, color, shape.chains, shape.chainRange, def.knockback, def.hitStop, size, kind, {
        homing: { target, point: ahead, delay: 0.07, turn: 9, age: 0 }, ...look,
      });
      if (sky) shot.life = Math.max(shot.life, sky.pos.distanceTo(from) / 18 + 1);
      return;
    }
    // Nothing to fight in range: a shot fired while facing a sky eye flies at it.
    const sky = target ? null : this.aimTarget(from, c.yaw);
    if (sky) dir.copy(sky.pos).sub(from).normalize();
    const speed = arrow ? 26 : 22;
    const shot = this.spawnProjectile(from, dir.multiplyScalar(speed), 'player', atk, def.mult, element, 1.0, color, shape.chains, shape.chainRange, def.knockback, def.hitStop, size, kind, look);
    if (sky) shot.life = Math.max(shot.life, sky.pos.distanceTo(from) / speed + 0.4);
    this.fx.flash(from, _col.set(color).multiplyScalar(0.7), heavy ? 1.6 : 0.9);
  }

  /**
   * Crimson Cleave: a blood crescent sent along the ground from the blade, CrescentShape.range metres at its speed,
   * cutting every mob it passes (once each) and laying the skill's burning ground along its path.
   */
  private cleave(me: CharacterDef, def: AttackDef, shape: CrescentShape, ground?: GroundEffectDef): void {
    const c = this.d.controller;
    const fx = Math.cos(c.yaw);
    const fz = Math.sin(c.yaw);
    const sx = c.pos.x + fx * 0.8;
    const sz = c.pos.z + fz * 0.8;
    const from = new Vector3(sx, this.d.world.heightAt(sx, sz, c.pos.y + 1) + CRESCENT_BASE, sz);
    const own = this.elementOf(me);
    const color = ELEMENT_COLOR[own];
    const atk = this.atkOf(me);
    const burn: BurnPath | null = ground ? { def: { ...ground, element: own }, atk, every: shape.burnEvery, next: shape.burnEvery / 2, group: { last: new Map(), lay: null } } : null;
    this.spawnProjectile(from, new Vector3(fx, 0, fz).multiplyScalar(shape.speed), 'player', atk, def.mult, def.element === 'own' ? own : null, shape.halfWidth, color, 0, 0, def.knockback, def.hitStop, 1, 'crescent', {
      pierce: true, ground: CRESCENT_BASE, life: shape.range / shape.speed, burn,
    });
    this.fx.flash(_v.set(sx, from.y + 0.9, sz), _col.set(color).multiplyScalar(0.8), 2.4);
    this.fx.dust(from, 1.6);
  }

  /**
   * Moon Volley: VolleyShape.arrows arrows fanned ±fan either side of her aim, each turning after a mark a moment
   * later (the locked-on enemy first, then the nearest, shared round the fan); with nothing to hunt, at a sky eye
   * ahead or down onto the ground along each one's own line. Each chains once: from the body it strikes on to the
   * nearest other within chainRange, chasing that one (Homing.chainTo). The two outermost draw the arrow ribbons (none
   * while the trip volley's fly). The volley charges the burst per body it strikes, not per arrow: 18 at most, what the
   * single chaining bolt Moon Volley was charged (Combat.CastCharge), where twelve hits at a blow's worth each were 72.
   */
  private moonVolley(me: CharacterDef, def: AttackDef, shape: VolleyShape): void {
    const c = this.d.controller;
    const from = this.d.muzzle?.(me) ?? new Vector3(c.pos.x + Math.cos(c.yaw) * 0.6, c.pos.y + 1.3, c.pos.z + Math.sin(c.yaw) * 0.6);
    const element: Element | null = def.element === 'own' ? this.elementOf(me) : null;
    const color = ELEMENT_COLOR[this.elementOf(me)];
    const atk = this.atkOf(me);
    const marks: Enemy[] = [];
    const seen = new Set<number>();
    for (let k = 0; k < 3; k++) {
      const m = this.markFor(shape.range, c.pos.x, c.pos.z, seen);
      if (!m) break;
      marks.push(m);
      seen.add(m.id);
    }
    const sky = marks.length ? null : this.aimTarget(from, c.yaw);
    // (No ribbons while the trip volley's fly: see nextArrowTrail.)
    const ribbons = !this.tripRibbonsFlying();
    const cast = new CastCharge();
    for (let i = 0; i < shape.arrows; i++) {
      const k = shape.arrows > 1 ? (i / (shape.arrows - 1)) * 2 - 1 : 0;
      const a = c.yaw + k * shape.fan;
      const target = marks.length ? marks[i % marks.length] : null;
      let point: Vector3 | null = null;
      if (!target) {
        const px = c.pos.x + Math.cos(a) * 16;
        const pz = c.pos.z + Math.sin(a) * 16;
        point = sky ? sky.pos.clone() : new Vector3(px, this.d.world.heightAt(px, pz, c.pos.y + 2), pz);
      }
      const vel = new Vector3(Math.cos(a), 0.12, Math.sin(a)).normalize().multiplyScalar(24);
      const trail = !ribbons ? undefined : i === 0 ? 'arrow0' : i === shape.arrows - 1 ? 'arrow1' : undefined;
      // (A lighter hit-stop each: six freezes in a row would stutter the volley.)
      this.spawnProjectile(from.clone(), vel, 'player', atk, def.mult, element, 1.0, color, shape.chains, shape.chainRange, def.knockback, def.hitStop * 0.4, 0.24, 'arrow', {
        homing: { target, point, delay: 0.12, turn: 5, age: 0 }, trail, trailW: 0.05, cast,
      });
    }
    this.sfx.swing('bow', true);
    this.fx.flash(from, _col.set(color).multiplyScalar(0.7), 1.5);
  }

  /**
   * Starfall: StarfallShape.stars stars dropped from `height` over the target area (the mark within `range`, else
   * half that ahead), the first on the mark and the rest round it within `spread`, one every 0.12 s. The stars charge
   * the burst per body they strike, not per star: 18 at most, what the single chaining bolt Starfall was charged
   * (Combat.CastCharge).
   */
  private starfall(me: CharacterDef, def: AttackDef, shape: StarfallShape): void {
    const c = this.d.controller;
    const mark = this.markFor(shape.range);
    const cx = mark ? mark.pos.x : c.pos.x + Math.cos(c.yaw) * shape.range * 0.5;
    const cz = mark ? mark.pos.z : c.pos.z + Math.sin(c.yaw) * shape.range * 0.5;
    const cy = mark ? mark.pos.y : c.pos.y;
    const element: Element | null = def.element === 'own' ? this.elementOf(me) : null;
    const color = ELEMENT_COLOR[this.elementOf(me)];
    const atk = this.atkOf(me);
    const turn = Math.random() * Math.PI * 2;
    const cast = new CastCharge();
    for (let i = 0; i < shape.stars; i++) {
      const a = turn + ((i - 1) / Math.max(1, shape.stars - 1)) * Math.PI * 2;
      const r = i === 0 ? 0 : shape.spread * (0.55 + 0.45 * Math.random());
      const tx = cx + Math.cos(a) * r;
      const tz = cz + Math.sin(a) * r;
      this.delayed.push({ t: i * 0.12, fn: () => this.dropStar(atk, def, element, color, shape, tx, cy, tz, i, cast) });
    }
    // Motes rising off the staff: the stars going up.
    if (this.d.weaponTips?.(_g, _t)) this.fx.sparks(_t, UP, 10, color, 9, 0.25);
  }

  /** One of Starfall's stars, from up high (under any roof) at (tx, tz), falling under gravity; its disc shows 0.5 s before it lands. */
  private dropStar(atk: number, def: AttackDef, element: Element | null, color: number, shape: StarfallShape, tx: number, ty: number, tz: number, i: number, cast: CastCharge): void {
    const w = this.d.world as Partial<HeightWorld> & WorldQuery;
    const gy = this.d.world.heightAt(tx, tz, ty + 2);
    const roof = w.ceilingAt?.(tx, tz, gy) ?? Infinity;
    const h = Math.max(1, Math.min(shape.height, roof - 0.6 - gy));
    const v0 = 4;
    const g = 28;
    const fall = (-v0 + Math.sqrt(v0 * v0 + 2 * g * h)) / g;
    this.spawnProjectile(new Vector3(tx, gy + h, tz), new Vector3(0, -v0, 0), 'player', atk, def.mult, element, 0.6, color, 0, 0, def.knockback, def.hitStop, 1.5, 'star', {
      gravity: g, aoe: shape.radius, trail: `star${this.starTrails++ % 2}`, trailW: 0.16, life: fall + 0.6, cast,
    });
    const warn = () => this.fx.telegraph(-100 - i, 'disc', _v.set(tx, gy, tz), 0, shape.radius, 0.5, color);
    if (fall > 0.5) this.delayed.push({ t: fall - 0.5, fn: warn });
    else warn();
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

  /**
   * A blow lands on `e`: the element and any reaction, the crit roll (the hero's own blows: 10 % plus the charm's and
   * the weapon's bonus, ×1.6), the knockback; a flash, sparks flying off along the blow and the number over the
   * target; the kick, the fov punch for a heavy or a crit, the sound of what it lands on, the combo count.
   */
  private hitEnemy(e: Enemy, atk: number, mult: number, element: Element | null, knockback: number, hitStop: number, o: HitOpts = {}): void {
    const c = this.d.controller;
    const dot = o.dot ?? false;
    const own = !dot && !o.companion;
    const heavy = !dot && (o.heavy ?? hitStop >= 0.08);
    const { aura, reaction } = applyElement(e.aura, element);
    e.aura = aura;
    const { amount: dmg, crit } = rollHit(
      { atk: atk * this.d.inventory.damageMult(), multiplier: mult, defense: e.def.def - e.defDown.amount, reaction },
      own ? CRIT_CHANCE + this.d.inventory.critBonus(this.active.id) : 0,
      this.rnd,
    );
    const kdx = e.pos.x - c.pos.x;
    const kdz = e.pos.z - c.pos.z;
    const kl = Math.hypot(kdx, kdz) || 1;
    const kb = { x: kdx / kl, z: kdz / kl };
    const bossKb = e.def.boss ? 0.15 : 1;
    const died = e.takeDamage(dmg, kb, (knockback + (reaction ? REACTIONS[reaction].knockback : 0)) * bossKb);
    const sc = e.def.scale ?? 1;
    const at = new Vector3(e.pos.x, e.pos.y + e.def.height * sc * 0.5, e.pos.z);
    // Where it struck: a shot's head, else the body's side facing the hero at about the swing's height (a giant is hit
    // on the shin, not twelve metres up).
    const hitAt = o.at
      ? o.at.clone()
      : new Vector3(e.pos.x - kb.x * e.def.bodyRadius * sc * 0.7, Math.min(at.y, Math.max(e.pos.y + 0.4, c.pos.y + 1.2)), e.pos.z - kb.z * e.def.bodyRadius * sc * 0.7);
    const color = element ? ELEMENT_COLOR[element] : PALETTE.cloth;
    if (dot) {
      this.fx.flash(hitAt, _col.set(color).multiplyScalar(0.6), 0.9);
      this.fx.sparks(hitAt, UP, 3, color, 3, 0.8);
    } else {
      // Bigger, denser and faster with the damage: a flash up to 2.5 m, 10-24 sparks at 6-10 m/s off along the blow.
      // (One flash per body a step, a little under the element's full colour: the bloom makes the glow, and the
      // body's own hit blink is white already; a crit's leans to the moon.)
      const weight = Math.min(1, dmg / 350);
      if (!this.flashed.has(e.id)) {
        this.flashed.add(e.id);
        _col.set(color).lerp(MOON, crit ? 0.5 : 0).multiplyScalar(crit ? 0.85 : 0.7);
        this.fx.flash(hitAt, _col, (0.9 + Math.min(1.6, dmg / 220)) * (crit ? 1.2 : 1));
      }
      this.fx.sparks(hitAt, _w.set(kb.x, 0.35, kb.z), Math.round(10 + 14 * weight), color, 6 + 4 * weight, 0.55);
      if (crit) this.fx.sparks(hitAt, UP, 8, PALETTE.moon, 5, 1.0);
      if (heavy) this.fx.shock(_v.set(e.pos.x, e.pos.y, e.pos.z), color, 2.5 + 2 * weight);
    }
    this.showNumber(_v.copy(hitAt).add(_w.set(0, 0.5, 0)), dmg, crit ? PALETTE.moon : color, false, e.id, crit);
    // (A piercing shot freezes the fight on the first body it cuts; on each after, the blow and any reaction there only
    // catch it: Combat.pierceStop. Not a piercing shot, 0: the full stop.)
    const nth = o.pierced ?? 0;
    this.d.game.hitStop = Math.max(this.d.game.hitStop, pierceStop(hitStop, nth));
    if (own) {
      this.kick(e.pos.x, e.pos.z, crit ? 0.5 : 0.08 + (heavy ? 0.12 : 0));
      if (heavy || crit) this.feel.punch = true;
      if (heavy) this.feel.boom = true;
      this.streak.hit();
    }
    this.sfx.hit(hitMaterial(e.def.kind), heavy, element !== null);
    if (crit) {
      this.feel.crit = true;
      this.d.events?.emit({ kind: 'feat', what: 'crit', at: { x: hitAt.x, y: hitAt.y, z: hitAt.z } });
    }
    // The burst: a blow's worth a hit, or through a many-shot cast, once a body (o.cast).
    if (o.energy ?? true) this.burstEnergy = Math.min(BURST_MAX, this.burstEnergy + (o.cast ? o.cast.take(e.id) : HIT_ENERGY));
    if (reaction) { this.applyReaction(e, reaction, dmg, at, pierceStop(REACTION_STOP, nth)); this.d.audio.reaction(); }
    if (died) this.onEnemyDeath(e, at);
  }

  private onEnemyDeath(e: Enemy, at: Vector3): void {
    this.fx.sparks(at, UP, 24, PALETTE.moon, 7, 1.1);
    this.fx.shock(_v.set(e.pos.x, e.pos.y, e.pos.z), ELEMENT_COLOR[e.def.element], e.def.boss ? 14 : 5);
    this.d.hud.removeEnemyBar(e.id);
    this.d.audio.kill(!!e.def.boss);
    this.d.onKill?.(e.def.kind);
    this.d.events?.emit({ kind: 'kill', enemy: e.def.kind, boss: !!e.def.boss, at: { x: at.x, y: at.y, z: at.z } });
    this.voiceClock = 0;
    this.say(e, e.def.voices?.death);
    this.burstEnergy = Math.min(BURST_MAX, this.burstEnergy + 18);
    // Summoned mobs drop nothing (they would be an endless farm).
    if (!e.summoned) {
      // A flyer killed over a drop (the Blood Eye over the chasm) leaves its loot where the hero can reach it.
      const gy = this.d.world.heightAt(e.pos.x, e.pos.z, e.pos.y + 1);
      const c = this.d.controller;
      const at = gy < e.pos.y - 25 ? new Vector3(c.pos.x, c.pos.y + 1, c.pos.z) : new Vector3(e.pos.x, gy + 1, e.pos.z);
      this.loot.spawn(rollDrops(e.def.drops, e.def.shards), at);
    }
    if (e.def.boss) {
      this.d.hud.announce(`${e.def.name} falls`);
      this.d.onShake?.(1);
      this.feel.pulse = Math.max(this.feel.pulse, 0.35);
      this.feel.punch = true;
    }
    // Its summons go with it.
    const called = this.summoned.get(e.id);
    if (called) {
      for (const m of called) if (m.alive && this.enemies.includes(m)) { this.fx.sparks(_v.set(m.pos.x, m.pos.y + 1, m.pos.z), UP, 12, ELEMENT_COLOR[m.def.element], 4, 1.0); this.despawn(m); }
      this.summoned.delete(e.id);
    }
  }

  /** A reaction on `target`: its ring, flash and name, its splash, and a freeze of the fight for `stop` seconds. */
  private applyReaction(target: Enemy, id: ReactionId, dmg: number, at: Vector3, stop: number): void {
    const r = REACTIONS[id];
    this.fx.shock(_v.set(target.pos.x, target.pos.y, target.pos.z), r.color, Math.max(3, r.aoeRadius * 2));
    this.fx.flash(at, r.color, 2.6);
    this.feel.pulse = Math.max(this.feel.pulse, 0.35);
    this.showNumber(at.clone().add(new Vector3(0, 0.6, 0)), r.name, r.color, true);
    this.d.game.hitStop = Math.max(this.d.game.hitStop, stop);
    if (id === 'conduit') target.defDown = { amount: r.defDown, left: r.defDownDuration };
    if (r.aoeRadius > 0) {
      for (const e of this.enemies.slice()) {
        if (!e.alive || e === target) continue;
        if (inRadius({ x: target.pos.x, z: target.pos.z }, { x: e.pos.x, z: e.pos.z }, r.aoeRadius + e.def.bodyRadius)) {
          const dx = e.pos.x - target.pos.x;
          const dz = e.pos.z - target.pos.z;
          const l = Math.hypot(dx, dz) || 1;
          const splash = Math.max(1, Math.round(dmg * 0.5));
          const died = e.takeDamage(splash, { x: dx / l, z: dz / l }, e.def.boss ? 0 : r.knockback);
          const p = new Vector3(e.pos.x, e.pos.y + e.def.height * 0.5, e.pos.z);
          this.fx.flash(p, r.color, 1.4);
          this.fx.sparks(p, _w.set(dx / l, 0.4, dz / l), 8, r.color, 6);
          this.showNumber(p, splash, r.color, false, e.id);
          if (died) this.onEnemyDeath(e, p);
        }
      }
    }
  }

  /**
   * A patch of lingering ground (`def`) at `at` (default 2 m in front of the hero), one of `group`'s when given: a lone
   * patch is a zone's ring and disc; a group's patches are drawn as one strip (one plane, not two a patch).
   */
  private addZone(def: GroundEffectDef, atk: number, at: Vector3 = this.ahead(2), group: ZoneGroup | null = null): void {
    const pos = at.clone();
    let remove = NOOP;
    if (group) {
      group.lay ??= this.vfx.path(ELEMENT_COLOR[def.element], def.radius, def.duration);
      group.lay(pos);
    } else remove = this.vfx.zone(pos, def.radius, ELEMENT_COLOR[def.element], def.duration);
    this.zones.push({ pos, def, left: def.duration, tick: 0.05, atk, remove, group });
  }

  private spawnProjectile(
    from: Vector3, vel: Vector3, owner: 'player' | 'enemy', atk: number, mult: number, element: Element | null, radius: number, color: number,
    chains: number, chainRange: number, knockback: number, hitStop: number, size = 0.24, kind: ProjectileKind = 'bolt',
    extra: {
      gravity?: number; poison?: { dps: number; seconds: number }; homing?: Projectile['homing']; wobble?: number; onHit?: (e: Enemy) => void;
      web?: number; rainbow?: boolean; by?: string;
      /** Seconds it flies (default: 4 for logs, trip arrows and homing shots, else 2.5). */
      life?: number; trail?: string; trailW?: number; pierce?: boolean; aoe?: number; ground?: number; burn?: BurnPath | null;
      /** One of the trip volley's three brightest arrows (bigger, stronger glows). */
      bright?: boolean;
      /** The burst charge of the cast it is a shot of (Combat.CastCharge). */
      cast?: CastCharge;
    } = {},
  ): Projectile {
    const object = new Group();
    const rainbow: Projectile['rainbow'] = [];
    let fade: Projectile['fade'] = null;
    let twinkle: Projectile['twinkle'] = null;
    if (kind === 'crescent') {
      // Sir Aldric's blood crescent (render/ShotFx.ts), riding the ground, its middle leaning forward like a wave.
      const shot = crescentShot(color);
      object.add(shot.object);
      fade = shot.fade;
      object.position.copy(from);
      object.lookAt(aim.copy(from).add(vel));
    } else if (kind === 'star') {
      // Orlan's star: a four-pointed star sprite, a hot core and a halo, `size` metres across its points.
      const shot = starShot(color, size);
      object.add(shot.object);
      twinkle = shot.star;
      object.position.copy(from);
    } else if (kind === 'log') {
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
    } else if (kind === 'gem') {
      // One of Old Hollowstaff's diamonds, spinning as it flies, with its glint.
      if (thrownGem) {
        const rig = new ModelRig('gem', thrownGem, { cloneMaterials: true });
        for (const m of rig.materials) { m.color.set(0xe9f2ff); m.emissive.set(0x8aa8ff); m.emissiveIntensity = 0.7; }
        rig.root.scale.setScalar(0.7 * size);
        object.add(rig.root);
      }
      object.add(glowSprite(0xdff2ff, 1.2 * size, 0.6, true));
      object.position.copy(from);
    } else if (kind === 'orb') {
      // A tripping orb: a bright core and a halo, both running through every colour.
      const core = glowSprite(color, 0.7 * size, 0.95, true);
      const halo = glowSprite(color, 1.6 * size, 0.45, true);
      object.add(core, halo);
      if (extra.rainbow !== false) rainbow.push(core.material, halo.material);
      object.position.copy(from);
    } else if (kind === 'web') {
      // A spun web flying face-on: spokes and rings of pale silk, turning as it comes.
      object.add(webDisc(1.1 * size, 0.85));
      object.add(glowSprite(PALETTE.moon, 1.4 * size, 0.25, true));
      object.position.copy(from);
    } else if (kind === 'trip') {
      // A tripping arrow: a glowing shaft and head that run through every colour, with a rainbow trail (a third larger
      // and stronger on the volley's three brightest).
      const glow = extra.bright ? 1.3 : 1;
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
        const t = glowSprite(color, (0.75 - k * 0.09) * glow, Math.min(1, (0.8 - k * 0.1) * glow), true);
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
    const p: Projectile = {
      pos: from.clone(), vel, life: extra.life ?? (kind === 'log' || kind === 'trip' || extra.homing ? 4 : 2.5), owner, atk, mult, element, radius, object, chains, chainRange,
      hit: new Set(), knockback, hitStop, kind, gravity: extra.gravity ?? 0, poison: extra.poison ?? null, color,
      homing: extra.homing ?? null, wobble: extra.wobble ?? 0, onHit: extra.onHit ?? null, rainbow, seed: Math.random() * 10, web: extra.web ?? 0, by: extra.by ?? null,
      age: 0, from: from.clone(), trail: extra.trail ?? null, trailW: extra.trailW ?? 0.06, pierce: extra.pierce ?? false, aoe: extra.aoe ?? 0,
      ground: extra.ground ?? 0, burn: extra.burn ?? null, fade, twinkle, cast: extra.cast ?? null, warn: null, flight: 0,
    };
    this.projectiles.push(p);
    // A ribbon id is one shot's at a time: the shot that had it lets go (its ribbon fades) and this one starts afresh.
    // An id not drawn yet starts only while fewer than SHOT_RIBBONS shots draw one (a switch from Wren's volley to
    // Orlan's bolt and stars would make six ids for four slots): past that, the shot flies without.
    if (p.trail) {
      const prev = this.trailOwners.get(p.trail);
      if (prev) this.releaseTrail(prev);
      else if (this.trailOwners.size >= SHOT_RIBBONS) p.trail = null;
      if (p.trail) this.trailOwners.set(p.trail, p);
    }
    return p;
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

  /** Skeletons risen in the Alley of Graves (alive or a heap), and the time to the next. */
  private readonly risen: Enemy[] = [];
  private riseIn = 3;

  /**
   * The Alley of Graves keeps its dead restless: while you walk it, every 6-10 s a skeleton climbs out of the ground at
   * the foot of the graves near you (up to six standing at once), in a spray of earth and a green glow. Heaps are
   * cleared away; leaving the alley lays the rest back down.
   */
  private updateGraveRising(dt: number): void {
    const c = this.d.controller;
    const R = GRAVEYARD;
    const inAlley = Math.abs(c.pos.x - R.x) < 25 && c.pos.z < R.z + 82 && c.pos.z > R.z - 44;
    for (let i = this.risen.length - 1; i >= 0; i--) {
      const e = this.risen[i];
      // (A heap lies its while, then burns away: gone once it has.)
      if (!this.enemies.includes(e)) this.risen.splice(i, 1);
      else if ((!e.alive && !e.object.visible) || !inAlley) { this.despawn(e); this.risen.splice(i, 1); }
    }
    if (!inAlley) { this.riseIn = 3; return; }
    this.riseIn -= dt;
    if (this.riseIn > 0 || this.risen.filter((e) => e.alive).length >= 6) return;
    this.riseIn = 6 + Math.random() * 4;
    // Ahead of you more often than behind, at the foot of the graves' wall on either side of the alley.
    const side = Math.random() < 0.5 ? -1 : 1;
    const z = Math.max(R.z - 40, Math.min(R.z + 78, c.pos.z + (Math.random() < 0.7 ? -1 : 1) * (7 + Math.random() * 9)));
    const x = R.x + side * 2.3;
    const e = this.spawnEnemy(ENEMY_DEFS['grave-skeleton'], x, z, true, { yaw: side > 0 ? Math.PI : 0 });
    // (Risen to hunt you down the whole alley.)
    e.brain.p.aggroRange = 30;
    e.riseFromGrave(2.2);
    const at = new Vector3(x, R.y + 0.15, z);
    this.fx.dust(at, 2.2);
    this.fx.dust(at, 1.2);
    this.fx.flash(at.clone().setY(R.y + 0.6), PALETTE.witch, 2.4);
    this.risen.push(e);
  }

  /** New Game+: mobs have this much more life, and every blow they land is this much harder. */
  plus = 1;

  /** A mimic chest stands up. */
  wake(kind: string, x: number, z: number): void {
    const def = ENEMY_DEFS[kind as EnemyKind];
    if (def) this.spawnEnemy(def, x, z, true);
  }

  /** After the ending: the same world, meaner. */
  beginPlus(): void {
    this.plus = 1.5;
    for (const e of this.enemies) {
      e.hpScale = this.plus;
      if (e.alive) e.hp = Math.max(e.hp, e.def.maxHp * this.plus);
    }
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
    this.tokens.give(e);
    const warned = this.windups.get(e.id);
    if (warned) { for (const w of warned) this.fx.endTelegraph(w.id); this.windups.delete(e.id); }
    if (this.grab?.e === e) this.grab = null;
    if (this.lockTarget === e) this.lockTarget = null;
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
    this.d.hud.announce('Webbed!', { priority: 1 });
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
    void this.d.audio.voice(voiceUrl(lines[Math.floor(Math.random() * lines.length)]), Math.max(0.25, 1 - d / 30), 'mob');
  }

  /** A puddle of lean: a burst cup's slows the hero who stands in it; one off the lean cyclone (`hero`) slows the mobs instead. */
  private spawnPuddle(at: Vector3, owner: 'hero' | 'enemy' = 'enemy'): void {
    const y = this.d.world.heightAt(at.x, at.z, at.y + 1) + 0.04;
    const mesh = new Mesh(new CircleGeometry(2.4, 24), new MeshBasicMaterial({ color: 0x8a2be2, transparent: true, opacity: 0.75, depthWrite: false, toneMapped: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(at.x, y, at.z);
    // (A burst cup's puddle glows; the cyclone's trail goes without, a halo a puddle being as many planes again.)
    if (owner !== 'hero') mesh.add(glowSprite(LEAN_PURPLE, 3.2, 0.35, true));
    this.d.scene.add(mesh);
    this.puddles.push({ pos: new Vector3(at.x, y, at.z), r: 2.4, left: 6, mesh, hero: owner === 'hero' });
    this.fx.sparks(_v.set(at.x, y + 0.3, at.z), UP, 14, LEAN_PURPLE, 4, 1.0);
  }

  /** Poison: damage every half second for a while (refreshed, never stacked). */
  poisonPlayer(dps: number, seconds: number): void {
    if (this.downed) return; // (a fallen hero passes no poison on to the next)
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

  private damagePlayer(atk: number, _element: Element | null, by = 'hazard'): void {
    if (this.iframes > 0 || this.downed) return;
    atk *= this.plus;
    const me = this.active;
    const dmg = computeDamage({ atk, multiplier: 1, defense: PLAYER_DEF });
    const hp = Math.max(0, this.hp.get(me.id)! - dmg);
    this.hp.set(me.id, hp);
    this.iframes = IFRAMES;
    // The body reacts: a flinch, or the whole reaction for a big one.
    this.hurt = { t: 0, big: dmg >= this.maxOf(me) * BIG_HIT };
    const at = this.playerPos().clone().add(new Vector3(0, 1.9, 0));
    this.showNumber(at, dmg, PALETTE.blood, false);
    this.fx.flash(at, PALETTE.blood, 1.6);
    this.d.hud.flashDamage();
    this.d.audio.hurt();
    this.d.onShake?.(0.4);
    this.d.events?.emit({ kind: 'hurt', amount: dmg, by });
    if (hp <= 0) this.onCharacterDown();
  }

  /** The active hero falls: everything they were doing stops and the death clip plays (finishDown follows). */
  private onCharacterDown(): void {
    if (this.downed) return;
    this.downed = { t: 0 };
    this.casting = null;
    this.heavy = null;
    this.heavyCharge = 0;
    this.burstCast = null;
    this.grab = null;
    for (const cb of this.combos.values()) { cb.swinging = false; cb.swingTime = 0; }
    this.iframes = DOWN_HOLD + 1;
    this.d.events?.emit({ kind: 'down', hero: this.active.id as HeroId });
    // (A wipe gets one banner, the fog's, from finishDown.)
    if (this.d.party.members.some((m) => m !== this.active && (this.hp.get(m.id) ?? 0) > 0)) this.d.hud.announce(`${this.active.name} falls`);
    // A ghoul who saw it gloats.
    const c = this.d.controller;
    const gloat = this.enemies.find((e) => e.alive && e.aggro && e.def.voices && Math.hypot(e.pos.x - c.pos.x, e.pos.z - c.pos.z) < 25);
    if (gloat) { this.voiceClock = 0; this.say(gloat, gloat.def.voices!.win); }
  }

  /** After the fall's hold: the next hero takes over, or, with nobody left, the fog takes the party. */
  private finishDown(): void {
    const party = this.d.party;
    // (Switched by hand during the hold: nothing to do.)
    if ((this.hp.get(this.active.id) ?? 0) > 0) return;
    const next = party.members.findIndex((m) => (this.hp.get(m.id) ?? 0) > 0);
    if (next >= 0) {
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
      // Pending attacks are dropped (their warnings put out); pending clean-ups (a web net on the ground) run now.
      const tidy = this.delayed.filter((j) => j.cleanup);
      for (const j of this.delayed) if (j.warn) this.fx.endTelegraph(j.warn.w.id);
      this.delayed.length = 0;
      for (const j of tidy) j.fn();
      this.mireLeft = 0;
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
      this.d.events?.emit({ kind: 'wipe' });
    }
  }

  /** A number (or a word) over `worldPos`; hits on one `targetId` merge on screen, a `crit` stands out. */
  private showNumber(worldPos: Vector3, value: number | string, color: number, big: boolean, targetId: number | null = null, crit = false): void {
    this.screen.copy(worldPos).project(this.d.camera);
    if (this.screen.z > 1) return;
    const x = (this.screen.x + 1) / 2 * window.innerWidth;
    const y = (1 - this.screen.y) / 2 * window.innerHeight;
    this.d.hud.damageNumber(x, y, value, color, big, targetId, crit);
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
    // The blade's ribbon, fed every drawn frame from where the hand put the blade this frame, while the cut is live.
    const blade = this.bladeColor();
    if (blade !== null && this.d.weaponTips?.(_g, _t)) { this.fx.trail('blade', _g, _t, blade, true); this.bladeFed = true; }
    else if (this.bladeFed) { this.fx.trail('blade', _g, _t, 0, false); this.bladeFed = false; }
    // The lock-on ring over the target's middle.
    const lt = this.lockTarget;
    if (lt?.alive && this.lockPoint(_v)) {
      this.screen.copy(_v).project(cam);
      const on = this.screen.z < 1 && Math.abs(this.screen.x) < 1.1 && Math.abs(this.screen.y) < 1.1;
      this.d.hud.lockMarker((this.screen.x + 1) / 2 * window.innerWidth, (1 - this.screen.y) / 2 * window.innerHeight, on);
    } else this.d.hud.lockMarker(0, 0, false);
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

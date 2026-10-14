import { BoxGeometry, Group, Mesh, PerspectiveCamera, Scene, Vector3 } from 'three';
import type { CharacterDef } from '../characters/roster';
import type { Rig } from '../characters/Rig';
import type { Game } from '../core/Game';
import { ENEMY_DEFS, ENEMY_SPAWNS } from '../data/enemies';
import type { ControllerState, WorldQuery } from '../player/CharacterController';
import type { Party } from '../player/Party';
import { PALETTE } from '../render/palette';
import { ps1Lambert } from '../render/PS1Material';
import type { Sky } from '../render/Sky';
import type { Hud } from '../ui/Hud';
import { glowSprite } from '../world/Landmarks';
import { ComboTracker, Cooldown, computeDamage, inCone, inRadius } from './Combat';
import { ELEMENT_COLOR, REACTIONS, applyElement, type Element, type ReactionId } from './Elements';
import { Enemy } from './Enemy';
import { COMBO, SKILLS, type AttackDef, type GroundEffectDef } from './Skills';
import { Vfx } from './Vfx';

interface Projectile {
  pos: Vector3; vel: Vector3; life: number; owner: 'player' | 'enemy';
  atk: number; mult: number; element: Element | null; radius: number; object: Group;
  chains: number; chainRange: number; hit: Set<number>; knockback: number; hitStop: number;
}

interface GroundZone { pos: Vector3; def: GroundEffectDef; left: number; tick: number; atk: number; remove: () => void }

export interface CombatInput { attack: boolean; skill: boolean }

export interface CombatDeps {
  scene: Scene; world: WorldQuery; sky: Sky; hud: Hud; camera: PerspectiveCamera; game: Game;
  controller: ControllerState; party: Party<CharacterDef>; rigs: Rig[]; spawn: Vector3;
  /** Called when the active character falls and another must take over. */
  onForceSwitch?: (index: number) => void;
}

const PLAYER_DEF = 30;
const IFRAMES = 0.6;

/** Owns enemies, projectiles, ground zones, VFX, player HP and the attack/skill flow. */
export class CombatSystem {
  readonly enemies: Enemy[] = [];
  private readonly projectiles: Projectile[] = [];
  private readonly zones: GroundZone[] = [];
  private readonly vfx = new Vfx();
  private readonly combos = new Map<string, ComboTracker>();
  private readonly cooldowns = new Map<string, Cooldown>();
  readonly hp = new Map<string, number>();
  private casting: { def: CharacterDef; t: number; fired: boolean } | null = null;
  private iframes = 0;
  private readonly tmp = new Vector3();
  private readonly screen = new Vector3();

  constructor(private readonly d: CombatDeps) {
    d.scene.add(this.vfx.group);
    for (const s of ENEMY_SPAWNS) {
      const e = new Enemy(ENEMY_DEFS[s.kind], { x: s.x, z: s.z }, d.world);
      this.enemies.push(e);
      d.scene.add(e.object);
    }
    for (const c of d.party.members) {
      const combo = COMBO[c.weapon];
      this.combos.set(c.id, new ComboTracker(combo.durations, combo.hitFraction));
      this.cooldowns.set(c.id, new Cooldown(SKILLS[c.id].cooldown));
      this.hp.set(c.id, c.maxHp);
    }
  }

  private get active(): CharacterDef {
    return this.d.party.active;
  }

  private get combo(): ComboTracker {
    return this.combos.get(this.active.id)!;
  }

  /** True while a swing or cast locks movement. */
  get busy(): boolean {
    return this.combo.swinging || this.casting !== null;
  }

  /** 0..1 animation progress for the rig, or undefined when idle. */
  get attackProgress(): number | undefined {
    if (this.casting) return Math.min(1, this.casting.t / SKILLS[this.casting.def.id].castTime);
    return this.combo.swinging ? this.combo.progress : undefined;
  }

  /** Called by the party switch so a swing does not carry across characters. */
  onSwitch(): void {
    this.casting = null;
    for (const c of this.combos.values()) {
      c.swinging = false;
      c.swingTime = 0;
    }
  }

  private playerPos(): Vector3 {
    const p = this.d.controller.pos;
    return this.tmp.set(p.x, p.y, p.z);
  }

  /** Face the nearest enemy in front-ish range before an attack (soft lock-on). */
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
    for (const cd of this.cooldowns.values()) cd.update(dt);

    // --- basic attack ---
    const grounded = c.mode === 'ground';
    if (input.attack && grounded && !this.casting) {
      this.softLock(7);
      const started = this.combo.press(0);
      if (started !== null) this.spawnSlash(me, COMBO[me.weapon].hits[started]);
    }
    const prevHit = this.combo.currentHit;
    const prevSwinging = this.combo.swinging;
    const hit = this.combo.update(dt);
    if (this.combo.swinging && (!prevSwinging || this.combo.currentHit !== prevHit) && this.combo.swingTime < dt * 1.5 && prevSwinging) {
      this.spawnSlash(me, COMBO[me.weapon].hits[this.combo.currentHit]);
    }
    if (hit !== null) this.resolveAttack(me, COMBO[me.weapon].hits[hit]);

    // --- skill ---
    const cd = this.cooldowns.get(me.id)!;
    if (input.skill && grounded && !this.busy && cd.ready) {
      this.softLock(9);
      cd.use();
      this.casting = { def: me, t: 0, fired: false };
      const skill = SKILLS[me.id];
      if (skill.attack.shape.kind === 'cone') this.vfx.slash(this.playerPos(), c.yaw, ELEMENT_COLOR[me.element], skill.attack.shape.range, skill.attack.shape.halfAngle);
    }
    if (this.casting) {
      const skill = SKILLS[this.casting.def.id];
      this.casting.t += dt;
      if (!this.casting.fired && this.casting.t >= skill.castTime * skill.hitFraction) {
        this.casting.fired = true;
        this.resolveAttack(this.casting.def, skill.attack);
        if (skill.ground) this.addZone(skill.ground, this.casting.def.atk);
        this.vfx.burst(this.playerPos().clone().add(new Vector3(0, 1, 0)), ELEMENT_COLOR[this.casting.def.element], 16, 6);
      }
      if (this.casting.t >= skill.castTime) this.casting = null;
    }

    // --- enemies ---
    const pp = { x: c.pos.x, y: c.pos.y, z: c.pos.z };
    let anyAggro = false;
    for (const e of this.enemies) {
      const action = e.update(dt, pp);
      anyAggro ||= e.aggro;
      if (action?.kind === 'melee') {
        const inRange = inCone({ x: e.pos.x, z: e.pos.z }, e.yaw, { x: c.pos.x, z: c.pos.z }, e.def.brain.attackRange + 0.6, 1.0);
        this.vfx.slash(new Vector3(e.pos.x, e.pos.y, e.pos.z), e.yaw, PALETTE.ultramarine, e.def.brain.attackRange, 1.0);
        if (inRange) this.damagePlayer(e.def.atk, e.def.element);
      } else if (action?.kind === 'bolt') {
        const from = new Vector3(e.pos.x, e.pos.y, e.pos.z);
        const to = new Vector3(c.pos.x, c.pos.y + 1, c.pos.z);
        this.spawnProjectile(from, to.sub(from).normalize().multiplyScalar(13), 'enemy', e.def.atk, 1, 'fog', 0.8, PALETTE.rune, 0, 0, 0, 0);
      }
    }
    d.sky.setBloodMoon(anyAggro);

    // --- projectiles ---
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.pos.addScaledVector(p.vel, dt);
      p.object.position.copy(p.pos);
      p.object.rotation.y += dt * 12;
      let dead = p.life <= 0 || p.pos.y < d.world.heightAt(p.pos.x, p.pos.z) - 1;
      if (p.owner === 'player') {
        for (const e of this.enemies) {
          if (!e.alive || p.hit.has(e.id)) continue;
          if (Math.hypot(e.pos.x - p.pos.x, e.pos.z - p.pos.z) <= p.radius + e.def.bodyRadius && Math.abs(e.pos.y + e.def.height * 0.5 - p.pos.y) < 2.5) {
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
      } else if (Math.hypot(c.pos.x - p.pos.x, c.pos.z - p.pos.z) < p.radius + 0.5 && Math.abs(c.pos.y + 1 - p.pos.y) < 1.6) {
        this.damagePlayer(p.atk, p.element);
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
          if (e.alive && inRadius({ x: z.pos.x, z: z.pos.z }, { x: e.pos.x, z: e.pos.z }, z.def.radius + e.def.bodyRadius)) {
            this.hitEnemy(e, z.atk, z.def.tickMult, z.def.element, 0, 0);
          }
        }
      }
      if (z.left <= 0) {
        z.remove();
        this.zones.splice(i, 1);
      }
    }

    this.vfx.update(dt);
    d.hud.setHp(this.hp.get(me.id)!, me.maxHp);
    d.hud.setSkill(SKILLS[me.id].name, cd.fraction, cd.ready && grounded);
  }

  private spawnSlash(me: CharacterDef, def: AttackDef): void {
    if (def.shape.kind !== 'cone') return;
    const color = def.element === 'own' ? ELEMENT_COLOR[me.element] : PALETTE.cloth;
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
    const element: Element | null = def.element === 'own' ? me.element : null;
    const origin = { x: c.pos.x, z: c.pos.z };
    if (def.shape.kind === 'bolt') {
      const target = this.nearestEnemy(c.pos.x, c.pos.z, def.shape.range);
      const from = new Vector3(c.pos.x + Math.cos(c.yaw) * 0.6, c.pos.y + 1.3, c.pos.z + Math.sin(c.yaw) * 0.6);
      const dir = target
        ? new Vector3(target.pos.x - from.x, target.pos.y + 0.5 - from.y, target.pos.z - from.z).normalize()
        : new Vector3(Math.cos(c.yaw), 0.05, Math.sin(c.yaw));
      this.spawnProjectile(from, dir.multiplyScalar(22), 'player', me.atk, def.mult, element, 1.0, ELEMENT_COLOR[me.element], def.shape.chains, def.shape.chainRange, def.knockback, def.hitStop);
      return;
    }
    for (const e of this.enemies) {
      if (!e.alive) continue;
      const t = { x: e.pos.x, z: e.pos.z };
      const ok = def.shape.kind === 'cone'
        ? inCone(origin, c.yaw, t, def.shape.range + e.def.bodyRadius, def.shape.halfAngle)
        : inRadius(origin, t, def.shape.radius + e.def.bodyRadius);
      if (ok) this.hitEnemy(e, me.atk, def.mult, element, def.knockback, def.hitStop);
    }
  }

  private hitEnemy(e: Enemy, atk: number, mult: number, element: Element | null, knockback: number, hitStop: number): void {
    const c = this.d.controller;
    const { aura, reaction } = applyElement(e.aura, element);
    e.aura = aura;
    const dmg = computeDamage({ atk, multiplier: mult, defense: e.def.def - e.defDown.amount, reaction });
    const kdx = e.pos.x - c.pos.x;
    const kdz = e.pos.z - c.pos.z;
    const kl = Math.hypot(kdx, kdz) || 1;
    const kb = { x: kdx / kl, z: kdz / kl };
    const died = e.takeDamage(dmg, kb, knockback + (reaction ? REACTIONS[reaction].knockback : 0));
    const at = new Vector3(e.pos.x, e.pos.y + e.def.height * 0.5, e.pos.z);
    const color = element ? ELEMENT_COLOR[element] : PALETTE.cloth;
    this.vfx.impact(at, color, 1.8);
    this.vfx.burst(at, color, 8, 4, 0.3);
    this.showNumber(at, dmg, color, false);
    this.d.game.hitStop = Math.max(this.d.game.hitStop, hitStop);
    if (reaction) this.applyReaction(e, reaction, dmg, at);
    if (died) {
      this.vfx.burst(at, PALETTE.moon, 24, 7, 0.5);
      this.vfx.shockwave(new Vector3(e.pos.x, e.pos.y, e.pos.z), ELEMENT_COLOR[e.def.element], 5);
      this.d.hud.removeEnemyBar(e.id);
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
          const died = e.takeDamage(splash, { x: dx / l, z: dz / l }, r.knockback);
          const p = new Vector3(e.pos.x, e.pos.y + e.def.height * 0.5, e.pos.z);
          this.vfx.impact(p, r.color, 1.4);
          this.showNumber(p, splash, r.color, false);
          if (died) this.d.hud.removeEnemyBar(e.id);
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

  private spawnProjectile(from: Vector3, vel: Vector3, owner: 'player' | 'enemy', atk: number, mult: number, element: Element | null, radius: number, color: number, chains: number, chainRange: number, knockback: number, hitStop: number): void {
    const object = new Group();
    const core = new Mesh(new BoxGeometry(0.24, 0.24, 0.24), ps1Lambert({ color: PALETTE.void, emissive: color, emissiveIntensity: 3 }));
    core.rotation.set(0.7, 0.7, 0);
    object.add(core, glowSprite(color, 1.1, 0.8, true));
    object.position.copy(from);
    this.d.scene.add(object);
    this.projectiles.push({ pos: from.clone(), vel, life: 2.5, owner, atk, mult, element, radius, object, chains, chainRange, hit: new Set(), knockback, hitStop });
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
      e.animate(dt);
      if (!e.alive) continue;
      const dist = Math.hypot(e.pos.x - cam.position.x, e.pos.z - cam.position.z);
      this.screen.set(e.pos.x, e.pos.y + e.def.height + 0.4, e.pos.z).project(cam);
      const visible = this.screen.z < 1 && Math.abs(this.screen.x) < 1.1 && Math.abs(this.screen.y) < 1.1 && dist < 60 && (e.aggro || e.hp < e.def.maxHp);
      this.d.hud.enemyBar(e.id, e.def.name, (this.screen.x + 1) / 2 * window.innerWidth, (1 - this.screen.y) / 2 * window.innerHeight, e.hp / e.def.maxHp, e.aura ? ELEMENT_COLOR[e.aura.element] : null, visible);
    }
  }
}

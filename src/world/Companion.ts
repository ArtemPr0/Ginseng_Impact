import { Vector3 } from 'three';
import { yawToRotation } from '../models/ModelRig';
import { Rig } from '../characters/Rig';
import type { NpcDef } from './NPCs';

export interface CompanionTarget { id: number; pos: { x: number; y: number; z: number }; alive: boolean; aggro: boolean }

/** The part of a follower the pure follow step moves: where it stands, which way it faces, whether it waits for you. */
export interface Follower {
  pos: { x: number; z: number };
  yaw: number;
  /** Waiting where it stands: settled at its place while you stood still. It keeps that place while you stand or walk straight up to it. */
  held: boolean;
  /** At your side: waiting, with you standing within sideRange and facing it — close enough to send home. */
  beside: boolean;
  /** Let go as you walked on: back to its place at a run. */
  hurry: boolean;
}

/** The hero as the follow step sees them: where, which way they face, and how they move (m/s). */
export interface FollowedHero { x: number; z: number; yaw: number; vx: number; vz: number }

/** Within this of a waiting companion (standing, facing it) you can send it home. */
export const SIDE_RANGE = 2.5;
/** Standing: slower than this. */
const STILL = 0.5;
/** At its place: within this of its slot (the follow's deadband). */
const SETTLED = 0.5;
/** A hold lets go beyond this (slot 2 stands 4.2 m out). */
const HOLD_RANGE = 5.5;
/** Walking at it: your heading within 30 degrees of it from afar (slot 1 stands 42 degrees off, so a plain start lets it go), 75 once close. */
const COS_FAR = Math.cos(Math.PI / 6);
const COS_NEAR = Math.cos((75 / 180) * Math.PI);
/** Facing it: within 60 degrees. */
const COS_FACED = 0.5;

/** A follower's place at your heels (x ahead, z to the left): slots 0 and 2 behind on the left, slot 1 ahead on the left. */
export function followSlot(slot: number): { x: number; z: number } {
  return { x: slot % 2 === 0 ? -2.2 : 2.2, z: 2 + Math.floor(slot / 2) * 1.6 };
}

/**
 * One step of following you with no enemy in mind: it walks to its slot as ever, except that one settled at its slot
 * while you stand still waits there — through your turning to it and walking straight up to it (its slot would
 * otherwise swing round with you and it would slip off to it, through you). Walking any other way lets it go at
 * once, so following is never held up: not a new hire walking out from your feet, not one crossing to its new slot
 * when you turn round, not one catching up. Returns whether it moved and how fast, for the animation.
 */
export function followStep(f: Follower, dt: number, hero: FollowedHero, slot: { x: number; z: number }): { moving: boolean; speed: number } {
  const c = Math.cos(hero.yaw);
  const s = Math.sin(hero.yaw);
  const gx = hero.x + slot.x * c - slot.z * s - f.pos.x;
  const gz = hero.z + slot.x * s + slot.z * c - f.pos.z;
  const gd = Math.hypot(gx, gz);
  const dx = f.pos.x - hero.x;
  const dz = f.pos.z - hero.z;
  const d = Math.hypot(dx, dz);
  const hs = Math.hypot(hero.vx, hero.vz);
  const still = hs < STILL;
  const toward = !still && hero.vx * dx + hero.vz * dz > (d < SIDE_RANGE ? COS_NEAR : COS_FAR) * hs * d;
  const was = f.held;
  // Never one still travelling to its slot: the hold is taken up only once it stands there and you stand too.
  f.held = was ? d < HOLD_RANGE && (still || toward) : still && gd <= SETTLED;
  if (was && !f.held && !still) f.hurry = true;
  f.beside = f.held && still && d < SIDE_RANGE && dx * c + dz * s > COS_FACED * d;
  // Stood by and faced, it turns to you.
  if (f.beside) f.yaw = Math.atan2(-dz, -dx);
  if (gd <= SETTLED) f.hurry = false;
  if (f.held || gd <= SETTLED) return { moving: false, speed: 0 };
  const speed = gd > 9 || f.hurry ? 8 : 5.2;
  const step = Math.min(gd, speed * dt);
  f.pos.x += (gx / gd) * step;
  f.pos.z += (gz / gd) * step;
  f.yaw = Math.atan2(gz, gx);
  return { moving: true, speed };
}

/** A hired NPC that follows the player and fights nearby enemies. */
export class Companion {
  readonly rig: Rig;
  readonly pos = new Vector3();

  /** Follows the player through a portal. */
  teleport(x: number, z: number, y: number): void {
    this.pos.set(x + 1.5, y, z + 1.5);
    this.held = this.beside = this.hurry = false;
    this.lastPlayer = null;
  }
  yaw = 0;
  hp: number;
  /** Waiting where it stands (see followStep). */
  held = false;
  /** At your side: standing, faced and close — the F prompt offers to send it home. */
  beside = false;
  hurry = false;
  private swing = 0;
  private swingTime = 0;
  private attacking = false;
  /** Where you stood last step, for your speed and heading. */
  private lastPlayer: { x: number; z: number } | null = null;
  private readonly follow: { x: number; z: number };

  constructor(readonly def: NpcDef, start: Vector3, private readonly heightAt: (x: number, z: number, y?: number) => number, readonly slot: number) {
    this.rig = new Rig({ id: def.id, name: def.name, title: def.title, element: 'fog', weapon: def.weapon, maxHp: def.hire!.maxHp, atk: def.hire!.atk, accent: def.accent }, def.model);
    this.hp = def.hire!.maxHp;
    this.pos.copy(start);
    this.follow = followSlot(slot);
  }

  /** Returns the enemy id to strike this step, or null. */
  update(dt: number, player: Vector3, playerYaw: number, enemies: CompanionTarget[]): number | null {
    let target: CompanionTarget | null = null;
    let bd = 14;
    for (const e of enemies) {
      if (!e.alive || !e.aggro) continue;
      const d = Math.hypot(e.pos.x - this.pos.x, e.pos.z - this.pos.z);
      if (d < bd) { bd = d; target = e; }
    }
    const hero: FollowedHero = { x: player.x, z: player.z, yaw: playerYaw, vx: 0, vz: 0 };
    if (this.lastPlayer && dt > 0) { hero.vx = (player.x - this.lastPlayer.x) / dt; hero.vz = (player.z - this.lastPlayer.z) / dt; }
    this.lastPlayer = { x: player.x, z: player.z };
    let moving = false;
    let speed = 5.2;
    const ranged = this.def.hire!.ranged;
    const reach = ranged ? 9 : 2.2;
    if (target) {
      this.held = this.beside = this.hurry = false;
      const dx = target.pos.x - this.pos.x;
      const dz = target.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      const gd = Math.max(0, d - reach);
      if (gd > 0.5) {
        const step = Math.min(gd, speed * dt);
        this.pos.x += (dx / d) * step;
        this.pos.z += (dz / d) * step;
        moving = true;
      }
      this.yaw = Math.atan2(dz, dx);
    } else {
      const r = followStep(this, dt, hero, this.follow);
      moving = r.moving;
      if (moving) speed = r.speed;
    }
    // Teleport if left far behind.
    // ...or fallen off a realm's floor into the void below (a follower has no colliders of its own).
    const ground = this.heightAt(this.pos.x, this.pos.z, this.pos.y);
    if (Math.hypot(player.x - this.pos.x, player.z - this.pos.z) > 40 || ground < player.y - 15 || Math.abs(player.y - this.pos.y) > 25) { this.pos.set(player.x, player.y, player.z); }
    else this.pos.y += (ground - this.pos.y) * Math.min(1, dt * 10);
    let strike: number | null = null;
    if (target && bd <= reach + 0.6) {
      this.swing -= dt;
      if (this.swing <= 0 && !this.attacking) { this.attacking = true; this.swingTime = 0; }
    }
    if (this.attacking) {
      this.swingTime += dt;
      const dur = 0.5;
      if (this.swingTime >= dur * 0.45 && this.swingTime - dt < dur * 0.45 && target) strike = target.id;
      if (this.swingTime >= dur) { this.attacking = false; this.swing = 1.1 + Math.random() * 0.4; }
    }
    this.rig.root.position.copy(this.pos);
    this.rig.root.rotation.y = yawToRotation(this.yaw);
    this.rig.animate({ mode: 'ground', speed: moving ? speed : 0, attack: this.attacking ? Math.min(1, this.swingTime / 0.5) : undefined, attackKind: 0 }, dt);
    return strike;
  }
}

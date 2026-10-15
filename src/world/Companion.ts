import { Vector3 } from 'three';
import { yawToRotation } from '../models/ModelRig';
import { Rig } from '../characters/Rig';
import type { NpcDef } from './NPCs';

export interface CompanionTarget { id: number; pos: { x: number; y: number; z: number }; alive: boolean; aggro: boolean }

/** A hired NPC that follows the player and fights nearby enemies. */
export class Companion {
  readonly rig: Rig;
  readonly pos = new Vector3();

  /** Follows the player through a portal. */
  teleport(x: number, z: number, y: number): void {
    this.pos.set(x + 1.5, y, z + 1.5);
  }
  yaw = 0;
  hp: number;
  private swing = 0;
  private swingTime = 0;
  private attacking = false;
  private readonly follow: Vector3;

  constructor(readonly def: NpcDef, start: Vector3, private readonly heightAt: (x: number, z: number, y?: number) => number, slot: number) {
    this.rig = new Rig({ id: def.id, name: def.name, title: def.title, element: 'fog', weapon: def.weapon, maxHp: def.hire!.maxHp, atk: def.hire!.atk, accent: def.accent }, def.model);
    this.hp = def.hire!.maxHp;
    this.pos.copy(start);
    this.follow = new Vector3(slot % 2 === 0 ? -2.2 : 2.2, 0, 2 + Math.floor(slot / 2) * 1.6);
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
    let goal: { x: number; z: number };
    let speed = 5.2;
    const ranged = this.def.hire!.ranged;
    const reach = ranged ? 9 : 2.2;
    if (target) {
      const dx = target.pos.x - this.pos.x;
      const dz = target.pos.z - this.pos.z;
      const d = Math.hypot(dx, dz) || 1;
      goal = d > reach ? { x: this.pos.x + (dx / d) * (d - reach), z: this.pos.z + (dz / d) * (d - reach) } : { x: this.pos.x, z: this.pos.z };
      this.yaw = Math.atan2(dz, dx);
    } else {
      const c = Math.cos(playerYaw);
      const s = Math.sin(playerYaw);
      goal = { x: player.x + this.follow.x * c - this.follow.z * s, z: player.z + this.follow.x * s + this.follow.z * c };
      speed = Math.hypot(goal.x - this.pos.x, goal.z - this.pos.z) > 9 ? 8 : 5.2;
    }
    const gx = goal.x - this.pos.x;
    const gz = goal.z - this.pos.z;
    const gd = Math.hypot(gx, gz);
    let moving = false;
    if (gd > 0.5) {
      const step = Math.min(gd, speed * dt);
      this.pos.x += (gx / gd) * step;
      this.pos.z += (gz / gd) * step;
      if (!target) this.yaw = Math.atan2(gz, gx);
      moving = true;
    }
    // Teleport if left far behind.
    if (Math.hypot(player.x - this.pos.x, player.z - this.pos.z) > 40) { this.pos.set(player.x, player.y, player.z); }
    this.pos.y += (this.heightAt(this.pos.x, this.pos.z, this.pos.y) - this.pos.y) * Math.min(1, dt * 10);
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

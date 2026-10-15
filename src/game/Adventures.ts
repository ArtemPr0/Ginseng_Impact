/**
 * The side adventures around the quests: carrying Croak in a sack, the Frog King's two-minute dream, riding a river
 * boat with the rowers and their beer. Owns the quest state and what F does before the usual targets (loot, talk).
 */
import { Group, Vector3 } from 'three';
import { DREAM, GALAXY, LAYOUT } from '../data/world';
import type { EnemyKind } from '../data/enemies';
import type { Enemy } from '../combat/Enemy';
import { MODELS } from '../data/models';
import { voiceUrl } from '../data/voices';
import { loadModelOrWarn, ModelRig } from '../models/ModelRig';
import type { Audio } from '../audio/Audio';
import type { Rig } from '../characters/Rig';
import type { Inventory } from '../items/Inventory';
import type { ControllerState } from '../player/CharacterController';
import type { Hud } from '../ui/Hud';
import type { Teleport } from '../world/Interact';
import type { Npc } from '../world/NPCs';
import type { Boat, World } from '../world/World';
import { dialogueFor, type DialogueNode, type DialogueWorld } from './Dialogue';
import { Quests } from './Quests';

/** Seconds in the frog's dream, and of the rowers' ale. */
const DREAM_SECONDS = 120;
const ALE_SECONDS = 180;
/** Croak is home when the sack is put down this close to his father. */
const HOME_RANGE = 8;
/** Where a passenger stands in a boat (between the rowers, boat frame). */
const SEAT = new Vector3(0, 0.32, 0.05);

export interface AdventureDeps {
  controller: ControllerState;
  world: World;
  hud: Hud;
  audio: Audio;
  inventory: Inventory;
  teleport: Teleport;
  /** The active hero's body (the sack hangs on it). */
  activeRig(): Rig;
  /** The hero's afflictions (poison, Sizzlin' Slowness), shown with the buffs. */
  debuffs(): Array<{ name: string; left: number }>;
  /** Bosses outside the spawn list (Yung Lean off his throne). */
  fight: { spawnBoss(kind: EnemyKind, x: number, z: number, yaw: number): Enemy; despawn(e: Enemy): void };
}

export class Adventures {
  readonly quests = new Quests();
  /** Seconds left in the dream (0: awake), of the ale buff, and the boat being ridden. */
  dreamLeft = 0;
  aleLeft = 0;
  riding: Boat | null = null;
  private readonly sack = new Group();
  private sackOn: Rig | null = null;
  private t = 0;
  private readonly dw: DialogueWorld;

  constructor(private readonly d: AdventureDeps) {
    this.quests.onChange = () => this.refreshHud();
    this.sack.visible = false;
    void loadModelOrWarn('croak-bag', MODELS['croak-bag']?.label).then((g) => {
      if (!g) return;
      const rig = new ModelRig('croak-bag', g);
      rig.root.scale.multiplyScalar(0.85);
      this.sack.add(rig.root);
    });
    this.dw = {
      quests: this.quests,
      pay: (n) => { d.inventory.shards += n; d.audio.coins(6); d.hud.announce(`+${n} Moon Shards`); },
      give: (id) => { d.inventory.add(id, 1); d.audio.loot(4); },
      has: (id) => d.inventory.has(id),
      take: (id) => d.inventory.remove(id, 1),
      bagCroak: () => this.bagCroak(),
      lick: () => this.enterDream(),
      drinkAle: () => { this.aleLeft = ALE_SECONDS; d.audio.slurp(1); d.hud.announce("Rowers' Ale · stamina lasts longer"); },
      challengeKing: () => this.challengeKing(),
      announce: (text) => d.hud.announce(text),
    };
  }

  /** The conversation to open with `npc`, or null for its ordinary lines. */
  talk(npcId: string): DialogueNode | null {
    return dialogueFor(npcId, this.dw);
  }

  /** Plays a dialogue line's recorded voice as it opens. */
  readonly onLine = (node: DialogueNode): void => { if (node.voice) void this.d.audio.voice(node.voice, 1); };

  private npc(id: string): Npc | undefined {
    return this.d.world.npcs.find((n) => n.def.id === id);
  }

  private bagCroak(): void {
    const croak = this.npc('croak');
    if (croak) { croak.hidden = true; croak.object.visible = false; }
    this.quests.set('croak', 'bagged');
    void this.d.audio.voice(voiceUrl('croak-bagged'), 1);
    this.d.hud.announce('Croak is in the sack');
  }

  /** Puts the sack down where the hero stands: Croak climbs out there (home, if it is by his father). */
  private dropSack(): void {
    const c = this.d.controller;
    const croak = this.npc('croak');
    if (croak) {
      croak.hidden = false;
      croak.object.visible = true;
      croak.pos.set(c.pos.x + Math.cos(c.yaw) * 1.4, 0, c.pos.z + Math.sin(c.yaw) * 1.4);
      croak.pos.y = this.d.world.heights.heightAt(croak.pos.x, croak.pos.z, c.pos.y);
      croak.yaw = c.yaw + Math.PI;
    }
    const king = this.npc('frogking');
    const home = !!king && Math.hypot(king.pos.x - c.pos.x, king.pos.z - c.pos.z) < HOME_RANGE;
    if (home && king && croak) {
      // Home: he hops over to his father's side (not between you and the King).
      const a = Math.atan2(c.pos.z - king.pos.z, c.pos.x - king.pos.x) + Math.PI / 2;
      croak.pos.set(king.pos.x + Math.cos(a) * 2.4, 0, king.pos.z + Math.sin(a) * 2.4);
      croak.pos.y = this.d.world.heights.heightAt(croak.pos.x, croak.pos.z, king.pos.y + 1);
      croak.yaw = Math.atan2(c.pos.z - croak.pos.z, c.pos.x - croak.pos.x);
    }
    this.quests.set('croak', home ? 'returned' : 'active');
    this.d.hud.announce(home ? 'Croak is home' : 'Croak climbs out of the sack');
    this.d.audio.footstep();
  }

  private enterDream(): void {
    this.dreamLeft = DREAM_SECONDS;
    this.d.audio.cast();
    this.d.teleport(DREAM.x, DREAM.y + 0.05, DREAM.z + 30, -Math.PI / 2, DREAM.name);
  }

  private wake(): void {
    this.dreamLeft = 0;
    const f = LAYOUT.frog;
    const x = f.x + 3.5;
    const z = f.z + 2;
    this.d.teleport(x, this.d.world.heights.heightAt(x, z), z, Math.PI, 'You wake beside the Frog King');
  }

  /** Picks up the lost sound on the far cup (Yung Lean's quest). */
  foundSound(): void {
    if (this.quests.stage('sound') !== 'active') return;
    this.d.inventory.add('lost-sound', 1);
    this.quests.set('sound', 'found');
    this.d.audio.loot(4);
    this.d.hud.announce('The Lost Sound');
  }

  /** Yung Lean off his throne: the seated king gives way to the boss in front of it until he is beaten or left. */
  private kingFight: { e: Enemy; t: number; beatenFor: number } | null = null;

  private challengeKing(): void {
    const npc = this.npc('yunglean');
    if (!npc || this.kingFight) return;
    npc.hidden = true;
    npc.object.visible = false;
    const e = this.d.fight.spawnBoss('rift-king', npc.pos.x, npc.pos.z + 3, Math.PI / 2);
    this.kingFight = { e, t: 0, beatenFor: 0 };
    this.d.hud.announce('Yung Lean rises from the throne');
  }

  private updateKingFight(dt: number): void {
    const f = this.kingFight;
    if (!f) return;
    f.t += dt;
    const c = this.d.controller;
    const left = Math.hypot(c.pos.x - GALAXY.x, c.pos.z - GALAXY.z) > GALAXY.radius || f.e.returning;
    if (f.e.alive && !left) return;
    if (!f.e.alive) { f.beatenFor += dt; if (f.beatenFor < 2.5) return; }
    // Beaten or left: he sits back down.
    this.d.fight.despawn(f.e);
    const npc = this.npc('yunglean');
    if (npc) { npc.hidden = false; npc.object.visible = true; }
    if (!f.e.alive) {
      void this.d.audio.voice(voiceUrl('lean-beaten'), 1);
      this.dw.pay(600);
      this.d.hud.announce('Yung Lean sits back down');
    }
    this.kingFight = null;
  }

  /** Steps out of the boat over the side (into the river: swim to a bank). */
  leaveBoat(): void {
    const b = this.riding;
    if (!b) return;
    this.riding = null;
    const c = this.d.controller;
    const side = b.root.rotation.y;
    c.vel.x = Math.cos(side) * 3;
    c.vel.z = -Math.sin(side) * 3;
    c.vel.y = 5;
    c.mode = 'air';
  }

  /** F, before loot and talk: put the sack down, talk to the rowers, or use the nearest door or boat. */
  interact(zone: string | null): { label: string; act(): void } | null {
    if (this.riding) return { label: 'Talk to the rowers', act: () => this.openRowers?.() };
    if (this.quests.stage('croak') === 'bagged') return { label: 'Put the sack down', act: () => this.dropSack() };
    const p = this.d.controller.pos;
    let best: { label: string; act(): void } | null = null;
    let bd = Infinity;
    for (const it of this.d.world.interactables) {
      if (it.zone !== zone) continue;
      const label = it.label();
      if (!label) continue;
      const dist = Math.hypot(it.pos.x - p.x, it.pos.z - p.z);
      if (dist < it.range && dist < bd && Math.abs(it.pos.y - p.y) < 4) { bd = dist; best = { label, act: () => it.act() }; }
    }
    return best;
  }

  /** Set by main: opens the rowers' conversation. */
  openRowers: (() => void) | null = null;

  /** Per step: the dream clock, the ale, the boat seat, the sack on the hero's back, the HUD. */
  update(dt: number): void {
    this.t += dt;
    if (this.dreamLeft > 0) {
      this.dreamLeft -= dt;
      if (this.dreamLeft <= 0) this.wake();
    }
    if (this.aleLeft > 0) this.aleLeft = Math.max(0, this.aleLeft - dt);
    this.updateKingFight(dt);
    this.d.controller.drainScale = this.aleLeft > 0 ? 0.5 : 1;
    // Riding: the hero stands between the rowers and goes where the boat goes.
    const b = this.riding;
    if (b) {
      b.root.updateWorldMatrix(true, false);
      const at = b.root.localToWorld(SEAT.clone());
      const c = this.d.controller;
      c.pos.x = at.x; c.pos.y = at.y; c.pos.z = at.z;
      c.vel.x = c.vel.y = c.vel.z = 0;
      c.mode = 'ground';
    }
    // The sack rides on whoever is in front, swaying with the walk.
    const rig = this.d.activeRig();
    const carrying = this.quests.stage('croak') === 'bagged';
    if (this.sackOn !== rig) { rig.root.add(this.sack); this.sackOn = rig; }
    this.sack.visible = carrying;
    if (carrying) {
      this.sack.position.set(0, 0.45, -0.42);
      this.sack.rotation.set(0.12 + Math.sin(this.t * 3.1) * 0.05, 0, Math.sin(this.t * 2.3) * 0.06);
    }
    this.refreshHud();
  }

  private refreshHud(): void {
    const buffs: Array<{ name: string; left: number }> = [];
    if (this.aleLeft > 0) buffs.push({ name: "Rowers' Ale", left: this.aleLeft });
    buffs.push(...this.d.debuffs());
    this.d.hud.setQuests(this.quests.tracker(), buffs);
    this.d.hud.setTimer(this.dreamLeft > 0 ? this.dreamLeft : null, 'The dream lasts');
  }
}

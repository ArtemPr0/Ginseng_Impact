/**
 * The ending's concert: Yung Lean at the door of his hall, every soul in the kingdom on the plaza facing him, the mobs
 * sent home, fireworks over the roof. Two camera shots: the crowd from behind, then down to the stage. It stays as the
 * after-party until the hero leaves the realm; `disperse` puts everyone back exactly where they were.
 */
import { Vector3, type Camera } from 'three';
import { crowdSpots } from '../game/Crowd';
import { PLAZA_SHOT } from '../game/Ending';
import type { CombatFx } from '../render/CombatFx';
import { PALETTE } from '../render/palette';
import { GALAXY, REALMS } from '../data/world';
import type { Npc, NpcBehaviour } from './NPCs';
import type { World } from './World';

const STAGE = { x: 1000, z: -47.5 };
const FIREWORKS = [PALETTE.rune, PALETTE.dusk, PALETTE.moon, PALETTE.electric, 0xff6ec7];
const UP = new Vector3(0, 1, 0);
const _at = new Vector3();
const _look = new Vector3();

interface Mob { object: { visible: boolean }; brain: { p: { aggroRange: number } }; pos: { x: number; z: number } }
interface Saved { npc: Npc; x: number; y: number; z: number; behaviour: NpcBehaviour; hidden: boolean }

export interface ConcertDeps {
  area: World;
  camera: Camera;
  fx: CombatFx;
  enemies(): readonly Mob[];
  /** Moves the hero onto the plaza. */
  place(x: number, y: number, z: number): void;
  heightAt(x: number, z: number, y?: number): number;
}

export class Concert {
  private readonly saved: Saved[] = [];
  private readonly mobs: Array<{ m: Mob; aggro: number }> = [];
  private wait = 0;
  private gy: number = GALAXY.y;

  constructor(private readonly d: ConcertDeps) {}

  get crowd(): number { return this.saved.length; }

  start(): void {
    const { area } = this.d;
    this.gy = this.d.heightAt(STAGE.x, -30, GALAXY.y + 0.5);
    this.d.place(STAGE.x, this.gy, -10);
    // The plaza's mobs go home for the night.
    for (const m of this.d.enemies()) {
      if (Math.hypot(m.pos.x - GALAXY.x, m.pos.z - GALAXY.z) > GALAXY.radius) continue;
      this.mobs.push({ m, aggro: m.brain.p.aggroRange });
      m.brain.p.aggroRange = 0;
      m.object.visible = false;
    }
    const people = area.npcs.filter((n) => !n.def.invisible && n.def.id !== 'yunglean')
      .sort((a, b) => Number(b.def.id === 'cup-gnome') - Number(a.def.id === 'cup-gnome'));
    const clear = (x: number, z: number) => Math.abs(this.d.heightAt(x, z, this.gy + 0.5) - this.gy) < 0.35;
    const spots = crowdSpots([{ rect: [976, 1024, -42, -14], look: STAGE, keep: 5 }], people.length, clear, { spacing: 1.6, step: 0.9 });
    const put = (n: Npc, x: number, z: number, yaw: number) => {
      this.saved.push({ npc: n, x: n.pos.x, y: n.pos.y, z: n.pos.z, behaviour: n.def.behaviour, hidden: n.hidden });
      area.moveNpcToZone(n, GALAXY.id);
      area.seatOf(n.def.id)?.root.position.setY(-500);
      n.def.behaviour = { kind: 'stand', yaw };
      n.hidden = false;
      n.object.visible = true;
      n.pos.set(x, this.d.heightAt(x, z, this.gy + 0.5), z);
      n.object.position.copy(n.pos);
    };
    people.forEach((n, i) => { const s = spots[i]; if (s) put(n, s.x, s.z, s.yaw); });
    const lean = area.npcs.find((n) => n.def.id === 'yunglean');
    if (lean) put(lean, STAGE.x, STAGE.z, Math.PI / 2);
  }

  /** Every frame of the concert, `t` seconds in. */
  tick(t: number, dt: number): void {
    const { camera, fx } = this.d;
    const g = this.gy;
    if (t < PLAZA_SHOT) {
      const u = t / PLAZA_SHOT;
      camera.position.set(1012 - 22 * u, g + 9 - 2 * u, 6 - 12 * u);
      _look.set(1000, g + 4, -50);
    } else {
      const u = Math.min(1, (t - PLAZA_SHOT) / 8);
      const s = u * u * (3 - 2 * u);
      camera.position.set(1003.5 - 2.5 * s, g + 2 - 0.2 * s, -36 - 6.5 * s);
      _look.set(1000, g + 1.5, STAGE.z);
    }
    camera.lookAt(_look);
    this.wait -= dt;
    if (this.wait <= 0) {
      this.wait = 0.35 + Math.random() * 0.5;
      const c = FIREWORKS[Math.floor(Math.random() * FIREWORKS.length)];
      _at.set(1000 + (Math.random() - 0.5) * 60, g + 20 + Math.random() * 16, -62 + (Math.random() - 0.5) * 30);
      fx.flash(_at, c, 7);
      fx.sparks(_at, UP, 26, c, 11, 3);
    }
  }

  /** The after-party is over: everyone home, the mobs back. */
  disperse(): void {
    const { area } = this.d;
    for (const s of this.saved) {
      const n = s.npc;
      n.def.behaviour = s.behaviour;
      n.hidden = s.hidden;
      n.object.visible = !s.hidden;
      n.pos.set(s.x, s.y, s.z);
      n.object.position.copy(n.pos);
      const realm = REALMS.find((r) => Math.hypot(s.x - r.x, s.z - r.z) < r.radius);
      area.moveNpcToZone(n, realm ? realm.id : null);
      area.seatOf(n.def.id)?.root.position.setY(s.y - 0.02);
    }
    this.saved.length = 0;
    for (const { m, aggro } of this.mobs) { m.brain.p.aggroRange = aggro; m.object.visible = true; }
    this.mobs.length = 0;
  }
}

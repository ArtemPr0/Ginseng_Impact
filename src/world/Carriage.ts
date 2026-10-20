/**
 * The black-and-gold carriage of the Lean Quarter (DeXn5rSPxR8): Count Rattlewheel rides inside, smoking, and offers
 * you a smoke and a drink; take the reins and it is yours to drive about the quarters, faster than you can run.
 * W/S drive (up to 9 m/s, a crawl backwards), A/D steer, Space or F climbs down. It stops at walls and drops, and keeps
 * to the kingdom's floors.
 */
import { Group, Vector3 } from 'three';
import { GALAXY } from '../data/world';
import { MODELS } from '../data/models';
import { PipeSmoke } from '../render/Smoke';
import type { Interactable } from './Interact';
import { modelLandmark } from './ModelLandmark';
import type { Npc } from './NPCs';
import type { RealmApi } from './Realms';

/** carriage.glb, measured: its long axis is the model's x, the shafts (its front) toward -x; 1.37 units tall. */
const UNIT = MODELS.carriage.height / 1.37;
/** The driver's bench, ahead of the middle and up (metres); the seat inside, behind it. */
const BENCH = { ahead: 0.75, up: 1.55 };
const INSIDE = { ahead: -0.8, up: 0.82 };
const MAX = 9;
const BACK = 3;

export class Carriage {
  /** Where it stands and which way it faces (world direction cos, sin). */
  readonly pos = new Vector3();
  heading = Math.PI;
  speed = 0;
  driving = false;
  passenger: Npc | null = null;
  private heightAt: ((x: number, z: number, y?: number) => number) | null = null;
  private readonly smoke = new PipeSmoke(0xb36bff);
  private sway = 0;

  /** The hero's seat on the bench, world space. */
  bench(out: Vector3): Vector3 {
    return out.set(this.pos.x + Math.cos(this.heading) * BENCH.ahead, this.pos.y + BENCH.up, this.pos.z + Math.sin(this.heading) * BENCH.ahead);
  }

  /** One fixed step of driving: `fwd` -1..1 (S..W), `turn` -1..1 (D..A). */
  drive(fwd: number, turn: number, dt: number): void {
    const want = fwd > 0 ? MAX * fwd : fwd < 0 ? -BACK : 0;
    const accel = fwd === 0 ? 5 : Math.sign(want - this.speed) === Math.sign(this.speed) || this.speed === 0 ? 4 : 9;
    this.speed += Math.max(-accel * dt, Math.min(accel * dt, want - this.speed));
    // Steering bites with speed (a standing carriage does not spin), and reverses backwards.
    this.heading += turn * 1.3 * dt * Math.min(1, Math.abs(this.speed) / 3) * Math.sign(this.speed || 1);
    if (Math.abs(this.speed) < 0.01) return;
    const h = this.heightAt;
    if (!h) return;
    const step = this.speed * dt;
    const nx = this.pos.x + Math.cos(this.heading) * step;
    const nz = this.pos.z + Math.sin(this.heading) * step;
    // The leading wheels' ground: a wall, a drop (the moat, the void), or off the kingdom's floor stops it.
    const lead = Math.sign(this.speed) * 2.2;
    const fx = nx + Math.cos(this.heading) * lead, fz = nz + Math.sin(this.heading) * lead;
    const ahead = h(fx, fz, this.pos.y + 0.4);
    const here = h(nx, nz, this.pos.y + 0.4);
    if (Math.abs(ahead - this.pos.y) > 0.6 || Math.abs(here - this.pos.y) > 0.6 || ahead < GALAXY.y - 0.5) { this.speed = 0; return; }
    this.pos.x = nx;
    this.pos.z = nz;
    this.pos.y = here;
  }

  /** Builds it into the kingdom at (x, z) facing `heading`; returns the reins and the count's offer. */
  build(api: RealmApi, x: number, z: number, heading: number, heightAt: (x: number, z: number, y?: number) => number, trip: (s: number, sec: number) => void): Interactable[] {
    this.pos.set(x, heightAt(x, z), z);
    this.heading = heading;
    this.heightAt = heightAt;
    const fx = new Group();
    fx.add(this.smoke.emitter, this.smoke.particles);
    this.smoke.emitter.scale.setScalar(2.5);
    api.vfx({ group: fx, update: (dt) => this.smoke.update(dt) });
    const lm = modelLandmark('carriage', x, z, this.pos.y, {
      collider: 'none',
      update: (dt, root) => {
        // Rocking on its springs as it rolls.
        this.sway += dt * (2 + Math.abs(this.speed));
        root.position.set(this.pos.x, this.pos.y + Math.abs(Math.sin(this.sway * 1.7)) * Math.min(0.06, Math.abs(this.speed) * 0.01), this.pos.z);
        root.rotation.set(0, Math.PI - this.heading, Math.sin(this.sway) * Math.min(0.03, Math.abs(this.speed) * 0.004));
        const p = this.passenger;
        if (p) {
          p.pos.set(this.pos.x + Math.cos(this.heading) * INSIDE.ahead, this.pos.y + INSIDE.up, this.pos.z + Math.sin(this.heading) * INSIDE.ahead);
          p.yaw = this.heading + Math.PI / 2;
          // His pipe smoke drifting out of the window.
          this.smoke.emitter.position.set(p.pos.x + Math.cos(p.yaw) * 0.6, p.pos.y + 1.15, p.pos.z + Math.sin(p.yaw) * 0.6);
        }
        reins.pos.copy(this.bench(reins.pos)).setY(this.pos.y);
        offer.pos.set(this.pos.x + Math.cos(this.heading + Math.PI / 2) * 1.6 + Math.cos(this.heading) * INSIDE.ahead, this.pos.y, this.pos.z + Math.sin(this.heading + Math.PI / 2) * 1.6 + Math.sin(this.heading) * INSIDE.ahead);
      },
    });
    api.place(lm);
    void UNIT;
    const reins: Interactable = {
      pos: new Vector3(), range: 2.6, zone: GALAXY.id,
      label: () => (this.driving ? 'Climb down from the carriage' : 'Take the reins'),
      act: () => { this.driving = !this.driving; this.speed = 0; },
    };
    let shared = 0;
    const offer: Interactable = {
      pos: new Vector3(), range: 2.4, zone: GALAXY.id,
      label: () => (this.driving ? null : 'Share a smoke and a drink with the Count'),
      act: () => {
        shared++;
        // Whichever of his lines comes to him.
        const p = this.passenger;
        if (p) p.speak(1, Math.floor(Math.random() * p.def.lines.length));
        // A pull of his pipe and a sip of his cup: the quarter swims.
        trip(0.6 + Math.min(0.3, shared * 0.1), 6);
      },
    };
    return [reins, offer];
  }
}

/** The one carriage (main.ts drives it, the world places it). */
export const CARRIAGE = new Carriage();

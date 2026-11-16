/**
 * Point lights are expensive in a forward renderer: every lit pixel evaluates every light in the scene, wherever it
 * is. The world creates dozens of them (fires, portals, glowing doors) and keeps animating them; this budget turns
 * each into a hidden *source* and drives a fixed pool of real lights from the sources nearest the player. The pool
 * size never changes, so materials never recompile when you walk around or cross a portal.
 */
import { Color, PointLight, Vector3, type ColorRepresentation, type Object3D, type Scene } from 'three';

interface Source { light: PointLight; pos: Vector3; score: number }

/** A light a spell or a blast holds for a while (2026-11-16): it goes ahead of every placed light. */
export interface Transient {
  pos: Vector3;
  color: Color;
  intensity: number;
  distance: number;
  /** Set to let go of it. */
  done: boolean;
}
interface Flash { l: Transient; peak: number; t: number; life: number }

export class LightBudget {
  private readonly pool: PointLight[] = [];
  private readonly sources: Source[] = [];
  private readonly held: Transient[] = [];
  private readonly flashes: Flash[] = [];

  constructor(scene: Scene, readonly size = 8) {
    for (let i = 0; i < size; i++) {
      const l = new PointLight(0xffffff, 0, 1, 2);
      l.userData.pooled = true;
      this.pool.push(l);
      scene.add(l);
    }
  }

  /** Hides every point light under `root` (except the pool) and adopts it as a source. Safe to call again. */
  collect(root: Object3D): number {
    root.traverse((o) => {
      const l = o as PointLight;
      if (!l.isPointLight || l.userData.pooled || l.userData.budgeted) return;
      l.userData.budgeted = true;
      l.visible = false;
      this.sources.push({ light: l, pos: new Vector3(), score: 0 });
    });
    return this.sources.length;
  }

  /** A source counts only when every ancestor is visible (hidden realms and dead props drop out). */
  private shown(o: Object3D): boolean {
    for (let p = o.parent; p; p = p.parent) if (!p.visible) return false;
    return true;
  }

  /** A light at `at` that fades from `intensity` to nothing over `seconds` (an explosion lighting the ground). */
  flash(at: Vector3, color: ColorRepresentation, intensity: number, distance: number, seconds: number): void {
    const l = this.hold(color, intensity, distance);
    l.pos.copy(at);
    this.flashes.push({ l, peak: intensity, t: 0, life: seconds });
  }

  /** A light the caller moves and dims as it likes, until it sets `done`. */
  hold(color: ColorRepresentation, intensity: number, distance: number): Transient {
    const l: Transient = { pos: new Vector3(), color: new Color(color), intensity, distance, done: false };
    this.held.push(l);
    return l;
  }

  update(focus: Vector3, dt = 0): void {
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) { f.l.done = true; this.flashes.splice(i, 1); continue; }
      f.l.intensity = f.peak * (1 - k) * (1 - k);
    }
    for (let i = this.held.length - 1; i >= 0; i--) if (this.held[i].done) this.held.splice(i, 1);
    // Transient lights first (brightest first), then the nearest placed ones.
    const hot = this.held.filter((l) => l.intensity > 0 && l.pos.distanceTo(focus) < l.distance + 40).sort((a, b) => b.intensity - a.intensity);
    let i = 0;
    for (; i < Math.min(hot.length, this.pool.length); i++) {
      const p = this.pool[i], l = hot[i];
      p.position.copy(l.pos);
      p.color.copy(l.color);
      p.intensity = l.intensity;
      p.distance = l.distance;
      p.decay = 2;
    }
    this.place(focus, i);
  }

  private place(focus: Vector3, from: number): void {
    const live: Source[] = [];
    for (const s of this.sources) {
      if (s.light.intensity <= 0 || !this.shown(s.light)) continue;
      s.light.getWorldPosition(s.pos);
      const reach = s.light.distance > 0 ? s.light.distance : 40;
      const d = s.pos.distanceTo(focus);
      if (d > reach + 30) continue;
      // Nearest first, with bright, far-reaching lights pulled forward.
      s.score = d - reach * 0.5;
      live.push(s);
    }
    live.sort((a, b) => a.score - b.score);
    for (let i = from; i < this.pool.length; i++) {
      const p = this.pool[i];
      const s = live[i - from];
      if (!s) { p.intensity = 0; continue; }
      p.position.copy(s.pos);
      p.color.copy(s.light.color);
      p.intensity = s.light.intensity;
      p.distance = s.light.distance;
      p.decay = s.light.decay;
    }
  }
}

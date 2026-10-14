/**
 * Point lights are expensive in a forward renderer: every lit pixel evaluates every light in the scene, wherever it
 * is. The world creates dozens of them (fires, portals, glowing doors) and keeps animating them; this budget turns
 * each into a hidden *source* and drives a fixed pool of real lights from the sources nearest the player. The pool
 * size never changes, so materials never recompile when you walk around or cross a portal.
 */
import { PointLight, Vector3, type Object3D, type Scene } from 'three';

interface Source { light: PointLight; pos: Vector3; score: number }

export class LightBudget {
  private readonly pool: PointLight[] = [];
  private readonly sources: Source[] = [];

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

  update(focus: Vector3): void {
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
    for (let i = 0; i < this.pool.length; i++) {
      const p = this.pool[i];
      const s = live[i];
      if (!s) { p.intensity = 0; continue; }
      p.position.copy(s.pos);
      p.color.copy(s.light.color);
      p.intensity = s.light.intensity;
      p.distance = s.light.distance;
      p.decay = s.light.decay;
    }
  }
}

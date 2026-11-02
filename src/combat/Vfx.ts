import { Group, type Sprite, type Vector3 } from 'three';
import { glowSprite } from '../render/Glow';
import { disposeObject } from '../render/dispose';

interface Item { obj: Group; life: number; max: number; tick: (t: number, dt: number) => void; done?: () => void }

/**
 * The effects the pooled CombatFx (render/CombatFx.ts) does not do: the hero's lingering ground zones (burning ground,
 * a cast's burning path as one strip). Low-poly, additive, throwaway, removed when their life ends. Sparks, flashes,
 * shocks and dust moved to CombatFx, then the enemies' swing arcs (CombatFx.arc) and the bosses' warning rings
 * (CombatFx telegraphs, driven by the fight's step).
 */
export class Vfx {
  readonly group = new Group();
  private readonly items: Item[] = [];

  private add(item: Item): void {
    this.items.push(item);
    this.group.add(item.obj);
  }

  /** Persistent ground zone (frost ring, burning ground). Returns a remover. */
  zone(pos: Vector3, radius: number, color: number, duration: number): () => void {
    // Low flames and embers on the ground itself, no drawn ring.
    const g = new Group();
    const sprites: Sprite[] = [];
    const n = Math.round(4 + radius * 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, r = radius * Math.sqrt(Math.random());
      const s = glowSprite(color, 0.6 + Math.random() * 0.7, 0.55, true);
      s.position.set(pos.x + Math.cos(a) * r, pos.y + 0.25, pos.z + Math.sin(a) * r);
      sprites.push(s);
      g.add(s);
    }
    const item: Item = { obj: g, life: 0, max: duration, tick: (t) => {
      const fade = Math.min(1, (1 - t) * 5);
      sprites.forEach((s, i) => { (s.material as { opacity: number }).opacity = (0.35 + 0.25 * Math.sin(item.life * 9 + i * 2.1)) * fade; });
    } };
    this.add(item);
    return () => { item.life = item.max; };
  }

  /**
   * A cast's burning ground along its path as ONE strip (render/ShotFx.burnStrip) rather than a zone's ring and disc per
   * patch: the returned `lay(at)` adds the next patch. It pulses like a zone's ring and lasts `duration` past its last
   * patch, fading over the last fifth of that, as each patch's zone would.
   */
  path(color: number, radius: number, duration: number): (at: Vector3) => void {
    return (at) => { this.zone(at, radius * 0.7, color, duration); };
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      const t = Math.min(1, it.life / it.max);
      it.tick(t, dt);
      if (it.life >= it.max) {
        this.group.remove(it.obj);
        // Every effect builds its own geometry and material: free them (the glow texture is shared and kept).
        disposeObject(it.obj);
        it.done?.();
        this.items.splice(i, 1);
      }
    }
  }
}

import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, type Vector3 } from 'three';
import { disposeObject } from '../render/dispose';
import { burnStrip } from '../render/ShotFx';

interface Item { obj: Group | Mesh; life: number; max: number; tick: (t: number, dt: number) => void; done?: () => void }

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
    const geo = new RingGeometry(radius - 0.35, radius, 18);
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false });
    const ring = new Mesh(geo, mat);
    ring.position.set(pos.x, pos.y + 0.12, pos.z);
    ring.rotation.x = -Math.PI / 2;
    const inner = new Mesh(new RingGeometry(0.01, radius - 0.4, 18), new MeshBasicMaterial({ color, transparent: true, opacity: 0.05, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false }));
    inner.position.copy(ring.position);
    inner.rotation.x = -Math.PI / 2;
    const g = new Group();
    g.add(ring, inner);
    const item: Item = { obj: g, life: 0, max: duration, tick: (t) => { mat.opacity = 0.4 + Math.sin(t * duration * 9) * 0.15; if (t > 0.8) mat.opacity *= (1 - t) / 0.2; } };
    this.add(item);
    return () => { item.life = item.max; };
  }

  /**
   * A cast's burning ground along its path as ONE strip (render/ShotFx.burnStrip) rather than a zone's ring and disc per
   * patch: the returned `lay(at)` adds the next patch. It pulses like a zone's ring and lasts `duration` past its last
   * patch, fading over the last fifth of that, as each patch's zone would.
   */
  path(color: number, radius: number, duration: number): (at: Vector3) => void {
    const strip = burnStrip(color, radius);
    const item: Item = {
      obj: strip.object, life: 0, max: duration,
      tick: () => {
        const fade = Math.max(0, Math.min(1, (item.max - item.life) / (duration * 0.2)));
        strip.rim.value = (0.4 + Math.sin(item.life * 9) * 0.15) * fade;
        strip.fade.value = fade;
      },
    };
    this.add(item);
    return (at) => { if (strip.add(at)) item.max = item.life + duration; };
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

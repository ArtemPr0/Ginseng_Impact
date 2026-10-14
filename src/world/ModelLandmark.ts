/**
 * Every structure and creature in the world is "a Meshy model at a spot": this module places one by its
 * registry id, keeps its colliders, and stands a glowing placeholder there until the GLB exists.
 */
import { AdditiveBlending, CircleGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { PALETTE } from '../render/palette';
import { MODELS } from '../data/models';
import { loadModelOrWarn, ModelRig, yawToRotation } from '../models/ModelRig';
import { MissingModelPlaceholder } from '../models/Placeholder';
import type { Footprint } from './Colliders';
import type { Landmark } from './Landmarks';
import { RIVER_LEVEL } from './Terrain';
import { riverPoint } from './Water';

type HeightAt = (x: number, z: number) => number;

export interface ModelLandmarkOptions {
  footprints?: Footprint[];
  /** Clip to play once loaded (walkers want 'walk'); static exports breathe instead. */
  clip?: string;
  yaw?: number;
  /** Placeholder colour. */
  color?: number;
  /** Per-frame hook with the landmark root and the model once it has loaded. */
  update?: (dt: number, root: Group, model: ModelRig | null, player: Vector3) => void;
}

export interface ModelLandmark extends Landmark {
  root: Group;
  /** Set once the GLB has loaded. */
  model: ModelRig | null;
}

/** Places model `id` at (x, y, z). Missing file → placeholder marker (and one console warning per id). */
export function modelLandmark(id: string, x: number, z: number, y: number, opts: ModelLandmarkOptions = {}): ModelLandmark {
  const root = new Group();
  root.position.set(x, y, z);
  root.rotation.y = opts.yaw ?? 0;
  const placeholder = new MissingModelPlaceholder(opts.color ?? PALETTE.rune);
  placeholder.group.visible = false;
  root.add(placeholder.group);
  const lm: ModelLandmark = {
    object: root, root, model: null, footprints: opts.footprints ?? [], clip: opts.clip,
    update(dt, player) {
      if (lm.model) {
        lm.model.update(dt);
        if (!lm.model.playing) { breathe += dt; lm.model.root.scale.y = 1 + Math.sin(breathe * 0.8) * 0.015; lm.model.root.rotation.z = Math.sin(breathe * 0.5) * 0.01; }
      } else placeholder.update(dt);
      opts.update?.(dt, root, lm.model, player);
    },
  };
  let breathe = Math.random() * 10;
  void loadModelOrWarn(id, MODELS[id]?.label).then((gltf) => {
    if (!gltf) { placeholder.group.visible = true; return; }
    lm.model = new ModelRig(id, gltf);
    root.add(lm.model.root);
    if (opts.clip) lm.model.play(opts.clip);
  });
  return lm;
}

/** Moves a group along a closed path at `speed`, facing the next waypoint (+x forward), feet on the ground. */
export function pathWalker(g: Group, path: Array<[number, number]>, speed: number, heightAt: HeightAt, lift = 0): (dt: number) => void {
  let seg = 0;
  let along = 0;
  const pos = new Vector3(path[0][0], 0, path[0][1]);
  g.position.copy(pos);
  return (dt) => {
    const a = path[seg];
    const b = path[(seg + 1) % path.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    along += dt * speed;
    if (along >= len) { along = 0; seg = (seg + 1) % path.length; }
    const t = Math.min(1, along / len);
    pos.set(a[0] + (b[0] - a[0]) * t, 0, a[1] + (b[1] - a[1]) * t);
    pos.y = Math.max(heightAt(pos.x, pos.z), -20) + lift;
    g.position.lerp(pos, Math.min(1, dt * 3));
    const yaw = Math.atan2(b[0] - g.position.x, b[1] - g.position.z); // local +z (the model's front) toward the next waypoint
    g.rotation.y += Math.atan2(Math.sin(yaw - g.rotation.y), Math.cos(yaw - g.rotation.y)) * Math.min(1, dt * 1.5);
  };
}

/** A model that walks a loop (log giant, spider chapel, colossus, horse and rider). `trail` leaves glowing discs. */
export function walkerLandmark(id: string, path: Array<[number, number]>, speed: number, heightAt: HeightAt, opts: { lift?: number; clip?: string; trail?: boolean; color?: number } = {}): ModelLandmark {
  const lm = modelLandmark(id, path[0][0], path[0][1], 0, { clip: opts.clip ?? 'walk', color: opts.color });
  const step = pathWalker(lm.root, path, speed, heightAt, opts.lift ?? 0);
  const base = lm.update!;
  const discs: Mesh[] = [];
  const trailMat = new MeshBasicMaterial({ color: PALETTE.electric, transparent: true, opacity: 0.35, blending: AdditiveBlending, depthWrite: false, side: DoubleSide });
  let sinceDrop = 0;
  lm.update = (dt, player) => {
    step(dt);
    base(dt, player);
    if (!opts.trail) return;
    sinceDrop += dt;
    if (sinceDrop > 4) {
      sinceDrop = 0;
      const disc = new Mesh(new CircleGeometry(4.5, 16), trailMat.clone());
      disc.rotation.x = -Math.PI / 2;
      disc.position.set(lm.root.position.x, lm.root.position.y + 0.55, lm.root.position.z);
      lm.root.parent?.add(disc);
      discs.push(disc);
      if (discs.length > 24) { const old = discs.shift()!; old.parent?.remove(old); }
    }
    for (let i = 0; i < discs.length; i++) (discs[i].material as MeshBasicMaterial).opacity = 0.05 + (i / discs.length) * 0.3;
  };
  return lm;
}

/** A model carried down the river (boats). */
export function riverDrifter(id: string, startS: number, speed: number): ModelLandmark {
  const p0 = riverPoint(-startS);
  const lm = modelLandmark(id, p0.x, p0.z, RIVER_LEVEL + 0.05, { clip: 'idle' });
  let s = startS;
  let t = 0;
  const base = lm.update!;
  lm.update = (dt, player) => {
    t += dt;
    s += dt * speed;
    const p = riverPoint(-s);
    lm.root.position.set(p.x, RIVER_LEVEL + 0.05 + Math.sin(t * 1.4) * 0.06, p.z);
    lm.root.rotation.y = yawToRotation(p.yaw);
    lm.root.rotation.z = Math.sin(t * 1.1) * 0.03;
    base(dt, player);
  };
  return lm;
}

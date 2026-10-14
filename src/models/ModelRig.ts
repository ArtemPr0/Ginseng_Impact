import { AnimationAction, AnimationClip, AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, Object3D, Vector3 } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MODELS, type ModelDef } from '../data/models';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<GLTF | null>>();

/** Loads a GLB once; resolves null when the file is missing so callers keep the procedural fallback. */
export function loadModel(id: string): Promise<GLTF | null> {
  const def = MODELS[id];
  if (!def) return Promise.resolve(null);
  let p = cache.get(def.file);
  if (!p) {
    p = fetch(`/models/${def.file}`, { method: 'HEAD' })
      .then((r) => { const ct = (r.headers.get('content-type') ?? '').toLowerCase(); return r.ok && (ct.includes('octet') || ct.includes('gltf') || ct.includes('glb')) ? loader.loadAsync(`/models/${def.file}`) : null; })
      .catch(() => null);
    cache.set(def.file, p);
  }
  return p;
}

export type ClipKey = keyof NonNullable<ModelDef['clips']>;

/**
 * A loaded glTF character: scaled to its target height, feet on the ground, with crossfaded clip playback.
 * Attach `root` where the procedural rig's root used to be.
 */
export class ModelRig {
  readonly root = new Group();
  private readonly mixer: AnimationMixer;
  private readonly actions = new Map<string, AnimationAction>();
  private current: AnimationAction | null = null;
  private currentKey = '';
  readonly height: number;

  constructor(readonly id: string, gltf: GLTF) {
    const def = MODELS[id];
    const scene = gltf.scene;
    scene.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    // Normalise: scale to height, centre on x/z, feet at y = 0.
    const box = new Box3().setFromObject(scene);
    const size = new Vector3();
    box.getSize(size);
    const s = def.height / Math.max(0.001, size.y);
    scene.scale.setScalar(s);
    box.setFromObject(scene);
    const centre = new Vector3();
    box.getCenter(centre);
    scene.position.x -= centre.x;
    scene.position.z -= centre.z;
    scene.position.y -= box.min.y - (def.yOffset ?? 0);
    const holder = new Group();
    holder.rotation.y = def.yaw ?? 0;
    holder.add(scene);
    this.root.add(holder);
    this.height = def.height;
    this.mixer = new AnimationMixer(scene);
    for (const clip of gltf.animations) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    this.play('idle');
  }

  private find(key: ClipKey | string): AnimationAction | null {
    const def = MODELS[this.id];
    const wanted = (def.clips?.[key as ClipKey] ?? key).toLowerCase();
    for (const [name, action] of this.actions) if (name === wanted || name.includes(wanted)) return action;
    return null;
  }

  /** Crossfades to a clip. `once` clips (attacks, hits) clamp on their last frame. */
  play(key: ClipKey | string, once = false, speed = 1): boolean {
    const action = this.find(key);
    if (!action) return false;
    if (this.current === action && !once) { action.timeScale = speed; return true; }
    action.reset();
    action.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    action.timeScale = speed;
    action.enabled = true;
    if (this.current && this.current !== action) { action.crossFadeFrom(this.current, 0.18, true); }
    action.play();
    this.current = action;
    this.currentKey = key;
    return true;
  }

  get playing(): string {
    return this.currentKey;
  }

  /** True when a one-shot clip has finished. */
  get finished(): boolean {
    return !!this.current && this.current.loop === LoopOnce && !this.current.isRunning();
  }

  update(dt: number): void {
    this.mixer.update(dt);
  }

  static clipNames(gltf: GLTF): string[] {
    return gltf.animations.map((c: AnimationClip) => c.name);
  }

  get object(): Object3D {
    return this.root;
  }
}

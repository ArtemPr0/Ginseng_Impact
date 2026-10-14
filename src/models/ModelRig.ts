import { AnimationAction, AnimationClip, AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, type MeshStandardMaterial, Object3D, Vector3 } from 'three';
import { warnMissing } from './Placeholder';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { MODELS, type ModelDef } from '../data/models';

const loader = new GLTFLoader();
const files = new Map<string, Promise<GLTF | null>>();
const models = new Map<string, Promise<GLTF | null>>();

/** Fetches one GLB once; null when it is missing (the dev server answers 404 or an HTML fallback). */
function fetchGlb(file: string): Promise<GLTF | null> {
  let p = files.get(file);
  if (!p) {
    p = fetch(`/models/${file}`, { method: 'HEAD' })
      .then((r) => { const ct = (r.headers.get('content-type') ?? '').toLowerCase(); return r.ok && (ct.includes('octet') || ct.includes('gltf') || ct.includes('glb')) ? loader.loadAsync(`/models/${file}`) : null; })
      .catch(() => null);
    files.set(file, p);
  }
  return p;
}

/**
 * Loads a model once; resolves null when its file is missing so callers keep the procedural fallback.
 * Clips that live in their own files (`clipFiles`, one animation per GLB as Meshy exports them) are
 * appended to the base model's animation list under their clip key, so `play('walk')` finds them.
 */
export function loadModel(id: string): Promise<GLTF | null> {
  const def = MODELS[id];
  if (!def) return Promise.resolve(null);
  let p = models.get(id);
  if (!p) {
    p = fetchGlb(def.file).then(async (base) => {
      if (!base) return null;
      if (def.clipFiles) {
        const extra = await Promise.all(Object.entries(def.clipFiles).map(([key, file]) => fetchGlb(file as string).then((g) => ({ key, g }))));
        for (const { key, g } of extra) {
          if (!g) continue;
          for (const clip of g.animations) { const c = clip.clone(); c.name = key; base.animations.push(c); }
        }
      }
      return base;
    });
    models.set(id, p);
  }
  return p;
}

/** `loadModel` that also logs a missing file once (the console is the Meshy to-do list). */
export function loadModelOrWarn(id: string, label?: string): Promise<GLTF | null> {
  return loadModel(id).then((g) => { if (!g) warnMissing(id, label); return g; });
}

export type ClipKey = keyof NonNullable<ModelDef['clips']>;

/** The scale, offset and yaw that put a file at `def.height`, centred on x/z with its feet at y = 0. */
export function normaliseTransform(scene: Object3D, def: ModelDef): { scale: number; offset: Vector3; yaw: number } {
  const box = new Box3().setFromObject(scene);
  const size = new Vector3();
  box.getSize(size);
  const scale = def.height / Math.max(0.001, size.y);
  const centre = new Vector3();
  box.getCenter(centre);
  return { scale, offset: new Vector3(-centre.x * scale, -(box.min.y * scale) + (def.yOffset ?? 0), -centre.z * scale), yaw: def.yaw ?? 0 };
}

/** Every mesh of a scene in traversal order (flora instancing reads geometry + material from these). */
export function firstMeshes(scene: Object3D): Mesh[] {
  const out: Mesh[] = [];
  scene.traverse((o) => { if ((o as Mesh).isMesh) out.push(o as Mesh); });
  return out;
}

export interface ModelRigOptions {
  /** Give this instance its own material copies (enemies flash on hit without lighting up their siblings). */
  cloneMaterials?: boolean;
}

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
  /** Bounding-box height of the file before scaling (model units), for shader effects in local space. */
  readonly rawHeight: number;
  /** Materials of the loaded meshes (for per-model shader patches). */
  readonly materials: MeshStandardMaterial[] = [];

  private readonly scene: Group;

  constructor(readonly id: string, gltf: GLTF, opts: ModelRigOptions = {}) {
    const def = MODELS[id];
    // Each rig gets its own copy (skinned meshes need SkeletonUtils so bones and skeletons are duplicated together).
    const scene = cloneSkinned(gltf.scene) as Group;
    scene.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      o.frustumCulled = false;
      const mesh = o as Mesh;
      if (opts.cloneMaterials) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      // Meshy textures are unlit and often near-black; a faint cobalt self-light keeps the silhouette readable at night.
      const mats = Array.isArray(mesh.material) ? (mesh.material as MeshStandardMaterial[]) : [mesh.material as MeshStandardMaterial];
      for (const m of mats) {
        if (!m || !('emissive' in m)) continue;
        if (m.emissive.getHex() === 0) { m.emissive.setHex(0x16224e); m.emissiveIntensity = 0.42; }
        m.roughness = Math.max(m.roughness ?? 1, 0.6);
        m.userData.baseEmissive = m.emissive.getHex();
        m.userData.baseIntensity = m.emissiveIntensity;
        this.materials.push(m);
      }
    });
    // Normalise: scale to height, centre on x/z, feet at y = 0.
    const box = new Box3().setFromObject(scene);
    const size = new Vector3();
    box.getSize(size);
    this.rawHeight = size.y;
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
    this.scene = scene;
    this.height = def.height;
    this.mixer = new AnimationMixer(scene);
    for (const clip of gltf.animations) this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    this.play('idle');
  }

  private find(key: ClipKey | string): AnimationAction | null {
    const def = MODELS[this.id];
    // A clip entry may list alternatives ("slam|attack|punch"); the first alternative with a match wins.
    const wanted = (def.clips?.[key as ClipKey] ?? key).toLowerCase().split('|');
    for (const w of wanted) {
      for (const [name, action] of this.actions) if (name === w) return action;
      for (const [name, action] of this.actions) if (name.includes(w)) return action;
    }
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

  /** First node whose name matches (bone lookups: `bone(/right.?hand/i)`), or null. */
  bone(pattern: RegExp): Object3D | null {
    let found: Object3D | null = null;
    this.scene.traverse((o) => { if (!found && pattern.test(o.name)) found = o; });
    return found;
  }

  /** False for static exports (no animation clips at all). */
  get hasClips(): boolean {
    return this.actions.size > 0;
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

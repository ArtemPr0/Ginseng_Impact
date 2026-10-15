import { AnimationAction, AnimationClip, AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, type MeshStandardMaterial, Object3D, Quaternion, type SkinnedMesh, Vector3 } from 'three';
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

/**
 * Rotation about y that points a model at world direction (cos yaw, sin yaw). Every body in the game is a
 * Meshy export whose front is local +z (after the registry `yaw` correction), so this is the one formula.
 */
export function yawToRotation(yaw: number): number {
  return Math.PI / 2 - yaw;
}

/** `loadModel` that also logs a missing file once (the console is the Meshy to-do list). */
export function loadModelOrWarn(id: string, label?: string): Promise<GLTF | null> {
  return loadModel(id).then((g) => { if (!g) warnMissing(id, label); return g; });
}

export type ClipKey = keyof NonNullable<ModelDef['clips']>;

/**
 * Ground covered per second by Meshy's locomotion presets at normal speed, in heights of the body (measured from
 * the foot bones of the in-place clips). Playing a walk at speed × v / (rate × height) keeps the feet planted.
 */
const STRIDE_RATE: Array<[RegExp, number]> = [
  [/slow_orc_walk/, 0.127], [/monster_walk/, 0.179], [/crawl/, 0.2], [/running|run/, 1.56], [/walking|walk/, 0.877],
];

/**
 * Where in an action clip the blow lands (fraction of its length), from the hand bones' fastest swing / lowest
 * reach: Meshy's Attack swings at ~38%, the ground slam lands at ~60%, casts release around 45%.
 */
const STRIKE_AT: Array<[RegExp, number]> = [
  [/charged_ground_slam|slam/, 0.6], [/charged_spell_cast/, 0.45], [/mage_s\w*_cast|spell/, 0.32], [/zombie_scream|scream/, 0.3],
  [/shouting|shout|roar/, 0.2], [/attack|punch|slash|bite/, 0.38],
];

/** Clips whose hips wander off sideways (Meshy's Hit_Reaction drifts half a body): their root is pinned in place. */
const PIN_ROOT = /hit_reaction|hit/i;
const pinned = new WeakSet<AnimationClip>();

function pinRoot(clip: AnimationClip): void {
  if (pinned.has(clip)) return;
  pinned.add(clip);
  for (const t of clip.tracks) {
    if (!/hips\.position$/i.test(t.name)) continue;
    const v = t.values;
    for (let i = 3; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
  }
}

/** The scale, offset and yaw that put a file at `def.height`, centred on x/z with its feet at y = 0. */
export function normaliseTransform(scene: Object3D, def: ModelDef): { scale: number; offset: Vector3; yaw: number } {
  const box = new Box3().setFromObject(scene);
  const size = new Vector3();
  box.getSize(size);
  const scale = def.height / Math.max(0.001, size[def.fit ?? 'y']);
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
  /** The registry-yawed group around the file: anchors (pipe smoke, a held staff) live here, in the file's own frame. */
  readonly frame: Group;

  constructor(readonly id: string, gltf: GLTF, opts: ModelRigOptions = {}) {
    const def = MODELS[id];
    // Each rig gets its own copy (skinned meshes need SkeletonUtils so bones and skeletons are duplicated together).
    const scene = cloneSkinned(gltf.scene) as Group;
    scene.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      o.castShadow = true;
      o.receiveShadow = true;
      const mesh = o as Mesh;
      // Welded drafts ship without normals (scripts/model-tools drops per-face ones): smooth them here, once per file.
      if (!mesh.geometry.attributes.normal) mesh.geometry.computeVertexNormals();
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      // Off-screen models are skipped. Animated bodies get a padded bind-pose sphere so a swinging arm or a crawl
      // never pops out at the screen edge (computing a skinned sphere per frame would cost more than it saves).
      if ((o as SkinnedMesh).isSkinnedMesh) {
        const sphere = mesh.geometry.boundingSphere!.clone();
        sphere.radius *= 1.6;
        (o as SkinnedMesh).boundingSphere = sphere;
      }
      o.frustumCulled = true;
      if (opts.cloneMaterials) mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => m.clone()) : mesh.material.clone();
      // Meshy textures are unlit and often near-black; a faint cobalt self-light keeps the silhouette readable at night.
      const mats = Array.isArray(mesh.material) ? (mesh.material as MeshStandardMaterial[]) : [mesh.material as MeshStandardMaterial];
      for (const m of mats) {
        if (!m || !('emissive' in m)) continue;
        // A file without a material gets glTF's default (fully metallic → near black at night): make it matte clay.
        if (!m.map) { m.metalness = 0; if (def.tint !== undefined) m.color.setHex(def.tint); }
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
    const s = def.height / Math.max(0.001, size[def.fit ?? 'y']);
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
    this.frame = holder;
    this.height = def.height;
    this.mixer = new AnimationMixer(scene);
    for (const clip of gltf.animations) {
      if (PIN_ROOT.test(clip.name)) pinRoot(clip);
      this.actions.set(clip.name.toLowerCase(), this.mixer.clipAction(clip));
    }
    if (def.armDamp) {
      // Rest pose of the arms, captured before any clip runs (see ModelDef.armDamp).
      scene.traverse((o) => { if (/(left|right)(shoulder|arm|forearm)$/i.test(o.name)) this.damped.push({ bone: o, rest: o.quaternion.clone() }); });
      this.armDamp = def.armDamp;
    }
    this.play('idle');
  }

  private readonly damped: Array<{ bone: Object3D; rest: Quaternion }> = [];
  private armDamp = 0;

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

  /**
   * Crossfades to a clip. `once` clips (attacks, hits) clamp on their last frame. `fitTo` plays the whole clip
   * in that many seconds, so a swing finishes exactly when the game's attack window does.
   */
  play(key: ClipKey | string, once = false, speed = 1, fitTo?: number): boolean {
    const action = this.find(key);
    if (!action) return false;
    if (this.current === action && !once) { action.timeScale = speed; return true; }
    action.reset();
    action.setLoop(once ? LoopOnce : LoopRepeat, Infinity);
    action.clampWhenFinished = once;
    action.timeScale = fitTo ? Math.max(0.3, action.getClip().duration / Math.max(0.05, fitTo)) : speed;
    action.enabled = true;
    action.weight = key === 'idle' ? MODELS[this.id]?.idleBlend ?? 1 : 1;
    if (this.current && this.current !== action) { action.crossFadeFrom(this.current, 0.18, true); }
    action.play();
    this.current = action;
    this.currentKey = key;
    return true;
  }

  get playing(): string {
    return this.currentKey;
  }

  /** True when `key` resolves to a clip on this body. */
  has(key: ClipKey | string): boolean {
    return this.find(key) !== null;
  }

  /** Name of the clip `key` resolves to (lower case), or ''. */
  clipName(key: ClipKey | string): string {
    return this.find(key)?.getClip().name.toLowerCase() ?? '';
  }

  /** Metres per second the locomotion clip `key` covers at speed 1 on this body (0 when it is not a locomotion clip). */
  strideSpeed(key: ClipKey | string): number {
    const name = this.clipName(key);
    for (const [re, rate] of STRIDE_RATE) if (re.test(name)) return rate * this.height;
    return 0;
  }

  /**
   * Plays a one-shot so that its blow (STRIKE_AT) lands `seconds` from now: the wind-up of the clip fills the
   * wind-up of the move, and the follow-through plays out at the same pace afterwards.
   */
  playStrike(key: ClipKey | string, seconds: number): boolean {
    const action = this.find(key);
    if (!action) return false;
    const name = action.getClip().name.toLowerCase();
    let at = 0.4;
    for (const [re, f] of STRIKE_AT) if (re.test(name)) { at = f; break; }
    const speed = Math.min(4, Math.max(0.35, (action.getClip().duration * at) / Math.max(0.05, seconds)));
    return this.play(key, true, speed);
  }

  /** Freezes the current clip once it reaches `fraction` of its length (a jump's apex, a charge's wind-up). */
  holdAt(fraction: number): void {
    const a = this.current;
    if (a && !a.paused && a.time >= a.getClip().duration * fraction) a.paused = true;
  }

  /** Unfreezes the current clip and plays what is left of it in `seconds`. */
  resumeFit(seconds: number): void {
    const a = this.current;
    if (!a) return;
    a.paused = false;
    a.timeScale = Math.max(0.3, (a.getClip().duration - a.time) / Math.max(0.05, seconds));
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

  /** 0..1 position in the current clip (sync sounds to a looping action). */
  get clipPhase(): number {
    const a = this.current;
    if (!a) return 0;
    const d = a.getClip().duration;
    return d > 0 ? (a.time % d) / d : 0;
  }

  /** True when a one-shot clip has finished. */
  get finished(): boolean {
    return !!this.current && this.current.loop === LoopOnce && !this.current.isRunning();
  }

  update(dt: number): void {
    this.mixer.update(dt);
    for (const d of this.damped) d.bone.quaternion.slerp(d.rest, this.armDamp);
  }

  static clipNames(gltf: GLTF): string[] {
    return gltf.animations.map((c: AnimationClip) => c.name);
  }

  get object(): Object3D {
    return this.root;
  }
}

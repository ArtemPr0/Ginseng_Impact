import { AnimationAction, AnimationClip, AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, type MeshStandardMaterial, Object3D, Quaternion, QuaternionKeyframeTrack, type SkinnedMesh, Vector3, VectorKeyframeTrack } from 'three';
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

const faced = new WeakMap<AnimationClip, number>();
const _q = new Quaternion();
const _y = new Quaternion();
const _f = new Vector3();
const UP = new Vector3(0, 1, 0);

/** Keeps only `keep` of the hips' and spine's twist about the vertical in every key of the clip (see ModelDef.faceForward). */
function faceForward(clip: AnimationClip, keep: number): void {
  if (faced.has(clip)) return;
  faced.set(clip, keep);
  for (const t of clip.tracks) {
    // The hips carry most of the turn; the spine adds its own twist on top.
    if (!/(hips|spine\d?)\.quaternion$/i.test(t.name)) continue;
    const v = t.values;
    for (let i = 0; i < v.length; i += 4) {
      _q.set(v[i], v[i + 1], v[i + 2], v[i + 3]);
      _f.set(0, 0, 1).applyQuaternion(_q);
      const yaw = Math.atan2(_f.x, _f.z);
      _y.setFromAxisAngle(UP, (keep - 1) * yaw);
      _q.premultiply(_y);
      v[i] = _q.x; v[i + 1] = _q.y; v[i + 2] = _q.z; v[i + 3] = _q.w;
    }
  }
}

function pinRoot(clip: AnimationClip): void {
  if (pinned.has(clip)) return;
  pinned.add(clip);
  for (const t of clip.tracks) {
    if (!/hips\.position$/i.test(t.name)) continue;
    const v = t.values;
    for (let i = 3; i < v.length; i += 3) { v[i] = v[0]; v[i + 2] = v[2]; }
  }
}

const mirrored = new WeakMap<AnimationClip, AnimationClip>();

/**
 * The clip played left for right (ModelDef.mirror): each bone takes its mirror twin's turn away from the rest pose,
 * reflected across the body's centre plane (x = 0 in `frame`, the registry-yawed holder whose front is +z). Works on
 * the bones' frame-space rotations, so it does not care how the rig's left and right local axes are set up; it needs
 * a symmetric rest pose (Meshy rigs come from an A-pose). Baked once per clip by sampling it at 30 fps.
 */
function mirrorClip(clip: AnimationClip, scene: Object3D, frame: Object3D): AnimationClip {
  const done = mirrored.get(clip);
  if (done) return done;
  const bones: Object3D[] = [];
  scene.traverse((o) => { if ((o as { isBone?: boolean }).isBone) bones.push(o); });
  const byName = new Map(bones.map((b) => [b.name, b]));
  const twin = (b: Object3D): Object3D => byName.get(b.name.replace(/Left|Right/g, (m) => (m === 'Left' ? 'Right' : 'Left'))) ?? b;
  const restLocal = bones.map((b) => ({ q: b.quaternion.clone(), p: b.position.clone() }));
  const frameQ = new Quaternion();
  const toFrame = (o: Object3D, out: Quaternion): Quaternion => out.copy(frameQ).invert().multiply(o.getWorldQuaternion(new Quaternion()));
  frame.updateWorldMatrix(true, true);
  frame.getWorldQuaternion(frameQ);
  const rest = new Map(bones.map((b) => [b, toFrame(b, new Quaternion())]));
  const parentRest = new Map(bones.map((b) => [b, b.parent ? toFrame(b.parent, new Quaternion()) : new Quaternion()]));
  const hips = bones.find((b) => /hips$/i.test(b.name)) ?? null;
  const hasHipsPos = clip.tracks.some((t) => /hips\.position$/i.test(t.name));
  const mixer = new AnimationMixer(scene);
  const action = mixer.clipAction(clip);
  action.play();
  const n = Math.max(2, Math.round(clip.duration * 30) + 1);
  const times = new Float32Array(n);
  const quats = new Map(bones.map((b) => [b, new Float32Array(n * 4)]));
  const hipsPos = new Float32Array(n * 3);
  const delta = new Quaternion();
  const want = new Map<Object3D, Quaternion>();
  for (let i = 0; i < n; i++) {
    const t = (clip.duration * i) / (n - 1);
    times[i] = t;
    mixer.setTime(Math.min(t, clip.duration - 1e-4));
    frame.updateWorldMatrix(true, true);
    const posed = new Map(bones.map((b) => [b, toFrame(b, new Quaternion())]));
    // Frame-space target of each bone: its twin's turn from rest, reflected (x, y, z, w) → (x, -y, -z, w).
    for (const b of bones) {
      const tw = twin(b);
      delta.copy(posed.get(tw)!).multiply(rest.get(tw)!.clone().invert());
      delta.set(delta.x, -delta.y, -delta.z, delta.w);
      want.set(b, delta.clone().multiply(rest.get(b)!));
    }
    for (const b of bones) {
      const parentQ = b.parent && want.has(b.parent) ? want.get(b.parent)! : parentRest.get(b)!;
      const local = parentQ.clone().invert().multiply(want.get(b)!);
      quats.get(b)!.set([local.x, local.y, local.z, local.w], i * 4);
    }
    if (hips && hasHipsPos && hips.parent) {
      const w = hips.getWorldPosition(new Vector3());
      const f = frame.worldToLocal(w);
      f.x = -f.x;
      const back = hips.parent.worldToLocal(frame.localToWorld(f));
      hipsPos.set([back.x, back.y, back.z], i * 3);
    }
  }
  action.stop();
  mixer.uncacheRoot(scene);
  bones.forEach((b, i) => { b.quaternion.copy(restLocal[i].q); b.position.copy(restLocal[i].p); });
  const animated = new Set(clip.tracks.map((t) => t.name.split('.')[0]));
  const tracks = bones
    .filter((b) => animated.has(b.name) || animated.has(twin(b).name))
    .map((b) => new QuaternionKeyframeTrack(`${b.name}.quaternion`, times, quats.get(b)!) as QuaternionKeyframeTrack | VectorKeyframeTrack);
  if (hips && hasHipsPos) tracks.push(new VectorKeyframeTrack(`${hips.name}.position`, times, hipsPos));
  const out = new AnimationClip(clip.name, clip.duration, tracks);
  mirrored.set(clip, out);
  return out;
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
  private readonly layers = new Map<string, AnimationAction>();
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
    // Clips played left for right (Sir Aldric's idle: the forward, bent arm holds his cup in the left hand).
    const flip = new Set((def.mirror ?? []).flatMap((k) => (def.clips?.[k] ?? k).toLowerCase().split('|')));
    let flipped = false;
    for (let clip of gltf.animations) {
      if (PIN_ROOT.test(clip.name)) pinRoot(clip);
      if (def.faceForward !== undefined) faceForward(clip, def.faceForward);
      if (!flipped && flip.has(clip.name.toLowerCase())) { clip = mirrorClip(clip, scene, holder); flipped = true; }
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
    // Asking again for the clip that is playing keeps it going (and lets go of a holdAt freeze).
    if (this.current === action && !once) { action.timeScale = speed; action.paused = false; return true; }
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

  /**
   * A layer: clip `key` cut down to the rotations of the bones matching `bones`, as its own action (stopped). Played
   * with a large weight it takes those bones over from the base clip (the mixer averages by weight) and leaves the
   * rest of the body alone: a sip of lean while walking.
   */
  layer(key: ClipKey | string, bones: RegExp): AnimationAction | null {
    const base = this.find(key);
    if (!base) return null;
    const clip = base.getClip();
    const id = `${clip.name}#${bones.source}`;
    let a = this.layers.get(id);
    if (!a) {
      const tracks = clip.tracks.filter((t) => t.name.endsWith('.quaternion') && bones.test(t.name.slice(0, -'.quaternion'.length)));
      a = this.mixer.clipAction(new AnimationClip(id, clip.duration, tracks));
      this.layers.set(id, a);
    }
    return a;
  }

  /** Stops every clip: the bones keep the pose they have (the caller moves them by hand). */
  stopAll(): void {
    this.mixer.stopAllAction();
    this.current = null;
    this.currentKey = '';
  }

  /** Shows the current clip frozen at `fraction` of its length (a held pose). */
  freezeAt(fraction: number): void {
    const a = this.current;
    if (!a) return;
    a.time = a.getClip().duration * fraction;
    a.paused = true;
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

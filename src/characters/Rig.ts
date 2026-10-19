import { AdditiveBlending, type AnimationAction, type Bone, BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, LoopOnce, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Vector3, type Object3D, type SkinnedMesh, type Sprite } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModelOrWarn, ModelRig } from '../models/ModelRig';
import { MissingModelPlaceholder } from '../models/Placeholder';
import { PipeSmoke } from '../render/Smoke';
import { capeKeepAttribute, patchCape, patchRobeWind } from '../render/Materials';
import { glowSprite } from '../render/Glow';
import { LeanCup } from '../render/LeanCup';
import { MODELS } from '../data/models';
import type { Mode } from '../player/CharacterController';
import type { CharacterDef, WeaponKind } from './roster';
import { CYCLONE, type BurstKind } from '../combat/Skills';

export interface RigPose {
  mode: Mode;
  /** Horizontal speed, m/s. */
  speed: number;
  /** 0..1 progress of an attack swing or cast, undefined when idle. */
  attack?: number;
  /** Which combo hit (0..2), 'skill', 'heavy' (charged) or 'burst'. Drives the swing shape. */
  attackKind?: number | 'skill' | 'heavy' | 'burst';
  /** Static NPC poses. */
  pose?: 'sit' | 'kneel' | 'row' | 'ride' | 'carry' | 'drink' | 'fish' | 'telescope' | 'read' | 'pray' | 'stir' | 'offer' | 'bow' | 'banner' | 'sitSword' | 'lantern' | 'throne' | 'watch' | 'talk';
  /** Seconds since landing, for the landing crouch. */
  landed?: number;
  /** How long the whole swing or cast lasts, so the clip is fitted to it. */
  attackDuration?: number;
  /** Holding the heavy attack: freeze the swing at its wind-up. */
  charging?: boolean;
  /** The hero's burst (Q) in progress: which one and seconds since it began. */
  burst?: { kind: BurstKind; t: number };
  /** Climbing: metres per second along the wall (up positive), so the climb clip keeps pace and stops when still. */
  climbRate?: number;
}



/** How far the weapon's tip sits from the hand, for the swing trail. */
const WEAPON_REACH: Record<WeaponKind, number> = { sword: 1.1, greatsword: 1.6, bow: 0.7, staff: 1.5 };
/** Model pulled into the right hand while attacking; null when the body's own baked weapon does the job. */
const WEAPON_MODEL: Record<WeaponKind, string | null> = { sword: null, greatsword: 'greatsword', bow: null, staff: 'staff' };
/**
 * How each hero flies: Orlan simply floats (his robe is enough), Wren straddles her bow and rides it, Sir Aldric
 * glides on his cape. Ride props sit in the body's own frame (x = the body's left, y up from the feet, z forward),
 * metres. Wren's bow lies lengthwise under her, string side up (archer-bow.glb: long axis y, string toward +x), so its
 * front limb rises ahead of her like a prow.
 */
type RideProp = { model: string; x: number; y: number; z: number; rx: number; ry: number; rz: number; slide: number };
const RIDE: Record<WeaponKind, RideProp | 'cape' | 'float' | null> = {
  staff: 'float',
  bow: { model: 'bow', x: 0, y: 0.8, z: 0.1, rx: Math.PI / 2, ry: Math.PI / 2, rz: 0, slide: -0.75 },
  greatsword: 'cape',
  sword: 'cape',
};
/** The playable bodies (NPC rigs never fly or carry a hero's props). */
const HEROES = new Set(['knight', 'archer', 'wizard']);
/**
 * Wren's bow in her left hand on foot (mixamorigLeftHand frame, solved at full draw of Archery_Shot: upright, string
 * toward her), and how far each shot clip turns her side-on so the arrow line points at the target (the clips aim
 * ~100° to her side, as real archers stand).
 */
const HELD_BOW = { x: 0, y: 0.08, z: 0, rx: 0.453, ry: -0.126, rz: -1.191, slide: -0.75 };
/** Between shots the bow is slung across her back, over the quiver (body frame: centre, and the bow's long axis). */
const STOWED_BOW = { at: new Vector3(0.02, 1.2, -0.2), along: new Vector3(-0.5, 1, 0).normalize() };
const SHOT_TURN: Record<string, number> = { attack: -1.74, heavy: -2.36, cast: -1.48 };
/** Wren astride the bow: thigh lift, knee bend, legs apart, hands down on the front limb. */
/**
 * Wren astride the bow: thigh lift, knee bend, legs apart, lean; her arms are aimed (not turned) so the hands rest on
 * the bow's front limb whatever her idle clip does: `elbow` and `grip` are points in the body frame (left side; the
 * right side mirrors x). `frame`: the moment of her idle clip she holds while riding.
 */
const SEAT = { thigh: -1.25, knee: 1.35, spread: 0.22, lean: 0.18, frame: 0.55, elbow: [0.24, 1.1, 0.08], grip: [0.07, 0.9, 0.36] };
const HAND_BONE = /right.?hand|hand[_.]?r\b|righthand/i;
const _pq = new Quaternion();
const _bq = new Quaternion();
const _q = new Quaternion();
const _fq = new Quaternion();
const LATERAL = new Vector3();
const FORWARD = new Vector3();
const UP = new Vector3();
/**
 * How Sir Aldric holds his cup of lean (left hand, metres): its axis along his knuckles (rim toward the index finger),
 * the middle knuckle `knuckleAt` up the cup, its wall `palm` off the knuckle line on the palm side and set `inset`
 * back toward the wrist; then every finger joint curls until the next one lies `finger` (thumb `thumb`) off the wall,
 * the gauntlet's thickness. The sip is Stand_and_Drink's left arm, neck and head, layered over whatever he is doing,
 * from `from` to `to` of the clip (hand at the mouth around 0.4–0.55), with a slurp at `slurpAt`.
 */
const CUP_HOLD = { knuckleAt: 0.085, palm: 0.017, inset: 0.018, finger: 0.011, thumb: 0.012 };
const FINGERS = ['Thumb', 'Index', 'Middle', 'Ring', 'Pinky'] as const;
const SIP = { from: 0.3, to: 0.66, slurpAt: 0.45, weight: 30, every: [10, 16] as const, tilt: 1.2 };
const SIP_BONES = /left(shoulder|arm|forearm|hand)|neck|head/i;
const LEFT_ARM = /left(shoulder|arm|forearm|hand)/i;
const RIGHT_ARM = /right(shoulder|arm|forearm|hand)/i;
/**
 * His mouth, from the head bone along the body's up and forward axes (metres): where a sip brings the rim. On his
 * helmet (measured) the eye slit is 0.09-0.1 up and the face plate's front 0.14-0.15 forward; the mouth is low on it.
 */
const MOUTH = { up: 0.035, fwd: 0.155 };
/** In flight the cup is carried at the chest, gripped as at the start of a sip (Stand_and_Drink at this fraction). */
const CARRY_AT = 0.22;
/**
 * Wren's snack: a psychedelic mushroom from the pouch on her right hip to her mouth, every `every` seconds while she
 * stands about. Points in her body frame (metres; her right side is -x). `size`: the mushroom, metres tall.
 */
const SHROOM = {
  every: [7, 12] as const, size: 0.12, frame: 0,
  /** Her mouth, from the head bone along the body's up and forward axes (metres, measured): where a bite brings the cap. */
  bite: { up: 0.035, fwd: 0.12 },
  /** As she bites, the mushroom points this far (radians) back from straight up, toward her lips. */
  biteTilt: 0.6,
  /** How far each fingertip's bone stays off the stem's centre (the stem's radius plus a finger pad), metres. */
  stem: 0.011,
  /** Her right arm hanging easy between snacks (the calm frame holds it out, palm up). */
  restElbow: [-0.23, 1.13, -0.04], restHand: [-0.25, 0.87, 0.03],
  pouch: [-0.21, 0.93, 0.1], pouchElbow: [-0.33, 1.12, -0.05], mouth: [-0.04, 1.49, 0.17], mouthElbow: [-0.26, 1.2, 0.1],
};
/**
 * Wren's hands: her mesh was modelled with open hands and crumples when a finger joint bends past about 30°, so the
 * clips' finger curls are eased toward that open bind pose, keeping `keep` of them (`keepShot` while she shoots, when
 * one hand holds the bow and the other the string).
 */
const HAND = { keep: 0.38, keepShot: 0.8, close: 0.8 };
/** Where a swimmer's hips ride above the controller's feet: just under the surface (CONTROLLER.swimFloat = 1.05). */
const SWIM_HIPS = 0.92;
const _t = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _ax = new Vector3();
const _mouth = new Vector3();
const _drink = new Vector3();
const _q2v = new Vector3();
const _drink2 = new Vector3();
const _pinch = new Vector3();
const _pinchAcross = new Vector3();
const _pinchT = new Vector3();
const _pinchI = new Vector3();
/** How far back a seated body may lean (radians): a relaxed slouch, never lying flat. */
const SIT_LEAN = 0.22;
const _rim = new Vector3();
const smooth = (x: number) => { const k = Math.max(0, Math.min(1, x)); return k * k * (3 - 2 * k); };

/** Turns a bone about a world-space axis (applied on top of whatever the clip posed this frame). */
function turnBone(bone: Object3D | null, axis: Vector3, angle: number): void {
  if (!bone || !bone.parent || angle === 0) return;
  bone.parent.getWorldQuaternion(_pq);
  _bq.copy(_pq).multiply(bone.quaternion);
  _q.setFromAxisAngle(axis, angle);
  _bq.premultiply(_q);
  bone.quaternion.copy(_pq.invert().multiply(_bq));
  bone.updateWorldMatrix(false, true);
}
const OFF_HAND_BONE = /left.?hand|hand[_.]?l\b|lefthand/i;

/** Each finger bone's local rotation in the skin's bind pose (from the skeleton's inverse bind matrices). */
function bindFingers(model: ModelRig): Array<{ bone: Object3D; rest: Quaternion; clip: Quaternion; held: boolean }> {
  let skinned: SkinnedMesh | null = null;
  model.root.traverse((o) => { if (!skinned && (o as SkinnedMesh).isSkinnedMesh) skinned = o as SkinnedMesh; });
  const sk = (skinned as SkinnedMesh | null)?.skeleton;
  if (!sk) return [];
  const out: Array<{ bone: Object3D; rest: Quaternion; clip: Quaternion; held: boolean }> = [];
  sk.bones.forEach((bone, i) => {
    if (!/hand(thumb|index|middle|ring|pinky)[1-3]$/i.test(bone.name)) return;
    const pi = sk.bones.indexOf(bone.parent as Bone);
    if (pi < 0) return;
    const local = sk.boneInverses[pi].clone().multiply(sk.boneInverses[i].clone().invert());
    const rest = new Quaternion();
    local.decompose(new Vector3(), rest, new Vector3());
    out.push({ bone, rest, clip: new Quaternion(), held: false });
  });
  return out;
}

/**
 * A character body: a Meshy glTF driven by pose → clip mapping, with the weapon trail and Orlan's pipe smoke.
 * Until the model file exists the body is a MissingModelPlaceholder. The root sits at the feet; the caller
 * sets `root.rotation.y` from the controller yaw.
 */
export class Rig {
  readonly root = new Group();
  /** The loaded glTF, once its file is on disk. */
  model: ModelRig | null = null;
  private placeholder: MissingModelPlaceholder | null;
  private hand: Object3D | null = null;
  private offHand: Object3D | null = null;
  /** Weapon prop parented to the hand (staff, greatsword); scaled in while attacking. */
  private prop: Group | null = null;
  private propRig: ModelRig | null = null;
  private propBase = 1;
  private propShown = 0;
  /** Boneless bodies hold their prop at a fixed anchor that the rig swings itself. */
  private anchor: Group | null = null;
  private wasCharging = false;
  private lastKind: RigPose['attackKind'] = undefined;
  /** Orlan's pipe. */
  private smoke: PipeSmoke | null = null;
  private staticPhase = Math.random() * 6;
  /** The glow under Orlan's hem while he floats up a wall. */
  private climbGlow: Sprite | null = null;
  private readonly trail: Mesh;
  /** World-space effects: the trail and the pipe smoke. */
  private readonly fx = new Group();
  private readonly trailPoints: Vector3[] = [];
  private readonly trailPos: Float32BufferAttribute;
  private readonly tipA = new Vector3();
  private readonly tipB = new Vector3();
  private readonly axis = new Vector3();
  private lastAttack: number | undefined;
  private trailAttack: number | undefined;
  /** 0 on foot … 1 flying, eased, so take-off and landing blend. */
  private flight = 0;
  private flightTime = 0;
  /** The staff or bow ridden while flying, and its exhaust glow. */
  private ride: Group | null = null;
  private rideGlow: Sprite | null = null;
  private capeLift: { value: number } | null = null;
  /** Wren's bow in hand for a shot and slung on her back between shots (in the air she shoots off the one she rides). */
  private heldBow: Group | null = null;
  private stowedBow: Group | null = null;
  /** Wren's mushroom snack: the mushroom in her hand, the snack in progress, and the sparkles it leaves. */
  private shroom: Group | null = null;
  /** Its height in the holder's units (the holder is scaled to the hand), and her fingers' bind pose (see HAND). */
  private shroomLen = 0;
  private shroomH = 0;
  /** Her fingers' bind pose, and the clip's rotation they had before being eased this frame (put back next frame). */
  private fingerRest: Array<{ bone: Object3D; rest: Quaternion; clip: Quaternion; held: boolean }> = [];
  /** Hand and finger bones by name (`RightHandIndex1`, `LeftHand`...), looked up once. */
  private readonly digits = new Map<string, Object3D | null>();
  private snack: { t: number } | null = null;
  private snackIn: number = SHROOM.every[0];
  private readonly sparkles: Sprite[] = [];
  private tripLeft = 0;
  /** Spin of the lean cyclone (radians about the vertical) and the lean flung off the blade. */
  private spin = 0;
  private readonly flung: Array<{ s: Sprite; v: Vector3; age: number }> = [];
  /** Eased side-on turn of a shot (radians about the vertical). */
  private shotTurn = 0;
  private shotClip = '';
  private readonly seat = SEAT;
  /** Eased lift that floats a swimming body at the surface (see swimPose). */
  private swimLift = 0;
  /** Sir Aldric's lean: the cup, its pivot on the hand (grip orientation in cupGripQ), and the sip in progress. */
  private cup: LeanCup | null = null;
  private cupPivot: Group | null = null;
  private readonly cupGripQ = new Quaternion();
  /** His fingers wrapped round the cup (local rotations, solved once: the cup never moves in his hand). */
  private cupFingers: Array<{ bone: Object3D; q: Quaternion }> | null = null;
  /**
   * An NPC's lean cup (holdCup): wanted, the loaded model, then the cup seated in whichever hand the NPC's clip lifts
   * to the mouth, the fingers closed round it (the clip does the drinking).
   */
  private npcCupWanted = false;
  private npcCupModel: GLTF | null = null;
  private npcCup: { cup: LeanCup; fingers: Array<{ bone: Object3D; q: Quaternion }> } | null = null;
  private sip: { action: AnimationAction; w: number; slurped: boolean } | null = null;
  private sipIn: number = SIP.every[0];
  /** The carry pose (cup at the chest in flight) is playing. */
  private carrying = false;
  /** Lean on the blade during the cyclone. */
  private readonly bladeGlows: Sprite[] = [];
  /** Sir Aldric's one-armed swing from the air (the attack clip's right arm over the glide). */
  private airSwing = false;
  /** Sounds the rig asks for (set by main). */
  static sound: { slurp(gain: number): void; rustle?(): void; munch?(): void } | null = null;
  /** Bones turned procedurally this frame, with their clip pose (see turn). */
  private readonly turned: Array<{ bone: Object3D; q: Quaternion }> = [];
  private bones: Record<'hips' | 'spine0' | 'spine' | 'spine2' | 'neck' | 'head' | 'lArm' | 'rArm' | 'lForeArm' | 'rForeArm' | 'lUpLeg' | 'rUpLeg' | 'lLeg' | 'rLeg', Object3D | null> | null = null;

  constructor(readonly def: CharacterDef, modelId: string = def.id) {
    // Weapon trail ribbon (world space).
    const N = 18;
    this.trailPos = new Float32BufferAttribute(new Float32Array(N * 2 * 3), 3);
    const tg = new BufferGeometry();
    tg.setAttribute('position', this.trailPos);
    const idx: number[] = [];
    for (let i = 0; i < N - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    tg.setIndex(idx);
    const alphas = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { alphas[i * 2] = alphas[i * 2 + 1] = 1 - i / N; }
    tg.setAttribute('alpha', new BufferAttribute(alphas, 1));
    this.trail = new Mesh(tg, new MeshBasicMaterial({ color: def.accent, transparent: true, opacity: 0.0, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false, toneMapped: false }));
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    this.fx.add(this.trail);
    for (let i = 0; i < N; i++) this.trailPoints.push(new Vector3(), new Vector3());
    // Marker until the Meshy file arrives.
    this.placeholder = new MissingModelPlaceholder(def.accent);
    this.root.add(this.placeholder.group);
    void loadModelOrWarn(modelId, def.name).then((g) => { if (g) this.useModel(modelId, g); });
  }

  /** Installs a loaded glTF as the body (the trail stays). */
  useModel(id: string, gltf: GLTF): void {
    if (this.placeholder) { this.root.remove(this.placeholder.group); this.placeholder = null; }
    if (this.model) this.root.remove(this.model.root);
    this.model = new ModelRig(id, gltf);
    this.root.add(this.model.root);
    this.hand = this.model.bone(HAND_BONE);
    this.offHand = this.model.bone(OFF_HAND_BONE);
    const hand = MODELS[id]?.hand;
    if (!this.hand && hand) {
      this.anchor = new Group();
      this.anchor.position.set(hand.x, hand.y, hand.z);
      this.model.frame.add(this.anchor);
    }
    const propId = WEAPON_MODEL[this.def.weapon];
    if (propId && (this.hand || this.anchor)) void loadModelOrWarn(propId, MODELS[propId]?.label).then((g) => { if (g) this.attachProp(propId, g); });
    if (MODELS[id]?.robe) for (const mat of this.model.materials) { patchRobeWind(mat, this.model.rawHeight * 0.55, 0.05); mat.needsUpdate = true; }
    const anchor = MODELS[id]?.smoke;
    if (anchor) {
      // On the pipe's bowl (wizard.glb, measured: right of the beard at chest height); the smoke itself is world-space.
      this.smoke = new PipeSmoke();
      this.smoke.emitter.position.set(anchor.x, anchor.y, anchor.z);
      this.model.frame.add(this.smoke.emitter);
      this.fx.add(this.smoke.particles);
    }
    if (id === 'knight' && this.offHand) void loadModelOrWarn('lean-cup', MODELS['lean-cup']?.label).then((g) => { if (g) this.attachCup(g); });
    if (this.npcCupWanted) this.loadNpcCup();
    if (id === 'archer' && this.hand) void loadModelOrWarn('purple-mushroom', MODELS['purple-mushroom']?.label).then((g) => { if (g) this.attachShroom(g); });
    if (id === 'archer') this.fingerRest = bindFingers(this.model);
    if (id === 'archer') for (let i = 0; i < 14; i++) {
      const sp = glowSprite(0xffffff, 0.05, 0, true);
      sp.visible = false;
      this.fx.add(sp);
      this.sparkles.push(sp);
    }
    if (this.model.hasClips) {
      const b = (re: RegExp) => this.model!.bone(re);
      this.bones = {
        hips: b(/hips$/i), spine0: b(/spine$/i), spine: b(/spine1$/i), spine2: b(/spine2$/i), neck: b(/neck$/i), head: b(/(^|:|mixamorig)head$/i),
        lArm: b(/leftarm$/i), rArm: b(/rightarm$/i), lForeArm: b(/leftforearm$/i), rForeArm: b(/rightforearm$/i),
        lUpLeg: b(/leftupleg$/i), rUpLeg: b(/rightupleg$/i), lLeg: b(/leftleg$/i), rLeg: b(/rightleg$/i),
      };
    }
    const ride = RIDE[this.def.weapon];
    if (ride === 'cape' && id === 'knight') {
      // Sir Aldric's cape hangs behind his back from the shoulders to the shins (knight.glb, bind pose: the hem
      // sheet lies behind z = -0.07 h, the calves in front of it).
      const mat = this.model.materials[0];
      let skinned: SkinnedMesh | null = null;
      this.model.root.traverse((o) => { if (!skinned && (o as SkinnedMesh).isSkinnedMesh) skinned = o as SkinnedMesh; });
      if (skinned) capeKeepAttribute(skinned);
      if (mat) this.capeLift = patchCape(mat, this.model.rawHeight, { shoulder: 0.79, back: -0.055, depth: 0.02, masked: !!skinned });
    } else if (ride && typeof ride === 'object' && HEROES.has(id)) {
      void loadModelOrWarn(ride.model, MODELS[ride.model]?.label).then((g) => {
        if (!g) return;
        this.attachRide(ride.model, g, ride);
        if (id === 'archer' && this.offHand) this.attachHeldBow(ride.model, g);
      });
    }
  }

  /** Sir Aldric's cup of lean, in his left hand. */
  private attachCup(gltf: GLTF): void {
    if (!this.model || !this.offHand) return;
    const rig = new ModelRig('lean-cup', gltf);
    this.cup = new LeanCup(rig.root, rig.height);
    this.model.root.updateWorldMatrix(true, true);
    const ws = new Vector3();
    this.offHand.getWorldScale(ws);
    const holder = new Group();
    holder.scale.setScalar(1 / Math.max(1e-4, ws.y));
    // (Seated in the hand on the first frame it is posed: see fitCup.)
    const pivot = new Group();
    pivot.add(this.cup.group);
    holder.add(pivot);
    this.offHand.add(holder);
    this.fx.add(this.cup.drops);
    this.cupPivot = pivot;
  }

  /**
   * The lean: a sip every so often while he stands or walks (the drink clip's arm and head layered over the base
   * clip, the rim brought to his mouth); anything else he does (an attack, a charge, a jump, flight, swimming) fades
   * the sip out at once and the base clip has the arm back. Between sips the wrist keeps the cup level; in flight he
   * carries it at his chest, the wrist turned up so the lean stays in. The liquid sloshes either way.
   */
  private animateCup(pose: RigPose, dt: number): void {
    const m = this.model;
    if (!this.cup || !this.cupPivot || !m) return;
    if (!this.cupFingers) this.fitCup();
    // On a wall both hands climb: the cup is tucked away until he is off the rock (the fingers follow the clip).
    const climbing = pose.mode === 'climb';
    this.cup.group.visible = !climbing;
    if (climbing) return;
    const cyclone = pose.burst?.kind === 'cyclone' ? pose.burst.t : -1;
    const calm = pose.mode === 'ground' && pose.attack === undefined && !pose.charging && pose.speed < 5.5;
    if (!this.sip) {
      this.sipIn -= dt;
      if (this.sipIn <= 0 && calm) {
        const a = m.layer('drink', SIP_BONES);
        if (a) {
          a.reset();
          a.setLoop(LoopOnce, 1);
          a.clampWhenFinished = true;
          a.time = a.getClip().duration * SIP.from;
          a.setEffectiveWeight(0);
          a.play();
          this.sip = { action: a, w: 0, slurped: false };
        }
        this.sipIn = SIP.every[0] + Math.random() * (SIP.every[1] - SIP.every[0]);
      }
    }
    let lead = 0;
    let sipK = 0;
    if (this.sip) {
      const s = this.sip;
      const k = (s.action.time / s.action.getClip().duration - SIP.from) / (SIP.to - SIP.from);
      sipK = k;
      const done = !calm || k >= 1;
      s.w += ((done ? 0 : 1) - s.w) * Math.min(1, dt * (calm ? 5 : 25));
      s.action.setEffectiveWeight(s.w * SIP.weight);
      if (!s.slurped && k >= SIP.slurpAt) { s.slurped = true; Rig.sound?.slurp(1); }
      if (done && s.w < 0.02) { s.action.stop(); this.sip = null; }
      lead = s.w;
    }
    // In flight: the left arm holds the opening pose of a sip (cup at the chest), frozen, while the cape glides.
    const carry = m.layer('drink', LEFT_ARM);
    const carryW = cyclone < 0 ? this.flight : 0;
    if (carry) {
      if (carryW > 0.01) {
        if (!this.carrying) { carry.reset(); carry.play(); this.carrying = true; }
        carry.time = carry.getClip().duration * CARRY_AT;
        carry.paused = true;
        carry.setEffectiveWeight(carryW * SIP.weight);
      } else if (this.carrying) { carry.stop(); this.carrying = false; }
    }
    // The cup never turns in his fist: the wrist does the tipping and the levelling.
    this.cupPivot.quaternion.copy(this.cupGripQ);
    if (cyclone >= 0 && cyclone < CYCLONE.pour) {
      // Tipped over the blade (the hand rolls about the forearm, rim toward the sword): the lean runs down it.
      const k = Math.min(1, cyclone / 0.25) * Math.min(1, (CYCLONE.pour - cyclone) / 0.15);
      this.pourByWrist(1.7 * k);
      if (k > 0.5) this.pourDrop();
    } else this.levelByWrist(this.flight > 0.05 ? this.flight : 0.92 * (1 - lead));
    // A sip tips the cup toward his face (base up and away, by the wrist) and brings the rim to his mouth (the clip
    // alone lifts it to the visor): the wrist, the shoulder and the elbow are turned in turn until both hold.
    if (this.sip && lead > 0.02 && this.bones?.head) {
      const bn = this.bones;
      m.root.updateWorldMatrix(true, true);
      m.frame.getWorldQuaternion(_fq);
      UP.set(0, 1, 0).applyQuaternion(_fq);
      FORWARD.set(0, 0, 1).applyQuaternion(_fq);
      const mouth = bn.head!.getWorldPosition(_mouth).addScaledVector(UP, MOUTH.up).addScaledVector(FORWARD, MOUTH.fwd);
      const tilt = SIP.tilt * smooth((sipK - 0.08) / 0.3) * (1 - smooth((sipK - 0.72) / 0.22));
      _drink.copy(UP).multiplyScalar(Math.cos(tilt)).addScaledVector(FORWARD, -Math.sin(tilt));
      for (let pass = 0; pass < 3; pass++) {
        this.tipCup(_drink, lead);
        for (const b of [bn.lArm, bn.lForeArm]) this.reach(b, mouth, lead);
      }
    }
    if (this.cupFingers) for (const f of this.cupFingers) f.bone.quaternion.copy(f.q);
    this.cup.update(dt);
  }

  /**
   * Seats the cup in Sir Aldric's left hand and closes his fingers round it: the cup's axis along the knuckle line,
   * its wall against the palm, then each finger joint (knuckle to tip) turned toward the cup's axis until the next
   * joint lies on the wall. Solved once from the posed hand; the cup is fixed to the hand, so the grip holds whatever
   * the arm does.
   */
  private fitCup(): void {
    const hand = this.offHand;
    const pivot = this.cupPivot;
    if (!this.model || !hand || !pivot || !this.cup) return;
    this.cupFingers = this.solveGrip('left', hand, pivot, this.cup);
    this.cupGripQ.copy(pivot.quaternion);
  }

  /**
   * The grip solve for a cup on `pivot` (a child of a holder on `hand`): the cup's axis along the knuckle line, its wall
   * against the palm, each finger joint turned toward the axis until the next joint lies on the wall. Returns the
   * fingers' solved local rotations ([] when the hand has no finger bones).
   */
  private solveGrip(side: 'left' | 'right', hand: Object3D, pivot: Group, cup: LeanCup): Array<{ bone: Object3D; q: Quaternion }> {
    const m = this.model;
    const holder = pivot.parent;
    if (!m || !holder) return [];
    const bone = (n: string) => m.bone(new RegExp(`${side}.?hand${n}$`, 'i'));
    const i1 = bone('Index1');
    const p1 = bone('Pinky1');
    const m1 = bone('Middle1');
    const m4 = bone('Middle4');
    if (!i1 || !p1 || !m1 || !m4) return [];
    m.root.updateWorldMatrix(true, true);
    const at = (o: Object3D) => holder.worldToLocal(o.getWorldPosition(new Vector3()));
    const I1 = at(i1);
    const M1 = at(m1);
    const W = at(hand);
    const up = I1.clone().sub(at(p1)).normalize();
    // Across the palm (wrist to knuckles), and out of it on the side the fingers close toward.
    const across = M1.clone().sub(W);
    across.addScaledVector(up, -across.dot(up)).normalize();
    const palm = new Vector3().crossVectors(across, up).normalize();
    if (palm.dot(at(m4).sub(M1)) < 0) palm.negate();
    const r = cup.radiusAt(CUP_HOLD.knuckleAt);
    pivot.position.copy(M1).addScaledVector(palm, r + CUP_HOLD.palm).addScaledVector(across, -CUP_HOLD.inset).addScaledVector(up, -CUP_HOLD.knuckleAt);
    pivot.quaternion.setFromRotationMatrix(new Matrix4().makeBasis(palm, up, new Vector3().crossVectors(palm, up)));
    pivot.updateWorldMatrix(true, true);
    const g = cup.group;
    const fingers: Array<{ bone: Object3D; q: Quaternion }> = [];
    for (const f of FINGERS) {
      const thick = f === 'Thumb' ? CUP_HOLD.thumb : CUP_HOLD.finger;
      for (let j = 1; j <= 3; j++) {
        const jb = bone(f + j);
        const cb = bone(f + (j + 1));
        if (!jb || !cb) break;
        const p = jb.getWorldPosition(new Vector3());
        const toAxis = g.localToWorld(new Vector3(0, g.worldToLocal(p.clone()).y, 0)).sub(p).normalize();
        const dir = cb.getWorldPosition(new Vector3()).sub(p).normalize();
        const axis = new Vector3().crossVectors(dir, toAxis).normalize();
        const base = jb.quaternion.clone();
        // How far the next joint stands off the wall with this joint turned `theta` toward the axis.
        const gap = (theta: number): number => {
          jb.quaternion.copy(base);
          turnBone(jb, axis, theta);
          const c = g.worldToLocal(cb.getWorldPosition(_a));
          return Math.hypot(c.x, c.z) - (cup.radiusAt(c.y) + thick);
        };
        let lo = -1.2;
        let hi = Math.min(1.7, dir.angleTo(toAxis));
        if (gap(lo) <= 0) gap(lo); // touching even straightened out
        else if (gap(hi) >= 0) gap(hi); // cannot reach the wall: curled as far as it goes
        else {
          for (let k = 0; k < 18; k++) { const mid = (lo + hi) / 2; if (gap(mid) > 0) lo = mid; else hi = mid; }
          gap(hi);
        }
        fingers.push({ bone: jb, q: jb.quaternion.clone() });
      }
    }
    return fingers;
  }

  /** An NPC holds a lean cup (NpcDef.cup): seated once the model is in and posed (see animateNpcCup). */
  holdCup(): void {
    this.npcCupWanted = true;
    if (this.model) this.loadNpcCup();
  }

  private loadNpcCup(): void {
    void loadModelOrWarn('lean-cup', MODELS['lean-cup']?.label).then((g) => { this.npcCupModel = g; });
  }

  /**
   * Seats the NPC's cup on the first posed frame: in the hand that comes nearest the mouth over the playing clip (a
   * drinking clip lifts one), else the right; fingers closed round it. Then each frame the fingers keep their grip.
   */
  private animateNpcCup(dt: number): void {
    const m = this.model;
    if (!this.npcCupModel || !m) return;
    if (!this.npcCup) {
      const head = this.bones?.head;
      const hands: Array<['left' | 'right', Object3D | null]> = [['left', this.offHand], ['right', this.hand]];
      const near: Record<string, number> = { left: Infinity, right: Infinity };
      if (head) m.sampleClip([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9], () => {
        const hp = head.getWorldPosition(_b);
        for (const [side, b] of hands) if (b) near[side] = Math.min(near[side], b.getWorldPosition(_a).distanceTo(hp));
      });
      const side: 'left' | 'right' = near.left < near.right ? 'left' : 'right';
      const hand = side === 'left' ? this.offHand : this.hand;
      if (!hand) { this.npcCupModel = null; return; }
      const rig = new ModelRig('lean-cup', this.npcCupModel);
      const cup = new LeanCup(rig.root, rig.height);
      m.root.updateWorldMatrix(true, true);
      const ws = hand.getWorldScale(new Vector3());
      const holder = new Group();
      holder.scale.setScalar(1 / Math.max(1e-4, ws.y));
      const pivot = new Group();
      pivot.add(cup.group);
      holder.add(pivot);
      hand.add(holder);
      this.fx.add(cup.drops);
      this.npcCup = { cup, fingers: this.solveGrip(side, hand, pivot, cup) };
    }
    for (const f of this.npcCup.fingers) f.bone.quaternion.copy(f.q);
    this.npcCup.cup.update(dt);
  }

  /** Turns the wrist so the cup stands `amount` of the way upright (at most 1.15 rad of it). */
  private levelByWrist(amount: number): void {
    this.tipCup(_drink.set(0, 1, 0), amount, 1.15);
  }

  /** Turns the wrist so the cup's axis (foot to rim) swings `w` of the way toward `want` (at most `max` rad). */
  private tipCup(want: Vector3, w: number, max = Math.PI): void {
    if (!this.offHand || !this.cupPivot || w <= 0.001) return;
    this.cupPivot.updateWorldMatrix(true, false);
    _a.set(0, 1, 0).applyQuaternion(this.cupPivot.getWorldQuaternion(_q));
    const angle = _a.angleTo(want);
    if (angle < 1e-3) return;
    _ax.crossVectors(_a, want).normalize();
    this.turn(this.offHand, _ax, Math.min(angle, max) * w);
  }

  /** Rolls the cup hand about the forearm by `angle`, the way that brings the rim toward the sword hand. */
  private pourByWrist(angle: number): void {
    const fore = this.bones?.lForeArm;
    if (!this.offHand || !this.hand || !this.cup || !fore || angle <= 0) return;
    const wrist = this.offHand.getWorldPosition(_a);
    const along = _ax.copy(wrist).sub(fore.getWorldPosition(_b)).normalize();
    const rim = this.cup.group.localToWorld(_t.set(0, this.cup.height, 0)).sub(wrist);
    const toBlade = this.hand.getWorldPosition(_b).sub(wrist);
    const sign = Math.sign(_mouth.crossVectors(along, rim).dot(toBlade)) || 1;
    this.turn(this.offHand, along, angle * sign);
  }

  /** Turns `bone` so the cup's rim swings toward `target` (one step of a CCD reach), by `w` of the way. */
  private reach(bone: Object3D | null, target: Vector3, w: number): void {
    if (!bone || !this.cup) return;
    const rim = this.cup.group.localToWorld(_rim.set(0, this.cup.height, 0));
    const p = bone.getWorldPosition(_a);
    const from = _b.copy(rim).sub(p).normalize();
    const to = _t.copy(target).sub(p).normalize();
    _q.setFromUnitVectors(from, to);
    const angle = 2 * Math.acos(Math.min(1, _q.w));
    if (angle < 1e-4) return;
    const sin = Math.sqrt(Math.max(1e-9, 1 - _q.w * _q.w));
    _ax.set(_q.x / sin, _q.y / sin, _q.z / sin);
    this.turn(bone, _ax, angle * w);
  }

  /** A drop of lean poured from the cup's rim (it falls onto the blade below). */
  private pourDrop(): void {
    if (!this.cup) return;
    const d = this.freeDrop();
    if (!d) return;
    this.cup.group.localToWorld(d.s.position.set(0, this.cup.height * 0.95, 0));
    d.v.set((Math.random() - 0.5) * 0.3, -0.6, (Math.random() - 0.5) * 0.3);
  }

  private freeDrop(): { s: Sprite; v: Vector3; age: number } | null {
    let d = this.flung.find((x) => !x.s.visible) ?? null;
    if (!d && this.flung.length < 60) {
      const s = glowSprite(0xb36bff, 0.07, 0.95, true);
      this.fx.add(s);
      d = { s, v: new Vector3(), age: 0 };
      this.flung.push(d);
    }
    if (d) { d.age = 0; d.s.visible = true; }
    return d;
  }

  /**
   * Sir Aldric's lean cyclone (his burst): the cup tipped over the raised sword, then the spin, arms out and the
   * blade level, flinging lean off its tip; afterwards he unwinds to face forward again.
   */
  private animateCyclone(pose: RigPose, dt: number): void {
    const m = this.model;
    const t = pose.burst?.kind === 'cyclone' ? pose.burst.t : -1;
    for (const d of this.flung) {
      if (!d.s.visible) continue;
      d.age += dt;
      if (d.age > 0.9) { d.s.visible = false; continue; }
      d.v.y -= 9.8 * dt;
      d.s.position.addScaledVector(d.v, dt);
      d.s.material.opacity = 0.95 * (1 - d.age / 0.9);
    }
    for (const g of this.bladeGlows) g.material.opacity += ((t >= CYCLONE.pour * 0.6 ? 0.6 : 0) - g.material.opacity) * Math.min(1, dt * 6);
    if (!m || !this.bones) return;
    if (t < 0) {
      // Unwind to the nearest whole turn, then rest.
      if (this.spin !== 0) {
        const goal = Math.round(this.spin / (Math.PI * 2)) * Math.PI * 2;
        this.spin += (goal - this.spin) * Math.min(1, dt * 10);
        if (Math.abs(goal - this.spin) < 0.01) this.spin = 0;
        m.root.rotation.y = this.spin % (Math.PI * 2);
      }
      return;
    }
    const bn = this.bones;
    m.root.updateWorldMatrix(true, true);
    m.frame.getWorldQuaternion(_fq);
    LATERAL.set(1, 0, 0).applyQuaternion(_fq);
    FORWARD.set(0, 0, 1).applyQuaternion(_fq);
    if (t < CYCLONE.pour) {
      // The sword held out level in front, the cup raised above it.
      const w = Math.min(1, t / 0.25) * Math.min(1, (CYCLONE.pour - t) / 0.12 + 0.3);
      this.aim(bn.rArm, bn.rForeArm, _t.set(-0.24, 1.22, 0.22), w);
      this.aim(bn.rForeArm, this.hand, _t.set(-0.08, 1.2, 0.5), w);
      this.aim(bn.lArm, bn.lForeArm, _t.set(0.24, 1.36, 0.2), w);
      this.aim(bn.lForeArm, this.offHand, _t.set(0.04, 1.5, 0.46), w);
      return;
    }
    const s = t - CYCLONE.pour;
    const ramp = Math.min(1, s / 0.35) * Math.max(0, Math.min(1, (CYCLONE.spin - s) / 0.35));
    this.spin += dt * 15 * ramp;
    m.root.rotation.y = this.spin % (Math.PI * 2);
    // Arms out like a top: the sword arm level, the cup arm a little lower.
    this.turn(bn.rArm, FORWARD, -1.25 * ramp);
    this.turn(bn.lArm, FORWARD, 0.95 * ramp);
    // Lean flung off the blade's tip, out along the turn.
    if (ramp > 0.5 && Math.random() < 0.85) {
      this.weaponTips();
      const d = this.freeDrop();
      if (d) {
        d.s.position.copy(this.tipB);
        const ox = this.tipB.x - this.root.position.x;
        const oz = this.tipB.z - this.root.position.z;
        d.v.set(-oz * 4 + ox * 2.5, 1.5 + Math.random() * 1.5, ox * 4 + oz * 2.5);
      }
    }
  }

  /**
   * Wren's mushroom: a small purple one, pinched by its stem between her thumb and forefinger (hidden until she takes
   * it out of the pouch; placed each frame, see pinch).
   */
  private attachShroom(gltf: GLTF): void {
    if (!this.model || !this.hand) return;
    const rig = new ModelRig('purple-mushroom', gltf);
    this.model.root.updateWorldMatrix(true, true);
    const ws = new Vector3();
    this.hand.getWorldScale(ws);
    const holder = new Group();
    holder.scale.setScalar(SHROOM.size / rig.height / Math.max(1e-4, ws.y));
    this.shroomLen = SHROOM.size / Math.max(1e-4, ws.y);
    this.shroomH = rig.height;
    holder.add(rig.root);
    holder.visible = false;
    this.hand.add(holder);
    this.shroom = holder;
  }

  /**
   * Wren between fights: she stands easy (the calm first frame of her idle, breathing), and every so often takes a
   * psychedelic mushroom out of the pouch on her hip, eats it, and sparkles a little for a while after.
   */
  private animateSnack(pose: RigPose, dt: number): void {
    const m = this.model;
    if (!m || m.id !== 'archer' || !this.bones) return;
    const bn = this.bones;
    const calm = pose.mode === 'ground' && pose.attack === undefined && !pose.charging && pose.speed < 0.3;
    m.root.updateWorldMatrix(true, true);
    m.frame.getWorldQuaternion(_fq);
    LATERAL.set(1, 0, 0).applyQuaternion(_fq);
    FORWARD.set(0, 0, 1).applyQuaternion(_fq);
    UP.set(0, 1, 0).applyQuaternion(_fq);
    if (calm) {
      // Breathing and a slow look around on the held pose; the right arm hangs (the snack takes it from there).
      const rest = 1 - (this.snack ? Math.min(1, this.snack.t / 0.45) * Math.min(1, (3.2 - this.snack.t) / 0.55) : 0);
      if (rest > 0.01) {
        this.aim(bn.rArm, bn.rForeArm, _t.set(SHROOM.restElbow[0], SHROOM.restElbow[1], SHROOM.restElbow[2]), rest);
        this.aim(bn.rForeArm, this.hand, _t.set(SHROOM.restHand[0], SHROOM.restHand[1], SHROOM.restHand[2]), rest);
      }
      const t = this.flightTime;
      this.turn(bn.spine, LATERAL, Math.sin(t * 1.6) * 0.025);
      this.turn(bn.neck, UP, Math.sin(t * 0.37) * 0.25);
      this.turn(bn.hips, FORWARD, Math.sin(t * 0.5) * 0.03);
    }
    if (!this.snack) this.relaxHands(pose);
    if (!this.snack) {
      this.snackIn -= dt;
      if (this.snackIn <= 0 && calm) { this.snack = { t: 0 }; Rig.sound?.rustle?.(); }
      if (this.snackIn <= 0) this.snackIn = SHROOM.every[0] + Math.random() * (SHROOM.every[1] - SHROOM.every[0]);
    }
    if (this.snack) {
      const sn = this.snack;
      sn.t += dt;
      if (!calm || sn.t > 3.2) { this.snack = null; if (this.shroom) this.shroom.visible = false; }
      else {
        const t = sn.t;
        const w = Math.min(1, t / 0.45) * Math.min(1, (3.2 - t) / 0.55);
        const up = smooth((t - 0.95) / 0.55);
        const at = (a: readonly number[], b: readonly number[]) => _t.set(a[0] + (b[0] - a[0]) * up, a[1] + (b[1] - a[1]) * up, a[2] + (b[2] - a[2]) * up);
        const chew = t > 1.55 && t < 2.6 ? Math.sin((t - 1.55) * 16) * 0.012 : 0;
        // Fumbling in the pouch, then the hand comes up to the mouth and stays there while she chews.
        const dig = t > 0.45 && t < 0.95 ? Math.sin(t * 30) * 0.015 : 0;
        this.aim(bn.rArm, bn.rForeArm, at(SHROOM.pouchElbow, SHROOM.mouthElbow), w);
        this.aim(bn.rForeArm, this.hand, at(SHROOM.pouch, SHROOM.mouth).add(_b.set(0, dig + chew, 0)), w);
        if (t > 1.55 && t < 2.6) this.turn(bn.head, LATERAL, Math.sin((t - 1.55) * 16) * 0.05);
        this.relaxHands(pose);
        this.pinch(w);
        if (this.shroom) {
          this.shroom.visible = t > 0.8 && t < 2.35;
          // Bitten down as she eats.
          const left = t < 1.6 ? 1 : Math.max(0.25, 1 - (t - 1.6) / 0.75);
          this.shroom.scale.y = Math.abs(this.shroom.scale.x) * left;
          // Up at her mouth, the cap (not the hand) meets her lips from below, the mushroom tipped up toward them so
          // the hand stays under her chin and the bite shows: the arm is turned until the cap is there.
          if (up > 0.02 && bn.head) {
            const mouth = bn.head.getWorldPosition(_mouth).addScaledVector(UP, SHROOM.bite.up).addScaledVector(FORWARD, SHROOM.bite.fwd);
            const toLips = _drink2.copy(UP).multiplyScalar(Math.cos(SHROOM.biteTilt)).addScaledVector(FORWARD, -Math.sin(SHROOM.biteTilt));
            for (let pass = 0; pass < 3; pass++) {
              this.pinch(w, toLips, up);
              for (const b of [bn.rArm, bn.rForeArm]) this.reachWith(b, this.shroomTip(), mouth, up * w);
            }
            this.pinch(w, toLips, up);
          }
        }
        if (t > 2.3 && this.tripLeft <= 0) { this.tripLeft = 6; Rig.sound?.munch?.(); }
      }
    }
    // After a mushroom: little rainbow sparkles drift around her head for a while.
    this.tripLeft = Math.max(0, this.tripLeft - dt);
    const head = bn.head;
    if (!head) return;
    head.getWorldPosition(_mouth);
    const T = this.flightTime;
    this.sparkles.forEach((sp, i) => {
      const on = this.tripLeft > 0;
      sp.visible = on;
      if (!on) return;
      const a = T * (0.8 + (i % 3) * 0.35) + i * 0.9;
      const r = 0.22 + (i % 4) * 0.05;
      sp.position.set(_mouth.x + Math.cos(a) * r, _mouth.y + 0.12 + Math.sin(T * 2 + i) * 0.1, _mouth.z + Math.sin(a) * r);
      sp.material.color.setHSL((T * 0.25 + i / 14) % 1, 0.9, 0.62);
      sp.material.opacity = Math.min(1, this.tripLeft / 1.5) * (0.5 + 0.5 * Math.sin(T * 6 + i * 2));
      sp.scale.setScalar(0.05 + 0.03 * Math.sin(T * 4 + i));
    });
  }

  /** A hand or finger bone of this body (`digit('RightHandIndex1')`), cached. */
  private digit(name: string): Object3D | null {
    if (!this.digits.has(name)) this.digits.set(name, this.model?.bone(new RegExp(`${name}$`, 'i')) ?? null);
    return this.digits.get(name)!;
  }

  /**
   * Eases every finger toward the bind pose (see HAND), then brings the fingers side by side: the bind pose spreads
   * them, and her low-poly hand then splits in two clumps.
   */
  private relaxHands(pose: RigPose): void {
    const keep = pose.attack !== undefined ? HAND.keepShot : HAND.keep;
    for (const f of this.fingerRest) {
      if (!f.held) { f.clip.copy(f.bone.quaternion); f.held = true; }
      f.bone.quaternion.copy(f.rest).slerp(f.clip, keep);
    }
    if (!this.fingerRest.length) return;
    this.model?.root.updateWorldMatrix(true, true);
    for (const side of ['Left', 'Right']) {
      const d = (n: string) => this.digit(`${side}Hand${n}`);
      const hand = d('');
      const i1 = d('Index1');
      const p1 = d('Pinky1');
      const m1 = d('Middle1');
      const m2 = d('Middle2');
      if (!hand || !i1 || !p1 || !m1 || !m2) continue;
      // The palm's normal, and the middle finger's line in the palm's plane.
      const n = _q2v.copy(i1.getWorldPosition(_a)).sub(p1.getWorldPosition(_b)).cross(_t.copy(m1.getWorldPosition(_a)).sub(hand.getWorldPosition(_b))).normalize();
      const mid = _drink2.copy(m2.getWorldPosition(_a)).sub(m1.getWorldPosition(_b));
      mid.addScaledVector(n, -mid.dot(n)).normalize();
      for (const f of ['Index', 'Ring', 'Pinky']) {
        const f1 = d(f + '1');
        const f2 = d(f + '2');
        if (!f1 || !f2) continue;
        const dir = _rim.copy(f2.getWorldPosition(_a)).sub(f1.getWorldPosition(_b));
        dir.addScaledVector(n, -dir.dot(n)).normalize();
        const angle = Math.atan2(_t.crossVectors(dir, mid).dot(n), dir.dot(mid));
        turnBone(f1, n, angle * HAND.close);
      }
    }
  }

  /**
   * Wren's right hand pinching the mushroom by its stem (`w` of the way): the thumb's and forefinger's tips brought
   * together, and the mushroom set between them, its cap out past the fingertips.
   */
  private pinch(w: number, along: Vector3 | null = null, k = 0): void {
    const m = this.model;
    const hand = this.hand;
    if (!m || !hand || w <= 0.01) return;
    const b = (n: string) => this.digit(`RightHand${n}`);
    const thumb = [b('Thumb1'), b('Thumb2'), b('Thumb3'), b('Thumb4')];
    const index = [b('Index1'), b('Index2'), b('Index3'), b('Index4')];
    if (thumb.some((x) => !x) || index.some((x) => !x)) return;
    m.root.updateWorldMatrix(true, true);
    // They meet halfway, either side of the stem.
    const tipT = thumb[3]!.getWorldPosition(_a);
    const tipI = index[3]!.getWorldPosition(_b);
    const meet = _drink.copy(tipT).add(tipI).multiplyScalar(0.5);
    const across = _pinchAcross.copy(tipT).sub(tipI);
    if (across.lengthSq() < 1e-8) across.set(0, 1, 0); else across.normalize();
    const atThumb = _pinchT.copy(meet).addScaledVector(across, SHROOM.stem);
    const atIndex = _pinchI.copy(meet).addScaledVector(across, -SHROOM.stem);
    for (let pass = 0; pass < 3; pass++) {
      for (const j of thumb.slice(0, 3)) this.reachWith(j, thumb[3]!.getWorldPosition(_rim), atThumb, w);
      for (const j of index.slice(0, 3)) this.reachWith(j, index[3]!.getWorldPosition(_rim), atIndex, w);
    }
    if (!this.shroom) return;
    // The stem between the pads, a third of the way up; the mushroom points out of the fist, past the fingertips.
    const pinchAt = _pinch.copy(hand.worldToLocal(thumb[3]!.getWorldPosition(_a).add(index[3]!.getWorldPosition(_b)).multiplyScalar(0.5)));
    const out = _t.copy(pinchAt).normalize();
    // (Turned `k` of the way to point along the world direction `along`.)
    if (along && k > 0) {
      const there = hand.worldToLocal(hand.localToWorld(_a.copy(pinchAt)).add(along)).sub(pinchAt).normalize();
      out.lerp(there, k).normalize();
    }
    this.shroom.quaternion.setFromUnitVectors(_b.set(0, 1, 0), out);
    this.shroom.position.copy(pinchAt).addScaledVector(out, -this.shroomLen * 0.3);
  }

  /** The top of the mushroom's cap, world space (the holder's scale carries the bites taken). */
  private shroomTip(): Vector3 {
    const s = this.shroom!;
    s.updateWorldMatrix(true, false);
    return s.localToWorld(_ax.set(0, this.shroomH, 0));
  }

  /** Turns `bone` so the world point `effector` (carried by it) swings toward `target`, `w` of the way (one CCD step). */
  private reachWith(bone: Object3D | null, effector: Vector3, target: Vector3, w: number): void {
    if (!bone) return;
    const p = bone.getWorldPosition(_a);
    const from = _b.copy(effector).sub(p).normalize();
    const to = _t.copy(target).sub(p).normalize();
    const angle = from.angleTo(to);
    if (angle < 1e-4) return;
    this.turn(bone, _q2v.crossVectors(from, to).normalize(), angle * w);
  }

  /** Wren's bow in her left hand (on foot); in the air she shoots off the bow she rides. */
  private attachHeldBow(id: string, gltf: GLTF): void {
    if (!this.model || !this.offHand) return;
    this.model.root.updateWorldMatrix(true, true);
    const ws = new Vector3();
    this.offHand.getWorldScale(ws);
    const make = (): Group => {
      const rig = new ModelRig(id, gltf);
      const pivot = new Group();
      pivot.position.set(HELD_BOW.x, HELD_BOW.y, HELD_BOW.z);
      pivot.rotation.set(HELD_BOW.rx, HELD_BOW.ry, HELD_BOW.rz);
      rig.root.position.y = HELD_BOW.slide;
      pivot.add(rig.root);
      const holder = new Group();
      holder.scale.setScalar(1 / Math.max(1e-4, ws.y));
      holder.add(pivot);
      this.offHand!.add(holder);
      return holder;
    };
    this.heldBow = make();
    // Slung across the back: mounted on the chest bone, solved from the pose it has now (upright, at load).
    const chest = this.model.bone(/spine2$/i);
    if (chest) {
      const frameQ = this.model.frame.getWorldQuaternion(new Quaternion());
      const y = STOWED_BOW.along.clone();
      const x = new Vector3(0, 0, 1).sub(y.clone().multiplyScalar(y.z)).normalize(); // string toward her back
      const z = new Vector3().crossVectors(x, y);
      const want = frameQ.multiply(new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z)));
      const chestQ = chest.getWorldQuaternion(new Quaternion());
      const cs = new Vector3();
      chest.getWorldScale(cs);
      const holder = new Group();
      holder.scale.setScalar(1 / Math.max(1e-4, cs.y));
      const pivot = new Group();
      pivot.position.copy(chest.worldToLocal(this.model.frame.localToWorld(STOWED_BOW.at.clone()))).multiplyScalar(cs.y);
      pivot.quaternion.copy(chestQ.invert().multiply(want));
      const rig = new ModelRig(id, gltf);
      rig.root.position.y = HELD_BOW.slide;
      pivot.add(rig.root);
      holder.add(pivot);
      chest.add(holder);
      this.stowedBow = holder;
    }
  }

  /** The ridden staff or bow, hidden until the hero takes off. */
  private attachRide(id: string, gltf: GLTF, at: RideProp): void {
    if (!this.model) return;
    const rig = new ModelRig(id, gltf);
    const pivot = new Group();
    pivot.position.set(at.x, at.y, at.z);
    pivot.rotation.set(at.rx, at.ry, at.rz);
    rig.root.position.y = at.slide;
    pivot.add(rig.root);
    // A wisp of the hero's colour trails from the staff's back end (a bow, held crosswise, has no back end).
    let glow: Sprite | null = null;
    if (id === 'staff') {
      glow = glowSprite(this.def.accent, 0.7, 0.0, true);
      glow.position.set(0, at.slide + 0.05, 0);
      pivot.add(glow);
    }
    pivot.visible = false;
    this.model.root.add(pivot);
    this.ride = pivot;
    this.rideGlow = glow;
  }

  /**
   * Flight on top of the clip: Orlan leans over his staff, Wren sits on her bow (thighs forward, shins down),
   * Sir Aldric tips into a glide with his arms out and his cape streaming. `f` is the eased flight amount.
   */
  private flyPose(pose: RigPose, dt: number): void {
    const m = this.model;
    if (!m) return;
    const target = pose.mode === 'fly' ? 1 : 0;
    this.flight += (target - this.flight) * Math.min(1, dt * (target ? 5 : 7));
    if (this.flight < 0.002) this.flight = 0;
    const f = this.flight;
    this.flightTime += dt;
    const ride = RIDE[this.def.weapon];
    // The body itself is near horizontal when gliding, so the cape only lifts a little off the back and flutters;
    // running on foot swings it back with speed.
    if (this.capeLift) this.capeLift.value = f > 0.05 ? 0.12 + f * 0.18 : Math.min(0.35, pose.speed * 0.045);
    if (this.ride) {
      this.ride.visible = f > 0.05;
      this.ride.scale.setScalar(Math.min(1, f * 1.4));
      if (this.rideGlow) this.rideGlow.material.opacity = f * (0.45 + Math.sin(this.flightTime * 9) * 0.15);
    }
    // Wren's bow is in her hand on foot and under her in the air (she shoots off it from there).
    const shooting = pose.attack !== undefined || Math.abs(this.shotTurn) > 0.25;
    if (this.heldBow) this.heldBow.visible = f <= 0.05 && shooting;
    if (this.stowedBow) this.stowedBow.visible = f <= 0.05 && !shooting;
    if (f === 0) {
      // On foot: a clip-driven body stands upright at its origin; a static robe keeps its own bob (driveStaticModel).
      if (m.hasClips) { m.root.rotation.x = 0; m.root.position.set(0, 0, 0); }
      return;
    }
    const bob = Math.sin(this.flightTime * 2.2) * 0.06 * f;
    if (ride === 'cape') {
      // Tip forward about the hips so the feet trail behind.
      const a = 1.32 * f;
      const hip = 0.95;
      m.root.rotation.x = a;
      m.root.position.set(0, hip * (1 - Math.cos(a)) + bob, -hip * Math.sin(a));
    } else if (ride === 'float') {
      // Upright, floating a hand's breadth higher than on foot, rocking gently.
      m.root.rotation.x = 0.05 * f;
      m.root.rotation.z = Math.sin(this.flightTime * 1.3) * 0.035 * f;
      m.root.position.set(0, 0.28 * f + bob * 1.5, 0);
    } else {
      m.root.rotation.x = 0.08 * f;
      m.root.position.set(0, 0.18 * f + bob, 0);
    }
    if (!this.bones) return;
    const bn = this.bones;
    m.root.updateWorldMatrix(true, true);
    m.frame.getWorldQuaternion(_fq);
    LATERAL.set(1, 0, 0).applyQuaternion(_fq);
    FORWARD.set(0, 0, 1).applyQuaternion(_fq);
    if (ride === 'cape') {
      // Arms out to glide; the cup arm carries the cup at the chest (animateCup), the sword arm swings in a strike.
      if (!this.cup) { this.turn(bn.lArm, FORWARD, 0.95 * f); this.turn(bn.lArm, LATERAL, 0.35 * f); }
      const strike = pose.attack !== undefined ? 1 - smooth((pose.attack - 0.8) / 0.2) : 0;
      this.turn(bn.rArm, FORWARD, -0.95 * f * (1 - strike));
      this.turn(bn.rArm, LATERAL, 0.35 * f * (1 - strike));
      this.turn(bn.neck, LATERAL, -0.55 * f);
      this.turn(bn.head, LATERAL, -0.5 * f);
      // The legs trail loosely: knees a little bent, each swinging gently out of step with the other.
      const t = this.flightTime;
      this.turn(bn.lUpLeg, LATERAL, (0.1 + Math.sin(t * 1.9) * 0.06) * f);
      this.turn(bn.rUpLeg, LATERAL, (0.06 + Math.sin(t * 1.9 + 2.2) * 0.06) * f);
      this.turn(bn.lLeg, LATERAL, (0.32 + Math.sin(t * 1.9 + 0.7) * 0.1) * f);
      this.turn(bn.rLeg, LATERAL, (0.22 + Math.sin(t * 1.9 + 2.9) * 0.1) * f);
    } else if (ride !== 'float') {
      if (this.shotTurn !== 0) {
        // A shot from the saddle: the twist spreads over the three spine bones.
        UP.set(0, 1, 0).applyQuaternion(_fq);
        for (const b of [bn.spine0, bn.spine, bn.spine2]) this.turn(b, UP, (this.shotTurn * f) / 3);
      }
      // Astride the bow: thighs forward and apart, shins hanging, leaning over the front limb with both hands on it.
      const s = this.seat;
      this.turn(bn.lUpLeg, LATERAL, s.thigh * f);
      this.turn(bn.rUpLeg, LATERAL, s.thigh * f);
      this.turn(bn.lUpLeg, FORWARD, s.spread * f);
      this.turn(bn.rUpLeg, FORWARD, -s.spread * f);
      this.turn(bn.lLeg, LATERAL, s.knee * f);
      this.turn(bn.rLeg, LATERAL, s.knee * f);
      this.turn(bn.spine, LATERAL, s.lean * f);
      // Both hands on the front limb; a shot draws the string back from it (the arrow leaves the bow under her).
      const draw = pose.attack !== undefined ? smooth(pose.attack / 0.45) * (1 - smooth((pose.attack - 0.6) / 0.3)) : 0;
      for (const side of [1, -1]) {
        const [arm, fore, hand] = side > 0 ? [bn.lArm, bn.lForeArm, this.offHand] : [bn.rArm, bn.rForeArm, this.hand];
        const d = side < 0 ? draw : 0;
        this.aim(arm, fore, _t.set(s.elbow[0] * side - 0.1 * d, s.elbow[1] + 0.18 * d, s.elbow[2] - 0.2 * d), f);
        this.aim(fore, hand, _t.set(s.grip[0] * side - 0.1 * d, s.grip[1] + 0.22 * d, s.grip[2] - 0.32 * d), f);
      }
    }
  }

  /** Parents a weapon model to the hand bone at the registry grip, compensating the skeleton's scale. */
  private attachProp(id: string, gltf: GLTF): void {
    const parent = this.hand ?? this.anchor;
    if (!parent || !this.model) return;
    const rig = new ModelRig(id, gltf);
    const grip = MODELS[id]?.grip ?? { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, slide: 0 };
    const pivot = new Group();
    pivot.position.set(grip.x, grip.y, grip.z);
    pivot.rotation.set(grip.rx, grip.ry, grip.rz);
    rig.root.position.y = grip.slide;
    pivot.add(rig.root);
    if (id === 'greatsword') {
      // Lean along the blade (tip at the bottom of the upright model, the guard about 1 m up), lit for the cyclone.
      for (const y of [0.12, 0.38, 0.64, 0.9]) {
        const g = glowSprite(0xb36bff, 0.32, 0, true);
        g.position.y = y;
        rig.root.add(g);
        this.bladeGlows.push(g);
      }
    }
    const holder = new Group();
    holder.add(pivot);
    this.model.root.updateWorldMatrix(true, true);
    const ws = new Vector3();
    parent.getWorldScale(ws);
    this.propBase = 1 / Math.max(1e-4, ws.y);
    holder.scale.setScalar(0.001);
    holder.visible = false;
    parent.add(holder);
    this.prop = holder;
    this.propRig = rig;
  }

  /** Scales the weapon prop in while attacking and away afterwards; a boneless body also swings it. */
  private animateProp(pose: RigPose, dt: number): void {
    if (!this.prop) return;
    const want = pose.attack !== undefined ? 1 : 0;
    this.propShown += (want - this.propShown) * Math.min(1, dt * (want ? 14 : 6));
    const s = this.propBase * Math.max(0.001, this.propShown);
    this.prop.scale.setScalar(s);
    this.prop.visible = this.propShown > 0.03;
    if (this.anchor) {
      // Drawn upright at the side, then levelled at the target for the strike and held while the bolt flies.
      const a = pose.attack ?? 1;
      const raise = a < 0.25 ? a / 0.25 : a < 0.75 ? 1 : 1 - (a - 0.75) / 0.25;
      const thrust = Math.sin(Math.min(1, a / 0.45) * Math.PI * 0.5);
      const target = pose.attack === undefined ? 0 : 0.25 + raise * 0.95 * thrust;
      this.anchor.rotation.x += (target - this.anchor.rotation.x) * Math.min(1, dt * 18);
      this.anchor.position.y = (MODELS[this.model?.id ?? '']?.hand?.y ?? 1) + raise * 0.12;
    }
  }

  /**
   * World position a projectile leaves from: the staff's crystal, the bow hand, or a point in front of the chest.
   * Null until the body has loaded.
   */
  muzzle(out: Vector3): Vector3 | null {
    if (!this.model) return null;
    if (this.propRig && this.prop && this.def.weapon === 'staff') {
      this.prop.updateWorldMatrix(true, true);
      // The prop is scaled to `height` with its feet at 0; the knob sits at the top.
      return this.propRig.root.localToWorld(out.set(0, this.propRig.height * 0.97, 0));
    }
    // Riding her bow, Wren's arrows leave from the bow under her.
    if (this.def.weapon === 'bow' && this.ride && this.flight > 0.5) {
      this.ride.updateWorldMatrix(true, false);
      return this.ride.localToWorld(out.set(0, 0, 0)).add(_b.set(0, -0.15, 0));
    }
    const hand = this.def.weapon === 'bow' ? this.offHand ?? this.hand : this.hand;
    if (hand) { hand.updateWorldMatrix(true, false); return hand.getWorldPosition(out); }
    this.root.updateWorldMatrix(true, false);
    return out.set(0, 1.3, 0.6).applyMatrix4(this.root.matrixWorld);
  }

  /**
   * A boneless model (the wizard's closed robe): hovers along instead of walking, sways while idle, leans into
   * casts, and tips over when dead. The hem itself flutters in the vertex shader (patchRobeWind).
   */
  private driveStaticModel(m: ModelRig, pose: RigPose, dt: number): void {
    const r = m.root;
    this.staticPhase += dt * (pose.speed > 0.3 ? 5.5 : 1.1);
    const t = this.staticPhase;
    let bob = Math.sin(t) * 0.012;
    // A slow, loose sway from side to side (Orlan is a little high), stronger while he walks.
    let lean = Math.sin(t * 0.5) * 0.025;
    let tilt = 0;
    let drift = Math.sin(t * 0.5 - 0.6) * 0.015;
    let wobble = Math.sin(t * 0.31) * 0.03;
    let scaleY = 1 + Math.sin(t * 0.9) * 0.008;
    if (pose.speed > 0.3) {
      bob = Math.abs(Math.sin(t)) * 0.05;
      lean = Math.sin(t * 0.5) * 0.1;
      drift = Math.sin(t * 0.5 - 0.6) * 0.06;
      wobble = Math.sin(t * 0.31) * 0.1;
      tilt = 0.05;
    }
    if (pose.mode === 'air') { bob = 0.1; lean = 0; tilt = -0.15; }
    if (pose.mode === 'fly') { bob = 0; lean = 0; drift = 0; wobble = 0; }
    // Orlan floats up a wall rather than climbing it: leaning back from the rock, rising in slow surges, robe swaying,
    // a glow under his hem.
    const climbing = pose.mode === 'climb';
    if (climbing) {
      const rate = Math.abs(pose.climbRate ?? 0);
      this.staticPhase += dt * rate * 1.5;
      bob = Math.sin(t * 2.2) * (0.03 + rate * 0.03);
      lean = Math.sin(t * 0.7) * 0.06;
      drift = 0;
      wobble = Math.sin(t * 0.5) * 0.05;
      tilt = -0.12;
    }
    if (!this.climbGlow && climbing) { this.climbGlow = glowSprite(0x8b3dff, 1.1, 0.55, true); this.climbGlow.position.set(0, 0.05, 0); r.parent?.add(this.climbGlow); }
    if (this.climbGlow) this.climbGlow.visible = climbing;
    // Orlan's robe floats him: a slow bob, leaning into the stroke.
    if (pose.mode === 'swim') { bob = Math.sin(t * 0.8) * 0.05; lean = Math.sin(t * 0.4) * 0.04; drift = 0; tilt = pose.speed > 0.3 ? 0.12 : 0.03; }
    if (pose.attack !== undefined) {
      const a = pose.attack;
      const windup = a < 0.3 ? a / 0.3 : 1 - (a - 0.3) / 0.7;
      lean = 0.18 * windup - 0.28 * (1 - windup) * (a > 0.3 ? 1 : 0);
      scaleY = 1 + windup * 0.04;
    }
    if (pose.landed !== undefined && pose.landed < 0.25) { bob -= 0.05 * (1 - pose.landed / 0.25); }
    r.position.y = bob;
    r.position.x += (drift - r.position.x) * Math.min(1, dt * 6);
    r.rotation.z += (lean - r.rotation.z) * Math.min(1, dt * 6);
    r.rotation.y += (wobble - r.rotation.y) * Math.min(1, dt * 6);
    r.rotation.x += (tilt - r.rotation.x) * Math.min(1, dt * 8);
    r.scale.set(1, scaleY, 1);
    m.update(dt);
    this.smoke?.update(dt, pose.speed > 0.3);
  }

  /** Maps a pose to a model clip. One-shot clips (attacks, hits) restart only when a new swing begins. */
  private driveModel(pose: RigPose, dt: number): void {
    const m = this.model!;
    const v = pose.speed;
    if (!m.hasClips) { this.driveStaticModel(m, pose, dt); return; }
    // The cyclone is spun by hand over the walk; from the air Wren shoots off her bow and Sir Aldric swings one-armed,
    // so the body keeps its flying pose.
    const cyclone = pose.burst?.kind === 'cyclone';
    const airStrike = pose.mode === 'fly' && pose.attack !== undefined && (m.id === 'archer' || m.id === 'knight');
    const swing = m.id === 'knight' ? m.layer('attack', RIGHT_ARM) : null;
    if (swing) {
      if (airStrike) {
        if (!this.airSwing) { swing.reset(); swing.play(); this.airSwing = true; }
        swing.time = swing.getClip().duration * Math.min(0.98, pose.attack!);
        swing.paused = true;
        swing.setEffectiveWeight(SIP.weight * this.flight);
      } else if (this.airSwing) { swing.stop(); this.airSwing = false; }
    }
    if (pose.attack !== undefined && !cyclone && !airStrike) {
      const k = pose.attackKind;
      const clip = k === 'heavy' ? 'heavy' : k === 'skill' || k === 'burst' ? 'cast' : 'attack';
      this.shotClip = clip;
      // A new swing starts when the progress counter restarts or the attack kind changes.
      const fresh = this.lastAttack === undefined || pose.attack < this.lastAttack || this.lastKind !== k;
      if (pose.charging) {
        // Hold the heavy swing at its wind-up while the charge builds.
        if (fresh || m.playing !== clip) { if (!m.play(clip, true, 0.9)) m.play('attack', true, 0.9); }
        m.holdAt(0.3);
        this.wasCharging = true;
      } else if (fresh || m.playing !== clip) {
        if (this.wasCharging && m.playing === clip) m.resumeFit(pose.attackDuration ?? 0.6);
        else if (!m.play(clip, true, 1, pose.attackDuration)) m.play('attack', true, 1, pose.attackDuration);
        this.wasCharging = false;
      }
      this.lastKind = k;
    } else if (pose.pose) {
      // A clip named after the pose wins (Meshy exports 'sit', 'read', 'stir'...); then the generic fallbacks.
      const generic = pose.pose === 'sit' || pose.pose === 'drink' || pose.pose === 'read' || pose.pose === 'throne' || pose.pose === 'sitSword' || pose.pose === 'fish' || pose.pose === 'row' ? 'sit' : pose.pose === 'kneel' ? 'kneel' : 'idle';
      if (!m.play(pose.pose) && !m.play(generic)) m.play('idle');
    } else if (pose.mode === 'air') {
      // Take off quickly, then freeze at the apex pose until the ground comes back.
      if (m.playing !== 'jump' && !m.play('jump', true, 1.6)) m.play('idle');
      m.holdAt(0.45);
    } else if (pose.mode === 'fly') {
      if (!m.play('fly')) m.play('idle', false, 0.6);
      // Riding the bow wants still arms: Wren's idle gestures freely, so it is held on a calm frame.
      if (m.id === 'archer' && m.playing === 'idle') m.freezeAt(this.seat.frame);
    }
    else if (pose.mode === 'climb') {
      // The wall climb (a Meshy preset on the heroes' shared skeleton), hand over hand at the pace of the climb; still on
      // the wall it holds the grip, climbing down it plays backwards.
      const rate = pose.climbRate ?? 0;
      const speed = Math.abs(rate) < 0.1 ? 0 : Math.max(-1.6, Math.min(1.6, rate / 1.2));
      if (!m.play('climb', false, speed)) m.play('idle', false, 0.5);
    }
    else if (pose.mode === 'swim') {
      // Strokes matched to the speed through the water; treading water when still.
      if (v > 0.3) { if (!m.play('swim', false, Math.max(0.7, v / 2.6))) m.play('walk', false, 0.6); }
      else if (!m.play('swimIdle')) m.play('idle');
    }
    // (A little hysteresis: a speed hovering at the threshold does not flip between the run and the walk.)
    else if (v > (m.playing === 'run' ? 5.1 : 5.9)) { if (!m.play('run', false, v / 7)) m.play('walk', false, v / 4); }
    else if (v > 0.3) { if (!m.play('walk', false, Math.max(0.6, v / 4))) m.play('run', false, v / 7); }
    else {
      m.play('idle');
      // Wren's idle clip stretches her arms up and out; she stands easy on its calm first frame (animateSnack adds
      // the breathing and the mushrooms).
      if (m.id === 'archer') m.freezeAt(SHROOM.frame);
    }
    // Wren turns side-on for a shot (her whole body on foot; in the air flyPose twists only her spine).
    if (m.id === 'archer') {
      const want = pose.attack !== undefined && !airStrike ? SHOT_TURN[this.shotClip] ?? 0 : 0;
      this.shotTurn += (want - this.shotTurn) * Math.min(1, dt * 12);
      m.root.rotation.y = this.shotTurn * (1 - this.flight);
    }
    m.update(dt);
    this.smoke?.update(dt, v > 0.3);
    this.lastAttack = pose.attack;
    if (pose.attack === undefined) { this.lastKind = undefined; this.wasCharging = false; }
  }

  /** World-space effects (the weapon trail, pipe smoke): add them to the scene next to the root. */
  get trailObject(): Object3D {
    return this.fx;
  }

  /**
   * A procedural turn on top of the clip. The bone's clip pose is restored at the start of the next frame: the mixer
   * only rewrites a bone when its track value changes, so a frozen or constant track would otherwise keep (and
   * pile up) every turn.
   */
  private turn(bone: Object3D | null, axis: Vector3, angle: number): void {
    if (!bone || angle === 0) return;
    if (!this.turned.some((t) => t.bone === bone)) this.turned.push({ bone, q: bone.quaternion.clone() });
    turnBone(bone, axis, angle);
  }

  /**
   * In the water the body floats: the swim clips keep the hips wherever their author put them, so the body is lifted
   * until the hips ride just under the surface (the controller keeps the feet SWIM_FLOAT below it).
   */
  private swimPose(pose: RigPose, dt: number): void {
    const m = this.model;
    const hips = this.bones?.hips;
    if (!m || !hips) return;
    let want = 0;
    if (pose.mode === 'swim') {
      m.root.updateWorldMatrix(true, true);
      want = SWIM_HIPS - (hips.getWorldPosition(_a).y - this.root.getWorldPosition(_b).y - m.root.position.y);
    }
    this.swimLift += (want - this.swimLift) * Math.min(1, dt * 6);
    if (Math.abs(this.swimLift) > 1e-3) m.root.position.y += this.swimLift;
  }

  /** Turns `bone` (by `f` of the way) so its child points at `target`, a point in the body frame. */
  private aim(bone: Object3D | null, child: Object3D | null, target: Vector3, f: number): void {
    if (!bone || !child || !this.model) return;
    const at = this.model.frame.localToWorld(target);
    const p = bone.getWorldPosition(_a);
    const from = child.getWorldPosition(_b).sub(p).normalize();
    const to = at.sub(p).normalize();
    _q.setFromUnitVectors(from, to); // w ≥ 0
    const angle = 2 * Math.acos(Math.min(1, _q.w));
    const sin = Math.sqrt(Math.max(1e-9, 1 - _q.w * _q.w));
    _ax.set(_q.x / sin, _q.y / sin, _q.z / sin);
    this.turn(bone, _ax, angle * f);
  }

  /**
   * Seated bodies sit up: some sit clips (Yung Lean's Chair_Sit) fold the torso flat over the thighs; a torso leaning
   * further than SIT_LEAN back (or a little forward) is turned at the lower spine until the neck is over the hips.
   */
  private sitUpright(pose: RigPose): void {
    const m = this.model;
    const bn = this.bones;
    const p = pose.pose;
    if (!m || !bn?.hips || !bn.spine0 || !bn.neck || !(p === 'sit' || p === 'throne' || p === 'drink' || p === 'read' || p === 'sitSword')) return;
    m.root.updateWorldMatrix(true, true);
    const hips = m.frame.worldToLocal(bn.hips.getWorldPosition(_a));
    const neck = m.frame.worldToLocal(bn.neck.getWorldPosition(_b));
    const dy = neck.y - hips.y;
    const dz = neck.z - hips.z;
    const lean = Math.atan2(-dz, dy); // > 0: leaning back, < 0: folded forward (the frame's front is +z)
    const want = Math.max(-SIT_LEAN * 0.6, Math.min(SIT_LEAN, lean));
    if (Math.abs(want - lean) < 0.05) return;
    const len = Math.hypot(dy, dz);
    this.aim(bn.spine0, bn.neck, _t.set(neck.x, hips.y + Math.cos(want) * len, hips.z - Math.sin(want) * len), 1);
  }

  /** Advance the animation. Call once per rendered frame. */
  animate(pose: RigPose, dt: number): void {
    for (const t of this.turned) t.bone.quaternion.copy(t.q);
    this.turned.length = 0;
    // (The clip's finger rotations back too: a frozen or constant track would not rewrite them, and the easing would
    // pile up frame after frame.)
    for (const f of this.fingerRest) if (f.held) { f.bone.quaternion.copy(f.clip); f.held = false; }
    if (this.model) {
      this.driveModel(pose, dt);
      this.sitUpright(pose);
      this.flyPose(pose, dt);
      this.swimPose(pose, dt);
      this.animateCyclone(pose, dt);
      this.animateCup(pose, dt);
      this.animateNpcCup(dt);
      this.animateSnack(pose, dt);
    }
    else this.placeholder?.update(dt);
    this.animateProp(pose, dt);
    this.animateTrail(pose, dt);
  }

  /** Weapon tip positions: from the model's hand bone when it has one, else a fixed offset in front of the root. */
  private weaponTips(): void {
    const reach = WEAPON_REACH[this.def.weapon];
    if (this.hand) {
      this.hand.updateWorldMatrix(true, false);
      this.hand.getWorldPosition(this.tipA);
      this.axis.set(0, 1, 0).transformDirection(this.hand.matrixWorld);
      this.tipB.copy(this.tipA).addScaledVector(this.axis, reach);
      return;
    }
    this.root.updateWorldMatrix(true, false);
    this.tipA.set(0.5, 1.1, 0).applyMatrix4(this.root.matrixWorld);
    this.tipB.set(0.5 + reach, 1.2, 0).applyMatrix4(this.root.matrixWorld);
  }

  private animateTrail(pose: RigPose, dt: number): void {
    const active = pose.attack !== undefined && this.def.weapon !== 'staff' && this.def.weapon !== 'bow';
    const mat = this.trail.material as MeshBasicMaterial;
    if (active) {
      this.weaponTips();
      for (let i = this.trailPoints.length - 2; i >= 2; i -= 2) {
        this.trailPoints[i].copy(this.trailPoints[i - 2]);
        this.trailPoints[i + 1].copy(this.trailPoints[i - 1]);
      }
      if (this.trailAttack === undefined || pose.attack! < this.trailAttack) {
        for (let i = 0; i < this.trailPoints.length; i += 2) { this.trailPoints[i].copy(this.tipA); this.trailPoints[i + 1].copy(this.tipB); }
      }
      this.trailPoints[0].copy(this.tipA);
      this.trailPoints[1].copy(this.tipB);
      for (let i = 0; i < this.trailPoints.length; i++) this.trailPos.setXYZ(i, this.trailPoints[i].x, this.trailPoints[i].y, this.trailPoints[i].z);
      this.trailPos.needsUpdate = true;
      this.trail.visible = true;
      mat.opacity = pose.attack! > 0.3 ? 0.55 : 0.0;
    } else {
      mat.opacity = Math.max(0, mat.opacity - dt * 4);
      if (mat.opacity <= 0) this.trail.visible = false;
    }
    this.trailAttack = pose.attack;
  }
}

import { AdditiveBlending, type AnimationAction, BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, LoopOnce, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Vector3, type Object3D, type SkinnedMesh, type Sprite } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModelOrWarn, ModelRig } from '../models/ModelRig';
import { MissingModelPlaceholder } from '../models/Placeholder';
import { PipeSmoke } from '../render/Smoke';
import { capeKeepAttribute, patchCape, patchRobeWind } from '../render/Materials';
import { glowSprite } from '../render/Glow';
import { Levitation } from '../render/Levitate';
import { LeanCup } from '../render/LeanCup';
import { MODELS } from '../data/models';
import type { Mode } from '../player/CharacterController';
import type { CharacterDef, WeaponKind } from './roster';

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
  grounded?: boolean;
  /** How long the whole swing or cast lasts, so the clip is fitted to it. */
  attackDuration?: number;
  /** Holding the heavy attack: freeze the swing at its wind-up. */
  charging?: boolean;
}

/** How far the weapon's tip sits from the hand, for the swing trail. */
const WEAPON_REACH: Record<WeaponKind, number> = { sword: 1.1, greatsword: 1.6, bow: 0.7, staff: 1.5 };
/** Model pulled into the right hand while attacking; null when the body's own baked weapon does the job. */
const WEAPON_MODEL: Record<WeaponKind, string | null> = { sword: null, greatsword: 'greatsword', bow: null, staff: 'staff' };
/**
 * How each hero flies: Orlan levitates in a swirl of his colour, Wren straddles her bow and rides it, Sir Aldric
 * glides on his cape. Ride props sit in the body's own frame (x = the body's left, y up from the feet, z forward),
 * metres. Wren's bow lies lengthwise under her, string side up (archer-bow.glb: long axis y, string toward +x), so its
 * front limb rises ahead of her like a prow.
 */
type RideProp = { model: string; x: number; y: number; z: number; rx: number; ry: number; rz: number; slide: number };
const RIDE: Record<WeaponKind, RideProp | 'cape' | 'levitate' | null> = {
  staff: 'levitate',
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
 * Sir Aldric's cup of lean in his left hand (mixamorigLeftHand frame, metres: the cup's foot under the fingers,
 * upright when he holds it before a sip). The sip is Stand_and_Drink's left arm, neck and head, layered over whatever
 * he is doing, from `from` to `to` of the clip (hand at the mouth around 0.4–0.55), with a slurp at `slurpAt`.
 */
const CUP_GRIP = { x: -0.047, y: 0.108, z: -0.043, rx: -0.56, ry: -0.426, rz: -1.931 };
const SIP = { from: 0.3, to: 0.66, slurpAt: 0.45, weight: 30, every: [10, 16] as const };
const SIP_BONES = /left(shoulder|arm|forearm|hand)|neck|head/i;
/** Where a swimmer's hips ride above the controller's feet: just under the surface (CONTROLLER.swimFloat = 1.05). */
const SWIM_HIPS = 0.92;
const _t = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const _ax = new Vector3();

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
  private levitation: Levitation | null = null;
  /** Wren's bow in hand for a shot, slung on her back between shots, and the spectral copy she draws while riding. */
  private heldBow: Group | null = null;
  private stowedBow: Group | null = null;
  private ghostBow: Group | null = null;
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
  private sip: { action: AnimationAction; w: number; slurped: boolean } | null = null;
  private sipIn: number = SIP.every[0];
  /** Sounds the rig asks for (set by main). */
  static sound: { slurp(gain: number): void } | null = null;
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
    if (this.model.hasClips) {
      const b = (re: RegExp) => this.model!.bone(re);
      this.bones = {
        hips: b(/hips$/i), spine0: b(/spine$/i), spine: b(/spine1$/i), spine2: b(/spine2$/i), neck: b(/neck$/i), head: b(/:head$|^head$/i),
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
    } else if (ride === 'levitate' && HEROES.has(id)) {
      this.levitation = new Levitation(this.def.accent);
      this.root.add(this.levitation.group);
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
    const pivot = new Group();
    pivot.position.set(CUP_GRIP.x, CUP_GRIP.y, CUP_GRIP.z);
    pivot.rotation.set(CUP_GRIP.rx, CUP_GRIP.ry, CUP_GRIP.rz);
    this.cupGripQ.copy(pivot.quaternion);
    pivot.add(this.cup.group);
    holder.add(pivot);
    this.offHand.add(holder);
    this.fx.add(this.cup.drops);
    this.cupPivot = pivot;
  }

  /**
   * The lean: a sip every so often while he stands or walks (the drink clip's arm and head layered over the base
   * clip); anything else he does (an attack, a charge, a jump, flight, swimming) fades the sip out at once and the
   * base clip has the arm back. Between sips the wrist keeps the cup level; the liquid sloshes either way.
   */
  private animateCup(pose: RigPose, dt: number): void {
    const m = this.model;
    if (!this.cup || !this.cupPivot || !m) return;
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
    if (this.sip) {
      const s = this.sip;
      const k = (s.action.time / s.action.getClip().duration - SIP.from) / (SIP.to - SIP.from);
      const done = !calm || k >= 1;
      s.w += ((done ? 0 : 1) - s.w) * Math.min(1, dt * (calm ? 5 : 25));
      s.action.setEffectiveWeight(s.w * SIP.weight);
      if (!s.slurped && k >= SIP.slurpAt) { s.slurped = true; Rig.sound?.slurp(1); }
      if (done && s.w < 0.02) { s.action.stop(); this.sip = null; }
      lead = s.w;
    }
    this.cupPivot.quaternion.copy(this.cupGripQ);
    LeanCup.level(this.cupPivot, 0.92 * (1 - lead));
    this.cup.update(dt);
  }

  /** Wren's bow in her left hand (on foot), plus a spectral copy for shots fired while she rides the real one. */
  private attachHeldBow(id: string, gltf: GLTF): void {
    if (!this.model || !this.offHand) return;
    this.model.root.updateWorldMatrix(true, true);
    const ws = new Vector3();
    this.offHand.getWorldScale(ws);
    const make = (ghost: boolean): Group => {
      const rig = new ModelRig(id, gltf, { cloneMaterials: ghost });
      if (ghost) rig.root.traverse((o) => { const m = o as Mesh; if (m.isMesh) m.material = new MeshBasicMaterial({ color: this.def.accent, transparent: true, opacity: 0.75, blending: AdditiveBlending, depthWrite: false, toneMapped: false }); });
      const pivot = new Group();
      pivot.position.set(HELD_BOW.x, HELD_BOW.y, HELD_BOW.z);
      pivot.rotation.set(HELD_BOW.rx, HELD_BOW.ry, HELD_BOW.rz);
      rig.root.position.y = HELD_BOW.slide;
      pivot.add(rig.root);
      const holder = new Group();
      holder.scale.setScalar(1 / Math.max(1e-4, ws.y));
      holder.add(pivot);
      holder.visible = !ghost;
      this.offHand!.add(holder);
      return holder;
    };
    this.heldBow = make(false);
    this.ghostBow = make(true);
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
    this.levitation?.update(dt, f);
    // Wren's bow is in her hand on foot and under her in the air; shooting from the air she draws a spectral bow.
    const shooting = pose.attack !== undefined || Math.abs(this.shotTurn) > 0.25;
    if (this.heldBow) this.heldBow.visible = f <= 0.05 && shooting;
    if (this.stowedBow) this.stowedBow.visible = f <= 0.05 && !shooting;
    if (this.ghostBow) this.ghostBow.visible = f > 0.05 && pose.attack !== undefined;
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
    } else if (ride === 'levitate') {
      // Upright, floating a hand's breadth higher than on foot, rocking gently on the swirl.
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
      this.turn(bn.lArm, FORWARD, 0.95 * f);
      this.turn(bn.rArm, FORWARD, -0.95 * f);
      this.turn(bn.lArm, LATERAL, 0.35 * f);
      this.turn(bn.rArm, LATERAL, 0.35 * f);
      this.turn(bn.neck, LATERAL, -0.55 * f);
      this.turn(bn.head, LATERAL, -0.5 * f);
      // The legs trail loosely: knees a little bent, each swinging gently out of step with the other.
      const t = this.flightTime;
      this.turn(bn.lUpLeg, LATERAL, (0.1 + Math.sin(t * 1.9) * 0.06) * f);
      this.turn(bn.rUpLeg, LATERAL, (0.06 + Math.sin(t * 1.9 + 2.2) * 0.06) * f);
      this.turn(bn.lLeg, LATERAL, (0.32 + Math.sin(t * 1.9 + 0.7) * 0.1) * f);
      this.turn(bn.rLeg, LATERAL, (0.22 + Math.sin(t * 1.9 + 2.9) * 0.1) * f);
    } else if (ride !== 'levitate') {
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
      if (pose.attack === undefined) {
        for (const side of [1, -1]) {
          const [arm, fore, hand] = side > 0 ? [bn.lArm, bn.lForeArm, this.offHand] : [bn.rArm, bn.rForeArm, this.hand];
          this.aim(arm, fore, _t.set(s.elbow[0] * side, s.elbow[1], s.elbow[2]), f);
          this.aim(fore, hand, _t.set(s.grip[0] * side, s.grip[1], s.grip[2]), f);
        }
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
    if (pose.attack !== undefined) {
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
    else if (pose.mode === 'climb') { if (!m.play('climb')) m.play('idle', false, 0.5); }
    else if (pose.mode === 'swim') {
      // Strokes matched to the speed through the water; treading water when still.
      if (v > 0.3) { if (!m.play('swim', false, Math.max(0.7, v / 2.6))) m.play('walk', false, 0.6); }
      else if (!m.play('swimIdle')) m.play('idle');
    }
    else if (v > 5.5) { if (!m.play('run', false, v / 7)) m.play('walk', false, v / 4); }
    else if (v > 0.3) { if (!m.play('walk', false, Math.max(0.6, v / 4))) m.play('run', false, v / 7); }
    else m.play('idle');
    // Wren turns side-on for a shot (her whole body on foot; in the air flyPose twists only her spine).
    if (m.id === 'archer') {
      const want = pose.attack !== undefined ? SHOT_TURN[this.shotClip] ?? 0 : 0;
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

  /** Advance the animation. Call once per rendered frame. */
  animate(pose: RigPose, dt: number): void {
    for (const t of this.turned) t.bone.quaternion.copy(t.q);
    this.turned.length = 0;
    if (this.model) { this.driveModel(pose, dt); this.flyPose(pose, dt); this.swimPose(pose, dt); this.animateCup(pose, dt); }
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

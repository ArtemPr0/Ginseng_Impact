import { AdditiveBlending, BufferAttribute, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Quaternion, Vector3, type Object3D, type Sprite } from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { loadModelOrWarn, ModelRig } from '../models/ModelRig';
import { MissingModelPlaceholder } from '../models/Placeholder';
import { PipeSmoke } from '../render/Smoke';
import { patchCape, patchRobeWind } from '../render/Materials';
import { glowSprite } from '../render/Glow';
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
 * How each hero flies: Orlan rides his staff like a broom, Wren sits on her bow, Sir Aldric glides on his cape.
 * Ride props sit in the body's own frame (x = the body's left, y up from the feet, z forward), metres.
 */
const RIDE: Record<WeaponKind, { model: string; x: number; y: number; z: number; rx: number; ry: number; rz: number; slide: number } | 'cape' | null> = {
  staff: { model: 'staff', x: 0, y: 0.74, z: 0, rx: Math.PI / 2 - 0.1, ry: 0, rz: 0, slide: -0.95 },
  bow: { model: 'bow', x: 0, y: 0.86, z: 0.06, rx: 0, ry: 0, rz: Math.PI / 2, slide: -0.75 },
  greatsword: 'cape',
  sword: 'cape',
};
const HAND_BONE = /right.?hand|hand[_.]?r\b|righthand/i;
const _pq = new Quaternion();
const _bq = new Quaternion();
const _q = new Quaternion();
const _fq = new Quaternion();
const LATERAL = new Vector3();
const FORWARD = new Vector3();

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
  private bones: Record<'hips' | 'spine' | 'neck' | 'head' | 'lArm' | 'rArm' | 'lUpLeg' | 'rUpLeg' | 'lLeg' | 'rLeg', Object3D | null> | null = null;

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
      this.smoke = new PipeSmoke();
      this.smoke.group.position.set(anchor.x, anchor.y, anchor.z);
      this.model.frame.add(this.smoke.group);
    }
    if (this.model.hasClips) {
      const b = (re: RegExp) => this.model!.bone(re);
      this.bones = {
        hips: b(/hips$/i), spine: b(/spine1$/i), neck: b(/neck$/i), head: b(/:head$|^head$/i),
        lArm: b(/leftarm$/i), rArm: b(/rightarm$/i), lUpLeg: b(/leftupleg$/i), rUpLeg: b(/rightupleg$/i), lLeg: b(/leftleg$/i), rLeg: b(/rightleg$/i),
      };
    }
    const ride = RIDE[this.def.weapon];
    if (ride === 'cape' && this.model.hasClips) {
      // Sir Aldric's cape hangs behind his back from the shoulders to the shins (knight.glb, bind pose).
      const mat = this.model.materials[0];
      if (mat) this.capeLift = patchCape(mat, this.model.rawHeight, { shoulder: 0.79, back: -0.04, depth: 0.035 });
    } else if (ride && ride !== 'cape') {
      void loadModelOrWarn(ride.model, MODELS[ride.model]?.label).then((g) => { if (g) this.attachRide(ride.model, g, ride); });
    }
  }

  /** The ridden staff or bow, hidden until the hero takes off. */
  private attachRide(id: string, gltf: GLTF, at: { x: number; y: number; z: number; rx: number; ry: number; rz: number; slide: number }): void {
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
    } else {
      const lean = (this.def.weapon === 'staff' ? 0.26 : 0.08) * f;
      m.root.rotation.x = lean;
      m.root.position.set(0, (this.def.weapon === 'bow' ? 0.18 : 0.12) * f + bob, 0);
    }
    if (!this.bones) return;
    const bn = this.bones;
    m.root.updateWorldMatrix(true, true);
    m.frame.getWorldQuaternion(_fq);
    LATERAL.set(1, 0, 0).applyQuaternion(_fq);
    FORWARD.set(0, 0, 1).applyQuaternion(_fq);
    if (ride === 'cape') {
      turnBone(bn.lArm, FORWARD, 0.95 * f);
      turnBone(bn.rArm, FORWARD, -0.95 * f);
      turnBone(bn.lArm, LATERAL, 0.35 * f);
      turnBone(bn.rArm, LATERAL, 0.35 * f);
      turnBone(bn.neck, LATERAL, -0.55 * f);
      turnBone(bn.head, LATERAL, -0.5 * f);
    } else {
      // Seated: thighs forward, shins hanging down, a little lean over the knees.
      turnBone(bn.lUpLeg, LATERAL, -1.35 * f);
      turnBone(bn.rUpLeg, LATERAL, -1.35 * f);
      turnBone(bn.lLeg, LATERAL, 1.3 * f);
      turnBone(bn.rLeg, LATERAL, 1.3 * f);
      turnBone(bn.lArm, FORWARD, -0.35 * f);
      turnBone(bn.rArm, FORWARD, 0.35 * f);
      turnBone(bn.spine, LATERAL, 0.12 * f);
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
    let lean = Math.sin(t * 0.5) * 0.015;
    const tilt = 0;
    let scaleY = 1 + Math.sin(t * 0.9) * 0.008;
    if (pose.speed > 0.3) { bob = Math.abs(Math.sin(t)) * 0.07; lean = -0.12 - Math.min(0.12, pose.speed * 0.012); }
    if (pose.mode === 'air') { bob = 0.1; lean = -0.2; }
    if (pose.mode === 'fly') { bob = 0; lean = 0; }
    if (pose.attack !== undefined) {
      const a = pose.attack;
      const windup = a < 0.3 ? a / 0.3 : 1 - (a - 0.3) / 0.7;
      lean = 0.18 * windup - 0.28 * (1 - windup) * (a > 0.3 ? 1 : 0);
      scaleY = 1 + windup * 0.04;
    }
    if (pose.landed !== undefined && pose.landed < 0.25) { bob -= 0.05 * (1 - pose.landed / 0.25); }
    r.position.y = bob;
    r.rotation.z = lean;
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
    } else if (pose.mode === 'fly') { if (!m.play('fly')) m.play('idle', false, 0.6); }
    else if (pose.mode === 'climb') { if (!m.play('climb')) m.play('idle', false, 0.5); }
    else if (v > 5.5) { if (!m.play('run', false, v / 7)) m.play('walk', false, v / 4); }
    else if (v > 0.3) { if (!m.play('walk', false, Math.max(0.6, v / 4))) m.play('run', false, v / 7); }
    else m.play('idle');
    m.update(dt);
    this.smoke?.update(dt, v > 0.3);
    this.lastAttack = pose.attack;
    if (pose.attack === undefined) { this.lastKind = undefined; this.wasCharging = false; }
  }

  /** The trail lives in world space: add it to the scene next to the root. */
  get trailObject(): Object3D {
    return this.trail;
  }

  /** Advance the animation. Call once per rendered frame. */
  animate(pose: RigPose, dt: number): void {
    if (this.model) { this.driveModel(pose, dt); this.flyPose(pose, dt); }
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

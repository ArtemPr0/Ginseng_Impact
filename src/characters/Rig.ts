import {
  AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CapsuleGeometry, ConeGeometry, CylinderGeometry, DoubleSide,
  Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, PlaneGeometry, SphereGeometry, TorusGeometry, Vector3, type Object3D,
} from 'three';
import { surface } from '../render/Materials';
import { ModelRig } from '../models/ModelRig';
import { PipeSmoke } from '../render/Smoke';
import { MODELS } from '../data/models';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { PALETTE } from '../render/palette';
import type { Mode } from '../player/CharacterController';
import type { CharacterDef } from './roster';

export interface RigPose {
  mode: Mode;
  /** Horizontal speed, m/s. */
  speed: number;
  /** 0..1 progress of an attack swing or cast, undefined when idle. */
  attack?: number;
  /** Which combo hit (0..2), 'skill', 'heavy' (charged) or 'burst'. Drives the swing shape. */
  attackKind?: number | 'skill' | 'heavy' | 'burst';
  /** Static NPC poses. */
  pose?: 'sit' | 'kneel' | 'row' | 'ride' | 'carry' | 'drink' | 'fish' | 'telescope' | 'read' | 'pray' | 'stir' | 'offer' | 'bow' | 'banner' | 'sitSword' | 'lantern' | 'throne' | 'watch';
  /** Seconds since landing, for the landing crouch. */
  landed?: number;
  grounded?: boolean;
}

/** A limb with a joint: pivot → upper segment → joint pivot → lower segment (+ optional end part). */
class Limb {
  readonly pivot = new Group();
  readonly joint = new Group();
  constructor(upperLen: number, lowerLen: number, radius: number, matUpper: ReturnType<typeof surface>, matLower: ReturnType<typeof surface>, end?: Mesh) {
    const upper = new Mesh(new CapsuleGeometry(radius, upperLen - radius * 2, 3, 10), matUpper);
    upper.position.y = -upperLen / 2;
    upper.castShadow = true;
    this.pivot.add(upper);
    this.joint.position.y = -upperLen;
    this.pivot.add(this.joint);
    const lower = new Mesh(new CapsuleGeometry(radius * 0.85, lowerLen - radius * 1.7, 3, 10), matLower);
    lower.position.y = -lowerLen / 2;
    lower.castShadow = true;
    this.joint.add(lower);
    if (end) {
      end.position.y = -lowerLen;
      this.joint.add(end);
    }
  }
}

function lerpAngle(cur: number, target: number, k: number): number {
  return cur + (target - cur) * k;
}

/**
 * Smooth procedural humanoid: capsule limbs with elbows and knees, cloth cloak, helmets/hats, weapons with trails.
 * The root sits at the feet; the caller sets `root.rotation.y` from the controller yaw.
 */
export class Rig {
  readonly root = new Group();
  readonly hips = new Group();
  readonly chest = new Group();
  readonly head = new Group();
  private readonly armL: Limb;
  private readonly armR: Limb;
  /** End-of-arm attachment points for props. */
  readonly handL = new Group();
  readonly handR = new Group();
  private readonly legL: Limb;
  private readonly legR: Limb;
  private readonly weapon = new Group();
  /** Orlan's pipe. */
  private smoke: PipeSmoke | null = null;
  private readonly cloak?: Mesh;
  private readonly cloakRest: Float32Array = new Float32Array(0);
  private readonly orbit?: Group;
  private readonly trail: Mesh;
  private readonly trailPoints: Vector3[] = [];
  private readonly trailPos: Float32BufferAttribute;
  private readonly tipA = new Vector3();
  private readonly tipB = new Vector3();
  private phase = 0;
  private time = 0;
  private readonly legLen: number;
  private lastAttack: number | undefined;
  /** Real glTF model, when one has been generated for this character. */
  model: ModelRig | null = null;
  private lastClipOnce = '';

  constructor(readonly def: CharacterDef) {
    const { height: h, bulk: b, cloth, armour, skin, accent } = def.look;
    const legUpper = h * 0.26;
    const legLower = h * 0.24;
    const L = legUpper + legLower;
    this.legLen = L;
    const T = h * 0.3;
    const headR = h * 0.075;
    const torsoR = h * 0.1 * b;

    const clothMat = surface({ color: cloth, roughness: 0.85 });
    const armourMat = def.look.skeleton ? surface({ color: skin, roughness: 0.8 }) : surface({ color: armour, roughness: 0.5, metalness: 0.35 });
    const skinMat = surface({ color: skin, roughness: 0.7 });
    const runeMat = surface({ color: PALETTE.void, emissive: accent, emissiveIntensity: 1.1 });

    this.hips.position.y = L;
    this.root.add(this.hips);

    // Pelvis + chest (two capsules give a waist).
    const pelvis = new Mesh(new CapsuleGeometry(torsoR * 0.95, T * 0.15, 3, 12), armourMat);
    pelvis.scale.set(1.1, 1, 0.8);
    pelvis.position.y = T * 0.12;
    pelvis.castShadow = true;
    this.hips.add(pelvis);
    this.chest.position.y = T * 0.3;
    this.hips.add(this.chest);
    const torso = new Mesh(new CapsuleGeometry(torsoR, T * 0.45, 4, 14), armourMat);
    torso.scale.set(1.25, 1, 0.85);
    torso.position.y = T * 0.35;
    torso.castShadow = true;
    this.chest.add(torso);
    const belt = new Mesh(new TorusGeometry(torsoR * 1.05, 0.025, 6, 16), surface({ color: PALETTE.bark }));
    belt.rotation.x = Math.PI / 2;
    belt.position.y = T * 0.05;
    this.chest.add(belt);
    // Chest rune / brooch.
    const rune = new Mesh(new BoxGeometry(torsoR * 0.28, T * 0.16, 0.02), runeMat);
    rune.position.set(0, T * 0.42, torsoR * 0.85 + 0.01);
    this.chest.add(rune);
    // Shoulders.
    for (const side of [-1, 1]) {
      const pad = new Mesh(new SphereGeometry(torsoR * 0.55, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), armourMat);
      pad.position.set(side * torsoR * 1.3, T * 0.72, 0);
      pad.castShadow = true;
      this.chest.add(pad);
    }

    // Head + hood/helmet/hat.
    this.head.position.y = T * 0.86;
    this.chest.add(this.head);
    const skull = new Mesh(new SphereGeometry(headR, 16, 12), skinMat);
    skull.scale.set(0.95, 1.1, 1);
    skull.position.y = headR * 1.05;
    skull.castShadow = true;
    this.head.add(skull);
    const eyes = new Mesh(new BoxGeometry(headR * 1.0, headR * 0.14, 0.02), surface({ color: PALETTE.void, emissive: accent, emissiveIntensity: 1.0 }));
    eyes.position.set(0, headR * 1.1, headR * 0.92);
    this.head.add(eyes);
    if (def.look.antlers) {
      const antlerMat = surface({ color: 0x3a2e24, roughness: 0.9 });
      for (const side of [-1, 1]) {
        const beam = new Mesh(new CylinderGeometry(0.02, 0.035, headR * 3.2, 6), antlerMat);
        beam.position.set(side * headR * 0.7, headR * 2.6, -headR * 0.2);
        beam.rotation.z = -side * 0.55;
        beam.rotation.x = -0.2;
        this.head.add(beam);
        for (let k = 0; k < 3; k++) {
          const tine = new Mesh(new CylinderGeometry(0.012, 0.025, headR * 1.3, 5), antlerMat);
          tine.position.set(side * headR * (1.0 + k * 0.35), headR * (2.3 + k * 0.7), -headR * 0.15);
          tine.rotation.z = -side * (0.1 + k * 0.35);
          this.head.add(tine);
        }
      }
      const crown = new Mesh(new TorusGeometry(headR * 1.05, 0.02, 6, 16), surface({ color: 0x5a4a1a, roughness: 0.4, metalness: 0.7 }));
      crown.rotation.x = Math.PI / 2;
      crown.position.y = headR * 1.8;
      this.head.add(crown);
    }
    if (def.look.horns) {
      const hornMat = surface({ color: 0x0a0d2a, roughness: 0.5 });
      for (const side of [-1, 1]) {
        const horn = new Mesh(new ConeGeometry(headR * 0.3, headR * 3.6, 7), hornMat);
        horn.position.set(side * headR * 0.9, headR * 2.9, -headR * 0.2);
        horn.rotation.z = -side * 0.75;
        horn.rotation.x = -0.35;
        this.head.add(horn);
        const curl = new Mesh(new ConeGeometry(headR * 0.18, headR * 1.6, 6), hornMat);
        curl.position.set(side * headR * 2.2, headR * 3.9, -headR * 0.6);
        curl.rotation.z = -side * 1.5;
        this.head.add(curl);
      }
    }
    if (def.look.beard) {
      const beard = new Mesh(new ConeGeometry(headR * 0.55, headR * 2.4, 8), surface({ color: 0xd8dcf0, roughness: 0.9 }));
      beard.position.set(0, headR * 0.1, headR * 0.5);
      beard.rotation.x = Math.PI + 0.25;
      this.head.add(beard);
    }
    if (def.look.hat) {
      const brim = new Mesh(new CylinderGeometry(headR * 2.4, headR * 2.6, 0.03, 18), surface({ color: def.look.hatColor ?? cloth, roughness: 0.85 }));
      brim.position.y = headR * 1.9;
      brim.castShadow = true;
      const cone = new Mesh(new ConeGeometry(headR * 1.25, headR * 4.2, 14), surface({ color: def.look.hatColor ?? cloth, roughness: 0.85 }));
      cone.position.y = headR * 1.9 + headR * 2.1;
      cone.rotation.z = -0.18;
      cone.castShadow = true;
      this.head.add(brim, cone);
    } else if (def.weapon === 'greatsword') {
      const helm = new Mesh(new SphereGeometry(headR * 1.18, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), armourMat);
      helm.position.y = headR * 1.05;
      helm.castShadow = true;
      const visor = new Mesh(new BoxGeometry(headR * 1.9, headR * 0.32, headR * 0.3), surface({ color: PALETTE.void, emissive: accent, emissiveIntensity: 0.9 }));
      visor.position.set(0, headR * 1.05, headR * 0.95);
      const crest = new Mesh(new BoxGeometry(0.03, headR * 1.2, headR * 1.6), surface({ color: 0x3a1020, emissive: accent, emissiveIntensity: 0.35 }));
      crest.position.y = headR * 2.3;
      this.head.add(helm, visor, crest);
    } else {
      const hair = new Mesh(new CapsuleGeometry(headR * 0.55, headR * 2.4, 3, 10), surface({ color: 0x7f8bc0, roughness: 0.85 }));
      hair.position.set(0, headR * 0.1, -headR * 0.75);
      hair.rotation.x = 0.3;
      hair.castShadow = true;
      const hood = new Mesh(new SphereGeometry(headR * 1.12, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), clothMat);
      hood.position.y = headR * 1.1;
      hood.rotation.x = -0.3;
      this.head.add(hair, hood);
    }

    // Arms.
    const armUpper = h * 0.17;
    const armLower = h * 0.16;
    const armR = h * 0.038 * b;
    const hand = () => { const m = new Mesh(new SphereGeometry(armR * 1.15, 8, 6), skinMat); m.castShadow = true; return m; };
    this.armL = new Limb(armUpper, armLower, armR, clothMat, clothMat, hand());
    this.armR = new Limb(armUpper, armLower, armR, clothMat, clothMat, hand());
    this.armL.pivot.position.set(-torsoR * 1.35, T * 0.68, 0);
    this.armR.pivot.position.set(torsoR * 1.35, T * 0.68, 0);
    this.chest.add(this.armL.pivot, this.armR.pivot);
    this.handL.position.y = -armLower;
    this.handR.position.y = -armLower;
    this.armL.joint.add(this.handL);
    this.armR.joint.add(this.handR);

    // Legs with boots.
    const legR = h * 0.05 * b;
    const boot = () => { const m = new Mesh(new BoxGeometry(legR * 2.1, legR * 1.3, legR * 3.2), armourMat); m.position.z = legR * 0.6; m.castShadow = true; return m; };
    this.legL = new Limb(legUpper, legLower, legR, armourMat, clothMat, boot());
    this.legR = new Limb(legUpper, legLower, legR, armourMat, clothMat, boot());
    this.legL.pivot.position.set(-torsoR * 0.55, 0, 0);
    this.legR.pivot.position.set(torsoR * 0.55, 0, 0);
    this.hips.add(this.legL.pivot, this.legR.pivot);

    // Cloak: a cloth strip from the shoulders, animated on the CPU.
    if (def.look.cape || def.look.hat) {
      const w = torsoR * 2.6;
      const len = L + T * 0.55;
      const geo = new PlaneGeometry(w, len, 4, 9);
      geo.translate(0, -len / 2, 0);
      this.cloak = new Mesh(geo, surface({ color: cloth, roughness: 0.9, side: DoubleSide }));
      this.cloak.position.set(0, T * 0.78, -torsoR * 0.9);
      this.cloak.castShadow = true;
      this.chest.add(this.cloak);
      this.cloakRest = new Float32Array((geo.attributes.position as BufferAttribute).array);
    }

    // Weapon in the right hand.
    this.weapon.position.y = -armLower;
    this.armR.joint.add(this.weapon);
    this.orbit = this.buildWeapon(def, accent, armourMat);

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
    this.trail = new Mesh(tg, new MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.0, blending: AdditiveBlending, side: DoubleSide, depthWrite: false, toneMapped: false }));
    this.trail.frustumCulled = false;
    this.trail.visible = false;
    for (let i = 0; i < N; i++) this.trailPoints.push(new Vector3(), new Vector3());
  }

  /** Swaps the procedural body for a loaded glTF (the trail and props stay). */
  useModel(id: string, gltf: GLTF): void {
    this.model = new ModelRig(id, gltf);
    this.hips.visible = false;
    this.root.add(this.model.root);
    const anchor = MODELS[id]?.smoke;
    if (anchor) {
      this.smoke = new PipeSmoke();
      this.smoke.group.position.set(anchor.x, anchor.y, anchor.z);
      this.model.root.add(this.smoke.group);
    }
  }

  /** Maps a pose to a model clip. One-shot clips (attacks, hits) restart only when a new swing begins. */
  private driveModel(pose: RigPose, dt: number): void {
    const m = this.model!;
    const v = pose.speed;
    let clip: string = 'idle';
    let once = false;
    if (pose.attack !== undefined) {
      const k = pose.attackKind;
      clip = k === 'heavy' ? 'heavy' : k === 'skill' || k === 'burst' ? 'cast' : 'attack';
      once = true;
      const tag = clip + ':' + String(k) + ':' + (pose.attack < (this.lastAttack ?? 1) ? Math.random() : 0);
      if (this.lastAttack === undefined || pose.attack < this.lastAttack) this.lastClipOnce = tag;
      if (m.playing !== clip || this.lastClipOnce === tag) {
        if (!m.play(clip, true)) m.play('attack', true);
        this.lastClipOnce = '';
      }
    } else if (pose.pose) {
      clip = pose.pose === 'sit' || pose.pose === 'drink' || pose.pose === 'read' || pose.pose === 'throne' || pose.pose === 'sitSword' || pose.pose === 'fish' || pose.pose === 'row' ? 'sit' : pose.pose === 'kneel' ? 'kneel' : 'idle';
      if (!m.play(clip)) m.play('idle');
    } else if (pose.mode === 'air') { if (!m.play('jump')) m.play('idle'); }
    else if (pose.mode === 'glide') { if (!m.play('fly')) m.play('jump'); }
    else if (pose.mode === 'climb') { if (!m.play('climb')) m.play('idle', false, 0.5); }
    else if (v > 5.5) { if (!m.play('run', false, v / 7)) m.play('walk', false, v / 4); }
    else if (v > 0.3) { if (!m.play('walk', false, Math.max(0.6, v / 4))) m.play('run', false, v / 7); }
    else m.play('idle');
    void once;
    m.update(dt);
    this.smoke?.update(dt, v > 0.3);
    this.lastAttack = pose.attack;
  }

  /** The trail lives in world space: add it to the scene next to the root. */
  get trailObject(): Object3D {
    return this.trail;
  }

  private buildWeapon(def: CharacterDef, accent: number, armourMat: ReturnType<typeof surface>): Group | undefined {
    const w = this.weapon;
    const blade = (len: number, width: number, thick: number) => {
      const m = new Mesh(new BoxGeometry(width, len, thick), surface({ color: 0xaab3dc, roughness: 0.3, metalness: 0.85 }));
      m.position.y = len / 2 + 0.08;
      m.castShadow = true;
      const edge = new Mesh(new BoxGeometry(width * 0.22, len * 0.92, thick * 1.3), surface({ color: PALETTE.void, emissive: accent, emissiveIntensity: 1.3 }));
      edge.position.y = len / 2 + 0.1;
      const tip = new Mesh(new ConeGeometry(width / 2, width * 1.6, 4), surface({ color: 0xaab3dc, roughness: 0.3, metalness: 0.85 }));
      tip.position.y = len + 0.08 + width * 0.8;
      tip.rotation.y = Math.PI / 4;
      return [m, edge, tip];
    };
    if (def.weapon === 'sword') {
      const guard = new Mesh(new BoxGeometry(0.2, 0.035, 0.05), armourMat);
      guard.position.y = 0.07;
      const grip = new Mesh(new CylinderGeometry(0.018, 0.02, 0.2, 8), surface({ color: PALETTE.bark }));
      grip.position.y = -0.04;
      w.add(...blade(0.95, 0.06, 0.016), guard, grip);
      w.userData.tipLen = 1.1;
    } else if (def.weapon === 'greatsword') {
      const guard = new Mesh(new BoxGeometry(0.34, 0.05, 0.07), armourMat);
      guard.position.y = 0.08;
      const grip = new Mesh(new CylinderGeometry(0.022, 0.025, 0.36, 8), surface({ color: PALETTE.bark }));
      grip.position.y = -0.12;
      w.add(...blade(1.45, 0.12, 0.026), guard, grip);
      w.userData.tipLen = 1.6;
    } else if (def.weapon === 'bow') {
      const limb = new Mesh(new TorusGeometry(0.62, 0.016, 6, 18, Math.PI * 1.1), surface({ color: PALETTE.bark, roughness: 0.8 }));
      limb.rotation.z = -Math.PI * 0.55;
      limb.position.y = 0.1;
      const string = new Mesh(new CylinderGeometry(0.004, 0.004, 1.18, 4), surface({ color: 0xdfe6ff, emissive: accent, emissiveIntensity: 0.6 }));
      string.position.set(-0.52, 0.1, 0);
      w.add(limb, string);
      w.userData.tipLen = 0.7;
    } else {
      const shaft = new Mesh(new CylinderGeometry(0.02, 0.028, 1.75, 10), surface({ color: PALETTE.bark, roughness: 0.8 }));
      shaft.position.y = 0.45;
      shaft.castShadow = true;
      const orb = new Mesh(new SphereGeometry(0.09, 14, 10), surface({ color: PALETTE.void, emissive: accent, emissiveIntensity: 3.5 }));
      orb.position.y = 1.4;
      const orbit = new Group();
      orbit.position.y = 1.4;
      for (let i = 0; i < 3; i++) {
        const crystal = new Mesh(new ConeGeometry(0.03, 0.12, 5), surface({ color: PALETTE.void, emissive: accent, emissiveIntensity: 2.5 }));
        const a = (i / 3) * Math.PI * 2;
        crystal.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2);
        crystal.rotation.z = Math.PI;
        orbit.add(crystal);
      }
      w.add(shaft, orb, orbit);
      w.userData.tipLen = 1.5;
      w.rotation.x = Math.PI * 0.08;
      return orbit;
    }
    w.rotation.x = Math.PI * 0.5;
    return undefined;
  }

  /** Advance the animation. Call once per rendered frame. */
  animate(pose: RigPose, dt: number): void {
    if (this.model) { this.time += dt; this.driveModel(pose, dt); this.animateTrail(pose, dt); return; }
    this.time += dt;
    const v = pose.speed;
    const run = Math.min(1, v / 4.5);
    const sprint = Math.max(0, Math.min(1, (v - 4.5) / 3.5));
    const freq = 1.5 + v * 0.2;
    this.phase += dt * freq * Math.PI * 2 * (v > 0.3 ? 1 : 0);
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const k = 1 - Math.exp(-dt * 16);
    const breathe = Math.sin(this.time * 1.8);

    // Targets: pivot x-rotations (positive = forward swing of the leg, backward for arms), joint bends, hips, chest.
    let thighL = 0, thighR = 0, kneeL = 0, kneeR = 0;
    let upArmL = 0.12, upArmR = 0.12, elbowL = 0.25, elbowR = 0.25, armOutL = 0.1, armOutR = -0.1;
    let lean = 0, twist = 0, bob = 0, headPitch = 0, crouch = 0;

    switch (pose.mode) {
      case 'ground': {
        const amp = (0.65 + sprint * 0.35) * run;
        thighL = s * amp;
        thighR = -s * amp;
        // Knees bend when the leg swings back and during the lift.
        kneeL = Math.max(0, -s) * amp * 1.4 + Math.max(0, c) * amp * 0.5;
        kneeR = Math.max(0, s) * amp * 1.4 + Math.max(0, -c) * amp * 0.5;
        upArmL = -s * amp * 0.75 + 0.1;
        upArmR = s * amp * 0.75 + 0.1;
        elbowL = 0.35 + Math.max(0, -s) * amp * 0.9 + sprint * 0.7;
        elbowR = 0.35 + Math.max(0, s) * amp * 0.9 + sprint * 0.7;
        lean = 0.08 * run + 0.22 * sprint;
        twist = s * 0.08 * run;
        bob = Math.abs(c) * 0.06 * run;
        headPitch = breathe * 0.015 * (1 - run);
        if (run < 0.2) {
          upArmL = 0.08 + breathe * 0.02;
          upArmR = 0.12 + breathe * 0.02;
          bob = breathe * 0.008;
        }
        if (pose.landed !== undefined && pose.landed < 0.22) crouch = Math.sin((pose.landed / 0.22) * Math.PI) * 0.22;
        break;
      }
      case 'air':
        thighL = 0.5; thighR = -0.25; kneeL = 1.3; kneeR = 0.6;
        upArmL = -0.9; upArmR = -0.7; elbowL = 0.6; elbowR = 0.5; armOutL = 0.6; armOutR = -0.6;
        lean = 0.1;
        break;
      case 'climb':
        thighL = 1.0 + s * 0.3; thighR = 1.0 - s * 0.3; kneeL = 1.6; kneeR = 1.6;
        upArmL = -2.4 + s * 0.4; upArmR = -2.4 - s * 0.4; elbowL = 0.9; elbowR = 0.9; armOutL = 0.35; armOutR = -0.35;
        lean = -0.15;
        break;
      case 'glide':
        thighL = -0.25; thighR = -0.25; kneeL = 0.35; kneeR = 0.35;
        upArmL = -1.5; upArmR = -1.5; elbowL = 0.3; elbowR = 0.3; armOutL = 1.35; armOutR = -1.35;
        lean = 1.25;
        headPitch = -0.6;
        break;
    }

    // Static NPC poses.
    switch (pose.pose) {
      case 'sit':
        thighL = thighR = 1.5; kneeL = kneeR = 1.55; crouch = this.legLen * 0.52;
        upArmL = -0.5; upArmR = -0.5; elbowL = elbowR = 1.3; armOutL = 0.2; armOutR = -0.2; lean = 0.05;
        break;
      case 'drink': {
        const sip = (Math.sin(this.time * 0.9) + 1) / 2;
        thighL = thighR = 1.5; kneeL = kneeR = 1.55; crouch = this.legLen * 0.52;
        upArmL = -0.6; elbowL = 1.3; armOutL = 0.25;
        upArmR = -0.9 - sip * 0.9; elbowR = 1.6 + sip * 0.8; armOutR = -0.35; headPitch = -sip * 0.35; lean = 0.08;
        break;
      }
      case 'kneel':
        thighL = -0.1; kneeL = 1.65; thighR = 1.5; kneeR = 1.6; crouch = this.legLen * 0.42;
        upArmL = -0.3; upArmR = -0.3; elbowL = elbowR = 1.1; armOutL = 0.15; armOutR = -0.15; lean = 0.35; headPitch = 0.55;
        break;
      case 'row': {
        const r = Math.sin(this.time * 2.2);
        thighL = thighR = 1.2; kneeL = kneeR = 1.4; crouch = this.legLen * 0.45;
        upArmL = upArmR = -0.9 + r * 0.6; elbowL = elbowR = 0.9 - r * 0.5; armOutL = 0.3; armOutR = -0.3; lean = 0.15 + r * 0.18;
        break;
      }
      case 'ride':
        thighL = thighR = 0.9; kneeL = kneeR = 1.3; armOutL = 0.35; armOutR = -0.35;
        upArmL = upArmR = -0.5; elbowL = elbowR = 0.9; lean = 0.12; bob = Math.abs(Math.sin(this.time * 4.2)) * 0.05;
        break;
      case 'carry':
        upArmL = upArmR = -2.6; elbowL = elbowR = 0.6; armOutL = 0.45; armOutR = -0.45; lean = 0.5 + Math.sin(this.phase) * 0.03;
        headPitch = -0.3;
        break;
      case 'fish':
        thighL = thighR = 1.4; kneeL = kneeR = 1.5; crouch = this.legLen * 0.5;
        upArmL = -0.8; elbowL = 0.4; armOutL = 0.1; upArmR = -1.2; elbowR = 0.2; armOutR = -0.1; lean = 0.3; headPitch = 0.3;
        break;
      case 'telescope':
        upArmR = -1.9; elbowR = 1.4; armOutR = -0.15; upArmL = -0.4; elbowL = 0.6; headPitch = -0.7; lean = -0.15;
        break;
      case 'read':
        thighL = thighR = 1.5; kneeL = kneeR = 1.55; crouch = this.legLen * 0.52;
        upArmL = upArmR = -0.9; elbowL = elbowR = 1.7; armOutL = 0.35; armOutR = -0.35; headPitch = 0.45; lean = 0.15;
        break;
      case 'pray': {
        const raise = (Math.sin(this.time * 0.5) + 1) / 2;
        upArmL = upArmR = -0.6 - raise * 2.2; elbowL = elbowR = 0.2 + (1 - raise) * 0.6; armOutL = 0.25 + raise * 0.3; armOutR = -0.25 - raise * 0.3;
        headPitch = -0.35 * raise; lean = -0.08 * raise;
        break;
      }
      case 'stir': {
        const st = this.time * 1.6;
        upArmR = -1.3 + Math.sin(st) * 0.25; elbowR = 0.9 + Math.cos(st) * 0.3; armOutR = -0.5 + Math.cos(st) * 0.2;
        upArmL = -0.3; elbowL = 1.0; armOutL = 0.6; lean = 0.25; headPitch = 0.35;
        break;
      }
      case 'offer':
        upArmR = -1.4; elbowR = 0.5; armOutR = -0.2; upArmL = -0.2; elbowL = 0.4; lean = 0.18; headPitch = 0.25;
        break;
      case 'bow':
        upArmL = upArmR = 0.1; elbowL = elbowR = 1.2; armOutL = 0.2; armOutR = -0.2; lean = 0.32; headPitch = 0.55;
        break;
      case 'banner':
        upArmL = -2.6; elbowL = 0.3; armOutL = 0.5; upArmR = -1.4; elbowR = 0.9; armOutR = -0.9; lean = -0.1; thighL = 0.4; kneeL = 0.5; thighR = -0.3;
        break;
      case 'sitSword':
        thighL = thighR = 1.25; kneeL = kneeR = 0.6; crouch = this.legLen * 0.48;
        upArmR = -0.6; elbowR = 0.9; armOutR = -0.3; upArmL = -0.4; elbowL = 1.1; armOutL = 0.3; lean = 0.2; headPitch = 0.1;
        break;
      case 'lantern':
        upArmR = -1.1; elbowR = 0.4; armOutR = -0.15; upArmL = 0.1; elbowL = 0.3; lean = 0.08; headPitch = 0.05;
        break;
      case 'throne':
        thighL = thighR = 1.45; kneeL = kneeR = 1.5; crouch = this.legLen * 0.5;
        upArmL = -0.25 + breathe * 0.02; upArmR = -0.25; elbowL = elbowR = 1.35; armOutL = 0.45; armOutR = -0.45; lean = -0.1; headPitch = 0.08 + breathe * 0.02;
        break;
      case 'watch':
        upArmL = 0.05; upArmR = 0.1; elbowL = elbowR = 0.35; headPitch = -0.45; lean = -0.12;
        break;
    }

    // Attacks override the arms and chest.
    if (pose.attack !== undefined) {
      const a = pose.attack;
      const kind = pose.attackKind ?? 0;
      if (this.def.weapon === 'staff' || this.def.weapon === 'bow') {
        const thrust = a < 0.35 ? a / 0.35 : 1 - ((a - 0.35) / 0.65) * 0.6;
        upArmR = -1.4 * thrust - 0.2;
        elbowR = 0.25 + (1 - thrust) * 0.8;
        armOutR = -0.2;
        upArmL = -0.6 * thrust;
        armOutL = 0.5 * thrust;
        twist = -0.35 * thrust;
        lean = 0.12 * thrust;
      } else {
        // Wind-up over the shoulder, then a diagonal cut; alternate sides per hit; skill/heavy = overhead; burst = spin.
        const side = typeof kind === 'number' ? (kind % 2 === 0 ? 1 : -1) : 0;
        const windup = Math.min(1, a / 0.3);
        const swing = Math.max(0, (a - 0.3) / 0.45);
        const settle = Math.max(0, (a - 0.75) / 0.25);
        const ease = swing < 1 ? 1 - Math.pow(1 - swing, 3) : 1;
        if (kind === 'burst') {
          const spin = a * Math.PI * 4;
          twist = Math.sin(spin) * 1.2;
          upArmR = -1.2; upArmL = -1.2; armOutR = -1.4; armOutL = 1.4; elbowR = elbowL = 0.2;
          lean = 0.2 + Math.sin(a * Math.PI) * 0.2;
          crouch = Math.sin(a * Math.PI) * 0.15;
        } else if (kind === 'heavy') {
          const w = Math.min(1, a / 0.45);
          const sw = Math.max(0, (a - 0.45) / 0.3);
          const e2 = sw < 1 ? 1 - Math.pow(1 - sw, 4) : 1;
          const st = Math.max(0, (a - 0.75) / 0.25);
          upArmR = -3.0 * w + e2 * 3.9 - st * 1.2;
          upArmL = -2.8 * w + e2 * 3.6 - st * 1.1;
          armOutR = -0.15; armOutL = 0.15;
          elbowR = elbowL = 0.3 * w * (1 - e2) + 0.15;
          lean = -0.35 * w + e2 * 0.7 - st * 0.3;
          crouch = e2 * 0.18;
          twist = 0;
        } else if (kind === 'skill' || this.def.weapon === 'greatsword') {
          upArmR = -2.6 * windup + ease * 3.4 - settle * 1.0;
          upArmL = -2.3 * windup + ease * 3.0 - settle * 0.9;
          armOutR = -0.25;
          armOutL = 0.25;
          elbowR = 0.5 * windup * (1 - ease) + 0.2;
          elbowL = 0.5 * windup * (1 - ease) + 0.2;
          lean = -0.25 * windup + ease * 0.55 - settle * 0.25;
          twist = 0;
        } else {
          upArmR = -2.0 * windup + ease * 2.6 - settle * 0.8;
          armOutR = -0.9 * windup * side + ease * 1.3 * side;
          elbowR = 0.8 * windup * (1 - ease) + 0.15;
          twist = 0.5 * windup * side - ease * 0.9 * side + settle * 0.3 * side;
          lean = 0.05 + ease * 0.22 - settle * 0.1;
          upArmL = 0.4 * ease;
          armOutL = 0.35;
        }
        crouch = ease * 0.06;
      }
    }

    // Apply with smoothing.
    this.legL.pivot.rotation.x = lerpAngle(this.legL.pivot.rotation.x, thighL, k);
    this.legR.pivot.rotation.x = lerpAngle(this.legR.pivot.rotation.x, thighR, k);
    this.legL.joint.rotation.x = lerpAngle(this.legL.joint.rotation.x, -kneeL, k);
    this.legR.joint.rotation.x = lerpAngle(this.legR.joint.rotation.x, -kneeR, k);
    const ak = pose.attack !== undefined ? Math.min(1, k * 2.2) : k;
    this.armL.pivot.rotation.x = lerpAngle(this.armL.pivot.rotation.x, upArmL, ak);
    this.armR.pivot.rotation.x = lerpAngle(this.armR.pivot.rotation.x, upArmR, ak);
    this.armL.pivot.rotation.z = lerpAngle(this.armL.pivot.rotation.z, armOutL, ak);
    this.armR.pivot.rotation.z = lerpAngle(this.armR.pivot.rotation.z, armOutR, ak);
    this.armL.joint.rotation.x = lerpAngle(this.armL.joint.rotation.x, -elbowL, ak);
    this.armR.joint.rotation.x = lerpAngle(this.armR.joint.rotation.x, -elbowR, ak);
    this.hips.rotation.x = lerpAngle(this.hips.rotation.x, lean, k);
    this.chest.rotation.y = lerpAngle(this.chest.rotation.y, twist, ak);
    this.chest.rotation.x = lerpAngle(this.chest.rotation.x, lean * 0.4, k);
    this.head.rotation.x = lerpAngle(this.head.rotation.x, headPitch - lean * 0.6, k);
    this.head.rotation.y = lerpAngle(this.head.rotation.y, -twist * 0.5, k);
    const kneeDrop = (1 - Math.cos(Math.max(this.legL.joint.rotation.x, this.legR.joint.rotation.x))) * 0.1;
    this.hips.position.y = this.legLen - crouch - kneeDrop + bob;

    if (this.orbit) {
      this.orbit.rotation.y += dt * (pose.attack !== undefined ? 14 : 2.5);
      this.orbit.position.y = 1.4 + Math.sin(this.time * 2.5) * 0.04;
    }
    this.animateCloak(v, pose.mode, dt);
    this.animateTrail(pose, dt);
  }

  private animateCloak(speed: number, mode: Mode, dt: number): void {
    if (!this.cloak) return;
    const geo = this.cloak.geometry;
    const pos = geo.attributes.position as BufferAttribute;
    const rest = this.cloakRest;
    const rows = 10;
    const cols = 5;
    const flow = mode === 'glide' ? 1.6 : Math.min(1, speed / 6) * 0.9;
    for (let r = 0; r < rows; r++) {
      const t = r / (rows - 1);
      for (let cI = 0; cI < cols; cI++) {
        const i = r * cols + cI;
        const x = rest[i * 3];
        const y = rest[i * 3 + 1];
        const wave = Math.sin(this.time * 5.5 - t * 4 + cI * 0.6) * 0.05 * t + Math.sin(this.time * 2.1 + cI) * 0.02 * t;
        const back = -(t * t) * (0.25 + flow * 0.55);
        const lift = t * flow * 0.35;
        pos.setXYZ(i, x + wave * 0.5, y + lift * t, back + wave);
      }
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    void dt;
  }

  private animateTrail(pose: RigPose, dt: number): void {
    const active = pose.attack !== undefined && this.def.weapon !== 'staff' && this.def.weapon !== 'bow';
    const mat = this.trail.material as MeshBasicMaterial;
    if (active) {
      this.weapon.updateWorldMatrix(true, false);
      const tipLen = this.weapon.userData.tipLen as number;
      this.tipA.set(0, 0.15, 0).applyMatrix4(this.weapon.matrixWorld);
      this.tipB.set(0, tipLen, 0).applyMatrix4(this.weapon.matrixWorld);
      for (let i = this.trailPoints.length - 2; i >= 2; i -= 2) {
        this.trailPoints[i].copy(this.trailPoints[i - 2]);
        this.trailPoints[i + 1].copy(this.trailPoints[i - 1]);
      }
      if (this.lastAttack === undefined || pose.attack! < this.lastAttack) {
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
    this.lastAttack = pose.attack;
  }

  /** Kept for API compatibility; real shadows come from the shadow map. */
  setShadowHeight(_groundY: number): void {}
}

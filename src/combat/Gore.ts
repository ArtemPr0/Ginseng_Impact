/**
 * Mobs coming apart in the game (Sever.ts holds the pure parts): a limb or the head baked off the body as it stands and
 * thrown as debris, closed red where it was cut; a red wound at the stump and an artery pumping blood out of it in beats
 * that stain the ground (the user's call of 2026-11-17, overturning 11-16's no blood); ghosts puff their glow, bone
 * snaps off in dust; a skeleton bursting into its bones; a body without a rig (robes, statues) or a frozen one shattering into
 * chunks. Pieces bounce, rest a while and shrink away.
 */
import { Euler, Group, Mesh, MeshStandardMaterial, Quaternion, SphereGeometry, Vector3, type Material, type Object3D, type SkinnedMesh } from 'three';
import { DebrisSim, type Piece } from '../world/Debris';
import { fractureObject, fractureGeometry } from '../world/Fracture';
import { Spray } from '../render/Spray';
import { Blood } from '../render/Blood';
import { hitMaterial } from '../audio/CombatSfx';
import { ELEMENT_COLOR } from './Elements';
import { armsLost, bakeTriangles, capCut, partTriangles, subtreeIndices, woundOf, BLOOD_RED, type Part } from './Sever';
import type { Enemy } from './Enemy';

/** Seconds a piece lies about before it shrinks away. */
const PIECE_LIFE = 12;

/** The bone a part comes off at, tried in order. */
const PART_BONES: Record<Part, RegExp[]> = {
  // At the head, not the neck: the neck stays on the body (cut at the neck it pinched to a point).
  head: [/head$/i, /neck$/i],
  leftArm: [/leftforearm$/i, /leftarm$/i],
  rightArm: [/rightforearm$/i, /rightarm$/i],
  leftHand: [/lefthand$/i],
  rightHand: [/righthand$/i],
};

/** A skeleton's bones: each group of bone names one piece; whatever no group claims goes with the ribs. */
const BONE_GROUPS: RegExp[][] = [
  [/neck$/i, /head$/i, /headtop/i],
  [/hips$/i, /spine$/i, /spine1$/i],
  [/leftarm$/i], [/leftforearm$/i, /lefthand/i],
  [/rightarm$/i], [/rightforearm$/i, /righthand/i],
  [/leftupleg$/i], [/leftleg$/i, /leftfoot/i, /lefttoe/i],
  [/rightupleg$/i], [/rightleg$/i, /rightfoot/i, /righttoe/i],
];

interface Bit { mesh: Mesh; piece: Piece; life: number; scale: number; own: boolean }

const _v = new Vector3();
const _d = new Vector3();
const _p = new Vector3();

function skinnedOf(root: Object3D): SkinnedMesh[] {
  const out: SkinnedMesh[] = [];
  root.traverseVisible((o) => { if ((o as SkinnedMesh).isSkinnedMesh) out.push(o as SkinnedMesh); });
  return out;
}

function boneOf(e: Enemy, part: Part): Object3D | null {
  const m = e.model;
  if (!m) return null;
  for (const re of PART_BONES[part]) { const b = m.bone(re); if (b) return b; }
  return null;
}

export interface GoreHooks {
  /** A bone or a limb landed hard (rattle, thud). */
  onLand?: (x: number, y: number, z: number, bone: boolean) => void;
}

export class Gore {
  readonly group = new Group();
  readonly sim: DebrisSim;
  readonly spray: Spray;
  private readonly bits: Bit[] = [];
  private readonly drips: Array<{ at: Object3D; left: number; glow: boolean; color: number; every: number; blood: boolean; life: number }> = [];
  /** Severed parts still bleeding as they fly. */
  private readonly bleeding: Array<{ obj: Object3D; left: number; every: number }> = [];
  readonly blood: Blood;
  /** Inside a cut: raw red; the stump's wound. */
  private readonly wound = new MeshStandardMaterial({ color: 0x5a0610, emissive: 0x1a0204, roughness: 0.35, metalness: 0 });
  private readonly boneCap = new MeshStandardMaterial({ color: 0xcfc6ae, roughness: 0.9 });
  private readonly stumpGeo = new SphereGeometry(1, 10, 8);
  /** Ice, for a frozen body shattering. */
  readonly ice = new MeshStandardMaterial({ color: 0xbfefff, emissive: 0x3a8aa8, emissiveIntensity: 0.6, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  private landAt = 0;
  private clock = 0;

  constructor(groundAt: (x: number, z: number, y: number) => number, private readonly hooks: GoreHooks = {}) {
    this.sim = new DebrisSim(groundAt, 160);
    this.spray = new Spray(groundAt);
    this.blood = new Blood(groundAt);
    this.group.add(this.spray.group, this.blood.group);
  }

  /** Parts `e` still has, with where their joints are now. */
  partsOf(e: Enemy): Array<{ part: Part; at: Vector3 }> {
    const out: Array<{ part: Part; at: Vector3 }> = [];
    for (const part of ['head', 'leftArm', 'rightArm', 'leftHand', 'rightHand'] as Part[]) {
      if (e.lost.has(part)) continue;
      const b = boneOf(e, part);
      if (b) out.push({ part, at: b.getWorldPosition(new Vector3()) });
    }
    return out;
  }

  /** Takes `part` off `e`, thrown along `kb` with `strength`. False when it has no such part (no rig, already gone). */
  sever(e: Enemy, part: Part, kb: { x: number; z: number }, strength = 1): boolean {
    const m = e.model;
    const bone = boneOf(e, part);
    if (!m || !bone || e.lost.has(part)) return false;
    const look = woundOf(hitMaterial(e.def.kind), ELEMENT_COLOR[e.def.element]);
    let made = 0, radius = 0.1;
    for (const mesh of skinnedOf(m.root)) {
      const tris = partTriangles(mesh, subtreeIndices(mesh, bone));
      if (tris.length < 4) continue;
      const b = bakeTriangles(mesh, tris);
      // Closed where it was cut: red inside for flesh, bone for bone.
      const capMat = look.blood ? this.wound : look.glow ? (mesh.material as Material) : this.boneCap;
      const geo = capCut(b.geometry);
      b.geometry.dispose();
      const obj = this.throwPiece(geo, [mesh.material as Material, capMat], b.pivot, b.radius, kb, (part === 'head' ? 6 : part.endsWith('Hand') ? 3.5 : 4.5) * strength, true);
      if (look.blood) this.bleeding.push({ obj, left: 0.9, every: 0 });
      radius = Math.max(radius, b.radius);
      made++;
    }
    if (!made) return false;
    e.lost.add(part);
    e.lostArms = armsLost(e.lost);
    e.severed.push(bone);
    // The stump: a wound at the joint, riding the parent bone (in its own scale: rigs are often 0.01-scaled).
    const at = bone.getWorldPosition(new Vector3());
    const parent = bone.parent;
    if (parent) {
      const mat = look.blood ? this.wound : look.glow ? new MeshStandardMaterial({ color: 0x14121a, emissive: look.color, emissiveIntensity: 0.35, roughness: 0.95 })
        : new MeshStandardMaterial({ color: look.color, roughness: 0.9 });
      const stump = new Mesh(this.stumpGeo, mat);
      stump.position.copy(bone.position);
      // Flat across the limb (the bone runs along its own y), a disc of wound, not a ball.
      stump.quaternion.copy(bone.quaternion);
      const ps = parent.getWorldScale(_v).x || 1;
      const r = Math.min(0.14, Math.max(0.04, radius * 0.28)) / ps;
      stump.scale.set(r, r * 0.35, r);
      stump.name = 'gore:stump';
      parent.add(stump);
      e.stumps.push(stump);
      this.drips.push({ at: stump, left: look.blood ? 1.6 : 1.4, life: look.blood ? 1.6 : 1.4, glow: look.glow, color: look.color, every: 0, blood: look.blood });
    }
    _d.set(kb.x, 0.8, kb.z).normalize();
    if (look.blood) this.blood.pulse(at, _d, 1.2);
    else this.spray.spurt(at, _d, 30, 5, look.glow, look.color);
    return true;
  }

  /** A skeleton bursts into its bones, flung out along `kb` (the body is hidden: its bones are the pieces). */
  burstBones(e: Enemy, kb: { x: number; z: number }, strength = 1): boolean {
    const m = e.model;
    if (!m) return false;
    let made = 0;
    for (const mesh of skinnedOf(m.root)) {
      const bones = mesh.skeleton.bones;
      const groupOf = new Int8Array(bones.length).fill(1);
      bones.forEach((b, i) => { const g = BONE_GROUPS.findIndex((rs) => rs.some((r) => r.test(b.name))); if (g >= 0) groupOf[i] = g; });
      // The ribs: whatever no group named, with the chest bones.
      for (let g = 0; g < BONE_GROUPS.length; g++) {
        const set = new Set<number>();
        groupOf.forEach((gi, i) => { if (gi === g) set.add(i); });
        if (!set.size) continue;
        const tris = partTriangles(mesh, set);
        if (tris.length < 3) continue;
        const b = bakeTriangles(mesh, tris);
        this.throwPiece(b.geometry, mesh.material as Material, b.pivot, b.radius, kb, (3 + Math.random() * 3) * strength, true, true);
        made++;
      }
    }
    if (!made) return false;
    m.root.visible = false;
    const at = new Vector3(e.pos.x, e.pos.y + e.def.height * (e.def.scale ?? 1) * 0.5, e.pos.z);
    this.spray.spurt(at, _d.set(0, 1, 0), 16, 3, false, 0xd9d2bf);
    return true;
  }

  /** A body shatters into `n` chunks (unrigged mobs, frozen ones), with `material` over them if given (ice). */
  shatter(e: Enemy, kb: { x: number; z: number }, n = 10, material?: Material): boolean {
    const m = e.model;
    if (!m) return false;
    m.root.updateMatrixWorld(true);
    let made = 0;
    const skinned = skinnedOf(m.root);
    if (skinned.length) {
      for (const mesh of skinned) {
        const tris: number[] = [];
        const triN = (mesh.geometry.getIndex()?.count ?? mesh.geometry.attributes.position.count) / 3;
        for (let t = 0; t < triN; t++) tris.push(t);
        const whole = bakeTriangles(mesh, tris);
        for (const c of fractureGeometry(whole.geometry, n, 3)) {
          this.throwPiece(c.geometry, material ?? (mesh.material as Material), c.pivot.add(whole.pivot), c.radius, kb, 4.5, true);
          made++;
        }
        whole.geometry.dispose();
      }
    } else {
      const s = m.root.getWorldScale(new Vector3()).x;
      const rot = new Euler().setFromQuaternion(m.root.getWorldQuaternion(this.q));
      for (const c of fractureObject(m.root, n, 3)) {
        const at = c.pivot.clone().applyMatrix4(m.root.matrixWorld);
        this.throwPiece(c.geometry, material ?? c.material, at, c.radius * s, kb, 4.5, true, false, s, rot);
        made++;
      }
    }
    if (made) m.root.visible = false;
    return made > 0;
  }
  private readonly q = new Quaternion();

  /** Puts `e` back together (it respawned): its bones full size, its stumps gone, its body shown. */
  mend(e: Enemy): void {
    for (const b of e.severed) b.scale.setScalar(1);
    e.severed.length = 0;
    for (const s of e.stumps) s.removeFromParent();
    e.stumps.length = 0;
    e.lost.clear();
    e.lostArms = 0;
    e.wearFrom = 1;
    if (e.model) e.model.root.visible = true;
  }

  update(dt: number): void {
    this.clock += dt;
    this.sim.step(dt);
    this.spray.update(dt);
    this.blood.update(dt);
    for (const d of this.drips) {
      d.left -= dt;
      d.every -= dt;
      if (d.every > 0 || !d.at.parent) continue;
      d.at.getWorldPosition(_v);
      if (d.blood) {
        // An artery: beats of blood out of the stump along the limb's line, each weaker than the last.
        d.every = 0.3;
        d.at.parent.getWorldPosition(_p);
        _d.subVectors(_v, _p).normalize();
        _d.y += 0.35;
        this.blood.pulse(_v, _d.normalize(), Math.max(0.15, d.left / d.life));
      } else {
        d.every = 0.08;
        this.spray.spurt(_v, _d.set((Math.random() - 0.5) * 0.4, 0.5, (Math.random() - 0.5) * 0.4), 2, 2.2 * Math.max(0.3, d.left), d.glow, d.color);
      }
    }
    for (let i = this.bleeding.length - 1; i >= 0; i--) {
      const b = this.bleeding[i];
      b.left -= dt; b.every -= dt;
      if (b.every <= 0 && b.obj.parent) { b.every = 0.07; this.blood.spurt(b.obj.position, _d.set(0, 0.2, 0), 2, 1.2, false, BLOOD_RED); }
      if (b.left <= 0 || !b.obj.parent) this.bleeding.splice(i, 1);
    }
    for (let i = this.drips.length - 1; i >= 0; i--) if (this.drips[i].left <= 0) this.drips.splice(i, 1);
    for (let i = this.bits.length - 1; i >= 0; i--) {
      const b = this.bits[i];
      b.life -= dt;
      if (b.life < 0.5) b.mesh.scale.setScalar(b.scale * Math.max(0, b.life / 0.5));
      if (b.life <= 0 || b.piece.dead) {
        b.mesh.removeFromParent();
        if (b.own) b.mesh.geometry.dispose();
        this.sim.remove(b.piece);
        this.bits.splice(i, 1);
      }
    }
  }

  private throwPiece(geometry: Mesh['geometry'], material: Material | Material[], at: Vector3, r: number, kb: { x: number; z: number }, speed: number, own: boolean, bone = false, scale = 1, rot?: Euler): Mesh {
    const mesh = new Mesh(geometry, material);
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    mesh.frustumCulled = false;
    this.group.add(mesh);
    const out = Math.random() * Math.PI * 2;
    const spread = bone ? 0.9 : 0.35;
    const spin = () => (Math.random() - 0.5) * 2 * (4 + speed) / Math.max(0.4, r * 3);
    const piece = this.sim.add({
      x: at.x, y: at.y, z: at.z, r: Math.max(0.08, Math.min(r, 0.6)),
      vx: kb.x * speed + Math.cos(out) * speed * spread, vy: 2.5 + Math.random() * speed * 0.7, vz: kb.z * speed + Math.sin(out) * speed * spread,
      wx: spin(), wy: spin(), wz: spin(), rx: rot?.x ?? 0, ry: rot?.y ?? 0, rz: rot?.z ?? 0, obj: mesh,
      onLand: (p, v) => {
        if (this.clock - this.landAt < 0.05 || v < 4) return;
        this.landAt = this.clock;
        this.hooks.onLand?.(p.x, p.y, p.z, bone);
      },
    });
    this.bits.push({ mesh, piece, life: PIECE_LIFE + Math.random() * 3, scale, own });
    return mesh;
  }
}

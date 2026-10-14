import { BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, PlaneGeometry, DoubleSide, type Object3D } from 'three';
import { PALETTE } from '../render/palette';
import { ps1Lambert } from '../render/PS1Material';
import type { Mode } from '../player/CharacterController';
import type { CharacterDef } from './roster';

export interface RigPose {
  mode: Mode;
  /** Horizontal speed, m/s. */
  speed: number;
  /** 0..1 progress of an attack swing, or undefined when not attacking. */
  attack?: number;
}

function box(w: number, h: number, d: number, color: number, emissive?: number, emissiveIntensity = 2): Mesh {
  const mat = emissive !== undefined
    ? ps1Lambert({ color: emissiveIntensity >= 1 ? PALETTE.void : color, emissive, emissiveIntensity })
    : ps1Lambert({ color });
  return new Mesh(new BoxGeometry(w, h, d), mat);
}

/** A limb pivot with the limb box hanging below it. */
function limb(length: number, width: number, color: number): Group {
  const pivot = new Group();
  const m = box(width, length, width, color);
  m.position.y = -length / 2;
  pivot.add(m);
  return pivot;
}

/**
 * Procedural low-poly humanoid (≈ 300 triangles) with procedural animation.
 * The root sits at the feet. `rotation.y` is set from the controller yaw by the caller.
 */
export class Rig {
  readonly root = new Group();
  private readonly hips = new Group();
  private readonly torso: Mesh;
  private readonly head: Mesh;
  private readonly armL: Group;
  private readonly armR: Group;
  private readonly legL: Group;
  private readonly legR: Group;
  private readonly cape?: Mesh;
  private readonly weapon: Group;
  private readonly shadow: Mesh;
  private phase = 0;
  private time = 0;
  private readonly legLen: number;

  constructor(readonly def: CharacterDef) {
    const { height: h, bulk: b, cloth, armour, skin, accent } = def.look;
    const L = h * 0.46;
    const T = h * 0.30;
    const H = h * 0.15;
    const torsoW = h * 0.22 * b;
    const torsoD = h * 0.13 * b;
    this.legLen = L;

    this.hips.position.y = L;
    this.root.add(this.hips);

    this.torso = box(torsoW, T, torsoD, armour);
    this.torso.position.y = T / 2;
    this.hips.add(this.torso);

    // Emissive accent strip on the chest (runes / brooch).
    const rune = box(torsoW * 0.35, T * 0.3, 0.02, PALETTE.void, accent);
    rune.position.set(0, T * 0.15, torsoD / 2 + 0.01);
    this.torso.add(rune);

    this.head = box(H, H, H, skin);
    this.head.position.y = T + H / 2 + 0.03;
    this.hips.add(this.head);

    if (def.look.hat) {
      const brim = new Mesh(new CylinderGeometry(H * 1.3, H * 1.3, 0.03, 6), ps1Lambert({ color: cloth }));
      brim.position.y = H / 2 + 0.01;
      const cone = new Mesh(new ConeGeometry(H * 0.75, H * 2.2, 6), ps1Lambert({ color: cloth }));
      cone.position.y = H / 2 + H * 1.1;
      cone.rotation.z = -0.12;
      this.head.add(brim, cone);
    }

    const armLen = h * 0.40;
    const armW = h * 0.07 * b;
    this.armL = limb(armLen, armW, cloth);
    this.armR = limb(armLen, armW, cloth);
    this.armL.position.set(-(torsoW / 2 + armW / 2 + 0.01), T - 0.05, 0);
    this.armR.position.set(torsoW / 2 + armW / 2 + 0.01, T - 0.05, 0);
    this.hips.add(this.armL, this.armR);

    const legW = h * 0.09 * b;
    this.legL = limb(L, legW, cloth === PALETTE.bark ? armour : cloth);
    this.legR = limb(L, legW, cloth === PALETTE.bark ? armour : cloth);
    this.legL.position.set(-torsoW / 4, 0, 0);
    this.legR.position.set(torsoW / 4, 0, 0);
    this.hips.add(this.legL, this.legR);

    if (def.look.cape) {
      this.cape = new Mesh(new PlaneGeometry(torsoW * 1.1, L + T * 0.7, 1, 3), ps1Lambert({ color: cloth, side: DoubleSide }));
      this.cape.position.set(0, T - (L + T * 0.7) / 2 - 0.05, -torsoD / 2 - 0.02);
      this.cape.rotation.x = 0.12;
      this.hips.add(this.cape);
    }

    this.weapon = new Group();
    this.weapon.position.y = -armLen;
    this.armR.add(this.weapon);
    this.buildWeapon(def, accent);

    this.shadow = new Mesh(new CircleGeometry(0.45 * b, 10), new MeshBasicMaterial({ color: PALETTE.void, transparent: true, opacity: 0.55, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.04;
    this.root.add(this.shadow);
  }

  private buildWeapon(def: CharacterDef, accent: number): void {
    const w = this.weapon;
    if (def.weapon === 'sword') {
      const blade = box(0.06, 0.95, 0.02, 0xc9d2f5, PALETTE.moon, 0.35);
      blade.position.y = 0.55;
      const guard = box(0.18, 0.04, 0.04, def.look.armour);
      guard.position.y = 0.08;
      const gem = box(0.05, 0.05, 0.05, PALETTE.void, accent);
      gem.position.y = 0.0;
      w.add(blade, guard, gem);
    } else if (def.weapon === 'greatsword') {
      const blade = box(0.11, 1.5, 0.03, 0x9aa3cf, PALETTE.electric, 0.25);
      blade.position.y = 0.85;
      const rune = box(0.03, 1.0, 0.03, PALETTE.void, accent);
      rune.position.set(0, 0.85, 0.0);
      const guard = box(0.3, 0.06, 0.06, def.look.armour);
      guard.position.y = 0.1;
      w.add(blade, rune, guard);
    } else {
      const shaft = new Mesh(new CylinderGeometry(0.025, 0.03, 1.7, 6), ps1Lambert({ color: PALETTE.bark }));
      shaft.position.y = 0.5;
      const orb = new Mesh(new BoxGeometry(0.14, 0.14, 0.14), ps1Lambert({ color: PALETTE.void, emissive: accent, emissiveIntensity: 2.5 }));
      orb.position.y = 1.4;
      orb.rotation.set(0.6, 0.6, 0);
      w.add(shaft, orb);
    }
    w.rotation.x = Math.PI * 0.08;
  }

  get object(): Object3D {
    return this.root;
  }

  /** Advance the animation. Call once per rendered frame. */
  animate(pose: RigPose, dt: number): void {
    this.time += dt;
    const v = pose.speed;
    const run = Math.min(1, v / 4.5);
    const freq = 1.4 + v * 0.22;
    this.phase += dt * freq * Math.PI * 2 * (v > 0.2 ? 1 : 0);
    const s = Math.sin(this.phase);
    const k = 1 - Math.exp(-dt * 18);

    let legL = 0, legR = 0, armL = 0, armR = 0, armLz = -0.08, armRz = 0.08, lean = 0, bob = 0, torsoY = 0;
    switch (pose.mode) {
      case 'ground': {
        const amp = 0.95 * run + 0.35 * Math.max(0, (v - 4.5) / 3.5);
        legL = s * amp;
        legR = -s * amp;
        armL = -s * amp * 0.8;
        armR = s * amp * 0.8;
        lean = 0.18 * (v / 8);
        bob = Math.abs(s) * 0.07 * run;
        torsoY = Math.sin(this.time * 2.1) * 0.008 * (1 - run);
        break;
      }
      case 'air':
        legL = -0.55; legR = 0.35; armL = -0.9; armR = -0.6; armLz = -0.5; armRz = 0.5; lean = 0.05;
        break;
      case 'climb':
        legL = -1.0 + s * 0.4; legR = -1.0 - s * 0.4; armL = -2.6 + s * 0.5; armR = -2.6 - s * 0.5; lean = -0.1;
        break;
      case 'glide':
        legL = 0.25; legR = 0.25; armL = -1.6; armR = -1.6; armLz = -1.3; armRz = 1.3; lean = 1.2;
        break;
    }
    if (pose.attack !== undefined) {
      const a = pose.attack;
      // wind-up (0..0.3) then swing (0.3..1)
      const swing = a < 0.3 ? -1.9 + a / 0.3 * -0.6 : -2.5 + (a - 0.3) / 0.7 * 3.4;
      armR = swing;
      armRz = 0.35;
      lean = 0.1 + Math.sin(a * Math.PI) * 0.25;
    }

    this.legL.rotation.x += (legL - this.legL.rotation.x) * k;
    this.legR.rotation.x += (legR - this.legR.rotation.x) * k;
    this.armL.rotation.x += (armL - this.armL.rotation.x) * k;
    this.armR.rotation.x += (armR - this.armR.rotation.x) * k;
    this.armL.rotation.z += (armLz - this.armL.rotation.z) * k;
    this.armR.rotation.z += (armRz - this.armR.rotation.z) * k;
    this.hips.rotation.x += (lean - this.hips.rotation.x) * k;
    this.hips.position.y = this.legLen + bob + torsoY;
    if (this.cape) this.cape.rotation.x = 0.12 + Math.min(0.9, v * 0.09) + Math.sin(this.time * 6) * 0.03 * run;
  }

  /** Blob shadow follows the ground even while airborne. */
  setShadowHeight(groundY: number): void {
    this.shadow.position.y = groundY - this.root.position.y + 0.04;
  }
}

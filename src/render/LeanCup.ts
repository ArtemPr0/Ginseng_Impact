import { AdditiveBlending, CanvasTexture, CircleGeometry, Group, Mesh, MeshBasicMaterial, Quaternion, Sprite, SpriteMaterial, Vector2, Vector3, type Object3D } from 'three';
import { glowSprite, glowTexture } from './Glow';
import { PALETTE } from './palette';

/** lean-cup.glb proportions (measured): open double cup, rim radius 0.29 h, wall about 0.02 h thick. */
const FILL = 0.8;
const INNER_R = 0.265;
/** How strongly the surface follows the cup's acceleration (1 = physical; less, as the cup's walls damp it). */
const SLOSH = 0.28;
/** Splashes over the rim: a jolt (m/s²) or a slosh tilt (radians) past these. */
const SPLASH_JOLT = 30;
const SPLASH_TILT = 0.5;

let liquidTex: CanvasTexture | undefined;
/** Glossy purple: a deep body with a soft highlight off-centre, so the surface reads wet and shiny. */
function liquidTexture(): CanvasTexture {
  if (liquidTex) return liquidTex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#4d10b8';
  ctx.fillRect(0, 0, size, size);
  const g = ctx.createRadialGradient(size * 0.36, size * 0.32, 0, size * 0.36, size * 0.32, size * 0.3);
  g.addColorStop(0, 'rgba(225,180,255,0.9)');
  g.addColorStop(0.4, 'rgba(150,80,245,0.45)');
  g.addColorStop(1, 'rgba(77,16,184,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  liquidTex = new CanvasTexture(canvas);
  return liquidTex;
}

const _up = new Vector3(0, 1, 0);
const _v = new Vector3();
const _w = new Vector3();
const _q = new Quaternion();
const _q2 = new Quaternion();
const _a = new Vector3();
const _pos = new Vector3();
const _inv = new Quaternion();

/**
 * Sir Aldric's cup of lean: the cup model, a glowing purple surface that stays level while the cup moves and sloshes
 * (a damped spring driven by the cup's acceleration, so turns and stops tip it), droplets thrown over the rim on sharp
 * moves, and a faint shine. `group` is the cup with its feet at the origin; `drops` lives in world space.
 */
export class LeanCup {
  readonly group = new Group();
  readonly drops = new Group();
  private readonly liquid: Mesh;
  private readonly shine: Sprite;
  private readonly droplets: Array<{ sprite: Sprite; vel: Vector3; age: number }> = [];
  /** Slosh tilt (world x/z lean of the surface, radians) and its rate. */
  private readonly tilt = new Vector2();
  private readonly tiltRate = new Vector2();
  private readonly lastPos = new Vector3();
  private readonly lastVel = new Vector3();
  private readonly acc = new Vector3();
  private readonly smoothVel = new Vector3();
  private primed = false;
  private splashCooldown = 0;
  private t = 0;

  /** The cup's height, metres (its rim is at this height above `group`'s origin). */
  get height(): number {
    return this.h;
  }

  /** The cup's outer radius `y` metres above its feet (measured: 0.194 h at the foot, widening to 0.29 h by 0.7 h). */
  radiusAt(y: number): number {
    const f = Math.max(0, Math.min(1, y / this.h));
    return this.h * (0.194 + 0.096 * Math.min(1, f / 0.7));
  }

  constructor(cup: Object3D, private readonly h: number) {
    this.group.add(cup);
    this.liquid = new Mesh(new CircleGeometry(INNER_R * h, 20), new MeshBasicMaterial({ map: liquidTexture(), toneMapped: false }));
    this.liquid.position.y = FILL * h;
    this.group.add(this.liquid);
    this.shine = glowSprite(PALETTE.dusk, h * 1.0, 0.2);
    this.shine.position.y = FILL * h + 0.01;
    this.group.add(this.shine);
    for (let i = 0; i < 14; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: glowTexture(), color: 0xb36bff, transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }));
      sprite.visible = false;
      sprite.scale.setScalar(0.022);
      this.drops.add(sprite);
      this.droplets.push({ sprite, vel: new Vector3(), age: 0 });
    }
  }

  update(dt: number): void {
    if (dt <= 0) return;
    this.t += dt;
    this.splashCooldown -= dt;
    // The cup's motion in the world: velocity and a smoothed acceleration.
    this.liquid.updateWorldMatrix(true, false);
    const pos = this.liquid.getWorldPosition(_pos);
    if (!this.primed) { this.lastPos.copy(pos); this.lastVel.set(0, 0, 0); this.smoothVel.set(0, 0, 0); this.primed = true; }
    const raw = _w.copy(pos).sub(this.lastPos).divideScalar(dt);
    // Teleports and swaps (a jump of metres in a frame) are not motion.
    if (raw.lengthSq() > 400) raw.copy(this.lastVel);
    // Frame-to-frame differences are noisy at high frame rates: smooth the velocity, then its change.
    // (The simulation steps at a fixed rate under a faster render, so the hand moves in small jumps.)
    const vel = this.smoothVel.lerp(raw, 1 - Math.exp(-dt / 0.08));
    const a = _a.copy(vel).sub(this.lastVel).divideScalar(dt);
    this.acc.lerp(a, 1 - Math.exp(-dt / 0.1));
    this.lastPos.copy(pos);
    this.lastVel.copy(vel);
    // Slosh: the surface settles square to gravity minus the cup's acceleration (its normal leans toward the push),
    // overshooting and swinging back on a damped spring (about 2.4 Hz, settling in about a second).
    const k = 230;
    const c = 7;
    this.tiltRate.x += (k * (SLOSH * this.acc.x / 9.8 - this.tilt.x) - c * this.tiltRate.x) * dt;
    this.tiltRate.y += (k * (SLOSH * this.acc.z / 9.8 - this.tilt.y) - c * this.tiltRate.y) * dt;
    this.tilt.addScaledVector(this.tiltRate, dt);
    this.tilt.clampLength(0, 0.55);
    // The surface's world orientation: level, its normal leaning by the slosh tilt.
    _q.setFromAxisAngle(_v.set(this.tilt.y, 0, -this.tilt.x).normalize(), this.tilt.length() || 0);
    _q.multiply(_q2.setFromAxisAngle(_v.set(1, 0, 0), -Math.PI / 2));
    this.group.getWorldQuaternion(_q2);
    this.liquid.quaternion.copy(_q2.invert().multiply(_q));
    (this.shine.material as SpriteMaterial).opacity = 0.16 + Math.sin(this.t * 2.3) * 0.04;
    // Over the rim: a sharp jolt or a big slosh throws a few droplets out on the high side.
    const jolt = Math.hypot(this.acc.x, this.acc.z);
    if (this.splashCooldown <= 0 && (jolt > SPLASH_JOLT || this.tilt.length() > SPLASH_TILT)) {
      this.splashCooldown = 0.6;
      const side = _v.set(-this.tilt.x, 0, -this.tilt.y);
      if (side.lengthSq() < 1e-6) side.set(-this.acc.x, 0, -this.acc.z);
      side.normalize();
      for (let i = 0; i < 4; i++) {
        const d = this.droplets.find((x) => !x.sprite.visible);
        if (!d) break;
        d.age = 0;
        d.sprite.visible = true;
        d.sprite.position.copy(pos).addScaledVector(side, INNER_R * this.h);
        d.vel.copy(this.lastVel).multiplyScalar(0.6).addScaledVector(side, 0.5 + Math.random() * 0.5);
        d.vel.y += 0.8 + Math.random() * 0.7;
        d.vel.x += (Math.random() - 0.5) * 0.4;
        d.vel.z += (Math.random() - 0.5) * 0.4;
      }
    }
    for (const d of this.droplets) {
      if (!d.sprite.visible) continue;
      d.age += dt;
      if (d.age > 0.7) { d.sprite.visible = false; continue; }
      d.vel.y -= 9.8 * dt;
      d.sprite.position.addScaledVector(d.vel, dt);
      (d.sprite.material as SpriteMaterial).opacity = 0.9 * (1 - d.age / 0.7);
    }
  }

  /** Points the cup's up axis toward the world's up by `amount` (0..1), pivoting about `grip` (the wrist keeps it level). */
  static level(pivot: Object3D, amount: number): void {
    if (amount <= 0 || !pivot.parent) return;
    pivot.updateWorldMatrix(true, false);
    pivot.getWorldQuaternion(_q);
    const cupUp = _w.copy(_up).applyQuaternion(_q);
    _q2.setFromUnitVectors(cupUp, _up);
    _q2.slerp(_q.identity(), 1 - amount);
    // World-space correction → the pivot's parent frame.
    pivot.parent.getWorldQuaternion(_q);
    pivot.quaternion.premultiply(_inv.copy(_q).invert().multiply(_q2).multiply(_q));
  }
}

/**
 * The octopus boss's arms (the playtest of 2026-11-14: "make a massive octopus as the boss and make his attacks look
 * very cool and animated (not just circles flying out of it)"). Its model is one unrigged mesh lying with its eight arms
 * spread, so the arms move in the vertex shader: a wave running out along every arm, a swim pulse that curls the tips
 * down and in like a bell, one arm lifting toward its target and slamming down (the tentacle slam), all of them
 * twisting round the middle (the whirlpool). `octoDeform` is the shader's arithmetic, for the tests.
 */
import type { Material, MeshStandardMaterial, Object3D } from 'three';
import { type BufferGeometry, Vector2, Vector3 } from 'three';
import type { BossAttackKind } from '../data/enemies';

export interface OctoPose {
  /** Seconds, for the wave. */
  time: number;
  /** 0..1: the tips curled down and in (a swim stroke, the squeeze before a jet of ink). */
  pulse: number;
  /** One arm raised toward `dir` (1: high over the body), or driven down (negative: the slam). */
  lift: number;
  /** Which way that arm points, in the mesh's own xz plane (radians from +x toward +z). */
  dir: number;
  /** Radians the arm tips are turned round the middle (trailing behind the whirlpool's spin), the root not at all. */
  spin: number;
  /** How strongly the idle wave runs along the arms (0..1). */
  wave: number;
  /** Where the raised arm's tip is carried to reach its target (x, z in arm lengths, full at the tip): a rubbery arm. */
  reachX: number;
  reachZ: number;
}

/** Where a vertex at `p` (mesh units, the body's middle at the origin, the arms out to `R`) is drawn in `pose`. */
export function octoDeform(p: readonly [number, number, number], R: number, pose: OctoPose): [number, number, number] {
  let [x, y, z] = p;
  const r = Math.hypot(x, z);
  const t = Math.min(1, r / R);
  const th = Math.atan2(z, x);
  y += Math.sin(pose.time * 2.4 - t * 7 + th * 3) * 0.05 * R * t * t * pose.wave;
  y -= pose.pulse * 0.32 * R * t * t;
  const draw = 1 - pose.pulse * 0.18 * t;
  x *= draw;
  z *= draw;
  const w = Math.max(0, Math.cos(th - pose.dir)) ** 10;
  y += pose.lift * 1.1 * R * t * t * w;
  const out = Math.max(pose.lift, 0) * 0.25 * t;
  x += (Math.cos(pose.dir) * out + pose.reachX * t * t) * R * w;
  z += (Math.sin(pose.dir) * out + pose.reachZ * t * t) * R * w;
  const a = pose.spin * t;
  const ca = Math.cos(a);
  const sa = Math.sin(a);
  return [ca * x - sa * z, y, sa * x + ca * z];
}

/**
 * The directions its arms lie in (radians in the mesh's xz plane), from its vertex positions (x, y, z packed): where the
 * outer half of the mesh bunches round the middle, the eight strongest bunches.
 */
export function armAngles(positions: ArrayLike<number>, R: number, count = 8): number[] {
  const BINS = 72;
  const hist = new Float64Array(BINS);
  const ring: Array<[number, number]> = [];
  for (let i = 0; i + 2 < positions.length; i += 3) {
    const x = positions[i];
    const z = positions[i + 2];
    const t = Math.hypot(x, z) / R;
    if (t < 0.55 || t > 0.92) continue;
    const a = Math.atan2(z, x);
    ring.push([a, 1]);
    hist[((Math.floor(((a + Math.PI) / (Math.PI * 2)) * BINS) % BINS) + BINS) % BINS]++;
  }
  if (!ring.length) return [];
  const smooth = Array.from(hist, (_, i) => [1, 2, 3, 2, 1].reduce((sum, w, k) => sum + w * hist[(i + k - 2 + BINS) % BINS], 0));
  const mean = smooth.reduce((a, b) => a + b, 0) / BINS;
  const peaks: Array<{ i: number; v: number }> = [];
  for (let i = 0; i < BINS; i++) {
    const v = smooth[i];
    if (v > mean * 0.5 && v >= smooth[(i + BINS - 1) % BINS] && v > smooth[(i + 1) % BINS]) peaks.push({ i, v });
  }
  peaks.sort((a, b) => b.v - a.v);
  // Each peak refined to the mean direction of the points round it.
  return peaks.slice(0, count).map(({ i }) => {
    const centre = -Math.PI + ((i + 0.5) / BINS) * Math.PI * 2;
    let sx = 0;
    let sz = 0;
    for (const [a] of ring) {
      if (Math.abs(Math.atan2(Math.sin(a - centre), Math.cos(a - centre))) > 0.2) continue;
      sx += Math.cos(a);
      sz += Math.sin(a);
    }
    return Math.atan2(sz, sx);
  });
}

/** The arm in `arms` nearest the direction `dir`, given on the same turn as `dir` (or `dir` itself when there are none). */
export function nearestArm(arms: readonly number[], dir: number): number {
  let best = dir;
  let bd = Infinity;
  for (const a of arms) {
    const d = Math.atan2(Math.sin(a - dir), Math.cos(a - dir));
    if (Math.abs(d) < bd) { bd = Math.abs(d); best = dir + d; }
  }
  return best;
}

const GLSL = /* glsl */ `
#include <begin_vertex>
{
  float oR = length(transformed.xz);
  float oT = clamp(oR / uOctoR, 0.0, 1.0);
  float oTh = atan(transformed.z, transformed.x + 1e-6);
  transformed.y += sin(uOctoTime * 2.4 - oT * 7.0 + oTh * 3.0) * 0.05 * uOctoR * oT * oT * uOctoWave;
  transformed.y -= uOctoPulse * 0.32 * uOctoR * oT * oT;
  transformed.xz *= 1.0 - uOctoPulse * 0.18 * oT;
  float oW = pow(max(0.0, cos(oTh - uOctoDir)), 10.0);
  transformed.y += uOctoLift * 1.1 * uOctoR * oT * oT * oW;
  transformed.xz += (vec2(cos(uOctoDir), sin(uOctoDir)) * max(uOctoLift, 0.0) * 0.25 * oT + uOctoReach * oT * oT) * uOctoR * oW;
  float oA = uOctoSpin * oT;
  float oC = cos(oA);
  float oS = sin(oA);
  transformed.xz = vec2(oC * transformed.x - oS * transformed.z, oS * transformed.x + oC * transformed.z);
}
`;

const TAU = Math.PI * 2;
const SLAM_DOWN = 0.12;
const SLAM_REST = 0.25;
/** The whirlpool's top speed (radians a second), and how far the arm tips trail per radian a second. */
const SPIN_TOP = 7;
const TRAIL = 0.16;
const SLAM_BACK = 0.5;

/** What the body is doing this frame (Enemy.animate). */
export interface OctoDrive {
  state: string;
  attack: BossAttackKind | null;
  /** Where whom it fights stands (world). */
  mark: { x: number; y: number; z: number };
  moving: boolean;
}

/** The octopus's arms on its model: patches its materials and moves them each frame from what the body is doing. */
export class OctopusBody {
  readonly pose: OctoPose = { time: 0, pulse: 0, lift: 0, dir: 0, spin: 0, wave: 1, reachX: 0, reachZ: 0 };
  private readonly u = {
    uOctoTime: { value: 0 }, uOctoPulse: { value: 0 }, uOctoLift: { value: 0 }, uOctoDir: { value: 0 }, uOctoSpin: { value: 0 },
    uOctoWave: { value: 1 }, uOctoR: { value: 1 }, uOctoReach: { value: new Vector2() },
  };
  private swim = Math.random() * TAU;
  private raise = 0;
  private hold = 0;
  private slamT = -1;
  private aimDir = 0;
  /** Where the tip must be carried to its target (arm lengths), and how far down it must slam to meet the ground. */
  private readonly aimReach = new Vector2();
  private aimDrop = 0.35;
  private readonly arms: number[];
  /** How high the arm tips lie at rest (mesh units). */
  private readonly tipY: number;
  private whirl = 0;
  private spinVel = 0;
  /** How far round the body has spun (radians). */
  private turn = 0;
  private squeeze = 0;
  private readonly v = new Vector3();

  /** `mesh` is the body's mesh (its local space is the shader's, `geometry` its shape); `R` how far its arms reach there. */
  constructor(private readonly mesh: Object3D, geometry: BufferGeometry, materials: readonly Material[], R: number) {
    this.u.uOctoR.value = R;
    // (Read through the attribute: a loaded mesh's positions are often interleaved with its normals and uvs.)
    const attr = geometry.getAttribute('position');
    const pos = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i++) { pos[i * 3] = attr.getX(i); pos[i * 3 + 1] = attr.getY(i); pos[i * 3 + 2] = attr.getZ(i); }
    this.arms = armAngles(pos, R);
    let ys = 0;
    let n = 0;
    for (let i = 0; i + 2 < pos.length; i += 3) if (Math.hypot(pos[i], pos[i + 2]) > R * 0.85) { ys += pos[i + 1]; n++; }
    this.tipY = n ? ys / n : 0;
    for (const m of materials) patchOctopus(m as MeshStandardMaterial, this.u);
  }

  /** The tentacle slam: the arm stays raised toward (x, z) for `delay` seconds, then comes down. */
  slamAt(x: number, y: number, z: number, delay: number): void {
    this.aim(x, y, z, true);
    this.hold = delay;
    this.raise = 1;
  }

  /** The whirlpool: every arm spins round the middle for `seconds`. */
  spinFor(seconds: number): void {
    this.whirl = seconds;
  }

  /** A jet of ink: the bell squeezes shut. */
  squirt(): void {
    this.squeeze = 0.6;
  }

  drive(dt: number, s: OctoDrive): void {
    const p = this.pose;
    p.time += dt;
    this.swim += dt * (s.moving ? 2.6 : 1.4);
    let pulse = 0.3 + 0.3 * Math.sin(this.swim);
    // The arm: raised toward the mark through a slam's wind-up, held over the target, brought down, back.
    const winding = s.state === 'windup' && s.attack === 'tentacle';
    if (winding) { this.raise = Math.min(1, this.raise + dt * 1.4); this.aim(s.mark.x, s.mark.y, s.mark.z, true); }
    let lift: number;
    if (this.hold > 0) {
      this.hold -= dt;
      lift = 1;
      if (this.hold <= 0) this.slamT = 0;
    } else if (this.slamT >= 0) {
      this.slamT += dt;
      // (Down past level to the ground under it, held there a moment, then eased back.)
      const back = Math.max(0, 1 - Math.max(0, this.slamT - SLAM_DOWN - SLAM_REST) / SLAM_BACK);
      lift = this.slamT < SLAM_DOWN ? 1 - (1 + this.aimDrop) * (this.slamT / SLAM_DOWN) : -this.aimDrop * back * back * (3 - 2 * back);
      if (this.slamT > SLAM_DOWN + SLAM_REST + SLAM_BACK) { this.slamT = -1; this.raise = 0; this.aimReach.set(0, 0); }
    } else {
      if (!winding) this.raise = Math.max(0, this.raise - dt * 2);
      lift = this.raise * this.raise * (3 - 2 * this.raise);
    }
    // A throw: the arm toward the mark flicks up as the thing leaves it.
    if (s.attack === 'diamond' && s.state === 'windup' && this.slamT < 0 && this.hold <= 0) { lift = Math.max(lift, 0.45); this.aim(s.mark.x, s.mark.y, s.mark.z, false); }
    // Ink: the bell opens wide through the wind-up, then squeezes shut.
    if (s.attack === 'ink' && s.state === 'windup') pulse = Math.max(0, pulse - 0.6);
    if (this.squeeze > 0) { this.squeeze -= dt; pulse = 1; }
    // The whirlpool: the whole body spins up like a top, its arms trailing behind it, then spins down and comes round
    // to face the way it faced (the next whole turn on).
    if (this.whirl > 0 || (s.attack === 'whirlpool' && s.state === 'windup')) {
      this.whirl = Math.max(0, this.whirl - dt);
      this.spinVel = Math.min(SPIN_TOP, this.spinVel + dt * 9);
    } else this.spinVel = Math.max(0, this.spinVel - dt * 5);
    this.turn += this.spinVel * dt;
    if (this.spinVel === 0 && this.turn !== 0) {
      const rest = Math.ceil(this.turn / TAU - 1e-6) * TAU;
      this.turn += (rest - this.turn) * Math.min(1, dt * 3);
      if (Math.abs(rest - this.turn) < 1e-3) this.turn = 0;
    }
    // (Turning +x toward +z, as the arms' twist does: three's rotation.y turns the other way.)
    this.mesh.rotation.y = -this.turn;
    p.spin = -this.spinVel * TRAIL;
    p.pulse = pulse;
    // (The stretch goes with the arm: out while it is up or coming down, back as it settles.)
    const k = Math.min(1, dt * 6);
    const on = lift !== 0 ? 1 : 0;
    p.reachX += (this.aimReach.x * on - p.reachX) * k;
    p.reachZ += (this.aimReach.y * on - p.reachZ) * k;
    p.lift = lift;
    p.dir = this.aimDir;
    const u = this.u;
    u.uOctoTime.value = p.time;
    u.uOctoPulse.value = p.pulse;
    u.uOctoLift.value = p.lift;
    u.uOctoDir.value = p.dir;
    u.uOctoSpin.value = p.spin;
    u.uOctoWave.value = p.wave;
    u.uOctoReach.value.set(p.reachX, p.reachZ);
  }

  /**
   * Points the arm nearest (x, y, z) at it: which arm, and (when it must reach) where its tip is carried, sideways and
   * out, to come down on it, and how far down past level the slam must go to meet it.
   */
  private aim(x: number, y: number, z: number, stretch: boolean): void {
    this.mesh.updateWorldMatrix(true, false);
    const l = this.mesh.worldToLocal(this.v.set(x, y, z));
    const R = this.u.uOctoR.value;
    this.aimDir = nearestArm(this.arms, Math.atan2(l.z, l.x));
    if (!stretch) { this.aimReach.set(0, 0); return; }
    const tipX = Math.cos(this.aimDir) * R * 0.92;
    const tipZ = Math.sin(this.aimDir) * R * 0.92;
    this.aimReach.set((l.x - tipX) / R, (l.z - tipZ) / R);
    if (this.aimReach.length() > 1.6) this.aimReach.setLength(1.6);
    this.aimDrop = Math.max(0.35, Math.min(1.5, (this.tipY - l.y) / (1.1 * R)));
  }
}

function patchOctopus(mat: MeshStandardMaterial, u: Record<string, { value: unknown }>): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    Object.assign(shader.uniforms, u);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', `uniform float uOctoTime; uniform float uOctoPulse; uniform float uOctoLift; uniform float uOctoDir; uniform float uOctoSpin; uniform float uOctoWave; uniform float uOctoR; uniform vec2 uOctoReach;\nvoid main() {`)
      .replace('#include <begin_vertex>', GLSL);
  };
  const key = mat.customProgramCacheKey?.bind(mat);
  mat.customProgramCacheKey = () => `${key ? key() : ''}|octopus`;
  mat.needsUpdate = true;
}

/**
 * Rigid bodies for rubble, bones and severed parts (no physics library). The quality pass of 2026-11-16 ("when buildings
 * break it doesn't look realistic"): real gravity, and a chunk is an oriented box fitted to it, so it lands on a face,
 * tips off a corner, slides and stacks with its neighbours, its spin a real angular velocity. Small things (bones,
 * pebbles) stay balls. Ground is the collision ground (heights.heightAt: roofs, walls, terrain alike). A piece that has
 * been still for half a second sleeps; at most `maxActive` are awake with full contacts, the oldest past that keep
 * falling but skip piece-to-piece contact (never frozen in the air, never deleted), so a cathedral stays smooth.
 */

/** Pieces awake with full contacts at once. */
export const MAX_ACTIVE = 300;

/** m/s² — the real thing: big falls read big. */
export const GRAVITY = 9.81;

const RESTITUTION = 0.22;
const FRICTION = 0.6;
/** Below this landing speed it stops bouncing. */
const STICK = 1.2;
const SLEEP_SPEED = 0.18;
const SLEEP_SPIN = 0.6;
const SLEEP_AFTER = 0.5;
/** Pieces born touching each other (a wall turned to chunks) ignore each other this long: no pop at the swap. */
const GRACE = 0.3;
const CELL = 2;
/** Contact slop (m): this close counts as touching. */
const SLOP = 0.012;
/** Neighbours a piece checks each step. */
const NEIGHBOURS = 6;
/** Longest physics sub-step. */
const SUB = 1 / 120;

/** Something the sim moves (a three Object3D fits). */
export interface Body {
  position: { set(x: number, y: number, z: number): unknown };
  quaternion: { set(x: number, y: number, z: number, w: number): unknown };
}

export interface Half { x: number; y: number; z: number }

export interface PieceInit {
  x: number; y: number; z: number;
  /** Bounding radius (a ball's radius). */
  r: number;
  /** Half extents of its box (local axes); none: a ball. */
  box?: Half;
  /** Its orientation (else from rx, ry, rz, XYZ Euler). */
  q?: { x: number; y: number; z: number; w: number };
  vx?: number; vy?: number; vz?: number;
  /** Spin, radians a second about each world axis. */
  wx?: number; wy?: number; wz?: number;
  rx?: number; ry?: number; rz?: number;
  /** kg/m³ (stone 2400, wood 600); mass is its box's volume times this. */
  density?: number;
  restitution?: number;
  friction?: number;
  obj?: Body;
  /** Called when it lands hard (a clatter, a thud, dust). */
  onLand?: (p: Piece, speed: number) => void;
}

export interface Piece {
  x: number; y: number; z: number; r: number;
  vx: number; vy: number; vz: number;
  wx: number; wy: number; wz: number;
  qx: number; qy: number; qz: number; qw: number;
  /** Half extents; 0 for a ball. */
  hx: number; hy: number; hz: number;
  box: boolean;
  invM: number;
  /** Inverse inertia about its local axes. */
  ix: number; iy: number; iz: number;
  e: number; mu: number;
  awake: boolean;
  /** Over the cap: still falls and lands, but no piece-to-piece contact. */
  cheap: boolean;
  /** Seconds it has been slow. */
  still: number;
  /** Seconds since it was added. */
  age: number;
  bounces: number;
  grounded: boolean;
  dead: boolean;
  obj?: Body;
  onLand?: (p: Piece, speed: number) => void;
  /** Free for the owner (which collapse it belongs to). */
  tag?: unknown;
  /** Pieces it was born touching (ignored for GRACE seconds). */
  born?: Set<Piece>;
}

// Scratch.
const R = new Float64Array(9);
const RQ = new Float64Array(9);

/** Rotation matrix (row-major) of quaternion (x, y, z, w) into `m`. */
function rot(x: number, y: number, z: number, w: number, m: Float64Array): void {
  const xx = x * x, yy = y * y, zz = z * z, xy = x * y, xz = x * z, yz = y * z, wx = w * x, wy = w * y, wz = w * z;
  m[0] = 1 - 2 * (yy + zz); m[1] = 2 * (xy - wz); m[2] = 2 * (xz + wy);
  m[3] = 2 * (xy + wz); m[4] = 1 - 2 * (xx + zz); m[5] = 2 * (yz - wx);
  m[6] = 2 * (xz - wy); m[7] = 2 * (yz + wx); m[8] = 1 - 2 * (xx + yy);
}

function eulerQ(x: number, y: number, z: number): [number, number, number, number] {
  const c1 = Math.cos(x / 2), c2 = Math.cos(y / 2), c3 = Math.cos(z / 2);
  const s1 = Math.sin(x / 2), s2 = Math.sin(y / 2), s3 = Math.sin(z / 2);
  return [s1 * c2 * c3 + c1 * s2 * s3, c1 * s2 * c3 - s1 * c2 * s3, c1 * c2 * s3 + s1 * s2 * c3, c1 * c2 * c3 - s1 * s2 * s3];
}

/** Applies p's world inverse inertia to (x, y, z) → out. */
function invInertia(p: Piece, m: Float64Array, x: number, y: number, z: number, out: number[]): void {
  if (!p.box) { out[0] = x * p.ix; out[1] = y * p.ix; out[2] = z * p.ix; return; }
  // Local = Rᵀ v, scaled, back to world.
  const lx = (m[0] * x + m[3] * y + m[6] * z) * p.ix;
  const ly = (m[1] * x + m[4] * y + m[7] * z) * p.iy;
  const lz = (m[2] * x + m[5] * y + m[8] * z) * p.iz;
  out[0] = m[0] * lx + m[1] * ly + m[2] * lz;
  out[1] = m[3] * lx + m[4] * ly + m[5] * lz;
  out[2] = m[6] * lx + m[7] * ly + m[8] * lz;
}

const _t = [0, 0, 0];

/**
 * An impulse along unit normal n at world offset r from p's centre, against a fixed thing, to stop it closing (with
 * bounce `e` when it closes fast) and with Coulomb friction. Returns the closing speed it removed.
 */
function contact(p: Piece, m: Float64Array, rx: number, ry: number, rz: number, nx: number, ny: number, nz: number, bounce: boolean): number {
  // Velocity of the contact point.
  let vx = p.vx + (p.wy * rz - p.wz * ry), vy = p.vy + (p.wz * rx - p.wx * rz), vz = p.vz + (p.wx * ry - p.wy * rx);
  const vn = vx * nx + vy * ny + vz * nz;
  if (vn >= 0) return 0;
  // k = 1/m + n · ((I⁻¹ (r × n)) × r)
  const cx = ry * nz - rz * ny, cy = rz * nx - rx * nz, cz = rx * ny - ry * nx;
  invInertia(p, m, cx, cy, cz, _t);
  const kx = _t[1] * rz - _t[2] * ry, ky = _t[2] * rx - _t[0] * rz, kz = _t[0] * ry - _t[1] * rx;
  const k = p.invM + nx * kx + ny * ky + nz * kz;
  const e = bounce && -vn > STICK ? p.e : 0;
  const j = (-(1 + e) * vn) / k;
  apply(p, m, rx, ry, rz, nx * j, ny * j, nz * j);
  // Friction along the sliding direction, at most mu · j.
  vx = p.vx + (p.wy * rz - p.wz * ry); vy = p.vy + (p.wz * rx - p.wx * rz); vz = p.vz + (p.wx * ry - p.wy * rx);
  const vn2 = vx * nx + vy * ny + vz * nz;
  let tx = vx - vn2 * nx, ty = vy - vn2 * ny, tz = vz - vn2 * nz;
  const ts = Math.hypot(tx, ty, tz);
  if (ts > 1e-6) {
    tx /= ts; ty /= ts; tz /= ts;
    const ax = ry * tz - rz * ty, ay = rz * tx - rx * tz, az = rx * ty - ry * tx;
    invInertia(p, m, ax, ay, az, _t);
    const bx = _t[1] * rz - _t[2] * ry, by = _t[2] * rx - _t[0] * rz, bz = _t[0] * ry - _t[1] * rx;
    const kt = p.invM + tx * bx + ty * by + tz * bz;
    const jt = Math.min(ts / kt, p.mu * j);
    apply(p, m, rx, ry, rz, -tx * jt, -ty * jt, -tz * jt);
  }
  if (bounce && e > 0) p.bounces++;
  return -vn;
}

function apply(p: Piece, m: Float64Array, rx: number, ry: number, rz: number, jx: number, jy: number, jz: number): void {
  p.vx += jx * p.invM; p.vy += jy * p.invM; p.vz += jz * p.invM;
  invInertia(p, m, ry * jz - rz * jy, rz * jx - rx * jz, rx * jy - ry * jx, _t);
  p.wx += _t[0]; p.wy += _t[1]; p.wz += _t[2];
}

export class DebrisSim {
  readonly pieces: Piece[] = [];
  private checkAt = 0;

  constructor(private readonly groundAt: (x: number, z: number, y: number) => number, public maxActive = MAX_ACTIVE) {}

  /** Pieces awake with full contacts. */
  get active(): number {
    let n = 0;
    for (const p of this.pieces) if (p.awake && !p.cheap) n++;
    return n;
  }

  add(i: PieceInit): Piece {
    const box = !!i.box;
    const hx = i.box?.x ?? 0, hy = i.box?.y ?? 0, hz = i.box?.z ?? 0;
    const density = i.density ?? 2000;
    const vol = box ? 8 * hx * hy * hz : (4 / 3) * Math.PI * i.r ** 3;
    const mass = Math.max(0.05, vol * density);
    const [qx, qy, qz, qw] = i.q ? [i.q.x, i.q.y, i.q.z, i.q.w] : eulerQ(i.rx ?? 0, i.ry ?? 0, i.rz ?? 0);
    const inertia = (a: number, b: number) => (mass / 3) * (a * a + b * b);
    const ball = 0.4 * mass * i.r * i.r;
    const p: Piece = {
      x: i.x, y: i.y, z: i.z, r: i.r,
      vx: i.vx ?? 0, vy: i.vy ?? 0, vz: i.vz ?? 0,
      wx: i.wx ?? 0, wy: i.wy ?? 0, wz: i.wz ?? 0,
      qx, qy, qz, qw, hx, hy, hz, box,
      invM: 1 / mass,
      ix: 1 / (box ? inertia(hy, hz) : ball), iy: 1 / (box ? inertia(hx, hz) : ball), iz: 1 / (box ? inertia(hx, hy) : ball),
      e: i.restitution ?? RESTITUTION, mu: i.friction ?? FRICTION,
      awake: true, cheap: false, still: 0, age: 0, bounces: 0, grounded: false, dead: false, obj: i.obj, onLand: i.onLand,
    };
    // Born touching a young piece (the next chunk of the same wall): they ignore each other a moment.
    for (const q of this.pieces) {
      if (q.age >= GRACE || q.dead) continue;
      const ap = halfBox(p), aq = halfBox(q);
      if (Math.abs(p.x - q.x) > ap[0] + aq[0] + 0.02 || Math.abs(p.y - q.y) > ap[1] + aq[1] + 0.02 || Math.abs(p.z - q.z) > ap[2] + aq[2] + 0.02) continue;
      (p.born ??= new Set()).add(q);
      (q.born ??= new Set()).add(p);
    }
    this.pieces.push(p);
    this.cap();
    this.sync(p);
    return p;
  }

  remove(p: Piece): void {
    p.dead = true;
  }

  /** Wakes and throws every piece within `radius` of (x, y, z) outward and up, by `strength` m/s at the centre. */
  blast(x: number, y: number, z: number, radius: number, strength: number): void {
    for (const p of this.pieces) {
      const dx = p.x - x, dy = p.y - y, dz = p.z - z;
      const d = Math.hypot(dx, dy, dz);
      if (d > radius) continue;
      const k = strength * (1 - d / radius);
      const h = Math.hypot(dx, dz) || 1;
      p.vx += (dx / h) * k;
      p.vz += (dz / h) * k;
      p.vy += k * 0.6 + 0.6;
      // A blast sets it tumbling, harder the lighter it is.
      const spin = (k / Math.max(0.3, p.r)) * 0.6;
      p.wx += (Math.random() - 0.5) * spin; p.wy += (Math.random() - 0.5) * spin; p.wz += (Math.random() - 0.5) * spin;
      this.wake(p);
    }
    this.cap();
  }

  /** Adds `fn`'s velocity change to each piece within `radius` of (x, z) (a vortex, a tornado, wind). */
  push(x: number, z: number, radius: number, fn: (p: Piece, dx: number, dz: number, d: number) => void): void {
    for (const p of this.pieces) {
      const dx = p.x - x, dz = p.z - z;
      const d = Math.hypot(dx, dz);
      if (d > radius) continue;
      this.wake(p);
      fn(p, dx, dz, d);
    }
    this.cap();
  }

  wake(p: Piece): void {
    if (p.dead) return;
    if (!p.awake) { p.awake = true; p.cheap = false; }
    p.still = 0;
    p.grounded = false;
  }

  step(dt: number): void {
    if (dt <= 0) return;
    const n = Math.min(6, Math.ceil(dt / SUB));
    const h = dt / n;
    // Sleeping pieces whose ground went away (a wall under them broke) wake, a few each frame.
    this.checkAt += dt;
    const grid = this.grid();
    if (this.checkAt > 0.25) {
      this.checkAt = 0;
      for (const p of this.pieces) {
        if (p.awake || p.dead) continue;
        if (this.groundAt(p.x, p.z, p.y) < p.y - this.reach(p) - 0.15 && !this.supported(p, grid)) this.wake(p);
      }
      this.cap();
    }
    for (let s = 0; s < n; s++) {
      for (const p of this.pieces) if (p.awake && !p.dead) this.integrate(p, h);
      const g = s === 0 ? grid : this.grid();
      for (const p of this.pieces) if (p.awake && !p.dead && !p.cheap) this.collide(p, g);
    }
    for (const p of this.pieces) {
      if (!p.awake || p.dead) continue;
      p.age += dt;
      if (p.born && p.age >= GRACE) p.born = undefined;
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      const spin = Math.hypot(p.wx, p.wy, p.wz);
      if (p.grounded && speed < SLEEP_SPEED && spin < SLEEP_SPIN) p.still += dt; else p.still = 0;
      if (p.still >= SLEEP_AFTER) { p.awake = false; p.cheap = false; p.vx = p.vy = p.vz = 0; p.wx = p.wy = p.wz = 0; }
      if (p.y < -60) p.dead = true;
      this.sync(p);
    }
    if (this.pieces.some((p) => p.dead)) {
      for (let i = this.pieces.length - 1; i >= 0; i--) if (this.pieces[i].dead) this.pieces.splice(i, 1);
    }
  }

  /** How far below its centre it reaches. */
  private reach(p: Piece): number {
    if (!p.box) return p.r;
    rot(p.qx, p.qy, p.qz, p.qw, R);
    return Math.abs(R[3]) * p.hx + Math.abs(R[4]) * p.hy + Math.abs(R[5]) * p.hz;
  }

  private grid(): Map<number, Piece[]> {
    const grid = new Map<number, Piece[]>();
    for (const p of this.pieces) {
      if (p.dead) continue;
      const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(p);
    }
    return grid;
  }

  private integrate(p: Piece, h: number): void {
    p.vy -= GRAVITY * h;
    p.x += p.vx * h; p.y += p.vy * h; p.z += p.vz * h;
    // q += ½ ω q h
    const { qx, qy, qz, qw } = p;
    const hx = 0.5 * h;
    p.qx += hx * (p.wx * qw + p.wy * qz - p.wz * qy);
    p.qy += hx * (p.wy * qw + p.wz * qx - p.wx * qz);
    p.qz += hx * (p.wz * qw + p.wx * qy - p.wy * qx);
    p.qw += hx * (-p.wx * qx - p.wy * qy - p.wz * qz);
    const l = Math.hypot(p.qx, p.qy, p.qz, p.qw) || 1;
    p.qx /= l; p.qy /= l; p.qz /= l; p.qw /= l;
    // A little air drag on the spin.
    const d = Math.max(0, 1 - 0.15 * h);
    p.wx *= d; p.wy *= d; p.wz *= d;
    this.ground(p);
  }

  private ground(p: Piece): void {
    p.grounded = false;
    if (!p.box) {
      const g = this.groundAt(p.x, p.z, p.y + p.r);
      if (p.y - p.r > g) return;
      p.y = g + p.r;
      const speed = -p.vy;
      if (speed > 3) p.onLand?.(p, speed);
      if (p.vy < 0) { if (speed > STICK) { p.vy = speed * p.e; p.bounces++; } else p.vy = 0; }
      p.grounded = p.vy <= 0.01;
      if (p.grounded) {
        const f = Math.max(0, 1 - 6 * SUB);
        p.vx *= f; p.vz *= f; p.wx *= f; p.wy *= f; p.wz *= f;
      }
      return;
    }
    rot(p.qx, p.qy, p.qz, p.qw, R);
    // Corners under the ground.
    const cs: number[] = [];
    let deepest = 0;
    const g0 = this.groundAt(p.x, p.z, p.y + p.r);
    if (p.y - p.r > g0 + 0.05) return;
    for (let i = 0; i < 8; i++) {
      const lx = i & 1 ? p.hx : -p.hx, ly = i & 2 ? p.hy : -p.hy, lz = i & 4 ? p.hz : -p.hz;
      const rx = R[0] * lx + R[1] * ly + R[2] * lz, ry = R[3] * lx + R[4] * ly + R[5] * lz, rz = R[6] * lx + R[7] * ly + R[8] * lz;
      const g = this.groundAt(p.x + rx, p.z + rz, p.y + p.r);
      const pen = g - (p.y + ry);
      if (pen > 0) { cs.push(rx, ry, rz); deepest = Math.max(deepest, pen); }
    }
    if (!cs.length) return;
    p.y += deepest;
    let hit = 0;
    for (let it = 0; it < 3; it++) {
      for (let c = 0; c < cs.length; c += 3) {
        // (After the push up, the corner is at its offset again.)
        const v = contact(p, R, cs[c], cs[c + 1], cs[c + 2], 0, 1, 0, it === 0);
        if (it === 0) hit = Math.max(hit, v);
      }
    }
    if (hit > 3) p.onLand?.(p, hit);
    p.grounded = true;
    // Rolling and scraping resistance on the ground.
    const f = Math.max(0, 1 - 1.5 * SUB);
    p.wx *= f; p.wy *= f; p.wz *= f;
  }

  /** Contacts with neighbours: a box's corners inside another box (both ways), balls by distance. */
  private collide(p: Piece, grid: Map<number, Piece[]>): void {
    const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
    const near: Piece[] = [];
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const b = grid.get(key(cx + i, cz + j));
      if (!b) continue;
      for (const q of b) {
        if (q === p || q.dead) continue;
        if (p.age < GRACE && p.born?.has(q)) continue;
        const rr = p.r + q.r;
        if ((p.x - q.x) ** 2 + (p.y - q.y) ** 2 + (p.z - q.z) ** 2 >= rr * rr) continue;
        near.push(q);
      }
    }
    if (near.length > NEIGHBOURS) {
      near.sort((a, b) => (a.x - p.x) ** 2 + (a.y - p.y) ** 2 + (a.z - p.z) ** 2 - ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 + (b.z - p.z) ** 2));
      near.length = NEIGHBOURS;
    }
    for (const q of near) {
      if (p.box && q.box) this.pair(p, q);
      else this.balls(p, q);
    }
  }

  /**
   * Two boxes: the separating-axis test over both boxes' face axes gives the contact normal (q toward p) and depth;
   * p is pushed out (half of it when q is awake) and stopped closing at the points of each box that reach into the
   * other across that face — its corners (a hair inside, so flush faces still meet) and face centres.
   */
  private pair(p: Piece, q: Piece): void {
    rot(p.qx, p.qy, p.qz, p.qw, R);
    rot(q.qx, q.qy, q.qz, q.qw, RQ);
    const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
    let best = Infinity, nx = 0, ny = 1, nz = 0, ep = 0, eq = 0;
    for (let k = 0; k < 6; k++) {
      const M = k < 3 ? RQ : R, c = k % 3;
      const lx = M[c], ly = M[3 + c], lz = M[6 + c];
      const a = ext(R, p, lx, ly, lz), b = ext(RQ, q, lx, ly, lz);
      const dist = dx * lx + dy * ly + dz * lz;
      const over = a + b - Math.abs(dist);
      if (over <= 0) return;
      // (A little bias to q's own faces, so a slab on a slab picks the face it lies on.)
      if (over < best - 1e-4) { best = over; const sg = dist >= 0 ? 1 : -1; nx = lx * sg; ny = ly * sg; nz = lz * sg; ep = a; eq = b; }
    }
    // A sleeping piece resting on top of p is held up by p, not a wall to push p away (p would be squeezed between).
    if (!q.awake && ny < -0.5) return;
    const share = q.awake && !q.cheap ? 0.5 : 1;
    // Contact points (offsets from p's centre), before the push.
    const pts: number[] = [];
    const planeQ = q.x * nx + q.y * ny + q.z * nz + eq;
    const planeP = p.x * nx + p.y * ny + p.z * nz - ep;
    for (const [body, M, sgn] of [[p, R, 1], [q, RQ, -1]] as const) {
      for (let i = 0; i < 14; i++) {
        let lx: number, ly: number, lz: number;
        if (i < 8) { lx = (i & 1 ? body.hx : -body.hx) * 0.97; ly = (i & 2 ? body.hy : -body.hy) * 0.97; lz = (i & 4 ? body.hz : -body.hz) * 0.97; }
        else { const f = i - 8, sg = f & 1 ? 1 : -1; lx = f >> 1 === 0 ? sg * body.hx : 0; ly = f >> 1 === 1 ? sg * body.hy : 0; lz = f >> 1 === 2 ? sg * body.hz : 0; }
        const wx = body.x + M[0] * lx + M[1] * ly + M[2] * lz, wy = body.y + M[3] * lx + M[4] * ly + M[5] * lz, wz = body.z + M[6] * lx + M[7] * ly + M[8] * lz;
        const s = wx * nx + wy * ny + wz * nz;
        // p's points below q's face plane, q's points above p's.
        const depth = sgn === 1 ? planeQ - s : s - planeP;
        // (Points just touching count too, so a slab resting flat is held at all its corners, not tipped by one.)
        if (depth <= -SLOP || depth > best + 0.05) continue;
        pts.push(wx - p.x, wy - p.y, wz - p.z);
      }
    }
    // (At most a few cm a sub-step: a deep overlap eases apart instead of firing the pieces off.)
    const push = Math.min(0.04, Math.max(0, best - SLOP * 0.5) * share);
    p.x += nx * push; p.y += ny * push; p.z += nz * push;
    for (let it = 0; it < 2; it++) for (let c = 0; c < pts.length; c += 3) contact(p, R, pts[c], pts[c + 1], pts[c + 2], nx, ny, nz, false);
    if (ny > 0.5) p.grounded = true;
  }

  /** A ball against a ball or a box (by bounding radii, the box's smaller half): separate and stop closing. */
  private balls(p: Piece, q: Piece): void {
    const rp = p.box ? Math.min(p.hx, p.hy, p.hz) * 1.4 : p.r, rq = q.box ? Math.min(q.hx, q.hy, q.hz) * 1.4 : q.r;
    const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
    const min = (rp + rq) * 0.9;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 >= min * min) return;
    const d = Math.sqrt(d2) || 1e-4;
    const over = min - d;
    const nx = d2 ? dx / d : 0, ny = d2 ? dy / d : 1, nz = d2 ? dz / d : 0;
    const share = q.awake && !q.cheap ? 0.5 : 1;
    p.x += nx * over * share; p.y += ny * over * share; p.z += nz * over * share;
    if (share < 1) { q.x -= nx * over * 0.5; q.y -= ny * over * 0.5; q.z -= nz * over * 0.5; }
    const vn = p.vx * nx + p.vy * ny + p.vz * nz;
    if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; p.vz -= vn * nz; }
    if (ny > 0.5) {
      p.grounded = true;
      const f = Math.max(0, 1 - 6 * SUB);
      p.vx *= f; p.vz *= f; p.wx *= f; p.wy *= f; p.wz *= f;
    }
  }

  /** True when another piece holds `p` up. */
  private supported(p: Piece, grid: Map<number, Piece[]>): boolean {
    const b = grid.get(key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)));
    if (!b) return false;
    for (const q of b) {
      if (q === p || q.dead) continue;
      if (q.y < p.y && Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < (p.r + q.r) * 1.05) return true;
    }
    return false;
  }

  /** Over the cap: the oldest awake pieces go cheap (they still fall and land, without piece-to-piece contact). */
  private cap(): void {
    let over = this.active - this.maxActive;
    if (over <= 0) return;
    for (const p of this.pieces) {
      if (over <= 0) break;
      if (p.awake && !p.cheap && p.grounded) { p.awake = false; p.vx = p.vy = p.vz = 0; p.wx = p.wy = p.wz = 0; over--; }
    }
    for (const p of this.pieces) {
      if (over <= 0) break;
      if (p.awake && !p.cheap) { p.cheap = true; over--; }
    }
  }

  private sync(p: Piece): void {
    p.obj?.position.set(p.x, p.y, p.z);
    p.obj?.quaternion.set(p.qx, p.qy, p.qz, p.qw);
  }
}

/** How far box p (rotation M) reaches along unit axis (x, y, z). */
function ext(M: Float64Array, p: Piece, x: number, y: number, z: number): number {
  return Math.abs(M[0] * x + M[3] * y + M[6] * z) * p.hx + Math.abs(M[1] * x + M[4] * y + M[7] * z) * p.hy + Math.abs(M[2] * x + M[5] * y + M[8] * z) * p.hz;
}

/** Half sizes of the world box round a piece. */
function halfBox(p: Piece): [number, number, number] {
  if (!p.box) return [p.r, p.r, p.r];
  rot(p.qx, p.qy, p.qz, p.qw, R);
  return [
    Math.abs(R[0]) * p.hx + Math.abs(R[1]) * p.hy + Math.abs(R[2]) * p.hz,
    Math.abs(R[3]) * p.hx + Math.abs(R[4]) * p.hy + Math.abs(R[5]) * p.hz,
    Math.abs(R[6]) * p.hx + Math.abs(R[7]) * p.hy + Math.abs(R[8]) * p.hz,
  ];
}

function key(cx: number, cz: number): number {
  return (cx + 4096) * 8192 + (cz + 4096);
}

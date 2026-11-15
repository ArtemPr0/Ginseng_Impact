/**
 * Light rigid bodies for rubble, bones and severed parts (no physics library): each piece is a ball of its own radius
 * that flies, tumbles, lands on the collision ground (heights.heightAt, so it rests on roofs, walls and terrain alike),
 * bounces a little, slides to a stop, and piles on other pieces through ball separation in a spatial hash. A piece that
 * has been still for half a second sleeps, and at most MAX_ACTIVE are awake (the oldest sleep or go first), so a
 * cathedral coming down stays smooth on a laptop.
 */

/** Pieces awake at once. */
export const MAX_ACTIVE = 300;

const GRAVITY = 22;
const RESTITUTION = 0.25;
/** Below this landing speed it stops bouncing. */
const STICK = 1.4;
const SLEEP_SPEED = 0.15;
const SLEEP_AFTER = 0.5;
const CELL = 2;

/** Something the sim moves (a three Object3D fits). */
export interface Body {
  position: { set(x: number, y: number, z: number): unknown };
  rotation: { set(x: number, y: number, z: number): unknown };
}

export interface PieceInit {
  x: number; y: number; z: number; r: number;
  vx?: number; vy?: number; vz?: number;
  /** Spin, radians a second about each axis. */
  wx?: number; wy?: number; wz?: number;
  rx?: number; ry?: number; rz?: number;
  obj?: Body;
  /** Called when it lands hard (a clatter, a thud). */
  onLand?: (p: Piece, speed: number) => void;
}

export interface Piece {
  x: number; y: number; z: number; r: number;
  vx: number; vy: number; vz: number;
  wx: number; wy: number; wz: number;
  rx: number; ry: number; rz: number;
  awake: boolean;
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
}

export class DebrisSim {
  readonly pieces: Piece[] = [];
  private checkAt = 0;

  constructor(private readonly groundAt: (x: number, z: number, y: number) => number, private readonly maxActive = MAX_ACTIVE) {}

  get active(): number {
    let n = 0;
    for (const p of this.pieces) if (p.awake) n++;
    return n;
  }

  add(i: PieceInit): Piece {
    const p: Piece = {
      x: i.x, y: i.y, z: i.z, r: i.r,
      vx: i.vx ?? 0, vy: i.vy ?? 0, vz: i.vz ?? 0,
      wx: i.wx ?? 0, wy: i.wy ?? 0, wz: i.wz ?? 0,
      rx: i.rx ?? 0, ry: i.ry ?? 0, rz: i.rz ?? 0,
      awake: true, still: 0, age: 0, bounces: 0, grounded: false, dead: false, obj: i.obj, onLand: i.onLand,
    };
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
      p.vy += k * 0.7 + 1;
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
    p.awake = true;
    p.still = 0;
    p.grounded = false;
  }

  step(dt: number): void {
    if (dt <= 0) return;
    const grid = new Map<number, Piece[]>();
    const key = (cx: number, cz: number) => (cx + 4096) * 8192 + (cz + 4096);
    for (const p of this.pieces) {
      if (p.dead) continue;
      const k = key(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
      let b = grid.get(k);
      if (!b) grid.set(k, (b = []));
      b.push(p);
    }
    // Sleeping pieces whose ground went away (a wall under them broke) wake, a few each frame.
    this.checkAt += dt;
    if (this.checkAt > 0.25) {
      this.checkAt = 0;
      for (const p of this.pieces) {
        if (p.awake || p.dead) continue;
        if (this.groundAt(p.x, p.z, p.y) < p.y - p.r - 0.15 && !this.supported(p, grid, key)) this.wake(p);
      }
    }
    for (const p of this.pieces) {
      if (!p.awake || p.dead) continue;
      p.age += dt;
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.rx += p.wx * dt;
      p.ry += p.wy * dt;
      p.rz += p.wz * dt;
      const g = this.groundAt(p.x, p.z, p.y + p.r);
      p.grounded = false;
      if (p.y - p.r <= g) {
        p.y = g + p.r;
        if (p.vy < 0) {
          const speed = -p.vy;
          if (speed > 3) p.onLand?.(p, speed);
          if (speed > STICK) { p.vy = speed * RESTITUTION; p.bounces++; } else p.vy = 0;
        }
        p.grounded = p.vy <= 0.01;
        if (p.grounded) {
          const f = Math.max(0, 1 - 5 * dt);
          p.vx *= f; p.vz *= f;
          p.wx *= f; p.wy *= f; p.wz *= f;
        }
      }
      if (p.y < -60) { p.dead = true; continue; }
    }
    // Pile: separate overlapping balls (a sleeping one holds still and carries the awake one).
    for (const p of this.pieces) {
      if (!p.awake || p.dead) continue;
      const cx = Math.floor(p.x / CELL), cz = Math.floor(p.z / CELL);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
        const b = grid.get(key(cx + i, cz + j));
        if (!b) continue;
        for (const q of b) {
          if (q === p || q.dead) continue;
          const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z;
          const min = (p.r + q.r) * 0.9;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (d2 >= min * min) continue;
          const d = Math.sqrt(d2) || 1e-4;
          const over = min - d;
          const nx = d2 ? dx / d : 0, ny = d2 ? dy / d : 1, nz = d2 ? dz / d : 0;
          const share = q.awake ? 0.5 : 1;
          p.x += nx * over * share; p.y += ny * over * share; p.z += nz * over * share;
          if (q.awake) { q.x -= nx * over * 0.5; q.y -= ny * over * 0.5; q.z -= nz * over * 0.5; }
          // Kill the closing speed, and rest on top as on ground.
          const vn = p.vx * nx + p.vy * ny + p.vz * nz;
          if (vn < 0) { p.vx -= vn * nx; p.vy -= vn * ny; p.vz -= vn * nz; }
          if (ny > 0.5) {
            p.grounded = true;
            const f = Math.max(0, 1 - 5 * dt);
            p.vx *= f; p.vz *= f;
          }
        }
      }
    }
    for (const p of this.pieces) {
      if (!p.awake || p.dead) continue;
      const speed = Math.hypot(p.vx, p.vy, p.vz);
      if (p.grounded && speed < SLEEP_SPEED * 4) p.still += dt; else p.still = 0;
      if (p.still >= SLEEP_AFTER) { p.awake = false; p.vx = p.vy = p.vz = 0; p.wx = p.wy = p.wz = 0; }
      this.sync(p);
    }
    if (this.pieces.some((p) => p.dead)) {
      for (let i = this.pieces.length - 1; i >= 0; i--) if (this.pieces[i].dead) this.pieces.splice(i, 1);
    }
  }

  /** True when another piece holds `p` up. */
  private supported(p: Piece, grid: Map<number, Piece[]>, key: (a: number, b: number) => number): boolean {
    const b = grid.get(key(Math.floor(p.x / CELL), Math.floor(p.z / CELL)));
    if (!b) return false;
    for (const q of b) {
      if (q === p || q.dead) continue;
      if (q.y < p.y && Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z) < (p.r + q.r) * 1.05) return true;
    }
    return false;
  }

  /** Over the cap: the oldest awake pieces on the ground sleep; if none is grounded the oldest flying one goes. */
  private cap(): void {
    let over = this.active - this.maxActive;
    if (over <= 0) return;
    for (const p of this.pieces) {
      if (over <= 0) break;
      if (p.awake && p.grounded) { p.awake = false; p.vx = p.vy = p.vz = 0; over--; }
    }
    for (const p of this.pieces) {
      if (over <= 0) break;
      if (p.awake) { p.dead = true; p.awake = false; over--; }
    }
    for (let i = this.pieces.length - 1; i >= 0; i--) if (this.pieces[i].dead && !this.pieces[i].obj) this.pieces.splice(i, 1);
  }

  private sync(p: Piece): void {
    p.obj?.position.set(p.x, p.y, p.z);
    p.obj?.rotation.set(p.rx, p.ry, p.rz);
  }
}

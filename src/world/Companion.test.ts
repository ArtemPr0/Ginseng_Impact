import { describe, expect, it } from 'vitest';
import { followSlot, followStep, type Follower, type FollowedHero } from './Companion';

const DT = 1 / 60;
const WALK = 4.5;
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Where slot `slot` lies for a hero at `h` facing `h.yaw` (the same arithmetic the follow uses). */
function slotAt(slot: number, h: { x: number; z: number; yaw: number }): { x: number; z: number } {
  const o = followSlot(slot);
  const c = Math.cos(h.yaw), s = Math.sin(h.yaw);
  return { x: h.x + o.x * c - o.z * s, z: h.z + o.x * s + o.z * c };
}

function hero(x = 0, z = 0, yaw = 0): FollowedHero {
  return { x, z, yaw, vx: 0, vz: 0 };
}

function follower(x: number, z: number): Follower {
  return { pos: { x, z }, yaw: 0, held: false, beside: false, hurry: false };
}

/** Walks the hero straight at the companion. */
function aimAt(h: FollowedHero, f: Follower, speed = WALK): void {
  const dir = { x: f.pos.x - h.x, z: f.pos.z - h.z };
  const len = Math.hypot(dir.x, dir.z);
  h.yaw = Math.atan2(dir.z, dir.x);
  h.vx = (dir.x / len) * speed;
  h.vz = (dir.z / len) * speed;
}

/** A companion standing at its slot by a hero who stands still: settled, and after one step waiting (held). */
function settled(slot: number, h: FollowedHero): Follower {
  const at = slotAt(slot, h);
  const f = follower(at.x, at.z);
  followStep(f, DT, h, followSlot(slot));
  expect(f.held).toBe(true);
  expect(f.beside).toBe(false);
  return f;
}

interface Trace { held: number; heldAway: number; beside: number; stoodAway: number; closest: number }

/** Runs `frames` steps, moving the hero by its velocity each step. Counts the frames the companion was held, held while
 * away from its slot (the regression: following held up), offered home, or stood still away from its slot; and notes
 * the closest it came to the hero. */
function run(f: Follower, slot: number, h: FollowedHero, frames: number): Trace {
  const t: Trace = { held: 0, heldAway: 0, beside: 0, stoodAway: 0, closest: Infinity };
  for (let i = 0; i < frames; i++) {
    h.x += h.vx * DT;
    h.z += h.vz * DT;
    const r = followStep(f, DT, h, followSlot(slot));
    const away = dist(f.pos, slotAt(slot, h)) > 0.6;
    if (f.held) t.held++;
    if (f.held && away) t.heldAway++;
    if (f.beside) t.beside++;
    if (!r.moving && away) t.stoodAway++;
    t.closest = Math.min(t.closest, dist(f.pos, h));
  }
  return t;
}

describe('followSlot', () => {
  it('keeps the places at your heels: 0 and 2 behind on the left, 1 ahead on the left', () => {
    expect(followSlot(0)).toEqual({ x: -2.2, z: 2 });
    expect(followSlot(1)).toEqual({ x: 2.2, z: 2 });
    expect(followSlot(2)).toEqual({ x: -2.2, z: 3.6 });
  });
});

describe('followStep — ordinary following is never held up', () => {
  it('(a) a new hire walks out from your feet to its place through your cone without stopping or offering to go home', () => {
    const h = hero();
    const f = follower(0, 0);
    const t = run(f, 1, h, 120);
    expect(t.heldAway).toBe(0);
    expect(t.stoodAway).toBe(0);
    expect(t.beside).toBe(0);
    expect(dist(f.pos, slotAt(1, h))).toBeLessThanOrEqual(0.6);
    // Only once it stands at its place (you still standing) does it wait there; and that is not "at your side".
    expect(f.held).toBe(true);
    expect(f.beside).toBe(false);
  });

  it('(b) turning round and stopping: a settled companion walks to its new place behind you, through your cone, unheld', () => {
    const h = hero();
    const f = settled(0, h);
    const start = { ...f.pos };
    // The turn: a step backward while the facing flips, then standing still.
    h.yaw = Math.PI;
    h.vx = -3; h.vz = 0;
    const turn = run(f, 0, h, 10);
    h.vx = 0;
    const rest = run(f, 0, h, 120);
    expect(turn.held + rest.heldAway).toBe(0);
    expect(turn.beside + rest.beside).toBe(0);
    expect(turn.stoodAway + rest.stoodAway).toBe(0);
    expect(dist(f.pos, slotAt(0, h))).toBeLessThanOrEqual(0.6);
    expect(dist(f.pos, start)).toBeGreaterThan(4);
    // It crossed right through your cone on the way, without a pause.
    expect(rest.closest).toBeLessThan(1.5);
  });

  it('(c) catching up after a sprint, a slot-1 companion never hitches at the 2.5 m boundary', () => {
    const h = hero();
    const f = follower(-6, 2);
    h.vx = 8;
    const sprint = run(f, 1, h, 60);
    h.vx = 0;
    const after = run(f, 1, h, 180);
    expect(sprint.held + after.heldAway).toBe(0);
    expect(sprint.beside + after.beside).toBe(0);
    expect(sprint.stoodAway + after.stoodAway).toBe(0);
    expect(after.closest).toBeLessThan(2.5);
    expect(dist(f.pos, slotAt(1, h))).toBeLessThanOrEqual(0.6);
  });

  it('backtracking on foot (no stop) never holds', () => {
    const h = hero();
    const f = follower(-2.2, 2);
    h.vx = WALK;
    const out = run(f, 0, h, 60);
    h.yaw = Math.PI;
    h.vx = -WALK;
    const back = run(f, 0, h, 60);
    h.vx = 0;
    const rest = run(f, 0, h, 120);
    expect(out.held + back.held + rest.heldAway).toBe(0);
    expect(out.beside + back.beside + rest.beside).toBe(0);
    expect(dist(f.pos, slotAt(0, h))).toBeLessThanOrEqual(0.8);
  });

  it('starting to walk lets a waiting companion go at once (slot 1 stands ahead on the left, inside your cone)', () => {
    const h = hero();
    const f = settled(1, h);
    h.vx = WALK;
    h.x += h.vx * DT;
    followStep(f, DT, h, followSlot(1));
    expect(f.held).toBe(false);
    expect(f.beside).toBe(false);
    const t = run(f, 1, h, 120);
    expect(t.held).toBe(0);
    expect(t.stoodAway).toBe(0);
    expect(dist(f.pos, slotAt(1, h))).toBeLessThanOrEqual(0.8);
  });
});

describe('followStep — walking up to a companion', () => {
  it('holds a settled companion where it stands while you walk at it; stopping there, facing it, it turns to you and may be sent home', () => {
    const h = hero();
    const f = settled(0, h);
    const start = { ...f.pos };
    aimAt(h, f);
    let steps = 0;
    while (dist(f.pos, h) > 1.8 && steps < 60) { run(f, 0, h, 1); steps++; }
    expect(steps).toBeLessThan(60);
    expect(f.held).toBe(true);
    expect(f.pos).toEqual(start);
    expect(f.beside).toBe(false); // (still walking)
    // Stopping in front of it.
    h.vx = h.vz = 0;
    const t = run(f, 0, h, 12);
    expect(t.held).toBe(12);
    expect(t.beside).toBe(12);
    expect(f.pos).toEqual(start);
    // Turned to face you.
    const toHero = Math.atan2(h.z - f.pos.z, h.x - f.pos.x);
    expect(Math.cos(f.yaw - toHero)).toBeCloseTo(1, 3);
  });

  it('a slightly crooked approach (20 degrees off) still keeps it', () => {
    const h = hero();
    const f = settled(0, h);
    const start = { ...f.pos };
    aimAt(h, f);
    const a = Math.atan2(h.vz, h.vx) + (20 / 180) * Math.PI;
    h.yaw = a;
    h.vx = Math.cos(a) * WALK;
    h.vz = Math.sin(a) * WALK;
    let steps = 0;
    while (dist(f.pos, h) > 1.8 && steps < 60) { run(f, 0, h, 1); steps++; }
    h.vx = h.vz = 0;
    run(f, 0, h, 6);
    expect(f.pos).toEqual(start);
    expect(f.beside).toBe(true);
  });

  it('a companion stood by is not offered home until you face it close up', () => {
    const h = hero();
    const f = settled(0, h); // 2.97 m behind on the left: out of reach, and behind you
    expect(f.beside).toBe(false);
    // Facing it from where you stand: still out of reach.
    h.yaw = Math.atan2(f.pos.z - h.z, f.pos.x - h.x);
    followStep(f, DT, h, followSlot(0));
    expect(f.held).toBe(true);
    expect(f.beside).toBe(false);
  });

  it('walking away again lets it go, and it falls in behind you as ever', () => {
    const h = hero();
    const f = settled(0, h);
    aimAt(h, f);
    while (dist(f.pos, h) > 1.8) run(f, 0, h, 1);
    h.vx = h.vz = 0;
    run(f, 0, h, 6);
    expect(f.beside).toBe(true);
    // Off the other way.
    h.yaw = 0;
    h.vx = WALK; h.vz = 0;
    run(f, 0, h, 1);
    expect(f.held).toBe(false);
    expect(f.beside).toBe(false);
    const t = run(f, 0, h, 120);
    expect(t.held).toBe(0);
    expect(dist(f.pos, slotAt(0, h))).toBeLessThanOrEqual(0.8);
  });

  it('walking past a waiting companion (not stopping) never offers it home; it lets go as you pass and hurries back to its place', () => {
    const h = hero();
    const f = settled(0, h);
    aimAt(h, f);
    const t = run(f, 0, h, 100); // 7.5 m: through it and on
    expect(t.beside).toBe(0);
    expect(f.held).toBe(false);
    expect(f.hurry).toBe(false);
    expect(dist(f.pos, slotAt(0, h))).toBeLessThanOrEqual(0.8);
  });
});

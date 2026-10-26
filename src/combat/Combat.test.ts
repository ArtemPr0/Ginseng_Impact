import { describe, expect, it, vi } from 'vitest';
import {
  CAST_BODIES, CastCharge, ComboTracker, Cooldown, CRIT_CHANCE, CRIT_MULT, computeDamage, cutWindow, HIT_ENERGY, HitStreak, inCone, inRadius,
  LOCK_RANGE, lockHolds, LockOn, PATCH_DROP, patchHeight, PIERCE_STOP, pickLockTarget, pierceStop, RIDE_DROP, RIDE_UP, rideBase, rollHit,
  UNLOCK_RANGE,
} from './Combat';

describe('computeDamage', () => {
  it('scales with atk and multiplier and is reduced by defence', () => {
    const base = computeDamage({ atk: 100, multiplier: 1, defense: 0 });
    expect(base).toBe(100);
    expect(computeDamage({ atk: 100, multiplier: 2.5, defense: 0 })).toBe(250);
    expect(computeDamage({ atk: 100, multiplier: 1, defense: 100 })).toBe(50);
  });

  it('applies reaction multipliers and never drops below 1', () => {
    expect(computeDamage({ atk: 100, multiplier: 1, defense: 0, reaction: 'eclipse' })).toBeGreaterThan(100);
    expect(computeDamage({ atk: 1, multiplier: 0.01, defense: 1000 })).toBe(1);
  });
});

describe('hit shapes', () => {
  const o = { x: 0, z: 0 };
  it('inCone respects range and half angle around the facing yaw', () => {
    // yaw 0 faces +x
    expect(inCone(o, 0, { x: 3, z: 0.5 }, 4, Math.PI / 4)).toBe(true);
    expect(inCone(o, 0, { x: 5, z: 0 }, 4, Math.PI / 4)).toBe(false);
    expect(inCone(o, 0, { x: 1, z: 3 }, 4, Math.PI / 4)).toBe(false);
    expect(inCone(o, Math.PI / 2, { x: 0, z: 3 }, 4, Math.PI / 4)).toBe(true);
  });
  it('inRadius is inclusive', () => {
    expect(inRadius(o, { x: 3, z: 4 }, 5)).toBe(true);
    expect(inRadius(o, { x: 3, z: 4.1 }, 5)).toBe(false);
  });
});

describe('Cooldown', () => {
  it('is ready at start, then counts down', () => {
    const c = new Cooldown(2);
    expect(c.ready).toBe(true);
    c.use();
    expect(c.ready).toBe(false);
    expect(c.fraction).toBeCloseTo(1);
    c.update(1);
    expect(c.fraction).toBeCloseTo(0.5);
    c.update(1.1);
    expect(c.ready).toBe(true);
    expect(c.fraction).toBe(0);
  });
});

describe('ComboTracker', () => {
  const durations = [0.4, 0.4, 0.6];
  const fractions = [0.4, 0.4, 0.4];

  it('starts hit 0 on press and reports the hit frame once', () => {
    const c = new ComboTracker(durations, fractions);
    expect(c.press()).toBe(0);
    expect(c.swinging).toBe(true);
    const fired: number[] = [];
    for (let t = 0; t < 0.5; t += 1 / 60) {
      const h = c.update(1 / 60);
      if (h !== null) fired.push(h);
    }
    expect(fired).toEqual([0]);
    expect(c.swinging).toBe(false);
  });

  it('chains to the next hit when pressed late in a swing, and resets after a gap', () => {
    const c = new ComboTracker(durations, fractions);
    c.press();
    for (let i = 0; i < 20; i++) c.update(1 / 60); // 0.33 s into a 0.4 s swing
    expect(c.press()).toBeNull(); // buffered
    for (let i = 0; i < 6; i++) c.update(1 / 60);
    expect(c.currentHit).toBe(1);
    expect(c.swinging).toBe(true);
    for (let i = 0; i < 120; i++) c.update(1 / 60);
    expect(c.swinging).toBe(false);
    expect(c.press()).toBe(0); // combo reset after idle
  });

  it('ignores presses early in a swing', () => {
    const c = new ComboTracker(durations, fractions);
    c.press();
    c.update(1 / 60);
    expect(c.press()).toBeNull();
    for (let i = 0; i < 30; i++) c.update(1 / 60);
    expect(c.currentHit).toBe(0);
    expect(c.swinging).toBe(false);
  });

  it('lands each hit at its own fraction of its own swing (the clip blow)', () => {
    // Hit 0 strikes early (0.25 of 0.6 s = 0.15 s), hit 1 late (0.75 of 0.5 s = 0.375 s), hit 2 in the middle.
    const c = new ComboTracker([0.6, 0.5, 0.8], [0.25, 0.75, 0.5]);
    const dt = 1 / 120;
    const landed: Array<{ hit: number; t: number }> = [];
    let t = 0;
    const run = (seconds: number) => {
      for (let i = 0; i < Math.round(seconds / dt); i++) {
        t += dt;
        const h = c.update(dt);
        if (h !== null) landed.push({ hit: h, t: +(t - 0).toFixed(3) });
      }
    };
    c.press();
    expect(c.hitFraction).toBe(0.25);
    run(0.5); // deep enough into the swing to buffer
    c.press();
    run(0.12); // the swing ends at 0.6 s, hit 1 starts
    expect(c.currentHit).toBe(1);
    expect(c.hitFraction).toBe(0.75);
    run(0.45);
    c.press();
    run(0.06); // hit 1 ends at 1.1 s, hit 2 starts
    expect(c.currentHit).toBe(2);
    run(0.8);
    expect(landed.map((l) => l.hit)).toEqual([0, 1, 2]);
    expect(landed[0].t).toBeCloseTo(0.15, 1);
    expect(landed[1].t).toBeCloseTo(0.6 + 0.375, 1);
    expect(landed[2].t).toBeCloseTo(0.6 + 0.5 + 0.4, 1);
  });

  it('falls back to the last fraction when a hit has none', () => {
    const c = new ComboTracker([0.4, 0.4, 0.6], [0.3]);
    c.press();
    expect(c.hitFraction).toBe(0.3);
    c.currentHit = 2;
    expect(c.hitFraction).toBe(0.3);
  });
});

describe('crits', () => {
  const hit = { atk: 100, multiplier: 1, defense: 0 };

  it('rolls against the chance with the injected rnd: a crit lands ×CRIT_MULT, a miss lands plain', () => {
    expect(CRIT_CHANCE).toBe(0.1);
    expect(rollHit(hit, CRIT_CHANCE, () => 0.05)).toEqual({ amount: 160, crit: true });
    expect(rollHit(hit, CRIT_CHANCE, () => 0.1)).toEqual({ amount: 100, crit: false }); // strictly under the chance
    expect(rollHit(hit, CRIT_CHANCE, () => 0.99)).toEqual({ amount: 100, crit: false });
    expect(CRIT_MULT).toBe(1.6);
  });

  it('adds the charm and affix bonus to the base chance, clamped to a sure crit', () => {
    expect(rollHit(hit, CRIT_CHANCE + 0.05, () => 0.12).crit).toBe(true);
    expect(rollHit(hit, CRIT_CHANCE + 0.05, () => 0.16).crit).toBe(false);
    expect(rollHit(hit, 7, () => 0.999).crit).toBe(true);
  });

  it('never draws for a hit that cannot crit (zones, companions), whatever the rnd says', () => {
    const rnd = vi.fn(() => 0);
    expect(rollHit(hit, 0, rnd)).toEqual({ amount: 100, crit: false });
    expect(rnd).not.toHaveBeenCalled();
  });

  it('stacks on the reaction multiplier and rounds once, at the end', () => {
    const plain = computeDamage({ ...hit, reaction: 'eclipse' });
    const crit = rollHit({ ...hit, reaction: 'eclipse' }, 1, () => 0);
    expect(crit.crit).toBe(true);
    expect(crit.amount).toBe(Math.round(100 * 2.2 * 1.6));
    expect(crit.amount).toBeGreaterThan(plain);
    // Defence still applies to the crit: 100 × 1.6 × 100/200.
    expect(rollHit({ ...hit, defense: 100 }, 1, () => 0).amount).toBe(80);
  });
});

describe('HitStreak', () => {
  it('counts hits that come within its window of the last, and drops to 0 after a pause', () => {
    const s = new HitStreak(1.2);
    expect(s.count).toBe(0);
    expect(s.hit()).toBe(1);
    s.update(1.0);
    expect(s.hit()).toBe(2); // 1.0 s after the first: still in
    s.update(1.1);
    expect(s.hit()).toBe(3); // the window restarts on every hit
    s.update(1.19);
    expect(s.count).toBe(3);
    s.update(0.02);
    expect(s.count).toBe(0);
    expect(s.hit()).toBe(1);
  });
});

describe('cutWindow', () => {
  it('maps a measured window in seconds of the source clip into the cut, clamped to 0..1', () => {
    // Right_Hand_Sword_Slash cut 0.2..0.95 s; the blade cuts 0.39..0.78 s.
    const [a, b] = cutWindow(0.2, 0.95, 0.43, [0.39, 0.78]);
    expect(a).toBeCloseTo(0.19 / 0.75);
    expect(b).toBeCloseTo(0.58 / 0.75);
    expect(cutWindow(0.5, 1, 0.5, [0.2, 1.4])).toEqual([0, 1]);
  });

  it('without a measured window, spans `around` either side of the strike', () => {
    const [a, b] = cutWindow(0, 0.4, 0.4, null);
    expect(a).toBeCloseTo(0.18);
    expect(b).toBeCloseTo(0.62);
    expect(cutWindow(0, 1, 0.1, undefined, 0.3)).toEqual([0, 0.4]);
  });
});

describe('pierceStop', () => {
  it('freezes the fight on the first body a crescent cuts and only catches on each after', () => {
    expect(pierceStop(0.1, 1)).toBe(0.1);
    expect(PIERCE_STOP).toBe(0.3);
    expect(pierceStop(0.1, 2)).toBeCloseTo(0.03, 9);
    expect(pierceStop(0.1, 6)).toBeCloseTo(0.03, 9);
    // Three skeletons in its path: 0.16 s of freeze in all, where a full stop on each was 0.3 s.
    expect([1, 2, 3].reduce((t, n) => t + pierceStop(0.1, n), 0)).toBeCloseTo(0.16, 9);
  });

  it('leaves a shot that does not pierce (nth 0) its full stop, and cuts a reaction past the first body like a blow', () => {
    expect(pierceStop(0.06, 0)).toBe(0.06);
    // A reaction's 0.1 on the first body the crescent cuts stands; on the third it only catches the fight too.
    expect(pierceStop(0.1, 1)).toBe(0.1);
    expect(pierceStop(0.1, 3)).toBeCloseTo(0.03, 9);
  });
});

describe('CastCharge', () => {
  it('charges the burst once for each body a many-shot cast strikes, CAST_BODIES at most: the single chaining bolt it was', () => {
    expect(HIT_ENERGY).toBe(6);
    expect(CAST_BODIES).toBe(3);
    // Moon Volley into three mobs: six arrows, each striking its mark and chaining on to another (twelve hits, 72 at a
    // blow's worth each); the chaining bolt it was struck the three once each.
    const volley = new CastCharge();
    const hits = [1, 2, 2, 3, 3, 1, 1, 2, 2, 3, 3, 1];
    expect(hits.reduce((sum, id) => sum + volley.take(id), 0)).toBe(3 * HIT_ENERGY);
  });

  it('charges a lone body once however many shots land on it, and nothing for bodies past the cap', () => {
    const one = new CastCharge();
    expect([7, 7, 7, 7, 7, 7].map((id) => one.take(id))).toEqual([6, 0, 0, 0, 0, 0]);
    // Starfall's four stars, each bursting over the same five mobs huddled together.
    const stars = new CastCharge();
    const struck = [1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5, 1, 2, 3, 4, 5];
    expect(struck.map((id) => stars.take(id)).slice(0, 5)).toEqual([6, 6, 6, 0, 0]);
    // Each cast charges afresh.
    expect(new CastCharge().take(1)).toBe(6);
  });
});

describe('the crescent riding the ground', () => {
  /**
   * Crimson Cleave's crescent, flown the way CombatSystem's projectile loop flies it: 14 m/s along +x from x = 0 for 9 m,
   * 60 steps a second, riding 0.2 m over `ground(x)` (rideBase; a break ends the run); a patch every 2 m of the run from
   * 1 m out, and one where it ends unless one lies within a metre behind, each where patchHeight puts it. Returns the
   * patches laid, as [x, y], and where the run ended.
   */
  function cleave(ground: (x: number) => number): { patches: Array<[number, number]>; end: number } {
    const ride = 0.2;
    const speed = 14;
    const every = 2;
    const dt = 1 / 60;
    let x = 0;
    let y = ground(0) + ride;
    let life = 9 / speed;
    let next = every / 2;
    const patches: Array<[number, number]> = [];
    const lay = () => {
      const at = patchHeight(y - ride, ground(x));
      if (at !== null) patches.push([x, at]);
    };
    for (;;) {
      life -= dt;
      x += speed * dt;
      const to = rideBase(y - ride, ground(x));
      if (to !== null) y = to + ride;
      while (x >= next) { lay(); next += every; }
      if (to === null || life <= 0) {
        if (x - (next - every) > every * 0.5) lay();
        return { patches, end: x };
      }
    }
  }

  it('lays no patch in the air off a 3 m ledge: it sails across, its burning ground stays on the ground up top', () => {
    const ledge = (x: number) => (x < 4 ? 10 : 7);
    const { patches, end } = cleave(ledge);
    expect(end).toBeGreaterThanOrEqual(9);
    // (At its own height, 10, the three over the drop would hang 3 m over the ground at 7.)
    expect(patches).toHaveLength(2);
    for (const [x, y] of patches) {
      expect(x).toBeLessThan(4);
      expect(y).toBeCloseTo(10, 9);
    }
  });

  it('rides down a 2 m step and lays its patches on the ground below it', () => {
    const step = (x: number) => (x < 4 ? 10 : 8);
    const { patches } = cleave(step);
    expect(patches).toHaveLength(5);
    for (const [x, y] of patches) expect(y).toBeCloseTo(step(x), 9);
  });

  it('follows a slope down, every patch on it', () => {
    const slope = (x: number) => 5 - x * 0.4;
    const { patches } = cleave(slope);
    expect(patches).toHaveLength(5);
    for (const [x, y] of patches) expect(y).toBeCloseTo(slope(x), 9);
  });

  it('breaks on a step higher than RIDE_UP, its last patch at the foot of it', () => {
    const wall = (x: number) => (x < 4 ? 10 : 11.5);
    const { patches, end } = cleave(wall);
    expect(end).toBeGreaterThanOrEqual(4);
    expect(end).toBeLessThan(4 + 14 / 60 + 1e-9);
    expect(patches).toHaveLength(3);
    expect(patches[2][0]).toBe(end);
    for (const [, y] of patches) expect(y).toBeCloseTo(10, 9);
  });

  it('rideBase follows the ground RIDE_UP up and RIDE_DROP down, breaks above, holds over a deeper drop', () => {
    expect(RIDE_UP).toBe(1.2);
    expect(RIDE_DROP).toBe(2.5);
    expect(rideBase(10, 11.1)).toBe(11.1);
    expect(rideBase(10, 11.3)).toBeNull();
    expect(rideBase(10, 7.6)).toBe(7.6);
    expect(rideBase(10, 7)).toBe(10);
  });

  it('patchHeight lays on the ground under it, none over ground more than PATCH_DROP below, at the foot of a rise', () => {
    expect(PATCH_DROP).toBe(0.5);
    expect(patchHeight(10, 10)).toBe(10);
    expect(patchHeight(10, 9.6)).toBe(9.6);
    expect(patchHeight(10, 9.4)).toBeNull();
    expect(patchHeight(10, 11.5)).toBe(10);
  });
});

describe('lock-on', () => {
  /** A body at (x, z): standing and drawn unless told otherwise. */
  const body = (x: number, z: number, o: { alive?: boolean; visible?: boolean } = {}) => ({ alive: o.alive ?? true, pos: { x, z }, object: { visible: o.visible ?? true } });
  const hero = { x: 0, z: 0 };
  /** The camera looking toward -z (ThirdPersonCamera.forward at yaw 0). */
  const ahead = { x: 0, z: -1 };

  it('picks the nearest in front of the camera over nearer ones behind and beside the hero', () => {
    const behind = body(0, 3);
    const beside = body(5, 0);
    const near = body(2, -9);
    const far = body(0, -18);
    expect(pickLockTarget(hero, ahead, [behind, beside, far, near])).toBe(near);
  });

  it('falls back to the nearest of all when nobody stands in front', () => {
    const behind = body(1, 9);
    const beside = body(-6, 1);
    expect(pickLockTarget(hero, ahead, [behind, beside])).toBe(beside);
  });

  it('counts 60 degrees either side of the look as in front, and a body at the feet', () => {
    const at = (deg: number, r: number) => body(Math.sin((deg * Math.PI) / 180) * r, -Math.cos((deg * Math.PI) / 180) * r);
    const inside = at(58, 12);
    const outside = at(62, 6);
    expect(pickLockTarget(hero, ahead, [outside, inside])).toBe(inside);
    const feet = body(0.3, 0.2);
    expect(pickLockTarget(hero, ahead, [inside, feet])).toBe(feet);
  });

  it('skips the fallen, the hidden and anything past LOCK_RANGE', () => {
    expect(LOCK_RANGE).toBe(30);
    const dead = body(0, -4, { alive: false });
    const hidden = body(0, -5, { visible: false });
    const tooFar = body(0, -(LOCK_RANGE + 0.5));
    expect(pickLockTarget(hero, ahead, [dead, hidden, tooFar])).toBeNull();
    const inReach = body(0, -(LOCK_RANGE - 0.5));
    expect(pickLockTarget(hero, ahead, [dead, hidden, tooFar, inReach])).toBe(inReach);
  });

  it('Tab locks on, Tab again lets go, and a third Tab picks afresh', () => {
    const lock = new LockOn<ReturnType<typeof body>>();
    const a = body(0, -8);
    const b = body(4, -6);
    expect(lock.toggle(hero, ahead, [a, b])).toBe(b);
    expect(lock.target).toBe(b);
    expect(lock.toggle(hero, ahead, [a, b])).toBeNull();
    expect(lock.target).toBeNull();
    b.alive = false;
    expect(lock.toggle(hero, ahead, [a, b])).toBe(a);
  });

  it('holds to UNLOCK_RANGE and lets go past it, or when the target falls', () => {
    expect(UNLOCK_RANGE).toBe(40);
    const t = body(0, -10);
    const lock = new LockOn<ReturnType<typeof body>>();
    lock.toggle(hero, ahead, [t]);
    t.pos.z = -UNLOCK_RANGE;
    lock.update(hero);
    expect(lock.target).toBe(t);
    expect(lockHolds(t, hero)).toBe(true);
    t.pos.z = -(UNLOCK_RANGE + 0.1);
    expect(lockHolds(t, hero)).toBe(false);
    lock.update(hero);
    expect(lock.target).toBeNull();
    // (The hero walking off counts the same as the target running.)
    const u = body(0, -10);
    lock.toggle(hero, ahead, [u]);
    lock.update({ x: 0, z: 31 });
    expect(lock.target).toBeNull();
    const v = body(0, -10);
    lock.toggle(hero, ahead, [v]);
    v.alive = false;
    lock.update(hero);
    expect(lock.target).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { Noise2D, smoothstep } from './noise';
import { KNOLL, LAYOUT, PADS } from '../data/world';
import { EYE, RIVER_LEVEL, Terrain, WORLD, flatMask, knollAt, rimLip, riverAt, streamCentre, terrainHeight } from './Terrain';

describe('Noise2D', () => {
  it('is deterministic for a seed and bounded in [-1, 1]', () => {
    const a = new Noise2D(7);
    const b = new Noise2D(7);
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 2000; i++) {
      const x = (i * 0.37) % 50;
      const y = (i * 0.91) % 50;
      const v = a.noise(x, y);
      expect(v).toBe(b.noise(x, y));
      min = Math.min(min, v);
      max = Math.max(max, v);
    }
    expect(min).toBeGreaterThanOrEqual(-1);
    expect(max).toBeLessThanOrEqual(1);
    expect(max - min).toBeGreaterThan(0.5);
  });

  it('smoothstep clamps and eases', () => {
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
    expect(smoothstep(0, 1, 0.5)).toBeCloseTo(0.5);
    expect(smoothstep(10, 0, 5)).toBeCloseTo(0.5); // reversed edges work too
  });
});

describe('terrainHeight', () => {
  const noise = new Noise2D(1337);

  it('is a walkable plateau near the spawn and the far end of the causeway line', () => {
    for (const z of [70, 40, 0, -30, -90, -120]) {
      const h = terrainHeight(0, z, noise);
      expect(h).toBeGreaterThan(-6);
      expect(h).toBeLessThan(14);
    }
  });

  it('fades the causeway corridor out past its ends instead of leaving a ledge', () => {
    // (Behind the spawn and behind the causeway's north stairs, where it once stopped in 2.5 m and 3.6 m steps.)
    for (const x of [0, 4]) {
      for (const [from, to] of [[WORLD.corridorZ.max - 8, WORLD.corridorZ.max + 11], [WORLD.corridorZ.min - 12, WORLD.corridorZ.min + 6]]) {
        for (let z = from; z < to; z += 0.5) {
          expect(Math.abs(terrainHeight(x, z + 0.5, noise) - terrainHeight(x, z, noise))).toBeLessThan(0.5);
        }
      }
    }
  });

  it('drops into the abyss well outside the island', () => {
    for (const [x, z] of [[170, 0], [-170, -36], [0, 150], [0, -200]] as const) {
      expect(terrainHeight(x, z, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
    }
  });

  it('has a chasm across the island on the causeway line', () => {
    expect(terrainHeight(0, WORLD.chasmCentreZ, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
    expect(terrainHeight(24, WORLD.chasmCentreZ, noise)).toBeLessThan(WORLD.cloudSeaY - 20);
  });

  it('opens the eye pool under water where the road crosses the river, with dry banks at both bridge ends', () => {
    expect(terrainHeight(EYE.x, EYE.z, noise)).toBeLessThan(RIVER_LEVEL - 2);
    expect(riverAt(EYE.x, EYE.z)).toBe(1);
    for (const z of [EYE.z - EYE.b - 4, EYE.z + EYE.b + 4]) expect(terrainHeight(0, z, noise)).toBeGreaterThan(RIVER_LEVEL + 1);
  });

  it('cuts the forest gorge deep below its rims', () => {
    const G = WORLD.gorge;
    const floor = terrainHeight(G.x, -124, noise);
    expect(terrainHeight(G.x - G.rim - 2, -124, noise) - floor).toBeGreaterThan(8);
  });

  it('steps the koi pools down toward the eye, each basin under its own water', () => {
    const levels = LAYOUT.tiers.map((t) => t.water);
    expect(levels[0]).toBeLessThan(levels[1]);
    expect(levels[1]).toBeLessThan(levels[2]);
    for (const t of LAYOUT.tiers) expect(terrainHeight(t.x, t.z, noise)).toBeLessThan(t.water);
  });
});

describe('island relief', () => {
  const noise = new Noise2D(1337);
  const H = (x: number, z: number) => terrainHeight(x, z, noise);
  /** The bare sculpt: no hills, no knoll, no lip. */
  const B = (x: number, z: number) => terrainHeight(x, z, noise, false);
  const MAX_GRADIENT = 0.35;

  it('keeps every footpath walkable: |dh/ds| <= 0.35 at 1 m steps, bar the knoll risers and the sculpt\'s own cliffs', () => {
    // The bare sculpt already exceeds 0.35 in a few places by design (the ford to Old Moss's bank, the pond's shore,
    // the chasm lip at the rope bridge, the climb onto the peak, the gorge's west rim, the corridor's edge by the
    // spawn): there the relief may add no more than 0.35. The two 0.45 m risers of the hamlet knoll are steps (the
    // controller walks up to 0.5 m), so a stride over one may rise 0.45 m more.
    const bad: string[] = [];
    for (const line of LAYOUT.paths) {
      for (let i = 0; i < line.length - 1; i++) {
        const [ax, az] = line[i];
        const [bx, bz] = line[i + 1];
        const len = Math.hypot(bx - ax, bz - az);
        const n = Math.max(1, Math.ceil(len));
        const ds = len / n;
        let prev = H(ax, az);
        let prevBare = B(ax, az);
        for (let k = 1; k <= n; k++) {
          const x = ax + ((bx - ax) * k) / n;
          const z = az + ((bz - az) * k) / n;
          const h = H(x, z);
          const bare = B(x, z);
          const g = Math.abs(h - prev) / ds;
          const gBare = Math.abs(bare - prevBare) / ds;
          const mx = x - ((bx - ax) * 0.5) / n;
          const mz = z - ((bz - az) * 0.5) / n;
          const s = Math.hypot(mx - KNOLL.landing.x, mz - KNOLL.landing.z);
          const onRiser = KNOLL.risers.some((at) => Math.abs(s - at) < 0.5 + KNOLL.riserRun);
          const limit = Math.max(MAX_GRADIENT + (onRiser ? KNOLL.riser : 0), gBare > MAX_GRADIENT ? gBare + MAX_GRADIENT : 0);
          if (g > limit) bad.push(`(${x.toFixed(1)}, ${z.toFixed(1)}) gradient ${g.toFixed(2)} (bare ${gBare.toFixed(2)})`);
          prev = h;
          prevBare = bare;
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it('holds every level pad at its own height', () => {
    for (const p of PADS) expect(Math.abs(H(p.x, p.z) - p.y), `pad at (${p.x}, ${p.z})`).toBeLessThanOrEqual(0.05);
  });

  it('rolls the open ground and leaves the pads, the paths, the water and the causeway line as the bare sculpt', () => {
    // Open ground moves (hills of a few metres), and plenty of it.
    let open = 0;
    let moved = 0;
    for (let z = -150; z <= 100; z += 4) {
      for (let x = -130; x <= 130; x += 4) {
        if (B(x, z) < 0) continue;
        if (flatMask(x, z, noise) < 0.5) {
          open++;
          if (Math.abs(H(x, z) - B(x, z)) > 0.5) moved++;
        }
      }
    }
    expect(open).toBeGreaterThan(150);
    expect(moved / open).toBeGreaterThan(0.6);
    // Pads, path centre lines away from the knoll, the river's and the stream's beds and the spawn stay put.
    for (const p of PADS) expect(H(p.x, p.z)).toBeCloseTo(B(p.x, p.z), 6);
    for (const line of LAYOUT.paths) for (const [x, z] of line) if (Math.hypot(x - KNOLL.x, z - KNOLL.z) > KNOLL.r + KNOLL.blend) expect(H(x, z), `path point (${x}, ${z})`).toBeCloseTo(B(x, z), 6);
    expect(H(EYE.x, EYE.z)).toBeCloseTo(B(EYE.x, EYE.z), 6);
    expect(H(50, 4)).toBeCloseTo(B(50, 4), 6);
    expect(H(streamCentre(0, noise), 0)).toBeCloseTo(B(streamCentre(0, noise), 0), 6);
    expect(H(LAYOUT.spawn.x, LAYOUT.spawn.z)).toBeCloseTo(B(LAYOUT.spawn.x, LAYOUT.spawn.z), 6);
  });

  it('raises the hamlet knoll behind a level bridge landing, in two risers no house or torch stands on', () => {
    // The eye bridge takes the higher of its two banks for both ends: they must stay level with each other.
    expect(Math.abs(H(0, EYE.z - EYE.b - 4) - H(0, EYE.z + EYE.b + 4))).toBeLessThan(0.3);
    // From the landing up the terrace: the full rise, two sharp steps of about 0.45 m, nothing steeper than a step.
    expect(H(0, -14) - H(0, -3)).toBeCloseTo(KNOLL.rise, 0);
    let steps = 0;
    let onStep = false;
    for (let z = -3; z >= -14; z -= 0.1) {
      const g = (H(0, z - 0.1) - H(0, z)) / 0.1;
      // Never back down on the way up (the corridor's own 0.07/m dip north of the terrace is the base sculpt's).
      expect(g).toBeGreaterThan(-0.15);
      // Over a stride (the controller's own 1 m central difference) a riser is a slope well under its 1.2 climb limit.
      expect((H(0, z - 0.55) - H(0, z + 0.45)) / 1).toBeLessThan(1.0);
      if (g > 0.5 && !onStep) steps++;
      onStep = g > 0.5;
    }
    expect(steps).toBe(KNOLL.risers.length);
    // The hamlet's houses and torches stand clear of the risers' ramps.
    const spots: Array<readonly [number, number]> = [...LAYOUT.hamlet.map(([x, z]) => [x, z] as const), [-3, -3.5], [3, -3.5], [12, -11], [-14, -3]];
    for (const [x, z] of spots) {
      const s = Math.hypot(x - KNOLL.landing.x, z - KNOLL.landing.z);
      for (const at of KNOLL.risers) expect(Math.abs(s - at), `(${x}, ${z}) against the riser at ${at} m`).toBeGreaterThan(KNOLL.riserRun + 0.2);
      // Each stands on the knoll (full rise) or on the bank below it (none mid-face), except the west house's own pad.
      const k = knollAt(x, z) / KNOLL.rise;
      if (x !== -8) expect(k < 0.15 || k > 0.85, `(${x}, ${z}) knoll ${k.toFixed(2)}`).toBe(true);
    }
  });

  it('lifts a rock lip along the rim and nothing past the cliff', () => {
    expect(rimLip(100)).toBe(0);
    expect(rimLip(110)).toBe(0);
    expect(rimLip(119)).toBeCloseTo(1.2, 6);
    expect(rimLip(124)).toBe(0);
    expect(rimLip(140)).toBe(0);
  });
});

describe('Terrain', () => {
  const terrain = new Terrain();
  const noise = new Noise2D(1337);

  it('bakes the sculpt: exact at the vertices, the drawn triangle between them, the analytic sculpt beyond the square', () => {
    expect(terrain.heightAt(0, 59)).toBeCloseTo(terrainHeight(0, 59, noise), 5);
    expect(terrain.heightAt(-94, -12)).toBeCloseTo(4.4, 5);
    // Between vertices: on the plane of the triangle, so within the span of its corners.
    const corners = [terrainHeight(10, 40, noise), terrainHeight(11, 40, noise), terrainHeight(10, 41, noise), terrainHeight(11, 41, noise)];
    const h = terrain.heightAt(10.3, 40.4);
    expect(h).toBeGreaterThanOrEqual(Math.min(...corners) - 1e-6);
    expect(h).toBeLessThanOrEqual(Math.max(...corners) + 1e-6);
    expect(terrain.heightAt(1000, 0)).toBe(terrainHeight(1000, 0, noise));
    expect(terrain.heightAt(1000, 0)).toBe(WORLD.abyssY);
    expect(terrain.slopeAt(0, 59)).toBeGreaterThanOrEqual(0);
    expect(terrain.slopeAt(0, 59)).toBeLessThan(0.2);
    expect(terrain.slopeAtCached(0, 59)).toBe(terrain.slopeAt(0, 59));
    expect(terrain.streamCentre(0)).toBeCloseTo(streamCentre(0, noise), 9);
  });

  it('draws the island as chunk meshes under one material, skipping the abyss, and answers `mesh` with the same group', () => {
    const group = terrain.group;
    expect(terrain.mesh).toBe(group);
    expect(group.name).toBe('ground');
    // 12 × 12 chunks of 32 m over 360 m (the last row and column 8 m wide); the all-abyss corners are never built.
    expect(group.children.length).toBeGreaterThan(60);
    expect(group.children.length).toBeLessThan(144);
    const materials = new Set(group.children.map((c) => (c as unknown as { material: unknown }).material));
    expect(materials.size).toBe(1);
    expect(group.children.every((c) => (c as { receiveShadow: boolean }).receiveShadow)).toBe(true);
    terrain.update({ x: 0, y: 0, z: 59 } as Parameters<Terrain['update']>[0]);
  });
});

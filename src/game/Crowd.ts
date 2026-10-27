/**
 * Where a crowd stands: spots on a grid inside a list of areas (filled in order: the front first), each facing what
 * its area looks at, at least `spacing` apart, on ground the caller says is clear (flat floor, nothing standing there).
 * Pure: the caller hands in the test.
 */
export interface CrowdArea {
  /** [minX, maxX, minZ, maxZ]. */
  rect: readonly [number, number, number, number];
  /** What everyone in this area faces. */
  look: { x: number; z: number };
  /** Nobody closer to `look` than this (the stage's own room). */
  keep?: number;
}

export interface CrowdSpot { x: number; z: number; yaw: number; area: number }

/**
 * Up to `n` spots, nearest to each area's `look` first, `spacing` metres apart (and as far from every `taken` point),
 * on a grid of `step`, jittered a little by `seed` so the rows do not read as a parade ground.
 */
export function crowdSpots(
  areas: readonly CrowdArea[],
  n: number,
  clear: (x: number, z: number) => boolean,
  opts: { spacing?: number; step?: number; taken?: ReadonlyArray<{ x: number; z: number }>; seed?: number } = {},
): CrowdSpot[] {
  const spacing = opts.spacing ?? 1.3;
  const step = opts.step ?? 0.7;
  let s = (opts.seed ?? 7) >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const out: CrowdSpot[] = [];
  const taken = [...(opts.taken ?? [])];
  for (let a = 0; a < areas.length && out.length < n; a++) {
    const { rect, look, keep = 0 } = areas[a];
    const cand: Array<{ x: number; z: number; d: number }> = [];
    for (let x = rect[0]; x <= rect[1] + 1e-6; x += step) {
      for (let z = rect[2]; z <= rect[3] + 1e-6; z += step) {
        const jx = x + (rnd() - 0.5) * step * 0.5;
        const jz = z + (rnd() - 0.5) * step * 0.5;
        const d = Math.hypot(jx - look.x, jz - look.z);
        if (d < keep) continue;
        cand.push({ x: jx, z: jz, d });
      }
    }
    cand.sort((p, q) => p.d - q.d);
    for (const c of cand) {
      if (out.length >= n) break;
      if (taken.some((t) => Math.hypot(t.x - c.x, t.z - c.z) < spacing)) continue;
      if (!clear(c.x, c.z)) continue;
      taken.push(c);
      // Facing the look point, a little off now and then (heads turned to a friend).
      const yaw = Math.atan2(look.z - c.z, look.x - c.x) + (rnd() - 0.5) * 0.35;
      out.push({ x: c.x, z: c.z, yaw, area: a });
    }
  }
  return out;
}

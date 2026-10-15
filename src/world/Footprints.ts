/**
 * Hand-placed spots that do not come from a model's own collider. Building colliders are baked from the models
 * themselves (scripts/collider-grids.mjs → Colliders.gridFootprint), so nothing here describes a building's shape.
 */

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** The rainy orchard's 6 × 6 rows of trees (DdKl7fKMO75), jittered, around (cx, cz). */
export function orchardSpots(cx: number, cz: number): Array<[number, number]> {
  const rnd = rng(123);
  const out: Array<[number, number]> = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const x = cx - 17.5 + i * 7 + (rnd() - 0.5) * 2;
      const z = cz - 17.5 + j * 7 + (rnd() - 0.5) * 2;
      out.push([x, z]);
      for (let k = 0; k < 14 * 2 + 2; k++) rnd(); // keep the old trunk positions
    }
  }
  return out;
}

/**
 * The frog's dream east of the middle: a grove of mushrooms round the eye pool where the canal village stood (the
 * playtest of 2026-11-12: "remove the houses and bridges, mushrooms instead, different kinds, some you bounce on from
 * mushroom to mushroom"). Positions are relative to the eye's middle. Only the three mushroom models there are
 * (giant-mushroom, purple-mushroom, the small glowing cluster), at many sizes and in the dream's colours.
 */

/** The eye pool's half-widths (Dream.ts eyePool(…, 22, 15)). */
export const EYE = { rx: 22, rz: 15 } as const;
/** Upward speed a bouncy cap throws you at (the island's road mushrooms: 16). */
export const BOUNCE_V = 16;

export type ShroomKind = 'giant-mushroom' | 'purple-mushroom' | 'mushroom';
export interface Shroom { dx: number; dz: number; kind: ShroomKind; scale: number; tint: number; bouncy: boolean; top: number; r: number; yaw: number }

/** Registry heights (data/models), and each model's cap: its top and its radius as fractions of its height. */
const MODEL: Record<ShroomKind, { h: number; top: number; r: number }> = {
  'giant-mushroom': { h: 5, top: 0.92, r: 0.42 },
  'purple-mushroom': { h: 2.2, top: 0.9, r: 0.86 * 0.75 },
  mushroom: { h: 0.7, top: 0.8, r: 0.6 },
};
/** How many dream colours a mushroom can take (Dream.ts SHROOM_TINTS). */
export const TINTS = 6;

function shroom(kind: ShroomKind, dx: number, dz: number, scale: number, tint: number, bouncy: boolean, yaw: number): Shroom {
  const m = MODEL[kind];
  return { dx, dz, kind, scale, tint, bouncy, top: m.h * scale * m.top, r: m.h * scale * m.r, yaw };
}

export function dreamGrove(rnd: () => number): { chain: Shroom[]; scatter: Shroom[] } {
  // The bounce chain: a low purple cap you can jump onto, then giant caps climbing round the pool and down again.
  const sizes: Array<[ShroomKind, number]> = [['purple-mushroom', 0.6], ...[0.45, 0.6, 0.75, 0.9, 1.05, 1.2, 1.35, 1.5, 1.2, 0.9, 0.6].map((s): [ShroomKind, number] => ['giant-mushroom', s])];
  const chain: Shroom[] = [];
  let a = Math.PI * 0.62;
  const R = 29;
  for (const [i, [kind, s]] of sizes.entries()) {
    const next = shroom(kind, 0, 0, s, i % TINTS, true, rnd() * 6);
    if (chain.length) {
      const prev = chain[chain.length - 1];
      const d = Math.min(6.4, Math.max(3.5, prev.r + next.r + 1.0));
      a += d / R;
    }
    next.dx = Math.cos(a) * R;
    next.dz = Math.sin(a) * R;
    chain.push(next);
  }
  // Round them, every kind at every size and colour, none in the pool or in one another.
  const scatter: Shroom[] = [];
  const kinds: ShroomKind[] = ['giant-mushroom', 'purple-mushroom', 'mushroom', 'mushroom', 'purple-mushroom'];
  for (let tries = 0; tries < 3000 && scatter.length < 48; tries++) {
    const ang = rnd() * Math.PI * 2, dist = 22 + rnd() * 30;
    const dx = Math.cos(ang) * dist, dz = Math.sin(ang) * dist * 0.85;
    if ((dx / EYE.rx) ** 2 + (dz / EYE.rz) ** 2 < 1.3) continue;
    const kind = kinds[Math.floor(rnd() * kinds.length)];
    const scale = kind === 'giant-mushroom' ? 0.3 + rnd() * 0.6 : kind === 'purple-mushroom' ? 0.3 + rnd() * 1.1 : 1.4 + rnd() * 2.2;
    const m = shroom(kind, dx, dz, scale, Math.floor(rnd() * TINTS), false, rnd() * 6);
    if ([...chain, ...scatter].some((o) => Math.hypot(o.dx - dx, o.dz - dz) < o.r + m.r + 0.4)) continue;
    // The bigger giants throw you too.
    m.bouncy = kind === 'giant-mushroom' && scale > 0.6;
    scatter.push(m);
  }
  return { chain, scatter };
}

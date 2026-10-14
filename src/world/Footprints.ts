/**
 * Pure collider formulas for the Meshy-built structures. They reproduce the footprints the procedural
 * builders used to emit, so walking, climbing and `plantable()` behave the same whether the GLB has arrived
 * or only its placeholder stands there. No geometry lives here.
 */
import type { Footprint } from './Colliders';

type HeightAt = (x: number, z: number) => number;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
}

/** Rotates a local (dx, dz) offset about y by `rotY` and returns the world point. */
export function rotated(x: number, z: number, dx: number, dz: number, rotY: number): { x: number; z: number } {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return { x: x + dx * c + dz * s, z: z - dx * s + dz * c };
}

/** Five spires and the hall of the cathedral. */
export function cathedralFootprints(x: number, z: number, baseY: number): Footprint[] {
  const spires: Array<[number, number, number]> = [[0, 0, 118], [15, 7, 86], [-13, 9, 78], [7, -15, 66], [-9, -13, 58]];
  const out: Footprint[] = spires.map(([dx, dz, h]) => ({ kind: 'cyl', x: x + dx, z: z + dz, r: h * 0.11 * 0.55, top: baseY + h * 0.9 }));
  out.push({ kind: 'box', x, z: z + 2, hw: 17, hd: 11, top: baseY + 16 });
  return out;
}

/** Curtain walls, seven towers and the keep of the castle (64 m square). */
/**
 * The castle model (castle.glb at 44 m) is solid: four towers, curtain walls and a central keep with no open
 * courtyard. Its colliders are a 10×10 grid of the model's top heights in metres (rows run −z → +z, columns
 * −x → +x), sampled from the file, so every wall and tower can be climbed where it stands.
 */
const CASTLE_GRID = [
  [11, 14, 14, 14, 13, 14, 14, 14, 14, 10],
  [16, 17, 32, 33, 14, 14, 33, 32, 17, 16],
  [17, 18, 34, 36, 27, 27, 36, 34, 18, 16],
  [17, 18, 35, 37, 28, 28, 37, 34, 18, 17],
  [13, 17, 21, 28, 27, 27, 28, 21, 17, 12],
  [11, 15, 32, 33, 32, 37, 38, 38, 15, 11],
  [11, 26, 33, 38, 33, 38, 44, 38, 26, 11],
  [11, 26, 24, 33, 21, 37, 37, 37, 26, 11],
  [9, 11, 11, 21, 21, 21, 21, 12, 12, 9],
  [1, 9, 10, 8, 6, 6, 1, 9, 9, 1],
];
export const CASTLE_SIZE = { w: 45.3, d: 48 };

export function castleFootprints(x: number, z: number, baseY: number): Footprint[] {
  const out: Footprint[] = [];
  const cw = CASTLE_SIZE.w / 10;
  const cd = CASTLE_SIZE.d / 10;
  CASTLE_GRID.forEach((row, j) => row.forEach((top, i) => {
    if (top < 2) return;
    out.push({ kind: 'box', x: x - CASTLE_SIZE.w / 2 + (i + 0.5) * cw, z: z - CASTLE_SIZE.d / 2 + (j + 0.5) * cd, hw: cw / 2, hd: cd / 2, top: baseY + top });
  }));
  return out;
}

/** The orchard's 6×6 trunks (same seeded jitter the builder used). */
export function orchardFootprints(cx: number, cz: number, heightAt: HeightAt): Footprint[] {
  const rnd = rng(123);
  const out: Footprint[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const x = cx - 17.5 + i * 7 + (rnd() - 0.5) * 2;
      const z = cz - 17.5 + j * 7 + (rnd() - 0.5) * 2;
      const h = 2.8 + rnd() * 1.2;
      out.push({ kind: 'cyl', x, z, r: 0.45, top: heightAt(x, z) + h });
      for (let k = 0; k < 14 * 2; k++) rnd(); // fruit jitter draws, kept so trunk positions match the old layout
      rnd();
    }
  }
  return out;
}

/** Ring of eleven columns, a wall and an arch (the flooded nave). */
export function floodedRuinFootprints(x: number, z: number, y: number, radius: number): Footprint[] {
  const out: Footprint[] = [];
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2 + 0.3;
    const r = radius * (0.55 + ((i * 37) % 10) / 25);
    const h = 4 + ((i * 53) % 9);
    out.push({ kind: 'cyl', x: x + Math.cos(a) * r, z: z + Math.sin(a) * r, r: 1.4, top: y + h - 0.4 });
  }
  out.push({ kind: 'box', x: x - radius * 0.2, z: z - radius * 0.95, hw: 11, hd: 1.2, top: y + 6.5, rotY: 0.25 });
  out.push({ kind: 'box', x: x + radius * 0.8, z: z + radius * 0.3, hw: 5.5, hd: 1.2, top: y + 9, rotY: -1.1 });
  return out;
}

/** Two rock walls flanking the troll's path (along x). */
export function trollGorgeFootprints(x: number, z: number, y: number, length: number): Footprint[] {
  return [-1, 1].map((side) => ({ kind: 'box', x: x + side * 4, z: z + side * 11, hw: length / 2, hd: 3.5, top: y + 14, rotY: side * 0.12 }));
}

/** Twelve columns and the rose-window wall of the ruined nave, rotated with the building. */
export function naveFootprints(x: number, z: number, baseY: number, rotY: number): Footprint[] {
  const out: Footprint[] = [];
  for (let i = 0; i < 6; i++) {
    for (const side of [-1, 1]) {
      const h = 14 - (i % 3) * 3;
      const p = rotated(x, z, side * 7, -20 + i * 8, rotY);
      out.push({ kind: 'cyl', x: p.x, z: p.z, r: 1, top: baseY + h });
    }
  }
  const w = rotated(x, z, 0, 30, rotY);
  out.push({ kind: 'box', x: w.x, z: w.z, hw: 10, hd: 1.25, top: baseY + 26, rotY });
  return out;
}

/** The two piers of the arch gate. */
export function archGateFootprints(x: number, z: number, baseY: number, rotY: number, width = 12, height = 14): Footprint[] {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return [
    { kind: 'box', x: x + (-width / 2) * c, z: z - (-width / 2) * s, hw: 1.5, hd: 1.5, top: baseY + height },
    { kind: 'box', x: x + (width / 2) * c, z: z - (width / 2) * s, hw: 1.5, hd: 1.5, top: baseY + height },
  ];
}

export function villageHouseFootprint(x: number, z: number, y: number, w: number, d: number, rotY: number): Footprint {
  return { kind: 'box', x, z, hw: w / 2, hd: d / 2, top: y + 3.2, rotY };
}

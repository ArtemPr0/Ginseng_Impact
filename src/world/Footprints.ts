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
export function castleFootprints(x: number, z: number, baseY: number): Footprint[] {
  const half = 32;
  const out: Footprint[] = [];
  for (const [wx, wz, w, d] of [[0, -half, half * 2, 3], [0, half, half * 2, 3], [-half, 0, 3, half * 2], [half, 0, 3, half * 2]] as const) {
    out.push({ kind: 'box', x: x + wx, z: z + wz, hw: w / 2, hd: d / 2, top: baseY + 12 });
  }
  for (const [tx, tz, r, h] of [[-half, -half, 6.5, 30], [half, -half, 6.5, 30], [-half, half, 6.5, 30], [half, half, 6.5, 30], [0, -8, 5, 44], [-6, half, 3.5, 18], [6, half, 3.5, 18]] as const) {
    out.push({ kind: 'cyl', x: x + tx, z: z + tz, r, top: baseY + h });
  }
  out.push({ kind: 'box', x, z: z - 8, hw: 12, hd: 11, top: baseY + 26 });
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

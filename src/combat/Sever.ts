/**
 * Mobs coming apart (the request of 2026-11-15: "skeletons should collapse into bones and other mobs could have hands or
 * head ripped off — realistic and fun"; the user's calls: some blood, and limbs come off mid-fight too). A part is a
 * bone's subtree of the skinned body: its triangles (those whose strongest weight is in the subtree) are baked in the
 * pose they are in right now into a static piece that flies off as debris, while the bone on the body shrinks to
 * nothing so the limb is gone there. This module holds the pure parts; Gore (Gore.ts) runs them in the game.
 */
import { BufferAttribute, BufferGeometry, Vector3, type Object3D, type SkinnedMesh } from 'three';
import type { HitMaterial } from '../audio/CombatSfx';

export type Part = 'head' | 'leftArm' | 'rightArm' | 'leftHand' | 'rightHand';

/** The bone each part hangs from (Mixamo names, as Meshy rigs use them). */
export const PART_BONE: Record<Part, RegExp> = {
  head: /(^|[^a-z])(mixamorig)?:?neck$|(^|[^a-z])(mixamorig)?:?head$/i,
  leftArm: /leftforearm$/i,
  rightArm: /rightforearm$/i,
  leftHand: /lefthand$/i,
  rightHand: /righthand$/i,
};

/** Skeleton indices of `bone` and every bone under it in `mesh`'s skeleton. */
export function subtreeIndices(mesh: SkinnedMesh, bone: Object3D): Set<number> {
  const under = new Set<Object3D>();
  bone.traverse((o) => under.add(o));
  const out = new Set<number>();
  mesh.skeleton.bones.forEach((b, i) => { if (under.has(b)) out.add(i); });
  return out;
}

/** Triangles of `mesh` whose vertices are all mostly weighted to bones in `set`. */
export function partTriangles(mesh: SkinnedMesh, set: Set<number>): number[] {
  const g = mesh.geometry;
  const si = g.attributes.skinIndex, sw = g.attributes.skinWeight;
  const index = g.getIndex();
  const triN = (index ? index.count : g.attributes.position.count) / 3;
  const owned = new Uint8Array(g.attributes.position.count);
  for (let v = 0; v < owned.length; v++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(v, k); if (w > bw) { bw = w; best = si.getComponent(v, k); } }
    owned[v] = set.has(best) ? 1 : 0;
  }
  const out: number[] = [];
  for (let t = 0; t < triN; t++) {
    const a = index ? index.getX(t * 3) : t * 3, b = index ? index.getX(t * 3 + 1) : t * 3 + 1, c = index ? index.getX(t * 3 + 2) : t * 3 + 2;
    if (owned[a] && owned[b] && owned[c]) out.push(t);
  }
  return out;
}

export interface Baked { geometry: BufferGeometry; pivot: Vector3; radius: number }

const _v = new Vector3();

/** The triangles `tris` of `mesh` as posed right now, in world space, centred on their pivot (a static piece). */
export function bakeTriangles(mesh: SkinnedMesh, tris: number[]): Baked {
  const g = mesh.geometry;
  const index = g.getIndex();
  const uv = g.attributes.uv;
  const pos = new Float32Array(tris.length * 9);
  const uvs = uv ? new Float32Array(tris.length * 6) : null;
  mesh.updateMatrixWorld(true);
  mesh.skeleton.update();
  const pivot = new Vector3();
  let o = 0;
  for (const t of tris) for (let k = 0; k < 3; k++) {
    const v = index ? index.getX(t * 3 + k) : t * 3 + k;
    mesh.getVertexPosition(v, _v);
    _v.applyMatrix4(mesh.matrixWorld);
    pos[o * 3] = _v.x; pos[o * 3 + 1] = _v.y; pos[o * 3 + 2] = _v.z;
    if (uvs) { uvs[o * 2] = uv.getX(v); uvs[o * 2 + 1] = uv.getY(v); }
    pivot.add(_v);
    o++;
  }
  if (o) pivot.divideScalar(o);
  let r2 = 0;
  for (let i = 0; i < pos.length; i += 3) {
    pos[i] -= pivot.x; pos[i + 1] -= pivot.y; pos[i + 2] -= pivot.z;
    r2 = Math.max(r2, pos[i] ** 2 + pos[i + 1] ** 2 + pos[i + 2] ** 2);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(pos, 3));
  if (uvs) geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return { geometry, pivot, radius: Math.sqrt(r2) || 0.05 };
}

export interface SeverBlow {
  crit: boolean;
  heavy: boolean;
  /** A skill, a burst or a spell. */
  skill: boolean;
  /** The blow's damage as a share of the mob's max HP. */
  share: number;
  died: boolean;
  bloodMoon?: boolean;
  boss?: boolean;
  /** HP left as a share of max (bosses lose a limb only in their last quarter). */
  hpShare?: number;
}

/** Chance a strong blow takes a limb. */
export const SEVER_CHANCE = 0.35;

/** Does this blow take a part? */
export function severRoll(b: SeverBlow, rnd: () => number = Math.random): boolean {
  if (b.boss && !b.died && (b.hpShare ?? 1) > 0.25) return false;
  if (b.bloodMoon) return true;
  if (b.died && (b.heavy || b.skill)) return true;
  const strong = b.crit || b.heavy || (b.skill && b.share >= 0.12);
  return strong && rnd() < SEVER_CHANCE;
}

/** The part nearest the blow (hands too, since 2026-11-17); the head comes off only on a kill. */
export function pickPart(parts: Array<{ part: Part; at: Vector3 }>, hit: Vector3, died: boolean): Part | null {
  let best: Part | null = null, bd = Infinity;
  for (const p of parts) {
    if (p.part === 'head' && !died) continue;
    const d = p.at.distanceTo(hit);
    if (d < bd) { bd = d; best = p.part; }
  }
  return best;
}

/** What a mob with `lostArms` arms gone hits for (both gone: it can only bite and kick). */
export function maimMult(lostArms: number): number {
  return lostArms <= 0 ? 1 : lostArms === 1 ? 0.65 : 0.4;
}

/** The red of blood (drops, stains, the wound inside a cut). */
export const BLOOD_RED = 0x6a0a10;

/**
 * What comes out where a part comes off. Since 2026-11-17 (the user's call, overturning 11-16's "no blood"): flesh
 * bleeds red; ghosts puff their element's glow; bone its dust, stone its grit.
 */
export function woundOf(material: HitMaterial, element: number): { blood: boolean; glow: boolean; color: number } {
  if (material === 'bone') return { blood: false, glow: false, color: 0xd9d2bf };
  if (material === 'stone') return { blood: false, glow: false, color: 0x8a8fa6 };
  if (material === 'ghost') return { blood: false, glow: true, color: element };
  return { blood: true, glow: false, color: BLOOD_RED };
}

/**
 * Closes a cut piece (a non-indexed baked part): every loop of edges that only one triangle uses is fanned shut round
 * its middle. The caps are a second group (material index 1: the wound), so the piece shows red inside where it was
 * cut instead of a hollow shell.
 */
export function capCut(g: BufferGeometry): BufferGeometry {
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  const key = (i: number) => `${Math.round(p.getX(i) * 1e4)},${Math.round(p.getY(i) * 1e4)},${Math.round(p.getZ(i) * 1e4)}`;
  const at = new Map<string, number>();
  const count = new Map<string, number>();
  const dirE = new Map<string, [string, string]>();
  for (let t = 0; t + 2 < p.count; t += 3) {
    for (let k = 0; k < 3; k++) {
      const ia = t + k, ib = t + ((k + 1) % 3);
      const a = key(ia), b = key(ib);
      at.set(a, ia); at.set(b, ib);
      const e = a < b ? a + '|' + b : b + '|' + a;
      count.set(e, (count.get(e) ?? 0) + 1);
      dirE.set(e, [a, b]);
    }
  }
  // Open edges, walked into loops (b → a reversed, so the cap faces out of the cut).
  const next = new Map<string, string>();
  for (const [e, n] of count) if (n === 1) { const [a, b] = dirE.get(e)!; next.set(b, a); }
  const caps: number[] = [];
  const seen = new Set<string>();
  for (const start of next.keys()) {
    if (seen.has(start)) continue;
    const loop: string[] = [];
    let cur: string | undefined = start;
    while (cur !== undefined && !seen.has(cur)) { seen.add(cur); loop.push(cur); cur = next.get(cur); }
    if (loop.length < 3) continue;
    let cx = 0, cy = 0, cz = 0;
    for (const k of loop) { const i = at.get(k)!; cx += p.getX(i); cy += p.getY(i); cz += p.getZ(i); }
    cx /= loop.length; cy /= loop.length; cz /= loop.length;
    for (let i = 0; i < loop.length; i++) {
      const a = at.get(loop[i])!, b = at.get(loop[(i + 1) % loop.length])!;
      caps.push(p.getX(a), p.getY(a), p.getZ(a), p.getX(b), p.getY(b), p.getZ(b), cx, cy, cz);
    }
  }
  const n0 = p.count;
  const pos = new Float32Array(n0 * 3 + caps.length);
  pos.set(p.array as Float32Array, 0);
  pos.set(caps, n0 * 3);
  const out = new BufferGeometry();
  out.setAttribute('position', new BufferAttribute(pos, 3));
  if (uv) {
    const u = new Float32Array((n0 + caps.length / 3) * 2);
    u.set(uv.array as Float32Array, 0);
    out.setAttribute('uv', new BufferAttribute(u, 2));
  }
  out.addGroup(0, n0, 0);
  out.addGroup(n0, caps.length / 3, 1);
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

/**
 * Wear: a mob comes apart as its health drops (the user's call of 2026-11-16, "after a few hits the mob should start
 * losing some parts of the body based on % of health remaining so he looks weakened"). A blow that takes its health
 * past 70 % takes a hand, past 45 % an arm; bosses only at 50 % and 25 %. (The Mixamo rigs have no ear or horn bones,
 * so there is no smaller chip stage.)
 */
export type Wear = 'hand' | 'arm';

export function wearCrossed(before: number, after: number, boss: boolean): Wear[] {
  const marks: Array<[number, Wear]> = boss ? [[0.5, 'hand'], [0.25, 'arm']] : [[0.7, 'hand'], [0.45, 'arm']];
  return marks.filter(([m]) => before > m && after <= m).map(([, w]) => w);
}

/** The part `wear` takes from a mob hit on `side`, missing `lost` (the other side when this one is gone). */
export function wearPart(wear: Wear, side: 'left' | 'right', lost: Set<string>): Part | null {
  const other = side === 'left' ? 'right' : 'left';
  for (const s of [side, other]) {
    const arm = `${s}Arm` as Part, hand = `${s}Hand` as Part;
    if (lost.has(arm)) continue;
    if (wear === 'arm') return arm;
    if (!lost.has(hand)) return hand;
  }
  return null;
}

/** Under 30 % a mob is worn out: slower (`pace`) and bent over (`hunch`, radians at the spine) the lower it gets. */
export function weakness(hpShare: number): { pace: number; hunch: number } {
  if (hpShare >= 0.3) return { pace: 1, hunch: 0 };
  const f = 1 - Math.max(0, hpShare) / 0.3;
  return { pace: 0.85 - 0.15 * f, hunch: 0.2 + 0.3 * f };
}

/** Sides of the body that have lost a hand or an arm (for maimMult). */
export function armsLost(lost: Set<string>): number {
  return (['left', 'right'] as const).filter((s) => lost.has(`${s}Arm`) || lost.has(`${s}Hand`)).length;
}

/** Chance a solid blow snaps a bone off a living skeleton (its skull too: it fights on without it). */
export const BONE_SNAP = 0.65;

/**
 * Does this blow snap a bone off a living skeleton? (Playtest 2026-11-17: they only ever fell apart on death.) A crit, a
 * heavy, or anything taking a tenth of its health or more; a graze never.
 */
export function boneSnap(b: { crit: boolean; heavy: boolean; skill: boolean; share: number }, rnd: () => number = Math.random): boolean {
  const solid = b.crit || b.heavy || b.share >= 0.1;
  return solid && rnd() < BONE_SNAP;
}

/**
 * Mobs coming apart (the request of 2026-11-15: "skeletons should collapse into bones and other mobs could have hands or
 * head ripped off — realistic and fun"; the user's calls: some blood, and limbs come off mid-fight too). A part is a
 * bone's subtree of the skinned body: its triangles (those whose strongest weight is in the subtree) are baked in the
 * pose they are in right now into a static piece that flies off as debris, while the bone on the body shrinks to
 * nothing so the limb is gone there. This module holds the pure parts; Gore (Gore.ts) runs them in the game.
 */
import { BufferAttribute, BufferGeometry, Vector3, type Object3D, type SkinnedMesh } from 'three';
import type { HitMaterial } from '../audio/CombatSfx';

export type Part = 'head' | 'leftArm' | 'rightArm';

/** The bone each part hangs from (Mixamo names, as Meshy rigs use them). */
export const PART_BONE: Record<Part, RegExp> = {
  head: /(^|[^a-z])(mixamorig)?:?neck$|(^|[^a-z])(mixamorig)?:?head$/i,
  leftArm: /leftforearm$/i,
  rightArm: /rightforearm$/i,
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

/** The part nearest the blow; the head comes off only on a kill. */
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

/** Blood red. */
export const BLOOD = 0x6a0a10;

/** What spurts from a wound: red blood from flesh (glow of the element with the Blood setting off), dust from bone. */
export function bloodOf(material: HitMaterial, element: number, bloodOn: boolean): { glow: boolean; color: number } {
  if (material === 'ghost') return { glow: true, color: element };
  if (material === 'bone') return { glow: false, color: 0xd9d2bf };
  if (material === 'stone') return { glow: false, color: 0x8a8fa6 };
  return bloodOn ? { glow: false, color: BLOOD } : { glow: true, color: element };
}

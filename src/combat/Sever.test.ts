import { describe, expect, it } from 'vitest';
import { Bone, BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { bakeTriangles, capCut, woundOf, maimMult, partTriangles, pickPart, severRoll, subtreeIndices } from './Sever';

/** A 2 m tall box skinned to hips → spine → head (top 0.5 m) and spine → leftArm (x > 0.3). */
function body() {
  const geo = new BoxGeometry(1, 2, 0.4, 6, 12, 2).translate(0, 1, 0);
  const pos = geo.attributes.position;
  const idx: number[] = [], w: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i);
    const b = y > 1.5 ? 2 : x > 0.3 ? 3 : 1;
    idx.push(b, 0, 0, 0);
    w.push(1, 0, 0, 0);
  }
  geo.setAttribute('skinIndex', new Uint16BufferAttribute(idx, 4));
  geo.setAttribute('skinWeight', new Float32BufferAttribute(w, 4));
  const hips = new Bone(); hips.name = 'mixamorigHips';
  const spine = new Bone(); spine.name = 'mixamorigSpine'; spine.position.y = 1;
  const head = new Bone(); head.name = 'mixamorigHead'; head.position.y = 0.5;
  const arm = new Bone(); arm.name = 'mixamorigLeftArm'; arm.position.x = 0.3;
  hips.add(spine); spine.add(head, arm);
  const mesh = new SkinnedMesh(geo, new MeshStandardMaterial());
  const root = new Group();
  root.add(mesh, hips);
  root.updateMatrixWorld(true);
  mesh.bind(new Skeleton([hips, spine, head, arm]));
  return { root, mesh, hips, spine, head, arm };
}

describe('subtreeIndices / partTriangles', () => {
  it('the head subtree owns only the triangles of the head, disjoint from the arm', () => {
    const { mesh, head, arm } = body();
    const h = partTriangles(mesh, subtreeIndices(mesh, head));
    const a = partTriangles(mesh, subtreeIndices(mesh, arm));
    expect(h.length).toBeGreaterThan(0);
    expect(a.length).toBeGreaterThan(0);
    expect(h.some((t) => a.includes(t))).toBe(false);
  });

  it('a subtree includes the bones under it', () => {
    const { mesh, spine } = body();
    expect([...subtreeIndices(mesh, spine)].sort()).toEqual([1, 2, 3]);
  });
});

describe('bakeTriangles', () => {
  it('bakes the posed triangles into a static piece where they are in the world', () => {
    const { mesh, head, root } = body();
    root.position.set(10, 0, 0);
    root.updateMatrixWorld(true);
    const tris = partTriangles(mesh, subtreeIndices(mesh, head));
    const p = bakeTriangles(mesh, tris);
    expect(p.geometry.attributes.position.count).toBe(tris.length * 3);
    expect(p.pivot.x).toBeCloseTo(10, 0);
    expect(p.pivot.y).toBeGreaterThan(1.5);
    expect(p.radius).toBeGreaterThan(0.1);
    expect(p.radius).toBeLessThan(1);
  });
});

describe('severRoll', () => {
  const r = (v: number) => () => v;
  it('a plain combo hit never takes a limb', () => {
    expect(severRoll({ crit: false, heavy: false, skill: false, share: 0.3, died: false }, r(0))).toBe(false);
  });
  it('a crit, a heavy or a big skill hit takes one about a third of the time', () => {
    expect(severRoll({ crit: true, heavy: false, skill: false, share: 0.05, died: false }, r(0.2))).toBe(true);
    expect(severRoll({ crit: true, heavy: false, skill: false, share: 0.05, died: false }, r(0.5))).toBe(false);
    expect(severRoll({ crit: false, heavy: false, skill: true, share: 0.12, died: false }, r(0.2))).toBe(true);
    expect(severRoll({ crit: false, heavy: false, skill: true, share: 0.05, died: false }, r(0.2))).toBe(false);
  });
  it('every kill by a heavy, skill or spell takes something; Blood Moon makes every hit', () => {
    expect(severRoll({ crit: false, heavy: true, skill: false, share: 0.01, died: true }, r(0.99))).toBe(true);
    expect(severRoll({ crit: false, heavy: false, skill: false, share: 0.01, died: false, bloodMoon: true }, r(0.99))).toBe(true);
  });
  it('a boss only loses one in its last quarter or on its death', () => {
    expect(severRoll({ crit: true, heavy: true, skill: false, share: 0.2, died: false, boss: true, hpShare: 0.5 }, r(0))).toBe(false);
    expect(severRoll({ crit: true, heavy: true, skill: false, share: 0.2, died: false, boss: true, hpShare: 0.2 }, r(0))).toBe(true);
  });
});

describe('pickPart', () => {
  it('takes the part nearest the blow, the head only on a kill', () => {
    const parts = [
      { part: 'head' as const, at: new Vector3(0, 2, 0) },
      { part: 'leftArm' as const, at: new Vector3(0.5, 1.4, 0) },
      { part: 'rightArm' as const, at: new Vector3(-0.5, 1.4, 0) },
    ];
    expect(pickPart(parts, new Vector3(-0.6, 1.3, 0), false)).toBe('rightArm');
    expect(pickPart(parts, new Vector3(0, 2.1, 0), false)).not.toBe('head');
    expect(pickPart(parts, new Vector3(0, 2.1, 0), true)).toBe('head');
    expect(pickPart([], new Vector3(), true)).toBeNull();
  });
  it('hands come off too (playtest 2026-11-17: "the hand actually falls off")', () => {
    const parts = [
      { part: 'rightArm' as const, at: new Vector3(-0.5, 1.4, 0) },
      { part: 'rightHand' as const, at: new Vector3(-0.8, 1.0, 0) },
    ];
    expect(pickPart(parts, new Vector3(-0.85, 0.95, 0), false)).toBe('rightHand');
  });
});

describe('maimMult', () => {
  it('one arm off: 35 % weaker; both: it only bites and kicks', () => {
    expect(maimMult(0)).toBe(1);
    expect(maimMult(1)).toBeCloseTo(0.65);
    expect(maimMult(2)).toBeLessThan(0.5);
  });
});

describe('woundOf', () => {
  it("red blood for flesh (the user's call of 2026-11-17, overturning 11-16's no blood); ghosts their glow, bone and stone their dust", () => {
    const f = woundOf('flesh', 0x37f5ff);
    expect(f.blood).toBe(true);
    const r = (f.color >> 16) & 255, g = (f.color >> 8) & 255, b = f.color & 255;
    expect(r > g * 1.8 && r > b * 1.8).toBe(true);
    expect(woundOf('ghost', 0x37f5ff)).toEqual({ blood: false, glow: true, color: 0x37f5ff });
    expect(woundOf('bone', 0x37f5ff).glow).toBe(false);
    expect(woundOf('bone', 0x37f5ff).blood).toBe(false);
    expect(woundOf('stone', 0x37f5ff).blood).toBe(false);
  });
});

describe('capCut (the severed piece is closed where it was cut, red inside)', () => {
  it('fills every open edge loop of a cut piece, as a second group', () => {
    // An open tube: a cylinder with no ends, non-indexed like a baked piece.
    const tube = new CylinderGeometry(0.1, 0.1, 0.5, 12, 1, true).toNonIndexed();
    const capped = capCut(tube);
    expect(openEdges(tube)).toBeGreaterThan(0);
    expect(openEdges(capped)).toBe(0);
    expect(capped.groups.length).toBe(2);
    expect(capped.groups[1].materialIndex).toBe(1);
  });
});

/** Edges used by just one triangle (positions welded). */
function openEdges(g: BufferGeometry): number {
  const p = g.attributes.position;
  const r = (v: number) => Math.round(v * 1e4) + 0;
  const key = (i: number) => `${r(p.getX(i))},${r(p.getY(i))},${r(p.getZ(i))}`;
  const n = new Map<string, number>();
  for (let t = 0; t < p.count; t += 3) for (let k = 0; k < 3; k++) {
    const a = key(t + k), b = key(t + ((k + 1) % 3));
    const e = a < b ? a + '|' + b : b + '|' + a;
    n.set(e, (n.get(e) ?? 0) + 1);
  }
  let open = 0;
  for (const c of n.values()) if (c === 1) open++;
  return open;
}

describe('wear (mobs coming apart as their health drops, 2026-11-16)', () => {
  it('a blow crossing 70 % takes a hand, 45 % an arm; under 30 % nothing more but it is weakened', async () => {
    const { wearCrossed } = await import('./Sever');
    expect(wearCrossed(1, 0.8, false)).toEqual([]);
    expect(wearCrossed(0.8, 0.65, false)).toEqual(['hand']);
    expect(wearCrossed(0.65, 0.4, false)).toEqual(['arm']);
    expect(wearCrossed(1, 0.3, false)).toEqual(['hand', 'arm']);
    expect(wearCrossed(0.4, 0.1, false)).toEqual([]);
  });
  it('bosses wear only at 50 % and 25 %', async () => {
    const { wearCrossed } = await import('./Sever');
    expect(wearCrossed(1, 0.6, true)).toEqual([]);
    expect(wearCrossed(0.6, 0.45, true)).toEqual(['hand']);
    expect(wearCrossed(0.45, 0.2, true)).toEqual(['arm']);
  });
  it('the part worn is on the side hit, falling back to the other side, never a hand on an arm already gone', async () => {
    const { wearPart } = await import('./Sever');
    expect(wearPart('hand', 'left', new Set())).toBe('leftHand');
    expect(wearPart('hand', 'left', new Set(['leftHand']))).toBe('rightHand');
    expect(wearPart('hand', 'left', new Set(['leftArm']))).toBe('rightHand');
    expect(wearPart('arm', 'right', new Set(['rightHand']))).toBe('rightArm');
    expect(wearPart('arm', 'right', new Set(['rightArm', 'leftArm']))).toBe(null);
  });
  it('weakened under 30 %: slower, and bent over more the lower it gets', async () => {
    const { weakness } = await import('./Sever');
    expect(weakness(0.8)).toEqual({ pace: 1, hunch: 0 });
    const w = weakness(0.2), w2 = weakness(0.05);
    expect(w.pace).toBeLessThan(1);
    expect(w.pace).toBeGreaterThan(0.6);
    expect(w2.hunch).toBeGreaterThan(w.hunch);
    expect(w2.hunch).toBeLessThan(0.6);
  });
});

describe('boneSnap (playtest 2026-11-17: skeletons should lose bones when hit, not only on death)', () => {
  it('a solid blow on a living skeleton snaps a bone off more often than not; a graze never does', async () => {
    const { boneSnap } = await import('./Sever');
    expect(boneSnap({ crit: false, heavy: true, skill: false, share: 0.05 }, () => 0.5)).toBe(true);
    expect(boneSnap({ crit: false, heavy: false, skill: false, share: 0.2 }, () => 0.5)).toBe(true);
    expect(boneSnap({ crit: false, heavy: false, skill: false, share: 0.05 }, () => 0)).toBe(false);
    expect(boneSnap({ crit: true, heavy: false, skill: false, share: 0.05 }, () => 0.9)).toBe(false);
  });
});

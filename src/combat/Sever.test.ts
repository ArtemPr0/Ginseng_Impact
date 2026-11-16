import { describe, expect, it } from 'vitest';
import { Bone, BoxGeometry, Float32BufferAttribute, Group, MeshStandardMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three';
import { bakeTriangles, woundOf, maimMult, partTriangles, pickPart, severRoll, subtreeIndices } from './Sever';

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
});

describe('maimMult', () => {
  it('one arm off: 35 % weaker; both: it only bites and kicks', () => {
    expect(maimMult(0)).toBe(1);
    expect(maimMult(1)).toBeCloseTo(0.65);
    expect(maimMult(2)).toBeLessThan(0.5);
  });
});

describe('woundOf', () => {
  it("no blood anywhere (the user's call of 2026-11-16): flesh and ghosts puff their element, bone and stone their dust", () => {
    expect(woundOf('flesh', 0x37f5ff)).toEqual({ glow: true, color: 0x37f5ff });
    expect(woundOf('ghost', 0x37f5ff)).toEqual({ glow: true, color: 0x37f5ff });
    expect(woundOf('bone', 0x37f5ff).glow).toBe(false);
    expect(woundOf('stone', 0x37f5ff).glow).toBe(false);
    for (const [m, el] of [['flesh', 0x37f5ff], ['ghost', 0x37f5ff], ['bone', 0x37f5ff], ['stone', 0x37f5ff], ['flesh', 0xd0102a], ['ghost', 0xd0102a]] as const) {
      const c = woundOf(m, el).color;
      const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
      // Never a blood red: red well above both other channels.
      expect(r > g * 1.8 && r > b * 1.8).toBe(false);
    }
  });
});

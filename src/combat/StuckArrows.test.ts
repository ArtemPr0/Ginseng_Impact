import { describe, expect, it } from 'vitest';
import { Bone, Group, Vector3 } from 'three';
import { ARROW_LEN, MAX_STUCK, StuckArrows, entryPoint } from './StuckArrows';

function body() {
  const root = new Group();
  const hips = new Bone(); hips.name = 'Hips'; hips.position.y = 1;
  const head = new Bone(); head.name = 'Head'; head.position.y = 0.7;
  hips.add(head);
  root.add(hips);
  root.scale.setScalar(0.5); // rigs are often scaled
  root.position.set(3, 0, 0);
  root.updateMatrixWorld(true);
  return { root, bones: [hips, head], hips, head };
}

describe('entryPoint', () => {
  it('meets the body at its surface on the shot side, at the shot height', () => {
    const p = entryPoint({ x: 0, y: 0, z: 0 }, 0.5, 2, new Vector3(-2, 1.2, 0));
    expect(p.x).toBeCloseTo(-0.5 * 0.85, 5);
    expect(p.y).toBeCloseTo(1.2, 5);
    expect(p.z).toBeCloseTo(0, 5);
  });
  it('keeps the height inside the body', () => {
    expect(entryPoint({ x: 0, y: 0, z: 0 }, 0.5, 2, new Vector3(-2, 5, 0)).y).toBeLessThanOrEqual(2);
  });
});

describe('StuckArrows', () => {
  it('lodges an arrow on the nearest bone, half sunk along the shot, and it moves with that bone', () => {
    const s = new StuckArrows();
    const { root, bones, head } = body();
    const hit = new Vector3();
    head.getWorldPosition(hit); hit.z -= 0.1;
    const dir = new Vector3(0, 0, 1);
    const a = s.stick('m1', bones, hit, dir)!;
    expect(a.parent).toBe(head);
    a.updateMatrixWorld(true);
    const at = a.getWorldPosition(new Vector3());
    // Its middle is at the entry point: half the shaft inside.
    expect(at.distanceTo(hit)).toBeLessThan(1e-4);
    // Pointing along the shot (its +z).
    const fwd = new Vector3(0, 0, 1).transformDirection(a.matrixWorld);
    expect(fwd.dot(dir)).toBeGreaterThan(0.999);
    // World size is real whatever the rig's scale.
    const tip = new Vector3(0, 0, ARROW_LEN / 2).applyMatrix4(a.matrixWorld);
    expect(tip.distanceTo(at)).toBeCloseTo(ARROW_LEN / 2, 4);
    head.rotation.x = 1; root.updateMatrixWorld(true);
    expect(a.getWorldPosition(new Vector3()).distanceTo(hit)).toBeGreaterThan(0.01);
  });
  it(`holds at most ${MAX_STUCK} per body, the oldest falling out`, () => {
    const s = new StuckArrows();
    const { bones } = body();
    const first = s.stick('m1', bones, new Vector3(3, 1, 0), new Vector3(1, 0, 0))!;
    for (let i = 0; i < MAX_STUCK; i++) s.stick('m1', bones, new Vector3(3, 1, 0), new Vector3(1, 0, 0));
    expect(s.count('m1')).toBe(MAX_STUCK);
    expect(first.parent).toBe(null);
  });
  it('a shot past a bent body is pulled in to the nearest bone (no arrow hanging in the air)', () => {
    const s = new StuckArrows();
    const { bones, head } = body();
    const hp = head.getWorldPosition(new Vector3());
    const a = s.stick('m1', bones, hp.clone().add(new Vector3(0, 1, 0)), new Vector3(1, 0, 0), 0.2)!;
    expect(a.getWorldPosition(new Vector3()).distanceTo(hp)).toBeCloseTo(0.2, 4);
  });
  it('a limb shrunk away (torn off) holds nothing, even its child bones', () => {
    const s = new StuckArrows();
    const { bones, hips, head } = body();
    hips.scale.setScalar(1e-4); hips.updateMatrixWorld(true);
    expect(s.stick('m1', bones, head.getWorldPosition(new Vector3()), new Vector3(1, 0, 0))).toBe(null);
  });
  it('clears a body', () => {
    const s = new StuckArrows();
    const { bones } = body();
    const a = s.stick('m1', bones, new Vector3(3, 1, 0), new Vector3(1, 0, 0))!;
    s.clear('m1');
    expect(s.count('m1')).toBe(0);
    expect(a.parent).toBe(null);
  });
  it('without bones there is nothing to stick to', () => {
    expect(new StuckArrows().stick('m', [], new Vector3(), new Vector3(1, 0, 0))).toBe(null);
  });
});

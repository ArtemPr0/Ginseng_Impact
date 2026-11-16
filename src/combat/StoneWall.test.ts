import { describe, expect, it } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Vector3 } from 'three';
import { StoneWall, wallSource } from './StoneWall';

describe('StoneWall from the Meshy wall model', () => {
  it('stands on the ground even when the model is also placed in the world, moved and scaled (2026-11-16: it floated 1.4 m up)', () => {
    const world = new Group();
    world.position.set(50, 10, -4);
    world.scale.setScalar(3);
    const root = new Group();
    const m = new Mesh(new BoxGeometry(2.6, 1.2, 0.5, 8, 4, 2), new MeshStandardMaterial());
    m.position.y = 0.6;
    root.add(m);
    world.add(root);
    world.updateMatrixWorld(true);
    const src = wallSource(root)!;
    expect(src.height).toBeCloseTo(1.2, 1);
    expect(src.floor).toBeCloseTo(0, 1);
    const w = new StoneWall(src, new Vector3(0, 2, 0), 0, () => 2);
    for (let i = 0; i < 20; i++) w.update(0.1);
    let low = Infinity;
    for (const b of w.blocks) low = Math.min(low, b.proxy.position.y - b.half.y);
    expect(low).toBeGreaterThan(1.85);
    expect(low).toBeLessThan(2.15);
  });
  it('comes up out of the ground at the aim, not off the top of a post standing beside it', () => {
    const root = new Group();
    const m = new Mesh(new BoxGeometry(2.6, 1.2, 0.5, 8, 4, 2), new MeshStandardMaterial());
    m.position.y = 0.6;
    root.add(m);
    // A post's collider 1 m high at x = -1.5, the ground at 0 everywhere else.
    const w = new StoneWall(wallSource(root)!, new Vector3(0, 0, 0), Math.PI / 2, (x) => (Math.abs(x + 1.5) < 0.3 ? 1 : 0));
    for (let i = 0; i < 20; i++) w.update(0.1);
    // The half of the wall over the post (x < 0).
    let low = Infinity;
    for (const b of w.blocks) if (b.x < -0.2) low = Math.min(low, b.proxy.position.y - b.half.y);
    expect(low).toBeLessThan(0.3);
  });
});

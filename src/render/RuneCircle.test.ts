import { describe, expect, it } from 'vitest';
import { Mesh, Vector3 } from 'three';
import { RuneCircles } from './RuneCircle';

const live = (r: RuneCircles) => r.group.children.filter((c) => c.visible && (c as Mesh).isMesh && c.name === 'rune') as Mesh[];

describe('RuneCircles (v12: the reel\'s stacked circles over the target)', () => {
  it('a stack of circles rising over the target, each smaller and higher, with a column of light through them', () => {
    const r = new RuneCircles();
    r.cast(new Vector3(5, 1, 5), 0xff7a2a, { radius: 3, stack: 3, height: 9, hold: 0.4 });
    r.update(0.3);
    const rings = live(r).sort((a, b) => a.position.y - b.position.y);
    expect(rings).toHaveLength(3);
    expect(rings[0].position.y).toBeCloseTo(1.08, 1);
    expect(rings[2].position.y).toBeGreaterThan(8);
    expect(rings[2].scale.x).toBeLessThan(rings[0].scale.x);
    expect(r.group.children.some((c) => c.visible && c.name === 'rune-column')).toBe(true);
  });
  it('the stack turns both ways and is gone soon after it lands', () => {
    const r = new RuneCircles();
    r.cast(new Vector3(0, 0, 0), 0xffffff, { radius: 2, stack: 2, height: 5, hold: 0.4 });
    r.update(0.2);
    const [a, b] = live(r).sort((p, q) => p.position.y - q.position.y);
    const a0 = a.rotation.y, b0 = b.rotation.y;
    r.update(0.1);
    expect(Math.sign(a.rotation.y - a0)).not.toBe(Math.sign(b.rotation.y - b0));
    for (let i = 0; i < 20; i++) r.update(0.1);
    expect(live(r)).toHaveLength(0);
    expect(r.group.children.some((c) => c.visible)).toBe(false);
  });
  it('a small upright circle at the caster\'s hand faces the target', () => {
    const r = new RuneCircles();
    r.tip(new Vector3(0, 1.5, 0), new Vector3(0, 1.5, 10), 0x88ccff, 0.4);
    r.update(0.1);
    const t = live(r)[0];
    expect(t).toBeDefined();
    const n = new Vector3(0, 1, 0).applyQuaternion(t.quaternion);
    expect(Math.abs(n.z)).toBeGreaterThan(0.9);
  });
  it('many casts at once never grow the pool', () => {
    const r = new RuneCircles();
    const n = r.group.children.length;
    for (let i = 0; i < 30; i++) r.cast(new Vector3(i, 0, 0), 0xffffff, { radius: 2, stack: 4, height: 8, hold: 1 });
    expect(r.group.children.length).toBe(n);
  });
});

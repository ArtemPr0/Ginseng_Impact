import { describe, expect, it } from 'vitest';
import { PointLight, Scene, Vector3 } from 'three';
import { LightBudget } from './LightBudget';

const pool = (s: Scene) => s.children.filter((c) => (c as PointLight).isPointLight && c.userData.pooled) as PointLight[];

describe('LightBudget transient lights (spells light the ground)', () => {
  it('a flash takes a pooled light ahead of every placed light, then fades out over its seconds', () => {
    const scene = new Scene();
    const b = new LightBudget(scene, 2);
    for (let i = 0; i < 3; i++) { const l = new PointLight(0xffffff, 5, 10); l.position.set(i, 0, 0); scene.add(l); }
    b.collect(scene);
    b.flash(new Vector3(30, 1, 0), 0xff8800, 40, 18, 0.5);
    b.update(new Vector3(0, 0, 0), 0);
    expect(pool(scene).some((p) => p.intensity === 40 && p.position.x === 30)).toBe(true);
    b.update(new Vector3(0, 0, 0), 0.25);
    const mid = pool(scene).find((p) => p.position.x === 30)!;
    expect(mid.intensity).toBeGreaterThan(0);
    expect(mid.intensity).toBeLessThan(40);
    b.update(new Vector3(0, 0, 0), 0.3);
    expect(pool(scene).some((p) => p.position.x === 30)).toBe(false);
  });

  it('a held light follows what it is given until it is let go', () => {
    const scene = new Scene();
    const b = new LightBudget(scene, 2);
    const l = b.hold(0x8a3dff, 20, 15);
    l.pos.set(5, 2, 5);
    b.update(new Vector3(), 0.1);
    expect(pool(scene).some((p) => p.position.x === 5 && p.intensity === 20)).toBe(true);
    l.intensity = 0;
    l.done = true;
    b.update(new Vector3(), 0.1);
    expect(pool(scene).every((p) => p.intensity === 0)).toBe(true);
  });
});

describe('LightBudget.setLimit (Quality Low)', () => {
  it('uses only the first `n` pool lights; the rest are hidden (out of the shaders)', async () => {
    const { Scene, Vector3 } = await import('three');
    const { LightBudget } = await import('./LightBudget');
    const scene = new Scene();
    const b = new LightBudget(scene, 6);
    b.setLimit(3);
    for (let i = 0; i < 5; i++) b.flash(new Vector3(i, 0, 0), 0xffffff, 10, 10, 2);
    b.update(new Vector3(), 0.016);
    const pool = scene.children.filter((o) => (o as { isPointLight?: boolean }).isPointLight);
    expect(pool.filter((l) => l.visible).length).toBe(3);
    expect(pool.filter((l) => !l.visible).every((l) => (l as unknown as { intensity: number }).intensity === 0)).toBe(true);
  });
});

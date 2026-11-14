import { describe, expect, it } from 'vitest';
import { Scene, Texture, Vector3 } from 'three';
import { ImpactStars, STAR_LIFE } from './ImpactStars';

describe('ImpactStars', () => {
  const make = (pool = 4) => {
    const scene = new Scene();
    return { scene, stars: new ImpactStars(scene, pool, () => new Texture()) };
  };
  const shown = (s: ImpactStars) => s.sprites.filter((x) => x.visible);

  it('pops a comic star where a blow lands, growing, then gone', () => {
    const { stars } = make();
    stars.pop(new Vector3(1, 2, 3), 0xff5a1a, 1.2);
    const [s] = shown(stars);
    expect(s.position.toArray()).toEqual([1, 2, 3]);
    const start = s.scale.x;
    stars.update(STAR_LIFE * 0.5);
    expect(s.scale.x).toBeGreaterThan(start);
    stars.update(STAR_LIFE);
    expect(shown(stars)).toHaveLength(0);
  });

  it('holds still while time is stopped (hit-stop: a freeze frame on the blow)', () => {
    const { stars } = make();
    stars.pop(new Vector3(), 0xffffff, 1);
    const [s] = shown(stars);
    const before = s.scale.x;
    stars.update(0);
    expect(s.scale.x).toBe(before);
    expect(s.visible).toBe(true);
  });

  it('reuses the oldest star when the pool is full, and draws over the bodies', () => {
    const { stars, scene } = make(2);
    for (let i = 0; i < 3; i++) stars.pop(new Vector3(i, 0, 0), 0xffffff, 1);
    expect(shown(stars).map((s) => s.position.x).sort()).toEqual([1, 2]);
    expect(scene.children.length).toBe(2);
    expect(stars.sprites[0].material.depthTest).toBe(false);
  });
});

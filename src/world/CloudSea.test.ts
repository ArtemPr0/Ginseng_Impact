import { describe, expect, it } from 'vitest';
import { Color, Mesh, ShaderMaterial } from 'three';
import { CloudLevel, CloudSea } from './CloudSea';

const cam = { x: 0, y: 30, z: 0 };
/** A sea that has seen the camera once (so the next change is eased, not a teleport's). */
function settled(y = -26): CloudSea {
  const sea = new CloudSea(y);
  sea.update(0, cam);
  sea.update(0, cam);
  return sea;
}
const layers = (sea: CloudSea) => sea.group.children.map((m) => (m as Mesh).position.y);
const alphas = (sea: CloudSea) => sea.group.children.map((m) => ((m as Mesh).material as ShaderMaterial).uniforms.uAlpha.value as number);

describe('CloudLevel', () => {
  it('eases to a new level over the given seconds, smoothly, and stays there', () => {
    const c = new CloudLevel(-26);
    c.set(-16, 1);
    c.step(0.25);
    expect(c.level).toBeGreaterThan(-26);
    expect(c.level).toBeLessThan(-21);
    c.step(0.25);
    expect(c.level).toBeCloseTo(-21, 6);
    c.step(0.5);
    expect(c.level).toBe(-16);
    expect(c.alpha).toBe(1);
    c.step(5);
    expect(c.level).toBe(-16);
  });

  it('asking again for the level it is going to does not restart the ease', () => {
    const c = new CloudLevel(-26);
    c.set(-16, 1);
    c.step(0.5);
    c.set(-16, 1);
    c.step(0.5);
    expect(c.level).toBe(-16);
  });

  it('null fades the clouds out where they are', () => {
    const c = new CloudLevel(-26);
    c.set(null, 1);
    expect(c.wanted).toBeNull();
    c.step(0.5);
    expect(c.alpha).toBeCloseTo(0.5, 6);
    expect(c.level).toBe(-26);
    c.step(0.5);
    expect(c.alpha).toBe(0);
    expect(c.level).toBe(-26);
  });

  it('a level after a fade-out is taken at once and faded in', () => {
    const c = new CloudLevel(-26);
    c.set(null, 1);
    c.step(1);
    c.set(-40, 1);
    expect(c.level).toBe(-40);
    expect(c.alpha).toBe(0);
    c.step(1);
    expect(c.level).toBe(-40);
    expect(c.alpha).toBe(1);
  });

  it('turning back halfway eases from where it is', () => {
    const c = new CloudLevel(-26);
    c.set(null, 1);
    c.step(0.5);
    c.set(-26, 1);
    expect(c.alpha).toBeCloseTo(0.5, 6);
    c.step(1);
    expect(c.alpha).toBe(1);
  });

  it('zero seconds is immediate', () => {
    const c = new CloudLevel(-26);
    c.set(-16, 0);
    expect(c.level).toBe(-16);
    c.set(null, 0);
    expect(c.alpha).toBe(0);
  });
});

describe('CloudSea', () => {
  it('lays its three layers at y, y − 9 and y − 22, and eases them together to a new level', () => {
    const sea = settled(-26);
    expect(layers(sea)).toEqual([-26, -35, -48]);
    sea.setLevel(-16);
    sea.update(0.5, cam);
    expect(layers(sea)[0]).toBeCloseTo(-21, 6);
    sea.update(0.5, cam);
    expect(layers(sea)).toEqual([-16, -25, -38]);
  });

  it('fades out for null (the drowned city, the rooms) and stops drawing', () => {
    const sea = settled(-26);
    const full = alphas(sea);
    sea.setLevel(null);
    sea.update(0.5, cam);
    alphas(sea).forEach((a, i) => expect(a).toBeCloseTo(full[i] * 0.5, 6));
    expect(sea.group.visible).toBe(true);
    sea.update(0.5, cam);
    expect(alphas(sea)).toEqual([0, 0, 0]);
    expect(sea.group.visible).toBe(false);
    // Back on the island: there at once, fading in.
    sea.setLevel(-26);
    expect(layers(sea)).toEqual([-26, -35, -48]);
    sea.update(1, cam);
    expect(alphas(sea)).toEqual(full);
    expect(sea.group.visible).toBe(true);
  });

  it('a teleport (the camera jumping far in one frame) makes the next change at once', () => {
    const sea = settled(-26);
    sea.update(0.016, { x: -1000, y: -44, z: 50 });
    sea.setLevel(null);
    expect(sea.alpha).toBe(0);
    expect(sea.group.visible).toBe(false);
    // The next frames are ordinary again: a change eases.
    sea.update(0.016, { x: -1000, y: -44, z: 49 });
    sea.setLevel(-26);
    sea.update(0.25, { x: -1000, y: -44, z: 49 });
    expect(sea.alpha).toBeGreaterThan(0);
    expect(sea.alpha).toBeLessThan(1);
  });

  it('a new sea takes its first level at once (the hero may start anywhere)', () => {
    const sea = new CloudSea(-26);
    sea.update(0.016, { x: 1000, y: 26, z: 20 });
    sea.setLevel(-16);
    expect(layers(sea)).toEqual([-16, -25, -38]);
  });

  it('follows the camera across, never up and down', () => {
    const sea = settled(-26);
    sea.update(0.016, { x: 12, y: 80, z: -7 });
    expect(sea.group.position.x).toBe(12);
    expect(sea.group.position.z).toBe(-7);
    expect(layers(sea)[0]).toBe(-26);
  });

  it('takes a realm air (its sky tint, its fog by distance), and back to the island own unfogged sea', () => {
    const sea = settled(-26);
    const u = ((sea.group.children[0] as Mesh).material as ShaderMaterial).uniforms;
    const tint = u.uTint.value as Color;
    const electric = tint.clone();
    const pink = new Color(0xff3fa0);
    expect(u.uFogged.value).toBe(0);
    sea.setAir(pink);
    sea.update(0.05, cam);
    // (Eased, not at once.)
    expect(tint.r).toBeGreaterThan(electric.r);
    expect(tint.r).toBeLessThan(pink.r * 0.5);
    for (let i = 0; i < 200; i++) sea.update(0.05, cam);
    for (const k of ['r', 'g', 'b'] as const) expect(tint[k]).toBeCloseTo(pink[k], 4);
    expect(u.uFogged.value).toBeCloseTo(1, 4);
    sea.setAir(null);
    for (let i = 0; i < 200; i++) sea.update(0.05, cam);
    for (const k of ['r', 'g', 'b'] as const) expect(tint[k]).toBeCloseTo(electric[k], 4);
    expect(u.uFogged.value).toBeCloseTo(0, 4);
  });

  it('a teleport takes the new air at once', () => {
    const sea = settled(-26);
    const u = ((sea.group.children[0] as Mesh).material as ShaderMaterial).uniforms;
    sea.update(0.016, { x: 1000, y: 26, z: 20 });
    sea.setAir(0x8a2ad0);
    expect(u.uFogged.value).toBe(1);
    expect((u.uTint.value as Color).equals(new Color(0x8a2ad0))).toBe(true);
  });
});

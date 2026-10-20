import { DoubleSide, type ShaderMaterial, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { Vfx } from '../combat/Vfx';
import { burnStrip } from './ShotFx';

/** Crimson Cleave's run: a patch every 2 m from 1 m out, and the last where the crescent stops at 9 m. */
const RUN = [1, 3, 5, 7, 9].map((d) => new Vector3(10 + d * 0.6, 2 + d * 0.1, -4 + d * 0.8));

describe('burnStrip', () => {
  it('draws a whole cast of patches with one mesh, its ribbon growing a quad per patch', () => {
    const strip = burnStrip(0xc8243c, 2);
    const geo = strip.object.geometry;
    expect(geo.drawRange.count).toBe(0);
    RUN.forEach((at, i) => {
      expect(strip.add(at)).toBe(true);
      expect(geo.drawRange.count).toBe((i + 2) * 6);
    });
    expect(strip.object.children).toHaveLength(0);
    const mat = strip.object.material as ShaderMaterial;
    expect(mat.transparent && mat.side === DoubleSide && mat.forceSinglePass && !mat.depthWrite).toBe(true);
    expect(mat.uniforms.uCount.value).toBe(5);
  });

  it('bounds just its patches (the culling sphere never reaches back to the origin)', () => {
    const strip = burnStrip(0xc8243c, 2);
    for (const at of RUN) strip.add(at);
    const sphere = strip.object.geometry.boundingSphere!;
    for (const at of RUN) expect(sphere.distanceToPoint(at)).toBeLessThanOrEqual(0);
    expect(sphere.distanceToPoint(new Vector3())).toBeGreaterThan(5);
    // Ends capped a radius past the first and last patch, the rows square to the run.
    const pos = strip.object.geometry.getAttribute('position');
    const cap = new Vector3(pos.getX(0) + pos.getX(1), pos.getY(0) + pos.getY(1), pos.getZ(0) + pos.getZ(1)).multiplyScalar(0.5);
    const along = RUN[1].clone().sub(RUN[0]).setY(0).normalize();
    expect(cap.x).toBeCloseTo(RUN[0].x - along.x * 2, 5);
    expect(cap.z).toBeCloseTo(RUN[0].z - along.z * 2, 5);
    const across = new Vector3(pos.getX(1) - pos.getX(0), 0, pos.getZ(1) - pos.getZ(0));
    expect(Math.abs(across.normalize().dot(along))).toBeLessThan(1e-6);
  });

  it('sits each row at its own patch height, a little above the ground', () => {
    const strip = burnStrip(0xc8243c, 2);
    for (const at of RUN) strip.add(at);
    const pos = strip.object.geometry.getAttribute('position');
    RUN.forEach((at, i) => expect(pos.getY((i + 1) * 2)).toBeCloseTo(at.y + 0.12, 6));
  });

  it('holds eight patches and refuses a ninth', () => {
    const strip = burnStrip(0xc8243c, 2);
    for (let i = 0; i < 8; i++) expect(strip.add(new Vector3(i * 2, 0, 0))).toBe(true);
    expect(strip.add(new Vector3(16, 0, 0))).toBe(false);
  });
});

describe('Vfx.path', () => {
  it('a cast of five patches is one object in the scene, lasting its duration past the last patch', () => {
    const vfx = new Vfx();
    const lay = vfx.path(0xc8243c, 2, 5);
    for (const at of RUN) { lay(at); vfx.update(0.14); }
    expect(vfx.group.children).toHaveLength(1);
    // Five zones of a ring and a disc each would have been ten planes.
    vfx.update(5 - 0.14 - 0.01);
    expect(vfx.group.children).toHaveLength(1);
    vfx.update(0.02);
    expect(vfx.group.children).toHaveLength(0);
  });

  it('pulses like a zone ring and fades over the last fifth', () => {
    const vfx = new Vfx();
    const lay = vfx.path(0xc8243c, 2, 5);
    lay(RUN[0]);
    const mat = (vfx.group.children[0] as unknown as { material: ShaderMaterial }).material;
    vfx.update(1);
    expect(mat.uniforms.uRim.value).toBeCloseTo(0.4 + Math.sin(9) * 0.15, 6);
    expect(mat.uniforms.uFade.value).toBe(1);
    vfx.update(3.5);
    expect(mat.uniforms.uFade.value).toBeCloseTo(0.5, 6);
  });
});

import { describe, expect, it } from 'vitest';
import { MeshStandardMaterial, PerspectiveCamera, type WebGLProgramParametersWithUniforms, type WebGLRenderer, Vector3 } from 'three';
import { COMBATFX_CLOCK, CombatFx, patchDissolve } from './CombatFx';

const cam = new PerspectiveCamera();
const P = new Vector3(1, 2, 3);
const A = new Vector3(0, 1, 0);
const B = new Vector3(0, 1.9, 0);
const UP = new Vector3(0, 1, 0);

function objects(fx: CombatFx): number {
  let n = 0;
  fx.group.traverse(() => n++);
  return n;
}

function visible(fx: CombatFx): number {
  let n = 0;
  fx.group.traverse((o) => { if (o !== fx.group && o.visible) n++; });
  return n;
}

const DARK = { trails: 0, arcs: 0, sparks: 0, flashes: 0, shocks: 0, dust: 0, telegraphs: 0, rune: false };

describe('CombatFx pools', () => {
  it('never grow: 1000 sparks() and 50 flash() calls leave the object count unchanged', () => {
    const fx = new CombatFx();
    const before = objects(fx);
    for (let i = 0; i < 1000; i++) fx.sparks(P, UP, 8, 0xff2a2a, 6);
    for (let i = 0; i < 50; i++) fx.flash(P, 0x37f5ff, 1.5);
    fx.update(1 / 60, cam);
    expect(objects(fx)).toBe(before);
    expect(fx.live.sparks).toBeLessThanOrEqual(256);
    expect(fx.live.flashes).toBeLessThanOrEqual(16);
    expect(fx.live.flashes).toBeGreaterThan(0);
  });

  it('sizes its pools from the options', () => {
    const fx = new CombatFx({ trails: 2, flashes: 4, shocks: 3, telegraphs: 2, sparks: 32, dust: 8 });
    for (let i = 0; i < 20; i++) fx.flash(P, 0xffffff, 1);
    for (let i = 0; i < 20; i++) fx.sparks(P, UP, 4, 0xffffff, 5);
    fx.update(0.01, cam);
    expect(fx.live.flashes).toBe(4);
    expect(fx.live.sparks).toBe(32);
    for (let i = 0; i < 5; i++) fx.shock(P, 0xffffff, 3, 0.5);
    expect(fx.live.shocks).toBe(3);
  });

  it('advances the shared clock in update()', () => {
    const fx = new CombatFx();
    const t0 = COMBATFX_CLOCK.value;
    fx.update(0.5, cam);
    expect(COMBATFX_CLOCK.value).toBeCloseTo(t0 + 0.5);
  });
});

describe('trails', () => {
  it('trail(id, ..., on=false) frees the slot and the ribbon fades out over ~0.15 s', () => {
    const fx = new CombatFx();
    fx.trail('a', A, B, 0xff2a2a, true);
    expect(fx.trailSlot('a')).toBeGreaterThanOrEqual(0);
    fx.update(1 / 60, cam);
    fx.trail('a', A, B, 0xff2a2a, true);
    fx.update(1 / 60, cam);
    expect(fx.live.trails).toBe(1);
    fx.trail('a', A, B, 0xff2a2a, false);
    expect(fx.trailSlot('a')).toBe(-1);
    fx.update(0.1, cam);
    expect(fx.live.trails).toBe(1);
    fx.update(0.1, cam);
    expect(fx.live.trails).toBe(0);
    expect(visible(fx)).toBe(0);
  });

  it('a fifth id steals the oldest finished slot', () => {
    const fx = new CombatFx();
    for (const id of ['a', 'b', 'c', 'd']) fx.trail(id, A, B, 0xffffff, true);
    fx.update(1 / 60, cam);
    const slotB = fx.trailSlot('b');
    fx.trail('b', A, B, 0xffffff, false);
    fx.update(0.01, cam);
    fx.trail('c', A, B, 0xffffff, false);
    fx.trail('e', A, B, 0xffffff, true);
    expect(fx.trailSlot('e')).toBe(slotB);
    expect(fx.trailSlot('a')).not.toBe(-1);
    expect(fx.trailSlot('d')).not.toBe(-1);
    expect(fx.live.trails).toBe(4);
  });

  it('with every slot swinging, a fifth id takes the one fed least recently', () => {
    const fx = new CombatFx();
    fx.trail('a', A, B, 0xffffff, true);
    fx.update(0.02, cam);
    for (const id of ['b', 'c', 'd']) fx.trail(id, A, B, 0xffffff, true);
    const slotA = fx.trailSlot('a');
    fx.trail('e', A, B, 0xffffff, true);
    expect(fx.trailSlot('a')).toBe(-1);
    expect(fx.trailSlot('e')).toBe(slotA);
  });

  it('a trail nobody feeds any more turns itself off', () => {
    const fx = new CombatFx();
    fx.trail('a', A, B, 0xffffff, true);
    for (let i = 0; i < 30; i++) fx.update(0.05, cam);
    expect(fx.trailSlot('a')).toBe(-1);
    expect(fx.live.trails).toBe(0);
  });
});

describe('telegraphs and the rest', () => {
  it("telegraph by id replaces the same id's shape", () => {
    const fx = new CombatFx();
    fx.telegraph(7, 'ring', P, 0, 3, 1, 0xff2a2a);
    const slot = fx.telegraphSlot(7);
    expect(slot).toBeGreaterThanOrEqual(0);
    fx.telegraph(7, 'cone', P, 1, 5, 2, 0x37f5ff);
    expect(fx.telegraphSlot(7)).toBe(slot);
    expect(fx.live.telegraphs).toBe(1);
    fx.telegraph(8, 'disc', P, 0, 2, 0.5, 0xffffff);
    expect(fx.live.telegraphs).toBe(2);
    fx.update(0.6, cam);
    expect(fx.live.telegraphs).toBe(1);
    expect(fx.telegraphSlot(8)).toBe(-1);
    fx.update(2, cam);
    expect(fx.live.telegraphs).toBe(0);
  });

  it('every effect ends on its own and the rune fades out', () => {
    const fx = new CombatFx();
    fx.arc(P, 0.3, 0.2, 2, 0xff2a2a);
    fx.shock(P, 0xff2a2a, 4, 0.3);
    fx.dust(P, 1);
    fx.sparks(P, UP, 12, 0xff2a2a, 5);
    fx.flash(P, 0xff2a2a, 2);
    fx.rune(P, 0x37f5ff, true);
    fx.update(0.05, cam);
    expect(fx.live).toMatchObject({ arcs: 1, shocks: 1, flashes: 1, sparks: 12, rune: true });
    expect(fx.live.dust).toBeGreaterThanOrEqual(3);
    fx.rune(P, 0x37f5ff, false);
    for (let i = 0; i < 60; i++) fx.update(1 / 30, cam);
    expect(fx.live).toEqual(DARK);
    expect(visible(fx)).toBe(0);
  });

  it('update() with nothing live is cheap and leaves nothing visible', () => {
    const fx = new CombatFx();
    const t0 = performance.now();
    for (let i = 0; i < 10000; i++) fx.update(1 / 60, cam);
    expect(performance.now() - t0).toBeLessThan(1000);
    expect(fx.live).toEqual(DARK);
    expect(visible(fx)).toBe(0);
  });

  it('dispose() empties the group', () => {
    const fx = new CombatFx();
    fx.dispose();
    expect(fx.group.children.length).toBe(0);
  });
});

describe('patchDissolve', () => {
  it('returns a uniform and sets customProgramCacheKey', () => {
    const mat = new MeshStandardMaterial();
    const keyBefore = mat.customProgramCacheKey();
    const u = patchDissolve(mat, 0xff2a2a);
    expect(u).toEqual({ value: 0 });
    expect(mat.customProgramCacheKey()).not.toBe(keyBefore);
    expect(mat.customProgramCacheKey()).toContain('dissolve');
    // Runs against the standard chunks: a discard after the clipping planes, the edge glow on the emissive.
    const shader = {
      uniforms: {} as Record<string, { value: unknown }>,
      vertexShader: '#include <common>\n#include <worldpos_vertex>',
      fragmentShader: '#include <common>\n#include <clipping_planes_fragment>\n#include <emissivemap_fragment>',
    };
    mat.onBeforeCompile(shader as unknown as WebGLProgramParametersWithUniforms, undefined as unknown as WebGLRenderer);
    expect(shader.uniforms.uDissolve).toBe(u);
    expect(shader.vertexShader).toContain('vDissolveP');
    expect(shader.fragmentShader).toContain('discard');
    expect(shader.fragmentShader).toContain('totalEmissiveRadiance += uDissolveEdge');
  });

  it('chains an earlier onBeforeCompile', () => {
    const mat = new MeshStandardMaterial();
    let called = 0;
    mat.onBeforeCompile = () => { called++; };
    patchDissolve(mat, 0x37f5ff);
    const shader = { uniforms: {}, vertexShader: '', fragmentShader: '' };
    mat.onBeforeCompile(shader as unknown as WebGLProgramParametersWithUniforms, undefined as unknown as WebGLRenderer);
    expect(called).toBe(1);
  });
});

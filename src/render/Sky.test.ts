import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Color, type Mesh, type ShaderMaterial, type Sprite, Vector3 } from 'three';
import { REALM_SKY } from '../data/world';
import { CAMERA_JUMP, CameraJump, SKIES, SKY_SHARED, Sky, type SkyPreset } from './Sky';

/** Enough of a 2D canvas for the sky's textures to draw on (every call a no-op; gradients take their stops). */
const ctx = new Proxy({} as Record<string | symbol, unknown>, {
  get: (t, k) => (k in t ? t[k] : () => ({ addColorStop() {} })),
  set: (t, k, v) => { t[k] = v; return true; },
});
beforeEach(() => vi.stubGlobal('document', { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) }));
afterEach(() => vi.unstubAllGlobals());

/** The sky's own parts the tests look at (private in Sky). */
interface Parts { domeMat: ShaderMaterial; eclipse: Mesh; moon: Mesh; glow: Sprite; skyFace: Sprite; streak: Sprite; starMat: ShaderMaterial }
const parts = (s: Sky) => s as unknown as Parts;
const island = new Vector3(0, 30, 60);
const drowned = new Vector3(-1000, -44, 50);
/** A sky that has seen the camera on the island for a while (its preset settled, the next change eased). */
function settled(): Sky {
  const s = new Sky();
  s.setPreset(SKIES.island);
  s.setReflection(null);
  for (let i = 0; i < 3; i++) s.update(0.016, island);
  return s;
}
const hex = (c: Color) => c.getHex();
const uniformHex = (s: Sky, name: string) => hex(parts(s).domeMat.uniforms[name].value as Color);

describe('CameraJump', () => {
  it('a first frame is a jump; then only a move of more than CAMERA_JUMP metres in one frame', () => {
    const j = new CameraJump();
    expect(j.jumped).toBe(true);
    expect(j.update({ x: 0, y: 30, z: 0 })).toBe(true);
    expect(j.update({ x: 40, y: 32, z: -30 })).toBe(false);
    expect(j.update({ x: 40 + CAMERA_JUMP * 0.9, y: 32, z: -30 })).toBe(false);
    expect(j.update({ x: -1000, y: -44, z: 50 })).toBe(true);
    expect(j.jumped).toBe(true);
    expect(j.update({ x: -1000, y: -44, z: 49 })).toBe(false);
    // Straight up or down counts too.
    expect(j.update({ x: -1000, y: -44 + CAMERA_JUMP + 1, z: 49 })).toBe(true);
  });
});

describe('SKIES.sunken', () => {
  it('is the lake murk: the fog colour at the horizon, no moon, black sun, stars, vortex, nebula or wonders', () => {
    const p: SkyPreset = SKIES.sunken;
    expect(p).toBeDefined();
    expect(p.horizon).toBe(0x0a3a4e);
    for (const k of ['vortex', 'nebula', 'stars', 'moon', 'eclipse', 'wonders', 'swirl'] as const) expect(p[k], k).toBe(0);
    // Every colour a dark teal: more green and blue than red, nothing bright.
    for (const c of [p.horizon, p.mid, p.zenith, p.cloudDark, p.cloudLit]) {
      const col = new Color(c);
      expect(col.g).toBeGreaterThan(col.r);
      expect(col.b).toBeGreaterThan(col.r);
      expect(Math.max(col.r, col.g, col.b)).toBeLessThan(0.1);
    }
  });

  it('every other sky keeps its wonders', () => {
    for (const id of ['island', 'vale', 'graveyard']) expect(SKIES[id].wonders, id).toBe(1);
  });
});

describe('Sky arriving somewhere (a teleport)', () => {
  it('takes the new place’s sky at once: under the lake no black sun, moon or star on the frame it arrives', () => {
    const s = settled();
    expect(parts(s).eclipse.visible).toBe(true);
    s.update(0.016, drowned);
    s.setPreset(SKIES.sunken);
    expect(parts(s).eclipse.visible).toBe(false);
    expect(parts(s).glow.visible).toBe(false);
    expect(parts(s).moon.visible).toBe(false);
    expect(parts(s).starMat.uniforms.uOpacity.value).toBeCloseTo(0, 9);
    expect(uniformHex(s, 'uHorizon')).toBe(SKIES.sunken.horizon);
    expect(uniformHex(s, 'uMid')).toBe(SKIES.sunken.mid);
    expect(uniformHex(s, 'uZenith')).toBe(SKIES.sunken.zenith);
    expect(uniformHex(s, 'uCloudLit')).toBe(SKIES.sunken.cloudLit);
    expect(parts(s).domeMat.uniforms.uNebula.value).toBeCloseTo(0, 9);
    expect(parts(s).domeMat.uniforms.uVortexAmount.value).toBeCloseTo(0, 9);
    // And straight back to the island's whole night on the way home.
    s.update(0.016, island);
    s.setPreset(SKIES.island);
    expect(parts(s).eclipse.visible).toBe(true);
    expect(uniformHex(s, 'uHorizon')).toBe(SKIES.island.horizon);
  });

  it('without a teleport a new sky still blends in over a couple of seconds', () => {
    const s = settled();
    s.update(0.016, island);
    s.setPreset(SKIES.graveyard);
    expect(uniformHex(s, 'uHorizon')).toBe(SKIES.island.horizon);
    s.update(0.5, island);
    const h = parts(s).domeMat.uniforms.uHorizon.value as Color;
    expect(h.getHex()).not.toBe(SKIES.island.horizon);
    expect(h.getHex()).not.toBe(SKIES.graveyard.horizon);
    for (let i = 0; i < 100; i++) s.update(0.1, island);
    expect(h.getHex()).toBe(SKIES.graveyard.horizon);
  });

  it('under the lake no shooting star, face in the clouds or moon glow ever shows', () => {
    const s = settled();
    s.update(0.016, drowned);
    s.setPreset(SKIES.sunken);
    expect(hex(parts(s).domeMat.uniforms.uMoonGlow.value as Color)).toBe(0);
    let streak = 0, face = 0;
    // (The face shows 99-140 s into each 180 s; the first shooting star 3 s in, then every 8-14 s.)
    for (let t = 0; t < 200; t += 0.1) {
      s.update(0.1, drowned);
      s.setPreset(SKIES.sunken);
      streak = Math.max(streak, parts(s).streak.material.opacity);
      face = Math.max(face, parts(s).skyFace.material.opacity);
    }
    expect(streak).toBe(0);
    expect(face).toBe(0);
    // A blood moon under the lake stays out of the murk too.
    s.setBloodMoon(true);
    expect(hex(parts(s).domeMat.uniforms.uMoonGlow.value as Color)).toBe(0);
  });

  it('the island still has its shooting stars and its face in the clouds', () => {
    const s = settled();
    let streak = 0, face = 0;
    for (let t = 0; t < 200; t += 0.1) {
      s.update(0.1, island);
      s.setPreset(SKIES.island);
      streak = Math.max(streak, parts(s).streak.material.opacity);
      face = Math.max(face, parts(s).skyFace.material.opacity);
    }
    expect(streak).toBeGreaterThan(0.5);
    expect(face).toBeGreaterThan(0.5);
    expect(hex(parts(s).domeMat.uniforms.uMoonGlow.value as Color)).not.toBe(0);
  });
});

describe('Sky reflections (SKY_SHARED)', () => {
  const shared = () => [SKY_SHARED.uSkyHorizon, SKY_SHARED.uSkyMid, SKY_SHARED.uSkyZenith, SKY_SHARED.uSkyCloud].map((u) => u.value.getHex());

  it('after a teleport the water reflects the new place’s sky at once, and the island’s own on the way back', () => {
    const s = settled();
    expect(shared()).toEqual([SKIES.island.horizon, SKIES.island.mid, SKIES.island.zenith, SKIES.island.cloudLit]);
    const sunk = REALM_SKY.sunken!;
    s.update(0.016, drowned);
    s.setPreset(SKIES.sunken);
    s.setReflection(sunk);
    expect(shared()).toEqual([sunk.horizon, sunk.mid, sunk.zenith, sunk.cloud]);
    s.update(0.016, island);
    s.setPreset(SKIES.island);
    s.setReflection(null);
    expect(shared()).toEqual([SKIES.island.horizon, SKIES.island.mid, SKIES.island.zenith, SKIES.island.cloudLit]);
  });

  it('without a teleport it eases (1 − e^(−2·dt)) toward a changing sky, read each frame', () => {
    const s = settled();
    const pink = { horizon: new Color(0xff3fa0), mid: new Color(0x5a1f8a), zenith: new Color(0x0a0c2a), cloud: new Color(0xd060ff) };
    s.update(0.016, island);
    s.setReflection(pink);
    expect(SKY_SHARED.uSkyHorizon.value.getHex()).toBe(SKIES.island.horizon);
    const before = SKY_SHARED.uSkyHorizon.value.clone();
    s.update(0.25, island);
    const k = 1 - Math.exp(-2 * 0.25);
    expect(SKY_SHARED.uSkyHorizon.value.r).toBeCloseTo(before.r + (pink.horizon.r - before.r) * k, 6);
    // The same object, changed in place (the kingdom's night): followed.
    pink.horizon.set(0x2a0a40);
    for (let i = 0; i < 100; i++) s.update(0.1, island);
    expect(SKY_SHARED.uSkyHorizon.value.getHex()).toBe(0x2a0a40);
  });
});

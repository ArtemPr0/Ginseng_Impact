import { describe, expect, it } from 'vitest';
import { Color } from 'three';
import { CLOUD_LEVEL, GALAXY } from '../data/world';
import { KINGDOM_SKY_GLSL, kingdomSkyAt, kingdomSkyColors, type KingdomSkyColors, WIRE_FADE, wireComputer, wireComputerSpot } from './Kingdom';

/** The dome shader's own numbers, written out by hand (zenith, middle, low; plaza = night 0, quarters = night 1). */
const SHADER = {
  zen: [[0.03, 0.04, 0.16], [0.008, 0.01, 0.045]],
  mid: [[0.24, 0.08, 0.42], [0.07, 0.03, 0.16]],
  low: [[1.0, 0.31, 0.69], [0.26, 0.09, 0.34]],
  ink: [[0.55, 0.2, 0.95], [1.0, 0.35, 0.75]],
  aurora: [0.75, 0.3],
} as const;

/** GLSL smoothstep (the dome also runs it with edge0 > edge1). */
const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** The dome's gradient as its fragment shader computes it, channel by channel, for night 0 or 1. */
function shaderSky(e: number, n: 0 | 1): number[] {
  return [0, 1, 2].map((i) => {
    let c = SHADER.mid[n][i] + (SHADER.zen[n][i] - SHADER.mid[n][i]) * smoothstep(0.1, 0.75, e);
    c += (SHADER.low[n][i] - c) * smoothstep(0.32, -0.02, e) * 0.85;
    return c;
  });
}
const fresh = (): KingdomSkyColors => ({ horizon: new Color(), mid: new Color(), zenith: new Color(), cloud: new Color() });
const rgb = (c: Color) => [c.r, c.g, c.b];
const close = (a: number[], b: readonly number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 6));

describe('kingdomSkyColors', () => {
  for (const n of [0, 1] as const) {
    it(`at night ${n} is the dome's own sky: its zenith constant overhead, its gradient at the horizon and the middle`, () => {
      const s = kingdomSkyColors(n, fresh());
      close(rgb(s.zenith), SHADER.zen[n]);
      close(rgb(s.horizon), shaderSky(0, n));
      close(rgb(s.mid), shaderSky(0.3, n));
      // The clouds: the aurora's average ink over the sky at its band's middle, as strong as the dome draws it.
      const ink = [0, 1, 2].map((i) => ((SHADER.ink[0][i] + SHADER.ink[1][i]) / 2) * SHADER.aurora[n]);
      close(rgb(s.cloud), shaderSky(0.5, n).map((v, i) => v + ink[i]));
    });
  }

  it('the horizon is the neon pink low band at the plaza, a dim violet in the quarters', () => {
    const plaza = kingdomSkyColors(0, fresh()).horizon;
    const night = kingdomSkyColors(1, fresh()).horizon;
    expect(plaza.r).toBeGreaterThan(plaza.b);
    expect(plaza.r).toBeGreaterThan(0.8);
    expect(night.r).toBeLessThan(plaza.r * 0.4);
  });

  it('blends linearly between the plaza and the night', () => {
    const half = kingdomSkyColors(0.5, fresh());
    const z0 = SHADER.zen[0], z1 = SHADER.zen[1];
    close(rgb(half.zenith), [0, 1, 2].map((i) => (z0[i] + z1[i]) / 2));
  });

  it('writes into one shared sky by default (no garbage each frame)', () => {
    expect(kingdomSkyColors(0.2)).toBe(kingdomSkyColors(0.7));
  });

  it('kingdomSkyAt is the shader formula at any height', () => {
    for (const e of [-0.4, -0.02, 0, 0.1, 0.3, 0.5, 0.75, 1]) close(rgb(kingdomSkyAt(e, 1, new Color())), shaderSky(e, 1));
  });
});

describe('the dome shader', () => {
  it('is written from the same constants', () => {
    const v = (c: readonly number[]) => `vec3(${c.map((x) => x.toFixed(3)).join(', ')})`;
    for (const k of ['zen', 'mid', 'low'] as const) {
      expect(KINGDOM_SKY_GLSL).toContain(`mix(${v(SHADER[k][0])}, ${v(SHADER[k][1])}, uNight)`);
    }
    expect(KINGDOM_SKY_GLSL).toContain('smoothstep(0.1, 0.75, e)');
    expect(KINGDOM_SKY_GLSL).toContain('smoothstep(0.32, -0.02, e) * 0.85');
  });
});

describe('the wire computers', () => {
  it('stand far out, sunk whole in the cloud sea: every top, bobbing 2 m, stays 2 m under its top layer', () => {
    const clouds = CLOUD_LEVEL.galaxy!;
    const { top } = wireComputer(0x5ee8ff);
    // (The tower case's top, the highest of its boxes.)
    expect(top).toBeCloseTo(1.4, 6);
    for (let i = 0; i < 7; i++) {
      const s = wireComputerSpot(i, clouds, top);
      expect(s.y + top * s.size + 2, `computer ${i}`).toBeLessThanOrEqual(clouds - 2);
      expect(s.dist, `computer ${i}`).toBeGreaterThan(GALAXY.radius + 100);
    }
  });

  it('glow without writing depth (a line drawn before the clouds must not cut holes in the layers behind it)', () => {
    const { mat } = wireComputer(0xff5ec8);
    expect(mat.depthWrite).toBe(false);
    expect(mat.transparent).toBe(true);
    expect(mat.fog).toBe(true);
  });

  it('are gone past 320 m from the camera (the plan)', () => {
    expect(WIRE_FADE[0]).toBeLessThan(WIRE_FADE[1]);
    expect(WIRE_FADE[1]).toBeLessThanOrEqual(320);
  });
});

/**
 * The inside of a break (the quality pass of 2026-11-16): what a cut through a wall, a trunk or a boulder shows —
 * grainy stone with darker pits and pale chips, splintered wood with its grain, rough plaster, dull metal, cloudy
 * glass or crystal. Drawn in code with triplanar noise on the chunk's own position, so it needs no UVs and every cut
 * face differs. It takes no self-glow (the outside of a model keeps the cobalt rim; the inside is dark and real).
 */
import { Color, MeshStandardMaterial } from 'three';
import { GLSL_NOISE_BASIC } from './glsl';

export type BreakKind = 'stone' | 'wood' | 'plaster' | 'metal' | 'glass' | 'crystal' | 'bone' | 'earth';

const LOOK: Record<BreakKind, { color: number; dark: number; rough: number; metal: number; grain: number; scale: number }> = {
  stone: { color: 0x77727c, dark: 0x3a373f, rough: 0.95, metal: 0, grain: 0, scale: 3.5 },
  plaster: { color: 0x9a9083, dark: 0x5e5549, rough: 0.98, metal: 0, grain: 0, scale: 6 },
  wood: { color: 0x7a5434, dark: 0x3b2616, rough: 0.9, metal: 0, grain: 1, scale: 2.5 },
  metal: { color: 0x6c6c74, dark: 0x34343a, rough: 0.5, metal: 0.8, grain: 0, scale: 8 },
  glass: { color: 0x8fb8d6, dark: 0x3e5a70, rough: 0.15, metal: 0, grain: 0, scale: 5 },
  crystal: { color: 0x9b6ad8, dark: 0x40246a, rough: 0.25, metal: 0, grain: 0, scale: 4 },
  bone: { color: 0xcfc6b0, dark: 0x8a7f68, rough: 0.9, metal: 0, grain: 0, scale: 7 },
  earth: { color: 0x4a3a2c, dark: 0x221a12, rough: 1, metal: 0, grain: 0, scale: 2.2 },
};

const cache = new Map<BreakKind, MeshStandardMaterial>();

export function breakMaterial(kind: BreakKind): MeshStandardMaterial {
  const hit = cache.get(kind);
  if (hit) return hit;
  const l = LOOK[kind];
  const m = new MeshStandardMaterial({ color: l.color, roughness: l.rough, metalness: l.metal });
  const dark = new Color(l.dark);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uDark = { value: dark };
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vBrkPos;\nvarying vec3 vBrkNrm;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvBrkPos = position;\nvBrkNrm = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
uniform vec3 uDark;
varying vec3 vBrkPos;
varying vec3 vBrkNrm;
${GLSL_NOISE_BASIC}
float tri(vec3 p, vec3 n) {
  vec3 w = abs(n); w /= (w.x + w.y + w.z + 1e-4);
  return fbm(p.yz) * w.x + fbm(p.zx) * w.y + fbm(p.xy) * w.z;
}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 p = vBrkPos * ${l.scale.toFixed(2)};
    float n = tri(p, vBrkNrm);
    float fine = tri(p * 4.7 + 3.1, vBrkNrm);
    ${l.grain ? `// Wood: long grain along the trunk (y), with splinter streaks.
    float g = sin(vBrkPos.x * 40.0 + n * 9.0) * 0.5 + 0.5;
    n = mix(n, g, 0.55);` : ''}
    float k = smoothstep(0.25, 0.75, n) * 0.75 + fine * 0.25;
    diffuseColor.rgb = mix(uDark, diffuseColor.rgb, k);
    // Pale chips and dark pits.
    diffuseColor.rgb *= 0.85 + 0.3 * step(0.78, fine);
    diffuseColor.rgb *= 1.0 - 0.35 * step(fine, 0.2);
  }`);
  };
  m.customProgramCacheKey = () => `break-${kind}`;
  cache.set(kind, m);
  return m;
}

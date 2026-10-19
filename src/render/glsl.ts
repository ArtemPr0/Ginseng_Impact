/**
 * GLSL shared by the procedural shaders, so one hash/noise/cell family lives in one place instead of a pasted copy
 * per file. These are the Floors.ts formulas (a sine-free Hoskins hash, so world coordinates do not draw stripes;
 * value noise; 4-octave fbm; two-nearest-seed cells) plus Kingdom.ts's Voronoi edge and Floors' rectangle SDF.
 * Each block is one declaration, so a shader can take only the functions it needs and stay byte-identical to the
 * copy it replaced. Other files keep their own sine hash + 3-octave fbm on purpose: swapping it would change the look.
 */
export const GLSL_HASH = /* glsl */ `float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }`;
export const GLSL_VNOISE = /* glsl */ `float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }`;
export const GLSL_FBM = /* glsl */ `float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }`;
export const GLSL_CELLS = /* glsl */ `// Cells: distance to the nearest seed and to the second nearest (stones, cracks).
vec2 cells(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y); vec2 o = vec2(hash(i + g), hash(i + g + 17.3));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}`;

/** hash + vnoise + fbm (what LeanFx and the kingdom's shaders use). */
export const GLSL_NOISE_BASIC = /* glsl */ `
${GLSL_HASH}
${GLSL_VNOISE}
${GLSL_FBM}`;

/** hash + vnoise + fbm + cells: Floors.ts's NOISE block, the ground's noise family. */
export const GLSL_NOISE = /* glsl */ `${GLSL_NOISE_BASIC}
${GLSL_CELLS}`;

/** Distance to the nearest Voronoi edge (cracks, ore veins); needs `hash`. */
export const GLSL_VORONOI_EDGE = /* glsl */ `// Distance to the nearest Voronoi edge (cracks, veins).
float voronoiEdge(vec2 p) {
  vec2 n = floor(p); vec2 f = fract(p); vec2 mg, mr; float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(i, j); vec2 o = vec2(hash(n + g), hash(n + g + 17.3)); vec2 r = g + o - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; } }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { vec2 g = mg + vec2(i, j); vec2 o = vec2(hash(n + g), hash(n + g + 17.3)); vec2 r = g + o - f; if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr))); }
  return md;
}`;

/** Signed distance to a rectangle [x0, x1, z0, z1] (negative inside). */
export const GLSL_SDRECT = /* glsl */ `float sdRect(vec2 p, vec4 r) { vec2 c = vec2(r.x + r.y, r.z + r.w) * 0.5; vec2 h = vec2(r.y - r.x, r.w - r.z) * 0.5; vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }`;

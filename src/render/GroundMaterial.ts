/**
 * The ground's splat material: one lit MeshStandardMaterial for every chunk of every heightfield. The vertex colour
 * is the ground's tint, its hue and brightness near and far; up close (under uDetailFar) the twelve layer weights
 * (layerA/B/C vertex attributes, see Ground.ts LAYER) blend the procedural patterns ported from Floors.ts, Kingdom.ts's
 * porcelain and the graveyard's moss, and the tint takes their pattern but not their colour (the pattern over its
 * mean: Ground.ts splatAlbedo). Each layer has its own roughness (never under the material's roughness floor: the
 * island's sculpt keeps its stone matt under the low moon) and a relief height that bumps the normal, so moonlight and
 * bloom catch stone edges. Marble carries pulsing ore veins and, with wet ground, a Fresnel gloss of the
 * same sky the water reflects (SKY_SHARED). Fog, lights and shadows are the standard chunks: the ground is lit and
 * shadowed like everything else.
 *
 * Pattern: patchGlowCap (Materials.ts) — onBeforeCompile replacing chunks + customProgramCacheKey.
 */
import { MeshStandardMaterial } from 'three';
import { GLSL_NOISE, GLSL_VORONOI_EDGE } from './glsl';
import { LAYER, LAYER_TINT, PATTERN_RATIO, TEXTURE_LAYERS } from './Ground';
import { SKY_SHARED } from './Sky';

/** The ground's uniforms (uTime is advanced by the frame loop; sky uniforms are SKY_SHARED's own objects). */
export const GROUND_UNIFORMS = {
  uTime: { value: 0 },
  /** Metres: the patterns fade into the far tint between 60 % of this and this. */
  uDetailFar: { value: 140 },
  /** Relief strength (0 flat … 1 = BUMP_METRES of relief). */
  uBump: { value: 1.0 },
};

/** Physical height of the layer relief in metres at uBump = 1 (a cobble ~8 cm proud of its gap). */
const BUMP_METRES = 0.08;
/** The ore veins' strength: porcelainFloor's 1.9 at half. */
const ORE_STRENGTH = 1.9 * 0.5;
/** Marble brightness in Floors space (porcelainFloor drew base × 0.42 plus a reflection; this stands in for both). */
const MARBLE_LEVEL = 0.75;

const num = (v: number) => v.toFixed(4);
const vec3 = (t: ArrayLike<number>) => `vec3(${num(t[0])}, ${num(t[1])}, ${num(t[2])})`;

/** LAYER_TINT as GLSL constants (TINT_GRASS … TINT_SEABED), generated from the TS table so the two never drift. */
const TINT_DEFINES = (Object.keys(LAYER) as Array<keyof typeof LAYER>)
  .filter((name) => LAYER[name] < TEXTURE_LAYERS)
  .map((name) => `#define TINT_${name.toUpperCase()} ${vec3(LAYER_TINT[LAYER[name]])}`)
  .join('\n');

/** Declarations added after <common> in the fragment shader: uniforms, varyings, noise, the sky and the layers. */
const FRAG_COMMON = /* glsl */ `
${TINT_DEFINES}
#define PATTERN_MIN ${num(PATTERN_RATIO[0])}
#define PATTERN_MAX ${num(PATTERN_RATIO[1])}
#define BUMP_METRES ${num(BUMP_METRES)}
#define ORE_STRENGTH ${num(ORE_STRENGTH)}
#define MARBLE_LEVEL ${num(MARBLE_LEVEL)}
uniform float uTime; uniform float uDetailFar; uniform float uBump; uniform float uRoughFloor;
uniform vec3 uSkyHorizon; uniform vec3 uSkyMid; uniform vec3 uSkyZenith; uniform vec3 uSkyCloud; uniform vec3 uMoonDir; uniform vec3 uMoonCol; uniform float uSkyTime;
varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec3 vW; varying float vDist;
${GLSL_NOISE}
${GLSL_VORONOI_EDGE}
// The sky as seen in a reflection (Water.ts WATER_COMMON's skyColor, so the gloss matches the water's sky).
vec3 skyColor(vec3 r) {
  float y = max(r.y, 0.0);
  vec3 c = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.3, y));
  c = mix(c, uSkyZenith, smoothstep(0.3, 0.95, y));
  vec2 p = r.xz / (y + 0.14) * 0.85 + vec2(uSkyTime * 0.012, uSkyTime * 0.004);
  c = mix(c, uSkyCloud * 0.75, smoothstep(0.42, 0.78, fbm(p * 1.25)) * 0.7 * smoothstep(0.0, 0.15, y));
  float m = max(dot(r, uMoonDir), 0.0);
  return c + uMoonCol * (pow(m, 1400.0) * 40.0 + pow(m, 90.0) * 1.2 + pow(m, 10.0) * 0.18);
}
// ---- The layers: each returns vec4(colour in Floors space, relief height 0..1). ----
// Night grass: blue-green tufts under the moon, a little lighter where the aurora catches it.
vec4 grassTex(vec2 p) {
  float n = fbm(p * 0.15);
  float tuft = fbm(p * 2.4);
  vec3 c = mix(vec3(0.05, 0.12, 0.09), vec3(0.11, 0.24, 0.17), n) * (0.7 + 0.5 * tuft);
  c += vec3(0.03, 0.08, 0.06) * smoothstep(0.6, 0.9, fbm(p * 0.04 + 7.0));
  return vec4(c, tuft);
}
// Moss (the Alley of Graves' floor): deep greens with darker patches. (×2.5: Graveyard wrote linear values.)
vec4 mossTex(vec2 p) {
  vec3 c = mix(vec3(0.012, 0.03, 0.02), vec3(0.035, 0.085, 0.045), fbm(p * 0.6)) * 2.5;
  float v = vnoise(p * 3.0);
  c *= 0.7 + v * 0.5;
  return vec4(c, v * 0.6);
}
// Rock (the sky dock's rockTop): dark cracked rock, moss in the hollows.
vec4 rockTex(vec2 p) {
  vec2 cl = cells(p * 0.55);
  float crack = smoothstep(0.0, 0.07, cl.y - cl.x);
  vec3 c = mix(vec3(0.045, 0.05, 0.08), vec3(0.1, 0.11, 0.15), fbm(p * 0.35)) * (0.5 + 0.5 * crack);
  c = mix(c, vec3(0.05, 0.09, 0.06), smoothstep(0.55, 0.78, fbm(p * 0.8 + 3.1)) * 0.7);
  return vec4(c, crack);
}
// Soil: a worn earth path, dark and slightly warm-grey, mottled, with grit.
vec4 soilTex(vec2 p) {
  float n = fbm(p * 0.5);
  float grit = vnoise(p * 6.0);
  vec3 c = mix(vec3(0.13, 0.12, 0.12), vec3(0.22, 0.2, 0.19), n) * (0.8 + 0.3 * grit);
  return vec4(c, grit * 0.35);
}
// Dark cracked flagstones, blue-black, faintly lit \`glow\` in the cracks (the fountain hall, the court, the yard).
vec4 flagstoneTex(vec2 p, vec3 glow) {
  vec2 cl = cells(p * 0.55);
  float seam = smoothstep(0.06, 0.0, cl.y - cl.x);
  float stone = hash(floor(p * 0.55 + cl.x));
  vec3 c = mix(vec3(0.06, 0.07, 0.13), vec3(0.13, 0.14, 0.24), stone) * (0.75 + 0.35 * fbm(p * 0.9));
  c *= 1.0 - seam * 0.7;
  float crack = smoothstep(0.03, 0.0, abs(fbm(p * 0.25) - 0.5)) * 0.8;
  return vec4(c + glow * (seam * 0.25 + crack * 0.35), (1.0 - seam) * (1.0 - crack * 0.5));
}
// Rounded cobbles in blue-grey (the drowned street), each stone catching a little light at its top.
vec4 cobbleTex(vec2 p) {
  vec2 cl = cells(p * 1.4);
  float stone = smoothstep(0.75, 0.1, cl.x);
  float gap = smoothstep(0.1, 0.0, cl.y - cl.x);
  float tone = hash(floor(p * 1.4 + cl.x * 3.0));
  vec3 c = mix(vec3(0.16, 0.22, 0.3), vec3(0.42, 0.52, 0.64), tone * 0.6 + 0.2) * (0.35 + 0.75 * stone);
  return vec4(mix(c, vec3(0.02, 0.04, 0.06), gap), stone * (1.0 - gap));
}
// Fresh snow under a moon: blue-white drifts and a sparkle that comes and goes as you move.
vec4 snowTex(vec2 p) {
  float drift = fbm(p * 0.12);
  vec3 c = mix(vec3(0.24, 0.3, 0.46), vec3(0.5, 0.57, 0.76), drift) * (0.82 + 0.18 * fbm(p * 1.1));
  float sparkle = step(0.985, hash(floor(p * 18.0))) * (0.5 + 0.5 * sin(dot(cameraPosition.xz, vec2(3.1, 2.3)) + hash(floor(p * 18.0)) * 40.0));
  return vec4(c + vec3(0.6, 0.7, 0.9) * sparkle, drift);
}
// Sand: the island's dune colour (Terrain's 0xa9b2cf) in wind ripples, with grain.
vec4 sandTex(vec2 p) {
  float warp = fbm(p * 0.08);
  float ripple = 0.5 + 0.5 * sin(p.x * 2.2 + p.y * 0.6 + warp * 9.0);
  ripple *= ripple;
  float grain = vnoise(p * 7.0);
  vec3 c = mix(vec3(0.42, 0.44, 0.54), vec3(0.66, 0.7, 0.81), ripple * 0.6 + grain * 0.25);
  return vec4(c, ripple);
}
// The dead forest's red-purple leaf floor (Terrain's deadA / deadB in patches), rustled into drifts.
vec4 deadTex(vec2 p) {
  float blotch = smoothstep(0.45, 0.55, vnoise(p * 0.09)); // ('patch' is a reserved word in GLSL ES 3.00)
  float leaf = fbm(p * 1.8);
  vec3 c = mix(vec3(0.29, 0.078, 0.19), vec3(0.416, 0.165, 0.235), blotch) * (0.75 + 0.5 * leaf);
  return vec4(c, leaf);
}
// Cracked polished porcelain and marble laid as a chessboard, grey-veined: porcelainFloor without its reflection
// (the ore veins are emissive below, the sky gloss is the Fresnel term).
vec4 marbleTex(vec2 p) {
  vec2 tile = p / 4.0;
  float checker = mod(floor(tile.x) + floor(tile.y), 2.0);
  vec2 ft = abs(fract(tile) - 0.5);
  float seam = smoothstep(0.485, 0.5, max(ft.x, ft.y));
  float m = fbm(p * 0.35);
  float vein = smoothstep(0.035, 0.0, abs(sin((p.x * 0.45 + p.y * 0.2 + m * 4.0) * 1.7)) * (0.6 + m));
  vec3 white = vec3(0.86, 0.86, 0.9), grey = vec3(0.6, 0.6, 0.68);
  vec3 base = mix(grey, white, checker) * (0.9 + 0.12 * m);
  base = mix(base, vec3(0.38, 0.38, 0.46), vein * 0.5);
  float crack = smoothstep(0.035, 0.0, voronoiEdge(p * 0.22));
  vec3 c = base * MARBLE_LEVEL * (1.0 - seam * 0.5) * (1.0 - crack * 0.55);
  return vec4(c, 1.0 - max(seam, crack));
}
// The sea bed round the drowned city: dark blue-green silt in soft ripples.
vec4 seabedTex(vec2 p) {
  float ripple = 0.5 + 0.5 * sin(p.x * 0.9 + fbm(p * 0.2) * 6.0);
  vec3 c = mix(vec3(0.02, 0.06, 0.08), vec3(0.05, 0.12, 0.14), fbm(p * 0.08)) * (0.8 + 0.25 * ripple);
  return vec4(c, ripple);
}`;

/**
 * Replaces <color_fragment>: the tint (vertex colour) everywhere, and up close (under uDetailFar) the weighted layers'
 * pattern over its mean (the same weights mixing TINT_*) laid on it, per channel: hue from the tint, pattern from the
 * layers (Ground.ts splatAlbedo is this in JS). Only layers with weight > 0.02 are evaluated; the mix is normalised by
 * their sum with grass as the fallback, so no pixel is ever black. Leaves gDetail / gBump / gRough / gMarble / gWet for
 * the chunks after it.
 */
const COLOR_FRAGMENT = /* glsl */ `
float gDetail = 1.0 - smoothstep(uDetailFar * 0.6, uDetailFar, vDist);
float gBump = 0.0;
float gRough = roughness;
float gMarble = vC.y;
float gWet = vC.w;
{
  vec3 ground = vColor.rgb;
  if (gDetail > 0.001) {
    vec2 p = vW.xz;
    vec4 acc = vec4(0.0);
    vec3 patternMean = vec3(0.0);
    float wsum = 0.0, rough = 0.0, w;
    w = vA.x; if (w > 0.02) { acc += grassTex(p) * w; patternMean += TINT_GRASS * w; rough += 0.95 * w; wsum += w; }
    w = vA.y; if (w > 0.02) { acc += mossTex(p) * w; patternMean += TINT_MOSS * w; rough += 0.95 * w; wsum += w; }
    w = vA.z; if (w > 0.02) { acc += rockTex(p) * w; patternMean += TINT_ROCK * w; rough += 0.95 * w; wsum += w; }
    w = vA.w; if (w > 0.02) { acc += soilTex(p) * w; patternMean += TINT_SOIL * w; rough += 0.95 * w; wsum += w; }
    w = vB.x; if (w > 0.02) { acc += flagstoneTex(p, vec3(0.45, 0.15, 0.9)) * w; patternMean += TINT_FLAGSTONE * w; rough += 0.6 * w; wsum += w; }
    w = vB.y; if (w > 0.02) { acc += cobbleTex(p) * w; patternMean += TINT_COBBLE * w; rough += 0.55 * w; wsum += w; }
    w = vB.z; if (w > 0.02) { acc += snowTex(p) * w; patternMean += TINT_SNOW * w; rough += 0.9 * w; wsum += w; }
    w = vB.w; if (w > 0.02) { acc += sandTex(p) * w; patternMean += TINT_SAND * w; rough += 0.95 * w; wsum += w; }
    w = vC.x; if (w > 0.02) { acc += deadTex(p) * w; patternMean += TINT_DEAD * w; rough += 0.95 * w; wsum += w; }
    w = vC.y; if (w > 0.02) { acc += marbleTex(p) * w; patternMean += TINT_MARBLE * w; rough += 0.25 * w; wsum += w; }
    w = vC.z; if (w > 0.02) { acc += seabedTex(p) * w; patternMean += TINT_SEABED * w; rough += 0.8 * w; wsum += w; }
    if (wsum < 0.02) { acc = grassTex(p); patternMean = TINT_GRASS; rough = 0.95; wsum = 1.0; }
    acc /= wsum;
    patternMean /= wsum;
    rough /= wsum;
    // The tint (wet already baked into it) times the pattern over its mean: a sculpt's own tint keeps its hue and
    // brightness, and the default tint (the weighted TINT_* at GROUND_ALBEDO) gives back the pattern at GROUND_ALBEDO.
    vec3 patternRatio = clamp(acc.rgb / max(patternMean, vec3(0.001)), PATTERN_MIN, PATTERN_MAX);
    ground *= mix(vec3(1.0), patternRatio, gDetail);
    gBump = acc.a * gDetail;
    // (The floor: a sculpt can keep every layer matt, so the low moon draws no grey sheen on its stone.)
    gRough = mix(roughness, max(rough, uRoughFloor), gDetail);
  }
  diffuseColor.rgb *= ground;
}`;

/** Replaces <roughnessmap_fragment>: the layers' roughness; wet halves it. */
const ROUGHNESS_FRAGMENT = /* glsl */ `
float roughnessFactor = gRough * (1.0 - 0.5 * gWet);`;

/**
 * After <normal_fragment_maps>: a screen-space bump from the layer relief (Mikkelsen's unparametrized bump, as
 * three's bumpmap chunk, but with raw position derivatives so the tilt is the relief's real slope at any distance).
 * One evaluation: the height is the gBump already computed, differentiated with dFdx/dFdy.
 */
const NORMAL_FRAGMENT = /* glsl */ `
{
  vec2 dH = vec2(dFdx(gBump), dFdy(gBump)) * (uBump * BUMP_METRES);
  vec3 sp = -vViewPosition;
  vec3 sx = dFdx(sp);
  vec3 sy = dFdy(sp);
  vec3 r1 = cross(sy, normal);
  vec3 r2 = cross(normal, sx);
  float det = dot(sx, r1) * faceDirection;
  vec3 grad = sign(det) * (dH.x * r1 + dH.y * r2);
  normal = normalize(abs(det) * normal - grad);
}`;

/** After <emissivemap_fragment>: the sky's Fresnel gloss on marble and wet ground, and the marble's pulsing ore veins. */
const EMISSIVE_FRAGMENT = /* glsl */ `
{
  vec3 V = normalize(cameraPosition - vW);
  vec3 nW = transformNormalByInverseViewMatrix(normal, viewMatrix);
  float glossW = gMarble * 0.55 + gWet * 0.35;
  if (glossW > 0.002) {
    float fres = pow(1.0 - max(dot(nW, V), 0.0), 4.0);
    totalEmissiveRadiance += skyColor(reflect(-V, nW)) * fres * glossW;
  }
  if (gMarble > 0.02 && gDetail > 0.001) {
    vec2 p = vW.xz;
    // Ginseng ore: neon-blue veins that pulse slowly (porcelainFloor's, at half its strength).
    float ore = smoothstep(0.08, 0.0, voronoiEdge(p * 0.06 + 3.7)) * smoothstep(0.3, 0.6, fbm(p * 0.05 + 9.0));
    float pulse = 0.7 + 0.3 * sin(uTime * 1.3 + p.x * 0.05);
    totalEmissiveRadiance += vec3(0.08, 0.42, 1.0) * ore * pulse * ORE_STRENGTH * gMarble * gDetail;
  }
}`;

export interface GroundMaterialOptions {
  /**
   * The lowest roughness any layer renders at (Sculpt.roughnessFloor; 0 keeps each layer's own: flagstone 0.6, cobble
   * 0.55, marble 0.25). Wet ground still halves it.
   */
  roughnessFloor?: number;
}

/**
 * A ground material. Every one compiles to the same program ('ground'); share one between the chunk sets of sculpts
 * with the same roughness floor.
 */
export function groundMaterial(opts: GroundMaterialOptions = {}): MeshStandardMaterial {
  const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  mat.name = 'ground';
  // This material's own (a uniform, not a define: one program for every floor).
  const roughFloor = { value: opts.roughnessFloor ?? 0 };
  mat.userData.roughFloor = roughFloor;
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = GROUND_UNIFORMS.uTime;
    shader.uniforms.uDetailFar = GROUND_UNIFORMS.uDetailFar;
    shader.uniforms.uBump = GROUND_UNIFORMS.uBump;
    shader.uniforms.uRoughFloor = roughFloor;
    for (const [k, u] of Object.entries(SKY_SHARED)) shader.uniforms[k] = u;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec4 layerA; attribute vec4 layerB; attribute vec4 layerC;
varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec3 vW; varying float vDist;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vA = layerA; vB = layerB; vC = layerC;
vW = (modelMatrix * vec4(transformed, 1.0)).xyz;
vDist = distance(vW, cameraPosition);`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>${FRAG_COMMON}`)
      .replace('#include <color_fragment>', COLOR_FRAGMENT)
      .replace('#include <roughnessmap_fragment>', ROUGHNESS_FRAGMENT)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>${NORMAL_FRAGMENT}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>${EMISSIVE_FRAGMENT}`);
  };
  mat.customProgramCacheKey = () => 'ground';
  return mat;
}

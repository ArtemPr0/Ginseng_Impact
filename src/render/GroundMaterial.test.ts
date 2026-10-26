/**
 * node has no WebGL, so this resolves the ground material's final GLSL the way WebGLProgram does (ShaderLib.standard
 * + onBeforeCompile + every #include) and checks what a compiler would: no unresolved includes, balanced braces and
 * parentheses, every custom function defined exactly once and before its first use, no clash with the names three's
 * chunks define, each chunk replacement in place and in order, and the names the patches rely on declared first.
 */
import { describe, expect, it } from 'vitest';
import { ShaderChunk, ShaderLib } from 'three';
import { GROUND_UNIFORMS, groundMaterial } from './GroundMaterial';
import { LAYER, LAYER_TINT, PATTERN_RATIO, TEXTURE_LAYERS } from './Ground';
import { SKY_SHARED } from './Sky';

interface Resolved { vert: string; frag: string; stockVert: string; stockFrag: string; uniforms: Record<string, unknown>; key: string }

const chunks = ShaderChunk as unknown as Record<string, string>;
const resolve = (src: string): string => src.replace(/^[ \t]*#include +<([\w\d./]+)>/gm, (_m, name: string) => {
  const s = chunks[name];
  if (s === undefined) throw new Error('missing chunk ' + name);
  return resolve(s);
});
const strip = (s: string) => s.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
// The uniforms and attributes WebGLProgram prepends (the ones the patches use).
const PREFIX_V = 'uniform mat4 modelMatrix; uniform mat4 modelViewMatrix; uniform mat4 projectionMatrix; uniform mat4 viewMatrix; uniform mat3 normalMatrix; uniform vec3 cameraPosition; attribute vec3 position; attribute vec3 normal; attribute vec2 uv; attribute vec3 color;\n';
const PREFIX_F = 'uniform mat4 viewMatrix; uniform vec3 cameraPosition; uniform bool isOrthographic;\n';

function resolved(): Resolved {
  const mat = groundMaterial();
  const shader = { uniforms: {} as Record<string, unknown>, vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader };
  (mat.onBeforeCompile as unknown as (s: typeof shader, r: null) => void)(shader, null);
  return {
    vert: strip(PREFIX_V + resolve(shader.vertexShader)),
    frag: strip(PREFIX_F + resolve(shader.fragmentShader)),
    stockVert: strip(PREFIX_V + resolve(ShaderLib.standard.vertexShader)),
    stockFrag: strip(PREFIX_F + resolve(ShaderLib.standard.fragmentShader)),
    uniforms: shader.uniforms,
    key: mat.customProgramCacheKey(),
  };
}

/** Open minus close count (the stock chunks are not textually balanced: preprocessor branches share closing braces). */
const balance = (s: string, open: string, close: string) => s.split(open).length - s.split(close).length;

const MINE = ['hash', 'vnoise', 'fbm', 'cells', 'voronoiEdge', 'skyColor', 'grassTex', 'mossTex', 'rockTex', 'soilTex', 'flagstoneTex', 'cobbleTex', 'snowTex', 'sandTex', 'deadTex', 'marbleTex', 'seabedTex'];

/** Function definitions by name → start offsets. */
function definitions(s: string): Map<string, number[]> {
  const defs = new Map<string, number[]>();
  for (const m of s.matchAll(/^[ \t]*(?:highp\s+|mediump\s+)?(?:float|vec2|vec3|vec4|void|mat2|mat3|mat4|bool|int|ivec2)\s+(\w+)\s*\([^;{]*\)\s*\{/gm)) defs.set(m[1], [...(defs.get(m[1]) ?? []), m.index!]);
  return defs;
}

describe('groundMaterial shader', () => {
  const r = resolved();

  it('resolves every include and adds balanced braces and parentheses', () => {
    for (const [mine, stock] of [[r.vert, r.stockVert], [r.frag, r.stockFrag]]) {
      expect(mine).not.toMatch(/#include/);
      expect(balance(mine, '{', '}')).toBe(balance(stock, '{', '}'));
      expect(balance(mine, '(', ')')).toBe(balance(stock, '(', ')'));
    }
  });

  it('uses no GLSL ES 3.00 reserved word as an identifier', () => {
    // Words reserved for future use (the compiler rejects them as names; a text check cannot see it, Chrome does).
    const reserved = /\b(patch|sample|filter|input|output|common|partition|active|asm|class|union|enum|typedef|template|this|goto|inline|noinline|public|static|extern|external|interface|long|short|double|half|fixed|unsigned|superp|sizeof|cast|namespace|using|resource|subroutine|coherent|volatile|restrict|readonly|writeonly|hvec2|hvec3|hvec4|fvec2|fvec3|fvec4|dvec2|dvec3|dvec4)\b/g;
    // ... and names starting with gl_ or containing a double underscore. The stock chunks use their own built-ins
    // (gl_DrawID in batching), so the rule is: the patches add no occurrence the stock shader does not have.
    const glNames = /\b(gl_\w+|\w*__\w*)\b/g;
    const words = (s: string, re: RegExp) => [...s.matchAll(re)].map((m) => m[0]).sort();
    for (const [mine, stock] of [[r.vert, r.stockVert], [r.frag, r.stockFrag]]) {
      expect(words(mine, reserved)).toEqual(words(stock, reserved));
      expect(words(mine, glNames)).toEqual(words(stock, glNames));
    }
    // (And the stock shader has none of the reserved words itself: the check is not vacuous.)
    expect(words(r.stockFrag, reserved)).toEqual([]);
  });

  it('defines each ground function once, before its first use, without redefining a three function', () => {
    const defs = definitions(r.frag);
    for (const fn of MINE) {
      const d = defs.get(fn) ?? [];
      expect(d, fn).toHaveLength(1);
      const bodyStart = r.frag.indexOf('{', d[0]);
      // Calls outside the definition's own signature.
      const uses = [...r.frag.matchAll(new RegExp(`\\b${fn}\\s*\\(`, 'g'))].map((m) => m.index!).filter((i) => i < d[0] || i > bodyStart);
      expect(uses.length, `${fn} is used`).toBeGreaterThan(0);
      expect(uses.filter((i) => i < d[0]), `${fn} used before definition`).toHaveLength(0);
    }
    // Nothing three defines is defined again (rand, pow2's two overloads, the bump chunk's helpers, ...).
    const stock = definitions(r.stockFrag);
    for (const [fn, d] of stock) expect(defs.get(fn), fn).toHaveLength(d.length);
    for (const fn of MINE) expect(stock.has(fn), fn).toBe(false);
    expect(defs.get('rand')).toHaveLength(1);
    expect(defs.get('pow2')).toHaveLength(2);
    expect(defs.get('saturate')).toBeUndefined();
  });

  it('replaces the colour, roughness, normal and emissive chunks in order and keeps the rest standard', () => {
    const f = r.frag;
    const colorAt = f.indexOf('float gDetail = 1.0 - smoothstep(uDetailFar * 0.6, uDetailFar, vDist);');
    const roughAt = f.indexOf('float roughnessFactor = gRough * (1.0 - 0.5 * gWet);');
    const normalAt = f.indexOf('vec2 dH = vec2(dFdx(gBump), dFdy(gBump))');
    const emisAt = f.indexOf('vec3 nW = transformNormalByInverseViewMatrix(normal, viewMatrix);');
    expect(colorAt).toBeGreaterThan(0);
    expect(roughAt).toBeGreaterThan(colorAt);
    expect(normalAt).toBeGreaterThan(roughAt);
    expect(emisAt).toBeGreaterThan(normalAt);
    expect(f).not.toMatch(/diffuseColor \*= vColor;/);
    expect(f.match(/float roughnessFactor/g)).toHaveLength(1);
    expect(f).toMatch(/material\.roughness = max\( roughnessFactor, 0\.0525 \);/);
    // Fog, lights and shadows untouched.
    for (const std of ['vec3 fogColor', 'getShadow(', 'RE_Direct_Physical', 'gl_FragColor = vec4( outgoingLight, diffuseColor.a );']) expect(f).toContain(std);
    // Names the patches rely on are declared before the point of use.
    const before = (decl: RegExp, use: number) => { const m = decl.exec(f); expect(m, String(decl)).not.toBeNull(); expect(m!.index, String(decl)).toBeLessThan(use); };
    before(/varying vec3 vViewPosition;/, normalAt);
    before(/float faceDirection = /, normalAt);
    before(/vec3 normal = /, normalAt);
    before(/vec3 totalEmissiveRadiance = /, emisAt);
    before(/vec4 diffuseColor = /, colorAt);
    before(/varying vec4 vColor;/, colorAt);
    before(/uniform float roughness;/, colorAt);
    before(/vec3 transformNormalByInverseViewMatrix\(/, emisAt);
    before(/varying vec4 vA; varying vec4 vB; varying vec4 vC; varying vec3 vW; varying float vDist;/, colorAt);
  });

  it('lays the pattern over its mean on the tint, from TINT_* constants generated off LAYER_TINT', () => {
    const f = r.frag;
    const colorAt = f.indexOf('float gDetail = 1.0 - smoothstep(uDetailFar * 0.6, uDetailFar, vDist);');
    const n = (v: number) => v.toFixed(4);
    for (const [name, k] of Object.entries(LAYER)) {
      if (k >= TEXTURE_LAYERS) continue;
      const id = `TINT_${name.toUpperCase()}`;
      const t = LAYER_TINT[k];
      const def = `#define ${id} vec3(${n(t[0])}, ${n(t[1])}, ${n(t[2])})`;
      expect(f, def).toContain(def);
      expect(f.indexOf(def), def).toBeLessThan(colorAt);
      // Each constant joins the mean in its own layer's branch, at the same weight as its pattern.
      expect(f, id).toMatch(new RegExp(`acc \\+= ${name}Tex\\([^;]*\\) \\* w; patternMean \\+= ${id} \\* w;`));
    }
    expect(f).toContain('if (wsum < 0.02) { acc = grassTex(p); patternMean = TINT_GRASS; rough = 0.95; wsum = 1.0; }');
    expect(f).toContain('patternMean /= wsum;');
    // The ratio clamp, its bounds from PATTERN_RATIO.
    expect(f).toContain(`#define PATTERN_MIN ${n(PATTERN_RATIO[0])}`);
    expect(f).toContain(`#define PATTERN_MAX ${n(PATTERN_RATIO[1])}`);
    const ratioAt = f.indexOf('vec3 patternRatio = clamp(acc.rgb / max(patternMean, vec3(0.001)), PATTERN_MIN, PATTERN_MAX);');
    const mixAt = f.indexOf('ground *= mix(vec3(1.0), patternRatio, gDetail);');
    expect(ratioAt).toBeGreaterThan(f.indexOf('patternMean /= wsum;'));
    expect(mixAt).toBeGreaterThan(ratioAt);
    expect(f.indexOf('diffuseColor.rgb *= ground;')).toBeGreaterThan(mixAt);
    // The layers no longer replace the tint up close, and wet lives in the tint (baked), not again in the shader.
    expect(f).not.toMatch(/ground = mix\(ground, detail, gDetail\)/);
    expect(f).not.toMatch(/GROUND_ALBEDO|WET_DARKEN/);
  });

  it('floors every layer\'s roughness at the material\'s own uRoughFloor (one program for every floor), wet still halving it', () => {
    const f = r.frag;
    const colorAt = f.indexOf('float gDetail = 1.0 - smoothstep(uDetailFar * 0.6, uDetailFar, vDist);');
    expect(f.indexOf('uniform float uRoughFloor;')).toBeGreaterThan(0);
    expect(f.indexOf('uniform float uRoughFloor;')).toBeLessThan(colorAt);
    // The layers' mix is floored before it fades into the material roughness (0.95) with distance; wet halves the result.
    expect(f).toContain('gRough = mix(roughness, max(rough, uRoughFloor), gDetail);');
    expect(f.indexOf('float roughnessFactor = gRough * (1.0 - 0.5 * gWet);')).toBeGreaterThan(f.indexOf('max(rough, uRoughFloor)'));
    // The flagstone (0.6) and cobble (0.55) branches still carry their own roughness: the floor is per material.
    expect(f).toMatch(/flagstoneTex\(p, [^;]*\) \* w; patternMean \+= TINT_FLAGSTONE \* w; rough \+= 0\.6 \* w;/);
    expect(f).toMatch(/cobbleTex\(p\) \* w; patternMean \+= TINT_COBBLE \* w; rough \+= 0\.55 \* w;/);
    // Each material keeps its own floor: none by default (a realm's marble stays glossy), the island's 0.85.
    const floorOf = (opts?: Parameters<typeof groundMaterial>[0]) => {
      const mat = groundMaterial(opts);
      const shader = { uniforms: {} as Record<string, { value: unknown }>, vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader };
      (mat.onBeforeCompile as unknown as (s: typeof shader, r: null) => void)(shader, null);
      expect(mat.customProgramCacheKey()).toBe('ground');
      return shader.uniforms.uRoughFloor.value;
    };
    expect(floorOf()).toBe(0);
    expect(floorOf({ roughnessFloor: 0.85 })).toBe(0.85);
  });

  it('passes the layer attributes and world position from the vertex shader', () => {
    const v = r.vert;
    for (const needle of ['attribute vec4 layerA; attribute vec4 layerB; attribute vec4 layerC;', 'vA = layerA; vB = layerB; vC = layerC;', 'vW = (modelMatrix * vec4(transformed, 1.0)).xyz;', 'vDist = distance(vW, cameraPosition);']) expect(v).toContain(needle);
    expect(v.indexOf('vec3 transformed = vec3( position );')).toBeLessThan(v.indexOf('vA = layerA;'));
    expect(v.indexOf('vA = layerA;')).toBeLessThan(v.indexOf('gl_Position = projectionMatrix * mvPosition;'));
  });

  it('shares the sky uniforms with the water and keys the program as ground', () => {
    for (const [k, u] of Object.entries(SKY_SHARED)) expect(r.uniforms[k]).toBe(u);
    expect(r.uniforms.uTime).toBe(GROUND_UNIFORMS.uTime);
    expect(r.uniforms.uDetailFar).toBe(GROUND_UNIFORMS.uDetailFar);
    expect(r.uniforms.uBump).toBe(GROUND_UNIFORMS.uBump);
    expect((r.uniforms.uRoughFloor as { value: number }).value).toBe(0);
    expect(r.key).toBe('ground');
    const mat = groundMaterial();
    expect(mat.vertexColors).toBe(true);
    expect(mat.roughness).toBe(0.95);
    expect(mat.metalness).toBe(0);
  });
});

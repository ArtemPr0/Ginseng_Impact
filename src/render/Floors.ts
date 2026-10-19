/**
 * Floors drawn by shader on flat realm slabs (terrain, like the island's ground): fresh snow with a trodden path
 * (DeldocTvFiB's chapel), dark cracked flagstones (Def4LDkxikA's fountain hall), and wet cobbles (DeVj-Z8POjl's
 * drowned street). Each is a plane laid just over its slab's collider top.
 */
import { CircleGeometry, Color, Mesh, PlaneGeometry, ShaderMaterial, Vector2 } from 'three';

const NOISE = /* glsl */ `
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
// Cells: distance to the nearest seed and to the second nearest (stones, cracks).
vec2 cells(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); float d1 = 8.0, d2 = 8.0;
  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
    vec2 g = vec2(x, y); vec2 o = vec2(hash(i + g), hash(i + g + 17.3));
    float d = length(g + o - f);
    if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
  }
  return vec2(d1, d2);
}`;

/** A lit floor: the shader's colour shaded by the scene's fog (the realms are foggy). */
function floorMaterial(body: string, decl = '', uniforms: Record<string, { value: unknown }> = {}): ShaderMaterial {
  return new ShaderMaterial({
    fog: true,
    uniforms: { fogColor: { value: new Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 }, fogDensity: { value: 0.01 }, ...uniforms },
    vertexShader: /* glsl */ `
      varying vec2 vP;
      #include <fog_pars_vertex>
      void main() { vP = (modelMatrix * vec4(position, 1.0)).xz; vec4 mvPosition = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP;
      ${decl}
      #include <fog_pars_fragment>
      ${NOISE}
      void main() {
        vec3 c;
        ${body}
        // The colours above are written as they should look on screen; the scene renders in linear light and converts
        // at the end, so without this an unlit floor shows as a lifted grey (0.13 comes out near 0.4).
        c = pow(max(c, vec3(0.0)), vec3(2.2));
        gl_FragColor = vec4(c, 1.0);
        #include <fog_fragment>
      }`,
  });
}

function plane(mat: ShaderMaterial, x: number, z: number, w: number, d: number, y: number, yaw = 0): Mesh {
  const m = new Mesh(new PlaneGeometry(w, d), mat);
  m.rotation.set(-Math.PI / 2, 0, yaw);
  m.position.set(x, y + 0.012, z);
  m.receiveShadow = true;
  return m;
}

/**
 * Fresh snow under a moon: blue-white drifts, sparkle that comes and goes as you move, and a trodden grey path along
 * `pathX` (world x; NaN for none) a few metres wide.
 */
export function snowGround(x: number, z: number, w: number, d: number, y: number, pathX = Number.NaN): Mesh {
  const m = floorMaterial(/* glsl */ `
    float drift = fbm(vP * 0.12);
    c = mix(vec3(0.24, 0.3, 0.46), vec3(0.5, 0.57, 0.76), drift);
    c *= 0.82 + 0.18 * fbm(vP * 1.1);
    float sparkle = step(0.985, hash(floor(vP * 18.0))) * (0.5 + 0.5 * sin(dot(cameraPosition.xz, vec2(3.1, 2.3)) + hash(floor(vP * 18.0)) * 40.0));
    c += vec3(0.6, 0.7, 0.9) * sparkle;
    ${Number.isNaN(pathX) ? '' : `float onPath = smoothstep(2.6, 1.2, abs(vP.x - (${pathX.toFixed(1)} + (fbm(vP * 0.05) - 0.5) * 6.0)));
    c = mix(c, vec3(0.36, 0.4, 0.52) * (0.85 + 0.3 * fbm(vP * 2.0)), onPath * 0.75);`}
  `);
  return plane(m, x, z, w, d, y);
}

/** Dark cracked flagstones, blue-black and wet, faintly lit purple in the cracks (the fountain hall, the court). */
export function flagstoneFloor(x: number, z: number, w: number, d: number, y: number, crackGlow = new Color(0.45, 0.15, 0.9)): Mesh {
  const m = floorMaterial(/* glsl */ `
    vec2 cl = cells(vP * 0.55);
    float seam = smoothstep(0.06, 0.0, cl.y - cl.x);
    float stone = hash(floor(vP * 0.55 + cl.x));
    c = mix(vec3(0.06, 0.07, 0.13), vec3(0.13, 0.14, 0.24), stone) * (0.75 + 0.35 * fbm(vP * 0.9));
    c *= 1.0 - seam * 0.7;
    float crack = smoothstep(0.03, 0.0, abs(fbm(vP * 0.25) - 0.5)) * 0.8;
    c += vec3(${crackGlow.r.toFixed(3)}, ${crackGlow.g.toFixed(3)}, ${crackGlow.b.toFixed(3)}) * (seam * 0.25 + crack * 0.35);
  `);
  return plane(m, x, z, w, d, y);
}

/** Night grass: blue-green tufts under the moon, a little lighter where the aurora catches it (the Dragon's Vale). */
export function grassGround(x: number, z: number, w: number, d: number, y: number): Mesh {
  const m = floorMaterial(/* glsl */ `
    float n = fbm(vP * 0.15);
    float tuft = fbm(vP * 2.4);
    c = mix(vec3(0.05, 0.12, 0.09), vec3(0.11, 0.24, 0.17), n) * (0.7 + 0.5 * tuft);
    c += vec3(0.03, 0.08, 0.06) * smoothstep(0.6, 0.9, fbm(vP * 0.04 + 7.0));
  `);
  return plane(m, x, z, w, d, y);
}

/** The sea bed round the drowned city: dark blue-green silt in soft ripples, fading into the murk. */
export function seabed(x: number, z: number, w: number, d: number, y: number): Mesh {
  const m = floorMaterial(/* glsl */ `
    float ripple = 0.5 + 0.5 * sin(vP.x * 0.9 + fbm(vP * 0.2) * 6.0);
    c = mix(vec3(0.02, 0.06, 0.08), vec3(0.05, 0.12, 0.14), fbm(vP * 0.08)) * (0.8 + 0.25 * ripple);
  `);
  const p = plane(m, x, z, w, d, y);
  p.position.y = y + 0.006;
  return p;
}

/** Rounded wet cobbles in blue-grey (the drowned street), each stone catching a little light at its top. */
export function cobbleFloor(x: number, z: number, w: number, d: number, y: number, yaw = 0, tone = 1): Mesh {
  const m = floorMaterial(/* glsl */ `
    vec2 cl = cells(vP * 1.4);
    float stone = smoothstep(0.75, 0.1, cl.x);
    float gap = smoothstep(0.1, 0.0, cl.y - cl.x);
    float tone = hash(floor(vP * 1.4 + cl.x * 3.0));
    c = mix(vec3(0.16, 0.22, 0.3), vec3(0.42, 0.52, 0.64), tone * 0.6 + 0.2) * (0.35 + 0.75 * stone);
    c = mix(c, vec3(0.02, 0.04, 0.06), gap) * ${tone.toFixed(3)};
  `);
  return plane(m, x, z, w, d, y, yaw);
}

/**
 * The flat top of a floating island (Den1ausBXai's sky dock): dark cracked rock with moss, a disc of radius `r` whose
 * rim frays so it follows the rock's own edge. Laid over the island where its tree is clipped away.
 */
export function rockTop(x: number, z: number, r: number, y: number): Mesh {
  const mat = floorMaterial(/* glsl */ `
    if (length(vP - uC) / uR > 1.0 - 0.07 * fbm(vP * 1.3)) discard;
    vec2 cl = cells(vP * 0.55);
    float crack = smoothstep(0.0, 0.07, cl.y - cl.x);
    c = mix(vec3(0.045, 0.05, 0.08), vec3(0.1, 0.11, 0.15), fbm(vP * 0.35)) * (0.5 + 0.5 * crack);
    c = mix(c, vec3(0.05, 0.09, 0.06), smoothstep(0.55, 0.78, fbm(vP * 0.8 + 3.1)) * 0.7);`,
  'uniform vec2 uC; uniform float uR;', { uC: { value: new Vector2(x, z) }, uR: { value: r } });
  const m = new Mesh(new CircleGeometry(r, 48), mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y + 0.012, z);
  m.receiveShadow = true;
  return m;
}

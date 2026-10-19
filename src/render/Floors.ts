/**
 * Floors drawn by shader on flat realm slabs (terrain, like the island's ground): fresh snow with a trodden path
 * (DeldocTvFiB's chapel), dark cracked flagstones (Def4LDkxikA's fountain hall), wet cobbles (DeVj-Z8POjl's
 * drowned street) and the planks of the vale's tavern (Dd5Bqt7vQ5T). Each is a plane laid just over its slab's
 * collider top.
 */
import { BackSide, CircleGeometry, Color, Mesh, MeshBasicMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector2, Vector4 } from 'three';

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
      #include <fog_pars_fragment>
      ${NOISE}
      ${decl}
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

/**
 * Worn tavern planks, dark with soot and spilt ale. The floor is unlit, so the firelight is painted on: each pool
 * (x, z, radius, strength) brightens and warms the boards round a hearth or a chandelier (at most four).
 */
export function plankFloor(x: number, z: number, w: number, d: number, y: number, pools: Array<[number, number, number, number]> = []): Mesh {
  const P = [0, 1, 2, 3].map((i) => new Vector4(...(pools[i] ?? [0, 0, 1, 0])));
  const m = floorMaterial(/* glsl */ `
    float row = floor(vP.y / 0.32);
    float along = vP.x + hash(vec2(row, 3.0)) * 7.0;
    float board = floor(along / 2.4);
    float tone = hash(vec2(row, board));
    float grain = fbm(vec2(along * 1.6, vP.y * 18.0));
    c = mix(vec3(0.07, 0.04, 0.025), vec3(0.15, 0.085, 0.045), tone * 0.6 + grain * 0.4);
    float seam = smoothstep(0.035, 0.0, fract(vP.y / 0.32) * 0.32) + smoothstep(0.03, 0.0, fract(along / 2.4) * 2.4);
    c *= 1.0 - min(seam, 1.0) * 0.6;
    c *= 0.75 + 0.25 * fbm(vP * 0.4);
    float lit = 0.0;
    for (int i = 0; i < 4; i++) { vec2 q = (vP - uPools[i].xy) / uPools[i].z; lit += uPools[i].w * exp(-dot(q, q) * 2.0); }
    c *= 0.6 + lit;
    c += vec3(0.09, 0.035, 0.0) * lit * lit;`,
  'uniform vec4 uPools[4];', { uPools: { value: P } });
  return plane(m, x, z, w, d, y);
}

/**
 * The dark round an interior realm (the tavern, the crypt): a sphere seen from inside in the room's fog colour, so
 * past the walls there is only shadow, not the renderer's clear colour or the island's cloud sea far below.
 */
export function darkHollow(x: number, y: number, z: number, r: number, color: number): Mesh {
  const m = new Mesh(new SphereGeometry(r, 24, 12), new MeshBasicMaterial({ color, side: BackSide, fog: false }));
  m.position.set(x, y, z);
  m.renderOrder = -1;
  return m;
}

/**
 * The Lean Quarter's floors as one ground (they were four rectangles meeting in straight seams): flagstones in the
 * court, cobbles down Bucket Street, purple-cracked flagstones in the castle yard, snow in the chapel's quarter. Where
 * two meet they blend over several metres along a wandering, noise-warped border, and they fray out onto the plaza's
 * porcelain in patches. Rectangles are [x0, x1, z0, z1]; nothing is drawn outside them (the void) or in the moat.
 */
export function quarterFloor(r: { court: readonly number[]; street: readonly number[]; yard: readonly number[]; snow: readonly number[]; plaza: readonly number[]; moat: readonly number[] }, y: number): Mesh {
  const v4 = (a: readonly number[]) => new Vector4(a[0], a[1], a[2], a[3]);
  const x0 = Math.min(r.court[0], r.street[0], r.yard[0], r.snow[0], r.plaza[0]), x1 = Math.max(r.court[1], r.street[1], r.yard[1], r.snow[1], r.plaza[1]);
  const z0 = Math.min(r.court[2], r.street[2], r.yard[2], r.snow[2], r.plaza[2]), z1 = Math.max(r.court[3], r.street[3], r.yard[3], r.snow[3], r.plaza[3]);
  const m = floorMaterial(/* glsl */ `
    // Inside the quarters only (raw position: the edges over the void stay where the colliders are).
    float inside = min(min(sdRect(vP, uCourt), sdRect(vP, uStreet)), min(min(sdRect(vP, uYard), sdRect(vP, uSnow)), sdRect(vP, uPlaza)));
    if (inside > 0.0 || sdRect(vP, uMoat) < 0.0) discard;
    // Each ground's share: inside its own rectangle, fading across a border warped by noise.
    vec2 q = vP + (vec2(fbm(vP * 0.045), fbm(vP * 0.045 + 17.0)) - 0.5) * 16.0;
    float B = 5.0;
    float wC = 1.0 - smoothstep(-B, B, sdRect(q, uCourt));
    float wS = 1.0 - smoothstep(-B, B, sdRect(q, uStreet));
    float wY = 1.0 - smoothstep(-B, B, sdRect(q, uYard));
    float wN = 1.0 - smoothstep(-B, B, sdRect(q, uSnow));
    float sum = wC + wS + wY + wN;
    // On the plaza: the grounds fray out over the porcelain in patches, then stop.
    if (sdRect(vP, uPlaza) < 0.0 && sum < fbm(vP * 0.9 + 3.0) * 1.1 + 0.05) discard;
    sum = max(sum, 1e-3);
    c = (flagstone(vP, vec3(0.45, 0.15, 0.9)) * wC + cobble(vP) * wS + flagstone(vP, vec3(0.3, 0.1, 0.6)) * wY + snow(vP) * wN) / sum;`,
  /* glsl */ `
    uniform vec4 uCourt; uniform vec4 uStreet; uniform vec4 uYard; uniform vec4 uSnow; uniform vec4 uPlaza; uniform vec4 uMoat;
    float sdRect(vec2 p, vec4 r) { vec2 c = vec2(r.x + r.y, r.z + r.w) * 0.5; vec2 h = vec2(r.y - r.x, r.w - r.z) * 0.5; vec2 d = abs(p - c) - h; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0); }
    vec3 flagstone(vec2 p, vec3 glow) {
      vec2 cl = cells(p * 0.55);
      float seam = smoothstep(0.06, 0.0, cl.y - cl.x);
      float stone = hash(floor(p * 0.55 + cl.x));
      vec3 c = mix(vec3(0.06, 0.07, 0.13), vec3(0.13, 0.14, 0.24), stone) * (0.75 + 0.35 * fbm(p * 0.9));
      c *= 1.0 - seam * 0.7;
      float crack = smoothstep(0.03, 0.0, abs(fbm(p * 0.25) - 0.5)) * 0.8;
      return c + glow * (seam * 0.25 + crack * 0.35);
    }
    vec3 cobble(vec2 p) {
      vec2 cl = cells(p * 1.4);
      float stone = smoothstep(0.75, 0.1, cl.x);
      float gap = smoothstep(0.1, 0.0, cl.y - cl.x);
      float tone = hash(floor(p * 1.4 + cl.x * 3.0));
      vec3 c = mix(vec3(0.16, 0.22, 0.3), vec3(0.42, 0.52, 0.64), tone * 0.6 + 0.2) * (0.35 + 0.75 * stone);
      return mix(c, vec3(0.02, 0.04, 0.06), gap);
    }
    vec3 snow(vec2 p) {
      float drift = fbm(p * 0.12);
      vec3 c = mix(vec3(0.24, 0.3, 0.46), vec3(0.5, 0.57, 0.76), drift) * (0.82 + 0.18 * fbm(p * 1.1));
      float sparkle = step(0.985, hash(floor(p * 18.0))) * (0.5 + 0.5 * sin(dot(cameraPosition.xz, vec2(3.1, 2.3)) + hash(floor(p * 18.0)) * 40.0));
      return c + vec3(0.6, 0.7, 0.9) * sparkle;
    }`,
  { uCourt: { value: v4(r.court) }, uStreet: { value: v4(r.street) }, uYard: { value: v4(r.yard) }, uSnow: { value: v4(r.snow) }, uPlaza: { value: v4(r.plaza) }, uMoat: { value: v4(r.moat) } });
  // (Over the plaza's porcelain mirror, 1 cm above it, so the frayed patches lie on it.)
  return plane(m, (x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y + 0.012);
}

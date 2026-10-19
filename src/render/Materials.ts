import { BufferAttribute, Color, type Material, type Matrix4, MeshStandardMaterial, type MeshStandardMaterialParameters, Plane, type SkinnedMesh, Vector3 } from 'three';

/** Shared time uniform for wind/sway shaders. Updated once per frame by the renderer. */
export const WIND = { value: 0 };

/**
 * Smooth-shaded, matte surface: the base material for everything lit.
 * Cinematic direction: no flat shading, soft roughness, shadows on.
 */
export function surface(params: MeshStandardMaterialParameters & { color?: number | Color } = {}): MeshStandardMaterial {
  return new MeshStandardMaterial({ roughness: 0.92, metalness: 0, ...params });
}

/** Adds vertex-shader wind sway to a material: amplitude scales with vertex height (uv.y or local y). */
export function patchWind(mat: MeshStandardMaterial, strength = 0.25): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = WIND;
    shader.uniforms.uWindStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uWindStrength;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          #ifdef USE_INSTANCING
          vec3 wp = (instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #else
          vec3 wp = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
          #endif
          float h = clamp(transformed.y, 0.0, 10.0);
          float phase = uWind * 1.6 + wp.x * 0.15 + wp.z * 0.11;
          float sway = (sin(phase) + sin(phase * 2.3 + 1.7) * 0.4) * uWindStrength * h * h * 0.25;
          transformed.x += sway;
          transformed.z += sway * 0.6;
        }`,
      );
  };
}

/**
 * Cloth wind for a rigid robe model (no bones): the hem sways, the shoulders and head stay put.
 * `hemTop` is the local-space height (model units) above which the sway fades to zero.
 */
export function patchRobeWind(mat: MeshStandardMaterial, hemTop: number, strength = 0.06): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWind = WIND;
    shader.uniforms.uRobeStrength = { value: strength };
    shader.uniforms.uRobeTop = { value: hemTop };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uRobeStrength;\nuniform float uRobeTop;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float hem = 1.0 - clamp(transformed.y / max(uRobeTop, 0.001), 0.0, 1.0);
          hem = hem * hem;
          float phase = uWind * 2.1 + transformed.x * 3.0 + transformed.z * 2.0;
          float sway = (sin(phase) + sin(phase * 2.7 + 1.3) * 0.5) * uRobeStrength * uRobeTop * hem;
          transformed.x += sway;
          transformed.z += sway * 0.7;
        }`,
      );
  };
}

/**
 * A cape that streams behind its wearer: vertices behind the back and below the shoulders (bind pose, front = +z,
 * model units of height `h`) swing back about the shoulder line by `lift` (0 standing … 1 gliding) and flutter.
 * Applied before skinning, so the cape follows the body's animation. With `masked`, the geometry carries a
 * `capeKeep` attribute (0 on shins, feet and arms, see capeKeepAttribute) so only the cloth moves. Returns the
 * uniform to drive.
 */
export function patchCape(mat: MeshStandardMaterial, h: number, shape: { shoulder: number; back: number; depth: number; masked?: boolean }): { value: number } {
  // Materials are shared between rigs of the same file: patch once.
  if (mat.userData.capeLift) return mat.userData.capeLift as { value: number };
  const lift = { value: 0 };
  mat.userData.capeLift = lift;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uWind = WIND;
    shader.uniforms.uCapeLift = lift;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform float uWind;\nuniform float uCapeLift;${shape.masked ? '\nattribute float capeKeep;' : ''}`)
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float H = ${h.toFixed(5)};
          float sy = ${(shape.shoulder * h).toFixed(5)};
          float back = ${(shape.back * h).toFixed(5)};
          float w = smoothstep(back, back - ${(shape.depth * h).toFixed(5)}, transformed.z) * smoothstep(sy + 0.02 * H, sy - 0.12 * H, transformed.y)${shape.masked ? ' * capeKeep' : ''};
          if (w > 0.0) {
            float d = max(0.0, sy - transformed.y);
            float flutter = sin(uWind * 11.0 + d / H * 14.0 + transformed.x / H * 6.0) * (0.06 + 0.5 * uCapeLift) * (d / H + 0.2);
            float a = (uCapeLift * 1.25 + flutter) * w;
            float dy = transformed.y - sy;
            float dz = transformed.z - back;
            transformed.y = sy + dy * cos(a) - dz * sin(a);
            transformed.z = back + dy * sin(a) + dz * cos(a);
            transformed.x += sin(uWind * 7.0 + d / H * 9.0) * 0.015 * H * w * (0.3 + uCapeLift);
          }
        }`,
      );
  };
  mat.needsUpdate = true;
  return lift;
}

/**
 * Wings that flap, for a static mesh with no bones (the kingdom dragon): every vertex beyond `x0` of the body's
 * centre line (mesh units, wings spread along ±x) swings up and down about the wing root, more toward the tip and a
 * beat behind it, so the stroke ripples out along the wing. Returns nothing; the shared WIND clock drives it.
 */
export function patchWingFlap(mat: MeshStandardMaterial, opts: { x0: number; rootY: number; rate: number; amp: number }): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uWind = WIND;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float ax = abs(transformed.x);
          float span = max(0.0, ax - ${opts.x0.toFixed(4)});
          if (span > 0.0) {
            float a = sin(uWind * ${opts.rate.toFixed(3)} - span * 2.4) * ${opts.amp.toFixed(3)} * smoothstep(0.0, 0.25, span);
            float dy = transformed.y - ${opts.rootY.toFixed(4)};
            // Rotate about the wing root line (along z): up and down, the far side mirrored.
            float sx = sign(transformed.x);
            float ca = cos(a), sa = sin(a);
            float lx = span * ca - dy * sa;
            float ly = span * sa + dy * ca;
            transformed.x = sx * (${opts.x0.toFixed(4)} + lx);
            transformed.y = ${opts.rootY.toFixed(4)} + ly;
          }
        }`,
      );
  };
  mat.needsUpdate = true;
}

/**
 * A creature seen on DMT (the Frog God of the dream): its surface runs through every colour in bands that crawl over
 * it, its outline breathes, and its skin shimmers. Works on skinned meshes (the bands follow the bind pose).
 */
export function patchTrippy(mat: MeshStandardMaterial): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uWind = WIND;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nvarying vec3 vTrip;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vTrip = transformed;
        transformed += normal * sin(transformed.y * 9.0 + uWind * 3.0) * 0.012;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nvarying vec3 vTrip;')
      .replace('#include <dithering_fragment>', `#include <dithering_fragment>
        {
          float band = vTrip.y * 3.0 + sin(vTrip.x * 7.0 + uWind) * 0.4 + uWind * 0.35;
          vec3 hue = 0.5 + 0.5 * cos(6.28318 * (band + vec3(0.0, 0.33, 0.67)));
          float lum = dot(gl_FragColor.rgb, vec3(0.3, 0.6, 0.1));
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hue * (0.35 + lum * 1.6), 0.7);
        }`);
  };
  mat.customProgramCacheKey = () => 'trippy';
  mat.needsUpdate = true;
}

/**
 * A four-beat walk for a horse without a skeleton (horse-rider.glb is one static mesh): every vertex below the hip
 * line within `radius` of a leg's column swings about that leg's hip, the hoof lifting as it comes forward. Legs are
 * columns (x, z) in the model frame (`rel` maps the mesh's geometry into it; forward is the frame's -x), each with
 * its phase of the stride (0..1); `rate` strides per second, `amp` radians. Nothing else of the mesh moves.
 */
export function patchGait(mat: MeshStandardMaterial, opts: { legs: Array<{ x: number; z: number; phase: number }>; hipY: number; radius: number; rate: number; amp: number; rel: Matrix4 }): void {
  const prev = mat.onBeforeCompile;
  const rel = { value: opts.rel.clone() };
  const inv = { value: opts.rel.clone().invert() };
  const f = (v: number) => v.toFixed(4);
  const legs = opts.legs.map((l, i) => `{ float d = length(p.xz - vec2(${f(l.x)}, ${f(l.z)})); if (d < best) { best = d; leg = ${i}; lx = ${f(l.x)}; ph = ${f(l.phase)}; } }`).join('\n');
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uWind = WIND;
    shader.uniforms.uGaitRel = rel;
    shader.uniforms.uGaitInv = inv;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform mat4 uGaitRel;\nuniform mat4 uGaitInv;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec3 p = (uGaitRel * vec4(transformed, 1.0)).xyz;
          const float HIP = ${f(opts.hipY)};
          if (p.y < HIP) {
            float best = ${f(opts.radius)}; int leg = -1; float lx = 0.0; float ph = 0.0;
            ${legs}
            if (leg >= 0) {
              float w = smoothstep(HIP, HIP - 0.25, p.y);
              float t = (uWind * ${f(opts.rate)} + ph) * 6.2832;
              float a = sin(t) * ${f(opts.amp)} * w;
              vec2 q = vec2(p.x - lx, p.y - HIP);
              float ca = cos(a), sa = sin(a);
              p.x = lx + q.x * ca - q.y * sa;
              p.y = HIP + q.x * sa + q.y * ca;
              // The hoof comes up off the ground as the leg swings forward (toward -x).
              p.y += max(0.0, cos(t)) * 0.08 * w * (1.0 - clamp(p.y / HIP, 0.0, 1.0));
              transformed = (uGaitInv * vec4(p, 1.0)).xyz;
            }
          }
        }`,
      );
  };
  mat.customProgramCacheKey = () => 'gait:' + opts.legs.map((l) => `${f(l.x)},${f(l.z)}`).join(';');
  mat.needsUpdate = true;
}

/** Bones whose vertices never belong to the cape: shins, feet, toes, arms and hands (thighs carry the cape's hem). */
const NOT_CAPE = /(?<!up)leg$|foot|toe|arm$|forearm|hand/i;

/**
 * Per-vertex 1 − (skin weight on NOT_CAPE bones), the `capeKeep` attribute patchCape reads: the cape region of the
 * shader then leaves the calves, heels and arms behind the back alone (they used to stretch out when gliding).
 */
export function capeKeepAttribute(mesh: SkinnedMesh): void {
  const g = mesh.geometry;
  const si = g.getAttribute('skinIndex');
  const sw = g.getAttribute('skinWeight');
  const n = g.getAttribute('position').count;
  const keep = new Float32Array(n).fill(1);
  if (si && sw) {
    const off = mesh.skeleton.bones.map((b) => NOT_CAPE.test(b.name));
    for (let i = 0; i < n; i++) {
      let w = 0;
      for (let k = 0; k < 4; k++) if (off[si.getComponent(i, k)]) w += sw.getComponent(i, k);
      keep[i] = Math.max(0, 1 - w * 1.5);
    }
  }
  g.setAttribute('capeKeep', new BufferAttribute(keep, 1));
}

/**
 * The reference's glowing mushrooms (#28): the cap (local height above `capFrom`) glows its own blue, speckled with
 * brighter spots, breathing slowly; the stem keeps a faint glow. Works on instanced flora (each instance breathes in
 * its own phase).
 */
export function patchGlowCap(mat: MeshStandardMaterial, capFrom: number, color: Color = new Color(0.2, 0.45, 1.3)): void {
  // Matte: a shiny cap would catch the moon as a white sheen and lose its own glow.
  mat.roughness = Math.max(mat.roughness, 0.85);
  mat.metalness = 0;
  if (mat.roughnessMap) mat.roughnessMap = null;
  if (mat.metalnessMap) mat.metalnessMap = null;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uWind = WIND;
    shader.uniforms.uCapFrom = { value: capFrom };
    shader.uniforms.uCapColor = { value: color };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCap; varying float vPhase;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vCap = transformed;
        #ifdef USE_INSTANCING
        vPhase = dot(instanceMatrix[3].xyz, vec3(0.37, 0.0, 0.61));
        #else
        vPhase = 0.0;
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uWind; uniform float uCapFrom; uniform vec3 uCapColor; varying vec3 vCap; varying float vPhase;\nfloat capHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          // The cap is deep glowing blue whatever colour the texture paints it; the stem keeps its own colour.
          float capC = smoothstep(uCapFrom - 0.08, uCapFrom + 0.08, vCap.y);
          float l = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
          diffuseColor.rgb = mix(diffuseColor.rgb, normalize(uCapColor) * (0.25 + l * 0.6), capC);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          float cap = smoothstep(uCapFrom - 0.08, uCapFrom + 0.08, vCap.y);
          vec3 cell = floor(vCap * 22.0);
          float spot = step(0.9, capHash(cell)) * smoothstep(0.5, 0.0, length(fract(vCap * 22.0) - 0.5));
          float breathe = 0.75 + 0.25 * sin(uWind * 1.3 + vPhase);
          float lum = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
          totalEmissiveRadiance += uCapColor * (cap * (0.12 + lum * 0.45) * breathe + spot * cap * 1.1 + (1.0 - cap) * 0.03);
        }`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|glowcap:${capFrom.toFixed(3)}`;
  mat.needsUpdate = true;
}

/** White blossoms (the whale reel's meadow): the petals lose their colour and glow faintly in the moonlight. */
export function patchWhiteBloom(mat: MeshStandardMaterial): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float l = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
          // Greens (stems, leaves) stay green; everything brighter turns to white petals.
          float leaf = smoothstep(0.05, 0.2, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
          diffuseColor.rgb = mix(vec3(0.82, 0.86, 0.95) * (0.6 + l * 0.8), diffuseColor.rgb, leaf);
        }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(0.16, 0.19, 0.3) * smoothstep(0.4, 0.8, dot(diffuseColor.rgb, vec3(0.33)));`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|whitebloom`;
  mat.needsUpdate = true;
}

/**
 * Lit windows: the warm bright texels of a house's texture (its painted windows) glow as if candles burn inside, in
 * `glow` (warm candlelight by default; the Lean Quarter's castle burns purple).
 */
export function patchLitWindows(mat: MeshStandardMaterial, strength = 2.2, glow = new Color(1.0, 0.55, 0.18)): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float warm = smoothstep(0.08, 0.3, c.r - c.b) * smoothstep(0.25, 0.6, max(c.r, c.g));
          totalEmissiveRadiance += vec3(${glow.r.toFixed(3)}, ${glow.g.toFixed(3)}, ${glow.b.toFixed(3)}) * warm * ${strength.toFixed(2)};
        }`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|litwindows:${strength}:${glow.getHexString()}`;
  mat.needsUpdate = true;
}

/**
 * Re-colours a model's texture: its colours drain to their brightness and take `tint` instead, keeping its warm bright
 * texels (painted fire, candle flames) as they are. The drowned tavern's blue-green stone becomes the vale tavern's
 * soot-warm hearth wall this way.
 */
export function patchRetint(mat: MeshStandardMaterial, tint: Color): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float l = dot(c, vec3(0.3, 0.6, 0.1));
          float flame = smoothstep(0.1, 0.3, c.r - c.b) * smoothstep(0.3, 0.6, c.r);
          diffuseColor.rgb = mix(vec3(${tint.r.toFixed(3)}, ${tint.g.toFixed(3)}, ${tint.b.toFixed(3)}) * (0.25 + l * 1.5), c, flame);
        }`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|retint:${tint.getHexString()}`;
  mat.needsUpdate = true;
}

/** Turns a figure to weathered stone (the dream's hooded statues): its colours drain to grey, mottled and mossy. */
export function patchStone(mat: MeshStandardMaterial): void {
  mat.roughness = 1;
  mat.metalness = 0;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStoneP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvStoneP = transformed;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vStoneP;\nfloat stoneHash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }')
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          float l = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
          float speck = stoneHash(floor(vStoneP * 40.0)) * 0.12;
          diffuseColor.rgb = vec3(0.32, 0.33, 0.38) * (0.6 + l * 0.7) + speck;
        }`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|stone`;
  mat.needsUpdate = true;
}

/**
 * A swimming stroke for a rigid creature model (the flying whale): the body flexes up and down in a wave that grows
 * toward the tail. `axis` is the model's long axis ('z' or 'x', front toward +), `from`/`to` its extent along it in the
 * model's own units, `amp` the tail's swing in the same units.
 */
export function patchSwim(mat: MeshStandardMaterial, axis: 'x' | 'z', from: number, to: number, amp: number): void {
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uWind = WIND;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        {
          float along = transformed.${axis};
          float f = clamp((${to.toFixed(4)} - along) / ${(to - from).toFixed(4)}, 0.0, 1.0);
          transformed.y += sin(uWind * 1.1 - f * 4.0) * ${amp.toFixed(4)} * f * f;
        }`);
  };
  mat.customProgramCacheKey = () => `swim:${axis}:${from.toFixed(2)}:${to.toFixed(2)}`;
  mat.needsUpdate = true;
}

/**
 * Cuts a model off above world height `y`: a clipping plane on its (cloned) material, so a floating island's giant tree
 * goes and its top can carry a floor (the renderer has local clipping on).
 */
export function clipAbove(mat: Material, y: number): void {
  mat.clippingPlanes = [new Plane(new Vector3(0, -1, 0), y)];
}

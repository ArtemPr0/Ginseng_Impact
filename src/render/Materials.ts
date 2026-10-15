import { BufferAttribute, Color, type Matrix4, MeshStandardMaterial, type MeshStandardMaterialParameters, type SkinnedMesh } from 'three';

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

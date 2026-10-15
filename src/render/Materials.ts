import { Color, MeshStandardMaterial, type MeshStandardMaterialParameters } from 'three';

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
 * Applied before skinning, so the cape follows the body's animation. Returns the uniform to drive.
 */
export function patchCape(mat: MeshStandardMaterial, h: number, shape: { shoulder: number; back: number; depth: number }): { value: number } {
  const lift = { value: 0 };
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uWind = WIND;
    shader.uniforms.uCapeLift = lift;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWind;\nuniform float uCapeLift;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          float H = ${h.toFixed(5)};
          float sy = ${(shape.shoulder * h).toFixed(5)};
          float back = ${(shape.back * h).toFixed(5)};
          float w = smoothstep(back, back - ${(shape.depth * h).toFixed(5)}, transformed.z) * smoothstep(sy + 0.02 * H, sy - 0.12 * H, transformed.y);
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

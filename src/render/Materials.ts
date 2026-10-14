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

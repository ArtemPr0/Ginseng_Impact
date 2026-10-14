import { Color, Material, MeshLambertMaterial, Vector2, type MeshLambertMaterialParameters } from 'three';

/** Half the low-res render target size; shared by every patched material. */
export const SNAP = new Vector2(240, 135);

/**
 * Patches a built-in material with PS1-style vertex snapping and affine texture mapping.
 * See .claude/skills/ginseng-impact-design/references/rendering.md.
 */
export function patchPS1(mat: Material): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = { value: SNAP };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uSnap;\nvarying vec3 vAffine;')
      .replace(
        '#include <project_vertex>',
        `#include <project_vertex>
        {
          vec4 snapped = gl_Position;
          snapped.xy = floor(snapped.xy / snapped.w * uSnap) / uSnap * snapped.w;
          gl_Position = snapped;
        }
        #ifdef USE_MAP
        vAffine = vec3(vMapUv * gl_Position.w, gl_Position.w);
        #else
        vAffine = vec3(0.0, 0.0, 1.0);
        #endif`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAffine;')
      .replace(
        '#include <map_fragment>',
        `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vAffine.xy / vAffine.z );
        diffuseColor *= sampledDiffuseColor;
        #endif`,
      );
  };
  mat.customProgramCacheKey = () => 'ps1';
}

/** Flat-shaded Lambert with the PS1 patch applied. Pass a palette token or hex as `color`. */
export function ps1Lambert(params: MeshLambertMaterialParameters & { color?: number | Color } = {}): MeshLambertMaterial {
  const mat = new MeshLambertMaterial({ flatShading: true, ...params });
  patchPS1(mat);
  return mat;
}

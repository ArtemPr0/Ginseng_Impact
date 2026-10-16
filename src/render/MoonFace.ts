/**
 * The moons with faces (shot-013029, shot-013056, shot-013117): a Meshy face-moon drawn as a sky object — unlit except
 * for its own crescent terminator (a crescent is the same face half in shadow), its brightest texels (teeth, eyes)
 * glowing even on the dark side, and a cold rim. Fog never touches it; the bloom does.
 */
import { Box3, Color, Group, type Mesh, type MeshStandardMaterial, ShaderMaterial, type Texture, Vector3 } from 'three';
import { loadModelOrWarn } from '../models/ModelRig';
import { MODELS } from '../data/models';

const VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv; vN = normalize(normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize((inverse(modelViewMatrix) * vec4(0.0, 0.0, 0.0, 1.0)).xyz - position);
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform sampler2D uMap; uniform bool uHasMap; uniform vec3 uTint; uniform vec3 uLight; uniform float uCrescent; uniform float uGlow; uniform float uTime;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vec3 base = (uHasMap ? texture2D(uMap, vUv).rgb : vec3(0.7)) ;
  float luma = dot(base, vec3(0.3, 0.6, 0.1));
  vec3 col = mix(vec3(luma), base, 0.35) * uTint;
  float lit = smoothstep(-0.12, 0.3, dot(normalize(vN), normalize(uLight)));
  float light = mix(1.0, mix(0.035, 1.0, lit), uCrescent);
  // Teeth and eyes: the brightest texels keep glowing in the shadow (the grinning moon's eyes, 01.30.56).
  float bright = smoothstep(0.55, 0.85, luma);
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
  vec3 c = col * light * (1.1 + uGlow) + vec3(0.9, 0.95, 1.0) * bright * (0.6 + 0.4 * sin(uTime * 1.7)) * uGlow
         + uTint * rim * 0.55 * mix(1.0, lit, uCrescent * 0.7);
  gl_FragColor = vec4(c, 1.0);
}`;

export interface FaceMoon {
  group: Group;
  /** Resolves true once the model is in (false if its file is missing: keep the fallback moon). */
  ready: Promise<boolean>;
  update(dt: number): void;
  /** Recolours it (the dream's moons drift through the hues). */
  tint: Color;
}

/**
 * A face-moon `radius` metres across its face. `crescent` 0 shows it full, 1 a thin crescent lit from `light`
 * (moon-local direction); `glow` brightens the face and its teeth and eyes.
 */
export function faceMoon(id: string, radius: number, opts: { crescent?: number; light?: Vector3; tint?: Color; glow?: number } = {}): FaceMoon {
  const group = new Group();
  const tint = opts.tint ?? new Color(0.55, 0.7, 1.35);
  const mats: ShaderMaterial[] = [];
  let t = 0;
  const ready = loadModelOrWarn(id, MODELS[id]?.label).then((gltf) => {
    if (!gltf) return false;
    const scene = gltf.scene.clone(true);
    scene.traverse((o) => {
      const m = o as Mesh;
      if (!m.isMesh) return;
      const src = (Array.isArray(m.material) ? m.material[0] : m.material) as MeshStandardMaterial;
      const map = (src.map ?? null) as Texture | null;
      const mat = new ShaderMaterial({
        uniforms: {
          uMap: { value: map }, uHasMap: { value: !!map }, uTint: { value: tint }, uLight: { value: (opts.light ?? new Vector3(1, 0.25, 0.35)).clone().normalize() },
          uCrescent: { value: opts.crescent ?? 0 }, uGlow: { value: opts.glow ?? 0.6 }, uTime: { value: 0 },
        },
        vertexShader: VERT, fragmentShader: FRAG, fog: false,
      });
      mats.push(mat);
      m.material = mat;
      m.castShadow = m.receiveShadow = false;
      m.frustumCulled = false;
    });
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const k = (radius * 2) / Math.max(size.x, size.y);
    scene.position.copy(centre).multiplyScalar(-k);
    scene.scale.setScalar(k);
    group.add(scene);
    return true;
  });
  return {
    group, ready, tint,
    update(dt) {
      t += dt;
      for (const m of mats) m.uniforms.uTime.value = t;
      group.position.y += Math.sin(t * 0.3) * dt * 0.4;
    },
  };
}

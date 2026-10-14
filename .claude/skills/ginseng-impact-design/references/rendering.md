# Rendering recipe — retro low-poly dark fantasy

The reels' 3D frames look like PS1/N64 captures: flat-shaded low-poly meshes, a low internal
resolution, wobbling vertices, ordered dither, and fog so thick it is a colour. Reproduce all of it.

## Pipeline

1. Render the scene into a `WebGLRenderTarget` at **480×270** (keep 16:9; on portrait or odd
   aspect use `floor(canvasWidth / 4) × floor(canvasHeight / 4)`, minimum 320 wide).
   `minFilter = magFilter = NearestFilter`, `generateMipmaps = false`, depth buffer on.
2. Run the **dither pass** (below) on that target.
3. Blit to the canvas with a fullscreen quad using nearest sampling. Never let the browser
   smooth it: canvas CSS `image-rendering: pixelated`.
4. No MSAA, no FXAA, no TAA. Aliasing is the look.

## Lighting

- One `DirectionalLight` = the moon. Colour `moon` `#dfe6ff`, intensity 1.4, direction from
  above and *behind* the hero view so landmarks are rim-lit and faces fall into `abyss`.
- `HemisphereLight` sky `cobalt` `#1a2cff`, ground `abyss` `#0a0f2e`, intensity 0.9.
- No other lights except emissive materials and, sparingly, `PointLight`s in `rune`/`blood`
  with distance ≤ 12 for portal fire and eyes.
- **No shadow maps.** They break at 480×270. Use a dark blob mesh under characters and bake
  vertex-colour occlusion into geometry (darken verts under overhangs by multiplying vertex colour
  by 0.6).
- Never add a warm light. If something must glow warm it is `blood`, not orange.

## Fog

- `scene.fog = new FogExp2(PALETTE.fog, 0.014)` with world units in metres.
- `renderer.setClearColor(PALETTE.fog)` and the sky dome's horizon band is also `fog`, so
  terrain dissolves seamlessly into sky.
- Add a second, denser fog band below cliff edges with the cloud-sea planes; do not fake it with
  a grey gradient.

## Materials

- `MeshLambertMaterial` with `flatShading: true` for everything lit. No `MeshStandardMaterial`,
  no roughness/metalness, no environment maps.
- Textures, when used, are **canvas-generated at 16–64 px**, `NearestFilter`, no mipmaps.
  Vertex colours alone are preferred.
- Emissive surfaces: `emissive` set to an accent token, `emissiveIntensity` 1.5–3, base colour
  `void`. Glow halos are **additive billboard sprites** (`SpriteMaterial`, `AdditiveBlending`),
  not a bloom pass.

## Vertex snapping + affine textures (`onBeforeCompile`)

Patch every lit material. `uSnap` is half the low-res target size, e.g. `vec2(240, 135)`.

```ts
export function patchPS1(mat: Material, snap: Vector2) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = { value: snap };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nuniform vec2 uSnap;\nvarying vec3 vAffine;`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 snapped = gl_Position;
        snapped.xy = floor(snapped.xy / snapped.w * uSnap) / uSnap * snapped.w; // PS1 vertex jitter
        gl_Position = snapped;
        #ifdef USE_UV
        vAffine = vec3(vUv * gl_Position.w, gl_Position.w); // cancel perspective correction
        #endif`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\nvarying vec3 vAffine;`)
      .replace('#include <map_fragment>', `#ifdef USE_MAP
        vec4 sampledDiffuseColor = texture2D( map, vAffine.xy / vAffine.z );
        diffuseColor *= sampledDiffuseColor;
        #endif`);
  };
}
```

## Dither pass (fragment)

4×4 Bayer, then quantise to 5 bits per channel (32 levels). Run at the low-res size.

```glsl
uniform sampler2D tDiffuse; varying vec2 vUv;
const float bayer[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
void main() {
  vec3 c = texture2D(tDiffuse, vUv).rgb;
  ivec2 p = ivec2(mod(gl_FragCoord.xy, 4.0));
  float t = (bayer[p.y * 4 + p.x] + 0.5) / 16.0 - 0.5;
  float levels = 32.0;
  c = floor(c * levels + t) / levels;
  gl_FragColor = vec4(c, 1.0);
}
```

## Geometry budgets

| Thing | Triangles | Notes |
|---|---|---|
| Player character | ≤ 500 | boxes + 6-sided capsules, no smoothing |
| Enemy | ≤ 300 | |
| Landmark (head, cathedral) | ≤ 2 500 | big flat faces read better than detail |
| Tree / flower | ≤ 40 | instanced; thousands are fine |
| Terrain | 128×128 grid | `computeFlatNormals` style: non-indexed, per-face normals |

## Camera

- FOV 65°. Third-person, 4.5 m behind, 1.6 m up, slight downward pitch so the horizon sits in the
  lower third of the frame and the sky dominates.
- Far plane 600 m; fog hides the clip.

## Checklist for any new rendered thing

- [ ] Lit by moon + hemisphere only; no warm light
- [ ] `flatShading: true`, patched with `patchPS1`
- [ ] Palette tokens only; accents emissive, ≤ 2% red in frame
- [ ] Reads at 480×270 (test by screenshot; if detail vanishes, simplify the silhouette)
- [ ] Dissolves into `fog` at distance

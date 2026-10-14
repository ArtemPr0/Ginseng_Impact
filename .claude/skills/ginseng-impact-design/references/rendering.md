# Rendering recipe — cinematic dark fantasy

**Superseded direction:** the PS1 recipe below the line was the first build and was rejected by the user
("too pixelated, looks like Roblox"). The current pipeline is this section.

## Pipeline (src/render/Renderer.ts)

1. `WebGLRenderer` at DPR ≤ 1.5, `ACESFilmicToneMapping`, exposure 0.95, `PCFSoftShadowMap`.
2. `EffectComposer` on a `HalfFloat`, `samples: 4` target → `RenderPass` → `UnrealBloomPass(0.55, 0.65, 0.8)`
   → grade `ShaderPass` (cobalt lift `(0.006, 0.012, 0.045)` in shadows, contrast 1.08, vignette 0.5) → `OutputPass`.
3. Canvas CSS has no `image-rendering`; everything is smooth.

## Lighting

- Moon `DirectionalLight` `#dfe6ff` 1.5, shadows on: 2048 map, ortho ±80 m following the player, bias −0.0005, normalBias 0.5.
- Fill `DirectionalLight` `#7f95e0` 0.35 from the south-east so faces toward the camera are not black.
- `HemisphereLight` cobalt/abyss 0.55. Low ambient = contrast; the reels are dark with bright accents.
- Emissive accents: eyes 2.5–5 (bloom does the halo), runes ≤ 1.3 (higher turns orange under ACES).

## Materials and geometry

- `surface()` = `MeshStandardMaterial` roughness 0.92; armour roughness 0.5 metalness 0.35; blades 0.3/0.85.
- Stone: `rockify(BoxGeometry(w,h,d,segs), amp)` → welded, noise-displaced, smooth normals; `tintRock` adds moss.
- Pines: cylinder trunk + five lumpy open cones with tier offsets. Grass: 26k curved instanced blades with `patchWind`.
- Flowers: unlit petal-textured crossed quads with per-instance colour (`toneMapped: false`) so bloom lights them.

## Atmosphere (src/render/Atmosphere.ts, Sky.ts)

- `FogExp2(fog, 0.0062)`; 42 ground-hugging mist sprites (noise alpha, 55–135 m wide, opacity 0.2–0.38) drifting and wrapping around the player; 1 400 floating motes.
- Sky dome shader: gradient + fbm clouds tinted cobalt→dusk drifting slowly + moon glow; 2 200 twinkling stars; cratered moon disc `toneMapped: false` ×1.6 for bloom.

## Motion checklist (the reels are never static)

cloud drift · moon halo breathing · mist drift · motes · grass/flower sway · cloak · weapon trails · head eyes breathing and flaring · wisp trails and orbiting motes · golem stomp dust + camera shake · title dolly · camera breathing.

---


# (Archived) retro low-poly recipe

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
- `HemisphereLight` sky `cobalt` `#1a2cff`, ground `abyss` `#0a0f2e`, intensity 1.0.
- Albedo must be mid-bright for the result to read as blue: lit ground vertex colour ≈ `#2a3775`, lit stone ≈ `#5a6aa8`. Dark albedo (`#0e1538`) renders black.
- The final blit shader must `#include <colorspace_fragment>` before dithering; a ShaderMaterial does not convert linear→sRGB on its own and the frame comes out crushed.
- No other lights except emissive materials and, sparingly, `PointLight`s in `rune`/`blood`
  with distance ≤ 12 for portal fire and eyes.
- **No shadow maps.** They break at 480×270. Use a dark blob mesh under characters and bake
  vertex-colour occlusion into geometry (darken verts under overhangs by multiplying vertex colour
  by 0.6).
- Never add a warm light. If something must glow warm it is `blood`, not orange.

## Fog

- `scene.fog = new FogExp2(PALETTE.fog, 0.0085)` with world units in metres (0.014 hid everything past 100 m; 0.0085 keeps three distance bands).
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

## Lessons from the first build (verified by screenshot)

- **Point sprites need a texture.** `PointsMaterial` without `map` draws squares; at 480×270 with
  additive blending a 1 m particle becomes a huge pink block. Use `glowTexture()` and sizes 0.3–0.5.
- **Additive glows are amplified by the quantiser.** Keep halo sprites ≤ 1.2 m for projectiles and
  ≤ 0.3 × landmark height for landmark eyes; ground zone fills ≤ 0.05 opacity.
- **Emissive flora blows out.** Sunflower petals read blue at `emissiveIntensity 0.55` on a `#1a2a7a`
  base; 1.6 turned the field white.
- **Cloud sea tint**: fog → electric mix 0.15–0.3; higher reads as a white sheet.
- **Landmark eyes must be `fog: false`** on both the emissive mesh and the halo sprite so they
  show through the fog from 300 m. Everything else keeps fog.
- **Cones for pines**: `openEnded: true`, or the flat bottom disc shows black from below.

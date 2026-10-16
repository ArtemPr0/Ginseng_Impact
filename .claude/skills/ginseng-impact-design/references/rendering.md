# Rendering recipe — the glowing cobalt night

(The first build's PS1 recipe — 480×270, dither, flat shading — was rejected by the user: "too pixelated". It is gone.)

## Pipeline (`src/render/Renderer.ts`)

1. `WebGLRenderer`, pixel ratio 0.8–1.25 (adaptive governor: steps down above 25 ms, up below 14 ms),
   `ACESFilmicToneMapping`, `PCFShadowMap` redrawn every second frame.
2. `EffectComposer` on a half-float target, **no MSAA** (it halved the frame rate on Apple GPUs) →
   `RenderPass` → quarter-resolution `UnrealBloomPass` → `OutputPass` with the grade folded in → `FXAA`.
3. The grade (in the output pass, linear, before tone mapping): trip warp, saturation, cobalt lift in the shadows,
   contrast, vignette.
4. **Looks per world** (`LOOKS`): island bloom 0.7 / radius 0.6 / threshold 0.78, saturation 1.18, exposure 0.92;
   the dream is hotter (0.9 / 0.75 / 0.65, saturation 1.4); the graveyard darker with a heavier vignette. main.ts
   calls `renderer.setLook(LOOKS[realm])` each frame; it blends over ~1 s.
5. **Trip** (`renderer.trip(strength, seconds)`): the frame swirls round the centre, ripples in rings, splits into
   colour fringes and drifts through hues; comes on fast, leaves over ~2 s. Frog lick 1.0 for 6 s; rainbow spells 0.6.

## Sky (`src/render/Sky.ts`)

- Dome shader: horizon→mid→zenith gradient; a nebula band; a galaxy swirl (`uVortexA/B/C`); clouds = domain-warped
  5-octave noise on a high plane, slowly **swirling** round a point overhead, **lit from the moon side** (sample the
  density a step toward the moon: the difference is the silver lining), glowing where they cross the moon; wisps.
- `SKIES` presets (`island`, `graveyard`), blended by `sky.setPreset()`. A realm without `ownSky` uses the island
  dome with its own preset (the graveyard's amber storm).
- `SKY_SHARED`: the dome's colours, moon direction and colour, clock — shared with everything that reflects the sky.
- Black sun: dark disc + flickering blue corona plane, low in the north-west over the spire castle.
- Moons: `faceMoon(id, radius, {crescent, light, glow, tint})` (`src/render/MoonFace.ts`) draws a Meshy face-moon
  unlit, with a crescent terminator, teeth/eyes glowing in the shadow, a cold rim. Island: `moon-laugh` crescent;
  kingdom: `moon-grin`; dream: a spiral of `moon-laugh`s, hue-cycled.

## Water (`src/world/Water.ts`)

- `waterMaterial(deep, shallow, foam, flow, width)`: wave normals from three scrolling noise layers; fresnel
  `0.03 + 0.97(1−N·V)^5`; the reflection is `skyColor(reflect(−V, N))` (gradient, clouds, a 1400-power moon glint);
  light under the crests; foam lace at a ribbon's banks; uses `cameraPosition` (never the player position).
- Near the eye (`uEye`) the river blends into `tripColor()`: deep blue streaked with orange, magenta and cyan.
- `eyePool(x, z, level, a, b)`: an ellipse whose black pupil sits in a rainbow iris with radial fibres (green-yellow
  at the collar) and orange/violet swirl arms; the pupil leans toward the hero, widens when near, `startle()` on a hit.
- `poolWater(x, z, r, level)` still pools; `waterRibbon(points, half)` a stream down a sloped bed.

## Waterfalls (`src/world/Falls.ts`)

`cascade({x, z, top, height, width, yaw, curve, color})`: a ribbon that arcs out from its lip then drops, drawn as
distinct strands with dark gaps (noise lanes across, clumps racing down, faster as they fall), ragged edges, a wider
faint veil behind; at the foot an additive splash ring, mist sprites and falling spray. Default colour
`(0.22, 0.55, 1.35)` — it blooms without going white.

## Glow and restyling

- `FloraOptions.patch(mat, geo)` gives an instanced set its own material copy (geometry bbox available).
- `patchGlowCap(mat, capFrom)`: caps turn deep blue, glow, breathe per instance, speckled with brighter spots;
  forces roughness ≥ 0.85.
- `patchLitWindows(mat)`: warm bright texels of a house texture glow orange.
- `patchWhiteBloom(mat)`: petals desaturate to moonlit white, leaves stay green.
- `patchStone(mat)`: figures turn to weathered grey stone (freeze their idle at speed 0 so they are not in A-pose).
- `patchSwim(mat, axis, from, to, amp)`: a rigid creature flexes as it swims (the whale).
- Small flames (`fire()` below intensity 6) are emissive only; the light budget keeps the 6 nearest point lights.

## Lighting

- Moon `DirectionalLight` 1.5 (shadows 2048, ortho ±80 m following the player), cobalt fill from the south-east,
  `HemisphereLight` 0.7. Lightning flares both.
- `FogExp2(fog #1b2a6b, 0.0062)` on the island; each realm its own colour and density (main.ts blends).

## Performance rules

- Every new term in `terrainHeight` gets a bounding-box early-out (it runs for every grass candidate).
- New glows are sprites or emissive; at most a couple of new point lights per area.
- Waterfalls share one shader per colour; transparent planes: keep ~10 or fewer in one view.

---
name: ginseng-impact-design
description: Use when doing any visual work on Ginseng Impact — colours, materials, lighting, fog, shaders, post-processing, terrain, landmarks, creatures, characters, VFX, HUD, menus, title screen, fonts, icons — or when asked what the game should look like. Also use before choosing a Three.js light, fog, material or render setting in this repo.
---

# Ginseng Impact — design language

**Thesis: Silent kingdoms beyond the fog — monumental, lunar, melancholic, cobalt.**
Source: the @ozavry_ Instagram reels (see `references/sources.md`). Style: retro low-poly PS1/N64
dark fantasy. "Ginseng" is a pun on Genshin; there are no ginseng roots or plants in the art.

## The five rules

1. **The world is blue.** Saturated cobalt/ultramarine on near-black, 70% of every frame.
   "Dark fantasy" here is NOT desaturated brown, grey-purple or aged gold. Fog is blue, never grey.
2. **Light is the moon.** One cool directional + cobalt/abyss hemisphere. **Zero warm lights.**
   Glows are `blood` red, `rune` cyan, `witch` green or `dusk` violet, and they are emissive, not lights.
3. **Render like a PS1.** 480×270 target, nearest upscale, `flatShading` Lambert, vertex snapping,
   4×4 Bayer dither. **No** shadow maps, bloom, vignette, film grain, chromatic aberration, AA, toon ramps.
4. **Monumental vs. tiny.** Stone heads with red eyes, cathedral spires above a cloud sea, one-point
   causeways, moons. The player is ≤ 1/12 of frame height in hero views. Horizon in the lower third.
5. **HUD = Genshin layout, dark-fantasy skin.** Cinzel + Inter, `moon` text on navy panels, 1 px
   silver border, sharp corners, stepped motion. No gold, no blur, no rounded pills.

## Palette (tokens are the contract — `references/palette.md`)

| `void` #05060f | `abyss` #0a0f2e | `cobalt` #1a2cff | `ultramarine` #2b3fd9 | `electric` #4f7cff | `moon` #dfe6ff |
|---|---|---|---|---|---|
| `blood` #ff2a2a | `rune` #37f5ff | `witch` #5dff3a | `dusk` #8b3dff | `fog` #1b2a6b | surfaces: `stone` `bark` `cloth` |

Elements: Lunar=`moon`, Blood=`blood`, Astral=`dusk`, Fog=`fog`, Stone=`ultramarine`, Rot=`witch`, Tide=`rune`.
`blood` is a focal point (eyes, blood moon, HP), under 2% of pixels.

## Quick reference

| Task | Read | Key numbers |
|---|---|---|
| Lights, fog, materials, shader, post | `references/rendering.md` | moon dir light 1.4 · hemi 0.9 · `FogExp2(fog, 0.014)` · RT 480×270 · 32 levels |
| Landmark, creature, flora, character | `references/motifs.md` | head 45–60 m · spires ≤ 120 m · causeway 6 × 300 m · moon 8° at 25° |
| HUD, menu, title, icons, fonts | `references/ui.md` | Cinzel/Inter · panel rgba(10,15,46,.72) · radius 2 px · ≤ 120 ms steps |
| Colour decision of any kind | `references/palette.md` | 70 / 20 / 10 proportions |

## Before you ship a visual change

- [ ] Only palette tokens; no new hue, no warm colour, no grey
- [ ] Screenshot at 480×270 still reads: cobalt sky, blue fog bands, one red focal point
- [ ] Silhouette is low-poly and flat-shaded; dither visible on gradients
- [ ] Composition: small figure, big monument, low horizon, path toward the landmark
- [ ] HUD text crisp (DOM), world chunky (RT)

## Common mistakes (seen in practice)

| Mistake | Fix |
|---|---|
| Muted palette: gold accent, dried-blood red, grey-purple bg | Use `cobalt`/`abyss` fills, `blood` #ff2a2a, `electric` highlights |
| Grey/black fog (`0x0b0a12`) | `fog` #1b2a6b, and clear colour = fog |
| Amber/orange point lights, torches, embers | `rune` portal fire or `blood` eyes as emissive + glow sprite |
| `castShadow`, 2048 shadow maps | Blob shadows + vertex AO |
| Cel/toon ramps, 0.75× resolution, bloom, grain, aberration | PS1 pipeline in `references/rendering.md` |
| Inventing motifs (roots, chains, bone) | Pick from `references/motifs.md` |

---
name: ginseng-psychedelic-dream
description: Use when building or extending a psychedelic, DMT, dream or trip place in Ginseng Impact (the Frog King's dream, the Prism Wizard, anything "trippy", "like the DefYcvutTow reel", rainbow, kaleidoscope, eye vortex, moon faces, checkerboard corridor), or when asked to make something feel like a trip.
---

# The psychedelic dream (reel DefYcvutTow)

**The vibe in one line: a storybook gothic world dissolving into a tie-dye cosmos — every surface familiar, every
colour wrong, and everything looking back at you.** It is beautiful first and unsettling second: soft glow, slow
motion, vast scale, and faces and eyes hidden everywhere. Built today in `src/world/Dream.ts`.

## What the reel shows (11 s, three shots)

1. **Stair path into a tie-dye sky.** A rough stone stair climbs toward a marbled glowing moon-egg; floating rocks;
   floating islands carry skulls, burning castles (orange fire) and giant sunflowers. The sky is tie-dye nebula:
   every hue folded through every other, with dark rifts holding stars.
2. **Canal village round an eye.** Crooked timber houses with warm windows ring a vortex shaped like a giant eye
   (green-yellow iris, black pupil, orange and blue swirl arms); wooden bridges carry candles; rain streaks; a spiral
   of glowing moon faces (orange through green) fills the sky; a twisted giant trunk carries stone faces.
3. **Endless checkerboard corridor.** Black and white floor to infinity, rows of hooded robed statues, a ceiling
   column of stacked giant eyes, coloured torch flames, a giant skull with a snake coiled round it at the end.

## Rules of the style

1. **Familiar things, impossible colour.** Use ordinary gothic/storybook models (houses, statues, castles,
   bridges) and change only their colour, light and context. The weirdness is in the palette, not the shapes.
2. **Rainbow lives in light, not paint.** Cosine palette `0.5 + 0.5·cos(2π(t + (0, .33, .67)))` on emissive and
   sky/water shaders; textures stay mostly natural. Keep dark rifts — saturation needs darkness around it.
3. **Eyes and faces everywhere.** Water that is an eye, moons that laugh, eyes stacked in a column, statues with
   hidden faces, a tree with faces. Something should be looking at the player in every view.
4. **Slow, breathing motion.** Floors breathe, skies flow, islands bob, moons spiral; nothing jitters. Speed only
   when the trip effect hits.
5. **Scenes, not scatter.** Three or four composed places each with one hero element (stair → moon-egg, village →
   eye, corridor → skull), joined by open fractal floor. Something new every ~10 s of walking.

## Recipes (all exist in this repo)

| Element | How |
|---|---|
| Tie-dye nebula sky | Dream.ts `skyMaterial()`: domain-warped fbm (q, r warps) through the cosine palette, ×(0.12 + n·0.62), dark rifts where n < 0.5, stars in rifts |
| Breathing fractal floor | Dream.ts `floorMaterial()`: Julia set with drifting seed; the set's interior dark (never a flat sheet) |
| Eye vortex water | `eyePool(x, z, level, a, b)` (Water.ts) |
| Psychedelic river | `waterMaterial` with `uEye` set near the eye: `tripColor()` |
| Moon-egg | sphere + marble shader (`moonEggMaterial()`), glow sprite, fog off |
| Spiral of moon faces | `flora('moon-laugh', spiral, { update, patch })`: per-instance hue from the instance position + clock |
| Floating skull islands | `floating-island` + `giant-skull` + `castle` at 0.22, two big `fire()`s, bobbing |
| Giant sunflowers | `flower` ×4–11 with the sunflower patch (gold petals, dark centres, faint glow) |
| Candle bridges | `archBridge()` + chasm-bridge tiles, `candle` on every other post + `fire(…, 0.12, 1)` |
| Checkerboard corridor | `checkerMaterial()` plane; statues `robed-priest`/`void-monk` ×2.1 with `patchStone`, idle frozen at speed 0 |
| Column of eyes | `new SkyEyes(stack)` (blink, follow, moods, angry when shot) |
| Coloured torch flames | two additive glow sprites per flame (cyan, green, magenta, violet) |
| Rainbow waterfall | `cascade({ color: new Color(1.2, 0.4, 1.4) })` |
| Trip hit | `renderer.trip(strength, seconds)`; enemy projectiles of kind `'trip'` call it on hit (0.6, 3 s) |
| A trippy creature | `EnemyDef.trippy` → `patchTrippy` (crawling rainbow bands); the Prism Wizard, the Frog God |

## Look settings

`LOOKS.dream`: bloom 0.9, radius 0.75, threshold 0.65, saturation 1.4, low vignette; the fog cycles hue
(`RealmDef.cycle`). Keep emissive colours ≤ ~1.5 per channel or the bloom flattens everything to white.

## Common mistakes

| Mistake | Fix |
|---|---|
| Sky brighter than everything standing in it | sky ×0.12–0.74 with dark rifts; objects carry the glow |
| Flat bright fractal floor | dark interior, brightness 0.12 + 0.5·k |
| Trip effect always on | it is an event (lick, spell hit), fading over ~2 s |
| Random props everywhere | three composed scenes, each with one hero element and a sightline to it |
| Inventing new models for the weirdness | reuse models; recolour with shaders. New models only from reels/frames (Meshy) |

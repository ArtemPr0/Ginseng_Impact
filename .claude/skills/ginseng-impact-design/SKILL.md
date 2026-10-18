---
name: ginseng-impact-design
description: Use when doing any visual work on Ginseng Impact — colours, materials, lighting, fog, sky, water, waterfalls, shaders, post-processing, terrain, landmarks, creatures, characters, VFX, HUD, menus, fonts, icons — when laying out a place on the map, or when asked what the game should look or feel like. Also use before choosing a Three.js light, fog, material or render setting in this repo.
---

# Ginseng Impact — design language

**Thesis: a glowing cobalt night you never get bored walking through.** The target frame is the user's reference
`docs/reference/frames/world-look-28.png`: a flagstone road between glowing blue mushrooms to a candle-lit wooden
bridge over an eye-shaped psychedelic vortex, a village with warm windows, floating rock islands with dead trees
pouring glowing waterfalls, gothic spires, a huge blue cyclops. Sources are the @ozavry_ reels and the user's frames
(`references/sources.md`). "Ginseng" is a pun on Genshin; no ginseng anywhere.

## The five rules

1. **Cobalt night, neon glow.** Deep navy and cobalt fill most of every frame; what glows (water, falls, mushroom
   caps, eyes, runes) is saturated cyan, electric blue, violet and the rainbow of the eye vortex. Never grey, never
   brown, never desaturated "dark fantasy".
2. **Light is the moon plus emissives.** One cold moon (with a face), a cobalt hemisphere, and glow from emissive
   materials that the bloom turns into light. Warm points are allowed as *small* accents — torches, candles, lit
   windows, burning castles — never a warm key or fill light.
3. **Cinematic, not retro.** Half-float render → bloom on emissives → per-world grade (saturation, cobalt lift,
   vignette) → ACES → FXAA (`src/render/Renderer.ts`, `LOOKS`). The PS1 look (low-res, dither, flat shading) was
   rejected; never reintroduce it.
4. **Real sizes, big views.** Size everything as if real (houses ~6 m, cathedral 55 m, cyclops 9 m). Compose with
   a path leading the eye to a landmark, something floating overhead, something glowing below, a spire on the skyline.
5. **Never boring for more than 10 seconds.** At walking pace (~5 m/s) the player meets something new every 40–50 m:
   a landmark, a creature, a waterfall, a bouncy mushroom, fireflies, a sky eye to shoot, a shooting star.
6. **One vibe per district.** Never scatter a reel's subjects across the map: each reel (or family of reels) owns a
   place with its own floor, fog, sky and look, and its mobs stay in it. Lean, gold, diamonds, grills and dragons
   live in Yung Lean's kingdom (the Lean Quarter); the island stays storybook; snow places have snow ground and
   snowfall; a new reel with no room on the island gets a realm (the Dragon's Vale, the Sunken City). See the map below.

## The @returndark vibe (round 6: the Lean Quarter, the Sunken City, the Dragon's Vale)

Dark-fantasy at night, rendered rich: **deep purple-blue darkness, purple light, gold and diamonds that sparkle**.
Skeletons with gold or diamond grills and chains sip purple lean from double cups; black dragons with gold horns
and diamond teeth lounge and drink; knights in blue plate raise goblets; everything is lit by purple flames,
lanterns and the moon. Recipes (skill `ginseng-effects` has the code):

- Purple torches and braziers: `fire(..., PURPLE_FIRE)`; lean falls and fountains: `cascade({ color: LEAN_FALL })`.
- Diamonds catch light: `Glints` on grills, chains, cups, gems, coin heaps (quick 4-point star pops).
- Purple mist on the floor: `mistLayers(..., 0x5a26b0, 0.26)`; a purple `skyVortex` over a castle; a `ringedPlanet`
  and `meteors` in the sky.
- Night per district: `DISTRICT_AIR` (fog, `kingdomNight` sky darkening, `lean-night` / `lean-snow` looks).
- Underwater (DeVj-Z8POjl): deep teal, warm orange lanterns, `waterCeiling` with the sun, `lightShafts`,
  faint `causticFloor`, `risingBubbles`, fish with `patchSwim`, a `seabed` hiding every edge.

## The map (districts)

| District | Where | Reels | Feel |
|---|---|---|---|
| Island heart, hamlet, eye | island south | world-look-28 | cobalt night, glowing mushrooms, falls |
| Lantern village street | island SW (-34, 70) | early reels | thatched houses, torches, tavern, knights |
| Frost March | island NE (x > 57, z < −42) | DeJj8CDhL2f | snow ground, snowfall (`LAYOUT.snowZones`), yeti |
| Dead wood, gorge, spire castle | island N/NW | Ddn0A49tnW7, shot-011636 | dead trees, black spires |
| Lean Quarter (Yung Lean's kingdom) | realm (1000, 0) | DeXn5rSPxR8, DeOemU1BOZF, DeaqHWJBBPw, Den1ausBXai, DeldocTvFiB, Def4LDkxikA, DeYtKbMh76x | vaporwave plaza; purple night quarters |
| Sunken City | realm (−1000, 0) | DeVj-Z8POjl | drowned street, kelp road, Fish King |
| Dragon's Vale | realm (1000, 900) | Dd5Bqt7vQ5T | village + dragon, crowned head, aurora, floating castle |
| Alley of Graves, dream, tree house | realms | shot-011654, DefYcvutTow | as built |

## Quick reference (see also skills `ginseng-effects`, `ginseng-animation`, `ginseng-reel-to-game`)

| Task | Use | Read |
|---|---|---|
| Grade, bloom, trip warp per world | `renderer.setLook(LOOKS[id])`, `renderer.trip(strength, s)` | `references/rendering.md` |
| Sky per world, black sun, face moons | `SKIES` presets + `sky.setPreset`, `faceMoon(id, r, {crescent})` | `references/rendering.md` |
| Water that reflects the sky | `waterMaterial`, `poolWater`, `waterRibbon`, `eyePool` (`src/world/Water.ts`) | `references/rendering.md` |
| Waterfalls | `cascade({x, z, top, height, width, yaw, curve, color})` (`src/world/Falls.ts`) | `references/rendering.md` |
| Glowing flora, lit windows, white blooms, stone statues | `FloraOptions.patch` + `patchGlowCap` / `patchLitWindows` / `patchWhiteBloom` / `patchStone` | `references/rendering.md` |
| Watching eyes, fireflies | `SkyEyes`, `fireflies()` (`src/render/`) | `references/motifs.md` |
| Landmark, creature, flora, character | Meshy models only, from the reels/frames | `references/motifs.md` |
| Colour decisions | palette tokens | `references/palette.md` |
| HUD, menus, fonts | Cinzel + Inter on navy panels | `references/ui.md` |
| Psychedelic places (the frog's dream) | the dream's recipes | skill `ginseng-psychedelic-dream` |

## Before you ship a visual change

- [ ] Screenshot it headless (`.claude/skills/verify`) next to the reference frame it copies.
- [ ] The frame is mostly deep blue; glows bloom but nothing is blown to white (no glow colour channel above ~1.5).
- [ ] Warm colour only in small points (flames, windows).
- [ ] Nothing floats unless it is meant to (islands, eyes, moons); nothing sinks; every walkable thing has colliders.
- [ ] Frame rate at the island heart, the dream and the kingdom is no worse than before.

## Common mistakes (seen in practice)

| Mistake | Fix |
|---|---|
| Bloom and glows so strong the frame washes out white-blue | Island look: bloom 0.7, threshold 0.78; emissive caps ≤ ~0.5 of colour |
| Shiny GLB materials catch the moon as white sheen on glowing caps | roughness ≥ 0.85, metalness 0 (patchGlowCap does it) |
| Restyling a GLB material in place recolours every copy of that model | clone per set (`FloraOptions.patch` clones; `restyle()` in Heart/Dream) |
| A building placed where it overhangs the chasm or the cliff | check the land disc (r 124 from (0,-36)), the chasm band (z -34..-80) and PADS first |
| Trees growing over a new road or vista | filter the scatter (see the spawn-vista filter in World.ts) |
| Trip effect lingering into the next place | it fades over ~2 s; strengths ≤ 0.6 for spells, 1 only for the lick |

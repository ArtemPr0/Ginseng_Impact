---
name: ginseng-effects
description: Use when adding or tuning visual effects in Ginseng Impact — flames, sparkle or diamond glints, mist or fog layers, waterfalls or lean falls, fountains, smoke, snow or rain, underwater light (caustics, light shafts, bubbles, water surface), sky objects (vortex, ringed planet, meteors, moons, aurora), glowing windows, or any "make it look like the reel" effect pass.
---

# Ginseng Impact — effects

Effects are procedural (shaders and sprites); everything solid is a Meshy model. Code that builds geometry for an
effect lives in `src/render/` (allowed by `npm run audit:procedural`); world files call the helpers.

## Recipes

| Effect | Call | Notes |
|---|---|---|
| Flame (torch, brazier, hearth) | `fire(x, y, z, scale, intensity, colors?)` (world/Fire.ts) | `PURPLE_FIRE` for the Lean Quarter, `{core: 0x2ff0d0, ...}` teal for the drowned hearth. `intensity >= 6` adds a point light: at most a couple per area. |
| Diamond sparkle | `new Glints(count, rate)` then `add(objectOrPoint, offset, spread)`; `update(dt)` (render/LeanFx.ts) | Grills, chains, iced cups, gems, coin heaps. Anchors on an Object3D follow it. |
| Floor mist | `mistLayers(x, z, w, d, y, color, opacity, layers)` | Lean: `0x5a26b0`, 0.26. Snow haze: `0xc8d6ff`, ≤ 0.16 (more washes the scene white). |
| Lean / water falls | `cascade({x, z, top, height, width, yaw, curve, color})` (world/Falls.ts) | Lean `new Color(0.62, 0.22, 1.25)`. Gate falls on their source model: `if (PRESENT_MODELS.has(id))`, and start them at the model's probed wall or rim (`heightAt` scan), never in front of it. `yaw` 0 pours toward +z (outward d = (cos θ, sin θ) is yaw π/2 − θ). |
| Tiered fountain | `fountain(x, z, y, {basinY, basinR, bowlY, bowlR, jetY}, color)` (render/Fountain.ts) | Measure the tiers on the model (radius per height slice); jet, curtain and pools all centre on it. |
| Rope / lamp line | `rope(a, b, sag)` (render/Rope.ts) | Hang lamps from points along a rope between posts: nothing hangs from nothing. |
| Still water sheet / moat | `waterSheet(x, z, w, d, level, [deep, shallow, foam])` (world/Water.ts) | Lean moat `[0x1a0640, 0x7a32e0, 0xe0b8ff]`. |
| Smoke (vape, chimney, pipe) | `new PipeSmoke(color)`; emitter at the mouth/chimney; `update(dt)` | Purple `0xb36bff`; chimney `0x9aa6c0` with the emitter scaled ×6. |
| Snow / rain | `LAYOUT.snowZones`, `LAYOUT.rainZone` (render/Weather.ts) | Add a zone for a new snowy place; ground with `snowGround()`. |
| Floors | `snowGround`, `flagstoneFloor`, `cobbleFloor(.., tone)`, `grassGround`, `seabed`, `rockTop` (render/Floors.ts) | Unlit shader planes. Write colours as they should look on screen: `floorMaterial` converts them to linear (without that 0.13 showed as 0.4). Stack overlapping floors 2–3 cm apart or they z-fight. |
| A floating island you can stand on | `landableIsland(api, x, z, base, {scale, yaw, tree})` (world/Islands.ts) | Still, solid on top (r = 5 m per unit of scale), tree clipped and replaced. Tops within 55 m of the floor below (the flight ceiling). Two big props on one island need scale 1.5. |
| One ground for several districts | `quarterFloor(rects, y)` (render/Floors.ts) | Noise-warped borders blending 5 m; frays onto a neighbouring floor. 3 cm over any floor under it. |
| Underwater | `waterCeiling`, `lightShafts`, `causticFloor`, `risingBubbles`, `tickUnderwater(dt)` (render/Underwater.ts) | Caustics faint (0.16); shafts billboard in their shader; the ceiling takes fog. |
| Sky objects | `skyVortex(size, colors)`, `ringedPlanet(r)`, `meteors(center, r, h)`, `horizonMoon(size)` | Moons dimmed below bloom; vortex `[0x4a2a9a, 0xa04ab0]` reads purple, not neon pink. |
| Night per district | `DISTRICT_AIR` + `leanDistrict()` (data/world.ts), `kingdomNight` (Kingdom.ts) | Fog, sky darkening, renderer look (`LOOKS`). |
| Light per place | `ZONE_LIGHT` (data/world.ts), blended in main.ts | Hemisphere colours, moon, fill. `cameraFill: 1` swings the fill behind the camera so characters keep true colours at night (white mimics, a green dragon); floors are unlit and stay dark. Rooms: moon 0, warm fill. |
| A room (indoors) | a small realm with `ownSky` + `indoors`, `darkHollow(x, y, z, r, fogColor)` round it, `plankFloor(.., pools)` (render/Floors.ts) | world/Interiors.ts. The hollow must write depth or the island's cloud sea shows through gaps. `patchRetint(mat, tint)` re-colours a reused model's texture (the drowned tavern's face as a warm hearth wall). |
| Lit windows | `patchLitWindows(mat, strength, glow)` (render/Materials.ts) | Lights warm texels: never on thatch or warm roofs (glow sprites at the windows instead). |
| Glow halo | `glowSprite(color, size, opacity, fog)` (render/Glow.ts) | The cheapest light: lanterns, jellyfish, gems. |

## Rules

1. **Darkness first.** The reels are night scenes: dark floor, dark fog, glows on top. If a screenshot looks pale,
   the culprit is usually an unlit floor colour, a mist layer, a bright sky object or the CD-moon bloom. Check a
   floor against the reel frame side by side, not alone.
2. **Gate on the source.** A fall, jet, drip or glint that comes *from* a model only exists once that model's file
   does (`PRESENT_MODELS`), or it pours from thin air.
3. **Budget.** ≤ 6 live point lights (LightBudget), ~10 transparent planes in one view, shared clocks
   (`tickLeanFx`, `tickUnderwater`) advanced once per frame from a realm `vfx` update.
4. **Check it headless** (skill `verify`): a lit studio shot for shapes, and a normal shot for the mood.

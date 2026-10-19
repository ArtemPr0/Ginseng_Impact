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
| Lean / water falls | `cascade({x, z, top, height, width, yaw, curve, color})` (world/Falls.ts) | Lean `new Color(0.62, 0.22, 1.25)`. Gate falls on their source model: `if (PRESENT_MODELS.has(id))`. |
| Still water sheet / moat | `waterSheet(x, z, w, d, level, [deep, shallow, foam])` (world/Water.ts) | Lean moat `[0x1a0640, 0x7a32e0, 0xe0b8ff]`. |
| Smoke (vape, chimney, pipe) | `new PipeSmoke(color)`; emitter at the mouth/chimney; `update(dt)` | Purple `0xb36bff`; chimney `0x9aa6c0` with the emitter scaled ×6. |
| Snow / rain | `LAYOUT.snowZones`, `LAYOUT.rainZone` (render/Weather.ts) | Add a zone for a new snowy place; ground with `snowGround()`. |
| Floors | `snowGround`, `flagstoneFloor`, `cobbleFloor(.., tone)`, `grassGround`, `seabed`, `rockTop` (render/Floors.ts) | Unlit shader planes. Write colours as they should look on screen: `floorMaterial` converts them to linear (without that 0.13 showed as 0.4). Stack overlapping floors 2–3 cm apart or they z-fight. |
| A floating island you can stand on | `clipAbove(mat, y)` on the island's cloned materials (render/Materials.ts) + `rockTop(x, z, r, y)` | `floating-island` carries a giant dead tree: clip it away at the floor and add an ordinary `dead-forest-tree`. A bobbing island must not carry anything static. |
| Underwater | `waterCeiling`, `lightShafts`, `causticFloor`, `risingBubbles`, `tickUnderwater(dt)` (render/Underwater.ts) | Caustics faint (0.16); shafts billboard in their shader; the ceiling takes fog. |
| Sky objects | `skyVortex(size, colors)`, `ringedPlanet(r)`, `meteors(center, r, h)`, `horizonMoon(size)` | Moons dimmed below bloom; vortex `[0x4a2a9a, 0xa04ab0]` reads purple, not neon pink. |
| Night per district | `DISTRICT_AIR` + `leanDistrict()` (data/world.ts), `kingdomNight` (Kingdom.ts) | Fog, sky darkening, renderer look (`LOOKS`). |
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

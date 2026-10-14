# Ginseng Impact — Design Spec

Date: 2026-10-14
Status: approved (plan approved in session; this spec records the design)

## 1. Goal

Build **Ginseng Impact**, a browser-based, single-player, Genshin-Impact-style action RPG vertical
slice, rendered in the visual language of the @ozavry_ Instagram reels: retro low-poly PS1/N64 dark
fantasy, cobalt-blue, lunar, fog-bound, monumental.

Two deliverables:

1. A project-scoped Claude Code skill (`.claude/skills/ginseng-impact-design/`) that encodes the
   visual language so every later visual task (shaders, world, HUD, VFX) stays on-style.
2. The game's first playable slice: exploration + light combat in one open area.

## 2. Visual source (what was observed)

All 11 reference reels belong to one creator, @ozavry_ (dark-fantasy AI visuals). Video playback is
login-gated, but ~25 cover frames and all captions were inspected. Findings:

| Aspect | Observation |
|---|---|
| Dominant colour | Deep cobalt / ultramarine on near-black. Blue is ~80% of every frame. |
| Accents | Glowing blood red (eyes, blood moon); cyan/teal emissive (portal fire, runes); moon silver; violet-magenta dusk skies; acid green (witch/forest). |
| Fog | Always blue-tinted, thick, layered; never grey. |
| Rendering | Half the frames are retro low-poly PS1/N64 (flat shading, low-res textures, vertex wobble). Half photoreal AI. We take the low-poly direction. |
| Motifs | Giant stone heads with red eyes; gothic cathedral spires on cliffs above a cloud sea; stone causeway in one-point perspective; moons (silver / blood / with a face); dark pines; glowing blue sunflowers; astral frog; witches; lone armoured knight; waterfalls; star fields. |
| Composition | Tiny lone figure vs. monument; low horizon; huge sky; path leads eye to focal landmark. |
| Mood (captions) | "Silent Kingdoms Beyond the Fog", "Lost Kingdoms Under Silver Moons", "Forgotten Castles Under Dark Skies", "Lonely Towers of the Forgotten Realm", "Mystical Echoes of a Lost Realm", "Last Garden of Darkness", "Astral Frog King", "Beyond the Silent Mountains". |

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Platform | Web: Vite + TypeScript + Three.js (vanilla) | Buildable and visually verifiable by the agent; static deploy to Vercel. |
| Art | ~~Retro low-poly PS1~~ → **Cinematic**: full-res, smooth shading, soft shadows, bloom, grade, mist | The PS1 build was rejected by the user as "too pixelated / Roblox"; the target is the photoreal half of the reels. Still fully procedural. |
| First slice | Exploration (walk/sprint/jump/climb/glide) + light combat (3-char party, attack + skill, 2 enemies, reactions) | Delivers the Genshin "feel" in one scene. |
| Physics | Custom kinematic controller vs. heightfield + simple colliders | No engine dependency; climbing/gliding are easier kinematically. |
| HUD | DOM overlay (HTML/CSS) | Crisp text at any resolution over the low-res 3D. |
| Out of scope | Gacha, accounts, backend, quests, swimming, audio | YAGNI for the slice. |

## 4. Element reskin

Genshin → Ginseng: Cryo→**Lunar**, Pyro→**Blood**, Electro→**Astral**, Anemo→**Fog**,
Geo→**Stone**, Dendro→**Rot**, Hydro→**Tide**. The slice implements Lunar, Blood, Astral.

Reactions (slice): Lunar+Blood = **Eclipse** (burst damage), Lunar+Astral = **Conduit**
(defence down), Blood+Astral = **Overload** (knockback AoE).

## 5. Party and enemies

| Name | Element | Archetype (from reels) | Weapon | E skill |
|---|---|---|---|---|
| Vesper | Lunar | silver-cloaked swordswoman | moon-blade | Moonfall: slash that leaves a frost ring |
| Morrow | Blood | the lone armoured knight | greatsword | Crimson Cleave: cone + burning ground |
| Ashka | Astral | the witch | staff | Starfall: bolt that chains to 2 enemies |

Enemies: **Fog Wisp** (hovering, ranged bolt, fragile) and **Stone Sentinel** (slow, heavy melee,
miniature of the giant head motif, red eyes).

## 6. Architecture

See `src/` layout in the plan (`core/`, `render/`, `world/`, `player/`, `characters/`, `combat/`,
`ui/`, `data/`). Pure logic (elements, combat math, controller state machine, party, stamina) lives
in dependency-free modules and is unit-tested with vitest. Rendering is verified visually.

Render pipeline: scene → low-res `WebGLRenderTarget` (480×270 base) → dither/quantize pass →
nearest-neighbour upscale to the canvas. Materials are `MeshLambertMaterial` patched via
`onBeforeCompile` for vertex snapping and flat shading. Fog is `FogExp2` in the `fog` token colour.

## 7. Controls

WASD move · Shift sprint · Space jump / hold toward wall to climb / Space in air toggles glide ·
LMB attack (3-hit combo) · E skill · 1/2/3 switch · mouse orbit (pointer lock) · Esc pause.

## 8. Milestones

M0 scaffold + look → M1 player → M2 traversal → M3 world → M4 combat → M5 HUD → M6 polish + deploy.
Each milestone: tsc clean, vitest green, build clean, Chrome screenshot checked against the skill.

## 9. Success criteria

- A screenshot of the spawn view reads as an @ozavry_ frame: cobalt dominant, blue fog, red eyes
  on a monument, one-point causeway, visible dither, low-poly silhouettes.
- A player can walk, sprint, jump, climb a wall, glide over the cloud sea, switch between three
  characters, and defeat both enemy types, triggering at least one elemental reaction.

## 10. Revision 2026-10-14 (evening): cinematic rework

User feedback on the first slice: "mobs and animation look like Roblox", "too pixelated, match the videos".
Rework (M7): full-resolution MSAA + bloom + grade pipeline, PCF soft shadows, cloud sky, mist layers and
motes, grass and flower meadows, noise-displaced rock, jointed capsule rigs with cloaks and weapon trails,
spirit wisp and rock golem mobs, title dolly, camera shake. Hard ceiling: procedural geometry cannot match
AI-generated video photorealism; real animated glTF characters are the next step and need asset approval.

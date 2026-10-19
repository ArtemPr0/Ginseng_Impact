---
name: ginseng-reel-to-game
description: Use when the user sends Instagram reels (the @returndark or @ozavry_ accounts, or similar) to add to Ginseng Impact, asks to "add everything from these reels", to match a reel exactly, to generate models from a reel with Meshy, or to check that reels are present in the game.
---

# From a reel to the game

## 1. Watch it properly

Open `instagram.com/p/<code>/` in the logged-in Chrome tab, find the `video_versions` URL nearest
`"code":"<code>"` in the page HTML, play it in an overlay `<video>`, seek every ~2 s and `zoom` on (0,0)-(420,746).
Write what each shot shows into `docs/reference/reel-notes.md`: subjects, materials, light, colours, motion.
Saving frames to disk is blocked by the permission classifier: ask the user for screenshots at named seconds
(reel @ s), and copy them into `docs/reference/frames/` for image-to-3D.

## 2. Decide the district before the models

Each reel belongs to one place (design skill rule 6). Add to an existing district if it fits the vibe; otherwise
give it a realm (floor, fog, sky preset or own sky, look, portal from where it makes sense). Search for free
ground headlessly before planning island placements (the island is crowded).

## 3. Models (Meshy): only what the reel shows

- One registry entry per subject in `src/data/models.ts`, label ending with the reel code. Reuse an existing model
  (tinted, scaled, restyled) when the reel's thing is close enough: it costs nothing.
- **Complete bodies.** If the reel shows a character only from the waist up, or side-on, the prompt still says:
  full body, standing in A-pose, both arms and hands, both legs and feet, back of the body, what the hidden parts
  wear. Props in hand are named (double cup, tankard with a candle, glowing book). Creatures that lie down are
  prompted lying down, whole, with tail and all four legs.
- Image-to-3D from a screenshot cropped to the subject on a plain background (clutter becomes geometry).
- Review every draft preview before paying for texture; drop broken drafts.
- Ask the user before spending past the agreed budget. Characters: biped rig + presets (skill `ginseng-animation`).

## 4. Build the scene

Place by id (`modelLandmark`, `floraSet`, `Rig`/NPC defs); nothing shows until the file exists, so the layout can
be written first. Add the reel's effects (skill `ginseng-effects`): light, mist, falls, sparkle, sky.

Once the GLBs are in, check every placement in game (a guess made before the model existed is often wrong):
- **NPCs stand on the highest collider surface at their anchor.** An anchor in a pillar, a table, a stall or a roof
  puts them on top of it; out in a realm a seat must use the realm floor, not the island terrain (it is the void).
  Probe `heights.heightAt(x, z, y)` over a grid round the spot and read the numbers; use `dy`, or an absolute `y`
  for a model that is one piece with its seat (the plague doctor and his chest).
- **Closed models have no inside.** A booth, hut or stall window is part of the mesh: put the keeper at its front.
- **Facing is measured, not assumed.** A model's front can sit 30–45° off what `face()` expects (the lean dragon):
  shoot it from the court and turn it. Box footprints turn the other way from model yaw (local x runs along
  (cos rotY, sin rotY)): use `rotY: -yaw` for a box under a model placed with `yaw`.
- Props that belong to a character (the reader's book) go where the body actually is in its pose: shoot a close-up.
- **Anything placed for a realm goes into that realm's group** (`enterZone(realm.id)`): the island's group is hidden
  while the player is in a realm, so a seat barrel placed with the island zone never shows.
- A clip named `Sit_and_Drink` is a seated pose: give that NPC a seat (`SEATED` + `dy`), or it squats in mid-air.

## Interiors

A reel shot indoors (a tavern, a crypt bar) gets a room behind a door: a small realm (`ownSky`, `indoors`, dark fog,
its own `LOOKS` and `ZONE_LIGHT` entries) entered and left by `Interactable`s (world/Interiors.ts). The walls are a
Meshy model: reuse one (a facade as the far wall, shelves and barrel stacks down the sides, darkness past them) or
generate a room with a **"cutaway diorama ... open front"** prompt (text-to-3D; the crypt bar came out right first
time). Rooms with a roof get `collider: 'none'` and hand-made boxes measured by vertical ray picks over a grid
(floor, counters, vaults); a baked grid would make the roof the floor.

## 5. Verify against the reel

For every reel: a sheet of its frames beside headless captures from the matching spots (skill `verify`), each
subject ticked off or listed as missing (model not made yet, or a gap). Report gaps honestly. Judge the mood too:
a reel shot inside (a tavern, a crypt bar) is not matched by the same characters standing outdoors.

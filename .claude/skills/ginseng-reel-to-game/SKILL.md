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

## 5. Verify against the reel

For every reel: a sheet of its frames beside headless captures from the matching spots (skill `verify`), each
subject ticked off or listed as missing (model not made yet, or a gap). Report gaps honestly.

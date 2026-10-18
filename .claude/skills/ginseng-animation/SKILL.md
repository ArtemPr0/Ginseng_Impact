---
name: ginseng-animation
description: Use when animating characters, NPCs, mobs or creatures in Ginseng Impact — sipping or drinking, toasting, sitting, reading, holding a cup, tankard, book or mushroom, hand and finger poses, grips that look wrong, a creature that should breathe, swim, drip or bob, or choosing Meshy animation presets for a new model.
---

# Ginseng Impact — animation

Bodies are Meshy GLBs rigged by Meshy (biped) with Meshy presets; the game layers and corrects them in
`src/characters/Rig.ts`. Static creatures move procedurally.

## Clips: which presets to add (free, on rigging)

| Character does | Presets | Pose in NpcDef |
|---|---|---|
| Stands and sips / toasts | Idle_02, Walking, **Stand_and_Drink** | `pose: 'drink'` (the clip named `drink` wins) + `sipAt` ≈ 0.42 |
| Sits and sips (bench, wagon, beside a dragon) | Idle_02, **Sit_and_Drink** (Chair_Sit_Idle) | `pose: 'drink'`, add the id to `SEATED` (World.ts) or set `dy` onto its seat |
| Reads | Idle_02, a reading/sit clip | `pose: 'read'` |
| Serves at a counter | Idle_02, Talk_with_Hands_Open | `pose: 'offer'` |
| Mob | Combat_Stance, Walking, Running, Attack / Charged_Ground_Slam, Hit_Reaction, dying_backwards | `clips: BOSS_CLIPS` |

Model the prop in the hand (the cup, the tankard, the book): it is part of the mesh and moves with the clip. Only
the hero's cup is a separate prop (it needs solved fingers, below).

## Rules that keep hands and props right

1. **A held prop is fitted, never placed by eye.** Seat it against the palm along the knuckle line, then solve each
   finger joint onto its surface (`Rig.fitCup`: binary search per joint until the next joint sits a glove's
   thickness off the wall). Measure gaps in cm in a headless script; aim 1.0–1.3.
2. **The wrist tilts, the fist never opens.** Level, tip toward the mouth, pour: turn the hand bone (`tipCup`,
   `levelByWrist`, `pourByWrist`), never the prop inside the fist.
3. **Mouths are measured.** Put coloured markers at heights on the head (headless) and read where the lips are;
   a sip or bite brings the rim/cap *there* with CCD (`reach`, `reachWith`).
4. **Low-poly hands crumple past ~30° of finger bend.** Ease clip finger curls toward the bind pose
   (`bindFingers` + `relaxHands`), restoring the clip's rotation first each frame so nothing piles up.
5. **Restore every procedural turn before the mixer** (`Rig.turn` records them): a frozen or constant track is not
   rewritten, so an unrestored tweak accumulates.

## Static creatures (no rig)

- Breathe: scale ±0.8–1.5 % on a slow sine (`modelLandmark` does this for idle statics).
- Swim / fly: `patchSwim(mat, axis, from, to, amp)` (fish, whale), `patchWingFlap` (dragon riders).
- Drink / drip: emit glow-sprite drops from a mouth point in the model's frame (LeanQuarter's lean dragon).
- Bob: islands, platforms, crowns, gems: `root.position.y = base + sin(t·k) · a` in the landmark's `update`.

## Check

Studio close-ups from front and side under a test hemisphere light (skill `verify`), plus numbers: finger gaps,
rim-to-mouth distance, tilt angles. Compare against the reel frame.

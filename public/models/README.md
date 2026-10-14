# Real 3D models

Drop Meshy (or any glTF 2.0 binary) exports here. The game checks for each file at startup and uses it in place
of the procedural version when present; missing files simply keep the procedural fallback.

File names and target heights are defined in `src/data/models.ts`. Expected files:

| File | Replaces | Height (m) | Needs rig/clips |
|---|---|---|---|
| knight.glb | Sir Aldric (party) | 1.95 | yes (Idle_02, Walking, Running, Basic_Jump, Right_Hand_Sword_Slash, Sword_Judgment, Sword_Shout, Hit_Reaction, Stand_Dodge, dying_backwards) |
| archer.glb | Wren (party) | 1.8 | yes (Idle_02, Walking, Running, Basic_Jump, Archery_Shot, Archery_Shot_1, Archery_Aim_with_Lateral_Scan, Hit_Reaction_with_Bow, Stand_Dodge, dying_backwards) |
| wizard.glb | Orlan (party): the closed-robe image-to-3D model the user chose; `robe: true` makes the rig hover, sway, lean into casts and flutter the hem (patchRobeWind), `smoke` puts pipe smoke at his mouth | 1.85 | no clips (boneless); procedural |
| yeti.glb | the Yeti boss | 5.2 | yes (Meshy presets: Combat_Stance, Walking, Running, Charged_Ground_Slam, Attack, Shouting_Angrily, Hit_Reaction, dying_backwards) |
| horned-shade.glb | the Horned Shade | 7 | yes (Combat_Stance, Walking, Charged_Spell_Cast, mage cast, Shouting_Angrily, Hit_Reaction, dying_backwards) |
| antlered-warden.glb | the Antlered Warden | 15 | yes (same preset set as the Yeti) |
| moon-wyrm.glb | the Moon Wyrm | 3 (body) | static smart rig (Meshy cannot animate smart rigs yet); the game banks and bobs it |
| rock-troll.glb | the Gorge Troll | 4.6 | yes (Yeti set + Slow_Orc_Walk) |
| lake-lurker.glb | the Lake Lurker | 4.2 | static smart rig (half body; breathes in-game) |
| marsh-demon.glb | the Marsh Sovereign | 12 | static smart rig (half body; breathes in-game) |
| hollow-king.glb | the Hollow King (seated, castle in the ribs) | 42 | static (no rig possible); breathes in-game |
| log-giant.glb | the log-hauling stone giant on the village loop | 7.5 | yes (Carry_Heavy_Object_Walk, Walking, Combat_Stance, Hit_Reaction) |
| spider-chapel.glb | the spider that carries a chapel | 34 | static smart rig; walks its loop in-game |
| river-shade.glb | the River Shade | 5 | yes: idle, walk, cast |
| fog-beast.glb | fog beasts and the Pass Beast | 1.5 / 3.8 | yes: idle, run, bite |
| stone-sentinel.glb | stone sentinels | 2.6 | yes: idle, walk, punch |
| fog-wisp.glb | fog wisps | 1.4 | idle only |
| crocodile.glb | mire crocodiles | 1.0 | yes: idle, walk, bite |
| frog-king.glb | the Frog King | 6 | idle (breathing) |
| moon-shell-colossus.glb | the Moon-Shell Colossus | 18 | crawl |
| antlered-king.glb | the Antlered King | 1.95 | sit |
| witch.glb | the coven witches | 1.85 | idle, walk, cast |
| giant-head.glb, cathedral.glb, castle.glb, demon-church.glb, wizard-tower.glb, tree-house.glb | landmarks | 52 / 118 / 44 / 36 / 100 / 48 | static |

Clip names are matched by substring, case-insensitive, and an entry may list alternatives ("slam|attack|punch"),
so Meshy's preset ids ("Combat_Stance", "Walking", "Charged_Ground_Slam") work without renaming.
Models should face +X in their own space; set `yaw` in `src/data/models.ts` if a file faces another way.

## Pipeline (Meshy Pro)

1. Image-to-3D from a frame in `docs/reference/frames/` (texture on) or Text-to-3D + Texture.
2. Models over 300k triangles: Animate sidebar → "установка" remesh at 30K (free).
3. Rig: Humanoid for bipeds (check the markers; horns and logs confuse the auto-placement), Smart rig for everything else.
4. Add presets from the library (free), then Download → glb → "All added" + "One file".
5. `node scripts/model-tools.mjs optimize <download.glb> public/models/<name>.glb` (WebP textures, ~20 MB → 2–4 MB).

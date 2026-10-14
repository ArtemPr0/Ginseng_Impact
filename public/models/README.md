# Real 3D models

Drop Meshy (or any glTF 2.0 binary) exports here. The game checks for each file at startup and uses it in place
of the procedural version when present; missing files simply keep the procedural fallback.

File names and target heights are defined in `src/data/models.ts`. Expected files:

| File | Replaces | Height (m) | Needs rig/clips |
|---|---|---|---|
| vesper.glb, morrow.glb, ashka.glb | party members | 1.8 / 1.95 / 1.75 | yes: idle, walk, run, jump, slash/cast, heavy, hit, death |
| yeti.glb | the Yeti boss | 5.2 | yes: idle, walk, punch, roar, hit, death |
| horned-shade.glb | the Horned Shade | 7 | yes: idle, walk, cast, hit, death |
| antlered-warden.glb | the Antlered Warden | 15 | yes: idle, walk, punch |
| moon-wyrm.glb | the Moon Wyrm | 3 (body) | yes: fly, bite |
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

Clip names are matched by substring, case-insensitive, so Meshy's defaults ("Idle", "Walking", "Sword Slash") work.
Models should face +X in their own space; set `yaw` in `src/data/models.ts` if a file faces another way.

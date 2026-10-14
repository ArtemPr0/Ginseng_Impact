# Real 3D models (Meshy only)

Every structure, creature, NPC and plant in Ginseng Impact is a Meshy export placed by its registry id
(`src/data/models.ts`). Nothing is built procedurally any more: a missing file shows a small glowing marker
(structures, characters, enemies) or nothing at all (instanced flora), and the browser console warns once
per missing id at startup. `npm run todo:models` prints the same list; `npm run audit:procedural` (part of
`npm run build`) fails if procedural geometry comes back.

Pipeline (Meshy Pro): image-to-3D from `docs/reference/frames/` (texture on, A-pose for humanoids) or
text-to-3D + image-guided texture → remesh at 30K → Humanoid rig with presets (free) or static → Download
glb ("All added", "One file") → `node scripts/model-tools.mjs optimize <download.glb> public/models/<file>`.
Models should face +X; set `yaw` in the registry if a file faces another way. Clip names match by substring
with alternatives (`"slam|attack|punch"`).

107 registered, 16 present, 90 files to generate (91 ids).

| id | file | height (m) | what | status |
|---|---|---|---|---|
| `knight` | knight.glb | 1.95 |  | present |
| `archer` | archer.glb | 1.8 |  | present |
| `wizard` | wizard.glb | 1.85 |  | present |
| `yeti` | yeti.glb | 5.2 |  | present |
| `shade` | horned-shade.glb | 7 |  | present |
| `warden` | antlered-warden.glb | 15 |  | present |
| `wyrm` | moon-wyrm.glb | 3 |  | present |
| `troll` | rock-troll.glb | 4.6 |  | present |
| `lurker` | lake-lurker.glb | 4.2 |  | present |
| `marshdemon` | marsh-demon.glb | 12 |  | present |
| `hollowking` | hollow-king.glb | 42 |  | present |
| `rivershade` | river-shade.glb | 5 |  | to generate |
| `passbeast` | fog-beast.glb | 3.8 |  | to generate |
| `beast` | fog-beast.glb | 1.5 |  | to generate |
| `sentinel` | stone-sentinel.glb | 2.6 |  | to generate |
| `wisp` | fog-wisp.glb | 1.4 |  | to generate |
| `croc` | crocodile.glb | 1.0 |  | to generate |
| `frogking` | frog-king.glb | 6 |  | present |
| `loggiant` | log-giant.glb | 7.5 |  | present |
| `spiderchapel` | spider-chapel.glb | 34 |  | present |
| `colossus` | moon-shell-colossus.glb | 18 |  | to generate |
| `king` | antlered-king.glb | 1.95 |  | to generate |
| `witch` | witch.glb | 1.85 |  | to generate |
| `head` | giant-head.glb | 52 | giant stone head with red eyes | to generate |
| `cathedral` | cathedral.glb | 118 |  | to generate |
| `castle` | castle.glb | 44 |  | to generate |
| `church` | demon-church.glb | 36 |  | to generate |
| `tower` | wizard-tower.glb | 100 |  | present |
| `treehouse` | tree-house.glb | 48 |  | to generate |
| `causeway-segment` | causeway-segment.glb | 8 | causeway deck segment with balustrade posts | to generate |
| `causeway-stairs` | causeway-stairs.glb | 6 | causeway stairs at the south end | to generate |
| `chasm-bridge` | chasm-bridge.glb | 4 | wooden rope bridge span across the chasm | to generate |
| `witch-bridge` | witch-bridge.glb | 3 | stone bridge over the witch stream | to generate |
| `nave` | ruined-nave.glb | 26 | ruined nave with columns, arches and a rose window | to generate |
| `archgate` | arch-gate.glb | 14 | frozen arch gate | to generate |
| `palmisland` | palm-island.glb | 28 | floating palm island on an inverted rock | to generate |
| `colossus-statue` | kneeling-colossus.glb | 15.5 | kneeling horned colossus statue | to generate |
| `burning-castle` | burning-castle.glb | 68 | burning castle on the far shore | to generate |
| `village-house` | village-house.glb | 5.8 | thatched village house | to generate |
| `tavern` | tavern.glb | 7.6 | tavern with its sign, table and stools | to generate |
| `well` | well.glb | 1.2 | village well | to generate |
| `barrel` | barrel.glb | 1.1 | wooden barrel | to generate |
| `torch-post` | torch-post.glb | 2.6 | torch on a post | to generate |
| `campfire` | campfire.glb | 2.8 | campfire ring with tripod, kettle and three log seats | to generate |
| `cloister` | cloister.glb | 8.6 | cloister: three stone arches on a cobbled floor | to generate |
| `observatory` | observatory.glb | 12 | mushroom observatory hut with balcony and telescope | to generate |
| `throne` | throne.glb | 7.8 | antler-and-bone throne on a dais with candles | to generate |
| `cauldron` | cauldron.glb | 1.4 | iron cauldron over coals | to generate |
| `lantern-post` | lantern-post.glb | 2.5 | red paper lantern on a pole | to generate |
| `candle` | candle.glb | 0.3 | candle | to generate |
| `ruin-arch` | ruin-arch.glb | 6.6 | ruined stone arch | to generate |
| `ruin-column` | ruin-column.glb | 4.5 | broken stone column | to generate |
| `flooded-ruin` | flooded-ruin.glb | 9 | flooded ruin: ring of columns, wall and arch | to generate |
| `monolith` | monolith.glb | 12 | standing stone | to generate |
| `troll-gorge` | troll-gorge.glb | 15 | rock walls of the troll gorge | to generate |
| `floating-rock` | floating-rock.glb | 3 | floating boulder | to generate |
| `pinnacle` | pinnacle.glb | 30 | sea pinnacle rising from the cloud sea | to generate |
| `mountain` | mountain.glb | 180 | backdrop mountain | to generate |
| `orchard` | orchard.glb | 6 | orchard of gnarled trees (one block) | to generate |
| `boat` | boat.glb | 1.9 | rowing boat with two rowers | to generate |
| `horse-rider` | horse-rider.glb | 2.6 | knight on horseback with a lantern | to generate |
| `koi` | flying-koi.glb | 1.2 | flying koi | to generate |
| `snake` | snake.glb | 0.6 | coiled snake | to generate |
| `knight-npc` | knight-npc.glb | 1.9 | sword-and-shield knight (Aldous, the Vigil, Dunmar) | to generate |
| `knight-seated` | knight-seated.glb | 1.95 | caped greatsword knight sitting on the cliff (Sir Halvard) | to generate |
| `knight-rose` | knight-rose.glb | 1.95 | black knight offering a rose (Sir Corvin) | to generate |
| `skeleton` | skeleton.glb | 1.75 | skeleton (Rattle, Bone, Marrow) | to generate |
| `skeleton-banner` | skeleton-banner.glb | 1.85 | skeleton standard-bearer with banner and trident (Hollow Jack) | to generate |
| `witch-cook` | witch-cook.glb | 1.8 | skeleton cook in a chef hat with a spoon (Mother Marrow) | to generate |
| `bride` | bride.glb | 1.8 | the Pale Bride | to generate |
| `maiden` | maiden.glb | 1.68 | Elowen of the flower garden | to generate |
| `wanderer` | wanderer.glb | 1.85 | hooded wanderer with a lantern (the Lanternbearer) | to generate |
| `wizard-npc` | wizard-npc.glb | 1.8 | wizard NPC (Mirren, Sel) | to generate |
| `gnome` | gnome.glb | 1.15 | gnome astronomer with a telescope (Pim) | to generate |
| `frog-monk` | frog-monk.glb | 1.75 | frog monk reading a book (Brother Croak) | to generate |
| `troll-fisher` | troll-fisher.glb | 2.6 | troll fisher with a rod (Old Moss) | to generate |
| `goblin` | goblin.glb | 1.15 | tavern goblin (Snik, Vrak) | to generate |
| `pilgrim` | pilgrim.glb | 1.8 | river pilgrim | to generate |
| `ogre` | log-giant.glb | 3.1 | ogre woodhauler (Grub) — reuses the log giant | present |
| `pine` | pine.glb | 13 | pine tree | to generate |
| `snow-pine` | snow-pine.glb | 13 | snow-laden pine | to generate |
| `birch` | birch.glb | 11 | birch | to generate |
| `willow` | willow.glb | 9 | willow | to generate |
| `palm` | palm.glb | 8 | palm | to generate |
| `gnarled-tree` | gnarled-tree.glb | 6 | gnarled orchard tree | to generate |
| `dead-tree` | dead-tree.glb | 5.5 | bare dead tree | to generate |
| `dead-forest-tree` | dead-forest-tree.glb | 8 | dead forest tree | to generate |
| `flower-tree` | flower-tree.glb | 10 | glowing flower tree | to generate |
| `floating-island` | floating-island.glb | 6 | small floating rock island | to generate |
| `giant-mushroom` | giant-mushroom.glb | 8 | giant mushroom | to generate |
| `mushroom` | mushroom.glb | 0.45 | small glowing mushroom | to generate |
| `sunflower` | sunflower.glb | 1.5 | blue sunflower | to generate |
| `flower` | flower.glb | 0.35 | meadow flower | to generate |
| `giant-flower` | giant-flower.glb | 3 | giant cosmos flower | to generate |
| `rose-bush` | rose-bush.glb | 0.9 | rose bush | to generate |
| `boulder` | boulder.glb | 1.2 | boulder | to generate |
| `ice-crystal` | ice-crystal.glb | 2.4 | ice crystal cluster | to generate |
| `pod-tree` | pod-tree.glb | 22 | tree with hanging glowing pods | to generate |
| `coral` | coral.glb | 1.6 | coral bush | to generate |
| `reed` | reed.glb | 2.4 | reed clump | to generate |
| `lily-pad` | lily-pad.glb | 0.9 | lily pad | to generate |
| `lotus` | lotus.glb | 0.5 | lotus flower | to generate |
| `fallen-leaf` | fallen-leaf.glb | 0.28 | fallen leaf | to generate |
| `fallen-fruit` | fallen-fruit.glb | 0.35 | fallen fruit | to generate |
| `cobblestone` | cobblestone.glb | 0.14 | cobblestone | to generate |
| `cypress` | cypress.glb | 9 | cypress | to generate |
| `grave` | grave.glb | 1.2 | gravestone | to generate |

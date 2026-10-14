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

140 registered, 37 present, 103 files to generate (103 ids).

| id | file | height (m) | what | status |
|---|---|---|---|---|
| `knight` | knight.glb | 1.95 |  | present |
| `archer` | archer.glb | 1.8 |  | present |
| `wizard` | wizard.glb | 1.85 |  | present |
| `staff` | staff.glb | 1.75 |  | present |
| `greatsword` | greatsword.glb | 1.45 |  | present |
| `yeti` | yeti.glb | 5.2 |  | present |
| `shade` | horned-shade.glb | 7 |  | present |
| `warden` | antlered-warden.glb | 15 |  | present |
| `wyrm` | moon-wyrm.glb | 3 |  | present |
| `troll` | rock-troll.glb | 4.6 |  | present |
| `lurker` | lake-lurker.glb | 4.2 |  | present |
| `marshdemon` | marsh-demon.glb | 12 |  | present |
| `hollowking` | hollow-king.glb | 42 |  | present |
| `rivershade` | river-shade.glb | 5 | hooded river shade with glowing eyes (DeUydbMvKqC, DeWZT3jvPCG) | present |
| `passbeast` | fog-beast.glb | 3.8 | red-eyed black beast of the mountain pass (DeXeZ7rhGVi) | present |
| `beast` | fog-beast.glb | 2.2 | red-eyed black beast (DeXeZ7rhGVi) | present |
| `croc` | crocodile.glb | 1.0 | crocodile in the flooded ruins (DeJj8CDhL2f) | present |
| `frogking` | frog-king.glb | 6 |  | present |
| `loggiant` | log-giant.glb | 7.5 |  | present |
| `spiderchapel` | spider-chapel.glb | 34 |  | present |
| `colossus` | moon-shell-colossus.glb | 18 |  | present |
| `king` | antlered-king.glb | 1.95 |  | to generate |
| `witch` | witch.glb | 1.85 |  | to generate |
| `head` | giant-head.glb | 52 | giant stone head with red eyes | present |
| `cathedral` | cathedral.glb | 118 |  | present |
| `castle` | castle.glb | 44 |  | present |
| `church` | demon-church.glb | 24 | horned demon church (DeDRVZwxJyO) | present |
| `tower` | wizard-tower.glb | 100 |  | present |
| `treehouse` | tree-house.glb | 22 | giant tree-house with a round door (DdKl7fKMO75) | present |
| `causeway-segment` | causeway-segment.glb | 1.89 | arched cobbled bridge span (three per causeway segment) | present |
| `causeway-stairs` | causeway-stairs.glb | 6 | causeway stairs at the south end | present |
| `chasm-bridge` | chasm-bridge.glb | 1.8 | rope-bridge deck tile, repeated across the chasm (DeWji_1PuKW, DdnJDwBMUoj) | present |
| `witch-bridge` | witch-bridge.glb | 3 | stone bridge over the witch stream | to generate |
| `nave` | ruined-nave.glb | 26 | ruined nave with columns, arches and a rose window | to generate |
| `archgate` | arch-gate.glb | 14 | frozen arch gate | to generate |
| `palmisland` | palm-island.glb | 28 | floating palm island on an inverted rock | to generate |
| `colossus-statue` | kneeling-colossus.glb | 15.5 | kneeling horned colossus statue | to generate |
| `burning-castle` | burning-castle.glb | 68 | burning castle on the far shore | to generate |
| `village-house` | village-house.glb | 5.8 | thatched village house | present |
| `tavern` | tavern.glb | 7.6 | tavern with its sign, table and stools | to generate |
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
| `troll-gorge` | troll-gorge.glb | 15 | rock walls of the troll gorge | to generate |
| `floating-rock` | floating-rock.glb | 3 | floating boulder | to generate |
| `pinnacle` | pinnacle.glb | 30 | sea pinnacle rising from the cloud sea | to generate |
| `mountain` | mountain.glb | 180 | backdrop mountain | to generate |
| `boat` | boat.glb | 1.9 | rowing boat with two rowers | to generate |
| `horse-rider` | horse-rider.glb | 2.6 | knight on horseback with a lantern | to generate |
| `koi` | flying-koi.glb | 1.2 | flying koi | to generate |
| `snake` | snake.glb | 0.6 | coiled snake | to generate |
| `knight-npc` | knight-npc.glb | 1.9 | armoured knight: tavern, rowing, kneeling, watching (DdfKgLsBmoA, DdjlyzyOcnK, DdKl7fKMO75) | present |
| `knight-seated` | knight-seated.glb | 1.95 | caped greatsword knight sitting on the cliff (Sir Halvard) | to generate |
| `knight-rose` | knight-rose.glb | 1.95 | black knight offering a rose (Sir Corvin) | to generate |
| `skeleton` | skeleton.glb | 1.75 | skeletons at the campfire (DdjlyzyOcnK) | present |
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
| `ogre` | log-giant.glb | 3.1 | ogre woodhauler (Grub) — reuses the log giant | present |
| `pine` | pine.glb | 13 | pine tree | present |
| `snow-pine` | snow-pine.glb | 13 | snow-laden pine | to generate |
| `birch` | birch.glb | 11 | birch | to generate |
| `willow` | willow.glb | 9 | willow | to generate |
| `palm` | palm.glb | 8 | palm | to generate |
| `gnarled-tree` | gnarled-tree.glb | 6 | gnarled orchard tree | to generate |
| `dead-forest-tree` | dead-forest-tree.glb | 8 | dead forest tree | to generate |
| `flower-tree` | flower-tree.glb | 10 | glowing flower tree | to generate |
| `floating-island` | floating-island.glb | 6 | small floating rock island | to generate |
| `giant-mushroom` | giant-mushroom.glb | 8 | giant mushroom | present |
| `mushroom` | mushroom.glb | 0.45 | small glowing mushroom | to generate |
| `sunflower` | sunflower.glb | 1.5 | blue sunflower | to generate |
| `flower` | flower.glb | 0.35 | meadow flower | present |
| `giant-flower` | giant-flower.glb | 3 | giant cosmos flower | to generate |
| `rose-bush` | rose-bush.glb | 0.9 | rose bush | to generate |
| `boulder` | boulder.glb | 1.2 | boulder | to generate |
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
| `checker-road` | checker-road.glb | 4 | checkered stone causeway section with a wooden railing (DeOemU1BOZF) | to generate |
| `round-tower` | round-tower.glb | 22 | round medieval tower with lit windows and a conical roof (DeOemU1BOZF) | to generate |
| `stone-throne` | stone-throne.glb | 3.2 | grey stone throne of the skeleton king (DeOemU1BOZF) | to generate |
| `coin-block` | coin-block.glb | 1.2 | cracked stone block heaped with gold coins (DeOemU1BOZF) | to generate |
| `purple-crystal` | purple-crystal.glb | 1.0 | purple crystal (DeOemU1BOZF, DeaqHWJBBPw) | to generate |
| `gothic-pavilion` | gothic-pavilion.glb | 9 | gothic pavilion with a ribbed dome and round arched windows (DeXn5rSPxR8) | to generate |
| `purple-house` | purple-house.glb | 9 | half-timbered house with a purple roof (DeaqHWJBBPw) | to generate |
| `purple-mushroom` | purple-mushroom.glb | 2.2 | glowing purple mushroom (DeaqHWJBBPw) | to generate |
| `galaxy-hall` | galaxy-hall.glb | 26 | pillared hall with a river down its centre and crystal stalactites (Dd0wR9Jh2lH) | to generate |
| `marble-throne` | marble-throne.glb | 4 | cracked white marble throne (Dd0wR9Jh2lH) | to generate |
| `ring-portal` | ring-portal.glb | 7 | stone ring portal (DdyN2PNyIxb, DdnJDwBMUoj) | to generate |
| `brazier` | brazier.glb | 1.4 | stone fire brazier (DdyN2PNyIxb) | to generate |
| `market-stall` | market-stall.glb | 3.5 | thatched goblin market stall with lanterns (DdnJDwBMUoj) | to generate |
| `crystal-ball` | crystal-ball.glb | 0.5 | purple crystal ball on a stand (DdnJDwBMUoj) | to generate |
| `dragon-riders` | dragon-riders.glb | 6 | black dragon with gold horns carrying the skeleton lord and the blue knight (DeYtKbMh76x) | to generate |
| `skeleton-lord` | skeleton-lord.glb | 1.9 | skeleton lord in a black fur cloak and gold chains (DeXn5rSPxR8) | to generate |
| `blue-knight` | blue-knight.glb | 1.95 | blue plate knight with a goblet (DeXn5rSPxR8) | to generate |
| `skeleton-king` | skeleton-king.glb | 2.0 | crowned skeleton king with gold chains and a galaxy cloak (DeOemU1BOZF) | to generate |
| `skeleton-wizard` | skeleton-wizard.glb | 1.9 | skeleton wizard with a gold crystal staff (DeaqHWJBBPw) | to generate |
| `galaxy-wizard` | galaxy-wizard.glb | 1.9 | galaxy-robed wizard pouring a glowing potion (DeQ-NnpvqF6) | to generate |
| `galaxy-king` | galaxy-king.glb | 2.6 | crowned galaxy king with glowing eyes (Dd0wR9Jh2lH) | to generate |
| `void-monk` | void-monk.glb | 1.85 | hooded monk whose face is a galaxy (DdyN2PNyIxb) | to generate |
| `bucket` | bucket-mimic.glb | 1.3 | tooth-grinning bucket mimic on skeletal legs (DeaqHWJBBPw) | to generate |
| `sunken-tavern` | sunken-tavern.glb | 12 | underwater tavern with jellyfish windows and bottle shelves (DeVj-Z8POjl) | to generate |
| `coral-throne` | coral-throne.glb | 3 | coral throne (DeVj-Z8POjl) | to generate |
| `jellyfish` | jellyfish.glb | 1.4 | glowing jellyfish (DeVj-Z8POjl) | to generate |
| `barrel` | barrel.glb | 1.1 | wooden barrel (DeVj-Z8POjl) | to generate |
| `giant-crown` | giant-crown.glb | 3 | giant golden crown hanging over the hearth (DeVj-Z8POjl) | to generate |
| `fish-king` | fish-king.glb | 2.1 | crowned fish king with a lantern and a chalice (DeVj-Z8POjl) | to generate |
| `face-tree` | face-tree.glb | 12 | tree with a carved stone face and a round door (DeQ-NnpvqF6) | to generate |
| `stepping-stone` | stepping-stone.glb | 0.4 | flat round stepping stone (DeQ-NnpvqF6) | to generate |
| `hanging-lantern` | hanging-lantern.glb | 1.2 | hanging lantern (DeQ-NnpvqF6) | to generate |
| `mushroom-lamp` | mushroom-lamp.glb | 1.2 | hanging glowing mushroom lamp (DaIqFavJWbd) | to generate |
| `tavern-table` | tavern-table.glb | 1.0 | long wooden tavern table with a pewter mug (DaIqFavJWbd) | to generate |
| `world-tree` | world-tree.glb | 28 | giant tree veined with glowing blue light (Ddn0A49tnW7) | to generate |
| `rune-grave` | rune-grave.glb | 1.6 | runic gravestone (Ddn0A49tnW7) | to generate |
| `robed-priest` | robed-priest.glb | 1.9 | robed figure raising its arms to the world tree (Ddn0A49tnW7) | to generate |
| `spire-city` | spire-city.glb | 90 | city of spires and aqueduct bridges beyond the cliffs (DdwXCyeSsXn) | to generate |
| `crystalgolem` | crystal-golem.glb | 3.2 | golem of blue crystal shards (Dd0wR9Jh2lH) | to generate |
| `emberrider` | ember-rider.glb | 3.0 | red-eyed rider on a black horse with a burning mane (Ddn0A49tnW7) | to generate |

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

201 registered, 168 present, 33 files to generate (33 ids).

| id | file | height (m) | what | status |
|---|---|---|---|---|
| `knight` | knight.glb | 1.95 |  | present |
| `archer` | archer.glb | 1.8 |  | present |
| `wizard` | wizard.glb | 1.85 |  | present |
| `staff` | staff.glb | 1.75 |  | present |
| `bow` | archer-bow.glb | 1.5 |  | present |
| `greatsword` | greatsword.glb | 1.45 |  | present |
| `yeti` | yeti.glb | 3.2 |  | present |
| `shade` | horned-shade.glb | 10 |  | present |
| `warden` | antlered-warden.glb | 6.5 |  | present |
| `wyrm` | moon-wyrm.glb | 3 |  | present |
| `troll` | rock-troll.glb | 3.2 |  | present |
| `lurker` | lake-lurker.glb | 2.8 |  | present |
| `marshdemon` | marsh-demon.glb | 5 |  | present |
| `hollowking` | hollow-king.glb | 10 |  | present |
| `rivershade` | river-shade.glb | 3 | hooded river shade with glowing eyes (DeUydbMvKqC, DeWZT3jvPCG) | present |
| `passbeast` | fog-beast.glb | 2.4 | red-eyed black beast of the mountain pass (DeXeZ7rhGVi) | present |
| `beast` | fog-beast.glb | 1.5 | red-eyed black beast (DeXeZ7rhGVi) | present |
| `croc` | crocodile.glb | 0.7 | crocodile in the flooded ruins (DeJj8CDhL2f) | present |
| `frogking` | frog-king.glb | 2.4 |  | present |
| `dmt-entity` | frog-king.glb | 7 | the Frog God of the dream (frog-king.glb, trippy shader) | present |
| `loggiant` | log-giant.glb | 4.2 |  | present |
| `spiderchapel` | spider-chapel.glb | 28 |  | present |
| `colossus` | moon-shell-colossus.glb | 9 |  | present |
| `king` | antlered-king.glb | 1.95 | the Antlered King (DedGUYetKjP) | present |
| `witch` | witch.glb | 1.85 | coven witch in a pointed hat (DeWji_1PuKW) | present |
| `head` | giant-head.glb | 26 | giant stone head with red eyes | present |
| `cathedral` | cathedral.glb | 55 |  | present |
| `castle` | castle.glb | 28 |  | present |
| `church` | demon-church.glb | 15 | horned demon church (DeDRVZwxJyO) | present |
| `tower` | wizard-tower.glb | 32 |  | present |
| `treehouse` | tree-house.glb | 15 | giant tree-house with a round door (DdKl7fKMO75) | present |
| `causeway-segment` | causeway-segment.glb | 1.89 | arched cobbled bridge span (three per causeway segment) | present |
| `causeway-stairs` | causeway-stairs.glb | 6 | causeway stairs at the south end | present |
| `chasm-bridge` | chasm-bridge.glb | 1.8 | rope-bridge deck tile, repeated across the chasm (DeWji_1PuKW, DdnJDwBMUoj) | present |
| `witch-bridge` | witch-bridge.glb | 22 | humpback stone footbridge over the witch stream (DeWji_1PuKW) | present |
| `nave` | ruined-nave.glb | 18 | ruined nave with columns, arches and a rose window | to generate |
| `archgate` | arch-gate.glb | 10 | frozen arch gate | to generate |
| `palmisland` | palm-island.glb | 28 | floating palm island on an inverted rock | to generate |
| `colossus-statue` | kneeling-colossus.glb | 12 | kneeling horned colossus statue | to generate |
| `burning-castle` | burning-castle.glb | 40 | burning castle on the far shore | to generate |
| `village-house` | village-house.glb | 5.8 | thatched village house | present |
| `tavern` | tavern.glb | 7 | tavern with its sign, table and stools | present |
| `torch-post` | torch-post.glb | 2.4 | torch on a post | present |
| `campfire` | campfire.glb | 0.75 | stone campfire ring with a kettle tripod (DdjlyzyOcnK) | present |
| `cloister` | cloister.glb | 6.5 | three pointed gothic arches on slender columns (DdKl7fKMO75) | present |
| `observatory` | observatory.glb | 7 | mushroom observatory hut with balcony and telescope | present |
| `throne` | throne.glb | 3 | antler-and-bone throne on a dais with candelabras (DedGUYetKjP) | present |
| `cauldron` | cauldron.glb | 1.1 | iron cauldron over coals | present |
| `lantern-post` | lantern-post.glb | 2.5 | red paper lantern on a pole | present |
| `candle` | candle.glb | 0.3 | candle | present |
| `ruin-arch` | ruin-arch.glb | 6.6 | ruined stone arch | to generate |
| `ruin-column` | ruin-column.glb | 4.5 | broken stone column | to generate |
| `flooded-ruin` | flooded-ruin.glb | 9 | flooded ruin: ring of columns, wall and arch | to generate |
| `troll-gorge` | troll-gorge.glb | 15 | rock walls of the troll gorge | to generate |
| `floating-rock` | floating-rock.glb | 3 | floating boulder | to generate |
| `pinnacle` | pinnacle.glb | 30 | sea pinnacle rising from the cloud sea | to generate |
| `mountain` | mountain.glb | 180 | backdrop mountain | to generate |
| `boat` | boat.glb | 1.9 | rowing boat with a bow lantern (DdjlyzyOcnK, DdwXCyeSsXn) | present |
| `horse-rider` | horse-rider.glb | 2.6 | knight on horseback with a lantern (DdmvaMvMvS4) | present |
| `koi` | flying-koi.glb | 0.6 | flying koi | present |
| `snake` | snake.glb | 0.35 | coiled snake | present |
| `knight-npc` | knight-npc.glb | 1.9 | armoured knight: tavern, rowing, kneeling, watching (DdfKgLsBmoA, DdjlyzyOcnK, DdKl7fKMO75) | present |
| `knight-seated` | knight-seated.glb | 1.95 | caped greatsword knight sitting on the cliff (Sir Halvard) | present |
| `knight-rose` | knight-rose.glb | 1.95 | black knight offering a rose (Sir Corvin) | present |
| `skeleton` | skeleton.glb | 1.75 | skeletons at the campfire (DdjlyzyOcnK) | present |
| `skeleton-banner` | skeleton-banner.glb | 1.85 | skeleton standard-bearer with banner and trident (Hollow Jack) | present |
| `witch-cook` | witch-cook.glb | 1.8 | skeleton cook in a chef hat with a spoon (Mother Marrow) | present |
| `bride` | bride.glb | 1.8 | the Pale Bride | present |
| `maiden` | maiden.glb | 1.68 | Elowen of the flower garden | present |
| `wanderer` | wanderer.glb | 1.85 | hooded wanderer with a lantern (the Lanternbearer) | present |
| `wizard-npc` | wizard-npc.glb | 1.8 | wizard NPC (Mirren, Sel) | present |
| `gnome` | gnome.glb | 1.15 | gnome astronomer with a telescope (Pim) | present |
| `frog-monk` | frog-monk.glb | 1.75 | frog monk reading a book (Brother Croak) | present |
| `troll-fisher` | troll-fisher.glb | 2.4 | troll fisher with a rod (Old Moss) | present |
| `goblin` | goblin.glb | 1.15 | tavern goblin (Snik, Vrak) | present |
| `ogre` | log-giant.glb | 2.8 | ogre woodhauler (Grub) — reuses the log giant | present |
| `pine` | pine.glb | 12 | pine tree | present |
| `snow-pine` | snow-pine.glb | 11 | snow-laden pine | to generate |
| `birch` | birch.glb | 10 | birch | to generate |
| `willow` | willow.glb | 8 | willow | to generate |
| `palm` | palm.glb | 8 | palm | to generate |
| `gnarled-tree` | gnarled-tree.glb | 6 | gnarled orchard tree | to generate |
| `dead-forest-tree` | dead-forest-tree.glb | 10 | dead gnarled leafless tree, black bark (world-look-28) | present |
| `flower-tree` | flower-tree.glb | 7 | glowing flower tree | to generate |
| `floating-island` | floating-island.glb | 22 | floating rock island with dead trees and chimney stumps (#28, 01.22.56) | present |
| `giant-mushroom` | giant-mushroom.glb | 5 | giant mushroom | present |
| `mushroom` | mushroom.glb | 0.45 | small glowing mushroom | to generate |
| `sunflower` | sunflower.glb | 1.5 | blue sunflower | to generate |
| `flower` | flower.glb | 0.35 | meadow flower | present |
| `giant-flower` | giant-flower.glb | 2.4 | giant cosmos flower | to generate |
| `rose-bush` | rose-bush.glb | 0.9 | rose bush | to generate |
| `boulder` | boulder.glb | 1.2 | boulder | to generate |
| `pod-tree` | pod-tree.glb | 12 | tree with hanging glowing pods | to generate |
| `coral` | coral.glb | 1.6 | coral bush | to generate |
| `reed` | reed.glb | 1.8 | reed clump | to generate |
| `lily-pad` | lily-pad.glb | 0.9 | lily pad | to generate |
| `lotus` | lotus.glb | 0.5 | lotus flower | to generate |
| `fallen-leaf` | fallen-leaf.glb | 0.28 | fallen leaf | to generate |
| `fallen-fruit` | fallen-fruit.glb | 0.35 | fallen fruit | to generate |
| `cobblestone` | cobblestone.glb | 0.14 | cobblestone | to generate |
| `cypress` | cypress.glb | 9 | cypress | to generate |
| `grave` | grave.glb | 1.1 | arched gothic headstone (shot-011654) | present |
| `cup-gnome` | cup-gnome.glb | 1.25 | gnome with a gold grill, gold chain and a purple cup (frames/cup-gnome.png) | present |
| `rift-king` | rift-king.glb | 1.85 | Yung Lean in a white puffer coat with an ice crown (frames/rift-king.png) | present |
| `styro-ghoul` | styro-ghoul.glb | 1.25 | purple imp in baggy streetwear with a double-cup backpack | present |
| `lean-chucker` | styro-ghoul.glb | 1.9 | the Lean-Chucker, boss of the Styro-Ghouls | present |
| `lean-cup` | lean-cup.glb | 0.17 | double white styrofoam cup of glowing purple lean (frames/lean-cup.png) | present |
| `lean-cup-island` | lean-cup.glb | 22 | giant double cup of lean, an island of the kingdom | present |
| `gnome-brother` | gnome-brother.glb | 1.2 |  | present |
| `croak-bag` | croak-bag.glb | 1.1 | burlap sack with Brother Croak inside | present |
| `treehouse-door` | treehouse-door.glb | 2.3 | round plank door of the tree house | present |
| `treehouse-interior` | treehouse-interior.glb | 7 | round room inside the tree house trunk | present |
| `stone-lotus` | stone-lotus.glb | 1.6 | stone-carved lotus drifting on the green-tea streams | present |
| `checker-road` | checker-road.glb | 6 | checkered stone causeway tile (DeOemU1BOZF) | present |
| `round-tower` | round-tower.glb | 18 | round medieval tower with lit windows and a conical roof (DeOemU1BOZF) | present |
| `stone-throne` | stone-throne.glb | 2.6 | grey stone throne of the skeleton king (DeOemU1BOZF) | present |
| `coin-block` | coin-block.glb | 1.2 | cracked stone block heaped with gold coins (DeOemU1BOZF) | present |
| `purple-crystal` | purple-crystal.glb | 1.0 | purple crystal (DeOemU1BOZF, DeaqHWJBBPw) | present |
| `gothic-pavilion` | gothic-pavilion.glb | 7 | gothic pavilion with a ribbed dome and round arched windows (DeXn5rSPxR8) | present |
| `purple-house` | purple-house.glb | 8 | half-timbered house with a purple roof (DeaqHWJBBPw) | present |
| `purple-mushroom` | purple-mushroom.glb | 2.2 | glowing purple mushroom (DeaqHWJBBPw) | present |
| `galaxy-hall` | galaxy-hall.glb | 15 | pillared hall with a river down its centre and crystal stalactites (Dd0wR9Jh2lH) | present |
| `marble-throne` | marble-throne.glb | 2.8 | cracked white marble throne (Dd0wR9Jh2lH) | present |
| `ring-portal` | ring-portal.glb | 5.5 | stone ring portal (DdyN2PNyIxb, DdnJDwBMUoj) | present |
| `brazier` | brazier.glb | 1.4 | stone fire brazier (DdyN2PNyIxb) | present |
| `market-stall` | market-stall.glb | 3.2 | thatched goblin market stall with lanterns (DdnJDwBMUoj) | present |
| `crystal-ball` | crystal-ball.glb | 0.5 | purple crystal ball on a stand (DdnJDwBMUoj) | present |
| `dragon-riders` | dragon-riders.glb | 5 | black dragon with gold horns carrying the skeleton lord and the blue knight (DeYtKbMh76x) | present |
| `skeleton-lord` | skeleton-lord.glb | 1.9 | skeleton lord in a black fur cloak and gold chains (DeXn5rSPxR8) | present |
| `blue-knight` | blue-knight.glb | 1.95 | blue plate knight with a goblet (DeXn5rSPxR8) | present |
| `skeleton-king` | skeleton-king.glb | 2.0 | crowned skeleton king with gold chains and a galaxy cloak (DeOemU1BOZF) | present |
| `skeleton-wizard` | skeleton-wizard.glb | 1.9 | skeleton wizard with a gold crystal staff (DeaqHWJBBPw) | present |
| `galaxy-wizard` | galaxy-wizard.glb | 1.9 | galaxy-robed wizard pouring a glowing potion (DeQ-NnpvqF6) | present |
| `galaxy-king` | galaxy-king.glb | 2.2 | crowned galaxy king with glowing eyes (Dd0wR9Jh2lH) | present |
| `void-monk` | void-monk.glb | 1.85 | hooded monk whose face is a galaxy (DdyN2PNyIxb) | present |
| `bucket` | bucket-mimic.glb | 1.0 | tooth-grinning bucket mimic on skeletal legs (DeaqHWJBBPw) | present |
| `sunken-tavern` | sunken-tavern.glb | 9 | underwater tavern with jellyfish windows and bottle shelves (DeVj-Z8POjl) | present |
| `coral-throne` | coral-throne.glb | 2.4 | coral throne (DeVj-Z8POjl) | present |
| `jellyfish` | jellyfish.glb | 0.9 | glowing jellyfish (DeVj-Z8POjl) | present |
| `barrel` | barrel.glb | 1.1 | wooden barrel (DeVj-Z8POjl) | present |
| `giant-crown` | giant-crown.glb | 2.2 | giant golden crown hanging over the hearth (DeVj-Z8POjl) | present |
| `fish-king` | fish-king.glb | 2.1 | crowned fish king with a lantern and a chalice (DeVj-Z8POjl) | present |
| `face-tree` | face-tree.glb | 10 | tree with a carved stone face and a round door (DeQ-NnpvqF6) | present |
| `stepping-stone` | stepping-stone.glb | 1.0 | flat round stepping stone (DeQ-NnpvqF6) | present |
| `hanging-lantern` | hanging-lantern.glb | 1.2 | hanging lantern (DeQ-NnpvqF6) | present |
| `mushroom-lamp` | mushroom-lamp.glb | 1.2 | hanging glowing mushroom lamp (DaIqFavJWbd) | present |
| `tavern-table` | tavern-table.glb | 1.0 | long wooden tavern table (DaIqFavJWbd, DeVj-Z8POjl) | present |
| `world-tree` | world-tree.glb | 22 | giant tree veined with glowing blue light (Ddn0A49tnW7) | present |
| `rune-grave` | rune-grave.glb | 1.6 | pointed gothic headstone (Ddn0A49tnW7, shot-011654) | present |
| `grave-cross` | grave-cross.glb | 1.8 | celtic cross gravestone (shot-011654) | present |
| `robed-priest` | robed-priest.glb | 1.9 | robed figure raising its arms to the world tree (Ddn0A49tnW7) | present |
| `spire-city` | spire-city.glb | 90 | city of spires and aqueduct bridges beyond the cliffs (DdwXCyeSsXn) | to generate |
| `crystalgolem` | crystal-golem.glb | 2.6 | golem of blue crystal shards (Dd0wR9Jh2lH) | present |
| `emberrider` | ember-rider.glb | 2.7 | red-eyed rider on a black horse with a burning mane (Ddn0A49tnW7) | present |
| `cyclops` | cyclops.glb | 9 | huge blue one-eyed horned cyclops with claws (shot-011654, world-look-28) | present |
| `cyclops-lord` | cyclops.glb | 7 | the cyclops at the end of the alley of graves (shot-011654) | present |
| `blood-eye` | blood-eye.glb | 6 | giant floating red spiky eyeball with a blue iris (shot-013226) | present |
| `trip-wizard` | galaxy-wizard.glb | 1.9 | rainbow-robed wizard flying in the dream (shot-013245) | present |
| `moon-laugh` | moon-laugh.glb | 10 | blue moon with a laughing face (shot-013117, shot-013029) | present |
| `moon-grin` | moon-grin.glb | 10 | blue moon with glowing eyes and a sharp-toothed grin (shot-013056) | present |
| `stone-wall` | stone-wall.glb | 1.2 | low mossy dry-stone graveyard wall segment, 2.6 m long (shot-011654) | present |
| `whale` | whale.glb | 3.6 | humpback whale flying over the white flowers (DeSEl9PvPG_) | present |
| `giant-skull` | giant-skull.glb | 7 | giant ancient skull with a snake coiled round it (DefYcvutTow) | present |
| `galaxy-knight` | galaxy-knight.glb | 2.2 | knight in galaxy-patterned plate with a spiked helm and a galaxy-swirl greatsword (DeOemU1BOZF) | present |
| `mail-knight` | mail-knight.glb | 1.95 | knight in faceted blue chain mail and a gold chain with a crystal spear (DeaqHWJBBPw) | present |
| `skeleton-red` | skeleton-red.glb | 1.85 | green-eyed skeleton with gold grills in a red fur coat sipping a double cup (DeldocTvFiB) | present |
| `skeleton-witch` | skeleton-witch.glb | 2.1 | skeleton in a tall black witch hat and gold chain sipping a double cup (DeldocTvFiB) | present |
| `gold-knight` | gold-knight.glb | 2.0 | dark blue knight with gold trim and a skull medallion raising a glowing cup (DeldocTvFiB) | present |
| `plague-doctor` | plague-doctor.glb | 2.4 | plague doctor with glowing eyes, black hat and gold chain lounging on a riveted treasure chest with lanterns, sipping a lidded cup (DeldocTvFiB) | present |
| `lean-dragon` | lean-dragon.glb | 4.2 | black dragon with gold horns and a diamond grill lying down (Den1ausBXai, Def4LDkxikA, DeYtKbMh76x) | present |
| `sky-bar` | sky-bar.glb | 5.5 | floating wooden bar booth hung on chains, a skull sign and a purple menu board (Den1ausBXai) | present |
| `gothic-lamp` | gothic-lamp.glb | 3.2 | tall black iron gothic lamp post with a glowing lantern (Den1ausBXai, Def4LDkxikA) | present |
| `dragon-throne` | dragon-throne.glb | 6.5 | black and gold gothic throne flanked by two black dragon statues in gold chains (Def4LDkxikA) | present |
| `dragon-fountain` | dragon-fountain.glb | 4.5 | black dragon-head statue over a stone basin, a fountain (Def4LDkxikA) | present |
| `lean-fountain` | lean-fountain.glb | 3.0 | tiered carved stone fountain (Def4LDkxikA) | present |
| `carriage` | carriage.glb | 3.2 | ornate black carriage with gold trim and gold wheels (DeXn5rSPxR8) | present |
| `gem` | gem.glb | 0.5 | faceted cut gemstone (DeXn5rSPxR8, DeaqHWJBBPw) | present |
| `stalactite` | stalactite.glb | 3.0 | hanging blue crystal stalactite cluster (DeOemU1BOZF) | present |
| `skull-pile` | skull-pile.glb | 1.6 | heap of old skulls (DeldocTvFiB) | present |
| `crypt-bar` | crypt-bar.glb | 8 | vaulted stone crypt bar, open at the front: an L-shaped bar with skull panels and stools, candle sconces (DeldocTvFiB) | present |
| `snow-chapel` | snow-chapel.glb | 10 | ruined gothic stone chapel with snow on its roof and ledges (DeldocTvFiB) | present |
| `snow-pillar` | snow-pillar.glb | 2.6 | square stone gate pillar capped with snow (DeldocTvFiB) | present |
| `broken-gate` | broken-gate.glb | 1.9 | broken leaning wooden gate (DeldocTvFiB) | present |
| `potion-bottle` | potion-bottle.glb | 0.4 | round glass potion bottle full of a swirling galaxy (DeOemU1BOZF) | present |
| `candle-head` | candle-head.glb | 1.95 | man in a black suit whose head is a cluster of melting white candles, raising a candle-lit tankard (Dd5Bqt7vQ5T) | present |
| `dwarf` | dwarf.glb | 1.4 | dwarf in blue armour with a long braided beard raising a wooden tankard (Dd5Bqt7vQ5T) | present |
| `green-dragon` | green-dragon.glb | 7 | huge green dragon lying down behind the village, head raised (Dd5Bqt7vQ5T) | present |
| `spell-book` | spell-book.glb | 0.35 | open glowing spell book (Dd5Bqt7vQ5T) | present |
| `crowned-head` | crowned-head.glb | 14 | giant crowned stone head of a king lying on a grassy hill (Dd5Bqt7vQ5T) | present |
| `floating-castle` | floating-castle.glb | 40 | gothic castle on a floating rock pouring waterfalls (Dd5Bqt7vQ5T) | present |
| `chained-platform` | chained-platform.glb | 6 | floating rock platform hung on iron chains with a lantern (Dd5Bqt7vQ5T) | present |
| `chandelier` | chandelier.glb | 1.6 | iron ring chandelier of melting candles (Dd5Bqt7vQ5T, DeOemU1BOZF) | present |
| `diver` | diver.glb | 1.9 | figure in a brass diving helmet with a glowing porthole and a long dark robe (DeVj-Z8POjl) | present |
| `drowned-house` | drowned-house.glb | 7 | narrow half-timbered house with a slate roof and warm lit windows, under the sea (DeVj-Z8POjl) | present |
| `blue-fish` | blue-fish.glb | 1.4 | big blue grouper swimming between the houses (DeVj-Z8POjl) | present |
| `jelly-lantern` | jelly-lantern.glb | 4.2 | iron post with a hanging cage lantern holding a glowing jellyfish (DeVj-Z8POjl) | present |
| `bottle-shelf` | bottle-shelf.glb | 2.6 | wooden shelves of glowing orange bottles (DeVj-Z8POjl) | present |
| `orb-lamp` | orb-lamp.glb | 2.2 | iron lamp stand with glowing red glass orbs (DeVj-Z8POjl) | present |
| `coin-table` | coin-table.glb | 0.9 | round wooden table heaped with gold coins (DeVj-Z8POjl) | present |
| `chalice` | chalice.glb | 0.5 | barnacle-crusted stone chalice (DeVj-Z8POjl) | present |
| `kelp` | kelp.glb | 4 | tall swaying kelp (DeVj-Z8POjl) | present |

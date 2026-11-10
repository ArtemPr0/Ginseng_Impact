# Island re-layout, Meshy round 9, play-fix pass — design record

Date: 2026-11-10 · Status: approved in plan mode (plan: `~/.claude/plans/ultrathink-pasted-content-id-568a-var-fo-shiny-rabin.md`)

## Intent

The user's playtest found the witches' bridge lying in the great river and a house standing in water, with other
buildings sunk into the terrain. The 2026-10-14 world rescale (0.6) moved placements closer together while building,
bridge and river-channel sizes stayed real-size, and nothing in the test suite measured island placements against the
terrain. The map must "make sense": nothing in water, nothing hanging, nothing buried, nothing over the void; then the
remaining Meshy credits go to reel subjects that fill the map, and a real play pass fixes what it finds.

## Decisions (with the user)

- **Fix in place + fill gaps**: every district, landmark and quest spot stays; wrong objects move or are re-levelled.
- **Meshy credits to all three kinds** (mobs, buildings/landmarks, flora/props), reel subjects only; the plan's list
  is the spend list; balance 746 at the start of the round, ≤ 706 to spend.
- Two design-visible calls, flagged for veto: the cathedral at 0.65 (was 0.7) and the chasm rope bridge as a pitched
  chain span.

## What changed (Phase A)

| Thing | Before | After |
|---|---|---|
| River west reach | (-40,4)→(-58,12)→(-74,20), under the witches' bridge | (-40,15)→(-54,21), a round sink pool whose carve and 8 m ribbon cap stop short of the stream ravine (an end at (-62,25) flattened the ravine under the stream), low mist over it |
| Witches' bridge | east half in the riverbed | crosses the witch stream alone, both feet on ground ≥ 2.9 |
| Witch stream | ribbon on the centre line, up to 4 m above the trough; ran to z 48 into the church footing | ribbon on the lowest bed across the ravine; ends at z 40 |
| Face tree | 39 % of its cells over river water | dry, on a footing r 7.5 |
| Cathedral | south feet in the river, north wall on the chasm lip, one r 14 footing damming the river | z -17, 0.65, two r 11 footings, river floor restored |
| Arch gate | on the chasm's north cliff face (70,-72) | on the Frost March flat (56,-84), footing r 4.5 |
| Village back row | three houses on footing shelves past the cliff (island radius 119–138) | a coastal bulge (-50,90, r 55, 30 m) and two level pads at 2.8; per-house footings removed (they dug pits) |
| Tree house | rock over the west cliff | (-86,30), footing r 10; its door offset follows LAYOUT |
| Rope bridge | south end 4 m over the chasm, flat deck | (26,-32.5)→(27,-85), chain span bank to bank |
| Ruin column | inside the lily pond | (-30,-30) |
| Hamlet house (7,-6), colossus statue, nave, ruins | hanging or buried edges | footings |
| Old Moss, the log giant's road, two beasts, a crocodile | in the channel / on the cliff | moved with the river |
| Cloister | west arches hanging 0.55 (the tavern's footing blend won there) | 1.5 m east, footing before the tavern's, blend 5.5 |

## Guards added

- `src/world/IslandTruth.test.ts`: every island building (LANDMARKS, LAYOUT, VILLAGE, the face tree), NPC spot and
  mob spawn is sampled over its baked collider cells against `terrainHeight` and `waterLevelAt`: no wet cell, no
  cell over the void or on a footing shelf past the cliff, no edge hanging > 0.35, nothing buried past
  max(1, 0.3 h); roaming hostiles ≥ 30 m from the spawn and ≥ 12 m from any NPC spot.
- `waterLevelAt` (Terrain.ts): the river and eye, koi tiers, lily pond, mud pool and the witch stream (lowest bed
  + 0.75) in one answer, for tests and the in-page audit.
- `LANDMARKS` (data/world.ts): the free-standing island buildings as data, read by World.ts and the test; the
  tree clearings read the layout tables instead of literal copies.
- The relief guard's southern-meadow region excludes the village terrace (a settlement's level ground is not open
  meadow); threshold unchanged.

## Phase B

Island hostiles raised with district-native kinds (risen dead in the dead wood, fog beasts at the gorge head,
crocodiles along the river and in the mud pool), two more ghouls and a mail knight in the Kingdom, two beasts in the
Vale's bare south meadow. No snow-yeti variant: a texture tint cannot whiten the yeti and a copy would read as the boss.

## Phase C (Meshy round 9)

Made (balance 746 → 77): snow pine, birch, willow, palm, cypress, orchard tree, rose bush, sunflower, lotus pad,
blue mushroom cluster; the archway shade, the brazier hermit and the vale knight (rigged, six clips each, armatures
flattened from cm); the candle gate (beside the nave: on the road it sat in the climb to the head), the ruined church
tower behind the sea castle, the needle-spire castle beyond the gorge. Skipped: the chest wagon (its crop holds the
plague doctor, who already exists with his chest) and the treasure chest (budget). The Agent remeshed the three
characters before rigging at 30 each, which the plan's 39 per model did not foresee.

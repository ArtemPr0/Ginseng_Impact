# Play checks (run.mjs bodies that drive the hero)

Load the built game at a spot with `?at=x,z` (there the game runs without pointer lock and keys dispatched on `window`
count), then run a body: it prints one JSON line, and run.mjs adds `CONSOLE: [...]`, what the page logged meanwhile.

```bash
node scripts/perf/run.mjs "http://127.0.0.1:4173/?at=0,40" 8 scripts/perf/play/walk.js   # hold W for 20 s, sample every 0.5 s
node scripts/perf/run.mjs "http://127.0.0.1:4173/?at=-92,8" 8 scripts/perf/play/talk.js  # F on the nearest NPC (the king), answer 1, Escape
node scripts/perf/run.mjs - 0 scripts/perf/play/talk.js                                   # again, on the page as it is
```

`walk.js` holds W for 20 s of wall time (the camera's forward) and samples the hero every 0.5 s:
`{ samples: [{ t, x, y, z, ground, water?, mode }], maxAbove, maxBelow, distance, displacement }` — `ground` is the
surface under him (`heights.heightAt` with his own y as the hint, so a bridge or a floor counts), `water` the water level
there when any, `mode` the controller's (ground, air, climb, fly, swim). `maxAbove` / `maxBelow` are the largest
`y - ground` / `ground - y` over the run, `distance` the path length walked, `displacement` start to end.
Reading it: `maxBelow` over ~0.3 → he sank; `maxAbove` over ~0.5 with mode `ground` → he floats (a swim over deep water
is by design: see `water`); `mode` flipping to `air` sample after sample → he bounces; `distance` ≈ 0 → he never moved;
`displacement` ≈ 0 with a distance → stuck against something.

`talk.js` finds the nearest NPC, steps next to him when out of reach, presses F, waits 300 ms and reads `#hud-dialog`;
when the conversation offers answers it presses 1, reads again, then leaves with Escape:
`{ npc, dist, prompt, text1, choice, text2, panel1, panel2, after, note? }` — `prompt` is what F offered ("Talk to …"),
`text1` / `text2` the panel's text before and after the answer (`text2` null when the answer closed it), `panel*` the
HUD panel state (talk, shop, none), `after` the state once Escape was pressed (none when all is well), `note` why F was
not pressed (it would take loot or use a door instead).

Both never throw: a missing hook comes back as `error`, with whatever was gathered.
Headless renders at 5–15 fps and the loop caps a frame at 0.1 s, so game time runs slower than the 20 s of wall time.

`fight.js` is a frame-time A/B for the combat effects, the same on any build: five campfire skeletons stand stunned and
unkillable in front of the hero, then Crimson Cleave, the Lean Cyclone (walked forward and back so it lays its trail),
Moon Volley, Trip Volley and Starfall go off in turn (~22 s), with the resolution governor pinned at a pixel ratio of 1.
It prints `{ ratio, all, phases }`, each with `fps`, `medianMs`, `p95Ms` (wall time), `cpu` (milliseconds a frame in
`combat.update`, `combat.render` and `renderer.render`: the game's own work), `calls` (draw calls a frame, max/mean),
`planes` (the fight's own transparent meshes and sprites showing in the scene: ground zones and strips, puddles,
shots, smoke, CombatFx's pools; max/mean), `transparent` (every transparent thing on screen within 120 m, the world's included) and
`fx` (CombatFx's live pools). Serve the builds on ports nobody else uses (check with `lsof -iTCP:<port>`: a busy port
makes `vite preview --strictPort` fail and the run measures someone else's build) and alternate the runs (A, B, A, B,
...) in one session. Wall-time fps swings with whatever else the machine draws (other headless pages, builds): compare
`cpu`, `calls` and `planes`, which hold still, and read fps only across many alternations.

```bash
node scripts/perf/run.mjs "http://127.0.0.1:4173/?at=0,59" 40 scripts/perf/play/fight.js
```

## Full verification

With preview on `4173` and headless Chrome on CDP `9333` (see `.claude/skills/verify`):

```bash
node scripts/perf/play/verify-all.mjs
```

Runs: every NPC dialogue hub (`sweep-dialogue.js`), main + side quests (`sweep-quests.js`), every enemy kill (`sweep-enemies.js`), every interactable label/act (`sweep-interact.js`), Hollow King aggro, layout/glows/characters audits, and the ending shortcut (`playthrough.mjs`). Exit 0 only when every hard check passes. Audits still print by-design flags (bridges over void, lean bubbles, realm footings) without failing the run.

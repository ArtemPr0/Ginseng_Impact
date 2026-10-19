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

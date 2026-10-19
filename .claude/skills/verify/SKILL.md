---
name: verify
description: Use when verifying a Ginseng Impact change in the running game (movement, mobs, animations, layout, colliders, rendering) — how to build, serve, drive and capture it headlessly
---

# Verifying Ginseng Impact in the running game

**Surface:** the built game in a browser. A hidden/occluded Chrome tab pauses requestAnimationFrame, so drive a
headless Chrome over CDP instead of the user's tab.

```bash
npm run build                                   # also bakes colliders (npm run colliders)
npx vite preview --host 127.0.0.1 --port 4173 --strictPort &     # often already running
CH="$HOME/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
"$CH" --headless=new --no-first-run --user-data-dir=/tmp/gi-headless --use-angle=metal --enable-gpu \
  --ignore-gpu-blocklist --disable-gpu-vsync --disable-frame-rate-limit --autoplay-policy=no-user-gesture-required \
  --window-size=1280,720 --remote-debugging-port=9333 about:blank &   # audio runs only with the autoplay flag
```

`?at=x,z` spawns there and keeps the game running without pointer lock; `window.__ginseng` exposes scene, camera,
controller, combat (enemies), area (World), world (HeightWorld), tpc (camera rig), party, renderer.
`?placeholders` shows markers for models not generated yet.

| Need | Tool (scripts/perf) |
|---|---|
| Run JS on the loaded page (async body, `return` a value) | `node run.mjs "<url>|-" <loadSeconds> file.js` |
| Screenshot | `node shot.mjs <url> out.png <wait> [js]` |
| fps / CPU profile | `fps.mjs`, `prof.mjs` |
| A mob in action: frames + state/clip/speed log | `node anim/capture.mjs "<url>|-" <kind> <prefix> [frames] [ms] [dist]` → `python3 anim/sheet.py <prefix> out.png` |
| Every clip of a mob, frozen at fractions, lit | `FRACS=0.1,0.4,0.7 node anim/stage.mjs <kind> <prefix>` (STAGE_AT=x,z to move it onto dry land) → `COLS=6 python3 anim/stagesheet.py <prefix> out.png` |
| Skin tearing on every mob / NPC body (% of surface stretched past 4x, worst moment per clip) | `node run.mjs "<url>" 6 anim/stretch-all.js`, `anim/stretch-npcs.js`: under ~5% is sound, 10-40% is a torn web or fan |
| Things floating, buried, overlapping, inside buildings | `node run.mjs "http://127.0.0.1:4173/?at=0,40" 8 audit/layout.js` |
| Glows and flames with nothing under them (torch flames on no torch, lamps off the wall) | `audit/glows.js` (same call) |
| Mobs and NPCs off or under the ground | `audit/characters.js` (same call) |

Gotchas
- The audits list by-design items too (bridges and pinnacles over the void, lily pads on water, seated NPCs over their
  seat's collider, the sky's eyes and clouds, swimming fish): read the list, look at each new entry, fix the rest.
- A torn mob: `cut-triangles` for webs between limbs (list them in the page: triangles stretched past 3x joining the
  two legs, or past 6x joining any two limbs, kept under ~2% of the surface), then `smooth-skin <in> <out> 8` for
  weights that jump vertex to vertex (the rest of the fan). Never on the heroes without checking their cup grip.
- Headless renders at ~5–15 fps and the loop caps a frame at 0.1 s: game time runs slower than wall time.
- Drive input with `window.dispatchEvent(new KeyboardEvent('keydown', { code }))` (Space, Digit1-3, KeyW…).
- Scripts that change enemy params (`o.brain.p.aggroRange = 0`) persist on that page: reload between runs.
  Never write to `o.def` — ENEMY_DEFS objects are shared by every enemy of a kind.
- Fog and night make captures dark: `G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2`; hide trees with
  `o.isInstancedMesh && o !== G.area.grass.mesh` → `visible = false`.
- To pin the camera, replace `G.tpc.update` (the render loop calls it every frame).
- If the Mac's display sleeps, headless Chrome stops producing frames (rAF count 0, `Page.captureScreenshot` hangs for
  minutes). Launch with `--disable-gpu-vsync --disable-frame-rate-limit`, keep ONE page open (extra tabs starve it),
  and grab the canvas instead of screenshotting: in a rAF queued behind the game's,
  `G.renderer.gl.domElement.toDataURL()` (anim/stage.mjs and anim/capture.mjs do this; no DOM HUD in the image).
- A mob whose skin tears into sheets or streaks when a limb moves: `node run.mjs "<url near it>" 22 anim/stretch.js`
  (after `window.__stretchKind = '<kind>'`) lists triangles stretched far past their bind size; cut the web with
  `node scripts/model-tools.mjs cut-triangles in.glb out.glb list.json`, and damp arm swings that drag fused fur
  (`armDamp` in data/models.ts).
- Bone tweaks on top of a clip (`turnBone`) must be undone before the next mixer update: three's PropertyMixer only
  rewrites a bone whose track value changed, so on a frozen (`paused`) or constant track the tweak piles up each
  frame (Rig.turn records and restores them).

## Reel side-by-side (does the game look like the reel?)

For each reel in `docs/reference/reel-notes.md`: pick the matching spot in the game (its district, see the design
skill's map), pin the camera at a similar framing (`G.tpc.update = () => { cam.position.set(...); cam.lookAt(...) }`,
`await sleep(5000)` so fog/look blends finish), `snap()` it, and tile it next to the user's screenshot of that
reel moment (`docs/reference/frames/r6-*.png`) with PIL. Tick off each subject in the notes; list anything missing
(model file not made, wrong colour, too bright). Lit studio close-ups (add a `HemisphereLight(0xffffff, 0x8888aa,
3.4)` and `scene.fog = null` in the script only) judge shapes and hands; normal captures judge the mood.

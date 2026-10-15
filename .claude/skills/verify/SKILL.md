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
  --ignore-gpu-blocklist --window-size=1280,720 --remote-debugging-port=9333 about:blank &
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

Gotchas
- Headless renders at ~5–15 fps and the loop caps a frame at 0.1 s: game time runs slower than wall time.
- Drive input with `window.dispatchEvent(new KeyboardEvent('keydown', { code }))` (Space, Digit1-3, KeyW…).
- Scripts that change enemy params (`o.brain.p.aggroRange = 0`) persist on that page: reload between runs.
  Never write to `o.def` — ENEMY_DEFS objects are shared by every enemy of a kind.
- Fog and night make captures dark: `G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2`; hide trees with
  `o.isInstancedMesh && o !== G.area.grass.mesh` → `visible = false`.
- To pin the camera, replace `G.tpc.update` (the render loop calls it every frame).

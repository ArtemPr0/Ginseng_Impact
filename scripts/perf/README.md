# Performance tools (headless Chromium over the DevTools protocol)

Measure the built game without a visible browser window (a hidden or occluded tab pauses `requestAnimationFrame`):

```bash
npm run build && npx vite preview --host 127.0.0.1 --port 4173 &
"$HOME/Library/Caches/ms-playwright/chromium-1228/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing" \
  --headless=new --no-first-run --user-data-dir=/tmp/gi-headless --use-angle=metal --enable-gpu --ignore-gpu-blocklist \
  --window-size=1280,720 --remote-debugging-port=9333 about:blank &
node scripts/perf/fps.mjs "http://127.0.0.1:4173/?at=0,59" 35 8   # load 35 s, sample 8 s → fps, median/p95 frame ms
node scripts/perf/prof.mjs 6                                     # GPU string + CPU profile by self time
node scripts/perf/alloc.mjs 6                                    # allocation rate (incl. collected) by call site
node scripts/perf/shot.mjs "<url>" out.png 30                     # screenshot after 30 s
node scripts/perf/eval.mjs "<js>"                                 # evaluate on the loaded page (window.__dbg in ?at= mode)
```

Findings from the 2026-10-14 pass (M4 Max, Retina): repeated flora must be simplified hard (`scripts/lod-pass.mjs`);
every mesh is frustum-culled and flora is chunked; point lights go through `src/render/LightBudget.ts`; MSAA on a
half-float target halved the frame rate (FXAA instead); bloom at quarter resolution; shadows redraw every second frame;
transparent double-sided materials need `forceSinglePass` (else three.js re-resolves their program twice a frame).

Audits (run.mjs bodies; each prints a list to read, see `.claude/skills/verify`): `audit/layout.js` (floating, buried,
overlapping, inside buildings), `audit/glows.js` (flames and glows with nothing solid near), `audit/characters.js`
(mobs and NPCs off the ground), `anim/stretch-all.js` and `anim/stretch-npcs.js` (skin tearing per clip).

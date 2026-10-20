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

## Hero animation

The heroes' moves are windows of their Meshy clips (`src/characters/heroClips.ts`), measured, never guessed:

```bash
node scripts/clip-strike.mjs public/models/knight.glb            # per clip: the blow (the hand's peak speed), wind-up, settle, other swings; jump arcs
node scripts/clip-strike.mjs public/models/archer.glb lefthand   # another bone (a regex; the right side is preferred)
node scripts/clip-strike.mjs public/models/knight.glb --curve Sword_Judgment   # that clip every 1/30 s: hand speed and height, hips height
```

Another tool can `import { loadGlb, measure } from './clip-strike.mjs'` (a GLB loaded in node without a DOM; the bone,
hips and `sample(clip)` of a loaded file): the command line runs only when the file is the entry point.

To watch a move in the built game (same build/serve/headless-Chrome steps as above; the page must be in `?at=` mode):

```bash
node scripts/perf/anim/hero.mjs "http://127.0.0.1:4173/?at=0,59" light out/knight-light        # 24 PNG frames over 1.6 s + out/knight-light.json (the rig's state per frame)
node scripts/perf/anim/hero.mjs - heavy out/archer-heavy archer                                 # '-' reuses the loaded page; the 4th argument picks the hero
node scripts/perf/anim/hero.mjs - hurt out/knight-hurt knight 30 2                              # frames and seconds
```

Moves: `light` (three LMB presses 0.3 s apart), `heavy` (RMB held 1.2 s), `skill` (E), `burst` (Q), `dodge` (R), `jump`
(Space), `run`, `sprint`, `hurt` (a flinch), `bighurt` (≥ 15 % of max HP: the whole reaction), `death`. The state log
shows the clip playing, its time and rate (`held` while a charge or an apex is frozen), the attack kind and progress,
hurt/dodge/dead and the hit-stop left; the damage frame should fall where the clip's blow is (`clip-strike.mjs`).
`sheet.py` tiles the frames into a contact sheet.

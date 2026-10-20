// run.mjs body: a scripted fight, the same on any build, for frame-time A/Bs of the combat effects. Five campfire
// skeletons stand stunned and unkillable in front of the hero (three in a line down the camera's look, two either side
// of it), then each hero's moves go off in turn: Sir Aldric's Crimson Cleave (E) and his Lean Cyclone (Q, walked
// forward and back so it lays a trail), Wren's Moon Volley (E) and Trip Volley (Q), Orlan's Starfall (E).
// The renderer's resolution governor is pinned at a pixel ratio of 1 for the run (it would trade pixels for time and
// hide the difference). Load the page at the spawn: node run.mjs "http://127.0.0.1:4173/?at=0,59" 40 play/fight.js
// Prints { ratio, all, phases: { cleave, cyclone, volley, trip, starfall } }, each phase:
//   fps, medianMs, p95Ms over its frames (wall time: it drifts with whatever else the machine draws);
//   cpu: mean milliseconds a frame in combat.update, combat.render and renderer.render (the game's own work, steadier);
//   calls (draw calls a frame, max and mean); planes (the fight's own transparent meshes and sprites showing in the
//   scene: ground zones and strips, puddles, shots, smoke, CombatFx's pools; max and mean, sampled every 6th frame);
//   transparent (every transparent thing on screen within 120 m, the world's included: max and mean); fx (CombatFx's
//   live pools at the busiest sample, when the build has them).
const G = window.__ginseng;
if (!G?.combat || !G.renderer) return { error: 'no window.__ginseng: load the page with ?at=x,z' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const key = (code, type) => window.dispatchEvent(new KeyboardEvent(type, { code }));
const tap = async (code) => { key(code, 'keydown'); await sleep(80); key(code, 'keyup'); };
const hold = async (code, ms) => { key(code, 'keydown'); await sleep(ms); key(code, 'keyup'); };
const until = async (fn, ms) => { const t0 = performance.now(); while (!fn() && performance.now() - t0 < ms) await sleep(50); };

const R = G.renderer;
R.govern = () => {};
R.ratio = 1;
R.gl.setPixelRatio(1);
R.composer.setPixelRatio(1);
R.resize(R.width, R.height);

// The pack: down the camera's look 2.5, 5 and 7.5 m out (the crescent's line), and two flankers 4 m out, 2 m aside.
const c = G.controller;
const f = G.tpc.forward();
const at = (ahead, aside) => ({ x: c.pos.x + f.x * ahead - f.z * aside, z: c.pos.z + f.z * ahead + f.x * aside });
const pack = [];
for (const [ahead, aside] of [[2.5, 0], [5, 0.3], [7.5, -0.3], [4, 2], [4, -2]]) {
  const p = at(ahead, aside);
  const e = G.combat.spawnBoss('skeleton', p.x, p.z, Math.atan2(c.pos.z - p.z, c.pos.x - p.x));
  e.hp = 1e7;
  e.afflict('stun', 600);
  pack.push(e);
}
await sleep(1500);

// Per frame: its time, the draw calls (every pass of the frame: info is reset here, once a frame), and every 6th frame
// the transparent things on screen.
const info = R.gl.info;
info.autoReset = false;
info.reset();
const cam = G.camera;
const v = cam.position.clone();
const onScreen = (o) => {
  // Where it is drawn: its geometry's bounding sphere when it has one (effects built in world space sit at the origin).
  const bs = !o.isInstancedMesh && o.geometry?.boundingSphere;
  if (bs) v.copy(bs.center).applyMatrix4(o.matrixWorld);
  else o.getWorldPosition(v);
  if (v.distanceTo(cam.position) > 120) return false;
  v.project(cam);
  return v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.1;
};
const transparentNow = () => {
  let n = 0;
  G.scene.traverseVisible((o) => {
    if (!(o.isMesh || o.isSprite || o.isLine || o.isPoints)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m?.transparent && onScreen(o)) n++;
  });
  return n;
};
const fxLive = () => (G.fx?.live ? { ...G.fx.live } : null);
// The fight's own transparent planes: what the combat system and CombatFx put in the scene.
const planesNow = () => {
  let n = 0;
  const count = (root) => root?.traverseVisible((o) => {
    if (!(o.isMesh || o.isSprite || o.isLine || o.isPoints)) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material;
    if (m?.transparent) n++;
  });
  const cs = G.combat;
  count(cs.vfx?.group);
  for (const p of cs.puddles ?? []) count(p.mesh);
  for (const p of cs.projectiles ?? []) count(p.object);
  for (const cl of cs.clouds ?? []) for (const p of cl.puffs) count(p.s);
  count(G.fx?.group);
  return n;
};
// The game's own work a frame: the fixed steps' combat.update, combat.render and the renderer.
const cpu = { update: 0, render: 0, draw: 0 };
const timed = (obj, name, slot) => {
  const f = obj[name].bind(obj);
  obj[name] = (...a) => { const t = performance.now(); const r = f(...a); cpu[slot] += performance.now() - t; return r; };
};
timed(G.combat, 'update', 'update');
timed(G.combat, 'render', 'render');
timed(R, 'render', 'draw');
const frames = [];
let phase = 'start';
let running = true;
let last = performance.now();
let k = 0;
const loop = (t) => {
  const calls = info.render.calls;
  info.reset();
  const s = { phase, ms: t - last, calls, cpu: { ...cpu } };
  cpu.update = cpu.render = cpu.draw = 0;
  last = t;
  if (k++ % 6 === 0) { s.transparent = transparentNow(); s.planes = planesNow(); s.fx = fxLive(); }
  frames.push(s);
  if (running) requestAnimationFrame(loop);
};
requestAnimationFrame(loop);

phase = 'cleave';
await tap('KeyE');
await sleep(2200);

phase = 'cyclone';
G.combat.burstEnergy = 100;
await tap('KeyQ');
await sleep(900);
await hold('KeyW', 1800);
await hold('KeyS', 1800);
await until(() => !G.combat.burstState, 5000);
await sleep(400);

phase = 'volley';
await tap('Digit2');
await sleep(500);
await tap('KeyE');
await sleep(2600);

phase = 'trip';
G.combat.burstEnergy = 100;
await tap('KeyQ');
await until(() => !G.combat.burstState, 4000);
await sleep(1600);

phase = 'starfall';
await tap('Digit3');
await sleep(500);
await tap('KeyE');
await sleep(2600);
running = false;
await sleep(100);
info.autoReset = true;
for (const e of pack) G.combat.despawn(e);

const stats = (list) => {
  const ms = list.map((s) => s.ms).sort((a, b) => a - b);
  const total = ms.reduce((a, b) => a + b, 0);
  const sampled = list.filter((s) => s.transparent !== undefined);
  const busiestPlanes = sampled.reduce((b, s) => (!b || s.planes > b.planes ? s : b), null);
  const busiest = sampled.reduce((b, s) => (!b || s.transparent > b.transparent ? s : b), null);
  const mean = (xs) => +(xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length)).toFixed(1);
  return {
    frames: list.length,
    fps: +(list.length / (total / 1000)).toFixed(1),
    medianMs: +ms[Math.floor(ms.length / 2)].toFixed(1),
    p95Ms: +ms[Math.floor(ms.length * 0.95)].toFixed(1),
    cpu: { update: +(list.reduce((a, s) => a + s.cpu.update, 0) / list.length).toFixed(2), render: +(list.reduce((a, s) => a + s.cpu.render, 0) / list.length).toFixed(2), draw: +(list.reduce((a, s) => a + s.cpu.draw, 0) / list.length).toFixed(2) },
    calls: { max: Math.max(...list.map((s) => s.calls)), mean: mean(list.map((s) => s.calls)) },
    planes: { max: busiestPlanes?.planes ?? null, mean: mean(sampled.map((s) => s.planes)) },
    transparent: { max: busiest?.transparent ?? null, mean: mean(sampled.map((s) => s.transparent)) },
    fx: busiestPlanes?.fx ?? null,
  };
};
const fought = frames.slice(1).filter((s) => s.phase !== 'start');
const phases = {};
for (const p of ['cleave', 'cyclone', 'volley', 'trip', 'starfall']) phases[p] = stats(fought.filter((s) => s.phase === p));
return { ratio: R.ratio, all: stats(fought), phases };

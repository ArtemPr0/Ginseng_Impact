// node hero.mjs <url|-> <move> <out-prefix> [hero=knight] [frames=24] [seconds=1.6]
// Pins a side camera 4 m from the hero, performs one move through the game's own input, and records PNG frames plus
// the rig's state per frame (mode, speed, attack kind and progress, the clip and its time/rate, hurt/dodge/dead,
// hit-stop, HP) to <prefix>-NN.png and <prefix>.json. Needs the headless Chrome of scripts/perf/README.md with the
// game loaded in `?at=` mode (its Input then behaves as if the pointer were locked). '-' as the url reuses the page.
// Moves: light (three LMB presses 0.3 s apart), heavy (RMB held 1.2 s), skill (E), burst (Q), dodge (R), jump (Space),
// run (W held), sprint (Shift+W held), hurt (a small hit), bighurt (≥ 15 % of max HP), death (the hero falls).
import { writeFileSync } from 'node:fs';
const [url, move = 'light', prefix = 'hero', hero = 'knight', frames = '24', seconds = '1.6'] = process.argv.slice(2);
if (!url) { console.log('usage: node scripts/perf/anim/hero.mjs <url|-> <move> <out-prefix> [hero] [frames] [seconds]'); process.exit(1); }
const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? ('ERR ' + JSON.stringify(r.result?.exceptionDetails ?? r).slice(0, 400)); };
await send('Emulation.setDeviceMetricsOverride', { width: 960, height: 540, deviceScaleFactor: 1, mobile: false });
if (url !== '-') { await send('Page.navigate', { url }); await new Promise((r) => setTimeout(r, 30000)); }

const setup = await ev(`(async () => {
  const G = window.__ginseng; document.getElementById('hud').style.display = 'none';
  G.renderer.gl.toneMappingExposure = 2.2;
  G.scene.traverse((o) => { if (o.isInstancedMesh && o !== G.area.grass.mesh) o.visible = false; });
  // Nobody else acts.
  for (const e of G.combat.enemies) { e.brain.state = 'idle'; e.brain.p.aggroRange = 0; }
  // The hero asked for (1/2/3 switch the party, through the game's own keys).
  const want = ['knight', 'archer', 'wizard'].indexOf('${hero}');
  if (want >= 0 && G.party.activeIndex !== want) {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit' + (want + 1) }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit' + (want + 1) }));
    await new Promise((r) => setTimeout(r, 400));
  }
  const rig = G.rigs[G.party.activeIndex];
  if (!rig.model) return 'no model for ' + G.party.active.id;
  G.combat.hp.set(G.party.active.id, G.party.active.maxHp);
  const c = G.controller; c.vel = { x: 0, y: 0, z: 0 }; c.mode = 'ground';
  // A side camera 4 m off the hero's right, at chest height.
  const cam = G.camera;
  G.tpc.update = () => { const p = c.pos; const sx = -Math.sin(c.yaw), sz = Math.cos(c.yaw); cam.position.set(p.x + sx * 4, p.y + 1.3, p.z + sz * 4); cam.lookAt(p.x, p.y + 1.0, p.z); };
  // Input through the game's listeners: keys on the window, mouse buttons on the canvas (released on the window).
  const canvas = G.renderer.gl.domElement;
  const key = (code, ms = 80) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code })), ms); };
  const button = (b, ms = 80) => { canvas.dispatchEvent(new MouseEvent('mousedown', { button: b, bubbles: true })); setTimeout(() => window.dispatchEvent(new MouseEvent('mouseup', { button: b })), ms); };
  const hit = (atk) => { G.combat.iframes = 0; G.combat.damagePlayer(atk, null); };
  const moves = {
    light: () => { button(0); setTimeout(() => button(0), 300); setTimeout(() => button(0), 600); },
    heavy: () => button(2, 1200),
    skill: () => key('KeyE'),
    burst: () => { G.combat.burstEnergy = 100; key('KeyQ'); },
    dodge: () => key('KeyR'),
    jump: () => key('Space', 250),
    run: () => key('KeyW', 1500),
    sprint: () => { key('ShiftLeft', 1500); key('KeyW', 1500); },
    hurt: () => hit(60),
    bighurt: () => hit(G.party.active.maxHp),
    death: () => { G.combat.hp.set(G.party.active.id, 1); hit(G.party.active.maxHp); },
  };
  const go = moves['${move}'];
  if (!go) return 'no move ${move}; moves: ' + Object.keys(moves).join(', ');
  window.__hero = { rig, go };
  return 'ok ' + G.party.active.id + ' ' + (rig.model.playing || '');
})()`);
console.log('setup', setup);
if (String(setup).startsWith('ERR') || !String(setup).startsWith('ok')) { ws.close(); process.exit(1); }

// Two settled frames first, then the move, then the rest of the frames over `seconds`.
const n = Number(frames);
const interval = (Number(seconds) * 1000) / n;
const log = [];
const state = () => ev(`(() => {
  const G = window.__ginseng; const C = G.combat; const c = G.controller; const m = window.__hero.rig.model; const a = m && m.action;
  const f = (x, d = 2) => (typeof x === 'number' ? x.toFixed(d) : '-');
  return [c.mode, 'v=' + f(Math.hypot(c.vel.x, c.vel.z), 1), 'kind=' + (C.attackKind === undefined ? '-' : C.attackKind), 'p=' + f(C.attackProgress),
    'clip=' + (m ? m.playing : '-'), a ? 't=' + f(a.time) + '/' + f(a.getClip().duration) + ' x' + f(a.timeScale) + (a.paused ? ' held' : '') : '',
    'hurt=' + (C.hurtState ? (C.hurtState.big ? 'big' : 'small') + '@' + f(C.hurtState.t) : '-'), 'dodge=' + (C.dodgeState ? f(C.dodgeState.t) : '-'),
    'dead=' + C.dead, 'stop=' + f(G.game.hitStop), 'hp=' + Math.round(C.hp.get(G.party.active.id))].join(' ');
})()`);
for (let i = 0; i < n; i++) {
  if (i === 2) await ev(`(() => { window.__hero.go(); return 1; })()`);
  log.push(await state());
  // The canvas right after a render (no compositor wait: works with the display asleep).
  const data = await ev(`new Promise((res) => setTimeout(() => requestAnimationFrame(() => res(window.__ginseng.renderer.gl.domElement.toDataURL('image/png'))), 0))`);
  writeFileSync(`${prefix}-${String(i).padStart(2, '0')}.png`, Buffer.from(String(data).split(',')[1], 'base64'));
  await new Promise((r) => setTimeout(r, interval));
}
writeFileSync(`${prefix}.json`, JSON.stringify(log, null, 1));
console.log(log.map((l, i) => `${String(i).padStart(2, '0')} ${l}`).join('\n'));
ws.close();

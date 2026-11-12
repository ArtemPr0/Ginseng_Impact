// node lineup.mjs <outPrefix> [id,id,...]: every character model (MODELS entries with clips) loaded fresh into a lit
// studio high over the island, each clip frozen at a few moments and shot from three-quarters front. One JPEG per frame
// (<prefix>-<id>-NN.jpg) and <prefix>-<id>.json with the labels; tile with lineupsheet.py. Run on a page loaded with
// ?at=0,40 (scripts/perf/run.mjs style: the page must already be open on CDP 9333).
import { writeFileSync } from 'node:fs';
const CDP = 'http://127.0.0.1:' + (process.env.CDP_PORT ?? '9333');
const [out, idsArg] = process.argv.slice(2);
const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.result?.exceptionDetails) return 'ERR ' + (r.result.exceptionDetails.exception?.description ?? JSON.stringify(r.result.exceptionDetails)).slice(0, 400); return r.result?.result?.value ?? 'ERR ' + JSON.stringify(r).slice(0, 400); };
await send('Emulation.setDeviceMetricsOverride', { width: 480, height: 480, deviceScaleFactor: 1, mobile: false });
const setup = await ev(`(async () => {
  const G = window.__ginseng; const hud = document.getElementById('hud'); if (hud) hud.style.display = 'none';
  G.scene.fog = null; G.renderer.gl.toneMappingExposure = 1.6;
  G.scene.traverse((o) => { if (o.isInstancedMesh) o.visible = false; });
  for (const e of G.combat.enemies) e.object.visible = false;
  for (const r of G.rigs ?? []) r.root.visible = false;
  const THREE = { Group: G.scene.constructor };
  const L = G.scene.children.find((o) => o.isDirectionalLight).constructor;
  if (!window.__studio) {
    const key = new L(0xffffff, 2.6); const rim = new L(0x9fb4ff, 1.4);
    window.__studio = { key, rim, at: { x: 0, y: 420, z: 300 } };
    G.scene.add(key, key.target, rim, rim.target);
  }
  const S = window.__studio; const p = S.at;
  if (!window.__lineupPinned) { const r = G.renderer; const orig = r.render.bind(r); r.render = (sc, c) => { window.__lineupPin?.(); orig(sc, c); }; window.__lineupPinned = true; }
  G.game.paused = false;
  const ids = ${JSON.stringify(idsArg ? idsArg.split(',') : null)} ?? Object.keys(G.models.MODELS).filter((k) => G.models.MODELS[k].clips);
  return JSON.stringify(ids);
})()`);
if (typeof setup !== "string" || setup.startsWith("ERR")) { console.log("setup", JSON.stringify(setup).slice(0, 600)); process.exit(1); }
const ids = JSON.parse(setup);
console.log('models', ids.length);
const KEYS = (process.env.KEYS ?? 'idle,walk,run,attack,heavy,hit,death,talk,sit,drink,cast,roar,throw,fly,swim').split(',');
for (const mid of ids) {
  const info = await ev(`(async () => {
    const G = window.__ginseng; const S = window.__studio; const p = S.at;
    if (window.__lineup) { window.__lineup.root.parent?.remove(window.__lineup.root); window.__lineup = null; }
    const g = await G.models.load('${mid}'); if (!g) return 'none';
    const m = new G.models.ModelRig('${mid}', g); G.scene.add(m.root); m.root.position.set(p.x, p.y, p.z); m.root.updateMatrixWorld(true);
    window.__lineup = m; m.root.frustumCulled = false; m.root.traverse((o) => { o.frustumCulled = false; });
    const H = m.height; const d = H * 1.0 + 0.4; const cam = G.camera;
    window.__lineupPin = () => { cam.position.set(p.x + d * 0.62, p.y + H * 0.62, p.z + d * 0.8); cam.lookAt(p.x, p.y + H * 0.5, p.z); cam.updateMatrixWorld(); S.key.position.set(p.x + 4, p.y + H + 6, p.z + 7); S.key.target.position.set(p.x, p.y, p.z); S.rim.position.set(p.x - 6, p.y + H, p.z - 5); S.rim.target.position.set(p.x, p.y + H * 0.5, p.z); };
    const names = ${JSON.stringify(KEYS)}.map((k) => [k, m.clipName(k)]).filter(([, n]) => n);
    const uniq = []; for (const [k, n] of names) if (!uniq.some(([, u]) => u === n)) uniq.push([k, n]);
    return JSON.stringify({ clips: uniq, H });
  })()`);
  if (info === 'none' || info.startsWith('ERR')) { console.log(mid, info); continue; }
  const { clips, H } = JSON.parse(info);
  const shots = [];
  const frames = [['bind', null, 0]];
  for (const [k, n] of clips) for (const f of (k === 'walk' || k === 'run' ? [0.2, 0.7] : [0.45])) frames.push([k, n, f]);
  for (const [k, n, f] of frames) {
    await ev(`(() => { const m = window.__lineup; m.mixer.stopAllAction(); ${n ? `const a = m.actions.get('${n}'); a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true; a.time = a.getClip().duration * ${f};` : ''} m.mixer.update(0); m.root.updateMatrixWorld(true); return 1; })()`);
    const url = await ev(`new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(window.__ginseng.renderer.gl.domElement.toDataURL('image/jpeg', 0.75)))))`);
    if (typeof url !== 'string' || !url.startsWith('data:')) { console.log(mid, k, 'no frame', String(url).slice(0, 120)); continue; }
    shots.push({ label: n ? `${k} ${Math.round(f * 100)}%` : 'bind', data: url.split(',')[1] });
  }
  writeFileSync(`${out}-${mid}.json`, JSON.stringify({ id: mid, H, labels: shots.map((s) => s.label) }));
  shots.forEach((s, i) => writeFileSync(`${out}-${mid}-${String(i).padStart(2, '0')}.jpg`, Buffer.from(s.data, 'base64')));
  console.log(mid, 'frames', shots.length);
}
ws.close();

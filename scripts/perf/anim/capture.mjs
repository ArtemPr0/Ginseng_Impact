// node capture.mjs <url> <kind> <out-prefix> [frames=16] [intervalMs=180] [dist=9]
// Puts the player near a mob, pins a side camera, records frames + the mob's state/clip per frame.
import { writeFileSync } from 'node:fs';
const [url, kind, prefix, frames = '16', interval = '180', dist = '9'] = process.argv.slice(2);
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
  G.renderer.gl.toneMappingExposure = 2.0;
  G.scene.traverse((o) => { if (o.isInstancedMesh && o !== G.area.grass.mesh) o.visible = false; });
  const e = G.combat.enemies.find((x) => x.def.kind === '${kind}' && x.model);
  if (!e) return 'no ${kind}';
  window.__cap = e;
  // Reset everyone else so only this mob acts.
  for (const o of G.combat.enemies) if (o !== e) { o.brain.state = 'idle'; o.brain.p.aggroRange = 0; }
  const H = e.model.height;
  const px = e.spawn.x + ${dist} + H * 0.3, pz = e.spawn.z;
  const c = G.controller; c.pos = { x: px, y: G.world.heightAt(px, pz), z: pz }; c.vel = { x: 0, y: 0, z: 0 }; c.mode = 'ground';
  G.combat.hp.set(G.party.active.id, 99999);
  const cam = G.camera;
  const back = Math.max(3.2, H * 2.2 + 1.5);
  G.tpc.update = () => { const p = e.pos; const g = p.y - e.def.hover * 0.5; cam.position.set(p.x + back * 0.45, g + H * 0.6 + 0.6, p.z + back); cam.lookAt(p.x, g + H * 0.45, p.z); };
  G.renderer.gl.toneMappingExposure = 2.6;
  return 'ok H=' + H;
})()`);
console.log('setup', setup);
const log = [];
for (let i = 0; i < Number(frames); i++) {
  const st = await ev(`(() => { const e = window.__cap; const m = e.model; const a = m.current; const r = m.root; const pose = m.hasClips ? '' : ' pose rx=' + r.rotation.x.toFixed(2) + ' rz=' + r.rotation.z.toFixed(2) + ' ry=' + r.rotation.y.toFixed(2) + ' y=' + r.position.y.toFixed(2); return e.state + (e.returning ? '/home' : '') + pose + ' | ' + m.playing + (a ? ' t=' + a.time.toFixed(2) + '/' + a.getClip().duration.toFixed(2) + ' x' + a.timeScale.toFixed(2) : '') + ' | v=' + (window.__lastPos ? Math.hypot(e.pos.x - window.__lastPos.x, e.pos.z - window.__lastPos.z).toFixed(2) : '?') + ' | hp=' + Math.round(window.__ginseng.combat.hp.get(window.__ginseng.party.active.id)); })()`);
  await ev(`(() => { window.__lastPos = { ...window.__cap.pos }; return 1; })()`);
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
  writeFileSync(`${prefix}-${String(i).padStart(2, '0')}.jpg`, Buffer.from(shot.result.data, 'base64'));
  log.push(st);
  await new Promise((r) => setTimeout(r, Number(interval)));
}
writeFileSync(`${prefix}.json`, JSON.stringify(log));
console.log(log.join('\n'));
ws.close();

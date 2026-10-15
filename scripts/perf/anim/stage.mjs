// node stage.mjs <kind> <outPng> [clipKeys comma list]: freezes one mob's AI, lights it, and renders frames of each clip.
import { writeFileSync } from 'node:fs';
const [kind, out, keysArg] = process.argv.slice(2);
const keys = (keysArg ?? 'idle,walk,run,attack,charged_ground_slam,charged_spell_cast,zombie_scream,shouting,hit,death').split(',');
const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.result?.value ?? ('ERR ' + JSON.stringify(r.result?.exceptionDetails ?? r).slice(0, 400)); };
await send('Emulation.setDeviceMetricsOverride', { width: 640, height: 640, deviceScaleFactor: 1, mobile: false });
const info = await ev(`(async () => {
  const G = window.__ginseng; document.getElementById('hud').style.display = 'none';
  G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2;
  G.scene.traverse((o) => { if (o.isInstancedMesh && o !== G.area.grass.mesh) o.visible = false; });
  if (!window.__stageLight) { const L = G.scene.children.find((o) => o.isDirectionalLight).constructor; window.__stageLight = new L(0xdfe6ff, 2.4); G.scene.add(window.__stageLight, window.__stageLight.target); }
  for (const o of G.combat.enemies) { o.object.visible = false; }
  const e = G.combat.enemies.find((x) => x.def.kind === '${kind}' && x.model);
  if (!e) return 'none';
  e.object.visible = true; e.update = () => null; e.animate = () => {};
  window.__st = e;
  const m = e.model; const H = m.height;
  const at = ${JSON.stringify(process.env.STAGE_AT ?? '')}; if (at) { const [ax, az] = at.split(',').map(Number); e.pos.x = ax; e.pos.z = az; e.pos.y = G.world.heightAt(ax, az); }
  const p = e.pos; const g = p.y;
  e.object.position.set(p.x, p.y, p.z); e.object.rotation.y = 0;
  const cam = G.camera; const d = H * 1.45 + 0.7;
  G.tpc.update = () => { cam.position.set(p.x + d * 0.75, g + H * 0.62, p.z + d * 0.75); cam.lookAt(p.x, g + H * 0.48, p.z); window.__stageLight.position.set(p.x + 5, g + H + 6, p.z + 8); window.__stageLight.target.position.set(p.x, g, p.z); };
  const names = ${JSON.stringify(keys)}.map((k) => [k, m.clipName(k)]).filter(([, n]) => n);
  const uniq = []; for (const [k, n] of names) if (!uniq.some(([, u]) => u === n)) uniq.push([k, n]);
  window.__clips = uniq;
  return JSON.stringify(uniq) + ' H=' + H;
})()`);
console.log(kind, info);
if (info === 'none' || info.startsWith('ERR')) process.exit(0);
const clips = JSON.parse(info.split(' H=')[0]);
const fracs = (process.env.FRACS ?? '0.05,0.25,0.45,0.65,0.85').split(',').map(Number);
const shots = [];
for (const [key, name] of clips) {
  for (const f of fracs) {
    await ev(`(() => { const m = window.__st.model; m.mixer.stopAllAction(); const a = m.actions.get('${name}'); a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true; a.time = a.getClip().duration * ${f}; m.update(0); return 1; })()`);
    await new Promise((r) => setTimeout(r, 260));
    // Read the canvas right after the game renders (no compositor wait: works with the display asleep).
    const url = await ev(`new Promise((res) => setTimeout(() => requestAnimationFrame(() => res(window.__ginseng.renderer.gl.domElement.toDataURL('image/jpeg', 0.8))), 0))`);
    shots.push({ label: `${name} ${Math.round(f * 100)}%`, data: url.split(',')[1] });
  }
}
writeFileSync(out + '.json', JSON.stringify(shots.map((s) => s.label)));
shots.forEach((s, i) => writeFileSync(`${out}-${String(i).padStart(2, '0')}.jpg`, Buffer.from(s.data, 'base64')));
console.log('frames', shots.length);
ws.close();

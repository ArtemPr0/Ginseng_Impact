// Headless beat of the ending: load the built game, wake the Hollow King, and assert the credits.
// Needs the preview on 127.0.0.1:4173 and headless Chrome on CDP_PORT (default 9333). See .claude/skills/verify.
const port = process.env.CDP_PORT ?? 9333;
const url = process.env.PLAY_URL ?? 'http://127.0.0.1:4173/?at=0,40';
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
if (!page) { console.error('no chrome page on', port); process.exit(1); }
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, 8000));
const expr = `(() => {
  const G = window.__ginseng;
  if (!G) return { ok: false, why: 'game not ready' };
  const q = G.adventures.quests;
  q.set('silence', 'open');
  q.kill('hollowking');
  return { ok: q.stage('silence') === 'ended' && G.ending.played, stage: q.stage('silence'), played: G.ending.played };
})()`;
const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
const value = res.result?.result?.value;
console.log(JSON.stringify(value));
if (!value?.ok) process.exit(1);
ws.close();

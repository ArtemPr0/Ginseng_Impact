// node prof.mjs <seconds>: GPU string + a CPU profile of the current page, summarised by self time.
const CDP = 'http://127.0.0.1:' + (process.env.CDP_PORT ?? '9333'); // CDP_PORT selects the headless Chrome (default 9333)
const secs = Number(process.argv[2] ?? 5);
const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const gpu = await send('Runtime.evaluate', { expression: `(() => { const c = document.createElement('canvas').getContext('webgl2'); const e = c.getExtension('WEBGL_debug_renderer_info'); return e ? c.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'n/a'; })()`, returnByValue: true });
console.log('GPU:', gpu.result.result.value);
await send('Profiler.enable');
await send('Profiler.setSamplingInterval', { interval: 500 });
await send('Profiler.start');
await new Promise((r) => setTimeout(r, secs * 1000));
const { result } = await send('Profiler.stop');
const p = result.profile;
const self = new Map();
const byId = new Map(p.nodes.map((n) => [n.id, n]));
const counts = new Map();
for (const s of p.samples) counts.set(s, (counts.get(s) ?? 0) + 1);
let total = 0;
for (const [nid, c] of counts) { const n = byId.get(nid); const f = n.callFrame; const key = `${f.functionName || '(anon)'} ${(f.url || '').split('/').pop()}:${f.lineNumber}`; self.set(key, (self.get(key) ?? 0) + c); total += c; }
const top = [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22);
for (const [k, c] of top) console.log(((100 * c) / total).toFixed(1).padStart(5) + '%  ' + k);
ws.close();

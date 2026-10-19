// Allocation profile (including collected objects) over a steady-state window on the loaded page.
const CDP = 'http://127.0.0.1:' + (process.env.CDP_PORT ?? '9333'); // CDP_PORT selects the headless Chrome (default 9333)
const secs = Number(process.argv[2] ?? 6);
const list = await (await fetch(CDP + '/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('HeapProfiler.enable');
await send('HeapProfiler.startSampling', { samplingInterval: 16384, includeObjectsCollectedByMajorGC: true, includeObjectsCollectedByMinorGC: true });
await new Promise((r) => setTimeout(r, secs * 1000));
const { result } = await send('HeapProfiler.stopSampling');
const by = new Map(); let total = 0;
const walk = (n, stack) => {
  const f = n.callFrame;
  const name = `${f.functionName || "(anon)"}:${f.lineNumber}`;
  const s = stack.concat(name);
  if (n.selfSize) { const key = s.slice(-4).join(' < '); by.set(key, (by.get(key) ?? 0) + n.selfSize); total += n.selfSize; }
  for (const c of n.children) walk(c, s);
};
walk(result.profile.head, []);
console.log(`allocated ${(total / 1048576 / secs).toFixed(1)} MB/s`);
for (const [k, v] of [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) console.log(((v / 1048576) / secs).toFixed(2).padStart(6), 'MB/s ', k.slice(0, 230));
ws.close();

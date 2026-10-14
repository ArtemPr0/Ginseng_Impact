// node fps.mjs <url> <loadSeconds> <sampleSeconds>: average frame time measured with requestAnimationFrame in headless Chromium.
const [url, load = '25', sample = '8'] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1512, height: 860, deviceScaleFactor: 2, mobile: false });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, Number(load) * 1000));
const expr = `new Promise((res) => { const t0 = performance.now(); let n = 0; const times = []; let last = t0; const f = (t) => { n++; times.push(t - last); last = t; if (t - t0 < ${Number(sample) * 1000}) requestAnimationFrame(f); else { times.sort((a, b) => a - b); res({ fps: +(n / ((t - t0) / 1000)).toFixed(1), medianMs: +times[Math.floor(times.length / 2)].toFixed(1), p95Ms: +times[Math.floor(times.length * 0.95)].toFixed(1), heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null }); } }; requestAnimationFrame(f); })`;
const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
console.log(url, JSON.stringify(r.result?.result?.value ?? r));
ws.close();

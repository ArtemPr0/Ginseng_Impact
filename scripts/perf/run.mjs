// node run.mjs <url|-> <loadSeconds> <file.js>: navigates (unless url is "-"), waits, evaluates the file's code (async body), prints JSON.
import { readFileSync } from 'node:fs';
const [url, loadS, file] = process.argv.slice(2);
const list = await (await fetch('http://127.0.0.1:9333/json/list')).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false });
if (url !== '-') { await send('Page.navigate', { url }); await new Promise((r) => setTimeout(r, Number(loadS) * 1000)); }
const code = readFileSync(file, 'utf8');
const r = await send('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true });
const v = r.result?.exceptionDetails ? 'EXCEPTION ' + JSON.stringify(r.result.exceptionDetails).slice(0, 1500) : r.result?.result?.value ?? r;
console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1));
ws.close();

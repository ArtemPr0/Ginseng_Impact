// node run.mjs <url|-> <loadSeconds> <file.js>: navigates (unless url is "-"), waits, evaluates the file's code (async body), prints JSON.
// SHOT_DIR: where the body's `__shot(name)` screenshots go. Then one more line, `CONSOLE: [...]`: what the page logged meanwhile (uncaught exceptions, console.error / console.warn,
// browser-level errors such as a failed load) as {level, text, url?, line?} — `CONSOLE: []` when clean. CDP_PORT overrides 9333.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
const [url, loadS, file] = process.argv.slice(2);
const port = process.env.CDP_PORT ?? 9333;
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((t) => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
// The page's errors and warnings from the navigation until the body returns (capped: a per-frame error must not swamp the line).
const logged = []; let dropped = 0; let since = Infinity;
const note = (level, text, url, line, at) => {
  if (!(at >= since)) return; // (Runtime.enable and Log.enable replay the page's older messages: their timestamps are from before this run)
  if (logged.length >= 200) { dropped++; return; }
  const e = { level, text: String(text ?? '').slice(0, 600) };
  if (url) e.url = url;
  if (typeof line === 'number') e.line = line;
  logged.push(e);
};
const argText = (a) => (a.type === 'string' ? a.value : a.description ?? (a.value !== undefined ? JSON.stringify(a.value) : a.type));
const onEvent = (method, p) => {
  if (method === 'Runtime.exceptionThrown') {
    const d = p.exceptionDetails; const f = d.stackTrace?.callFrames?.[0];
    note('error', d.exception?.description ?? d.text, d.url ?? f?.url, d.lineNumber + 1, p.timestamp);
  } else if (method === 'Runtime.consoleAPICalled' && ['error', 'warning', 'assert'].includes(p.type)) {
    const f = p.stackTrace?.callFrames?.[0];
    note(p.type === 'warning' ? 'warning' : 'error', p.args.map(argText).join(' '), f?.url, f ? f.lineNumber + 1 : undefined, p.timestamp);
  } else if (method === 'Log.entryAdded' && (p.entry.level === 'error' || p.entry.level === 'warning')) {
    const e = p.entry;
    note(e.level, (e.source === 'javascript' ? '' : `${e.source}: `) + e.text, e.url, e.lineNumber, e.timestamp);
  }
};
// The body's screenshots: `await window.__shot('name')` (play/lib.js) captures the page, HUD included, into SHOT_DIR.
const shotDir = process.env.SHOT_DIR;
const onBinding = async (p) => {
  if (p.name !== '__cdpShot') return;
  const { name, token } = JSON.parse(p.payload);
  let saved = null;
  if (shotDir) {
    const r = await Promise.race([send('Page.captureScreenshot', { format: 'png' }), new Promise((ok) => setTimeout(() => ok(null), 20000))]);
    if (r?.result?.data) { mkdirSync(shotDir, { recursive: true }); saved = join(shotDir, `${name.replace(/[^\w.-]+/g, '_')}.png`); writeFileSync(saved, Buffer.from(r.result.data, 'base64')); }
  }
  void send('Runtime.evaluate', { expression: `window.__shotDone && window.__shotDone(${JSON.stringify(token)}, ${JSON.stringify(saved)})` });
};
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  else if (d.method === 'Runtime.bindingCalled') void onBinding(d.params);
  else if (d.method) onEvent(d.method, d.params);
};
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Runtime.enable');
await send('Log.enable');
await send('Runtime.addBinding', { name: '__cdpShot' });
since = Date.now() - 5;
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 2, mobile: false });
if (url !== '-') { await send('Page.navigate', { url }); await new Promise((r) => setTimeout(r, Number(loadS) * 1000)); }
// `//#include <path>` lines (relative to the file) are replaced by that file: the play bodies share play/lib.js.
const inline = (f) => readFileSync(f, 'utf8').replace(/^\/\/#include (.+)$/gm, (_, p) => inline(resolve(dirname(f), p.trim())));
const code = inline(file);
const r = await send('Runtime.evaluate', { expression: `(async () => { ${code} })()`, awaitPromise: true, returnByValue: true });
since = Infinity;
const v = r.result?.exceptionDetails ? 'EXCEPTION ' + JSON.stringify(r.result.exceptionDetails).slice(0, 1500) : r.result?.result?.value ?? r;
console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1));
if (dropped) logged.push({ level: 'info', text: `… ${dropped} more not shown` });
console.log('CONSOLE: ' + JSON.stringify(logged));
ws.close();

// Minimal CDP driver: node shot.mjs <url> <out.png> [waitSeconds] [js-to-run-before-shot]
const CDP = 'http://127.0.0.1:' + (process.env.CDP_PORT ?? '9333'); // CDP_PORT selects the headless Chrome (default 9333)
const [url, out, wait = '20', js = ''] = process.argv.slice(2);
const { writeFileSync } = await import('node:fs');
const list = await (await fetch(CDP + '/json/list')).json();
let page = list.find((t) => t.type === 'page');
if (!page) page = await (await fetch(CDP + '/json/new?about:blank', { method: 'PUT' })).json();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pending = new Map();
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send('Page.enable');
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await new Promise((r) => setTimeout(r, Number(wait) * 1000));
if (js) { const res = await send('Runtime.evaluate', { expression: js, awaitPromise: true, returnByValue: true }); console.log('js:', JSON.stringify(res.result?.result?.value ?? res.result?.exceptionDetails?.text ?? res).slice(0, 600)); }
const shot = await send('Page.captureScreenshot', { format: 'png' });
writeFileSync(out, Buffer.from(shot.result.data, 'base64'));
console.log('saved', out);
ws.close();

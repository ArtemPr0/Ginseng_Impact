//#include lib.js
const B = G.area.breakables;
await sleep(1500);
const p = hero();
// time an empty blow (all providers scanned)
let t0 = performance.now();
for (let i = 0; i < 20; i++) B.damageAt(p.x + 500, 0, p.z + 500, 2, 'light');
const emptyMs = (performance.now() - t0) / 20;
// find nearest flora placement with a tree
let best = null;
G.scene.traverse((o) => { if (o.name?.startsWith('flora:') && /pine|tree|boulder|mushroom|barrel/.test(o.name)) for (const q of o.userData.placements ?? []) { const d = Math.hypot(q.x - p.x, q.z - p.z); if (d > 4 && (!best || d < best.d)) best = { d, q, id: o.name }; } });
if (!best) return JSON.stringify({ emptyMs, none: true });
const q = best.q;
const before = B.entries.length;
t0 = performance.now();
const n1 = B.damageAt(q.x, q.y + 1, q.z, 1.2, 'heavy');
const hitMs = performance.now() - t0;
const e = B.entries.find((x) => x.target.key === q);
const st1 = e?.state;
for (let i = 0; i < 8 && e && e.state !== 'rubble'; i++) B.damageAt(q.x, q.y + 1, q.z, 1.2, 'heavy');
const cam = G.camera; G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2;
G.tpc.update = () => { cam.position.set(q.x + 9, q.y + 5, q.z + 9); cam.lookAt(q.x, q.y + 2, q.z); };
await sleep(300); await shot('tree-0.3s');
await sleep(2500); await shot('tree-2.8s');
return JSON.stringify({ emptyMs: +emptyMs.toFixed(2), hitMs: +hitMs.toFixed(1), target: best.id, d: +best.d.toFixed(1), n1, st1, end: e?.state, added: B.entries.length - before, chunks: e?.chunks.length, pieces: B.sim.pieces.length, errors: consoleErrors.slice(0, 5), shots });

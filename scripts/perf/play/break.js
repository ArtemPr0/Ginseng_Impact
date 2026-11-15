//#include lib.js
// Breaks a building in front of the camera and shoots it (2026-11-15 destruction).
const B = G.area.breakables;
const ids = {};
for (const e of B.entries) ids[e.target.id] = (ids[e.target.id] ?? 0) + 1;
const want = window.__breakId ?? 'village-house';
const p0 = hero();
const list = B.entries.filter((e) => e.target.id === want).sort((a, b) => Math.hypot(a.x - p0.x, a.z - p0.z) - Math.hypot(b.x - p0.x, b.z - p0.z));
const e = list[0];
if (!e) return JSON.stringify({ ids, missing: want });
// Stand 16 m off on the hero's side.
const dx = p0.x - e.x, dz = p0.z - e.z, l = Math.hypot(dx, dz) || 1;
const off = window.__breakOff ?? (e.r + 10);
await tp(e.x + (dx / l) * off, e.z + (dz / l) * off, undefined, e.x, e.z);
G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2;
G.scene.traverse((o) => { if (o.isInstancedMesh && o !== G.area.grass?.mesh && /tree|pine|birch|cypress|willow|palm/.test(o.parent?.name ?? '')) o.visible = false; });
{ const cam = G.camera; const gy0 = G.world.heightAt(e.x, e.z); const k = (e.r + 9) / l;
  G.tpc.update = () => { cam.position.set(e.x + dx * k, gy0 + e.r * 0.9 + 3, e.z + dz * k); cam.lookAt(e.x, gy0 + 2.2, e.z); }; }
await sleep(2500);
await shot('intact');
const gy = G.world.heightAt(e.x, e.z);
const fx = e.x + (dx / l) * e.r * 0.6, fz = e.z + (dz / l) * e.r * 0.6;
const t0 = performance.now();
const hit1 = B.damageAt(fx, gy + 1.5, fz, 2.5, 'spell');
const fractureMs = performance.now() - t0;
await sleep(200); await shot('spell-0.2s');
await sleep(1500); await shot('spell-1.7s');
const afterSpell = { state: e.state, standing: e.chunks.filter((c) => c.standing).length, chunks: e.chunks.length, live: e.live.length, pieces: B.sim.pieces.length, active: B.sim.active };
B.damageAt(e.x, gy + 2, e.z, 4, 'burst');
B.damageAt(e.x, gy + 2, e.z, 4, 'burst');
await sleep(250); await shot('collapse-0.25s');
await sleep(900); await shot('collapse-1.1s');
await sleep(3000); await shot('rubble-4s');
const rubbleFeet = e.rubble.size;
// fps while pieces settle
let n = 0; const tf = performance.now(); await new Promise((r) => { const f = () => { n++; if (performance.now() - tf < 2000) requestAnimationFrame(f); else r(); }; requestAnimationFrame(f); });
return JSON.stringify({ total: B.entries.length, ids, house: { id: e.target.id, x: +e.x.toFixed(1), z: +e.z.toFixed(1), size: +e.target.size.toFixed(1), quick: !!e.target.quick }, hit1, fractureMs: +fractureMs.toFixed(1), afterSpell, end: { state: e.state, pieces: B.sim.pieces.length, active: B.sim.active, rubbleFeet }, fps: n / 2, errors: consoleErrors.slice(0, 5), shots });

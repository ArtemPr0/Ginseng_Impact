//#include lib.js
// v13 (2026-11-17): Wren rises on mushrooms while Space is held; a sword blow on a house breaks only where it lands;
// a fallen house's rubble lies on the ground (none hangs in the air) and can be walked over without sliding or bouncing.
await sleep(3000);
const C = G.combat, B = G.area.breakables, cam = G.camera, c = G.controller;
for (const e of C.enemies) if (e.brain) e.brain.p.aggroRange = 0;
G.scene.fog = null; G.renderer.gl.toneMappingExposure = 1.6;
const out = { frames: {} };
const snap = (name) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const k = document.createElement('canvas'); k.width = 480; k.height = 270;
  k.getContext('2d').drawImage(G.renderer.gl.domElement, 0, 0, 480, 270);
  out.frames[name] = k.toDataURL('image/jpeg', 0.8); r();
})));
// --- mushrooms ---
await hero_(1);
await tp(60, 30, undefined, 60, 40); await sleep(500);
const g0 = G.world.heightAt(60, 30, 200);
G.tpc.update = () => { const h = hero(); cam.position.set(h.x - 9, g0 + 4, h.z - 2); cam.lookAt(h.x, g0 + 3.5, h.z); };
keyDown('Space');
const rise = [];
for (let i = 0; i < 10; i++) { await sleep(300); rise.push({ y: +(hero().y - g0).toFixed(2), mode: c.mode }); if (i === 9) await snap('shroom-top'); }
keyUp('Space');
await sleep(1200);
out.mushrooms = { rise, standing: { y: +(hero().y - g0).toFixed(2), mode: c.mode } };
await snap('shroom-after');
await sleep(9000);
out.mushrooms.later = { y: +(hero().y - g0).toFixed(2), mode: c.mode, left: G.scene.getObjectsByProperty('name', 'wren-mushroom').length };
delete G.tpc.update;
// --- a sword blow on a house ---
const p0 = hero();
const houses = B.entries.filter((b) => b.state === 'intact' && !b.target.tree && b.target.size >= 5 && b.target.size <= 11)
  .sort((a, b) => Math.hypot(a.x + 34, a.z - 70) - Math.hypot(b.x + 34, b.z - 70));
const b = houses[0];
if (b) {
  await tp(b.x - b.r - 4, b.z, undefined, b.x, b.z); await sleep(500);
  const gy = G.world.heightAt(b.x, b.z, 200);
  G.tpc.update = () => { cam.position.set(b.x - b.r - 9, gy + 4, b.z + 4); cam.lookAt(b.x, gy + 2, b.z); };
  await snap('house-before');
  // On its wall facing him, at head height: a sword's heavy (1 m).
  const wx = b.x - b.r * 0.7, wy = gy + 1.6;
  B.damageAt(wx, wy, b.z, 1, 'heavy');
  await sleep(2500);
  const st = b.chunks.filter((k) => k.standing).length;
  out.sword = { id: b.target.id, state: b.state, standing: st, of: b.chunks.length };
  await snap('house-sword');
  // Then brought down hard, and left to settle.
  for (let i = 0; i < 6; i++) { B.damageAt(b.x + (Math.random() - 0.5) * 3, gy + 1 + i * 0.8, b.z + (Math.random() - 0.5) * 3, 3, 'burst'); await sleep(200); }
  await sleep(8000);
  const floating = [];
  for (const p of B.sim.pieces) {
    if (p.awake) continue;
    const gr = G.world.heightAt(p.x, p.z, p.y);
    const lo = p.box ? p.y - Math.max(p.box.x, p.box.y, p.box.z) : p.y - p.r;
    if (lo - gr > 0.15) floating.push({ x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), over: +(lo - gr).toFixed(2) });
  }
  out.collapse = { state: b.state, standing: b.chunks.filter((k) => k.standing).length, pieces: B.sim.pieces.length, floating: floating.length, first: floating.slice(0, 4) };
  await snap('house-down');
  // Walk across where it stood and out the other side.
  delete G.tpc.update;
  await tp(b.x - b.r - 3, b.z + 0.3, undefined, b.x + 10, b.z + 0.3);
  face(b.x + 10, b.z + 0.3);
  await sleep(400);
  const walk = [];
  keyDown('KeyW');
  const t0 = performance.now();
  while (performance.now() - t0 < 7000) {
    face(b.x + 30, b.z + 0.3);
    await sleep(250);
    const h = hero();
    walk.push({ x: +h.x.toFixed(1), y: +h.y.toFixed(2), mode: c.mode, ground: +G.world.heightAt(h.x, h.z, h.y + 0.5).toFixed(2) });
  }
  keyUp('KeyW');
  // Around where he ended: the heights a 2 m square round him reads (at his own height as the hint), 0.25 m apart.
  { const h = hero(); const rows = [];
    for (let dz = -1; dz <= 1.001; dz += 0.25) { const r = []; for (let dx = -1; dx <= 2.001; dx += 0.25) r.push(+G.world.heightAt(h.x + dx, h.z + dz, h.y).toFixed(2)); rows.push(r.join(' ')); }
    out.around = { at: [+h.x.toFixed(2), +h.y.toFixed(2), +h.z.toFixed(2)], climbDir: c.climbDir, stamina: c.stamina, rows }; }
  const air = walk.filter((w) => w.mode === 'air').length;
  const flips = walk.slice(1).filter((w, i) => w.mode !== walk[i].mode).length;
  const above = Math.max(...walk.map((w) => w.y - w.ground));
  out.walk = { log: walk, samples: walk.length, from: walk[0]?.x, to: walk[walk.length - 1]?.x, air, flips, maxAbove: +above.toFixed(2), slid: walk.filter((w, i) => i && w.x < walk[i - 1].x - 0.05).length };
}
out.errors = consoleErrors.slice(0, 6);
return out;

//#include lib.js
// v13 (2026-11-17): Orlan lifts a small house whole with Telekinesis (hold right click on slot 7), throws it at the
// crosshair (left click), and it breaks only where it lands; Sir Aldric grabs a mob (G), clubs with it (left click)
// and throws it (G). Real inputs, frames of each step.
await sleep(3000);
const C = G.combat, K = C.carry, B = G.area.breakables, cam = G.camera;
for (const e of C.enemies) if (e.brain) e.brain.p.aggroRange = 0;
G.scene.fog = null; G.renderer.gl.toneMappingExposure = 1.6;
const out = { frames: {} };
const grab = (name) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270;
  c.getContext('2d').drawImage(G.renderer.gl.domElement, 0, 0, 480, 270);
  out.frames[name] = c.toDataURL('image/jpeg', 0.75); r();
})));
// --- Orlan and a house ---
const p0 = hero();
const houses = B.entries.filter((b) => b.state === 'intact' && !b.target.tree && b.target.size >= 4 && b.target.size <= 11)
  .sort((a, b) => Math.hypot(a.x - p0.x, a.z - p0.z) - Math.hypot(b.x - p0.x, b.z - p0.z));
const b = houses[0];
out.house = b && { id: b.target.id, size: b.target.size, x: +b.x.toFixed(1), z: +b.z.toFixed(1), chunks: b.chunks.length };
if (b && !new URLSearchParams(location.search).has('knight')) {
  await hero_(2);
  const sx = b.x - 9, sz = b.z;
  await tp(sx, sz, undefined, b.x, b.z); face(b.x, b.z); await sleep(400);
  const gy = G.world.heightAt(b.x, b.z, 200);
  // The camera behind him over his shoulder, the crosshair on the house's middle.
  let look = { x: b.x, y: gy + 1.5, z: b.z };
  G.tpc.update = () => { const h = hero(); cam.position.set(h.x - 6, h.y + 3.2, h.z + 0.8); cam.lookAt(look.x, look.y, look.z); };
  await sleep(300);
  await press('Digit7', 60);
  await grab('h0-before');
  mouseDown(2);
  await sleep(1800);
  const L = [...B.lifted][0];
  out.lift = { whole: !!K.mind?.whole, lifted: L && { id: L.target.id, x: +L.x.toFixed(1), z: +L.z.toFixed(1), size: +L.target.size.toFixed(1) } };
  const breaks = [];
  const hb = K.h.breakAt.bind(K.h);
  K.h.breakAt = (x, y, z, r, kind) => { breaks.push({ x: +x.toFixed(1), z: +z.toFixed(1), r: +r.toFixed(1), kind }); return hb(x, y, z, r, kind); };
  out.breaks = breaks;
  await grab('h1-held');
  // Aim off to the side, 14 m out on open ground, and throw.
  const tx = sx + 4, tz = sz + 14;
  look = { x: tx, y: G.world.heightAt(tx, tz, 200), z: tz };
  await sleep(700);
  await grab('h2-aimed');
  mouseDown(0); await frames(2); mouseUp(0);
  await sleep(150);
  mouseUp(2);
  const log = [];
  for (let k = 0; k < 10; k++) {
    await sleep(400);
    log.push({ k, flying: !!K.house, x: L && +L.x.toFixed(1), z: L && +L.z.toFixed(1), state: L?.state, standing: L ? L.chunks.filter((c) => c.standing).length : null, of: L?.chunks.length, pieces: B.sim.pieces.length });
    if (k === 2 || k === 6) await grab(`h3-land${k}`);
  }
  out.flight = log;
  out.aimedAt = { x: tx, z: tz };
  // Nothing hangs in the air: sleeping pieces more than 0.3 m over the ground under them.
  await sleep(5000);
  const floating = [];
  for (const p of B.sim.pieces) {
    if (p.awake) continue;
    const g = G.world.heightAt(p.x, p.z, p.y);
    const bottom = p.y - (p.box ? Math.min(p.box.x, p.box.y, p.box.z) : p.r);
    if (bottom - g > 0.3) floating.push({ x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), over: +(bottom - g).toFixed(2) });
  }
  out.floating = { count: floating.length, of: B.sim.pieces.length, first: floating.slice(0, 5) };
  await grab('h4-after');
  delete G.tpc.update;
}
// --- Sir Aldric grabs a mob ---
await hero_(0);
const me = hero();
const grabbable = (e) => { const d = e.def; return e.alive && !d.boss && !d.flying && d.speed > 0 && !d.body && !d.eye && !d.seated && d.floatAt === undefined && d.height * (d.scale ?? 1) < 3.2; };
const mob = C.enemies.filter(grabbable)
  .sort((a, b) => Math.hypot(a.pos.x - me.x, a.pos.z - me.z) - Math.hypot(b.pos.x - me.x, b.pos.z - me.z))[0];
if (mob) {
  out.mob = { kind: mob.def.kind, at: [+mob.pos.x.toFixed(1), +mob.pos.z.toFixed(1)] };
  // Two of them: one to hold, one to club.
  const other = C.enemies.filter((e) => e !== mob && grabbable(e))
    .sort((a, b) => Math.hypot(a.pos.x - mob.pos.x, a.pos.z - mob.pos.z) - Math.hypot(b.pos.x - mob.pos.x, b.pos.z - mob.pos.z))[0];
  await tp(mob.pos.x - 1.8, mob.pos.z, undefined, mob.pos.x, mob.pos.z); face(mob.pos.x, mob.pos.z);
  if (other) { other.pos.x = mob.pos.x - 0.6; other.pos.z = mob.pos.z + 1.6; }
  await sleep(300);
  // Side-on, a little off: him, his fist and what hangs from it.
  G.tpc.update = () => { const h = hero(); cam.position.set(h.x + 0.5, h.y + 2.2, h.z - 5.5); cam.lookAt(h.x + 0.8, h.y + 1.3, h.z); };
  await press('KeyG', 60);
  await sleep(600);
  const prop = G.rigs?.[0]?.prop ?? null;
  out.grab = { held: mob.held, hand: !!K.hand, swordShown: prop ? prop.visible : 'no prop ref' };
  await grab('k1-held');
  const hp0 = other?.hp;
  // Walk sideways a moment so it swings on its grip.
  keyDown('KeyD'); await sleep(500); keyUp('KeyD');
  out.swingTilt = mob.swing && { x: +mob.swing.x.toFixed(2), z: +mob.swing.z.toFixed(2) };
  await grab('k2-swaying');
  if (other) { other.pos.x = hero().x + 1.2; other.pos.z = hero().z + 0.3; }
  await clickMouse(0, 40);
  await sleep(250);
  await grab('k3-club');
  await sleep(400);
  out.club = { otherHp: hp0 !== undefined ? [+hp0.toFixed(1), +other.hp.toFixed(1)] : null, stillHeld: mob.held };
  await press('KeyG', 60);
  await sleep(200);
  await grab('k4-thrown');
  out.thrown = { held: mob.held, hand: !!K.hand, swordShownAfter: prop ? prop.visible : null };
  await sleep(1500);
  out.after = { swordShown: prop ? prop.visible : null };
  delete G.tpc.update;
}
out.errors = consoleErrors.slice(0, 8);
return out;

//#include lib.js
// The twelve spells (2026-11-15): each cast on the open meadow at three mobs pulled in front of the hero, a frame shot
// mid-spell and after, with the frame time, live debris and console errors logged.
await sleep(2000);
const C = G.combat, cam = G.camera;
document.getElementById('hud').style.visibility = 'hidden';
G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2;
const SPOT = { x: 24.9, z: 37.6 };
const only = window.__spellOnly ?? null;
const burst = window.__burst ?? false;
const heroes = ['knight', 'archer', 'wizard'];
const out = { casts: [] };
const mobs = C.enemies.filter((e) => e.alive && e.model && !e.def.boss && !e.def.flying && e.def.speed > 0).slice(0, 40);
for (const e of mobs) e.brain.p.aggroRange = 0;
let n = 0;
for (const heroId of heroes) for (let slot = 0; slot < 4; slot++) {
  if (only !== null && n++ !== only) continue;
  await tp(SPOT.x - 9, SPOT.z, undefined, SPOT.x, SPOT.z);
  await sleep(300);
  const aim = { x: SPOT.x, z: SPOT.z, y: G.world.heightAt(SPOT.x, SPOT.z, 50) };
  // Three mobs in a loose knot round the aim point.
  const near = mobs.filter((e) => e.alive).sort((a, b) => dist2(a.pos, aim) - dist2(b.pos, aim)).slice(0, 3);
  near.forEach((e, i) => { e.pos.x = SPOT.x + Math.cos(i * 2.1) * 1.6; e.pos.z = SPOT.z + Math.sin(i * 2.1) * 1.6; e.pos.y = G.world.heightAt(e.pos.x, e.pos.z, 50); e.hp = e.def.maxHp * e.hpScale; e.afflict("stun", 6); });
  G.tpc.update = () => { cam.position.set(SPOT.x - 9, aim.y + 4, SPOT.z + 6); cam.lookAt(SPOT.x, aim.y + 1.2, SPOT.z); };
  await sleep(500);
  const V = cam.position.constructor;
  const h0 = { x: hero().x, z: hero().z, mode: G.controller.mode };
  const t0 = performance.now();
  const def = C.caster.cast(heroId, slot, new V(aim.x, aim.y, aim.z));
  const castMs = performance.now() - t0;
  const long = def.id === 'black-hole' || def.id === 'fire-tornado' || def.id === 'overgrowth' || def.id === 'blood-moon';
  if (burst) { for (const ms of [450, 150, 250, 400]) { await sleep(ms); await shot(`${def.id}-t`); } }
  await sleep(long ? 900 : 350); await shot(`${def.id}-a`);
  let worst = 0, last = performance.now();
  const until = performance.now() + (long ? 2600 : 1100);
  while (performance.now() < until) { await new Promise((r) => requestAnimationFrame(r)); const t = performance.now(); worst = Math.max(worst, t - last); last = t; }
  await shot(`${def.id}-b`);
  out.casts.push({ id: def.id, castMs: +castMs.toFixed(1), worstFrame: Math.round(worst), moved: +Math.hypot(hero().x - h0.x, hero().z - h0.z).toFixed(1), mode: h0.mode, debris: G.area.breakables.sim.active, gore: C.gore.sim.pieces.length, hp: near.map((e) => (e.alive ? Math.round((e.hp / (e.def.maxHp * e.hpScale)) * 100) : 'dead')), craters: G.area.craters.healing });
  if (def.id === 'black-hole' || def.id === 'fire-tornado') await sleep(2500);
}
out.errors = consoleErrors.slice(0, 6);
return JSON.stringify(out);

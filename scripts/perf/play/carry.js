//#include lib.js
// Carry (2026-11-16): Sir Aldric grabs a mob one-handed and throws it; Orlan lifts a small house with his mind and
// hurls it at mobs.
await sleep(2000);
const V = G.camera.position.constructor;
const C = G.combat, K = C.carry, c = G.controller;
G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2;
for (const el of document.querySelectorAll('body > div')) if (!el.querySelector('canvas')) el.style.visibility = 'hidden';
const cam = G.camera;
const out = {};
const step = (i) => K.update(0.016, { grab: false, attack: false, heavyHeld: false, ...i });
// --- the knight ---
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' })); await sleep(300);
window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit1' })); await sleep(1200);
out.hero1 = C.active.id;
const mob = C.enemies.filter((e) => e.alive && e.model?.hasClips && !e.def.boss && !e.def.seated && !e.def.flying && e.def.speed > 0 && e.def.height * (e.def.scale ?? 1) < 3).sort((a, b) => dist2(a.pos, hero()) - dist2(b.pos, hero()))[0];
if (mob) {
  mob.brain.p.aggroRange = 0;
  await tp(mob.pos.x + 6, mob.pos.z);
  await sleep(800);
  c.yaw = Math.PI; // facing −x, at the mob
  mob.pos.x = c.pos.x - 1.6; mob.pos.z = c.pos.z; mob.pos.y = G.world.heightAt(mob.pos.x, mob.pos.z, c.pos.y + 1);
  await sleep(300);
  step({ grab: true });
  out.grabbed = !!K.hand;
  G.tpc.update = () => { cam.position.set(c.pos.x + 1.5, c.pos.y + 2.2, c.pos.z + 4.5); cam.lookAt(c.pos.x - 0.8, c.pos.y + 1.4, c.pos.z); };
  await sleep(1200); await shot('knight-holds');
  out.held = { y: +(mob.pos.y - c.pos.y).toFixed(2), d: +Math.hypot(mob.pos.x - c.pos.x, mob.pos.z - c.pos.z).toFixed(2) };
  const hp0 = mob.hp;
  step({ attack: true });
  await sleep(250); await shot('knight-throw-0.25');
  await sleep(1500); await shot('knight-throw-landed');
  out.thrown = { dist: +Math.hypot(mob.pos.x - c.pos.x, mob.pos.z - c.pos.z).toFixed(1), hurt: Math.round(hp0 - mob.hp), flying: !!mob.thrown, alive: mob.alive };
}
// --- the wizard ---
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit3' })); await sleep(300);
window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Digit3' })); await sleep(1500);
out.hero3 = C.active.id;
const B = G.area.breakables;
const house = B.near(c.pos.x, c.pos.z, 200).filter((b) => b.state === 'intact' && !b.target.brief && !b.target.tree && b.target.size >= 3 && b.target.size < 12).sort((a, b) => Math.hypot(a.x - c.pos.x, a.z - c.pos.z) - Math.hypot(b.x - c.pos.x, b.z - c.pos.z))[0];
if (house) {
  out.house = house.target.id;
  await tp(house.x + house.r + 7, house.z);
  await sleep(2500);
  c.yaw = Math.PI;
  const gy = G.world.heightAt(house.x, house.z);
  K.h.aimAt = () => new V(house.x, gy, house.z);
  K.h.lookDir = () => new V(-1, 0.1, 0.4).normalize();
  G.tpc.update = () => { cam.position.set(c.pos.x + 7, c.pos.y + 4, c.pos.z + 9); cam.lookAt(c.pos.x - 2, c.pos.y + 2.5, c.pos.z); };
  await sleep(500); await shot('wizard-before');
  step({ heavyHeld: true });
  out.lifting = !!K.mind;
  for (let i = 0; i < 150; i++) { step({ heavyHeld: true }); await sleep(30); }
  out.holding = K.mind ? K.mind.pieces.size : -1;
  await shot('wizard-holds');
  step({ heavyHeld: false });
  await sleep(300); await shot('wizard-hurl-0.3');
  await sleep(1500); await shot('wizard-hurl-1.8');
}
out.errors = consoleErrors.slice(0, 5);
return JSON.stringify(out);

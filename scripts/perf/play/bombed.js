//#include lib.js
// Bombed ground (2026-11-16): blasts on one spot dig a hole down to 3 m, wide and walkable, throwing out clods.
await sleep(2000);
const C = G.combat, c = G.controller;
G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2;
for (const el of document.querySelectorAll('body > div')) if (!el.querySelector('canvas')) el.style.visibility = 'hidden';
// The nearest spot that may be dug, 9-30 m off.
let x = c.pos.x + 9, z = c.pos.z;
search: for (let r = 9; r < 30; r += 3) for (let a = 0; a < 6.28; a += 0.5) {
  const tx = c.pos.x + Math.cos(a) * r, tz = c.pos.z + Math.sin(a) * r;
  if ([[0, 0], [4, 0], [-4, 0], [0, 4], [0, -4]].every(([dx, dz]) => G.area.craters.hooks.canDig(tx + dx, tz + dz))) { x = tx; z = tz; break search; }
}
const g0 = G.world.heightAt(x, z);
const cam = G.camera;
G.tpc.update = () => { cam.position.set(x - 9, g0 + 6, z + 9); cam.lookAt(x, g0 - 1, z); };
await sleep(600); await shot('bomb-0');
const out = { g0 };
for (let i = 0; i < 5; i++) {
  C.d.dig(x, z, 3.6, 1.5);
  C.fx.dust(new (cam.position.constructor)(x, g0, z), 3);
  await sleep(i === 0 ? 300 : 900);
  if (i === 0) await shot('bomb-1-0.3s');
}
await sleep(2500); await shot('bomb-5');
out.depth = +(g0 - G.world.heightAt(x, z)).toFixed(2);
let steep = 0;
for (let dx = -12; dx <= 12; dx += 0.5) steep = Math.max(steep, G.area.craters.field.slopeAt(x + dx, z + 0.3));
out.steepest = +steep.toFixed(2);
out.clods = G.combat.d.debris().reduce((n, s) => n + s.pieces.length, 0);
out.errors = consoleErrors.slice(0, 5);
return JSON.stringify(out);

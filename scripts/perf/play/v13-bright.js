//#include lib.js
// v13: how bright the frame gets when a blast goes off 6 m away (Moonbomb blinded the screen, playtest 2026-11-17).
// Mean frame luminance (0-1) over the second after the cast, at the game's own exposure; the plan's bar is 0.6.
await sleep(3000);
const C = G.combat;
for (const e of C.enemies) if (e.brain) e.brain.p.aggroRange = 0;
const out = {};
const lum = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const c = document.createElement('canvas'); c.width = 96; c.height = 54;
  const x = c.getContext('2d'); x.drawImage(G.renderer.gl.domElement, 0, 0, 96, 54);
  const d = x.getImageData(0, 0, 96, 54).data; let s = 0;
  for (let i = 0; i < d.length; i += 4) s += (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
  r(s / (d.length / 4));
})));
for (const [who, i, slot] of [['archer', 1, 0], ['archer', 1, 1], ['wizard', 2, 0]]) {
  await hero_(i);
  await tp(60, 30, undefined, 60, 40);
  await sleep(600);
  const id = who + ':' + slot;
  const base = await lum();
  const p = hero();
  const aim = G.camera.position.clone().set(p.x, 0, p.z + 6); aim.y = G.world.heightAt(aim.x, aim.z, 200);
  C.caster.cast(who, slot, aim);
  let peak = 0, sum = 0, n = 0;
  const t0 = performance.now();
  while (performance.now() - t0 < 2500) { const l = await lum(); peak = Math.max(peak, l); sum += l; n++; }
  out[id] = { base: +base.toFixed(3), peak: +peak.toFixed(3), mean: +(sum / n).toFixed(3), frames: n };
  await sleep(3000);
}
return out;

//#include lib.js
// v13 (2026-11-17): every spell on both pages cast in the open, a frame of each, and what errors came out.
await sleep(3000);
const C = G.combat;
for (const e of C.enemies) if (e.brain) e.brain.p.aggroRange = 0;
const only = window.__v13 ?? new URLSearchParams(location.search).get('v13');
const HEROES = ['knight', 'archer', 'wizard'];
const { SPELLS } = window.__ginsengSpells ?? {};
const out = { casts: [], frames: {} };
// The canvas itself, in a frame queued behind the game's (Page.captureScreenshot is black when the display sleeps).
const grab = (name) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const src = G.renderer.gl.domElement, c = document.createElement('canvas');
  c.width = 480; c.height = 270; c.getContext('2d').drawImage(src, 0, 0, 480, 270);
  out.frames[name] = c.toDataURL('image/jpeg', 0.75); r();
})));
const cam = G.camera;
if (window.__bright !== false) { G.scene.fog = null; G.renderer.gl.toneMappingExposure = 1.6; }
G.scene.traverse((o) => { if (o.isInstancedMesh && o !== G.area.grass?.mesh && o.name !== 'ground-fires' && !/spike|ice|chunk|stone/i.test(o.name)) o.visible = false; });
for (let hi = 0; hi < 3; hi++) {
  const h = HEROES[hi];
  await hero_(hi);
  const list = C.caster.spellList?.(h) ?? null;
  for (let s = 0; s < 12; s++) {
    if (only && !String(only).split(',').includes(`${h}:${s}`)) continue;
    // (The same spot every cast: Wrecking Charge, Fire Dash and Wave Surf move him.)
    const home = window.__home ?? { x: 60, z: 30 };
    await tp(home.x, home.z, undefined, home.x, home.z + 9);
    G.controller.vel?.set?.(0, 0, 0);
    await sleep(250);
    const p = hero();
    const aim = cam.position.clone().set(p.x, 0, p.z + 9);
    aim.y = G.world.heightAt(aim.x, aim.z, 200);
    face(aim.x, aim.z);
    G.tpc.update = () => { cam.position.set(p.x - 8, p.y + 3.5, p.z + 1); cam.lookAt(p.x, p.y + 1.4, p.z + 5); };
    const before = consoleErrors.length;
    let threw = null;
    try { C.caster.cast(h, s, aim); } catch (err) { threw = String(err).slice(0, 160); }
    await sleep(500);
    await grab(`${h}-${s}a`);
    await sleep(900);
    await grab(`${h}-${s}b`);
    await sleep(900);
    out.casts.push({ h, s, threw, errors: consoleErrors.slice(before, before + 3) });
    delete G.tpc.update;
    await sleep(300);
  }
}
out.errorsTotal = consoleErrors.length;
return out;

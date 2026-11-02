//#include lib.js
// Eye-level walk: window.__walk = {x0,x1,z0,z1,step}. Mobs held still; four headings per stop would be too many to
// read, so each stop is one shot looking along the path of the walk, turning 90 degrees per row.
await sleep(1500);
const W = (typeof WALK !== 'undefined' ? WALK : null) ?? { x0: -120, x1: 120, z0: -120, z1: 120, step: 30 };
for (const e of G.combat.enemies) e.update = () => null;
const r = G.renderer; const orig = r.render.bind(r); let aim = null;
r.render = (sc, c) => { if (aim) { c.position.set(aim[0], aim[1], aim[2]); c.lookAt(aim[3], aim[4], aim[5]); c.updateMatrixWorld(); } orig(sc, c); };
document.querySelector('#hud')?.style.setProperty('visibility', 'hidden');
for (const rig of G.rigs) rig.root.visible = false;
let n = 0, row = 0;
for (let z = W.z0; z <= W.z1; z += W.step, row++) for (let x = W.x0; x <= W.x1; x += W.step) {
  const g = G.groundOnly(x, z); if (g < (W.floor ?? -3)) continue;
  G.teleport(x, g, z, 0); await frames(3); await sleep(W.wait ?? 500);
  const a = (n * 2.4); const ey = G.world.heightAt(x, z, g + 3) + 1.7;
  for (const rig of G.rigs) { rig.root.visible = false; rig.trailObject.visible = false; }
  aim = [x, ey, z, x + Math.cos(a) * 20, ey - 0.5, z + Math.sin(a) * 20]; await frames(3); await sleep(150);
  await shot(`${String(x)}_${String(z)}`); n++;
}
return report({ stops: n });

//#include lib.js
// The new landmarks from fixed cameras, the world held still.
await sleep(1500);
const spots = [['nave', 18, -136, 36, 8, -118], ['archgate', 58, -90, 68, 6, -76], ['palm', 72, 89, 40, 40, 60], ['colossus', 10, -96, 26, 7, -84], ['castle', 0, 180, 0, 8, 80], ['ruin', 31, -28, 40, 5, -20], ['flooded', 106, -13, 90, 8, -2], ['gorge', -64, -125, -64, 9, -96], ['mountains', 0, 0, 0, 40, 118], ['city', -330, 20, -100, 22, 10]];
const cam = G.camera; const r = G.renderer; const orig = r.render.bind(r);
let aim = null;
r.render = (sc, c) => { if (aim) { c.position.set(aim[0], aim[1], aim[2]); c.lookAt(aim[3], aim[4], aim[5]); c.updateMatrixWorld(); } orig(sc, c); };
document.querySelector('#hud')?.style.setProperty('visibility', 'hidden');
for (const [n, x, z, cx, cy, cz] of spots) {
  await tp((x + cx) / 2, (z + cz) / 2); await sleep(600);
  G.combat.hp.set('knight', 1700);
  aim = [cx, Math.max(cy, G.world.heightAt(cx, cz, 200) + 2), cz, x, G.world.heightAt(x, z, 200) + 5, z];
  await sleep(500); await shot(n);
}
return report({});

//#include lib.js
await sleep(1500);
const r = G.renderer; const orig = r.render.bind(r); let aim = null;
r.render = (sc, c) => { if (aim) { c.position.set(aim[0], aim[1], aim[2]); c.lookAt(aim[3], aim[4], aim[5]); c.updateMatrixWorld(); } orig(sc, c); };
document.querySelector('#hud')?.style.setProperty('visibility', 'hidden');
const spots = [['door', 96, -18, 98, 7, -22, 85, 6, -18], ['pond', -18, -8, -14, 4, -4, -18, 1, -18], ['lean', 1132, -28, 1136, 44, -22, 1124, 42, -40], ['crypt', -1000, 1296, -1003, 3, 1293, -1006, 1, 1300], ['ribs', 998, 30, 0, 0, 0, 0, 0, 0]];
for (const [n, hx, hz, cx, cy, cz, lx, ly, lz] of spots) {
  if (n === 'ribs') { const b = npc('bartender'); await tp(b.pos.x + 3, b.pos.z + 2, b.pos.y + 2); await sleep(1500); aim = [b.pos.x + Math.cos(b.yaw) * 2.2, b.pos.y + 1.6, b.pos.z + Math.sin(b.yaw) * 2.2, b.pos.x, b.pos.y + 1.1, b.pos.z]; }
  else { await tp(hx, hz, cy); await sleep(1500); aim = [cx, cy, cz, lx, ly, lz]; }
  G.combat.hp.set('knight', 1700); await sleep(1800); await shot(n);
}
return report({});

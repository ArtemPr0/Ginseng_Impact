//#include lib.js
// The Vale on foot, by the keys, with nothing but W: the arrival to the square, over the bridge, up to the crowned head,
// back, east along the lane, over the chains and onto the castle's shelf. If a wall or a gap stops the walk, it fails.
await sleep(1500);
for (const e of G.combat.enemies) e.update = () => null;
const legs = [
  ['arrival', 1000, 1006, [[1006, 985], [1006, 965], [1002, 948], [982, 944], [970, 941], [943, 940], [930, 931], [921, 926]]],
  ['chains', 1012, 955, [[1024, 950], [1046, 922], [1062, 908], [1083.5, 895.5], [1103, 894], [1106, 894.5], [1109, 895.5], [1117.5, 902.5]]],
];
const log = [];
for (const [name, sx, sz, pts] of legs) {
  await tp(sx, sz); await sleep(300); const t0 = performance.now(); keyDown('KeyW'); keyDown('ShiftLeft'); let i = 0; let stuck = 0, last = [hero().x, hero().z];
  while (i < pts.length && performance.now() - t0 < 42000) {
    const [x, z] = pts[i]; face(x, z);
    if (Math.hypot(hero().x - x, hero().z - z) < 1.8) { log.push(`${name} ${i} y${hero().y.toFixed(1)} ${G.controller.mode}`); i++; }
    await frames(2);
    if (performance.now() - t0 > stuck * 1500 + 1500) { stuck++; if (Math.hypot(hero().x - last[0], hero().z - last[1]) < 0.3) { fail('stuck', { name, i, at: [hero().x, hero().y, hero().z].map((v) => +v.toFixed(1)), mode: G.controller.mode }); break; } last = [hero().x, hero().z]; }
  }
  keyUp('KeyW'); keyUp('ShiftLeft'); if (i < pts.length) fail('did not arrive', { name, i, at: [hero().x, hero().y, hero().z].map((v) => +v.toFixed(1)) });
}
return report({ log });

//#include lib.js
// The reconstruction's checks, as a player meets them.
await sleep(1500); const out = {};
// Cathedral: walk in the east door.
await tp(96, -18, undefined, 70, -18); const y0 = hero().y;
keyDown('KeyW'); let t0 = performance.now(); while (performance.now() - t0 < 5000 && hero().x > 76) { face(70, -18); await frames(2); } keyUp('KeyW');
out.door = { x: +hero().x.toFixed(1), y0: +y0.toFixed(1), y: +hero().y.toFixed(1) };
if (hero().x > 80) fail('cannot walk into the cathedral', out.door);
await shot('door-inside');
// Doctor stands on snow: lowest bone vs real ground.
const d = npc('plague-doctor'); out.doctor = { y: +d.pos.y.toFixed(2), real: +G.area?.realmHeight?.(d.pos.x, d.pos.z) };
return report(out);

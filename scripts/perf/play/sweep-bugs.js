//#include lib.js
// The six bugs the takeover named, each tried the way a player would meet it.
await sleep(1500);
const out = {};

// 1. The wyrm's cave: walked in from the north, along the ledge between the tower and the sea cliff.
{
  const cx = 83 + 7.7, cz = 32 + 4.7;
  await tp(96, 14);
  for (const [x, z] of [[95, 22], [93, 30], [91, 34], [90.2, 36.7]]) {
    const t0 = performance.now(); keyDown('KeyW');
    while (performance.now() - t0 < 4500 && Math.hypot(hero().x - x, hero().z - z) > 0.8) { face(x, z); await frames(2); }
    keyUp('KeyW');
  }
  const d = Math.hypot(hero().x - cx, hero().z - cz);
  out.cave = { d: +d.toFixed(2), y: +hero().y.toFixed(1), mode: G.controller.mode };
  if (d > 2) fail('cannot walk to the cave mouth', out.cave);
}

// 2. A koi dies to a real swing.
{
  const k = G.combat.enemies.find((e) => e.def.kind === 'koi' && e.alive);
  const hp = k.hp; const killed = await fight(k, { ms: 9000 });
  out.koi = { hp0: hp, hp: k.hp, killed, flyY: +k.pos.y.toFixed(1) };
  if (!killed) fail('koi survived 9 s of swings', out.koi);
}

// 3. Carriage: D turns right, A left, seen from the bench.
{
  const c = G.carriage;
  await tp(c.pos.x + 2.5, c.pos.z, 26, c.pos.x, c.pos.z); await sleep(200);
  let t = G.interactTarget();
  for (const [dx, dz] of [[-2.5, 0], [0, 2.5], [0, -2.5], [3.5, 0]]) { if (/reins/i.test(t?.label ?? '')) break; await tp(c.pos.x + dx, c.pos.z + dz, 26, c.pos.x, c.pos.z); await sleep(200); t = G.interactTarget(); }
  out.target = t?.label; await press('KeyF', 60); await sleep(300);
  if (panelOpen()) await escape();
  out.driving = c.driving;
  if (!c.driving) fail('no reins');
  else {
    const dir = (a, b) => { const n = Math.hypot(b.x - a.x, b.z - a.z) || 1; return { x: (b.x - a.x) / n, z: (b.z - a.z) / n }; };
    const turn = async (key) => {
      keyDown('KeyW'); await sleep(1100);
      let a = { x: c.pos.x, z: c.pos.z }; await sleep(250); let b = { x: c.pos.x, z: c.pos.z }; const d0 = dir(a, b);
      keyDown(key); await sleep(700); keyUp(key);
      a = { x: c.pos.x, z: c.pos.z }; await sleep(250); b = { x: c.pos.x, z: c.pos.z }; const d1 = dir(a, b);
      keyUp('KeyW'); await sleep(900);
      return d1.x * -d0.z + d1.z * d0.x; // + is right of the old heading
    };
    out.carriageD = +(await turn('KeyD')).toFixed(2);
    out.carriageA = +(await turn('KeyA')).toFixed(2);
    if (!(out.carriageD > 0.1)) fail('D did not turn right', out);
    if (!(out.carriageA < -0.1)) fail('A did not turn left', out);
  }
  await press('Space', 60); await sleep(300);
}

// 4. Snow heights: the doctor and everything in the chapel stands on the snow.
{
  const d = npc('plague-doctor');
  const gy = G.groundOnly(d.pos.x, d.pos.z);
  out.doctor = { y: +d.pos.y.toFixed(2), ground: +gy.toFixed(2) };
  if (Math.abs(d.pos.y - gy) > 0.3) fail('plague doctor off the ground', out.doctor);
  const off = G.area.npcs.filter((n) => !n.def.invisible && !n.seated && n.pos.x > 860 && n.pos.x < 960 && n.pos.z > 75 && n.pos.z < 175)
    .map((n) => [n.def.id, +(n.pos.y - G.groundOnly(n.pos.x, n.pos.z)).toFixed(2)]).filter((r) => Math.abs(r[1]) > 0.3);
  out.snowOff = off; if (off.length) note('snow npcs off ground', { off });
}

// 5. Hollow King: turns on the hero inside 34 m, and calls beasts.
{
  const k = G.combat.enemies.find((e) => e.def.kind === 'hollowking');
  await tp(k.pos.x + 16, k.pos.z + 4, k.pos.y + 3, k.pos.x, k.pos.z);
  let woke = false, called = 0; const t0 = performance.now();
  while (performance.now() - t0 < 60000 && !called) { // (His pick is random: summons are 2 in 6.)
    woke ||= k.aggro; called = Math.max(called, G.combat.enemies.filter((e) => e.summoned && e.alive).length);
    G.combat.hp.set(G.party.active?.id ?? 'knight', 1700); await sleep(200);
  }
  out.king = { woke, called };
  if (!woke) fail('Hollow King passive', out.king);
  if (!called) fail('Hollow King never summoned', out.king);
}
return report(out);

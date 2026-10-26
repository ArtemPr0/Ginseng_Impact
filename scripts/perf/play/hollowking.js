const G = window.__ginseng;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2000);
const hk = G.combat.enemies.find((e) => e.def.kind === 'hollowking');
if (!hk) return JSON.stringify({ err: 'no hollowking' });
G.controller.pos.x = hk.pos.x + 18;
G.controller.pos.z = hk.pos.z + 4;
G.controller.pos.y = G.world.heightAt(G.controller.pos.x, G.controller.pos.z);
await sleep(10000);
const summons = G.combat.enemies.filter((e) => e !== hk && e.alive && Math.hypot(e.pos.x - hk.pos.x, e.pos.z - hk.pos.z) < 55);
return JSON.stringify({
  aggroRange: hk.brain.p.aggroRange,
  state: hk.brain.state,
  aggro: !!hk.aggro,
  summons: summons.map((e) => e.def.kind),
  hp: hk.hp,
});

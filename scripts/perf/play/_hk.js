const G = window.__ginseng;
await new Promise((r) => setTimeout(r, 1500));
const rows = [];
for (let z = -138; z >= -162; z -= 2) {
  const r = [];
  for (let x = 28; x <= 44; x += 2) { const t = G.terrain.heightAt(x, z); const h = G.world.heightAt(x, z, 30); r.push(h.toFixed(1) + (Math.abs(h - t) > 0.3 ? '*' : '')); }
  rows.push(z + ': ' + r.join(' '));
}
const k = G.combat.enemies.find((e) => e.def.kind === 'hollowking');
return JSON.stringify({ rows, king: [k.pos.x, k.pos.y, k.pos.z], seated: k.def.seated, solid: k.def.solid, sit: k.spawn?.sitY });

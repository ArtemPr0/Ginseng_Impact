// Do the walkers walk through walls? Every loop NPC's path, sampled every metre, against the colliders; every standing
// NPC against them too; and is anyone over water or a drop.
const G = window.__ginseng; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); await sleep(2500);
const w = G.world; const bad = [];
for (const n of G.area.npcs) { if (n.def.invisible) continue; const b = n.def.behaviour;
  if (b.kind === 'loop') { const P = b.path; for (let i = 0; i < P.length; i++) { const [ax, az] = P[i], [bx, bz] = P[(i + 1) % P.length]; const L = Math.hypot(bx - ax, bz - az); for (let t = 0; t <= L; t += 1) { const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L; const g = G.groundOnly(x, z); const top = w.heightAt(x, z, g + 1.5);
    if (w.blocked?.(x, z) && top > g + 0.6) { bad.push(`${n.def.id} path hits something at ${x.toFixed(0)},${z.toFixed(0)} top ${(top - g).toFixed(1)}`); t = L; i = P.length; } } } }
  else if (!n.seated) { const g = G.groundOnly(n.pos.x, n.pos.z); if (Math.abs(n.pos.y - g) > 1.2 && g > -40) bad.push(`${n.def.id} stands ${(n.pos.y - g).toFixed(1)} off the ground`); } }
return JSON.stringify({ bad: bad.slice(0, 40), n: G.area.npcs.length });

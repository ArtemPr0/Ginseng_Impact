// Where is there nothing to see? A map of the walkable land: '.' something within 14 m, '#' empty, ' ' not walkable.
// window.__box = [x0,x1,z0,z1]. Counts every placed mesh (instanced too), NPC and mob, by its centre.
const G = window.__ginseng; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); await sleep(2500);
const B = window.__box; const STEP = 12, R = 14; const pts = [];
const m4 = new G.camera.matrixWorld.constructor();
const skip = /^(ground|grass|cloud|sky|moon)/i;
G.scene.traverse((o) => { if (!o.isMesh || !o.geometry) return; for (let p = o; p; p = p.parent) { if (!p.visible) return; if (skip.test(p.name)) return; }
  if (/^(flower|fallen-leaf|cobblestone|reed|mushroom)$/.test((o.name || '').replace('flora:', ''))) return;
  if (o.isInstancedMesh) { for (let i = 0; i < o.count; i += 1) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); const e = m4.elements; pts.push([e[12], e[14]]); } }
  else { if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere(); if (o.geometry.boundingSphere.radius > 60) return; const e = o.matrixWorld.elements; pts.push([e[12], e[14]]); } });
for (const n of G.area.npcs) pts.push([n.pos.x, n.pos.z]);
for (const e of G.combat.enemies) pts.push([e.pos.x, e.pos.z]);
const rows = []; let empty = 0, land = 0;
for (let z = B[2]; z <= B[3]; z += STEP) { let r = String(z).padStart(5) + ' ';
  for (let x = B[0]; x <= B[1]; x += STEP) {
    const g = G.groundOnly(x, z);
    const dx = G.groundOnly(x + 2, z) - g, dz = G.groundOnly(x, z + 2) - g;
    if (g < (window.__floor ?? -25) || Math.hypot(dx, dz) > 2.2) { r += ' '; continue; }
    land++; let near = false; for (const p of pts) if (Math.abs(p[0] - x) < R && Math.abs(p[1] - z) < R && Math.hypot(p[0] - x, p[1] - z) < R) { near = true; break; }
    if (!near) empty++; r += near ? '.' : '#'; }
  rows.push(r); }
return JSON.stringify({ land, empty, pts: pts.length, rows });

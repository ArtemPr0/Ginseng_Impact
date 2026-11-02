// What occupies a spot? window-free: edit SPOTS. Lists every mesh (plain or instanced) whose world box covers it.
const G = window.__ginseng; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); await sleep(1500);
const owner = (o) => { const names = []; for (let p = o; p; p = p.parent) if (p.name) names.push(p.name); return names.slice(0, 3).join(' < ') || o.type; };
const grub = G.area.npcs.find((n) => n.def.id === 'grub');
const SPOTS = [[grub.pos.x + 3, grub.pos.z], [-40, 70], [-10, 70]];
const V = G.camera.position.constructor; const Box = (() => { let B; G.scene.traverse((o) => { if (!B && o.geometry?.boundingBox) B = o.geometry.boundingBox.constructor; }); return B; })();
const m4 = new G.camera.matrixWorld.constructor(); const out = [];
for (const [x, z] of SPOTS) { const hits = {};
  G.scene.traverse((o) => { if (!o.isMesh || !o.geometry) return; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false; if (!vis) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; if (!b || !isFinite(b.min.x)) return;
    const n = owner(o); const test = (m) => { const w = b.clone().applyMatrix4(m); if (w.min.x <= x && w.max.x >= x && w.min.z <= z && w.max.z >= z && w.max.x - w.min.x < 600) { const h = hits[n] ??= { n: 0, box: [w.min.y, w.max.y, w.max.x - w.min.x, w.max.z - w.min.z].map((v) => +v.toFixed(2)) }; h.n++; } };
    if (o.isInstancedMesh) { for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); test(m4); } } else test(o.matrixWorld); });
  out.push({ at: [x, z], g: +G.terrain.heightAt(x, z).toFixed(2), hits }); }
return JSON.stringify(out);

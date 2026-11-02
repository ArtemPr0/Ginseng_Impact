// Audit v2: measured from the DRAWN GROUND, never from colliders (hw.heightAt reads an object's own collider as floor,
// which is how a hovering NPC once passed). Characters' lowest mesh point, and every pair of placed objects whose
// boxes really intersect, instanced ones included.
const G = window.__ginseng; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); await sleep(2500);
const Box = (() => { let B; G.scene.traverse((o) => { if (!B && o.geometry?.boundingBox) B = o.geometry.boundingBox.constructor; if (!B && o.geometry) { o.geometry.computeBoundingBox(); B = o.geometry.boundingBox.constructor; } }); return B; })();
const r2 = (v) => +v.toFixed(2); const out = { chars: [], overlaps: [], low: [] };
const c = G.controller.pos; const R = window.__R ?? 130;
const near = (x, z) => Math.hypot(x - c.x, z - c.z) < R;
for (const n of G.area.npcs) { if (n.def.invisible || !near(n.pos.x, n.pos.z) || !n.object?.visible) continue;
  const b = new Box().setFromObject(n.object, true); if (!isFinite(b.min.y)) continue;
  const g = G.groundOnly(n.pos.x, n.pos.z); const gap = b.min.y - g;
  if (Math.abs(gap) > 0.25) out.chars.push(`${n.def.id} @${r2(n.pos.x)},${r2(n.pos.z)} feet ${r2(b.min.y)} ground ${r2(g)} gap ${r2(gap)}`); }
const items = []; const m4 = new G.camera.matrixWorld.constructor();
const name = (o) => { for (let p = o; p; p = p.parent) { if (/^(realm:|ground)/.test(p.name)) return p.parent ? (o.name || null) && null : null; if (/^(lm:|flora:|enemy)/.test(p.name)) return p.name.replace(/^flora:/, ''); } return null; };
G.scene.traverse((o) => { if (!o.isMesh || !o.geometry) return; for (let p = o; p; p = p.parent) if (!p.visible) return;
  const n = name(o); if (!n || /^(ground|realm:|shock|telegraph|hud|sky|cloud|grass|moon|dome|lm:(castle|cathedral)$)/.test(n) || o.parent?.name?.startsWith('ground') || /^ground/.test(o.name)) return;
  if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; if (!bb || !isFinite(bb.min.x)) return;
  const add = (m) => { const w = bb.clone().applyMatrix4(m); const x = (w.min.x + w.max.x) / 2, z = (w.min.z + w.max.z) / 2; if (near(x, z) && w.max.x - w.min.x < 80) items.push({ n, w, x, z }); };
  if (o.isInstancedMesh) { const k = Math.min(o.count, 800); for (let i = 0; i < k; i++) { o.getMatrixAt(i, m4); m4.premultiply(o.matrixWorld); add(m4); } } else add(o.matrixWorld); });
out.count = items.length;
const floats = {};
for (const it of items) { const g = G.groundOnly(it.x, it.z); const gap = it.w.min.y - g; if (gap > 0.7 && g > -20) { const f = floats[it.n] ??= { n: 0, max: 0, at: '' }; f.n++; if (gap > f.max) { f.max = r2(gap); f.at = `${r2(it.x)},${r2(it.z)}`; } } }
out.low = Object.entries(floats).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `${k}: ${v.n}x up to ${v.max} m @${v.at}`);
const seen = {};
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) { const a = items[i], b = items[j]; if (a.n === b.n && a.n.length && (a.w.max.x - a.w.min.x) < 1) continue; if (!a.w.intersectsBox(b.w)) continue;
  const ix = Math.min(a.w.max.x, b.w.max.x) - Math.max(a.w.min.x, b.w.min.x), iy = Math.min(a.w.max.y, b.w.max.y) - Math.max(a.w.min.y, b.w.min.y), iz = Math.min(a.w.max.z, b.w.max.z) - Math.max(a.w.min.z, b.w.min.z);
  if (ix < 0.5 || iz < 0.5 || iy < 0.3) continue; const k = [a.n, b.n].sort().join(' x '); (seen[k] ??= { n: 0, at: `${r2(a.x)},${r2(a.z)}`, vol: 0 }); seen[k].n++; seen[k].vol = Math.max(seen[k].vol, r2(ix * iy * iz)); }
out.overlaps = Object.entries(seen).sort((a, b) => b[1].vol - a[1].vol).slice(0, 60).map(([k, v]) => `${k}: ${v.n}x, worst ${v.vol} m3 @${v.at}`);
return JSON.stringify(out);

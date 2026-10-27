// Characters (run.mjs body): every mob and NPC whose feet are off or under the surface below it, or whose model is
// drawn floating over or sunk below its feet (NPCs in a realm you are not in keep stale matrices: ignore those).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = window.__ginseng; const hw = G.area.heights;
await sleep(10000);
G.scene.updateMatrixWorld(true);
const V = G.camera.position.constructor; const v = new V();
const bottom = (root) => { let mn = 1e9; root.traverse((o) => { if (!(o.isMesh || o.isSkinnedMesh) || !o.geometry || !o.visible) return; const mt = Array.isArray(o.material) ? o.material[0] : o.material; if (mt?.transparent && mt.depthWrite === false) return; const pa = o.geometry.attributes.position; if (o.isSkinnedMesh) { for (let i = 0; i < pa.count; i += 7) { o.getVertexPosition(i, v); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); mn = Math.min(mn, v.y); } } else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; for (const x of [b.min.x, b.max.x]) for (const z of [b.min.z, b.max.z]) { v.set(x, b.min.y, z).applyMatrix4(o.matrixWorld); mn = Math.min(mn, v.y); } } }); return mn; };
const out = [];
// Only what is drawn in the zone you stand in: an object under a hidden group keeps stale matrices.
const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const check = (id, pos, root, fly, seated) => {
  if (!root || !shown(root)) return;
  const surf = hw.heightAt(pos.x, pos.z, pos.y + 0.5);
  const water = hw.waterAt?.(pos.x, pos.z);
  const gap = pos.y - surf;
  const b = bottom(root) - pos.y;
  const flags = [];
  if (!fly && !seated && gap > 0.25 && !(water !== null && water !== undefined && pos.y < water + 0.5)) flags.push('pos above surface ' + gap.toFixed(2));
  if (gap < -0.3) flags.push('pos below surface ' + gap.toFixed(2));
  if (!fly && !seated && b > 0.25) flags.push('model floats ' + b.toFixed(2));
  if (!seated && b < -0.35) flags.push('model sinks ' + b.toFixed(2));
  if (flags.length) out.push([id, +pos.x.toFixed(1), +pos.y.toFixed(2), +pos.z.toFixed(1), flags.join('; ')]);
};
for (const e of G.combat.enemies) { if (e.dead) continue; check('enemy:' + e.def.kind, e.pos, e.object ?? e.rig?.root ?? e.model?.root, !!e.def.flying, false); }
for (const n of G.area.npcs) { if (n.hidden || n.def.invisible) continue; const b = n.def.behaviour; check('npc:' + n.def.id, n.pos, n.object, false, b.pose === 'sit' || b.kind === 'sit'); }
return JSON.stringify({ n: G.combat.enemies.length + G.area.npcs.length, flagged: out });

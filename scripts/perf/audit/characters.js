// Characters (run.mjs body, any ?at=): every mob and NPC in the zone the hero stands in whose feet are off or under the
// surface below it, whose model is drawn floating over or sunk below its feet, or (seated NPCs) whose hips are not on
// their seat. Only the zone you are in is measured: everything else is hidden and keeps stale matrices.
// Returns { zone, n, flagged: [[id, x, y, z, why]], allowed: [[id, why, reason]] }: `flagged` must be empty.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = window.__ginseng; const hw = G.area.heights;
// Wait for the models to finish streaming in (a loaded machine takes a minute): the scene's mesh count holds for 8 s.
{ let last = -1, same = 0; for (let t = 0; t < 90 && same < 4; t++) { let k = 0; G.scene.traverse((o) => { if (o.isMesh) k++; }); same = k === last ? same + 1 : 0; last = k; await sleep(2000); } }
await sleep(4000);
G.scene.updateMatrixWorld(true);
const zoneAt = (x, z) => (G.realms ?? []).find((r) => Math.hypot(x - r.x, z - r.z) < r.radius)?.id ?? null;
const here = zoneAt(G.controller.pos.x, G.controller.pos.z);
const V = G.camera.position.constructor; const v = new V(), a = new V(), b = new V(), c = new V();
const solid = (o) => { const mt = Array.isArray(o.material) ? o.material[0] : o.material; return !(mt?.transparent && mt.depthWrite === false); };
// The lowest drawn vertex of a body, or null when nothing of it is drawn (a shader body, a model still loading).
const bottom = (root) => {
  let mn = Infinity;
  root.traverse((o) => {
    if (!(o.isMesh || o.isSkinnedMesh) || !o.geometry?.attributes?.position || !solid(o)) return;
    for (let p = o; p && p !== root.parent; p = p.parent) if (!p.visible) return;
    const pa = o.geometry.attributes.position;
    if (o.isSkinnedMesh) { for (let i = 0; i < pa.count; i += 7) { o.getVertexPosition(i, v); o.applyBoneTransform(i, v); v.applyMatrix4(o.matrixWorld); mn = Math.min(mn, v.y); } }
    else { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; for (const x of [bb.min.x, bb.max.x]) for (const z of [bb.min.z, bb.max.z]) { v.set(x, bb.min.y, z).applyMatrix4(o.matrixWorld); mn = Math.min(mn, v.y); } }
  });
  return Number.isFinite(mn) ? mn : null;
};
// The highest drawn surface straight under (x, y, z), skipping `skip`'s subtree and every skinned body: the seat a
// sitter's hips rest on (a barrel, a throne, a settee), the floor or the ground (the collider query) when nothing else.
const statics = [];
G.scene.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh && !o.isInstancedMesh && o.geometry?.attributes?.position && o.geometry.index !== undefined && solid(o)) statics.push(o); });
const shownObj = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
const surfaceUnder = (x, y, z, skip) => {
  let best = hw.heightAt(x, z, y);
  for (const o of statics) {
    if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
    const s = o.geometry.boundingSphere; v.copy(s.center).applyMatrix4(o.matrixWorld);
    const r = s.radius * o.matrixWorld.getMaxScaleOnAxis();
    if (Math.hypot(v.x - x, v.z - z) > r || v.y - r > y || r > 60) continue;
    let mine = false; for (let p = o; p; p = p.parent) if (p === skip) { mine = true; break; }
    if (mine || !shownObj(o)) continue;
    const pa = o.geometry.attributes.position, ix = o.geometry.index; const n = ix ? ix.count : pa.count;
    for (let t = 0; t < n; t += 3) {
      const i0 = ix ? ix.getX(t) : t, i1 = ix ? ix.getX(t + 1) : t + 1, i2 = ix ? ix.getX(t + 2) : t + 2;
      a.fromBufferAttribute(pa, i0).applyMatrix4(o.matrixWorld); b.fromBufferAttribute(pa, i1).applyMatrix4(o.matrixWorld); c.fromBufferAttribute(pa, i2).applyMatrix4(o.matrixWorld);
      const d = (b.z - c.z) * (a.x - c.x) + (c.x - b.x) * (a.z - c.z); if (Math.abs(d) < 1e-9) continue;
      const w0 = ((b.z - c.z) * (x - c.x) + (c.x - b.x) * (z - c.z)) / d, w1 = ((c.z - a.z) * (x - c.x) + (a.x - c.x) * (z - c.z)) / d, w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const hy = w0 * a.y + w1 * b.y + w2 * c.y;
      if (hy <= y + 0.05 && hy > best) best = hy;
    }
  }
  return best;
};
// By design, each with its reason (by kind or id: never a blanket filter). The check named is skipped for it only.
const ALLOW = {
  // The Lurker floats in the shallows at its floatAt (0.6): the lake bed is under the water it rises from.
  'enemy:lurker': { 'pos above': 'floats on the lake shallows (floatAt 0.6)' },
  // The Marsh Sovereign stands knee-deep in its mud basin (filled to 4.9): the mud is drawn over its shins.
  'enemy:marshdemon': { 'model sinks': 'wades its mud basin (the mud surface is over the basin floor)' },
  // The Cyclops wades the eye pool: its feet are under the water on the pool's bed.
  'enemy:cyclops': { 'model sinks': 'wades the eye pool (feet on the bed under the water)' },
};
const out = [], allowed = [];
let n = 0;
const flag = (id, pos, why) => {
  const key = Object.keys(ALLOW[id] ?? {}).find((k) => why.startsWith(k));
  if (key) allowed.push([id, why, ALLOW[id][key]]); else out.push([id, +pos.x.toFixed(1), +pos.y.toFixed(2), +pos.z.toFixed(1), why]);
};
for (const e of G.combat.enemies) {
  if (e.dead) continue;
  const root = e.object ?? e.rig?.root ?? e.model?.root;
  if (!root || !shownObj(root) || zoneAt(e.pos.x, e.pos.z) !== here) continue;
  const bot = bottom(root); if (bot === null) continue; n++;
  const d = e.def, id = 'enemy:' + d.kind, pos = e.pos;
  const ground = Math.max(hw.heightAt(pos.x, pos.z, pos.y + 0.5), d.floatAt ?? -Infinity);
  const water = hw.waterAt?.(pos.x, pos.z);
  if (d.flying) {
    // A flyer may be anywhere over the ground, never in it.
    const under = hw.heightAt(pos.x, pos.z, bot + 0.5);
    if (bot - under < -0.3) flag(id, pos, 'flyer dips into the ground ' + (bot - under).toFixed(2));
    continue;
  }
  if (d.seated && e.spawn?.sitY !== undefined) continue; // (sits on its own seat at sitY: see the enemy's spawn)
  // Feet at the ground plus the registry's hover (a breath of up to a fifth of it).
  const gap = pos.y - ground - (d.hover ?? 0);
  const bob = Math.min(0.25, (d.hover ?? 0) * 0.2) + 0.25;
  const swimming = water !== null && water !== undefined && pos.y < water + 0.5;
  if (gap > bob && !swimming) flag(id, pos, 'pos above surface ' + gap.toFixed(2));
  if (gap < -0.3) flag(id, pos, 'pos below surface ' + gap.toFixed(2));
  const m = bot - pos.y;
  if (m > 0.25) flag(id, pos, 'model floats ' + m.toFixed(2));
  if (m < -0.35) flag(id, pos, 'model sinks ' + m.toFixed(2));
}
const SEATED_POSES = new Set(['sit', 'throne', 'sitSword']);
for (const npc of G.area.npcs) {
  if (npc.hidden || npc.def.invisible) continue;
  const root = npc.object, pos = npc.pos, id = 'npc:' + npc.def.id;
  if (!root || !shownObj(root) || zoneAt(pos.x, pos.z) !== here) continue;
  const bot = bottom(root); if (bot === null) continue; n++;
  const beh = npc.def.behaviour;
  const seated = SEATED_POSES.has(beh.pose) || beh.kind === 'sit' || G.area.seats?.has(npc.def.id);
  const hips = npc.rig.model?.bone?.(/hips$/i);
  if (seated && hips) {
    // Hips on the seat: the pelvis bone sits 0.02-0.35 m over whatever is under it (the buttocks are below the bone).
    const p = hips.getWorldPosition(new V());
    const seat = surfaceUnder(p.x, p.y, p.z, root);
    const g = p.y - seat;
    if (g > 0.35) flag(id, pos, 'hips over the seat ' + g.toFixed(2));
    if (g < 0.02) flag(id, pos, 'hips in the seat ' + g.toFixed(2));
    // The feet on the floor, not through it.
    const floor = hw.heightAt(pos.x, pos.z, bot + 0.3);
    if (bot - floor < -0.35) flag(id, pos, 'model sinks below the floor ' + (bot - floor).toFixed(2));
    continue;
  }
  const surf = hw.heightAt(pos.x, pos.z, pos.y + 0.5);
  const gap = pos.y - surf;
  if (gap > 0.25) flag(id, pos, 'pos above surface ' + gap.toFixed(2));
  if (gap < -0.3) flag(id, pos, 'pos below surface ' + gap.toFixed(2));
  const m = bot - pos.y;
  if (m > 0.25) flag(id, pos, 'model floats ' + m.toFixed(2));
  if (m < -0.35) flag(id, pos, 'model sinks ' + m.toFixed(2));
}
return JSON.stringify({ zone: here ?? 'island', n, flagged: out, allowed });

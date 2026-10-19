// Layout audit (run.mjs body, ?at=0,40): landmarks floating or buried, buildings overlapping (baked grids), flora inside
// buildings or floating, characters inside buildings or water. Each list needs reading: bridges, pinnacles over the
// clouds, lily pads and seated NPCs show up by design; anything else is a bug.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = window.__ginseng;
const W = G.area; const hw = W.heights; const T = G.terrain;
await sleep(9000);
G.scene.updateMatrixWorld(true);
const V = G.camera.position.constructor;
const tmp = new V();
const r1 = (n) => Math.round(n * 10) / 10;
// World bounds of a subtree, skipping hidden descendants (placeholders), sprites, points and lines.
function bounds(root) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; let any = false;
  const visit = (o, top) => {
    if (!top && !o.visible) return;
    if ((o.isMesh || o.isSkinnedMesh) && !o.isInstancedMesh && o.geometry) {
      if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
      const b = o.geometry.boundingBox;
      for (const cx of [b.min.x, b.max.x]) for (const cy of [b.min.y, b.max.y]) for (const cz of [b.min.z, b.max.z]) {
        tmp.set(cx, cy, cz).applyMatrix4(o.matrixWorld);
        mn[0] = Math.min(mn[0], tmp.x); mn[1] = Math.min(mn[1], tmp.y); mn[2] = Math.min(mn[2], tmp.z);
        mx[0] = Math.max(mx[0], tmp.x); mx[1] = Math.max(mx[1], tmp.y); mx[2] = Math.max(mx[2], tmp.z);
        any = true;
      }
    }
    for (const c of o.children) visit(c, false);
  };
  visit(root, true);
  return any ? { mn, mx } : null;
}
// Support: the closest surface under the object's base at its centre and 4 inner points.
function support(b) {
  const cx = (b.mn[0] + b.mx[0]) / 2, cz = (b.mn[2] + b.mx[2]) / 2;
  const ex = (b.mx[0] - b.mn[0]) * 0.3, ez = (b.mx[2] - b.mn[2]) * 0.3;
  const pts = [[cx, cz], [cx - ex, cz - ez], [cx + ex, cz - ez], [cx - ex, cz + ez], [cx + ex, cz + ez]];
  let gap = 1e9, depth = -1e9;
  for (const [x, z] of pts) {
    const g = hw.heightAt(x, z, b.mn[1] + 0.6);
    gap = Math.min(gap, b.mn[1] - g); depth = Math.max(depth, g - b.mn[1]);
  }
  return { gap, depth, cx, cz };
}
const lms = W.landmarks.filter((l) => l.object?.name?.startsWith('lm:'));
// Colliders centred on (x, z) (an object's own trunk, wall box or cap), set aside while measuring what it stands on.
const local = (x, z, r = 0.3) => hw.footprints.filter((f) => f.kind !== 'grid' && Math.hypot(f.x - x, f.z - z) < r);
const without = (fs, fn) => { if (fs.length) hw.remove(...fs); try { return fn(); } finally { if (fs.length) hw.add(...fs); } };
const out = { floating: [], buried: [], overlaps: [], floraIn: {}, charsIn: [], inWater: [], offIsland: [], counts: {} };
const SKY_OK = /^(floating-castle|chained-platform|gem|round-tower|lean-cup$|boat|dragon-riders|giant-crown|floating-island|koi|jellyfish|purple-crystal|whale|moon|giant-skull|castle|palmisland|burning-castle|floating-rock)/;
for (const l of lms) {
  const id = l.object.name.slice(3);
  const b = bounds(l.object); if (!b) continue;
  const h = b.mx[1] - b.mn[1];
  // (Its own colliders out of the way while measuring what it stands on.)
  const own = [...new Set([...l.footprints, ...local(l.object.position.x, l.object.position.z, 0.6)])];
  const s = without(own, () => support(b));
  if (s.gap > 0.35 && !SKY_OK.test(id)) out.floating.push(`${id} @(${r1(s.cx)},${r1(s.cz)}) base ${r1(b.mn[1])} gap ${r1(s.gap)} h ${r1(h)}`);
  if (s.depth > Math.max(1.0, h * 0.3)) out.buried.push(`${id} @(${r1(s.cx)},${r1(s.cz)}) buried ${r1(s.depth)} of ${r1(h)}`);
  const ground = T.heightAt(s.cx, s.cz);
  if (Math.abs(s.cx) < 400 && Math.abs(s.cz) < 400 && ground < -40 && !/mountain|pinnacle|cathedral|spire/.test(id)) out.offIsland.push(`${id} @(${r1(s.cx)},${r1(s.cz)}) over the void`);
}
// Building overlaps from the baked grids (occupied cells of one inside another's).
const grids = [];
for (const l of lms) for (const f of l.footprints) if (f.kind === 'grid') grids.push({ id: l.object.name.slice(3), f });
const cellsOf = (f) => {
  const pts = []; const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
  for (let k = 0; k < f.nz; k++) for (let i = 0; i < f.nx; i++) {
    const ci = k * f.nx + i; if (!(f.data[ci * 3 + 2] > 0)) continue;
    const lx = f.minX + (i + 0.5) * f.cell, lz = f.minZ + (k + 0.5) * f.cell;
    pts.push([f.x + lx * c + lz * s, f.z - lx * s + lz * c, f.cell * f.cell]);
  }
  return pts;
};
const contains = (f, x, z) => {
  const dx = x - f.x, dz = z - f.z; if (dx * dx + dz * dz > f.r * f.r) return false;
  const c = Math.cos(f.rotY), s = Math.sin(f.rotY);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const i = Math.floor((lx - f.minX) / f.cell), k = Math.floor((lz - f.minZ) / f.cell);
  if (i < 0 || k < 0 || i >= f.nx || k >= f.nz) return false;
  return f.data[(k * f.nx + i) * 3 + 2] > 0;
};
for (let a = 0; a < grids.length; a++) {
  const A = grids[a]; const pts = cellsOf(A.f);
  for (let b = a + 1; b < grids.length; b++) {
    const B = grids[b];
    if (Math.hypot(A.f.x - B.f.x, A.f.z - B.f.z) > A.f.r + B.f.r) continue;
    let area = 0; for (const [x, z, ar] of pts) if (contains(B.f, x, z)) area += ar;
    if (area >= 2) out.overlaps.push(`${A.id} @(${r1(A.f.x)},${r1(A.f.z)}) x ${B.id} @(${r1(B.f.x)},${r1(B.f.z)}): ${r1(area)} m2`);
  }
}
// Flora inside buildings, flora floating/buried.
const floraGroups = []; G.scene.traverse((o) => { if (o.name?.startsWith('flora:')) floraGroups.push(o); });
const floraFloat = {};
for (const fg of floraGroups) {
  const id = fg.name.slice(6); const ps = fg.userData.placements ?? [];
  for (const p of ps) {
    for (const g of grids) if (g.id !== id && contains(g.f, p.x, p.z)) { const k = `${id} in ${g.id} @(${r1(g.f.x)},${r1(g.f.z)})`; out.floraIn[k] = (out.floraIn[k] ?? 0) + 1; }
    const gnd = without(local(p.x, p.z), () => hw.heightAt(p.x, p.z, p.y + 0.6));
    if (p.y - gnd > 0.5 && !SKY_OK.test(id)) { const k = id; (floraFloat[k] ??= []).length < 4 && floraFloat[k].push(`(${r1(p.x)},${r1(p.z)}) +${r1(p.y - gnd)}`); floraFloat[k + '#n'] = (floraFloat[k + '#n'] ?? 0) + 1; }
    if (gnd - p.y > 0.8) { const k = id + ' buried'; (floraFloat[k] ??= []).length < 4 && floraFloat[k].push(`(${r1(p.x)},${r1(p.z)}) -${r1(gnd - p.y)}`); floraFloat[k + '#n'] = (floraFloat[k + '#n'] ?? 0) + 1; }
  }
}
out.floraFloat = floraFloat;
// Characters inside buildings or water.
const chars = [...G.combat.enemies.map((e) => ({ id: 'enemy:' + e.def.kind, x: e.pos.x, y: e.pos.y, z: e.pos.z, fly: !!e.def.flying })), ...W.npcs.map((n) => ({ id: 'npc:' + n.def.id, x: n.pos.x, y: n.pos.y, z: n.pos.z, fly: false }))];
for (const c of chars) {
  if (c.fly) continue;
  for (const g of grids) if (contains(g.f, c.x, c.z)) {
    const top = hw.heightAt(c.x, c.z, c.y + 1.5);
    if (Math.abs(top - c.y) > 0.8) out.charsIn.push(`${c.id} (${r1(c.x)},${r1(c.y)},${r1(c.z)}) inside ${g.id} (surface ${r1(top)})`);
  }
}
const WATER_OK = /boat|koi|cyclops|lurker|marshdemon|croc|rivershade|bridge|eye/;
for (const l of lms) { const id = l.object.name.slice(3); if (WATER_OK.test(id)) continue; const b = bounds(l.object); if (!b) continue; const x = (b.mn[0] + b.mx[0]) / 2, z = (b.mn[2] + b.mx[2]) / 2; if (Math.abs(x) < 300 && Math.abs(z) < 300 && W.heights.waterAt(x, z) !== null && b.mn[1] < 0.9) out.inWater.push(`${id} @(${r1(x)},${r1(z)}) base ${r1(b.mn[1])}`); }
for (const c of chars) { if (WATER_OK.test(c.id) || c.fly) continue; if (Math.abs(c.x) < 300 && W.heights.waterAt(c.x, c.z) !== null && c.y < 0.9) out.inWater.push(`${c.id} (${r1(c.x)},${r1(c.z)}) y ${r1(c.y)}`); }
out.counts = { landmarks: lms.length, grids: grids.length, flora: floraGroups.length, chars: chars.length };
window.__layout = { lms: lms.map((l) => { const b = bounds(l.object); return b ? [l.object.name.slice(3), b.mn[0], b.mn[2], b.mx[0], b.mx[2], b.mn[1], b.mx[1]] : null; }).filter(Boolean), chars: chars.map((c) => [c.id, c.x, c.z]) };
return JSON.stringify(out);

// The same for every NPC body and the heroes (run.mjs body): the clips each model carries (only those it plays matter).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = window.__ginseng; const V = G.camera.position.constructor; const v = new V();
await sleep(14000);
const byModel = new Map();
for (const n of G.area.npcs) { const m = n.rig?.model; if (!m || byModel.has(m.id)) continue; byModel.set(m.id, n); }
for (const r of G.rigs ?? []) { const m = r.model; if (m && !byModel.has('hero:' + m.id)) byModel.set('hero:' + m.id, { rig: r, hero: true }); }
const res = {};
for (const [id, n] of byModel) {
  const m = n.rig.model;
  let mesh = null; m.root.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
  if (!mesh) { res[id] = 'static'; continue; }
  if (n.update) n.update = () => {};
  const g = mesh.geometry, P = g.attributes.position, I = g.index; if (!I) { res[id] = 'no index'; continue; }
  const nV = P.count, nT = I.count / 3;
  const bind = new Float32Array(nV * 3); for (let i = 0; i < nV; i++) { v.fromBufferAttribute(P, i); bind[i * 3] = v.x; bind[i * 3 + 1] = v.y; bind[i * 3 + 2] = v.z; }
  const L = (arr, a, b) => Math.hypot(arr[a * 3] - arr[b * 3], arr[a * 3 + 1] - arr[b * 3 + 1], arr[a * 3 + 2] - arr[b * 3 + 2]);
  const bindE = new Float32Array(nT * 3);
  for (let t = 0; t < nT; t++) { const a = I.getX(t * 3), b = I.getX(t * 3 + 1), c = I.getX(t * 3 + 2); bindE[t * 3] = L(bind, a, b); bindE[t * 3 + 1] = L(bind, b, c); bindE[t * 3 + 2] = L(bind, c, a); }
  const cur = new Float32Array(nV * 3); const area = {};
  for (const [name, a] of m.actions) {
    let worstPct = 0;
    for (const f of [0.2, 0.5, 0.8]) {
      m.mixer.stopAllAction(); a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true; a.time = a.getClip().duration * f; m.mixer.update(0);
      m.root.updateWorldMatrix(true, true); mesh.skeleton.update();
      for (let i = 0; i < nV; i++) { v.set(bind[i * 3], bind[i * 3 + 1], bind[i * 3 + 2]); mesh.applyBoneTransform(i, v); cur[i * 3] = v.x; cur[i * 3 + 1] = v.y; cur[i * 3 + 2] = v.z; }
      let tot = 0, bad = 0;
      for (let t = 0; t < nT; t++) { const a1 = I.getX(t * 3), b1 = I.getX(t * 3 + 1), c1 = I.getX(t * 3 + 2); const e1 = L(cur, a1, b1), e2 = L(cur, b1, c1), e3 = L(cur, c1, a1); const r = Math.max(e1 / (bindE[t * 3] + 1e-5), e2 / (bindE[t * 3 + 1] + 1e-5), e3 / (bindE[t * 3 + 2] + 1e-5)); const sp = (e1 + e2 + e3) / 2; const ar = Math.sqrt(Math.max(0, sp * (sp - e1) * (sp - e2) * (sp - e3))); tot += ar; if (r > 4) bad += ar; }
      worstPct = Math.max(worstPct, bad / tot * 100);
    }
    area[name] = +worstPct.toFixed(1);
  }
  const mx = Math.max(0, ...Object.values(area));
  res[id] = { max: +mx.toFixed(1), file: m.id, worst: Object.entries(area).sort((a, b) => b[1] - a[1]).slice(0, 4) };
}
return JSON.stringify(res);

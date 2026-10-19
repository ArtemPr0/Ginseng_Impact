// Skin stretch over every mob (run.mjs body, ?at=0,40): each clip posed at four moments, the share of the surface in
// triangles stretched past 4x their bind size, worst moment per clip. A torn web or fan reads 10-40%; a sound rig
// under 3-5%. window.__kinds limits it. Fix with model-tools cut-triangles (webs between limbs) or smooth-skin.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = window.__ginseng; const V = G.camera.position.constructor; const v = new V();
await sleep(15000);
const kinds = window.__kinds ?? [...new Set(G.combat.enemies.map((e) => e.def.kind))];
const res = {};
for (const KIND of kinds) {
  const e = G.combat.enemies.find((x) => x.def.kind === KIND && x.model);
  if (!e) { res[KIND] = 'no model loaded'; continue; }
  const m = e.model; e.animate = () => {};
  const meshes = []; m.root.traverse((o) => { if (o.isSkinnedMesh) meshes.push(o); });
  if (!meshes.length) { res[KIND] = 'static'; continue; }
  const rep = { tris: 0, area: {} };
  for (const mesh of meshes) {
    const g = mesh.geometry; const P = g.attributes.position; const I = g.index; if (!I) continue;
    const nV = P.count, nT = I.count / 3; rep.tris += nT;
    const bind = new Float32Array(nV * 3); for (let i = 0; i < nV; i++) { bind[i * 3] = P.getX(i); bind[i * 3 + 1] = P.getY(i); bind[i * 3 + 2] = P.getZ(i); }
    const L = (arr, a, b) => Math.hypot(arr[a * 3] - arr[b * 3], arr[a * 3 + 1] - arr[b * 3 + 1], arr[a * 3 + 2] - arr[b * 3 + 2]);
    const bindE = new Float32Array(nT * 3);
    for (let t = 0; t < nT; t++) { const a = I.getX(t * 3), b = I.getX(t * 3 + 1), c = I.getX(t * 3 + 2); bindE[t * 3] = L(bind, a, b); bindE[t * 3 + 1] = L(bind, b, c); bindE[t * 3 + 2] = L(bind, c, a); }
    const worst = new Float32Array(nT); const cur = new Float32Array(nV * 3);
    for (const key of ['attack', 'attack2', 'skill', 'shouting', 'hit', 'run', 'walk', 'idle', 'death', 'special']) {
      const a = m.actions?.get(m.clipName(key)); if (!a) continue;
      let clipWorst = 0;
      for (const f of [0.15, 0.4, 0.65, 0.9]) {
        m.mixer.stopAllAction(); a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true; a.time = a.getClip().duration * f; m.update(0);
        m.root.updateWorldMatrix(true, true); mesh.skeleton.update();
        for (let i = 0; i < nV; i++) { v.set(bind[i * 3], bind[i * 3 + 1], bind[i * 3 + 2]); mesh.applyBoneTransform(i, v); cur[i * 3] = v.x; cur[i * 3 + 1] = v.y; cur[i * 3 + 2] = v.z; }
        let tot = 0, bad = 0;
        for (let t = 0; t < nT; t++) { const a1 = I.getX(t * 3), b1 = I.getX(t * 3 + 1), c1 = I.getX(t * 3 + 2);
          const e1 = L(cur, a1, b1), e2 = L(cur, b1, c1), e3 = L(cur, c1, a1);
          const r = Math.max(e1 / (bindE[t * 3] + 1e-4), e2 / (bindE[t * 3 + 1] + 1e-4), e3 / (bindE[t * 3 + 2] + 1e-4));
          const sp = (e1 + e2 + e3) / 2; const ar = Math.sqrt(Math.max(0, sp * (sp - e1) * (sp - e2) * (sp - e3)));
          tot += ar; if (r > 4) bad += ar; }
        clipWorst = Math.max(clipWorst, bad / tot * 100);
      }
      rep.area[key] = +clipWorst.toFixed(2);
    }
  }
  res[KIND] = rep;
}
return JSON.stringify(res);

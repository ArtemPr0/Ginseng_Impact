// Stretch survey for a skinned mob (run.mjs body): poses every clip at six moments, skins each vertex on the CPU
// (SkinnedMesh.applyBoneTransform) and reports how far triangles stretch versus the bind pose. `webList` = triangles
// joining an arm to the torso (or the two thighs) stretched over 3x: feed it to `model-tools.mjs cut-triangles`.
// Set window.__stretchKind (default 'yeti') first; the enemy must be loaded (spawn near it with ?at=).
const G = window.__ginseng; const V = G.camera.position.constructor;
const KIND = window.__stretchKind ?? 'yeti';
const e = G.combat.enemies.find((x) => x.def.kind === KIND);
if (!e?.model) return 'no ' + KIND + ' with a model here';
const m = e.model; e.animate = () => {};
let mesh = null; m.root.traverse((o) => { if (o.isSkinnedMesh && !mesh) mesh = o; });
const g = mesh.geometry; const P = g.attributes.position; const I = g.index; const SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
const nV = P.count, nT = I.count / 3;
const bind = new Float32Array(nV * 3); for (let i = 0; i < nV; i++) { bind[i * 3] = P.getX(i); bind[i * 3 + 1] = P.getY(i); bind[i * 3 + 2] = P.getZ(i); }
const edgeLen = (arr, a, b) => Math.hypot(arr[a * 3] - arr[b * 3], arr[a * 3 + 1] - arr[b * 3 + 1], arr[a * 3 + 2] - arr[b * 3 + 2]);
const bindE = new Float32Array(nT * 3);
for (let t = 0; t < nT; t++) { const a = I.getX(t * 3), b = I.getX(t * 3 + 1), c = I.getX(t * 3 + 2); bindE[t * 3] = edgeLen(bind, a, b); bindE[t * 3 + 1] = edgeLen(bind, b, c); bindE[t * 3 + 2] = edgeLen(bind, c, a); }
const worst = new Float32Array(nT);
const cur = new Float32Array(nV * 3); const v = new V();
const clips = ['attack', 'shouting', 'hit', 'run', 'walk', 'idle', 'death'];
for (const key of clips) {
  const a = m.actions.get(m.clipName(key)); if (!a) continue;
  for (const f of [0.1, 0.25, 0.4, 0.55, 0.7, 0.85]) {
    m.mixer.stopAllAction(); a.reset(); a.setEffectiveWeight(1); a.play(); a.paused = true; a.time = a.getClip().duration * f; m.update(0);
    m.root.updateWorldMatrix(true, true); mesh.skeleton.update();
    for (let i = 0; i < nV; i++) { v.set(bind[i * 3], bind[i * 3 + 1], bind[i * 3 + 2]); mesh.applyBoneTransform(i, v); cur[i * 3] = v.x; cur[i * 3 + 1] = v.y; cur[i * 3 + 2] = v.z; }
    for (let t = 0; t < nT; t++) { const a1 = I.getX(t * 3), b1 = I.getX(t * 3 + 1), c1 = I.getX(t * 3 + 2); const r = Math.max(edgeLen(cur, a1, b1) / (bindE[t * 3] + 1e-5), edgeLen(cur, b1, c1) / (bindE[t * 3 + 1] + 1e-5), edgeLen(cur, c1, a1) / (bindE[t * 3 + 2] + 1e-5)); if (r > worst[t]) worst[t] = r; }
  }
}
const names = mesh.skeleton.bones.map((b) => b.name.replace(/^mixamorig:?/i, ''));
const dom = (i) => { let top = 0; for (let k = 1; k < 4; k++) if (SW.getComponent(i, k) > SW.getComponent(i, top)) top = k; return names[SI.getComponent(i, top)] + ':' + SW.getComponent(i, top).toFixed(2); };
const bad = []; for (let t = 0; t < nT; t++) if (worst[t] > 3) bad.push(t);
// Group by the bone pairs involved.
const pairs = {};
for (const t of bad) { const vs = [I.getX(t * 3), I.getX(t * 3 + 1), I.getX(t * 3 + 2)].map(dom).map((s) => s.split(':')[0]); const key = [...new Set(vs)].sort().join('+'); pairs[key] = (pairs[key] ?? 0) + 1; }
window.__stretch = { worst: Array.from(worst), bad };
// Web triangles: an arm vertex and a torso vertex in one triangle, stretched over 4x somewhere.
const isArm = (n) => /(Left|Right)(Arm|ForeArm|Hand)/.test(n);
const isTorso = (n) => /^(Hips|Spine\d?)$/.test(n);
const web = [];
for (let t = 0; t < nT; t++) { if (worst[t] <= 3) continue; const vs = [I.getX(t * 3), I.getX(t * 3 + 1), I.getX(t * 3 + 2)].map(dom).map((x) => x.split(':')[0]); if ((vs.some(isArm) && vs.some(isTorso)) || (vs.includes('LeftUpLeg') && vs.includes('RightUpLeg'))) web.push(t); }
window.__web = web;
const hist = [1.5, 2, 3, 5, 10].map((th) => th + ':' + Array.from(worst).filter((x) => x > th).length);
return { web: web.length, webList: web, triangles: nT, over: hist.join(' '), badPairs: Object.entries(pairs).sort((a, b) => b[1] - a[1]).slice(0, 15) };

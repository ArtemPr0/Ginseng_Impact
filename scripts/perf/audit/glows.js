// Floating glows and flames (run.mjs body): every visible glow sprite over 1.2 m above the ground with no solid mesh
// or flora instance within 0.8 m (a torch flame with no torch, a lantern glow in front of a wall). Mist, clouds,
// sky objects and swimming fish come up too: read the list.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = window.__ginseng;
await sleep(9000);
G.scene.updateMatrixWorld(true);
const V = G.camera.position.constructor, M = G.camera.matrixWorld.constructor;
const v = new V(), m = new M();
const CELL = 8; const hash = new Map();
const key = (i, k) => i * 100003 + k;
let nBoxes = 0;
const addBox = (mn, mx, tag) => {
  for (let i = Math.floor(mn[0] / CELL); i <= Math.floor(mx[0] / CELL); i++) for (let k = Math.floor(mn[2] / CELL); k <= Math.floor(mx[2] / CELL); k++) {
    const kk = key(i, k); let l = hash.get(kk); if (!l) hash.set(kk, l = []); l.push([mn, mx, tag]);
  }
  nBoxes++;
};
const boxOf = (geo, mat4) => {
  if (!geo.boundingBox) geo.computeBoundingBox();
  const b = geo.boundingBox; const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) { v.set(x, y, z).applyMatrix4(mat4); mn[0] = Math.min(mn[0], v.x); mn[1] = Math.min(mn[1], v.y); mn[2] = Math.min(mn[2], v.z); mx[0] = Math.max(mx[0], v.x); mx[1] = Math.max(mx[1], v.y); mx[2] = Math.max(mx[2], v.z); }
  return [mn, mx];
};
const isEffect = (o) => { const mt = Array.isArray(o.material) ? o.material[0] : o.material; return !mt || (mt.transparent && mt.depthWrite === false) || mt.blending === 2; };
G.scene.traverse((o) => {
  if (o.isInstancedMesh) {
    if (o === G.area.grass?.mesh || isEffect(o)) return;
    for (let i = 0; i < o.count; i++) { o.getMatrixAt(i, m); m.premultiply(o.matrixWorld); const [mn, mx] = boxOf(o.geometry, m); addBox(mn, mx, o.parent?.name || 'inst'); }
  } else if ((o.isMesh || o.isSkinnedMesh) && o.geometry && !isEffect(o)) {
    const [mn, mx] = boxOf(o.geometry, o.matrixWorld);
    if (mx[0] - mn[0] > 400 || mx[2] - mn[2] > 400) return; // terrain/sky/ocean planes are handled by heightAt
    let n = o, tag = ''; while (n && !tag) { if (n.name) tag = n.name; n = n.parent; }
    addBox(mn, mx, tag || 'mesh');
  }
});
const near = (p, pad) => {
  const l = hash.get(key(Math.floor(p.x / CELL), Math.floor(p.z / CELL))) ?? [];
  for (const [mn, mx] of l) if (p.x > mn[0] - pad && p.x < mx[0] + pad && p.y > mn[1] - pad && p.y < mx[1] + pad && p.z > mn[2] - pad && p.z < mx[2] + pad) return true;
  return false;
};
const hw = G.area.heights;
const out = [];
let n = 0;
G.scene.traverse((o) => {
  if (!o.isSprite) return;
  const mt = o.material; if (!mt.map || mt.opacity <= 0.02) return;
  if (o.userData?.hidden) return;
  // invisible itself (pooled particles)
  if (!o.visible) return;
  o.getWorldPosition(v);
  if (Math.abs(v.x) > 3000 || Math.abs(v.y) > 400) return;
  n++;
  const ground = hw.heightAt(v.x, v.z, v.y + 0.3);
  if (v.y - ground < 1.2) return;
  if (near(v, 0.8)) return;
  let p = o.parent, chain = []; for (let d = 0; p && d < 4; d++, p = p.parent) chain.push(p.name || p.type);
  out.push([+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1), +(v.y - ground).toFixed(1), +o.scale.x.toFixed(2), '#' + mt.color.getHexString(), chain.join('<')]);
});
return JSON.stringify({ boxes: nBoxes, sprites: n, flagged: out.length, list: out });

//#include lib.js
// Gore v13 (2026-11-17): red blood; a rigged mob loses an arm, then its head; a living skeleton loses bones and fights on.
window.__goreKind = 'beast'; await sleep(2000);
const C = G.combat;
const kinds = {};
for (const e of C.enemies) { if (!e.model || kinds[e.def.kind]) continue; kinds[e.def.kind] = C.gore.partsOf(e).map((p) => p.part).join(',') || '-'; }
G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.4;
G.scene.traverse((o) => { if (o.isInstancedMesh && o.parent?.name?.startsWith('flora:')) o.visible = false; });
const cam = G.camera;
for (const el of document.querySelectorAll('body > div')) if (!el.querySelector('canvas')) el.style.visibility = 'hidden';
const SPOT = { x: 24.9, z: 37.6 };
const out = { kinds, frames: {} };
const snap = (name) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const c = document.createElement('canvas'); c.width = 480; c.height = 270;
  c.getContext('2d').drawImage(G.renderer.gl.domElement, 0, 0, 480, 270);
  out.frames[name] = c.toDataURL('image/jpeg', 0.8); r();
})));
const sk = C.enemies.filter((e) => e.def.kind === 'skeleton' && e.alive).sort((a, b) => dist2(a.pos, hero()) - dist2(b.pos, hero()))[0];
if (sk) {
  const p = sk.pos;
  sk.brain.p.aggroRange = 0;
  await tp(SPOT.x + 10, SPOT.z + 10);
  p.x = SPOT.x; p.z = SPOT.z; p.y = G.world.heightAt(p.x, p.z);
  G.tpc.update = () => { cam.position.set(p.x + 2.6, p.y + 1.9, p.z + 2.6); cam.lookAt(p.x, p.y + 0.6, p.z); };
  await sleep(800);
  { const v = sk.object.getWorldPosition(cam.position.clone()); out.probe = { cam: cam.position.toArray().map(Math.round), sk: v.toArray().map(Math.round), ndc: v.clone().project(cam).toArray().map((x) => +x.toFixed(2)), gy: G.world.heightAt(SPOT.x, SPOT.z), vis: sk.object.visible, root: sk.model.root.visible }; }
  await snap('skeleton-before');
  // Alive: blows wear bones off it (v13), and it keeps going.
  for (let i = 0; i < 6; i++) { sk.hp = Math.max(sk.hp, 400); C.hitEnemy(sk, 20, 0.3, null, 0.3, 0.02, { blow: 'heavy', heavy: true }); await sleep(250); }
  out.skeletonAlive = { alive: sk.alive, lost: [...(sk.lost ?? [])], bits: C.gore.sim.pieces.length };
  await snap('skeleton-worn');
  sk.hp = 1;
  C.hitEnemy(sk, 500, 2, null, 2, 0.08, { heavy: true, blow: 'heavy' });
  await sleep(120); await snap('skeleton-0.1s');
  await sleep(700); await snap('skeleton-0.8s');
  await sleep(1800); await snap('skeleton-2.6s');
  out.skeleton = { visible: sk.model.root.visible, bits: C.gore.sim.pieces.length };
}
const arm = C.enemies.filter((e) => e.alive && e.model?.hasClips && C.gore.partsOf(e).length >= 3 && !e.def.boss && !e.def.collapse && (window.__goreKind ? e.def.kind === window.__goreKind : true)).sort((a, b) => dist2(a.pos, hero()) - dist2(b.pos, hero()))[0];
if (arm) {
  const p = arm.pos;
  arm.brain.p.aggroRange = 0;
  p.x = SPOT.x + 0.5; p.z = SPOT.z - 3; p.y = G.world.heightAt(p.x, p.z);
  await sleep(1500);
  const R = 3 + arm.def.height;
  G.tpc.update = () => { cam.position.set(p.x + R * 0.7, p.y + arm.def.height * 0.9, p.z + R * 0.7); cam.lookAt(p.x, p.y + arm.def.height * 0.6, p.z); };
  await sleep(800); await snap('mob-before');
  C.bloodMoon = 5;
  const hand = C.gore.partsOf(arm).find((x) => x.part === 'leftArm');
  C.hitEnemy(arm, 10, 0.1, null, 0.2, 0.02, { at: hand?.at, blow: 'heavy', heavy: true });
  await sleep(150); await snap('mob-arm-0.15s');
  await sleep(900); await snap('mob-arm-1s');
  out.arm = { kind: arm.def.kind, lost: [...arm.lost], lostArms: arm.lostArms, stumps: arm.stumps.length };
  arm.hp = 1;
  C.hitEnemy(arm, 500, 2, null, 2, 0.08, { blow: 'heavy', heavy: true, at: hand.at.clone().set(p.x, p.y + arm.def.height, p.z) });
  await sleep(200); await snap('mob-head-0.2s');
  await sleep(1200); await snap('mob-head-1.4s');
  out.head = { lost: [...arm.lost], alive: arm.alive };
}
out.errors = consoleErrors.slice(0, 5);
return out;

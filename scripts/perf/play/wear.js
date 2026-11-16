//#include lib.js
// Wear (2026-11-16): a mob loses a hand at 70 %, an arm at 45 %, stoops below 30 %; Wren's arrows stay stuck in it.
await sleep(2000);
const THREE_V = G.camera.position.constructor;
const C = G.combat;
G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.4;
G.scene.traverse((o) => { if (o.isInstancedMesh && o.parent?.name?.startsWith('flora:')) o.visible = false; });
const cam = G.camera;
for (const el of document.querySelectorAll('body > div')) if (!el.querySelector('canvas')) el.style.visibility = 'hidden';
const SPOT = { x: 24.9, z: 37.6 };
const out = {};
if (window.__wearKind) {
  const any = C.enemies.find((e) => e.def.kind === window.__wearKind && e.alive);
  if (any) { await tp(any.pos.x + 6, any.pos.z + 6); for (let i = 0; i < 30 && !any.model?.hasClips; i++) await sleep(500); }
}
const mob = C.enemies.filter((e) => e.alive && e.model?.hasClips && C.gore.partsOf(e).length >= 5 && !e.def.boss && !e.def.collapse && (window.__wearKind ? e.def.kind === window.__wearKind : true)).sort((a, b) => dist2(a.pos, hero()) - dist2(b.pos, hero()))[0];
if (mob) {
  const p = mob.pos;
  mob.brain.p.aggroRange = 0;
  await tp(p.x + 10, p.z + 10);
  await sleep(1200);
  const h = mob.def.height * (mob.def.scale ?? 1), R = 1.6 + h;
  const o = new THREE_V();
  G.tpc.update = () => { mob.object.getWorldPosition(o); cam.position.set(o.x + R * 0.75, o.y + h * 0.75, o.z + R * 0.75); cam.lookAt(o.x, o.y + h * 0.55, o.z); };
  await sleep(600); await shot('wear-full');
  const max = mob.def.maxHp * mob.hpScale;
  // Just above the mark, then a small blow (no crit: Math.random pinned) past it.
  const blow = (to) => { mob.hp = max * (to + 0.06); const r = Math.random; Math.random = () => 0.99; C.hitEnemy(mob, max * 0.5, 1, null, 0.1, 0.02, { blow: 'light', at: new THREE_V(p.x + 0.3, p.y + h * 0.6, p.z + 0.3) }); Math.random = r; mob.hp = Math.max(1, Math.min(mob.hp, max * to)); };
  out.parts = C.gore.partsOf(mob).map((x) => x.part);
  blow(0.66); await sleep(900); await shot('wear-66');
  out.at66 = [...mob.lost];
  blow(0.42); await sleep(900); await shot('wear-42');
  out.at42 = [...mob.lost];
  mob.hp = max * 0.12; await sleep(1500); await shot('wear-12');
  out.at12 = { lost: [...mob.lost], pace: mob.pace, alive: mob.alive };
  // Arrows from round it.
  for (let i = 0; i < 7; i++) {
    const a = i * 0.9, from = new THREE_V(p.x + Math.cos(a) * 8, p.y + h * (0.35 + 0.08 * i), p.z + Math.sin(a) * 8);
    const vel = new THREE_V(p.x - from.x, 0, p.z - from.z).normalize().multiplyScalar(26);
    C.lodgeArrow(mob, from.clone().addScaledVector(vel, (8 - mob.def.bodyRadius) / 26), vel);
  }
  out.stuck = C.stuck.count(mob.id);
  await sleep(1500); await shot('wear-arrows');
  G.tpc.update = () => { mob.object.getWorldPosition(o); cam.position.set(o.x - R * 0.75, o.y + h * 0.75, o.z - R * 0.4); cam.lookAt(o.x, o.y + h * 0.55, o.z); };
  await sleep(800); await shot('wear-arrows-back');
  out.kind = mob.def.kind;
}
out.errors = consoleErrors.slice(0, 5);
return JSON.stringify(out);

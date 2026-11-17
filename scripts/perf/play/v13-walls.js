//#include lib.js
// v13: close-ups of the earth wall (Stone Wall) and the ice wall made from the reel models, at the game's own light
// and with a studio light (shapes).
await sleep(3000);
const C = G.combat, cam = G.camera;
for (const e of C.enemies) if (e.brain) e.brain.p.aggroRange = 0;
const out = { frames: {} };
const snap = (name) => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const k = document.createElement('canvas'); k.width = 480; k.height = 270;
  k.getContext('2d').drawImage(G.renderer.gl.domElement, 0, 0, 480, 270);
  out.frames[name] = k.toDataURL('image/jpeg', 0.8); r();
})));
G.scene.traverse((o) => { if (o.isInstancedMesh && o !== G.area.grass?.mesh && !/spike|ice|chunk|stone|explosion|fire/i.test(o.name)) o.visible = false; });
const Light = G.scene.children.find((o) => o.isHemisphereLight)?.constructor;
for (const [who, i, id] of [['knight', 0, 4], ['archer', 1, 10]]) {
  await hero_(i);
  await tp(60, 30, undefined, 60, 40); await sleep(400);
  const p = hero();
  const aim = cam.position.clone().set(p.x, 0, p.z + 7); aim.y = G.world.heightAt(aim.x, aim.z, 200);
  C.caster.cast(who, id, aim);
  G.tpc.update = () => { cam.position.set(aim.x + 1, aim.y + 2.0, aim.z - 5.5); cam.lookAt(aim.x, aim.y + 1.3, aim.z); };
  await sleep(1500);
  await snap(`${who}-game`);
  let l = null;
  if (Light) { l = new Light(0xffffff, 0x8888aa, 3.4); G.scene.add(l); }
  const fog = G.scene.fog; G.scene.fog = null;
  await snap(`${who}-lit`);
  if (l) l.removeFromParent(); G.scene.fog = fog;
  delete G.tpc.update;
  await sleep(9000);
}
return out;

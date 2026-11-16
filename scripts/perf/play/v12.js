//#include lib.js
// v12 (2026-11-16): each new spell cast at a real building — the sky black hole, both tornadoes, the stone wall and its
// kick, Earthsplitter's slabs, a fireball's explosion and fires — logging what broke, how many blocks, what rose, and
// screenshots along the way.
await sleep(3000);
const C = G.combat, B = G.area.breakables;
for (const e of C.enemies) if (e.brain) e.brain.p.aggroRange = 0;
const SPELL = (window.__v12 ?? new URLSearchParams(location.search).get('v12') ?? 'black-hole');
const houses = B.entries.filter((b) => b.state === 'intact' && b.target.size >= 5 && b.target.size <= 14 && !b.target.tree)
  .sort((a, b) => Math.hypot(a.x, a.z - 40) - Math.hypot(b.x, b.z - 40));
const b = houses[0];
const out = { spell: SPELL, house: b && { id: b.target.id, size: b.target.size, x: +b.x.toFixed(1), z: +b.z.toFixed(1) } };
if (!b) return { ...out, err: 'no house' };
const gy = G.world.heightAt(b.x, b.z, 200);
const from = { x: b.x - (SPELL === 'gale-shot' || SPELL === 'wrecking-charge' ? 6 : 16), z: b.z };
await tp(from.x, from.z, undefined, b.x, b.z);
face(b.x, b.z);
await sleep(600);
const HERO = { knight: 0, archer: 1, wizard: 2 };
const which = { 'black-hole': ['wizard', 1], 'fire-tornado': ['wizard', 2], fireball: ['wizard', 0], 'storm-tornado': ['archer', 4], 'stone-wall': ['knight', 4], earthsplitter: ['knight', 0], 'gale-shot': ['archer', 3], 'storm-arrow': ['archer', 2], 'wrecking-charge': ['knight', 1], overgrowth: ['wizard', 3] }[SPELL];
await hero_(HERO[which[0]]);
await tp(from.x, from.z, undefined, b.x, b.z); face(b.x, b.z); await sleep(400);
const aim = G.camera.position.clone().set(b.x, gy, b.z);
if (SPELL === 'stone-wall') { aim.set(from.x + 7, G.world.heightAt(from.x + 7, from.z, 200), from.z); }
// A side-on camera: the house, the sky over it and the hero all in frame.
const cam = G.camera;
const look = SPELL === 'stone-wall' ? { x: from.x + 7, z: from.z } : { x: b.x - 3, z: b.z };
const back = SPELL === 'stone-wall' ? 9 : 24;
const wy = SPELL === 'stone-wall' ? aim.y : gy;
if (SPELL === 'stone-wall') G.scene.traverse((o) => { if (o.isInstancedMesh && o !== G.area.grass?.mesh && o.name !== 'ground-fires') o.visible = false; });
G.tpc.update = () => { cam.position.set(look.x - 5, wy + (SPELL === 'stone-wall' ? 3 : 5), look.z + back); cam.lookAt(look.x, wy + (SPELL === 'stone-wall' ? 1.5 : 7), look.z); };
await sleep(800);
await shot('before');
C.caster.cast(which[0], which[1], aim);
const log = [];
let maxY = 0;
const t0 = performance.now();
const FAST = SPELL === 'fireball';
for (let k = 0; k < 14; k++) {
  await sleep(FAST && k < 4 ? 150 : 500);
  for (const p of B.sim.pieces) maxY = Math.max(maxY, p.y - gy);
  log.push({ t: +((performance.now() - t0) / 1000).toFixed(1), state: b.state, standing: b.chunks.filter((c) => c.standing).length, of: b.chunks.length, pieces: B.sim.pieces.length, fires: C.caster.fires.live, puffs: C.caster.explosions.live, wall: C.caster.wallUp() });
  if (k === 1 || k === 3 || k === 6 || k === 9) await shot(`t${k}`);
  if (SPELL === 'stone-wall' && k === 5) { C.caster.kickWall(); await sleep(150); await shot('kick'); }
}
out.maxPieceY = +maxY.toFixed(1);
out.log = log;
out.errors = consoleErrors.slice(0, 8);
return out;

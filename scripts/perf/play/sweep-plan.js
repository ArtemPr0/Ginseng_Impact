//#include lib.js
// The plan's last features, used as a player uses them.
await sleep(1500);
const out = {}; const inv = G.inventory;
// Charm slot: the satchel's Wear button, and only the wearer gets it.
inv.add('lunar-charm', 1);
await press('KeyI', 60); await sleep(300);
let b = [...document.querySelectorAll('#hud-dialog button[data-act="charm"]')][0];
if (!b) fail('no Wear button'); else { b.click(); await sleep(200); }
const me = G.party.active.id;
const worn = inv.charmOf(me);
out.charm = { worn: worn?.itemId, mult: inv.damageMult(me), other: inv.damageMult(me === 'knight' ? 'archer' : 'knight'), tag: /worn by/.test(document.querySelector('#hud-dialog').textContent) };
if (!(out.charm.mult > 1) || out.charm.other !== 1 || !out.charm.tag) fail('charm slot', out.charm);
await press('KeyI', 60); await sleep(200); if (panelOpen()) await escape();
// Weapon glow.
const rig = G.rigs[0]; rig.setWeaponGlow(0x37f5ff);
let lit = 0; rig.root.traverse((o) => { if (o.isMesh && o.material?.emissiveIntensity === 0.6) lit++; });
out.glow = lit; if (!lit) fail('weapon glow lit nothing');
// Head turn: a standing NPC, the hero off to its side.
const n = G.area.npcs.find((x) => !x.def.invisible && x.def.behaviour.kind === 'stand' && !x.def.behaviour.pose && x.pos.y < 40 && Math.hypot(x.pos.x, x.pos.z) < 120);
const a = n.yaw + 1; await tp(n.pos.x + Math.cos(a) * 5, n.pos.z + Math.sin(a) * 5, n.pos.y + 2); await sleep(1500);
out.look = { id: n.def.id, now: +n.lookNow?.toFixed?.(2) };
// Step back: a swing beside it.
await tp(n.pos.x + 1.4, n.pos.z, n.pos.y + 2, n.pos.x, n.pos.z); await sleep(200);
await clickMouse(0, 40); await sleep(500);
const moved = Math.hypot(n.object.position.x - n.pos.x, n.object.position.z - n.pos.z);
out.startle = +moved.toFixed(2); if (moved < 0.3) fail('NPC did not step back', out);
await sleep(2200);
out.back = +Math.hypot(n.object.position.x - n.pos.x, n.object.position.z - n.pos.z).toFixed(2);
if (out.back > 0.05) fail('NPC did not come home', out);
await shot?.('compass');
return report(out);

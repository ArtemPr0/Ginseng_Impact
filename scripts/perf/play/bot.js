// A player bot: walks to the nearest hostile, fights it with the real controls (LMB, held RMB, E, Q, R), and logs the
// reward cadence (kills, XP, levels, drops picked, callouts, words) and every hit it takes, wipe and console error.
// BOT_S (window.__botS) wall seconds, default 150. Stays within BOT_R m of where it started (window.__botR, default 70).
//#include lib.js
const S = window.__botS ?? 150;
const R = window.__botR ?? 70;
const t0 = performance.now();
const now = () => +((performance.now() - t0) / 1000).toFixed(1);
const log = [];
const ev = (k, d = {}) => log.push({ t: now(), k, ...d });
const home = { x: hero().x, z: hero().z };

// Taps on what the player sees and hears.
for (const m of ['hype', 'announce', 'bonk']) {
  const orig = G.hud[m].bind(G.hud);
  G.hud[m] = (...a) => { ev(m, { text: String(m === 'bonk' ? a[2] : a[0]).slice(0, 40) }); return orig(...a); };
}
G.events.on?.('pickup', (e) => ev('pickup', { what: e.item ?? e.what }));
const pickups = [];
for (const k of ['pickup', 'loot', 'chest', 'feat', 'kill', 'quest', 'trade']) G.events.on?.(k, (e) => { if (k !== 'kill') pickups.push(k); ev('event:' + k, { d: JSON.stringify(e).slice(0, 80) }); });

const me = () => G.party.active;
const myHp = () => G.combat.hp.get(me().id);
let lastHp = myHp();
const inv0 = JSON.stringify(G.inventory.snapshot?.() ?? {}).length;
const lvl0 = G.progress.level;
let kills = 0, stuckT = 0, lastPos = { ...hero() }, target = null, tLock = 0, skipped = new Set();

const hostile = (e) => e.alive && (window.__botKind ? e.def.kind === window.__botKind : !aquatic?.has(e.def.kind) && !e.def.passive && !e.def.boss) && !skipped.has(e) && Math.hypot(e.pos.x - home.x, e.pos.z - home.z) < R;
function pick() {
  let best = null, bd = 1e9;
  for (const e of G.combat.enemies) {
    if (!hostile(e)) continue;
    const d = dist2(e.pos, hero());
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

const lootSkip = new Set();
let nextSkill = 0, nextBurst = 0, heavyEvery = 0, nextPos = 0;
const shards0 = G.inventory.shards;
const aquatic = window.__botDry ? new Set(['croc', 'lurker', 'koi', 'rivershade', 'jellyfish', 'cyclops', 'octopus']) : new Set();
while (performance.now() - t0 < S * 1000) {
  const hp = myHp();
  if (now() > nextPos) { nextPos = now() + (window.__botEvery ?? 5); const p = hero(); ev('pos', { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1), mode: G.controller.mode, tgt: target ? [+target.pos.x.toFixed(1), +target.pos.y.toFixed(1), +target.pos.z.toFixed(1), target.brain?.state, +target.hp.toFixed(0)] : null, shards: G.inventory.shards, loot: G.combat.loot?.pickups?.length }); }
  if (hp < lastHp - 0.5) ev('hurt', { by: +(lastHp - hp).toFixed(0), hp: +hp.toFixed(0) });
  lastHp = hp;
  // Loot on the ground: walk to it and press F, as a player does.
  const near = G.combat.loot?.pickups?.filter((p) => p.drop.kind === "item" && p.landed && !lootSkip.has(p) && dist2(p.pos, hero()) < 14) ?? [];
  if (near.length) {
    const p = near[0];
    face(p.pos.x, p.pos.z);
    if (dist2(p.pos, hero()) > 1.2) { keyDown('KeyW'); await sleep(250); continue; }
    keyUp('KeyW');
    ev('f-loot', { item: p.drop.itemId, prompt: G.interactTarget?.()?.label ?? null });
    await press('KeyF', 60);
    await sleep(200);
    if (G.combat.loot.pickups.includes(p)) { ev('loot-stuck', { item: p.drop.itemId }); lootSkip.add(p); }
    continue;
  }
  if (!target || !target.alive) {
    if (target && !target.alive) { kills++; ev('kill', { kind: target.def.kind }); }
    target = pick(); tLock = now();
    if (!target) { ev('none-left'); break; }
    ev('target', { kind: target.def.kind, d: +dist2(target.pos, hero()).toFixed(1) });
  }
  if (now() - tLock > 40) { ev('gave-up', { kind: target.def.kind, hp: +target.hp.toFixed(0) }); skipped.add(target); target = null; keyUp('KeyW'); continue; }
  face(target.pos.x, target.pos.z);
  const d = dist2(target.pos, hero());
  const reach = 2.2 + (target.def.bodyRadius ?? 0.6);
  if (d > reach) {
    keyDown('KeyW');
    if (d > 12) keyDown('ShiftLeft'); else keyUp('ShiftLeft');
    // Stuck: jump, then strafe.
    if (dist2(hero(), lastPos) < 0.2) stuckT += 0.25; else stuckT = 0;
    if (stuckT > 1.5) { await press('Space', 80); keyDown('KeyD'); await sleep(400); keyUp('KeyD'); }
    if (stuckT > 6) { ev('stuck', { kind: target.def.kind, d: +d.toFixed(1) }); skipped.add(target); target = null; stuckT = 0; }
  } else {
    keyUp('KeyW'); keyUp('ShiftLeft');
    if (now() > nextSkill) { await press('KeyE', 60); nextSkill = now() + 3; }
    else if (now() > nextBurst) { await press('KeyQ', 60); nextBurst = now() + 8; }
    else if (++heavyEvery % 6 === 0) { mouseDown(2); await sleep(900); mouseUp(2); }
    else await clickMouse(0, 40);
    if (myHp() < 0.3 * G.combat.maxOf(me())) await press('KeyR', 60);
  }
  lastPos = { ...hero() };
  await sleep(250);
}
for (const k of ['KeyW', 'ShiftLeft', 'KeyD']) keyUp(k);
const count = (k) => log.filter((e) => e.k === k).length;
const rewards = log.filter((e) => ['kill', 'hype', 'event:pickup', 'event:loot', 'event:chest', 'event:feat'].includes(e.k)).map((e) => e.t);
let maxGap = 0; for (let i = 1; i < rewards.length; i++) maxGap = Math.max(maxGap, rewards[i] - rewards[i - 1]);
return JSON.stringify({
  ok: consoleErrors.length === 0, seconds: now(), kills, shards: [shards0, G.inventory.shards], levels: [lvl0, G.progress.level], xp: G.progress.xp,
  hurts: count('hurt'), hype: count('hype'), words: count('bonk'), announce: count('announce'), events: [...new Set(pickups)],
  maxRewardGapS: +maxGap.toFixed(1), errors: consoleErrors.slice(0, 8),
  log: log.filter((e) => e.k !== 'bonk').slice(0, 140),
});

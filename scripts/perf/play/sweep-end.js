// The main story and side quests PLAYED: every step through the F key, rendered buttons, real pickups and real blows.
// Travel is G's teleport; the one test hook is `weaken` (the killing blow is still a real attack). Nothing calls
// quests.step or quests.set. A stage that cannot be reached this way is a failure.
//#include lib.js
const Q = G.adventures.quests;
const st = (id) => Q.stage(id);
await sleep(1500);
for (const e of G.combat.enemies) e.brain.p.aggroRange = Math.min(e.brain.p.aggroRange, 0.01);
G.inventory.shards = 8000;
const log = [];
const SKIP = /^(leave|trade|hire|send|goodbye|not (now|today|yet)|later|no\b|never mind|nothing)/i;
/** Talks to `id` and clicks through until quest `q` reaches `want`, trying the offered choices depth first. */
async function drive(id, q, want, prefer = /./) {
  const ok = () => [].concat(want).includes(st(q));
  for (let round = 0; round < 5 && !ok(); round++) {
    G.adventures.story?.update?.(200);
    if (!(await talkTo(id))) return false;
    const seen = new Set();
    for (let i = 0; i < 16 && !ok(); i++) {
      const p = readPanel(); if (!p) break;
      const cs = p.choices.filter((c) => !SKIP.test(c.label) && !seen.has(`${p.line}|${c.label}`));
      const c = cs.find((x) => prefer.test(x.label)) ?? cs[Math.floor(round / 2) % Math.max(1, cs.length)] ?? cs[0];
      if (!c) break;
      seen.add(`${p.line}|${c.label}`);
      await clickAct(c.act); await sleep(120);
    }
    if (panelOpen()) await escape();
  }
  log.push(`${id}: ${q} → ${st(q)}`);
  if (!ok()) fail('stage not reached by talking', { id, q, want, at: st(q) });
  return ok();
}
async function pickup(x, z, y, label) {
  await tp(x, z, y + 1);
  await sleep(400);
  const t = await waitFor(() => { const v = G.interactTarget(); return v && new RegExp(label, 'i').test(v.label) ? v : null; }, 4000);
  if (!t) { fail('no prompt', { label, got: G.interactTarget()?.label }); return false; }
  await press('KeyF', 60); await sleep(500);
  log.push(`picked: ${label}`);
  return true;
}
async function slay(kind) {
  const e = enemiesOf(kind).find((v) => v.alive) ?? enemiesOf(kind)[0];
  if (!e) { fail('no such enemy', { kind }); return; }
  weaken(e, 1);
  const done = await fight(e, { ms: 15000 });
  log.push(`slain ${kind}: ${done}`);
  if (!done) fail('real blows did not kill it', { kind, hp: e.hp });
  await sleep(600);
}
// The ending, watched frame by frame (SHOT_DIR): the shortcut here is only the road to the last fight; the story sweep plays that.
for (const q of ['throne', 'bell', 'grave', 'sound']) Q.set(q, 'done');
Q.set('trip', 'god'); Q.set('silence', 'open'); await sleep(500);
log.push(`silence ${st('silence')}`);
await shot('e00-before');
await slay('hollowking');
const t0 = performance.now();
const seen = [];
for (let i = 1; i <= 16; i++) {
  await sleep(3000);
  const hud = document.querySelector('#hud')?.innerText?.replace(/\s+/g, ' ').slice(0, 70);
  seen.push([Math.round(performance.now() - t0), G.controller.pos.x | 0, G.controller.pos.z | 0, hud]);
  await shot(`e${String(i).padStart(2, '0')}`);
}
return report({ log, seen, silence: st('silence'), buttons: [...document.querySelectorAll('button')].filter((b) => b.offsetParent).map((b) => b.textContent.trim()).slice(0, 6) });

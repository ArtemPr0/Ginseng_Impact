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
await drive('stone-head', 'silence', 'told');
await drive('king', 'throne', 'active');
await slay('warden');
if (st('throne') !== 'slain') fail('warden kill did not move throne', { at: st('throne') });
await drive('king', 'throne', 'done');
await drive('frogking', 'croak', 'active');
await drive('croak', 'croak', 'bagged');
const fk = npc('frogking');
await tp(fk.pos.x + 2, fk.pos.z + 2, fk.pos.y + 1); await sleep(400);
let drop = G.interactTarget(); log.push(`at frog: ${drop?.label}`);
await press('KeyF', 60); await sleep(800); if (panelOpen()) await escape();
if (st('croak') !== 'returned') { await tp(fk.pos.x + 1, fk.pos.z - 2, fk.pos.y + 1); await sleep(300); log.push(`retry: ${G.interactTarget()?.label}`); await press('KeyF', 60); await sleep(600); }
await drive('frogking', 'trip', 'none', /lick/i);
await drive('frogking', 'croak', 'done', /lick/i);
if (!(G.adventures.dreamLeft > 0)) { await talkTo('frogking'); const p = readPanel(); log.push(`frog offers: ${p?.choices.map((c) => c.label)}`); await clickLabel('*lick*'); await sleep(600); if (panelOpen()) await escape(); }
log.push(`dreamLeft ${G.adventures.dreamLeft}`);
await sleep(1500);
await slay('dmt-entity');
G.adventures.wake(); await sleep(1500);
log.push(`trip ${st('trip')}`);
await drive('brother', 'lean', 'active');
await drive('yunglean', 'sound', 'active');
const cupSpot = G.area.interactables.find((i) => /lost sound/i.test(i.label?.() ?? ''));
if (!cupSpot) fail('lost sound not offered'); else await pickup(cupSpot.pos.x, cupSpot.pos.z, cupSpot.pos.y, 'lost sound');
await drive('yunglean', 'sound', 'done');
await drive('yunglean', 'lean', 'signed');
await drive('brother', 'lean', 'done');
await drive('fish-king', 'bell', 'active');
await slay('angler'); await slay('angler');
await pickup(-1000, -92, -48, 'Drowned Bell');
if (st('bell') !== 'found') fail('the bell pickup did not move the quest', { at: st('bell') });
await drive('fish-king', 'bell', 'done');
await drive('skeleton-king', 'grave', 'active');
await slay('cyclops-lord');
await drive('skeleton-king', 'grave', 'done');
log.push(`trip ${st('trip')} throne ${st('throne')} sound ${st('sound')} bell ${st('bell')} grave ${st('grave')} silence ${st('silence')}`);
await drive('stone-head', 'silence', 'open');
await slay('hollowking');
await sleep(1500);
if (st('silence') !== 'ended') fail('the Hollow King\'s death did not end it', { at: st('silence') });
// Side quests.
await drive('vale-beggar', 'penny', 'done');
await drive('crypt-red', 'books', 'active');
await drive('dragon-reader', 'books', 'done');
await drive('rose-knight', 'rose', ['asked', 'worthy', 'answered']);
await drive('maiden', 'rose', 'answered');
await drive('bride', 'bride', 'walking');
const b = npc('bride'); log.push(`bride at ${b.pos.x.toFixed(1)},${b.pos.z.toFixed(1)}`);
await waitFor(() => st('bride') === 'done', 45000, 250);
if (st('bride') !== 'done') fail('the bride never reached the shore', { at: [b.pos.x, b.pos.z], stage: st('bride') });
return report({ log, stages: Object.fromEntries(['silence','throne','croak','trip','crown','lean','sound','bell','grave','penny','books','rose','bride'].map((q) => [q, st(q)])) });

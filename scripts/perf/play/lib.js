// Shared helpers for the play sweeps (inlined by run.mjs through `//#include lib.js`). Everything here PLAYS: keys and
// mouse are dispatched as the browser would (the game reads them through Input), F goes through the game's own
// interactTarget/pressF path, dialogue choices are clicked on the rendered #hud-dialog buttons. The only shortcuts are
// travel (G.teleport, the game's own move) and `weaken` (an enemy put at low HP, the documented test hook: the killing
// blow is still a real attack).
const G = window.__ginseng;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const notes = [];
const fail = (what, detail = {}) => { failures.push({ what, ...detail }); };
const note = (what, detail = {}) => { notes.push({ what, ...detail }); };

/** Waits until `cond()` is truthy (returns its value) or `ms` passes (returns null). */
async function waitFor(cond, ms = 5000, every = 50) {
  const t0 = performance.now();
  for (;;) {
    let v = null;
    try { v = cond(); } catch { v = null; }
    if (v) return v;
    if (performance.now() - t0 > ms) return null;
    await sleep(every);
  }
}
/** Game frames: resolves after `n` requestAnimationFrame ticks (the game steps in rAF). */
const frames = (n = 2) => new Promise((r) => { let k = 0; const f = () => (++k >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });

// ---- input, as the browser delivers it ------------------------------------------------------------------------------
function keyDown(code) { window.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true })); }
function keyUp(code) { window.dispatchEvent(new KeyboardEvent('keyup', { code, key: code, bubbles: true })); }
/** A key pressed and held `ms` (at least two game frames so the fixed step sees the press). */
async function press(code, ms = 120) { keyDown(code); await frames(2); await sleep(ms); keyUp(code); await frames(1); }
const canvas = () => G.renderer.gl.domElement;
function mouseDown(button = 0) { canvas().dispatchEvent(new MouseEvent('mousedown', { button, bubbles: true })); }
function mouseUp(button = 0) { window.dispatchEvent(new MouseEvent('mouseup', { button, bubbles: true })); }
async function clickMouse(button = 0, ms = 60) { mouseDown(button); await frames(2); await sleep(ms); mouseUp(button); await frames(1); }

// ---- the hero -----------------------------------------------------------------------------------------------------
const hero = () => G.controller.pos;
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
/** The game's own move (portal/door teleport) to (x, z), on the ground there (`y` a hint for floors and realms). */
async function tp(x, z, y, faceX, faceZ) {
  const gy = G.world.heightAt(x, z, y ?? 200);
  const yaw = faceX === undefined ? G.controller.yaw : Math.atan2(faceZ - z, faceX - x);
  G.teleport(x, gy, z, yaw);
  await frames(4);
  await sleep(150);
}
/** Turns the hero (and the camera behind him) to face (x, z). */
function face(x, z) {
  const p = hero();
  const yaw = Math.atan2(z - p.z, x - p.x);
  G.controller.yaw = yaw;
  G.tpc.yaw = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
}
function zoneAt(x, z) {
  const r = (G.area.realms ?? []);
  void r;
  return null;
}

// ---- screenshots (run.mjs saves them into SHOT_DIR) -----------------------------------------------------------------
const shotWaits = new Map();
window.__shotDone = (token, path) => { const w = shotWaits.get(token); if (w) { shotWaits.delete(token); w(path); } };
let shotN = 0;
const shots = [];
async function shot(name) {
  if (typeof window.__cdpShot !== 'function') return null;
  const token = `${Date.now()}-${++shotN}`;
  const done = new Promise((r) => { shotWaits.set(token, r); setTimeout(() => { if (shotWaits.delete(token)) r(null); }, 25000); });
  window.__cdpShot(JSON.stringify({ name: `${String(shotN).padStart(3, '0')}-${name}`, token }));
  const p = await done;
  if (p) shots.push(p);
  return p;
}

// ---- console errors raised while the body runs ------------------------------------------------------------------------
const consoleErrors = [];
{
  const orig = console.error.bind(console);
  console.error = (...a) => { consoleErrors.push(a.map(String).join(' ').slice(0, 300)); orig(...a); };
  window.addEventListener('error', (e) => consoleErrors.push(`uncaught: ${e.message}`));
  window.addEventListener('unhandledrejection', (e) => consoleErrors.push(`rejection: ${e.reason?.message ?? e.reason}`));
}

// ---- the dialogue panel, as rendered --------------------------------------------------------------------------------
const panelEl = () => document.querySelector('#hud-dialog');
const panelOpen = () => { const el = panelEl(); return !!el && el.style.display !== 'none' && getComputedStyle(el).display !== 'none'; };
function readPanel() {
  const el = panelEl();
  if (!el || !panelOpen()) return null;
  const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  return {
    name: clean(el.querySelector('.dlg-name')?.textContent),
    title: clean(el.querySelector('.dlg-title')?.textContent),
    line: clean(el.querySelector('.dlg-line')?.textContent).replace(/^“|”$/g, ''),
    choices: [...el.querySelectorAll('button[data-act]')].map((b) => ({ act: b.dataset.act, label: clean(b.textContent.replace(/^\d+/, '')), raw: clean(b.textContent) })),
    panel: G.hud.panel,
  };
}
/** Clicks the rendered button whose act is `act` (a real DOM click: the HUD's own handler runs). */
async function clickAct(act) {
  const b = panelEl()?.querySelector(`button[data-act="${act}"]`);
  if (!b) return false;
  b.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await frames(2);
  await sleep(60);
  return true;
}
async function clickLabel(label) {
  const p = readPanel();
  const c = p?.choices.find((x) => x.label === label) ?? p?.choices.find((x) => x.label.toLowerCase().startsWith(String(label).toLowerCase()));
  if (!c) return false;
  return clickAct(c.act);
}
/** Escape, as the player closes a panel. */
async function escape() { await press('Escape', 40); await frames(2); return !panelOpen(); }

/** Every NPC the world has, by id (the first of each id). */
function npc(id) { return G.area.npcs.find((n) => n.def.id === id); }

/**
 * Walks up to an NPC (teleport beside it, facing it) and presses F as the player does. Tries spots around it until
 * the F prompt is "Talk to <name>" for this NPC. Returns the open panel or null (and records why).
 */
async function talkTo(id, { quiet = false } = {}) {
  const n = npc(id);
  if (!n) { if (!quiet) fail('npc missing', { id }); return null; }
  if (n.hidden) { if (!quiet) fail('npc hidden', { id }); return null; }
  if (panelOpen()) await escape();
  const r = Math.max(1.2, Math.min(2.2, n.talkRange * 0.6));
  let got = null;
  const tried = [];
  for (const a of [Math.PI / 2 + n.yaw, n.yaw, -Math.PI / 2 + n.yaw, 0, Math.PI / 2, Math.PI, -Math.PI / 2, Math.PI / 4, -Math.PI / 4, 3 * Math.PI / 4]) {
    // (npc.yaw is the way it faces: stand in front of it first.)
    const x = n.pos.x + Math.cos(a) * r;
    const z = n.pos.z + Math.sin(a) * r;
    await tp(x, z, n.pos.y + 2, n.pos.x, n.pos.z);
    await sleep(120);
    const t = G.interactTarget();
    tried.push(t ? `${t.kind}:${t.label}` : 'none');
    if (t?.kind === 'talk' && t.npc === n) { got = t; break; }
  }
  if (!got) { if (!quiet) fail('cannot talk (F does something else or nothing)', { id, tried: [...new Set(tried)].slice(0, 4) }); return null; }
  await press('KeyF', 60);
  const p = await waitFor(() => panelOpen() && readPanel(), 2000);
  if (!p) { fail('F opened no panel', { id }); return null; }
  return p;
}

/** Enemies of a kind (alive first), nearest to (x, z). */
function enemiesOf(kind) { return G.combat.enemies.filter((e) => e.def.kind === kind); }
/** The documented test hook: the enemy at `hp` (a real blow still has to land and kill it). */
function weaken(e, hp = 1) { e.hp = Math.min(e.hp, hp); }

/** The current hero: 0 knight, 1 archer, 2 wizard (Digit1-3). */
async function hero_(i) { await press(`Digit${i + 1}`, 60); await waitFor(() => G.party.activeIndex === i, 1500); await sleep(400); }

/**
 * Fights `e` with real input: face it, step in range, swing LMB until it dies or `ms` passes. Returns whether it died.
 * `move` W toward it while out of reach (melee), `range` how near to stand.
 */
async function fight(e, { ms = 20000, range = 2.2, kind = 'light' } = {}) {
  const t0 = performance.now();
  while (e.alive && performance.now() - t0 < ms) {
    const p = hero();
    const d = dist2(p, e.pos);
    if (d > range + (e.def.bodyRadius ?? 1) + 6) {
      const a = Math.atan2(p.z - e.pos.z, p.x - e.pos.x);
      const R = range + (e.def.bodyRadius ?? 1) * 0.8;
      await tp(e.pos.x + Math.cos(a) * R, e.pos.z + Math.sin(a) * R, e.pos.y + 2, e.pos.x, e.pos.z);
    }
    face(e.pos.x, e.pos.z);
    if (kind === 'light') await clickMouse(0, 40);
    else if (kind === 'heavy') { mouseDown(2); await sleep(1300); mouseUp(2); }
    else if (kind === 'skill') await press('KeyE', 60);
    else if (kind === 'burst') await press('KeyQ', 60);
    await sleep(220);
  }
  return !e.alive;
}

/** The body's result: ok only with no failures and no console errors. */
function report(extra = {}) {
  for (const e of consoleErrors) fail('console error', { text: e });
  return JSON.stringify({ ok: failures.length === 0, failCount: failures.length, failures: failures.slice(0, 80), notes: notes.slice(0, 60), shots: shots.length, ...extra });
}

// ---- the dialogue explorer ------------------------------------------------------------------------------------------
/** Actions the dialogue sweep leaves to the quest sweep (they move the hero, spawn a boss or hire someone). */
const WORLD_ACTIONS = /^(lick|challenge|bag-croak|follow|hire|home|ale)$/;
/** The book's action for a choice label the NPC offers (hub topics and Leave have none). */
function bookAction(id, label) {
  if (label === 'Trade') return 'trade';
  if (/^Hire\b/.test(label)) return 'hire';
  if (label === 'Send home') return 'home';
  for (const l of G.story.book[id]?.lines ?? []) for (const c of l.choices ?? []) if (c.label === label && c.action) return c.action;
  return null;
}
/** Is `label` a hub topic (a topic line's ask) of this NPC? */
const isTopicAsk = (id, label) => (G.story.book[id]?.lines ?? []).some((l) => l.slot === 'topic' && l.ask?.trim() === label);
const normText = (s) => String(s ?? '').toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
const GARBLED = /\{[a-zA-Z]+(:[^}]*)?\}|undefined|\bNaN\b|\[object|\bnull\b|\bthat thing\b/;
const allLines = new Map();

/** Checks one rendered node; records what is wrong with it. */
function checkNode(id, p, via) {
  allLines.set(`${id}|${p.line}`, { id, line: p.line, choices: p.choices.map((c) => c.label) });
  if (!p.line) fail('empty line', { id, via });
  else if (GARBLED.test(p.line)) fail('garbled line', { id, line: p.line, via });
  if (!p.choices.length) fail('node with no choices (cannot be left by a button)', { id, line: p.line });
  const seen = new Set();
  const raw = G.hud.lastNode?.node?.choices ?? [];
  p.choices.forEach((c, i) => {
    if (!c.label) fail('empty choice label', { id, line: p.line });
    if (GARBLED.test(c.label)) fail('garbled choice label', { id, label: c.label });
    if (seen.has(c.label)) fail('duplicate choice label', { id, label: c.label, line: p.line });
    seen.add(c.label);
    const authored = raw[i]?.label?.replace(/\s+/g, ' ').trim();
    if (c.label === '…' && authored && authored !== '…') fail('choice label repeats the NPC line (the HUD hid it)', { id, label: authored, line: p.line });
    const nl = normText(c.label);
    if (nl.split(' ').length >= 3 && normText(p.line).includes(nl)) fail('choice label repeats the NPC line', { id, label: c.label, line: p.line });
  });
}

const quietSnap = () => ({ q: JSON.stringify(G.adventures.quests.snapshot()), inv: G.inventory.snapshot(), flags: [...G.worldState.flags] });
function rollback(s) {
  G.adventures.quests.restore(JSON.parse(s.q));
  G.inventory.restore(s.inv);
  G.worldState.flags.clear();
  for (const f of s.flags) G.worldState.flags.add(f);
}

/** Opens the talk (F, as the player: from where the hero stands when the NPC is in reach, else walking up). */
async function reopen(id) {
  if (panelOpen()) await escape();
  const t = G.interactTarget();
  if (t?.kind === 'talk' && t.npc.def.id === id) { await press('KeyF', 40); return waitFor(() => panelOpen() && readPanel(), 1500); }
  return talkTo(id, { quiet: true });
}

/**
 * Every choice of `id`'s conversation, clicked on the rendered buttons; each node checked (checkNode). The walk takes
 * an unclicked choice where the node has one, else the known way to the nearest node that has one, else opens the talk
 * again (the greet changes with each meeting) until two openings in a row find nothing new. Quest steps a choice takes
 * are recorded and rolled back (the quest sweep plays them for real); world actions (the lick, a hire) are left to the
 * quest sweep. Returns { nodes, clicks, advances }.
 */
async function exploreNpc(id, { maxClicks = 80, stage = '' } = {}) {
  /** line -> { labels, to: Map(label -> line | 'close' | 'shop' | 'skip' | 'mutate') } */
  const graph = new Map();
  const advances = [];
  let clicks = 0;
  let idle = 0;
  if (!(await talkTo(id))) return { id, nodes: 0, clicks: 0 };
  const known = (p) => {
    if (!graph.has(p.line)) { graph.set(p.line, { labels: p.choices.map((c) => c.label), to: new Map() }); checkNode(id, p); }
    const g = graph.get(p.line);
    for (const c of p.choices) if (!g.labels.includes(c.label)) g.labels.push(c.label);
    return g;
  };
  const open = (g) => g.labels.filter((l) => !g.to.has(l));
  /** Labels to click from `line` to reach a node with an unclicked choice (through nodes the walk has seen). */
  const route = (line) => {
    const seen = new Set([line]);
    const q = [[line, []]];
    while (q.length) {
      const [l, path] = q.shift();
      const g = graph.get(l);
      if (!g) continue;
      if (path.length && open(g).length) return path;
      for (const [label, to] of g.to) if (graph.has(to) && !seen.has(to)) { seen.add(to); q.push([to, path.concat(label)]); }
    }
    return null;
  };
  while (clicks < maxClicks) {
    let p = readPanel();
    if (!p || p.panel !== 'talk') {
      if (idle >= 2) break;
      p = await reopen(id);
      if (!p) { fail('talk cannot be opened again', { id }); break; }
      const g0 = known(p);
      if (open(g0).length || route(p.line)) idle = 0;
      else { idle++; await escape(); continue; }
    }
    const g = known(p);
    let label = open(g)[0];
    const fresh = label !== undefined;
    if (!fresh) {
      const r = route(p.line);
      if (!r) { await escape(); continue; }
      label = r[0];
    }
    const lineHere = p.line;
    const action = bookAction(id, label);
    if (fresh && action && WORLD_ACTIONS.test(action)) { g.to.set(label, 'skip'); note('left to the quest sweep', { id, label, action }); continue; }
    const before = quietSnap();
    const prevChoices = p.choices.map((x) => x.label).join('|');
    if (!(await clickLabel(label))) { g.to.set(label, 'skip'); continue; }
    clicks++;
    const after = readPanel();
    const qNow = JSON.stringify(G.adventures.quests.snapshot());
    const mutated = qNow !== before.q || JSON.stringify(G.inventory.snapshot()) !== JSON.stringify(before.inv);
    if (qNow !== before.q) {
      const b = JSON.parse(before.q); const a = JSON.parse(qNow);
      advances.push({ label, steps: Object.keys(a).filter((k) => a[k] !== b[k]).map((k) => `${k}:${b[k] ?? 'none'}→${a[k]}`) });
    }
    if (!after) {
      g.to.set(label, 'close');
      // A plain topic (no action) that ends the talk is a dead end.
      if (fresh && !action && label !== 'Leave' && isTopicAsk(id, label)) fail('topic closes the talk (dead end)', { id, label, stage });
      if (mutated) rollback(before);
      continue;
    }
    if (after.panel === 'shop') {
      g.to.set(label, 'shop');
      if (label !== 'Trade') fail('a choice opened the shop', { id, label });
      await clickAct('back');
      const back = readPanel();
      if (!back || back.panel !== 'talk' || back.line !== lineHere) fail('shop Back did not return to the talk', { id });
      continue;
    }
    if (fresh) {
      if (after.line === lineHere && after.choices.map((x) => x.label).join('|') === prevChoices) fail('choice does nothing', { id, label, line: lineHere });
      else if (after.line === lineHere) fail('same line twice in a row', { id, label, line: lineHere });
    }
    if (mutated || action) {
      // A quest step or a payment: check where it leads, then put the world back (the quest sweep takes it for real).
      g.to.set(label, 'mutate');
      known(after);
      rollback(before);
      await escape();
      continue;
    }
    g.to.set(label, after.line);
    known(after);
  }
  if (!panelOpen()) await reopen(id);
  if (panelOpen() && !(await escape())) fail('Escape does not close the panel', { id });
  return { id, nodes: graph.size, clicks, advances };
}

/** Every NPC with a book (or those in `only`), grouped by place: explored through the UI. */
async function exploreAll(stage, only) {
  const out = [];
  const ids = [...new Set(G.area.npcs.map((n) => n.def.id))].filter((id) => Object.hasOwn(G.story.book, id) && (!only || only.includes(id)));
  const cell = (id) => { const p = npc(id).pos; return Math.round(p.x / 400) * 100 + Math.round(p.z / 400); };
  ids.sort((a, b) => cell(a) - cell(b));
  for (const id of ids) {
    if (npc(id).hidden) { note('hidden at this stage', { id, stage }); continue; }
    try { out.push(await exploreNpc(id, { stage })); } catch (e) { fail('explorer threw', { id, err: String(e?.message ?? e) }); }
    if (panelOpen()) await escape();
  }
  return out;
}

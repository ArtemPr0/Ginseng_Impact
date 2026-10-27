// Walk every NPC hub: open, check labels, BFS topics/choices (skip trade/hire side effects).
const G = window.__ginseng;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);

const story = G.adventures?.story;
if (!story) return JSON.stringify({ ok: false, err: 'no story' });

const ids = new Set([
  ...G.area.npcs.map((n) => n.def?.id ?? n.id).filter(Boolean),
  'stone-head',
  'rowers',
]);
const failures = [];
const ok = [];
const SKIP = new Set(['Trade', 'Leave', 'Not now.']);
const isHire = (l) => /^Hire\b/i.test(l) || l === 'Send home' || l.startsWith('Send ');

function badLabel(label, npcText) {
  if (!label || !String(label).trim()) return 'empty label';
  const t = (npcText || '').replace(/\s+/g, ' ').trim();
  const a = String(label).replace(/\s+/g, ' ').trim();
  // Exact echo of the spoken line (hub asks sharing a greet prefix are checked in unit tests vs their own topic text).
  if (t && a.toLowerCase() === t.toLowerCase()) return 'label equals NPC text';
  return null;
}

for (const id of [...ids].sort()) {
  let node;
  try {
    node = story.open(id);
  } catch (e) {
    failures.push({ id, err: String(e?.message || e) });
    continue;
  }
  if (!node) {
    if (id === 'rowers') failures.push({ id, err: 'rowers returned null' });
    continue;
  }
  const seen = new Set();
  const queue = [node];
  let topics = 0;
  let choices = 0;
  while (queue.length && topics + choices < 80) {
    const n = queue.shift();
    const key = `${n.line}|${(n.choices || []).map((c) => c.label).join('>')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    for (const c of n.choices || []) {
      choices++;
      const why = badLabel(c.label, n.line);
      if (why) failures.push({ id, label: c.label, why, line: String(n.line).slice(0, 80) });
      if (SKIP.has(c.label) || isHire(c.label) || !c.run) continue;
      let next;
      try {
        next = c.run();
      } catch (e) {
        failures.push({ id, label: c.label, err: String(e?.message || e) });
        continue;
      }
      if (next && typeof next === 'object' && next.line !== undefined) {
        topics++;
        queue.push(next);
      }
    }
  }
  ok.push({ id, nodes: seen.size, choices });
}

return JSON.stringify({
  ok: failures.length === 0 && ok.length >= 40,
  npcs: ok.length,
  expectedMin: 40,
  failures: failures.slice(0, 40),
  failCount: failures.length,
  sample: ok.slice(0, 15).map((o) => o.id),
});

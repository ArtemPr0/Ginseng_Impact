// Talk (run.mjs body, ?at=x,z): steps next to the nearest NPC when none is in reach, presses F, reads the dialogue panel,
// picks answer 1 when the conversation offers choices, reads it again, then leaves with Escape. Returns the NPC, the F
// prompt, both texts, the panel state along the way, and `note` when F would do something else here (loot, a door).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const press = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code })); window.dispatchEvent(new KeyboardEvent('keyup', { code })); };
const r2 = (n) => Math.round(n * 100) / 100;
const out = { npc: null, dist: null, prompt: null, text1: null, choice: null, text2: null, panel1: null, panel2: null, after: null };
const G = window.__ginseng;
const read = () => document.querySelector('#hud-dialog')?.innerText?.trim() ?? null;
const panel = () => G?.hud?.panel ?? (document.querySelector('#hud-dialog')?.style.display === 'none' ? 'none' : 'open');
let opened = false;
try {
  const c = G?.controller;
  if (!c?.pos || typeof G.pressF !== 'function') return JSON.stringify({ ...out, error: 'no window.__ginseng: load the page with ?at=x,z' });
  const dist = (n) => Math.hypot(n.pos.x - c.pos.x, n.pos.z - c.pos.z);
  const npcs = (G.area?.npcs ?? []).filter((n) => n && !n.hidden && n.pos);
  const near = npcs.reduce((b, n) => (!b || dist(n) < dist(b) ? n : b), null);
  if (!near) return JSON.stringify({ ...out, error: 'no NPC in the area' });
  out.npc = near.def?.id ?? near.def?.name ?? null; out.dist = r2(dist(near));
  let t = G.interactTarget?.() ?? null;
  // Out of reach: step next to the NPC (on the surface there) and let a few frames run so the prompt refreshes.
  if (t?.kind !== 'talk' && dist(near) > (near.talkRange ?? 3) * 0.8) {
    const dx = c.pos.x - near.pos.x; const dz = c.pos.z - near.pos.z; const d = Math.hypot(dx, dz) || 1;
    const x = near.pos.x + (dx / d) * 1.4; const z = near.pos.z + (dz / d) * 1.4;
    const hw = G.area?.heights ?? G.world; let y = near.pos.y;
    try { if (typeof hw?.heightAt === 'function') y = hw.heightAt(x, z, near.pos.y + 0.5); } catch {}
    c.pos.x = x; c.pos.y = y + 0.05; c.pos.z = z; if (c.vel) { c.vel.x = 0; c.vel.y = 0; c.vel.z = 0; } c.mode = 'ground';
    await sleep(600);
    out.dist = r2(dist(near)); t = G.interactTarget?.() ?? null;
  }
  out.prompt = t?.label ?? null;
  if (t?.kind !== 'talk') return JSON.stringify({ ...out, note: t ? `F would ${t.kind} (${t.label}), not talk` : 'nothing to interact with here' });
  G.pressF(); opened = true;
  await sleep(300);
  out.panel1 = panel(); out.text1 = read();
  const choice = document.querySelector('#hud-dialog button[data-act="c0"]');
  if (choice) {
    out.choice = choice.innerText?.trim() ?? '';
    press('Digit1');
    await sleep(300);
    out.panel2 = panel(); out.text2 = out.panel2 === 'none' ? null : read();
  }
} catch (e) { out.error = String(e?.stack ?? e); }
finally { if (opened && panel() !== 'none') { press('Escape'); await sleep(150); } out.after = panel(); }
return JSON.stringify(out);

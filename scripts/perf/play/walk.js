// Walk (run.mjs body, ?at=x,z): holds W for 20 s of wall time and samples the hero every 0.5 s — his position, the surface
// under him (heights.heightAt with his own y as the hint, so a bridge or a floor counts), the water there if any, and the
// controller's mode. Returns the samples, how far above and below the surface he got (maxBelow > 0: he sank), the path
// length walked and the straight-line displacement (distance ≈ 0: he never moved; displacement ≈ 0 with a distance: stuck).
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const holdW = (type) => window.dispatchEvent(new KeyboardEvent(type, { code: 'KeyW', key: 'w' }));
const r2 = (n) => Math.round(n * 100) / 100;
const samples = []; const errors = [];
let maxAbove = -Infinity; let maxBelow = -Infinity; let distance = 0; let displacement = 0;
try {
  const G = window.__ginseng; const c = G?.controller; const hw = G?.area?.heights ?? G?.world;
  if (!c?.pos) return JSON.stringify({ error: 'no window.__ginseng.controller: load the page with ?at=x,z', samples });
  const surface = (p) => { try { return typeof hw?.heightAt === 'function' ? hw.heightAt(p.x, p.z, p.y) : null; } catch (e) { errors.push(String(e)); return null; } };
  const water = (p) => { try { const w = hw?.waterAt?.(p.x, p.z); return typeof w === 'number' ? w : null; } catch { return null; } };
  const start = { x: c.pos.x, y: c.pos.y, z: c.pos.z }; let prev = start;
  const t0 = performance.now();
  holdW('keydown');
  try {
    for (let i = 0; i <= 40; i++) {
      const p = { x: c.pos.x, y: c.pos.y, z: c.pos.z }; const g = surface(p); const w = water(p);
      const s = { t: r2((performance.now() - t0) / 1000), x: r2(p.x), y: r2(p.y), z: r2(p.z), ground: g === null ? null : r2(g), mode: c.mode ?? null };
      if (w !== null) s.water = r2(w);
      samples.push(s);
      if (g !== null) { maxAbove = Math.max(maxAbove, p.y - g); maxBelow = Math.max(maxBelow, g - p.y); }
      distance += Math.hypot(p.x - prev.x, p.z - prev.z); prev = p;
      if (i < 40) await sleep(500);
    }
  } finally { holdW('keyup'); }
  displacement = Math.hypot(prev.x - start.x, prev.z - start.z);
} catch (e) { errors.push(String(e?.stack ?? e)); }
const num = (n) => (Number.isFinite(n) ? r2(n) : null);
return JSON.stringify({ samples, maxAbove: num(maxAbove), maxBelow: num(maxBelow), distance: r2(distance), displacement: r2(displacement), ...(errors.length ? { errors } : {}) });

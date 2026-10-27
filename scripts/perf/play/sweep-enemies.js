// Every live enemy: teleport near, force damage to kill (passive/neutral included), assert death.
const G = window.__ginseng;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(2000);

const failures = [];
const results = [];
const seenKinds = new Set();

// Snapshot kinds present at load (spawns).
const enemies = [...G.combat.enemies];
for (const e of enemies) {
  const kind = e.def.kind;
  seenKinds.add(kind);
  if (!e.alive) {
    results.push({ kind, skipped: 'already dead' });
    continue;
  }
  const hp0 = e.hp;
  G.controller.pos.x = e.pos.x + Math.max(2, (e.def.bodyRadius || 1) + 1.5);
  G.controller.pos.z = e.pos.z;
  G.controller.pos.y = G.world.heightAt(G.controller.pos.x, G.controller.pos.z, e.pos.y);
  // Wait briefly so aggro can flip for non-passive hostiles.
  if (!e.def.passive && e.def.brain?.aggroRange > 0) {
    await sleep(600);
  }
  const aggroed = !!(e.aggro || e.brain?.state === 'chase' || e.brain?.state === 'attack' || e.brain?.state === 'windup' || e.provoked);
  // Kill with direct damage (bypass animations); bosses need a big hit.
  const died = e.takeDamage(Math.max(hp0, e.def.maxHp) + 50, { x: 1, z: 0 }, 0);
  await sleep(50);
  const ok = !e.alive || died === true || e.hp <= 0;
  if (!ok) failures.push({ kind, hp: e.hp, alive: e.alive, died });
  results.push({
    kind,
    boss: !!e.def.boss,
    passive: !!e.def.passive,
    neutral: !!e.def.neutral,
    aggroed: e.def.passive ? null : aggroed,
    hp0,
    dead: !e.alive || e.hp <= 0,
  });
}

// Bosses that should exist among spawns.
const wantBosses = ['hollowking', 'warden', 'wyrm', 'yeti', 'shade', 'marshdemon', 'dmt-entity', 'cyclops-lord', 'lean-chucker'];
for (const k of wantBosses) {
  if (![...seenKinds].includes(k) && !enemies.some((e) => e.def.kind === k)) {
    // May be gated (Hollow King used to be); still flag if totally missing from combat list.
    if (!G.combat.enemies.some((e) => e.def.kind === k)) failures.push({ kind: k, err: 'boss not spawned' });
  }
}

return JSON.stringify({
  ok: failures.length === 0,
  n: results.length,
  kinds: [...seenKinds].sort(),
  failures: failures.slice(0, 40),
  failCount: failures.length,
  sample: results.filter((r) => r.boss || r.passive).slice(0, 20),
});

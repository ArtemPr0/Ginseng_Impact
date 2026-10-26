const G = window.__ginseng;
if (!G) return { ok: false, why: 'no game' };
G.game.advance(3);
const p = G.controller.pos;
const nan = [p.x, p.y, p.z].some((n) => !Number.isFinite(n));
return {
  ok: !nan && p.y > -80,
  y: +p.y.toFixed(2),
  quests: G.adventures.quests.stage('silence'),
  enemies: G.combat.enemies.length,
  chests: G.area.interactables.length,
};

// The title as a first-time player meets it, then Continue, then New Game (run.mjs twice: window.name holds the step).
const G = window.__ginseng; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(3000);
const press = () => (document.body.innerText.match(/CLICK[^\n]*/i) || [''])[0];
const step = window.name;
const out = { step, press: press(), locked: G.input.locked, hasSave: G.save.has(), failed: performance.getEntriesByType('resource').filter((e) => e.responseStatus >= 400).map((e) => e.name.split('/').pop()) };
const enter = async () => { G.input.locked = true; G.input.hold = false; await sleep(1500); };
if (!step) {
  await enter();
  out.afterEnter = { x: +G.controller.pos.x.toFixed(1), z: +G.controller.pos.z.toFixed(1), shards: G.inventory.shards, paused: G.game.paused };
  G.inventory.shards = 4321; G.adventures.quests.set('throne', 'active'); await sleep(300);
  G.save.write(G.snapshot()); window.name = 'cont'; location.reload(); return JSON.stringify(out);
}
if (step === 'cont') {
  await enter();
  out.continued = { shards: G.inventory.shards, throne: G.adventures.quests.stage('throne') };
  window.name = 'new'; location.reload(); return JSON.stringify(out);
}
window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', key: 'n', bubbles: true })); await sleep(300);
await enter();
out.newGame = { shards: G.inventory.shards, throne: G.adventures.quests.stage('throne'), saved: JSON.parse(localStorage.getItem('ginseng.save.v1') || '{}').inventory?.shards };
window.name = '';
return JSON.stringify(out);

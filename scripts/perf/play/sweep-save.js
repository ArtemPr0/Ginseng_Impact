// Save, real reload, load: run twice. First run plants state and writes; the second (window.name remembers) checks it.
const G = window.__ginseng; const sleep = (ms) => new Promise((r) => setTimeout(r, ms)); await sleep(1500);
const Q = G.adventures.quests;
if (!window.name.startsWith('saved:')) {
  G.inventory.shards = 4321; G.inventory.add('mist-blade', 1); Q.set('throne', 'active'); Q.set('bell', 'active');
  G.combat.hp.set('knight', 777);
  localStorage.setItem('ginseng.save.v1', JSON.stringify(G.snapshot()));
  window.name = 'saved:';
  location.reload();
  return JSON.stringify({ planted: true });
}
window.name = '';
const loaded = G.loadSave();
await sleep(500);
return JSON.stringify({ loaded, shards: G.inventory.shards, blade: G.inventory.has('mist-blade'), throne: Q.stage('throne'), bell: Q.stage('bell'), hp: G.combat.hp.get('knight'), level: G.snapshot().progress });

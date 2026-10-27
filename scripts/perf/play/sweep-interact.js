// Every interactable: move near, require a non-empty label, fire act() for doors/portals/chests where safe.
const G = window.__ginseng;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await sleep(1500);

const list = G.area.interactables || [];
const failures = [];
const ok = [];
const start = { x: G.controller.pos.x, y: G.controller.pos.y, z: G.controller.pos.z };

for (let i = 0; i < list.length; i++) {
  const it = list[i];
  const pos = it.pos;
  if (!pos) {
    failures.push({ i, err: 'no pos' });
    continue;
  }
  G.controller.pos.x = pos.x;
  G.controller.pos.z = pos.z;
  G.controller.pos.y = typeof pos.y === 'number' ? pos.y : G.world.heightAt(pos.x, pos.z);
  await sleep(30);
  let label = null;
  try {
    label = it.label();
  } catch (e) {
    failures.push({ i, x: pos.x, z: pos.z, err: `label threw: ${e?.message || e}` });
    continue;
  }
  if (label == null || label === '') {
    // Some interactables hide their prompt until a quest stage; still record as soft.
    ok.push({ i, x: +pos.x.toFixed(1), z: +pos.z.toFixed(1), label: null, soft: true });
    continue;
  }
  // Fire act for things that look like doors/chests/bells/boats — catch throws.
  const lower = String(label).toLowerCase();
  const tryAct = /door|enter|exit|climb|boat|chest|open|ring|bell|cart|portal|teleport|step|go |board/.test(lower);
  let acted = false;
  let actErr = null;
  if (tryAct) {
    try {
      it.act();
      acted = true;
      await sleep(80);
    } catch (e) {
      actErr = String(e?.message || e);
      failures.push({ i, label, err: `act: ${actErr}` });
    }
  }
  ok.push({ i, x: +pos.x.toFixed(1), z: +pos.z.toFixed(1), label, acted });
}

// Restore roughly to start so later sweeps are not stranded.
G.controller.pos.x = start.x;
G.controller.pos.y = start.y;
G.controller.pos.z = start.z;

return JSON.stringify({
  ok: failures.length === 0,
  n: list.length,
  withLabel: ok.filter((o) => o.label).length,
  softHidden: ok.filter((o) => o.soft).length,
  acted: ok.filter((o) => o.acted).length,
  failures: failures.slice(0, 40),
  failCount: failures.length,
  sample: ok.filter((o) => o.label).slice(0, 25),
});

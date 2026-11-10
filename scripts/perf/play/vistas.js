// Framed screenshots of named spots: set `window.VISTAS = [{ name, at: [x, z], cam: [x, y, z], look: [x, y, z] }]`
// before running (eval.mjs), or let the default list (the island's re-laid places, 2026-11-10) run. The hero is
// teleported to `at` (so the chunks and the mobs around it are live), the camera pinned at `cam` looking at `look`,
// the fog and look blends given five seconds, then one shot per spot into SHOT_DIR.
//#include lib.js
const VISTAS = window.VISTAS ?? [
  { name: 'spawn-vista', at: [0, 59], cam: [0, 5, 64], look: [0, 3, 10] },
  { name: 'witch-bridge-from-south', at: [-62, 30], cam: [-66, 9, 32], look: [-67, 3, 9] },
  { name: 'witch-bridge-from-east', at: [-50, 12], cam: [-46, 8, 14], look: [-67, 4, 9] },
  { name: 'river-west-end', at: [-40, 30], cam: [-36, 12, 36], look: [-58, 1, 22] },
  { name: 'face-tree', at: [-36, 6], cam: [-33, 8, 10], look: [-47, 3, -2] },
  { name: 'cathedral-south-wall', at: [68, 12], cam: [68, 10, 12], look: [68, 4, -17] },
  { name: 'village-back-row-from-coast', at: [-35, 100], cam: [-35, 12, 112], look: [-35, 3, 88] },
  { name: 'village-street', at: [-8, 70], cam: [-4, 5, 72], look: [-50, 3, 70] },
  { name: 'archgate', at: [56, -70], cam: [56, 8, -66], look: [56, 3, -84] },
  { name: 'rope-bridge-south-end', at: [24, -20], cam: [22, 8, -18], look: [26, 2, -40] },
  { name: 'stream-ribbon-west-bank', at: [-55, -30], cam: [-54, 8, -32], look: [-67, 0, -14] },
  { name: 'treehouse', at: [-70, 30], cam: [-68, 8, 32], look: [-86, 4, 30] },
  { name: 'hamlet-by-the-road', at: [0, 4], cam: [-2, 7, 6], look: [7, 3, -6] },
  { name: 'tavern-and-cloister', at: [27, 78], cam: [27, 7, 82], look: [27, 3, 65] },
];
const out = [];
const cam = G.camera;
const origUpdate = G.tpc.update;
try {
for (const v of VISTAS) {
  await tp(v.at[0], v.at[1]);
  G.tpc.update = () => { cam.position.set(v.cam[0], v.cam[1], v.cam[2]); cam.lookAt(v.look[0], v.look[1], v.look[2]); };
  await sleep(5000);
  const p = await shot(v.name);
  out.push({ name: v.name, shot: p, hero: [Math.round(hero().x), +hero().y.toFixed(2), Math.round(hero().z)] });
}
} finally { G.tpc.update = origUpdate; }
return JSON.stringify({ shots: out, errors: consoleErrors.slice(0, 10) });

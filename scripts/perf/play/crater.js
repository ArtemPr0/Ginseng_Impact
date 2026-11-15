//#include lib.js
await sleep(1500);
const C = G.area.craters;
const p = hero();
const T = G.area.terrain;
const open = (x, z) => { for (let a = 0; a < 16; a++) for (const r of [0, 4, 8, 12]) { const qx = x + Math.cos(a) * r, qz = z + Math.sin(a) * r; if (G.world.heightAt(qx, qz) > T.heightAt(qx, qz) + 0.05 || !T.dryAt(qx, qz)) return false; } return true; };
let x = 0, z = 0, found = false;
for (let r = 0; r < 60 && !found; r += 3) for (let a = 0; a < 12 && !found; a++) { x = p.x + Math.cos(a / 2) * r; z = p.z + Math.sin(a / 2) * r; found = open(x, z) && open(x + 9, z); }
const h0 = G.world.heightAt(x, z);
G.scene.traverse((o) => { if (o.isInstancedMesh && o.parent?.name?.startsWith('flora:')) o.visible = false; });
const cam = G.camera; G.scene.fog = null; G.renderer.gl.toneMappingExposure = 2.2;
G.tpc.update = () => { cam.position.set(x + 5, h0 + 11, z + 5); cam.lookAt(x, h0, z); };
await sleep(1200); await shot('before');
let t0 = performance.now();
const dug = C.crater(x, z, 3.5, 1.1);
C.scorch(x, z, 4, 'burnt');
const ms = performance.now() - t0;
const h1 = G.world.heightAt(x, z);
await sleep(1500); await shot('crater');
C.scorch(x + 9, z, 3, 'frozen');
G.tpc.update = () => { cam.position.set(x + 9 + 5, h0 + 11, z + 5); cam.lookAt(x + 9, h0, z); };
await sleep(1200); await shot('frost');
return JSON.stringify({ found, x: +x.toFixed(1), z: +z.toFixed(1), dug, ms: +ms.toFixed(1), h0: +h0.toFixed(2), h1: +h1.toFixed(2), healing: C.healing, errors: consoleErrors.slice(0, 5), shots });

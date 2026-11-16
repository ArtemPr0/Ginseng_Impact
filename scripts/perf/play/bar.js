//#include lib.js
// The 1-7 bar (2026-11-16): for each hero, pick every slot and right-click it at a mob knot; log what was cast, the
// HUD's picked slot, telekinesis' glow and lift, and console errors.
await sleep(2500);
const C = G.combat;
const SPOT = { x: 24.9, z: 37.6 };
const out = { heroes: [] };
const errs = [];
const oe = console.error; console.error = (...a) => { errs.push(String(a[0]).slice(0, 200)); oe(...a); };
for (const e of C.enemies) if (e.brain) e.brain.p.aggroRange = 0;
for (let h = 0; h < 3; h++) {
  await hero_(h);
  const row = { hero: G.party.active.id, casts: [] };
  for (let k = 1; k <= 7; k++) {
    await tp(SPOT.x - 9, SPOT.z, undefined, SPOT.x, SPOT.z); await sleep(300);
    await press(`Digit${k}`, 60);
    C.burstEnergy = 999;
    const before = C.spellsCast;
    if (k === 7 && row.hero === 'wizard') {
      // Telekinesis: the glow should be on something; hold right click, let go.
      row.tkGlow = !!C.carry.liftTarget();
      mouseDown(2); await sleep(900);
      row.tkHeld = !!C.carry.mind;
      mouseUp(2); await sleep(600);
      row.tkAfter = !!C.carry.mind;
    } else { mouseDown(2); await frames(2); mouseUp(2); await sleep(1600); }
    row.casts.push({ k, cast: C.spellsCast - before, mode: G.controller.mode, busy: C.busy, casting: !!C.casting, charge: C.heavyCharge, down: C.downed, carry: C.carry.busy, ready: C.spells.ready(row.hero, Math.max(0, k - 3)) });
    await sleep(400);
  }
  // Left click: tap swings, hold charges a heavy.
  await tp(SPOT.x - 9, SPOT.z, undefined, SPOT.x, SPOT.z); await sleep(300);
  mouseDown(0); await sleep(80); mouseUp(0); await sleep(700);
  mouseDown(0); await sleep(700); row.charge = +C.heavyCharge.toFixed(2); mouseUp(0); await sleep(900);
  out.heroes.push(row);
}
out.errors = errs.slice(0, 10);
return out;

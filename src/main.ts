import { Color, DirectionalLight, FogExp2, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { Bubbles } from './world/Portal';
import { LightBudget } from './render/LightBudget';
import { yawToRotation } from './models/ModelRig';
import { Audio } from './audio/Audio';
import { Rig } from './characters/Rig';
import { ROSTER } from './characters/roster';
import { CombatSystem } from './combat/CombatSystem';
import { Game } from './core/Game';
import { Input } from './core/Input';
import { LAYOUT, REALMS } from './data/world';
import { Inventory } from './items/Inventory';
import { riverAt } from './world/Terrain';
import { ITEMS } from './items/Items';
import { CONTROLLER, createControllerState, stepController } from './player/CharacterController';
import { Party } from './player/Party';
import { ThirdPersonCamera } from './player/ThirdPersonCamera';
import { Atmosphere } from './render/Atmosphere';
import { PALETTE } from './render/palette';
import { LOOKS, Renderer } from './render/Renderer';
import { SKIES, Sky } from './render/Sky';
import { faceMoon } from './render/MoonFace';
import { SkyEvents } from './render/SkyEvents';
import { Weather } from './render/Weather';
import { Hud } from './ui/Hud';
import { Minimap } from './ui/Minimap';
import { Companion } from './world/Companion';
import { Npc } from './world/NPCs';
import { Terrain } from './world/Terrain';
import { World } from './world/World';
import { Adventures } from './game/Adventures';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();
const renderer = new Renderer(canvas);
const debugAt = new URLSearchParams(location.search).has('at');
const input = new Input(canvas, debugAt);
const audio = new Audio();
const hud = new Hud(document.getElementById('hud')!);
const inventory = new Inventory();
inventory.shards = 40;
inventory.add('moon-dew', 2);
inventory.equip(inventory.add('hunters-bow'), 'archer', 'bow');
const scene = new Scene();
const islandFog = { color: new Color(PALETTE.fog), density: 0.0062 };
const fog = new FogExp2(PALETTE.fog, islandFog.density);
scene.fog = fog;
const bubbles = new Bubbles();
scene.add(bubbles.group);
const fogTarget = new Color();
let portalCooldown = 0;

const camera = new PerspectiveCamera(65, renderer.aspect, 0.3, 600);
const moon = new DirectionalLight(PALETTE.moon, 1.5);
const fill = new DirectionalLight(0x8fa5f0, 0.75);
fill.position.set(70, 60, 110);
const sky = new Sky();
// The island's moon is the laughing face, as a crescent (shot-013029); until its model loads, the cratered disc.
const moonFace = faceMoon('moon-laugh', Sky.moonRadius, { crescent: 0.72, glow: 0.7 });
void moonFace.ready.then((ok) => { if (ok) sky.attachMoonModel(moonFace.group, moonFace.tint); });
const skyEvents = new SkyEvents();
moon.castShadow = true;
moon.shadow.mapSize.set(2048, 2048);
moon.shadow.camera.left = -80;
moon.shadow.camera.right = 80;
moon.shadow.camera.top = 80;
moon.shadow.camera.bottom = -80;
moon.shadow.camera.near = 20;
moon.shadow.camera.far = 420;
moon.shadow.bias = -0.0005;
moon.shadow.normalBias = 0.5;
moon.shadow.radius = 3;
const hemi = new HemisphereLight(PALETTE.cobalt, PALETTE.abyss, 0.7);
scene.add(moon, moon.target, fill, fill.target, hemi, sky.group, skyEvents.group);

const terrain = new Terrain();
scene.add(terrain.mesh);
const minimap = new Minimap(document.getElementById('hud')!, terrain);
const area = new World(terrain);
scene.add(area.group);
const world = area.heights;
if (debugAt) (window as unknown as { __dbg: unknown }).__dbg = { h: (x: number, z: number) => world.heightAt(x, z), river: (x: number, z: number) => riverAt(x, z), rigs: () => rigs, combat: () => combat, npcs: () => area.npcs, audio, gl: () => renderer.gl, renderer, world: () => area, camera, terrain, sky, atmosphere: () => atmosphere, weather: () => weather };
const atmosphere = new Atmosphere((x, z) => world.heightAt(x, z), new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z));
scene.add(atmosphere.group);
const weather = new Weather(LAYOUT.rainZone, LAYOUT.snowZone);
scene.add(weather.group);
const playerPos = new Vector3();
/** Where the hero was at the start of the last fixed step, and where they are drawn (between it and now). */
const prevPos = new Vector3();
const drawPos = new Vector3();
const interactAt = new Vector3();
let interactIn = 0;

// --- player ---
// `?at=x,z` starts the party at a world position (used to check landmarks and bosses quickly).
const atParam = new URLSearchParams(location.search).get('at')?.split(',').map(Number);
const SPAWN = atParam && atParam.length === 2 && atParam.every((n) => Number.isFinite(n)) ? new Vector3(atParam[0], 0, atParam[1]) : new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z);
SPAWN.y = world.heightAt(SPAWN.x, SPAWN.z);
const controller = createControllerState(SPAWN);
const party = new Party(ROSTER);
const rigs = ROSTER.map((def) => new Rig(def));
for (const r of rigs) {
  r.root.visible = r.trailObject.visible = false;
  scene.add(r.root, r.trailObject);
}
let landedAt = -10;
/** Camera roll while slowed by a puddle of lean. */
let tilt = 0;
let wasInKingdom = false;
let wasAirborne = false;
rigs[party.activeIndex].root.visible = rigs[party.activeIndex].trailObject.visible = true;
const tpc = new ThirdPersonCamera(camera, world);
const camParam = new URLSearchParams(location.search).get('cam')?.split(',').map(Number).filter((n) => Number.isFinite(n));
// `?face=x,z` (debug) aims the camera from the spawn toward a world point.
const faceParam = new URLSearchParams(location.search).get('face')?.split(',').map(Number);
if (faceParam && faceParam.length === 2 && faceParam.every((n) => Number.isFinite(n))) tpc.yaw = Math.atan2(-(faceParam[0] - SPAWN.x), -(faceParam[1] - SPAWN.z));
tpc.snapTo(new Vector3(SPAWN.x, SPAWN.y + 1.4, SPAWN.z));
hud.setParty(ROSTER, party.activeIndex);
const companions: Companion[] = [];
let talking: Npc | null = null;

function switchTo(i: number): boolean {
  const swap = party.switchTo(i);
  if (!swap) return false;
  rigs[swap.from].root.visible = rigs[swap.from].trailObject.visible = false;
  rigs[swap.to].root.visible = rigs[swap.to].trailObject.visible = true;
  hud.setParty(ROSTER, swap.to);
  combat.onSwitch();
  audio.click();
  return true;
}

Npc.sound = { voice: (url, gain) => audio.voice(url, gain), slurp: (gain) => audio.slurp(gain) };
Rig.sound = { slurp: (gain) => audio.slurp(gain), rustle: () => audio.rustle(), munch: () => audio.munch() };
const lightBudget = new LightBudget(scene, 6);
lightBudget.collect(scene);

const combat = new CombatSystem({
  scene, world, sky, hud, camera, game, audio, inventory, controller, party, spawn: SPAWN,
  onForceSwitch: (i) => { party.update(Party.cooldown); switchTo(i); },
  onShake: (a) => tpc.shake(a),
  onTrip: (strength, seconds) => renderer.trip(strength, seconds),
  onKill: (kind) => adventures.quests.kill(kind),
  muzzle: () => rigs[party.activeIndex].muzzle(new Vector3()),
  // A wipe also ends the frog's dream (otherwise its clock would run on, and block the portals, back on the island).
  onWipe: () => { adventures.riding = null; wasLocked = false; if (adventures.dreamLeft > 0) adventures.wake(); },
  onDodge: () => {
    const axis = input.moveAxis();
    const dir = axis.x === 0 && axis.z === 0 ? { x: -Math.cos(controller.yaw), z: -Math.sin(controller.yaw) } : tpc.moveToWorld(axis);
    controller.vel.x += dir.x * 11;
    controller.vel.z += dir.z * 11;
  },
});

/** Moves the hero (portals, doors, the frog's dream): everything that was chasing stays behind. */
function teleport(x: number, y: number, z: number, yaw: number, name?: string): void {
  hud.curtain();
  adventures.riding = null;
  controller.pos = { x, y: y + 0.05, z };
  controller.vel = { x: 0, y: 0, z: 0 };
  controller.mode = 'ground';
  controller.yaw = yaw;
  tpc.yaw = Math.atan2(-Math.cos(yaw), -Math.sin(yaw));
  wasLocked = false;
  for (const c of companions) c.teleport(x, z, world.heightAt(x, z, y));
  combat.resetAggro();
  if (name) hud.announce(name);
  audio.cast();
  portalCooldown = 1.5;
}
combat.loot.onAbsorbed = () => audio.absorb();
const adventures = new Adventures({
  controller, world: area, hud, audio, inventory, teleport, activeRig: () => rigs[party.activeIndex], debuffs: () => combat.debuffs,
  trip: (strength, seconds) => renderer.trip(strength, seconds),
  fight: { spawnBoss: (kind, x, z, yaw) => combat.spawnBoss(kind, x, z, yaw), despawn: (e) => combat.despawn(e) },
});
area.hooks.soundWanted = () => adventures.quests.stage('sound') === 'active';
area.hooks.foundSound = () => adventures.foundSound();
area.hooks.teleport = teleport;
area.hooks.shoot = (from, s) => combat.hostileShot(from, s);
area.hooks.hurt = (atk, poison) => combat.hazard(atk, poison);
area.hooks.mire = (seconds) => combat.mire(seconds);
// Shootable things in the world (sky eyes, the eye pool), and the prize for shooting every sky eye.
combat.targets.push(...area.shotTargets);
area.hooks.reward = (what) => {
  if (what !== 'eyes') return;
  combat.loot.spawn([{ kind: 'shards', amount: 60 }, { kind: 'item', itemId: 'moon-dew', count: 2 }], new Vector3(controller.pos.x, controller.pos.y + 1, controller.pos.z));
  hud.announce('The sky blinks first · 60 shards');
  audio.loot(4);
};
area.hooks.board = (boat) => { adventures.riding = boat; audio.footstep(); hud.announce('Aboard · F talk · SPACE jump off'); };
adventures.openRowers = () => {
  const node = adventures.talk('rowers');
  if (node) openPanel(() => hud.dialogue({ name: 'The Rowers', title: 'Two Knights and a Boat' }, node, adventures.onLine));
};

// --- panels ---
function openPanel(fn: () => void): void {
  input.unlock();
  input.uiOpen = true;
  fn();
  hud.setLocked(false);
}
function closePanel(): void {
  hud.close();
  talking = null;
  input.uiOpen = false;
  // (Escape does not count as a user gesture: the lock may be refused, and the click-to-resume prompt shows.)
  canvas.requestPointerLock()?.catch?.(() => {});
}
hud.bind({
  onBuy: (itemId, price) => {
    if (!inventory.spend(price)) return false;
    inventory.add(itemId);
    audio.coins(3);
    hud.announce(`${ITEMS[itemId].name} acquired`);
    return true;
  },
  onSell: (uid, count) => { const gain = inventory.sell(uid, count); if (gain > 0) audio.coins(2); },
  onHire: (npc) => {
    if (!npc.hire || companions.length >= 3 || companions.some((c) => c.def.id === npc.id)) return 'full';
    if (!inventory.spend(npc.hire.cost)) return 'poor';
    // The one who follows you leaves their post (no twin standing where they used to be).
    const post = area.npcs.find((n) => n.def.id === npc.id);
    if (post) post.hidden = true;
    const c = new Companion(npc, new Vector3(controller.pos.x, controller.pos.y, controller.pos.z), (x, z, y) => world.heightAt(x, z, y), companions.length);
    companions.push(c);
    scene.add(c.rig.root, c.rig.trailObject);
    hud.setCompanions(companions.map((x) => x.def.name));
    audio.fanfare();
    hud.announce(`${npc.name} joins you`);
    return 'ok';
  },
  onEquip: (uid) => {
    const me = party.active;
    const ok = inventory.equip(uid, me.id, me.weapon);
    if (ok) { audio.click(); const e = inventory.entries.find((x) => x.uid === uid)!; hud.announce(`${me.name} wields ${ITEMS[e.itemId].name}`); }
    return ok;
  },
  onUse: (uid) => {
    const e = inventory.entries.find((x) => x.uid === uid);
    if (!e) return false;
    const d = ITEMS[e.itemId];
    if (d.kind !== 'consumable') return false;
    if (d.heal) combat.healActive(d.heal);
    if (d.frenzy) combat.applyFrenzy(d.frenzy);
    inventory.remove(e.itemId, 1);
    return true;
  },
  onDrop: (uid) => {
    const e = inventory.entries.find((x) => x.uid === uid);
    if (!e || e.equippedBy || ITEMS[e.itemId].kind === 'key') return;
    inventory.remove(e.itemId, 1);
    combat.loot.spawn([{ kind: 'item', itemId: e.itemId, count: 1 }], new Vector3(controller.pos.x, controller.pos.y + 1, controller.pos.z));
  },
  onClose: () => closePanel(),
}, inventory);
window.addEventListener('keydown', (e) => {
  // (Held keys repeat: a held digit would pick choice after choice, a held I would flicker the bag.)
  if (e.repeat) return;
  const digit = /^Digit([1-9])$/.exec(e.code);
  if (digit && hud.pickChoice(Number(digit[1]))) return;
  if (e.code === 'KeyI') {
    if (hud.panel === 'inventory') closePanel();
    else if (hud.panel === 'none') openPanel(() => hud.inventoryPanel());
  } else if (e.code === 'Escape' && hud.panel !== 'none') closePanel();
});
const unlockAudio = () => audio.unlock();
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('keydown', unlockAudio);
// The title screen's music (the intro sample, then the loop) from the moment the game opens until play begins.
// Most browsers keep sound off until the first click or key press: that first press only starts the music, and the
// next click enters the game.
let titleMusic = !debugAt && audio.hasMusic('title-intro', 'title-loop');
if (titleMusic) {
  audio.unlock();
  audio.title(true);
  if (audio.suspended) { input.hold = true; hud.setPress('CLICK TO BEGIN'); }
}

// Title cinematic: a slow dolly up the causeway toward the head while the pointer is not locked.
const HEAD_EYES = new Vector3(LAYOUT.head.x, terrain.heightAt(LAYOUT.head.x, LAYOUT.head.z) - 3 + LAYOUT.head.height * 0.69, LAYOUT.head.z);
let cinematicT = 0;
let wasLocked = false;

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
  camera.aspect = renderer.aspect;
  camera.updateProjectionMatrix();
});

/** What F would do right now: loot first, then talk. */
function interactTarget(): { kind: 'loot'; take: () => void; label: string } | { kind: 'use'; act: () => void; label: string } | { kind: 'talk'; npc: Npc; label: string } | null {
  const p = interactAt.set(controller.pos.x, controller.pos.y, controller.pos.z);
  const pickup = combat.loot.nearest(p, 2.8);
  if (pickup && pickup.drop.kind === 'item') {
    const def = ITEMS[pickup.drop.itemId];
    return { kind: 'loot', label: `Take ${def.name}`, take: () => { combat.loot.take(pickup); inventory.add(def.id, 1); audio.loot(def.rarity); hud.announce(`${def.name}`); } };
  }
  const zone = REALMS.find((r) => Math.hypot(p.x - r.x, p.z - r.z) < r.radius)?.id ?? null;
  const use = adventures.interact(zone);
  if (use) return { kind: 'use', label: use.label, act: use.act };
  let best: Npc | null = null;
  let bd = Infinity;
  for (const n of area.npcs) {
    if (n.hidden) continue;
    const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
    if (d < n.talkRange && d < bd && Math.abs(n.pos.y - p.y) < 6) { bd = d; best = n; }
  }
  if (best) return { kind: 'talk', npc: best, label: `Talk to ${best.def.name}` };
  return null;
}

/** F: take the loot, use the door or boat (or put the sack down), or talk to whoever is near. */
function pressF(): void {
  const t = interactTarget();
  if (t?.kind === 'loot') t.take();
  else if (t?.kind === 'use') t.act();
  else if (t?.kind === 'talk') {
    talking = t.npc;
    audio.talk();
    // A conversation with choices (quests) when the NPC has one; otherwise its ordinary lines.
    const node = adventures.talk(t.npc.def.id);
    if (node) openPanel(() => hud.dialogue(t.npc.def, node, adventures.onLine));
    else { t.npc.speak(); openPanel(() => hud.talk(t.npc.def)); }
  }
}

const focus = new Vector3();
game
  .add({
    update(dt) {
      prevPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      const { dx, dy } = input.takeMouseDelta();
      if (input.locked) tpc.rotate(dx, dy);
      party.update(dt);
      for (let i = 0; i < ROSTER.length; i++) {
        if (input.locked && input.justPressed(`Digit${i + 1}`)) switchTo(i);
      }
      if (input.locked && input.justPressed('KeyF')) pressF();
      combat.update(dt, {
        attack: input.locked && input.mouseJustPressed(0),
        heavyHeld: input.locked && input.mouseDown(2),
        heavyRelease: input.locked && input.mouseJustReleased(2),
        skill: input.locked && input.justPressed('KeyE'),
        burst: input.locked && input.justPressed('KeyQ'),
        dodge: input.locked && input.justPressed('KeyR'),
      });
      const move = input.locked && !combat.busy && combat.charging === 0 ? tpc.moveToWorld(input.moveAxis()) : { x: 0, z: 0 };
      const space = input.locked && input.justPressed('Space');
      adventures.update(dt);
      controller.speedScale = combat.webbed > 0 ? 0 : combat.slowed > 0 ? 0.6 : combat.mired > 0 ? 0.55 : 1;
      if (adventures.riding) { if (space) adventures.leaveBoat(); }
      // In a giant's fist: no moving until thrown.
      else if (combat.held) { /* the combat system carries the hero */ }
      else stepController(controller, {
        move,
        sprint: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
        jump: space && !combat.busy,
        jumpHeld: input.isDown('Space'),
        // Space again in the air takes off; hold Space to climb, C to dive, X to let go (Ctrl+W would close the tab).
        fly: space,
        ascend: input.isDown('Space'),
        descend: input.isDown('KeyC'),
        stopFly: input.locked && input.justPressed('KeyX'),
      }, world, dt);
      // Portals: step into one to cross between the island and the realms.
      portalCooldown -= dt;
      if (portalCooldown <= 0) {
        for (const l of area.portals) {
          if (Math.hypot(controller.pos.x - l.at.x, controller.pos.z - l.at.z) > l.radius || Math.abs(controller.pos.y - l.at.y) > l.height) continue;
          // No portal works inside the frog's dream (there are none there) — nor out of it.
          if (adventures.dreamLeft > 0) break;
          teleport(l.to.x, world.heightAt(l.to.x, l.to.z), l.to.z, l.to.yaw, l.name);
          tpc.yaw = l.to.cameraYaw;
          break;
        }
      }
      // Fallen out of the world: back on the island's spawn, or, out of a realm, back in the middle of that realm.
      const fallRealm = REALMS.find((r) => Math.hypot(controller.pos.x - r.x, controller.pos.z - r.z) < r.radius);
      if (controller.pos.y < (fallRealm ? fallRealm.y - 30 : -70)) {
        const to = fallRealm ? { x: fallRealm.x, z: fallRealm.z, y: world.heightAt(fallRealm.x, fallRealm.z, fallRealm.y + 60) } : SPAWN;
        teleport(to.x, to.y, to.z, controller.yaw);
        controller.flung = 0;
      }
      playerPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      const targets = companions.length ? combat.enemies.map((e) => ({ id: e.id, pos: e.pos, alive: e.alive, aggro: e.aggro })) : [];
      for (const c of companions) {
        const strike = c.update(dt, playerPos, controller.yaw, targets);
        if (strike !== null) { combat.companionStrike(strike, c.def.hire!.atk); audio.swing(false); }
      }
      hud.setStamina(controller.stamina, CONTROLLER.maxStamina);
      // The F prompt, ten times a second (pressing F looks again at once).
      interactIn -= dt;
      if (interactIn <= 0) { interactIn = 0.1; const t = interactTarget(); hud.setInteract(t ? t.label : null); }
      input.endStep();
    },
    render(alpha, dt) {
      // In a boat the river carries you even while a conversation pauses the game.
      adventures.pinToBoat();
      const rig = rigs[party.activeIndex];
      // Drawn between the last two fixed steps (smooth on 120/144 Hz screens); a jump of metres is a teleport.
      drawPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      if (!adventures.riding && !game.paused && drawPos.distanceToSquared(prevPos) < 16) drawPos.lerpVectors(prevPos, drawPos, Math.min(1, alpha));
      rig.root.position.copy(drawPos);
      rig.root.rotation.y = yawToRotation(controller.yaw);
      const airborne = controller.mode === 'air' || controller.mode === 'fly';
      if (wasAirborne && !airborne) landedAt = performance.now() / 1000;
      wasAirborne = airborne;
      rig.animate({
        mode: controller.mode,
        speed: Math.hypot(controller.vel.x, controller.vel.z),
        attack: combat.attackProgress,
        attackKind: combat.attackKind,
        attackDuration: combat.attackDuration,
        charging: combat.charging > 0,
        landed: performance.now() / 1000 - landedAt,
        burst: combat.burstState,
      }, dt);
      // Benched party members are hidden: no need to animate them.
      combat.render(dt);
      lightBudget.update(playerPos);
      focus.set(drawPos.x, drawPos.y + 1.4, drawPos.z);
      if (!input.locked && hud.panel === 'none') {
        cinematicT += dt;
        const u = (Math.sin(cinematicT * 0.045) + 1) / 2;
        camera.position.set(Math.sin(cinematicT * 0.1) * 2.5, 8.5 + u * 6, 150 - u * 95);
        camera.lookAt(HEAD_EYES.x, HEAD_EYES.y * 0.55, HEAD_EYES.z);
        wasLocked = false;
      } else {
        if (!wasLocked) { tpc.snapTo(focus); wasLocked = true; }
        tpc.update(focus, dt);
        // `?cam=x,y,z` (debug) pins the camera at a world position looking at the `face` point.
        if (camParam) { camera.position.set(camParam[0], camParam[1], camParam[2]); const fx = faceParam ? faceParam[0] : SPAWN.x; const fz = faceParam ? faceParam[1] : SPAWN.z; camera.lookAt(fx, world.heightAt(fx, fz) + 1.2, fz); }
        // Sizzlin' Slowness: the world leans a little and sways while the lean has hold of you.
        tilt += ((combat.slowed > 0 ? 0.07 + Math.sin(performance.now() / 700) * 0.025 : 0) - tilt) * Math.min(1, dt * 3);
        if (Math.abs(tilt) > 1e-4) camera.rotateZ(tilt);
      }
      playerPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      sky.update(dt, camera.position);
      moonFace.update(dt);
      const auroraNear = Math.max(0, 1 - Math.hypot(playerPos.x - area.auroraCentre.x, playerPos.z - area.auroraCentre.z) / 90);
      const kingNear = Math.max(0, Math.min(1, 1 - (Math.hypot(playerPos.x - 57, playerPos.z + 129) - 50) / 70));
      skyEvents.update(dt, camera.position, auroraNear, kingNear);
      area.update(dt, camera.position, playerPos, talking);
      atmosphere.update(dt, playerPos, camera.position);
      // Realm fog and the sunken city's bubbles.
      const realm = REALMS.find((r) => Math.hypot(playerPos.x - r.x, playerPos.z - r.z) < r.radius);
      fogTarget.set(realm ? realm.fog.color : islandFog.color);
      // The frog's dream: the fog drifts through every hue.
      if (realm?.cycle) fogTarget.setHSL((performance.now() / 1000 * 0.035) % 1, 0.7, 0.24);
      fog.color.lerp(fogTarget, Math.min(1, dt * 3));
      fog.density += ((realm ? realm.fog.density : islandFog.density) - fog.density) * Math.min(1, dt * 3);
      bubbles.group.visible = !!realm?.underwater;
      // Each world has its own grade (bloom, saturation, lift); the renderer blends toward it.
      renderer.setLook(LOOKS[realm?.id ?? 'island'] ?? LOOKS.island);
      sky.setPreset(SKIES[realm?.id ?? 'island'] ?? SKIES.island);
      // A realm with a sky of its own (the kingdom, the frog's dream) hides the island's moon, stars and aurora.
      sky.group.visible = skyEvents.group.visible = !realm?.ownSky;
      // Yung Lean's kingdom has its own music (an underwater arrival, a hum, a slow beat).
      const inKingdom = realm?.id === 'galaxy';
      if (inKingdom !== wasInKingdom) { audio.kingdom(inKingdom); wasInKingdom = inKingdom; }
      bubbles.update(dt, camera.position);
      if (weather.update(dt, playerPos, world.ceilingAt(playerPos.x, playerPos.z, playerPos.y) < playerPos.y + 40) > 0) sky.flash = 1;
      hemi.intensity = 0.7 + sky.flash * 2.2;
      moon.intensity = 1.5 + sky.flash * 1.5;
      moon.position.copy(playerPos).addScaledVector(sky.moonDir, 240);
      moon.target.position.copy(playerPos);
      fill.position.set(playerPos.x + 70, playerPos.y + 60, playerPos.z + 110);
      fill.target.position.copy(playerPos);
      hud.setLocked(input.locked);
      if (input.hold && !audio.suspended) { input.hold = false; hud.setPress('CLICK TO ENTER THE FOG'); }
      if (titleMusic && input.locked) { audio.title(false); titleMusic = false; }
      game.paused = !input.locked;
      minimap.draw(controller.pos.x, controller.pos.z, tpc.yaw, combat.enemies.map((e) => ({ x: e.pos.x, z: e.pos.z, alive: e.alive, aggro: e.aggro, boss: !!e.def.boss })), inventory.reveals(), area.npcs.map((n) => ({ x: n.pos.x, z: n.pos.z })));
      renderer.render(scene, camera);
    },
  });
game.start();

declare global {
  interface Window {
    __ginseng: {
      scene: Scene; camera: PerspectiveCamera; terrain: Terrain; world: World['heights']; area: World; sky: Sky; controller: typeof controller;
      party: Party<(typeof ROSTER)[number]>; tpc: ThirdPersonCamera; input: Input; game: Game; renderer: Renderer; combat: CombatSystem;
      inventory: Inventory; hud: Hud; companions: Companion[]; audio: Audio;
      /** Quests and side adventures; F and its current target (headless checks press F without pointer lock). */
      adventures: Adventures; pressF: () => void; interactTarget: typeof interactTarget;
    };
  }
}
window.__ginseng = { scene, camera, terrain, world, area, sky, controller, party, tpc, input, game, renderer, combat, inventory, hud, companions, audio, adventures, pressF, interactTarget };

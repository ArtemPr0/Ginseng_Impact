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
import { DISTRICT_AIR, LAYOUT, leanDistrict, REALMS, VALE, ZONE_LIGHT } from './data/world';
import { kingdomNight } from './world/Kingdom';
import { Inventory } from './items/Inventory';
import { riverAt } from './world/Terrain';
import { ITEMS } from './items/Items';
import { CONTROLLER, createControllerState, startDash, stepController } from './player/CharacterController';
import { Party } from './player/Party';
import { ThirdPersonCamera } from './player/ThirdPersonCamera';
import { Atmosphere } from './render/Atmosphere';
import { GROUND_UNIFORMS } from './render/GroundMaterial';
import { PALETTE } from './render/palette';
import { LOOKS, Renderer } from './render/Renderer';
import { CARRIAGE } from './world/Carriage';
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
import { Events, type HeroId } from './game/Events';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();
/** The game's event bus: what happens is announced here (for the NPC minds, the world state and the save). */
const events = new Events();
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
// The place's light (ZONE_LIGHT), blended toward each frame.
const light = { hemi: 0.7, moon: 1.5, fill: 0.75, cameraFill: 0 };
const lightSky = new Color(PALETTE.cobalt), lightGround = new Color(PALETTE.abyss), lightFill = new Color(0x8fa5f0);
const lightTo = new Color();
const fillFixed = new Vector3(), fillCam = new Vector3(), fillAim = new Vector3();
/** On the carriage's bench, facing where it goes. */
const benchAt = new Vector3();
function pinToCarriage(): void {
  CARRIAGE.bench(benchAt);
  controller.pos.x = benchAt.x; controller.pos.y = benchAt.y; controller.pos.z = benchAt.z;
  controller.vel.x = controller.vel.y = controller.vel.z = 0;
  controller.mode = 'ground';
  controller.yaw = CARRIAGE.heading;
}
/** The hero's height last frame, for the climb clip's pace. */
let lastClimbY = 0;

const terrain = new Terrain();
scene.add(terrain.group);
const minimap = new Minimap(document.getElementById('hud')!, terrain);
const area = new World(terrain);
scene.add(area.group);
const world = area.heights;
if (debugAt) (window as unknown as { __dbg: unknown }).__dbg = { h: (x: number, z: number) => world.heightAt(x, z), river: (x: number, z: number) => riverAt(x, z), rigs: () => rigs, combat: () => combat, npcs: () => area.npcs, audio, gl: () => renderer.gl, renderer, world: () => area, camera, terrain, sky, atmosphere: () => atmosphere, weather: () => weather };
const atmosphere = new Atmosphere((x, z) => world.heightAt(x, z), new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z));
scene.add(atmosphere.group);
const weather = new Weather(LAYOUT.rainZone, LAYOUT.snowZones);
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
/** What the body was doing last step (flight, a swim, a climb, a mushroom bounce, the carriage's reins): each is announced once, on entry. */
let lastMode = controller.mode;
let wasBouncing = false;
let wasDriving = false;
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

/** Who lies at 0 HP: not switchable, and their portrait says so. */
function fallen(): boolean[] {
  return ROSTER.map((d) => (combat.hp.get(d.id) ?? d.maxHp) <= 0);
}

function switchTo(i: number): boolean {
  const down = fallen();
  const swap = party.switchTo(i, (j) => !down[j]);
  if (!swap) {
    if (down[i] && i !== party.activeIndex) hud.announce(`${ROSTER[i].name} is down`);
    return false;
  }
  rigs[swap.from].root.visible = rigs[swap.from].trailObject.visible = false;
  rigs[swap.to].root.visible = rigs[swap.to].trailObject.visible = true;
  hud.setParty(ROSTER, swap.to, down);
  combat.onSwitch();
  audio.click();
  events.emit({ kind: 'hero', hero: ROSTER[swap.to].id as HeroId });
  return true;
}

Npc.sound = { voice: (url, gain, channel) => audio.voice(url, gain, channel), slurp: (gain) => audio.slurp(gain) };
// (Rig.sound.slurp is Sir Aldric's own cup of lean: the hero's sip is a feat.)
Rig.sound = { slurp: (gain) => { audio.slurp(gain); events.emit({ kind: 'feat', what: 'sip' }); }, rustle: () => audio.rustle(), munch: () => audio.munch() };
const lightBudget = new LightBudget(scene, 6);
lightBudget.collect(scene);

const combat = new CombatSystem({
  scene, world, sky, hud, camera, game, audio, inventory, controller, party, spawn: SPAWN, events,
  onForceSwitch: (i) => { party.update(Party.cooldown); switchTo(i); },
  onShake: (a) => tpc.shake(a),
  onTrip: (strength, seconds) => renderer.trip(strength, seconds),
  onKill: (kind) => adventures.quests.kill(kind),
  muzzle: () => rigs[party.activeIndex].muzzle(new Vector3()),
  // A wipe also ends the frog's dream (otherwise its clock would run on, and block the portals, back on the island).
  // (Everyone stands again after a wipe: the portraits lose their `down`.)
  onWipe: () => { adventures.riding = null; wasLocked = false; if (adventures.dreamLeft > 0) adventures.wake(); hud.setParty(ROSTER, party.activeIndex, fallen()); },
  // A roll along the stick, or a backstep: the controller carries it (an impulse alone was eaten by the ground drag).
  onDodge: () => startDash(controller, tpc.moveToWorld(input.moveAxis())),
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
  controller, world: area, hud, audio, inventory, teleport, events, activeRig: () => rigs[party.activeIndex], debuffs: () => combat.debuffs,
  trip: (strength, seconds) => renderer.trip(strength, seconds),
  fight: { spawnBoss: (kind, x, z, yaw) => combat.spawnBoss(kind, x, z, yaw), despawn: (e) => combat.despawn(e) },
});
area.hooks.events = events;
area.hooks.soundWanted = () => adventures.quests.stage('sound') === 'active';
area.hooks.foundSound = () => adventures.foundSound();
area.hooks.teleport = teleport;
area.hooks.trip = (strength, seconds) => renderer.trip(strength, seconds);
area.hooks.shoot = (from, s) => combat.hostileShot(from, s);
area.hooks.hurt = (atk, poison) => combat.hazard(atk, poison);
area.hooks.mire = (seconds) => combat.mire(seconds);
// Shootable things in the world (sky eyes, the eye pool), and the prize for shooting every sky eye.
combat.targets.push(...area.shotTargets);
area.hooks.reward = (what) => {
  if (what !== 'eyes') return;
  events.emit({ kind: 'feat', what: 'skyeye' });
  combat.loot.spawn([{ kind: 'shards', amount: 60 }, { kind: 'item', itemId: 'moon-dew', count: 2 }], new Vector3(controller.pos.x, controller.pos.y + 1, controller.pos.z));
  hud.announce('The sky blinks first · 60 shards');
  audio.loot(4);
};
area.hooks.board = (boat) => { adventures.riding = boat; audio.footstep(); hud.announce('Aboard · F talk · SPACE jump off'); };
adventures.openRowers = () => {
  const node = adventures.talk('rowers');
  if (node) { events.emit({ kind: 'talk', npc: 'rowers' }); openPanel(() => hud.dialogue({ name: 'The Rowers', title: 'Two Knights and a Boat' }, node, adventures.onLine)); }
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
    events.emit({ kind: 'trade', what: 'buy', item: itemId });
    audio.coins(3);
    hud.announce(`${ITEMS[itemId].name} acquired`);
    return true;
  },
  onSell: (uid, count) => { const item = inventory.entries.find((x) => x.uid === uid)?.itemId; const gain = inventory.sell(uid, count); if (gain > 0) audio.coins(2); if (gain > 0 && item) events.emit({ kind: 'trade', what: 'sell', item }); },
  onHire: (npc) => {
    if (!npc.hire || companions.length >= 3 || companions.some((c) => c.def.id === npc.id)) return 'full';
    if (!inventory.spend(npc.hire.cost)) return 'poor';
    // The one who follows you leaves their post (no twin standing where they used to be).
    const post = area.npcs.find((n) => n.def.id === npc.id);
    if (post) post.hidden = true;
    // The first free place at your heels (one sent home leaves a gap).
    let slot = 0;
    while (companions.some((c) => c.slot === slot)) slot++;
    const c = new Companion(npc, new Vector3(controller.pos.x, controller.pos.y, controller.pos.z), (x, z, y) => world.heightAt(x, z, y), slot);
    companions.push(c);
    scene.add(c.rig.root, c.rig.trailObject);
    hud.setCompanions(companions.map((x) => x.def.name));
    audio.fanfare();
    hud.announce(`${npc.name} joins you`);
    events.emit({ kind: 'trade', what: 'hire', item: npc.id });
    return 'ok';
  },
  onEquip: (uid) => {
    const me = party.active;
    const ok = inventory.equip(uid, me.id, me.weapon);
    if (ok) { audio.click(); const e = inventory.entries.find((x) => x.uid === uid)!; hud.announce(`${me.name} wields ${ITEMS[e.itemId].name}`); events.emit({ kind: 'trade', what: 'equip', item: e.itemId }); }
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
/** The realm pause: a slow circle of the hero (radians per second), and the camera rig's pitch and distance for it. */
const ORBIT = { rate: 0.12, pitch: 0.22, distance: 6 };
/** The gameplay camera's pitch and distance while the orbit borrows the rig; put back on relock (its yaw stays where the orbit left it: no pop). */
let orbitFrom: { pitch: number; distance: number } | null = null;
function endOrbit(): void {
  if (!orbitFrom) return;
  tpc.pitch = orbitFrom.pitch;
  tpc.distance = orbitFrom.distance;
  orbitFrom = null;
}

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
  camera.aspect = renderer.aspect;
  camera.updateProjectionMatrix();
});

/** What F would do right now: loot first, then talk; last, a companion you walked up to goes home. */
function interactTarget(): { kind: 'loot'; take: () => void; label: string } | { kind: 'use'; act: () => void; label: string } | { kind: 'talk'; npc: Npc; label: string } | { kind: 'dismiss'; companion: Companion; label: string } | null {
  const p = interactAt.set(controller.pos.x, controller.pos.y, controller.pos.z);
  const pickup = combat.loot.nearest(p, 2.8);
  if (pickup && pickup.drop.kind === 'item') {
    const def = ITEMS[pickup.drop.itemId];
    return { kind: 'loot', label: `Take ${def.name}`, take: () => { combat.loot.take(pickup); inventory.add(def.id, 1); audio.loot(def.rarity); hud.announce(`${def.name}`); events.emit({ kind: 'loot', item: def.id, rarity: def.rarity }); } };
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
  // A companion waiting at your side (you stood still by it, walked up to it and face it; no enemy on its mind): send it home.
  let comp: Companion | null = null;
  let cd = Infinity;
  for (const c of companions) {
    const d = Math.hypot(c.pos.x - p.x, c.pos.z - p.z);
    if (d < cd && c.beside) { cd = d; comp = c; }
  }
  if (comp) return { kind: 'dismiss', companion: comp, label: `Send ${comp.def.name} home` };
  return null;
}

/** Sends a companion home: off the scene, back at their post (the hire hid it), hireable again. */
function dismiss(c: Companion): void {
  companions.splice(companions.indexOf(c), 1);
  scene.remove(c.rig.root, c.rig.trailObject);
  const post = area.npcs.find((n) => n.def.id === c.def.id);
  if (post) post.hidden = false;
  hud.setCompanions(companions.map((x) => x.def.name));
  hud.unhire(c.def.id);
  audio.click();
  hud.announce(`${c.def.name} goes home`);
  events.emit({ kind: 'trade', what: 'dismiss', item: c.def.id });
}

/** F: take the loot, use the door or boat (or put the sack down), talk to whoever is near, or send a companion home. */
function pressF(): void {
  const t = interactTarget();
  if (t?.kind === 'loot') t.take();
  else if (t?.kind === 'use') t.act();
  else if (t?.kind === 'talk') {
    talking = t.npc;
    audio.talk();
    events.emit({ kind: 'talk', npc: t.npc.def.id });
    // A conversation with choices (quests) when the NPC has one; otherwise its ordinary lines.
    const node = adventures.talk(t.npc.def.id);
    if (node) openPanel(() => hud.dialogue(t.npc.def, node, adventures.onLine));
    else { t.npc.speak(); openPanel(() => hud.talk(t.npc.def)); }
  } else if (t?.kind === 'dismiss') dismiss(t.companion);
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
      // Driving the carriage: W/S and A/D take the reins, Space climbs down.
      else if (CARRIAGE.driving) {
        if (space) { CARRIAGE.driving = false; CARRIAGE.speed = 0; controller.vel.y = 5; controller.mode = 'air'; }
        else CARRIAGE.drive(input.locked ? (input.isDown('KeyW') ? 1 : 0) - (input.isDown('KeyS') ? 1 : 0) : 0, input.locked ? (input.isDown('KeyA') ? 1 : 0) - (input.isDown('KeyD') ? 1 : 0) : 0, dt);
        if (CARRIAGE.driving) pinToCarriage();
      }
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
        hold: combat.busy || combat.charging > 0,
      }, world, dt);
      // Feats of movement, once per entry: a take-off, a swim, a climb, a mushroom bounce, taking the carriage's reins.
      if (controller.mode !== lastMode) { if (controller.mode === 'fly' || controller.mode === 'swim' || controller.mode === 'climb') events.emit({ kind: 'feat', what: controller.mode }); lastMode = controller.mode; }
      if (!!controller.bouncing !== wasBouncing) { if (controller.bouncing) events.emit({ kind: 'feat', what: 'bounce' }); wasBouncing = !!controller.bouncing; }
      if (CARRIAGE.driving !== wasDriving) { if (CARRIAGE.driving) events.emit({ kind: 'feat', what: 'carriage' }); wasDriving = CARRIAGE.driving; }
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
      if (CARRIAGE.driving) pinToCarriage();
      const rig = rigs[party.activeIndex];
      // Drawn between the last two fixed steps (smooth on 120/144 Hz screens); a jump of metres is a teleport.
      drawPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      if (!adventures.riding && !CARRIAGE.driving && !game.paused && drawPos.distanceToSquared(prevPos) < 16) drawPos.lerpVectors(prevPos, drawPos, Math.min(1, alpha));
      rig.root.position.copy(drawPos);
      rig.root.rotation.y = yawToRotation(controller.yaw);
      const airborne = controller.mode === 'air' || controller.mode === 'fly';
      if (wasAirborne && !airborne) landedAt = performance.now() / 1000;
      wasAirborne = airborne;
      // Hit-stop freezes the bodies on the blow (the hero's and the enemies'); the world's effects keep real time.
      const animDt = game.hitStop > 0 ? 0 : dt;
      rig.animate({
        mode: controller.mode,
        speed: Math.hypot(controller.vel.x, controller.vel.z),
        attack: combat.attackProgress,
        attackKind: combat.attackKind,
        attackDuration: combat.attackDuration,
        charging: combat.charging > 0,
        landed: performance.now() / 1000 - landedAt,
        burst: combat.burstState,
        climbRate: controller.mode === 'climb' && dt > 0 ? (controller.pos.y - lastClimbY) / dt + Math.hypot(controller.vel.x, controller.vel.z) * 0.5 * Math.sign(controller.pos.y - lastClimbY || 1) : 0,
        hurt: combat.hurtState,
        dodge: combat.dodgeState,
        dead: combat.dead,
      }, animDt);
      lastClimbY = controller.pos.y;
      // Benched party members are hidden: no need to animate them (companions animate in the fixed step, which hit-stop pauses).
      combat.render(animDt);
      lightBudget.update(playerPos);
      focus.set(drawPos.x, drawPos.y + 1.4, drawPos.z);
      if (!input.locked && hud.panel === 'none') {
        if (REALMS.some((r) => Math.hypot(drawPos.x - r.x, drawPos.z - r.z) < r.radius)) {
          // Inside a realm the island (and the causeway the dolly rides) is hidden: circle the hero slowly instead, on
          // the camera's own spring arm, so a room's walls pull it in rather than let it through them (the indoor
          // realms are smaller than the circle). It takes over from where the camera was and eases out to 6 m.
          if (!orbitFrom) orbitFrom = { pitch: tpc.pitch, distance: tpc.distance };
          const ease = Math.min(1, dt * 2);
          tpc.pitch += (ORBIT.pitch - tpc.pitch) * ease;
          tpc.yaw += ORBIT.rate * dt;
          // The arm's own look-ahead samples its length at half-metre steps, so as it eases out a thin solid (a cell of
          // the tavern's hearth wall) can slip between two of them and the floor clamp pops the camera onto it: march
          // the orbit line finely first and let the rig out only as far as it is clear (in at once, out eased).
          const cp = Math.cos(tpc.pitch), sp = Math.sin(tpc.pitch);
          const ox = Math.sin(tpc.yaw) * cp, oz = Math.cos(tpc.yaw) * cp;
          let clear = ORBIT.distance;
          for (let r = 0.3; r <= ORBIT.distance; r += 0.1) {
            const y = focus.y + sp * r;
            if (y < world.heightAt(focus.x + ox * r, focus.z + oz * r, y) + 0.5) { clear = Math.max(0.6, r - 0.4); break; }
          }
          tpc.distance = Math.min(clear, tpc.distance + (ORBIT.distance - tpc.distance) * ease);
          tpc.update(focus, dt);
        } else {
          endOrbit();
          cinematicT += dt;
          const u = (Math.sin(cinematicT * 0.045) + 1) / 2;
          camera.position.set(Math.sin(cinematicT * 0.1) * 2.5, 8.5 + u * 6, 150 - u * 95);
          camera.lookAt(HEAD_EYES.x, HEAD_EYES.y * 0.55, HEAD_EYES.z);
        }
        wasLocked = false;
      } else {
        if (!wasLocked) { endOrbit(); tpc.snapTo(focus); wasLocked = true; }
        tpc.update(focus, dt);
        // `?cam=x,y,z` (debug) pins the camera at a world position looking at the `face` point.
        if (camParam) { camera.position.set(camParam[0], camParam[1], camParam[2]); const fx = faceParam ? faceParam[0] : SPAWN.x; const fz = faceParam ? faceParam[1] : SPAWN.z; camera.lookAt(fx, world.heightAt(fx, fz) + 1.2, fz); }
        // Sizzlin' Slowness: the world leans a little and sways while the lean has hold of you.
        tilt += ((combat.slowed > 0 ? 0.07 + Math.sin(performance.now() / 700) * 0.025 : 0) - tilt) * Math.min(1, dt * 3);
        if (Math.abs(tilt) > 1e-4) camera.rotateZ(tilt);
      }
      playerPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      // The ground's level of detail follows the camera; its splat shader's clock runs with the frame.
      terrain.update(camera.position);
      GROUND_UNIFORMS.uTime.value += dt;
      sky.update(dt, camera.position);
      moonFace.update(dt);
      // (Strong over the church; full over the Dragon's Vale, where the reel's aurora hangs.)
      const inVale = Math.hypot(playerPos.x - VALE.x, playerPos.z - VALE.z) < VALE.radius;
      const auroraNear = inVale ? 1 : Math.max(0, 1 - Math.hypot(playerPos.x - area.auroraCentre.x, playerPos.z - area.auroraCentre.z) / 90);
      const kingNear = Math.max(0, Math.min(1, 1 - (Math.hypot(playerPos.x - 57, playerPos.z + 129) - 50) / 70));
      skyEvents.update(dt, camera.position, auroraNear, kingNear);
      area.update(dt, camera.position, playerPos, talking);
      atmosphere.update(dt, playerPos, camera.position);
      // Realm fog and the sunken city's bubbles.
      const realm = REALMS.find((r) => Math.hypot(playerPos.x - r.x, playerPos.z - r.z) < r.radius);
      // The kingdom's quarters are moonlit night (the @returndark reels); its plaza and cups stay vaporwave.
      const district = realm?.id === 'galaxy' ? leanDistrict(playerPos.x, playerPos.z) : null;
      const air = district ? DISTRICT_AIR[district] : null;
      fogTarget.set(air ? air.fog : realm ? realm.fog.color : islandFog.color);
      // The frog's dream: the fog drifts through every hue.
      if (realm?.cycle) fogTarget.setHSL((performance.now() / 1000 * 0.035) % 1, 0.7, 0.24);
      fog.color.lerp(fogTarget, Math.min(1, dt * 3));
      fog.density += ((air ? air.density : realm ? realm.fog.density : islandFog.density) - fog.density) * Math.min(1, dt * 3);
      kingdomNight.value += ((air?.night ?? 0) - kingdomNight.value) * Math.min(1, dt * 1.5);
      bubbles.group.visible = !!realm?.underwater;
      atmosphere.group.visible = !realm?.indoors;
      // Each world has its own grade (bloom, saturation, lift); the renderer blends toward it.
      renderer.setLook(LOOKS[air?.look ?? realm?.id ?? 'island'] ?? LOOKS.island);
      sky.setPreset(SKIES[realm?.id ?? 'island'] ?? SKIES.island);
      // A realm with a sky of its own (the kingdom, the frog's dream) hides the island's moon, stars and aurora.
      sky.group.visible = skyEvents.group.visible = !realm?.ownSky;
      // Yung Lean's kingdom has its own music (an underwater arrival, a hum, a slow beat).
      const inKingdom = realm?.id === 'galaxy';
      if (inKingdom !== wasInKingdom) { audio.kingdom(inKingdom); wasInKingdom = inKingdom; }
      bubbles.update(dt, camera.position);
      if (weather.update(dt, playerPos, world.ceilingAt(playerPos.x, playerPos.z, playerPos.y) < playerPos.y + 40) > 0) sky.flash = 1;
      const zl = ZONE_LIGHT[district ? 'lean' : realm?.id ?? 'island'] ?? ZONE_LIGHT.island;
      const lk = Math.min(1, dt * 2);
      light.hemi += (zl.hemi - light.hemi) * lk;
      light.moon += (zl.moon - light.moon) * lk;
      light.fill += (zl.fill - light.fill) * lk;
      light.cameraFill += (zl.cameraFill - light.cameraFill) * lk;
      hemi.color.copy(lightSky.lerp(lightTo.set(zl.sky), lk));
      hemi.groundColor.copy(lightGround.lerp(lightTo.set(zl.ground), lk));
      fill.color.copy(lightFill.lerp(lightTo.set(zl.fillColor), lk));
      hemi.intensity = light.hemi + sky.flash * 2.2;
      moon.intensity = light.moon + sky.flash * 1.5;
      moon.position.copy(playerPos).addScaledVector(sky.moonDir, 240);
      moon.target.position.copy(playerPos);
      fill.intensity = light.fill;
      // The fill from the south-east, or swung round to shine from just above the camera along its view.
      fillFixed.set(playerPos.x + 70, playerPos.y + 60, playerPos.z + 110);
      camera.getWorldDirection(fillAim);
      fillCam.copy(camera.position).addScaledVector(fillAim, -40);
      fillCam.y = camera.position.y + 18;
      fill.position.lerpVectors(fillFixed, fillCam, light.cameraFill);
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
      /** The party's bodies (bones, held props), in roster order. */
      rigs: typeof rigs;
      /** The event bus: what happened (kills, hurts, zones, talks, loot, trades, quests, feats). */
      events: Events;
    };
  }
}
window.__ginseng = { scene, camera, terrain, world, area, sky, controller, party, tpc, input, game, renderer, combat, inventory, hud, companions, audio, adventures, pressF, interactTarget, rigs, events };

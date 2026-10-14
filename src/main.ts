import { Color, DirectionalLight, FogExp2, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { REALMS } from './data/world';
import { Bubbles } from './world/Portal';
import { yawToRotation } from './models/ModelRig';
import { Audio } from './audio/Audio';
import { Rig } from './characters/Rig';
import { ROSTER } from './characters/roster';
import { CombatSystem } from './combat/CombatSystem';
import { Game } from './core/Game';
import { Input } from './core/Input';
import { LAYOUT } from './data/world';
import { Inventory } from './items/Inventory';
import { riverAt } from './world/Terrain';
import { ITEMS } from './items/Items';
import { CONTROLLER, createControllerState, stepController } from './player/CharacterController';
import { Party } from './player/Party';
import { ThirdPersonCamera } from './player/ThirdPersonCamera';
import { Atmosphere } from './render/Atmosphere';
import { PALETTE } from './render/palette';
import { Renderer } from './render/Renderer';
import { Sky } from './render/Sky';
import { SkyEvents } from './render/SkyEvents';
import { Weather } from './render/Weather';
import { Hud } from './ui/Hud';
import { Minimap } from './ui/Minimap';
import { Companion } from './world/Companion';
import { Npc } from './world/NPCs';
import { Terrain } from './world/Terrain';
import { World } from './world/World';

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
if (debugAt) (window as unknown as { __dbg: unknown }).__dbg = { h: (x: number, z: number) => world.heightAt(x, z), river: (x: number, z: number) => riverAt(x, z), rigs: () => rigs, combat: () => combat, npcs: () => area.npcs, audio };
const atmosphere = new Atmosphere((x, z) => world.heightAt(x, z), new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z));
scene.add(atmosphere.group);
const weather = new Weather(LAYOUT.rainZone, LAYOUT.snowZone);
scene.add(weather.group);
const playerPos = new Vector3();

// --- player ---
// `?at=x,z` starts the party at a world position (used to check landmarks and bosses quickly).
const atParam = new URLSearchParams(location.search).get('at')?.split(',').map(Number);
const SPAWN = atParam && atParam.length === 2 && atParam.every((n) => Number.isFinite(n)) ? new Vector3(atParam[0], 0, atParam[1]) : new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z);
SPAWN.y = world.heightAt(SPAWN.x, SPAWN.z);
const controller = createControllerState(SPAWN);
const party = new Party(ROSTER);
const rigs = ROSTER.map((def) => new Rig(def));
for (const r of rigs) {
  r.root.visible = false;
  scene.add(r.root, r.trailObject);
}
let landedAt = -10;
let wasAirborne = false;
rigs[party.activeIndex].root.visible = true;
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
  rigs[swap.from].root.visible = false;
  rigs[swap.to].root.visible = true;
  hud.setParty(ROSTER, swap.to);
  combat.onSwitch();
  audio.click();
  return true;
}

Npc.sound = { voice: (url, gain) => audio.voice(url, gain), slurp: (gain) => audio.slurp(gain) };

const combat = new CombatSystem({
  scene, world, sky, hud, camera, game, audio, inventory, controller, party, spawn: SPAWN,
  onForceSwitch: (i) => { party.update(Party.cooldown); switchTo(i); },
  onShake: (a) => tpc.shake(a),
  muzzle: () => rigs[party.activeIndex].muzzle(new Vector3()),
  onDodge: () => {
    const axis = input.moveAxis();
    const dir = axis.x === 0 && axis.z === 0 ? { x: -Math.cos(controller.yaw), z: -Math.sin(controller.yaw) } : tpc.moveToWorld(axis);
    controller.vel.x += dir.x * 11;
    controller.vel.z += dir.z * 11;
  },
});

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
  void canvas.requestPointerLock();
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
    if (!npc.hire || companions.length >= 3 || companions.some((c) => c.def.id === npc.id)) return false;
    if (!inventory.spend(npc.hire.cost)) return false;
    const c = new Companion(npc, new Vector3(controller.pos.x, controller.pos.y, controller.pos.z), (x, z) => world.heightAt(x, z), companions.length);
    companions.push(c);
    scene.add(c.rig.root, c.rig.trailObject);
    hud.setCompanions(companions.map((x) => x.def.name));
    audio.fanfare();
    hud.announce(`${npc.name} joins you`);
    return true;
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
    if (!e || e.equippedBy) return;
    inventory.remove(e.itemId, 1);
    combat.loot.spawn([{ kind: 'item', itemId: e.itemId, count: 1 }], new Vector3(controller.pos.x, controller.pos.y + 1, controller.pos.z));
  },
  onClose: () => closePanel(),
}, inventory);
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyI') {
    if (hud.panel === 'inventory') closePanel();
    else if (hud.panel === 'none') openPanel(() => hud.inventoryPanel());
  } else if (e.code === 'Escape' && hud.panel !== 'none') closePanel();
});
const unlockAudio = () => audio.unlock();
window.addEventListener('mousedown', unlockAudio);
window.addEventListener('keydown', unlockAudio);

// Title cinematic: a slow dolly up the causeway toward the head while the pointer is not locked.
const HEAD_EYES = new Vector3(LAYOUT.head.x, Math.max(-12, terrain.heightAt(LAYOUT.head.x, LAYOUT.head.z) - 8) + LAYOUT.head.height * 0.69, LAYOUT.head.z);
let cinematicT = 0;
let wasLocked = false;

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
  camera.aspect = renderer.aspect;
  camera.updateProjectionMatrix();
});

/** What F would do right now: loot first, then talk. */
function interactTarget(): { kind: 'loot'; take: () => void; label: string } | { kind: 'talk'; npc: Npc; label: string } | null {
  const p = new Vector3(controller.pos.x, controller.pos.y, controller.pos.z);
  const pickup = combat.loot.nearest(p, 2.8);
  if (pickup && pickup.drop.kind === 'item') {
    const def = ITEMS[pickup.drop.itemId];
    return { kind: 'loot', label: `Take ${def.name}`, take: () => { combat.loot.take(pickup); inventory.add(def.id, 1); audio.loot(def.rarity); hud.announce(`${def.name}`); } };
  }
  let best: Npc | null = null;
  let bd = Infinity;
  for (const n of area.npcs) {
    const d = Math.hypot(n.pos.x - p.x, n.pos.z - p.z);
    if (d < n.talkRange && d < bd && Math.abs(n.pos.y - p.y) < 6) { bd = d; best = n; }
  }
  if (best) return { kind: 'talk', npc: best, label: `Talk to ${best.def.name}` };
  return null;
}

const focus = new Vector3();
game
  .add({
    update(dt) {
      const { dx, dy } = input.takeMouseDelta();
      if (input.locked) tpc.rotate(dx, dy);
      party.update(dt);
      for (let i = 0; i < ROSTER.length; i++) {
        if (input.justPressed(`Digit${i + 1}`)) switchTo(i);
      }
      if (input.locked && input.justPressed('KeyF')) {
        const t = interactTarget();
        if (t?.kind === 'loot') t.take();
        else if (t?.kind === 'talk') { talking = t.npc; audio.talk(); t.npc.speak(); openPanel(() => hud.talk(t.npc.def)); }
      }
      combat.update(dt, {
        attack: input.locked && input.mouseJustPressed(0),
        heavyHeld: input.locked && input.mouseDown(2),
        heavyRelease: input.locked && input.mouseJustReleased(2),
        skill: input.locked && input.justPressed('KeyE'),
        burst: input.locked && input.justPressed('KeyQ'),
        dodge: input.locked && input.justPressed('KeyR'),
      });
      const move = input.locked && !combat.busy && combat.charging === 0 ? tpc.moveToWorld(input.moveAxis()) : { x: 0, z: 0 };
      stepController(controller, {
        move,
        sprint: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
        jump: input.locked && !combat.busy && input.justPressed('Space'),
        jumpHeld: input.isDown('Space'),
        glide: input.locked && input.justPressed('Space'),
        climbHeld: false,
      }, world, dt);
      // Portals: step into one to cross between the island and the realms.
      portalCooldown -= dt;
      if (portalCooldown <= 0) {
        for (const l of area.portals) {
          if (Math.hypot(controller.pos.x - l.at.x, controller.pos.z - l.at.z) > l.radius || Math.abs(controller.pos.y - l.at.y) > l.height) continue;
          controller.pos = { x: l.to.x, y: world.heightAt(l.to.x, l.to.z) + 0.05, z: l.to.z };
          controller.vel = { x: 0, y: 0, z: 0 };
          controller.mode = 'ground';
          controller.yaw = l.to.yaw;
          tpc.yaw = l.to.cameraYaw;
          wasLocked = false;
          for (const c of companions) c.teleport(controller.pos.x, controller.pos.z, world.heightAt(controller.pos.x, controller.pos.z));
          hud.announce(l.name);
          audio.cast();
          portalCooldown = 1.5;
          break;
        }
      }
      if (controller.pos.y < -70) {
        controller.pos = { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z };
        controller.vel = { x: 0, y: 0, z: 0 };
        controller.mode = 'ground';
      }
      playerPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      const targets = combat.enemies.map((e) => ({ id: e.id, pos: e.pos, alive: e.alive, aggro: e.aggro }));
      for (const c of companions) {
        const strike = c.update(dt, playerPos, controller.yaw, targets);
        if (strike !== null) { combat.companionStrike(strike, c.def.hire!.atk); audio.swing(false); }
      }
      hud.setStamina(controller.stamina, CONTROLLER.maxStamina);
      const t = interactTarget();
      hud.setInteract(t ? t.label : null);
      input.endStep();
    },
    render(_alpha, dt) {
      const rig = rigs[party.activeIndex];
      rig.root.position.set(controller.pos.x, controller.pos.y, controller.pos.z);
      rig.root.rotation.y = yawToRotation(controller.yaw);
      const airborne = controller.mode === 'air' || controller.mode === 'glide';
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
        grounded: controller.mode === 'ground',
      }, dt);
      for (const r of rigs) if (r !== rig) r.animate({ mode: 'ground', speed: 0 }, dt);
      combat.render(dt);
      focus.set(controller.pos.x, controller.pos.y + 1.4, controller.pos.z);
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
      }
      playerPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      sky.update(dt, camera.position);
      const auroraNear = Math.max(0, 1 - Math.hypot(playerPos.x - area.auroraCentre.x, playerPos.z - area.auroraCentre.z) / 90);
      const kingNear = Math.max(0, Math.min(1, 1 - (Math.hypot(playerPos.x - 57, playerPos.z + 129) - 50) / 70));
      skyEvents.update(dt, camera.position, auroraNear, kingNear);
      area.update(dt, camera.position, playerPos, talking);
      atmosphere.update(dt, playerPos, camera.position);
      // Realm fog and the sunken city's bubbles.
      const realm = REALMS.find((r) => Math.hypot(playerPos.x - r.x, playerPos.z - r.z) < r.radius);
      fogTarget.set(realm ? realm.fog.color : islandFog.color);
      fog.color.lerp(fogTarget, Math.min(1, dt * 3));
      fog.density += ((realm ? realm.fog.density : islandFog.density) - fog.density) * Math.min(1, dt * 3);
      bubbles.group.visible = !!realm?.underwater;
      bubbles.update(dt, camera.position);
      if (weather.update(dt, playerPos) > 0) sky.flash = 1;
      hemi.intensity = 0.7 + sky.flash * 2.2;
      moon.intensity = 1.5 + sky.flash * 1.5;
      moon.position.copy(playerPos).addScaledVector(sky.moonDir, 240);
      moon.target.position.copy(playerPos);
      fill.position.set(playerPos.x + 70, playerPos.y + 60, playerPos.z + 110);
      fill.target.position.copy(playerPos);
      hud.setLocked(input.locked);
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
    };
  }
}
window.__ginseng = { scene, camera, terrain, world, area, sky, controller, party, tpc, input, game, renderer, combat, inventory, hud, companions, audio };

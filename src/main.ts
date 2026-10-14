import { DirectionalLight, FogExp2, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { Rig } from './characters/Rig';
import { CombatSystem } from './combat/CombatSystem';
import { ROSTER } from './characters/roster';
import { Game } from './core/Game';
import { Input } from './core/Input';
import { CONTROLLER, createControllerState, stepController } from './player/CharacterController';
import { Party } from './player/Party';
import { ThirdPersonCamera } from './player/ThirdPersonCamera';
import { PALETTE } from './render/palette';
import { Atmosphere } from './render/Atmosphere';
import { Renderer } from './render/Renderer';
import { Sky } from './render/Sky';
import { Hud } from './ui/Hud';
import { Minimap } from './ui/Minimap';
import { LAYOUT } from './data/world';
import { Terrain } from './world/Terrain';
import { World } from './world/World';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const hud = new Hud(document.getElementById('hud')!);
const scene = new Scene();
scene.fog = new FogExp2(PALETTE.fog, 0.0062);

const camera = new PerspectiveCamera(65, renderer.aspect, 0.3, 600);
const moon = new DirectionalLight(PALETTE.moon, 1.5);
const fill = new DirectionalLight(0x7f95e0, 0.35);
fill.position.set(70, 60, 110);
const sky = new Sky();
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
scene.add(moon, moon.target, fill, fill.target, new HemisphereLight(PALETTE.cobalt, PALETTE.abyss, 0.55), sky.group);

const terrain = new Terrain();
scene.add(terrain.mesh);
const minimap = new Minimap(document.getElementById('hud')!, terrain);
const area = new World(terrain);
scene.add(area.group);
const world = area.heights;
const atmosphere = new Atmosphere((x, z) => world.heightAt(x, z), new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z));
scene.add(atmosphere.group);
const playerPos = new Vector3();

// --- player ---
const SPAWN = new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z);
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
tpc.snapTo(new Vector3(SPAWN.x, SPAWN.y + 1.4, SPAWN.z));
hud.setParty(ROSTER, party.activeIndex);

function switchTo(i: number): boolean {
  const swap = party.switchTo(i);
  if (!swap) return false;
  rigs[swap.from].root.visible = false;
  rigs[swap.to].root.visible = true;
  hud.setParty(ROSTER, swap.to);
  combat.onSwitch();
  return true;
}

const combat = new CombatSystem({
  scene, world, sky, hud, camera, game, controller, party, rigs, spawn: SPAWN,
  onForceSwitch: (i) => { party.update(Party.cooldown); switchTo(i); },
  onShake: (a) => tpc.shake(a),
});
// Title cinematic: a slow dolly up the causeway toward the head while the pointer is not locked.
const HEAD_EYES = new Vector3(LAYOUT.head.x, Math.max(-12, terrain.heightAt(LAYOUT.head.x, LAYOUT.head.z) - 8) + LAYOUT.head.height * 0.69, LAYOUT.head.z);
let cinematicT = 0;
let wasLocked = false;

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
  camera.aspect = renderer.aspect;
  camera.updateProjectionMatrix();
});

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
      combat.update(dt, { attack: input.locked && input.mouseJustPressed(0), skill: input.locked && input.justPressed('KeyE') });
      const move = input.locked && !combat.busy ? tpc.moveToWorld(input.moveAxis()) : { x: 0, z: 0 };
      stepController(controller, {
        move,
        sprint: input.isDown('ShiftLeft') || input.isDown('ShiftRight'),
        jump: input.locked && input.justPressed('Space'),
        jumpHeld: input.isDown('Space'),
        glide: input.locked && input.justPressed('Space'),
        climbHeld: false,
      }, world, dt);
      if (controller.pos.y < -70) {
        controller.pos = { x: SPAWN.x, y: SPAWN.y, z: SPAWN.z };
        controller.vel = { x: 0, y: 0, z: 0 };
        controller.mode = 'ground';
      }
      hud.setStamina(controller.stamina, CONTROLLER.maxStamina);
      input.endStep();
    },
    render(_alpha, dt) {
      const rig = rigs[party.activeIndex];
      rig.root.position.set(controller.pos.x, controller.pos.y, controller.pos.z);
      rig.root.rotation.y = -controller.yaw - Math.PI / 2;
      const airborne = controller.mode === 'air' || controller.mode === 'glide';
      if (wasAirborne && !airborne) landedAt = performance.now() / 1000;
      wasAirborne = airborne;
      rig.animate({
        mode: controller.mode,
        speed: Math.hypot(controller.vel.x, controller.vel.z),
        attack: combat.attackProgress,
        attackKind: combat.attackKind,
        landed: performance.now() / 1000 - landedAt,
        grounded: controller.mode === 'ground',
      }, dt);
      for (const r of rigs) if (r !== rig) r.animate({ mode: 'ground', speed: 0 }, dt);
      combat.render(dt);
      focus.set(controller.pos.x, controller.pos.y + 1.4, controller.pos.z);
      if (!input.locked) {
        cinematicT += dt;
        const u = (Math.sin(cinematicT * 0.045) + 1) / 2;
        camera.position.set(Math.sin(cinematicT * 0.1) * 2.5, 8.5 + u * 6, 150 - u * 95);
        camera.lookAt(HEAD_EYES.x, HEAD_EYES.y * 0.55, HEAD_EYES.z);
        wasLocked = false;
      } else {
        if (!wasLocked) { tpc.snapTo(focus); wasLocked = true; }
        tpc.update(focus, dt);
      }
      playerPos.set(controller.pos.x, controller.pos.y, controller.pos.z);
      sky.update(dt, camera.position);
      area.update(dt, camera.position, playerPos);
      atmosphere.update(dt, playerPos, camera.position);
      moon.position.copy(playerPos).addScaledVector(sky.moonDir, 240);
      moon.target.position.copy(playerPos);
      fill.position.set(playerPos.x + 70, playerPos.y + 60, playerPos.z + 110);
      fill.target.position.copy(playerPos);
      hud.setLocked(input.locked);
      game.paused = !input.locked;
      minimap.draw(controller.pos.x, controller.pos.z, tpc.yaw, combat.enemies.map((e) => ({ x: e.pos.x, z: e.pos.z, alive: e.alive, aggro: e.aggro })));
      renderer.render(scene, camera);
    },
  });
game.start();

declare global {
  interface Window {
    __ginseng: { scene: Scene; camera: PerspectiveCamera; terrain: Terrain; world: World['heights']; area: World; sky: Sky; controller: typeof controller; party: Party<(typeof ROSTER)[number]>; tpc: ThirdPersonCamera; input: Input; game: Game; renderer: Renderer; combat: CombatSystem };
  }
}
window.__ginseng = { scene, camera, terrain, world, area, sky, controller, party, tpc, input, game, renderer, combat };

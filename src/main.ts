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
import { Renderer } from './render/Renderer';
import { Sky } from './render/Sky';
import { Hud } from './ui/Hud';
import { LAYOUT } from './data/world';
import { Terrain } from './world/Terrain';
import { World } from './world/World';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const game = new Game();
const renderer = new Renderer(canvas);
const input = new Input(canvas);
const hud = new Hud(document.getElementById('hud')!);
const scene = new Scene();
scene.fog = new FogExp2(PALETTE.fog, 0.006);

const camera = new PerspectiveCamera(65, renderer.aspect, 0.3, 600);
const moon = new DirectionalLight(PALETTE.moon, 1.4);
const sky = new Sky();
moon.position.copy(sky.moonDir).multiplyScalar(200);
scene.add(moon, new HemisphereLight(PALETTE.cobalt, PALETTE.abyss, 1.0), sky.group);

const terrain = new Terrain();
scene.add(terrain.mesh);
const area = new World(terrain);
scene.add(area.group);
const world = area.heights;

// --- player ---
const SPAWN = new Vector3(LAYOUT.spawn.x, 0, LAYOUT.spawn.z);
SPAWN.y = world.heightAt(SPAWN.x, SPAWN.z);
const controller = createControllerState(SPAWN);
const party = new Party(ROSTER);
const rigs = ROSTER.map((def) => new Rig(def));
for (const r of rigs) {
  r.root.visible = false;
  scene.add(r.root);
}
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
});

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
      rig.animate({ mode: controller.mode, speed: Math.hypot(controller.vel.x, controller.vel.z), attack: combat.attackProgress }, dt);
      combat.render(dt);
      rig.setShadowHeight(world.heightAt(controller.pos.x, controller.pos.z));
      focus.set(controller.pos.x, controller.pos.y + 1.4, controller.pos.z);
      tpc.update(focus, dt);
      sky.follow(camera.position);
      area.update(dt, camera.position);
      hud.setLocked(input.locked);
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

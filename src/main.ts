import { DirectionalLight, FogExp2, HemisphereLight, PerspectiveCamera, Scene, Vector3 } from 'three';
import { Game } from './core/Game';
import { PALETTE } from './render/palette';
import { Renderer } from './render/Renderer';
import { Sky } from './render/Sky';
import { Terrain } from './world/Terrain';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const renderer = new Renderer(canvas);
const scene = new Scene();
scene.fog = new FogExp2(PALETTE.fog, 0.0085);

const camera = new PerspectiveCamera(65, renderer.aspect, 0.3, 600);

const moon = new DirectionalLight(PALETTE.moon, 1.4);
const sky = new Sky();
moon.position.copy(sky.moonDir).multiplyScalar(200);
scene.add(moon, new HemisphereLight(PALETTE.cobalt, PALETTE.abyss, 1.0), sky.group);

const terrain = new Terrain();
scene.add(terrain.mesh);

// M0 hero view: standing at the spawn end of the causeway line, looking north across the chasm.
const eye = new Vector3(0, terrain.heightAt(0, 120) + 2.2, 120);
const target = new Vector3(0, 14, -200);
camera.position.copy(eye);
camera.lookAt(target);

window.addEventListener('resize', () => {
  renderer.resize(window.innerWidth, window.innerHeight);
  camera.aspect = renderer.aspect;
  camera.updateProjectionMatrix();
});

let t = 0;
const game = new Game()
  .add({
    update(dt) {
      t += dt;
      camera.position.x = eye.x + Math.sin(t * 0.08) * 6;
      camera.position.y = eye.y + Math.sin(t * 0.05) * 0.6;
      camera.lookAt(target);
    },
    render() {
      sky.follow(camera.position);
      renderer.render(scene, camera);
    },
  });
game.start();

declare global {
  interface Window { __ginseng: { scene: Scene; camera: PerspectiveCamera; terrain: Terrain; sky: Sky } }
}
window.__ginseng = { scene, camera, terrain, sky };

/**
 * The Alley of Graves (01.16.54): a straight cracked, mossy path between low stone walls, gravestones crowded on raised
 * plots either side, purple fog along the ground and amber storm clouds overhead (Sky's 'graveyard' preset), a gothic
 * tower at the end, and the cyclops waiting before it. Reached through the demon church's door on the island. Every
 * 35 m or so something happens: skeleton guards, a candle shrine, an open grave that throws you up, the gate.
 * The floor (path and moss) is a shader like the terrain; walls, graves, trees and towers are models.
 */
import { Color, Mesh, type MeshStandardMaterial, PlaneGeometry, ShaderMaterial, UniformsLib, UniformsUtils, Vector3 } from 'three';
import { GRAVEYARD } from '../data/world';
import { MODELS } from '../data/models';
import { fireflies } from '../render/Fireflies';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import type { Footprint, HeightWorld } from './Colliders';
import { fire } from './Fire';
import type { FloraOptions, Placement } from './Flora';
import type { Interactable, Teleport } from './Interact';
import { modelLandmark } from './ModelLandmark';
import type { ModelRig } from '../models/ModelRig';
import { portal, type PortalLink } from './Portal';
import type { RealmApi } from './Realms';

/** (With the scene's fog, like everything else in the alley: its far edges fade instead of ending against the void.) */
const FLOOR_VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FLOOR_FRAG = /* glsl */ `
varying vec2 vUv; varying vec3 vWorld;
#include <fog_pars_fragment>
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { return vnoise(p) * 0.5 + vnoise(p * 2.1 + 3.3) * 0.3 + vnoise(p * 4.3 - 1.7) * 0.2; }
void main() {
  vec2 p = vWorld.xz;
  float path = 1.0 - smoothstep(2.6, 3.2, abs(p.x));
  // Moss: deep greens with darker patches.
  vec3 moss = mix(vec3(0.012, 0.03, 0.02), vec3(0.035, 0.085, 0.045), fbm(p * 0.6));
  moss *= 0.7 + vnoise(p * 3.0) * 0.5;
  // The path: pale worn stone, broken into slabs, cracks filled with moss.
  vec2 slab = floor(p * vec2(0.9, 0.7));
  float stone = 0.5 + hash(slab) * 0.25;
  float crack = smoothstep(0.08, 0.0, min(fract(p.x * 0.9), fract(p.y * 0.7))) + smoothstep(0.62, 0.66, fbm(p * 1.8)) * 0.8;
  vec3 slabCol = vec3(0.13, 0.14, 0.15) * stone * (0.8 + fbm(p * 2.5) * 0.4);
  slabCol = mix(slabCol, moss * 1.3, clamp(crack, 0.0, 1.0));
  vec3 c = mix(moss, slabCol, path);
  // Purple mist pooling on the ground, thicker down the alley.
  float mist = fbm(p * 0.12 + vec2(0.0, vWorld.z * 0.01)) * 0.5;
  c = mix(c, vec3(0.16, 0.06, 0.26), mist * 0.6);
  gl_FragColor = vec4(c, 1.0);
  #include <fog_fragment>
}`;

/** Gives every mesh of a loaded model its own material copy and restyles it. */
function restyle(model: ModelRig, fn: (mat: MeshStandardMaterial) => void): void {
  model.root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh) return;
    const mat = (m.material as MeshStandardMaterial).clone();
    fn(mat);
    m.material = mat;
  });
}

export interface GraveyardApi extends Omit<RealmApi, 'flora'> {
  heights: HeightWorld;
  flora(id: string, placements: Placement[], opts?: FloraOptions & { trunk?: number }): void;
  teleport(): Teleport | undefined;
  /** Where the island door is (the demon church's front) and the ground height there. */
  door: { x: number; z: number; y: number };
}

export function buildGraveyard(api: GraveyardApi): { links: PortalLink[]; interactables: Interactable[] } {
  const R = GRAVEYARD;
  api.realm(R.id);
  const y0 = R.y;
  const zGate = R.z + 85;
  const zArena = R.z - 68;
  const rnd = api.rnd;
  // The floor: one slab for walking, the shader for looks.
  // (Wider than the walkable alley: the fog swallows its edges, never the void.)
  const floor = new Mesh(new PlaneGeometry(220, 300, 1, 1), new ShaderMaterial({
    vertexShader: FLOOR_VERT,
    fragmentShader: FLOOR_FRAG, fog: true, uniforms: UniformsUtils.clone(UniformsLib.fog),
  }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(R.x, y0, R.z);
  floor.receiveShadow = true;
  api.group.add(floor);
  const solid: Footprint[] = [{ kind: 'box', x: R.x, z: R.z, hw: 24, hd: 120, top: y0 }];
  // Invisible walls at the floor's edge (beyond is the void and the fog).
  for (const side of [-1, 1]) solid.push({ kind: 'box', x: R.x + side * 24.5, z: R.z, hw: 0.5, hd: 120, top: y0 + 6 });
  solid.push({ kind: 'box', x: R.x, z: R.z + 120.5, hw: 25, hd: 0.5, top: y0 + 6 }, { kind: 'box', x: R.x, z: R.z - 120.5, hw: 25, hd: 0.5, top: y0 + 6 });

  // Walls either side of the path, with a gap every 30 m (a way onto the plots).
  // One segment's length (stone-wall.glb is 2.16 times as long as it is tall).
  const wallLen = MODELS['stone-wall'].height * 2.16;
  const walls: Footprint[] = [];
  for (const side of [-1, 1]) {
    for (let z = zGate - 2; z > zArena + 22; z -= wallLen) {
      if (Math.abs(((zGate - z) % 30) - 15) < 2) continue;
      api.place(modelLandmark('stone-wall', R.x + side * 3.4, z, y0, { collider: 'none', yaw: Math.PI / 2 }));
      walls.push({ kind: 'box', x: R.x + side * 3.4, z, hw: 0.62, hd: wallLen / 2, top: y0 + MODELS['stone-wall'].height });
    }
  }
  // Raised plots of graves behind the walls.
  const graves: Placement[] = [];
  const runes: Placement[] = [];
  const crosses: Placement[] = [];
  for (const side of [-1, 1]) {
    solid.push({ kind: 'box', x: R.x + side * 10.25, z: R.z + 8, hw: 5.75, hd: 76, top: y0 + 0.6 });
    for (let z = zGate - 4; z > zArena + 24; z -= 1.9) {
      for (let k = 0; k < 3; k++) {
        if (rnd() < 0.18) continue;
        const x = R.x + side * (5.4 + k * 3.4 + (rnd() - 0.5) * 0.8);
        const p = { x, y: y0 + 0.6, z: z + (rnd() - 0.5) * 0.6, yaw: (side > 0 ? -Math.PI / 2 : Math.PI / 2) + (rnd() - 0.5) * 0.35, scale: 0.8 + rnd() * 0.5 };
        const r = rnd();
        (r < 0.15 ? runes : r < 0.3 ? crosses : graves).push(p);
      }
    }
  }
  // Solid like any stone (a slim cylinder each; the cross's is narrower).
  api.flora('grave', graves, { trunk: 0.3 });
  api.flora('rune-grave', runes, { trunk: 0.25 });
  api.flora('grave-cross', crosses, { trunk: 0.12 });
  const plotSlab = new Mesh(new PlaneGeometry(11.5, 152), new ShaderMaterial({ vertexShader: FLOOR_VERT, fragmentShader: FLOOR_FRAG, fog: true, uniforms: UniformsUtils.clone(UniformsLib.fog) }));
  for (const side of [-1, 1]) {
    const m = plotSlab.clone();
    m.rotation.x = -Math.PI / 2;
    m.position.set(R.x + side * 10.25, y0 + 0.6, R.z + 8);
    api.group.add(m);
  }
  // Dead trees leaning over the plots.
  const trees: Placement[] = [];
  for (let i = 0; i < 12; i++) {
    const side = i % 2 ? 1 : -1;
    trees.push({ x: R.x + side * (14 + rnd() * 6), y: y0 + 0.6, z: zGate - 10 - i * 11 - rnd() * 4, yaw: rnd() * 6, scale: 0.9 + rnd() * 0.5 });
  }
  api.flora('dead-forest-tree', trees, { trunk: 0.05 });

  // Something every 35 m: the guards (enemies, data/enemies), a candle shrine, an open grave that throws you up, the gate.
  const shrineZ = R.z + 20;
  for (const side of [-1, 1]) {
    const x = R.x + side * 2.2;
    api.place(modelLandmark('brazier', x, shrineZ, y0, { collider: 'none' }));
    api.vfx(fire(x, y0 + MODELS.brazier.height * 0.9, shrineZ, 0.6, 14));
  }
  const candles: Placement[] = [];
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * Math.PI * 2;
    const x = R.x + Math.cos(a) * 1.4;
    const z = shrineZ + Math.sin(a) * 1.4;
    candles.push({ x, y: y0, z, yaw: rnd() * 6, scale: 0.9 + rnd() * 0.5 });
    if (i % 3 === 0) api.vfx(fire(x, y0 + 0.3, z, 0.1, 1));
  }
  api.flora('candle', candles, { shadows: false });
  const graveZ = R.z - 15;
  api.heights.bouncers.push({ x: R.x, z: graveZ, r: 1.2, top: y0, v: 18 });
  const pit = glowSprite(PALETTE.witch, 3, 0.45, true);
  pit.position.set(R.x, y0 + 0.4, graveZ);
  api.group.add(pit);
  api.place(modelLandmark('ring-portal', R.x, R.z - 45, y0, { collider: 'none', scale: 1.6 }));

  // The end: the cyclops's arena before the gothic tower and its two round towers.
  api.place(modelLandmark('tower', R.x, zArena - 27, y0 - 0.5, { onLoad: (m) => restyle(m, (mat) => { mat.color.multiplyScalar(0.4); }) }));
  for (const side of [-1, 1]) api.place(modelLandmark('round-tower', R.x + side * 14, zArena - 20, y0 - 0.3));
  for (const [x, z] of [[-8, zArena + 6], [8, zArena + 6], [-10, zArena - 10], [10, zArena - 10]] as const) {
    api.place(modelLandmark('brazier', R.x + x, z, y0, { collider: 'none' }));
    api.vfx(fire(R.x + x, y0 + MODELS.brazier.height * 0.9, z, 0.7, 16));
  }

  // Purple mist sprites low over the plots, fireflies (wisps) over the graves.
  for (let i = 0; i < 26; i++) {
    const s = glowSprite(0x6a2aa8, 10 + rnd() * 10, 0.12 + rnd() * 0.08, true);
    s.position.set(R.x + (rnd() - 0.5) * 40, y0 + 0.8 + rnd() * 1.5, R.z + (rnd() - 0.5) * 220);
    api.group.add(s);
  }
  api.vfx(fireflies(R.x - 10, y0 + 0.6, R.z + 30, 9, 3, 40, new Color(0.6, 1.4, 0.5)));
  api.vfx(fireflies(R.x + 10, y0 + 0.6, R.z - 20, 9, 3, 40, new Color(0.6, 1.4, 0.5)));

  // Ways in and out: the church door on the island, the portal at the alley's mouth back to it.
  const exit = portal(R.x, y0 + 2, zGate + 6, 1.8, { vertical: true, facing: 0, colors: [0x6a2aa8, 0x2a1446] });
  api.place(exit);
  api.realm(null);
  api.heights.add(...solid, ...walls);
  const door = api.door;
  const interactables: Interactable[] = [{
    pos: new Vector3(door.x, door.y + 1, door.z), range: 3.2, zone: null,
    label: () => 'Open the church door',
    act: () => api.teleport()?.(R.x, y0 + 0.05, zGate - 1, -Math.PI / 2, R.name),
  }];
  const links: PortalLink[] = [{ at: new Vector3(R.x, y0 + 1, zGate + 6), radius: 1.6, height: 3, to: { x: door.x + 4, z: door.z, yaw: 0, cameraYaw: Math.atan2(-Math.cos(0), -Math.sin(0)) }, name: 'The Demon Church' }];
  return { links, interactables };
}

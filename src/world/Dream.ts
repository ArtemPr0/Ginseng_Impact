/**
 * The Frog King's dream (licking a DMT frog), built from the reel DefYcvutTow (see the ginseng-psychedelic-dream
 * skill): a tie-dye nebula sky with a marbled moon-egg and a spiral of laughing moons; a floor of breathing fractals;
 * three places around the Frog God in the middle —
 *  - west: a stair path of floating stones up to a terrace among floating skull islands with burning castles and
 *    giant sunflowers;
 *  - east: a canal village of crooked houses around an eye-shaped vortex, candle-lit wooden bridges over it, and a
 *    giant face tree;
 *  - north-west: an endless checkerboard corridor between hooded stone statues under a column of stacked giant eyes,
 *    ending at a giant skull with a snake coiled round it, lit by coloured flames.
 * The Prism Wizard flies about it all. Four minutes, no way out (Adventures keeps the clock); an unseen ring keeps
 * you on the floor.
 */
import { BackSide, CircleGeometry, Color, Group, Mesh, type MeshStandardMaterial, PlaneGeometry, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { DREAM } from '../data/world';
import { MODELS } from '../data/models';
import { fireflies } from '../render/Fireflies';
import { glowSprite } from '../render/Glow';
import { patchLitWindows, patchStone, WIND } from '../render/Materials';
import { SkyEyes } from '../render/SkyEyes';
import type { Footprint } from './Colliders';
import { cascade } from './Falls';
import { fire } from './Fire';
import type { Placement } from './Flora';
import { ISLAND_TOP } from './Heart';
import { modelLandmark } from './ModelLandmark';
import type { ModelRig } from '../models/ModelRig';
import type { RealmApi } from './Realms';
import { archBridge, floorSlab } from './Walkways';
import { eyePool } from './Water';

const FLOOR_R = 150;

/** Things in the dream that watch the hero (the column of eyes), updated by World with the camera and the hero. */
export const dreamWatchers: Array<(dt: number, cam: Vector3, hero: Vector3) => void> = [];

const PALETTE_GLSL = /* glsl */ `
  vec3 pal(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
`;

function skyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide, depthWrite: false, fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vDir;
      ${PALETTE_GLSL}
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
      float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += vnoise(p) * a; p = p * 2.02 + 1.7; a *= 0.5; } return s; }
      void main() {
        // Tie-dye nebula (DefYcvutTow): bands of every colour folded through each other, flowing slowly.
        vec2 p = vec2(atan(vDir.z, vDir.x) * 1.6, vDir.y * 3.2);
        vec2 q = vec2(fbm(p + uTime * 0.02), fbm(p + vec2(5.2, 1.3) - uTime * 0.015));
        vec2 r = vec2(fbm(p + q * 2.4 + vec2(1.7, 9.2) + uTime * 0.01), fbm(p + q * 2.4 + vec2(8.3, 2.8)));
        float n = fbm(p + r * 2.2);
        vec3 col = pal(n * 1.4 + r.x * 0.6 + uTime * 0.02) * (0.12 + n * 0.62);
        // Dark rifts between the bands, and stars in them.
        float rift = smoothstep(0.5, 0.34, n);
        col = mix(col, vec3(0.02, 0.0, 0.06), rift * 0.8);
        float star = step(0.9975, hash(floor(vDir.xz * 420.0 + vDir.y * 300.0)));
        col += vec3(1.0) * star * rift * 1.5;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

/** The marbled moon-egg hanging over the stair path (DefYcvutTow): swirls of blue, white and violet, glowing. */
function moonEggMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    fog: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; void main() { vN = normalize(normalMatrix * normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vN; varying vec3 vP;
      float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
      float n3(vec3 p) { vec3 i = floor(p); vec3 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                   mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
      void main() {
        vec3 p = vP * 0.08;
        float m = sin(p.x * 3.0 + n3(p * 2.0 + uTime * 0.05) * 6.0 + p.y * 2.0);
        vec3 col = mix(vec3(0.15, 0.25, 1.1), vec3(1.1, 1.1, 1.3), smoothstep(-0.2, 0.9, m));
        col = mix(col, vec3(0.7, 0.25, 1.2), smoothstep(0.55, 0.95, n3(p * 4.0 - uTime * 0.03)));
        float rim = pow(1.0 - abs(vN.z), 2.0);
        gl_FragColor = vec4(col * (0.9 + rim * 0.8), 1.0);
      }`,
  });
}

/** The corridor's floor: black and white squares running to the end, faintly glossy. */
function checkerMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vW; void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vW;
      void main() {
        vec2 c = floor(vW.xz / 2.0);
        float k = mod(c.x + c.y, 2.0);
        vec3 col = mix(vec3(0.02, 0.02, 0.03), vec3(0.85, 0.85, 0.9), k);
        // A slow ripple of colour runs down the squares.
        col += 0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + vW.z * 0.01 - uTime * 0.1)) * 0.0;
        col *= 0.85 + 0.15 * sin(vW.z * 0.2 - uTime * 2.0);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

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

function floorMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      uniform float uTime; varying vec2 vP;
      void main() {
        vP = position.xy;
        vec3 p = position;
        float d = length(p.xy);
        // The floor breathes: slow swells rolling outward (visual only; the walk surface stays level).
        p.z += sin(d * 0.08 - uTime * 0.9) * 0.35 * smoothstep(8.0, 30.0, d);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vP;
      ${PALETTE_GLSL}
      void main() {
        // A Julia set whose seed drifts: the fractal unfolds and folds back as you stand on it.
        vec2 z = vP / 45.0;
        vec2 c = vec2(-0.74 + 0.08 * sin(uTime * 0.13), 0.16 + 0.06 * cos(uTime * 0.17));
        float n = 0.0;
        for (int i = 0; i < 40; i++) {
          z = vec2(z.x * z.x - z.y * z.y, 2.0 * z.x * z.y) + c;
          if (dot(z, z) > 16.0) break;
          n += 1.0;
        }
        float k = n / 40.0;
        vec3 col = pal(k * 2.0 - uTime * 0.07 + length(vP) * 0.004) * (0.12 + 0.5 * k);
        // The set's inside (never escaping) is a dark pool with faint colour, not a flat sheet of light.
        if (n >= 40.0) col = pal(uTime * 0.05 + length(vP) * 0.01) * 0.07;
        col *= 0.75 + 0.25 * sin(uTime * 1.3 - length(vP) * 0.05);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function buildDream(api: RealmApi): void {
  const R = DREAM;
  api.realm(R.id);
  const sky = new Mesh(new SphereGeometry(380, 48, 24), skyMaterial());
  sky.position.set(R.x, R.y, R.z);
  sky.frustumCulled = false;
  const floor = new Mesh(new CircleGeometry(FLOOR_R + 20, 120), floorMaterial());
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(R.x, R.y - 0.02, R.z);
  const group = new Group();
  group.add(sky, floor);
  const mats = [sky.material as ShaderMaterial, floor.material as ShaderMaterial];
  let t = 0;
  api.vfx({ group, update: (dt) => { t += dt; for (const m of mats) m.uniforms.uTime.value = t; } });
  // The floor you stand on, and an unseen ring at its edge (you cannot walk out of a dream).
  const footprints: Footprint[] = [{ kind: 'cyl', x: R.x, z: R.z, r: FLOOR_R + 10, top: R.y }];
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    footprints.push({ kind: 'box', x: R.x + Math.cos(a) * FLOOR_R, z: R.z + Math.sin(a) * FLOOR_R, hw: 1, hd: 11, top: R.y + 80, rotY: -a });
  }
  api.place({ object: new Group(), footprints });

  // Things drifting through the air: koi circling, jellyfish bobbing, crystals turning.
  const drift = (id: string, n: number, rMin: number, rMax: number, yMin: number, yMax: number, scale: number, speed: number) => {
    for (let i = 0; i < n; i++) {
      const r = rMin + api.rnd() * (rMax - rMin);
      const a0 = api.rnd() * Math.PI * 2;
      const y0 = R.y + yMin + api.rnd() * (yMax - yMin);
      const s = scale * (0.7 + api.rnd() * 0.8);
      const w = speed * (0.6 + api.rnd() * 0.8) * (api.rnd() < 0.5 ? -1 : 1) / r;
      const phase = api.rnd() * 6;
      let a = a0;
      let tt = 0;
      api.place(modelLandmark(id, R.x + Math.cos(a0) * r, R.z + Math.sin(a0) * r, y0, {
        collider: 'none', scale: s, clip: MODELS[id]?.clips ? 'idle' : undefined,
        update: (dt, root) => {
          tt += dt;
          a += w * dt;
          root.position.set(R.x + Math.cos(a) * r, y0 + Math.sin(tt * 0.7 + phase) * 1.5, R.z + Math.sin(a) * r);
          // Swimmers face along their circle; the rest tumble slowly.
          if (id === 'koi') root.rotation.y = Math.PI / 2 - (a + Math.sign(w) * Math.PI / 2);
          else { root.rotation.y += dt * 0.4; root.rotation.z = Math.sin(tt * 0.5 + phase) * 0.3; }
        },
      }));
    }
  };
  drift('koi', 10, 12, 70, 3, 14, 3, 9);
  drift('jellyfish', 10, 18, 90, 6, 30, 4, 3);
  drift('purple-crystal', 10, 25, 110, 4, 40, 3.5, 2);

  const C = { x: R.x, z: R.z };
  const y0 = R.y;
  const rnd = api.rnd;
  const anim: Array<(dt: number) => void> = [];

  // --- the moon-egg and the spiral of laughing moons in the nebula ---
  const egg = new Mesh(new SphereGeometry(22, 48, 32), moonEggMaterial());
  egg.scale.set(1, 1.25, 1);
  egg.position.set(C.x - 70, y0 + 105, C.z + 60 - 300);
  group.add(egg);
  const eggGlow = glowSprite(0x8fa8ff, 90, 0.35, false);
  eggGlow.position.copy(egg.position);
  group.add(eggGlow);
  anim.push(() => { (egg.material as ShaderMaterial).uniforms.uTime.value = t; egg.rotation.y = t * 0.05; });
  const moons: Placement[] = [];
  for (let i = 0; i < 20; i++) {
    const a = i * 0.55;
    const r = 30 + i * 9;
    moons.push({ x: C.x + 140 + Math.cos(a) * r, y: y0 + 120 + Math.sin(a) * r * 0.6, z: C.z - 240, yaw: 0, scale: 0.6 + i * 0.08 });
  }
  api.flora('moon-laugh', moons, {
    shadows: false,
    // The spiral turns slowly, every moon a different colour that drifts (orange through green, as in the reel).
    update: (tt, ps) => { ps.forEach((p, i) => { const a = i * 0.55 + tt * 0.05; const r = 30 + i * 9; p.x = C.x + 140 + Math.cos(a) * r; p.y = y0 + 120 + Math.sin(a) * r * 0.6; }); return true; },
    patch: (mat) => {
      mat.fog = false;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uWind = WIND;
        shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying float vHue;').replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef USE_INSTANCING\nvHue = instanceMatrix[3].x * 0.013 + instanceMatrix[3].y * 0.02;\n#else\nvHue = 0.0;\n#endif');
        shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uWind; varying float vHue;').replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += (0.5 + 0.5 * cos(6.28318 * (vec3(0.0, 0.33, 0.67) + vHue + uWind * 0.03))) * dot(diffuseColor.rgb, vec3(0.33)) * 1.3;`);
      };
      mat.customProgramCacheKey = () => 'dream-moons';
      mat.needsUpdate = true;
    },
  });

  // --- west: the stair path of floating stones up to the sunflower terrace, skull islands burning around it ---
  const steps: Placement[] = [];
  const stepFeet: Footprint[] = [];
  const terrace = { x: C.x - 66, z: C.z - 8, top: y0 + 9.6 };
  for (let i = 0; i < 18; i++) {
    const f = (i + 1) / 18;
    const a = Math.PI * 0.5 + f * Math.PI * 0.55;
    const x = C.x - 14 - f * 44 + Math.cos(a * 3) * 3;
    const z = C.z + 18 - f * 26;
    const top = y0 + 0.55 * (i + 1);
    steps.push({ x, y: top - 0.45, z, yaw: rnd() * 6, scale: 2.4 });
    stepFeet.push({ kind: 'cyl', x, z, r: 1.15, top });
  }
  api.flora('stepping-stone', steps, { shadows: true, patch: (mat) => { mat.color.multiplyScalar(0.55); mat.color.lerp(new Color(0.25, 0.3, 0.8), 0.35); } });
  api.place({ object: new Group(), footprints: stepFeet });
  api.place(floorSlab(terrace.x, terrace.z, terrace.top, 18, 18));
  const sunflowers: Placement[] = [];
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 8 + rnd() * 26;
    const onTerrace = i < 8;
    const x = onTerrace ? terrace.x + (rnd() - 0.5) * 15 : terrace.x + Math.cos(a) * r;
    const z = onTerrace ? terrace.z + (rnd() - 0.5) * 15 : terrace.z + Math.sin(a) * r;
    sunflowers.push({ x, y: onTerrace ? terrace.top : y0, z, yaw: rnd() * 6, scale: onTerrace ? 4 + rnd() * 2 : 6 + rnd() * 5 });
  }
  api.flora('flower', sunflowers, { wind: 0.2, patch: (mat) => {
    // Giant sunflowers: the petals turn gold, the centres dark.
    mat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
        {
          float leaf = smoothstep(0.05, 0.2, diffuseColor.g - max(diffuseColor.r, diffuseColor.b));
          float l = dot(diffuseColor.rgb, vec3(0.3, 0.6, 0.1));
          diffuseColor.rgb = mix(mix(vec3(0.18, 0.08, 0.02), vec3(1.0, 0.72, 0.08), smoothstep(0.25, 0.5, l)), diffuseColor.rgb, leaf);
        }`).replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.5, 0.3, 0.02) * smoothstep(0.5, 0.9, diffuseColor.r);');
    };
    mat.customProgramCacheKey = () => 'sunflower';
    mat.needsUpdate = true;
  } });
  for (const [dx, dz, y, yaw] of [[-104, -44, 32, 0.6], [-58, -94, 42, 2.1], [-114, 28, 28, -0.8]] as const) {
    const x = C.x + dx;
    const z = C.z + dz;
    const base = y0 + y;
    const bob = (root: Group, k: number) => { root.position.y = base + k + Math.sin(t * 0.3 + dx) * 0.8; };
    api.place(modelLandmark('floating-island', x, z, base, { collider: 'none', yaw, update: (dt, root) => { void dt; bob(root, 0); } }));
    const top = base + MODELS['floating-island'].height * ISLAND_TOP;
    api.place(modelLandmark('giant-skull', x + 2, z, top, { collider: 'none', yaw: yaw + Math.PI, update: (dt, root) => { void dt; bob(root, MODELS['floating-island'].height * ISLAND_TOP); } }));
    api.place(modelLandmark('castle', x - 3, z + 2, top, { collider: 'none', scale: 0.22, yaw, update: (dt, root) => { void dt; bob(root, MODELS['floating-island'].height * ISLAND_TOP); } }));
    api.vfx(fire(x - 3, top + 3, z + 2, 5, 0));
    api.vfx(fire(x - 1, top + 5, z + 4, 3.5, 0));
  }
  // A rainbow waterfall off the highest skull island, down into the void under the floor's edge.
  api.place(cascade({ x: C.x - 58, z: C.z - 88, top: y0 + 42 + MODELS['floating-island'].height * 0.4, height: 50, width: 4, yaw: 0.4, color: new Color(1.2, 0.4, 1.4) }));

  // --- east: the canal village round the eye, candle-lit bridges, the giant face tree ---
  const V = { x: C.x + 64, z: C.z - 14 };
  const eye = eyePool(V.x, V.z, y0 + 0.02, 22, 15);
  api.place(eye);
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.2;
    if (Math.abs(Math.cos(a)) > 0.92) continue;
    const x = V.x + Math.cos(a) * 33;
    const z = V.z + Math.sin(a) * 25;
    api.place(modelLandmark('village-house', x, z, y0, { yaw: Math.atan2(V.x - x, V.z - z), scale: 1 + rnd() * 0.3, onLoad: (m) => restyle(m, (mat) => { patchLitWindows(mat, 2.6); }) }));
  }
  for (const bx of [V.x - 9, V.x + 9]) {
    const zA = V.z + 17;
    const zB = V.z - 17;
    const b = archBridge(bx, zA, zB, y0 + 0.1, y0 + 3.6, 1.3, MODELS['chasm-bridge'].height);
    api.place(b);
    api.flora('chasm-bridge', b.tiles);
    const candles: Placement[] = [];
    b.posts.forEach((p, i) => { if (i % 2 === 0) { candles.push({ x: p.x, y: p.y + 0.9, z: p.z, yaw: 0, scale: 1.2 }); api.vfx(fire(p.x, p.y + 1.25, p.z, 0.12, 1)); } });
    api.flora('candle', candles, { shadows: false });
  }
  api.place(modelLandmark('face-tree', C.x + 104, C.z + 34, y0, { scale: 2.6, yaw: Math.atan2(V.x - (C.x + 104), V.z - (C.z + 34)) }));
  api.vfx(fireflies(V.x, y0, V.z, 30, 8, 120, new Color(1.2, 0.8, 0.3)));

  // --- north-west: the endless checkerboard corridor, hooded statues, the column of eyes, the skull and the snake ---
  const K = { x: C.x - 42, z0: C.z - 34, z1: C.z - 136 };
  const corridor = new Mesh(new PlaneGeometry(13, K.z0 - K.z1, 1, 1), checkerMaterial());
  corridor.rotation.x = -Math.PI / 2;
  corridor.position.set(K.x, y0 + 0.03, (K.z0 + K.z1) / 2);
  group.add(corridor);
  anim.push(() => { (corridor.material as ShaderMaterial).uniforms.uTime.value = t; });
  const statueSpots: Array<[number, number, string]> = [];
  for (let z = K.z0 - 6; z > K.z1 + 10; z -= 9) for (const side of [-1, 1]) statueSpots.push([K.x + side * 7.5, z, (z / 9) % 2 ? 'robed-priest' : 'void-monk']);
  statueSpots.forEach(([x, z, id], i) => {
    // (Frozen mid-pose: the idle clip stopped on a frame, so they stand like carvings, not in the bind pose.)
    api.place(modelLandmark(id, x, z, y0, { scale: 2.1, clip: 'idle', yaw: x < K.x ? Math.PI / 2 : -Math.PI / 2, onLoad: (m) => { restyle(m, (mat) => patchStone(mat)); m.play('idle', false, 0); } }));
    // Coloured torch flames between the statues.
    if (i % 2 === 0) {
      const tx = x + (x < K.x ? -1.6 : 1.6);
      const col = [0x37f5ff, 0x5dff3a, 0xff5ad6, 0x8b3dff][(i >> 1) % 4];
      const flame = glowSprite(col, 2.2, 0.9, true);
      flame.position.set(tx, y0 + 4.2, z + 4.5);
      group.add(flame);
      const halo = glowSprite(col, 7, 0.25, true);
      halo.position.copy(flame.position);
      group.add(halo);
    }
  });
  const column = new SkyEyes(Array.from({ length: 7 }, (_, i) => ({ x: K.x, y: y0 + 14 + i * 6.5, z: C.z - 96, size: 7 })));
  group.add(column.group);
  dreamWatchers.push((dt, cam, hero) => column.update(dt, cam, hero));
  api.place(modelLandmark('giant-skull', K.x, K.z1 - 4, y0, { yaw: 0 }));
  api.place(modelLandmark('snake', K.x + 3, K.z1 - 2, y0 + 1.5, { scale: 3.5, clip: 'idle', collider: 'none', yaw: -Math.PI / 2 }));
  for (const side of [-1, 1]) api.vfx(fire(K.x + side * 6, y0, K.z1 - 3, 1.6, 20));

  api.vfx({ group: new Group(), update: (dt) => { for (const f of anim) f(dt); } });

  // The Frog King, enormous, rising out of the horizon and turning to watch you.
  const faceAt = new Vector3(R.x, R.y - 6, R.z - 118);
  const face = modelLandmark('frogking', faceAt.x, faceAt.z, faceAt.y, {
    collider: 'none', scale: 34 / MODELS.frogking.height, clip: 'idle',
    update: (dt, root, _m, player) => {
      const want = Math.atan2(player.x - faceAt.x, player.z - faceAt.z);
      root.rotation.y += Math.atan2(Math.sin(want - root.rotation.y), Math.cos(want - root.rotation.y)) * Math.min(1, dt * 0.6);
      root.position.y = faceAt.y + Math.sin(t * 0.4) * 1.2;
    },
  });
  api.place(face);
  api.realm(null);
}

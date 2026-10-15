/**
 * The Frog King's dream (licking a DMT frog): a kaleidoscope sky, a floor of breathing fractals, colour-cycling fog,
 * koi, jellyfish and crystals drifting through the air, and the Frog King's face, huge on the horizon, watching.
 * Two minutes, no way out (main.ts keeps the clock); an unseen ring keeps you on the floor.
 */
import { BackSide, CircleGeometry, Group, Mesh, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { DREAM } from '../data/world';
import { MODELS } from '../data/models';
import type { Footprint } from './Colliders';
import { modelLandmark } from './ModelLandmark';
import type { RealmApi } from './Realms';

const FLOOR_R = 150;

const PALETTE_GLSL = /* glsl */ `
  vec3 pal(float t) { return 0.5 + 0.5 * cos(6.28318 * (t + vec3(0.0, 0.33, 0.67))); }
`;

function skyMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide, depthWrite: false,
    uniforms: { uTime: { value: 0 } },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vDir;
      ${PALETTE_GLSL}
      void main() {
        float a = atan(vDir.z, vDir.x);
        float e = asin(clamp(vDir.y, -1.0, 1.0));
        // Fold the circle into 8 mirrored wedges: a kaleidoscope turning slowly.
        float seg = 6.28318 / 8.0;
        a = mod(a + uTime * 0.05, seg);
        a = abs(a - seg * 0.5);
        vec2 p = vec2(cos(a), sin(a)) * (1.6 - e);
        float v = 0.0;
        for (int i = 0; i < 4; i++) {
          p = abs(p) / dot(p, p) - 0.82 + 0.06 * sin(uTime * 0.3 + float(i));
          v += exp(-3.0 * abs(length(p) - 0.9));
        }
        vec3 col = pal(v * 0.18 + uTime * 0.04 + e * 0.3) * (0.35 + 0.5 * v * 0.35);
        gl_FragColor = vec4(col, 1.0);
      }`,
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
        vec3 col = pal(k * 2.0 - uTime * 0.07 + length(vP) * 0.004) * (0.25 + 0.75 * k);
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
  drift('koi', 14, 12, 70, 3, 14, 3, 9);
  drift('jellyfish', 16, 18, 90, 6, 30, 4, 3);
  drift('purple-crystal', 18, 25, 110, 4, 40, 3.5, 2);

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

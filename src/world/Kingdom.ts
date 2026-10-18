/**
 * Yung Lean's kingdom (the realm beyond the portal): a vaporwave ink-wash sky with wireframe computers and a grid on
 * the horizon, a pale crescent and a spinning holographic CD-ROM for moons, slow pixel snow that dissolves before it
 * reaches you, low pink blossom fog, a floor of cracked polished porcelain and marble laid like a chessboard (it
 * reflects) with neon-blue ore veins, tea streams with stone lotus drifting down them, and giant lean cups for islands
 * joined by walkable purple waves. Sky, floor, water and effects are procedural; everything standing is a GLB.
 */
import {
  BackSide, BoxGeometry, BufferAttribute, BufferGeometry, CircleGeometry, Color, DoubleSide, EdgesGeometry, Float32BufferAttribute,
  Group, LineBasicMaterial, LineSegments, Mesh, type MeshStandardMaterial, PlaneGeometry, Points, ShaderMaterial, SphereGeometry, Vector3,
} from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { GALAXY, LEAN_QUARTER } from '../data/world';
import { MODELS } from '../data/models';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import type { Footprint } from './Colliders';
import type { Interactable } from './Interact';
import { modelLandmark } from './ModelLandmark';
import type { RealmApi } from './Realms';
import { faceMoon } from '../render/MoonFace';
import { patchSwim } from '../render/Materials';

const NOISE = /* glsl */ `
float hash(vec2 p) { vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vnoise(p); p *= 2.03; a *= 0.5; } return v; }
// Distance to the nearest Voronoi edge (cracks, veins).
float voronoiEdge(vec2 p) {
  vec2 n = floor(p); vec2 f = fract(p); vec2 mg, mr; float md = 8.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) { vec2 g = vec2(i, j); vec2 o = vec2(hash(n + g), hash(n + g + 17.3)); vec2 r = g + o - f; float d = dot(r, r); if (d < md) { md = d; mr = r; mg = g; } }
  md = 8.0;
  for (int j = -2; j <= 2; j++) for (int i = -2; i <= 2; i++) { vec2 g = mg + vec2(i, j); vec2 o = vec2(hash(n + g), hash(n + g + 17.3)); vec2 r = g + o - f; if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr))); }
  return md;
}`;

/** The shared clock of the kingdom's shaders. */
const clock = { value: 0 };
/**
 * How far the kingdom's sky has sunk into night (0 = the vaporwave plaza, 1 = the moonlit quarters of the
 * @returndark reels); main.ts eases it as the hero walks between them (data/world.ts DISTRICT_AIR).
 */
export const kingdomNight = { value: 0 };

// ---------- the sky ----------
function skyDome(): Mesh {
  const mat = new ShaderMaterial({
    // Drawn first and writing depth: the island's moon and aurora (further out) stay hidden behind it.
    side: BackSide, fog: false,
    uniforms: { uTime: clock, uNight: kingdomNight },
    vertexShader: /* glsl */ `varying vec3 vDir; void main() { vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uNight; varying vec3 vDir;
      ${NOISE}
      void main() {
        float e = vDir.y;
        // Midnight blue overhead, violet in the middle, neon pink low on the horizon.
        // (At night, in the quarters: near-black indigo overhead, deep violet low, the horizon only faintly warm.)
        vec3 zen = mix(vec3(0.03, 0.04, 0.16), vec3(0.008, 0.01, 0.045), uNight);
        vec3 mid = mix(vec3(0.24, 0.08, 0.42), vec3(0.07, 0.03, 0.16), uNight);
        vec3 low = mix(vec3(1.0, 0.31, 0.69), vec3(0.26, 0.09, 0.34), uNight);
        vec3 c = mix(mid, zen, smoothstep(0.1, 0.75, e));
        c = mix(c, low, smoothstep(0.32, -0.02, e) * 0.85);
        // The aurora in ink wash: soft curtains that bleed into each other, drifting.
        float a = atan(vDir.z, vDir.x);
        vec2 q = vec2(a * 3.0 + uTime * 0.02, e * 4.0);
        float curtain = fbm(q + vec2(fbm(q * 0.7 + uTime * 0.03) * 2.0, 0.0));
        float band = smoothstep(0.15, 0.55, e) * smoothstep(0.85, 0.45, e);
        vec3 ink = mix(vec3(0.55, 0.2, 0.95), vec3(1.0, 0.35, 0.75), fbm(q * 1.3 + 5.0));
        ink = mix(ink, vec3(0.25, 0.85, 1.0), smoothstep(0.62, 0.8, fbm(q * 0.6 - 3.0)) * 0.6);
        c += ink * smoothstep(0.45, 0.85, curtain) * band * mix(0.75, 0.3, uNight);
        // A few pixel stars.
        vec2 sp = floor(vec2(a * 160.0, e * 160.0));
        float star = step(0.9965, hash(sp)) * smoothstep(0.05, 0.3, e);
        c += vec3(star) * (0.6 + 0.4 * sin(uTime * 2.0 + hash(sp) * 30.0));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const dome = new Mesh(new SphereGeometry(560, 48, 24), mat);
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  return dome;
}

/** The neon grid stretching out under the floor to the horizon (it scrolls toward you, slowly). */
function horizonGrid(): Mesh {
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: clock, uNight: kingdomNight },
    vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = (modelMatrix * vec4(position, 1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uNight; varying vec2 vP;
      void main() {
        vec2 c = vP - vec2(${GALAXY.x.toFixed(1)}, ${GALAXY.z.toFixed(1)});
        vec2 g = abs(fract((c + vec2(0.0, uTime * 2.0)) / 14.0 - 0.5));
        float line = smoothstep(0.035, 0.0, min(g.x, g.y));
        float d = length(c);
        // (Out past the quarters, and faint at night.)
        float fade = smoothstep(230.0, 300.0, d) * (1.0 - smoothstep(420.0, 700.0, d)) * (1.0 - uNight * 0.7);
        vec3 col = mix(vec3(1.0, 0.3, 0.75), vec3(0.3, 0.9, 1.0), smoothstep(150.0, 420.0, d));
        gl_FragColor = vec4(col * line, line * fade * 0.85);
      }`,
  });
  const grid = new Mesh(new PlaneGeometry(1600, 1600, 1, 1), mat);
  grid.rotation.x = -Math.PI / 2;
  grid.frustumCulled = false;
  return grid;
}

/** A 1990s computer drawn in neon lines: CRT monitor, keyboard, tower. */
function wireComputer(color: number): Group {
  const g = new Group();
  const mat = new LineBasicMaterial({ color, transparent: true, opacity: 0.75, fog: false, toneMapped: false });
  const box = (w: number, h: number, d: number, x: number, y: number, z: number) => {
    const l = new LineSegments(new EdgesGeometry(new BoxGeometry(w, h, d)), mat);
    l.position.set(x, y, z);
    g.add(l);
  };
  box(1.3, 1.0, 1.1, 0, 0.75, 0);       // the CRT's shell
  box(1.0, 0.75, 0.05, 0, 0.78, 0.58);   // its screen
  box(0.5, 0.2, 0.5, 0, 0.12, 0);        // the stand
  box(1.4, 0.08, 0.5, 0, 0.04, 1.0);     // the keyboard
  box(0.5, 1.4, 1.2, 1.3, 0.7, 0.1);     // the tower case
  box(0.3, 0.05, 0.02, 1.3, 1.1, 0.71);  // its drive bay
  // Rows of keys.
  const pts: number[] = [];
  for (let r = 0; r < 4; r++) for (let k = 0; k < 12; k++) {
    const x = -0.62 + k * 0.113, z = 0.82 + r * 0.1, y = 0.085;
    pts.push(x, y, z, x + 0.08, y, z, x + 0.08, y, z, x + 0.08, y, z + 0.07, x + 0.08, y, z + 0.07, x, y, z + 0.07, x, y, z + 0.07, x, y, z);
  }
  const kg = new BufferGeometry();
  kg.setAttribute('position', new Float32BufferAttribute(pts, 3));
  g.add(new LineSegments(kg, mat));
  return g;
}

function crescentMoon(): Mesh {
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vec2 p = vUv - 0.5;
        float disc = smoothstep(0.42, 0.4, length(p));
        float bite = smoothstep(0.37, 0.39, length(p - vec2(0.13, 0.06)));
        float glow = smoothstep(0.5, 0.38, length(p)) * 0.25;
        float a = disc * bite;
        gl_FragColor = vec4(vec3(0.93, 0.9, 1.0) * (a + glow), max(a, glow * bite));
      }`,
  });
  return new Mesh(new PlaneGeometry(1, 1), mat);
}

/** The holographic CD-ROM moon: a silver disc with a hole, rainbow film sliding with the angle, fine grooves. */
function cdMoon(): Mesh {
  const mat = new ShaderMaterial({
    transparent: true, side: DoubleSide, fog: false, depthWrite: false,
    uniforms: { uTime: clock, uNight: kingdomNight },
    vertexShader: /* glsl */ `varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() { vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vN = normalize(mat3(modelMatrix) * normal); vView = normalize(cameraPosition - w.xyz); gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uNight; varying vec2 vUv; varying vec3 vN; varying vec3 vView;
      void main() {
        // (Gone from the quarters' night sky.)
        if (uNight > 0.85) discard;
        vec2 p = vUv - 0.5; float r = length(p) * 2.0; float a = atan(p.y, p.x);
        if (r > 1.0 || r < 0.16) discard;
        // Thin-film rainbow: hue slides with the viewing angle, the radius and the spin.
        float film = dot(vN, vView) * 1.7 + r * 2.4 + sin(a * 2.0 + uTime * 0.5) * 0.25;
        vec3 rainbow = 0.55 + 0.45 * cos(6.28318 * (film + vec3(0.0, 0.33, 0.67)));
        float grooves = 0.82 + 0.18 * sin(r * 520.0);
        vec3 silver = vec3(0.78, 0.8, 0.9) * grooves;
        // A clear hub around the hole, a label ring, and glints that sweep around as it turns.
        float hub = smoothstep(0.34, 0.31, r);
        float glint = pow(max(0.0, cos(a * 2.0 - uTime * 0.7)), 18.0) * (1.0 - hub);
        vec3 c = mix(silver, rainbow, 0.65) + vec3(glint) * 0.8;
        c = mix(c, vec3(0.75, 0.85, 1.0), hub * 0.7);
        gl_FragColor = vec4(c, mix(0.95, 0.35, hub));
      }`,
  });
  return new Mesh(new CircleGeometry(1, 96), mat);
}

// ---------- the air ----------
/**
 * Pixel snow (square points, slow) in a box around the hero, dissolving as it nears the floor or the hero, and pink
 * blossom petals drifting low.
 */
function pixelSnow(floorY: number): { points: Points; update(dt: number, player: Vector3): void } {
  const N = 1400;
  const pos = new Float32Array(N * 3);
  const col = new Float32Array(N * 3);
  const seed = new Float32Array(N);
  const palette = [new Color(0xffffff), new Color(0xbfe8ff), new Color(0xffb3e6), new Color(0xff9ad5)];
  for (let i = 0; i < N; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 70;
    pos[i * 3 + 1] = Math.random() * 30;
    pos[i * 3 + 2] = (Math.random() - 0.5) * 70;
    const petal = i % 6 === 0;
    const c = petal ? palette[3] : palette[i % 3];
    col.set([c.r, c.g, c.b], i * 3);
    seed[i] = petal ? -Math.random() : Math.random();
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('color', new BufferAttribute(col, 3));
  geo.setAttribute('seed', new BufferAttribute(seed, 1));
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uPlayer: { value: new Vector3() }, uFloor: { value: floorY }, uScale: { value: 620 }, uNight: kingdomNight },
    vertexShader: /* glsl */ `
      uniform vec3 uPlayer; uniform float uFloor; uniform float uScale; uniform float uNight;
      attribute vec3 color; attribute float seed; varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        float petal = step(seed, 0.0);
        float size = mix(0.13, 0.09, petal);
        gl_PointSize = max(1.0, size * uScale / -mv.z);
        // Gone before it touches anything: fades out low over the floor and close to the hero.
        float h = position.y - uFloor;
        float near = distance(position, uPlayer + vec3(0.0, 1.0, 0.0));
        vAlpha = smoothstep(0.4, 2.6, h + petal * 2.0) * smoothstep(1.2, 4.0, near) * mix(0.85, 0.7, petal) * (1.0 - uNight * 0.85);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `varying vec3 vColor; varying float vAlpha; void main() { gl_FragColor = vec4(vColor, vAlpha); }`,
  });
  const points = new Points(geo, mat);
  points.frustumCulled = false;
  let t = 0;
  return {
    points,
    update(dt, player) {
      t += dt;
      mat.uniforms.uPlayer.value.copy(player);
      for (let i = 0; i < N; i++) {
        const s = seed[i];
        const petal = s < 0;
        let x = pos[i * 3], y = pos[i * 3 + 1], z = pos[i * 3 + 2];
        if (petal) {
          // Petals drift sideways, swirling low over the floor.
          x += Math.sin(t * 0.4 + i) * 0.6 * dt + 0.25 * dt;
          z += Math.cos(t * 0.3 + i * 1.7) * 0.6 * dt;
          y = floorY + 0.4 + Math.abs(s) * 2.2 + Math.sin(t * 0.8 + i) * 0.25;
        } else {
          y -= (0.45 + s * 0.35) * dt;
          x += Math.sin(t * 0.3 + i * 0.37) * 0.15 * dt;
          if (y < floorY - 0.5) y = floorY + 26 + s * 4;
        }
        // Keep the snow in a box around the hero (wrap at the edges).
        if (x - player.x > 35) x -= 70; else if (x - player.x < -35) x += 70;
        if (z - player.z > 35) z -= 70; else if (z - player.z < -35) z += 70;
        pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      }
      (geo.attributes.position as BufferAttribute).needsUpdate = true;
    },
  };
}

/** Low pink fog: a few soft, drifting layers just over the floor. */
function blossomFog(cx: number, cz: number, w: number, d: number, floorY: number): Group {
  const g = new Group();
  for (const [h, op] of [[0.35, 0.22], [1.0, 0.16], [1.9, 0.1]] as const) {
    const mat = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: DoubleSide,
      uniforms: { uTime: clock },
      vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = (modelMatrix * vec4(position, 1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; varying vec2 vP;
        ${NOISE}
        void main() {
          float n = fbm(vP * 0.06 + vec2(uTime * 0.03, uTime * 0.017) + ${h.toFixed(2)} * 3.0);
          float a = smoothstep(0.35, 0.8, n) * ${op.toFixed(2)};
          gl_FragColor = vec4(vec3(1.0, 0.62, 0.86), a);
        }`,
    });
    const plane = new Mesh(new PlaneGeometry(w, d), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(cx, floorY + h, cz);
    plane.renderOrder = 3;
    g.add(plane);
  }
  return g;
}

// ---------- the floor ----------
/** Cracked polished porcelain and marble laid as a chessboard, reflecting the hall above it, veined with neon ore. */
function porcelainFloor(cx: number, cz: number, w: number, d: number, y: number): Reflector {
  const shader = {
    uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uTime: clock },
    vertexShader: /* glsl */ `
      uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
      void main() { vUv = textureMatrix * vec4(position, 1.0); vWorld = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse; uniform float uTime; varying vec4 vUv; varying vec3 vWorld;
      ${NOISE}
      void main() {
        vec2 p = vWorld.xz;
        vec2 tile = p / 4.0;
        float checker = mod(floor(tile.x) + floor(tile.y), 2.0);
        vec2 ft = abs(fract(tile) - 0.5);
        float seam = smoothstep(0.485, 0.5, max(ft.x, ft.y));
        // Marble: soft clouding and thin grey veins.
        float m = fbm(p * 0.35);
        float vein = smoothstep(0.035, 0.0, abs(sin((p.x * 0.45 + p.y * 0.2 + m * 4.0) * 1.7)) * (0.6 + m));
        vec3 white = vec3(0.86, 0.86, 0.9), grey = vec3(0.6, 0.6, 0.68);
        vec3 base = mix(grey, white, checker) * (0.9 + 0.12 * m);
        base = mix(base, vec3(0.38, 0.38, 0.46), vein * 0.5);
        // Cracks: the porcelain has broken into plates.
        float crack = smoothstep(0.035, 0.0, voronoiEdge(p * 0.22));
        // Ginseng ore: neon-blue veins that pulse slowly.
        float ore = smoothstep(0.08, 0.0, voronoiEdge(p * 0.06 + 3.7)) * smoothstep(0.3, 0.6, fbm(p * 0.05 + 9.0));
        float pulse = 0.7 + 0.3 * sin(uTime * 1.3 + p.x * 0.05);
        // The reflection, a little broken along the cracks.
        vec4 uv = vUv; uv.xy += vec2(crack * 0.004, 0.0) * uv.w;
        vec3 refl = texture2DProj(tDiffuse, uv).rgb;
        vec3 c = base * 0.42 * (1.0 - seam * 0.5) * (1.0 - crack * 0.55);
        c = mix(c, refl, 0.38) + refl * 0.12;
        c += vec3(0.08, 0.42, 1.0) * ore * pulse * 1.9;
        gl_FragColor = vec4(c, 1.0);
      }`,
  };
  const floor = new Reflector(new PlaneGeometry(w, d), { shader, textureWidth: 640, textureHeight: 360, clipBias: 0.003, multisample: 0 });
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, y + 0.01, cz);
  // (Reflector clones the shader's uniforms: give it back the shared clock so the ore veins pulse.)
  (floor.material as ShaderMaterial).uniforms.uTime = clock;
  return floor;
}

/** A stream of AriZona green tea across the floor: flowing teal water in a shallow channel, stone lotus drifting down it. */
function teaStream(api: RealmApi, path: Array<[number, number]>, y: number): void {
  const half = 1.8;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  let len = 0;
  for (let i = 0; i < path.length; i++) {
    const [x, z] = path[i];
    const [nx, nz] = path[Math.min(path.length - 1, i + 1)];
    const [px, pz] = path[Math.max(0, i - 1)];
    const tx = nx - px, tz = nz - pz;
    const tl = Math.hypot(tx, tz) || 1;
    const sx = -tz / tl * half, sz = tx / tl * half;
    if (i > 0) len += Math.hypot(x - path[i - 1][0], z - path[i - 1][1]);
    pos.push(x - sx, y + 0.03, z - sz, x + sx, y + 0.03, z + sz);
    uv.push(0, len, 1, len);
    if (i < path.length - 1) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: true,
    uniforms: { uTime: clock, fogColor: { value: new Color() }, fogDensity: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = vec2(vUv.x * 3.0, vUv.y * 0.6 - uTime * 0.4);
        float n = fbm(p + fbm(p * 0.8) * 1.2);
        vec3 tea = mix(vec3(0.05, 0.42, 0.36), vec3(0.45, 0.95, 0.75), smoothstep(0.45, 0.85, n));
        float edge = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
        tea += vec3(0.9, 1.0, 0.95) * pow(vnoise(p * 6.0 + uTime), 12.0) * 0.6;
        gl_FragColor = vec4(tea * 0.85, 0.85 * edge);
      }`,
  });
  const water = new Mesh(geo, mat);
  water.renderOrder = 2;
  const group = new Group();
  group.add(water);
  api.vfx({ group, update: () => {} });
  // Stone lotus flowers, as big as a cart, drifting downstream and round again.
  const segs: Array<{ x: number; z: number; l: number }> = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) { const l = Math.hypot(path[i + 1][0] - path[i][0], path[i + 1][1] - path[i][1]); segs.push({ x: path[i][0], z: path[i][1], l }); total += l; }
  const at = (s: number) => {
    s = ((s % total) + total) % total;
    for (let i = 0; i < segs.length; i++) {
      if (s <= segs[i].l) { const k = s / segs[i].l; return { x: path[i][0] + (path[i + 1][0] - path[i][0]) * k, z: path[i][1] + (path[i + 1][1] - path[i][1]) * k }; }
      s -= segs[i].l;
    }
    return { x: path[0][0], z: path[0][1] };
  };
  for (let k = 0; k < 4; k++) {
    let s = (total / 4) * k;
    let t = Math.random() * 6;
    const p0 = at(s);
    api.place(modelLandmark('stone-lotus', p0.x, p0.z, y - 0.15, {
      collider: 'none', scale: 2.4 / MODELS['stone-lotus'].height,
      update: (dt, root) => { s += dt * 0.9; t += dt; const p = at(s); root.position.set(p.x, y - 0.15 + Math.sin(t * 1.1) * 0.05, p.z); root.rotation.y += dt * 0.08; },
    }));
  }
}

// ---------- the islands ----------
/** How full the island cups are: the lean stands just under the rim and is the ground you walk on. */
const ISLAND_FILL = 0.96;
const ISLAND_R = 0.28;
/** The rim stands this far above the lean (the cup model's lip at 1 − ISLAND_FILL of its height). */
const ISLAND_RIM = 0.9;
/** How far inside a cup's rim a wave of lean comes down into it. */
const WAVE_INSIDE = 2.6;

/** A giant lean cup for an island: its lean is the floor (glossy, swirling), its rim just above it. */
function leanCupIsland(api: RealmApi, x: number, z: number, y: number): number {
  const H = MODELS['lean-cup-island'].height;
  api.place(modelLandmark('lean-cup-island', x, z, y - H * ISLAND_FILL, { collider: 'none', yaw: Math.random() * 6 }));
  const r = ISLAND_R * H;
  const mat = new ShaderMaterial({
    uniforms: { uTime: clock },
    vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vP;
      ${NOISE}
      void main() {
        float a = atan(vP.y, vP.x), r = length(vP);
        vec2 q = vec2(a * 2.0 + uTime * 0.12 + r * 0.25, r * 0.4);
        float n = fbm(q * 1.5 + fbm(q) * 1.4);
        vec3 c = mix(vec3(0.2, 0.03, 0.42), vec3(0.62, 0.28, 0.98), smoothstep(0.4, 0.85, n));
        c += vec3(0.95, 0.8, 1.0) * pow(vnoise(vec2(a * 8.0, r) * 3.0 + uTime * 0.3), 16.0) * 0.7;
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const lean = new Mesh(new CircleGeometry(r, 48), mat);
  lean.rotation.x = -Math.PI / 2;
  lean.position.set(x, y + 0.02, z);
  const group = new Group();
  group.add(lean, glowSprite(PALETTE.dusk, r * 2.6, 0.18, true));
  group.children[1].position.set(x, y + 1.5, z);
  api.vfx({ group, update: () => {} });
  // The lean holds you up; the cup's rim (just above the lean) is a low wall round it, so nobody walks off the edge.
  const footprints: Footprint[] = [{ kind: 'cyl', x, z, r: r + 0.4, top: y }];
  const segs = 28;
  for (let i = 0; i < segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    footprints.push({ kind: 'box', x: x + Math.cos(a) * (r + 0.2), z: z + Math.sin(a) * (r + 0.2), hw: 0.3, hd: (Math.PI * (r + 0.2)) / segs + 0.12, top: y + ISLAND_RIM, rotY: a });
  }
  api.place({ object: new Group(), footprints });
  return r;
}

/**
 * A wave of purple lean you can walk over, from one cup to the next: it rises out of the lean in one cup, arches high
 * enough to clear both rims, and comes down into the lean of the next; the crest curls over on one side and the
 * surface rolls. Its deck collides in short level steps along the arch (each under the hero's step height).
 */
function leanWave(api: RealmApi, ax: number, az: number, bx: number, bz: number, y: number): void {
  const L = Math.hypot(bx - ax, bz - az);
  const ux = (bx - ax) / L, uz = (bz - az) / L;
  const sx = -uz, sz = ux;
  const N = 40, M = 7, half = 1.9, rise = 4.2;
  const heightAt = (s: number) => y + Math.sin(Math.PI * s) * rise;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i <= N; i++) {
    const s = i / N;
    for (let j = 0; j <= M; j++) {
      const k = j / M;
      const across = (k - 0.5) * 2 * half;
      // The curl: the far edge rises and leans in, like a breaking wave.
      const curl = Math.pow(Math.max(0, k - 0.75) / 0.25, 2) * 0.9 * Math.sin(Math.PI * s);
      pos.push(ax + ux * L * s + sx * across, heightAt(s) + curl, az + uz * L * s + sz * across);
      uv.push(k, s * L);
    }
  }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) {
    const a = i * (M + 1) + j, b = a + M + 1;
    idx.push(a, b, a + 1, a + 1, b, b + 1);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new ShaderMaterial({
    side: DoubleSide,
    uniforms: { uTime: clock },
    vertexShader: /* glsl */ `uniform float uTime; varying vec2 vUv;
      void main() { vUv = uv; vec3 p = position; p.y += sin(uv.y * 0.9 - uTime * 2.0) * 0.06 + sin(uv.x * 6.0 + uTime * 1.3) * 0.03; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = vec2(vUv.x * 4.0, vUv.y * 0.5 - uTime * 0.6);
        float n = fbm(p + fbm(p * 0.7) * 1.3);
        vec3 c = mix(vec3(0.22, 0.04, 0.45), vec3(0.66, 0.3, 1.0), smoothstep(0.35, 0.85, n));
        float foam = smoothstep(0.8, 1.0, vUv.x) * (0.6 + 0.4 * vnoise(p * 5.0));
        c = mix(c, vec3(0.95, 0.85, 1.0), foam * 0.7);
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  const wave = new Mesh(geo, mat);
  const group = new Group();
  group.add(wave);
  api.vfx({ group, update: () => {} });
  const footprints: Footprint[] = [];
  const steps = 34;
  for (let i = 0; i < steps; i++) {
    const s = (i + 0.5) / steps;
    footprints.push({ kind: 'box', x: ax + ux * L * s, z: az + uz * L * s, hw: half * 0.85, hd: L / steps / 2 + 0.05, top: heightAt(s), rotY: -Math.atan2(ux, uz) });
  }
  api.place({ object: new Group(), footprints });
}

// ---------- assembly ----------
export interface Kingdom {
  interactables: Interactable[];
}

/**
 * Builds the kingdom's sky, air, floor, streams and cup islands into the realm. `foundSound` is called when the hero
 * picks up the lost sound on the far cup (Yung Lean's quest); `soundWanted` says whether it is there to find.
 */
export function buildKingdom(api: RealmApi, hooks: { soundWanted(): boolean; foundSound(): void }): Kingdom {
  const R = GALAXY;
  const gy = R.y;
  api.realm(R.id);
  const sky = new Group();
  const dome = skyDome();
  dome.position.set(R.x, gy, R.z);
  const grid = horizonGrid();
  grid.position.set(R.x, gy - 26, R.z);
  sky.add(dome, grid);
  // Wireframe computers standing on the horizon, all round.
  const computers: Group[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + 0.3;
    const c = wireComputer(i % 2 ? 0xff5ec8 : 0x5ee8ff);
    const dist = 360 + (i % 3) * 40;
    c.scale.setScalar(55 + (i % 3) * 15);
    c.position.set(R.x + Math.cos(a) * dist, gy - 30, R.z + Math.sin(a) * dist);
    c.rotation.y = -a - Math.PI / 2;
    sky.add(c);
    computers.push(c);
  }
  // Two moons: a pale crescent and a huge holographic CD-ROM, turning.
  const crescent = crescentMoon();
  crescent.scale.setScalar(55);
  crescent.position.set(R.x - 160, gy + 210, R.z - 330);
  crescent.lookAt(R.x, gy, R.z);
  const cd = cdMoon();
  cd.scale.setScalar(120);
  cd.position.set(R.x + 230, gy + 150, R.z - 300);
  cd.lookAt(R.x, gy + 20, R.z);
  sky.add(crescent, cd);
  // The grinning moon with glowing eyes (shot-013056) takes the crescent's place once its model is in.
  const grin = faceMoon('moon-grin', 34, { crescent: 0.45, light: new Vector3(-1, 0.3, 0.4), glow: 0.9 });
  void grin.ready.then((ok) => {
    if (!ok) return;
    grin.group.position.copy(crescent.position);
    grin.group.lookAt(R.x, gy, R.z);
    crescent.visible = false;
    sky.add(grin.group);
  });
  let t = 0;
  api.vfx({ group: sky, update: (dt) => {
    t += dt;
    clock.value = t;
    cd.rotateZ(dt * 0.35);
    grin.update(dt);
    for (let i = 0; i < computers.length; i++) computers[i].position.y = gy - 30 + Math.sin(t * 0.2 + i) * 4;
    // The neon computers and the grinning moon fade out of the quarters' night sky.
    for (const c of computers) c.visible = kingdomNight.value < 0.8;
    grin.group.visible = kingdomNight.value < 0.85;
  } });
  // A humpback whale flying slow loops over the plaza and the cups (DeSEl9PvPG_), its body flexing as it swims.
  {
    const cx = R.x + 20;
    const cz = R.z - 10;
    const wy = gy + 38;
    let a = 0;
    const whale = modelLandmark('whale', cx + 85, cz, wy, {
      collider: 'none',
      onLoad: (m) => {
        // The swim wave along the body's long axis (measured from its mesh, whichever way Meshy laid it).
        m.root.traverse((o) => {
          const mesh = o as Mesh;
          if (!mesh.isMesh) return;
          mesh.geometry.computeBoundingBox();
          const bb = mesh.geometry.boundingBox!;
          const axis = bb.max.x - bb.min.x > bb.max.z - bb.min.z ? 'x' : 'z';
          const mat = (mesh.material as MeshStandardMaterial).clone();
          patchSwim(mat, axis, bb.min[axis], bb.max[axis], (bb.max.y - bb.min.y) * 0.18);
          mesh.material = mat;
        });
      },
      update: (dt, root) => {
        a += dt * 0.11;
        root.position.set(cx + Math.cos(a) * 85, wy + Math.sin(a * 2.3) * 5, cz + Math.sin(a) * 60);
        // Facing along the loop (its front is local +z), banking a little into the turn.
        root.rotation.set(0, Math.atan2(-Math.sin(a) * 85, Math.cos(a) * 60), 0.12);
      },
    });
    api.place(whale);
    const belly = glowSprite(0x8fa8ff, 22, 0.18, false);
    whale.root.add(belly);
  }
  // Pixel snow and the low pink fog.
  const snow = pixelSnow(gy);
  const snowGroup = new Group();
  snowGroup.add(snow.points);
  api.place({ object: snowGroup, footprints: [], update: (dt, player) => snow.update(dt, player) });
  api.group.add(blossomFog(R.x, R.z - 5, 120, 160, gy));
  // The floor: porcelain and marble, reflecting.
  api.group.add(porcelainFloor(R.x, R.z - 5, 120, 160, gy));
  // The plaza (its walls and the quarters round it: LeanQuarter.ts; the east edge opens onto the waves to the cups).
  api.place({ object: new Group(), footprints: [{ kind: 'box', x: R.x, z: R.z - 5, hw: 60, hd: 80, top: gy }] });
  // Two tea streams down the length of the plaza, either side of the road.
  // (The west stream stops short of the purple houses' street at x 966-974, z 5-35.)
  teaStream(api, [[R.x - 24, R.z - 2], [R.x - 30, R.z - 20], [R.x - 25, R.z - 50]], gy);
  teaStream(api, [[R.x + 27, R.z - 50], [R.x + 33, R.z - 20], [R.x + 26, R.z + 10], [R.x + 32, R.z + 40], [R.x + 27, R.z + 66]], gy);
  // The cup islands east of the plaza, joined by waves of lean (they used to be blocks with rope bridges).
  const cups: Array<[number, number]> = [[1082, 10], [1108, -12], [1136, 14]];
  const radii = cups.map(([x, z]) => leanCupIsland(api, x, z, gy));
  // From the plaza's edge into the first cup, then cup to cup: each end comes down WAVE_INSIDE inside a rim.
  const into = (i: number, fx: number, fz: number) => { const [x, z] = cups[i]; const d = Math.hypot(fx - x, fz - z); const k = (radii[i] - WAVE_INSIDE) / d; return [x + (fx - x) * k, z + (fz - z) * k] as const; };
  { const [bx, bz] = into(0, 1057, 10); leanWave(api, 1057, 10, bx, bz, gy); }
  for (let i = 0; i < cups.length - 1; i++) {
    const [ax, az] = into(i, cups[i + 1][0], cups[i + 1][1]);
    const [bx, bz] = into(i + 1, cups[i][0], cups[i][1]);
    leanWave(api, ax, az, bx, bz, gy);
  }
  // From the far cup out to the sky dock (LeanQuarter.ts), landing just inside the island's rim.
  {
    const D = LEAN_QUARTER.dock;
    const last = cups.length - 1;
    const [ax, az] = into(last, D.x, D.z);
    const d = Math.hypot(ax - D.x, az - D.z);
    leanWave(api, ax, az, D.x + ((ax - D.x) / d) * (D.r - 2), D.z + ((az - D.z) / d) * (D.r - 2), gy);
  }
  // The lost sound, humming in the mist on the far cup (Yung Lean's quest).
  const soundAt = new Vector3(1136, gy + 1.6, 14);
  const sound = new Group();
  const core = glowSprite(PALETTE.rune, 1.2, 0.9, true);
  const halo = glowSprite(PALETTE.dusk, 3.4, 0.4, true);
  sound.add(core, halo);
  for (let i = 0; i < 8; i++) { const s = glowSprite(i % 2 ? PALETTE.rune : 0xff9ad5, 0.25, 0.9, true); s.userData.k = i; sound.add(s); }
  sound.position.copy(soundAt);
  let st = 0;
  api.vfx({ group: sound, update: (dt) => {
    st += dt;
    sound.visible = hooks.soundWanted();
    core.scale.setScalar(1.2 + Math.sin(st * 6) * 0.15);
    sound.position.y = soundAt.y + Math.sin(st * 1.5) * 0.25;
    for (const c of sound.children) if (c.userData.k !== undefined) { const k = c.userData.k as number; const a = st * 1.8 + k * 0.785; c.position.set(Math.cos(a) * 0.9, Math.sin(st * 3 + k) * 0.35, Math.sin(a) * 0.9); }
  } });
  api.realm(null);
  return {
    interactables: [{
      pos: soundAt, range: 3, zone: R.id,
      label: () => (hooks.soundWanted() ? 'Take the lost sound' : null),
      act: () => hooks.foundSound(),
    }],
  };
}

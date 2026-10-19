/**
 * The Lean Quarter's effects (the @returndark reels): diamond glints that pop on grills, chains and cups, low purple
 * mist over the floors, meteors streaking the sky, and a ringed planet in a pink nebula. All sprites and shaders.
 */
import {
  AdditiveBlending, CanvasTexture, Color, DoubleSide, Group, Mesh, type Object3D, PlaneGeometry, RingGeometry,
  ShaderMaterial, SphereGeometry, Sprite, SpriteMaterial, Vector3,
} from 'three';
import { GLSL_NOISE_BASIC } from './glsl';

/** The colour of lean: glowing purple (bloom-safe, every channel under 1.5 once multiplied by the glows). */
export const LEAN = 0x9b4dff;

let starTex: CanvasTexture | undefined;
/** A four-pointed star with a hot centre: the sparkle on a diamond. */
export function starTexture(): CanvasTexture {
  if (starTex) return starTex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const c = size / 2;
  const core = ctx.createRadialGradient(c, c, 0, c, c, c * 0.35);
  core.addColorStop(0, 'rgba(255,255,255,1)');
  core.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);
  // The spikes: thin bright diamonds along the axes and fainter ones on the diagonals.
  const spike = (angle: number, len: number, width: number, alpha: number) => {
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(angle);
    const g = ctx.createLinearGradient(0, 0, len, 0);
    g.addColorStop(0, `rgba(255,255,255,${alpha})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(0, -width);
    ctx.lineTo(len, 0);
    ctx.lineTo(0, width);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  for (let i = 0; i < 4; i++) spike((i * Math.PI) / 2, c, 2.4, 1);
  for (let i = 0; i < 4; i++) spike((i * Math.PI) / 2 + Math.PI / 4, c * 0.55, 1.4, 0.55);
  starTex = new CanvasTexture(canvas);
  return starTex;
}

interface GlintAnchor { at: Object3D | Vector3; offset: Vector3; spread: number }

/**
 * Diamond glints: a pool of star sprites that flash one after another on the anchors (the grill of a skeleton, a
 * chain on a chest, an iced-out cup), each a quick swell and fade, as the reels' diamonds catch the light.
 */
export class Glints {
  readonly group = new Group();
  private readonly anchors: GlintAnchor[] = [];
  private readonly stars: Array<{ s: Sprite; age: number; life: number; size: number; a: GlintAnchor | null; local: Vector3 }> = [];
  private next = 0;

  constructor(count = 24, private readonly rate = 9, color = 0xffffff) {
    for (let i = 0; i < count; i++) {
      const s = new Sprite(new SpriteMaterial({ map: starTexture(), color, blending: AdditiveBlending, transparent: true, opacity: 0, depthWrite: false, fog: false }));
      s.visible = false;
      s.renderOrder = 7;
      this.group.add(s);
      this.stars.push({ s, age: 0, life: 0.3, size: 0.2, a: null, local: new Vector3() });
    }
  }

  /** Sparkles on `at` (an object, which they follow, or a fixed point), within `spread` metres of `offset`. */
  add(at: Object3D | Vector3, offset = new Vector3(), spread = 0.1): void {
    this.anchors.push({ at, offset, spread });
  }

  update(dt: number): void {
    if (this.anchors.length) {
      this.next -= dt * this.rate;
      while (this.next <= 0) {
        this.next += 0.5 + Math.random();
        const st = this.stars.find((x) => !x.s.visible);
        if (!st) break;
        st.a = this.anchors[Math.floor(Math.random() * this.anchors.length)];
        st.local.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(st.a.spread * 2).add(st.a.offset);
        st.age = 0;
        st.life = 0.22 + Math.random() * 0.25;
        st.size = 0.12 + Math.random() * 0.22;
        st.s.material.rotation = Math.random() * 0.6;
        st.s.visible = true;
      }
    }
    for (const st of this.stars) {
      if (!st.s.visible || !st.a) continue;
      st.age += dt;
      const k = st.age / st.life;
      if (k >= 1) { st.s.visible = false; continue; }
      const at = st.a.at;
      if ((at as Object3D).isObject3D) (at as Object3D).localToWorld(st.s.position.copy(st.local));
      else st.s.position.copy(at as Vector3).add(st.local);
      const swell = Math.sin(k * Math.PI);
      st.s.scale.setScalar(st.size * (0.3 + swell));
      st.s.material.opacity = swell;
    }
  }
}

const NOISE = GLSL_NOISE_BASIC;

/** The effects' shared clock (seconds); `tickLeanFx(dt)` advances it once a frame. */
const clock = { value: 0 };
export function tickLeanFx(dt: number): void { clock.value += dt; }

/**
 * Low mist hugging a floor: a few soft drifting layers of `color` (the purple mist of the fountain hall, the snow's
 * ground haze), densest at the bottom. `w` × `d` metres centred on (x, z), the lowest layer just over `y`.
 */
export function mistLayers(x: number, z: number, w: number, d: number, y: number, color: number, opacity = 0.3, layers = 3): Group {
  const g = new Group();
  const c = new Color(color);
  for (let i = 0; i < layers; i++) {
    const h = 0.25 + i * 0.6;
    const op = opacity * (1 - i / (layers + 0.5));
    const mat = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, side: DoubleSide,
      uniforms: { uTime: clock, uColor: { value: c } },
      vertexShader: /* glsl */ `varying vec2 vP; varying vec2 vUv; void main() { vUv = uv; vP = (modelMatrix * vec4(position, 1.0)).xz; gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0); }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform vec3 uColor; varying vec2 vP; varying vec2 vUv;
        ${NOISE}
        void main() {
          float n = fbm(vP * 0.09 + vec2(uTime * 0.04, uTime * 0.023) + ${(i * 3.1).toFixed(1)});
          // Soft at the edges of the patch, so it never shows a straight border.
          vec2 e = min(vUv, 1.0 - vUv);
          float edge = smoothstep(0.0, 0.12, min(e.x, e.y));
          gl_FragColor = vec4(uColor, smoothstep(0.38, 0.8, n) * ${op.toFixed(3)} * edge);
        }`,
    });
    const plane = new Mesh(new PlaneGeometry(w, d), mat);
    plane.rotation.x = -Math.PI / 2;
    plane.position.set(x, y + h, z);
    plane.renderOrder = 3;
    g.add(plane);
  }
  return g;
}

/**
 * Meteors: every few seconds a bright streak crosses the sky high above `center`, trailing a fading tail (the
 * shooting stars of DeOemU1BOZF and Dd5Bqt7vQ5T).
 */
export function meteors(center: Vector3, radius: number, height: number, color = 0xcfe0ff): { group: Group; update(dt: number): void } {
  const g = new Group();
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending, side: DoubleSide,
    uniforms: { uColor: { value: new Color(color) }, uAlpha: { value: 0 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv;
      void main() {
        // Head at u = 1, tail fading back to u = 0; thin across.
        float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
        float a = pow(vUv.x, 2.5) * pow(across, 3.0);
        gl_FragColor = vec4(uColor * (1.0 + 2.0 * pow(vUv.x, 12.0)), a * uAlpha);
      }`,
  });
  const streak = new Mesh(new PlaneGeometry(1, 1), mat);
  streak.frustumCulled = false;
  g.add(streak);
  const from = new Vector3();
  const dir = new Vector3();
  let t = 0;
  let wait = 2;
  let life = 0;
  return {
    group: g,
    update(dt) {
      if (life > 0) {
        t += dt;
        const k = t / life;
        if (k >= 1) { life = 0; mat.uniforms.uAlpha.value = 0; return; }
        mat.uniforms.uAlpha.value = Math.sin(k * Math.PI);
        streak.position.copy(from).addScaledVector(dir, t * 140);
        return;
      }
      wait -= dt;
      if (wait > 0) return;
      wait = 4 + Math.random() * 7;
      life = 1 + Math.random() * 0.6;
      t = 0;
      const a = Math.random() * Math.PI * 2;
      from.set(center.x + Math.cos(a) * radius, center.y + height + Math.random() * height * 0.4, center.z + Math.sin(a) * radius);
      dir.set(-Math.cos(a) + (Math.random() - 0.5) * 0.6, -0.25 - Math.random() * 0.2, -Math.sin(a) + (Math.random() - 0.5) * 0.6).normalize();
      // Laid along its path, the head leading: a long thin quad.
      streak.scale.set(46, 1.6, 1);
      streak.position.copy(from);
      streak.quaternion.setFromUnitVectors(new Vector3(1, 0, 0), dir);
    },
  };
}

/**
 * A ringed planet hanging in a pink nebula (DeOemU1BOZF): a banded sphere lit from one side, a dusty ring, and a
 * nebula cloud glowing behind it. `size` is the planet's radius in metres (it sits at sky distance).
 */
export function ringedPlanet(size: number): Group {
  const g = new Group();
  const body = new Mesh(new SphereGeometry(size, 48, 24), new ShaderMaterial({
    fog: false,
    uniforms: { uTime: clock },
    vertexShader: /* glsl */ `varying vec3 vN; varying vec3 vP; void main() { vN = normalize(normal); vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec3 vN; varying vec3 vP;
      ${NOISE}
      void main() {
        float lat = vN.y;
        // Cream and copper bands, warped a little, slowly turning.
        float bands = sin(lat * 26.0 + fbm(vec2(atan(vN.z, vN.x) * 2.0 + uTime * 0.01, lat * 6.0)) * 3.0);
        vec3 c = mix(vec3(0.95, 0.78, 0.6), vec3(0.62, 0.36, 0.3), 0.5 + 0.5 * bands);
        float light = clamp(dot(vN, normalize(vec3(-0.6, 0.35, 0.7))), 0.0, 1.0);
        c *= 0.18 + 0.95 * light;
        gl_FragColor = vec4(c, 1.0);
      }`,
  }));
  const ring = new Mesh(new RingGeometry(size * 1.35, size * 2.3, 96, 1), new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: DoubleSide,
    vertexShader: /* glsl */ `varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec2 vP;
      ${NOISE}
      void main() {
        float r = length(vP) / ${size.toFixed(1)};
        float rings = 0.55 + 0.45 * sin(r * 40.0) * sin(r * 13.0 + 1.0);
        float edge = smoothstep(1.35, 1.5, r) * smoothstep(2.3, 2.05, r);
        gl_FragColor = vec4(vec3(0.96, 0.84, 0.72) * (0.6 + 0.4 * rings), edge * (0.35 + 0.4 * rings));
      }`,
  }));
  ring.rotation.x = -Math.PI / 2 + 0.38;
  ring.rotation.y = 0.2;
  // The nebula behind: soft pink and violet clouds on a big billboard.
  const nebula = new Mesh(new PlaneGeometry(size * 9, size * 6), new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending,
    uniforms: { uTime: clock },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = (vUv - 0.5) * vec2(3.0, 2.0);
        float n = fbm(p * 1.6 + vec2(fbm(p * 2.0 + uTime * 0.01) * 1.5, 0.0));
        float fall = smoothstep(1.4, 0.2, length(p * vec2(0.7, 1.0)));
        vec3 c = mix(vec3(0.95, 0.25, 0.55), vec3(0.45, 0.2, 0.95), smoothstep(0.3, 0.7, n));
        gl_FragColor = vec4(c * smoothstep(0.3, 0.85, n) * fall * 0.7, 1.0);
      }`,
  }));
  nebula.position.z = -size * 2;
  g.add(nebula, body, ring);
  return g;
}

let moonTex: CanvasTexture | undefined;
/** A pale full moon with soft grey seas, for the big moons sitting on a realm's horizon (Dd5Bqt7vQ5T). */
export function horizonMoon(size: number): Sprite {
  if (!moonTex) {
    const s = 128;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = s;
    const ctx = canvas.getContext('2d')!;
    const g = ctx.createRadialGradient(s / 2, s / 2, s * 0.42, s / 2, s / 2, s / 2);
    g.addColorStop(0, 'rgba(220,232,255,1)');
    g.addColorStop(1, 'rgba(220,232,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = 'rgb(214,226,250)';
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s * 0.43, 0, Math.PI * 2);
    ctx.fill();
    // Seas: soft grey blotches.
    for (const [x, y, r] of [[0.4, 0.38, 0.12], [0.58, 0.5, 0.09], [0.45, 0.6, 0.07], [0.62, 0.33, 0.06], [0.33, 0.55, 0.05]]) {
      ctx.fillStyle = 'rgba(150,165,200,0.55)';
      ctx.beginPath();
      ctx.arc(x * s, y * s, r * s, 0, Math.PI * 2);
      ctx.fill();
    }
    moonTex = new CanvasTexture(canvas);
  }
  // (Dimmed below the bloom threshold: a pale disc, not a blown-out light.)
  const sp = new Sprite(new SpriteMaterial({ map: moonTex, color: 0x5a6680, transparent: true, fog: false, depthWrite: false }));
  sp.scale.setScalar(size);
  sp.renderOrder = -8;
  return sp;
}

/**
 * A purple swirling vortex in the sky (DeaqHWJBBPw's sky, Dd5Bqt7vQ5T's floating castle): a slowly turning spiral of
 * violet and pink with a dark heart. `size` metres across; face it toward the viewer.
 */
export function skyVortex(size: number, colors: [number, number] = [0x7a3cff, 0xff5ad6]): Mesh {
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: DoubleSide,
    uniforms: { uTime: clock, uA: { value: new Color(colors[0]) }, uB: { value: new Color(colors[1]) } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform vec3 uA; uniform vec3 uB; varying vec2 vUv;
      ${NOISE}
      void main() {
        vec2 p = vUv - 0.5;
        float r = length(p) * 2.0;
        float a = atan(p.y, p.x);
        float swirl = a + r * 5.0 - uTime * 0.12;
        float arms = 0.5 + 0.5 * sin(swirl * 3.0 + fbm(vec2(swirl, r * 4.0)) * 2.0);
        vec3 c = mix(uA, uB, arms) * (0.35 + 0.85 * arms);
        float heart = smoothstep(0.08, 0.3, r);
        float fade = smoothstep(1.0, 0.55, r);
        gl_FragColor = vec4(c * heart, fade * (0.45 + 0.55 * arms));
      }`,
  });
  const m = new Mesh(new PlaneGeometry(size, size), mat);
  m.frustumCulled = false;
  return m;
}

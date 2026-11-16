/**
 * The reel's volumetric explosion (v12, 2026-11-16: the godofprompt reel's fireball fills a third of the screen). A
 * burst is a cloud of 30-100 soft noise puffs thrown out from the blast and dragged to a stop at about its radius:
 * they are born white-hot, cool through the spell's colour (orange for fire, ice-blue for a moonbomb) to red and then
 * to dark smoke that keeps swelling and rises for a few seconds, with a ring of dust rolling out along the ground.
 * Every puff is one instance of a camera-facing quad with its own noise seed and heat, drawn in one call with
 * premultiplied blending: hot puffs are opaque glowing fire and cooled smoke darkens what is behind it.
 */
import {
  Color, CustomBlending, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, OneFactor, OneMinusSrcAlphaFactor,
  PlaneGeometry, ShaderMaterial, Vector3,
} from 'three';

const VERT = /* glsl */ `
attribute vec3 aCenter;
attribute float aSize;
attribute float aHeat;
attribute float aAlpha;
attribute float aSeed;
attribute vec3 aHot;
varying vec2 vUv;
varying float vHeat;
varying float vAlpha;
varying float vSeed;
varying vec3 vHot;
varying float vUp;
varying float vNear;
void main() {
  vUv = uv;
  vUp = position.y + 0.5;
  vHeat = aHeat; vAlpha = aAlpha; vSeed = aSeed; vHot = aHot;
  vec4 mv = viewMatrix * vec4(aCenter, 1.0);
  // A puff the camera is inside (a blast round the hero it follows) would fill the whole frame: it fades out as its
  // centre comes nearer than about its own size.
  vNear = smoothstep(0.35 * aSize, 1.2 * aSize, -mv.z);
  // Turned by its seed so no two puffs share an outline.
  float a = aSeed * 6.2832;
  vec2 p = mat2(cos(a), -sin(a), sin(a), cos(a)) * position.xy;
  mv.xy += p * aSize;
  gl_Position = projectionMatrix * mv;
}`;

const FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vHeat;
varying float vAlpha;
varying float vSeed;
varying vec3 vHot;
varying float vUp;
varying float vNear;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  if (vNear <= 0.001) discard;
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  // A billowing ball: a soft disc eaten into by turning noise at its edge.
  float n = fbm(c * 3.2 + vec2(vSeed * 17.0, vSeed * 9.0) + uTime * vec2(0.12, -0.25));
  float shape = 1.0 - smoothstep(0.2, 0.95, r + (n - 0.5) * 1.3);
  if (shape <= 0.001) discard;
  float h = clamp(vHeat + (n - 0.5) * 0.25, 0.0, 1.0);
  // Heat ramp: white-yellow core, the spell's colour, deep red, then smoke.
  vec3 core = vec3(1.0, 0.95, 0.82);
  vec3 deep = vHot * vec3(0.55, 0.22, 0.2) + vec3(0.12, 0.02, 0.0);
  vec3 fire = h > 0.7 ? mix(vHot, core, (h - 0.7) / 0.3) : mix(deep, vHot, smoothstep(0.3, 0.7, h));
  float emit = smoothstep(0.22, 0.55, h);
  // Smoke: dark cobalt-grey, lit from above by the moon and shadowed underneath, so each puff reads as a ball.
  float lit = mix(0.45, 1.35, smoothstep(0.1, 0.95, vUp + (n - 0.5) * 0.5));
  vec3 smoke = vec3(0.035, 0.04, 0.065) * (0.6 + 0.9 * n) * lit;
  float smokeA = (1.0 - emit) * shape * (vAlpha * vNear) * 0.5 * (0.6 + 0.6 * n);
  // Fire is opaque: a hot puff covers what is behind it (alpha 0.7), so a hundred overlapping puffs settle on the
  // fire's own colour (white-hot core at most ~2.6x) instead of adding up to a white screen.
  vec3 rgb = fire * emit * shape * (vAlpha * vNear) * (0.6 + 1.2 * h) + smoke * smokeA;
  gl_FragColor = vec4(rgb, smokeA + emit * shape * (vAlpha * vNear) * 0.7);
}`;

interface Puff {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  size: number; grow: number;
  heat: number; cool: number;
  age: number; life: number;
  seed: number; hot: Color;
  /** Ground dust: grey, no heat, hugs the ground. */
  dust: boolean;
  /** Cloud: hangs where it is, turning slowly round `cx, cz` (a storm's shelf cloud). */
  still?: { cx: number; cz: number };
}

export interface BurstOptions {
  /** The fire's colour between white-hot and red (default fire orange). */
  hot?: number;
  /** Puffs per metre of radius (default 14). */
  density?: number;
  /** How long the smoke lingers (default 1 = about 3-6 s). */
  smoke?: number;
}

export class Explosions {
  readonly geometry: InstancedBufferGeometry;
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly puffs: Puff[] = [];
  private readonly aCenter: InstancedBufferAttribute;
  private readonly aSize: InstancedBufferAttribute;
  private readonly aHeat: InstancedBufferAttribute;
  private readonly aAlpha: InstancedBufferAttribute;
  private readonly aSeed: InstancedBufferAttribute;
  private readonly aHot: InstancedBufferAttribute;
  private time = 0;

  constructor(private readonly cap = 600) {
    const g = new InstancedBufferGeometry();
    const quad = new PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    const mk = (n: number) => new InstancedBufferAttribute(new Float32Array(cap * n), n);
    this.aCenter = mk(3); this.aSize = mk(1); this.aHeat = mk(1); this.aAlpha = mk(1); this.aSeed = mk(1); this.aHot = mk(3);
    for (const a of [this.aCenter, this.aSize, this.aHeat, this.aAlpha, this.aSeed, this.aHot]) a.setUsage(35048 /* DynamicDrawUsage */);
    g.setAttribute('aCenter', this.aCenter); g.setAttribute('aSize', this.aSize); g.setAttribute('aHeat', this.aHeat);
    g.setAttribute('aAlpha', this.aAlpha); g.setAttribute('aSeed', this.aSeed); g.setAttribute('aHot', this.aHot);
    g.instanceCount = 0;
    this.geometry = g;
    this.mat = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: CustomBlending, blendSrc: OneFactor, blendDst: OneMinusSrcAlphaFactor,
      uniforms: { uTime: { value: 0 } },
    });
    this.mesh = new Mesh(g, this.mat);
    this.mesh.name = 'explosions';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
  }

  get live(): number { return this.puffs.length; }

  /** A blast `r` metres across at `at`. */
  burst(at: Vector3, r: number, o: BurstOptions = {}): void {
    const hot = new Color(o.hot ?? 0xff7a1a);
    const n = Math.round(Math.max(30, Math.min(90, r * (o.density ?? 14))));
    const smoke = o.smoke ?? 1;
    const push = (p: Puff) => {
      if (this.puffs.length >= this.cap) {
        // Full: the oldest smoke makes way.
        let oldest = 0;
        for (let i = 1; i < this.puffs.length; i++) if (this.puffs[i].age / this.puffs[i].life > this.puffs[oldest].age / this.puffs[oldest].life) oldest = i;
        this.puffs.splice(oldest, 1);
      }
      this.puffs.push(p);
    };
    for (let i = 0; i < n; i++) {
      // Out in every direction, more sideways and up than down.
      const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u);
      const dx = Math.cos(a) * s, dy = Math.abs(u) * 0.8 + 0.15, dz = Math.sin(a) * s;
      const speed = r * (1.6 + Math.random() * 2.6);
      push({
        x: at.x + dx * r * 0.1, y: at.y + 0.5 + dy * r * 0.1, z: at.z + dz * r * 0.1,
        vx: dx * speed, vy: dy * speed, vz: dz * speed,
        size: r * (0.25 + Math.random() * 0.3), grow: r * (0.3 + Math.random() * 0.35),
        heat: 1, cool: 0.6 + Math.random() * 0.6,
        age: 0, life: (2.6 + Math.random() * 2.4) * smoke,
        seed: Math.random(), hot, dust: false,
      });
    }
    // A ring of dust rolling out along the ground.
    const dustN = Math.round(Math.min(24, 8 + r * 2.5));
    for (let i = 0; i < dustN; i++) {
      const a = (i / dustN) * Math.PI * 2 + Math.random() * 0.3;
      const speed = r * (2.2 + Math.random());
      push({
        x: at.x, y: at.y + 0.3, z: at.z, vx: Math.cos(a) * speed, vy: 0.4, vz: Math.sin(a) * speed,
        size: r * 0.3, grow: r * 0.45, heat: 0, cool: 0, age: 0, life: (2 + Math.random() * 1.5) * smoke,
        seed: Math.random(), hot, dust: true,
      });
    }
    this.write();
  }

  /**
   * A storm's shelf cloud: `n` big dark puffs in a deck `r` metres round over `at`, appearing from the middle outward
   * over two seconds, hanging there turning slowly, and thinning away by `life` seconds.
   */
  cloud(at: Vector3, r: number, n: number, life: number): void {
    const hot = new Color(0x000000);
    for (let i = 0; i < n; i++) {
      if (this.puffs.length >= this.cap) this.puffs.shift();
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const delay = (d / r) * 2;
      this.puffs.push({
        x: at.x + Math.cos(a) * d, y: at.y + (Math.random() - 0.5) * 1.5 - (1 - d / r) * 1.2, z: at.z + Math.sin(a) * d,
        vx: 0, vy: 0, vz: 0, size: 5 + Math.random() * 4, grow: 1.2, heat: 0, cool: 0,
        age: -delay, life: life - delay, seed: Math.random(), hot, dust: false, still: { cx: at.x, cz: at.z },
      });
    }
    this.write();
  }

  update(dt: number): void {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    for (let i = this.puffs.length - 1; i >= 0; i--) {
      const p = this.puffs[i];
      p.age += dt;
      if (p.age >= p.life) { this.puffs.splice(i, 1); continue; }
      if (p.still) {
        if (p.age < 0) continue;
        // Turns slowly round the storm's middle; grows a little as it rolls.
        const dx = p.x - p.still.cx, dz = p.z - p.still.cz, w = 0.12 * dt;
        p.x = p.still.cx + dx * Math.cos(w) - dz * Math.sin(w);
        p.z = p.still.cz + dx * Math.sin(w) + dz * Math.cos(w);
        p.size += (p.grow * dt) / (1 + p.age);
        continue;
      }
      // Dragged to a stop; hot air and smoke rise.
      const drag = Math.exp(-(p.dust ? 2.6 : 3.4) * dt);
      p.vx *= drag; p.vz *= drag; p.vy *= drag;
      if (!p.dust) p.vy += (1.2 + p.heat * 2.5) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.heat = Math.max(0, p.heat - p.cool * dt);
      p.size += (p.grow * dt) / (1 + p.age);
    }
    this.write();
  }

  /** Farthest any shown puff's edge reaches from `c` (sideways). */
  extent(c: Vector3): number {
    let m = 0;
    for (const p of this.puffs) if (p.age >= 0) m = Math.max(m, Math.hypot(p.x - c.x, p.z - c.z) + p.size / 2);
    return m;
  }
  maxHeat(): number { return this.puffs.reduce((m, p) => Math.max(m, p.heat), 0); }
  meanY(): number { return this.puffs.length ? this.puffs.reduce((s, p) => s + p.y, 0) / this.puffs.length : 0; }

  private write(): void {
    const n = this.puffs.length;
    const C = this.aCenter.array as Float32Array, S = this.aSize.array as Float32Array, H = this.aHeat.array as Float32Array;
    const A = this.aAlpha.array as Float32Array, E = this.aSeed.array as Float32Array, T = this.aHot.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const p = this.puffs[i];
      C[i * 3] = p.x; C[i * 3 + 1] = p.y; C[i * 3 + 2] = p.z;
      S[i] = p.size;
      H[i] = p.heat;
      const k = Math.max(0, p.age) / p.life;
      A[i] = p.still
        ? Math.max(0, Math.min(1, p.age / 0.8)) * (k < 0.75 ? 1 : Math.max(0, 1 - (k - 0.75) / 0.25)) * 0.9
        : Math.min(1, p.age / 0.05) * (k < 0.55 ? 1 : Math.max(0, 1 - (k - 0.55) / 0.45)) * (p.dust ? 0.55 : 1);
      E[i] = p.seed;
      if (p.dust) { T[i * 3] = 0.3; T[i * 3 + 1] = 0.32; T[i * 3 + 2] = 0.4; } else { T[i * 3] = p.hot.r; T[i * 3 + 1] = p.hot.g; T[i * 3 + 2] = p.hot.b; }
    }
    for (const a of [this.aCenter, this.aSize, this.aHeat, this.aAlpha, this.aSeed, this.aHot]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, Math.max(1, n) * a.itemSize);
      a.needsUpdate = true;
    }
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
  }

  dispose(): void {
    this.geometry.dispose();
    this.mat.dispose();
  }
}

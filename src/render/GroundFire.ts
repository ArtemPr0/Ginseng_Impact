/**
 * Fires left burning on the ground after a blast (v12, 2026-11-16: in the godofprompt reel the grass keeps burning in
 * patches after every fireball and along the tornado's path). Each fire is a tongue of flame: an upright quad that
 * turns to face the camera about its own vertical axis, its shape licked by rising noise, white-yellow at the root to
 * orange and red at the tips. They flare up over half a second, burn 8-15 s flickering, and die down; at most `cap`
 * burn at once (High 120, Low 40), the oldest going out first. One instanced draw for all of them.
 */
import {
  AdditiveBlending, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, type Vector3,
} from 'three';

const VERT = /* glsl */ `
attribute vec3 aRoot;
attribute float aSize;
attribute float aSeed;
varying vec2 vUv;
varying float vSeed;
void main() {
  vUv = uv;
  vSeed = aSeed;
  // Upright, turned to the camera about its own vertical axis (a flame does not lie down when seen from above).
  vec3 toCam = cameraPosition - aRoot;
  vec3 side = normalize(vec3(toCam.z, 0.0, -toCam.x) + vec3(1e-4, 0.0, 0.0));
  vec3 p = aRoot + side * position.x * aSize * 0.9 + vec3(0.0, (position.y + 0.5) * aSize * 1.5, 0.0);
  gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv;
varying float vSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void main() {
  float y = vUv.y;
  float x = (vUv.x - 0.5) * 2.0;
  // Rising noise licks the edges; the tongue narrows to a tip.
  float t = uTime * 2.4 + vSeed * 31.0;
  float n = noise(vec2(x * 2.5 + vSeed * 7.0, y * 3.5 - t)) * 0.6 + noise(vec2(x * 5.0, y * 7.0 - t * 1.7)) * 0.4;
  float w = (1.0 - y) * 0.9 + 0.1;
  float body = 1.0 - smoothstep(w * 0.55, w, abs(x) + (n - 0.5) * 0.5 * y);
  body *= 1.0 - smoothstep(0.55, 1.0, y + (n - 0.5) * 0.35);
  body *= smoothstep(0.0, 0.08, y);
  if (body <= 0.002) discard;
  // Hot down the middle, cooling to orange and deep red toward the licking edges (a solid pale tongue reads as a cone).
  float core = 1.0 - smoothstep(0.0, w * 0.7, abs(x) + (n - 0.5) * 0.3);
  float heat = clamp(1.0 - y * 1.25 + (n - 0.5) * 0.3, 0.0, 1.0);
  heat *= 0.35 + 0.65 * core;
  // Ragged and see-through toward its edges.
  float a = body * (0.45 + 0.55 * core) * (0.75 + 0.5 * n);
  vec3 col = heat > 0.6 ? mix(vec3(1.0, 0.45, 0.08), vec3(1.0, 0.9, 0.62), (heat - 0.6) / 0.4) : mix(vec3(0.6, 0.08, 0.02), vec3(1.0, 0.45, 0.08), heat / 0.6);
  gl_FragColor = vec4(col * a * (0.45 + heat * 0.75), a);
}`;

export interface FireTongue {
  x: number; y: number; z: number;
  /** Full height, metres. */
  size: number;
  /** Height shown now (flare up, flicker, die down). */
  shown: number;
  age: number; life: number; seed: number;
}

export class GroundFires {
  readonly geometry: InstancedBufferGeometry;
  readonly mesh: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly fires: FireTongue[] = [];
  private readonly aRoot: InstancedBufferAttribute;
  private readonly aSize: InstancedBufferAttribute;
  private readonly aSeed: InstancedBufferAttribute;
  private time = 0;

  constructor(public cap = 120) {
    const g = new InstancedBufferGeometry();
    const quad = new PlaneGeometry(1, 1);
    g.index = quad.index;
    g.setAttribute('position', quad.getAttribute('position'));
    g.setAttribute('uv', quad.getAttribute('uv'));
    const max = Math.max(cap, 120);
    this.aRoot = new InstancedBufferAttribute(new Float32Array(max * 3), 3);
    this.aSize = new InstancedBufferAttribute(new Float32Array(max), 1);
    this.aSeed = new InstancedBufferAttribute(new Float32Array(max), 1);
    for (const a of [this.aRoot, this.aSize, this.aSeed]) a.setUsage(35048 /* DynamicDrawUsage */);
    g.setAttribute('aRoot', this.aRoot); g.setAttribute('aSize', this.aSize); g.setAttribute('aSeed', this.aSeed);
    g.instanceCount = 0;
    this.geometry = g;
    this.mat = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uTime: { value: 0 } },
    });
    this.mesh = new Mesh(g, this.mat);
    this.mesh.name = 'ground-fires';
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
  }

  get live(): number { return this.fires.length; }
  list(): readonly FireTongue[] { return this.fires; }

  /** `count` fires scattered within `r` of `at`, each on the ground there (`groundAt`). */
  ignite(at: Vector3, r: number, count: number, groundAt: (x: number, z: number) => number, life: [number, number] = [8, 15]): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r;
      const x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d;
      if (this.fires.length >= this.cap) this.fires.shift();
      this.fires.push({
        x, y: groundAt(x, z), z, size: 1.1 + Math.random() * 1.6, shown: 0,
        age: 0, life: life[0] + Math.random() * (life[1] - life[0]), seed: Math.random(),
      });
    }
    this.write();
  }

  update(dt: number): void {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    for (let i = this.fires.length - 1; i >= 0; i--) {
      const f = this.fires[i];
      f.age += dt;
      if (f.age >= f.life) { this.fires.splice(i, 1); continue; }
      const up = Math.min(1, f.age / 0.5);
      const down = Math.min(1, (f.life - f.age) / 2);
      const flicker = 0.85 + 0.15 * Math.sin(this.time * 9 + f.seed * 40) * Math.sin(this.time * 5.3 + f.seed * 13);
      f.shown = f.size * up * down * flicker;
    }
    this.write();
  }

  /** True when a fire burns within `r` of (x, z). */
  burning(x: number, z: number, r: number): boolean {
    for (const f of this.fires) if (f.shown > 0.2 && Math.hypot(f.x - x, f.z - z) <= r) return true;
    return false;
  }

  private write(): void {
    const n = this.fires.length;
    const R = this.aRoot.array as Float32Array, S = this.aSize.array as Float32Array, E = this.aSeed.array as Float32Array;
    for (let i = 0; i < n; i++) {
      const f = this.fires[i];
      R[i * 3] = f.x; R[i * 3 + 1] = f.y; R[i * 3 + 2] = f.z;
      S[i] = f.shown;
      E[i] = f.seed;
    }
    for (const a of [this.aRoot, this.aSize, this.aSeed]) { a.clearUpdateRanges(); a.addUpdateRange(0, Math.max(1, n) * a.itemSize); a.needsUpdate = true; }
    this.geometry.instanceCount = n;
    this.mesh.visible = n > 0;
  }

  dispose(): void {
    this.geometry.dispose();
    this.mat.dispose();
  }
}

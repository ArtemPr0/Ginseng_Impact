/**
 * Billowing dust and smoke that lingers (quality pass of 2026-11-16): big soft puffs that rise, spread, slow and
 * drift for several seconds, each one a camera-facing quad with animated noise inside a soft round edge, lit from
 * the moon's side so a cloud has volume. Collapses raise a cloud of it from their base; blasts roll smoke up from it.
 * One instanced draw, a fixed pool; everything moves in the vertex shader from a birth time (no per-frame upload).
 */
import { Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, PlaneGeometry, ShaderMaterial, Sphere, Vector3, type ColorRepresentation } from 'three';

const VERT = /* glsl */ `
attribute vec3 aStart; attribute vec3 aVel; attribute vec4 aLife; attribute vec3 aColor;
uniform float uTime;
varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying float vSeed;
void main() {
  // aLife: birth, life, size at birth, size at death.
  float age = uTime - aLife.x;
  float k = clamp(age / aLife.y, 0.0, 1.0);
  // Slows as it spreads (drag), keeps rising a little (buoyancy), drifts with the wind.
  float slow = (1.0 - exp(-age * 1.1)) / 1.1;
  vec3 p = aStart + aVel * slow + vec3(0.25, 0.18, 0.1) * age;
  float size = mix(aLife.z, aLife.w, 1.0 - (1.0 - k) * (1.0 - k));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float spin = aStart.x * 3.1 + age * (fract(aStart.z * 7.3) - 0.5) * 0.6;
  vec2 q = vec2(cos(spin) * position.x - sin(spin) * position.y, sin(spin) * position.x + cos(spin) * position.y);
  mv.xy += q * size;
  gl_Position = projectionMatrix * mv;
  vUv = position.xy + 0.5;
  // Fades in fast, out slow; nothing before birth or after death.
  vAlpha = age < 0.0 || k >= 1.0 ? 0.0 : smoothstep(0.0, 0.08, k) * (1.0 - k) * (1.0 - k * 0.4);
  vColor = aColor;
  vSeed = fract(aStart.x * 0.37 + aStart.z * 0.71);
}`;

const FRAG = /* glsl */ `
uniform float uTime;
varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying float vSeed;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
void main() {
  if (vAlpha <= 0.0) discard;
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  vec2 w = vUv * 2.6 + vSeed * 17.0 + vec2(uTime * 0.05, -uTime * 0.08);
  float n = fbm(w + fbm(w * 0.8 + 3.0));
  // Billows: a round body broken at its rim by the noise.
  float body = smoothstep(1.0, 0.25, r + (n - 0.5) * 0.9);
  float a = body * vAlpha * 0.8;
  if (a < 0.01) discard;
  // Lit from above and one side (the moon), darker underneath: a cloud with volume.
  float lit = 0.8 + 0.55 * clamp(-c.y * 1.2 + c.x * 0.4 + (n - 0.5) * 0.6, -0.5, 0.6);
  gl_FragColor = vec4(vColor * lit, a);
}`;

export interface CloudOptions { puffs?: number; life?: number; rise?: number; spread?: number; /** Puff size at birth, metres. */ size?: number }

export class Billow {
  readonly mesh: Mesh;
  private readonly geo: InstancedBufferGeometry;
  private readonly mat: ShaderMaterial;
  private readonly start: InstancedBufferAttribute;
  private readonly vel: InstancedBufferAttribute;
  private readonly lifeA: InstancedBufferAttribute;
  private readonly color: InstancedBufferAttribute;
  private time = 0;
  private head = 0;
  private until = 0;
  private readonly bounds: Sphere;
  private readonly col = new Color();

  constructor(private readonly pool = 220) {
    const plane = new PlaneGeometry(1, 1);
    this.geo = new InstancedBufferGeometry();
    this.geo.index = plane.index;
    this.geo.setAttribute('position', plane.attributes.position);
    const mk = (n: number) => { const a = new InstancedBufferAttribute(new Float32Array(pool * n), n); a.setUsage(DynamicDrawUsage); return a; };
    this.start = mk(3); this.vel = mk(3); this.lifeA = mk(4); this.color = mk(3);
    // (Unborn slots are dead: life 1 s, born long ago.)
    for (let i = 0; i < pool; i++) { this.lifeA.setXYZW(i, -1e6, 1, 0, 0); }
    this.geo.setAttribute('aStart', this.start);
    this.geo.setAttribute('aVel', this.vel);
    this.geo.setAttribute('aLife', this.lifeA);
    this.geo.setAttribute('aColor', this.color);
    this.geo.instanceCount = pool;
    this.mat = new ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false,
      forceSinglePass: true, uniforms: { uTime: { value: 0 } },
    });
    this.mesh = new Mesh(this.geo, this.mat);
    this.mesh.name = 'billow';
    this.mesh.renderOrder = 5;
    this.mesh.visible = false;
    this.bounds = new Sphere(new Vector3(), 1);
    this.geo.boundingSphere = this.bounds;
  }

  /** Puffs alive now. */
  get live(): number {
    let n = 0;
    const l = this.lifeA.array as Float32Array;
    for (let i = 0; i < this.pool; i++) if (this.time - l[i * 4] < l[i * 4 + 1]) n++;
    return n;
  }

  startOf(i: number): Vector3 { return new Vector3(this.start.getX(i), this.start.getY(i), this.start.getZ(i)); }
  velOf(i: number): Vector3 { return new Vector3(this.vel.getX(i), this.vel.getY(i), this.vel.getZ(i)); }

  /**
   * A cloud rising from the ground round (at), `r` metres across at its base: dust from a collapse, smoke from a blast.
   * `life` seconds; `rise` m/s up; `spread` m/s out.
   */
  cloud(at: Vector3, r: number, color: ColorRepresentation, o: CloudOptions = {}): void {
    const n = Math.min(this.pool, o.puffs ?? Math.round(8 + r * 4));
    const life = o.life ?? 7;
    const rise = o.rise ?? 1.2 + r * 0.25;
    const spread = o.spread ?? 1 + r * 0.35;
    this.col.set(color);
    for (let k = 0; k < n; k++) {
      const i = this.head;
      this.head = (i + 1) % this.pool;
      const a = Math.random() * Math.PI * 2, d = r * Math.sqrt(Math.random());
      const x = at.x + Math.cos(a) * d, z = at.z + Math.sin(a) * d;
      this.start.setXYZ(i, x, at.y + Math.random() * r * 0.25, z);
      const out = spread * (0.5 + Math.random() * 0.7);
      this.vel.setXYZ(i, Math.cos(a) * out, rise * (0.5 + Math.random() * 0.9), Math.sin(a) * out);
      const s0 = (o.size ?? 0.6 + r * 0.3) * (0.6 + Math.random() * 0.6);
      this.lifeA.setXYZW(i, this.time + Math.random() * Math.min(0.6, life * 0.1), life * (0.7 + Math.random() * 0.5), s0, s0 * (1.8 + Math.random() * 0.8));
      const v = 0.85 + Math.random() * 0.25;
      this.color.setXYZ(i, this.col.r * v, this.col.g * v, this.col.b * v);
    }
    this.start.needsUpdate = this.vel.needsUpdate = this.lifeA.needsUpdate = this.color.needsUpdate = true;
    const reach = r * 2 + (rise + spread) * life + 8;
    if (this.time >= this.until) { this.bounds.center.copy(at); this.bounds.radius = reach; }
    else {
      const d = this.bounds.center.distanceTo(at);
      if (d + reach > this.bounds.radius) {
        const R = (this.bounds.radius + d + reach) / 2;
        if (d > 0) this.bounds.center.lerp(at, (R - this.bounds.radius) / d);
        this.bounds.radius = R;
      }
    }
    this.until = Math.max(this.until, this.time + Math.min(0.6, life * 0.1) + life * 1.2 + 0.05);
    this.mesh.visible = true;
  }

  update(dt: number): void {
    this.time += dt;
    this.mat.uniforms.uTime.value = this.time;
    if (this.mesh.visible && this.time >= this.until) this.mesh.visible = false;
  }
}

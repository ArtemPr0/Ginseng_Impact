/**
 * The Blood Eye's living iris (shot-013226), drawn over the model's painted one: a blue iris with a black pupil that
 * follows the hero, snaps narrow when hit, and a bloodshot red that spreads as it weakens. A disc on the eyeball's
 * front, in a shader.
 */
import { CircleGeometry, Color, Group, Mesh, ShaderMaterial } from 'three';

const FRAG = /* glsl */ `
uniform vec3 uIris; uniform float uPupil; uniform float uBlood; uniform float uTime; uniform float uFlash; varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float fib = vnoise(vec2(atan(p.y, p.x) * 8.0, r * 10.0 - uTime * 0.3)) * 0.5 + 0.5;
  vec3 iris = uIris * (0.55 + fib * 0.8) + vec3(0.6, 0.8, 1.6) * smoothstep(0.55, 0.2, r) * 0.4;
  iris = mix(iris, vec3(1.3, 0.1, 0.05), uBlood * smoothstep(0.3, 1.0, r) * fib);
  float pupil = smoothstep(uPupil + 0.04, uPupil - 0.04, r);
  vec3 col = mix(iris, vec3(0.0), pupil);
  col += vec3(1.0) * smoothstep(0.1, 0.0, length(p - vec2(-0.3, 0.35))) * 0.8;
  col = mix(col, vec3(1.4, 0.3, 0.2), uFlash);
  float alpha = smoothstep(1.0, 0.86, r);
  gl_FragColor = vec4(col, alpha);
}`;

export class EyeIris {
  readonly group = new Group();
  private readonly mat: ShaderMaterial;
  private pupil = 0.32;
  private flash = 0;
  private t = 0;

  constructor(radius: number, iris: number) {
    this.mat = new ShaderMaterial({
      uniforms: { uIris: { value: new Color(iris) }, uPupil: { value: 0.32 }, uBlood: { value: 0 }, uTime: { value: 0 }, uFlash: { value: 0 } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: FRAG, transparent: true, depthWrite: false,
    });
    const disc = new Mesh(new CircleGeometry(radius, 40), this.mat);
    disc.renderOrder = 3;
    this.group.add(disc);
  }

  /** Hit: the pupil snaps to a pinpoint and the iris flashes. */
  hurt(): void {
    this.pupil = 0.08;
    this.flash = 1;
  }

  /** `health` 1 → 0: the red spreads through the iris as it weakens. */
  update(dt: number, health: number, near: number): void {
    this.t += dt;
    // The pupil widens when the hero is close, breathes, and recovers after a hit.
    const want = 0.28 + near * 0.12 + Math.sin(this.t * 0.9) * 0.03;
    this.pupil += (want - this.pupil) * Math.min(1, dt * 1.5);
    this.flash = Math.max(0, this.flash - dt * 3);
    const u = this.mat.uniforms;
    u.uPupil.value = this.pupil;
    u.uBlood.value = Math.max(0, 1 - health * 1.4);
    u.uTime.value = this.t;
    u.uFlash.value = this.flash;
  }
}

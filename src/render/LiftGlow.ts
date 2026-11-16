/**
 * Telekinesis' highlight (the user's call of 2026-11-16: "I don't see how the wizard can pick things up"): with
 * Telekinesis picked, whatever right click would lift — a mob, loose rubble, a small building — is ringed on the ground
 * by a slowly turning violet rune band with a soft column of light rising off it, so it reads as "grabbable".
 */
import { AdditiveBlending, CylinderGeometry, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';

const RING_FRAG = /* glsl */ `
uniform float uTime; uniform float uA;
varying vec2 vUv;
void main() {
  vec2 c = vUv - 0.5;
  float r = length(c) * 2.0;
  float band = smoothstep(0.78, 0.9, r) * (1.0 - smoothstep(0.94, 1.0, r));
  float a = atan(c.y, c.x);
  // Rune ticks round the band, turning.
  float ticks = step(0.55, fract((a + uTime * 0.6) * 24.0 / 6.2832));
  float inner = smoothstep(0.62, 0.7, r) * (1.0 - smoothstep(0.7, 0.74, r)) * 0.6;
  float glow = band * (0.55 + 0.45 * ticks) + inner + (1.0 - smoothstep(0.0, 0.9, r)) * 0.08;
  gl_FragColor = vec4(vec3(0.62, 0.42, 1.0) * glow * 1.4, glow * uA);
}`;
const COL_FRAG = /* glsl */ `
uniform float uTime; uniform float uA;
varying vec2 vUv;
void main() {
  float up = 1.0 - vUv.y;
  float shimmer = 0.75 + 0.25 * sin(vUv.x * 40.0 + uTime * 3.0 - vUv.y * 9.0);
  float a = up * up * 0.35 * shimmer * uA;
  gl_FragColor = vec4(vec3(0.6, 0.45, 1.0) * a * 2.0, a);
}`;
const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

export type LiftTargetLike = { kind: 'mob' | 'rubble' | 'building'; x: number; y: number; z: number; r: number } | null;

export class LiftGlow {
  readonly group = new Group();
  /** 0..1, fading in on a target and out without one. */
  strength = 0;
  private time = 0;
  private readonly mats: ShaderMaterial[];

  constructor() {
    const mk = (frag: string) => new ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag, transparent: true, depthWrite: false, blending: AdditiveBlending,
      side: DoubleSide, forceSinglePass: true, uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
    });
    const ring = new Mesh(new PlaneGeometry(2.2, 2.2), mk(RING_FRAG));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.08;
    const col = new Mesh(new CylinderGeometry(1, 1, 2.4, 32, 1, true), mk(COL_FRAG));
    col.position.y = 1.2;
    this.mats = [ring.material as ShaderMaterial, col.material as ShaderMaterial];
    this.group.add(ring, col);
    this.group.name = 'lift-glow';
    this.group.visible = false;
    this.group.renderOrder = 6;
  }

  update(dt: number, t: LiftTargetLike): void {
    this.time += dt;
    this.strength = t ? Math.min(1, this.strength + dt * 6) : Math.max(0, this.strength - dt * 5);
    if (t) {
      this.group.position.set(t.x, t.y, t.z);
      const r = Math.max(0.8, t.r);
      this.group.scale.set(r, t.kind === 'building' ? Math.max(1.5, r) : 1, r);
    }
    const pulse = 0.85 + 0.15 * Math.sin(this.time * 5);
    for (const m of this.mats) { m.uniforms.uTime.value = this.time; m.uniforms.uA.value = this.strength * pulse; }
    this.group.visible = this.strength > 0.01;
  }
}

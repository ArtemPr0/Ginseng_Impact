/**
 * Orlan's Telekinesis made visible (v12, 2026-11-16, the user: "I still don't see how the wizard can pick up mobs and
 * buildings"): while he holds something, a crackling violet beam runs from his hand to it and a shimmering field of
 * force wraps what he holds. Both fade in as he grabs and out as he lets go.
 */
import { AdditiveBlending, CylinderGeometry, DoubleSide, Group, Mesh, Quaternion, ShaderMaterial, SphereGeometry, Vector3 } from 'three';

const VERT = /* glsl */ `
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const BEAM_FRAG = /* glsl */ `
uniform float uT; uniform float uA;
varying vec2 vUv;
void main() {
  // Pulses running along it from the hand, a bright core, crackling edges.
  float pulse = 0.6 + 0.4 * sin(vUv.y * 40.0 - uT * 22.0);
  float edge = 1.0 - abs(vUv.x - 0.5) * 2.0;
  float crack = step(0.82, fract(sin(floor(vUv.y * 60.0 + uT * 30.0) * 12.9898) * 43758.5453));
  float a = (pow(edge, 3.0) * pulse + crack * edge * 0.6) * uA;
  gl_FragColor = vec4(vec3(0.72, 0.5, 1.0) * a * 2.2, a);
}`;
const FIELD_FRAG = /* glsl */ `
uniform float uT; uniform float uA;
varying vec2 vUv; varying vec3 vN; varying vec3 vV;
void main() {
  float rim = pow(1.0 - abs(dot(vN, vV)), 2.5);
  float bands = 0.75 + 0.25 * sin(vUv.y * 30.0 + uT * 4.0) * sin(vUv.x * 24.0 - uT * 3.0);
  float a = rim * bands * 0.85 * uA;
  gl_FragColor = vec4(vec3(0.62, 0.42, 1.0) * a * 1.8, a);
}`;

const UP = new Vector3(0, 1, 0);

export interface MindHold { from: Vector3; to: Vector3; r: number }

export class MindBeam {
  readonly group = new Group();
  strength = 0;
  private time = 0;
  private readonly beam: Mesh;
  private readonly field: Mesh;
  private readonly mats: ShaderMaterial[];

  constructor() {
    const mk = (frag: string) => new ShaderMaterial({
      vertexShader: VERT, fragmentShader: frag, transparent: true, depthWrite: false, blending: AdditiveBlending,
      side: DoubleSide, forceSinglePass: true, uniforms: { uT: { value: 0 }, uA: { value: 0 } },
    });
    this.beam = new Mesh(new CylinderGeometry(0.09, 0.16, 1, 10, 1, true), mk(BEAM_FRAG));
    this.beam.name = 'mind-beam';
    this.field = new Mesh(new SphereGeometry(1, 32, 16), mk(FIELD_FRAG));
    this.field.name = 'mind-field';
    this.mats = [this.beam.material as ShaderMaterial, this.field.material as ShaderMaterial];
    this.group.add(this.beam, this.field);
    this.group.name = 'mind-beam-fx';
    this.group.visible = false;
    this.group.renderOrder = 6;
  }

  update(dt: number, hold: MindHold | null): void {
    this.time += dt;
    this.strength = hold ? Math.min(1, this.strength + dt * 5) : Math.max(0, this.strength - dt * 4);
    if (hold) {
      const d = new Vector3().subVectors(hold.to, hold.from);
      const len = d.length();
      this.beam.position.addVectors(hold.from, hold.to).multiplyScalar(0.5);
      this.beam.quaternion.copy(new Quaternion().setFromUnitVectors(UP, len > 1e-6 ? d.divideScalar(len) : UP));
      this.beam.scale.set(1, Math.max(1e-3, len), 1);
      this.field.position.copy(hold.to);
      const wob = 1 + Math.sin(this.time * 6) * 0.04;
      this.field.scale.setScalar(Math.max(0.8, hold.r * 1.15) * wob);
    }
    for (const m of this.mats) { m.uniforms.uT.value = this.time; m.uniforms.uA.value = this.strength; }
    this.group.visible = this.strength > 0.01;
  }
}

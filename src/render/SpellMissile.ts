/**
 * What flies for a spell (quality pass of 2026-11-16, replacing flat glowing balls): a fireball is a burning orb (a
 * sphere of scrolling flame noise, white-hot inside, soft at its edge) round a bright core; the arrow spells fly as
 * real arrows, turned along their flight, a small glow at the head in the spell's colour.
 */
import { AdditiveBlending, Color, Group, Mesh, MeshBasicMaterial, ShaderMaterial, SphereGeometry, Vector3 } from 'three';
import { spentArrow } from './ArrowMesh';
import { GLSL_NOISE_BASIC } from './glsl';

const ORB_V = /* glsl */ `
varying vec3 vN; varying vec3 vV; varying vec3 vP;
void main() {
  vP = position;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;
const ORB_F = /* glsl */ `
uniform float uT; uniform vec3 uColor;
varying vec3 vN; varying vec3 vV; varying vec3 vP;
${GLSL_NOISE_BASIC}
void main() {
  float facing = clamp(dot(vN, vV), 0.0, 1.0);
  // Flames racing back over the surface, broken up by noise.
  float n = fbm(vec2(atan(vP.z, vP.x) * 1.6 + uT * 1.3, vP.y * 2.4 - uT * 4.0)) * 0.6 + fbm(vP.xz * 3.0 + uT * 2.0) * 0.4;
  float heat = facing * 0.75 + n * 0.55;
  vec3 col = mix(uColor * 0.5, uColor * 1.3, smoothstep(0.35, 0.7, heat));
  col = mix(col, vec3(1.4, 1.2, 0.85), smoothstep(0.8, 1.05, heat));
  // Soft, ragged edge: thinner where the surface turns away.
  float a = smoothstep(0.05, 0.5, facing + (n - 0.5) * 0.5);
  gl_FragColor = vec4(col * a, 1.0);
}`;

let sphere: SphereGeometry | null = null;

export interface SpellMissile { object: Group; time: number; update(dt: number, dir: Vector3): void; dispose(): void }

export function spellMissile(id: string, color: number): SpellMissile {
  sphere ??= new SphereGeometry(1, 20, 14);
  const g = new Group();
  const mats: Array<MeshBasicMaterial | ShaderMaterial> = [];
  let orb: ShaderMaterial | null = null;
  if (id === 'fireball') {
    orb = new ShaderMaterial({
      vertexShader: ORB_V, fragmentShader: ORB_F, transparent: true, depthWrite: false, blending: AdditiveBlending,
      uniforms: { uT: { value: Math.random() * 10 }, uColor: { value: new Color(color) } },
    });
    const m = new Mesh(sphere, orb);
    m.name = 'fire-orb';
    m.scale.setScalar(0.55);
    const core = new MeshBasicMaterial({ color: new Color(0xfff0c8).multiplyScalar(1.3), transparent: true, blending: AdditiveBlending, depthWrite: false });
    const c = new Mesh(sphere, core);
    c.scale.setScalar(0.22);
    g.add(m, c);
    mats.push(orb, core);
  } else {
    const arrow = spentArrow(0.95);
    arrow.position.z = -0.3;
    const glow = new MeshBasicMaterial({ color: new Color(color).multiplyScalar(1.4), transparent: true, blending: AdditiveBlending, depthWrite: false });
    const head = new Mesh(sphere, glow);
    head.scale.set(0.09, 0.09, 0.2);
    head.position.z = 0.18;
    g.add(arrow, head);
    mats.push(glow);
  }
  const _t = new Vector3();
  const self: SpellMissile = {
    object: g,
    time: 0,
    update(dt, dir) {
      self.time += dt;
      if (orb) { orb.uniforms.uT.value += dt; g.rotation.y += dt * 2; return; }
      if (dir.lengthSq() > 1e-8) g.lookAt(_t.copy(g.position).add(dir));
    },
    dispose() { for (const m of mats) m.dispose(); },
  };
  return self;
}

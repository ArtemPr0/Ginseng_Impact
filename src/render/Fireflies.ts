/**
 * Fireflies and glowing spores: a cloud of soft points drifting in slow loops around a spot, each blinking in its own
 * rhythm (the joy pass: something alive near every pool, gorge and mushroom ring). One draw call per swarm.
 */
import { AdditiveBlending, BufferAttribute, BufferGeometry, Color, Group, Points, ShaderMaterial } from 'three';
import { glowTexture } from './Glow';

const VERT = /* glsl */ `
attribute vec4 seed; uniform float uTime; uniform float uRadius; uniform float uHeight; varying float vA;
void main() {
  float t = uTime * (0.25 + seed.w * 0.35) + seed.x * 6.2832;
  vec3 p = position + vec3(sin(t) * uRadius * 0.18 + sin(t * 2.3 + seed.y * 9.0) * 0.6,
                           sin(t * 1.7 + seed.z * 7.0) * uHeight * 0.25,
                           cos(t * 0.9) * uRadius * 0.18 + cos(t * 1.9 + seed.x * 5.0) * 0.6);
  vA = pow(max(0.0, sin(uTime * (1.2 + seed.y * 2.0) + seed.z * 31.0)), 3.0);
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_PointSize = (60.0 + seed.w * 40.0) / -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const FRAG = /* glsl */ `
uniform vec3 uColor; uniform sampler2D uMap; varying float vA;
void main() { gl_FragColor = vec4(uColor * (1.0 + vA * 2.0), texture2D(uMap, gl_PointCoord).a * (0.15 + vA * 0.85)); }`;

/** A swarm of `count` fireflies in a disc of `radius` around (x, y, z), up to `height` above it. */
export function fireflies(x: number, y: number, z: number, radius: number, height: number, count: number, color = new Color(0.75, 1.3, 0.45)): { group: Group; update(dt: number): void } {
  const pos = new Float32Array(count * 3);
  const seed = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * radius;
    pos.set([Math.cos(a) * r, 0.4 + Math.random() * height, Math.sin(a) * r], i * 3);
    seed.set([Math.random(), Math.random(), Math.random(), Math.random()], i * 4);
  }
  const geo = new BufferGeometry();
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('seed', new BufferAttribute(seed, 4));
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uRadius: { value: radius }, uHeight: { value: height }, uColor: { value: color }, uMap: { value: glowTexture() } },
    vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, blending: AdditiveBlending,
  });
  const points = new Points(geo, mat);
  points.position.set(x, y, z);
  geo.computeBoundingSphere();
  if (geo.boundingSphere) geo.boundingSphere.radius += radius * 0.4 + 2;
  const group = new Group();
  group.add(points);
  let t = Math.random() * 100;
  return { group, update(dt) { t += dt; mat.uniforms.uTime.value = t; } };
}

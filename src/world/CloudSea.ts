import { Color, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial } from 'three';
import { PALETTE } from '../render/palette';

const VERT = /* glsl */ `
varying vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uColor; uniform float uAlpha; uniform float uScale; uniform vec3 uCam;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
}
void main() {
  vec2 p = vWorld.xz * uScale + vec2(uTime * 0.03, uTime * 0.012);
  float n = vnoise(p) * 0.55 + vnoise(p * 2.3 + 7.0) * 0.3 + vnoise(p * 5.1 - 3.0) * 0.15;
  float a = smoothstep(0.42, 0.62, n) * uAlpha;
  float d = distance(uCam.xz, vWorld.xz);
  a *= smoothstep(8.0, 30.0, d);
  gl_FragColor = vec4(uColor, a);
}`;

/** Three drifting noise-alpha planes below the cliffs, tinted fog → electric. */
export class CloudSea {
  readonly group = new Group();
  private readonly mats: ShaderMaterial[] = [];

  constructor(y: number) {
    const base = new Color(PALETTE.fog);
    const tint = new Color(PALETTE.electric);
    const layers: Array<[number, number, number, number]> = [[0, 0.95, 0.016, 0.3], [-9, 0.9, 0.01, 0.22], [-22, 0.85, 0.007, 0.15]];
    for (const [dy, alpha, scale, mix] of layers) {
      const mat = new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uColor: { value: base.clone().lerp(tint, mix) },
          uAlpha: { value: alpha },
          uScale: { value: scale },
          uCam: { value: { x: 0, y: 0, z: 0 } },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        side: DoubleSide, forceSinglePass: true,
      });
      const mesh = new Mesh(new PlaneGeometry(1600, 1600), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = y + dy;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.mats.push(mat);
    }
  }

  update(dt: number, cam: { x: number; y: number; z: number }): void {
    // The noise lives in world space, so the planes can follow the camera to the realms beyond the island.
    this.group.position.x = cam.x;
    this.group.position.z = cam.z;
    for (const m of this.mats) {
      m.uniforms.uTime.value += dt;
      m.uniforms.uCam.value = cam;
    }
  }
}

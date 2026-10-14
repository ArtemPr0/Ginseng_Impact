/**
 * Portals between the island and the realms beyond it: a swirling galaxy vortex (DeQ-NnpvqF6, DdyN2PNyIxb) or a
 * whirlpool in still water (the way down to the sunken city, DeVj-Z8POjl). Pure effect, kept procedural; the stone
 * ring around a portal is a Meshy model placed separately.
 */
import { CircleGeometry, Color, DoubleSide, Group, Mesh, PointLight, ShaderMaterial, Vector3 } from 'three';
import { glowSprite } from '../render/Glow';
import { PALETTE } from '../render/palette';
import type { Landmark } from './Landmarks';

const VORTEX_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const VORTEX_FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uA; uniform vec3 uB; uniform float uSpin;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
void main() {
  vec2 p = vUv * 2.0 - 1.0;
  float r = length(p);
  if (r > 1.0) discard;
  float a = atan(p.y, p.x);
  // Spiral arms that wind tighter toward the centre and turn with time.
  float arms = sin(a * 3.0 + log(r + 0.02) * 6.0 * uSpin - uTime * 2.4 * uSpin);
  float stars = step(0.985, hash(floor(vec2(a * 40.0, r * 60.0 - uTime * 4.0))));
  float core = smoothstep(0.35, 0.0, r);
  float rim = smoothstep(0.75, 1.0, r);
  vec3 c = mix(uA, uB, 0.5 + 0.5 * arms) * (0.35 + 0.65 * smoothstep(1.0, 0.2, r));
  c += vec3(1.0) * core * 0.9 + uB * stars * 1.5;
  gl_FragColor = vec4(c, (1.0 - rim) * 0.92 + rim * 0.25 * (1.0 - r));
}`;

export interface PortalLink {
  /** World point the player walks into. */
  at: Vector3;
  /** Horizontal trigger radius and vertical tolerance. */
  radius: number;
  height: number;
  /** Where the player arrives, with the facing (controller yaw) and camera yaw. */
  to: { x: number; z: number; yaw: number; cameraYaw: number };
  /** Announced on arrival. */
  name: string;
}

/**
 * A portal at (x, y, z). `vertical` stands it up facing `facing` (radians, world direction the disc faces);
 * otherwise it lies flat (a whirlpool).
 */
export function portal(x: number, y: number, z: number, radius: number, opts: { vertical: boolean; facing?: number; colors?: [number, number]; spin?: number }): Landmark {
  const g = new Group();
  g.position.set(x, y, z);
  const [ca, cb] = opts.colors ?? [PALETTE.abyss, PALETTE.dusk];
  const mat = new ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: new Color(ca) }, uB: { value: new Color(cb).multiplyScalar(1.4) }, uSpin: { value: opts.spin ?? 1 } },
    vertexShader: VORTEX_VERT, fragmentShader: VORTEX_FRAG, transparent: true, depthWrite: false, side: DoubleSide, forceSinglePass: true, toneMapped: false,
  });
  const disc = new Mesh(new CircleGeometry(radius, 48), mat);
  if (opts.vertical) disc.rotation.y = Math.PI / 2 - (opts.facing ?? 0);
  else disc.rotation.x = -Math.PI / 2;
  const halo = glowSprite(cb, radius * 3.2, 0.5, true);
  const light = new PointLight(cb, 40, radius * 8, 1.8);
  light.position.set(0, opts.vertical ? 0 : 1.5, 0);
  g.add(disc, halo, light);
  let t = 0;
  return {
    object: g,
    footprints: [],
    update(dt) {
      t += dt;
      mat.uniforms.uTime.value = t;
      halo.material.opacity = 0.38 + Math.sin(t * 1.7) * 0.12;
      light.intensity = 34 + Math.sin(t * 2.3) * 8;
      if (!opts.vertical) disc.rotation.z += dt * 0.6;
    },
  };
}

/** Bubbles rising around the camera (inside the sunken city). Additive points, recycled. */
export class Bubbles {
  readonly group = new Group();
  private readonly sprites: Array<{ s: ReturnType<typeof glowSprite>; v: number }> = [];

  constructor(count = 60) {
    for (let i = 0; i < count; i++) {
      const s = glowSprite(PALETTE.rune, 0.12 + Math.random() * 0.18, 0.55, true);
      s.position.set((Math.random() - 0.5) * 30, Math.random() * 14, (Math.random() - 0.5) * 30);
      this.sprites.push({ s, v: 0.6 + Math.random() * 1.2 });
      this.group.add(s);
    }
    this.group.visible = false;
  }

  update(dt: number, around: { x: number; y: number; z: number }): void {
    if (!this.group.visible) return;
    this.group.position.set(around.x, around.y - 4, around.z);
    for (const b of this.sprites) {
      b.s.position.y += b.v * dt;
      b.s.position.x += Math.sin(b.s.position.y * 2 + b.v * 10) * dt * 0.2;
      if (b.s.position.y > 14) { b.s.position.y = 0; b.s.position.x = (Math.random() - 0.5) * 30; b.s.position.z = (Math.random() - 0.5) * 30; }
    }
  }
}

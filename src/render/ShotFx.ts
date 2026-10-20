/**
 * The heroes' shots that are effects rather than Meshy props: Sir Aldric's blood crescent (Crimson Cleave), a thin
 * glowing crescent that rides the ground, and Orlan's star (his bolt and Starfall), a four-pointed star sprite with a
 * hot core and a halo. Additive and emissive (the bloom makes the light; no point lights, no channel over ~1.5).
 * The crescent's shape is built once and shared: dispose a shot's object with its geometry kept.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, ShaderMaterial, Sprite,
  SpriteMaterial,
} from 'three';
import { glowSprite } from './Glow';
import { starTexture } from './LeanFx';

/** The crescent's outer radius, how far its horns reach round (radians), its thickness mid-arc and its lean forward. */
const CRESCENT = { radius: 2.1, half: 1.15, thick: 0.42, tilt: 1.05 };

let crescentGeo: BufferGeometry | undefined;

/**
 * The crescent, built once: an arc of `CRESCENT.half` radians either side of its middle, thick there and pointed at the
 * horns, its leading (outer) edge at uv.y = 1. In its own frame +z is the way it travels (Object3D.lookAt aims +z), +y is
 * up and x is across: the horns sit on the ground at either side and the middle of the arc leans up and forward, a
 * wave about to break.
 */
function crescentGeometry(): BufferGeometry {
  if (crescentGeo) return crescentGeo;
  const { radius: R, half: H, thick: T, tilt } = CRESCENT;
  const U = 28;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  const back = R * Math.cos(H);
  for (let i = 0; i <= U; i++) {
    const u = i / U;
    const th = (u * 2 - 1) * H;
    const taper = Math.pow(Math.max(0, Math.cos((u - 0.5) * Math.PI)), 0.7);
    for (const v of [0, 1]) {
      const r = v === 0 ? R - T * taper : R;
      const depth = r * Math.cos(th) - back;
      pos.push(r * Math.sin(th), depth * Math.sin(tilt), depth * Math.cos(tilt));
      uv.push(u, v);
    }
    if (i < U) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeBoundingSphere();
  crescentGeo = g;
  return g;
}

export interface CrescentShot {
  object: Group;
  /** 0..1: the caller fades it in at the launch and out at the end of its run. */
  fade: { value: number };
}

/** A blood crescent in `color`: the arc itself (its leading edge hottest) and a soft halo over the middle. */
export function crescentShot(color: number): CrescentShot {
  const fade = { value: 0 };
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true,
    uniforms: { uColor: { value: new Color(color) }, uFade: fade },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uFade; varying vec2 vUv;
      void main() {
        // Pointed at the horns, soft on the inside, a crisp burning edge in front.
        float along = pow(sin(vUv.x * 3.14159265), 0.6);
        float body = smoothstep(0.0, 0.4, vUv.y) * (1.0 - smoothstep(0.9, 1.0, vUv.y));
        float hot = pow(vUv.y, 4.0);
        gl_FragColor = vec4(uColor * (0.65 + 0.8 * hot), body * along * uFade * 0.9);
      }`,
  });
  const arc = new Mesh(crescentGeometry(), mat);
  arc.renderOrder = 6;
  const { radius: R, half: H, tilt } = CRESCENT;
  const mid = R * (1 - Math.cos(H));
  const halo = glowSprite(color, 2.8, 0.3, true);
  halo.position.set(0, mid * Math.sin(tilt) * 0.6, mid * Math.cos(tilt) * 0.6);
  const object = new Group();
  object.add(arc, halo);
  return { object, fade };
}

export interface StarShot {
  object: Group;
  /** The star's own material: the caller turns it (`rotation`) so the points twinkle round. */
  star: SpriteMaterial;
}

const _tint = new Color();
const MOON = new Color(0xdfe6ff);

/** Orlan's star, `size` metres across its points: the four-pointed star in a pale tint of `color`, a hot core, a halo. */
export function starShot(color: number, size: number): StarShot {
  const tint = _tint.set(color).lerp(MOON, 0.35).getHex();
  const star = new SpriteMaterial({ map: starTexture(), color: tint, blending: AdditiveBlending, transparent: true, depthWrite: false, fog: true });
  const s = new Sprite(star);
  s.scale.setScalar(size);
  const object = new Group();
  object.add(s, glowSprite(0xdfe6ff, size * 0.4, 0.95, true), glowSprite(color, size * 1.3, 0.45, true));
  return { object, star };
}

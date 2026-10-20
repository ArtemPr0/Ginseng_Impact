/**
 * The heroes' shots that are effects rather than Meshy props: Sir Aldric's blood crescent (Crimson Cleave), a thin
 * glowing crescent that rides the ground, and the burning ground it leaves (one strip for the whole path); Orlan's star
 * (his bolt and Starfall), a four-pointed star sprite with a hot core and a halo. Additive and emissive (the bloom makes
 * the light; no point lights, no channel over ~1.5). The crescent's shape is built once and shared: dispose a shot's
 * object with its geometry kept. A burn strip owns its geometry and material: dispose them with it.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Group, Mesh, ShaderMaterial,
  Sprite, SpriteMaterial, Vector3,
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

/** Patches one burn strip holds (Crimson Cleave lays five at most: one every 2 m of its 9 m, and one where it stops). */
const STRIP_PATCHES = 8;
/** How far the burning ground glows above the ground (a ground zone's ring sits as high). */
const STRIP_LIFT = 0.12;

export interface BurnStrip {
  /** One mesh for a cast's whole path: one draw call and one transparent plane, however many patches it holds. */
  object: Mesh;
  /** Lays the next patch, a disc of the strip's radius on the ground at `at`; false (nothing drawn) once it is full. */
  add(at: Vector3): boolean;
  /** The rim's strength (a ground zone ring's opacity: its pulse and fade) and the inside's fade, set by the owner. */
  rim: { value: number };
  fade: { value: number };
}

/**
 * The burning ground a cast leaves along its path (Crimson Cleave), drawn as ONE strip rather than a ring and a disc per
 * patch: the outline of the union of its patches (discs of `radius`) glows like a ground zone's ring and the inside
 * holds a zone disc's faint wash. The strip is a ribbon through the patches' centres, each row at its own patch's
 * height and `radius` either side, capped `radius` past both ends; the fragment shader keeps what lies within `radius`
 * of a centre. Patches are expected roughly in a line (the crescent's run is straight).
 */
export function burnStrip(color: number, radius: number): BurnStrip {
  const rows = STRIP_PATCHES + 2;
  const pos = new BufferAttribute(new Float32Array(rows * 2 * 3), 3).setUsage(DynamicDrawUsage);
  const index: number[] = [];
  for (let r = 0; r < rows - 1; r++) { const a = r * 2; index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const geo = new BufferGeometry();
  geo.setAttribute('position', pos);
  geo.setIndex(index);
  geo.setDrawRange(0, 0);
  const centres = Array.from({ length: STRIP_PATCHES }, () => new Vector3());
  const count = { value: 0 };
  const rim = { value: 0 };
  const fade = { value: 1 };
  const mat = new ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true,
    uniforms: { uColor: { value: new Color(color) }, uRadius: { value: radius }, uCentres: { value: centres }, uCount: count, uRim: rim, uFade: fade },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vXZ = w.xz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor; uniform float uRadius; uniform vec3 uCentres[${STRIP_PATCHES}]; uniform float uCount;
      uniform float uRim; uniform float uFade;
      varying vec2 vXZ;
      void main() {
        float d = 1e4;
        for (int i = 0; i < ${STRIP_PATCHES}; i++) {
          if (float(i) >= uCount) break;
          d = min(d, distance(vXZ, uCentres[i].xz));
        }
        // The union's edge as a zone's ring (radius - 0.35 to radius), the inside as its disc's wash.
        float ring = smoothstep(uRadius - 0.4, uRadius - 0.32, d) * (1.0 - smoothstep(uRadius - 0.04, uRadius, d));
        float wash = 1.0 - smoothstep(uRadius - 0.45, uRadius - 0.35, d);
        float a = ring * uRim + wash * 0.06 * uFade;
        if (a < 0.002) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  const object = new Mesh(geo, mat);
  object.name = 'burn-strip';
  const arr = pos.array as Float32Array;
  const dir = new Vector3();
  const row = (r: number, x: number, y: number, z: number, dx: number, dz: number) => {
    // Across the run, a little wider than the discs so the rim's soft outer edge is never clipped.
    const w = radius + 0.05;
    const o = r * 6;
    arr[o] = x - dz * w; arr[o + 1] = y; arr[o + 2] = z + dx * w;
    arr[o + 3] = x + dz * w; arr[o + 4] = y; arr[o + 5] = z - dx * w;
  };
  const rebuild = () => {
    const n = count.value;
    for (let i = 0; i < n; i++) {
      // Each row square to the run through its patch (a lone patch: any way round covers its disc).
      const a = centres[Math.max(0, i - 1)];
      const b = centres[Math.min(n - 1, i + 1)];
      dir.set(b.x - a.x, 0, b.z - a.z);
      if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
      dir.normalize();
      const c = centres[i];
      row(i + 1, c.x, c.y, c.z, dir.x, dir.z);
      if (i === 0) row(0, c.x - dir.x * radius, c.y, c.z - dir.z * radius, dir.x, dir.z);
      if (i === n - 1) {
        // The end cap, and every unused row after it collapsed onto it (they stay out of the bounding sphere).
        for (let r = n + 1; r < rows; r++) row(r, c.x + dir.x * radius, c.y, c.z + dir.z * radius, dir.x, dir.z);
      }
    }
    pos.needsUpdate = true;
    geo.setDrawRange(0, (n + 1) * 6);
    geo.computeBoundingSphere();
  };
  return {
    object, rim, fade,
    add(at: Vector3): boolean {
      if (count.value >= STRIP_PATCHES) return false;
      centres[count.value].set(at.x, at.y + STRIP_LIFT, at.z);
      count.value++;
      rebuild();
      return true;
    },
  };
}

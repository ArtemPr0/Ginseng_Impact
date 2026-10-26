/**
 * Combat effects, pooled and allocated once: blade trails, swing crescents, sparks, impact flashes, ground shocks,
 * dust, attack telegraphs and the cast rune, plus the dissolve patch for deaths. Everything is emissive and
 * additive (the bloom makes the light: no point lights, no glow channel over ~1.5), every pool is built in the
 * constructor and recycled oldest-first, one shared clock (COMBATFX_CLOCK) drives every shader, and update()
 * returns at once when nothing is live. Add `group` to the scene at the origin.
 *
 * Transparent-plane budget (the effects skill allows ~10 big planes per view; a fight is allowed ~20):
 *   trails 4 + arcs 4 + telegraphs 8 + rune 1 = 17 ribbons and planes that can all be live together;
 *   shocks: pool 8, but a shock lives 0.3-0.5 s, so 2-3 overlap in practice (the hard maximum is 25);
 *   sparks (256 slivers), flashes (16) and dust (24) are one InstancedMesh each: one draw call apiece and little
 *   fill, since each quad is a few centimetres to a metre across. Dead instances collapse in the vertex shader.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, type Camera, CanvasTexture, Color, type ColorRepresentation,
  DataTexture, DoubleSide, DynamicDrawUsage, Group, InstancedBufferAttribute, InstancedMesh, Matrix4, Mesh,
  MeshBasicMaterial, type MeshStandardMaterial, PlaneGeometry, RingGeometry, ShaderMaterial, Sphere, type Texture,
  Vector3,
} from 'three';
import { glowTexture } from './Glow';
import { puffTexture } from './Smoke';

/** The shared clock (seconds) every combat shader reads; `CombatFx.update(dt)` advances it once a frame. */
export const COMBATFX_CLOCK = { value: 0 };

const TRAIL_N = 24;
const TRAIL_FADE = 0.15;
const TRAIL_SPAN = 0.22;
const ARC_LIFE = 0.14;
const FLASH_LIFE = 0.22;
const DUST_LIFE = 0.6;
const SPARK_GRAVITY = 12;
const SPARK_LIFE_MAX = 0.6;
const FX_PI = '3.14159265';

let fallbackTex: DataTexture | undefined;
/** The shared canvas textures need a DOM; under vitest (node) a 1×1 white texel stands in. */
function texture(make: () => Texture): Texture {
  if (typeof document !== 'undefined') return make();
  if (!fallbackTex) {
    fallbackTex = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    fallbackTex.needsUpdate = true;
  }
  return fallbackTex;
}

/** The cast circle: two rings and eight ticks, drawn once; the material tints it and update() turns it. */
function runeTexture(): Texture {
  return texture(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const c = size / 2;
    ctx.strokeStyle = 'rgba(255,255,255,1)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.36, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(c + Math.cos(a) * size * 0.36, c + Math.sin(a) * size * 0.36);
      ctx.lineTo(c + Math.cos(a) * size * 0.46, c + Math.sin(a) * size * 0.46);
      ctx.stroke();
    }
    // Small beads between the ticks on the inner ring.
    for (let i = 0; i < 8; i++) {
      const a = ((i + 0.5) / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(c + Math.cos(a) * size * 0.36, c + Math.sin(a) * size * 0.36, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.fill();
    }
    return new CanvasTexture(canvas);
  });
}

/** Collapses an instance to a point off screen: `dead` is 0 (draw) or 1 (gone). */
const DEAD_GLSL = /* glsl */ `gl_Position = mix(gl_Position, vec4(2.0, 2.0, 2.0, 1.0), min(1.0, dead));`;

interface TrailSlot {
  mesh: Mesh;
  mat: ShaderMaterial;
  pos: BufferAttribute;
  age: BufferAttribute;
  stamp: BufferAttribute;
  sphere: Sphere;
  guard: Float32Array;
  tip: Float32Array;
  t: Float32Array;
  head: number;
  count: number;
  id: string | null;
  on: boolean;
  offAt: number;
  lastFed: number;
  dirty: boolean;
}

interface ArcSlot { mesh: Mesh; mat: ShaderMaterial; birth: number; radius: number }
interface ShockSlot { mesh: Mesh; mat: MeshBasicMaterial; birth: number; seconds: number; radius: number }
/**
 * A telegraph slot. On the clock by default (its fill is its age over `seconds`); `driven` once its owner drives it
 * (driveTelegraph): then `fill` is the owner's, `keptAt` when the owner last drove it, and `full` that the sweep has
 * been shown at the edge (it goes dark at the next update).
 */
interface TelegraphSlot { mesh: Mesh; mat: ShaderMaterial; id: number; birth: number; seconds: number; driven: boolean; fill: number; keptAt: number; full: boolean }

/** A driven telegraph its owner stops driving goes dark this long after the last drive (seconds): it fell, or let go. */
export const TELEGRAPH_KEEP = 0.5;

const _a = new Vector3();
const _b = new Vector3();
const _c = new Vector3();
const _d = new Vector3();
const _m = new Matrix4();
const _col = new Color();

/** How many of the first `n` instances are alive at `now`: born, and younger than `life` (+ `spread` × their seed). */
function countAlive(birth: Float32Array, n: number, now: number, life: number, spread = 0, seed?: Float32Array): number {
  let alive = 0;
  for (let i = 0; i < n; i++) {
    const b = birth[i];
    if (b <= now && now < b + life + (seed ? spread * seed[i] : 0)) alive++;
  }
  return alive;
}

/**
 * The culling sphere of an instanced pool whose instances move in the vertex shader: a box over every live
 * emission point (plus how far its particles can fly), kept as the mesh's boundingSphere. Never frustumCulled=false.
 */
class Bounds {
  private readonly min = new Vector3();
  private readonly max = new Vector3();
  constructor(readonly sphere: Sphere) {}

  grow(empty: boolean, x: number, y: number, z: number, reach: number): void {
    if (empty) {
      this.min.set(x - reach, y - reach, z - reach);
      this.max.set(x + reach, y + reach, z + reach);
    } else {
      this.min.x = Math.min(this.min.x, x - reach); this.min.y = Math.min(this.min.y, y - reach); this.min.z = Math.min(this.min.z, z - reach);
      this.max.x = Math.max(this.max.x, x + reach); this.max.y = Math.max(this.max.y, y + reach); this.max.z = Math.max(this.max.z, z + reach);
    }
    this.sphere.center.addVectors(this.min, this.max).multiplyScalar(0.5);
    this.sphere.radius = this.max.distanceTo(this.min) * 0.5;
  }
}

export class CombatFx {
  readonly group = new Group();

  private readonly trails: TrailSlot[] = [];
  private readonly arcs: ArcSlot[] = [];
  private readonly shocks: ShockSlot[] = [];
  private readonly telegraphs: TelegraphSlot[] = [];

  // Sparks: one InstancedMesh, a ring of instances (the oldest is always the next overwritten).
  private readonly sparkMesh: InstancedMesh;
  private readonly sparkP0: InstancedBufferAttribute;
  private readonly sparkVel: InstancedBufferAttribute;
  private readonly sparkBirth: InstancedBufferAttribute;
  private readonly sparkSeed: InstancedBufferAttribute;
  private readonly sparkColor: InstancedBufferAttribute;
  private readonly sparkBounds: Bounds;
  private sparkHead = 0;
  private sparkEmitted = 0;
  private sparksUntil = -1;

  private readonly flashMesh: InstancedMesh;
  private readonly flashP0: InstancedBufferAttribute;
  private readonly flashBirth: InstancedBufferAttribute;
  private readonly flashSize: InstancedBufferAttribute;
  private readonly flashColor: InstancedBufferAttribute;
  private readonly flashBounds: Bounds;
  private flashHead = 0;
  private flashEmitted = 0;
  private flashUntil = -1;

  private readonly dustMesh: InstancedMesh;
  private readonly dustP0: InstancedBufferAttribute;
  private readonly dustVel: InstancedBufferAttribute;
  private readonly dustBirth: InstancedBufferAttribute;
  private readonly dustSeed: InstancedBufferAttribute;
  private readonly dustSize: InstancedBufferAttribute;
  private readonly dustBounds: Bounds;
  private dustHead = 0;
  private dustEmitted = 0;
  private dustUntil = -1;

  private readonly runeMesh: Mesh;
  private readonly runeMat: MeshBasicMaterial;
  private readonly runeTex: Texture;
  private runeOn = false;
  private runeOpacity = 0;

  private liveTrails = 0;
  private liveArcs = 0;
  private liveShocks = 0;
  private liveTelegraphs = 0;

  constructor(opts: { trails?: number; sparks?: number; flashes?: number; shocks?: number; dust?: number; telegraphs?: number } = {}) {
    const nTrails = opts.trails ?? 4;
    const nSparks = opts.sparks ?? 256;
    const nFlashes = opts.flashes ?? 16;
    const nShocks = opts.shocks ?? 8;
    const nDust = opts.dust ?? 24;
    const nTelegraphs = opts.telegraphs ?? 8;
    this.group.name = 'combatFx';

    // --- Blade trails: a ribbon of TRAIL_N (guard, tip) pairs, rebuilt in place from a ring buffer.
    const trailIndex: number[] = [];
    for (let i = 0; i < TRAIL_N - 1; i++) { const a = i * 2; trailIndex.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const across = new Float32Array(TRAIL_N * 2);
    for (let i = 0; i < TRAIL_N; i++) across[i * 2 + 1] = 1;
    for (let i = 0; i < nTrails; i++) {
      const geo = new BufferGeometry();
      const pos = new BufferAttribute(new Float32Array(TRAIL_N * 2 * 3), 3).setUsage(DynamicDrawUsage);
      const age = new BufferAttribute(new Float32Array(TRAIL_N * 2), 1).setUsage(DynamicDrawUsage);
      const stamp = new BufferAttribute(new Float32Array(TRAIL_N * 2), 1).setUsage(DynamicDrawUsage);
      geo.setAttribute('position', pos);
      geo.setAttribute('age', age);
      geo.setAttribute('stamp', stamp);
      geo.setAttribute('across', new BufferAttribute(across, 1));
      geo.setIndex(trailIndex);
      const sphere = new Sphere(new Vector3(), 1);
      geo.boundingSphere = sphere;
      const mat = new ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true,
        uniforms: { uColor: { value: new Color(0xffffff) }, uFade: { value: 1 }, uTime: COMBATFX_CLOCK },
        vertexShader: /* glsl */ `
          attribute float age; attribute float stamp; attribute float across;
          varying float vAge; varying float vStamp; varying float vAcross;
          void main() { vAge = age; vStamp = stamp; vAcross = across; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uFade; uniform float uTime;
          varying float vAge; varying float vStamp; varying float vAcross;
          void main() {
            // Newest segment bright, the tail gone by TRAIL_SPAN seconds or TRAIL_N samples, whichever first.
            float old = clamp((uTime - vStamp) / ${TRAIL_SPAN.toFixed(2)}, 0.0, 1.0);
            float a = 1.0 - max(vAge, old);
            a *= a;
            float edge = pow(sin(vAcross * ${FX_PI}), 0.7);
            gl_FragColor = vec4(uColor * (0.8 + 0.6 * a), a * edge * uFade * 0.85);
          }`,
      });
      const mesh = new Mesh(geo, mat);
      mesh.visible = false;
      mesh.renderOrder = 6;
      mesh.name = 'trail';
      this.group.add(mesh);
      this.trails.push({
        mesh, mat, pos, age, stamp, sphere, guard: new Float32Array(TRAIL_N * 3), tip: new Float32Array(TRAIL_N * 3), t: new Float32Array(TRAIL_N),
        head: 0, count: 0, id: null, on: false, offAt: 0, lastFed: 0, dirty: false,
      });
    }

    // --- Swing crescents: a parametric strip (uv.x = angle, uv.y = radial); the vertex shader shapes it per call.
    const arcGeo = (() => {
      const U = 20;
      const p: number[] = [];
      const uv: number[] = [];
      const idx: number[] = [];
      for (let i = 0; i <= U; i++) {
        const u = i / U;
        const th = (u * 2 - 1) * 1.0;
        for (const v of [0, 1]) {
          const r = v === 0 ? 1 - 0.35 * Math.cos((u - 0.5) * Math.PI) : 1;
          p.push(Math.cos(th) * r, Math.sin(th) * r, 0);
          uv.push(u, v);
        }
        if (i < U) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(p), 3));
      g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
      g.setIndex(idx);
      // The shader widens the crescent to any half-angle: cull on the whole unit disc, not the reference shape.
      g.boundingSphere = new Sphere(new Vector3(), 1.05);
      return g;
    })();
    for (let i = 0; i < 4; i++) {
      const mat = new ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true,
        uniforms: { uColor: { value: new Color(0xffffff) }, uK: { value: 0 }, uHalf: { value: 1.1 } },
        vertexShader: /* glsl */ `
          uniform float uHalf; varying vec2 vUv;
          void main() {
            vUv = uv;
            float th = (uv.x * 2.0 - 1.0) * uHalf;
            // A crescent: thick in the middle of the swing, pointed at both ends.
            float taper = cos((uv.x - 0.5) * ${FX_PI});
            float r = mix(1.0 - 0.35 * taper, 1.0, uv.y);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(cos(th) * r, sin(th) * r, 0.0, 1.0);
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uK; varying vec2 vUv;
          void main() {
            float across = pow(sin(vUv.y * ${FX_PI}), 0.6);
            float rim = 0.5 + 0.5 * smoothstep(0.3, 1.0, vUv.y);
            float a = (1.0 - uK) * across * rim;
            gl_FragColor = vec4(uColor * (0.9 + 0.5 * (1.0 - uK)), a * 0.9);
          }`,
      });
      const mesh = new Mesh(arcGeo, mat);
      mesh.visible = false;
      mesh.renderOrder = 6;
      mesh.name = 'arc';
      this.group.add(mesh);
      this.arcs.push({ mesh, mat, birth: 0, radius: 1 });
    }

    // --- Sparks: thin quads stretched along their velocity (the meteors' streak), integrated on the GPU.
    const quad = new PlaneGeometry(1, 1);
    const sparkGeo = new BufferGeometry();
    sparkGeo.setAttribute('position', quad.getAttribute('position'));
    sparkGeo.setAttribute('uv', quad.getAttribute('uv'));
    sparkGeo.setIndex(quad.getIndex());
    this.sparkP0 = new InstancedBufferAttribute(new Float32Array(nSparks * 3), 3).setUsage(DynamicDrawUsage);
    this.sparkVel = new InstancedBufferAttribute(new Float32Array(nSparks * 3), 3).setUsage(DynamicDrawUsage);
    this.sparkBirth = new InstancedBufferAttribute(new Float32Array(nSparks).fill(-10), 1).setUsage(DynamicDrawUsage);
    this.sparkSeed = new InstancedBufferAttribute(new Float32Array(nSparks), 1).setUsage(DynamicDrawUsage);
    this.sparkColor = new InstancedBufferAttribute(new Float32Array(nSparks * 3), 3).setUsage(DynamicDrawUsage);
    sparkGeo.setAttribute('aP0', this.sparkP0);
    sparkGeo.setAttribute('aVel', this.sparkVel);
    sparkGeo.setAttribute('aBirth', this.sparkBirth);
    sparkGeo.setAttribute('aSeed', this.sparkSeed);
    sparkGeo.setAttribute('aColor', this.sparkColor);
    const sparkMat = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true,
      uniforms: { uTime: COMBATFX_CLOCK, uGravity: { value: SPARK_GRAVITY } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform float uGravity;
        attribute vec3 aP0; attribute vec3 aVel; attribute float aBirth; attribute float aSeed; attribute vec3 aColor;
        varying vec2 vUv; varying float vK; varying vec3 vColor;
        void main() {
          vUv = uv; vColor = aColor;
          float life = 0.35 + 0.25 * aSeed;
          float t = uTime - aBirth;
          float k = t / life;
          vK = clamp(k, 0.0, 1.0);
          float dead = step(1.0, k) + step(t, -0.0001);
          vec3 g = vec3(0.0, -uGravity, 0.0);
          vec3 p = aP0 + aVel * t + 0.5 * g * t * t;
          vec3 v = aVel + g * t;
          float sp = length(v);
          vec3 along = v / max(sp, 1e-3);
          vec3 toCam = normalize(cameraPosition - p);
          vec3 side = normalize(cross(toCam, along));
          // Head at uv.x = 1 (the spark itself), a tail streaking behind it along the velocity.
          float len = (0.1 + sp * 0.04) * (1.0 - 0.4 * vK);
          float wid = 0.045 * (1.0 - 0.5 * vK);
          vec3 world = p + along * (position.x - 0.5) * len + side * position.y * wid;
          gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
          ${DEAD_GLSL}
        }`,
      fragmentShader: /* glsl */ `
        varying vec2 vUv; varying float vK; varying vec3 vColor;
        void main() {
          float across = 1.0 - abs(vUv.y - 0.5) * 2.0;
          float fade = (1.0 - vK) * (1.0 - vK);
          float a = pow(vUv.x, 1.2) * across * fade;
          gl_FragColor = vec4(vColor * (1.0 + 0.5 * pow(vUv.x, 6.0)), a);
        }`,
    });
    this.sparkMesh = new InstancedMesh(sparkGeo, sparkMat, nSparks);
    this.sparkMesh.count = 0;
    this.sparkMesh.visible = false;
    this.sparkMesh.boundingSphere = new Sphere(new Vector3(), 1);
    this.sparkBounds = new Bounds(this.sparkMesh.boundingSphere);
    this.sparkMesh.renderOrder = 7;
    this.sparkMesh.name = 'sparks';
    this.group.add(this.sparkMesh);

    // --- Flashes: expanding glow billboards (Vfx.impact), one InstancedMesh.
    const flashGeo = new BufferGeometry();
    flashGeo.setAttribute('position', quad.getAttribute('position'));
    flashGeo.setAttribute('uv', quad.getAttribute('uv'));
    flashGeo.setIndex(quad.getIndex());
    this.flashP0 = new InstancedBufferAttribute(new Float32Array(nFlashes * 3), 3).setUsage(DynamicDrawUsage);
    this.flashBirth = new InstancedBufferAttribute(new Float32Array(nFlashes).fill(-10), 1).setUsage(DynamicDrawUsage);
    this.flashSize = new InstancedBufferAttribute(new Float32Array(nFlashes), 1).setUsage(DynamicDrawUsage);
    this.flashColor = new InstancedBufferAttribute(new Float32Array(nFlashes * 3), 3).setUsage(DynamicDrawUsage);
    flashGeo.setAttribute('aP0', this.flashP0);
    flashGeo.setAttribute('aBirth', this.flashBirth);
    flashGeo.setAttribute('aSize', this.flashSize);
    flashGeo.setAttribute('aColor', this.flashColor);
    const flashMat = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending,
      uniforms: { uTime: COMBATFX_CLOCK, uMap: { value: texture(glowTexture) } },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec3 aP0; attribute float aBirth; attribute float aSize; attribute vec3 aColor;
        varying vec2 vUv; varying float vA; varying vec3 vColor;
        void main() {
          vUv = uv; vColor = aColor;
          float k = (uTime - aBirth) / ${FLASH_LIFE.toFixed(2)};
          float dead = step(1.0, k) + step(k, -0.0001);
          vA = 0.9 * (1.0 - clamp(k, 0.0, 1.0));
          vec4 mv = modelViewMatrix * vec4(aP0, 1.0);
          mv.xy += position.xy * aSize * (0.4 + clamp(k, 0.0, 1.0));
          gl_Position = projectionMatrix * mv;
          ${DEAD_GLSL}
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; varying vec2 vUv; varying float vA; varying vec3 vColor;
        void main() { vec4 t = texture2D(uMap, vUv); gl_FragColor = vec4(vColor * t.rgb, t.a * vA); }`,
    });
    this.flashMesh = new InstancedMesh(flashGeo, flashMat, nFlashes);
    this.flashMesh.count = 0;
    this.flashMesh.visible = false;
    this.flashMesh.boundingSphere = new Sphere(new Vector3(), 1);
    this.flashBounds = new Bounds(this.flashMesh.boundingSphere);
    this.flashMesh.renderOrder = 7;
    this.flashMesh.name = 'flashes';
    this.group.add(this.flashMesh);

    // --- Dust: puff billboards (PipeSmoke's texture) rising, turning and thinning; fogged like the floor.
    const dustGeo = new BufferGeometry();
    dustGeo.setAttribute('position', quad.getAttribute('position'));
    dustGeo.setAttribute('uv', quad.getAttribute('uv'));
    dustGeo.setIndex(quad.getIndex());
    this.dustP0 = new InstancedBufferAttribute(new Float32Array(nDust * 3), 3).setUsage(DynamicDrawUsage);
    this.dustVel = new InstancedBufferAttribute(new Float32Array(nDust * 3), 3).setUsage(DynamicDrawUsage);
    this.dustBirth = new InstancedBufferAttribute(new Float32Array(nDust).fill(-10), 1).setUsage(DynamicDrawUsage);
    this.dustSeed = new InstancedBufferAttribute(new Float32Array(nDust), 1).setUsage(DynamicDrawUsage);
    this.dustSize = new InstancedBufferAttribute(new Float32Array(nDust), 1).setUsage(DynamicDrawUsage);
    dustGeo.setAttribute('aP0', this.dustP0);
    dustGeo.setAttribute('aVel', this.dustVel);
    dustGeo.setAttribute('aBirth', this.dustBirth);
    dustGeo.setAttribute('aSeed', this.dustSeed);
    dustGeo.setAttribute('aSize', this.dustSize);
    const dustMat = new ShaderMaterial({
      transparent: true, depthWrite: false, fog: true,
      uniforms: {
        uTime: COMBATFX_CLOCK, uMap: { value: texture(puffTexture) }, uColor: { value: new Color(0x8a90a8) },
        fogColor: { value: new Color() }, fogNear: { value: 1 }, fogFar: { value: 1000 }, fogDensity: { value: 0.02 },
      },
      vertexShader: /* glsl */ `
        uniform float uTime;
        attribute vec3 aP0; attribute vec3 aVel; attribute float aBirth; attribute float aSeed; attribute float aSize;
        varying vec2 vUv; varying float vA;
        #include <fog_pars_vertex>
        void main() {
          vUv = uv;
          float t = uTime - aBirth;
          float k = clamp(t / ${DUST_LIFE.toFixed(2)}, 0.0, 1.0);
          float dead = step(${DUST_LIFE.toFixed(2)}, t) + step(t, -0.0001);
          vA = 0.8 * min(1.0, k * 5.0) * (1.0 - k) * (1.0 - k);
          // Rising slows as the puff spreads; each turns its own way.
          vec3 p = aP0 + aVel * t * (1.0 - 0.45 * k);
          float ang = aSeed * 6.2831853 + (aSeed - 0.5) * 2.4 * t;
          float c = cos(ang); float s = sin(ang);
          vec2 q = vec2(position.x * c - position.y * s, position.x * s + position.y * c) * aSize * (0.5 + k);
          vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
          mvPosition.xy += q;
          gl_Position = projectionMatrix * mvPosition;
          ${DEAD_GLSL}
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uMap; uniform vec3 uColor; varying vec2 vUv; varying float vA;
        #include <fog_pars_fragment>
        void main() {
          vec4 t = texture2D(uMap, vUv);
          gl_FragColor = vec4(uColor * t.rgb, t.a * vA);
          #include <fog_fragment>
        }`,
    });
    this.dustMesh = new InstancedMesh(dustGeo, dustMat, nDust);
    this.dustMesh.count = 0;
    this.dustMesh.visible = false;
    this.dustMesh.boundingSphere = new Sphere(new Vector3(), 1);
    this.dustBounds = new Bounds(this.dustMesh.boundingSphere);
    this.dustMesh.renderOrder = 5;
    this.dustMesh.name = 'dust';
    this.group.add(this.dustMesh);

    // --- Shocks: ground rings expanding to a radius (Vfx.shockwave), one shared ring geometry.
    const ringGeo = new RingGeometry(0.6, 1, 24);
    for (let i = 0; i < nShocks; i++) {
      const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false });
      const mesh = new Mesh(ringGeo, mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 4;
      mesh.name = 'shock';
      this.group.add(mesh);
      this.shocks.push({ mesh, mat, birth: 0, seconds: 0.35, radius: 1 });
    }

    // --- Telegraphs: one flat unit plane per slot; ring, cone or disc drawn in the fragment shader with a fill
    // that sweeps outward and a thin bright edge.
    const plane2 = new PlaneGeometry(2, 2);
    for (let i = 0; i < nTelegraphs; i++) {
      const mat = new ShaderMaterial({
        transparent: true, depthWrite: false, fog: false, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true,
        uniforms: {
          uColor: { value: new Color(0xffffff) }, uFill: { value: 0 }, uKind: { value: 2 }, uHalf: { value: 0.5 },
          uEdge: { value: 0.03 }, uAlpha: { value: 0 }, uTime: COMBATFX_CLOCK,
        },
        vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor; uniform float uFill; uniform float uKind; uniform float uHalf; uniform float uEdge; uniform float uAlpha; uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 p = vUv * 2.0 - 1.0;
            float r = length(p);
            float ang = abs(atan(p.y, p.x));
            float ring = step(uKind, 0.5);
            float cone = step(0.5, uKind) * step(uKind, 1.5);
            float inner = 0.72 * ring;
            float outer = 1.0 - smoothstep(1.0 - uEdge, 1.0, r);
            float shape = outer * smoothstep(inner, inner + uEdge, r);
            // The cone's sides: an angular width that keeps the line the same thickness along the radius.
            float aw = uEdge / max(r, 0.05);
            float inCone = 1.0 - smoothstep(uHalf - aw, uHalf, ang);
            shape *= mix(1.0, inCone, cone);
            float edge = smoothstep(1.0 - 2.5 * uEdge, 1.0 - uEdge, r);
            edge += ring * (1.0 - smoothstep(inner + uEdge, inner + 2.5 * uEdge, r));
            edge += cone * smoothstep(uHalf - 2.5 * aw, uHalf - aw, ang);
            edge = clamp(edge, 0.0, 1.0);
            // The fill sweeps from the centre (the inner rim for a ring) out to the edge.
            float frac = mix(r, (r - 0.72) / 0.28, ring);
            float fill = 1.0 - smoothstep(uFill - uEdge, uFill, frac);
            float lead = smoothstep(uFill - 3.0 * uEdge, uFill - uEdge, frac) * fill;
            float pulse = 0.85 + 0.15 * sin(uTime * 9.0);
            float a = shape * (0.08 + fill * 0.28 + lead * 0.4 + edge * 0.8) * uAlpha * pulse;
            gl_FragColor = vec4(uColor * (0.9 + 0.5 * max(edge, lead)), a);
          }`,
      });
      const mesh = new Mesh(plane2, mat);
      mesh.visible = false;
      mesh.renderOrder = 4;
      mesh.name = 'telegraph';
      this.group.add(mesh);
      this.telegraphs.push({ mesh, mat, id: -1, birth: 0, seconds: 1, driven: false, fill: 0, keptAt: 0, full: false });
    }

    // --- The cast rune: a tinted, turning ring texture under the hero.
    this.runeTex = runeTexture();
    this.runeMat = new MeshBasicMaterial({ map: this.runeTex, color: 0xffffff, transparent: true, opacity: 0, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false, fog: false });
    this.runeMesh = new Mesh(plane2, this.runeMat);
    this.runeMesh.rotation.x = -Math.PI / 2;
    this.runeMesh.scale.setScalar(1.2);
    this.runeMesh.visible = false;
    this.runeMesh.renderOrder = 4;
    this.runeMesh.name = 'rune';
    this.group.add(this.runeMesh);
  }

  // ---------------------------------------------------------------- trails

  /** The slot an id's trail owns, or -1. */
  trailSlot(id: string): number {
    for (let i = 0; i < this.trails.length; i++) if (this.trails[i].id === id) return i;
    return -1;
  }

  /**
   * A blade trail: feed one (guard, tip) pair per frame while `on`; `on = false` releases the id and the ribbon
   * fades out over TRAIL_FADE seconds. A fifth id takes the free slot, else the one released longest ago, else the
   * one fed least recently.
   */
  trail(id: string, a: Vector3, b: Vector3, color: ColorRepresentation, on: boolean): void {
    const now = COMBATFX_CLOCK.value;
    let slot: TrailSlot | undefined;
    for (const s of this.trails) if (s.id === id) { slot = s; break; }
    if (!on) {
      if (slot) { slot.on = false; slot.offAt = now; slot.id = null; }
      return;
    }
    const acquired = !slot;
    if (!slot) {
      slot = this.acquireTrail();
      if (!slot) return;
      if (!slot.mesh.visible) this.liveTrails++;
      slot.id = id;
      slot.head = 0;
      slot.count = 0;
      slot.on = true;
      (slot.mat.uniforms.uColor.value as Color).set(color);
      slot.mat.uniforms.uFade.value = 1;
    }
    const i = slot.head;
    slot.guard[i * 3] = a.x; slot.guard[i * 3 + 1] = a.y; slot.guard[i * 3 + 2] = a.z;
    slot.tip[i * 3] = b.x; slot.tip[i * 3 + 1] = b.y; slot.tip[i * 3 + 2] = b.z;
    slot.t[i] = now;
    slot.head = (i + 1) % TRAIL_N;
    slot.count = Math.min(TRAIL_N, slot.count + 1);
    slot.lastFed = now;
    slot.dirty = true;
    if (acquired) {
      // The slot may have been stolen from a live swing: collapse the ribbon onto this first sample now, so the
      // previous owner's geometry can never be drawn, whether the caller feeds trails before or after update().
      this.rebuildTrail(slot);
      slot.mesh.visible = true;
    }
  }

  private acquireTrail(): TrailSlot | undefined {
    let best: TrailSlot | undefined;
    let bestScore = Infinity;
    for (const s of this.trails) {
      // Idle first; then the one released longest ago; then (all four swinging) the one fed least recently.
      const score = !s.mesh.visible ? -1e9 : s.on ? s.lastFed + 1e6 : s.offAt;
      if (score < bestScore) { bestScore = score; best = s; }
    }
    return best;
  }

  private rebuildTrail(s: TrailSlot): void {
    const n = s.count;
    const pos = s.pos.array as Float32Array;
    const age = s.age.array as Float32Array;
    const stamp = s.stamp.array as Float32Array;
    let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (let j = 0; j < TRAIL_N; j++) {
      // Oldest sample first; the ring's unused samples collapse onto the newest one at full age (zero area, invisible).
      const used = Math.min(j, n - 1);
      const idx = (s.head - n + used + TRAIL_N * 2) % TRAIL_N;
      const v = j * 2;
      const gx = s.guard[idx * 3], gy = s.guard[idx * 3 + 1], gz = s.guard[idx * 3 + 2];
      const tx = s.tip[idx * 3], ty = s.tip[idx * 3 + 1], tz = s.tip[idx * 3 + 2];
      pos[v * 3] = gx; pos[v * 3 + 1] = gy; pos[v * 3 + 2] = gz;
      pos[v * 3 + 3] = tx; pos[v * 3 + 4] = ty; pos[v * 3 + 5] = tz;
      const k = j < n ? (n - 1 - used) / Math.max(1, n - 1) : 1;
      age[v] = age[v + 1] = k;
      stamp[v] = stamp[v + 1] = s.t[idx];
      if (j < n) {
        minX = Math.min(minX, gx, tx); minY = Math.min(minY, gy, ty); minZ = Math.min(minZ, gz, tz);
        maxX = Math.max(maxX, gx, tx); maxY = Math.max(maxY, gy, ty); maxZ = Math.max(maxZ, gz, tz);
      }
    }
    s.pos.needsUpdate = true;
    s.age.needsUpdate = true;
    s.stamp.needsUpdate = true;
    if (n > 0) {
      s.sphere.center.set((minX + maxX) * 0.5, (minY + maxY) * 0.5, (minZ + maxZ) * 0.5);
      s.sphere.radius = Math.hypot(maxX - minX, maxY - minY, maxZ - minZ) * 0.5 + 0.05;
    }
    s.dirty = false;
  }

  private finishTrail(s: TrailSlot): void {
    s.mesh.visible = false;
    s.on = false;
    s.id = null;
    s.count = 0;
    s.head = 0;
    this.liveTrails--;
  }

  // ---------------------------------------------------------------- arcs

  /**
   * A swing-plane crescent at the damage frame: centred on `at`, facing `yaw` (the game's heading, cos/sin), its
   * plane tilted by `pitch` (0 flat, π/2 an overhead chop), `radius` metres, spanning ±`halfAngle`.
   */
  arc(at: Vector3, yaw: number, pitch: number, radius: number, color: ColorRepresentation, halfAngle = 1.1): void {
    const now = COMBATFX_CLOCK.value;
    let slot: ArcSlot | undefined;
    for (const s of this.arcs) if (!s.mesh.visible) { slot = s; break; }
    if (!slot) { slot = this.arcs[0]; for (const s of this.arcs) if (s.birth < slot.birth) slot = s; }
    else this.liveArcs++;
    slot.birth = now;
    slot.radius = radius;
    slot.mesh.position.copy(at);
    // Local x = heading, local y = sideways tilted up by pitch, local z completes the frame.
    const h = _a.set(Math.cos(yaw), 0, Math.sin(yaw));
    const side = _b.set(Math.sin(yaw), 0, -Math.cos(yaw));
    const y = _c.set(side.x * Math.cos(pitch), Math.sin(pitch), side.z * Math.cos(pitch));
    const z = _d.crossVectors(h, y);
    _m.makeBasis(h, y, z);
    slot.mesh.quaternion.setFromRotationMatrix(_m);
    slot.mesh.scale.setScalar(radius * 0.8);
    (slot.mat.uniforms.uColor.value as Color).set(color);
    slot.mat.uniforms.uHalf.value = Math.min(Math.PI, Math.max(0.05, halfAngle));
    slot.mat.uniforms.uK.value = 0;
    slot.mesh.visible = true;
  }

  // ---------------------------------------------------------------- sparks

  /** `n` sparks from `at`, scattered within `spread` radians of `dir`, at about `speed` m/s; the oldest give way. */
  sparks(at: Vector3, dir: Vector3, n: number, color: ColorRepresentation, speed: number, spread = 0.6): void {
    const now = COMBATFX_CLOCK.value;
    const pool = this.sparkP0.count;
    const col = _col.set(color);
    const d = _b.copy(dir);
    if (d.lengthSq() < 1e-8) d.set(0, 1, 0);
    d.normalize();
    const p0 = this.sparkP0.array as Float32Array;
    const vel = this.sparkVel.array as Float32Array;
    const birth = this.sparkBirth.array as Float32Array;
    const seed = this.sparkSeed.array as Float32Array;
    const colors = this.sparkColor.array as Float32Array;
    const count = Math.min(n, pool);
    for (let k = 0; k < count; k++) {
      const i = this.sparkHead;
      this.sparkHead = (i + 1) % pool;
      // A cone around dir: the direction plus a random vector scaled by the spread.
      const v = _c.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2 * spread).add(d).normalize();
      const s = speed * (0.5 + Math.random() * 0.8);
      p0[i * 3] = at.x; p0[i * 3 + 1] = at.y; p0[i * 3 + 2] = at.z;
      vel[i * 3] = v.x * s; vel[i * 3 + 1] = v.y * s; vel[i * 3 + 2] = v.z * s;
      birth[i] = now;
      seed[i] = Math.random();
      colors[i * 3] = col.r; colors[i * 3 + 1] = col.g; colors[i * 3 + 2] = col.b;
    }
    this.sparkP0.needsUpdate = this.sparkVel.needsUpdate = this.sparkBirth.needsUpdate = this.sparkSeed.needsUpdate = this.sparkColor.needsUpdate = true;
    const reach = speed * 1.3 * SPARK_LIFE_MAX + 0.5 * SPARK_GRAVITY * SPARK_LIFE_MAX * SPARK_LIFE_MAX + 0.5;
    this.sparkBounds.grow(now >= this.sparksUntil, at.x, at.y, at.z, reach);
    this.sparkEmitted = Math.min(pool, this.sparkEmitted + count);
    this.sparkMesh.count = this.sparkEmitted;
    this.sparkMesh.visible = true;
    this.sparksUntil = Math.max(this.sparksUntil, now + SPARK_LIFE_MAX);
  }

  // ---------------------------------------------------------------- flashes

  /** An expanding glow at an impact, `size` metres across at its biggest, gone in FLASH_LIFE seconds. */
  flash(at: Vector3, color: ColorRepresentation, size: number): void {
    const now = COMBATFX_CLOCK.value;
    const pool = this.flashP0.count;
    const i = this.flashHead;
    this.flashHead = (i + 1) % pool;
    const c = _col.set(color);
    const p0 = this.flashP0.array as Float32Array;
    const colors = this.flashColor.array as Float32Array;
    p0[i * 3] = at.x; p0[i * 3 + 1] = at.y; p0[i * 3 + 2] = at.z;
    (this.flashBirth.array as Float32Array)[i] = now;
    (this.flashSize.array as Float32Array)[i] = size;
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    this.flashP0.needsUpdate = this.flashBirth.needsUpdate = this.flashSize.needsUpdate = this.flashColor.needsUpdate = true;
    this.flashBounds.grow(now >= this.flashUntil, at.x, at.y, at.z, size * 1.4);
    this.flashEmitted = Math.min(pool, this.flashEmitted + 1);
    this.flashMesh.count = this.flashEmitted;
    this.flashMesh.visible = true;
    this.flashUntil = Math.max(this.flashUntil, now + FLASH_LIFE);
  }

  // ---------------------------------------------------------------- shocks

  /** A ground ring at `at` expanding to `radius` metres over `seconds`, fading as it goes. */
  shock(at: Vector3, color: ColorRepresentation, radius: number, seconds = 0.35): void {
    const now = COMBATFX_CLOCK.value;
    let slot: ShockSlot | undefined;
    for (const s of this.shocks) if (!s.mesh.visible) { slot = s; break; }
    if (!slot) { slot = this.shocks[0]; for (const s of this.shocks) if (s.birth < slot.birth) slot = s; }
    else this.liveShocks++;
    slot.birth = now;
    slot.seconds = Math.max(0.05, seconds);
    slot.radius = radius;
    slot.mesh.position.set(at.x, at.y + 0.15, at.z);
    slot.mesh.scale.setScalar(0.2);
    slot.mat.color.set(color);
    slot.mat.opacity = 0.9;
    slot.mesh.visible = true;
  }

  // ---------------------------------------------------------------- dust

  /** Three to five puffs at `at`, `size` metres across, rising and thinning over DUST_LIFE seconds. */
  dust(at: Vector3, size: number): void {
    const now = COMBATFX_CLOCK.value;
    const pool = this.dustP0.count;
    const n = Math.min(pool, 3 + Math.floor(Math.random() * 3));
    const p0 = this.dustP0.array as Float32Array;
    const vel = this.dustVel.array as Float32Array;
    const birth = this.dustBirth.array as Float32Array;
    const seed = this.dustSeed.array as Float32Array;
    const sz = this.dustSize.array as Float32Array;
    for (let k = 0; k < n; k++) {
      const i = this.dustHead;
      this.dustHead = (i + 1) % pool;
      const ox = (Math.random() - 0.5) * size * 0.6;
      const oz = (Math.random() - 0.5) * size * 0.6;
      p0[i * 3] = at.x + ox; p0[i * 3 + 1] = at.y + size * 0.15; p0[i * 3 + 2] = at.z + oz;
      // Outward from the centre and up.
      vel[i * 3] = ox * 1.5 + (Math.random() - 0.5) * 0.4;
      vel[i * 3 + 1] = (0.7 + Math.random() * 0.6) * size;
      vel[i * 3 + 2] = oz * 1.5 + (Math.random() - 0.5) * 0.4;
      birth[i] = now + Math.random() * 0.05;
      seed[i] = Math.random();
      sz[i] = size * (0.4 + Math.random() * 0.4);
    }
    this.dustP0.needsUpdate = this.dustVel.needsUpdate = this.dustBirth.needsUpdate = this.dustSeed.needsUpdate = this.dustSize.needsUpdate = true;
    this.dustBounds.grow(now >= this.dustUntil, at.x, at.y, at.z, size * 2.2);
    this.dustEmitted = Math.min(pool, this.dustEmitted + n);
    this.dustMesh.count = this.dustEmitted;
    this.dustMesh.visible = true;
    this.dustUntil = Math.max(this.dustUntil, now + DUST_LIFE + 0.05);
  }

  // ---------------------------------------------------------------- telegraphs

  /** The slot a telegraph id owns, or -1. */
  telegraphSlot(id: number): number {
    for (let i = 0; i < this.telegraphs.length; i++) { const s = this.telegraphs[i]; if (s.mesh.visible && s.id === id) return i; }
    return -1;
  }

  /**
   * A ground warning at `at`: a `size`-metre ring, disc, or cone (apex at `at`, ±`halfAngle`, default 0.5 rad)
   * facing `yaw`, whose fill sweeps out over `seconds` and then goes dark. The same id replaces its own shape (and
   * puts it back on the clock); driveTelegraph takes it off the clock.
   */
  telegraph(id: number, kind: 'ring' | 'cone' | 'disc', at: Vector3, yaw: number, size: number, seconds: number, color: ColorRepresentation, halfAngle = 0.5): void {
    const now = COMBATFX_CLOCK.value;
    let slot: TelegraphSlot | undefined;
    for (const s of this.telegraphs) if (s.mesh.visible && s.id === id) { slot = s; break; }
    if (!slot) {
      for (const s of this.telegraphs) if (!s.mesh.visible) { slot = s; break; }
      if (!slot) { slot = this.telegraphs[0]; for (const s of this.telegraphs) if (s.birth < slot.birth) slot = s; }
      else this.liveTelegraphs++;
    }
    slot.id = id;
    slot.birth = now;
    slot.seconds = Math.max(0.05, seconds);
    slot.driven = slot.full = false;
    slot.fill = 0;
    slot.mesh.position.set(at.x, at.y + 0.08, at.z);
    slot.mesh.rotation.set(-Math.PI / 2, 0, -yaw);
    slot.mesh.scale.setScalar(Math.max(0.1, size));
    const u = slot.mat.uniforms;
    (u.uColor.value as Color).set(color);
    u.uKind.value = kind === 'ring' ? 0 : kind === 'cone' ? 1 : 2;
    u.uHalf.value = Math.min(Math.PI, Math.max(0.05, halfAngle));
    u.uEdge.value = Math.min(0.08, Math.max(0.012, 0.1 / Math.max(0.1, size)));
    u.uFill.value = 0;
    u.uAlpha.value = 0;
    slot.mesh.visible = true;
  }

  /** The live slot telegraph `id` owns, if any. */
  private liveTelegraph(id: number): TelegraphSlot | undefined {
    for (const s of this.telegraphs) if (s.mesh.visible && s.id === id) return s;
    return undefined;
  }

  /**
   * Drives telegraph `id` from its owner's step instead of the clock: its fill is `fill` (0..1) until the next drive,
   * and it stands at `at` facing `yaw` when given (it follows what it warns of). A wind-up that a hit-stop holds, a
   * slow stretches or a daze stops holds its warning with it, so the sweep reaches the edge exactly as the blow lands.
   * Driven to 1 it shows the full sweep for one frame and goes dark; one its owner stops driving goes dark
   * TELEGRAPH_KEEP seconds after the last drive. False when `id` has no live telegraph (issue it again).
   */
  driveTelegraph(id: number, fill: number, at?: Vector3, yaw?: number): boolean {
    const s = this.liveTelegraph(id);
    if (!s) return false;
    s.driven = true;
    s.fill = Math.max(0, Math.min(1, fill));
    s.keptAt = COMBATFX_CLOCK.value;
    if (at) s.mesh.position.set(at.x, at.y + 0.08, at.z);
    if (yaw !== undefined) s.mesh.rotation.set(-Math.PI / 2, 0, -yaw);
    s.mat.uniforms.uFill.value = s.fill;
    return true;
  }

  /** Puts telegraph `id` out at once, unfilled (its blow will not come: the owner fell, was dazed off it, gave up). */
  endTelegraph(id: number): void {
    const s = this.liveTelegraph(id);
    if (s) this.darkTelegraph(s);
  }

  private darkTelegraph(s: TelegraphSlot): void {
    s.mesh.visible = false;
    s.id = -1;
    s.driven = s.full = false;
    this.liveTelegraphs--;
  }

  // ---------------------------------------------------------------- rune

  /** The cast circle under the hero: follows `at` each call, fades in while `on` and out when not. */
  rune(at: Vector3, color: ColorRepresentation, on: boolean): void {
    this.runeOn = on;
    this.runeMesh.position.set(at.x, at.y + 0.05, at.z);
    if (on) this.runeMat.color.set(color);
  }

  // ---------------------------------------------------------------- update

  /**
   * What is live right now, for the tests and the perf HUD. This is the one read that allocates (its result
   * object): poll it when the HUD refreshes, not every frame.
   */
  get live(): { trails: number; arcs: number; sparks: number; flashes: number; shocks: number; dust: number; telegraphs: number; rune: boolean } {
    const now = COMBATFX_CLOCK.value;
    let trails = 0, arcs = 0, shocks = 0, telegraphs = 0;
    for (const s of this.trails) if (s.mesh.visible) trails++;
    for (const s of this.arcs) if (s.mesh.visible) arcs++;
    for (const s of this.shocks) if (s.mesh.visible) shocks++;
    for (const s of this.telegraphs) if (s.mesh.visible) telegraphs++;
    return {
      trails, arcs, shocks, telegraphs,
      sparks: this.sparkMesh.visible ? countAlive(this.sparkBirth.array as Float32Array, this.sparkMesh.count, now, 0.35, 0.25, this.sparkSeed.array as Float32Array) : 0,
      flashes: this.flashMesh.visible ? countAlive(this.flashBirth.array as Float32Array, this.flashMesh.count, now, FLASH_LIFE) : 0,
      dust: this.dustMesh.visible ? countAlive(this.dustBirth.array as Float32Array, this.dustMesh.count, now, DUST_LIFE) : 0,
      rune: this.runeMesh.visible,
    };
  }

  /**
   * Advances the shared clock, ages every live effect, rebuilds the ribbons that were fed and fades the rune.
   * Ribbons farther than 60 m from `camera` keep their last shape (they still fade: the shaders read the clock).
   */
  update(dt: number, camera: Camera): void {
    COMBATFX_CLOCK.value += dt;
    const now = COMBATFX_CLOCK.value;
    if (this.liveTrails === 0 && this.liveArcs === 0 && this.liveShocks === 0 && this.liveTelegraphs === 0
      && now >= this.sparksUntil && now >= this.flashUntil && now >= this.dustUntil && !this.runeOn && this.runeOpacity <= 0) {
      if (this.sparkMesh.visible) { this.sparkMesh.visible = false; this.sparkMesh.count = 0; this.sparkEmitted = 0; this.sparkHead = 0; }
      if (this.flashMesh.visible) { this.flashMesh.visible = false; this.flashMesh.count = 0; this.flashEmitted = 0; this.flashHead = 0; }
      if (this.dustMesh.visible) { this.dustMesh.visible = false; this.dustMesh.count = 0; this.dustEmitted = 0; this.dustHead = 0; }
      return;
    }

    if (this.liveTrails > 0) {
      const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z;
      for (const s of this.trails) {
        if (!s.mesh.visible) continue;
        // A caller that stops feeding without turning the trail off: treat it as off after half a second.
        if (s.on && now - s.lastFed > 0.5) { s.on = false; s.offAt = now; s.id = null; }
        if (!s.on) {
          const fade = 1 - (now - s.offAt) / TRAIL_FADE;
          if (fade <= 0) { this.finishTrail(s); continue; }
          s.mat.uniforms.uFade.value = fade;
        }
        if (s.dirty && s.count > 0) {
          const c = s.sphere.center;
          const far = s.count > 1 && (c.x - cx) ** 2 + (c.y - cy) ** 2 + (c.z - cz) ** 2 > 3600;
          if (!far) this.rebuildTrail(s);
        }
      }
    }

    if (this.liveArcs > 0) {
      for (const s of this.arcs) {
        if (!s.mesh.visible) continue;
        const k = (now - s.birth) / ARC_LIFE;
        if (k >= 1) { s.mesh.visible = false; this.liveArcs--; continue; }
        s.mat.uniforms.uK.value = k;
        s.mesh.scale.setScalar(s.radius * (0.8 + 0.3 * k));
      }
    }

    if (this.liveShocks > 0) {
      for (const s of this.shocks) {
        if (!s.mesh.visible) continue;
        const k = (now - s.birth) / s.seconds;
        if (k >= 1) { s.mesh.visible = false; this.liveShocks--; continue; }
        s.mesh.scale.setScalar(0.2 + k * s.radius);
        s.mat.opacity = 0.9 * (1 - k);
      }
    }

    if (this.liveTelegraphs > 0) {
      for (const s of this.telegraphs) {
        if (!s.mesh.visible) continue;
        const t = now - s.birth;
        if (s.driven) {
          // The owner's fill (set in driveTelegraph); the full sweep is shown for one frame, then it goes dark.
          if (s.full || now - s.keptAt > TELEGRAPH_KEEP) { this.darkTelegraph(s); continue; }
          if (s.fill >= 1) s.full = true;
        } else {
          if (t >= s.seconds) { this.darkTelegraph(s); continue; }
          s.mat.uniforms.uFill.value = t / s.seconds;
        }
        s.mat.uniforms.uAlpha.value = Math.min(1, t / 0.06);
      }
    }

    if (now >= this.sparksUntil && this.sparkMesh.visible) { this.sparkMesh.visible = false; this.sparkMesh.count = 0; this.sparkEmitted = 0; this.sparkHead = 0; }
    if (now >= this.flashUntil && this.flashMesh.visible) { this.flashMesh.visible = false; this.flashMesh.count = 0; this.flashEmitted = 0; this.flashHead = 0; }
    if (now >= this.dustUntil && this.dustMesh.visible) { this.dustMesh.visible = false; this.dustMesh.count = 0; this.dustEmitted = 0; this.dustHead = 0; }

    if (this.runeOn || this.runeOpacity > 0) {
      const want = this.runeOn ? 0.85 : 0;
      this.runeOpacity += (want - this.runeOpacity) * (1 - Math.exp(-dt * (this.runeOn ? 10 : 6)));
      if (!this.runeOn && this.runeOpacity < 0.01) this.runeOpacity = 0;
      this.runeMat.opacity = this.runeOpacity;
      this.runeMesh.rotation.z -= dt * 1.2;
      this.runeMesh.visible = this.runeOpacity > 0;
    }
  }

  /**
   * Frees every geometry, material and instanced mesh (the instance-matrix buffers); the glow and puff textures
   * are shared with the rest of the game and kept.
   */
  dispose(): void {
    const seen = new Set<BufferGeometry>();
    for (const o of this.group.children) {
      const m = o as Mesh;
      if (m.geometry && !seen.has(m.geometry)) { seen.add(m.geometry); m.geometry.dispose(); }
      (m.material as ShaderMaterial | MeshBasicMaterial).dispose();
    }
    if (this.runeTex !== fallbackTex) this.runeTex.dispose();
    this.sparkMesh.dispose();
    this.flashMesh.dispose();
    this.dustMesh.dispose();
    this.group.clear();
  }
}

/** The materials patchDissolve has patched, with their uniform and edge colour (the guard; see patchDissolve). */
const dissolved = new WeakMap<MeshStandardMaterial, { amount: { value: number }; edge: Color }>();

/**
 * Death by dissolve: pixels whose world-space noise falls under `value` are discarded, and a glowing edge in
 * `edge`'s colour burns just above the threshold. Ramp the returned uniform 0 → 1 over ~0.9 s. Works on skinned
 * and instanced meshes (the position is taken after the standard skinning chunk); chains any earlier
 * onBeforeCompile (the patchGlowCap pattern).
 *
 * Patches a material once: a respawned mob dies again with the same material copies, and a second patch chained
 * onto the first would redeclare every varying and function and break the program. A repeat call returns the
 * same uniform (also kept at `mat.userData.dissolve`) and only retints the edge; the caller sets the value back to
 * 0 for each death. A clone of a patched material carries only a JSON copy of that userData, so it is patched
 * afresh (the registry, not userData, is the guard).
 */
export function patchDissolve(mat: MeshStandardMaterial, edge: ColorRepresentation): { value: number } {
  const installed = dissolved.get(mat);
  if (installed) {
    installed.edge.set(edge);
    return installed.amount;
  }
  const amount = { value: 0 };
  const edgeColor = new Color(edge);
  dissolved.set(mat, { amount, edge: edgeColor });
  mat.userData.dissolve = amount;
  const prev = mat.onBeforeCompile;
  mat.onBeforeCompile = (shader, renderer) => {
    prev?.call(mat, shader, renderer);
    shader.uniforms.uDissolve = amount;
    shader.uniforms.uDissolveEdge = { value: edgeColor };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vDissolveP;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        {
          vec4 dp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          dp = instanceMatrix * dp;
          #endif
          vDissolveP = (modelMatrix * dp).xyz;
        }`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uDissolve; uniform vec3 uDissolveEdge; varying vec3 vDissolveP;
        float dsHash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float dsNoise(vec3 x) {
          vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(dsHash(i), dsHash(i + vec3(1, 0, 0)), f.x), mix(dsHash(i + vec3(0, 1, 0)), dsHash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(dsHash(i + vec3(0, 0, 1)), dsHash(i + vec3(1, 0, 1)), f.x), mix(dsHash(i + vec3(0, 1, 1)), dsHash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }`)
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
        float dsN = dsNoise(vDissolveP * 6.0) * 0.65 + dsNoise(vDissolveP * 19.0) * 0.35;
        // The threshold runs a little past the noise range so the last pixels go too.
        float dsT = uDissolve * 1.1 - 0.05;
        if (dsN < dsT) discard;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uDissolveEdge * smoothstep(0.1, 0.0, dsN - dsT) * 1.4 * step(0.001, uDissolve);`);
  };
  const prevKey = mat.customProgramCacheKey.bind(mat);
  mat.customProgramCacheKey = () => `${prevKey()}|dissolve`;
  mat.needsUpdate = true;
  return amount;
}

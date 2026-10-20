import { Color, type ColorRepresentation, DoubleSide, Group, Mesh, PlaneGeometry, ShaderMaterial, UniformsLib, UniformsUtils } from 'three';
import { PALETTE } from '../render/palette';
import { CameraJump } from '../render/Sky';

const VERT = /* glsl */ `
varying vec3 vWorld;
#include <fog_pars_vertex>
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FRAG = /* glsl */ `
uniform float uTime; uniform vec3 uBase; uniform vec3 uTint; uniform float uMix; uniform float uFogged; uniform float uAlpha; uniform float uScale; uniform vec3 uCam;
varying vec3 vWorld;
#include <fog_pars_fragment>
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
  // Thin right under the camera, and thinned out before the sky dome so the sea never ends in a line on the horizon.
  a *= smoothstep(8.0, 30.0, d) * (1.0 - smoothstep(380.0, 540.0, d));
  // The place's own air: its fog colour lifted toward its sky (the island's: fog blue toward electric). Out in a realm
  // its fog then takes the sea with distance (uFogged); the island's sea keeps its own unfogged look.
  #ifdef USE_FOG
    vec3 base = fogColor;
  #else
    vec3 base = uBase;
  #endif
  gl_FragColor = vec4(mix(base, uTint, uMix), a);
  #ifdef USE_FOG
    #ifdef FOG_EXP2
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
    #else
      float fogFactor = smoothstep(fogNear, fogFar, vFogDepth);
    #endif
    gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor * uFogged);
  #endif
}`;

/** Each layer's drop under the top one, opacity, noise scale, and how far it lifts the fog toward the tint. */
const LAYERS: ReadonlyArray<readonly [number, number, number, number]> = [[0, 0.95, 0.016, 0.3], [-9, 0.9, 0.01, 0.22], [-22, 0.85, 0.007, 0.15]];

const ease = (t: number) => t * t * (3 - 2 * t);

/**
 * The cloud sea's level and opacity over time. `set(y)` eases the level to `y` (and the opacity to full) over
 * `seconds`; `set(null)` fades the clouds out where they are; a level asked for while they are faded out is taken at
 * once and faded in. Asking again for the target already set changes nothing, so it can be called every frame.
 */
export class CloudLevel {
  /** The top layer's height now. */
  level: number;
  /** 0 (gone) to 1. */
  alpha = 1;
  private target: number | null;
  private fromLevel: number;
  private fromAlpha = 1;
  private toLevel: number;
  private toAlpha = 1;
  private t = 1;
  private duration = 1;

  constructor(y: number) {
    this.level = this.fromLevel = this.toLevel = this.target = y;
  }

  /** The level last asked for (null: no clouds). */
  get wanted(): number | null {
    return this.target;
  }

  set(y: number | null, seconds = 1): void {
    if (y === this.target) return;
    this.target = y;
    this.fromLevel = this.level;
    this.fromAlpha = this.alpha;
    if (y === null) {
      this.toLevel = this.level;
      this.toAlpha = 0;
    } else {
      // Out of sight, a sea needs no climb: it is simply there when it fades back in.
      if (this.alpha <= 0.001) this.fromLevel = this.level = y;
      this.toLevel = y;
      this.toAlpha = 1;
    }
    this.duration = Math.max(0, seconds);
    this.t = 0;
    if (this.duration === 0) this.step(0);
  }

  step(dt: number): void {
    if (this.t >= 1) return;
    this.t = this.duration > 0 ? Math.min(1, this.t + dt / this.duration) : 1;
    const k = ease(this.t);
    this.level = this.fromLevel + (this.toLevel - this.fromLevel) * k;
    this.alpha = this.fromAlpha + (this.toAlpha - this.fromAlpha) * k;
  }
}

/**
 * Three drifting noise-alpha planes below the cliffs, tinted from the place's fog toward its sky (on the island fog →
 * electric). They follow the camera into every place (they live in the scene root, never hidden with a zone), each
 * place setting its own level (data/world CLOUD_LEVEL) and air (setAir).
 */
export class CloudSea {
  readonly group = new Group();
  private readonly mats: ShaderMaterial[] = [];
  private readonly meshes: Mesh[] = [];
  private readonly state: CloudLevel;
  /** The tint every layer lifts its fog colour toward (shared uniform value), and where it is going. */
  private readonly tint = new Color(PALETTE.electric);
  private readonly tintTo = new Color(PALETTE.electric);
  /** How much the place's fog takes the sea with distance (shared uniform: 0 on the island, 1 in a realm). */
  private readonly fogged = { value: 0 };
  private foggedTo = 0;
  /**
   * Whether the camera jumped this frame (a teleport, or the first frame): a change asked for now is made at once. (The
   * sky's own, on the same rule: Sky.ts CameraJump.)
   */
  private readonly jump = new CameraJump();

  constructor(y: number) {
    this.state = new CloudLevel(y);
    const base = new Color(PALETTE.fog);
    for (const [, alpha, scale, mix] of LAYERS) {
      const mat = new ShaderMaterial({
        uniforms: {
          ...UniformsUtils.clone(UniformsLib.fog),
          uTime: { value: 0 },
          uBase: { value: base },
          uTint: { value: this.tint },
          uMix: { value: mix },
          uFogged: this.fogged,
          uAlpha: { value: alpha },
          uScale: { value: scale },
          uCam: { value: { x: 0, y: 0, z: 0 } },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        fog: true,
        side: DoubleSide, forceSinglePass: true,
      });
      const mesh = new Mesh(new PlaneGeometry(1600, 1600), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.renderOrder = 5;
      this.group.add(mesh);
      this.mats.push(mat);
      this.meshes.push(mesh);
    }
    this.place();
  }

  /** The top layer's height now (the others are 9 and 22 m under it). */
  get level(): number {
    return this.state.level;
  }

  /** 0 (gone) to 1. */
  get alpha(): number {
    return this.state.alpha;
  }

  /**
   * Eases the sea to a new level over `seconds` (its layers at y, y − 9, y − 22), or fades it out with null. Right
   * after a teleport the change is immediate (the arrival curtain hides it): no cloud lingers over a drowned floor.
   */
  setLevel(y: number | null, seconds = 1): void {
    this.state.set(y, this.jump.jumped ? 0 : seconds);
    this.place();
  }

  /**
   * The place's air: a realm's sky (its horizon colour), which the layers lift the realm's fog toward and whose fog
   * then takes them with distance; or null for the island's own sea (fog blue lifted toward electric, unfogged, as it
   * always was). Eased like the sky's reflections; at once right after a teleport.
   */
  setAir(sky: ColorRepresentation | null): void {
    this.tintTo.set(sky ?? PALETTE.electric);
    this.foggedTo = sky === null ? 0 : 1;
    if (this.jump.jumped) {
      this.tint.copy(this.tintTo);
      this.fogged.value = this.foggedTo;
    }
  }

  update(dt: number, cam: { x: number; y: number; z: number }): void {
    this.jump.update(cam);
    this.state.step(dt);
    const k = 1 - Math.exp(-2 * dt);
    this.tint.lerp(this.tintTo, k);
    this.fogged.value += (this.foggedTo - this.fogged.value) * k;
    this.place();
    // The noise lives in world space, so the planes can follow the camera to the realms beyond the island.
    this.group.position.x = cam.x;
    this.group.position.z = cam.z;
    for (const m of this.mats) {
      m.uniforms.uTime.value += dt;
      m.uniforms.uCam.value = cam;
    }
  }

  private place(): void {
    const { level, alpha } = this.state;
    this.group.visible = alpha > 0.001;
    for (let i = 0; i < LAYERS.length; i++) {
      this.meshes[i].position.y = level + LAYERS[i][0];
      this.mats[i].uniforms.uAlpha.value = LAYERS[i][1] * alpha;
    }
  }
}

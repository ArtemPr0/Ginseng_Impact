import {
  ACESFilmicToneMapping, Camera, HalfFloatType, PCFShadowMap, Scene, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import { WIND } from './Materials';
import { PALETTE } from './palette';

/**
 * Linear-space grade, folded into the output pass just before tone mapping so it costs no extra full-screen pass:
 * the trip warp (swirl, ripple, RGB split, hue drift), saturation, a cobalt lift in the shadows, contrast and a
 * cinematic vignette.
 */
const GRADE_UNIFORMS = 'uniform vec3 uLift; uniform float uVignette; uniform float uContrast; uniform float uSaturation; uniform float uTrip; uniform float uTime;';
const GRADE_GLSL = /* glsl */ `
  {
    vec2 uv = vUv;
    vec3 col;
    if (uTrip > 0.001) {
      // Trip: the frame swirls around the centre, breathes in rings and splits into colour fringes.
      vec2 c = uv - 0.5;
      float r = length(c);
      float a = atan(c.y, c.x) + uTrip * (0.9 * sin(uTime * 0.6) + 0.5) * (1.0 - smoothstep(0.0, 0.75, r)) * 1.4;
      r *= 1.0 + uTrip * 0.035 * sin(r * 34.0 - uTime * 5.0);
      uv = 0.5 + vec2(cos(a), sin(a)) * r;
      vec2 split = normalize(c + 1e-4) * uTrip * 0.012;
      col = vec3(texture2D(tDiffuse, uv + split).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - split).b);
      // Hue drift: rotate the colour around the grey axis.
      float h = uTrip * (uTime * 1.3 + r * 9.0);
      vec3 k = vec3(0.57735);
      col = col * cos(h) + cross(k, col) * sin(h) + k * dot(k, col) * (1.0 - cos(h));
      col = max(col, 0.0) * (1.0 + uTrip * 0.25);
    } else {
      col = gl_FragColor.rgb;
    }
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(lum), col, uSaturation);
    col += uLift * (1.0 - smoothstep(0.0, 0.35, lum));
    col = (col - 0.5 * 0.18) * uContrast + 0.5 * 0.18;
    float d = distance(vUv, vec2(0.5));
    col *= 1.0 - uVignette * smoothstep(0.35, 0.95, d);
    gl_FragColor.rgb = max(col, 0.0);
  }`;

/** How a world is graded: bloom on emissives, colour and exposure. Zones blend toward their look (see setLook). */
export interface Look {
  bloom: number;
  radius: number;
  threshold: number;
  saturation: number;
  contrast: number;
  vignette: number;
  exposure: number;
  lift: [number, number, number];
}

/** Per-world looks. The island is the reference night (#28): deep cobalt, neon glows that bloom hard. */
export const LOOKS: Record<string, Look> = {
  island: { bloom: 0.7, radius: 0.6, threshold: 0.78, saturation: 1.18, contrast: 1.1, vignette: 0.5, exposure: 0.92, lift: [0.004, 0.01, 0.04] },
  galaxy: { bloom: 0.75, radius: 0.65, threshold: 0.75, saturation: 1.25, contrast: 1.08, vignette: 0.45, exposure: 1.0, lift: [0.01, 0.006, 0.04] },
  dream: { bloom: 0.9, radius: 0.75, threshold: 0.65, saturation: 1.4, contrast: 1.05, vignette: 0.35, exposure: 1.05, lift: [0.02, 0.005, 0.03] },
  graveyard: { bloom: 0.65, radius: 0.6, threshold: 0.78, saturation: 1.15, contrast: 1.14, vignette: 0.62, exposure: 0.95, lift: [0.025, 0.008, 0.04] },
  sunken: { bloom: 0.7, radius: 0.7, threshold: 0.75, saturation: 1.15, contrast: 1.05, vignette: 0.55, exposure: 0.95, lift: [0.0, 0.015, 0.05] },
  treehouse: { bloom: 0.65, radius: 0.6, threshold: 0.78, saturation: 1.15, contrast: 1.08, vignette: 0.55, exposure: 1.0, lift: [0.01, 0.01, 0.04] },
  // The kingdom's quarters at night (the @returndark reels): deep purple, glows that bloom, heavier vignette.
  'lean-night': { bloom: 0.85, radius: 0.7, threshold: 0.68, saturation: 1.3, contrast: 1.14, vignette: 0.6, exposure: 0.95, lift: [0.012, 0.0, 0.05] },
  vale: { bloom: 0.72, radius: 0.62, threshold: 0.76, saturation: 1.2, contrast: 1.1, vignette: 0.5, exposure: 0.95, lift: [0.0, 0.012, 0.04] },
  'lean-snow': { bloom: 0.7, radius: 0.65, threshold: 0.75, saturation: 1.12, contrast: 1.12, vignette: 0.58, exposure: 0.92, lift: [0.0, 0.01, 0.055] },
};

/** Pixel-ratio range for the adaptive resolution governor and the frame-time band it keeps. */
const MAX_RATIO = 1.25;
const MIN_RATIO = 0.8;
const SLOW_MS = 25;
const FAST_MS = 14;

/**
 * Cinematic pipeline: half-float render (no MSAA) → quarter-resolution bloom on emissives → grade, trip warp and
 * vignette folded into the output pass → ACES + sRGB → FXAA. Shadows: PCF shadow map from the moon, redrawn every
 * second frame. The look blends per world (setLook) and the trip effect fades in and out (trip).
 */
export class Renderer {
  readonly gl: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly fxaa: ShaderPass;
  private readonly grade: Record<string, { value: unknown }>;
  private readonly look: Look = { ...LOOKS.island, lift: [...LOOKS.island.lift] };
  private target: Look = LOOKS.island;
  private tripLevel = 0;
  private tripUntil = 0;
  private tripPeak = 0;
  private frameIndex = 0;
  private width = 1;
  private height = 1;
  private ratio = Math.min(window.devicePixelRatio, MAX_RATIO);
  private frameMs = 16;
  private lastFrame = 0;
  private nextCheck = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    // Clipping planes on single materials (Materials.clipAbove: the sky dock's island without its tree).
    this.gl.localClippingEnabled = true;
    // At most 1.25× on Retina (1.5× cost ~45% more pixels for little visible gain); the governor may go lower.
    this.gl.setPixelRatio(this.ratio);
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = this.look.exposure;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFShadowMap;
    this.gl.setClearColor(PALETTE.fog, 1);
    // No MSAA: multisampling a half-float target roughly halved the frame rate on Apple GPUs (measured);
    // FXAA on the final image smooths edges for a fraction of the cost.
    const target = new WebGLRenderTarget(1, 1, { samples: 0, type: HalfFloatType });
    this.composer = new EffectComposer(this.gl, target);
    this.renderPass = new RenderPass(new Scene(), new Camera());
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), this.look.bloom, this.look.radius, this.look.threshold);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    const output = new OutputPass();
    this.grade = {
      uLift: { value: new Vector3(...this.look.lift) }, uVignette: { value: this.look.vignette }, uContrast: { value: this.look.contrast },
      uSaturation: { value: this.look.saturation }, uTrip: { value: 0 }, uTime: { value: 0 },
    };
    Object.assign(output.uniforms, this.grade);
    output.material.fragmentShader = output.material.fragmentShader
      .replace('uniform sampler2D tDiffuse;', 'uniform sampler2D tDiffuse; ' + GRADE_UNIFORMS)
      .replace('gl_FragColor = texture2D( tDiffuse, vUv );', 'gl_FragColor = texture2D( tDiffuse, vUv );' + GRADE_GLSL);
    output.material.needsUpdate = true;
    this.composer.addPass(output);
    this.fxaa = new ShaderPass(FXAAShader);
    this.composer.addPass(this.fxaa);
    // The moon's shadow map is redrawn every second frame (see render): half the shadow cost, no visible lag.
    this.gl.shadowMap.autoUpdate = false;
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.gl.setSize(width, height, false);
    this.composer.setSize(width, height);
    // Bloom is a soft glow: quarter resolution looks nearly the same and costs a small fraction.
    this.bloom.setSize(Math.max(1, Math.round(width / 4)), Math.max(1, Math.round(height / 4)));
    const px = this.gl.getPixelRatio();
    (this.fxaa.material.uniforms.resolution.value as Vector2).set(1 / Math.max(1, width * px), 1 / Math.max(1, height * px));
  }

  /** Current render scale (device pixels per CSS pixel), adapted to keep frames under ~25 ms. */
  get pixelRatio(): number {
    return this.ratio;
  }

  /** Watches frame times and steps the resolution down when frames are slow, back up when there is headroom. */
  private govern(): void {
    const now = performance.now();
    const dt = now - this.lastFrame;
    this.lastFrame = now;
    if (dt <= 0 || dt > 250) return;
    this.frameMs += (dt - this.frameMs) * 0.05;
    if (now < this.nextCheck) return;
    this.nextCheck = now + 1500;
    const cap = Math.min(window.devicePixelRatio, MAX_RATIO);
    let r = this.ratio;
    if (this.frameMs > SLOW_MS && r > MIN_RATIO) r = Math.max(MIN_RATIO, r - 0.1);
    else if (this.frameMs < FAST_MS && r < cap) r = Math.min(cap, r + 0.05);
    if (Math.abs(r - this.ratio) < 0.001) return;
    this.ratio = r;
    this.gl.setPixelRatio(r);
    this.composer.setPixelRatio(r);
    this.resize(this.width, this.height);
  }

  /** Blends the grade toward a world's look over about a second (zone changes). */
  setLook(look: Look): void {
    this.target = look;
  }

  /**
   * Starts or extends a trip: the frame swirls, ripples and drifts through hues, at `strength` (0..1) for `seconds`,
   * then fades out. Overlapping trips keep the strongest.
   */
  trip(strength: number, seconds: number): void {
    const now = performance.now() / 1000;
    this.tripPeak = this.tripUntil > now ? Math.max(this.tripPeak, strength) : strength;
    this.tripUntil = Math.max(this.tripUntil, now + seconds);
  }

  /** Current trip level, 0..1 (sound and HUD can follow it). */
  get tripAmount(): number {
    return this.tripLevel;
  }

  private blendLook(dt: number): void {
    const k = 1 - Math.exp(-dt * 2.5);
    const l = this.look;
    const t = this.target;
    l.bloom += (t.bloom - l.bloom) * k;
    l.radius += (t.radius - l.radius) * k;
    l.threshold += (t.threshold - l.threshold) * k;
    l.saturation += (t.saturation - l.saturation) * k;
    l.contrast += (t.contrast - l.contrast) * k;
    l.vignette += (t.vignette - l.vignette) * k;
    l.exposure += (t.exposure - l.exposure) * k;
    for (let i = 0; i < 3; i++) l.lift[i] += (t.lift[i] - l.lift[i]) * k;
    this.bloom.strength = l.bloom;
    this.bloom.radius = l.radius;
    this.bloom.threshold = l.threshold;
    this.gl.toneMappingExposure = l.exposure;
    (this.grade.uLift.value as Vector3).set(l.lift[0], l.lift[1], l.lift[2]);
    this.grade.uSaturation.value = l.saturation;
    this.grade.uContrast.value = l.contrast;
    this.grade.uVignette.value = l.vignette;
    const now = performance.now() / 1000;
    const want = now < this.tripUntil ? this.tripPeak : 0;
    // Trips come on fast and leave slowly.
    this.tripLevel += (want - this.tripLevel) * (1 - Math.exp(-dt * (want > this.tripLevel ? 4 : 0.8)));
    if (this.tripLevel < 0.002 && want === 0) this.tripLevel = 0;
    this.grade.uTrip.value = this.tripLevel;
    this.grade.uTime.value = now % 1000;
  }

  get aspect(): number {
    return this.width / this.height;
  }

  render(scene: Scene, camera: Camera): void {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    const prevWind = WIND.value;
    WIND.value = performance.now() / 1000;
    this.blendLook(Math.min(0.1, Math.max(0, WIND.value - prevWind)));
    this.govern();
    if (this.frameIndex++ % 2 === 0) this.gl.shadowMap.needsUpdate = true;
    this.composer.render();
  }
}

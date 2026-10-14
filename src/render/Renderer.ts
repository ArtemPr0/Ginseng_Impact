import {
  ACESFilmicToneMapping, Camera, HalfFloatType, PCFSoftShadowMap, Scene, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
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
 * Linear-space grade (cobalt lift in the shadows, gentle contrast, cinematic vignette), folded into the output pass
 * just before tone mapping, so it costs no extra full-screen pass.
 */
const GRADE_UNIFORMS = 'uniform vec3 uLift; uniform float uVignette; uniform float uContrast;';
const GRADE_GLSL = /* glsl */ `
  {
    float lum = dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722));
    gl_FragColor.rgb += uLift * (1.0 - smoothstep(0.0, 0.35, lum));
    gl_FragColor.rgb = (gl_FragColor.rgb - 0.5 * 0.18) * uContrast + 0.5 * 0.18;
    float d = distance(vUv, vec2(0.5));
    gl_FragColor.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.95, d);
  }`;

/** Pixel-ratio range for the adaptive resolution governor and the frame-time band it keeps. */
const MAX_RATIO = 1.25;
const MIN_RATIO = 0.8;
const SLOW_MS = 25;
const FAST_MS = 14;

/**
 * Cinematic pipeline: full-resolution MSAA render → bloom on emissives → grade/vignette → ACES + sRGB output.
 * Shadows: PCF soft shadow map from the moon.
 */
export class Renderer {
  readonly gl: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private readonly fxaa: ShaderPass;
  private frameIndex = 0;
  private width = 1;
  private height = 1;
  private ratio = Math.min(window.devicePixelRatio, MAX_RATIO);
  private frameMs = 16;
  private lastFrame = 0;
  private nextCheck = 0;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    // At most 1.25× on Retina (1.5× cost ~45% more pixels for little visible gain); the governor may go lower.
    this.gl.setPixelRatio(this.ratio);
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 0.95;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFSoftShadowMap;
    this.gl.setClearColor(PALETTE.fog, 1);
    // No MSAA: multisampling a half-float target roughly halved the frame rate on Apple GPUs (measured);
    // FXAA on the final image smooths edges for a fraction of the cost.
    const target = new WebGLRenderTarget(1, 1, { samples: 0, type: HalfFloatType });
    this.composer = new EffectComposer(this.gl, target);
    this.renderPass = new RenderPass(new Scene(), new Camera());
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.65, 0.8);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    const output = new OutputPass();
    Object.assign(output.uniforms, { uLift: { value: new Vector3(0.006, 0.012, 0.045) }, uVignette: { value: 0.5 }, uContrast: { value: 1.08 } });
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

  get aspect(): number {
    return this.width / this.height;
  }

  render(scene: Scene, camera: Camera): void {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    WIND.value = performance.now() / 1000;
    this.govern();
    if (this.frameIndex++ % 2 === 0) this.gl.shadowMap.needsUpdate = true;
    this.composer.render();
  }
}

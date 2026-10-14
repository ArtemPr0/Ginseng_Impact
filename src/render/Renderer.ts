import {
  ACESFilmicToneMapping, Camera, HalfFloatType, PCFSoftShadowMap, Scene, Vector2, Vector3, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { WIND } from './Materials';
import { PALETTE } from './palette';

/** Linear-space grade: cobalt lift in the shadows, gentle contrast, cinematic vignette. Runs before tone mapping. */
const GRADE = {
  uniforms: {
    tDiffuse: { value: null },
    uLift: { value: new Vector3(0.006, 0.012, 0.045) },
    uVignette: { value: 0.5 },
    uContrast: { value: 1.08 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse; uniform vec3 uLift; uniform float uVignette; uniform float uContrast;
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tDiffuse, vUv);
      float lum = dot(c.rgb, vec3(0.2126, 0.7152, 0.0722));
      c.rgb += uLift * (1.0 - smoothstep(0.0, 0.35, lum));
      c.rgb = (c.rgb - 0.5 * 0.18) * uContrast + 0.5 * 0.18;
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - uVignette * smoothstep(0.35, 0.95, d);
      gl_FragColor = c;
    }`,
};

/**
 * Cinematic pipeline: full-resolution MSAA render → bloom on emissives → grade/vignette → ACES + sRGB output.
 * Shadows: PCF soft shadow map from the moon.
 */
export class Renderer {
  readonly gl: WebGLRenderer;
  private readonly composer: EffectComposer;
  private readonly renderPass: RenderPass;
  private readonly bloom: UnrealBloomPass;
  private width = 1;
  private height = 1;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.gl.toneMapping = ACESFilmicToneMapping;
    this.gl.toneMappingExposure = 0.95;
    this.gl.shadowMap.enabled = true;
    this.gl.shadowMap.type = PCFSoftShadowMap;
    this.gl.setClearColor(PALETTE.fog, 1);
    const target = new WebGLRenderTarget(1, 1, { samples: 4, type: HalfFloatType });
    this.composer = new EffectComposer(this.gl, target);
    this.renderPass = new RenderPass(new Scene(), new Camera());
    this.bloom = new UnrealBloomPass(new Vector2(1, 1), 0.55, 0.65, 0.8);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new ShaderPass(GRADE));
    this.composer.addPass(new OutputPass());
    this.resize(window.innerWidth, window.innerHeight);
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.gl.setSize(width, height, false);
    this.composer.setSize(width, height);
    this.bloom.setSize(width, height);
  }

  get aspect(): number {
    return this.width / this.height;
  }

  render(scene: Scene, camera: Camera): void {
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    WIND.value = performance.now() / 1000;
    this.composer.render();
  }
}

import {
  Camera, Mesh, NearestFilter, OrthographicCamera, PlaneGeometry, Scene, ShaderMaterial,
  Vector2, WebGLRenderer, WebGLRenderTarget,
} from 'three';
import { PALETTE } from './palette';
import { SNAP } from './PS1Material';

const BASE_W = 480;
const BASE_H = 270;

const DITHER_FRAG = /* glsl */ `
uniform sampler2D tDiffuse;
uniform vec2 uLowRes;
varying vec2 vUv;
const float bayer[16] = float[16](0.,8.,2.,10., 12.,4.,14.,6., 3.,11.,1.,9., 15.,7.,13.,5.);
void main() {
  gl_FragColor = texture2D(tDiffuse, vUv);
  #include <colorspace_fragment>
  vec3 c = gl_FragColor.rgb;
  ivec2 p = ivec2(mod(floor(vUv * uLowRes), 4.0));
  float t = (bayer[p.y * 4 + p.x] + 0.5) / 16.0 - 0.5;
  float levels = 32.0;
  c = floor(c * levels + t) / levels;
  gl_FragColor = vec4(c, 1.0);
}`;

const BLIT_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

/**
 * Scene → low-res render target (≈480×270, nearest) → Bayer dither + 32-level quantise → canvas.
 * See .claude/skills/ginseng-impact-design/references/rendering.md.
 */
export class Renderer {
  readonly gl: WebGLRenderer;
  readonly lowRes = new Vector2(BASE_W, BASE_H);
  private readonly target: WebGLRenderTarget;
  private readonly blitScene = new Scene();
  private readonly blitCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly blitMat: ShaderMaterial;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.gl = new WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.gl.setPixelRatio(1);
    this.gl.setClearColor(PALETTE.fog, 1);
    this.target = new WebGLRenderTarget(BASE_W, BASE_H, {
      minFilter: NearestFilter, magFilter: NearestFilter, generateMipmaps: false, depthBuffer: true,
    });
    this.blitMat = new ShaderMaterial({
      uniforms: { tDiffuse: { value: this.target.texture }, uLowRes: { value: this.lowRes } },
      vertexShader: BLIT_VERT,
      fragmentShader: DITHER_FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.blitScene.add(new Mesh(new PlaneGeometry(2, 2), this.blitMat));
    this.resize(window.innerWidth, window.innerHeight);
  }

  /** Keeps ~480 px of width on landscape and ~270 px of height on portrait screens. */
  resize(width: number, height: number): void {
    this.gl.setSize(width, height, false);
    const aspect = width / height;
    const w = aspect >= 16 / 9 ? BASE_W : Math.max(320, Math.round(BASE_H * aspect));
    const h = Math.round(w / aspect);
    this.lowRes.set(w, h);
    SNAP.set(w / 2, h / 2);
    this.target.setSize(w, h);
  }

  get aspect(): number {
    return this.lowRes.x / this.lowRes.y;
  }

  render(scene: Scene, camera: Camera): void {
    this.gl.setRenderTarget(this.target);
    this.gl.clear();
    this.gl.render(scene, camera);
    this.gl.setRenderTarget(null);
    this.gl.render(this.blitScene, this.blitCamera);
  }
}

import { AdditiveBlending, Group, IcosahedronGeometry, Mesh, ShaderMaterial, type Sprite } from 'three';
import { glowSprite } from './Glow';
import { WIND } from './Materials';

/**
 * A bubble of lean that has come alive (the mobs in the kingdom's cups): a wobbling sphere of glossy purple, its
 * colours swirling, a bright rim where it curves away and a highlight on top. It squashes when it lands and
 * stretches as it leaps, flashes white when hit and pops when it dies. `group` sits on the ground at its feet.
 */
export class LeanBubble {
  readonly group = new Group();
  private readonly body: Mesh;
  private readonly mat: ShaderMaterial;
  private readonly shine: Sprite;
  private pop = -1;

  constructor(private readonly r: number) {
    this.mat = new ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: { uTime: WIND, uFlash: { value: 0 }, uFade: { value: 1 } },
      vertexShader: /* glsl */ `
        uniform float uTime; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          vec3 p = position;
          // The skin ripples as it moves.
          p += normal * (sin(p.y * 7.0 + uTime * 5.0) * 0.03 + sin(p.x * 9.0 - uTime * 4.0) * 0.02);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vP = p;
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime; uniform float uFlash; uniform float uFade; varying vec3 vN; varying vec3 vV; varying vec3 vP;
        void main() {
          float fres = pow(1.0 - max(dot(vN, vV), 0.0), 2.2);
          float swirl = 0.5 + 0.5 * sin(atan(vP.z, vP.x) * 3.0 + vP.y * 6.0 + uTime * 2.0);
          // Thick purple syrup, not a soap film: mostly opaque, brighter where the swirl catches the light.
          vec3 c = mix(vec3(0.3, 0.04, 0.62), vec3(0.85, 0.4, 1.0), swirl * 0.6 + fres * 0.4);
          c += vec3(0.95, 0.8, 1.0) * fres * 1.1 + vec3(0.5, 0.15, 0.8) * pow(swirl, 6.0) * 0.6;
          c = mix(c, vec3(1.0), uFlash);
          gl_FragColor = vec4(c, (0.84 + fres * 0.16) * uFade);
        }`,
    });
    this.body = new Mesh(new IcosahedronGeometry(r, 3), this.mat);
    this.body.position.y = r;
    this.shine = glowSprite(0xf2e6ff, r * 0.7, 0.85, true);
    this.shine.position.set(-r * 0.35, r * 1.55, r * 0.3);
    const glow = glowSprite(0x9b3dff, r * 3.2, 0.3, true);
    glow.position.y = r;
    glow.material.blending = AdditiveBlending;
    this.group.add(this.body, this.shine, glow);
  }

  /** `lift` metres off the ground (a hop), `squash` −1 (flattened on landing) … 1 (stretched in a leap), `flash` 0..1. */
  update(dt: number, lift: number, squash: number, flash: number): void {
    this.mat.uniforms.uFlash.value = flash;
    if (this.pop >= 0) {
      // Popped: it swells and is gone in a quarter of a second.
      this.pop += dt;
      const k = Math.min(1, this.pop / 0.25);
      this.body.scale.setScalar(1 + k * 0.6);
      this.mat.uniforms.uFade.value = 1 - k;
      this.shine.visible = false;
      this.group.visible = k < 1;
      return;
    }
    const sy = 1 + squash * 0.35;
    const sxz = 1 - squash * 0.18;
    this.body.scale.set(sxz, sy, sxz);
    this.body.position.y = this.r * sy + lift;
    this.shine.position.y = this.r * 1.55 * sy + lift;
  }

  /** Pops (death). */
  burst(): void {
    if (this.pop < 0) this.pop = 0;
  }

  /** Whole again (respawn). */
  reset(): void {
    this.pop = -1;
    this.group.visible = true;
    this.shine.visible = true;
    this.body.scale.setScalar(1);
    this.mat.uniforms.uFade.value = 1;
  }
}

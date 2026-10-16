/**
 * Giant eyes hanging in the sky (the user's request, and the reels' watching eyes): each blinks on its own clock,
 * follows the hero, and now and then changes mood (the pupil dilates, burns red, the lids squint or fly wide). Shot,
 * an eye flinches and slams shut, then glares: bloodshot, red-irised, lids narrowed, for a while. Drawn entirely in a
 * shader on a camera-facing quad, so there is no model to load and dozens cost one draw each.
 */
import { AdditiveBlending, Color, Group, Mesh, PlaneGeometry, ShaderMaterial, Vector2, Vector3 } from 'three';
import { glowSprite } from './Glow';

const VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv * 2.0 - 1.0; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const FRAG = /* glsl */ `
uniform vec2 uLook; uniform float uOpen; uniform float uSquint; uniform float uDilate; uniform float uRed; uniform float uAnger;
uniform float uHurt; uniform vec3 uIris; uniform float uTime; uniform float uFade;
varying vec2 vUv;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) { vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
void main() {
  vec2 p = vUv;
  // The almond opening between the lids; anger slants the upper lid down toward the nose side (x > 0 here).
  float halfH = sqrt(max(0.0, 1.0 - p.x * p.x));
  float top = halfH * (0.62 * uOpen - uSquint * 0.3) - uAnger * 0.22 * (0.5 + p.x * 0.5);
  float bot = -halfH * (0.5 * uOpen - uSquint * 0.15);
  float inLid = smoothstep(top + 0.02, top - 0.02, p.y) * smoothstep(bot - 0.02, bot + 0.02, p.y);
  // The eyeball: a lit sphere, its white turning to red veins with anger and pain.
  float r = length(p);
  vec3 sclera = vec3(0.5, 0.52, 0.6) * (1.0 - r * r * 0.5);
  float veinN = vnoise(p * 9.0 + 3.0) * 0.6 + vnoise(p * 23.0) * 0.4;
  float veins = smoothstep(0.62, 0.7, veinN) * smoothstep(0.25, 0.95, r);
  sclera = mix(sclera, vec3(0.75, 0.05, 0.05), veins * (0.35 + uAnger * 0.65 + uHurt * 0.5));
  sclera = mix(sclera, vec3(0.9, 0.35, 0.35), uAnger * 0.25 * smoothstep(0.3, 1.0, r));
  // Iris and pupil, looking toward the hero.
  vec2 c = p - uLook * 0.32;
  float ir = length(c);
  float pr = 0.13 * uDilate;
  float fib = vnoise(vec2(atan(c.y, c.x) * 7.0, ir * 14.0)) * 0.5 + 0.5;
  vec3 iris = mix(uIris, vec3(1.0, 0.1, 0.05), max(uRed, uAnger * 0.8)) * (0.45 + fib * 0.6);
  iris *= 1.0 + smoothstep(0.34, 0.1, ir) * 0.5;
  float irisMask = smoothstep(0.36, 0.33, ir);
  vec3 col = mix(sclera, iris, irisMask);
  float pupil = smoothstep(pr + 0.015, pr - 0.015, ir);
  col = mix(col, vec3(0.0) + vec3(0.6, 0.0, 0.0) * uRed * (0.6 + 0.4 * sin(uTime * 6.0)), pupil);
  // A wet highlight from the moon.
  col += vec3(1.0) * smoothstep(0.06, 0.0, length(p - vec2(-0.16, 0.18))) * 0.7;
  // The skin around the opening: dark, bruised blue, a lash line along the lids.
  vec3 skin = vec3(0.05, 0.06, 0.16) * (0.7 + vnoise(p * 6.0) * 0.5);
  float lash = smoothstep(0.05, 0.0, abs(p.y - top)) * step(abs(p.x), 0.98);
  col = mix(skin, col, inLid);
  col = mix(col, vec3(0.0), lash * 0.8);
  col = mix(col, vec3(1.0, 0.2, 0.2), uHurt * 0.35);
  // Fade at the quad's edge into the sky.
  float alpha = (1.0 - smoothstep(0.82, 1.0, length(p * vec2(0.92, 1.25)))) * uFade;
  gl_FragColor = vec4(col, alpha);
}`;

type Mood = 'calm' | 'dilate' | 'red' | 'squint' | 'wide';

/** Scratch vectors for the per-frame gaze (no allocations in update). */
const T1 = new Vector3();
const T2 = new Vector3();
const T3 = new Vector3();
const T4 = new Vector3();

interface Eye {
  mesh: Mesh;
  mat: ShaderMaterial;
  glow: ReturnType<typeof glowSprite>;
  home: Vector3;
  size: number;
  look: Vector3;
  wander: Vector3 | null;
  nextBlink: number;
  blink: number;
  mood: Mood;
  moodLeft: number;
  anger: number;
  hurt: number;
  phase: number;
}

const IRIS = [new Color(0.2, 0.55, 1.4), new Color(0.9, 0.75, 0.15), new Color(0.35, 1.0, 0.45), new Color(0.7, 0.3, 1.2)];

/** A set of sky eyes at the given spots (world position and size in metres). */
export class SkyEyes {
  readonly group = new Group();
  private readonly eyes: Eye[] = [];
  private t = 0;
  /** Called when every eye of the set has been shot at least once (the reward). */
  onAllHurt?: () => void;
  private readonly everHurt = new Set<number>();
  /** The prize is paid once. */
  private rewarded = false;

  constructor(spots: ReadonlyArray<{ x: number; y: number; z: number; size: number }>) {
    spots.forEach((s, i) => {
      const mat = new ShaderMaterial({
        uniforms: {
          uLook: { value: new Vector2() }, uOpen: { value: 1 }, uSquint: { value: 0 }, uDilate: { value: 1 }, uRed: { value: 0 },
          uAnger: { value: 0 }, uHurt: { value: 0 }, uIris: { value: IRIS[i % IRIS.length] }, uTime: { value: 0 }, uFade: { value: 1 },
        },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: false,
      });
      const mesh = new Mesh(new PlaneGeometry(s.size, s.size * 0.8), mat);
      mesh.position.set(s.x, s.y, s.z);
      mesh.renderOrder = -6;
      const glow = glowSprite(0x4f7cff, s.size * 1.6, 0.1, false);
      (glow.material as { blending: number }).blending = AdditiveBlending;
      glow.position.copy(mesh.position);
      this.group.add(glow, mesh);
      this.eyes.push({
        mesh, mat, glow, home: mesh.position.clone(), size: s.size, look: new Vector3(), wander: null,
        nextBlink: 2 + Math.random() * 5, blink: 0, mood: 'calm', moodLeft: 6 + Math.random() * 10, anger: 0, hurt: 0, phase: Math.random() * 10,
      });
    });
  }

  /** Shootable spots for CombatSystem.targets (each eye, its radius). */
  targets(): Array<{ pos: Vector3; radius: number; active(): boolean; onHit(at: Vector3): void; aim: boolean }> {
    return this.eyes.map((e, i) => ({
      pos: e.mesh.position, radius: e.size * 0.45, aim: true,
      active: () => this.group.visible && e.hurt <= 0,
      onHit: () => this.hurt(i),
    }));
  }

  /** Shot: it flinches and slams shut, then glares, bloodshot and red-irised, for a while. */
  hurt(i: number): void {
    const e = this.eyes[i];
    e.hurt = 0.6;
    e.anger = 1;
    e.blink = 0;
    this.everHurt.add(i);
    if (!this.rewarded && this.everHurt.size === this.eyes.length) { this.rewarded = true; this.onAllHurt?.(); }
  }

  update(dt: number, camera: Vector3, hero: Vector3): void {
    this.t += dt;
    for (const e of this.eyes) {
      const u = e.mat.uniforms;
      // Float a little, face the camera.
      e.mesh.position.set(e.home.x, e.home.y + Math.sin(this.t * 0.4 + e.phase) * 0.8, e.home.z);
      e.glow.position.copy(e.mesh.position);
      e.mesh.lookAt(camera);
      // Gaze: the hero, or now and then something else for a moment (then it snaps back to you).
      if (!e.wander && Math.random() < dt * 0.04) e.wander = hero.clone().add(new Vector3((Math.random() - 0.5) * 80, (Math.random() - 0.3) * 30, (Math.random() - 0.5) * 80));
      if (e.wander && Math.random() < dt * 0.5) e.wander = null;
      const want = e.wander ?? hero;
      e.look.lerp(want, Math.min(1, dt * (e.anger > 0.2 ? 6 : 2.5)));
      // The look in the eye's own frame: the direction to the target against the direction to the camera.
      const toTarget = T1.copy(e.look).sub(e.mesh.position).normalize();
      const toCam = T2.copy(camera).sub(e.mesh.position).normalize();
      const right = T3.set(0, 1, 0).cross(toCam).normalize();
      const upv = T4.copy(toCam).cross(right);
      const lx = Math.max(-1, Math.min(1, toTarget.dot(right) * -3));
      const ly = Math.max(-1, Math.min(1, toTarget.dot(upv) * 3));
      (u.uLook.value as Vector2).set(lx, ly);
      // Blinks.
      e.nextBlink -= dt;
      if (e.nextBlink <= 0) { e.blink = 0.22; e.nextBlink = 2.5 + Math.random() * 6; }
      e.blink = Math.max(0, e.blink - dt);
      // Moods come and go.
      e.moodLeft -= dt;
      if (e.moodLeft <= 0) {
        const moods: Mood[] = ['calm', 'calm', 'dilate', 'red', 'squint', 'wide'];
        e.mood = moods[Math.floor(Math.random() * moods.length)];
        e.moodLeft = e.mood === 'calm' ? 8 + Math.random() * 12 : 3 + Math.random() * 4;
      }
      e.hurt = Math.max(0, e.hurt - dt);
      e.anger = Math.max(0, e.anger - dt / 9);
      const blinkShut = e.blink > 0 ? Math.sin((e.blink / 0.22) * Math.PI) : 0;
      const hurtShut = e.hurt > 0 ? 1 : 0;
      const k = Math.min(1, dt * 8);
      const open = e.mood === 'wide' ? 1.25 : 1;
      u.uOpen.value += ((1 - Math.max(blinkShut, hurtShut)) * open - u.uOpen.value) * (hurtShut ? 1 : k);
      u.uSquint.value += ((e.mood === 'squint' ? 0.8 : 0) + e.anger * 0.4 - u.uSquint.value) * k;
      u.uDilate.value += ((e.mood === 'dilate' ? 2.3 : e.mood === 'wide' ? 0.6 : 1) * (1 - e.anger * 0.35) - u.uDilate.value) * k;
      u.uRed.value += ((e.mood === 'red' ? 1 : 0) - u.uRed.value) * k;
      u.uAnger.value = e.anger;
      u.uHurt.value = e.hurt > 0 ? e.hurt / 0.6 : 0;
      u.uTime.value = this.t;
      // A flinch: squashed for a beat when hit.
      const flinch = e.hurt > 0 ? 1 - Math.sin((e.hurt / 0.6) * Math.PI) * 0.25 : 1;
      e.mesh.scale.set(1 / flinch, flinch, 1);
      (e.glow.material as { color: Color }).color.setRGB(0.3 + e.anger * 0.7, 0.45 - e.anger * 0.35, 1 - e.anger * 0.8);
    }
  }
}

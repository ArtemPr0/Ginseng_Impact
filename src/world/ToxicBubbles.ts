/**
 * Bubbles that swell on poison water and pop (the playtest of 2026-11-14: the witch stream "looks like a 2D plane ...
 * make it look poisonous, add some popping bubbles"): glossy green domes rising out of the surface, a splash ring and a
 * spray of droplets where each one bursts, then a rest before the next one comes up in the same spot.
 */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, Color, DoubleSide, DynamicDrawUsage, Float32BufferAttribute, Group,
  InstancedMesh, MeshBasicMaterial, MeshStandardMaterial, Object3D, Points, PointsMaterial, RingGeometry, SphereGeometry,
} from 'three';
import { glowTexture } from '../render/Glow';

/** One bubble's life: it swells for `life` seconds (a little wobble on top), pops, and lies flat for `rest`. */
export class BubbleCycle {
  /** 0..1 of its full size (0 while resting). */
  scale = 0;
  private t: number;

  /** `phase` 0..1 starts it that far into its cycle (so a field of them pops out of step). */
  constructor(private readonly life: number, private readonly rest: number, phase: number) {
    this.t = phase * (life + rest);
  }

  /** Advances it; 'pop' on the step it bursts. */
  step(dt: number): 'none' | 'pop' {
    const before = this.t;
    this.t = (this.t + dt) % (this.life + this.rest);
    const wrapped = this.t < before;
    const popped = (before < this.life && (this.t >= this.life || wrapped));
    if (this.t >= this.life) { this.scale = 0; return popped ? 'pop' : 'none'; }
    const k = this.t / this.life;
    // Eased swell, a wobble that grows with it (never more than it has grown in the last tenth of a second).
    this.scale = Math.min(1, Math.sqrt(k) * (1 + 0.04 * Math.sin(this.t * 25) * k));
    return popped ? 'pop' : 'none';
  }
}

const DROPS_PER_POP = 7;
const RING_SECONDS = 0.45;
const DROP_SECONDS = 0.6;

/** Where a bubble comes up: on the water at (x, y, z), `r` metres across at full size. */
export interface BubbleSpot { x: number; y: number; z: number; r: number }

/**
 * A field of popping bubbles at fixed spots on a water surface. `update(dt)` swells and pops them; call it only while
 * someone is near (it writes every instance each frame). `pop` is told where each one burst (a sound, if wanted).
 */
export function toxicBubbles(spots: BubbleSpot[], color: number, pop?: (x: number, y: number, z: number) => void): { group: Group; update(dt: number): void } {
  const group = new Group();
  const n = spots.length;
  const domeMat = new MeshStandardMaterial({ color, emissive: new Color(color).multiplyScalar(0.55), roughness: 0.12, metalness: 0, transparent: true, opacity: 0.78 });
  const domes = new InstancedMesh(new SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), domeMat, n);
  domes.instanceMatrix.setUsage(DynamicDrawUsage);
  domes.frustumCulled = false;
  const ringGeo = new RingGeometry(0.7, 1, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = new InstancedMesh(ringGeo, new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }), n);
  rings.instanceMatrix.setUsage(DynamicDrawUsage);
  rings.frustumCulled = false;
  rings.setColorAt(0, new Color(color));
  const drops = new BufferGeometry();
  drops.setAttribute('position', new Float32BufferAttribute(new Array(n * DROPS_PER_POP * 3).fill(-1e4), 3));
  const dropAttr = drops.attributes.position as BufferAttribute;
  dropAttr.setUsage(DynamicDrawUsage);
  const spray = new Points(drops, new PointsMaterial({ map: glowTexture(), color, size: 0.16, transparent: true, opacity: 0.95, blending: AdditiveBlending, depthWrite: false }));
  spray.frustumCulled = false;
  group.add(domes, rings, spray);

  const cycles = spots.map((_, i) => new BubbleCycle(1.4 + ((i * 0.37) % 1.3), 0.4 + ((i * 0.53) % 1.1), (i * 0.618) % 1));
  const ringAge = new Array(n).fill(RING_SECONDS);
  const dropAge = new Array(n).fill(DROP_SECONDS);
  const vel = new Float32Array(n * DROPS_PER_POP * 3);
  const o = new Object3D();
  const tint = new Color(color);
  const c = new Color();
  return {
    group,
    update(dt) {
      for (let i = 0; i < n; i++) {
        const s = spots[i];
        if (cycles[i].step(dt) === 'pop') {
          ringAge[i] = 0;
          dropAge[i] = 0;
          for (let k = 0; k < DROPS_PER_POP; k++) {
            const j = (i * DROPS_PER_POP + k) * 3;
            const a = (k / DROPS_PER_POP) * Math.PI * 2 + i;
            const out = 0.8 + ((k * 0.41 + i * 0.13) % 0.7);
            vel[j] = Math.cos(a) * out; vel[j + 1] = 2.2 + ((k * 0.29) % 0.9); vel[j + 2] = Math.sin(a) * out;
            dropAttr.setXYZ(i * DROPS_PER_POP + k, s.x, s.y + s.r * 0.3, s.z);
          }
          pop?.(s.x, s.y, s.z);
        }
        const k = cycles[i].scale;
        o.position.set(s.x, s.y - 0.02, s.z);
        o.scale.set(s.r * k, s.r * k * 0.8, s.r * k);
        o.updateMatrix();
        domes.setMatrixAt(i, o.matrix);
        // The splash ring spreads and fades.
        ringAge[i] += dt;
        const rk = Math.min(1, ringAge[i] / RING_SECONDS);
        o.position.set(s.x, s.y + 0.02, s.z);
        o.scale.setScalar(rk < 1 ? s.r * (1 + rk * 2.2) : 0);
        o.updateMatrix();
        rings.setMatrixAt(i, o.matrix);
        rings.setColorAt(i, c.copy(tint).multiplyScalar(1 - rk));
        // The droplets fly up and fall back.
        if (dropAge[i] < DROP_SECONDS) {
          dropAge[i] += dt;
          for (let q = 0; q < DROPS_PER_POP; q++) {
            const v = i * DROPS_PER_POP + q;
            const j = v * 3;
            vel[j + 1] -= 9.8 * dt;
            if (dropAge[i] >= DROP_SECONDS) { dropAttr.setXYZ(v, 0, -1e4, 0); continue; }
            dropAttr.setXYZ(v, dropAttr.getX(v) + vel[j] * dt, dropAttr.getY(v) + vel[j + 1] * dt, dropAttr.getZ(v) + vel[j + 2] * dt);
          }
        }
      }
      domes.instanceMatrix.needsUpdate = true;
      rings.instanceMatrix.needsUpdate = true;
      if (rings.instanceColor) rings.instanceColor.needsUpdate = true;
      dropAttr.needsUpdate = true;
    },
  };
}

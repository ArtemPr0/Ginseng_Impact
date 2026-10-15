import { CanvasTexture, Group, Mesh, MeshBasicMaterial, Object3D, Sprite, SpriteMaterial, TorusGeometry, Vector3 } from 'three';

let puffTex: CanvasTexture | undefined;
/** A soft, lumpy smoke puff (a few overlapping blobs), so the wisp reads as smoke rather than glowing dots. */
function puffTexture(): CanvasTexture {
  if (puffTex) return puffTex;
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const blob = (x: number, y: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${a})`);
    g.addColorStop(0.55, `rgba(255,255,255,${a * 0.45})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  };
  blob(32, 32, 26, 0.55);
  blob(22, 26, 14, 0.4);
  blob(41, 24, 13, 0.35);
  blob(36, 41, 15, 0.35);
  blob(24, 40, 11, 0.3);
  puffTex = new CanvasTexture(canvas);
  return puffTex;
}

const RING_GEO = new TorusGeometry(1, 0.3, 6, 22);
const _p = new Vector3();

/**
 * Pipe smoke: a thin wisp that curls up from the bowl, and now and then a smoke ring that rises, widens and thins
 * out. `emitter` goes on the pipe's bowl (it moves with the body); `particles` goes in world space (the scene), so
 * the smoke stays where it was puffed and trails behind a walking smoker.
 */
export class PipeSmoke {
  readonly emitter = new Object3D();
  readonly particles = new Group();
  private readonly puffs: Array<{ sprite: Sprite; age: number; life: number; vel: Vector3; spin: number; size: number }> = [];
  private readonly rings: Array<{ mesh: Mesh; age: number; life: number; vel: Vector3; size: number }> = [];
  private puffIn = 0;
  private ringIn = 1.5;
  private t = Math.random() * 10;

  constructor(color = 0xc9d2f2) {
    this.particles.frustumCulled = false;
    for (let i = 0; i < 26; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: puffTexture(), color, transparent: true, opacity: 0, depthWrite: false }));
      sprite.visible = false;
      this.particles.add(sprite);
      this.puffs.push({ sprite, age: 0, life: 1, vel: new Vector3(), spin: 0, size: 0.03 });
    }
    for (let i = 0; i < 3; i++) {
      const mesh = new Mesh(RING_GEO, new MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false }));
      mesh.visible = false;
      this.particles.add(mesh);
      this.rings.push({ mesh, age: 0, life: 1, vel: new Vector3(), size: 0.03 });
    }
  }

  update(dt: number, moving = false): void {
    this.t += dt;
    this.emitter.updateWorldMatrix(true, false);
    this.emitter.getWorldPosition(_p);
    // The wisp: a puff every ~0.15 s (thinner while walking), each rising and curling as it spreads.
    this.puffIn -= dt;
    if (this.puffIn <= 0) {
      this.puffIn = (moving ? 0.22 : 0.13) + Math.random() * 0.08;
      const p = this.puffs.find((x) => !x.sprite.visible);
      if (p) {
        p.age = 0;
        p.life = 2.2 + Math.random() * 1.2;
        p.vel.set((Math.random() - 0.5) * 0.04, 0.22 + Math.random() * 0.08, (Math.random() - 0.5) * 0.04);
        p.spin = (Math.random() - 0.5) * 1.2;
        p.size = 0.025 + Math.random() * 0.015;
        p.sprite.position.copy(_p);
        p.sprite.material.rotation = Math.random() * 6.28;
        p.sprite.visible = true;
      }
    }
    for (const p of this.puffs) {
      if (!p.sprite.visible) continue;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) { p.sprite.visible = false; continue; }
      // Rising slows as the smoke cools; a slow curl sideways and a little breeze.
      const curl = Math.sin(this.t * 1.3 + p.life * 7 + p.age * 2.2) * 0.07;
      p.sprite.position.x += (p.vel.x + curl + 0.02) * dt;
      p.sprite.position.z += (p.vel.z + Math.cos(this.t * 1.1 + p.life * 5 + p.age * 1.8) * 0.05) * dt;
      p.sprite.position.y += p.vel.y * (1 - k * 0.6) * dt;
      p.sprite.material.rotation += p.spin * dt;
      const s = p.size + k * 0.24;
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.opacity = 0.3 * Math.min(1, k * 6) * (1 - k) * (1 - k);
    }
    // A smoke ring every few seconds (not while walking): lifts off the bowl, widens, wobbles and thins away.
    this.ringIn -= dt;
    if (this.ringIn <= 0) {
      this.ringIn = 3.2 + Math.random() * 2.6;
      const r = moving ? undefined : this.rings.find((x) => !x.mesh.visible);
      if (r) {
        r.age = 0;
        r.life = 2.2 + Math.random() * 0.6;
        r.size = 0.028 + Math.random() * 0.01;
        // Slow enough to thin away around face height, never a halo over the hat.
        r.vel.set((Math.random() - 0.5) * 0.05, 0.17 + Math.random() * 0.05, (Math.random() - 0.5) * 0.05);
        r.mesh.position.copy(_p).y += 0.03;
        r.mesh.rotation.set(Math.PI / 2 + (Math.random() - 0.5) * 0.5, 0, (Math.random() - 0.5) * 0.5);
        r.mesh.visible = true;
      }
    }
    for (const r of this.rings) {
      if (!r.mesh.visible) continue;
      r.age += dt;
      const k = r.age / r.life;
      if (k >= 1) { r.mesh.visible = false; continue; }
      r.mesh.position.addScaledVector(r.vel, dt * (1 - k * 0.7));
      r.mesh.position.x += 0.02 * dt;
      r.mesh.rotation.x += Math.sin(this.t * 2 + r.life) * 0.25 * dt;
      const s = r.size + k * 0.13;
      // The tube thins as the ring widens.
      r.mesh.scale.set(s, s, s * (1 - k * 0.55));
      (r.mesh.material as MeshBasicMaterial).opacity = 0.36 * Math.min(1, k * 8) * (1 - k) * (1 - k);
    }
  }
}

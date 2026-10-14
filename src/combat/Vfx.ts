import {
  AdditiveBlending, BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Points,
  PointsMaterial, RingGeometry, Sprite, Vector3,
} from 'three';
import { glowSprite, glowTexture } from '../render/Glow';

interface Item { obj: Group | Mesh | Points | Sprite; life: number; max: number; tick: (t: number, dt: number) => void; done?: () => void }

/** Low-poly, additive, short-lived effects. Everything here is throwaway and removed when its life ends. */
export class Vfx {
  readonly group = new Group();
  private readonly items: Item[] = [];

  private add(item: Item): void {
    this.items.push(item);
    this.group.add(item.obj);
  }

  /** Flat slash arc in front of the attacker. */
  slash(pos: Vector3, yaw: number, color: number, radius: number, halfAngle: number): void {
    const geo = new RingGeometry(radius * 0.45, radius, 10, 1, -halfAngle, halfAngle * 2);
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.85, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 1.1, pos.z);
    // RingGeometry lies in XY; lay it flat and rotate so theta=0 points along +x then apply yaw.
    mesh.rotation.set(-Math.PI / 2, 0, 0);
    mesh.rotateZ(-yaw);
    this.add({ obj: mesh, life: 0, max: 0.18, tick: (t) => { mat.opacity = 0.85 * (1 - t); mesh.scale.setScalar(0.7 + t * 0.5); } });
  }

  /** Particle burst of a few bright points. */
  burst(pos: Vector3, color: number, count = 12, speed = 5, size = 0.38): void {
    const positions = new Float32Array(count * 3);
    const vels: number[] = [];
    for (let i = 0; i < count; i++) {
      positions[i * 3] = pos.x;
      positions[i * 3 + 1] = pos.y;
      positions[i * 3 + 2] = pos.z;
      const a = Math.random() * Math.PI * 2;
      const u = Math.random() * 0.8 + 0.2;
      vels.push(Math.cos(a) * speed * u, speed * (0.6 + Math.random() * 0.8), Math.sin(a) * speed * u);
    }
    const geo = new BufferGeometry();
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
    const mat = new PointsMaterial({ map: glowTexture(), color, size, transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false });
    const pts = new Points(geo, mat);
    pts.frustumCulled = false;
    const attr = geo.attributes.position as Float32BufferAttribute;
    this.add({
      obj: pts, life: 0, max: 0.5,
      tick: (t, dt) => {
        for (let i = 0; i < count; i++) {
          vels[i * 3 + 1] -= 14 * dt;
          attr.setXYZ(i, attr.getX(i) + vels[i * 3] * dt, attr.getY(i) + vels[i * 3 + 1] * dt, attr.getZ(i) + vels[i * 3 + 2] * dt);
        }
        attr.needsUpdate = true;
        mat.opacity = 1 - t;
      },
    });
  }

  /** Expanding glow at an impact point. */
  impact(pos: Vector3, color: number, scale = 2.2): void {
    const s = glowSprite(color, scale * 0.4, 0.9, true);
    s.position.copy(pos);
    this.add({ obj: s, life: 0, max: 0.22, tick: (t) => { s.scale.setScalar(scale * (0.4 + t)); (s.material).opacity = 0.9 * (1 - t); } });
  }

  /** Expanding reaction ring on the ground. */
  shockwave(pos: Vector3, color: number, radius: number): void {
    const geo = new RingGeometry(0.6, 1, 20);
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false });
    const mesh = new Mesh(geo, mat);
    mesh.position.set(pos.x, pos.y + 0.15, pos.z);
    mesh.rotation.x = -Math.PI / 2;
    this.add({ obj: mesh, life: 0, max: 0.35, tick: (t) => { mesh.scale.setScalar(0.2 + t * radius); mat.opacity = 0.9 * (1 - t); } });
  }

  /** Persistent ground zone (frost ring, burning ground). Returns a remover. */
  zone(pos: Vector3, radius: number, color: number, duration: number): () => void {
    const geo = new RingGeometry(radius - 0.35, radius, 18);
    const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false });
    const ring = new Mesh(geo, mat);
    ring.position.set(pos.x, pos.y + 0.12, pos.z);
    ring.rotation.x = -Math.PI / 2;
    const inner = new Mesh(new RingGeometry(0.01, radius - 0.4, 18), new MeshBasicMaterial({ color, transparent: true, opacity: 0.05, blending: AdditiveBlending, side: DoubleSide, forceSinglePass: true, depthWrite: false }));
    inner.position.copy(ring.position);
    inner.rotation.x = -Math.PI / 2;
    const g = new Group();
    g.add(ring, inner);
    const item: Item = { obj: g, life: 0, max: duration, tick: (t) => { mat.opacity = 0.4 + Math.sin(t * duration * 9) * 0.15; if (t > 0.8) mat.opacity *= (1 - t) / 0.2; } };
    this.add(item);
    return () => { item.life = item.max; };
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life += dt;
      const t = Math.min(1, it.life / it.max);
      it.tick(t, dt);
      if (it.life >= it.max) {
        this.group.remove(it.obj);
        this.items.splice(i, 1);
      }
    }
  }
}

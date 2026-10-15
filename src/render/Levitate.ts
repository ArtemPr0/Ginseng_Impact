import { AdditiveBlending, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, type Sprite } from 'three';
import { glowSprite } from './Glow';

/**
 * Orlan's levitation: two thin rings of his colour turning under the hem and motes spiralling up around the robe.
 * Lives at the hero's feet (rig root); `update` fades it with the flight amount.
 */
export class Levitation {
  readonly group = new Group();
  private readonly rings: Mesh[] = [];
  private readonly motes: Array<{ sprite: Sprite; phase: number }> = [];
  private t = 0;

  constructor(color: number) {
    for (const [inner, outer] of [[0.3, 0.33], [0.42, 0.44]]) {
      const ring = new Mesh(new RingGeometry(inner, outer, 40), new MeshBasicMaterial({ color, transparent: true, opacity: 0, blending: AdditiveBlending, side: DoubleSide, depthWrite: false, toneMapped: false }));
      ring.rotation.x = -Math.PI / 2;
      this.group.add(ring);
      this.rings.push(ring);
    }
    for (let i = 0; i < 14; i++) {
      const sprite = glowSprite(color, 0.06, 0);
      this.group.add(sprite);
      this.motes.push({ sprite, phase: i / 14 });
    }
    this.group.visible = false;
  }

  update(dt: number, amount: number): void {
    this.t += dt;
    this.group.visible = amount > 0.02;
    if (!this.group.visible) return;
    this.rings.forEach((ring, i) => {
      ring.rotation.z += (i ? -0.9 : 1.4) * dt;
      ring.position.y = 0.04 + i * 0.05 + Math.sin(this.t * 2 + i) * 0.02;
      ring.scale.setScalar(1 + Math.sin(this.t * 3 + i * 2) * 0.06);
      (ring.material as MeshBasicMaterial).opacity = amount * (0.5 - i * 0.15);
    });
    for (const m of this.motes) {
      // Each mote climbs from the hem to the knees on a slow spiral, fading out as it rises.
      const k = (m.phase + this.t * 0.35) % 1;
      const a = m.phase * Math.PI * 2 + this.t * 2.4 + k * 3;
      const r = 0.36 - k * 0.12;
      m.sprite.position.set(Math.cos(a) * r, 0.05 + k * 0.85, Math.sin(a) * r);
      m.sprite.material.opacity = amount * 0.8 * Math.sin(k * Math.PI);
    }
  }
}

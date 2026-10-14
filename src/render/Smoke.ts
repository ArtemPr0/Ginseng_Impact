import { AdditiveBlending, Group, Sprite, SpriteMaterial, Vector3 } from 'three';
import { glowTexture } from '../world/Landmarks';

/** A lazy curl of pipe smoke: a few soft sprites that rise, drift and fade. */
export class PipeSmoke {
  readonly group = new Group();
  private readonly puffs: Array<{ sprite: Sprite; age: number; life: number; drift: Vector3 }> = [];
  private spawnIn = 0;

  constructor(private readonly color = 0xcfd8ff) {
    for (let i = 0; i < 9; i++) {
      const sprite = new Sprite(new SpriteMaterial({ map: glowTexture(), color: this.color, transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending }));
      sprite.visible = false;
      this.group.add(sprite);
      this.puffs.push({ sprite, age: 0, life: 1.8, drift: new Vector3() });
    }
  }

  update(dt: number, moving = false): void {
    this.spawnIn -= dt;
    if (this.spawnIn <= 0) {
      this.spawnIn = 0.28 + Math.random() * 0.25;
      const p = this.puffs.find((x) => !x.sprite.visible);
      if (p) {
        p.age = 0;
        p.life = 1.5 + Math.random() * 0.8;
        p.drift.set((Math.random() - 0.5) * 0.12, 0.42 + Math.random() * 0.2, (Math.random() - 0.5) * 0.12);
        if (moving) p.drift.x -= 0.5;
        p.sprite.position.set(0, 0, 0);
        p.sprite.visible = true;
      }
    }
    for (const p of this.puffs) {
      if (!p.sprite.visible) continue;
      p.age += dt;
      const t = p.age / p.life;
      if (t >= 1) { p.sprite.visible = false; continue; }
      p.sprite.position.addScaledVector(p.drift, dt);
      p.sprite.position.x += Math.sin(p.age * 3 + p.life) * 0.03 * dt;
      const size = 0.08 + t * 0.26;
      p.sprite.scale.set(size, size, 1);
      p.sprite.material.opacity = 0.55 * Math.sin(t * Math.PI);
    }
  }
}

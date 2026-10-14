import { BufferAttribute, Color, DoubleSide, InstancedMesh, Matrix4, Object3D, PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { patchWind, surface } from '../render/Materials';

const COUNT = 26000;
const RADIUS = 48;

/** Instanced grass blades that follow the player: tapered crossed quads, wind sway, dark base to electric tips. */
export class Grass {
  readonly mesh: InstancedMesh;
  private centre = { x: Infinity, z: Infinity };
  private readonly dummy = new Object3D();
  private readonly m = new Matrix4();
  private seed = 17;

  constructor(private readonly heightAt: (x: number, z: number) => number, private readonly plantable: (x: number, z: number) => boolean) {
    const blade = (rot: number) => {
      const g = new PlaneGeometry(0.07, 0.48, 1, 4).translate(0, 0.24, 0);
      const pos = g.attributes.position as BufferAttribute;
      const colors = new Float32Array(pos.count * 3);
      const base = new Color(0x0e1c34);
      const tip = new Color(0x4b66b8);
      const c = new Color();
      for (let i = 0; i < pos.count; i++) {
        const t = pos.getY(i) / 0.48;
        pos.setX(i, pos.getX(i) * (1 - t * 0.75));
        pos.setZ(i, pos.getZ(i) + t * t * 0.14); // curved blade
        c.copy(base).lerp(tip, t * t);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      g.setAttribute('color', new BufferAttribute(colors, 3));
      g.rotateY(rot);
      return g;
    };
    const geo = mergeGeometries([blade(0), blade(Math.PI / 2)], false)!;
    const mat = surface({ vertexColors: true, side: DoubleSide, roughness: 0.9 });
    patchWind(mat, 0.4);
    this.mesh = new InstancedMesh(geo, mat, COUNT);
    this.mesh.frustumCulled = false;
    this.mesh.receiveShadow = true;
  }

  private rnd(): number {
    this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0;
    return this.seed / 4294967296;
  }

  /** Rebuilds the patch when the player has moved far enough from the last centre. */
  update(px: number, pz: number): void {
    if (Math.hypot(px - this.centre.x, pz - this.centre.z) < 12) return;
    this.centre = { x: px, z: pz };
    this.seed = 17;
    let placed = 0;
    let guard = 0;
    while (placed < COUNT && guard++ < COUNT * 3) {
      const a = this.rnd() * Math.PI * 2;
      const r = Math.sqrt(this.rnd()) * RADIUS;
      const x = px + Math.cos(a) * r;
      const z = pz + Math.sin(a) * r;
      if (!this.plantable(x, z)) continue;
      this.dummy.position.set(x, this.heightAt(x, z) - 0.03, z);
      this.dummy.rotation.set((this.rnd() - 0.5) * 0.25, this.rnd() * Math.PI, (this.rnd() - 0.5) * 0.25);
      const sc = 0.75 + this.rnd() * 0.7;
      this.dummy.scale.set(sc, sc * (0.8 + this.rnd() * 0.5), sc);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(placed++, this.dummy.matrix);
    }
    for (let i = placed; i < COUNT; i++) {
      this.m.makeScale(0, 0, 0);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

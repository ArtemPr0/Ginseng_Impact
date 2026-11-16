/**
 * A broken building's pieces drawn in a few draw calls (v12, 2026-11-16: buildings now come apart into hundreds of
 * blocks, as in the godofprompt reel, which as separate meshes would cost a draw call each, twice with shadows). Every
 * piece keeps an invisible stand-in Object3D that the physics moves, turns, shrinks or hides exactly as before; once a
 * frame `update()` copies the stand-ins into one BatchedMesh per outside material and one for the inside (cut) faces.
 */
import { BatchedMesh, BufferAttribute, BufferGeometry, Group, Object3D, type Material } from 'three';

export interface BatchChunk {
  /** Non-indexed; group 0 = outside, group 1 = inside and cut faces. */
  geometry: BufferGeometry;
  material: Material;
}

/** The triangles of one group of a non-indexed geometry, as its own geometry. */
function part(g: BufferGeometry, group: number): BufferGeometry {
  const gr = g.groups[group];
  const out = new BufferGeometry();
  const start = gr ? gr.start : 0, count = gr ? gr.count : 0;
  for (const name of ['position', 'normal', 'uv']) {
    const a = g.attributes[name] as BufferAttribute | undefined;
    if (!a) continue;
    const s = a.itemSize;
    out.setAttribute(name, new BufferAttribute((a.array as Float32Array).slice(start * s, (start + count) * s), s));
  }
  return out;
}

export class ChunkBatch {
  readonly group = new Group();
  /** One per chunk, in order: move these (they are never drawn). */
  readonly proxies: Object3D[] = [];
  private readonly slots: Array<Array<{ mesh: BatchedMesh; id: number }>> = [];
  private readonly meshes: BatchedMesh[] = [];

  constructor(chunks: BatchChunk[], inside: Material, outerOf: (m: Material) => Material) {
    // Group the outsides by material; every inside goes in one batch.
    const byMat = new Map<Material, number[]>();
    chunks.forEach((c, i) => { const l = byMat.get(c.material); if (l) l.push(i); else byMat.set(c.material, [i]); });
    const parts = chunks.map((c) => [part(c.geometry, 0), part(c.geometry, 1)]);
    for (let i = 0; i < chunks.length; i++) { this.slots.push([]); const p = new Object3D(); p.name = 'chunk'; this.proxies.push(p); this.group.add(p); }
    const build = (list: number[], which: 0 | 1, mat: Material) => {
      const geos = list.map((i) => parts[i][which]).filter((g) => (g.attributes.position?.count ?? 0) > 0);
      if (!geos.length) return;
      const verts = geos.reduce((s, g) => s + g.attributes.position.count, 0);
      const mesh = new BatchedMesh(list.length, verts, 0, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      // (Pieces fly far from where the building stood: per-piece culling only.)
      mesh.frustumCulled = false;
      for (const i of list) {
        const g = parts[i][which];
        if (!g.attributes.position?.count) continue;
        const gid = mesh.addGeometry(g);
        const id = mesh.addInstance(gid);
        this.slots[i].push({ mesh, id });
      }
      this.meshes.push(mesh);
      this.group.add(mesh);
    };
    for (const [m, list] of byMat) build(list, 0, outerOf(m));
    build(chunks.map((_, i) => i), 1, inside);
    for (const p of parts) for (const g of p) g.dispose();
    this.update();
  }

  /** Copies every stand-in's place, turn, size and visibility into the batches. */
  update(): void {
    for (let i = 0; i < this.proxies.length; i++) {
      const p = this.proxies[i];
      const show = p.visible && p.scale.x > 1e-4;
      if (show) p.updateMatrix();
      for (const s of this.slots[i]) {
        if (s.mesh.getVisibleAt(s.id) !== show) s.mesh.setVisibleAt(s.id, show);
        if (show) s.mesh.setMatrixAt(s.id, p.matrix);
      }
    }
  }

  dispose(): void {
    for (const m of this.meshes) m.dispose();
    this.group.removeFromParent();
  }
}

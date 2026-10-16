/**
 * Flora and small decor: one Meshy model instanced over a set of placements. The scatter helpers in World
 * decide where things grow; this file only turns a loaded GLB into InstancedMeshes (one per mesh in the
 * file). A missing file leaves the set empty and warns once.
 */
import { type BufferGeometry, Group, InstancedMesh, Matrix4, Object3D, type MeshStandardMaterial } from 'three';
import { MODELS } from '../data/models';
import { firstMeshes, loadModelOrWarn, normaliseTransform } from '../models/ModelRig';
import { patchWind } from '../render/Materials';

/** Where one instance stands. `pitch` tilts it about its own x axis after the yaw (bridge planks on an arch). */
export interface Placement { x: number; y: number; z: number; yaw: number; scale: number; pitch?: number }

export interface FloraSet {
  group: Group;
  update(dt: number): void;
}

export interface FloraOptions {
  shadows?: boolean;
  /** Wind sway strength for the model's materials (grass/flowers), 0 = rigid. */
  wind?: number;
  /** Rewrites placements every frame (drifting leaves, bobbing islands); returns true when matrices changed. */
  update?: (t: number, placements: Placement[]) => boolean;
  /**
   * Restyles this set's material (glowing caps, white blooms). The set gets its own copy of the model's material,
   * so other sets of the same model keep the original.
   */
  patch?: (mat: MeshStandardMaterial, geo: BufferGeometry) => void;
}

const dummy = new Object3D();
const local = new Matrix4();
const scaleM = new Matrix4();

/** Instances are grouped into square cells this big, each its own InstancedMesh, so off-screen cells are skipped. */
const CELL = 48;
/** Models at least this tall cast shadows by default (trees, giant mushrooms); smaller flora does not. */
const SHADOW_HEIGHT = 4;

interface Chunk { meshes: InstancedMesh[]; items: Placement[] }

/** `bounds`: refit the culling sphere (once at placement; sets that move every frame are never culled instead). */
function writeMatrices(chunk: Chunk, scale: number, offset: { x: number; y: number; z: number }, yaw: number, bounds = true): void {
  local.makeTranslation(offset.x, offset.y, offset.z).multiply(scaleM.makeScale(scale, scale, scale));
  for (let i = 0; i < chunk.items.length; i++) {
    const p = chunk.items[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(p.pitch ?? 0, p.yaw + yaw, 0, 'YXZ');
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    dummy.matrix.multiply(local);
    for (const m of chunk.meshes) m.setMatrixAt(i, dummy.matrix);
  }
  for (const m of chunk.meshes) { m.instanceMatrix.needsUpdate = true; if (bounds) m.computeBoundingSphere(); }
}

/** Instances model `id` at every placement (placement scale multiplies the registry height). */
export function floraSet(id: string, placements: Placement[], opts: FloraOptions = {}): FloraSet {
  const group = new Group();
  const chunks: Chunk[] = [];
  let transform: ReturnType<typeof normaliseTransform> | null = null;
  const def = MODELS[id];
  if (placements.length > 0) {
    void loadModelOrWarn(id, def?.label).then((gltf) => {
      if (!gltf || !def) return;
      transform = normaliseTransform(gltf.scene, def);
      const parts = firstMeshes(gltf.scene).map((src) => {
        let mat = (Array.isArray(src.material) ? src.material[0] : src.material) as MeshStandardMaterial;
        if (opts.patch && mat) mat = mat.clone();
        if (opts.wind && mat && 'emissive' in mat) patchWind(mat, opts.wind);
        if (mat && 'metalness' in mat && !mat.map) mat.metalness = 0;
        const geo = src.geometry.clone();
        // Bake the mesh's own transform inside the file (Meshy exports usually have one node, but not always).
        src.updateWorldMatrix(true, false);
        geo.applyMatrix4(src.matrixWorld);
        if (!geo.attributes.normal) geo.computeVertexNormals();
        if (opts.patch && mat) { geo.computeBoundingBox(); opts.patch(mat, geo); }
        return { geo, mat };
      });
      // Moving sets (drifting leaves, jellyfish) stay one chunk; static ones are split into cells.
      const cells = new Map<string, Placement[]>();
      for (const p of placements) {
        const key = opts.update ? 'all' : `${Math.floor(p.x / CELL)},${Math.floor(p.z / CELL)}`;
        let list = cells.get(key);
        if (!list) cells.set(key, (list = []));
        list.push(p);
      }
      const shadows = opts.shadows ?? def.height * Math.max(...placements.map((p) => p.scale)) >= SHADOW_HEIGHT;
      for (const items of cells.values()) {
        const chunk: Chunk = { items, meshes: [] };
        for (const { geo, mat } of parts) {
          const inst = new InstancedMesh(geo, mat, items.length);
          inst.castShadow = shadows;
          if (opts.update) inst.frustumCulled = false;
          inst.receiveShadow = shadows;
          chunk.meshes.push(inst);
          group.add(inst);
        }
        writeMatrices(chunk, transform.scale, transform.offset, transform.yaw);
        chunks.push(chunk);
      }
    });
  }
  let t = 0;
  return {
    group,
    update(dt) {
      if (!opts.update || !transform) return;
      t += dt;
      if (opts.update(t, placements)) for (const c of chunks) writeMatrices(c, transform.scale, transform.offset, transform.yaw, false);
    },
  };
}

/** Cobblestone placements along a polyline street of the given width. */
export function cobbleSpots(points: Array<[number, number]>, width: number, heightAt: (x: number, z: number) => number, rnd: () => number): Placement[] {
  const out: Placement[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const [ax, az] = points[i];
    const [bx, bz] = points[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.floor(len * width * 0.9);
    for (let k = 0; k < n; k++) {
      const t = rnd();
      const side = (rnd() - 0.5) * width;
      const nx = -(bz - az) / len;
      const nz = (bx - ax) / len;
      const x = ax + (bx - ax) * t + nx * side;
      const z = az + (bz - az) * t + nz * side;
      out.push({ x, y: heightAt(x, z) + 0.02, z, yaw: rnd() * Math.PI * 2, scale: 0.7 + rnd() * 0.6 });
    }
  }
  return out;
}

/** Points around a circle, used for rings of trees. */
export function ringSpots(cx: number, cz: number, radius: number, count: number, heightAt: (x: number, z: number) => number, rnd: () => number, dy = -0.3): Placement[] {
  const out: Placement[] = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rnd() * 0.3;
    const x = cx + Math.cos(a) * radius * (0.9 + rnd() * 0.2);
    const z = cz + Math.sin(a) * radius * (0.9 + rnd() * 0.2);
    out.push({ x, y: heightAt(x, z) + dy, z, yaw: rnd() * Math.PI * 2, scale: 0.9 + rnd() * 0.5 });
  }
  return out;
}

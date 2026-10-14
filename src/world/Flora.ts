/**
 * Flora and small decor: one Meshy model instanced over a set of placements. The scatter helpers in World
 * decide where things grow; this file only turns a loaded GLB into InstancedMeshes (one per mesh in the
 * file). A missing file leaves the set empty and warns once.
 */
import { Group, InstancedMesh, Matrix4, Object3D, type MeshStandardMaterial } from 'three';
import { MODELS } from '../data/models';
import { firstMeshes, loadModelOrWarn, normaliseTransform } from '../models/ModelRig';
import { patchWind } from '../render/Materials';

export interface Placement { x: number; y: number; z: number; yaw: number; scale: number }

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
}

const dummy = new Object3D();
const local = new Matrix4();

function writeMatrices(meshes: InstancedMesh[], placements: Placement[], scale: number, offset: { x: number; y: number; z: number }, yaw: number): void {
  for (let i = 0; i < placements.length; i++) {
    const p = placements[i];
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, p.yaw + yaw, 0);
    dummy.scale.setScalar(p.scale);
    dummy.updateMatrix();
    local.makeTranslation(offset.x, offset.y, offset.z).multiply(new Matrix4().makeScale(scale, scale, scale));
    dummy.matrix.multiply(local);
    for (const m of meshes) m.setMatrixAt(i, dummy.matrix);
  }
  for (const m of meshes) m.instanceMatrix.needsUpdate = true;
}

/** Instances model `id` at every placement (placement scale multiplies the registry height). */
export function floraSet(id: string, placements: Placement[], opts: FloraOptions = {}): FloraSet {
  const group = new Group();
  let meshes: InstancedMesh[] = [];
  let transform: ReturnType<typeof normaliseTransform> | null = null;
  const def = MODELS[id];
  if (placements.length > 0) {
    void loadModelOrWarn(id, def?.label).then((gltf) => {
      if (!gltf || !def) return;
      transform = normaliseTransform(gltf.scene, def);
      for (const src of firstMeshes(gltf.scene)) {
        const mat = (Array.isArray(src.material) ? src.material[0] : src.material) as MeshStandardMaterial;
        if (opts.wind && mat && 'emissive' in mat) patchWind(mat, opts.wind);
        const geo = src.geometry.clone();
        // Bake the mesh's own transform inside the file (Meshy exports usually have one node, but not always).
        src.updateWorldMatrix(true, false);
        geo.applyMatrix4(src.matrixWorld);
        const inst = new InstancedMesh(geo, mat, placements.length);
        inst.frustumCulled = false;
        inst.castShadow = opts.shadows ?? true;
        inst.receiveShadow = opts.shadows ?? true;
        meshes.push(inst);
        group.add(inst);
      }
      writeMatrices(meshes, placements, transform.scale, transform.offset, transform.yaw);
    });
  }
  let t = 0;
  return {
    group,
    update(dt) {
      if (!opts.update || !transform) return;
      t += dt;
      if (opts.update(t, placements)) writeMatrices(meshes, placements, transform.scale, transform.offset, transform.yaw);
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

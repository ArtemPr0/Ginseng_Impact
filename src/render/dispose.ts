import type { Material, Mesh, Object3D, Sprite } from 'three';

/**
 * Frees what a throwaway effect allocated on the GPU (its geometries and materials; textures are shared and kept).
 * Sprites share one geometry inside three.js, so only their materials go. `keepGeometry` for clones that share
 * their geometry with a cached model (enemy bodies, thrown Meshy props).
 */
export function disposeObject(root: Object3D, keepGeometry = false): void {
  root.traverse((o) => {
    const m = o as Mesh;
    if (!m.isMesh && !(o as Sprite).isSprite && !(o as { isPoints?: boolean }).isPoints) return;
    if (!keepGeometry && !(o as Sprite).isSprite) m.geometry?.dispose();
    const mat = m.material as Material | Material[] | undefined;
    if (Array.isArray(mat)) for (const x of mat) x.dispose();
    else mat?.dispose();
  });
}

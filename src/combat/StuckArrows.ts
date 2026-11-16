/**
 * Arrows that stay in what they hit (the user's request of 2026-11-16: "when archer shoots, there should be arrows
 * stuck to the mob as well so it looks realistic"). Each arrow is lodged half its length into the body where the shot
 * met it, pointing along the shot, riding the bone nearest that point so it moves with the body; MAX_STUCK per body, the
 * oldest falling out; all gone when the body burns away or comes back.
 */
import { Matrix4, Quaternion, Vector3, type Group, type Object3D } from 'three';
import { spentArrow } from '../render/ArrowMesh';

/** A real arrow's length (m). */
export const ARROW_LEN = 0.75;
export const MAX_STUCK = 10;

/** Where a shot from `from` meets a body standing at `pos` (radius `r`, height `h`): its surface on the shot side. */
export function entryPoint(pos: { x: number; y: number; z: number }, r: number, h: number, from: Vector3): Vector3 {
  const y = Math.min(pos.y + h * 0.95, Math.max(pos.y + h * 0.1, from.y));
  let dx = from.x - pos.x, dz = from.z - pos.z;
  const l = Math.hypot(dx, dz) || 1;
  dx /= l; dz /= l;
  return new Vector3(pos.x + dx * r * 0.85, y, pos.z + dz * r * 0.85);
}

const _m = new Matrix4(), _inv = new Matrix4(), _q = new Quaternion(), _s = new Vector3(1, 1, 1), _b = new Vector3(), _c = new Vector3(), _s2 = new Vector3(), _z = new Vector3(0, 0, 1);

export class StuckArrows {
  private readonly byBody = new Map<string | number, Group[]>();

  count(id: string | number): number { return this.byBody.get(id)?.length ?? 0; }

  /**
   * Lodges an arrow at `hit` along `dir` on the bone of `bones` nearest it, no further than `reach` from that bone (a
   * shot that passed over a bent back is pulled in to it). Null with no bones.
   */
  stick(id: string | number, bones: Object3D[], hit: Vector3, dir: Vector3, reach = Infinity): Group | null {
    let bone: Object3D | null = null, bd = Infinity;
    for (const b of bones) {
      // (A bone shrunk to nothing — a limb torn off, and all under it — holds nothing.)
      if (b.getWorldScale(_b).x < 1e-3 * (bones[0].parent?.getWorldScale(_s2).x ?? 1)) continue;
      const d = b.getWorldPosition(_b).distanceToSquared(hit);
      if (d < bd) { bd = d; bone = b; }
    }
    if (!bone) return null;
    if (bd > reach * reach) hit = bone.getWorldPosition(_b).add(_c.copy(hit).sub(_b).setLength(reach)).clone();
    const a = spentArrow(ARROW_LEN);
    _q.setFromUnitVectors(_z, _b.copy(dir).normalize());
    // Wanted world pose, brought into the bone's frame (its scale undone: a 0.01-scaled rig still holds a real arrow).
    _m.compose(hit, _q, _s);
    bone.updateWorldMatrix(true, false);
    _inv.copy(bone.matrixWorld).invert();
    _m.premultiply(_inv);
    _m.decompose(a.position, a.quaternion, a.scale);
    bone.add(a);
    let list = this.byBody.get(id);
    if (!list) { list = []; this.byBody.set(id, list); }
    list.push(a);
    while (list.length > MAX_STUCK) list.shift()!.removeFromParent();
    return a;
  }

  clear(id: string | number): void {
    for (const a of this.byBody.get(id) ?? []) a.removeFromParent();
    this.byBody.delete(id);
  }
}

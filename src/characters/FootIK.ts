/**
 * Feet on the ground they stand on (v12 polish, 2026-11-16). The clips are authored on flat ground and the controller
 * stands the body on the ground under its middle, so across a slope or a step one foot hangs in the air and the other
 * sinks. Each frame (Rig.plantFeet) the hips drop to the lower foot's ground and the other leg bends up to its own:
 * `footPlan` says how far, `legIK` turns the thigh and the shin (world-space rotations, two-bone law of cosines).
 * Pure: three's maths only.
 */
import { Quaternion, Vector3 } from 'three';

const _a = new Vector3(), _b = new Vector3(), _c = new Vector3(), _n = new Vector3(), _t = new Vector3();

/** The angle at the knee between the thigh (toward the hip) and the shin (toward the ankle). */
function kneeAngle(hip: Vector3, knee: Vector3, ankle: Vector3): number {
  return _a.copy(hip).sub(knee).angleTo(_b.copy(ankle).sub(knee));
}

/**
 * World-space turns that bring the ankle to `target`: `lower` turns the shin about the knee (applied first, in the
 * shin's frame of the world), `upper` turns the whole leg about the hip. `side` is the axis a straight leg bends about
 * (the knee goes forward: side = forward × down-the-leg). A target out of reach straightens the leg toward it.
 */
export function legIK(hip: Vector3, knee: Vector3, ankle: Vector3, target: Vector3, side: Vector3): { upper: Quaternion; lower: Quaternion } {
  const l1 = hip.distanceTo(knee), l2 = knee.distanceTo(ankle);
  const d = Math.max(Math.abs(l1 - l2) + 1e-4, Math.min(l1 + l2 - 1e-4, hip.distanceTo(target)));
  const want = Math.acos(Math.max(-1, Math.min(1, (l1 * l1 + l2 * l2 - d * d) / (2 * l1 * l2))));
  const cur = kneeAngle(hip, knee, ankle);
  // The plane the leg bends in (a straight leg: about its side axis).
  _n.copy(knee).sub(hip).cross(_c.copy(ankle).sub(knee));
  if (_n.lengthSq() < 1e-10) _n.copy(side);
  _n.normalize();
  // Turning the shin one way or the other about that axis: keep the one that reaches the wanted knee angle.
  const shin = _c.copy(ankle).sub(knee);
  const lower = new Quaternion().setFromAxisAngle(_n, cur - want);
  _t.copy(shin).applyQuaternion(lower).add(knee);
  if (Math.abs(kneeAngle(hip, knee, _t) - want) > 1e-4) {
    lower.setFromAxisAngle(_n, want - cur);
    _t.copy(shin).applyQuaternion(lower).add(knee);
  }
  // Then the leg swings about the hip so the ankle lands on the target.
  const upper = new Quaternion().setFromUnitVectors(_a.copy(_t).sub(hip).normalize(), _b.copy(target).sub(hip).normalize());
  return { upper, lower };
}

/**
 * How far the hips drop (≤ 0) and each foot rises (≥ 0) for feet whose ground is `groundL`, `groundR` with the body
 * standing at `rootY`: the hips go down to the lower foot's ground (at most `maxDrop`), each foot up to its own. A foot
 * whose ground is more than `maxRaise` above that (a wall, a ledge) or below the drop (a hole) is left as the clip has it.
 */
export function footPlan(rootY: number, groundL: number, groundR: number, maxDrop: number, maxRaise: number): { drop: number; raiseL: number; raiseR: number } {
  const offL = groundL - rootY, offR = groundR - rootY;
  const drop = Math.max(-maxDrop, Math.min(0, offL, offR));
  const raise = (off: number): number => {
    const r = off - drop;
    return r > 0 && r <= maxRaise ? r : 0;
  };
  return { drop: drop === 0 ? 0 : drop, raiseL: raise(offL), raiseR: raise(offR) };
}

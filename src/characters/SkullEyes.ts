import { Matrix4, Vector3 } from 'three';

/** Where a skull's eye sockets are from its head joint (metres, the body facing forward): ahead, up, and apart. */
export const SOCKET = { forward: 0.09, up: 0.085, apart: 0.032 } as const;

/**
 * The two eye sockets in the head bone's own frame, from the bone's world matrix at bind (`bind`) and the body's facing
 * then (`yaw`: forward is (cos yaw, 0, sin yaw)). Carried by the bone afterwards (bone.localToWorld), the eyes stay in
 * the sockets whatever the head does, and whichever way the bone's own axes run.
 */
export function socketsInBone(bind: Matrix4, yaw: number): Vector3[] {
  const at = new Vector3().setFromMatrixPosition(bind);
  const inv = bind.clone().invert();
  const fx = Math.cos(yaw), fz = Math.sin(yaw);
  return [-1, 1].map((side) => new Vector3(
    at.x + fx * SOCKET.forward + fz * side * SOCKET.apart,
    at.y + SOCKET.up,
    at.z + fz * SOCKET.forward - fx * side * SOCKET.apart,
  ).applyMatrix4(inv));
}

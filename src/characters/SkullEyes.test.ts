import { describe, expect, it } from 'vitest';
import { Bone, Matrix4, Quaternion, Vector3 } from 'three';
import { SOCKET, socketsInBone } from './SkullEyes';

describe('a skull\'s eyes sit in its sockets and turn with its head', () => {
  // A head bone 1.6 m up, its own axes turned 90° about x (as Mixamo-style bones are), at bind facing +x (yaw 0).
  const head = new Bone();
  head.position.set(2, 1.6, 3);
  head.quaternion.setFromAxisAngle(new Vector3(1, 0, 0), Math.PI / 2);
  head.updateMatrixWorld(true);
  const bind = head.matrixWorld.clone();
  const local = socketsInBone(bind, 0);

  it('at bind they are in front of and above the head joint, either side', () => {
    const w = local.map((l) => l.clone().applyMatrix4(bind));
    for (const p of w) {
      expect(p.x - 2).toBeCloseTo(SOCKET.forward, 6);
      expect(p.y - 1.6).toBeCloseTo(SOCKET.up, 6);
    }
    expect(Math.abs(w[0].z - w[1].z)).toBeCloseTo(SOCKET.apart * 2, 6);
  });

  it('when the head turns away from the body, the eyes go with the face, not with the body', () => {
    head.quaternion.premultiply(new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2));
    head.updateMatrixWorld(true);
    const w = local.map((l) => l.clone().applyMatrix4(head.matrixWorld));
    // Turned 90° left (about +y), the face looks along -z: the eyes are in front of it there.
    for (const p of w) { expect(p.z - 3).toBeCloseTo(-SOCKET.forward, 6); expect(p.x - 2).toBeCloseTo(0, 1); }
  });

  it('works for a scaled armature (bones in centimetres)', () => {
    const m = new Matrix4().compose(new Vector3(0, 1, 0), new Quaternion(), new Vector3(0.01, 0.01, 0.01));
    const l = socketsInBone(m, Math.PI / 2);
    const p = l[0].clone().applyMatrix4(m);
    expect(p.z).toBeCloseTo(SOCKET.forward, 6);
  });
});

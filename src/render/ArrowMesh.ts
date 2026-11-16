/**
 * A plain arrow as it lies in a body (StuckArrows): a wooden shaft along +z centred on the origin, a dark steel head at
 * +z, two pale fletching vanes at −z. No glow: a spent arrow. Geometry and materials are shared by every copy.
 */
import { BoxGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshStandardMaterial } from 'three';

let parts: Array<{ geo: CylinderGeometry | ConeGeometry | BoxGeometry; mat: MeshStandardMaterial; z: number; rz: number; rx: number }> | null = null;

/** A real arrow `len` long (m). */
export function spentArrow(len: number): Group {
  if (!parts) {
    const wood = new MeshStandardMaterial({ color: 0x7a5a3a, roughness: 0.85 });
    const steel = new MeshStandardMaterial({ color: 0x3a3e48, roughness: 0.45, metalness: 0.7 });
    const feather = new MeshStandardMaterial({ color: 0xd8d4cc, roughness: 0.95 });
    parts = [
      { geo: new CylinderGeometry(0.0045, 0.0045, 1, 5), mat: wood, z: 0, rz: 0, rx: Math.PI / 2 },
      { geo: new ConeGeometry(0.011, 0.06, 4), mat: steel, z: 0.5, rz: 0, rx: Math.PI / 2 },
      { geo: new BoxGeometry(0.002, 0.022, 0.13), mat: feather, z: -0.42, rz: 0, rx: 0 },
      { geo: new BoxGeometry(0.002, 0.022, 0.13), mat: feather, z: -0.42, rz: Math.PI / 2, rx: 0 },
    ];
  }
  const g = new Group();
  for (const p of parts) {
    const m = new Mesh(p.geo, p.mat);
    m.rotation.set(p.rx, 0, p.rz);
    // (The shaft is 1 long scaled to len; the head and vanes keep their real size, only their place scales.)
    if (p.rx && p.geo instanceof CylinderGeometry) m.scale.set(1, len, 1);
    m.position.z = p.z * len;
    m.castShadow = false;
    g.add(m);
  }
  g.name = 'arrow:stuck';
  return g;
}

/**
 * Wood, planks and stone on the ground (the knight's harvest, world/Harvest): a short split log, a board and a rough
 * chunk, in the same break materials as the rubble they came off (BreakMaterial), so they read as pieces of it.
 */
import { BoxGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh } from 'three';
import { breakMaterial } from './BreakMaterial';

let geo: { log: CylinderGeometry; plank: BoxGeometry; stone: DodecahedronGeometry } | null = null;

export function harvestLook(kind: 'log' | 'stone' | 'plank'): Group {
  if (!geo) {
    const stone = new DodecahedronGeometry(0.2, 0);
    // A rough chunk, not a gem: squashed and pushed about a little per corner.
    const p = stone.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (1 + Math.sin(i * 7.3) * 0.15), p.getY(i) * 0.7, p.getZ(i) * (1 + Math.cos(i * 3.1) * 0.15));
    stone.computeVertexNormals();
    geo = { log: new CylinderGeometry(0.11, 0.12, 0.6, 9).rotateZ(Math.PI / 2), plank: new BoxGeometry(0.7, 0.04, 0.16), stone };
  }
  const g = new Group();
  const m = new Mesh(geo[kind], breakMaterial(kind === 'stone' ? 'stone' : 'wood'));
  m.castShadow = true;
  m.userData.shared = true;
  if (kind === 'plank') m.rotation.z = 0.35;
  g.add(m);
  return g;
}

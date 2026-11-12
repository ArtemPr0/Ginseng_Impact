import { CylinderGeometry, Group, Mesh, MeshStandardMaterial, SphereGeometry, Vector3 } from 'three';

/** A rolled blunt (metres): its length, the mouth end's and the lit end's radius. */
export const BLUNT = { length: 0.11, baseR: 0.0065, tipR: 0.0085 } as const;

/**
 * The Skeleton Lord's blunt, built in code (the user's call, 2026-11-12: no Meshy model for it): a brown leaf wrap
 * lying along +x from the fingers (x 0) to the lit end (x = length), a grey ash cap and a glowing orange ember there.
 * `ember` is the lit end's point, for its glow and its smoke.
 */
export function blunt(): { object: Group; ember: Vector3 } {
  const g = new Group();
  const wrap = new Mesh(new CylinderGeometry(BLUNT.tipR, BLUNT.baseR, BLUNT.length, 10), new MeshStandardMaterial({ color: 0x5a3a1e, roughness: 0.9 }));
  wrap.rotation.z = -Math.PI / 2;
  wrap.position.x = BLUNT.length / 2;
  const ash = new Mesh(new CylinderGeometry(BLUNT.tipR * 0.95, BLUNT.tipR, 0.006, 10), new MeshStandardMaterial({ color: 0x8a8580, roughness: 1 }));
  ash.rotation.z = -Math.PI / 2;
  ash.position.x = BLUNT.length - 0.003;
  const ember = new Mesh(new SphereGeometry(BLUNT.tipR * 0.75, 8, 6), new MeshStandardMaterial({ color: 0xff7a2a, emissive: 0xff5a10, emissiveIntensity: 2.2 }));
  ember.position.x = BLUNT.length;
  g.add(wrap, ash, ember);
  return { object: g, ember: new Vector3(BLUNT.length, 0, 0) };
}

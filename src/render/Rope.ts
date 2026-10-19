/**
 * A rope slung between two points, sagging under its own weight (a parabola close enough to the catenary at these
 * spans): a thin tube, and the point at any fraction along it so things can hang from it (the mushroom tavern's lamps).
 */
import { CatmullRomCurve3, Mesh, MeshStandardMaterial, TubeGeometry, Vector3 } from 'three';

const ROPE = new MeshStandardMaterial({ color: 0x3a2a1c, roughness: 0.95, metalness: 0 });

export interface Rope {
  mesh: Mesh;
  /** World point `t` (0..1) of the way from `a` to `b`, on the sagging rope. */
  at(t: number): Vector3;
}

export function rope(a: Vector3, b: Vector3, sag: number, radius = 0.025): Rope {
  const at = (t: number) => new Vector3().lerpVectors(a, b, t).setY(a.y + (b.y - a.y) * t - sag * 4 * t * (1 - t));
  const pts: Vector3[] = [];
  for (let i = 0; i <= 12; i++) pts.push(at(i / 12));
  const mesh = new Mesh(new TubeGeometry(new CatmullRomCurve3(pts), 24, radius, 5, false), ROPE);
  mesh.castShadow = false;
  return { mesh, at };
}

/** A short cord hanging straight down from `top` by `length` (a lamp's hook). */
export function cord(top: Vector3, length: number, radius = 0.012): Mesh {
  return rope(top, top.clone().setY(top.y - length), 0, radius).mesh;
}

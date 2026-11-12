/**
 * A lying creature that watches you (the lean dragons): its body shifts round toward you, within `body` radians of
 * where it lay (`home`), and its neck (Materials.patchNeckTurn) turns its head the rest, within `neck`. Angles are
 * directions from +x toward +z (World's `face(dir)` convention); the head looks `look` radians off the body's line.
 * The neck's value is patchNeckTurn's: positive turns the head toward the model's +x, which is a smaller direction.
 */
export interface Gaze { body: number; neck: number }

export function gazeStep(g: Gaze, at: { x: number; z: number }, player: { x: number; z: number }, dt: number, o: { home: number; look: number; reach: number; body: number; neck: number }): Gaze {
  const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
  const near = Math.hypot(player.x - at.x, player.z - at.z) < o.reach;
  const toward = Math.atan2(player.z - at.z, player.x - at.x) - o.look;
  const off = near ? wrap(toward - o.home) : 0;
  const bodyWant = o.home + Math.max(-o.body, Math.min(o.body, off));
  const body = g.body + wrap(bodyWant - g.body) * Math.min(1, dt * 0.5);
  const neckWant = near ? Math.max(-o.neck, Math.min(o.neck, -wrap(toward - body))) : 0;
  const neck = g.neck + (neckWant - g.neck) * Math.min(1, dt * 2);
  return { body, neck };
}

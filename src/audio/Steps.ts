/** Footsteps (quality pass of 2026-11-16): which recorded take a step on the ground under the foot uses, and when. */
import { LAYER } from '../render/Ground';

export type Surface = 'grass' | 'stone' | 'wood' | 'snow';

/** `weights`: the ground's texture layers at the foot (null off the island's ground); `built`: on a collider. */
export function surfaceOf(weights: ArrayLike<number> | null, built: boolean): Surface {
  if (built) return 'stone';
  if (!weights) return 'grass';
  const stone = weights[LAYER.rock] + weights[LAYER.flagstone] + weights[LAYER.cobble] + weights[LAYER.marble];
  const snow = weights[LAYER.snow];
  const soft = weights[LAYER.grass] + weights[LAYER.moss] + weights[LAYER.soil] + weights[LAYER.sand] + weights[LAYER.dead];
  if (snow >= stone && snow >= soft && snow > 0) return 'snow';
  if (stone > soft) return 'stone';
  return 'grass';
}

/** Counts distance walked on the ground; true on the frame a foot lands (one stride: 0.7 m walking, 1.3 m sprinting). */
export class StepClock {
  private d = 0;

  update(dt: number, speed: number, grounded: boolean): boolean {
    if (!grounded || speed < 0.4) { this.d = 0; return false; }
    const stride = 0.55 + Math.min(0.8, speed * 0.1);
    this.d += speed * dt;
    if (this.d < stride) return false;
    this.d -= stride;
    return true;
  }
}

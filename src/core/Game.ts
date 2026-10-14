export interface System {
  /** Fixed-step update, dt in seconds (always FIXED_DT). */
  update?(dt: number): void;
  /** Per-frame, alpha = interpolation factor into the next fixed step. */
  render?(alpha: number, dt: number): void;
}

export const FIXED_DT = 1 / 60;
const MAX_FRAME = 0.1;

/** Fixed-timestep loop with variable-rate rendering. Pauses when the tab is hidden. */
export class Game {
  private readonly systems: System[] = [];
  private accumulator = 0;
  private last = 0;
  private running = false;
  paused = false;

  add(system: System): this {
    this.systems.push(system);
    return this;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.last = performance.now();
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.last = 0;
    });
    requestAnimationFrame(this.frame);
  }

  private frame = (now: number): void => {
    if (!this.running) return;
    if (this.last === 0) this.last = now;
    const frameDt = Math.min(MAX_FRAME, (now - this.last) / 1000);
    this.last = now;
    if (!this.paused) {
      this.accumulator += frameDt;
      while (this.accumulator >= FIXED_DT) {
        for (const s of this.systems) s.update?.(FIXED_DT);
        this.accumulator -= FIXED_DT;
      }
    }
    const alpha = this.accumulator / FIXED_DT;
    for (const s of this.systems) s.render?.(alpha, frameDt);
    requestAnimationFrame(this.frame);
  };
}

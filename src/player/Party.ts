export interface SwapEvent { from: number; to: number }

/** Active-member bookkeeping for a party of up to 4. Pure; the scene listens for swaps. */
export class Party<T extends { id: string }> {
  static readonly cooldown = 0.35;
  activeIndex = 0;
  private cooldownLeft = 0;

  constructor(readonly members: readonly T[]) {
    if (members.length === 0) throw new Error('Party needs at least one member');
  }

  get active(): T {
    return this.members[this.activeIndex];
  }

  update(dt: number): void {
    this.cooldownLeft = Math.max(0, this.cooldownLeft - dt);
  }

  /**
   * Switches to `index`. `allowed` (the scene's: a hero at 0 HP is not sent back in) can veto it; it is asked only about
   * another member in range, off cooldown. A refusal starts no cooldown.
   */
  switchTo(index: number, allowed?: (index: number) => boolean): SwapEvent | null {
    if (index === this.activeIndex || index < 0 || index >= this.members.length || this.cooldownLeft > 0) return null;
    if (allowed && !allowed(index)) return null;
    const ev = { from: this.activeIndex, to: index };
    this.activeIndex = index;
    this.cooldownLeft = Party.cooldown;
    return ev;
  }
}

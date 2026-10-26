export type EnemyState = 'idle' | 'chase' | 'windup' | 'attack' | 'recover' | 'dead';

export interface BrainParams {
  aggroRange: number;
  attackRange: number;
  windup: number;
  recover: number;
  attackCooldown: number;
  /** Ranged enemies keep at least this distance (0 for melee). */
  preferredRange?: number;
}

/** Enemy decision state machine. Pure: fed the distance to the player each step. 'attack' is emitted for exactly one step. */
export class EnemyBrain {
  state: EnemyState = 'idle';
  stateTime = 0;
  private cooldown = 0;

  constructor(readonly p: BrainParams) {}

  get cooldownLeft(): number {
    return this.cooldown;
  }

  /** 0..1 of the wind-up behind it (0 outside one): its warning's fill, which reaches 1 as the blow lands. */
  get windupFill(): number {
    return this.state === 'windup' ? Math.min(1, this.stateTime / Math.max(1e-6, this.p.windup)) : 0;
  }

  private go(s: EnemyState): void {
    this.state = s;
    this.stateTime = 0;
  }

  kill(): void {
    this.go('dead');
  }

  /**
   * One step. In reach and cooled down, it winds up only if `canAttack` (asked then, and only then) lets it: a pack
   * shares a few attack tokens (AttackTokens), and one without a token stays in 'chase' until a striker is done.
   */
  update(dt: number, distance: number, canAttack?: () => boolean): EnemyState {
    this.stateTime += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    switch (this.state) {
      case 'idle':
        if (distance <= this.p.aggroRange) this.go('chase');
        break;
      case 'chase':
        if (distance > this.p.aggroRange * 1.6) this.go('idle');
        else if (distance <= this.p.attackRange && this.cooldown <= 0 && (canAttack?.() ?? true)) this.go('windup');
        break;
      case 'windup':
        if (this.stateTime >= this.p.windup) {
          this.go('attack');
          return 'attack';
        }
        break;
      case 'attack':
        this.cooldown = this.p.attackCooldown;
        this.go('recover');
        break;
      case 'recover':
        if (this.stateTime >= this.p.recover) this.go('chase');
        break;
      case 'dead':
        break;
    }
    return this.state;
  }
}

/**
 * Turns at striking: at most `max` holders at once (the melee mobs round the hero, so a pack takes turns instead of
 * swarming). A mob takes a token as it starts its wind-up (EnemyBrain.update's canAttack) and gives it back once its
 * blow is done: settle() each step lets go of every holder no longer winding up or striking (recovering, dead, gone
 * home, dazed off it).
 */
export class AttackTokens<T = number> {
  private readonly holders = new Set<T>();

  constructor(readonly max = 2) {}

  /** True when `who` holds a token, or one is free for it. */
  free(who: T): boolean {
    return this.holders.has(who) || this.holders.size < this.max;
  }

  /** Takes a token for `who` (or keeps the one it holds); false when none is free. */
  take(who: T): boolean {
    if (!this.free(who)) return false;
    this.holders.add(who);
    return true;
  }

  /** Gives back the token `who` holds, if any. */
  give(who: T): void {
    this.holders.delete(who);
  }

  /** Gives back every token whose holder `striking` says is no longer winding up or striking. */
  settle(striking: (who: T) => boolean): void {
    for (const who of this.holders) if (!striking(who)) this.holders.delete(who);
  }

  /** Lets every holder go (a wipe, the hero through a portal). */
  clear(): void {
    this.holders.clear();
  }

  /** Tokens held now. */
  get held(): number {
    return this.holders.size;
  }

  /** Whether `who` holds one. */
  holds(who: T): boolean {
    return this.holders.has(who);
  }
}

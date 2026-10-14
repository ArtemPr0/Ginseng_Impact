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

  private go(s: EnemyState): void {
    this.state = s;
    this.stateTime = 0;
  }

  kill(): void {
    this.go('dead');
  }

  update(dt: number, distance: number): EnemyState {
    this.stateTime += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    switch (this.state) {
      case 'idle':
        if (distance <= this.p.aggroRange) this.go('chase');
        break;
      case 'chase':
        if (distance > this.p.aggroRange * 1.6) this.go('idle');
        else if (distance <= this.p.attackRange && this.cooldown <= 0) this.go('windup');
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
